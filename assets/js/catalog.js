/**
 * catalog.js — Logica della pagina catalogo
 * - Card colorate minimal con solo le info delle facets (sezione, autore, anno, temi)
 * - Infinite scrolling con IntersectionObserver
 */

const BATCH_SIZE = 30;  // libri caricati per ogni "ondata"

const state = {
  books: [],
  fuse: null,
  query: '',
  sezioni: new Set(),
  temi: new Set(),
  autori: new Set(),
  annoMin: null,
  annoMax: null,
  sort: 'titolo',
  filtered: [],
  rendered: 0,  // quanti libri sono già stati renderizzati
};

let observer = null;  // IntersectionObserver per infinite scroll
let sentinel = null;  // elemento da osservare alla fine della lista

// --------- INIETTA STILI specifici del catalogo (solo infinite-scroll) ---------
// NB: gli stili delle card (.book-card) sono condivisi e vivono in style.css.
(function injectCatalogStyles() {
  const css = `
    .catalog-cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 1.5rem;
      list-style: none;
      padding: 0;
      margin: 1.5rem 0 0;
    }
    .scroll-sentinel {
      grid-column: 1 / -1;
      height: 1px;
    }
    .scroll-loading {
      grid-column: 1 / -1;
      text-align: center;
      padding: 2rem;
      font-family: var(--font-display);
      font-style: italic;
      color: var(--gray-500);
      font-size: 1rem;
    }
    .scroll-end {
      grid-column: 1 / -1;
      text-align: center;
      padding: 3rem 2rem 1rem;
      font-family: var(--font-mono);
      font-size: 0.72rem;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--gray-500);
    }
    .scroll-end::before,
    .scroll-end::after {
      content: "—————";
      margin: 0 1rem;
      color: var(--gray-300);
    }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
})();

// --------- INIT ---------

document.addEventListener('DOMContentLoaded', async () => {
  try {
    state.books = await window.LibApp.loadBooks();
    
    state.fuse = new Fuse(state.books, {
      keys: [
        { name: 'titolo', weight: 3 },
        { name: 'autore', weight: 2 },
        { name: 'editore', weight: 1 },
        { name: 'temi', weight: 1.5 },
      ],
      threshold: 0.35,
      ignoreLocation: true,
      minMatchCharLength: 2,
      includeScore: true,
    });
    
    readURLParams();
    buildFilters();
    bindEvents();
    
    // Nasconde la paginazione (non serve più)
    const pag = document.getElementById('pagination');
    if (pag) pag.style.display = 'none';
    
    applyFilters();
  } catch (err) {
    console.error(err);
    document.getElementById('results').innerHTML = 
      '<div class="empty-state"><h3>Errore di caricamento</h3><p>Impossibile caricare il catalogo. Ricarica la pagina.</p></div>';
  }
});

// --------- URL PARAMS ---------

function readURLParams() {
  const params = new URLSearchParams(window.location.search);
  if (params.has('q')) {
    state.query = params.get('q');
    document.getElementById('search').value = state.query;
    // Se arriviamo con una query (es. dalla home), ordiniamo per rilevanza
    // come avviene quando si digita direttamente nel catalogo.
    if (state.query) {
      state.sort = 'relevance';
      const sortEl = document.getElementById('sort');
      if (sortEl) sortEl.value = 'relevance';
    }
  }
  if (params.has('tema')) state.temi.add(params.get('tema'));
  if (params.has('sezione')) state.sezioni.add(params.get('sezione'));
  if (params.has('autore')) state.autori.add(params.get('autore'));
}

function updateURL() {
  const params = new URLSearchParams();
  if (state.query) params.set('q', state.query);
  if (state.temi.size === 1) params.set('tema', [...state.temi][0]);
  if (state.sezioni.size === 1) params.set('sezione', [...state.sezioni][0]);
  if (state.autori.size === 1) params.set('autore', [...state.autori][0]);
  const qs = params.toString();
  const url = window.location.pathname + (qs ? '?' + qs : '');
  window.history.replaceState(null, '', url);
}

// --------- COSTRUZIONE FILTRI ---------

function buildFilters() {
  const stats = window.LibApp.aggregateStats(state.books);
  
  const sezElem = document.getElementById('filter-sezioni');
  const sezOrdered = Object.entries(stats.sezioni).sort((a, b) => b[1] - a[1]);
  sezElem.innerHTML = sezOrdered.map(([s, c]) => `
    <li>
      <label>
        <input type="checkbox" data-filter="sezione" value="${escapeAttr(s)}" 
          ${state.sezioni.has(s) ? 'checked' : ''}>
        <span>${window.LibApp.escapeHTML(s)}</span>
        <span class="count">${c}</span>
      </label>
    </li>
  `).join('');
  
  const temiElem = document.getElementById('filter-temi');
  const temiOrdered = Object.entries(stats.temi).sort((a, b) => b[1] - a[1]);
  temiElem.innerHTML = temiOrdered.map(([t, c]) => `
    <li>
      <label>
        <input type="checkbox" data-filter="tema" value="${escapeAttr(t)}" 
          ${state.temi.has(t) ? 'checked' : ''}>
        <span>${window.LibApp.escapeHTML(t)}</span>
        <span class="count">${c}</span>
      </label>
    </li>
  `).join('');
  
  renderAutori('');
  
  document.getElementById('anno-min').placeholder = String(stats.annoMin);
  document.getElementById('anno-max').placeholder = String(stats.annoMax);
}

function renderAutori(searchTerm) {
  const stats = window.LibApp.aggregateStats(state.books);
  let entries = Object.entries(stats.autori);
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    entries = entries.filter(([a]) => a.toLowerCase().includes(term));
  }
  entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'it'));
  entries = entries.slice(0, 60);
  
  const elem = document.getElementById('filter-autori');
  elem.innerHTML = entries.map(([a, c]) => `
    <li>
      <label>
        <input type="checkbox" data-filter="autore" value="${escapeAttr(a)}" 
          ${state.autori.has(a) ? 'checked' : ''}>
        <span>${window.LibApp.escapeHTML(a)}</span>
        <span class="count">${c}</span>
      </label>
    </li>
  `).join('');
}

function escapeAttr(s) {
  return String(s).replace(/"/g, '&quot;').replace(/&/g, '&amp;');
}

// --------- EVENTI ---------

function bindEvents() {
  const searchInput = document.getElementById('search');
  searchInput.addEventListener('input', window.LibApp.debounce(() => {
    state.query = searchInput.value.trim();
    if (state.query && state.sort === 'titolo') {
      state.sort = 'relevance';
      document.getElementById('sort').value = 'relevance';
    }
    applyFilters();
  }, 200));
  
  document.getElementById('filters').addEventListener('change', (e) => {
    if (e.target.matches('input[type="checkbox"][data-filter]')) {
      const filter = e.target.dataset.filter;
      const value = e.target.value;
      const targetSet = filter === 'sezione' ? state.sezioni :
                        filter === 'tema' ? state.temi :
                        state.autori;
      if (e.target.checked) targetSet.add(value);
      else targetSet.delete(value);
      applyFilters();
    }
  });
  
  const annoMinEl = document.getElementById('anno-min');
  const annoMaxEl = document.getElementById('anno-max');
  const onAnno = window.LibApp.debounce(() => {
    state.annoMin = parseInt(annoMinEl.value, 10) || null;
    state.annoMax = parseInt(annoMaxEl.value, 10) || null;
    applyFilters();
  }, 300);
  annoMinEl.addEventListener('input', onAnno);
  annoMaxEl.addEventListener('input', onAnno);
  
  const autoreSearch = document.getElementById('autore-search');
  autoreSearch.addEventListener('input', window.LibApp.debounce(() => {
    renderAutori(autoreSearch.value.trim());
  }, 200));
  
  document.getElementById('sort').addEventListener('change', (e) => {
    state.sort = e.target.value;
    applyFilters();
  });
  
  document.getElementById('clear-filters').addEventListener('click', () => {
    state.sezioni.clear();
    state.temi.clear();
    state.autori.clear();
    state.annoMin = null;
    state.annoMax = null;
    annoMinEl.value = '';
    annoMaxEl.value = '';
    document.querySelectorAll('#filters input[type="checkbox"]').forEach(c => c.checked = false);
    applyFilters();
  });
}

// --------- APPLICAZIONE FILTRI ---------

function applyFilters() {
  let result;
  if (state.query && state.fuse) {
    const fuseResults = state.fuse.search(state.query);
    result = fuseResults.map(r => ({ ...r.item, _score: r.score }));
  } else {
    result = state.books.map(b => ({ ...b }));
  }
  
  if (state.sezioni.size > 0) {
    result = result.filter(b => state.sezioni.has(b.sezione));
  }
  if (state.temi.size > 0) {
    result = result.filter(b => (b.temi || []).some(t => state.temi.has(t)));
  }
  if (state.autori.size > 0) {
    result = result.filter(b => state.autori.has(b.autore));
  }
  if (state.annoMin !== null) {
    result = result.filter(b => b.anno && b.anno >= state.annoMin);
  }
  if (state.annoMax !== null) {
    result = result.filter(b => b.anno && b.anno <= state.annoMax);
  }
  
  applySort(result);
  state.filtered = result;
  state.rendered = 0;  // reset
  updateURL();
  renderInitial();
}

function applySort(arr) {
  const collator = new Intl.Collator('it', { sensitivity: 'base' });
  switch (state.sort) {
    case 'titolo':
      arr.sort((a, b) => collator.compare(a.titolo, b.titolo)); break;
    case 'titolo-desc':
      arr.sort((a, b) => collator.compare(b.titolo, a.titolo)); break;
    case 'autore':
      arr.sort((a, b) => collator.compare(a.autore || 'zzz', b.autore || 'zzz')); break;
    case 'anno':
      arr.sort((a, b) => (a.anno || 9999) - (b.anno || 9999)); break;
    case 'anno-desc':
      arr.sort((a, b) => (b.anno || 0) - (a.anno || 0)); break;
    case 'relevance':
      if (!state.query) arr.sort((a, b) => collator.compare(a.titolo, b.titolo));
      break;
  }
}

// --------- RENDERING ---------

function catalogCardHTML(book) {
  const E = window.LibApp.escapeHTML;
  const id = String(book.id).padStart(4, '0');
  const annoLabel = book.anno || 's.d.';
  const sezione = book.sezione || 'Non classificato';
  const temi = (book.temi || []);

  const temiHTML = temi.length
    ? `<div class="bookcard-temi">${temi.map(t => `<span class="bookcard-tag">${E(t)}</span>`).join('')}</div>`
    : '';

  // Stessa card condivisa (.book-card) ma con la variante "completa": più metadati.
  return `
    <a href="libro.html?id=${book.id}" class="book-card book-card--full">
      <div class="bookcard-num">N. ${id} · ${E(sezione)}</div>
      <div class="bookcard-titolo">${E(book.titolo)}</div>
      <div class="bookcard-autore">${E(book.autore || 'Anonimo')}</div>
      <div class="bookcard-anno">${annoLabel}</div>
      ${temiHTML}
    </a>
  `;
}

function renderInitial() {
  const total = state.filtered.length;
  
  // Conteggio
  const countEl = document.getElementById('count');
  if (total === 0) {
    countEl.innerHTML = '<em>Nessun risultato</em>';
  } else if (total === 1) {
    countEl.innerHTML = '<strong>1</strong> volume';
  } else {
    countEl.innerHTML = `<strong>${total.toLocaleString('it-IT')}</strong> volumi`;
  }
  
  // Disconnetti observer precedente
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  
  const resultsEl = document.getElementById('results');
  
  if (total === 0) {
    resultsEl.innerHTML = `
      <div class="empty-state">
        <h3>Nessun volume trovato</h3>
        <p>Prova ad allargare la ricerca o ad azzerare i filtri.</p>
      </div>
    `;
    return;
  }
  
  // Crea container e prima ondata
  resultsEl.innerHTML = '<div class="catalog-cards" id="catalog-cards"></div>';
  state.rendered = 0;
  appendBatch();
  setupInfiniteScroll();
}

function appendBatch() {
  const container = document.getElementById('catalog-cards');
  if (!container) return;
  
  // Rimuovi sentinel/loading se presenti
  const oldSentinel = container.querySelector('.scroll-sentinel');
  const oldLoading = container.querySelector('.scroll-loading');
  if (oldSentinel) oldSentinel.remove();
  if (oldLoading) oldLoading.remove();
  
  const start = state.rendered;
  const end = Math.min(start + BATCH_SIZE, state.filtered.length);
  const slice = state.filtered.slice(start, end);
  
  // Append cards
  const html = slice.map(catalogCardHTML).join('');
  container.insertAdjacentHTML('beforeend', html);
  state.rendered = end;
  
  // Aggiungi sentinel o end marker
  if (state.rendered < state.filtered.length) {
    container.insertAdjacentHTML('beforeend', '<div class="scroll-sentinel" id="scroll-sentinel"></div>');
  } else {
    container.insertAdjacentHTML('beforeend', `<div class="scroll-end">Fine catalogo · ${state.filtered.length.toLocaleString('it-IT')} volumi</div>`);
  }
}

function setupInfiniteScroll() {
  const sentinelEl = document.getElementById('scroll-sentinel');
  if (!sentinelEl) return;
  
  observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        // Pre-carica il prossimo batch quando il sentinel entra in vista
        appendBatch();
        observer.disconnect();
        // Re-osserva il nuovo sentinel se esiste
        const newSentinel = document.getElementById('scroll-sentinel');
        if (newSentinel) {
          observer.observe(newSentinel);
        }
      }
    }
  }, {
    rootMargin: '600px',  // pre-carica con 600px di anticipo
  });
  
  observer.observe(sentinelEl);
}