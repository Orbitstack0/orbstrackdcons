// historia.js - Interações Institucionais & Carrossel da Linha do Tempo

document.addEventListener('DOMContentLoaded', () => {
  // 1. Barra de progresso de leitura sutil no topo
  const progressBar = document.querySelector('.story-progress-bar');
  
  const updateScrollProgress = () => {
    if (!progressBar) return;
    const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (totalHeight > 0) {
      const progress = (window.scrollY / totalHeight) * 100;
      progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
    }
  };

  window.addEventListener('scroll', updateScrollProgress, { passive: true });
  updateScrollProgress();

  // 2. IntersectionObserver para Reveal suave de elementos (fade & slide up)
  const revealItems = document.querySelectorAll('.reveal-item');
  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: '0px 0px -40px 0px'
      }
    );

    revealItems.forEach((item) => {
      revealObserver.observe(item);
      const rect = item.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        item.classList.add('is-revealed');
      }
    });
  } else {
    revealItems.forEach((item) => item.classList.add('is-revealed'));
  }

  // 3. Carrossel 3D Coverflow Automático — Nossa Trajetória
  initCoverflowTrajetoria();
});

/**
 * Inicializa o Carrossel 3D Coverflow com rotação contínua, profundidade moderada,
 * destaque equilibrado no card central e controles acessíveis.
 */
