/**
 * Decolar Consórcios — blog.js
 * Central de renderização do Blog Decolar, alimentada pela tabela pública
 * `blog_articles` no Supabase (ver js/supabase-client.js):
 * - A leitura só retorna artigos com status = 'published' e
 *   published_at <= now() — essa regra é aplicada pelo RLS no banco, não
 *   apenas pelo filtro feito aqui no JavaScript.
 * - Capas editoriais são geradas em CSS/SVG quando o artigo não tem
 *   imagem de capa.
 * - Filtro por categoria + busca textual sobre os artigos já renderizados.
 * - O blog precisa funcionar corretamente com zero, um ou muitos artigos,
 *   e também diante de falha de conexão com o Supabase.
 *
 * NUNCA inserir texto vindo do banco diretamente em innerHTML sem passar
 * por escapeHtml() — título, resumo, autor e categoria são dados que, no
 * futuro (formulário público, Fase 3C), poderão ser digitados por
 * visitantes.
 */

// Artigos publicados, carregados de forma assíncrona em loadArticles().
// Começa vazio: nunca inventar artigos de exemplo aqui.
let ARTICLES = [];
let filtersWired = false;

// Metadados visuais por categoria: usados para gerar capas editoriais sem imagens externas
const CATEGORY_META = {
  entenda:    { label: 'Entenda o Consórcio',        icon: 'doc' },
  lances:     { label: 'Lances e Contemplação',      icon: 'target' },
  imoveis:    { label: 'Imóveis',                    icon: 'key' },
  veiculos:   { label: 'Veículos',                   icon: 'car' },
  pesados:    { label: 'Pesados',                    icon: 'truck' },
  seguranca:  { label: 'Segurança e Planejamento',   icon: 'shield' },
  mercado:    { label: 'Mercado e Atualidade',       icon: 'chart' },
};

const COVER_ICONS = {
  doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"></path><path d="M14 3v5h5"></path><line x1="9" y1="13" x2="15" y2="13"></line><line x1="9" y1="17" x2="15" y2="17"></line>',
  target: '<circle cx="12" cy="12" r="8"></circle><circle cx="12" cy="12" r="4"></circle><circle cx="12" cy="12" r="0.6" fill="currentColor"></circle>',
  key: '<circle cx="8" cy="15" r="4"></circle><path d="M10.8 12.2 19 4"></path><path d="M15.5 7.5 18 10"></path><path d="M18.5 4.5 21 7"></path>',
  car: '<path d="M4 16V9.5a1 1 0 0 1 .9-1L7 6h10l2.1 2.5a1 1 0 0 1 .9 1V16"></path><path d="M4 16h16v2a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1v-1h-9v1a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"></path><circle cx="7.5" cy="16" r="1.5"></circle><circle cx="16.5" cy="16" r="1.5"></circle>',
  truck: '<rect x="2" y="8" width="12" height="8"></rect><path d="M14 11h4l3 3v2h-7z"></path><circle cx="6.5" cy="18" r="1.5"></circle><circle cx="17.5" cy="18" r="1.5"></circle>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"></path><path d="M9 12l2 2 4-4"></path>',
  chart: '<line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line>',
  compass: '<circle cx="12" cy="12" r="9"></circle><polygon points="14.5 9.5 12.8 12.8 9.5 14.5 11.2 11.2 14.5 9.5"></polygon>',
};

/* --------------------------------------------------------------------------
   Segurança: todo texto que vem do banco passa por aqui antes de entrar em
   um template de innerHTML. Nunca confiar que título/resumo/autor/slug
   estão livres de marcação HTML.
   -------------------------------------------------------------------------- */
function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Slug só pode conter letras minúsculas, números e hífen — qualquer outra
// coisa é rejeitada antes de virar parte de um href.
function isValidSlug(slug) {
  return typeof slug === 'string' && /^[a-z0-9-]+$/.test(slug);
}

function articleUrl(slug) {
  if (!isValidSlug(slug)) return '#';
  const isHtml = window.location.pathname.endsWith('.html');
  const base = isHtml ? 'artigo.html' : '/artigo/';
  return `${base}?slug=${encodeURIComponent(slug)}`;
}

function coverIconMarkup(iconKey) {
  return COVER_ICONS[iconKey] || COVER_ICONS.doc;
}

