/**
 * Decolar Consórcios — admin-crm-tv.js
 * Lógica do Modo TV Decolar (admin/crm-tv.html).
 *
 * Funcionalidades:
 * - Proteção de acesso administrativo via DecolarAdminGuard.requireAdmin().
 * - Três visualizações: Visão Geral, Equipe Supervisor 1 e Equipe Supervisor 2.
 * - Alternância automática a cada 30 segundos com barra de progresso visual fluida.
 * - Modo manual (pausar, selecionar tela fixa, retomar).
 * - Relógio digital compacto em tempo real.
 * - Suporte à API Fullscreen (Tela Cheia) e Modo Apresentação (ocultar controles secundários).
 * - Indicador discreto de sincronização ("Aguardando integração").
 * - Sem chamadas a banco ou dados fictícios nesta etapa (somente leitura).
 */

document.addEventListener('DOMContentLoaded', () => {
  // Telas de acesso administrativo
  const loadingState = document.getElementById('admin-loading-state');
  const errorState = document.getElementById('admin-error-state');
  const retryBtn = document.getElementById('admin-retry-btn');
  const tvApp = document.getElementById('tv-app');

  // Elementos do Cabeçalho e Relógio
  const clockTimeEl = document.getElementById('tv-clock-time');
  const clockDateEl = document.getElementById('tv-clock-date');
  const progressBar = document.getElementById('tv-progress-bar');
  const autoToggleBtn = document.getElementById('tv-btn-auto-toggle');
  const autoToggleText = document.getElementById('tv-auto-toggle-text');
  const fullscreenBtn = document.getElementById('tv-btn-fullscreen');
  const fullscreenText = document.getElementById('tv-fullscreen-text');
  const presentationToggleBtn = document.getElementById('tv-btn-toggle-presentation');
  const presentationToggleText = document.getElementById('tv-presentation-toggle-text');
  const restoreControlsBtn = document.getElementById('tv-btn-restore-controls');

  // Abas e Telas
  const tabGeneral = document.getElementById('tv-tab-general');
  const tabSup1 = document.getElementById('tv-tab-sup1');
  const tabSup2 = document.getElementById('tv-tab-sup2');

  const viewGeneral = document.getElementById('tv-view-general');
  const viewSup1 = document.getElementById('tv-view-sup1');
  const viewSup2 = document.getElementById('tv-view-sup2');

  const guard = window.DecolarAdminGuard;

  // Estado da TV
  const viewsOrder = ['general', 'sup1', 'sup2'];
  let currentViewIndex = 0;
  let isAutoRunning = true;
  const ROTATION_INTERVAL_MS = 30000; // 30 segundos
  let rotationStartTime = Date.now();
  let animationFrameId = null;
  let isPresentationMode = false;

  // ---------------------------------------------------------------------------
  // 1. Verificação de Acesso Administrativo
  // ---------------------------------------------------------------------------
  function showLoading() {
    if (loadingState) loadingState.hidden = false;
    if (errorState) errorState.hidden = true;
    if (tvApp) tvApp.hidden = true;
  }

  function showError() {
    if (loadingState) loadingState.hidden = true;
    if (errorState) errorState.hidden = false;
    if (tvApp) tvApp.hidden = true;
  }

  function showTV() {
    if (loadingState) loadingState.hidden = true;
    if (errorState) errorState.hidden = true;
    if (tvApp) tvApp.hidden = false;

    initClock();
    initTV();
  }

  function checkAuth() {
    if (!guard) {
      showError();
      return;
    }
    showLoading();
    guard
      .requireAdmin()
      .then(() => showTV())
      .catch((err) => {
        console.warn('Erro na validação do Modo TV:', err);
        showError();
      });
  }

  if (retryBtn) {
    retryBtn.addEventListener('click', checkAuth);
  }

  // ---------------------------------------------------------------------------
  // 2. Relógio Digital Compacto em Tempo Real
  // ---------------------------------------------------------------------------
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  function updateClock() {
    const d = new Date();
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const weekDay = weekDays[d.getDay()];

    if (clockTimeEl) clockTimeEl.textContent = `${h}:${m}:${s}`;
    if (clockDateEl) clockDateEl.textContent = `${weekDay}, ${day}/${month}/${year}`;
  }

  function initClock() {
    updateClock();
    setInterval(updateClock, 1000);
  }

  // ---------------------------------------------------------------------------
  // 3. Alternância e Exibição de Telas
  // ---------------------------------------------------------------------------
  function setView(viewKey) {
    const idx = viewsOrder.indexOf(viewKey);
    if (idx !== -1) {
      currentViewIndex = idx;
    }

    // Atualização das Abas
    if (tabGeneral) tabGeneral.classList.toggle('is-active', viewKey === 'general');
    if (tabSup1) tabSup1.classList.toggle('is-active', viewKey === 'sup1');
    if (tabSup2) tabSup2.classList.toggle('is-active', viewKey === 'sup2');

    // Exibição das Telas
    if (viewGeneral) viewGeneral.hidden = (viewKey !== 'general');
    if (viewSup1) viewSup1.hidden = (viewKey !== 'sup1');
    if (viewSup2) viewSup2.hidden = (viewKey !== 'sup2');

    // Reinicia o tempo do ciclo atual
    rotationStartTime = Date.now();
  }

  function nextView() {
    currentViewIndex = (currentViewIndex + 1) % viewsOrder.length;
    setView(viewsOrder[currentViewIndex]);
  }

  function tickProgress() {
    if (!isAutoRunning) {
      if (progressBar) progressBar.style.width = '0%';
      return;
    }

    const elapsed = Date.now() - rotationStartTime;
    const progressPercent = Math.min(100, (elapsed / ROTATION_INTERVAL_MS) * 100);

    if (progressBar) {
      progressBar.style.width = `${progressPercent}%`;
    }

    if (elapsed >= ROTATION_INTERVAL_MS) {
      nextView();
    }

    animationFrameId = requestAnimationFrame(tickProgress);
  }

  function startAutoRotation() {
    isAutoRunning = true;
    rotationStartTime = Date.now();
    if (autoToggleBtn) {
      autoToggleBtn.classList.add('is-running');
      autoToggleBtn.classList.remove('is-paused');
    }
    if (autoToggleText) {
      autoToggleText.textContent = 'Auto 30s';
    }
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    animationFrameId = requestAnimationFrame(tickProgress);
  }

  function pauseAutoRotation() {
    isAutoRunning = false;
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    if (progressBar) progressBar.style.width = '0%';
    if (autoToggleBtn) {
      autoToggleBtn.classList.remove('is-running');
      autoToggleBtn.classList.add('is-paused');
    }
    if (autoToggleText) {
      autoToggleText.textContent = 'Fixo';
    }
  }

  function toggleAutoRotation() {
    if (isAutoRunning) {
      pauseAutoRotation();
    } else {
      startAutoRotation();
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Modo Apresentação (Ocultar Controles Secundários)
  // ---------------------------------------------------------------------------
  function setPresentationMode(enable) {
    isPresentationMode = enable;
    if (tvApp) {
      tvApp.classList.toggle('is-presentation-mode', isPresentationMode);
    }
    if (presentationToggleText) {
      presentationToggleText.textContent = isPresentationMode ? 'Exibir Controles' : 'Ocultar Controles';
    }
  }

  function togglePresentationMode() {
    setPresentationMode(!isPresentationMode);
  }

  // ---------------------------------------------------------------------------
  // 5. Modo Fullscreen (Tela Cheia)
  // ---------------------------------------------------------------------------
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        // Ao entrar em tela cheia, ativa modo apresentação para visual limpo
        setPresentationMode(true);
      }).catch((err) => {
        console.warn('Erro ao solicitar tela cheia:', err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => {
          setPresentationMode(false);
        }).catch((err) => {
          console.warn('Erro ao sair da tela cheia:', err);
        });
      }
    }
  }

  function updateFullscreenBtn() {
    const isFull = !!document.fullscreenElement;
    if (fullscreenText) {
      fullscreenText.textContent = isFull ? 'Sair Cheia' : 'Tela Cheia';
    }
    if (!isFull) {
      setPresentationMode(false);
    }
  }

  document.addEventListener('fullscreenchange', updateFullscreenBtn);

  // ---------------------------------------------------------------------------
  // 6. Inicialização dos Controles
  // ---------------------------------------------------------------------------
  function initTV() {
    // Clique nas abas: seleciona a equipe desejada e fixa a exibição (pausa auto)
    if (tabGeneral) {
      tabGeneral.addEventListener('click', () => {
        setView('general');
        pauseAutoRotation();
      });
    }

    if (tabSup1) {
      tabSup1.addEventListener('click', () => {
        setView('sup1');
        pauseAutoRotation();
      });
    }

    if (tabSup2) {
      tabSup2.addEventListener('click', () => {
        setView('sup2');
        pauseAutoRotation();
      });
    }

    // Botão de Play/Pause da rotação
    if (autoToggleBtn) {
      autoToggleBtn.addEventListener('click', toggleAutoRotation);
    }

    // Botão de Alternar Modo Apresentação
    if (presentationToggleBtn) {
      presentationToggleBtn.addEventListener('click', togglePresentationMode);
    }

    // Botão Flutuante para Restaurar Controles
    if (restoreControlsBtn) {
      restoreControlsBtn.addEventListener('click', () => {
        setPresentationMode(false);
      });
    }

    // Botão de Tela Cheia
    if (fullscreenBtn) {
      fullscreenBtn.addEventListener('click', toggleFullscreen);
    }

    // Inicia na Visão Geral com rotação automática ativa
    setView('general');
    startAutoRotation();
  }

  // Disparo da verificação de autorização administrativa
  checkAuth();
});
