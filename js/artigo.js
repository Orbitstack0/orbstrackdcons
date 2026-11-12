/**
 * Decolar Consórcios — artigo.js
 * Página dinâmica de leitura de artigo (artigo.html?slug=...), alimentada
 * pela tabela pública `blog_articles` no Supabase (ver js/supabase-client.js).
 *
 * SEGURANÇA — todo conteúdo vindo do banco é tratado como não confiável:
 * - Título, categoria, autor, data e autoria/revisão são inseridos com
 *   `textContent`, nunca interpretados como HTML.
 * - O conteúdo do artigo É HTML (produzido pelo editor Quill) — o único
 *   campo em que isso é esperado. Antes de entrar no DOM, passa
 *   obrigatoriamente por `DOMPurify.sanitize()` com uma lista branca
 *   explícita de tags/atributos/protocolos (mesma política usada no
 *   painel administrativo). Nunca é inserido sem essa sanitização.
 * - Todo link dentro do conteúdo sanitizado recebe target="_blank" e
 *   rel="noopener noreferrer" automaticamente (hook do DOMPurify).
 * - O slug da URL é validado contra um padrão estrito antes de ser usado
 *   na consulta; nunca é concatenado em HTML.
 * - A leitura pública só retorna artigos com status = 'published' — essa
 *   regra é aplicada pelo RLS no banco, não apenas pelo filtro feito aqui.
 */

const CATEGORY_LABELS = {
  entenda: 'Entenda o Consórcio',
  lances: 'Lances e Contemplação',
  imoveis: 'Imóveis',
  veiculos: 'Veículos',
  pesados: 'Pesados',
  seguranca: 'Segurança e Planejamento',
  mercado: 'Mercado e Atualidade',
};

// Origem pública oficial configurada para o site (usada para canonical,
// Open Graph e links de compartilhamento, evitando expor endereços locais como localhost).
const SITE_PUBLIC_ORIGIN = 'https://decolarconsorcios.com.br';

function isValidSlug(slug) {
  return typeof slug === 'string' && /^[a-z0-9-]+$/.test(slug);
}

function getSlugFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug');
  return isValidSlug(slug) ? slug : null;
}

// Centraliza a geração da URL pública de compartilhamento do artigo.
// Preserva o slug válido e o formato de rota canônico (artigo.html?slug=...).
// Em ambiente local (localhost, 127.0.0.1, file:), utiliza a URL pública oficial.
function getArticleShareUrl(slug) {
  const safeSlug = isValidSlug(slug) ? slug : '';
  const path = `artigo/?slug=${encodeURIComponent(safeSlug)}`;

  const host = window.location.hostname;
  const isLocal = !host || host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';

  if (isLocal) {
    return `${SITE_PUBLIC_ORIGIN}/${path}`;
  }

  return `${window.location.origin}/${path}`;
}

function formatDate(isoDate) {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function isSafeImagePath(value) {
  return typeof value === 'string' && /^(https?:\/\/|\/|assets\/)/i.test(value);
}

// Estimativa unificada de tempo de leitura — compartilhada entre blog.html,
// artigo.html e o painel editorial (ver js/reading-time.js).
function estimateReadingTime(content) {
  if (typeof window !== 'undefined' && typeof window.estimateReadingTime === 'function' && window.estimateReadingTime !== estimateReadingTime) {
    return window.estimateReadingTime(content);
  }
  if (!content) return null;
  const plain = (typeof window !== 'undefined' && typeof window.stripHtmlToText === 'function')
    ? window.stripHtmlToText(content)
    : String(content)
        .replace(/<\/(p|div|h[1-6]|li|blockquote|tr|table|section|article)>/gi, ' ')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/gi, ' ');
  const words = plain.trim().split(/\s+/).filter(Boolean).length;
  if (!words) return null;
  return Math.max(1, Math.ceil(words / 200));
}

// Mesma lista branca de tags/atributos/protocolos usada no painel
// administrativo (admin/js/admin-editor.js) — nenhuma tag de script,
// iframe, formulário ou manipulador de evento (on*) sobrevive.
const CONTENT_PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 'b', 'i', 'u', 's',
    'h1', 'h2', 'h3', 'h4',
    'ul', 'ol', 'li',
    'a', 'blockquote', 'code', 'pre', 'img', 'hr', 'span',
  ],
  ALLOWED_ATTR: ['href', 'title', 'alt', 'src'],
  ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|\/|#)/i,
};

let hardenLinksHookRegistered = false;

// Todo link do conteúdo abre em nova aba com target="_blank" — por isso
// precisa de rel="noopener noreferrer" (evita que a nova aba acesse
// `window.opener`, o risco clássico de "reverse tabnabbing").
function registerHardenLinksHookOnce() {
  if (hardenLinksHookRegistered || !window.DOMPurify) return;
  hardenLinksHookRegistered = true;
  window.DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });
}