// Capa gerada em CSS/SVG (fallback usado quando o artigo não tem imagem própria em `image`)
function iconCoverMarkup(category, size) {
  const meta = CATEGORY_META[category] || { label: 'Decolar Consórcios', icon: 'compass' };
  const iconSize = size === 'lg' ? 64 : 44;
  return `
    <div class="blog-cover blog-cover--${escapeHtml(category || 'geral')}" role="img" aria-label="Capa editorial — ${escapeHtml(meta.label)}">
      <svg class="blog-cover-icon" width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${coverIconMarkup(meta.icon)}</svg>
    </div>
  `;
}

// Capa do card/destaque: usa a foto real do artigo (campo `image`) quando existir
// e for um caminho/URL com aparência válida, ou cai na capa editorial em CSS/SVG.
function coverMarkup(article, size) {
  if (article && article.image && /^(https?:\/\/|\/|assets\/)/i.test(article.image)) {
    return `<img src="${escapeHtml(article.image)}" alt="${escapeHtml(article.title || '')}" class="blog-cover-photo" loading="lazy">`;
  }
  const category = article && article.category;
  return iconCoverMarkup(category, size);
}

function formatDate(isoDate) {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
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

function publishedArticles() {
  return ARTICLES;
}

/* --------------------------------------------------------------------------
   Converte uma linha da tabela public.blog_articles (já filtrada pelo RLS
   para status = 'published') no formato usado pelos componentes de
   renderização existentes.
   -------------------------------------------------------------------------- */
function mapArticleRow(row) {
  return {
    id: row.id,
    title: row.title || '',
    slug: row.slug || '',
    url: articleUrl(row.slug),
    category: row.category || '',
    summary: row.excerpt || '',
    image: row.cover_image_path || null,
    authorName: row.author_name || '',
    date: row.published_at || '',
    readingTime: estimateReadingTime(row.content),
    featured: row.featured === true,
  };
}

/* --------------------------------------------------------------------------
   Estados da seção: carregando, erro de conexão, vazio (sem artigos) ou
   preenchido. Só um desses fica visível por vez; os demais componentes
   (busca, categorias, destaque, grade, mercado) seguem a mesma régua.
   -------------------------------------------------------------------------- */
function setBlogLoadingMode(isLoading) {
  const loadingState = document.getElementById('blog-loading-state');
  if (loadingState) loadingState.hidden = !isLoading;
}

function setBlogErrorMode(isError) {
  const errorState = document.getElementById('blog-error-state');
  if (errorState) errorState.hidden = !isError;
}

function setBlogEmptyMode(isEmpty) {
  const emptyEditorial = document.getElementById('blog-empty-editorial');
  const featuredSection = document.getElementById('blog-featured-section');
  const recentSection = document.getElementById('artigos');
  const catBar = document.getElementById('blog-categories-bar');
  const searchContainer = document.getElementById('blog-search-container');
  const searchInput = document.getElementById('blog-search-input');

  if (emptyEditorial) emptyEditorial.hidden = !isEmpty;
  if (featuredSection) featuredSection.hidden = isEmpty;
  if (recentSection) recentSection.hidden = isEmpty;
  if (catBar) catBar.hidden = isEmpty;
  if (searchContainer) searchContainer.hidden = isEmpty;
  if (searchInput) searchInput.disabled = isEmpty;
}

// Esconde todo o conteúdo normal do blog enquanto carrega ou em caso de
// erro, sem apresentar o estado "vazio" como se não houvesse artigos.
function setBlogContentVisible(visible) {
  const featuredSection = document.getElementById('blog-featured-section');
  const recentSection = document.getElementById('artigos');
  const catBar = document.getElementById('blog-categories-bar');
  const searchContainer = document.getElementById('blog-search-container');
  const emptyEditorial = document.getElementById('blog-empty-editorial');

  if (!visible) {
    if (featuredSection) featuredSection.hidden = true;
    if (recentSection) recentSection.hidden = true;
    if (catBar) catBar.hidden = true;
    if (searchContainer) searchContainer.hidden = true;
    if (emptyEditorial) emptyEditorial.hidden = true;
  }
}

/* --------------------------------------------------------------------------
   Renderização — Matéria em Destaque
   -------------------------------------------------------------------------- */
function renderFeatured() {
  const mount = document.getElementById('blog-featured-mount');
  const section = document.getElementById('blog-featured-section');
  if (!mount) return;

  const published = publishedArticles();
  // Usa o artigo marcado como featured; na ausência de um, cai no mais recente
  const featured = published.find(a => a.featured === true) || published[0];

  if (!featured) {
    mount.innerHTML = '';
    if (section) section.hidden = true;
    return;
  }

  if (section) section.hidden = false;

  const meta = CATEGORY_META[featured.category] || { label: 'Decolar' };
  const url = featured.url;
  const readingTimeMarkup = featured.readingTime
    ? `<span class="blog-meta-item blog-meta-time">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        ${featured.readingTime} min de leitura
      </span>`
    : '';

  mount.innerHTML = `
    <article class="blog-featured-card" data-category="${escapeHtml(featured.category)}">
      <a href="${escapeHtml(url)}" class="blog-featured-media" aria-label="Ler matéria em destaque: ${escapeHtml(featured.title)}">
        ${coverMarkup(featured, 'lg')}
        <span class="blog-featured-badge">${escapeHtml(meta.label)}</span>
      </a>
      <div class="blog-featured-content">
        <div class="blog-featured-badges-row">
          <span class="blog-badge-featured">Matéria em Destaque</span>
          <span class="blog-badge-category">${escapeHtml(meta.label)}</span>
        </div>
        <h2 class="blog-featured-title"><a href="${escapeHtml(url)}">${escapeHtml(featured.title)}</a></h2>
        <p class="blog-featured-summary">${escapeHtml(featured.summary)}</p>
        <div class="blog-meta">
          <span class="blog-meta-item blog-meta-date">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            ${escapeHtml(formatDate(featured.date))}
          </span>
          ${readingTimeMarkup}
        </div>
        <a href="${escapeHtml(url)}" class="blog-cta-link">
          <span>Ler matéria completa</span>
          <svg class="blog-cta-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </a>
      </div>
    </article>
  `;
}

/* --------------------------------------------------------------------------
   Estado do Acervo Editorial: Filtros, Ordenação e Paginação
   -------------------------------------------------------------------------- */
let activeCategory = 'all';
let searchQuery = '';
let currentSort = 'recent'; // 'recent' | 'oldest'
let currentPage = 1;
const PAGE_SIZE = 12;

function getFilteredAndSortedArticles() {
  const all = publishedArticles();
  const query = searchQuery.trim().toLowerCase();

  // 1. Filtro por categoria e busca textual
  const filtered = all.filter(article => {
    const matchesCat = (activeCategory === 'all' || article.category === activeCategory);
    if (!matchesCat) return false;
    if (!query) return true;

    const title = (article.title || '').toLowerCase();
    const summary = (article.summary || '').toLowerCase();
    const catLabel = ((CATEGORY_META[article.category] && CATEGORY_META[article.category].label) || '').toLowerCase();
    return title.includes(query) || summary.includes(query) || catLabel.includes(query);
  });

  // 2. Ordenação sobre artigos reais
  filtered.sort((a, b) => {
    const timeA = new Date(a.date).getTime() || 0;
    const timeB = new Date(b.date).getTime() || 0;
    return currentSort === 'oldest' ? timeA - timeB : timeB - timeA;
  });

  return filtered;
}

function updateFeaturedVisibility(filteredCount) {
  const featuredSection = document.getElementById('blog-featured-section');
  if (!featuredSection) return;

  const query = searchQuery.trim().toLowerCase();
  if (activeCategory !== 'all') {
    featuredSection.style.display = 'none';
    return;
  }

  if (query.length > 0) {
    const feat = publishedArticles().find(a => a.featured === true) || publishedArticles()[0];
    if (feat) {
      const title = (feat.title || '').toLowerCase();
      const summary = (feat.summary || '').toLowerCase();
      const catLabel = ((CATEGORY_META[feat.category] && CATEGORY_META[feat.category].label) || '').toLowerCase();
      const matches = title.includes(query) || summary.includes(query) || catLabel.includes(query);
      featuredSection.style.display = matches ? '' : 'none';
    } else {
      featuredSection.style.display = 'none';
    }
  } else {
    featuredSection.style.display = publishedArticles().length > 0 ? '' : 'none';
  }
}

function renderPagination(totalItems) {
  const paginationEl = document.getElementById('blog-pagination');
  if (!paginationEl) return;

  const totalPages = Math.ceil(totalItems / PAGE_SIZE);

  // Requisito 7: Não mostrar números de páginas fictícias nem controles desnecessários quando existir apenas uma página.
  if (totalPages <= 1) {
    paginationEl.hidden = true;
    paginationEl.innerHTML = '';
    return;
  }

  paginationEl.hidden = false;
  let html = '';

  // Botão Anterior
  html += `<button type="button" class="blog-page-nav-btn" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled aria-disabled="true"' : ''}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"></polyline></svg>
    <span>Anterior</span>
  </button>`;

  // Números de página
  html += '<div class="blog-page-numbers">';
  for (let i = 1; i <= totalPages; i++) {
    const isActive = i === currentPage;
    html += `<button type="button" class="blog-page-num-btn ${isActive ? 'is-active' : ''}" data-page="${i}" ${isActive ? 'aria-current="page"' : ''}>${i}</button>`;
  }
  html += '</div>';

  // Botão Próxima
  html += `<button type="button" class="blog-page-nav-btn" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled aria-disabled="true"' : ''}>
    <span>Próxima</span>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg>
  </button>`;

  paginationEl.innerHTML = html;

  paginationEl.querySelectorAll('button[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetPage = parseInt(btn.getAttribute('data-page'), 10);
      if (!isNaN(targetPage) && targetPage >= 1 && targetPage <= totalPages && targetPage !== currentPage) {
        currentPage = targetPage;
        applyFiltersAndRender(false);
        const section = document.getElementById('artigos');
        if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

function applyFiltersAndRender(resetPage = true) {
  if (resetPage) currentPage = 1;

  const grid = document.getElementById('blog-posts-grid');
  const emptyState = document.getElementById('blog-empty-state');
  const marketSection = document.getElementById('mercado');
  const allFiltered = getFilteredAndSortedArticles();

  // Requisitos 5 e 7:
  // - Se houver apenas 1 artigo publicado total: exibe no destaque e na grade.
  // - Se houver mais de 1 artigo e estiver na visão padrão ("all" sem busca): não duplica o destaque na grade.
  // - Em buscas ou filtros por categoria: exibe todos os correspondentes na grade.
  let forGrid = allFiltered;
  const isDefaultView = activeCategory === 'all' && !searchQuery.trim();
  const allPublished = publishedArticles();

  if (isDefaultView && allPublished.length > 1) {
    const featured = allPublished.find(a => a.featured === true) || allPublished[0];
    if (featured) {
      forGrid = allFiltered.filter(a => a.id !== featured.id);
    }
  }

  updateFeaturedVisibility(allFiltered.length);

  // Seção Mercado em Movimento
  const isFiltering = searchQuery.trim().length > 0 || activeCategory !== 'all';
  if (marketSection && marketSection.dataset.hasArticles === 'true') {
    marketSection.style.display = isFiltering ? 'none' : '';
  }

  // Estado Vazio de busca/filtro
  if (emptyState) {
    const featuredSection = document.getElementById('blog-featured-section');
    const featuredHidden = !featuredSection || featuredSection.style.display === 'none';
    const showEmpty = isFiltering && forGrid.length === 0 && featuredHidden;
    emptyState.classList.toggle('is-visible', showEmpty);
  }

  // Paginação
  const totalGridItems = forGrid.length;
  const totalPages = Math.ceil(totalGridItems / PAGE_SIZE) || 1;
  if (currentPage > totalPages) currentPage = totalPages;

  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pageItems = forGrid.slice(startIndex, startIndex + PAGE_SIZE);

  if (grid) {
    if (pageItems.length === 0) {
      grid.innerHTML = '';
    } else {
      grid.innerHTML = pageItems.map(article => {
        const meta = CATEGORY_META[article.category] || { label: 'Decolar' };
        const readingTimeMarkup = article.readingTime
          ? `<span class="blog-card-status">${article.readingTime} min</span>`
          : '';
        return `
          <article class="blog-card" data-category="${escapeHtml(article.category)}">
            <a href="${escapeHtml(article.url)}" class="blog-card-media" aria-label="${escapeHtml(article.title)}">
              ${coverMarkup(article)}
              <span class="blog-card-cat-badge">${escapeHtml(meta.label)}</span>
            </a>
            <div class="blog-card-body">
              <h3 class="blog-card-title"><a href="${escapeHtml(article.url)}">${escapeHtml(article.title)}</a></h3>
              <p class="blog-card-summary">${escapeHtml(article.summary)}</p>
              <div class="blog-card-footer">
                <span>${escapeHtml(formatDate(article.date))}</span>
                ${readingTimeMarkup}
              </div>
            </div>
          </article>
        `;
      }).join('');
    }
  }

  renderPagination(totalGridItems);
}

/* --------------------------------------------------------------------------
   Renderização — Grade de Últimos Artigos (ponto de entrada)
   -------------------------------------------------------------------------- */
function renderRecentGrid() {
  applyFiltersAndRender(true);
}

/* --------------------------------------------------------------------------
   Renderização — Mercado em Movimento (categoria "mercado")
   -------------------------------------------------------------------------- */
function renderMarket() {
  const mount = document.getElementById('blog-market-mount');
  const section = document.getElementById('mercado');
  if (!mount) return;

  const marketArticles = publishedArticles().filter(a => a.category === 'mercado');

  // Sem artigos de mercado: a seção fica oculta (em vez de exibir mais um
  // aviso de "em breve") — reaparece sozinha quando houver conteúdo.
  if (section) section.dataset.hasArticles = marketArticles.length > 0 ? 'true' : 'false';

  if (marketArticles.length === 0) {
    mount.innerHTML = '';
    if (section) section.hidden = true;
    return;
  }

  if (section) section.hidden = false;

  mount.innerHTML = `
    <div class="blog-market-grid">
      ${marketArticles.map(article => `
        <a href="${escapeHtml(article.url)}" class="blog-market-card">
          <div class="blog-market-card-media">${coverMarkup(article)}</div>
          <div class="blog-market-card-body">
            <span class="blog-market-card-tag">${escapeHtml(formatDate(article.date))}</span>
            <h3 class="blog-market-card-title">${escapeHtml(article.title)}</h3>
            <p class="blog-market-card-summary">${escapeHtml(article.summary)}</p>
          </div>
        </a>
      `).join('')}
    </div>
  `;
}

/* --------------------------------------------------------------------------
   Filtro por categoria + busca textual (sobre artigos publicados
   renderizados). Conectado apenas uma vez (filtersWired), mesmo que
   loadArticles() seja chamada novamente via "Tentar novamente".
   -------------------------------------------------------------------------- */
function wireFiltersOnce() {
  if (filtersWired) return;
  filtersWired = true;

  const searchInput = document.getElementById('blog-search-input');
  const clearBtn = document.getElementById('blog-search-clear');
  const searchSubmitBtn = document.getElementById('blog-search-submit');
  const catButtons = document.querySelectorAll('.blog-cat-btn');
  const sortSelect = document.getElementById('blog-sort-select');
  const resetBtn = document.getElementById('blog-empty-reset');

  function scrollToRecent() {
    const recentSection = document.getElementById('artigos');
    if (recentSection) {
      recentSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      if (clearBtn) clearBtn.classList.toggle('is-visible', searchQuery.length > 0);
      applyFiltersAndRender(true);
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        scrollToRecent();
      }
    });
  }

  if (searchSubmitBtn) {
    searchSubmitBtn.addEventListener('click', () => {
      scrollToRecent();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        searchQuery = '';
        searchInput.focus();
      }
      clearBtn.classList.remove('is-visible');
      applyFiltersAndRender(true);
    });
  }

  catButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      catButtons.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      activeCategory = btn.getAttribute('data-category') || 'all';
      applyFiltersAndRender(true);

      const recentSection = document.getElementById('artigos');
      if (recentSection && window.scrollY > recentSection.offsetTop) {
        recentSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value || 'recent';
      applyFiltersAndRender(true);
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      activeCategory = 'all';
      searchQuery = '';
      currentSort = 'recent';
      if (searchInput) searchInput.value = '';
      if (clearBtn) clearBtn.classList.remove('is-visible');
      if (sortSelect) sortSelect.value = 'recent';

      catButtons.forEach(b => {
        b.classList.toggle('is-active', b.getAttribute('data-category') === 'all');
      });

      applyFiltersAndRender(true);
    });
  }

  // Estado inicial dos filtros/seções após a primeira renderização.
  applyFiltersAndRender(true);
}

