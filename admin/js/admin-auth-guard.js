/**
 * Decolar Consórcios — admin-auth-guard.js
 * Lógica de autenticação/autorização compartilhada por TODAS as páginas
 * do painel administrativo.
 *
 * IMPORTANTE: esta checagem em JavaScript é só uma conveniência de
 * experiência (evitar mostrar a interface e redirecionar quem não deve
 * estar aqui). Ela NÃO é a segurança real do painel — isso é papel das
 * políticas RLS no Supabase, aplicadas no banco independentemente do que
 * este arquivo faz. Mesmo que alguém pule esta checagem (ex.: chamando a
 * API do Supabase direto pelo console do navegador), o RLS continua
 * bloqueando qualquer leitura/escrita de quem não estiver em
 * `blog_admins`.
 *
 * Exposto em window.DecolarAdminGuard:
 *   - checkAdminAuthorization(): consulta sessão + blog_admins, sem
 *     redirecionar nem deslogar ninguém (usado pela própria login.html
 *     para decidir se já deve pular direto para o dashboard).
 *   - requireAdmin(): usado por toda página protegida do painel. Redireciona
 *     para login.html quando não há sessão ou quando a sessão não pertence
 *     a um administrador autorizado.
 *   - logout(): encerra a sessão e volta para login.html.
 */
(function () {
  'use strict';

  var LOGIN_PAGE = 'login.html';

  function getClient() {
    return window.adminSupabase || null;
  }

  // Consulta pura: sessão atual + se o usuário da sessão está em
  // blog_admins. Não decide nada sozinha (sem redirecionar, sem logout).
  async function checkAdminAuthorization() {
    var client = getClient();

    if (!client) {
      return { status: 'error', reason: 'sdk-unavailable' };
    }

    var sessionResult;
    try {
      sessionResult = await client.auth.getSession();
    } catch (err) {
      console.error('Decolar Admin: falha ao consultar a sessão.', err);
      return { status: 'error', reason: 'network' };
    }

    var session = sessionResult && sessionResult.data ? sessionResult.data.session : null;

    if (!session || !session.user) {
      return { status: 'signed-out' };
    }

    try {
      var query = await client
        .from('blog_admins')
        .select('user_id')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (query.error) throw query.error;

      if (!query.data) {
        return { status: 'unauthorized', session: session };
      }

      return { status: 'authorized', session: session, user: session.user };
    } catch (err) {
      console.error('Decolar Admin: falha ao verificar autorização em blog_admins.', err);
      return { status: 'error', reason: 'network', session: session };
    }
  }

  // Usado por toda página protegida do painel (ex.: admin/index.html).
  // Resolve com { session, user } somente quando autorizado; caso
  // contrário, redireciona para o login e a Promise nunca resolve
  // (a página já está saindo).
  function requireAdmin() {
    return checkAdminAuthorization().then(function (result) {
      if (result.status === 'authorized') {
        return { session: result.session, user: result.user };
      }

      if (result.status === 'unauthorized') {
        // Autenticado, mas fora de blog_admins: encerra a sessão antes de
        // voltar ao login, para não deixar um token "autenticado, porém
        // sem acesso" pendurado no navegador.
        var client = getClient();
        var signOutPromise = client ? client.auth.signOut() : Promise.resolve();
        return signOutPromise.finally(function () {
          window.location.replace(LOGIN_PAGE + '?error=unauthorized');
        });
      }

      if (result.status === 'signed-out') {
        window.location.replace(LOGIN_PAGE);
        return new Promise(function () {}); // mantém a página atual "congelada" durante o redirecionamento
      }

      // 'error' (SDK indisponível ou falha de rede ao verificar):
      // não revela nada do painel; devolve o motivo para a página exibir
      // um estado de erro com opção de tentar novamente, sem redirecionar
      // automaticamente (poderia expulsar um admin legítimo por uma
      // instabilidade momentânea de rede).
      return Promise.reject(result);
    });
  }

  function logout() {
    var client = getClient();
    // Limpa também o perfil visual selecionado (quando admin-profile.js
    // está carregado nesta página) — a próxima entrada deve começar sem
    // nenhum perfil assumido.
    if (window.DecolarAdminProfile && typeof window.DecolarAdminProfile.clearSelectedProfile === 'function') {
      window.DecolarAdminProfile.clearSelectedProfile();
    }
    var signOutPromise = client ? client.auth.signOut() : Promise.resolve();
    return signOutPromise.finally(function () {
      window.location.replace(LOGIN_PAGE);
    });
  }

  window.DecolarAdminGuard = {
    checkAdminAuthorization: checkAdminAuthorization,
    requireAdmin: requireAdmin,
    logout: logout,
  };
})();
