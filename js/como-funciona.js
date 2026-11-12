// como-funciona.js - Central de Educação sobre Consórcio: interações
// exclusivas desta página. Header, menu mobile, dropdown e simulador
// continuam sob responsabilidade de script.js (carregado antes deste).

document.addEventListener('DOMContentLoaded', () => {

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------------
     Revelação suave dos blocos ao entrar no viewport.
  ------------------------------------------------------------------ */
  const revealItems = document.querySelectorAll('.cf-reveal');

  if (revealItems.length && 'IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    revealItems.forEach((item) => {
      revealObserver.observe(item);
      const rect = item.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        item.classList.add('is-visible');
      }
    });
  } else {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  }

  /* ------------------------------------------------------------------
     Jornada (Cena 03): cada etapa "acende" ao entrar no viewport e a
     linha vertical é desenhada progressivamente conforme o scroll.
  ------------------------------------------------------------------ */
  const journeySteps = document.querySelectorAll('.cf-step');
  const journeyFill = document.querySelector('.cf-journey-line-fill');
  const journeyStepsWrap = document.querySelector('.cf-journey-steps');

  if (journeySteps.length && 'IntersectionObserver' in window) {
    const stepObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-active');
          }
        });
      },
      { threshold: 0.35, rootMargin: '0px 0px -15% 0px' }
    );

    journeySteps.forEach((step) => stepObserver.observe(step));
  } else {
    journeySteps.forEach((step) => step.classList.add('is-active'));
  }

  if (journeyFill && journeyStepsWrap) {
    if (prefersReducedMotion) {
      journeyFill.style.height = '100%';
    } else {
      let ticking = false;

      const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

      const updateJourneyProgress = () => {
        ticking = false;
        const rect = journeyStepsWrap.getBoundingClientRect();
        const viewportCenter = window.innerHeight * 0.5;
        const progress = clamp((viewportCenter - rect.top) / rect.height, 0, 1);
        journeyFill.style.height = `${(progress * 100).toFixed(1)}%`;
      };

      const onScroll = () => {
        if (!ticking) {
          window.requestAnimationFrame(updateJourneyProgress);
          ticking = true;
        }
      };

      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll, { passive: true });
      updateJourneyProgress();
    }
  }

  /* ------------------------------------------------------------------
     Bifurcação Sorteio / Lance: desenha os traços do SVG uma única vez
     quando o diagrama entra no viewport.
  ------------------------------------------------------------------ */
  const forkDiagram = document.querySelector('.cf-fork');

  if (forkDiagram && 'IntersectionObserver' in window) {
    const forkObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            forkDiagram.classList.add('is-drawn');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.4 }
    );

    forkObserver.observe(forkDiagram);
  } else if (forkDiagram) {
    forkDiagram.classList.add('is-drawn');
  }

  /* ------------------------------------------------------------------
     Accordions (glossário "Consórcio sem consorciês" e FAQ).
  ------------------------------------------------------------------ */
  const accordionTriggers = document.querySelectorAll('.cf-accordion-trigger');

  accordionTriggers.forEach((trigger) => {
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