/* --------------------------------------------------------------------------
   Carregamento dos artigos no Supabase. Executa uma única consulta por
   visita (sem polling/atualização contínua). Trata separadamente: banco
   sem artigos (estado vazio), falha de conexão (estado de erro) e sucesso
   com conteúdo (renderiza normalmente).
   -------------------------------------------------------------------------- */
async function loadArticles() {
  setBlogErrorMode(false);
  setBlogContentVisible(false);
  setBlogLoadingMode(true);

  const client = window.decolarSupabase;

  if (!client) {
    // SDK não carregou ou js/supabase-client.js falhou ao inicializar:
    // trata exatamente como uma falha de conexão, nunca como "sem artigos".
    setBlogLoadingMode(false);
    setBlogErrorMode(true);
    return;
  }

  try {
    const nowIso = new Date().toISOString();
    const { data, error } = await client
      .from('blog_articles')
      .select('id,title,slug,excerpt,content,author_name,category,cover_image_path,featured,published_at')
      .eq('status', 'published')
      .lte('published_at', nowIso)
      .order('published_at', { ascending: false });

    if (error) throw error;

    ARTICLES = (Array.isArray(data) ? data : [])
      .filter(row => row && row.title && isValidSlug(row.slug))
      .map(mapArticleRow);

    setBlogLoadingMode(false);

    const hasArticles = ARTICLES.length > 0;
    setBlogEmptyMode(!hasArticles);

    renderFeatured();
    renderRecentGrid();
    renderMarket();

    if (hasArticles) wireFiltersOnce();
  } catch (err) {
    // Falha real de conexão/consulta: nunca reaproveitar a mensagem de
    // "nenhum artigo publicado ainda" para esconder um erro técnico.
    console.error('Blog Decolar: falha ao carregar artigos do Supabase.', err);
    setBlogLoadingMode(false);
    setBlogErrorMode(true);
  }
}