// Caracteres Unicode invisíveis que o algoritmo de quebra de linha do
// navegador trata como pontos de quebra válidos — independente de
// qualquer CSS (overflow-wrap/word-break/hyphens não têm efeito sobre
// eles, porque não são uma decisão de CSS, são um caractere real dentro
// do texto). O mais comum de aparecer "do nada" é o hífen suave (U+00AD):
// é invisível em condições normais, mas qualquer editor/fonte que faça
// hifenização automática (Word, Google Docs, alguns PDFs) pode deixá-lo
// embutido no texto colado — e, se cair no meio de uma palavra, o
// navegador pode quebrar exatamente ali, sem que o DOMPurify (que
// sanitiza estrutura HTML, não o conteúdo dos nós de texto) tenha
// qualquer motivo para removê-lo.
const INVISIBLE_BREAK_CHARS_RE = /[­​‌‍⁠﻿]/g;

// Helper para normalizar strings de texto puro (título, resumo, autoria)
// removendo quebras invisíveis e convertendo &nbsp; (U+00A0) em espaços normais.
function cleanPlainText(str) {
  return String(str || '')
    .replace(INVISIBLE_BREAK_CHARS_RE, '')
    .replace(/\u00A0/g, ' ')
    .trim();
}

// Percorre todos os nós de texto já inseridos no DOM (depois da
// sanitização) e:
// 1. Remove caracteres invisíveis de quebra espúria (soft hyphen, ZWSP, etc.)
// 2. Normaliza espaços rígidos (&nbsp; / U+00A0) em espaços regulares (U+0020),
//    exceto dentro de tags pre/code. O editor Quill serializa espaços como
//    &nbsp;, fazendo com que parágrafos inteiros se tornem um único token
//    inquebrável para o motor de layout do navegador, estourando o container
//    e sobrepondo a sidebar.
function stripInvisibleBreakCharacters(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let node = walker.nextNode();
  while (node) {
    nodes.push(node);
    node = walker.nextNode();
  }
  nodes.forEach((textNode) => {
    const parent = textNode.parentElement;
    const isCode = parent && Boolean(parent.closest('pre, code, kbd, samp'));
    let val = textNode.nodeValue;
    if (INVISIBLE_BREAK_CHARS_RE.test(val)) {
      val = val.replace(INVISIBLE_BREAK_CHARS_RE, '');
    }
    if (!isCode && val.includes('\u00A0')) {
      val = val.replace(/\u00A0/g, ' ');
    }
    textNode.nodeValue = val;
  });
}

// Sanitiza o HTML do artigo (produzido pelo editor Quill) e o insere no
// container — único ponto desta página que usa innerHTML com conteúdo
// vindo do banco, e só depois de passar pela lista branca acima.
function renderContentSafely(container, content) {
  container.innerHTML = '';
  const raw = String(content || '').trim();
  if (!raw || !window.DOMPurify) return;

  registerHardenLinksHookOnce();
  container.innerHTML = window.DOMPurify.sanitize(raw, CONTENT_PURIFY_CONFIG);
  stripInvisibleBreakCharacters(container);
}

// Identificação de autoria/revisão — exibida logo abaixo do título e dos
// metadados. Usa sempre os valores já gravados em author_name/reviewer_name
// no momento da publicação; nunca o perfil administrativo atualmente
// conectado (quem está lendo o artigo publicado não tem nenhuma relação
// com o editor, e esta página nem tem acesso a essa informação).
function renderAttribution(article) {
  const wrap = document.getElementById('artigo-attribution');
  const authorEl = document.getElementById('artigo-attribution-author');
  const reviewerItem = document.getElementById('artigo-attribution-reviewer-item');
  const reviewerEl = document.getElementById('artigo-attribution-reviewer');
  if (!wrap) return;

  if (article.article_type === 'guest' && article.author_name) {
    if (authorEl) authorEl.textContent = cleanPlainText(article.author_name);

    // Nunca inventa um nome de revisor: se reviewer_name não foi
    // persistido, a linha inteira "Revisado e aprovado por" some, em vez
    // de mostrar um traço ou qualquer valor de preenchimento.
    if (article.reviewer_name) {
      if (reviewerEl) reviewerEl.textContent = cleanPlainText(article.reviewer_name);
      if (reviewerItem) reviewerItem.hidden = false;
    } else if (reviewerItem) {
      reviewerItem.hidden = true;
    }

    wrap.hidden = false;
  } else {
    wrap.hidden = true;
  }
}

