// Decolar Consórcios - script.js

document.addEventListener('DOMContentLoaded', () => {

  /* ------------------------------------------------------------------
     Header: sombra ao rolar a página
  ------------------------------------------------------------------ */
  const header = document.getElementById('site-header');

  if (header) {
    const updateHeaderShadow = () => {
      header.classList.toggle('is-scrolled', window.scrollY > 20);
    };

    updateHeaderShadow();
    window.addEventListener('scroll', updateHeaderShadow);
  }

  /* ------------------------------------------------------------------
     Menu mobile (hamburger)
  ------------------------------------------------------------------ */
  const navToggle = document.getElementById('nav-toggle');
  const mainNav = document.getElementById('main-nav');
  const headerActions = document.getElementById('header-actions');
  const menuOverlay = document.getElementById('menu-overlay');
  const MOBILE_MENU_BREAKPOINT = 1299;

  if (header && navToggle && mainNav) {
    const closeMenu = () => {
      header.classList.remove('nav-open');
      navToggle.setAttribute('aria-expanded', 'false');
      navToggle.setAttribute('aria-label', 'Abrir menu');
      document.body.classList.remove('nav-locked');
      closeAllDropdowns();
    };

    const toggleMenu = () => {
      const isOpen = header.classList.toggle('nav-open');
      navToggle.setAttribute('aria-expanded', String(isOpen));
      navToggle.setAttribute('aria-label', isOpen ? 'Fechar menu' : 'Abrir menu');
      document.body.classList.toggle('nav-locked', isOpen);
    };

    navToggle.addEventListener('click', toggleMenu);

    // Overlay: clicar fora do painel fecha o menu mobile
    if (menuOverlay) {
      menuOverlay.addEventListener('click', closeMenu);
    }

    // ESC fecha o menu mobile quando estiver aberto
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && header.classList.contains('nav-open')) {
        closeMenu();
        navToggle.focus();
      }
    });

    // Links normais fecham o menu mobile ao serem clicados; o gatilho do
    // dropdown "Consórcios" é tratado à parte (abre/fecha o submenu, não
    // fecha o painel inteiro).
    mainNav.querySelectorAll('a:not(.has-submenu)').forEach((link) => {
      link.addEventListener('click', closeMenu);
    });

    // Fecha também ao clicar nos CTAs ou nos ícones de redes sociais do menu mobile
    if (headerActions) {
      headerActions.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', closeMenu);
      });
    }

    // Extras do menu mobile (Área do Cliente/Representante e contato)
    document.querySelectorAll('.menu-extra-links a, .menu-extra-contact a').forEach((link) => {
      link.addEventListener('click', closeMenu);
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > MOBILE_MENU_BREAKPOINT) {
        closeMenu();
      }
    });
  }

  /* Itens ainda sem destino oficial (ex.: Área do Cliente): sem navegação */
  document.querySelectorAll('.js-soon-trigger').forEach((el) => {
    el.addEventListener('click', (event) => event.preventDefault());
  });

  /* ------------------------------------------------------------------
     Navegação "Início": rolar suavemente até o topo real (scrollY = 0)
  ------------------------------------------------------------------ */
  const normalizedPath = window.location.pathname.replace(/\/index(?:\.html)?$/, '/').replace(/\/$/, '') || '/';
  const isHomePage = normalizedPath === '/';

  const homeLinks = document.querySelectorAll(
    'a[href="#inicio"], a[href="/#inicio"], a[href="./#inicio"], a[href="index.html#inicio"]'
  );

  homeLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
      if (isHomePage) {
        event.preventDefault();
        window.scrollTo({
          top: 0,
          left: 0,
          behavior: 'smooth'
        });
        if (window.history.pushState) {
          window.history.pushState(null, '', window.location.pathname + window.location.search);
        }
      }
    });
  });

  if (isHomePage && window.location.hash === '#inicio') {
    window.scrollTo(0, 0);
    window.addEventListener('load', () => window.scrollTo(0, 0), { once: true });
  }

  /* ------------------------------------------------------------------
     Dropdown "Consórcios": no desktop a abertura/fechamento é controlada
     inteiramente por :hover via CSS (fecha sozinho ao tirar o mouse).
     A classe .is-open só é usada no mobile/tablet (clique/toque), onde
     não há hover real - por isso o clique é ignorado no desktop, evitando
     que a classe fique "presa" mantendo o menu aberto após o mouse sair.
  ------------------------------------------------------------------ */
  const dropdownItems = document.querySelectorAll('.nav-item-dropdown');
  const isMobileNav = () => window.matchMedia('(max-width: 1299px)').matches;

  function closeAllDropdowns() {
    dropdownItems.forEach((item) => {
      item.classList.remove('is-open');
      const trigger = item.querySelector('.has-submenu');
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
    });
  }

  dropdownItems.forEach((item) => {
    const trigger = item.querySelector('.has-submenu');

    if (!trigger) return;

    trigger.addEventListener('click', (event) => {
      event.preventDefault();

      // Desktop: nada a fazer aqui, o CSS (:hover) já controla o estado.
      if (!isMobileNav()) return;

      const wasOpen = item.classList.contains('is-open');
      closeAllDropdowns();

      if (!wasOpen) {
        item.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
      }
    });
  });

  document.addEventListener('click', (event) => {
    dropdownItems.forEach((item) => {
      if (item.classList.contains('is-open') && !item.contains(event.target)) {
        item.classList.remove('is-open');
        const trigger = item.querySelector('.has-submenu');
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
      }
    });
  });

  /* ------------------------------------------------------------------
     Simulador: configuração provisória por modalidade/tipo
     (valores de exemplo - ajustar min/max/step/default aqui, sem
     precisar tocar na lógica do simulador abaixo)
  ------------------------------------------------------------------ */
  const SIMULATOR_CONFIG = {
    imovel: {
      credito: { min: 200000, max: 1000000, step: 10000, default: 300000 }
    },
    veiculo: {
      credito: { min: 40000, max: 700000, step: 5000, default: 60000 }
    },
    pesados: {
      credito: { min: 180000, max: 1000000, step: 10000, default: 250000 }
    }
  };

  // Aba "Parcela": mesmo intervalo para as três modalidades (não muda ao trocar modalidade)
  const PARCELA_CONFIG = { min: 390, max: 6590, step: 10, default: 1500 };

  const RANGE_TITLES = {
    credito: 'Qual o valor do crédito?',
    parcela: 'Qual o valor da parcela?'
  };

  const formatCurrency = (value) => {
    return Number(value).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  };

  /* ------------------------------------------------------------------
     Simulador: seleção de modalidade
  ------------------------------------------------------------------ */
  const modalityOptions = document.querySelectorAll('.modality-option');

  const getSelectedModalidade = () => {
    const checked = document.querySelector('input[name="modalidade"]:checked');
    return checked ? checked.value : null;
  };

  modalityOptions.forEach((option) => {
    const input = option.querySelector('input[type="radio"]');

    if (!input) return;

    input.addEventListener('change', () => {
      modalityOptions.forEach((item) => item.classList.remove('is-selected'));
      option.classList.add('is-selected');
      applyRangeConfig();
    });
  });

  /* ------------------------------------------------------------------
     Simulador: alternância entre Crédito e Parcela
  ------------------------------------------------------------------ */
  const typeOptions = document.querySelectorAll('.type-option');

  const getSelectedTipo = () => {
    const checked = document.querySelector('input[name="tipo"]:checked');
    return checked ? checked.value : null;
  };

  typeOptions.forEach((option) => {
    const input = option.querySelector('input[type="radio"]');

    if (!input) return;

    input.addEventListener('change', () => {
      typeOptions.forEach((item) => item.classList.remove('is-selected'));
      option.classList.add('is-selected');
      applyRangeConfig();
    });
  });

  /* ------------------------------------------------------------------
     Simulador: slider de valor (crédito ou parcela, conforme seleção)
  ------------------------------------------------------------------ */
  const simulatorRange = document.getElementById('simulator-range');
  const simulatorValue = document.getElementById('simulator-value');
  const rangeTitle = document.getElementById('range-title');
  const rangeMinLabel = document.getElementById('range-min-label');
  const rangeMaxLabel = document.getElementById('range-max-label');

  function updateRangeDisplay() {
    if (!simulatorRange) return;

    const min = Number(simulatorRange.min);
    const max = Number(simulatorRange.max);
    const value = Number(simulatorRange.value);
    const percent = ((value - min) / (max - min)) * 100;

    simulatorRange.style.setProperty('--range-progress', `${percent}%`);

    if (simulatorValue) {
      simulatorValue.textContent = formatCurrency(value);
    }
  }

  function applyRangeConfig() {
    if (!simulatorRange) return;

    const modalidade = getSelectedModalidade();
    const tipo = getSelectedTipo();
    const config = tipo === 'parcela'
      ? PARCELA_CONFIG
      : SIMULATOR_CONFIG[modalidade] && SIMULATOR_CONFIG[modalidade].credito;

    if (!config) return;

    // Define min/max/step tanto via propriedade quanto via atributo,
    // garantindo que o <input type="range"> real seja alterado (e não
    // apenas os textos/labels visuais) ao trocar Crédito <-> Parcela.
    simulatorRange.min = config.min;
    simulatorRange.setAttribute('min', config.min);

    simulatorRange.max = config.max;
    simulatorRange.setAttribute('max', config.max);

    simulatorRange.step = config.step;
    simulatorRange.setAttribute('step', config.step);

    simulatorRange.value = config.default;

    if (rangeTitle) {
      rangeTitle.textContent = RANGE_TITLES[tipo] || RANGE_TITLES.credito;
    }

    if (rangeMinLabel) rangeMinLabel.textContent = formatCurrency(config.min);
    if (rangeMaxLabel) rangeMaxLabel.textContent = formatCurrency(config.max);

    updateRangeDisplay();
  }

  if (simulatorRange) {
    applyRangeConfig();
    simulatorRange.addEventListener('input', updateRangeDisplay);
  }

  /* ------------------------------------------------------------------
     Simulador: envio da primeira etapa -> redireciona para simulacao.html
  ------------------------------------------------------------------ */
  const simulatorForm = document.getElementById('simulator-form');

  if (simulatorForm) {
    simulatorForm.addEventListener('submit', (event) => {
      event.preventDefault();

      // Fallback defensivo: os radios já vêm com "checked" por padrão no
      // HTML, então isto normalmente nunca é usado - mas garante que a
      // URL nunca saia com "null" caso algo destrua a seleção nativa.
      const modalidade = getSelectedModalidade() || 'imovel';
      const tipo = getSelectedTipo() || 'credito';
      const valor = simulatorRange ? simulatorRange.value : '';

      const selecao = { modalidade, tipo, valor };

      // sessionStorage é apenas um fallback de segurança (refresh/nova aba
      // na mesma sessão); a URL continua sendo a fonte principal dos dados.
      try {
        sessionStorage.setItem('decolarSimulacao', JSON.stringify(selecao));
      } catch (err) {
        // Armazenamento indisponível (ex.: modo privado) - segue só com a URL.
      }

      const params = new URLSearchParams(selecao);
      const isHtml = window.location.pathname.endsWith('.html');
      const targetSimUrl = isHtml ? 'simulacao.html' : '/simulacao/';

      window.location.href = `${targetSimUrl}?${params.toString()}`;
    });
  }

  /* ------------------------------------------------------------------
     Home: simulador em modal, aberto pelos CTAs dos slides 1 e 5 do
     carrossel do hero (atributo data-open-simulator) e pelo CTA "Simule
     seu Consórcio" do header (em vez de navegar para simulacao.html).
     É o MESMO formulário de sempre (mesmos IDs/estado/validação).
  ------------------------------------------------------------------ */
  const simPanel = document.getElementById('simulador');
  const simCard = document.getElementById('simulator-form');

  if (simPanel && simCard) {
    const simCloseBtn = document.getElementById('simulator-close');
    const simOverlay = document.getElementById('simulador-overlay');
    const simOpenTriggers = document.querySelectorAll(
      '.header-actions a[href="/simulacao"], .header-actions a[href="simulacao"], .header-actions a[href="simulacao.html"], .header-cta-mobile, [data-open-simulator]'
    );

    const isSimOpen = () => simPanel.classList.contains('is-open');

    const showSimulator = (focusCard) => {
      if (!isSimOpen()) {
        simPanel.classList.add('is-open');
        simPanel.setAttribute('aria-hidden', 'false');
        document.body.classList.add('sim-open');
      }
      if (focusCard) {
        simCard.focus({ preventScroll: true });
      }
    };

    const hideSimulator = () => {
      simPanel.classList.remove('is-open');
      simPanel.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('sim-open');
    };

    simOpenTriggers.forEach((trigger) => {
      trigger.addEventListener('click', (event) => {
        event.preventDefault();
        showSimulator(true);
      });
    });

    if (simCloseBtn) {
      simCloseBtn.addEventListener('click', hideSimulator);
    }

    if (simOverlay) {
      simOverlay.addEventListener('click', hideSimulator);
    }

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && isSimOpen()) {
        hideSimulator();
      }
    });

    if (window.location.hash === '#simulador') {
      showSimulator(false);
    }
  }

  /* ------------------------------------------------------------------
     Home: carrossel cinematográfico do hero — 5 slides, troca automática
     a cada ~7s, pausa em hover/foco/aba oculta, setas e indicadores,
     respeita prefers-reduced-motion (sem troca automática).
  ------------------------------------------------------------------ */
  const heroCarousel = document.getElementById('inicio');
  const heroSlidesEl = document.getElementById('hero-slides');

  if (heroCarousel && heroSlidesEl) {
    const slides = Array.from(heroSlidesEl.querySelectorAll('.hero-slide'));
    const dots = Array.from(document.querySelectorAll('.hero-dot'));
    const prevBtn = document.getElementById('hero-prev');
    const nextBtn = document.getElementById('hero-next');
    const AUTOPLAY_MS = 7000;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let currentIndex = slides.findIndex((slide) => slide.classList.contains('is-active'));
    if (currentIndex < 0) currentIndex = 0;
    let autoplayTimer = null;

    const goToSlide = (index) => {
      const nextIndex = (index + slides.length) % slides.length;
      if (nextIndex === currentIndex) return;

      slides[currentIndex].classList.remove('is-active');
      dots[currentIndex] && dots[currentIndex].classList.remove('is-active');
      dots[currentIndex] && dots[currentIndex].setAttribute('aria-selected', 'false');

      currentIndex = nextIndex;

      slides[currentIndex].classList.add('is-active');
      dots[currentIndex] && dots[currentIndex].classList.add('is-active');
      dots[currentIndex] && dots[currentIndex].setAttribute('aria-selected', 'true');
    };

    const nextSlide = () => goToSlide(currentIndex + 1);
    const prevSlide = () => goToSlide(currentIndex - 1);

    const stopAutoplay = () => {
      window.clearInterval(autoplayTimer);
      autoplayTimer = null;
    };

    const startAutoplay = () => {
      if (prefersReducedMotion || document.hidden) return;
      stopAutoplay();
      autoplayTimer = window.setInterval(nextSlide, AUTOPLAY_MS);
    };

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        prevSlide();
        startAutoplay();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        nextSlide();
        startAutoplay();
      });
    }

    dots.forEach((dot, index) => {
      dot.addEventListener('click', () => {
        goToSlide(index);
        startAutoplay();
      });
    });

    heroCarousel.addEventListener('mouseenter', stopAutoplay);
    heroCarousel.addEventListener('mouseleave', startAutoplay);
    heroCarousel.addEventListener('focusin', stopAutoplay);
    heroCarousel.addEventListener('focusout', startAutoplay);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        stopAutoplay();
      } else {
        startAutoplay();
      }
    });

    heroCarousel.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') {
        prevSlide();
        startAutoplay();
      } else if (event.key === 'ArrowRight') {
        nextSlide();
        startAutoplay();
      }
    });

    startAutoplay();
  }

  /* ------------------------------------------------------------------
     Página de simulação (simulacao.html): lê modalidade/tipo/valor da
     URL (enviados pelo simulador da Home), exibe um resumo curto e
     envia o cliente para o WhatsApp com a mensagem já preenchida.
     Não há backend/API: o único destino final é o link wa.me.
  ------------------------------------------------------------------ */
  const simSummary = document.getElementById('sim-summary');

  if (simSummary) {
    // WhatsApp oficial da Decolar Consórcios
    const DECOLAR_WHATSAPP = '5551997191616';
    const showWhatsappSoonNote = (formEl) => {
      let note = formEl.querySelector('.whatsapp-soon-note');
      if (!note) {
        note = document.createElement('p');
        note.className = 'whatsapp-soon-note';
        note.setAttribute('role', 'status');
        note.textContent = 'O envio pelo WhatsApp estará disponível em breve. Enquanto isso, você pode falar conosco pelo e-mail atendimento@decolarconsorcios.com.br.';
        formEl.appendChild(note);
      }
    };
    const SIM_STORAGE_KEY = 'decolarSimulacao';

    const MODALIDADE_LABELS = {
      imovel: 'Imóvel',
      veiculo: 'Veículo',
      pesados: 'Pesados'
    };

    const VALUE_LABELS = {
      credito: 'Crédito desejado',
      parcela: 'Parcela desejada'
    };

    const isValorValido = (valor) => valor !== null && valor !== undefined && valor !== '' && !Number.isNaN(Number(valor));

    const readFromUrl = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const modalidade = urlParams.get('modalidade');
      const tipo = urlParams.get('tipo');
      const valor = urlParams.get('valor');

      if (modalidade && tipo && isValorValido(valor)) {
        return { modalidade, tipo, valor };
      }
      return null;
    };

    const readFromStorage = () => {
      try {
        const raw = sessionStorage.getItem(SIM_STORAGE_KEY);
        if (!raw) return null;

        const parsed = JSON.parse(raw);
        if (parsed && parsed.modalidade && parsed.tipo && isValorValido(parsed.valor)) {
          return parsed;
        }
      } catch (err) {
        // JSON inválido ou storage indisponível - trata como se não houvesse dado.
      }
      return null;
    };

    /* ------------------------------------------------------------------
       Estado A (resumo + dados pessoais) vs Estado B (escolha inicial,
       mesmos cards/toggle/slider do simulador da Home - reaproveitados
       via os mesmos ids/classes, então a lógica de modalidade/tipo/range
       já registrada acima nesta mesma função cuida sozinha da escolha).
    ------------------------------------------------------------------ */
    const stateA = document.getElementById('sim-state-a');
    const stateB = document.getElementById('sim-state-b');
    const summaryModalidade = document.getElementById('sim-summary-modalidade');
    const summaryValueLabel = document.getElementById('sim-summary-value-label');
    const summaryValue = document.getElementById('sim-summary-value');
    const editBtn = document.getElementById('sim-summary-edit');
    const choiceContinueBtn = document.getElementById('sim-choice-continue');
    const whatsappSubmitBtn = document.getElementById('sim-whatsapp-submit');

    let selecaoAtual = null;

    const persistSelecao = (sel) => {
      try {
        sessionStorage.setItem(SIM_STORAGE_KEY, JSON.stringify(sel));
      } catch (err) {
        // Storage indisponível - segue normalmente só com os dados em memória.
      }
    };

    function showStateA(sel) {
      selecaoAtual = sel;
      persistSelecao(sel);

      if (stateA) stateA.hidden = false;
      if (stateB) stateB.hidden = true;
      if (whatsappSubmitBtn) whatsappSubmitBtn.disabled = false;

      const modalidadeLabel = MODALIDADE_LABELS[sel.modalidade] || sel.modalidade;
      const valorLabel = VALUE_LABELS[sel.tipo] || VALUE_LABELS.credito;
      const valorFormatado = formatCurrency(sel.valor);

      if (summaryModalidade) summaryModalidade.textContent = modalidadeLabel;
      if (summaryValueLabel) summaryValueLabel.textContent = valorLabel;
      if (summaryValue) summaryValue.textContent = valorFormatado;
    }

    // Pré-preenche os cards/slider da Estado B com a seleção atual (usada
    // ao clicar em "Alterar" - não reseta a escolha do zero).
    function prefillChoice(sel) {
      const modalidadeInput = document.querySelector(`input[name="modalidade"][value="${sel.modalidade}"]`);
      const tipoInput = document.querySelector(`input[name="tipo"][value="${sel.tipo}"]`);

      if (modalidadeInput) {
        modalidadeInput.checked = true;
        modalidadeInput.dispatchEvent(new Event('change'));
      }

      if (tipoInput) {
        tipoInput.checked = true;
        tipoInput.dispatchEvent(new Event('change'));
      }

      // applyRangeConfig() (disparado pelos "change" acima) redefine o
      // slider para o valor padrão da combinação - sobrescrevemos aqui
      // com o valor real que o cliente já havia escolhido.
      if (simulatorRange && sel.valor) {
        simulatorRange.value = sel.valor;
        updateRangeDisplay();
      }
    }

    function showStateB(prefill) {
      if (stateA) stateA.hidden = true;
      if (stateB) stateB.hidden = false;
      if (whatsappSubmitBtn) whatsappSubmitBtn.disabled = true;

      if (prefill) prefillChoice(prefill);
    }

    // 1) URL é a fonte principal. 2) sessionStorage é o fallback de
    // segurança (refresh, nova aba na mesma sessão). 3) Sem nenhum dos
    // dois, a coluna esquerda vira a própria etapa de escolha (Estado B).
    const selecaoInicial = readFromUrl() || readFromStorage();

    if (selecaoInicial) {
      showStateA(selecaoInicial);
    } else {
      showStateB(null);

      // Vindo de "Conhecer o consórcio de X" na Home: só a modalidade
      // chega pela URL (ex.: ?modalidade=veiculo). Isso NÃO é uma
      // simulação completa (falta tipo e valor) - a etapa de escolha
      // continua aberta, apenas com a modalidade já pré-selecionada.
      const modalidadeParam = new URLSearchParams(window.location.search).get('modalidade');
      const modalidadeValida = ['imovel', 'veiculo', 'pesados'].includes(modalidadeParam);

      if (modalidadeValida) {
        const modalidadeInput = document.querySelector(`input[name="modalidade"][value="${modalidadeParam}"]`);
        if (modalidadeInput && !modalidadeInput.checked) {
          modalidadeInput.checked = true;
          modalidadeInput.dispatchEvent(new Event('change'));
        }
      }
    }

    if (choiceContinueBtn) {
      choiceContinueBtn.addEventListener('click', () => {
        const modalidade = getSelectedModalidade() || 'imovel';
        const tipo = getSelectedTipo() || 'credito';
        const valor = simulatorRange ? simulatorRange.value : '';
        const novaSelecao = { modalidade, tipo, valor };

        const params = new URLSearchParams(novaSelecao);
        if (window.history.replaceState) {
          const isHtml = window.location.pathname.endsWith('.html');
          const currentPath = isHtml
            ? window.location.pathname
            : (window.location.pathname.endsWith('/') ? window.location.pathname : `${window.location.pathname}/`);
          window.history.replaceState(null, '', `${currentPath}?${params.toString()}`);
        }

        showStateA(novaSelecao);
      });
    }

    if (editBtn) {
      editBtn.addEventListener('click', () => {
        showStateB(selecaoAtual);
      });
    }

    /* --------------------------------------------------------------
       Formulário curto: validação simples (mensagens junto ao campo,
       sem alert() nativo) e envio direto para o WhatsApp. Só funciona
       quando já existe modalidade/tipo/valor confirmados (Estado A).
    -------------------------------------------------------------- */
    const simForm = document.getElementById('sim-form');

    if (simForm) {
      const fields = {
        nome: document.getElementById('sim-nome'),
        whatsapp: document.getElementById('sim-whatsapp'),
        cidade: document.getElementById('sim-cidade'),
        prazo: document.getElementById('sim-prazo')
      };

      const consentimentoField = document.getElementById('sim-consentimento');

      const setFieldError = (field, message) => {
        if (!field) return;
        const wrapper = field.closest('.form-field');
        const errorEl = document.getElementById(`${field.id}-error`);
        if (wrapper) wrapper.classList.add('has-error');
        if (errorEl) errorEl.textContent = message;
      };

      const clearFieldError = (field) => {
        if (!field) return;
        const wrapper = field.closest('.form-field');
        const errorEl = document.getElementById(`${field.id}-error`);
        if (wrapper) wrapper.classList.remove('has-error');
        if (errorEl) errorEl.textContent = '';
      };

      Object.values(fields).forEach((field) => {
        if (!field) return;
        field.addEventListener('input', () => clearFieldError(field));
        field.addEventListener('change', () => clearFieldError(field));
      });

      if (consentimentoField) {
        consentimentoField.addEventListener('change', () => clearFieldError(consentimentoField));
      }

      const validateSimForm = () => {
        let isValid = true;
        let firstInvalid = null;

        const required = [
          { field: fields.nome, message: 'Informe seu nome.' },
          { field: fields.whatsapp, message: 'Informe seu WhatsApp.' },
          { field: fields.cidade, message: 'Informe sua cidade/UF.' },
          { field: fields.prazo, message: 'Selecione uma previsão.' }
        ];

        required.forEach(({ field, message }) => {
          if (!field) return;
          if (!field.value.trim()) {
            setFieldError(field, message);
            isValid = false;
            if (!firstInvalid) firstInvalid = field;
          } else {
            clearFieldError(field);
          }
        });

        if (consentimentoField) {
          if (!consentimentoField.checked) {
            setFieldError(consentimentoField, 'É necessário autorizar o contato para continuar.');
            isValid = false;
            if (!firstInvalid) firstInvalid = consentimentoField;
          } else {
            clearFieldError(consentimentoField);
          }
        }

        return { isValid, firstInvalid };
      };

      const buildWhatsappMessage = () => {
        const modalidadeLabel = MODALIDADE_LABELS[selecaoAtual.modalidade] || selecaoAtual.modalidade;
        const valorLabel = VALUE_LABELS[selecaoAtual.tipo] || VALUE_LABELS.credito;
        const valorFormatado = formatCurrency(selecaoAtual.valor);

        const nome = fields.nome.value.trim();
        const cidade = fields.cidade.value.trim();
        const prazo = fields.prazo.value.trim();

        return [
          `Olá! Meu nome é ${nome} e gostaria de fazer uma simulação na Decolar Consórcios.`,
          '',
          `Modalidade: ${modalidadeLabel}`,
          `${valorLabel}: ${valorFormatado}`,
          `Cidade/UF: ${cidade}`,
          `Previsão para realizar: ${prazo}`,
          '',
          'Gostaria de continuar meu atendimento.'
        ].join('\n');
      };

      simForm.addEventListener('submit', (event) => {
        event.preventDefault();

        if (!selecaoAtual) return;

        const { isValid, firstInvalid } = validateSimForm();

        if (!isValid) {
          if (firstInvalid && typeof firstInvalid.focus === 'function') {
            firstInvalid.focus();
          }
          return;
        }

        if (!DECOLAR_WHATSAPP) {
          showWhatsappSoonNote(simForm);
          return;
        }

        const message = buildWhatsappMessage();
        const whatsappUrl = `https://wa.me/${DECOLAR_WHATSAPP}?text=${encodeURIComponent(message)}`;

        window.open(whatsappUrl, '_blank', 'noopener');
      });
    }
  }

  /* ------------------------------------------------------------------
     Seção "Horizonte": fade-in/fade-up sutil ao entrar no viewport.
     Progressive enhancement: a seção só é ocultada momentaneamente se
     o navegador suportar IntersectionObserver; sem JS (ou sem suporte),
     ela permanece visível normalmente, sem depender de script algum.
  ------------------------------------------------------------------ */
  const horizonSection = document.querySelector('.horizon');

  if (horizonSection && 'IntersectionObserver' in window) {
    horizonSection.classList.add('horizon-pending');

    const revealHorizon = (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          horizonSection.classList.remove('horizon-pending');
          observer.unobserve(entry.target);
        }
      });
    };

    const horizonObserver = new IntersectionObserver(revealHorizon, {
      threshold: 0.2
    });

    horizonObserver.observe(horizonSection);
  }

  /* ------------------------------------------------------------------
     Novos blocos institucionais (Objetivos, Por que escolher a Decolar,
     Segurança e Transparência, CTA final): fade + translateY sutil ao
     entrar no viewport, reaproveitando o mesmo princípio já usado acima
     para o Horizonte. Progressive enhancement: sem IntersectionObserver,
     os elementos permanecem visíveis normalmente (a classe só é
     adicionada quando há suporte).
  ------------------------------------------------------------------ */
  const revealItems = document.querySelectorAll('.reveal-on-scroll');

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
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );

    // Delay discreto e crescente apenas para listas de itens irmãos
    // (ex.: as quatro faixas de Objetivos, os três benefícios de
    // seja-um-representante.html), sem atrasar as demais seções.
    const goalRows = document.querySelectorAll('.goals-list .reveal-on-scroll, .rep-network-cards .reveal-on-scroll');
    goalRows.forEach((row, index) => {
      row.style.transitionDelay = `${Math.min(index, 5) * 70}ms`;
    });

    revealItems.forEach((item) => {
      // Só entra no estado oculto (CSS ".reveal-armed") depois de termos
      // certeza de que há um observer cuidando de revelá-lo — nunca antes.
      item.classList.add('reveal-armed');
      revealObserver.observe(item);

      const rect = item.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        item.classList.add('is-visible');
        revealObserver.unobserve(item);
      }
    });
  }
  // Sem IntersectionObserver: os itens nunca recebem ".reveal-armed" e
  // ".reveal-on-scroll" já é visível por padrão no CSS — nada a fazer aqui.

  /* ------------------------------------------------------------------
     Carrossel mobile de modalidades ("O que você quer conquistar?"):
     sincroniza o ponto ativo com o card mais visível durante o swipe.
     Puramente decorativo/progressive enhancement — o carrossel em si é
     scroll-snap nativo e funciona com ou sem este script (basta tocar
     e arrastar); sem IntersectionObserver, o primeiro ponto so permanece
     marcado, sem prejudicar a navegação.
  ------------------------------------------------------------------ */
  const productsPanelsEl = document.querySelector('.products-panels');
  const productDots = document.querySelectorAll('.products-dot');

  if (productsPanelsEl && productDots.length && 'IntersectionObserver' in window) {
    const panels = Array.from(productsPanelsEl.querySelectorAll('.product-panel'));

    const dotsObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.intersectionRatio > 0.6) {
            const index = panels.indexOf(entry.target);
            if (index === -1) return;
            productDots.forEach((dot, dotIndex) => {
              dot.classList.toggle('is-active', dotIndex === index);
            });
          }
        });
      },
      { root: productsPanelsEl, threshold: [0.6] }
    );

    panels.forEach((panel) => dotsObserver.observe(panel));
  }

  /* ------------------------------------------------------------------
     Segurança e Transparência: acordeão exclusivo do mobile (<=767px).
     Progressive enhancement total:
     - Sem JS: nenhum painel ganha ".is-collapsed", então os quatro
       textos permanecem sempre visíveis (o CSS mobile só esconde o
       painel quando essa classe existe).
     - Em telas >=768px: o CSS do acordeão nem existe fora do
       breakpoint mobile, então clicar no título não causa nenhuma
       mudança visual — mas, por segurança extra, nem tentamos
       recolher nada fora do breakpoint (ver isMobile() abaixo).
     - Os gatilhos nascem com tabindex="-1" no HTML (inertes no
       desktop, igual a um <h3> comum); só viram parada de Tab quando
       o acordeão é realmente ativado no mobile.
  ------------------------------------------------------------------ */
  const trustRows = Array.from(document.querySelectorAll('.trust-row[data-trust-row]'))
    .map((row) => ({
      trigger: row.querySelector('.trust-row-trigger'),
      panel: row.querySelector('.trust-row-panel'),
    }))
    .filter((item) => item.trigger && item.panel);

  if (trustRows.length) {
    const isMobile = () => window.matchMedia('(max-width: 767px)').matches;

    const collapse = (panel) => {
      panel.style.maxHeight = '0px';
      panel.classList.add('is-collapsed');
    };

    const expand = (panel) => {
      panel.classList.remove('is-collapsed');
      panel.style.maxHeight = `${panel.scrollHeight}px`;
    };

    const openOnly = (index) => {
      trustRows.forEach((item, i) => {
        const isOpen = i === index;
        item.trigger.setAttribute('aria-expanded', String(isOpen));
        if (isOpen) {
          expand(item.panel);
        } else {
          collapse(item.panel);
        }
      });
    };

    const closeAll = () => {
      trustRows.forEach((item) => {
        item.trigger.setAttribute('aria-expanded', 'false');
        collapse(item.panel);
      });
    };

    const activateAccordion = () => {
      trustRows.forEach((item) => item.trigger.setAttribute('tabindex', '0'));
      closeAll(); // Inicialmente todos os itens fechados no mobile
    };

    const deactivateAccordion = () => {
      // Volta ao estado "tudo visível, nada é botão de verdade" do
      // desktop/tablet, caso a tela cruze o breakpoint (ex.: girar o
      // celular ou redimensionar a janela).
      trustRows.forEach((item) => {
        item.trigger.setAttribute('tabindex', '-1');
        item.trigger.setAttribute('aria-expanded', 'true');
        item.panel.classList.remove('is-collapsed');
        item.panel.style.maxHeight = '';
      });
    };

    if (isMobile()) {
      activateAccordion();
    }

    let wasMobile = isMobile();
    window.addEventListener('resize', () => {
      const nowMobile = isMobile();
      if (nowMobile === wasMobile) return;
      wasMobile = nowMobile;
      if (nowMobile) {
        activateAccordion();
      } else {
        deactivateAccordion();
      }
    });

    trustRows.forEach((item, index) => {
      item.trigger.addEventListener('click', () => {
        if (!isMobile()) return;
        const isCurrentlyOpen = item.trigger.getAttribute('aria-expanded') === 'true';
        if (isCurrentlyOpen) {
          item.trigger.setAttribute('aria-expanded', 'false');
          collapse(item.panel);
        } else {
          openOnly(index);
        }
      });
    });
  }

  /* ------------------------------------------------------------------
     Bloco "Atuação Nacional": Porto Alegre acende e as linhas de
     conexão se desenham suavemente ao entrar no viewport (uma única
     vez). Mesmo padrão progressive enhancement do Horizonte.
  ------------------------------------------------------------------ */
  const reachMap = document.querySelector('.reach-map');

  if (reachMap && 'IntersectionObserver' in window) {
    reachMap.classList.add('reach-pending');

    const revealReachMap = (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          reachMap.classList.remove('reach-pending');
          observer.unobserve(entry.target);
        }
      });
    };

    const reachObserver = new IntersectionObserver(revealReachMap, {
      threshold: 0.3
    });

    reachObserver.observe(reachMap);
  }



  /* ------------------------------------------------------------------
     Modal "Representantes em breve": mesmo padrão do modal do Blog
     acima (overlay, ESC, foco controlado), aplicado a todos os
     gatilhos ".js-rep-trigger" (hoje, o CTA "Seja um Representante
     Decolar" do header).
  ------------------------------------------------------------------ */
  const repModal = document.getElementById('rep-modal');
  const repTriggers = document.querySelectorAll('.js-rep-trigger');

  if (repModal && repTriggers.length) {
    const repOverlay = repModal.querySelector('[data-rep-modal-overlay]');
    const repDialog = repModal.querySelector('.blog-modal-dialog');
    const repCloseBtn = repModal.querySelector('[data-rep-modal-close]');
    const repCloseX = repModal.querySelector('[data-rep-modal-close-x]');

    let lastRepTrigger = null;

    const getRepFocusable = () => {
      if (!repDialog) return [];
      return Array.from(repDialog.querySelectorAll('a[href], button:not([disabled])'));
    };

    const onRepModalKeydown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRepModal();
        return;
      }

      if (event.key === 'Tab') {
        const focusable = getRepFocusable();
        if (!focusable.length) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    function openRepModal(trigger) {
      lastRepTrigger = trigger;

      repModal.classList.add('is-open');
      repModal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('blog-modal-open');

      if (repDialog && typeof repDialog.focus === 'function') {
        repDialog.focus();
      }

      document.addEventListener('keydown', onRepModalKeydown);
    }

    function closeRepModal() {
      if (!repModal.classList.contains('is-open')) return;

      repModal.classList.remove('is-open');
      repModal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('blog-modal-open');

      document.removeEventListener('keydown', onRepModalKeydown);

      if (lastRepTrigger && typeof lastRepTrigger.focus === 'function') {
        lastRepTrigger.focus();
      }
      lastRepTrigger = null;
    }

    repTriggers.forEach((trigger) => {
      trigger.addEventListener('click', (event) => {
        event.preventDefault();
        openRepModal(trigger);
      });
    });

    if (repCloseBtn) repCloseBtn.addEventListener('click', closeRepModal);
    if (repCloseX) repCloseX.addEventListener('click', closeRepModal);
    if (repOverlay) repOverlay.addEventListener('click', closeRepModal);
  }

});