/* --------------------------------------------------------------------------
   Modelo de Submissão de Artigo (#contribuir)
   Copia estrutura organizada para facilitar o envio por e-mail pelo visitante.
   -------------------------------------------------------------------------- */
const ARTICLE_SUBMISSION_TEMPLATE = `TÍTULO DO ARTIGO:
[Digite aqui o título do seu artigo]

RESUMO:
[Breve resumo em 2 a 3 frases apresentando o tema central]

CATEGORIA SUGERIDA:
[Selecione uma: Entenda o Consórcio / Lances e Contemplação / Imóveis / Veículos / Pesados / Segurança e Planejamento / Mercado e Atualidade]

CONTEÚDO DO ARTIGO:
[Escreva ou cole aqui o texto completo do seu artigo, organizado em tópicos ou parágrafos]

FONTES E REFERÊNCIAS:
[Indique fontes, dados, links e referências utilizadas]

NOME DO AUTOR:
[Seu nome completo e uma breve minibiografia opcional]

E-MAIL PARA CONTATO:
[Seu endereço de e-mail para alinhamento editorial]`;

function wireContributionTemplateCopy() {
  const btn = document.getElementById('btn-copy-template');
  if (!btn) return;

  const originalHtml = btn.innerHTML;
  let resetTimeout = null;

  btn.addEventListener('click', async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(ARTICLE_SUBMISSION_TEMPLATE);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = ARTICLE_SUBMISSION_TEMPLATE;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      btn.classList.add('is-copied');
      btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg> Modelo copiado!`;

      if (resetTimeout) clearTimeout(resetTimeout);
      resetTimeout = setTimeout(() => {
        btn.classList.remove('is-copied');
        btn.innerHTML = originalHtml;
      }, 2500);
    } catch (err) {
      console.error('Blog Decolar: erro ao copiar modelo do artigo.', err);
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadArticles();
  wireContributionTemplateCopy();

  const retryBtn = document.getElementById('blog-error-retry');
  if (retryBtn) {
    retryBtn.addEventListener('click', () => loadArticles());
  }
});