// Iniciais a partir de um nome real (ex.: "Andrey Roque" → "AR") — nunca
// uma foto fictícia. Usa só a primeira e a última palavra do nome.
function getInitials(name) {
  const parts = cleanPlainText(name).split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// Card "Sobre o autor" — nome real + iniciais, sem cargos ou biografias
// inventadas. Em artigo de visitante, identifica também o revisor, só
// quando reviewer_name estiver de fato persistido.
function renderAuthorCard(article) {
  const card = document.getElementById('artigo-author-card');
  const initialsEl = document.getElementById('artigo-author-initials');
  const nameEl = document.getElementById('artigo-author-name');
  const roleEl = document.getElementById('artigo-author-role');
  const reviewerRow = document.getElementById('artigo-author-reviewer-row');
  const reviewerInitialsEl = document.getElementById('artigo-author-reviewer-initials');
  const reviewerNameEl = document.getElementById('artigo-author-reviewer-name');
  if (!card) return;

  if (!article.author_name) {
    card.hidden = true;
    return;
  }

  const isGuestArticle = article.article_type === 'guest';

  if (initialsEl) initialsEl.textContent = getInitials(article.author_name);
  if (nameEl) nameEl.textContent = cleanPlainText(article.author_name);
  if (roleEl) roleEl.textContent = isGuestArticle ? 'Autor convidado' : 'Autor';

  if (isGuestArticle && article.reviewer_name) {
    if (reviewerInitialsEl) reviewerInitialsEl.textContent = getInitials(article.reviewer_name);
    if (reviewerNameEl) reviewerNameEl.textContent = cleanPlainText(article.reviewer_name);
    if (reviewerRow) reviewerRow.hidden = false;
  } else if (reviewerRow) {
    reviewerRow.hidden = true;
  }

  card.hidden = false;
}

// Monta a mensagem personalizada para o WhatsApp preservando emojis,
// formatação em negrito e quebras de linha.
function buildWhatsAppMessage(title, url) {
  return `📰 Olha só esse artigo do Blog da Decolar Consórcios!\n\n*${title}*\n\nConfira a matéria completa! 👇\n\n${url}`;
}

// Estado da URL dinâmica atual e controle de event listener do botão de cópia
let currentShareUrl = '';
let copyBtnWired = false;

// Configura os botões da seção "Compartilhe este artigo":
// 1. WhatsApp: mensagem personalizada com título e link dinâmico via API oficial
// 2. LinkedIn: link nativo com URL pública dinâmica
// 3. Copiar Link: cópia exclusiva da URL do artigo com Clipboard API + fallback
function setupShareCard(cleanTitle, shareUrl) {
  currentShareUrl = shareUrl;

  const whatsappLink = document.getElementById('artigo-share-whatsapp');
  const linkedinLink = document.getElementById('artigo-share-linkedin');
  const copyBtn = document.getElementById('artigo-share-copy');
  const feedbackEl = document.getElementById('artigo-share-feedback');

  if (whatsappLink) {
    const message = buildWhatsAppMessage(cleanTitle, shareUrl);
    whatsappLink.href = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
  }

  if (linkedinLink) {
    linkedinLink.href = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
  }

  if (copyBtn && !copyBtnWired) {
    copyBtnWired = true;

    copyBtn.addEventListener('click', async () => {
      const urlToCopy = currentShareUrl;
      let success = false;

      // 1. Tenta Clipboard API moderna
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(urlToCopy);
          success = true;
        } catch (err) {
          success = false;
        }
      }

      // 2. Fallback via elemento textarea invisível e execCommand
      if (!success) {
        try {
          const textarea = document.createElement('textarea');
          textarea.value = urlToCopy;
          textarea.setAttribute('readonly', '');
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          textarea.style.top = '-9999px';
          document.body.appendChild(textarea);
          textarea.focus();
          textarea.select();
          success = document.execCommand('copy');
          document.body.removeChild(textarea);
        } catch (fallbackErr) {
          success = false;
        }
      }

      // 3. Feedback visual discreto
      if (feedbackEl) {
        if (success) {
          feedbackEl.textContent = 'Link copiado!';
        } else {
          feedbackEl.textContent = 'Não foi possível copiar. Copie o link na barra de endereço.';
        }
        window.clearTimeout(copyBtn._feedbackTimeout);
        copyBtn._feedbackTimeout = window.setTimeout(() => {
          feedbackEl.textContent = '';
        }, 3000);
      }
    });
  }
}

// "Fonte: {source_name}" — discreto, ao final do conteúdo. Nunca vira
// link (texto puro via textContent); some por completo quando ausente.
function renderSource(article) {
  const el = document.getElementById('artigo-source');
  if (!el) return;

  if (article.source_name) {
    el.textContent = `Fonte: ${cleanPlainText(article.source_name)}`;
    el.hidden = false;
  } else {
    el.hidden = true;
  }
}

// ==============================================================================
// TELEMETRIA PROFISSIONAL DE LEITURA ATIVA — DECOLAR CONSÓRCIOS (ETAPA 3)
// ==============================================================================
// Comunica-se com a Edge Function 'track-article-engagement' para medição segura.
// Respeita consentimento estrito, Page Visibility API, inatividade e autenticação.
// ==============================================================================

