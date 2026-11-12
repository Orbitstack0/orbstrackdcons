/* ==========================================================================
   Decolar Consórcios — Consentimento de cookies (lógica central reutilizada
   em todas as páginas do site).

   Regras obrigatórias:
   - Apenas duas escolhas: "Aceitar todos" ou "Recusar opcionais". Não há
     painel de personalização nem seletores individuais por categoria.
   - Nenhum cookie/tecnologia opcional é carregado antes da aceitação.
   - A escolha é persistida (localStorage) e o banner não é reexibido em
     outras páginas depois de uma escolha válida.
   - O link/botão "Alterar escolha de cookies", presente no rodapé de
     todas as páginas, reabre o banner a qualquer momento.
   - O banner nunca bloqueia a navegação: não é modal, não tem overlay,
     não captura foco, os elementos de trás continuam utilizáveis.

   Inventário real de cookies/rastreadores do site (ver política de
   cookies para o texto completo):
   - Hoje o site NÃO carrega nenhuma ferramenta de analytics, publicidade
     ou rastreamento de terceiros (sem Google Analytics, Meta Pixel, Tag
     Manager, etc. no código-fonte).
   - O único armazenamento utilizado é "sessionStorage" para lembrar as
     escolhas do simulador durante a navegação entre páginas (não é um
     cookie, expira ao fechar a aba, é estritamente necessário ao
     funcionamento do simulador e não depende de consentimento).
   - A lista OPTIONAL_INTEGRATIONS abaixo existe para o dia em que uma
     ferramenta opcional (analytics/publicidade) for de fato adicionada:
     cada entrada só é carregada se a categoria correspondente tiver sido
     aceita. Hoje a lista está vazia porque nenhuma ferramenta opcional
     está em uso.
   ========================================================================== */

(function () {
  'use strict';

  var STORAGE_KEY = 'decolarCookieConsent'; // 'accepted' | 'rejected'

  /* Ferramentas opcionais reais do site, por categoria. Vazio hoje: não
     adicionar entradas aqui sem que a ferramenta exista de fato e esteja
     documentada na Política de Cookies. */
  var OPTIONAL_INTEGRATIONS = {
    analytics: [],
    publicidade: []
  };

  function getConsent() {
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function setConsent(value) {
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch (e) {
      /* localStorage indisponível (modo privado restrito etc.): a escolha
         vale apenas para a sessão atual; o banner pode reaparecer na
         próxima visita, o que é aceitável e não bloqueia nada. */
    }
    try {
      window.dispatchEvent(new CustomEvent('decolar:consent-change', { detail: { consent: value } }));
    } catch (_) {}
  }

  /* Remove cookies opcionais já gravados (quando tecnicamente possível) ao
     recusar ou revogar. Como hoje não existe nenhum cookie opcional
     próprio, esta função não tem o que remover — fica pronta para quando
     uma ferramenta opcional passar a existir. */
  function purgeOptionalCookies() {
    var domain = window.location.hostname;
    []
      .concat(OPTIONAL_INTEGRATIONS.analytics, OPTIONAL_INTEGRATIONS.publicidade)
      .forEach(function (integration) {
        (integration.cookieNames || []).forEach(function (name) {
          document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=' + domain;
        });
      });
  }

  function loadScript(src, attrs) {
    var s = document.createElement('script');
    s.src = src;
    s.async = true;
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        s.setAttribute(k, attrs[k]);
      });
    }
    document.head.appendChild(s);
  }

  /* Só é chamada DEPOIS de "Aceitar todos". Carrega as integrações
     opcionais realmente existentes (nenhuma, no momento). */
  function enableOptionalIntegrations() {
    [].concat(OPTIONAL_INTEGRATIONS.analytics, OPTIONAL_INTEGRATIONS.publicidade)
      .forEach(function (integration) {
        loadScript(integration.src, integration.attrs);
      });
  }

  function applyConsent(value) {
    if (value === 'accepted') {
      enableOptionalIntegrations();
    } else {
      purgeOptionalCookies();
    }
  }

  function buildBanner() {
    var wrap = document.createElement('div');
    wrap.className = 'consent-banner';
    wrap.id = 'consent-banner';
    wrap.setAttribute('role', 'region');
    wrap.setAttribute('aria-label', 'Preferências de cookies');

    wrap.innerHTML =
      '<div class="consent-banner-inner">' +
        '<div class="consent-banner-text">' +
          '<p class="consent-banner-title">Sua privacidade é importante</p>' +
          '<p class="consent-banner-desc">Utilizamos cookies essenciais para o funcionamento do site e, com sua autorização, cookies opcionais para análise e publicidade. Saiba mais em nossa <a href="/politica-de-cookies">Política de Cookies</a>.</p>' +
        '</div>' +
        '<div class="consent-banner-actions">' +
          '<button type="button" class="consent-reject-optional" id="consent-reject">Recusar opcionais</button>' +
          '<button type="button" class="consent-accept-all" id="consent-accept">Aceitar todos</button>' +
        '</div>' +
      '</div>';

    return wrap;
  }

  function showBanner() {
    if (document.getElementById('consent-banner')) return;
    var banner = buildBanner();
    document.body.appendChild(banner);

    document.getElementById('consent-accept').addEventListener('click', function () {
      setConsent('accepted');
      applyConsent('accepted');
      hideBanner();
    });

    document.getElementById('consent-reject').addEventListener('click', function () {
      setConsent('rejected');
      applyConsent('rejected');
      hideBanner();
    });
  }

  function hideBanner() {
    var banner = document.getElementById('consent-banner');
    if (banner) banner.remove();
  }

  function init() {
    var consent = getConsent();

    if (consent === 'accepted' || consent === 'rejected') {
      applyConsent(consent);
    } else {
      showBanner();
    }

    /* "Alterar escolha de cookies": presente no rodapé de todas as
       páginas; reabre o banner para uma nova escolha a qualquer momento,
       sem apagar a preferência anterior até que uma nova seja feita. */
    document.querySelectorAll('.js-manage-cookies').forEach(function (btn) {
      btn.addEventListener('click', function (event) {
        event.preventDefault();
        showBanner();
        var bannerEl = document.getElementById('consent-banner');
        if (bannerEl) {
          bannerEl.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
