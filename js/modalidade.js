// modalidade.js - Páginas de modalidade (Veículos, Imóveis, Pesados).
// Header, menu mobile, dropdown, revelação genérica (.reveal-on-scroll) e
// consentimento de cookies continuam sob responsabilidade de script.js e
// consent.js (carregados antes deste). Este arquivo cuida apenas do que é
// exclusivo destas três páginas: o seletor interativo (abas) e o FAQ.

document.addEventListener('DOMContentLoaded', () => {

  /* ------------------------------------------------------------------
     Hero: pequena transição de escala na fotografia ao carregar a
     página (sutil, não é parallax). Sem JS, a imagem já aparece no
     tamanho final (ver regra base em modalidade.css).
  ------------------------------------------------------------------ */
  const hero = document.querySelector('.mod-hero');
  if (hero) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => hero.classList.add('is-revealed'));
    });
  }

  /* ------------------------------------------------------------------
     Seletor interativo específico da modalidade: abas acessíveis
     (role="tablist"), navegação por teclado (setas, Home, End) e troca
     de conteúdo sem recarregar a página. Puramente informativo/
     comercial - não é um simulador.
  ------------------------------------------------------------------ */
  const tabsNav = document.querySelector('.mod-tabs-nav');

  if (tabsNav) {
    const tabsWrap = tabsNav.closest('.mod-tabs');
    const tabs = Array.from(tabsNav.querySelectorAll('.mod-tab'));
    const panel = document.querySelector('.mod-tab-panel');
    const contents = panel ? Array.from(panel.querySelectorAll('[data-tab-content]')) : [];

    // Só a partir daqui a troca "uma opção por vez" passa a valer (ver
    // modalidade.css); sem isto, as três respostas ficam todas visíveis.
    if (tabsWrap) tabsWrap.classList.add('js-ready');

    const activateTab = (index, { focusTab = false } = {}) => {
      tabs.forEach((tab, i) => {
        const isActive = i === index;
        tab.classList.toggle('is-active', isActive);
        tab.setAttribute('aria-selected', String(isActive));
        tab.setAttribute('tabindex', isActive ? '0' : '-1');
      });

      contents.forEach((content) => {
        const isActive = content.getAttribute('data-tab-content') === String(index);
        content.classList.toggle('is-visible', isActive);
      });

      if (panel) {
        panel.setAttribute('aria-labelledby', tabs[index].id);
        panel.classList.add('is-animating');
        window.setTimeout(() => panel.classList.remove('is-animating'), 400);
      }

      if (focusTab) tabs[index].focus();
    };

    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => activateTab(index));

      tab.addEventListener('keydown', (event) => {
        let newIndex = null;

        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          newIndex = (index + 1) % tabs.length;
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          newIndex = (index - 1 + tabs.length) % tabs.length;
        } else if (event.key === 'Home') {
          newIndex = 0;
        } else if (event.key === 'End') {
          newIndex = tabs.length - 1;
        }

        if (newIndex !== null) {
          event.preventDefault();
          activateTab(newIndex, { focusTab: true });
        }
      });
    });

    activateTab(0);
  }

  /* ------------------------------------------------------------------
     FAQ: accordion acessível (mesmo padrão já usado em contato.js e
     como-funciona.js - aria-expanded + max-height animado via JS).
  ------------------------------------------------------------------ */
  document.querySelectorAll('.mod-faq-trigger').forEach((trigger) => {
    const panelId = trigger.getAttribute('aria-controls');
    const panel = panelId ? document.getElementById(panelId) : null;

    if (!panel) return;

    trigger.addEventListener('click', () => {
      const isOpen = trigger.getAttribute('aria-expanded') === 'true';

      trigger.setAttribute('aria-expanded', String(!isOpen));
      panel.style.maxHeight = isOpen ? '0px' : `${panel.scrollHeight}px`;
    });
  });

});
