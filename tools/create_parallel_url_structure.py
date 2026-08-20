#!/usr/bin/env python3
"""Erzeugt parallel testbare, sprachgebundene Kernseiten ohne Altseiten zu ändern."""
from __future__ import annotations

import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOMAIN = "https://nikos.info"

PAGES = [
    {
        "source": "index.html",
        "key": "home",
        "de_slug": "",
        "en_slug": "",
        "old": "/",
        "de_title": "NIKOS – Mobile Notfalldurchsage & Sicherheitsbeschallung",
        "en_title": "NIKOS – Mobile Emergency Announcements & Safety PA",
        "de_description": "Mobile Notfalldurchsage, Sicherheitsbeschallung, Alarmierung und Evakuierung für Großveranstaltungen – mietbar, kabellos, autark per Digitalfunk.",
        "en_description": "Mobile emergency announcements, safety PA, alerting and evacuation for large events – rentable, wireless and self-sufficient via digital radio.",
    },
    {
        "source": "nikos-system.html",
        "key": "system",
        "de_slug": "system",
        "en_slug": "system",
        "old": "/nikos-system.html",
        "de_title": "NIKOS System – Modulare, autarke Sicherheitskommunikation",
        "en_title": "NIKOS System – Modular, self-sufficient safety communication",
        "de_description": "Das modulare NIKOS-System für autarke Durchsagen, Alarmierung, Steuerung und Monitoring auf temporären Einsätzen.",
        "en_description": "The modular NIKOS system for self-sufficient announcements, alerting, control and monitoring at temporary deployments.",
    },
    {
        "source": "nikos-anwendungen.html",
        "key": "applications",
        "de_slug": "anwendungen",
        "en_slug": "applications",
        "old": "/nikos-anwendungen.html",
        "de_title": "NIKOS Anwendungen – Sicherheit für Veranstaltungen und Krisenlagen",
        "en_title": "NIKOS Applications – Safety for events and crisis situations",
        "de_description": "Einsatzbeispiele für NIKOS auf Veranstaltungen, Baustellen und in Krisenlagen.",
        "en_description": "Deployment scenarios for NIKOS at events, construction sites and in crisis situations.",
    },
    {
        "source": "nikos-produkte.html",
        "key": "products",
        "de_slug": "produkte",
        "en_slug": "products",
        "old": "/nikos-produkte.html",
        "de_title": "NIKOS Produkte – Mobile Module für Alarmierung und Steuerung",
        "en_title": "NIKOS Products – Mobile modules for alerting and control",
        "de_description": "NIKOS Module für mobile Durchsagen, Alarmierung, Beleuchtung, Steuerung und Monitoring.",
        "en_description": "NIKOS modules for mobile announcements, alerting, lighting, control and monitoring.",
    },
    {
        "source": "nikos-referenzen.html",
        "key": "references",
        "de_slug": "referenzen",
        "en_slug": "references",
        "old": "/nikos-referenzen.html",
        "de_title": "NIKOS Referenzen – Mobile Sicherheitskommunikation im Einsatz",
        "en_title": "NIKOS References – Mobile safety communication in action",
        "de_description": "Praxisbeispiele für NIKOS auf Großveranstaltungen, Baustellen und in kritischen Lagen.",
        "en_description": "Real-world examples of NIKOS at large-scale events, construction sites and critical situations.",
    },
    {
        "source": "nikos-vermietung.html",
        "key": "rental",
        "de_slug": "vermietung",
        "en_slug": "rental",
        "old": "/nikos-vermietung.html",
        "de_title": "NIKOS Vermietung – Mobile Sicherheitskommunikation über regionale Partner",
        "en_title": "NIKOS Rental – Mobile safety communication through regional partners",
        "de_description": "NIKOS für temporäre Einsätze über zertifizierte Partner in Ihrer Region mieten.",
        "en_description": "Rent NIKOS for temporary deployments through certified partners in your region.",
    },
    {
        "source": "nikos-downloads.html",
        "key": "insights",
        "de_slug": "wissen",
        "en_slug": "insights",
        "old": "/nikos-downloads.html",
        "de_title": "NIKOS Wissen – Technische Unterlagen und Planungswissen",
        "en_title": "NIKOS Insights – Technical documentation and planning resources",
        "de_description": "Technische Unterlagen, Ausschreibungstexte, Checklisten und Praxiswissen zu NIKOS.",
        "en_description": "Technical documentation, tender texts, checklists and practical NIKOS know-how.",
    },
    {
        "source": "nikos-kontakt.html",
        "key": "contact",
        "de_slug": "kontakt",
        "en_slug": "contact",
        "old": "/nikos-kontakt.html",
        "de_title": "NIKOS Kontakt – Beratung und Mietanfrage",
        "en_title": "NIKOS Contact – Consultation and rental inquiry",
        "de_description": "Beratung, Mietanfrage und Partneranfrage für NIKOS – in der Regel Antwort am nächsten Werktag.",
        "en_description": "Consultation, rental inquiry and partner inquiry for NIKOS – usually answered the next business day.",
    },
]


