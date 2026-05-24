/**
 * stats.js — Calcolo e rendering delle statistiche
 */

(async function init() {
  try {
    const [books, prestiti] = await Promise.all([
      window.LibApp.loadBooks(),
      window.LibApp.loadPrestiti(),
    ]);
    
    const stats = window.LibApp.aggregateStats(books);
    const E = window.LibApp.escapeHTML;
    
    const totPrestiti = Object.values(prestiti).reduce((s, p) => s + p.totale, 0);
    
    document.getElementById('overview-stats').innerHTML = `
      <div class="stat">
        <span class="stat-num blue">${books.length.toLocaleString('it-IT')}</span>
        <span class="stat-label">Volumi totali</span>
      </div>
      <div class="stat">
        <span class="stat-num ocra">${stats.totalCopie.toLocaleString('it-IT')}</span>
        <span class="stat-label">Copie fisiche</span>
      </div>
      <div class="stat">
        <span class="stat-num rose">${Math.round(stats.totalPagine / 1000).toLocaleString('it-IT')}K</span>
        <span class="stat-label">Pagine catalogate</span>
      </div>
      <div class="stat">
        <span class="stat-num black">${totPrestiti.toLocaleString('it-IT')}</span>
        <span class="stat-label">Prestiti registrati</span>
      </div>
    `;
    
    renderBarChart('chart-sezioni', stats.sezioni, 5);
    renderBarChart('chart-temi', stats.temi, 11);
    renderBarChart('chart-autori', stats.autori, 12);
    renderBarChart('chart-editori', stats.editori, 10);
    
    renderDecadeChart('chart-decadi', stats.decadi);
    
    // Top prestiti
    const titoloCounts = {};
    for (const b of books) {
      titoloCounts[b.titolo] = (titoloCounts[b.titolo] || 0) + 1;
    }
    
    const sortedPrestiti = Object.entries(prestiti)
      .map(([titolo, p]) => {
        const firstBook = books.find(b => b.titolo === titolo);
        return {
          titolo,
          totale: p.totale,
          anni: Object.keys(p.per_anno).length,
          bookId: firstBook ? firstBook.id : null,
          autore: firstBook ? firstBook.autore : '',
          ambiguo: (titoloCounts[titolo] || 0) > 1,
        };
      })
      .sort((a, b) => b.totale - a.totale)
      .slice(0, 20);
    
    document.getElementById('top-prestiti').innerHTML = sortedPrestiti.map((row, i) => {
      let titoloHTML;
      if (row.ambiguo) {
        titoloHTML = `<a href="catalogo.html?q=${encodeURIComponent(row.titolo)}">${E(row.titolo)}</a><span class="edition-badge" title="Più edizioni in catalogo">${titoloCounts[row.titolo]}×</span>`;
      } else if (row.bookId !== null) {
        const autoreSpan = row.autore ? ` <span style="color: var(--gray-500); font-size: 0.85em; font-style: italic;">— ${E(row.autore)}</span>` : '';
        titoloHTML = `<a href="libro.html?id=${row.bookId}">${E(row.titolo)}</a>${autoreSpan}`;
      } else {
        titoloHTML = E(row.titolo);
      }
      return `
        <tr>
          <td class="pos">${i + 1}</td>
          <td class="titolo-cell">${titoloHTML}</td>
          <td class="num">${row.anni}</td>
          <td class="num totale">${row.totale.toLocaleString('it-IT')}</td>
        </tr>
      `;
    }).join('');
    
    // Prestiti per anno
    const prestitiPerAnno = {};
    for (const p of Object.values(prestiti)) {
      for (const [anno, n] of Object.entries(p.per_anno)) {
        prestitiPerAnno[anno] = (prestitiPerAnno[anno] || 0) + n;
      }
    }
    renderDecadeChart('chart-prestiti-anni', prestitiPerAnno);
    
  } catch (err) {
    console.error(err);
    document.querySelector('main').innerHTML += '<p style="color: var(--rose);">Errore nel caricamento dei dati statistici.</p>';
  }
})();

function renderBarChart(elementId, data, limit) {
  const E = window.LibApp.escapeHTML;
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, limit);
  const max = entries[0] ? entries[0][1] : 1;
  
  document.getElementById(elementId).innerHTML = entries.map(([label, value]) => {
    const pct = (value / max) * 100;
    return `
      <li>
        <div class="bar" style="width: ${pct}%;"></div>
        <span class="label">${E(label)}</span>
        <span class="value">${value.toLocaleString('it-IT')}</span>
      </li>
    `;
  }).join('');
}

function renderDecadeChart(elementId, data) {
  const container = document.getElementById(elementId);
  let entries = Object.entries(data).map(([k, v]) => [parseInt(k, 10), v]);
  entries.sort((a, b) => a[0] - b[0]);
  
  const max = Math.max(...entries.map(e => e[1]));
  
  container.innerHTML = entries.map(([k, v]) => {
    const h = Math.max(2, (v / max) * 100);
    const label = (k >= 1800 && k % 10 === 0 && k < 2030) ? `${k}s` : String(k);
    return `
      <div class="decade-bar" style="height: ${h}%;" title="${label}: ${v}">
        <span class="decade-value">${v}</span>
        <span class="decade-label">${label}</span>
      </div>
    `;
  }).join('');
}
