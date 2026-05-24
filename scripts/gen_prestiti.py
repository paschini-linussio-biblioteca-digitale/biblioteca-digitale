#!/usr/bin/env python3
"""
Converte il registro prestiti reale (1 riga = 1 prestito) in prestiti.json aggregato.

Schema TSV atteso:
  Col 0: anno del prestito
  Col 1: autore (formato "Cognome Nome", senza virgola)
  Col 2: titolo
  Col 3: genere (spesso vuoto, ignorato)
  Col 4: numero di prestiti (sempre vuoto nel file attuale, ignorato)
  Col 5: data prestito (formato libero, ignorata: usiamo l'anno della col 0)

Match con il catalogo:
  Si normalizzano titolo e autore (lowercase, no accenti, no punteggiatura).
  Il formato autore "Calvino Italo" viene unificato con "Calvino, Italo" del catalogo.
  Quando un prestito matcha un libro del catalogo, si usa il TITOLO esatto del catalogo
  come chiave nel JSON, in modo che il sito possa fare il lookup diretto.
  Per i libri non matchati si usa il titolo originale del registro.

Output:
  data/prestiti.json — formato:
    {
      "Titolo del libro": {
        "totale": 42,
        "per_anno": {"2003": 5, "2004": 7, ...},
        "matched": true|false,
        "autore": "Cognome, Nome"     // se matched, dal catalogo; altrimenti dal registro
      }
    }
"""
import csv
import json
import re
import sys
import unicodedata
from pathlib import Path
from collections import defaultdict

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPT_DIR.parent / "data"

DEFAULT_INPUT = DATA_DIR / "REGISTRO_PRESTITI_PL.tsv"
DEFAULT_BOOKS = DATA_DIR / "books.json"
DEFAULT_OUTPUT = DATA_DIR / "prestiti.json"

INPUT = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_INPUT
BOOKS = Path(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_BOOKS
OUTPUT = Path(sys.argv[3]) if len(sys.argv) > 3 else DEFAULT_OUTPUT


def normalize(s):
    """Lowercase + no accenti + no punteggiatura + spazi singoli."""
    if not s:
        return ""
    s = s.lower().strip()
    s = ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')
    s = re.sub(r"[^\w\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def normalize_author(s):
    """
    Normalizza autore per match.
    'Calvino, Italo'  -> 'calvino italo'
    'Calvino Italo'   -> 'calvino italo'
    'CALVINO  Italo'  -> 'calvino italo'
    """
    return normalize(s)


def main():
    if not INPUT.exists():
        print(f"ERRORE: file TSV non trovato: {INPUT}", file=sys.stderr)
        sys.exit(1)
    if not BOOKS.exists():
        print(f"ERRORE: books.json non trovato: {BOOKS}", file=sys.stderr)
        print(f"  Esegui prima: python3 convert.py", file=sys.stderr)
        sys.exit(1)

    print(f"Catalogo: {BOOKS}")
    print(f"Registro: {INPUT}")

    # Carica catalogo e costruisci indice (titolo+autore normalizzati)
    with open(BOOKS, encoding="utf-8") as f:
        books = json.load(f)

    # Mappa: (titolo_norm, autore_norm) -> book
    # Per gestire libri con stesso titolo+autore nel catalogo (es. più edizioni), prendiamo il primo.
    # Il sito usa il titolo come chiave in prestiti.json, quindi se più edizioni condividono
    # lo stesso titolo, il sito mostrerà giustamente il badge "più edizioni".
    book_index = {}
    for b in books:
        key = (normalize(b["titolo"]), normalize_author(b.get("autore", "")))
        if key not in book_index:
            book_index[key] = b

    # Anche un fallback per match solo sul titolo (in caso l'autore sia stato scritto
    # in modo molto diverso). Lo usiamo solo se l'autore non è specificato nel registro.
    title_only_index = defaultdict(list)
    for b in books:
        title_only_index[normalize(b["titolo"])].append(b)

    # Carica registro prestiti
    with open(INPUT, encoding="utf-8") as f:
        reader = csv.reader(f, delimiter="\t")
        rows = list(reader)

    # Aggregazione: chiave (titolo_originale_o_catalogo, autore) -> { anno -> count, info }
    # Usiamo come chiave di output il titolo del catalogo se matched, altrimenti del registro.
    aggregato = defaultdict(lambda: {"totale": 0, "per_anno": defaultdict(int),
                                     "matched": False, "autore": "",
                                     "_titolo_registro": "", "_autore_registro": ""})

    n_processati = 0
    n_matched = 0
    n_skipped = 0

    # Salta header
    for row in rows[1:]:
        if len(row) < 6:
            n_skipped += 1
            continue
        anno_str = row[0].strip()
        autore_reg = row[1].strip()
        titolo_reg = row[2].strip()

        if not titolo_reg or not anno_str:
            n_skipped += 1
            continue

        # Validazione anno (deve essere un numero a 4 cifre plausibile)
        m = re.match(r"^\d{4}$", anno_str)
        if not m:
            n_skipped += 1
            continue
        anno_int = int(anno_str)
        if anno_int < 1900 or anno_int > 2100:
            n_skipped += 1
            continue

        n_processati += 1

        # Tenta match titolo+autore
        nt = normalize(titolo_reg)
        na = normalize_author(autore_reg)

        match = book_index.get((nt, na))
        if match:
            chiave_titolo = match["titolo"]
            autore_finale = match.get("autore", autore_reg)
            matched = True
            n_matched += 1
        else:
            # Nessun match: usa i dati del registro
            chiave_titolo = titolo_reg
            autore_finale = autore_reg
            matched = False

        agg = aggregato[chiave_titolo]
        agg["totale"] += 1
        agg["per_anno"][anno_str] += 1
        agg["matched"] = matched
        agg["autore"] = autore_finale
        agg["_titolo_registro"] = titolo_reg
        agg["_autore_registro"] = autore_reg

    # Trasforma defaultdict per JSON e ordina anni
    output = {}
    for titolo, data in aggregato.items():
        output[titolo] = {
            "totale": data["totale"],
            "per_anno": dict(sorted(data["per_anno"].items())),
            "matched": data["matched"],
            "autore": data["autore"],
        }

    # Salva
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    # Statistiche di output
    print(f"\nRighe processate: {n_processati}")
    print(f"Righe scartate (vuote/malformate): {n_skipped}")
    print(f"Prestiti totali: {sum(d['totale'] for d in output.values())}")
    print(f"Libri distinti prestati: {len(output)}")
    print(f"  matchati nel catalogo: {sum(1 for d in output.values() if d['matched'])}")
    print(f"  non matchati: {sum(1 for d in output.values() if not d['matched'])}")

    anni_set = set()
    for d in output.values():
        anni_set.update(d["per_anno"].keys())
    print(f"Anni coperti: {min(anni_set)}-{max(anni_set)}")

    # Top 10 prestati
    top = sorted(output.items(), key=lambda x: -x[1]["totale"])[:10]
    print(f"\nTop 10 libri più prestati:")
    for titolo, d in top:
        flag = "✓" if d["matched"] else "·"
        print(f"  {flag} {d['totale']:3d}  {titolo[:55]:55}  {d['autore']}")

    print(f"\nScritto {OUTPUT}")


if __name__ == "__main__":
    main()
