/**
 * Decolar Consórcios — Consórcio de Pesados (consorcio-pesados.html)
 * Carrossel Cinematográfico 3D Coverflow com Autoplay Infinito Suave
 * 1. Caminhões | 2. Máquinas Agrícolas | 3. Ônibus e Frotas
 */

document.addEventListener('DOMContentLoaded', () => {
  const wrap = document.getElementById('pesados-coverflow');
  if (!wrap) return;

  const stage = wrap.querySelector('.pesados-coverflow-stage');
  const cards = Array.from(wrap.querySelectorAll('.pesados-coverflow-card'));

  if (!cards.length) return;

  const total = cards.length;
  let currentIndex = 0;
  let isAnimating = false;
  let autoplayTimer = null;
  let resumeTimer = null;
  let isInView = false;
  let isFocused = false;
  let isInteracting = false;

  const AUTOPLAY_INTERVAL = 5000; // Avanço automático a cada 5 segundos cravados
  const RESUME_DELAY = 5000;      // Retomada suave de 5 segundos após interação real
  const ANIMATION_DURATION = 900; // Transição suave de 900 ms

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let prefersReducedMotion = motionQuery.matches;

  motionQuery.addEventListener('change', (e) => {
    prefersReducedMotion = e.matches;
    if (prefersReducedMotion) {
      stopAutoplay();
    } else if (isInView) {
      startAutoplay();
    }
  });

  /**
   * Atualiza as posições 3D (slot-center, slot-left, slot-right)
   */
  function updateSlots({ focusActive = false } = {}) {
    const prevIndex = (currentIndex - 1 + total) % total;
    const nextIndex = (currentIndex + 1) % total;

    cards.forEach((card, index) => {
      card.classList.remove('slot-center', 'slot-left', 'slot-right');

      if (index === currentIndex) {
        card.classList.add('slot-center');
        card.setAttribute('aria-hidden', 'false');
        card.setAttribute('tabindex', '0');
        if (focusActive) card.focus();
      } else if (index === prevIndex) {
        card.classList.add('slot-left');
        card.setAttribute('aria-hidden', 'true');
        card.setAttribute('tabindex', '0');
      } else if (index === nextIndex) {
        card.classList.add('slot-right');
        card.setAttribute('aria-hidden', 'true');
        card.setAttribute('tabindex', '0');
      } else {
        card.setAttribute('aria-hidden', 'true');
        card.setAttribute('tabindex', '-1');
      }
    });
  }

  /**
   * Transição suave para um novo índice (loop infinito circular: 0 -> 1 -> 2 -> 0...)
   */
  function goTo(newIndex, { focusActive = false } = {}) {
    if (isAnimating) return;
    const target = ((newIndex % total) + total) % total;
    if (target === currentIndex) return;

    isAnimating = true;
    currentIndex = target;
    updateSlots({ focusActive });

    setTimeout(() => {
      isAnimating = false;
    }, ANIMATION_DURATION);
  }

  function next() {
    goTo(currentIndex + 1);
  }

  function prev() {
    goTo(currentIndex - 1);
  }

  /**
   * Verificação geométrica de visibilidade na viewport
   */
  function isElementInViewport(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    return rect.bottom > 50 && rect.top < (vh - 50);
  }

  /**
   * Gerenciador do Autoplay
   */
  function canRunAutoplay() {
    return (
      !prefersReducedMotion &&
      isInView &&
      !isFocused &&
      !isInteracting &&
      !document.hidden
    );
  }

  function startAutoplay() {
    stopAutoplay();
    if (!canRunAutoplay()) return;

    autoplayTimer = setInterval(() => {
      if (canRunAutoplay()) {
        next();
      }
    }, AUTOPLAY_INTERVAL);
  }

  function stopAutoplay() {
    if (autoplayTimer) {
      clearInterval(autoplayTimer);
      autoplayTimer = null;
    }
  }

  function pauseAndScheduleResume() {
    stopAutoplay();
    if (resumeTimer) clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => {
      isInteracting = false;
      if (canRunAutoplay()) {
        startAutoplay();
      }
    }, RESUME_DELAY);
  }

  // Interação manual ao clicar nos cards (interação real pausa e retoma após 5s)
  cards.forEach((card, index) => {
    card.addEventListener('click', () => {
      if (index === currentIndex) return;
      isInteracting = true;
      goTo(index);
      pauseAndScheduleResume();
    });

    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (index !== currentIndex) {
          isInteracting = true;
          goTo(index, { focusActive: true });
          pauseAndScheduleResume();
        }
      }
    });
  });

  if (stage) {
    // Pausa no foco por teclado (acessibilidade para navegação por Tab / leitores de tela)
    stage.addEventListener('focusin', () => {
      isFocused = true;
      stopAutoplay();
    });

    stage.addEventListener('focusout', (e) => {
      if (!stage.contains(e.relatedTarget)) {
        isFocused = false;
        if (canRunAutoplay()) {
          startAutoplay();
        }
      }
    });

    // Navegação manual por setas do teclado (interação real pausa e retoma após 5s)
    stage.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        isInteracting = true;
        prev();
        pauseAndScheduleResume();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        isInteracting = true;
        next();
        pauseAndScheduleResume();
      }
    });

    // Touch Swipe para Dispositivos Móveis e Tablets (interação real pausa e retoma após 5s)
    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let isSwiping = false;

    stage.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      currentX = startX;
      isSwiping = true;
      isInteracting = true;
      stopAutoplay();
    }, { passive: true });

    stage.addEventListener('touchmove', (e) => {
      if (!isSwiping) return;
      currentX = e.touches[0].clientX;
    }, { passive: true });

    stage.addEventListener('touchend', (e) => {
      if (!isSwiping) return;
      isSwiping = false;
      const diffX = currentX - startX;
      const diffY = (e.changedTouches[0] ? e.changedTouches[0].clientY : startY) - startY;

      if (Math.abs(diffX) > 35 && Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX > 0) {
          prev();
        } else {
          next();
        }
      }

      pauseAndScheduleResume();
    });

    stage.addEventListener('touchcancel', () => {
      isSwiping = false;
      pauseAndScheduleResume();
    });
  }

  // Verificação inicial imediata de visibilidade
  if (isElementInViewport(wrap)) {
    isInView = true;
    startAutoplay();
  }

  // Detecção por IntersectionObserver com múltiplos thresholds
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const visible = entry.isIntersecting || isElementInViewport(wrap);
          if (visible !== isInView) {
            isInView = visible;
            if (isInView) {
              startAutoplay();
            } else {
              stopAutoplay();
            }
          }
        });
      },
      { threshold: [0, 0.05, 0.2] }
    );
    observer.observe(wrap);
  } else {
    isInView = true;
    startAutoplay();
  }

  // Redundância passiva no evento de scroll da janela
  let scrollDebounce = null;
  window.addEventListener('scroll', () => {
    if (scrollDebounce) return;
    scrollDebounce = setTimeout(() => {
      scrollDebounce = null;
      const visible = isElementInViewport(wrap);
      if (visible !== isInView) {
        isInView = visible;
        if (isInView) {
          startAutoplay();
        } else {
          stopAutoplay();
        }
      }
    }, 100);
  }, { passive: true });

  // Pausar quando a aba estiver em segundo plano e retomar ao voltar
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopAutoplay();
    } else {
      if (isElementInViewport(wrap)) {
        isInView = true;
        startAutoplay();
      }
    }
  });

  // Inicialização visual dos slots
  updateSlots();
});
