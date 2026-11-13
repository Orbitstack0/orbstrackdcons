/**
 * Decolar Consórcios — admin-article-details.js
 * Central de detalhes editoriais, métricas reais e governança de artigos.
 */

document.addEventListener('DOMContentLoaded', () => {
  const guard = window.DecolarAdminGuard;
  const profileApi = window.DecolarAdminProfile;
  // Rota-ciente: '.html' no desenvolvimento local (Live Server), rota
  // limpa em produção (GitHub Pages, servida a partir de dist/).
  const isHtmlPath = window.location.pathname.endsWith('.html');
  const SELECT_PROFILE_PAGE = isHtmlPath ? 'selecionar-perfil.html' : '/admin/selecionar-perfil/';
  const ARTIGOS_PAGE = isHtmlPath ? 'artigos.html' : '/admin/artigos/';
  const ARTIGO_EDITOR_BASE = isHtmlPath ? 'artigo-editor.html' : '/admin/artigo-editor/';
  const ARTIGO_PUBLICO_BASE = isHtmlPath ? '/artigo.html' : '/artigo/';

  // Telas de verificação inicial de acesso
  const accessLoading = document.getElementById('admin-loading-state');
  const accessError = document.getElementById('admin-error-state');
  const accessRetryBtn = document.getElementById('admin-retry-btn');
  const adminShell = document.getElementById('admin-shell');

  // Botões de navegação lateral
  const logoutBtn = document.getElementById('admin-logout-btn');
  const switchProfileBtn = document.getElementById('admin-switch-profile-btn');

  // Estados de carregamento do artigo
  const detailsLoading = document.getElementById('admin-details-loading-state');
  const detailsError = document.getElementById('admin-details-error-state');
  const detailsContent = document.getElementById('admin-details-content');

  // Elementos do cabeçalho e ações
  const viewPublicBtn = document.getElementById('admin-details-view-public-btn');
  const editBtn = document.getElementById('admin-details-edit-btn');
  const deleteBtn = document.getElementById('admin-details-delete-btn');

  // Métricas de audiência real (Supabase)
  const statViewsValue = document.getElementById('stat-views-value');
  const statViewsDesc = document.getElementById('stat-views-desc');
  const statUniquesValue = document.getElementById('stat-uniques-value');
  const statUniquesDesc = document.getElementById('stat-uniques-desc');
  const statAvgTimeValue = document.getElementById('stat-avg-time-value');
  const statAvgTimeDesc = document.getElementById('stat-avg-time-desc');

  // Indicadores editoriais do conteúdo
  const statStatusPill = document.getElementById('stat-status-pill');
  const statStatusDesc = document.getElementById('stat-status-desc');
  const statReadingTime = document.getElementById('stat-reading-time');
  const statWordCount = document.getElementById('stat-word-count');

  // Identificação e conteúdo
  const titleEl = document.getElementById('article-details-title');
  const excerptEl = document.getElementById('article-details-excerpt');
  const slugEl = document.getElementById('article-details-slug');
  const urlTextEl = document.getElementById('article-details-url-text');
  const urlNoteEl = document.getElementById('article-details-url-note');
  const copyUrlBtn = document.getElementById('article-details-copy-url-btn');
  const metricsUpdatedEl = document.getElementById('admin-details-metrics-updated');
  const metricsErrorAlert = document.getElementById('admin-details-metrics-error');

  // Capa e metadados
  const coverImg = document.getElementById('article-details-cover-img');
  const coverEmpty = document.getElementById('article-details-cover-empty');
  const copyCoverBtn = document.getElementById('article-details-copy-cover-btn');
  const typeEl = document.getElementById('article-details-type');
  const authorEl = document.getElementById('article-details-author');
  const reviewerEl = document.getElementById('article-details-reviewer');
  const categoryEl = document.getElementById('article-details-category');
  const sourceEl = document.getElementById('article-details-source');
  const featuredEl = document.getElementById('article-details-featured');
  const createdEl = document.getElementById('article-details-created');
  const publishedEl = document.getElementById('article-details-published');
  const updatedEl = document.getElementById('article-details-updated');
  const auditStatusEl = document.getElementById('article-details-audit-status');

  // Modal de exclusão
  const deleteModal = document.getElementById('admin-delete-modal');
  const deleteModalOverlay = document.getElementById('admin-delete-modal-overlay');
  const deleteModalTitle = document.getElementById('admin-delete-modal-title');
  const deleteModalText = document.getElementById('admin-delete-modal-text');
  const deleteModalWarningBox = document.getElementById('admin-delete-modal-warning-box');
  const deleteModalError = document.getElementById('admin-delete-modal-error');
  const deleteModalCancelBtn = document.getElementById('admin-delete-modal-cancel-btn');
  const deleteModalConfirmBtn = document.getElementById('admin-delete-modal-confirm-btn');

  const BUCKET_NAME = 'blog-covers';
  const SITE_PUBLIC_ORIGIN = 'https://decolarconsorcios.com.br';

  // Nomenclatura oficial das categorias (100% idêntica ao blog público e ao Supabase)
  const CATEGORY_NAMES = {
    entenda: 'Entenda o Consórcio',
    lances: 'Lances e Contemplação',
    imoveis: 'Imóveis',
    veiculos: 'Veículos',
    pesados: 'Pesados',
    seguranca: 'Segurança e Planejamento',
    mercado: 'Mercado e Atualidade',
  };

  let currentArticle = null;
  let isDeleting = false;

  function setAccessState(state) {
    if (accessLoading) accessLoading.hidden = state !== 'loading';
    if (accessError) accessError.hidden = state !== 'error';
    if (adminShell) adminShell.hidden = state !== 'shell';
  }

  function setDetailsState(state) {
    if (detailsLoading) detailsLoading.hidden = state !== 'loading';
    if (detailsError) detailsError.hidden = state !== 'error';
    if (detailsContent) detailsContent.hidden = state !== 'content';
  }

  function formatDate(isoDate) {
    if (!isoDate) return 'Não definida';
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return 'Data inválida';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      + ' às '
      + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function countWordsAndReadingTime(htmlContent) {
    if (typeof window !== 'undefined' && typeof window.estimateReadingTime === 'function' && typeof window.countArticleWords === 'function') {
      const words = window.countArticleWords(htmlContent);
      const readingTimeMinutes = window.estimateReadingTime(htmlContent) || 1;
      return { words, readingTimeMinutes };
    }
    if (!htmlContent || typeof htmlContent !== 'string') {
      return { words: 0, readingTimeMinutes: 1 };
    }
    const plain = (typeof window !== 'undefined' && typeof window.stripHtmlToText === 'function')
      ? window.stripHtmlToText(htmlContent)
      : String(htmlContent)
          .replace(/<\/(p|div|h[1-6]|li|blockquote|tr|table|section|article)>/gi, ' ')
          .replace(/<[^>]*>/g, ' ')
          .replace(/&nbsp;/gi, ' ');
    const words = plain.trim().split(/\s+/).filter(Boolean).length;
    const readingTimeMinutes = Math.max(1, Math.ceil(words / 200));
    return { words, readingTimeMinutes };
  }

  function getArticlePublicDetails(slug) {
    const safeSlug = slug || '';
    // Caminho absoluto a partir da raiz do site — funciona independente da
    // profundidade da página do admin (admin/*.html no dev ou
    // admin/<rota>/ em produção): rota-ciente via ARTIGO_PUBLICO_BASE.
    const path = `${ARTIGO_PUBLICO_BASE}?slug=${encodeURIComponent(safeSlug)}`;
    const host = window.location.hostname;
    const isLocal = !host || host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || window.location.protocol === 'file:';

    const canonicalUrl = `${SITE_PUBLIC_ORIGIN}${path}`;
    const localPreviewUrl = path;

    return {
      canonicalUrl,
      localPreviewUrl,
      isLocal,
      displayUrl: canonicalUrl,
      navUrl: isLocal ? localPreviewUrl : canonicalUrl
    };
  }

  // Consulta do artigo no Supabase
  async function loadArticleDetails() {
    const urlParams = new URLSearchParams(window.location.search);
    const articleId = urlParams.get('id');

    if (!articleId) {
      setDetailsState('error');
      return;
    }

    const client = window.adminSupabase;
    if (!client) {
      setDetailsState('error');
      return;
    }

    setDetailsState('loading');

    try {
      const { data: article, error } = await client
        .from('blog_articles')
        .select('*')
        .eq('id', articleId)
        .single();

      if (error || !article) {
        throw error || new Error('Artigo não encontrado');
      }

      currentArticle = article;

      // Buscar métricas reais consolidadas de public.blog_article_metrics
      let metrics = null;
      let metricsLoadError = false;

      try {
        const { data: metricsData, error: metricsErr } = await client
          .from('blog_article_metrics')
          .select('total_qualified_views, total_qualified_seconds, estimated_unique_visitors, updated_at')
          .eq('article_id', article.id)
          .maybeSingle();

        if (metricsErr) {
          console.error('Decolar Admin: erro ao consultar blog_article_metrics.', metricsErr);
          metricsLoadError = true;
        } else {
          metrics = metricsData || {
            total_qualified_views: 0,
            total_qualified_seconds: 0,
            estimated_unique_visitors: 0,
            updated_at: null,
          };
        }
      } catch (err) {
        console.error('Decolar Admin: exceção ao buscar métricas.', err);
        metricsLoadError = true;
      }

      renderArticleDetails(article, metrics, metricsLoadError);
      setDetailsState('content');
    } catch (err) {
      console.error('Decolar Admin: erro ao carregar detalhes do artigo.', err);
      setDetailsState('error');
    }
  }

  function formatActiveReadingTime(totalSeconds, totalViews) {
    if (!totalViews || totalViews <= 0 || !totalSeconds || totalSeconds <= 0) {
      return '0 s';
    }
    const avgSeconds = Math.round(totalSeconds / totalViews);
    if (avgSeconds < 60) {
      return `${avgSeconds} s`;
    }
    const mins = Math.floor(avgSeconds / 60);
    const secs = avgSeconds % 60;
    return secs > 0 ? `${mins} min ${secs} s` : `${mins} min`;
  }

  function renderArticleDetails(article, metrics, metricsLoadError) {
    const isDraft = article.status === 'draft';
    const publicInfo = getArticlePublicDetails(article.slug || '');

    // Ações do topo
    if (editBtn) {
      editBtn.href = `${ARTIGO_EDITOR_BASE}?id=${encodeURIComponent(article.id)}`;
      editBtn.textContent = isDraft ? 'Continuar escrevendo' : 'Editar artigo';
    }

    if (viewPublicBtn) {
      if (isDraft) {
        viewPublicBtn.hidden = true;
      } else {
        viewPublicBtn.href = publicInfo.navUrl;
        viewPublicBtn.hidden = false;
      }
    }

    // 1. Métricas Reais de Audiência e Engajamento (Supabase)
    const views = Number(metrics?.total_qualified_views || 0);
    const uniques = Number(metrics?.estimated_unique_visitors || 0);
    const totalSeconds = Number(metrics?.total_qualified_seconds || 0);

    if (statViewsValue) {
      if (metricsLoadError) {
        statViewsValue.textContent = '—';
        if (statViewsDesc) statViewsDesc.textContent = 'Erro ao carregar métricas';
      } else {
        statViewsValue.textContent = views.toLocaleString('pt-BR');
        if (statViewsDesc) {
          statViewsDesc.textContent = views === 1
            ? '1 leitura ativa confirmada'
            : (views === 0 ? 'Nenhuma leitura qualificada ainda' : 'Leituras qualificadas (≥ 5s)');
        }
      }
    }

    if (statUniquesValue) {
      if (metricsLoadError) {
        statUniquesValue.textContent = '—';
        if (statUniquesDesc) statUniquesDesc.textContent = 'Erro ao carregar métricas';
      } else {
        statUniquesValue.textContent = uniques.toLocaleString('pt-BR');
        if (statUniquesDesc) {
          statUniquesDesc.textContent = uniques === 1
            ? '1 conexão distinta registrada'
            : (uniques === 0 ? 'Nenhum visitante registrado' : 'Conexões diárias distintas (anônimo)');
        }
      }
    }

    if (statAvgTimeValue) {
      if (metricsLoadError) {
        statAvgTimeValue.textContent = '—';
        if (statAvgTimeDesc) statAvgTimeDesc.textContent = 'Erro ao carregar métricas';
      } else if (views > 0 && totalSeconds > 0) {
        statAvgTimeValue.textContent = formatActiveReadingTime(totalSeconds, views);
        if (statAvgTimeDesc) statAvgTimeDesc.textContent = 'Média ativa real por sessão';
      } else {
        statAvgTimeValue.textContent = '—';
        if (statAvgTimeDesc) statAvgTimeDesc.textContent = 'Aguardando leituras ativas';
      }
    }

    // 2. Indicadores Editoriais do Conteúdo
    if (statStatusPill) {
      statStatusPill.className = `admin-details-stat-pill ${isDraft ? 'admin-details-stat-pill--draft' : 'admin-details-stat-pill--published'}`;
      statStatusPill.textContent = isDraft ? 'Rascunho' : 'Publicado';
    }
    if (statStatusDesc) {
      statStatusDesc.textContent = isDraft
        ? 'Visível apenas para a equipe'
        : `No ar desde ${formatDate(article.published_at)}`;
    }

    const { words, readingTimeMinutes } = countWordsAndReadingTime(article.content);
    if (statReadingTime) statReadingTime.textContent = `${readingTimeMinutes} min`;
    if (statWordCount) statWordCount.textContent = `${words.toLocaleString('pt-BR')}`;

    // Sincronização e Auditoria no Painel
    if (metricsUpdatedEl) {
      if (metrics?.updated_at) {
        metricsUpdatedEl.textContent = formatDate(metrics.updated_at);
      } else {
        metricsUpdatedEl.textContent = 'Ainda sem atividade registrada';
      }
    }

    if (metricsErrorAlert) {
      metricsErrorAlert.hidden = !metricsLoadError;
    }

    // Identificação e Conteúdo
    if (titleEl) titleEl.textContent = article.title || 'Sem título';
    if (excerptEl) excerptEl.textContent = article.excerpt || 'Sem resumo editorial informado.';
    if (slugEl) slugEl.textContent = article.slug || '—';
    if (urlTextEl) urlTextEl.textContent = publicInfo.displayUrl;

    if (urlNoteEl) {
      if (publicInfo.isLocal) {
        urlNoteEl.textContent = 'Ambiente de desenvolvimento: o link acima é a URL canônica pública de produção. Ao clicar em "Ver no site", a prévia local é aberta.';
      } else {
        urlNoteEl.textContent = 'URL canônica oficial indexada pelos mecanismos de busca.';
      }
    }

    if (copyUrlBtn) {
      copyUrlBtn.onclick = () => {
        navigator.clipboard.writeText(publicInfo.canonicalUrl).then(() => {
          const originalText = copyUrlBtn.textContent;
          copyUrlBtn.textContent = 'Copiado!';
          setTimeout(() => {
            copyUrlBtn.textContent = originalText;
          }, 2000);
        }).catch(() => {
          alert('Não foi possível copiar automaticamente. Selecione e copie o link no campo ao lado.');
        });
      };
    }

    // Capa do Artigo
    if (article.cover_image_path) {
      if (coverImg) {
        coverImg.src = article.cover_image_path;
        coverImg.hidden = false;
      }
      if (coverEmpty) coverEmpty.hidden = true;
      if (copyCoverBtn) {
        copyCoverBtn.hidden = false;
        copyCoverBtn.onclick = () => {
          navigator.clipboard.writeText(article.cover_image_path).then(() => {
            const originalText = copyCoverBtn.textContent;
            copyCoverBtn.textContent = 'Endereço copiado!';
            setTimeout(() => {
              copyCoverBtn.textContent = originalText;
            }, 2000);
          }).catch(() => {
            alert('Não foi possível copiar o endereço da imagem.');
          });
        };
      }
    } else {
      if (coverImg) coverImg.hidden = true;
      if (coverEmpty) coverEmpty.hidden = false;
      if (copyCoverBtn) copyCoverBtn.hidden = true;
    }

    // Autoria e Metadados Editoriais
    const typeLabel = (article.article_type === 'guest' || article.article_type === 'visitor')
      ? 'Visitante / Comunidade'
      : 'Equipe Decolar';
    if (typeEl) typeEl.textContent = typeLabel;
    if (authorEl) authorEl.textContent = article.author_name || 'Não informado';
    if (reviewerEl) reviewerEl.textContent = article.reviewer_name || 'Não informado';

    // Categoria real correspondente ao Supabase e blog público
    const realCategoryName = CATEGORY_NAMES[article.category] || article.category || 'Geral';
    if (categoryEl) categoryEl.textContent = realCategoryName;

    if (sourceEl) sourceEl.textContent = article.source_name || 'Decolar Consórcios';

    if (featuredEl) {
      featuredEl.textContent = article.featured ? 'Sim, em Destaque na Capa' : 'Padrão (Grade regular)';
    }

    // Linha do Tempo e Auditoria
    if (createdEl) createdEl.textContent = formatDate(article.created_at);
    if (publishedEl) publishedEl.textContent = formatDate(article.published_at);
    if (updatedEl) updatedEl.textContent = formatDate(article.updated_at);

    if (auditStatusEl) {
      if (isDraft) {
        auditStatusEl.textContent = 'Em elaboração (não publicado)';
      } else if (article.published_at && article.updated_at) {
        const pubTime = new Date(article.published_at).getTime();
        const updTime = new Date(article.updated_at).getTime();
        if (updTime - pubTime > 2000) {
          auditStatusEl.textContent = `Atualizado após a publicação (${formatDate(article.updated_at)})`;
        } else {
          auditStatusEl.textContent = 'Versão original da publicação';
        }
      } else {
        auditStatusEl.textContent = 'Versão original';
      }
    }
  }

  // --------------------------------------------------------------------------
  // Exclusão de Artigo (Rascunho ou Publicado)
  // --------------------------------------------------------------------------
  function extractStoragePath(publicUrl) {
    if (typeof publicUrl !== 'string') return null;
    const marker = `/storage/v1/object/public/${BUCKET_NAME}/`;
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return null;
    return publicUrl.slice(idx + marker.length);
  }

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

  function openDeleteModal() {
    if (!currentArticle) return;
    const isPublished = currentArticle.status === 'published';

    if (deleteModalTitle) {
      deleteModalTitle.textContent = isPublished ? 'Excluir artigo publicado?' : 'Excluir rascunho?';
    }

    if (deleteModalText) {
      deleteModalText.textContent = `Você tem certeza que deseja excluir "${currentArticle.title}"? Esta operação é permanente e não poderá ser desfeita.`;
    }

    if (deleteModalWarningBox) {
      deleteModalWarningBox.hidden = !isPublished;
    }

    if (deleteModalError) {
      deleteModalError.hidden = true;
      deleteModalError.textContent = '';
    }

    if (deleteModal) deleteModal.hidden = false;
  }

  function closeDeleteModal() {
    if (isDeleting) return;
    if (deleteModal) deleteModal.hidden = true;
  }

  async function confirmDelete() {
    if (isDeleting || !currentArticle) return;
    const client = window.adminSupabase;
    if (!client) {
      if (deleteModalError) {
        deleteModalError.textContent = 'Cliente de conexão Supabase indisponível.';
        deleteModalError.hidden = false;
      }
      return;
    }

    isDeleting = true;
    if (deleteModalError) deleteModalError.hidden = true;
    if (deleteModalConfirmBtn) {
      deleteModalConfirmBtn.disabled = true;
      deleteModalConfirmBtn.textContent = 'Excluindo…';
    }
    if (deleteModalCancelBtn) deleteModalCancelBtn.disabled = true;

    try {
      // 1. Executa o DELETE exigindo .select('id') para comprovar que a linha foi de fato removida no banco
      const { data: deletedRows, error: deleteError } = await client
        .from('blog_articles')
        .delete()
        .eq('id', currentArticle.id)
        .select('id');

      if (deleteError) throw deleteError;

      // 2. VERIFICAÇÃO CRÍTICA: Se deletedRows for vazio, NENHUMA linha foi excluída (bloqueio de RLS no Supabase)
      if (!deletedRows || !deletedRows.length) {
        console.warn('Decolar Admin: exclusão retornou 0 linhas afetadas pelo Supabase.', {
          articleId: currentArticle.id,
          status: currentArticle.status
        });

        isDeleting = false;
        if (deleteModalConfirmBtn) {
          deleteModalConfirmBtn.disabled = false;
          deleteModalConfirmBtn.textContent = 'Sim, excluir definitivamente';
        }
        if (deleteModalCancelBtn) deleteModalCancelBtn.disabled = false;

        if (deleteModalError) {
          const isPublished = currentArticle.status === 'published';
          deleteModalError.textContent = isPublished
            ? 'O artigo não foi excluído porque o banco de dados recusou a operação. A política de segurança (RLS) atual do Supabase bloqueia a exclusão de artigos publicados. Para autorizar, execute o script SQL de permissões no Supabase.'
            : 'Este artigo não pôde ser excluído agora. O registro pode já ter sido removido ou as permissões de acesso foram recusadas.';
          deleteModalError.hidden = false;
        }
        return; // NUNCA REDIRECIONAR QUANDO 0 LINHAS FOREM AFETADAS!
      }

      // 3. Comprovada a remoção da linha no banco, limpa a capa do Storage (se não for compartilhada)
      if (currentArticle.cover_image_path) {
        try {
          await cleanupCoverIfExclusive(client, currentArticle.id, currentArticle.cover_image_path);
        } catch (storageErr) {
          console.warn('Decolar Admin: capa órfã após exclusão de artigo.', storageErr);
        }
      }

      // 4. Somente após confirmação positiva e irrefutável, redireciona para a lista
      window.location.replace(`${ARTIGOS_PAGE}?deleted=1`);
    } catch (err) {
      console.error('Decolar Admin: erro na operação de exclusão do artigo.', err);
      isDeleting = false;
      if (deleteModalConfirmBtn) {
        deleteModalConfirmBtn.disabled = false;
        deleteModalConfirmBtn.textContent = 'Sim, excluir definitivamente';
      }
      if (deleteModalCancelBtn) deleteModalCancelBtn.disabled = false;
      if (deleteModalError) {
        deleteModalError.textContent = 'Não foi possível excluir o artigo: ' + (err.message || 'Falha de comunicação com o Supabase.');
        deleteModalError.hidden = false;
      }
    }
  }

  // Event Listeners
  if (deleteBtn) deleteBtn.addEventListener('click', openDeleteModal);
  if (deleteModalCancelBtn) deleteModalCancelBtn.addEventListener('click', closeDeleteModal);
  if (deleteModalOverlay) deleteModalOverlay.addEventListener('click', closeDeleteModal);
  if (deleteModalConfirmBtn) deleteModalConfirmBtn.addEventListener('click', confirmDelete);

  // Inicialização com guarda de autenticação
  function runAccessCheck() {
    if (!guard || !profileApi) {
      setAccessState('error');
      return;
    }
    setAccessState('loading');
    guard
      .requireAdmin()
      .then(() => {
        const profile = profileApi.requireProfile();
        if (!profile) return;
        setAccessState('shell');
        loadArticleDetails();
      })
      .catch(() => setAccessState('error'));
  }

  if (accessRetryBtn) accessRetryBtn.addEventListener('click', runAccessCheck);
  if (logoutBtn) logoutBtn.addEventListener('click', () => { if (guard) guard.logout(); });
  if (switchProfileBtn) {
    switchProfileBtn.addEventListener('click', () => {
      if (profileApi) profileApi.clearSelectedProfile();
      window.location.replace(SELECT_PROFILE_PAGE);
    });
  }

  runAccessCheck();
});
