/**
 * Decolar Consórcios — admin-dashboard.js
 * Lógica exclusiva do painel inicial (admin/index.html).
 * Nenhum conteúdo do painel é revelado antes de DecolarAdminGuard.requireAdmin()
 * resolver com uma sessão autorizada em blog_admins, E de haver um perfil
 * visual selecionado nesta sessão (DecolarAdminProfile.requireProfile()).
 */
document.addEventListener('DOMContentLoaded', () => {
  const loadingState = document.getElementById('admin-loading-state');
  const errorState = document.getElementById('admin-error-state');
  const retryBtn = document.getElementById('admin-retry-btn');
  const shell = document.getElementById('admin-shell');
  const logoutBtn = document.getElementById('admin-logout-btn');
  const switchProfileBtn = document.getElementById('admin-switch-profile-btn');
  const userNameEl = document.getElementById('admin-user-name');
  const userEmailEl = document.getElementById('admin-user-email');

  const draftNotice = document.getElementById('admin-draft-notice');
  const draftNoticeTitleEl = document.getElementById('admin-draft-notice-title');
  const draftNoticeTextEl = document.getElementById('admin-draft-notice-text');
  const draftNoticeArticleEl = document.getElementById('admin-draft-notice-article');
  const draftNoticeContinueBtn = document.getElementById('admin-draft-notice-continue-btn');
  const draftNoticeDismissBtn = document.getElementById('admin-draft-notice-dismiss-btn');

  const guard = window.DecolarAdminGuard;
  const profileApi = window.DecolarAdminProfile;

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

  function showDashboard(user, profile) {
    if (loadingState) loadingState.hidden = true;
    if (errorState) errorState.hidden = true;
    if (shell) shell.hidden = false;

    const email = (user && user.email) || '';
    if (userEmailEl) userEmailEl.textContent = email;
    if (userNameEl) {
      userNameEl.textContent = (profile && profile.firstName) || email.split('@')[0] || 'administrador';
    }

    loadDraftNotice(profile);
  }

  // --------------------------------------------------------------------
  // Aviso de rascunho pendente — personalizado por perfil, dispensável
  // durante a sessão atual, nunca com conteúdo fictício (só aparece após
  // uma consulta real a blog_articles confirmar que há rascunhos no nome
  // do perfil ativo). A dispensa é apenas visual: não altera dados nem
  // é persistida entre sessões/navegadores.
  // --------------------------------------------------------------------
  function draftNoticeDismissKey(profile) {
    return `decolar-admin-draft-notice-dismissed-${profile.id}`;
  }

  function isDraftNoticeDismissed(profile) {
    try {
      return window.sessionStorage.getItem(draftNoticeDismissKey(profile)) === '1';
    } catch (err) {
      return false;
    }
  }

  function dismissDraftNotice(profile) {
    try {
      window.sessionStorage.setItem(draftNoticeDismissKey(profile), '1');
    } catch (err) {
      // sessionStorage indisponível — sem persistência, mas a UI já esconde o aviso abaixo.
    }
    if (draftNotice) draftNotice.hidden = true;
  }

  function loadDraftNotice(profile) {
    if (!draftNotice || !profile) return;

    if (isDraftNoticeDismissed(profile)) {
      draftNotice.hidden = true;
      return;
    }

    const client = window.adminSupabase;
    if (!client) {
      draftNotice.hidden = true;
      return;
    }

    client
      .from('blog_articles')
      .select('id,title,updated_at')
      .eq('status', 'draft')
      .eq('author_name', profile.fullName)
      .order('updated_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) throw error;

        const drafts = Array.isArray(data) ? data : [];
        if (!drafts.length) {
          draftNotice.hidden = true;
          return;
        }

        const latest = drafts[0];
        const total = drafts.length;

        if (draftNoticeTitleEl) {
          draftNoticeTitleEl.textContent = `Bora terminar seu artigo, ${profile.firstName}?`;
        }
        if (draftNoticeTextEl) {
          draftNoticeTextEl.textContent = total > 1
            ? `Você tem ${total} rascunhos esperando por você. Continue de onde parou!`
            : 'Você tem um rascunho esperando por você. Continue de onde parou!';
        }
        if (draftNoticeArticleEl) {
          draftNoticeArticleEl.textContent = latest.title || 'Sem título';
        }
        if (draftNoticeContinueBtn) {
          draftNoticeContinueBtn.href = `artigo-editor.html?id=${encodeURIComponent(latest.id)}`;
        }

        draftNotice.hidden = false;
      })
      .catch((err) => {
        console.error('Decolar Admin: falha ao verificar rascunhos pendentes.', err);
        draftNotice.hidden = true;
      });
  }

  if (draftNoticeDismissBtn) {
    draftNoticeDismissBtn.addEventListener('click', () => {
      const profile = profileApi ? profileApi.getSelectedProfile() : null;
      if (profile) {
        dismissDraftNotice(profile);
      } else if (draftNotice) {
        draftNotice.hidden = true;
      }
    });
  }

  function runCheck() {
    if (!guard || !profileApi) {
      showError();
      return;
    }

    showLoading();

    guard
      .requireAdmin()
      .then((result) => {
        // requireProfile() redireciona por conta própria para
        // selecionar-perfil.html quando não há perfil ainda nesta sessão.
        // Nesse caso devolve null e o shell permanece oculto — a página já
        // está saindo, então não há conteúdo a revelar momentaneamente.
        const profile = profileApi.requireProfile();
        if (!profile) return;
        showDashboard(result && result.user, profile);
      })
      .catch(() => {
        // requireAdmin() já redirecionou para login.html nos casos de
        // "sem sessão" e "não autorizado". O que chega aqui é só a falha
        // de verificação (rede/SDK) — por isso mostramos erro com opção
        // de tentar novamente, em vez de expulsar o administrador.
        showError();
      });
  }

  if (retryBtn) {
    retryBtn.addEventListener('click', runCheck);
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      if (guard) guard.logout();
    });
  }

  if (switchProfileBtn) {
    switchProfileBtn.addEventListener('click', () => {
      if (profileApi) profileApi.clearSelectedProfile();
      window.location.replace('selecionar-perfil.html');
    });
  }

  runCheck();
});
