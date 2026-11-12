/**
 * Decolar Consórcios — admin-reset-password.js
 * Lógica exclusiva da tela de redefinição de senha (admin/redefinir-senha.html).
 *
 * O link de recuperação enviado pelo Supabase Auth chega com um token na
 * própria URL. O SDK (detectSessionInUrl, ativo por padrão) lê esse token
 * automaticamente e estabelece uma sessão de recuperação temporária,
 * emitindo o evento 'PASSWORD_RECOVERY'. Só então o formulário de nova
 * senha é exibido — nunca antes dessa confirmação.
 *
 * O token nunca é lido manualmente, nunca é registrado em console.log/erro,
 * e a URL é limpa (history.replaceState) assim que a sessão é confirmada
 * (ou assim que falha), para não deixá-lo visível na barra de endereço,
 * no histórico do navegador ou em qualquer log.
 */
document.addEventListener('DOMContentLoaded', () => {
  const verifyingState = document.getElementById('reset-verifying-state');
  const invalidState = document.getElementById('reset-invalid-state');
  const successState = document.getElementById('reset-success-state');
  const form = document.getElementById('admin-reset-form');

  const passwordInput = document.getElementById('reset-password');
  const confirmInput = document.getElementById('reset-password-confirm');
  const errorBox = document.getElementById('admin-reset-error');
  const submitBtn = document.getElementById('admin-reset-submit');

  const client = window.adminSupabase;

  function showOnly(stateEl) {
    [verifyingState, invalidState, form, successState].forEach((el) => {
      if (el) el.hidden = el !== stateEl;
    });
  }

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
    submitBtn.textContent = isSubmitting ? 'Salvando…' : 'Definir nova senha';
  }

  function stripTokensFromUrl() {
    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  if (!client) {
    stripTokensFromUrl();
    showOnly(invalidState);
    return;
  }

  let resolved = false;

  function markRecoverySession() {
    if (resolved) return;
    resolved = true;
    stripTokensFromUrl();
    showOnly(form);
  }

  client.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      markRecoverySession();
    }
  });

  // Reforço: em alguns casos o evento PASSWORD_RECOVERY pode já ter sido
  // emitido antes deste listener ser registrado. getSession() confirma se
  // uma sessão (de recuperação) já existe mesmo sem o evento ter sido
  // capturado aqui.
  client.auth
    .getSession()
    .then(({ data }) => {
      if (data && data.session) {
        markRecoverySession();
      }
    })
    .catch(() => {
      // Silencioso: a verificação por timeout abaixo cobre esta falha.
    });

  // Nenhuma sessão de recuperação foi confirmada a tempo: link inválido,
  // expirado ou já utilizado.
  setTimeout(() => {
    if (!resolved) {
      resolved = true;
      stripTokensFromUrl();
      showOnly(invalidState);
    }
  }, 4000);

  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      hideError();

      const password = (passwordInput && passwordInput.value) || '';
      const confirmPassword = (confirmInput && confirmInput.value) || '';

      if (!password || !confirmPassword) {
        showError('Preencha os dois campos.');
        return;
      }

      if (password.length < 8) {
        showError('A senha deve ter pelo menos 8 caracteres.');
        return;
      }

      if (password !== confirmPassword) {
        showError('As senhas não coincidem.');
        return;
      }

      setSubmitting(true);

      try {
        const { error: updateError } = await client.auth.updateUser({ password: password });

        if (updateError) {
          setSubmitting(false);
          showError('Não foi possível redefinir sua senha. O link pode ter expirado — solicite um novo.');
          return;
        }

        // Encerra a sessão de recuperação (temporária) antes de encaminhar
        // ao login — o usuário deve entrar de novo com a nova senha.
        if (client.auth && typeof client.auth.signOut === 'function') {
          await client.auth.signOut();
        }

        showOnly(successState);

        setTimeout(() => {
          window.location.replace('login.html');
        }, 2500);
      } catch (err) {
        console.error('Decolar Admin: falha ao redefinir senha.', err);
        setSubmitting(false);
        showError('Não foi possível redefinir sua senha agora. Tente novamente.');
      }
    });
  }
});
