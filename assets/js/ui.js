/**
 * ui.js — Componenti UI condivisi
 */

function initMenuToggle() {
  const btn = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.nav');
  if (!btn || !nav) return;
  btn.addEventListener('click', () => nav.classList.toggle('open'));
}

// ----- Lista verticale (catalogo) -----
function bookRowHTML(book) {
  const id = String(book.id).padStart(4, '0');
  const annoLabel = book.anno || 's.d.';
  const editore = book.editore || '—';
  const temi = (book.temi || []).slice(0, 3);
  const sezione = book.sezione || 'Non classificato';
  const E = escapeHTML;
  
  const temiHTML = temi.map((t, i) => 
    `<span class="tema-tag t-${(i % 3) + 1}">${E(t)}</span>`
  ).join('');
  
  return `
    <a href="libro.html?id=${book.id}" class="book-row">
      <div class="book-main">
        <div class="book-num">N. ${id}</div>
        <div class="book-info">
          <div class="book-titolo">${E(book.titolo)}</div>
          <div class="book-autore">${E(book.autore || 'Anonimo')}</div>
          <div class="book-meta-line">
            <span class="sezione">${E(sezione)}</span>
            <span class="dot">·</span>
            <span>${annoLabel}</span>
            <span class="dot">·</span>
            <span>${E(editore)}</span>
            ${book.pagine ? `<span class="dot">·</span><span>${book.pagine} pp.</span>` : ''}
          </div>
        </div>
      </div>
      ${temi.length ? `<div class="book-temi">${temiHTML}</div>` : '<div></div>'}
    </a>
  `;
}

// ----- Card libro condivisa (home "Aggiunte recenti", "Suggeriti", ecc.) -----
// Variante ridotta: solo titolo + autore. Stesso stile della card di catalogo.
function bookCardHTML(book) {
  const id = String(book.id).padStart(4, '0');
  const E = escapeHTML;

  return `
    <a href="libro.html?id=${book.id}" class="book-card">
      <div class="bookcard-num">N. ${id}</div>
      <div class="bookcard-titolo">${E(book.titolo)}</div>
      <div class="bookcard-autore">${E(book.autore || 'Anonimo')}</div>
    </a>
  `;
}

function escapeHTML(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderPagination(container, currentPage, totalPages, onClick) {
  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }
  const pages = [];
  pages.push(1);
  const start = Math.max(2, currentPage - 2);
  const end = Math.min(totalPages - 1, currentPage + 2);
  if (start > 2) pages.push('...');
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < totalPages - 1) pages.push('...');
  if (totalPages > 1) pages.push(totalPages);
  
  let html = '';
  html += `<button ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}">‹ Prec.</button>`;
  for (const p of pages) {
    if (p === '...') {
      html += `<span class="ellipsis">…</span>`;
    } else {
      html += `<button class="${p === currentPage ? 'active' : ''}" data-page="${p}">${p}</button>`;
    }
  }
  html += `<button ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">Succ. ›</button>`;
  
  container.innerHTML = html;
  container.querySelectorAll('button[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = parseInt(btn.dataset.page, 10);
      if (!isNaN(p) && p >= 1 && p <= totalPages) onClick(p);
    });
  });
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function setActiveNav() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === path || (path === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initMenuToggle();
  setActiveNav();
});

window.LibApp = window.LibApp || {};
Object.assign(window.LibApp, {
  bookRowHTML,
  bookCardHTML,
  escapeHTML,
  renderPagination,
  debounce,
});