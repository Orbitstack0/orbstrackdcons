/**
 * Decolar Consórcios — admin-editor.js
 * Lógica exclusiva da interface do editor de artigos (admin/artigo-editor.html).
 *
 * "Salvar rascunho" grava status='draft'. "Publicar" (Etapa 2B) exige
 * confirmação explícita, valida título/resumo/categoria/autor/conteúdo,
 * grava status='published' e published_at com a data/hora reais da
 * publicação, e trava os dois botões ao concluir — nesta etapa não existe
 * caminho de código para editar ou republicar um artigo já publicado
 * (loadExistingArticle recusa carregá-lo para edição).
 *
 * Segurança: a única chave usada é a publicável (anon), já carregada por
 * admin-supabase-client.js — nenhuma Secret Key/Service Role entra aqui. A
 * barreira real continua sendo a RLS de blog_articles e das políticas do
 * bucket blog-covers; este arquivo só evita gravações claramente inválidas
 * antes de chegar lá (validação de conveniência, não de segurança).
 *
 * O HTML do conteúdo vem do Quill (quill.getSemanticHTML()) e, antes de ir
 * para a tela OU para o banco, sempre passa por DOMPurify com a mesma
 * lista branca de tags/atributos/protocolos — nunca confiamos no HTML
 * exportado do editor sem sanitizar (mitigação recomendada pelo advisory
 * conhecido do Quill, GHSA-v3m3-f69x-jf25, sem correção publicada até esta
 * implementação).
 *
 * Etapa 2A: tipo de artigo ("equipe" x "visitante"). É só uma escolha
 * visual/editorial — nunca uma conta ou permissão separada. No modo
 * visitante, o Autor passa a ser digitado manualmente (nome de quem
 * escreveu), e o perfil ativo é gravado em `reviewer_name` como
 * responsável pela revisão — um registro editorial, não uma identidade
 * individual verificada (os perfis compartilham a mesma conta Supabase).
 * Registros sem `article_type` (artigos antigos) são tratados como
 * "equipe" por padrão, tanto no banco (coluna com default) quanto na
 * leitura aqui no editor.
 */