def path_for(lang: str, page: dict) -> str:
    slug = page[f"{lang}_slug"]
    return f"/{lang}/{slug}/" if slug else f"/{lang}/"


TARGETS = {}
for page in PAGES:
    source_name = page["source"]
    TARGETS[source_name] = {
        "de": path_for("de", page),
        "en": path_for("en", page),
    }


def apply_metadata(html: str, lang: str, page: dict) -> str:
    de_url = f"{DOMAIN}{path_for('de', page)}"
    en_url = f"{DOMAIN}{path_for('en', page)}"
    current_url = de_url if lang == "de" else en_url
    title = page[f"{lang}_title"]
    description = page[f"{lang}_description"]
    locale = "de_DE" if lang == "de" else "en_GB"

    html = re.sub(r'<html\b[^>]*>',
                  f'<html lang="{lang}" data-lang="{lang}" data-url-lang="{lang}" '
                  f'data-lang-url-de="{path_for("de", page)}" '
                  f'data-lang-url-en="{path_for("en", page)}">',
                  html,
                  count=1,
                  flags=re.IGNORECASE)
    html = re.sub(r'<title>.*?</title>', f'<title>{title}</title>', html, count=1, flags=re.IGNORECASE | re.DOTALL)
    html = re.sub(r'<meta\s+name="description"\s+content="[^"]*"\s*/?>',
                  f'<meta name="description" content="{description}">',
                  html,
                  count=1,
                  flags=re.IGNORECASE)
    html = re.sub(r'<link\s+rel="canonical"\s+href="[^"]*"\s*/?>',
                  f'<link rel="canonical" href="{current_url}">',
                  html,
                  count=1,
                  flags=re.IGNORECASE)
    html = re.sub(r'<link\s+rel="alternate"\s+hreflang="de"\s+href="[^"]*"\s*/?>',
                  f'<link rel="alternate" hreflang="de" href="{de_url}">',
                  html,
                  count=1,
                  flags=re.IGNORECASE)
    html = re.sub(r'<link\s+rel="alternate"\s+hreflang="en"\s+href="[^"]*"\s*/?>',
                  f'<link rel="alternate" hreflang="en" href="{en_url}">',
                  html,
                  count=1,
                  flags=re.IGNORECASE)
    html = re.sub(r'<link\s+rel="alternate"\s+hreflang="x-default"\s+href="[^"]*"\s*/?>',
                  f'<link rel="alternate" hreflang="x-default" href="{de_url}">',
                  html,
                  count=1,
                  flags=re.IGNORECASE)
    html = re.sub(r'(<meta\s+property="og:url"\s+content=")[^"]*("\s*/?>)',
                  rf'\g<1>{current_url}\g<2>', html, count=1, flags=re.IGNORECASE)
    html = re.sub(r'(<meta\s+property="og:title"\s+content=")[^"]*("\s*/?>)',
                  rf'\g<1>{title}\g<2>', html, count=1, flags=re.IGNORECASE)
    html = re.sub(r'(<meta\s+property="og:description"\s+content=")[^"]*("\s*/?>)',
                  rf'\g<1>{description}\g<2>', html, count=1, flags=re.IGNORECASE)
    html = re.sub(r'(<meta\s+property="og:locale"\s+content=")[^"]*("\s*/?>)',
                  rf'\g<1>{locale}\g<2>', html, count=1, flags=re.IGNORECASE)
    html = re.sub(r'(<meta\s+name="twitter:title"\s+content=")[^"]*("\s*/?>)',
                  rf'\g<1>{title}\g<2>', html, count=1, flags=re.IGNORECASE)
    html = re.sub(r'(<meta\s+name="twitter:description"\s+content=")[^"]*("\s*/?>)',
                  rf'\g<1>{description}\g<2>', html, count=1, flags=re.IGNORECASE)

    # Kernseitennavigation bereits im statischen HTML auf die Sprach-URL setzen.
    # Der Browser-Router ergänzt dies anschließend für den dynamisch eingesetzten Footer.
    for source_name, language_targets in TARGETS.items():
        target = language_targets[lang]
        if source_name == 'index.html':
            variants = ['index.html', '/index.html', '/']
        else:
            stem = source_name.removesuffix('.html')
            variants = [source_name, f'/{source_name}', stem, f'/{stem}']
        for variant in sorted(variants, key=len, reverse=True):
            pattern = rf'(href=["\']){re.escape(variant)}((?:[?#][^"\']*)?["\'])'
            html = re.sub(pattern, rf'\g<1>{target}\g<2>', html)

    insertion = (
        f'  <base href="/">\n'
        f'  <meta name="robots" content="noindex,follow">\n'
        f'  <meta name="migration-status" content="parallel-url-test">\n'
    )
    html = html.replace('</head>', insertion + '</head>', 1)
    contact_page = next(item for item in PAGES if item["key"] == "contact")
    override = (
        f'\n<script>window.NIKOS_CONTACT_URL = "{path_for(lang, contact_page)}";</script>'
        f'\n<script src="assets/js/url-language-router.js?v=3"></script>\n'
    )
    html = html.replace('</body>', override + '</body>', 1)
    return re.sub(r'[ \t]+(?=\n)', '', html)


