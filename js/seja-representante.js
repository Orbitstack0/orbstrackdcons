// seja-representante.js - Página "Seja um Representante".
// Header, menu mobile, dropdown, revelação genérica (.reveal-on-scroll) e
// consentimento de cookies continuam sob responsabilidade de script.js e
// consent.js (carregados antes deste).

document.addEventListener('DOMContentLoaded', () => {

  /* ------------------------------------------------------------------
     Hero: mesma pequena transição de escala na fotografia usada nas
     páginas de modalidade (.mod-hero/.is-revealed, ver modalidade.css).
     Sem JS, a imagem já aparece no tamanho final.
  ------------------------------------------------------------------ */
  const hero = document.querySelector('.mod-hero');

  if (hero) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => hero.classList.add('is-revealed'));
    });
  }

});
