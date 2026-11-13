/**
 * Decolar Consórcios — admin-login.js
 * Lógica exclusiva da tela de login (admin/login.html).
 */
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('admin-login-form');
  const emailInput = document.getElementById('admin-email');
  const passwordInput = document.getElementById('admin-password');
  const errorBox = document.getElementById('admin-login-error');
  const submitBtn = document.getElementById('admin-login-submit');
  const forgotLink = document.getElementById('admin-forgot-link');

  const forgotForm = document.getElementById('admin-forgot-form');
  const forgotEmailInput = document.getElementById('admin-forgot-email');
  const forgotErrorBox = document.getElementById('admin-forgot-error');
  const forgotSuccessBox = document.getElementById('admin-forgot-success');
  const forgotSubmitBtn = document.getElementById('admin-forgot-submit');
  const backToLoginBtn = document.getElementById('admin-back-to-login');

  const passwordToggleBtn = document.getElementById('admin-password-toggle');
  const eyeShowIcon = passwordToggleBtn ? passwordToggleBtn.querySelector('.admin-eye-icon--show') : null;
  const eyeHideIcon = passwordToggleBtn ? passwordToggleBtn.querySelector('.admin-eye-icon--hide') : null;

  const eyebrowEl = document.getElementById('admin-login-eyebrow');
  const titleEl = document.getElementById('admin-login-title');

  const guard = window.DecolarAdminGuard;
  const params = new URLSearchParams(window.location.search);
  // Rota-ciente: '.html' no desenvolvimento local (Live Server), rota
  // limpa em produção (GitHub Pages, servida a partir de dist/).
  const INDEX_PAGE = window.location.pathname.endsWith('.html') ? 'index.html' : '/admin/';

  function showError(message) {
    if (!errorBox) return;
    errorBox.textContent = message;
    errorBox.hidden = false;
  }

  function hideError() {
    if (!errorBox) return;
    errorBox.hidden = true;
    errorBox.textContent = '';
  }

  function setSubmitting(isSubmitting) {
    if (!submitBtn) return;
    submitBtn.disabled = isSubmitting;
    submitBtn.textContent = isSubmitting ? 'Entrando…' : 'Entrar';
  }

  // Mensagem vinda do guard de outra página (ex.: usuário autenticado,
  // mas fora de blog_admins, redirecionado de volta para cá).
  if (params.get('error') === 'unauthorized') {
    showError('Esta conta não tem permissão para acessar o painel administrativo.');
  } else if (guard) {
    // Sem erro na URL: se já existir uma sessão válida de administrador
    // (ex.: usuário voltou para /login.html por engano), pula direto para
    // o painel em vez de pedir login de novo.
    guard.checkAdminAuthorization().then((result) => {
      if (result.status === 'authorized') {
        window.location.replace(INDEX_PAGE);
      }
    });
  }

  function showForgotError(message) {
    if (!forgotErrorBox) return;
    forgotErrorBox.textContent = message;
    forgotErrorBox.hidden = false;
  }

  function hideForgotError() {
    if (!forgotErrorBox) return;
    forgotErrorBox.hidden = true;
    forgotErrorBox.textContent = '';
  }

  function hideForgotSuccess() {
    if (!forgotSuccessBox) return;
    forgotSuccessBox.hidden = true;
    forgotSuccessBox.textContent = '';
  }

  function setForgotSubmitting(isSubmitting) {
    if (!forgotSubmitBtn) return;
    forgotSubmitBtn.disabled = isSubmitting;
    forgotSubmitBtn.textContent = isSubmitting ? 'Enviando…' : 'Enviar link de recuperação';
  }

  function showLoginForm() {
    if (form) form.hidden = false;
    if (forgotForm) forgotForm.hidden = true;
    hideForgotError();
    hideForgotSuccess();
    if (eyebrowEl) eyebrowEl.textContent = 'Bem-vindo à Decolar';
    if (titleEl) titleEl.textContent = 'Painel Administrativo';
  }

  function showForgotForm() {
    if (form) form.hidden = true;
    if (forgotForm) forgotForm.hidden = false;
    hideError();
    if (eyebrowEl) eyebrowEl.textContent = 'Recuperação de senha';
    if (titleEl) titleEl.textContent = 'Esqueceu sua senha?';
  }

  // Alterna a visibilidade da senha digitada sem alterar seu valor —
  // apenas troca o atributo "type" do campo entre password/text.
  if (passwordToggleBtn && passwordInput) {
    passwordToggleBtn.addEventListener('click', () => {
      const willShow = passwordInput.type === 'password';
      passwordInput.type = willShow ? 'text' : 'password';
      if (eyeShowIcon) eyeShowIcon.hidden = willShow;
      if (eyeHideIcon) eyeHideIcon.hidden = !willShow;
      passwordToggleBtn.setAttribute('aria-label', willShow ? 'Ocultar senha' : 'Mostrar senha');
      passwordToggleBtn.setAttribute('aria-pressed', String(willShow));
    });
  }

  if (forgotLink) {
    forgotLink.addEventListener('click', () => {
      showForgotForm();
    });
  }

  if (backToLoginBtn) {
    backToLoginBtn.addEventListener('click', () => {
      showLoginForm();
    });
  }

  if (forgotForm) {
    forgotForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      hideForgotError();
      hideForgotSuccess();

      const email = (forgotEmailInput && forgotEmailInput.value || '').trim();

      if (!email) {
        showForgotError('Informe seu e-mail.');
        return;
      }

      const client = window.adminSupabase;
      if (!client) {
        showForgotError('Não foi possível conectar ao serviço de autenticação. Verifique sua conexão.');
        return;
      }

      // redirectTo é construído a partir da própria origem do site, para
      // sempre apontar exatamente para a página servida — seja no
      // desenvolvimento local (ex.: http://localhost:5500/admin/login.html
      // -> .../admin/redefinir-senha.html) ou em produção, com rotas
      // limpas (https://decolarconsorcios.com.br/admin/login/ ->
      // .../admin/redefinir-senha/). Esse endereço (nas duas formas)
      // precisa estar cadastrado nas "Redirect URLs" do Supabase Auth.
      const isHtmlPath = window.location.pathname.endsWith('.html');
      const resetPath = isHtmlPath
        ? window.location.pathname.replace(/login\.html$/, 'redefinir-senha.html')
        : window.location.pathname.replace(/\/login\/?$/, '/redefinir-senha/');
      const redirectTo = window.location.origin + resetPath;

      setForgotSubmitting(true);

      try {
        const { error: resetError } = await client.auth.resetPasswordForEmail(email, { redirectTo: redirectTo });

        setForgotSubmitting(false);

        if (resetError) {
          // Mensagem genérica: não confirma nem nega se o e-mail existe
          // na base de usuários.
          showForgotSuccess('Se este e-mail estiver cadastrado, um link de recuperação foi enviado.');
          if (forgotForm) forgotForm.reset();
          return;
        }

        showForgotSuccess('Se este e-mail estiver cadastrado, um link de recuperação foi enviado.');
        if (forgotForm) forgotForm.reset();
      } catch (err) {
        console.error('Decolar Admin: falha ao solicitar recuperação de senha.', err);
        setForgotSubmitting(false);
        showForgotError('Não foi possível enviar o link agora. Tente novamente em instantes.');
      }
    });
  }

  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      hideError();

      const email = (emailInput && emailInput.value || '').trim();
      const password = passwordInput && passwordInput.value || '';

      if (!email || !password) {
        showError('Informe e-mail e senha.');
        return;
      }

      const client = window.adminSupabase;
      if (!client) {
        showError('Não foi possível conectar ao serviço de autenticação. Verifique sua conexão.');
        return;
      }

      setSubmitting(true);

      try {
        const { error: signInError } = await client.auth.signInWithPassword({ email, password });

        if (signInError) {
          // Mensagem genérica de propósito: não revela se o e-mail existe
          // ou não, nem qual dos dois campos está incorreto.
          showError('E-mail ou senha incorretos.');
          setSubmitting(false);
          return;
        }

        // Login aceito pelo Supabase Auth — ainda falta confirmar que esta
        // conta está em blog_admins antes de liberar o painel.
        const authResult = guard ? await guard.checkAdminAuthorization() : null;

        if (authResult && authResult.status === 'authorized') {
          window.location.replace(INDEX_PAGE);
          return;
        }

        if (authResult && authResult.status === 'unauthorized') {
          if (client.auth && typeof client.auth.signOut === 'function') {
            await client.auth.signOut();
          }
          showError('Esta conta não tem permissão para acessar o painel administrativo.');
          setSubmitting(false);
          return;
        }

        showError('Não foi possível confirmar seu acesso agora. Tente novamente em instantes.');
        setSubmitting(false);
      } catch (err) {
        console.error('Decolar Admin: falha inesperada no login.', err);
        showError('Não foi possível entrar agora. Tente novamente em instantes.');
        setSubmitting(false);
      }
    });
  }
});