const TELEMETRY_ENDPOINT = 'https://mwrjurjievntdjsakebg.supabase.co/functions/v1/track-article-engagement';

const IS_DEV_ENV = Boolean(
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname === '0.0.0.0' ||
  window.location.protocol === 'file:'
);

function logTelemetryDev(label, data) {
  if (IS_DEV_ENV) {
    if (data !== undefined) {
      console.info(`[Telemetria Decolar] ${label}`, data);
    } else {
      console.info(`[Telemetria Decolar] ${label}`);
    }
  }
}

// Recupera token JWT do administrador se houver sessão logada no painel,
// permitindo ao servidor identificar e excluir visitas da equipe sem expor o token.
function getAdminAuthToken() {
  try {
    const raw = window.localStorage.getItem('decolar-admin-auth');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.access_token || parsed?.currentSession?.access_token || null;
  } catch (_) {
    return null;
  }
}

function hasAcceptedConsent() {
  try {
    return window.localStorage.getItem('decolarCookieConsent') === 'accepted';
  } catch (_) {
    return false;
  }
}

class ArticleEngagementTracker {
  constructor(articleId) {
    this.articleId = articleId;
    this.sessionId = this.getOrCreateSessionId();
    this.bufferedSeconds = 0;
    this.isQualified = false;
    this.isRunning = false;
    this.isDispatching = false;
    this.timerId = null;
    this.lastPulseDispatchedAt = 0;
    this.lastUserInteractionAt = Date.now();
    this.inactivityTimeoutMs = 45000; // 45 segundos sem interação pausa o cronômetro
    this.hasSentInitialPulse = false;

    this.onUserActivity = this.onUserActivity.bind(this);
    this.onVisibilityChange = this.onVisibilityChange.bind(this);
    this.onPageUnload = this.onPageUnload.bind(this);
    this.tick = this.tick.bind(this);
  }

  getOrCreateSessionId() {
    const key = `decolar_sess_${this.articleId}`;
    const metaKey = `${key}_meta`;
    try {
      const existingId = window.sessionStorage.getItem(key);
      const rawMeta = window.sessionStorage.getItem(metaKey);
      const meta = rawMeta ? JSON.parse(rawMeta) : null;
      const now = Date.now();

      // Se a sessão existir e a última atividade foi há menos de 30 minutos, reaproveita
      if (existingId && meta && meta.lastActiveAt && (now - meta.lastActiveAt) < 1800000) {
        window.sessionStorage.setItem(metaKey, JSON.stringify({ lastActiveAt: now }));
        return existingId;
      }

      // Caso contrário, gera novo session_id seguro de 32 caracteres
      const newId = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID().replace(/-/g, '')
        : ('sess_' + now.toString(36) + Math.random().toString(36).slice(2, 12));

      window.sessionStorage.setItem(key, newId);
      window.sessionStorage.setItem(metaKey, JSON.stringify({ lastActiveAt: now }));
      return newId;
    } catch (_) {
      return 'sess_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
    }
  }

  updateSessionActivity() {
    try {
      const metaKey = `decolar_sess_${this.articleId}_meta`;
      window.sessionStorage.setItem(metaKey, JSON.stringify({ lastActiveAt: Date.now() }));
    } catch (_) {}
  }

  resetSession() {
    try {
      window.sessionStorage.removeItem(`decolar_sess_${this.articleId}`);
      window.sessionStorage.removeItem(`decolar_sess_${this.articleId}_meta`);
    } catch (_) {}
    this.sessionId = this.getOrCreateSessionId();
    this.bufferedSeconds = 0;
    this.isQualified = false;
    this.hasSentInitialPulse = false;
    logTelemetryDev('Sessão reiniciada com novo identificador.', { sessionId: this.sessionId });
  }

  onUserActivity() {
    this.lastUserInteractionAt = Date.now();
    this.updateSessionActivity();
  }

  onVisibilityChange() {
    if (document.hidden) {
      logTelemetryDev('Aba em segundo plano: cronômetro pausado.');
    } else {
      this.lastUserInteractionAt = Date.now();
      logTelemetryDev('Aba retornou ao primeiro plano: cronômetro reativado.');
    }
  }

  start() {
    if (this.isRunning) return;

    if (!hasAcceptedConsent()) {
      logTelemetryDev('Telemetria aguardando consentimento de cookies.');
      return;
    }

    this.isRunning = true;
    this.lastUserInteractionAt = Date.now();
    logTelemetryDev('Iniciando rastreador de leitura ativa.', { articleId: this.articleId, sessionId: this.sessionId });

    // Registra listeners de atividade humana
    window.addEventListener('mousemove', this.onUserActivity, { passive: true });
    window.addEventListener('scroll', this.onUserActivity, { passive: true });
    window.addEventListener('keydown', this.onUserActivity, { passive: true });
    window.addEventListener('touchstart', this.onUserActivity, { passive: true });
    window.addEventListener('click', this.onUserActivity, { passive: true });

    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('pagehide', this.onPageUnload);
    window.addEventListener('beforeunload', this.onPageUnload);

    // Envia pulso inicial (pulse_seconds: 0) para registrar a sessão no servidor
    if (!this.hasSentInitialPulse) {
      this.dispatchPulse(0);
    }

    // Inicia loop de acumulação de 1 segundo
    this.timerId = window.setInterval(this.tick, 1000);
  }

