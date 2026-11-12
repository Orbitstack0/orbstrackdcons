/**
 * Decolar Consórcios — admin-chat.js
 * Lógica da interface do Chat da Equipe 2.0 (admin/chat.html).
 *
 * Funcionalidades:
 * - Proteção de acesso administrativo via DecolarAdminGuard.requireAdmin().
 * - Validação síncrona de perfil visual via DecolarAdminProfile.requireProfile().
 * - Reorganização em 4 grupos (Administração, Comunicação Geral, Equipes Comerciais, DMs).
 * - Alternância instantânea de canais via JavaScript local (sem recarregar a página).
 * - Suporte à navegação mobile (alternar entre lista de canais e área de conversa).
 * - Sem envio de mensagens reais, sem chamadas a banco e sem canais Realtime nesta etapa.
 */

document.addEventListener('DOMContentLoaded', () => {
  const loadingState = document.getElementById('admin-loading-state');
  const errorState = document.getElementById('admin-error-state');
  const retryBtn = document.getElementById('admin-retry-btn');
  const shell = document.getElementById('admin-shell');
  const logoutBtn = document.getElementById('admin-logout-btn');
  const switchProfileBtn = document.getElementById('admin-switch-profile-btn');

  // Elementos do Chat
  const chatContainer = document.getElementById('chat-container');
  const mobileBackBtn = document.getElementById('chat-mobile-back-btn');
  const chatActiveIcon = document.getElementById('chat-active-icon');
  const chatActiveName = document.getElementById('chat-active-name');
  const chatActiveSubname = document.getElementById('chat-active-subname');
  const chatActiveTopic = document.getElementById('chat-active-topic');
  const chatActiveBadgeText = document.getElementById('chat-active-badge-text');
  const chatEmptyIcon = document.getElementById('chat-empty-icon');
  const chatEmptyTitle = document.getElementById('chat-empty-title');
  const chatEmptyDesc = document.getElementById('chat-empty-desc');
  const chatCard1Title = document.getElementById('chat-card1-title');
  const chatCard1Desc = document.getElementById('chat-card1-desc');
  const chatCard2Title = document.getElementById('chat-card2-title');
  const chatCard2Desc = document.getElementById('chat-card2-desc');
  const chatCard3Title = document.getElementById('chat-card3-title');
  const chatCard3Desc = document.getElementById('chat-card3-desc');
  const chatInputField = document.getElementById('chat-input-field');
  const chatFooterStatus = document.getElementById('chat-footer-status');

  const guard = window.DecolarAdminGuard;
  const profileApi = window.DecolarAdminProfile;

  // ---------------------------------------------------------------------------
  // 1. Verificação de Acesso Administrativo e Perfil
  // ---------------------------------------------------------------------------
  function showLoading() {
    if (loadingState) loadingState.hidden = false;
    if (errorState) errorState.hidden = true;
    if (shell) shell.hidden = true;
  }

  function showError() {
    if (loadingState) loadingState.hidden = true;
    if (errorState) errorState.hidden = false;
    if (shell) shell.hidden = true;
  }

  function showShell() {
    if (loadingState) loadingState.hidden = true;
    if (errorState) errorState.hidden = true;
    if (shell) shell.hidden = false;
  }

  function runAuthCheck() {
    if (!guard || !profileApi) {
      showError();
      return;
    }

    showLoading();

    guard
      .requireAdmin()
      .then((session) => {
        // requireProfile() é síncrono e redireciona para selecionar-perfil.html
        // caso ainda não haja um perfil ativo nesta sessão de navegação.
        const profile = profileApi.requireProfile();
        if (!profile) return;

        showShell();
      })
      .catch((err) => {
        console.warn('Erro ao verificar acesso administrativo ao Chat da Equipe:', err);
        showError();
      });
  }

  if (retryBtn) {
    retryBtn.addEventListener('click', runAuthCheck);
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      if (guard) guard.logout();
    });
  }

  if (switchProfileBtn) {
    switchProfileBtn.addEventListener('click', () => {
      if (profileApi) {
        profileApi.clearSelectedProfile();
      }
      window.location.replace('selecionar-perfil.html');
    });
  }

  // ---------------------------------------------------------------------------
  // 2. Metadados dos 6 Canais e Mensagens Privadas
  // ---------------------------------------------------------------------------
  const CHANNELS_DATA = {
    diretoria: {
      name: 'diretoria',
      subname: '• Administração Estratégica',
      topic: 'Espaço reservado à administração da Decolar Consórcios.',
      badge: 'Privado (Admins)',
      iconType: 'lock',
      emptyTitle: 'Canal Exclusivo da Diretoria',
      emptyDesc: 'Espaço planejado para decisões estratégicas, assuntos financeiros, governança e comunicados de liderança. O isolamento definitivo será implementado no backend via políticas RLS.',
      card1: { title: 'Participação', desc: 'Exclusivo para os 3 Administradores da Decolar.' },
      card2: { title: 'Sigilo RLS', desc: 'Supervisores não poderão ler nem visualizar este canal.' },
      card3: { title: 'Gestão', desc: 'Pautas de diretoria, metas globais e alinhamentos.' },
      placeholder: 'Canal restrito à diretoria. Envio desabilitado na fase de preparação visual…',
      footerStatus: 'Canal restrito aos administradores'
    },
    geral: {
      name: 'geral',
      subname: '• Grupo Geral Decolar',
      topic: 'Comunicação e alinhamento entre administradores e supervisores.',
      badge: 'Todos os Usuários',
      iconType: 'hash',
      emptyTitle: 'Canal Geral da Equipe',
      emptyDesc: 'Canal oficial para comunicados institucionais, celebração de metas e alinhamento geral entre as lideranças da Decolar Consórcios.',
      card1: { title: 'Participação', desc: '3 Administradores e 2 Supervisores Comerciais.' },
      card2: { title: 'Transmissão', desc: 'Mensagens instantâneas via Supabase Realtime.' },
      card3: { title: 'Permissões RLS', desc: 'Leitura e envio para todos os membros autorizados.' },
      placeholder: 'Envio de mensagens desabilitado na fase de preparação visual…',
      footerStatus: 'Fase visual de planejamento'
    },
    comercial: {
      name: 'comercial',
      subname: '• Central Comercial',
      topic: 'Central de discussões e acompanhamento comercial.',
      badge: 'Equipe Comercial',
      iconType: 'hash',
      emptyTitle: 'Canal de Discussões Comerciais',
      emptyDesc: 'Ambiente planejado para alinhamento sobre captação de leads, andamento de cartas de crédito imobiliárias/automotivas e oportunidades do funil.',
      card1: { title: 'Participação', desc: '3 Administradores e 2 Supervisores Comerciais.' },
      card2: { title: 'Operação', desc: 'Acompanhamento do funil de oportunidades e metas.' },
      card3: { title: 'Integração CRM', desc: 'Futuro compartilhamento interno de leads.' },
      placeholder: 'Discussões comerciais. Envio desabilitado na fase de preparação visual…',
      footerStatus: 'Fase visual de planejamento'
    },
    avisos: {
      name: 'avisos',
      subname: '• Comunicados Oficiais',
      topic: 'Comunicados oficiais da administração.',
      badge: 'Somente Leitura (Supervisores)',
      iconType: 'hash',
      emptyTitle: 'Canal de Avisos Oficiais',
      emptyDesc: 'Canal dedicado a avisos formais da administração. Na fase funcional, administradores terão permissão de publicação e supervisores terão permissão de leitura.',
      card1: { title: 'Publicação', desc: 'Exclusiva para os Administradores.' },
      card2: { title: 'Supervisão', desc: 'Leitura obrigatória e confirmação de recebimento.' },
      card3: { title: 'Arquivo', desc: 'Histórico permanente de diretrizes internas.' },
      placeholder: 'Canal somente leitura para supervisores. Envio desabilitado…',
      footerStatus: 'Canal com publicação restrita'
    },
    'equipe-1': {
      name: 'equipe-1',
      subname: '• Equipe Comercial 1',
      topic: 'Alinhamentos da equipe coordenada pelo Supervisor 1.',
      badge: 'Supervisor 1 & Admins',
      iconType: 'hash',
      emptyTitle: 'Canal da Equipe Comercial 1',
      emptyDesc: 'Canal restrito ao Supervisor 1 e aos administradores para coordenação diária, distribuição de metas e rotinas comerciais da Equipe 1.',
      card1: { title: 'Coordenação', desc: 'Supervisor 1 e Administradores.' },
      card2: { title: 'Isolamento', desc: 'Supervisor 2 não tem acesso às mensagens da Equipe 1.' },
      card3: { title: 'Metas', desc: 'Acompanhamento da cota mensal da Equipe 1.' },
      placeholder: 'Equipe 1. Envio desabilitado na fase de preparação visual…',
      footerStatus: 'Canal restrito à Equipe 1 e Admins'
    },
    'equipe-2': {
      name: 'equipe-2',
      subname: '• Equipe Comercial 2',
      topic: 'Alinhamentos da equipe coordenada pelo Supervisor 2.',
      badge: 'Supervisor 2 & Admins',
      iconType: 'hash',
      emptyTitle: 'Canal da Equipe Comercial 2',
      emptyDesc: 'Canal restrito ao Supervisor 2 e aos administradores para coordenação diária, distribuição de metas e rotinas comerciais da Equipe 2.',
      card1: { title: 'Coordenação', desc: 'Supervisor 2 e Administradores.' },
      card2: { title: 'Isolamento', desc: 'Supervisor 1 não tem acesso às mensagens da Equipe 2.' },
      card3: { title: 'Metas', desc: 'Acompanhamento da cota mensal da Equipe 2.' },
      placeholder: 'Equipe 2. Envio desabilitado na fase de preparação visual…',
      footerStatus: 'Canal restrito à Equipe 2 e Admins'
    },
    privadas: {
      name: 'Mensagens Privadas',
      subname: '• Conversas Individuais (DMs)',
      topic: 'Conversas individuais e confidenciais entre usuários autorizados.',
      badge: 'Privado',
      iconType: 'user',
      emptyTitle: 'Mensagens Privadas (DMs)',
      emptyDesc: 'Estrutura preparada para conversas 1 a 1 entre os 5 usuários autorizados da Decolar Consórcios, com privacidade garantida via RLS.',
      card1: { title: 'Participação', desc: 'Apenas os 2 interlocutores da conversa.' },
      card2: { title: 'Criptografia', desc: 'Mensagens protegidas por políticas RLS no banco.' },
      card3: { title: 'Ativação', desc: 'Disponível após a criação de contas individuais.' },
      placeholder: 'Mensagens privadas desabilitadas na fase de preparação visual…',
      footerStatus: 'Conversas individuais e seguras'
    }
  };

  // ---------------------------------------------------------------------------
  // 3. Alternância Visual dos Canais
  // ---------------------------------------------------------------------------
  const lockSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
  const hashSvg = `#`;
  const userSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>`;

  function selectChannel(channelKey) {
    const data = CHANNELS_DATA[channelKey];
    if (!data) return;

    // Atualiza classe ativa nos itens da barra lateral
    const channelItems = document.querySelectorAll('.admin-chat-channel-item');
    channelItems.forEach((item) => {
      const isMatch = item.getAttribute('data-channel') === channelKey;
      item.classList.toggle('is-active', isMatch);
    });

    // Atualiza cabeçalho da área ativa
    if (chatActiveName) chatActiveName.textContent = data.name;
    if (chatActiveSubname) chatActiveSubname.textContent = data.subname;
    if (chatActiveTopic) chatActiveTopic.textContent = data.topic;
    if (chatActiveBadgeText) chatActiveBadgeText.textContent = data.badge;

    if (chatActiveIcon) {
      if (data.iconType === 'lock') {
        chatActiveIcon.innerHTML = lockSvg;
        chatActiveIcon.style.color = '#f59e0b';
      } else if (data.iconType === 'user') {
        chatActiveIcon.innerHTML = userSvg;
        chatActiveIcon.style.color = '#3b82f6';
      } else {
        chatActiveIcon.innerHTML = hashSvg;
        chatActiveIcon.style.color = 'var(--color-gray-400)';
      }
    }

    // Atualiza conteúdo do card de estado vazio
    if (chatEmptyTitle) chatEmptyTitle.textContent = data.emptyTitle;
    if (chatEmptyDesc) chatEmptyDesc.textContent = data.emptyDesc;

    if (chatEmptyIcon) {
      if (data.iconType === 'lock') {
        chatEmptyIcon.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
        chatEmptyIcon.style.color = '#d97706';
        chatEmptyIcon.style.background = 'rgba(245, 158, 11, 0.1)';
        chatEmptyIcon.style.borderColor = 'rgba(245, 158, 11, 0.25)';
      } else if (data.iconType === 'user') {
        chatEmptyIcon.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
        chatEmptyIcon.style.color = '#2563eb';
        chatEmptyIcon.style.background = 'rgba(59, 130, 246, 0.1)';
        chatEmptyIcon.style.borderColor = 'rgba(59, 130, 246, 0.25)';
      } else {
        chatEmptyIcon.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
        chatEmptyIcon.style.color = 'var(--color-red)';
        chatEmptyIcon.style.background = 'rgba(240, 68, 46, 0.08)';
        chatEmptyIcon.style.borderColor = 'rgba(240, 68, 46, 0.15)';
      }
    }

    // Atualiza os 3 cards de recursos específicos do canal
    if (chatCard1Title) chatCard1Title.textContent = data.card1.title;
    if (chatCard1Desc) chatCard1Desc.textContent = data.card1.desc;
    if (chatCard2Title) chatCard2Title.textContent = data.card2.title;
    if (chatCard2Desc) chatCard2Desc.textContent = data.card2.desc;
    if (chatCard3Title) chatCard3Title.textContent = data.card3.title;
    if (chatCard3Desc) chatCard3Desc.textContent = data.card3.desc;

    // Atualiza placeholder do input e status no rodapé
    if (chatInputField) chatInputField.placeholder = data.placeholder;
    if (chatFooterStatus) chatFooterStatus.textContent = data.footerStatus;

    // Modo mobile: ativa visualização da conversa
    if (chatContainer) {
      chatContainer.classList.add('is-chat-active');
    }
  }

  // Event Listeners nos itens de canais
  const channelItems = document.querySelectorAll('.admin-chat-channel-item');
  channelItems.forEach((item) => {
    item.addEventListener('click', () => {
      const channelKey = item.getAttribute('data-channel');
      if (channelKey) {
        selectChannel(channelKey);
      }
    });

    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const channelKey = item.getAttribute('data-channel');
        if (channelKey) selectChannel(channelKey);
      }
    });
  });

  // Botão mobile para voltar à lista de canais
  if (mobileBackBtn && chatContainer) {
    mobileBackBtn.addEventListener('click', () => {
      chatContainer.classList.remove('is-chat-active');
    });
  }

  // Inicia checagem de autorização
  runAuthCheck();
});
