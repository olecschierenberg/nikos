#!/usr/bin/env python3
"""Teilt sitemap.xml in einen Sitemap-Index plus mehrere kleine Teil-Sitemaps.

Hintergrund: Die Search Console meldet bei sitemap.xml dauerhaft 'Konnte nicht
abgerufen werden', obwohl Googlebot die Datei laut URL-Pruefung erfolgreich abruft.
Ein Sitemap-Index mit neuen Dateinamen ist der empfohlene Ausweg.

Ergebnis (im Ordner site/):
  sitemap-index.xml        <- diese Datei in der Search Console einreichen
  sitemap-seiten.xml       <- Kernseiten /de/ und /en/ (ohne Landingpages) + Startseiten
  sitemap-landingpages.xml <- /<sprache>/lp/...
  sitemap-loesungen.xml    <- /loesungen/...
sitemap.xml bleibt unveraendert bestehen (wird weiter von GitHub Actions erzeugt).
Aufruf:  python tools/split_sitemap.py
"""
import re, sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOMAIN = "https://nikos.info"
SRC = ROOT / "sitemap.xml"
URL_RE = re.compile(r"<url>\s*<loc>\s*([^<\s]+)\s*</loc>(?:\s*<lastmod>\s*([^<\s]+)\s*</lastmod>)?.*?</url>", re.S)

def group(url: str) -> str:
    p = url[len(DOMAIN):].strip("/")
    if p.startswith("loesungen"):
        return "loesungen"
    if re.match(r"^[a-z]{2}/lp(/|$)", p):
        return "landingpages"
    return "seiten"

def write(path: Path, data: str):
    b = data.encode("utf-8")
    path.write_bytes(b)
    if path.read_bytes() != b:
        sys.exit("Rueckleseprobe fehlgeschlagen: %s" % path)

def main():
    text = SRC.read_bytes().decode("utf-8")
    groups = {"seiten": [], "landingpages": [], "loesungen": []}
    seen = set()
    for m in URL_RE.finditer(text):
        u = m.group(1)
        if u in seen or not u.startswith(DOMAIN + "/"):
            continue
        seen.add(u)
        groups[group(u)].append((u, m.group(2)))
    today = date.today().isoformat()
    head = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    for name, items in groups.items():
        body = "".join("<url>\n<loc>%s</loc>\n%s</url>\n" % (u, ("<lastmod>%s</lastmod>\n" % d) if d else "") for u, d in items)
        write(ROOT / ("sitemap-%s.xml" % name), head + body + "</urlset>\n")
    idx = '<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    for name, items in groups.items():
        if items:
            idx += "<sitemap>\n<loc>%s/sitemap-%s.xml</loc>\n<lastmod>%s</lastmod>\n</sitemap>\n" % (DOMAIN, name, max([d for _, d in items if d] or [today]))
    idx += "</sitemapindex>\n"
    write(ROOT / "sitemap-index.xml", idx)
    print("Sitemap-Index erzeugt:", {k: len(v) for k, v in groups.items()}, "gesamt", len(seen))

if __name__ == "__main__":
    main()
