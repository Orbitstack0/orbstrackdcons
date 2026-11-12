/**
 * Decolar Consórcios — admin-nav-mobile.js
 * Abre/fecha a gaveta de navegação mobile do painel administrativo
 * (<=767px). Compartilhado por todas as páginas que usam o shell padrão
 * (.admin-shell + .admin-sidebar) — não depende de qual página é.
 *
 * Mesmo padrão de acessibilidade já usado no menu mobile do site público
 * (js/script.js): aria-expanded no gatilho, overlay fecha ao clicar fora,
 * Escape fecha e devolve o foco ao botão, clicar em qualquer link/botão
 * dentro da gaveta fecha o menu.
 *
 * Este arquivo só controla abertura/fechamento visual da gaveta. Nunca
 * lida com autenticação, perfil, CRM, chat ou artigos — cada página
 * continua com seus próprios scripts para isso, sem nenhuma alteração.
 */
document.addEventListener('DOMContentLoaded', () => {
  const shell = document.getElementById('admin-shell');
  const toggle = document.getElementById('admin-nav-toggle');
  const overlay = document.getElementById('admin-nav-overlay');
  const sidebar = document.getElementById('admin-sidebar-panel');

  if (!shell || !toggle || !sidebar) return;

  function openMenu() {
    shell.classList.add('nav-open');
    if (overlay) overlay.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Fechar menu');
    document.body.classList.add('admin-nav-locked');
  }

  function closeMenu() {
    shell.classList.remove('nav-open');
    if (overlay) overlay.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Abrir menu');
    document.body.classList.remove('admin-nav-locked');
  }

  function toggleMenu() {
    if (shell.classList.contains('nav-open')) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  toggle.addEventListener('click', toggleMenu);

  if (overlay) {
    overlay.addEventListener('click', closeMenu);
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && shell.classList.contains('nav-open')) {
      closeMenu();
      toggle.focus();
    }
  });

  // Qualquer link ou botão dentro da gaveta (itens de navegação, "Trocar
  // perfil", "Sair") fecha a gaveta — os próprios listeners desses botões
  // (login/perfil, em outros arquivos) continuam intocados e disparam
  // normalmente no mesmo clique.
  sidebar.querySelectorAll('a, button').forEach((el) => {
    el.addEventListener('click', closeMenu);
  });
});
