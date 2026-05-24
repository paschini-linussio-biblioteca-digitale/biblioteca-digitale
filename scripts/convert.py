#!/usr/bin/env python3
"""
Converte il TSV del Google Form in books.json normalizzato.
Uso: python3 convert.py [percorso_tsv] [percorso_json_output]
Default: cerca il TSV nella root del progetto, scrive in ../data/books.json
"""
import csv
import json
import re
import sys
from pathlib import Path
from collections import Counter

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent

# Default paths
DEFAULT_INPUT = PROJECT_ROOT / "Form_catalogazione_libri__Responses__-_Form_Responses_1.tsv"
DEFAULT_OUTPUT = PROJECT_ROOT / "data" / "books.json"

INPUT = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_INPUT
OUTPUT = Path(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_OUTPUT

# Mapping colonne (header generico "Column 1..12")
COLS = {
    "timestamp": 0,
    "titolo": 1,
    "autore": 2,
    "anno": 3,
    "editore": 4,
    "isbn": 5,
    "link_sbn": 6,
    "temi": 7,
    "pagine": 8,
    "copie": 9,
    "sezione": 10,
}

def clean_text(s):
    if s is None:
        return ""
    s = s.strip()
    # collassa spazi multipli
    s = re.sub(r"\s+", " ", s)
    return s

def clean_isbn(s):
    s = clean_text(s)
    if not s:
        return ""
    # rimuove tutto tranne cifre e X (per ISBN-10)
    # gestisce casi tipo "8845216756  : 884523060-"
    parts = re.split(r"[:;,/]", s)
    cleaned = []
    for p in parts:
        digits = re.sub(r"[^\dXx]", "", p)
        if len(digits) in (10, 13):
            cleaned.append(digits.upper())
    return cleaned[0] if cleaned else ""

def clean_url(s):
    s = clean_text(s)
    if not s:
        return ""
    if not (s.startswith("http://") or s.startswith("https://")):
        return ""
    return s

def parse_year(s):
    s = clean_text(s)
    m = re.search(r"\b(1[5-9]\d{2}|20[0-2]\d)\b", s)
    return int(m.group(1)) if m else None

def parse_int(s):
    s = clean_text(s)
    m = re.search(r"\d+", s)
    return int(m.group(0)) if m else None

def normalize_author(s):
    """Normalizza autori con piccola correzione di tipi noti."""
    s = clean_text(s)
    if not s:
        return ""
    # Capitalizza in modo sensato: "calvino, italo" -> "Calvino, Italo"
    # ma preserva acronimi e cose come "j.a."
    # Normalizzazione conservativa: trim + spazi singoli
    return s

def parse_temi(s):
    s = clean_text(s)
    if not s:
        return []
    # I temi sono separati da virgole, ma alcuni temi contengono virgole
    # noti: "Natura, Scienza e Futuro" e "Storia e Memoria"
    # Strategia: dividere e poi ricomporre i pezzi noti
    raw_parts = [p.strip() for p in s.split(",") if p.strip()]
    
    # Temi canonici (alcuni multi-parola con virgola)
    multipart = {
        ("Natura", "Scienza e Futuro"): "Natura, Scienza e Futuro",
    }
    
    result = []
    i = 0
    while i < len(raw_parts):
        # tenta merge a 2
        if i + 1 < len(raw_parts):
            pair = (raw_parts[i], raw_parts[i+1])
            if pair in multipart:
                result.append(multipart[pair])
                i += 2
                continue
        # "Natura" da solo è un errore di catalogazione: → "Natura, Scienza e Futuro"
        if raw_parts[i] == "Natura":
            result.append("Natura, Scienza e Futuro")
        else:
            result.append(raw_parts[i])
        i += 1
    # dedup mantenendo ordine
    seen = set()
    deduped = []
    for t in result:
        if t not in seen:
            seen.add(t)
            deduped.append(t)
    return deduped

def main():
    if not INPUT.exists():
        print(f"ERRORE: file TSV non trovato: {INPUT}", file=sys.stderr)
        print(f"Uso: python3 convert.py [percorso_tsv] [percorso_json_output]", file=sys.stderr)
        sys.exit(1)
    
    print(f"Leggo: {INPUT}")
    books = []
    with open(INPUT, encoding="utf-8") as f:
        reader = csv.reader(f, delimiter="\t")
        rows = list(reader)
    
    # salta header (riga 1) e righe vuote
    for idx, row in enumerate(rows[1:], start=2):
        if not row or all(not c.strip() for c in row):
            continue
        if len(row) < 11:
            row = row + [""] * (11 - len(row))
        
        titolo = clean_text(row[COLS["titolo"]])
        if not titolo:
            continue
        
        book = {
            "id": idx - 1,  # ID stabile
            "titolo": titolo,
            "autore": normalize_author(row[COLS["autore"]]),
            "anno": parse_year(row[COLS["anno"]]),
            "editore": clean_text(row[COLS["editore"]]),
            "isbn": clean_isbn(row[COLS["isbn"]]),
            "link_sbn": clean_url(row[COLS["link_sbn"]]),
            "temi": parse_temi(row[COLS["temi"]]),
            "pagine": parse_int(row[COLS["pagine"]]),
            "copie": parse_int(row[COLS["copie"]]) or 1,
            "sezione": clean_text(row[COLS["sezione"]]) or "Non classificato",
        }
        books.append(book)
    
    print(f"Totale libri: {len(books)}")
    
    # Statistiche per ispezione
    sezioni = Counter(b["sezione"] for b in books)
    temi_flat = Counter(t for b in books for t in b["temi"])
    autori = Counter(b["autore"] for b in books if b["autore"])
    decadi = Counter((b["anno"] // 10) * 10 for b in books if b["anno"])
    
    print("\n--- Sezioni ---")
    for s, c in sezioni.most_common():
        print(f"  {c:4d}  {s}")
    
    print("\n--- Top 20 temi ---")
    for t, c in temi_flat.most_common(20):
        print(f"  {c:4d}  {t}")
    
    print("\n--- Top 15 autori ---")
    for a, c in autori.most_common(15):
        print(f"  {c:4d}  {a}")
    
    print("\n--- Decadi ---")
    for d in sorted(decadi):
        print(f"  {d}s: {decadi[d]}")
    
    print(f"\nLibri senza anno: {sum(1 for b in books if not b['anno'])}")
    print(f"Libri senza ISBN: {sum(1 for b in books if not b['isbn'])}")
    print(f"Libri senza link SBN: {sum(1 for b in books if not b['link_sbn'])}")
    
    # Salva JSON
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(books, f, ensure_ascii=False, indent=2)
    print(f"\nScritto {OUTPUT}")

if __name__ == "__main__":
    main()
