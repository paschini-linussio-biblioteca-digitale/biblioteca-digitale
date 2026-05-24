# Biblioteca Digitale del Liceo

Sito statico per la consultazione del catalogo della biblioteca scolastica. 
Interamente client-side, senza database né backend: pronto per il deploy su **GitHub Pages**.

## Caratteristiche

- **Catalogo navigabile** di oltre 1.250 volumi con ricerca fuzzy (Fuse.js).
- **Filtri combinati** per sezione, tema, autore, intervallo di anni.
- **Lista verticale** in stile editoriale per il catalogo (no card affollate).
- **Schede dettaglio** con storico prestiti e link a OPAC SBN.
- **Statistiche** del catalogo: distribuzione per decennio, autori, editori, temi, prestiti.
- **Stile editoriale moderno**: Fraunces + Inter, palette blu/ocra/rosa-bordeaux/grigio.
- **Zero dipendenze di build**: solo HTML/CSS/JS vanilla.

## Palette

- `#4674b0` blu petrolio — accento primario
- `#e4ad55` ocra — accento caldo, numeri statistiche
- `#c34b6a` rosa-bordeaux — accento secondario
- `#3f3f3f` grigio scuro — footer
- bianco / nero — base

## Tipografia

- **Fraunces** (display variabile, serif moderno) — titoli, copertine, autori in italic
- **Inter** — corpo testo
- **JetBrains Mono** — metadati, eyebrow, codici

## Struttura

```
.
├── index.html              # Home con ricerca rapida
├── catalogo.html           # Lista filtrabile e paginata
├── libro.html              # Scheda dettaglio (?id=N)
├── statistiche.html        # Dashboard statistiche
├── assets/
│   ├── css/style.css
│   └── js/
│       ├── data.js         # Caricamento dati + cache sessionStorage
│       ├── ui.js           # Componenti UI (lista, card, paginazione)
│       ├── catalog.js      # Logica filtri/ricerca/paginazione
│       ├── stats.js        # Calcolo e rendering statistiche
│       └── fuse.min.js     # Fuzzy search (locale, no CDN)
├── data/
│   ├── books.json          # Catalogo (generato dal TSV)
│   ├── prestiti.json       # Prestiti aggregati per libro
│   └── prestiti.tsv        # Sorgente prestiti (titolo, anno, n.prestiti)
└── scripts/
    ├── convert.py          # Converte il TSV del Form Google in books.json
    └── gen_prestiti.py     # Rigenera i prestiti finti
```

## Deploy su GitHub Pages

1. Crea un repository su GitHub e carica il contenuto di questa cartella.
2. Vai in **Settings → Pages**.
3. In *Source* seleziona **Deploy from a branch**, branch `main`, cartella `/ (root)`.
4. Salva. Dopo qualche minuto il sito sarà disponibile a `https://<utente>.github.io/<repo>/`.

## Aggiornare il catalogo

Quando il modulo Google produce nuove risposte:

1. Esporta il foglio Google come **TSV** (File → Scarica → Valori separati da tabulazioni).
2. Salva il file come `Form_catalogazione_libri__Responses__-_Form_Responses_1.tsv` nella root.
3. Esegui:
   ```bash
   python3 scripts/convert.py
   ```
   Questo rigenera `data/books.json`.
4. Commit + push: GitHub Pages serve automaticamente la versione aggiornata.

### Schema TSV atteso

| Colonna | Contenuto                                  |
|---------|--------------------------------------------|
| 1       | Timestamp (ignorato)                       |
| 2       | Titolo                                     |
| 3       | Autore (formato "Cognome, Nome")           |
| 4       | Anno di pubblicazione                      |
| 5       | Editore                                    |
| 6       | ISBN                                       |
| 7       | Link a OPAC SBN                            |
| 8       | Temi separati da virgola                   |
| 9       | Numero di pagine                           |
| 10      | Numero di copie                            |
| 11      | Sezione (es. "Letteratura Italiana")       |

## Aggiornare i prestiti

Il file `data/prestiti.tsv` ha schema:

```
titolo	anno	numero_prestiti
```

dove ogni libro può comparire più volte (una per ogni anno in cui è stato prestato).
Per sostituire i dati di esempio con quelli reali:

1. Sostituisci `data/prestiti.tsv` con i tuoi dati.
2. Adatta `scripts/gen_prestiti.py` (o scrivine uno tuo) che produca 
   `data/prestiti.json` nel formato:
   ```json
   {
     "Titolo del libro": {
       "totale": 42,
       "per_anno": { "2022": 12, "2023": 30 }
     }
   }
   ```

## Note tecniche

- **Cache**: i JSON sono cacheati in `sessionStorage` per evitare fetch ripetuti.
- **Ricerca**: Fuse.js gestisce errori di battitura, accenti e ricerche parziali.
- **Paginazione**: 30 risultati per pagina nel catalogo.
- **URL params**: `catalogo.html?q=...&tema=...&sezione=...&autore=...` per link condivisibili.
- **Browser supportati**: tutti i browser moderni (ES2017+, Fetch API).

## Personalizzazione colori

Per cambiare la palette, modifica le variabili CSS in cima a 
`assets/css/style.css`:

```css
:root {
  --blue: #4674b0;
  --ocra: #e4ad55;
  --rose: #c34b6a;
  --gray-700: #3f3f3f;
  /* ... */
}
```
