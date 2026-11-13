/**
 * Decolar Consórcios — admin-profile-select.js
 * Lógica exclusiva da tela de seleção de perfil (admin/selecionar-perfil.html).
 *
 * Exige exatamente o mesmo requireAdmin() das demais páginas protegidas —
 * as telas desta página NUNCA são exibidas a quem não está autenticado e
 * autorizado, mesmo sendo "apenas visual". Depois da autorização, se a
 * sessão já tiver um perfil escolhido (ex.: a pessoa digitou esta URL
 * diretamente), pula direto para o dashboard em vez de pedir de novo.
 *
 * Fluxo desta página (depois do login, que já aconteceu antes de chegar
 * aqui): código individual -> confirmação com foto e nome -> dashboard.
 * O código serve só para decidir qual perfil mostrar na confirmação; quem
 * de fato grava a escolha (e só aceita um dos três ids válidos) é
 * DecolarAdminProfile.setSelectedProfile(), exatamente como antes.
 */
document.addEventListener('DOMContentLoaded', () => {
  // Rota-ciente: '.html' no desenvolvimento local (Live Server), rota
  // limpa em produção (GitHub Pages, servida a partir de dist/).
  const isHtmlPath = window.location.pathname.endsWith('.html');
  const INDEX_PAGE = isHtmlPath ? 'index.html' : '/admin/';
  const LOGIN_PAGE = isHtmlPath ? 'login.html' : '/admin/login/';

  const loadingState = document.getElementById('admin-loading-state');
  const errorState = document.getElementById('admin-error-state');
  const retryBtn = document.getElementById('admin-retry-btn');

  const codeScreen = document.getElementById('admin-code-screen');
  const codeForm = document.getElementById('admin-code-form');
  const codeInput = document.getElementById('admin-code-input');
  const codeError = document.getElementById('admin-code-error');
  const codeBackBtn = document.getElementById('admin-code-back');

  const confirmScreen = document.getElementById('admin-confirm-screen');
  const confirmPhoto = document.getElementById('admin-confirm-photo');
  const confirmName = document.getElementById('admin-confirm-name');
  const confirmYesBtn = document.getElementById('admin-confirm-yes');
  const confirmNoBtn = document.getElementById('admin-confirm-no');

  const guard = window.DecolarAdminGuard;
  const profileApi = window.DecolarAdminProfile;
  const codesApi = window.DecolarAdminProfileCodes;

  // Perfil identificado pelo código, aguardando confirmação. Só é usado
  // para preencher a tela de confirmação — a gravação real do perfil só
  // acontece em "Sim, sou eu", via profileApi.setSelectedProfile().
  let candidateProfile = null;

  function hideAllScreens() {
    if (loadingState) loadingState.hidden = true;
    if (errorState) errorState.hidden = true;
    if (codeScreen) codeScreen.hidden = true;
    if (confirmScreen) confirmScreen.hidden = true;
  }

  function showLoading() {
    hideAllScreens();
    if (loadingState) loadingState.hidden = false;
  }

  function showError() {
    hideAllScreens();
    if (errorState) errorState.hidden = false;
  }

  function showCodeScreen() {
    hideAllScreens();
    if (codeScreen) codeScreen.hidden = false;
    if (codeError) codeError.hidden = true;
    if (codeInput) {
      codeInput.value = '';
      codeInput.focus();
    }
  }

  function showConfirmScreen(profile) {
    hideAllScreens();
    candidateProfile = profile;
    if (confirmPhoto) {
      confirmPhoto.src = profile.photo || '';
      confirmPhoto.alt = profile.fullName;
    }
    if (confirmName) confirmName.textContent = profile.fullName;
    if (confirmScreen) confirmScreen.hidden = false;
  }

  function showCodeError(message) {
    if (!codeError) return;
    codeError.textContent = message;
    codeError.hidden = false;
  }

  function handleCodeSubmit(event) {
    event.preventDefault();
    if (!codeInput || !codesApi || !profileApi) return;

    // Mantido como texto (nunca Number()) para não perder zero à esquerda.
    const code = codeInput.value.trim();

    if (!/^\d{4}$/.test(code)) {
      showCodeError('Digite um código de 4 dígitos.');
      return;
    }

    const profileId = codesApi.resolveProfileIdByCode(code);
    const profile = profileId
      ? profileApi.PROFILES.find((item) => item.id === profileId)
      : null;

    if (!profile) {
      showCodeError('Código não reconhecido.');
      return;
    }

    showConfirmScreen(profile);
  }

  function handleConfirmYes() {
    if (!candidateProfile || !profileApi) return;
    profileApi.setSelectedProfile(candidateProfile.id);
    window.location.replace(INDEX_PAGE);
  }

  function handleConfirmNo() {
    candidateProfile = null;
    showCodeScreen();
  }

  function handleBack() {
    // "Voltar" encerra a sessão, igual ao logout já existente nas demais
    // páginas do painel — não deixa uma sessão autenticada pendurada só
    // porque a pessoa recuou nesta etapa.
    if (guard && typeof guard.logout === 'function') {
      guard.logout();
    } else {
      window.location.replace(LOGIN_PAGE);
    }
  }

  function runCheck() {
    if (!guard || !profileApi || !codesApi) {
      showError();
      return;
    }

    showLoading();

    guard
      .requireAdmin()
      .then(() => {
        const existing = profileApi.getSelectedProfile();
        if (existing) {
          // Já há um perfil válido nesta sessão — não repete a escolha.
          window.location.replace(INDEX_PAGE);
          return;
        }
        showCodeScreen();
      })
      .catch(() => {
        // requireAdmin() já redireciona ao login nos casos de sessão
        // ausente/não autorizada; o que chega aqui é falha de verificação
        // (rede/SDK) — mostramos erro com retry, sem expulsar ninguém.
        showError();
      });
  }

  if (retryBtn) retryBtn.addEventListener('click', runCheck);
  if (codeForm) codeForm.addEventListener('submit', handleCodeSubmit);
  if (codeInput) {
    codeInput.addEventListener('input', () => {
      // Só dígitos, no máximo 4 — nunca interpreta como número.
      codeInput.value = codeInput.value.replace(/\D/g, '').slice(0, 4);
      if (codeError && !codeError.hidden) codeError.hidden = true;
    });
  }
  if (codeBackBtn) codeBackBtn.addEventListener('click', handleBack);
  if (confirmYesBtn) confirmYesBtn.addEventListener('click', handleConfirmYes);
  if (confirmNoBtn) confirmNoBtn.addEventListener('click', handleConfirmNo);

  runCheck();
});