document.addEventListener('DOMContentLoaded', () => {
  const loadingState = document.getElementById('admin-loading-state');
  const errorState = document.getElementById('admin-error-state');
  const retryBtn = document.getElementById('admin-retry-btn');
  const shell = document.getElementById('admin-shell');
  const logoutBtn = document.getElementById('admin-logout-btn');
  const switchProfileBtn = document.getElementById('admin-switch-profile-btn');
  const userEmailEl = document.getElementById('admin-user-email');

  const articleErrorState = document.getElementById('admin-article-error-state');
  const articleErrorTitleEl = document.getElementById('admin-article-error-title');
  const articleErrorTextEl = document.getElementById('admin-article-error-text');
  const articleRetryBtn = document.getElementById('admin-article-retry-btn');

  const guard = window.DecolarAdminGuard;
  const profileApi = window.DecolarAdminProfile;
  // Rota-ciente: '.html' no desenvolvimento local (Live Server), rota
  // limpa em produção (GitHub Pages, servida a partir de dist/).
  const SELECT_PROFILE_PAGE = window.location.pathname.endsWith('.html') ? 'selecionar-perfil.html' : '/admin/selecionar-perfil/';

  // --------------------------------------------------------------------
  // Proteção de acesso — idêntica ao padrão já usado em admin/index.html.
  // Nenhum campo do editor aparece antes da autorização ser confirmada E
  // de haver um perfil visual selecionado nesta sessão.
  // --------------------------------------------------------------------
  function showLoading() {
    if (loadingState) loadingState.hidden = false;
    if (errorState) errorState.hidden = true;
    if (articleErrorState) articleErrorState.hidden = true;
    if (shell) shell.hidden = true;
  }

  function showError() {
    if (loadingState) loadingState.hidden = true;
    if (errorState) errorState.hidden = false;
    if (articleErrorState) articleErrorState.hidden = true;
    if (shell) shell.hidden = true;
  }

  function showEditor(user, profile) {
    if (loadingState) loadingState.hidden = true;
    if (errorState) errorState.hidden = true;
    if (shell) shell.hidden = false;
    if (userEmailEl) userEmailEl.textContent = (user && user.email) || '';

    // Preenche o Autor com o nome completo do perfil ativo, só na criação
    // de um artigo novo (sem ?id= na URL), no modo "equipe" (padrão), e sem
    // sobrescrever algo que já tenha sido digitado. Em edição, a autoria
    // original é carregada à parte por loadExistingArticle().
    if (!articleId && articleType === 'team' && authorInput && profile && !authorInput.value.trim()) {
      authorInput.value = profile.fullName;
      updatePreview();
    }

    if (articleId) loadExistingArticle(articleId);
  }

  function runAccessCheck() {
    if (!guard || !profileApi) {
      showError();
      return;
    }
    showLoading();
    guard
      .requireAdmin()
      .then((result) => {
        // requireProfile() redireciona por conta própria para
        // selecionar-perfil.html quando não há perfil ainda nesta sessão;
        // nesse caso devolve null e o shell permanece oculto.
        const profile = profileApi.requireProfile();
        if (!profile) return;
        showEditor(result && result.user, profile);
      })
      .catch(() => showError());
  }

  if (retryBtn) retryBtn.addEventListener('click', runAccessCheck);
  if (logoutBtn) logoutBtn.addEventListener('click', () => { if (guard) guard.logout(); });
  if (switchProfileBtn) {
    switchProfileBtn.addEventListener('click', () => {
      if (profileApi) profileApi.clearSelectedProfile();
      window.location.replace(SELECT_PROFILE_PAGE);
    });
  }

  // --------------------------------------------------------------------
  // Formulário e pré-visualização
  // --------------------------------------------------------------------
  const CATEGORY_LABELS = {
    entenda: 'Entenda o Consórcio',
    lances: 'Lances e Contemplação',
    imoveis: 'Imóveis',
    veiculos: 'Veículos',
    pesados: 'Pesados',
    seguranca: 'Segurança e Planejamento',
    mercado: 'Mercado e Atualidade',
  };

  const titleInput = document.getElementById('editor-title');
  const slugInput = document.getElementById('editor-slug');
  const slugGenerateBtn = document.getElementById('editor-slug-generate');
  const slugErrorEl = document.getElementById('editor-slug-error');
  const excerptInput = document.getElementById('editor-excerpt');
  const excerptCounterEl = document.getElementById('editor-excerpt-counter');
  const categorySelect = document.getElementById('editor-category');
  const authorInput = document.getElementById('editor-author');
  const authorLabelEl = document.getElementById('editor-author-label');
  const authorErrorEl = document.getElementById('editor-author-error');
  const reviewerInfoEl = document.getElementById('editor-reviewer-info');
  const sourceInput = document.getElementById('editor-source');
  const featuredCheckbox = document.getElementById('editor-featured');

  const typeTeamBtn = document.getElementById('editor-type-team');
  const typeGuestBtn = document.getElementById('editor-type-guest');
  const typeHintEl = document.getElementById('editor-type-hint');

  const previewCover = document.getElementById('preview-cover');
  const previewCategory = document.getElementById('preview-category');
  const previewTitle = document.getElementById('preview-title');
  const previewAuthor = document.getElementById('preview-author');
  const previewReadingTime = document.getElementById('preview-reading-time');
  const previewExcerpt = document.getElementById('preview-excerpt');
  const previewContent = document.getElementById('preview-content');
  const previewEmpty = document.getElementById('preview-empty');
  const previewAttribution = document.getElementById('preview-attribution');
  const previewAttributionAuthor = document.getElementById('preview-attribution-author');
  const previewAttributionReviewer = document.getElementById('preview-attribution-reviewer');

  const saveDraftBtn = document.getElementById('editor-save-draft-btn');
  const saveStatusEl = document.getElementById('editor-save-status');
  const publishBtn = document.getElementById('editor-publish-btn');
  const publishConfirmEl = document.getElementById('editor-publish-confirm');
  const publishConfirmTextEl = document.getElementById('editor-publish-confirm-text');
  const publishConfirmBtn = document.getElementById('editor-publish-confirm-btn');
  const publishCancelBtn = document.getElementById('editor-publish-cancel-btn');
  const previewStatusPillEl = document.getElementById('preview-status-pill');

  const headerEyebrowEl = document.getElementById('editor-header-eyebrow');
  const headerTitleEl = document.getElementById('editor-header-title');

  let isEditingPublished = false;
  let initialUpdatedAt = null;
  let loadedArticleData = null;

  const EXCERPT_LIMIT = 220;
  const BUCKET_NAME = 'blog-covers';

  function isValidSlug(value) {
    return /^[a-z0-9-]+$/.test(value);
  }

  // Permissivo o bastante para caber tanto um id numérico quanto um uuid —
  // só evita que algo fora desse conjunto de caracteres chegue à consulta.
  function isSafeArticleId(value) {
    return typeof value === 'string' && /^[a-zA-Z0-9-]{1,64}$/.test(value);
  }

  function getArticleIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    return isSafeArticleId(id) ? id : null;
  }

  let articleId = getArticleIdFromUrl();

  function slugify(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function estimateReadingTime(content) {
    if (typeof window !== 'undefined' && typeof window.estimateReadingTime === 'function' && window.estimateReadingTime !== estimateReadingTime) {
      return window.estimateReadingTime(content);
    }
    if (!content) return null;
    const plain = (typeof window !== 'undefined' && typeof window.stripHtmlToText === 'function')
      ? window.stripHtmlToText(content)
      : String(content)
          .replace(/<\/(p|div|h[1-6]|li|blockquote|tr|table|section|article)>/gi, ' ')
          .replace(/<[^>]*>/g, ' ')
          .replace(/&nbsp;/gi, ' ');
    const words = plain.trim().split(/\s+/).filter(Boolean).length;
    if (!words) return null;
    return Math.max(1, Math.ceil(words / 200));
  }

  if (slugGenerateBtn) {
    slugGenerateBtn.addEventListener('click', () => {
      if (!slugInput) return;
      slugInput.value = slugify(titleInput ? titleInput.value : '');
      validateSlug();
      updatePreview();
    });
  }

  function validateSlug() {
    if (!slugInput || !slugErrorEl) return;
    const value = slugInput.value.trim();
    if (value && !isValidSlug(value)) {
      slugErrorEl.textContent = 'Use apenas letras minúsculas, números e hífens.';
    } else {
      slugErrorEl.textContent = '';
    }
  }

  function updateExcerptCounter() {
    if (!excerptInput || !excerptCounterEl) return;
    const length = excerptInput.value.length;
    excerptCounterEl.textContent = `${length} / ${EXCERPT_LIMIT}`;
    excerptCounterEl.classList.toggle('is-over', length > EXCERPT_LIMIT);
  }

  // --------------------------------------------------------------------
  // Tipo de artigo (equipe x visitante) — escolha visual, sem relação com
  // autenticação. "Equipe" preserva o comportamento já existente (autor =
  // perfil ativo). "Visitante" pede o nome do autor manualmente e registra
  // o perfil ativo como responsável pela revisão editorial — um registro
  // editorial, não uma identidade individual verificada.
  // --------------------------------------------------------------------
  let articleType = 'team';

  function getReviewerName() {
    const profile = profileApi ? profileApi.getSelectedProfile() : null;
    return profile ? profile.fullName : '';
  }

  function validateAuthorRequired() {
    if (!authorErrorEl) return;
    if (articleType === 'guest' && authorInput && !authorInput.value.trim()) {
      authorErrorEl.textContent = 'Informe o nome do autor convidado.';
    } else {
      authorErrorEl.textContent = '';
    }
  }

  // skipFieldReset: usado ao popular um artigo existente, para não limpar
  // nem reaplicar o autopreenchimento do Autor — o valor vem do banco.
  function applyArticleType(type, skipFieldReset) {
    articleType = type === 'guest' ? 'guest' : 'team';

    if (typeTeamBtn) typeTeamBtn.classList.toggle('is-active', articleType === 'team');
    if (typeGuestBtn) typeGuestBtn.classList.toggle('is-active', articleType === 'guest');

    if (authorLabelEl) authorLabelEl.textContent = articleType === 'guest' ? 'Nome do autor (convidado)' : 'Autor';
    if (authorInput) {
      authorInput.placeholder = articleType === 'guest' ? 'Nome completo de quem escreveu o artigo' : '';
    }
    if (typeHintEl) {
      typeHintEl.textContent = articleType === 'guest'
        ? 'Informe o nome de quem escreveu o artigo. O perfil ativo fica registrado como responsável pela revisão.'
        : 'O autor é preenchido automaticamente pelo perfil selecionado.';
    }

    if (reviewerInfoEl) {
      if (articleType === 'guest') {
        const reviewer = getReviewerName();
        reviewerInfoEl.textContent = reviewer
          ? `Revisado por ${reviewer} (perfil ativo).`
          : '';
        reviewerInfoEl.hidden = !reviewer;
      } else {
        reviewerInfoEl.hidden = true;
        reviewerInfoEl.textContent = '';
      }
    }

    if (!skipFieldReset && authorInput) {
      if (articleType === 'guest') {
        // Trocar para visitante: o nome da equipe não se aplica mais —
        // limpa para a pessoa digitar o nome real do autor convidado.
        authorInput.value = '';
      } else {
        // Voltar para equipe: reaplica o autopreenchimento se o campo
        // estiver vazio (mesmo comportamento já existente na criação).
        const profile = profileApi ? profileApi.getSelectedProfile() : null;
        if (profile && !authorInput.value.trim()) authorInput.value = profile.fullName;
      }
    }

    validateAuthorRequired();
    updatePreview();
  }

  if (typeTeamBtn) typeTeamBtn.addEventListener('click', () => applyArticleType('team'));
  if (typeGuestBtn) typeGuestBtn.addEventListener('click', () => applyArticleType('guest'));

  // --------------------------------------------------------------------
  // Editor visual (Quill) — toolbar restrita: títulos H2–H4, negrito,
  // itálico, listas, link e "limpar formatação". Nunca usa
  // document.execCommand — o Quill aplica formatação através do seu
  // próprio modelo de documento (Parchment/Delta).
  // --------------------------------------------------------------------
  let quill = null;
  const quillMount = document.getElementById('editor-content-quill');

  if (quillMount && window.Quill) {
    quill = new window.Quill(quillMount, {
      theme: 'snow',
      placeholder: 'Escreva o conteúdo do artigo…',
      modules: {
        toolbar: [
          [{ header: [2, 3, 4, false] }],
          ['bold', 'italic'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['link'],
          ['clean'],
        ],
      },
    });
    quill.on('text-change', () => updatePreview());
  }

  // Lista branca explícita de tags/atributos/protocolos — nenhuma tag de
  // script, iframe, formulário ou manipulador de evento (on*) sobrevive,
  // independentemente do que o Quill produza. A mesma lista é usada para
  // sanitizar tanto o que vai para a pré-visualização quanto o que é
  // gravado no banco.
  const PURIFY_CONFIG = {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'b', 'i', 'u', 's',
      'h1', 'h2', 'h3', 'h4',
      'ul', 'ol', 'li',
      'a', 'blockquote', 'code', 'pre', 'img', 'hr', 'span',
    ],
    ALLOWED_ATTR: ['href', 'title', 'alt', 'src'],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|\/|#)/i,
  };

  function getSanitizedContentHtml() {
    if (!quill || !window.DOMPurify) return '';
    const rawHtml = typeof quill.getSemanticHTML === 'function'
      ? quill.getSemanticHTML()
      : quill.root.innerHTML;
    return window.DOMPurify.sanitize(rawHtml, PURIFY_CONFIG);
  }

  // --------------------------------------------------------------------
  // Imagem de capa — File escolhido nesta sessão (ainda não enviado),
  // caminho já salvo no banco (modo edição) e a flag de remoção explícita.
  // --------------------------------------------------------------------
  const coverDropzone = document.getElementById('editor-cover-dropzone');
  const coverFileInput = document.getElementById('editor-cover-input');
  const coverEmptyEl = document.getElementById('editor-cover-empty');
  const coverPickBtn = document.getElementById('editor-cover-pick-btn');
  const coverPreviewEl = document.getElementById('editor-cover-preview');
  const coverPreviewImg = document.getElementById('editor-cover-preview-img');
  const coverReplaceBtn = document.getElementById('editor-cover-replace-btn');
  const coverRemoveBtn = document.getElementById('editor-cover-remove-btn');
  const coverErrorEl = document.getElementById('editor-cover-error');

  const COVER_MAX_BYTES = 5 * 1024 * 1024;
  const COVER_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const COVER_EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

  let coverFile = null;
  let coverObjectUrl = null;
  let existingCoverPath = null;
  let coverWasRemoved = false;

  function showCoverError(message) {
    if (coverErrorEl) coverErrorEl.textContent = message;
  }

  function clearCoverError() {
    if (coverErrorEl) coverErrorEl.textContent = '';
  }

  function revokeCoverObjectUrl() {
    if (coverObjectUrl) {
      URL.revokeObjectURL(coverObjectUrl);
      coverObjectUrl = null;
    }
  }

  function getActiveCoverUrl() {
    if (coverObjectUrl) return coverObjectUrl;
    if (!coverWasRemoved && existingCoverPath) return existingCoverPath;
    return null;
  }

  function refreshCoverWidget() {
    const activeUrl = getActiveCoverUrl();
    if (activeUrl) {
      if (coverPreviewImg) coverPreviewImg.src = activeUrl;
      if (coverEmptyEl) coverEmptyEl.hidden = true;
      if (coverPreviewEl) coverPreviewEl.hidden = false;
    } else {
      if (coverPreviewImg) coverPreviewImg.removeAttribute('src');
      if (coverPreviewEl) coverPreviewEl.hidden = true;
      if (coverEmptyEl) coverEmptyEl.hidden = false;
    }
  }

  function setCoverFile(file) {
    clearCoverError();
    if (!file) return;

    if (COVER_ALLOWED_TYPES.indexOf(file.type) === -1) {
      showCoverError('Use um arquivo JPG, PNG ou WebP.');
      return;
    }

    if (file.size > COVER_MAX_BYTES) {
      showCoverError('O arquivo excede o limite de 5 MB.');
      return;
    }

    revokeCoverObjectUrl();
    coverFile = file;
    coverWasRemoved = false;
    coverObjectUrl = URL.createObjectURL(file);

    refreshCoverWidget();
    updatePreview();
  }

  function clearCoverFile() {
    revokeCoverObjectUrl();
    coverFile = null;
    if (coverFileInput) coverFileInput.value = '';
    if (existingCoverPath) coverWasRemoved = true;
    clearCoverError();
    refreshCoverWidget();
    updatePreview();
  }

  if (coverPickBtn) coverPickBtn.addEventListener('click', () => { if (coverFileInput) coverFileInput.click(); });
  if (coverReplaceBtn) coverReplaceBtn.addEventListener('click', () => { if (coverFileInput) coverFileInput.click(); });
  if (coverRemoveBtn) coverRemoveBtn.addEventListener('click', clearCoverFile);

  if (coverFileInput) {
    coverFileInput.addEventListener('change', () => {
      setCoverFile(coverFileInput.files && coverFileInput.files[0]);
    });
  }

  if (coverDropzone) {
    ['dragenter', 'dragover'].forEach((eventName) => {
      coverDropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        coverDropzone.classList.add('is-dragover');
      });
    });
    ['dragleave', 'drop'].forEach((eventName) => {
      coverDropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        coverDropzone.classList.remove('is-dragover');
      });
    });
    coverDropzone.addEventListener('drop', (event) => {
      const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
      setCoverFile(file);
    });
  }

  // Extrai o caminho relativo dentro do bucket a partir da URL pública
  // salva no banco — necessário para apagar o arquivo antigo do Storage
  // (a API de remoção pede o caminho, não a URL completa).
  function extractStoragePath(publicUrl) {
    if (typeof publicUrl !== 'string') return null;
    const marker = `/storage/v1/object/public/${BUCKET_NAME}/`;
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return null;
    return publicUrl.slice(idx + marker.length);
  }

  function removeStorageObjectBestEffort(path) {
    if (!path) return;
    const client = window.adminSupabase;
    if (!client) return;
    client.storage.from(BUCKET_NAME).remove([path]).then(({ error }) => {
      if (error) console.warn('Decolar Admin: não foi possível remover arquivo antigo do Storage.', error);
    }).catch((err) => {
      console.warn('Decolar Admin: falha ao tentar remover arquivo antigo do Storage.', err);
    });
  }

  // --------------------------------------------------------------------
  // Carregar rascunho existente (?id=...)
  // --------------------------------------------------------------------
  function showArticleError(title, message, withRetry) {
    if (shell) shell.hidden = true;
    if (loadingState) loadingState.hidden = true;
    if (errorState) errorState.hidden = true;
    if (articleErrorTitleEl) articleErrorTitleEl.textContent = title;
    if (articleErrorTextEl) articleErrorTextEl.textContent = message;
    if (articleRetryBtn) articleRetryBtn.hidden = !withRetry;
    if (articleErrorState) articleErrorState.hidden = false;
  }

  function populateFormFromArticle(article) {
    if (titleInput) titleInput.value = article.title || '';
    if (slugInput) slugInput.value = article.slug || '';
    if (excerptInput) excerptInput.value = article.excerpt || '';
    if (categorySelect) categorySelect.value = article.category || '';

    // Compatibilidade: registros antigos não têm article_type (coluna
    // pode nem existir no momento da leitura, ou vir nula) — tratados como
    // "equipe", conforme pedido. skipFieldReset=true porque o valor real
    // do Autor vem do próprio registro, logo abaixo, não deve ser limpo
    // nem reautopreenchido pelo perfil ativo.
    applyArticleType(article.article_type === 'guest' ? 'guest' : 'team', true);

    // Autoria original preservada — nunca sobrescrita pelo perfil ativo ao editar.
    if (authorInput) authorInput.value = article.author_name || '';
    if (sourceInput) sourceInput.value = article.source_name || '';
    if (featuredCheckbox) featuredCheckbox.checked = article.featured === true;

    existingCoverPath = article.cover_image_path || null;
    coverWasRemoved = false;
    coverFile = null;
    revokeCoverObjectUrl();
    refreshCoverWidget();

    if (quill) {
      const sanitized = window.DOMPurify
        ? window.DOMPurify.sanitize(article.content || '', PURIFY_CONFIG)
        : '';
      const delta = quill.clipboard.convert({ html: sanitized });
      quill.setContents(delta, 'silent');
    }

    validateSlug();
    validateAuthorRequired();
    updateExcerptCounter();
    updatePreview();
  }

  function setupPublishedEditMode(article) {
    if (headerEyebrowEl) headerEyebrowEl.textContent = 'Decolar Consórcios • Edição Editorial';
    if (headerTitleEl) headerTitleEl.textContent = 'Atualizar Artigo Publicado';

    // Para artigos publicados: ocultar "Salvar rascunho"
    if (saveDraftBtn) saveDraftBtn.hidden = true;

    // Adaptar botão de ação principal
    if (publishBtn) {
      publishBtn.textContent = 'Salvar alterações';
    }

    // Modal de confirmação
    if (publishConfirmTextEl) {
      publishConfirmTextEl.textContent = 'Atenção: Este artigo já está publicado no blog. As alterações salvas ficarão visíveis publicamente de imediato. Deseja confirmar a atualização?';
    }
    if (publishConfirmBtn) {
      publishConfirmBtn.textContent = 'Sim, salvar alterações';
    }

    // Travar slug (preservar URLs públicas, indexação e SEO)
    if (slugInput) {
      slugInput.readOnly = true;
      slugInput.style.backgroundColor = 'var(--color-gray-100)';
      slugInput.style.cursor = 'not-allowed';
    }
    if (slugGenerateBtn) {
      slugGenerateBtn.disabled = true;
      slugGenerateBtn.style.opacity = '0.5';
      slugGenerateBtn.style.cursor = 'not-allowed';
    }
    if (slugErrorEl) {
      slugErrorEl.textContent = 'O slug não pode ser modificado após a publicação para preservar a URL pública e o SEO.';
      slugErrorEl.style.color = 'var(--color-gray-500)';
    }

    // Preservar autoria e tipo original sem alteração
    if (authorInput) {
      authorInput.readOnly = true;
      authorInput.style.backgroundColor = 'var(--color-gray-100)';
      authorInput.style.cursor = 'not-allowed';
    }
    if (typeTeamBtn) typeTeamBtn.disabled = true;
    if (typeGuestBtn) typeGuestBtn.disabled = true;
    if (typeHintEl) {
      typeHintEl.textContent = 'A autoria e o tipo editorial do artigo original são preservados nesta edição.';
    }

    // Status pill na pré-visualização
    if (previewStatusPillEl) {
      previewStatusPillEl.textContent = 'Publicado (em edição)';
      previewStatusPillEl.classList.add('is-published');
    }
  }

  function loadExistingArticle(id) {
    const client = window.adminSupabase;
    if (!client) {
      showArticleError('Não foi possível carregar este artigo.', 'Verifique sua conexão e tente novamente.', true);
      return;
    }

    if (shell) shell.hidden = true;
    if (loadingState) loadingState.hidden = false;

    client
      .from('blog_articles')
      .select('id,title,slug,excerpt,category,author_name,cover_image_path,content,featured,status,source_name,article_type,reviewer_name,published_at,updated_at')
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) throw error;

        if (!data) {
          showArticleError('Artigo não encontrado.', 'O link acessado não corresponde a nenhum artigo salvo.', false);
          return;
        }

        loadedArticleData = data;
        initialUpdatedAt = data.updated_at;

        if (data.status === 'published') {
          isEditingPublished = true;
          setupPublishedEditMode(data);
        } else {
          isEditingPublished = false;
        }

        populateFormFromArticle(data);
        if (loadingState) loadingState.hidden = true;
        if (shell) shell.hidden = false;
      })
      .catch((err) => {
        console.error('Decolar Admin: falha ao carregar artigo para edição.', err);
        showArticleError('Não foi possível carregar este artigo agora.', 'Verifique sua conexão e tente novamente.', true);
      });
  }

  if (articleRetryBtn) {
    articleRetryBtn.addEventListener('click', () => {
      if (articleId) loadExistingArticle(articleId);
    });
  }

  // --------------------------------------------------------------------
  // Salvar rascunho / Publicar — compartilham a lógica de upload de capa
  // e o travamento mútuo dos dois botões (nunca gravar duas vezes em
  // paralelo, nem publicar com um clique duplicado).
  // --------------------------------------------------------------------
  function setSaveStatus(message, kind) {
    if (!saveStatusEl) return;
    saveStatusEl.textContent = message || '';
    saveStatusEl.classList.remove('is-success', 'is-error');
    if (kind) saveStatusEl.classList.add(kind);
  }

  let isBusy = false;
  let isPublishedLocked = false;

  // Desabilita os dois botões durante qualquer gravação em andamento.
  // Uma vez publicado nesta sessão (isPublishedLocked), eles permanecem
  // desabilitados para sempre — nunca são reabilitados pelo "finally".
  function setBusy(busy) {
    isBusy = busy;
    if (isPublishedLocked) return;
    if (saveDraftBtn) saveDraftBtn.disabled = busy;
    if (publishBtn) publishBtn.disabled = busy;
  }

  function setSavingLabel(isSaving) {
    if (saveDraftBtn) saveDraftBtn.textContent = isSaving ? 'Salvando…' : 'Salvar rascunho';
  }

  function classifySaveError(err) {
    const code = err && err.cause && err.cause.code;
    if (code === '23505') return 'Este slug já está em uso por outro artigo. Escolha outro.';
    return 'Não foi possível salvar agora. Tente novamente.';
  }

  // Valida e, se um novo arquivo foi escolhido, envia para o Storage.
  // Lança erro (com .cause) se o upload falhar — nunca retorna um
  // caminho parcial/inconsistente.
  async function prepareCoverForSave(client, slugValue) {
    let uploadedNewStoragePath = null;
    let coverPathToSave = coverWasRemoved ? null : existingCoverPath;

    if (coverFile) {
      const ext = COVER_EXTENSIONS[coverFile.type] || 'jpg';
      const storagePath = `covers/${slugValue}-${Date.now()}.${ext}`;

      const { error: uploadError } = await client.storage
        .from(BUCKET_NAME)
        .upload(storagePath, coverFile, { contentType: coverFile.type, cacheControl: '3600', upsert: false });

      if (uploadError) throw Object.assign(new Error('cover-upload-failed'), { cause: uploadError });

      const { data: publicUrlData } = client.storage.from(BUCKET_NAME).getPublicUrl(storagePath);
      coverPathToSave = publicUrlData && publicUrlData.publicUrl;
      uploadedNewStoragePath = storagePath;
    }

    return { coverPathToSave, uploadedNewStoragePath };
  }

  // Só é chamada depois que a linha já foi gravada com sucesso: só então
  // é seguro apagar o arquivo antigo do Storage e atualizar o estado local.
  function commitCoverStateAfterSave(coverPathToSave, uploadedNewStoragePath) {
    if (uploadedNewStoragePath) {
      const oldPath = extractStoragePath(existingCoverPath);
      if (oldPath && oldPath !== uploadedNewStoragePath) removeStorageObjectBestEffort(oldPath);
      existingCoverPath = coverPathToSave;
      coverFile = null;
      revokeCoverObjectUrl();
    } else if (coverWasRemoved && existingCoverPath) {
      const oldPath = extractStoragePath(existingCoverPath);
      if (oldPath) removeStorageObjectBestEffort(oldPath);
      existingCoverPath = null;
    }
    coverWasRemoved = false;
    refreshCoverWidget();
  }

  function applySavedRowId(savedRow) {
    if (!articleId && savedRow && savedRow.id) {
      articleId = savedRow.id;
      const url = new URL(window.location.href);
      url.searchParams.set('id', articleId);
      window.history.replaceState({}, document.title, url.toString());
    }
  }

  function buildBasePayload(slug) {
    return {
      title: (titleInput && titleInput.value || '').trim(),
      slug,
      excerpt: (excerptInput && excerptInput.value || '').trim() || null,
      category: (categorySelect && categorySelect.value) || null,
      author_name: (authorInput && authorInput.value || '').trim() || null,
      source_name: (sourceInput && sourceInput.value || '').trim() || null,
      article_type: articleType,
      content: getSanitizedContentHtml(),
      featured: !!(featuredCheckbox && featuredCheckbox.checked),
    };
  }

  async function saveDraft() {
    if (isBusy) return;
    setSaveStatus('', null);

    const title = (titleInput && titleInput.value || '').trim();
    const slug = (slugInput && slugInput.value || '').trim();
    const plainText = quill ? quill.getText().trim() : '';

    if (!title) {
      setSaveStatus('Informe um título antes de salvar.', 'is-error');
      return;
    }
    if (!slug || !isValidSlug(slug)) {
      setSaveStatus('Informe um slug válido (letras minúsculas, números e hífens).', 'is-error');
      return;
    }
    if (!plainText) {
      setSaveStatus('Escreva algum conteúdo antes de salvar.', 'is-error');
      return;
    }
    if (articleType === 'guest' && (!authorInput || !authorInput.value.trim())) {
      validateAuthorRequired();
      setSaveStatus('Informe o nome do autor convidado antes de salvar.', 'is-error');
      return;
    }

    const client = window.adminSupabase;
    if (!client) {
      setSaveStatus('Não foi possível conectar ao Supabase agora.', 'is-error');
      return;
    }

    setBusy(true);
    setSavingLabel(true);

    let uploadedNewStoragePath = null;

    try {
      const prepared = await prepareCoverForSave(client, slug);
      uploadedNewStoragePath = prepared.uploadedNewStoragePath;

      // "Salvar rascunho" nunca toca status/published_at de um artigo que
      // já foi publicado — mas, nesta etapa, esse caminho nem existe:
      // loadExistingArticle() já recusa carregar um artigo publicado para
      // edição, então articleId aqui só pertence a rascunhos.
      const payload = Object.assign(buildBasePayload(slug), {
        reviewer_name: articleType === 'guest' ? getReviewerName() || null : null,
        cover_image_path: prepared.coverPathToSave,
        status: 'draft',
      });

      let savedRow;
      if (articleId) {
        const { data, error } = await client.from('blog_articles').update(payload).eq('id', articleId).select().maybeSingle();
        if (error) throw error;
        savedRow = data;
      } else {
        const { data, error } = await client.from('blog_articles').insert(payload).select().maybeSingle();
        if (error) throw error;
        savedRow = data;
      }

      commitCoverStateAfterSave(prepared.coverPathToSave, uploadedNewStoragePath);
      applySavedRowId(savedRow);

      setSaveStatus('Rascunho salvo com sucesso.', 'is-success');
    } catch (err) {
      console.error('Decolar Admin: falha ao salvar rascunho.', err);
      // A linha não foi gravada — se um novo arquivo já tinha sido
      // enviado ao Storage, remove para não deixar órfão.
      if (uploadedNewStoragePath) removeStorageObjectBestEffort(uploadedNewStoragePath);
      setSaveStatus(classifySaveError(err), 'is-error');
    } finally {
      setSavingLabel(false);
      setBusy(false);
    }
  }

  if (saveDraftBtn) saveDraftBtn.addEventListener('click', saveDraft);

  // --------------------------------------------------------------------
  // Publicar — exige confirmação explícita antes de gravar. Validação
  // mais estrita que o rascunho: título, resumo, categoria, autor e
  // conteúdo são todos obrigatórios para publicar.
  // --------------------------------------------------------------------
  function validateForPublish() {
    const title = (titleInput && titleInput.value || '').trim();
    const slug = (slugInput && slugInput.value || '').trim();
    const excerpt = (excerptInput && excerptInput.value || '').trim();
    const category = categorySelect ? categorySelect.value : '';
    const author = (authorInput && authorInput.value || '').trim();
    const plainText = quill ? quill.getText().trim() : '';

    if (!title) return 'Informe um título antes de publicar.';
    if (!slug || !isValidSlug(slug)) return 'Informe um slug válido antes de publicar.';
    if (!excerpt) return 'Informe um resumo antes de publicar.';
    if (!category) return 'Selecione uma categoria antes de publicar.';
    if (!author) {
      return articleType === 'guest'
        ? 'Informe o nome do autor convidado antes de publicar.'
        : 'Informe o autor antes de publicar.';
    }
    if (!plainText) return 'Escreva algum conteúdo antes de publicar.';
    return null;
  }

  function showPublishConfirm() {
    if (publishConfirmEl) publishConfirmEl.hidden = false;
  }

  function hidePublishConfirm() {
    if (publishConfirmEl) publishConfirmEl.hidden = true;
  }

  function setPublishingLabel(isPublishing) {
    if (publishConfirmBtn) publishConfirmBtn.textContent = isPublishing ? 'Publicando…' : 'Sim, publicar agora';
  }

  // Trava definitiva após sucesso: nenhum dos dois botões volta a ficar
  // clicável nesta sessão — evita que "Salvar rascunho" desfaça a
  // publicação sem querer, e impede republicação por clique duplicado.
  function lockEditorAfterPublish() {
    isPublishedLocked = true;
    if (saveDraftBtn) saveDraftBtn.disabled = true;
    if (publishBtn) publishBtn.disabled = true;
    hidePublishConfirm();
    if (previewStatusPillEl) {
      previewStatusPillEl.textContent = 'Publicado';
      previewStatusPillEl.classList.add('is-published');
    }
  }

  async function publishArticle() {
    if (isBusy) return;
    setSaveStatus('', null);

    const validationError = validateForPublish();
    if (validationError) {
      if (articleType === 'guest') validateAuthorRequired();
      setSaveStatus(validationError, 'is-error');
      return;
    }

    const client = window.adminSupabase;
    if (!client) {
      setSaveStatus('Não foi possível conectar ao Supabase agora.', 'is-error');
      return;
    }

    const slug = (slugInput && slugInput.value || '').trim();

    setBusy(true);
    setPublishingLabel(true);

    let uploadedNewStoragePath = null;
    let publishedSuccessfully = false;

    try {
      const prepared = await prepareCoverForSave(client, slug);
      uploadedNewStoragePath = prepared.uploadedNewStoragePath;

      const payload = Object.assign(buildBasePayload(slug), {
        // Registro editorial, gravado definitivamente agora — nunca
        // confundir com autenticação individual: os perfis compartilham
        // a mesma conta Supabase, isto é só o nome do colaborador
        // responsável por esta publicação.
        reviewer_name: articleType === 'guest' ? getReviewerName() || null : null,
        cover_image_path: prepared.coverPathToSave,
        status: 'published',
        published_at: new Date().toISOString(),
      });

      let savedRow;
      if (articleId) {
        const { data, error } = await client.from('blog_articles').update(payload).eq('id', articleId).select().maybeSingle();
        if (error) throw error;
        savedRow = data;
      } else {
        const { data, error } = await client.from('blog_articles').insert(payload).select().maybeSingle();
        if (error) throw error;
        savedRow = data;
      }

      commitCoverStateAfterSave(prepared.coverPathToSave, uploadedNewStoragePath);
      applySavedRowId(savedRow);

      publishedSuccessfully = true;
      setSaveStatus('Artigo publicado com sucesso.', 'is-success');
      lockEditorAfterPublish();
    } catch (err) {
      console.error('Decolar Admin: falha ao publicar artigo.', err);
      if (uploadedNewStoragePath) removeStorageObjectBestEffort(uploadedNewStoragePath);
      setSaveStatus(classifySaveError(err), 'is-error');
    } finally {
      setPublishingLabel(false);
      if (!publishedSuccessfully) setBusy(false);
    }
  }

  async function savePublishedChanges() {
    if (isBusy) return;
    setSaveStatus('', null);

    const validationError = validateForPublish();
    if (validationError) {
      setSaveStatus(validationError, 'is-error');
      return;
    }

    const client = window.adminSupabase;
    if (!client) {
      setSaveStatus('Não foi possível conectar ao Supabase agora.', 'is-error');
      return;
    }

    setBusy(true);
    if (publishConfirmBtn) publishConfirmBtn.textContent = 'Salvando alterações…';

    let uploadedNewStoragePath = null;

    try {
      // 1. Verificação de concorrência otimista (evitar sobrescrever silenciosamente alterações de outro admin)
      if (initialUpdatedAt) {
        const { data: checkData, error: checkError } = await client
          .from('blog_articles')
          .select('updated_at')
          .eq('id', articleId)
          .maybeSingle();

        if (checkError) throw checkError;

        if (checkData && checkData.updated_at && checkData.updated_at !== initialUpdatedAt) {
          hidePublishConfirm();
          setSaveStatus('Conflito de edição: este artigo foi atualizado por outro administrador enquanto você editava. Recarregue a página para ver a versão mais recente antes de salvar.', 'is-error');
          setBusy(false);
          if (publishConfirmBtn) publishConfirmBtn.textContent = 'Sim, salvar alterações';
          return;
        }
      }

      // 2. Preparar imagem de capa
      const currentSlug = (slugInput && slugInput.value || (loadedArticleData && loadedArticleData.slug) || '').trim();
      const prepared = await prepareCoverForSave(client, currentSlug);
      uploadedNewStoragePath = prepared.uploadedNewStoragePath;

      // 3. Payload de atualização estrita: NUNCA altera ID, status ('published'), published_at, slug, author_name ou reviewer_name
      const updatePayload = {
        title: (titleInput && titleInput.value || '').trim(),
        excerpt: (excerptInput && excerptInput.value || '').trim() || null,
        category: (categorySelect && categorySelect.value) || null,
        source_name: (sourceInput && sourceInput.value || '').trim() || null,
        content: getSanitizedContentHtml(),
        featured: !!(featuredCheckbox && featuredCheckbox.checked),
        cover_image_path: prepared.coverPathToSave,
        updated_at: new Date().toISOString(),
      };

      const { data: updatedRow, error: updateError } = await client
        .from('blog_articles')
        .update(updatePayload)
        .eq('id', articleId)
        .select()
        .maybeSingle();

      if (updateError) throw updateError;

      commitCoverStateAfterSave(prepared.coverPathToSave, uploadedNewStoragePath);
      if (updatedRow && updatedRow.updated_at) {
        initialUpdatedAt = updatedRow.updated_at;
      }

      hidePublishConfirm();
      setSaveStatus('Alterações salvas com sucesso! O artigo publicado foi atualizado e já reflete no site.', 'is-success');
      updatePreview();
    } catch (err) {
      console.error('Decolar Admin: falha ao salvar alterações no artigo publicado.', err);
      if (uploadedNewStoragePath) removeStorageObjectBestEffort(uploadedNewStoragePath);
      hidePublishConfirm();
      setSaveStatus(classifySaveError(err), 'is-error');
    } finally {
      if (publishConfirmBtn) publishConfirmBtn.textContent = 'Sim, salvar alterações';
      setBusy(false);
    }
  }

  if (publishBtn) {
    publishBtn.addEventListener('click', () => {
      if (isBusy) return;
      setSaveStatus('', null);
      const validationError = validateForPublish();
      if (validationError) {
        if (articleType === 'guest') validateAuthorRequired();
        setSaveStatus(validationError, 'is-error');
        return;
      }
      showPublishConfirm();
    });
  }

  if (publishCancelBtn) publishCancelBtn.addEventListener('click', hidePublishConfirm);
  if (publishConfirmBtn) {
    publishConfirmBtn.addEventListener('click', () => {
      if (isEditingPublished) {
        savePublishedChanges();
      } else {
        publishArticle();
      }
    });
  }

  // --------------------------------------------------------------------
  // Pré-visualização
  // --------------------------------------------------------------------
  function updatePreview() {
    const title = (titleInput && titleInput.value || '').trim();
    const category = categorySelect ? categorySelect.value : '';
    const author = (authorInput && authorInput.value || '').trim();
    const excerpt = (excerptInput && excerptInput.value || '').trim();

    if (previewTitle) previewTitle.textContent = title || 'Título do artigo';

    if (previewCategory) {
      const label = CATEGORY_LABELS[category];
      if (label) {
        previewCategory.textContent = label;
        previewCategory.hidden = false;
      } else {
        previewCategory.hidden = true;
      }
    }

    const plainText = quill ? quill.getText() : '';
    const readingTime = estimateReadingTime(plainText);

    // Artigo de visitante: a autoria/revisão aparecem no bloco dedicado
    // (.admin-preview-attribution) abaixo, não nesta linha — aqui mostra
    // só o tempo de leitura. Artigo da equipe: comportamento inalterado,
    // "Escrito por {autor} · {tempo}" nesta mesma linha, sem bloco extra.
    if (articleType === 'guest') {
      if (previewAuthor) previewAuthor.textContent = '';
      if (previewReadingTime) previewReadingTime.textContent = readingTime ? `${readingTime} min de leitura` : '';
    } else {
      if (previewAuthor) previewAuthor.textContent = author ? `Escrito por ${author}` : '';
      if (previewReadingTime) {
        previewReadingTime.textContent = readingTime
          ? (author ? `· ${readingTime} min de leitura` : `${readingTime} min de leitura`)
          : '';
      }
    }

    if (previewAttribution) {
      if (articleType === 'guest') {
        const reviewer = getReviewerName();
        if (previewAttributionAuthor) previewAttributionAuthor.textContent = author || '—';
        if (previewAttributionReviewer) previewAttributionReviewer.textContent = reviewer || '—';
        previewAttribution.hidden = false;
      } else {
        previewAttribution.hidden = true;
      }
    }

    if (previewExcerpt) previewExcerpt.textContent = excerpt;

    if (previewCover) {
      const activeCoverUrl = getActiveCoverUrl();
      if (activeCoverUrl) {
        previewCover.src = activeCoverUrl;
        previewCover.alt = title;
        previewCover.hidden = false;
      } else {
        previewCover.removeAttribute('src');
        previewCover.hidden = true;
      }
    }

    const hasContent = plainText.trim().length > 0;
    if (previewContent) {
      previewContent.innerHTML = hasContent ? getSanitizedContentHtml() : '';
      previewContent.hidden = !hasContent;
    }
    if (previewEmpty) previewEmpty.hidden = hasContent;
  }

  [titleInput, slugInput, excerptInput, categorySelect, authorInput, sourceInput, featuredCheckbox]
    .forEach((field) => {
      if (!field) return;
      field.addEventListener('input', () => {
        if (field === slugInput) validateSlug();
        if (field === excerptInput) updateExcerptCounter();
        if (field === authorInput) validateAuthorRequired();
        updatePreview();
      });
      field.addEventListener('change', () => updatePreview());
    });

  updateExcerptCounter();
  updatePreview();

  // Recolher/expandir a pré-visualização no mobile — só visual, nunca
  // interfere na renderização em si (updatePreview continua rodando por
  // trás normalmente mesmo recolhida, então o conteúdo nunca fica
  // desatualizado quando a pessoa expande de novo).
  (function setupPreviewToggle() {
    const toggleBtn = document.getElementById('admin-preview-toggle-btn');
    const toggleLabel = document.getElementById('admin-preview-toggle-label');
    const collapsible = document.getElementById('admin-preview-collapsible');
    if (!toggleBtn || !collapsible) return;

    const MOBILE_QUERY = '(max-width: 767px)';

    function setExpanded(expanded) {
      collapsible.hidden = !expanded;
      toggleBtn.setAttribute('aria-expanded', String(expanded));
      if (toggleLabel) toggleLabel.textContent = expanded ? 'Recolher' : 'Expandir';
    }

    toggleBtn.addEventListener('click', () => {
      setExpanded(collapsible.hidden);
    });

    // Só no mobile a prévia começa recolhida (economiza espaço); em
    // qualquer outra largura começa sempre expandida, como sempre foi.
    if (window.matchMedia && window.matchMedia(MOBILE_QUERY).matches) {
      setExpanded(false);
    } else {
      setExpanded(true);
    }
  })();

  runAccessCheck();
});
