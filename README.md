# Biblioteca Digitale del Liceo

Sito per consultare il catalogo della biblioteca scolastica. È un sito statico (solo HTML/CSS/JS): niente database né server, si pubblica facilmente su GitHub Pages.

## Avviarlo in locale

Serve solo Python. Apri il terminale nella cartella del progetto e lancia un server locale:

```bash
python3 -m http.server 8000
```

Poi apri il browser su **http://localhost:8000**.

> Serve il server locale perché il sito carica i dati da un file JSON, e aprire l'HTML con doppio clic non lo permette.

## Aggiornare il catalogo (da TSV a JSON)

Quando il modulo Google raccoglie nuovi libri, si esporta il foglio come TSV e lo si converte nel file che il sito legge (`books.json`).

1. Esporta il foglio Google come TSV (*File → Scarica → Valori separati da tabulazioni*).
2. Salva il file dentro la cartella `data/`.
3. Esegui lo script di conversione:

   ```bash
   python3 scripts/convert.py data/nome_del_file.tsv data/books.json
   ```

4. Lo script stampa un riepilogo (quanti libri, sezioni, libri senza anno o senza link). Se i numeri tornano, è andato tutto bene.
5. Salva su GitHub (commit + push): il sito online si aggiorna da solo dopo qualche minuto.

## Librerie usate

- **Fuse.js** — la ricerca "intelligente": trova i libri anche con errori di battitura o parole parziali. È inclusa nel progetto (`fuse.min.js`), non scarica niente da internet.
- Per il resto il sito usa solo HTML, CSS e JavaScript normali, senza framework.