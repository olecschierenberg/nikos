#!/usr/bin/env python3
"""Sprachtrennung fuer die Seiten unter /de/ und /en/ (ohne /lp/).

Warum: Die Seiten tragen beide Sprachen im Quelltext (data-de / data-en) und blenden
eine Sprache per CSS aus. Google sieht im Quelltext dann fast identische DE- und
EN-Seiten und stuft die englische als Duplikat der deutschen ein.

Was das Skript tut: In /de/-Seiten werden alle Elemente mit dem Attribut data-en
entfernt, in /en/-Seiten alle Elemente mit data-de. Danach steht in jeder Datei nur
noch ihre eigene Sprache. Der Sprachschalter bleibt (er wechselt per Link auf die
andere URL, siehe assets/js/url-language-router.js).

Aufruf (im Ordner site/):
    python tools/prune_language.py            # bereinigt alle Seiten (idempotent)
    python tools/prune_language.py --check    # prueft nur, aendert nichts (Exit 1 bei Funden)
    python tools/prune_language.py --backup   # legt vorher ein Backup unter backups/ an
"""
from __future__ import annotations
import re, sys, shutil, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VOID = {"area","base","br","col","embed","hr","img","input","link","meta","param","source","track","wbr"}
TOKEN = re.compile(
    r'<!--.*?-->'
    r'|<(script|style)\b[^>]*>.*?</\1\s*>'
    r'|<(/?)([a-zA-Z][\w:-]*)((?:"[^"]*"|\'[^\']*\'|[^>"\'])*)>',
    re.S | re.I)

def has_attr(attrs: str, name: str) -> bool:
    return re.search(r'(?:^|\s)' + re.escape(name) + r'(?=[\s=/>]|$)', attrs, re.I) is not None

def prune(text: str, drop_attr: str, keep_attr: str):
    out, pos, removed = [], 0, 0
    stack_name = None   # Tag-Name des Elements, das gerade entfernt wird
    depth = 0
    for m in TOKEN.finditer(text):
        if stack_name is None:
            out.append(text[pos:m.start()])
        pos = m.end()
        closing, name, attrs = m.group(2), m.group(3), m.group(4)
        if name is None:  # Kommentar / script / style
            if stack_name is None:
                out.append(m.group(0))
            continue
        lname = name.lower()
        if stack_name is not None:
            if lname == stack_name:
                if closing: depth -= 1
                elif not attrs.rstrip().endswith('/') : depth += 1
                if depth == 0:
                    stack_name = None
            continue
        if not closing and has_attr(attrs, drop_attr) and not has_attr(attrs, keep_attr):
            removed += 1
            if lname in VOID or attrs.rstrip().endswith('/'):
                continue
            stack_name, depth = lname, 1
            continue
        out.append(m.group(0))
    if stack_name is not None:
        raise ValueError("unbalanced element <%s>" % stack_name)
    out.append(text[pos:])
    return "".join(out), removed

def pages():
    for lang in ("de", "en"):
        for p in sorted((ROOT / lang).rglob("index.html")):
            rel = p.relative_to(ROOT).as_posix()
            if "/lp/" in rel:
                continue
            yield lang, p

def main():
    check = "--check" in sys.argv
    backup = "--backup" in sys.argv
    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    bdir = ROOT / "backups" / (stamp + "_sprachtrennung")
    found = changed = 0
    for lang, p in pages():
        raw = p.read_bytes()
        text = raw.decode("utf-8")
        drop, keep = ("data-en", "data-de") if lang == "de" else ("data-de", "data-en")
        new, n = prune(text, drop, keep)
        if n == 0:
            continue
        found += 1
        if check:
            print("  Fremdsprache noch im Quelltext:", p.relative_to(ROOT).as_posix(), "(%d Elemente)" % n)
            continue
        if backup:
            t = bdir / p.relative_to(ROOT); t.parent.mkdir(parents=True, exist_ok=True); shutil.copy2(p, t)
        data = new.encode("utf-8")
        if not data.rstrip().lower().endswith(b"</html>"):
            print("  [ABBRUCH] Ergebnis endet nicht auf </html>:", p); sys.exit(2)
        p.write_bytes(data)
        if p.read_bytes() != data:
            print("  [ABBRUCH] Rueckleseprobe fehlgeschlagen:", p); sys.exit(2)
        changed += 1
    if check:
        print("OK - alle /de/- und /en/-Seiten sind einsprachig." if not found else "%d Seiten mit Fremdsprache." % found)
        sys.exit(1 if found else 0)
    print("Sprachtrennung: %d Seiten bereinigt." % changed + ("  Backup: " + str(bdir) if backup and changed else ""))

if __name__ == "__main__":
    main()