  stop() {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.timerId) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }

    window.removeEventListener('mousemove', this.onUserActivity);
    window.removeEventListener('scroll', this.onUserActivity);
    window.removeEventListener('keydown', this.onUserActivity);
    window.removeEventListener('touchstart', this.onUserActivity);
    window.removeEventListener('click', this.onUserActivity);

    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('pagehide', this.onPageUnload);
    window.removeEventListener('beforeunload', this.onPageUnload);

    logTelemetryDev('Rastreador de leitura ativa encerrado.');
  }

  tick() {
    // 1. Verifica se o consentimento permanece concedido
    if (!hasAcceptedConsent()) {
      logTelemetryDev('Consentimento revogado ou ausente. Interrompendo coleta.');
      this.stop();
      return;
    }

    // 2. Verifica se a aba está visível
    if (document.hidden) {
      return; // Pausado enquanto a aba estiver oculta
    }

    // 3. Verifica se o usuário interagiu recentemente (inactivity check)
    const isUserActive = (Date.now() - this.lastUserInteractionAt) < this.inactivityTimeoutMs;
    if (!isUserActive) {
      return; // Pausado por inatividade do leitor (> 45s)
    }

    // Leitor comprovadamente ativo e com a aba visível: incrementa 1 segundo
    this.bufferedSeconds++;
    this.updateSessionActivity();

    const now = Date.now();
    const elapsedSinceLastPulse = (now - this.lastPulseDispatchedAt);

    // Condição de envio de pulso:
    // A) Primeiro pulso de qualificação: aos 5 segundos ativos (com intervalo mínimo de 4s desde o início)
    // B) Pulsos subsequentes: a cada 15 segundos ativos (respeitando intervalo mínimo de 12s no relógio real)
    const shouldQualify = (!this.isQualified && this.bufferedSeconds >= 5 && elapsedSinceLastPulse >= 4000);
    const shouldSendPeriodic = (this.isQualified && this.bufferedSeconds >= 15 && elapsedSinceLastPulse >= 12000);

    if (shouldQualify || shouldSendPeriodic) {
      this.dispatchPulse(this.bufferedSeconds);
    }
  }

  async dispatchPulse(pulseSeconds) {
    if (this.isDispatching) return;
    this.isDispatching = true;

    const secondsToSend = Math.min(Math.max(pulseSeconds, 0), 20);
    const payload = {
      article_id: this.articleId,
      session_id: this.sessionId,
      pulse_seconds: secondsToSend,
      consent: 'accepted',
    };

    const headers = {
      'Content-Type': 'application/json',
    };

    const adminToken = getAdminAuthToken();
    if (adminToken) {
      headers['Authorization'] = 'Bearer ' + adminToken;
    }

    try {
      this.lastPulseDispatchedAt = Date.now();
      logTelemetryDev('Despachando pulso...', {
        pulse_seconds: secondsToSend,
        buffered_before: this.bufferedSeconds,
        is_initial: (secondsToSend === 0),
        has_admin_token: Boolean(adminToken),
      });

      const response = await fetch(TELEMETRY_ENDPOINT, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const result = await response.json();
        logTelemetryDev('Resposta da Edge Function:', result);

        // Se o servidor avisar que a sessão expirou por inatividade (> 30 min no banco)
        if (result.status === 'expired') {
          this.resetSession();
          this.dispatchPulse(0);
          return;
        }

        if (result.status === 'ignored') {
          logTelemetryDev('Acesso ignorado pelo servidor (membro da equipe ou bot).');
        }

        if (result.is_qualified || result.qualified) {
          this.isQualified = true;
        }

        if (secondsToSend === 0) {
          this.hasSentInitialPulse = true;
        }

        // Subtrai os segundos aceitos do buffer local
        const accepted = typeof result.accepted_seconds === 'number' ? result.accepted_seconds : secondsToSend;
        this.bufferedSeconds = Math.max(0, this.bufferedSeconds - accepted);
      } else if (response.status === 429) {
        logTelemetryDev('Pulso temporariamente limitado pelo servidor (429).');
      } else {
        logTelemetryDev('Servidor retornou status não-OK:', response.status);
      }
    } catch (networkErr) {
      logTelemetryDev('Falha de rede ao enviar pulso (experiência de leitura preservada).', networkErr);
    } finally {
      this.isDispatching = false;
    }
  }

  onPageUnload() {
    if (!this.isRunning || this.bufferedSeconds <= 0 || !hasAcceptedConsent()) return;

    const secondsToSend = Math.min(this.bufferedSeconds, 20);
    const payload = JSON.stringify({
      article_id: this.articleId,
      session_id: this.sessionId,
      pulse_seconds: secondsToSend,
      consent: 'accepted',
    });

    const headers = { 'Content-Type': 'application/json' };
    const adminToken = getAdminAuthToken();
    if (adminToken) {
      headers['Authorization'] = 'Bearer ' + adminToken;
    }

    try {
      if (typeof fetch === 'function') {
        fetch(TELEMETRY_ENDPOINT, {
          method: 'POST',
          headers: headers,
          body: payload,
          keepalive: true,
        }).catch(() => {});
        return;
      }
    } catch (_) {}

    try {
      if (navigator && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon(TELEMETRY_ENDPOINT, blob);
      }
    } catch (_) {}
  }
}

