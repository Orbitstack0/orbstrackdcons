/**
 * Decolar Consórcios — admin-articles.js
 * Lógica exclusiva da listagem de artigos (admin/artigos.html).
 *
 * Consulta blog_articles diretamente (mesmo cliente administrativo já
 * usado nas outras páginas, chave pública/anon) e lista título, autor,
 * data de atualização e status. Não grava nem publica nada — a única
 * escrita feita aqui é a exclusão de rascunhos (nunca de artigos
 * publicados, nem na interface nem na consulta ao banco). "Continuar
 * escrevendo" e "Excluir" só existem para rascunhos; um artigo já
 * publicado aparece na lista, mas sem nenhuma dessas ações nesta etapa.
 *
 * Organização por colaborador (ajuste sobre a Etapa 4B): os rascunhos de
 * outros perfis nunca aparecem para o perfil ativo, em nenhuma aba — a
 * separação é só visual/organizacional sobre a mesma conta compartilhada,
 * não uma restrição de acesso por conta individual nem por RLS. Artigos
 * publicados continuam visíveis para todos, independentemente de quem os
 * escreveu.
 *
 * Todo texto vindo do banco (título, autor) é inserido via textContent,
 * nunca interpretado como HTML.
 */
document.addEventListener('DOMContentLoaded', () => {
  const loadingState = document.getElementById('admin-loading-state');
  const errorState = document.getElementById('admin-error-state');
  const retryBtn = document.getElementById('admin-retry-btn');
  const shell = document.getElementById('admin-shell');
  const logoutBtn = document.getElementById('admin-logout-btn');
  const switchProfileBtn = document.getElementById('admin-switch-profile-btn');

  const guard = window.DecolarAdminGuard;
  const profileApi = window.DecolarAdminProfile;
  // Rota-ciente: '.html' no desenvolvimento local (Live Server), rota
  // limpa em produção (GitHub Pages, servida a partir de dist/).
  const isHtmlPath = window.location.pathname.endsWith('.html');
  const SELECT_PROFILE_PAGE = isHtmlPath ? 'selecionar-perfil.html' : '/admin/selecionar-perfil/';
  const ARTIGOS_PAGE = isHtmlPath ? 'artigos.html' : '/admin/artigos/';
  const ARTIGO_DETALHES_BASE = isHtmlPath ? 'artigo-detalhes.html' : '/admin/artigo-detalhes/';
  const ARTIGO_EDITOR_BASE = isHtmlPath ? 'artigo-editor.html' : '/admin/artigo-editor/';
  const ARTIGO_PUBLICO_BASE = isHtmlPath ? '/artigo.html' : '/artigo/';

  // --------------------------------------------------------------------
  // Proteção de acesso — mesmo padrão das demais páginas do painel.
  // --------------------------------------------------------------------
  function showLoading() {
    if (loadingState) loadingState.hidden = false;
    if (errorState) errorState.hidden = true;
    if (shell) shell.hidden = true;
  }

  function showError() {
    if (loadingState) loadingState.hidden = true;
    if (errorState) errorState.hidden = false;
    if (shell) shell.hidden = true;
  }

  function showShell() {
    if (loadingState) loadingState.hidden = true;
    if (errorState) errorState.hidden = true;
    if (shell) shell.hidden = false;
  }

  let activeProfile = null;

  function runAccessCheck() {
    if (!guard || !profileApi) {
      showError();
      return;
    }
    showLoading();
    guard
      .requireAdmin()
      .then(() => {
        const profile = profileApi.requireProfile();
        if (!profile) return;
        activeProfile = profile;
        showShell();
        loadArticles();
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('deleted') === '1') {
          setActionStatus('Artigo excluído com sucesso.', 'is-success');
          try {
            window.history.replaceState({}, '', ARTIGOS_PAGE);
          } catch (_) {}
        }
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

  runAccessCheck();

  // --------------------------------------------------------------------
  // Listagem
  // --------------------------------------------------------------------
  const listLoadingState = document.getElementById('admin-articles-loading-state');
  const listErrorState = document.getElementById('admin-articles-error-state');
  const listRetryBtn = document.getElementById('admin-articles-retry-btn');
  const listEmptyState = document.getElementById('admin-articles-empty');
  const listEmptyTitleEl = document.getElementById('admin-articles-empty-title');
  const listEmptyTextEl = document.getElementById('admin-articles-empty-text');
  const listEl = document.getElementById('admin-articles-list');

  const filterAllBtn = document.getElementById('admin-filter-all');
  const filterDraftBtn = document.getElementById('admin-filter-draft');

  let allArticles = [];
  let activeFilter = 'all';

  function isValidSlug(value) {
    return typeof value === 'string' && /^[a-z0-9-]+$/.test(value);
  }

  function setListState(state) {
    if (listLoadingState) listLoadingState.hidden = state !== 'loading';
    if (listErrorState) listErrorState.hidden = state !== 'error';
    if (listEmptyState) listEmptyState.hidden = state !== 'empty';
    if (listEl) listEl.hidden = state !== 'list';
  }

  function formatUpdatedAt(isoDate) {
    if (!isoDate) return '';
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      + ' às '
      + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function buildArticleRow(article) {
    const row = document.createElement('article');
    row.className = 'admin-article-row';

    const main = document.createElement('div');
    main.className = 'admin-article-row-main';

    const isDraft = article.status === 'draft';

    // Título + selo na mesma linha — o selo passa a viver junto da
    // identificação do artigo, não mais ao lado dos botões de ação.
    const titleLine = document.createElement('div');
    titleLine.className = 'admin-article-row-title-line';

    const title = document.createElement('h3');
    title.className = 'admin-article-row-title';
    title.textContent = article.title || 'Sem título';

    const statusPill = document.createElement('span');
    statusPill.className = `admin-article-status-pill ${isDraft ? 'admin-article-status-pill--draft' : 'admin-article-status-pill--published'}`;
    statusPill.textContent = isDraft ? 'Rascunho' : 'Publicado';

    titleLine.appendChild(title);
    titleLine.appendChild(statusPill);

    const meta = document.createElement('div');
    meta.className = 'admin-article-row-meta';

    if (article.author_name) {
      const author = document.createElement('span');
      author.textContent = article.author_name;
      meta.appendChild(author);
    }

    const updated = document.createElement('span');
    updated.textContent = `Atualizado em ${formatUpdatedAt(article.updated_at)}`;
    meta.appendChild(updated);

    main.appendChild(titleLine);
    main.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'admin-article-row-actions';

    const detailsLink = document.createElement('a');
    detailsLink.className = 'admin-article-details-btn';
    detailsLink.href = `${ARTIGO_DETALHES_BASE}?id=${encodeURIComponent(article.id)}`;
    detailsLink.textContent = 'Ver detalhes';

    if (isDraft) {
      const continueLink = document.createElement('a');
      continueLink.className = 'admin-article-continue-btn';
      continueLink.href = `${ARTIGO_EDITOR_BASE}?id=${encodeURIComponent(article.id)}`;
      continueLink.textContent = 'Continuar escrevendo';
      actions.appendChild(continueLink);

      actions.appendChild(detailsLink);

      // Exclusão rápida para rascunhos na listagem
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'admin-article-delete-btn';
      deleteBtn.textContent = 'Excluir';
      deleteBtn.addEventListener('click', () => openDeleteConfirm(article));
      actions.appendChild(deleteBtn);
    } else {
      if (isValidSlug(article.slug)) {
        const viewLink = document.createElement('a');
        viewLink.className = 'admin-article-continue-btn';
        viewLink.href = `${ARTIGO_PUBLICO_BASE}?slug=${encodeURIComponent(article.slug)}`;
        viewLink.target = '_blank';
        viewLink.rel = 'noopener noreferrer';
        viewLink.textContent = 'Ver artigo publicado';
        actions.appendChild(viewLink);
      }

      actions.appendChild(detailsLink);
    }

    row.appendChild(main);
    row.appendChild(actions);
    return row;
  }

  // Rascunhos de outros perfis nunca entram na lista visível, em nenhuma
  // aba — só os do perfil ativo. Artigos publicados ficam visíveis para
  // todos, de qualquer autor.
  function getOwnAndPublishedArticles() {
    if (!activeProfile) return [];
    return allArticles.filter((article) => {
      if (article.status === 'draft') return article.author_name === activeProfile.fullName;
      return true;
    });
  }

  function renderList() {
    const visible = getOwnAndPublishedArticles();
    const filtered = activeFilter === 'draft'
      ? visible.filter((article) => article.status === 'draft')
      : visible;

    if (!filtered.length) {
      const firstName = activeProfile ? activeProfile.firstName : '';
      if (listEmptyTitleEl) {
        listEmptyTitleEl.textContent = activeFilter === 'draft'
          ? `Você ainda não tem rascunhos, ${firstName}.`
          : 'Nenhum artigo encontrado.';
      }
      if (listEmptyTextEl) {
        listEmptyTextEl.textContent = activeFilter === 'draft'
          ? 'Comece um novo artigo quando quiser.'
          : 'Comece criando o primeiro artigo do blog.';
      }
      setListState('empty');
      return;
    }

    if (listEl) {
      listEl.innerHTML = '';
      filtered.forEach((article) => listEl.appendChild(buildArticleRow(article)));
    }
    setListState('list');
  }

  function setActiveFilter(filter) {
    activeFilter = filter;
    if (filterAllBtn) filterAllBtn.classList.toggle('is-active', filter === 'all');
    if (filterDraftBtn) filterDraftBtn.classList.toggle('is-active', filter === 'draft');
    renderList();
  }

  if (filterAllBtn) filterAllBtn.addEventListener('click', () => setActiveFilter('all'));
  if (filterDraftBtn) filterDraftBtn.addEventListener('click', () => setActiveFilter('draft'));

  function loadArticles() {
    const client = window.adminSupabase;
    if (!client) {
      setListState('error');
      return;
    }

    setListState('loading');

    client
      .from('blog_articles')
      .select('id,title,slug,author_name,status,updated_at,cover_image_path')
      .order('updated_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) throw error;
        allArticles = Array.isArray(data) ? data : [];
        renderList();
      })
      .catch((err) => {
        console.error('Decolar Admin: falha ao carregar a lista de artigos.', err);
        setListState('error');
      });
  }

  if (listRetryBtn) listRetryBtn.addEventListener('click', loadArticles);

  // --------------------------------------------------------------------
  // Exclusão de rascunhos
  // --------------------------------------------------------------------
  const actionStatusEl = document.getElementById('admin-articles-action-status');
  const deleteModal = document.getElementById('admin-delete-modal');
  const deleteModalOverlay = document.getElementById('admin-delete-modal-overlay');
  const deleteModalText = document.getElementById('admin-delete-modal-text');
  const deleteModalError = document.getElementById('admin-delete-modal-error');
  const deleteModalCancelBtn = document.getElementById('admin-delete-modal-cancel-btn');
  const deleteModalConfirmBtn = document.getElementById('admin-delete-modal-confirm-btn');

  const BUCKET_NAME = 'blog-covers';

  let pendingDeleteArticle = null;
  let isDeleting = false;

  function setActionStatus(message, kind) {
    if (!actionStatusEl) return;
    actionStatusEl.textContent = message || '';
    actionStatusEl.classList.remove('is-success', 'is-warning', 'is-error');
    if (kind) actionStatusEl.classList.add(kind);
  }

  function setDeleteModalError(message) {
    if (!deleteModalError) return;
    deleteModalError.textContent = message || '';
    deleteModalError.hidden = !message;
  }

  function setDeleteModalBusy(busy) {
    if (deleteModalCancelBtn) deleteModalCancelBtn.disabled = busy;
    if (deleteModalConfirmBtn) {
      deleteModalConfirmBtn.disabled = busy;
      deleteModalConfirmBtn.textContent = busy ? 'Excluindo…' : 'Sim, excluir rascunho';
    }
  }

  function openDeleteConfirm(article) {
    pendingDeleteArticle = article;
    setDeleteModalError('');
    if (deleteModalText) {
      deleteModalText.textContent = `Tem certeza de que deseja excluir o rascunho "${article.title || 'Sem título'}"? Esta ação não poderá ser desfeita.`;
    }
    if (deleteModal) deleteModal.hidden = false;
  }

  function closeDeleteConfirm() {
    if (isDeleting) return; // não permite fechar no meio de uma exclusão em andamento
    pendingDeleteArticle = null;
    setDeleteModalError('');
    if (deleteModal) deleteModal.hidden = true;
  }

  if (deleteModalCancelBtn) deleteModalCancelBtn.addEventListener('click', closeDeleteConfirm);
  if (deleteModalOverlay) deleteModalOverlay.addEventListener('click', closeDeleteConfirm);

  // Extrai o caminho relativo dentro do bucket a partir da URL pública
  // salva no banco. Se o valor não corresponder ao padrão esperado do
  // bucket blog-covers, devolve null — e o chamador nunca tenta remover
  // nada nesse caso (nunca mexe em arquivo fora do bucket esperado).
  function extractStoragePath(publicUrl) {
    if (typeof publicUrl !== 'string') return null;
    const marker = `/storage/v1/object/public/${BUCKET_NAME}/`;
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return null;
    return publicUrl.slice(idx + marker.length);
  }

  // Só remove a imagem do Storage se nenhum outro artigo (rascunho ou
  // publicado) ainda referenciar o mesmo cover_image_path — nunca apaga
  // uma imagem compartilhada. Lança erro se a verificação ou a remoção
  // falharem, para o chamador nunca anunciar sucesso total indevido.
  async function cleanupCoverIfExclusive(client, deletedArticleId, coverImagePath) {
    const storagePath = extractStoragePath(coverImagePath);
    if (!storagePath) return;

    const { count, error } = await client
      .from('blog_articles')
      .select('id', { count: 'exact', head: true })
      .eq('cover_image_path', coverImagePath)
      .neq('id', deletedArticleId);

    if (error) throw error;
    if (count && count > 0) return;

    const { error: removeError } = await client.storage.from(BUCKET_NAME).remove([storagePath]);
    if (removeError) throw removeError;
  }

  async function confirmDeleteArticle() {
    if (isDeleting || !pendingDeleteArticle) return;
    const article = pendingDeleteArticle;

    const client = window.adminSupabase;
    if (!client) {
      setDeleteModalError('Não foi possível conectar ao Supabase agora.');
      return;
    }

    isDeleting = true;
    setDeleteModalError('');
    setDeleteModalBusy(true);

    try {
      // A restrição "somente rascunho" vale também na própria operação de
      // exclusão, não só na interface — se o artigo deixou de ser
      // rascunho (foi publicado) entre o carregamento da lista e este
      // clique, o filtro abaixo impede a exclusão e nenhuma linha é
      // afetada (tratado logo adiante).
      const { data: deletedRows, error: deleteError } = await client
        .from('blog_articles')
        .delete()
        .eq('id', article.id)
        .eq('status', 'draft')
        .select('id');

      if (deleteError) throw deleteError;

      if (!deletedRows || !deletedRows.length) {
        // Nada foi excluído — artigo já não era mais rascunho, já tinha
        // sido removido, ou a política RLS recusou a operação. Em
        // qualquer um desses casos, a lista é atualizada para refletir a
        // realidade, em vez de insistir num estado que já não existe.
        setDeleteModalError('Este rascunho não pôde ser excluído agora. A lista será atualizada.');
        isDeleting = false;
        setDeleteModalBusy(false);
        closeDeleteConfirm();
        loadArticles();
        return;
      }

      let storageWarning = null;
      if (article.cover_image_path) {
        try {
          await cleanupCoverIfExclusive(client, article.id, article.cover_image_path);
        } catch (storageErr) {
          console.warn('Decolar Admin: falha ao limpar a imagem de capa do rascunho excluído.', storageErr);
          storageWarning = 'O rascunho foi excluído, mas não foi possível remover a imagem de capa associada. Ela pode ter ficado órfã no armazenamento.';
        }
      }

      allArticles = allArticles.filter((a) => a.id !== article.id);
      renderList();

      isDeleting = false;
      setDeleteModalBusy(false);
      pendingDeleteArticle = null;
      if (deleteModal) deleteModal.hidden = true;

      setActionStatus(storageWarning || 'Rascunho excluído com sucesso.', storageWarning ? 'is-warning' : 'is-success');
    } catch (err) {
      // Log estruturado do erro real (código/mensagem/detalhe/dica do
      // PostgREST) — nunca inclui token, chave ou qualquer credencial;
      // esses campos nunca existem no objeto de erro do Supabase. Isso
      // substitui o log genérico anterior, que não deixava claro se a
      // falha era de RLS, rede ou outra causa.
      console.error('Decolar Admin: falha ao excluir rascunho.', {
        code: err && err.code,
        message: err && err.message,
        details: err && err.details,
        hint: err && err.hint,
      });
      isDeleting = false;
      setDeleteModalBusy(false);
      setDeleteModalError('Não foi possível excluir o rascunho agora. Tente novamente.');
    }
  }

  if (deleteModalConfirmBtn) deleteModalConfirmBtn.addEventListener('click', confirmDeleteArticle);
});
