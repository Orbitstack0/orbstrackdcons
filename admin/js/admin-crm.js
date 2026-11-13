/**
 * Decolar Consórcios — admin-crm.js
 * Lógica da tela de apresentação visual do futuro CRM Decolar (admin/crm.html).
 *
 * Protegido pela autenticação administrativa existente:
 * - DecolarAdminGuard.requireAdmin() (valida sessão Supabase e blog_admins)
 * - DecolarAdminProfile.requireProfile() (garante perfil ativo selecionado)
 *
 * ESTA ETAPA É EXCLUSIVAMENTE VISUAL:
 * Não realiza chamadas de banco para dados de clientes, não cria tabelas
 * e não altera qualquer lógica do blog ou de métricas.
 */
document.addEventListener('DOMContentLoaded', () => {
  // Rota-ciente: '.html' no desenvolvimento local (Live Server), rota
  // limpa em produção (GitHub Pages, servida a partir de dist/).
  const SELECT_PROFILE_PAGE = window.location.pathname.endsWith('.html') ? 'selecionar-perfil.html' : '/admin/selecionar-perfil/';
  const loadingState = document.getElementById('admin-loading-state');
  const errorState = document.getElementById('admin-error-state');
  const retryBtn = document.getElementById('admin-retry-btn');
  const shell = document.getElementById('admin-shell');
  const logoutBtn = document.getElementById('admin-logout-btn');
  const switchProfileBtn = document.getElementById('admin-switch-profile-btn');
  const userNameEl = document.getElementById('admin-user-name');
  const userEmailEl = document.getElementById('admin-user-email');

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

  function showShell(user, profile) {
    if (loadingState) loadingState.hidden = true;
    if (errorState) errorState.hidden = true;
    if (shell) shell.hidden = false;

    const email = (user && user.email) || '';
    if (userEmailEl) userEmailEl.textContent = email;
    if (userNameEl) {
      userNameEl.textContent = (profile && profile.firstName) || email.split('@')[0] || 'administrador';
    }
  }

  function runAuthCheck() {
    if (!guard || !profileApi) {
      showError();
      return;
    }

    showLoading();

    guard
      .requireAdmin()
      .then((session) => {
        const profile = profileApi.requireProfile();
        if (!profile) return;
        showShell(session && session.user, profile);
      })
      .catch((err) => {
        console.warn('Erro ao verificar acesso administrativo ao CRM Decolar:', err);
        showError();
      });
  }

  // Event Listeners de navegação e autenticação
  if (retryBtn) {
    retryBtn.addEventListener('click', runAuthCheck);
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      if (guard) guard.logout();
    });
  }

  if (switchProfileBtn) {
    switchProfileBtn.addEventListener('click', () => {
      if (profileApi) {
        profileApi.clearSelectedProfile();
      }
      window.location.replace(SELECT_PROFILE_PAGE);
    });
  }

  // Inicia checagem de autorização
  runAuthCheck();
});