def write_page(lang: str, page: dict) -> None:
    source = ROOT / page["source"]
    destination = ROOT / lang / page[f"{lang}_slug"] / "index.html"
    destination.parent.mkdir(parents=True, exist_ok=True)
    html = source.read_text(encoding="utf-8")
    destination.write_text(apply_metadata(html, lang, page), encoding="utf-8")


def write_mapping() -> None:
    migration_dir = ROOT / "migration"
    migration_dir.mkdir(exist_ok=True)
    with (migration_dir / "url-mapping.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(["old_url", "new_de_url", "new_en_url", "status", "redirect_status", "notes"])
        for page in PAGES:
            writer.writerow([
                page["old"],
                path_for("de", page),
                path_for("en", page),
                "parallel_test",
                "not_configured",
                "Alt-URL bleibt bis zur expliziten Redirect-Freigabe unverändert aktiv.",
            ])
    manager_manifest = {
        "schemaVersion": 1,
        "migrationStatus": "parallel_test",
        "redirectStatus": "not_configured",
        "landingpagePolicy": {
            "sourceDirectories": ["loesungen/", "lp-preview/v2/"],
            "preserveExistingUrls": True,
            "updateOnlyAfterLandingpageReview": True,
            "description": "Landingpage-Maßnahmen werden im Website-Manager verknüpft, ohne bestehende V1- oder parallele V2-Dateien zu überschreiben."
        },
        "pages": [
            {
                "pageKey": page["key"],
                "sourcePath": page["source"],
                "oldUrl": page["old"],
                "languages": {
                    "de": {"url": path_for("de", page), "status": "parallel_test", "canonical": f"{DOMAIN}{path_for('de', page)}"},
                    "en": {"url": path_for("en", page), "status": "parallel_test", "canonical": f"{DOMAIN}{path_for('en', page)}"}
                },
                "landingpageIntegration": {"status": "pending_review", "hubUrl": "/loesungen/"}
            }
            for page in PAGES
        ]
    }
    (migration_dir / "website-manager-url-structure.json").write_text(
        json.dumps(manager_manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (migration_dir / "README.md").write_text(
        "# Parallele URL-Struktur\n\n"
        "Die neuen Kernseiten werden parallel zu den bisherigen URLs ausgeliefert. "
        "Sie sind bewusst mit `noindex,follow` versehen und noch nicht in der Sitemap. "
        "Alt-URLs bleiben unverändert erreichbar; 301-Weiterleitungen werden erst nach formaler Freigabe "
        "und erfolgreicher Funktions-, Layout- und Tracking-Prüfung in der aktiven Hosting-Schicht eingerichtet.\n\n"
        "Die Datei `website-manager-url-structure.json` ist die versionierte Eingabe für den NIKOS Local Hub. "
        "Sie enthält Sprachvarianten, kanonische Ziel-URLs, Alt-URLs, Migrationsstatus und die Schnittstelle zur Landingpage-Prüfung.\n",
        encoding="utf-8",
    )


def main() -> None:
    for page in PAGES:
        for language in ("de", "en"):
            write_page(language, page)
    write_mapping()
    print(f"Created {len(PAGES) * 2} parallel URL pages and a staged migration mapping.")


if __name__ == "__main__":
    main()