// Instância ativa global para controle de ciclo de vida e eventos de consentimento
let activeArticleTracker = null;

function setupArticleTelemetry(article) {
  if (!article || !article.id) return;

  if (activeArticleTracker) {
    activeArticleTracker.stop();
    activeArticleTracker = null;
  }

  activeArticleTracker = new ArticleEngagementTracker(article.id);

  if (hasAcceptedConsent()) {
    activeArticleTracker.start();
  }

  // Se o visitante aceitar os cookies com a matéria já aberta, inicia sem F5
  window.addEventListener('decolar:consent-change', (e) => {
    const consent = e.detail && e.detail.consent;
    if (consent === 'accepted') {
      if (activeArticleTracker) activeArticleTracker.start();
    } else {
      if (activeArticleTracker) activeArticleTracker.stop();
    }
  });

  // Listener para sincronização caso a escolha mude em outra aba
  window.addEventListener('storage', (e) => {
    if (e.key === 'decolarCookieConsent') {
      if (e.newValue === 'accepted') {
        if (activeArticleTracker) activeArticleTracker.start();
      } else {
        if (activeArticleTracker) activeArticleTracker.stop();
      }
    }
  });
}

// Até 3 artigos relacionados: prioriza a mesma categoria, completa com
// publicados recentes, nunca inclui o artigo atual. Uma única consulta
// alimenta duas apresentações — o Card B compacto na barra lateral e a
// seção "Você também pode se interessar" ao final da página — evitando
// duas buscas idênticas ao Supabase.
async function loadRelatedArticles(client, article) {
  const exploreCard = document.getElementById('artigo-explore-card');
  const exploreList = document.getElementById('artigo-explore-list');
  const section = document.getElementById('artigo-related-section');
  const grid = document.getElementById('artigo-related-grid');

  try {
    const nowIso = new Date().toISOString();
    const { data, error } = await client
      .from('blog_articles')
      .select('id,title,slug,category,cover_image_path')
      .eq('status', 'published')
      .lte('published_at', nowIso)
      .neq('id', article.id)
      .order('published_at', { ascending: false })
      .limit(12);

    if (error) throw error;

    const candidates = Array.isArray(data) ? data : [];
    const sameCategory = candidates.filter((a) => a.category === article.category);
    const others = candidates.filter((a) => a.category !== article.category);
    const related = sameCategory.concat(others).slice(0, 3);

    if (!related.length) {
      if (exploreCard) exploreCard.hidden = true;
      if (section) section.hidden = true;
      return;
    }

    if (exploreCard && exploreList) {
      exploreList.innerHTML = '';
      related.forEach((item) => exploreList.appendChild(buildExploreItem(item)));
      exploreCard.hidden = false;
    }

    if (section && grid) {
      grid.innerHTML = '';
      related.forEach((item) => grid.appendChild(buildRelatedCard(item)));
      section.hidden = false;
    }
  } catch (err) {
    // Recomendações são um complemento, não o conteúdo principal — se a
    // consulta falhar, os dois blocos simplesmente somem, sem exibir um
    // estado de erro adicional sobre o artigo que já carregou com sucesso.
    console.error('Blog Decolar: falha ao carregar artigos relacionados.', err);
    if (exploreCard) exploreCard.hidden = true;
    if (section) section.hidden = true;
  }
}

