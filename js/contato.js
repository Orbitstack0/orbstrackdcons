// contato.js - Página "Fale Conosco" (Decolar Consórcios)
// Experiência ágil, objetiva e moderna: canais diretos, acordeão acessível e modal de e-mail.

document.addEventListener('DOMContentLoaded', () => {

  /* ------------------------------------------------------------------
     1. Painel expansível de Contatos Secundários (Institucional e Ouvidoria)
  ------------------------------------------------------------------ */
  const secTrigger = document.getElementById('secondary-channels-trigger');
  const secPanel = document.getElementById('secondary-channels-panel');

  if (secTrigger && secPanel) {
    secTrigger.addEventListener('click', () => {
      const isOpen = secTrigger.getAttribute('aria-expanded') === 'true';
      if (isOpen) {
        secTrigger.setAttribute('aria-expanded', 'false');
        secPanel.style.maxHeight = '0px';
      } else {
        secTrigger.setAttribute('aria-expanded', 'true');
        secPanel.style.maxHeight = `${secPanel.scrollHeight + 16}px`;
      }
    });
  }

  /* ------------------------------------------------------------------
     3. FAQ interativo: Accordion compacto e acessível
  ------------------------------------------------------------------ */
  const faqTriggers = document.querySelectorAll('.contact-faq-trigger');

  faqTriggers.forEach((trigger) => {
    const panelId = trigger.getAttribute('aria-controls');
    const panel = panelId ? document.getElementById(panelId) : null;

    if (!panel) return;

    trigger.addEventListener('click', () => {
      const isOpen = trigger.getAttribute('aria-expanded') === 'true';

      if (isOpen) {
        trigger.setAttribute('aria-expanded', 'false');
        panel.style.maxHeight = '0px';
      } else {
        trigger.setAttribute('aria-expanded', 'true');
        panel.style.maxHeight = `${panel.scrollHeight + 16}px`;
      }
    });
  });

  // Atualiza alturas se a tela for redimensionada
  window.addEventListener('resize', () => {
    if (secTrigger && secPanel && secTrigger.getAttribute('aria-expanded') === 'true') {
      secPanel.style.maxHeight = `${secPanel.scrollHeight + 16}px`;
    }

    faqTriggers.forEach((trigger) => {
      if (trigger.getAttribute('aria-expanded') === 'true') {
        const panelId = trigger.getAttribute('aria-controls');
        const panel = panelId ? document.getElementById(panelId) : null;
        if (panel) {
          panel.style.maxHeight = `${panel.scrollHeight + 16}px`;
        }
      }
    });
  });

  /* ------------------------------------------------------------------
     4. Modal reutilizável de envio de e-mail (Gmail, Outlook, Yahoo, iCloud, Mailto)
  ------------------------------------------------------------------ */
  const emailModal = document.getElementById('email-modal');
  const emailTriggers = document.querySelectorAll('.js-email-trigger');

  if (emailModal && emailTriggers.length) {
    const emailOverlay = emailModal.querySelector('[data-email-modal-overlay]');
    const emailDialog = emailModal.querySelector('.contact-email-modal-dialog');
    const emailCloseBtn = emailModal.querySelector('[data-email-modal-close]');
    const emailAddressEl = document.getElementById('email-modal-address');
    const emailCopyBtn = document.getElementById('email-modal-copy');
    const emailGmailLink = document.getElementById('email-modal-gmail');
    const emailOutlookLink = document.getElementById('email-modal-outlook');
    const emailYahooLink = document.getElementById('email-modal-yahoo');
    const emailMailtoLink = document.getElementById('email-modal-mailto');

    const EMAIL_SUBJECTS_BY_RECIPIENT = {
      'atendimento@decolarconsorcios.com.br': 'Atendimento — Decolar Consórcios',
      'contato@decolarconsorcios.com.br': 'Contato Institucional — Decolar Consórcios',
      'ouvidoria@decolarconsorcios.com.br': 'Ouvidoria — Decolar Consórcios'
    };
    const DEFAULT_EMAIL_SUBJECT = 'Atendimento — Decolar Consórcios';

    const getEmailSubject = (email) => EMAIL_SUBJECTS_BY_RECIPIENT[email] || DEFAULT_EMAIL_SUBJECT;

    let lastEmailTrigger = null;
    let copyResetTimer = null;

    const fallbackCopyText = (text) => {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
      } catch (err) {
        // Falha silenciosa
      }
      document.body.removeChild(textarea);
    };

    const resetCopyButton = () => {
      if (!emailCopyBtn) return;
      emailCopyBtn.textContent = emailCopyBtn.dataset.defaultLabel || 'Copiar e-mail';
      emailCopyBtn.classList.remove('is-copied');
    };

    const updateEmailModalLinks = (email) => {
      if (emailAddressEl) {
        const at = email.indexOf('@');
        emailAddressEl.textContent = '';
        const local = document.createElement('span');
        local.className = 'email-local';
        local.textContent = email.slice(0, at + 1);
        const domain = document.createElement('span');
        domain.className = 'email-domain';
        domain.textContent = email.slice(at + 1);
        emailAddressEl.append(local, document.createElement('wbr'), domain);
      }

      const encodedEmail = encodeURIComponent(email);
      const encodedSubject = encodeURIComponent(getEmailSubject(email));

      if (emailGmailLink) {
        emailGmailLink.href = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodedEmail}&su=${encodedSubject}`;
      }
      if (emailOutlookLink) {
        emailOutlookLink.href = `https://outlook.live.com/mail/0/deeplink/compose?to=${encodedEmail}&subject=${encodedSubject}`;
      }
      if (emailYahooLink) {
        emailYahooLink.href = `https://compose.mail.yahoo.com/?to=${encodedEmail}&subject=${encodedSubject}`;
      }
      if (emailMailtoLink) {
        emailMailtoLink.href = `mailto:${email}?subject=${encodedSubject}`;
      }
    };

    const getFocusableElements = () => {
      if (!emailDialog) return [];
      return Array.from(emailDialog.querySelectorAll('a[href], button:not([disabled])'));
    };

    const onEmailModalKeydown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeEmailModal();
        return;
      }

      if (event.key === 'Tab') {
        const focusable = getFocusableElements();
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

    function openEmailModal(trigger) {
      const email = trigger.getAttribute('data-email');
      if (!email) return;

      lastEmailTrigger = trigger;
      updateEmailModalLinks(email);
      resetCopyButton();

      emailModal.classList.add('is-open');
      emailModal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('email-modal-open');

      if (emailDialog && typeof emailDialog.focus === 'function') {
        emailDialog.focus();
      }

      document.addEventListener('keydown', onEmailModalKeydown);
    }

    function closeEmailModal() {
      if (!emailModal.classList.contains('is-open')) return;

      emailModal.classList.remove('is-open');
      emailModal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('email-modal-open');
      resetCopyButton();

      if (copyResetTimer) {
        clearTimeout(copyResetTimer);
        copyResetTimer = null;
      }

      document.removeEventListener('keydown', onEmailModalKeydown);

      if (lastEmailTrigger && typeof lastEmailTrigger.focus === 'function') {
        lastEmailTrigger.focus();
      }
      lastEmailTrigger = null;
    }

    emailTriggers.forEach((trigger) => {
      trigger.addEventListener('click', (event) => {
        event.preventDefault();
        openEmailModal(trigger);
      });
    });

    if (emailCloseBtn) emailCloseBtn.addEventListener('click', closeEmailModal);
    if (emailOverlay) emailOverlay.addEventListener('click', closeEmailModal);

    if (emailCopyBtn) {
      emailCopyBtn.addEventListener('click', () => {
        const email = emailAddressEl ? emailAddressEl.textContent.trim() : '';
        if (!email) return;

        const showCopiedFeedback = () => {
          emailCopyBtn.textContent = emailCopyBtn.dataset.copiedLabel || 'E-mail copiado!';
          emailCopyBtn.classList.add('is-copied');
          if (copyResetTimer) clearTimeout(copyResetTimer);
          copyResetTimer = setTimeout(resetCopyButton, 1800);
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(email).then(showCopiedFeedback).catch(() => {
            fallbackCopyText(email);
            showCopiedFeedback();
          });
        } else {
          fallbackCopyText(email);
          showCopiedFeedback();
        }
      });
    }
  }

  /* ------------------------------------------------------------------
     3. Mapa de localização (Google Maps) — respeita o consentimento de
     cookies existente (js/consent.js). O mapa é um recurso de terceiro
     (pode gravar cookies do Google), então só carrega automaticamente
     depois de "Aceitar todos". Antes disso, ou se a pessoa recusou,
     ela ainda pode ativá-lo manualmente a qualquer momento pelo botão
     "Carregar mapa" — uma ação explícita dela, não um carregamento
     automático. O botão "Como chegar" é um link comum e nunca depende
     disso.
  ------------------------------------------------------------------ */
  const mapWrap = document.getElementById('contact-location-map');
  const mapIframe = document.getElementById('contact-location-iframe');
  const mapPlaceholder = document.getElementById('contact-location-map-placeholder');
  const mapLoadBtn = document.getElementById('contact-location-map-btn');

  if (mapWrap && mapIframe && mapPlaceholder) {
    let mapLoaded = false;

    const loadMap = () => {
      if (mapLoaded) return;
      const src = mapWrap.dataset.mapSrc;
      if (!src) return;
      mapIframe.src = src;
      mapIframe.hidden = false;
      mapPlaceholder.hidden = true;
      mapLoaded = true;
    };

    const hasAcceptedCookies = () => {
      try {
        return window.localStorage.getItem('decolarCookieConsent') === 'accepted';
      } catch (e) {
        return false;
      }
    };

    if (hasAcceptedCookies()) {
      loadMap();
    }

    // Se a pessoa aceitar os cookies depois (banner ainda aberto quando
    // a página carregou), o mapa aparece sem precisar recarregar a página.
    window.addEventListener('decolar:consent-change', (event) => {
      if (event && event.detail && event.detail.consent === 'accepted') {
        loadMap();
      }
    });

    if (mapLoadBtn) {
      mapLoadBtn.addEventListener('click', loadMap);
    }
  }

});
