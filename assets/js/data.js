/**
 * data.js — Caricamento e gestione dati globali
 * Cache in sessionStorage per evitare fetch ripetuti durante la navigazione.
 */

const DATA_PATHS = {
  books: 'data/books.json',
  prestiti: 'data/prestiti.json',
};

// Determina il prefisso path corretto a seconda del livello di pagina
function pathPrefix() {
  // Se siamo in una sottocartella, dovremmo aggiungere "../" — ma qui tutte
  // le pagine sono nella root, quindi nessun prefisso necessario.
  return '';
}

async function fetchJSON(url) {
  const res = await fetch(url, { cache: 'force-cache' });
  if (!res.ok) throw new Error(`Fetch ${url} fallita: ${res.status}`);
  return res.json();
}

let _booksCache = null;
let _prestitiCache = null;

async function loadBooks() {
  if (_booksCache) return _booksCache;
  // Prova sessionStorage
  const stored = sessionStorage.getItem('books_v1');
  if (stored) {
    try {
      _booksCache = JSON.parse(stored);
      return _booksCache;
    } catch (e) { /* cade nel fetch */ }
  }
  _booksCache = await fetchJSON(pathPrefix() + DATA_PATHS.books);
  try {
    sessionStorage.setItem('books_v1', JSON.stringify(_booksCache));
  } catch (e) { /* quota eccessa, non bloccare */ }
  return _booksCache;
}

async function loadPrestiti() {
  if (_prestitiCache) return _prestitiCache;
  const stored = sessionStorage.getItem('prestiti_v1');
  if (stored) {
    try {
      _prestitiCache = JSON.parse(stored);
      return _prestitiCache;
    } catch (e) {}
  }
  _prestitiCache = await fetchJSON(pathPrefix() + DATA_PATHS.prestiti);
  try {
    sessionStorage.setItem('prestiti_v1', JSON.stringify(_prestitiCache));
  } catch (e) {}
  return _prestitiCache;
}

// Helper per trovare un libro per ID
function findBook(books, id) {
  const numId = parseInt(id, 10);
  return books.find(b => b.id === numId);
}

// Stats aggregate (calcolate una volta)
function aggregateStats(books) {
  const stats = {
    total: books.length,
    sezioni: {},
    temi: {},
    autori: {},
    decadi: {},
    editori: {},
    totalCopie: 0,
    totalPagine: 0,
    annoMin: Infinity,
    annoMax: -Infinity,
  };
  for (const b of books) {
    stats.sezioni[b.sezione] = (stats.sezioni[b.sezione] || 0) + 1;
    for (const t of b.temi || []) {
      stats.temi[t] = (stats.temi[t] || 0) + 1;
    }
    if (b.autore) stats.autori[b.autore] = (stats.autori[b.autore] || 0) + 1;
    if (b.editore) stats.editori[b.editore] = (stats.editori[b.editore] || 0) + 1;
    if (b.anno) {
      const dec = Math.floor(b.anno / 10) * 10;
      stats.decadi[dec] = (stats.decadi[dec] || 0) + 1;
      if (b.anno < stats.annoMin) stats.annoMin = b.anno;
      if (b.anno > stats.annoMax) stats.annoMax = b.anno;
    }
    stats.totalCopie += b.copie || 1;
    stats.totalPagine += b.pagine || 0;
  }
  return stats;
}

// Esporta su window per uso non-modulare
window.LibApp = window.LibApp || {};
window.LibApp.loadBooks = loadBooks;
window.LibApp.loadPrestiti = loadPrestiti;
window.LibApp.findBook = findBook;
window.LibApp.aggregateStats = aggregateStats;