// Card B (barra lateral) — item compacto: miniatura, categoria, título
// truncado em 2 linhas via CSS, tudo dentro de um único link.
function buildExploreItem(item) {
  const link = document.createElement('a');
  link.className = 'artigo-explore-item';
  link.href = articleUrl(item.slug);

  if (isSafeImagePath(item.cover_image_path)) {
    const thumb = document.createElement('img');
    thumb.className = 'artigo-explore-thumb';
    thumb.src = item.cover_image_path;
    thumb.alt = '';
    thumb.loading = 'lazy';
    link.appendChild(thumb);
  }

  const body = document.createElement('div');
  body.className = 'artigo-explore-item-body';

  const category = document.createElement('span');
  category.className = 'artigo-explore-category';
  category.textContent = CATEGORY_LABELS[item.category] || 'Decolar';
  body.appendChild(category);

  const title = document.createElement('span');
  title.className = 'artigo-explore-item-title';
  title.textContent = item.title || 'Sem título';
  body.appendChild(title);

  link.appendChild(body);
  return link;
}

// Seção final "Você também pode se interessar" — cartão completo,
// reaproveitando .blog-card/.blog-card-media/.blog-card-cat-badge/
// .blog-card-body/.blog-card-title já definidos em css/blog.css.
function buildRelatedCard(item) {
  const card = document.createElement('article');
  card.className = 'blog-card artigo-related-card';

  const media = document.createElement('a');
  media.className = 'blog-card-media';
  media.href = articleUrl(item.slug);

  if (isSafeImagePath(item.cover_image_path)) {
    const img = document.createElement('img');
    img.className = 'blog-cover-photo';
    img.src = item.cover_image_path;
    img.alt = item.title || '';
    img.loading = 'lazy';
    media.appendChild(img);
  }

  const badge = document.createElement('span');
  badge.className = 'blog-card-cat-badge';
  badge.textContent = CATEGORY_LABELS[item.category] || 'Decolar';
  media.appendChild(badge);

  const body = document.createElement('div');
  body.className = 'blog-card-body';

  const title = document.createElement('h3');
  title.className = 'blog-card-title';
  const titleLink = document.createElement('a');
  titleLink.href = articleUrl(item.slug);
  titleLink.textContent = item.title || 'Sem título';
  title.appendChild(titleLink);
  body.appendChild(title);

  card.appendChild(media);
  card.appendChild(body);
  return card;
}

function articleUrl(slug) {
  if (!isValidSlug(slug)) return '#';
  const isHtml = window.location.pathname.endsWith('.html');
  const base = isHtml ? 'artigo.html' : '/artigo/';
  return `${base}?slug=${encodeURIComponent(slug)}`;
}

function setMeta(id, value) {
  const el = document.getElementById(id);
  if (el) el.setAttribute('content', value);
}

function setHref(id, value) {
  const el = document.getElementById(id);
  if (el) el.setAttribute('href', value);
}

function showLoading(isLoading) {
  const el = document.getElementById('artigo-loading-state');
  if (el) el.hidden = !isLoading;
}

function showUnavailable({ title, text, showRetry }) {
  const section = document.getElementById('artigo-unavailable-state');
  const titleEl = document.getElementById('artigo-unavailable-title');
  const textEl = document.getElementById('artigo-unavailable-text');
  const retryBtn = document.getElementById('artigo-retry');
  const content = document.getElementById('artigo-content');

  if (content) content.hidden = true;
  if (titleEl) titleEl.textContent = title;
  if (textEl) textEl.textContent = text;
  if (retryBtn) retryBtn.hidden = !showRetry;
  if (section) section.hidden = false;
}

