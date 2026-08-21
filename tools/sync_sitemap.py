#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
sync_sitemap.py
Ergaenzt sitemap.xml automatisch um alle Landingpages, die unter
site/loesungen/<slug>/index.html real live sind, aber noch nicht in der
Sitemap stehen. Wird von deploy.bat vor jedem Deploy aufgerufen (Sicherheitsnetz
zusaetzlich zur n8n-"Sitemap-Automatik" im Workflow "Landingpages veroeffentlichen").

Erkennt und ueberspringt automatisch:
- Redirect-Stubs (canonical zeigt auf eine ANDERE URL als die eigene, oder
  <meta name="robots" content="noindex...">)
- bereits in der Sitemap vorhandene URLs (idempotent)

Schreibt NUR, wenn wirklich etwas fehlt. Bricht den Deploy bei einem Problem
NICHT ab (Exit-Code 0 auch im Fehlerfall) - meldet aber deutlich eine Warnung,
damit ein Mensch nachschaut. Haelt sich an die Website-Regeln fuer kritische
Dateien: Backup vor jeder Aenderung, binaeres Lesen/Schreiben (kein Text-Modus,
sonst CRLF->LF-Verfaelschung), Byte-fuer-Byte-Rueckvergleich nach dem Schreiben.
"""
from __future__ import annotations

import re
import shutil
import sys
from datetime import datetime
from pathlib import Path

SITE_ROOT = Path(__file__).resolve().parents[1]
LOESUNGEN_DIR = SITE_ROOT / "loesungen"
SITEMAP_PATH = SITE_ROOT / "sitemap.xml"
BACKUP_DIR = SITE_ROOT / "backups"
DOMAIN = "https://nikos.info"

CANONICAL_RE = re.compile(rb'<link\s+rel="canonical"\s+href="([^"]+)"', re.IGNORECASE)
ROBOTS_NOINDEX_RE = re.compile(rb'<meta\s+name="robots"\s+content="[^"]*noindex', re.IGNORECASE)
LOC_RE = re.compile(rb"<loc>([^<]+)</loc>")


def find_live_lp_urls() -> list[str]:
    """Scannt site/loesungen/*/index.html und liefert alle URLs, die WIRKLICH
    live/indexierbar sind (kein Redirect-Stub, kein noindex)."""
    urls: list[str] = []
    if not LOESUNGEN_DIR.is_dir():
        return urls

    for entry in sorted(LOESUNGEN_DIR.iterdir()):
        if not entry.is_dir():
            continue
        index_file = entry / "index.html"
        if not index_file.is_file():
            continue

        raw = index_file.read_bytes()
        own_url = f"{DOMAIN}/loesungen/{entry.name}/"

        if ROBOTS_NOINDEX_RE.search(raw):
            continue  # noindex -> Redirect-Stub o.ae., bewusst nicht in der Sitemap

        m = CANONICAL_RE.search(raw)
        if not m:
            continue  # kein canonical gefunden -> nicht sicher genug, ueberspringen
        canonical = m.group(1).decode("utf-8", errors="replace")
        if canonical.rstrip("/") != own_url.rstrip("/"):
            continue  # canonical zeigt auf eine ANDERE Seite -> Redirect-Stub

        urls.append(own_url)

    return urls


def existing_sitemap_urls(sitemap_bytes: bytes) -> set[str]:
    return {m.group(1).decode("utf-8", errors="replace") for m in LOC_RE.finditer(sitemap_bytes)}


def build_url_block(url: str) -> bytes:
    # exakt dasselbe Format wie die bestehenden loesungen-Eintraege in sitemap.xml
    return (
        b"  <url>\r\n"
        b"    <loc>" + url.encode("utf-8") + b"</loc>\r\n"
        b'    <xhtml:link rel="alternate" hreflang="de" href="' + url.encode("utf-8") + b'"/>\r\n'
        b'    <xhtml:link rel="alternate" hreflang="en" href="' + url.encode("utf-8") + b'"/>\r\n'
        b"    <changefreq>monthly</changefreq>\r\n"
        b"    <priority>0.5</priority>\r\n"
        b"  </url>\r\n"
    )


def main() -> int:
    try:
        if not SITEMAP_PATH.is_file():
            print("[sync_sitemap] WARNUNG: sitemap.xml nicht gefunden - uebersprungen.")
            return 0

        live_urls = find_live_lp_urls()
        original = SITEMAP_PATH.read_bytes()
        present = existing_sitemap_urls(original)

        missing = [u for u in live_urls if u not in present]
        if not missing:
            print(f"[sync_sitemap] OK - Sitemap ist aktuell ({len(live_urls)} Landingpages, keine fehlt).")
            return 0

        # Backup zuerst (verbindliche Website-Regel fuer kritische Dateien)
        BACKUP_DIR.mkdir(exist_ok=True)
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = BACKUP_DIR / f"sitemap.preSync-{stamp}.xml"
        shutil.copy2(SITEMAP_PATH, backup_path)

        new_blocks = b"".join(build_url_block(u) for u in missing)
        marker = b"</urlset>"
        idx = original.rfind(marker)
        if idx == -1:
            print("[sync_sitemap] WARNUNG: </urlset> nicht gefunden - Sitemap nicht veraendert.")
            return 1
        updated = original[:idx] + new_blocks + original[idx:]

        SITEMAP_PATH.write_bytes(updated)

        # Byte-fuer-Byte-Rueckvergleich (verbindliche Website-Regel)
        reread = SITEMAP_PATH.read_bytes()
        if reread != updated:
            print("[sync_sitemap] WARNUNG: Rueckvergleich nach dem Schreiben schlaegt fehl! "
                  f"Backup liegt in {backup_path}")
            return 1
        if b"\x00" in reread or not reread.rstrip().endswith(b"</urlset>"):
            print("[sync_sitemap] WARNUNG: Sitemap wirkt nach dem Schreiben beschaedigt! "
                  f"Backup liegt in {backup_path}")
            return 1

        print(f"[sync_sitemap] {len(missing)} neue Landingpage(s) zur Sitemap hinzugefuegt:")
        for u in missing:
            print(f"  + {u}")
        print(f"[sync_sitemap] Backup der alten Sitemap: {backup_path.name}")
        return 0

    except Exception as exc:  # Sitemap-Sync darf den Deploy nie blockieren
        print(f"[sync_sitemap] WARNUNG: unerwarteter Fehler ({exc}) - Sitemap unveraendert, Deploy laeuft weiter.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