function initCoverflowTrajetoria() {
  const wrap = document.getElementById('coverflow-trajetoria');
  if (!wrap) return;

  const stage = wrap.querySelector('.coverflow-stage');
  const cards = Array.from(wrap.querySelectorAll('.coverflow-card'));
  const prevBtn = document.getElementById('coverflow-btn-prev');
  const nextBtn = document.getElementById('coverflow-btn-next');
  const pills = Array.from(wrap.querySelectorAll('.coverflow-pill-btn'));

  if (!cards.length) return;

  const total = cards.length;
  let currentIndex = 0;
  let isAnimating = false;
  let autoplayTimer = null;
  let manualResumeTimer = null;
  let isInView = false;
  let isHovered = false;

  const AUTOPLAY_INTERVAL = 5500;    // 5.5 segundos entre avanços automáticos
  const MANUAL_RESUME_DELAY = 5000;  // 5 segundos após interação manual
  const ANIMATION_DURATION = 700;    // 700 ms de transição suave

  // Checagem de preferência por redução de movimento
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /**
   * Atualiza as classes de slot 3D para cada card com base no índice ativo
   */
  function updateSlots() {
    cards.forEach((card, i) => {
      const offset = ((i - currentIndex) % total + total) % total;

      card.classList.remove('slot-center', 'slot-right', 'slot-left', 'slot-back', 'is-center');

      if (offset === 0) {
        // Centro (ativo)
        card.classList.add('slot-center', 'is-center');
        card.setAttribute('aria-hidden', 'false');
        card.tabIndex = 0;
      } else if (offset === 1) {
        // Lateral direita
        card.classList.add('slot-right');
        card.setAttribute('aria-hidden', 'true');
        card.tabIndex = -1;
      } else if (offset === total - 1) {
        // Lateral esquerda
        card.classList.add('slot-left');
        card.setAttribute('aria-hidden', 'true');
        card.tabIndex = -1;
      } else {
        // Oposto no fundo
        card.classList.add('slot-back');
        card.setAttribute('aria-hidden', 'true');
        card.tabIndex = -1;
      }
    });

    // Atualiza pílulas indicadoras dos anos
    pills.forEach((pill, i) => {
      const isActive = (i === currentIndex);
      pill.classList.toggle('is-active', isActive);
      pill.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
  }

  /**
   * Transiciona suavemente para o índice desejado
   */
  function goTo(index) {
    if (isAnimating) return;
    const targetIndex = ((index % total) + total) % total;
    if (targetIndex === currentIndex) return;

    isAnimating = true;
    currentIndex = targetIndex;
    updateSlots();

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

  // --------------------------------------------------------------------------
  // Gestão de Reprodução Automática (Autoplay)
  // --------------------------------------------------------------------------
  function clearTimers() {
    if (autoplayTimer) {
      clearTimeout(autoplayTimer);
      autoplayTimer = null;
    }
    if (manualResumeTimer) {
      clearTimeout(manualResumeTimer);
      manualResumeTimer = null;
    }
  }

  function startAutoplay(delay = AUTOPLAY_INTERVAL) {
    clearTimers();
    if (prefersReducedMotion || isHovered || !isInView || document.hidden) {
      return;
    }
    autoplayTimer = setTimeout(() => {
      next();
      startAutoplay(AUTOPLAY_INTERVAL);
    }, delay);
  }

  function pauseAutoplay() {
    clearTimers();
  }

  function handleManualInteraction() {
    clearTimers();
    if (prefersReducedMotion) return;
    manualResumeTimer = setTimeout(() => {
      if (isInView && !isHovered && !prefersReducedMotion && !document.hidden) {
        next();
        startAutoplay(AUTOPLAY_INTERVAL);
      }
    }, MANUAL_RESUME_DELAY);
  }

  // --------------------------------------------------------------------------
  // Eventos do Usuário
  // --------------------------------------------------------------------------
  cards.forEach((card, idx) => {
    card.addEventListener('click', () => {
      if (idx !== currentIndex && !isAnimating) {
        handleManualInteraction();
        goTo(idx);
      }
    });
  });

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      handleManualInteraction();
      prev();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      handleManualInteraction();
      next();
    });
  }

  pills.forEach((pill, idx) => {
    pill.addEventListener('click', () => {
      handleManualInteraction();
      goTo(idx);
    });
  });

  wrap.addEventListener('mouseenter', () => {
    isHovered = true;
    pauseAutoplay();
  });

  wrap.addEventListener('mouseleave', () => {
    isHovered = false;
    if (isInView && !prefersReducedMotion) {
      startAutoplay(AUTOPLAY_INTERVAL);
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      pauseAutoplay();
    } else if (isInView && !isHovered && !prefersReducedMotion) {
      startAutoplay(AUTOPLAY_INTERVAL);
    }
  });

  if (stage) {
    stage.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleManualInteraction();
        prev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleManualInteraction();
        next();
      }
    });
  }

  // Arraste com Mouse no Desktop e Toque Horizontal no Mobile
  let startX = 0;
  let currentX = 0;
  let isPointerDown = false;
  let hasDragged = false;

  const onPointerDown = (e) => {
    if (e.target.closest('.coverflow-controls')) return;
    isPointerDown = true;
    hasDragged = false;
    startX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
    currentX = startX;
    if (stage) stage.classList.add('is-dragging');
  };

  const onPointerMove = (e) => {
    if (!isPointerDown) return;
    currentX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
    if (Math.abs(currentX - startX) > 10) {
      hasDragged = true;
    }
  };

  const onPointerUp = () => {
    if (!isPointerDown) return;
    isPointerDown = false;
    if (stage) stage.classList.remove('is-dragging');

    const deltaX = currentX - startX;
    const threshold = 40;

    if (hasDragged && Math.abs(deltaX) >= threshold) {
      handleManualInteraction();
      if (deltaX < 0) {
        next();
      } else {
        prev();
      }
    }
  };

  if (stage) {
    stage.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  }

  // IntersectionObserver: inicia autoplay apenas quando visível na tela
  let isFirstEntry = true;

  if ('IntersectionObserver' in window) {
    const sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            isInView = true;
            if (isFirstEntry) {
              isFirstEntry = false;
              // Garante que o carrossel comece estritamente em 1988 (índice 0)
              currentIndex = 0;
              updateSlots();
              // Dá tempo para o visitante ler o marco 1988 antes da primeira transição
              if (!isHovered && !prefersReducedMotion) {
                startAutoplay(5500);
              }
            } else if (!isHovered && !prefersReducedMotion) {
              startAutoplay(AUTOPLAY_INTERVAL);
            }
          } else {
            isInView = false;
            pauseAutoplay();
          }
        });
      },
      { threshold: 0.20 }
    );
    sectionObserver.observe(wrap);
  } else {
    isInView = true;
    currentIndex = 0;
    updateSlots();
    if (!prefersReducedMotion) {
      startAutoplay(AUTOPLAY_INTERVAL);
    }
  }

  // Garante que na primeira carga o carrossel esteja estritamente no marco 0 (1988)
  currentIndex = 0;
  updateSlots();

  // Reset seguro caso haja navegação de retorno via cache do navegador (bfcache)
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) {
      currentIndex = 0;
      updateSlots();
    }
  });
}