function renderArticle(article) {
  const categoryEl = document.getElementById('artigo-category');
  const titleEl = document.getElementById('artigo-title');
  const excerptEl = document.getElementById('artigo-excerpt');
  const metaEl = document.getElementById('artigo-meta');
  const coverWrap = document.getElementById('artigo-cover-wrap');
  const coverImg = document.getElementById('artigo-cover-img');
  const bodyEl = document.getElementById('artigo-body');
  const content = document.getElementById('artigo-content');

  const categoryLabel = CATEGORY_LABELS[article.category] || 'Decolar';
  const cleanTitle = cleanPlainText(article.title);
  const cleanExcerpt = cleanPlainText(article.excerpt);

  if (categoryEl) categoryEl.textContent = categoryLabel;
  if (titleEl) titleEl.textContent = cleanTitle;

  if (excerptEl) {
    if (cleanExcerpt) {
      excerptEl.textContent = cleanExcerpt;
      excerptEl.hidden = false;
    } else {
      excerptEl.hidden = true;
    }
  }

  // O conteúdo precisa estar no DOM antes de montar o índice.
  if (bodyEl) renderContentSafely(bodyEl, article.content);
  const plainText = bodyEl ? bodyEl.textContent : '';
  const readingTime = estimateReadingTime(article.content || plainText);

  const isGuestArticle = article.article_type === 'guest';

  if (metaEl) {
    metaEl.innerHTML = '';
    // Artigo de visitante: a autoria/revisão completas aparecem no bloco
    // dedicado abaixo (renderAttribution) — aqui mostra só data e tempo de
    // leitura, para não repetir o nome do autor duas vezes. Artigo da
    // equipe: "Escrito por {autor}" direto aqui, sem bloco adicional.
    if (!isGuestArticle && article.author_name) {
      const author = document.createElement('span');
      author.className = 'artigo-meta-item';
      author.textContent = `Escrito por ${cleanPlainText(article.author_name)}`;
      metaEl.appendChild(author);
    }
    const dateText = formatDate(article.published_at);
    if (dateText) {
      const date = document.createElement('span');
      date.className = 'artigo-meta-item';
      date.textContent = dateText;
      metaEl.appendChild(date);
    }
    if (readingTime) {
      const time = document.createElement('span');
      time.className = 'artigo-meta-item';
      time.textContent = `${readingTime} min de leitura`;
      metaEl.appendChild(time);
    }
  }

  renderAttribution(article);

  if (coverWrap && coverImg) {
    if (isSafeImagePath(article.cover_image_path)) {
      coverImg.src = article.cover_image_path;
      coverImg.alt = cleanTitle || '';
      coverWrap.hidden = false;
    } else {
      coverWrap.hidden = true;
      coverImg.removeAttribute('src');
    }
  }

  renderSource(article);
  renderAuthorCard(article);

  const shareUrl = getArticleShareUrl(article.slug);

  // Título e descrição da aba
  const pageTitleEl = document.getElementById('artigo-page-title');
  if (pageTitleEl) pageTitleEl.textContent = `${cleanTitle} | Blog Decolar Consórcios`;
  setMeta('artigo-page-description', cleanExcerpt || `Leia no Blog Decolar Consórcios: ${cleanTitle}`);

  // Metadados canônicos e Open Graph (LinkedIn, WhatsApp, Redes Sociais)
  setHref('artigo-canonical-url', shareUrl);
  setMeta('artigo-og-url', shareUrl);
  setMeta('artigo-og-title', `${cleanTitle} | Blog Decolar Consórcios`);
  setMeta('artigo-og-description', cleanExcerpt || `Leia no Blog Decolar Consórcios: ${cleanTitle}`);

  // Twitter Card: mesmos valores do Open Graph acima, só espelhados nas
  // tags próprias do Twitter/X (quando o JS roda — ver aviso no <head>
  // sobre robôs que não executam JavaScript).
  setMeta('artigo-twitter-title', `${cleanTitle} | Blog Decolar Consórcios`);
  setMeta('artigo-twitter-description', cleanExcerpt || `Leia no Blog Decolar Consórcios: ${cleanTitle}`);

  if (isSafeImagePath(article.cover_image_path)) {
    const isAbsolute = /^https?:\/\//i.test(article.cover_image_path);
    const ogImgUrl = isAbsolute
      ? article.cover_image_path
      : `${SITE_PUBLIC_ORIGIN}/${article.cover_image_path.replace(/^\/+/, '')}`;
    setMeta('artigo-og-image', ogImgUrl);
    setMeta('artigo-twitter-image', ogImgUrl);
  }

  // Configura os botões da seção "Compartilhe este artigo" com mensagem personalizada
  setupShareCard(cleanTitle, shareUrl);

  if (content) content.hidden = false;
}

async function loadArticle() {
  const slug = getSlugFromUrl();

  if (!slug) {
    showLoading(false);
    showUnavailable({
      title: 'Artigo não encontrado.',
      text: 'O link acessado não aponta para um artigo válido.',
      showRetry: false,
    });
    return;
  }

  showLoading(true);

  const client = window.decolarSupabase;

  if (!client) {
    showLoading(false);
    showUnavailable({
      title: 'Não foi possível carregar este artigo agora.',
      text: 'Verifique sua conexão e tente novamente em instantes.',
      showRetry: true,
    });
    return;
  }

  try {
    const nowIso = new Date().toISOString();
    const { data, error } = await client
      .from('blog_articles')
      .select('id,title,slug,excerpt,content,author_name,category,cover_image_path,published_at,status,article_type,reviewer_name,source_name')
      .eq('slug', slug)
      .eq('status', 'published')
      .lte('published_at', nowIso)
      .maybeSingle();

    if (error) throw error;

    showLoading(false);

    if (!data || !data.title) {
      showUnavailable({
        title: 'Este artigo não está disponível.',
        text: 'O conteúdo pode ter sido removido, ainda não foi publicado, ou o link está incorreto.',
        showRetry: false,
      });
      return;
    }

    renderArticle(data);
    setupArticleTelemetry(data);
    loadRelatedArticles(client, data);
  } catch (err) {
    console.error('Blog Decolar: falha ao carregar o artigo do Supabase.', err);
    showLoading(false);
    showUnavailable({
      title: 'Não foi possível carregar este artigo agora.',
      text: 'Verifique sua conexão e tente novamente em instantes.',
      showRetry: true,
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadArticle();

  const retryBtn = document.getElementById('artigo-retry');
  if (retryBtn) {
    retryBtn.addEventListener('click', () => loadArticle());
  }
});
