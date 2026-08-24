# Validierung – parallele URL-Struktur

## Lokale Sichtprüfung

Am 20.08.2026 wurde `http://localhost:8765/de/system/` in einer lokalen statischen Vorschau geprüft. Die Seite lädt das bestehende Systemlayout, Hero-Motiv, Navigationsstruktur, Farben, Typografie und Akkordeon-Inhalte unverändert. Die deutsche Sprachfassung wird trotz vorhandener Browser-Spracheinstellung zuverlässig dargestellt, weil die neue URL die Sprache über `data-url-lang="de"` bindet.

Die zentrale Navigation wird auf die neue deutsche Struktur umgeschrieben: Startseite `/de/`, System `/de/system/`, Anwendungen `/de/anwendungen/`, Produkte `/de/produkte/`, Referenzen `/de/referenzen/`, Vermietung `/de/vermietung/`, Wissen `/de/wissen/` und Kontakt `/de/kontakt/`. Bestehende Landingpage-Links bleiben unverändert unter `/loesungen/` und werden damit nicht durch die Kernseitenmigration beeinträchtigt.

Die Sprachumschaltung war sichtbar und stellt Deutsch sowie Englisch bereit. Die Weiterleitung auf die englische Ziel-URL wird im folgenden Validierungsschritt geprüft. Alte Seiten und die Landingpage-Verzeichnisse wurden durch die Generierung nicht verändert.

## Englische Ziel-URL

Der Wechsel über die sichtbare Sprachumschaltung führte von `/de/system/` auf `/en/system/`. Die englische Seite zeigte denselben Layoutaufbau, dieselben visuellen Komponenten und die englische Inhaltsfassung. Die Hauptnavigation wurde auf die englischen Zielpfade umgeschrieben; beispielsweise führen Produkte zu `/en/products/`, Vermietung zu `/en/rental/`, Wissen zu `/en/insights/` und Kontakt zu `/en/contact/`. Dadurch wird die neue URL-Struktur genutzt, während die Bestandsseiten und Landingpages unberührt bleiben.

## Statische Navigationsprüfung

Alle 16 neuen Sprachseiten wurden lokal mit HTTP 200 geprüft. Jede Seite enthält die vorgesehenen `hreflang`-Signale, die URL-gebundene Sprachkennung und den Schutzstatus `noindex,follow`. Die Kernnavigation ist bereits im statisch ausgelieferten HTML sprachspezifisch: Deutsche Seiten führen ausschließlich zu `/de/…`, englische Seiten ausschließlich zu `/en/…`. Es verbleiben keine direkten Kernnavigationslinks auf die bisherigen `nikos-*.html`-Seiten. Die aktuellen Altseiten und eine repräsentative Landingpage unter `/loesungen/` lieferten in der lokalen Vorschau weiterhin HTTP 200.

## Live-Bereitstellung

Nach dem Push des Commit `6fbc98a` am 20.08.2026 wurde `https://nikos.info/de/system/` geprüft. Zu diesem Zeitpunkt antwortete die vorgelagerte Netlify-Auslieferung noch mit einer 404-Seite. Die Repository-Änderung ist damit korrekt versioniert und gepusht, aber der aktive Deployment-Webhook beziehungsweise die Veröffentlichungsschicht hat den neuen Stand noch nicht ausgeliefert. **Altseiten und Landingpages bleiben unverändert verfügbar; es wurden keine Redirects aktiviert.** Vor einer Redirect-Freigabe muss die Live-Auslieferung der neuen Pfade ausdrücklich bestätigt werden.

## Live-Nachprüfung und Korrekturbedarf

Der GitHub-Pages-Build des Commit `6fbc98a` ist abgeschlossen und die neue Live-URL `https://nikos.info/de/system/` ist erreichbar. Bei der Nachprüfung wurde jedoch festgestellt, dass eine zuvor gespeicherte englische Browser-Sprache die sichtbare deutsche URL-Fassung noch überschreibt. Die URL selbst, Titel und interne Zielpfade sind korrekt; vor der Redirect-Freigabe wird die Sprachlogik so korrigiert, dass `/de/…` und `/en/…` die jeweilige Sprache verbindlich bestimmen.

## Veröffentlichungsstand der Sprachkorrektur

Die cachefeste Router-Version wurde mit Commit `0024a22` in das Repository übertragen. Der anschließende GitHub-Pages-Build war bei der letzten Abfrage noch im Status `building`; daher erfolgt die abschließende Bestätigung der sichtbaren Sprachbindung erst nach Abschluss dieses Builds. Es wurden weiterhin keine Weiterleitungsregeln, Sitemap-Einträge oder Änderungen an bestehenden Landingpages aktiviert.

## Erfolgreiche Live-Abnahme

Die finale Live-Prüfung der deutschen Seite `https://nikos.info/de/system/` bestätigte die deutsche sichtbare Fassung, die deutsche Sprachmarkierung und korrekte interne Kernlinks, einschließlich des Startseitenlinks `/de/`. Anschließend führte die Sprachumschaltung sichtbar und ohne Umweg auf `https://nikos.info/en/system/`; dort wurden die englische Fassung, die englische Sprachmarkierung und englische Navigationsziele wie `/en/applications/`, `/en/products/` und `/en/contact/` bestätigt.

Die neue Struktur ist damit parallel funktionsfähig. Die 16 Seiten behalten bis zur formalen SEO- und Go-live-Freigabe `noindex,follow` und sind nicht in die Sitemap aufgenommen. Die bisherigen URLs sowie alle Landingpages unter `loesungen/` und `lp-preview/` wurden weder verändert noch weitergeleitet.

## Tranche 1 (24.08.2026) — 5 Produktunterseiten migriert

Migriert nach dem Muster der 8 Kernseiten (siehe oben): `nikos-produkt-horn.html`,
`-flash.html`, `-relay.html`, `-clamp.html`, `-xlr.html` → je `/de/produkte/<slug>/`
und `/en/products/<slug>/` (Slug unverändert, da Produktbezeichnung/Markenname).
`data-de`/`data-en`-Doppelinhalte aus den Altdateien unverändert übernommen (kein
Retext), nur Kopf (canonical/hreflang/og/twitter, `<title>`/Description für EN neu
übersetzt), `<html>`-Sprachbindung (`data-url-lang`, `data-lang-url-de/en`),
`<base href="/">`, `noindex,follow`, `migration-status` sowie interne Kernnav-Links
(Logo, Hauptnav, CTA-Band, „Zurück zur Produktübersicht") auf die neuen absoluten
Pfade umgestellt — exakt wie bei den 8 Bestandsseiten. Zusätzlich wurden die 5
zugehörigen Produktkarten-Links auf der Produkte-Hub-Seite (`/de/produkte/`,
`/en/products/`) auf die neuen Ziel-URLs umgestellt, ergänzt um ein
`data-href-<lang>`-Attribut (Verbesserung 1 aus dem Sprachstruktur-Plan). `led` und
`alarm` bleiben bewusst unverändert (nächste Tranche).

**Durchgeführte Prüfung (statisch, kein lokaler Server in dieser Sitzung verfügbar):**
Byte-Vergleich der zurückgelesenen Dateien mit den geschriebenen Versionen (identisch),
keine NUL-Bytes, alle Dateien enden korrekt auf `</html>`, `<div>`/`</div>`-Bilanz je
Datei unverändert (delta 0), `data-de`/`data-en`-Anzahl je Seite unverändert (nichts
verloren), keine verbliebenen alten `nikos-*.html`-Linkziele außer dem bekannten,
bereits bei den 8 Kernseiten genutzten JS-Fallback-String für den Kontakt-Button
(wird vom Router aus der zentralen `paths`-Tabelle korrekt aufgelöst). Python
`html.parser` meldet keine Strukturfehler. **Noch nicht durchgeführt:** echter
Klicktest im Browser (lokal oder live) und der Fallback-Check gegen den
GitHub-Pages-Endpunkt (Verbesserung 3) — beides erst sinnvoll nach dem nächsten
`deploy.bat`-Lauf durch den Nutzer, da diese Sitzung nicht deployen kann.

## Tranche 2 (24.08.2026) — restliche 5 Produktunterseiten migriert

Gleiches Verfahren wie Tranche 1: `nikos-produkt-alarm.html`, `-audio.html`,
`-dispatcher.html`, `-led.html`, `-moon.html` → je `/de/produkte/<slug>/` und
`/en/products/<slug>/`. Damit sind alle 10 Produktunterseiten migriert. Auf den
Produkte-Hub-Seiten wurden zusätzlich die Kartenlinks für `led` und `alarm`
umgestellt (inkl. `data-href-<lang>`, Verbesserung 1) — `audio`, `dispatcher` und
`moon` haben auf dem Hub keine eigene Karte, sondern sind dort als vollständige
Abschnitte direkt eingebettet (`id="audio"`, `id="dispatcher"`, `id="moon"`); diese
Abschnitte verlinken nicht auf die jeweilige Einzelseite, daher kein Änderungsbedarf
am Hub für diese drei.

**Prüfung:** wie Tranche 1 — Byte-Vergleich nach dem Schreiben (alle 14 Dateien
identisch), keine NUL-Bytes, `</html>`-Abschluss ok, `<div>`-Bilanz je Seite
unverändert, `data-de`-Anzahl je Seite unverändert (auch bei den größeren Seiten
`audio`/`dispatcher` mit Feature-Liste und Technische-Daten-Tabelle: 54 bzw. 42
Vorkommen, unverändert), keine alten `nikos-*.html`-Linkziele übrig, Python
`html.parser` ohne Fehler. Echter Klicktest weiterhin offen (siehe Tranche 1).

Nutzer-Rückmeldung zu Tranche 1 nach eigener Live-Prüfung: **in Ordnung.**

## Tranche 3 (24.08.2026) — 12 Anwendungsunterseiten migriert

Alle 12 `nikos-anwendung-<slug>.html` → je `/de/anwendungen/<slug>/` und
`/en/applications/<slug-en>/` (englische Slugs übersetzt statt übernommen, siehe
`website-manager-url-structure.json`: festival, funfair, city-festival,
christmas-market, memorial-event, anniversary-celebration, parade,
corporate-event, sports-event, park-festival, construction-site,
crisis-situation). Gleiches Sicherheits-/Schreibverfahren wie Tranche 1/2,
zusätzlich behandelt:

- **Fragment-Hrefs** zur Produkte-Hub-Seite (`nikos-produkte.html#zubehoer` /
  `#dispatcher` / `#audio` / `#moon`, aus den Modul-Inline-Logos) → auf
  `/de/produkte/#…` bzw. `/en/products/#…` umgestellt, Fragment-Namen
  unverändert (Abschnitts-IDs sind auf den Produkt-Hub-Seiten bereits
  sprachneutral identisch, geprüft).
- **Sequenzielle „Nächstes Anwendungsbeispiel“-Verlinkung**: alle 12 Seiten in
  einer Tranche migriert, damit die Kette vollständig auf neue Ziel-URLs zeigt,
  inklusive Rücksprung von krisenlage → festival.
- **TechArticle-JSON-LD** je Sprache übersetzt (`headline`, `about`,
  `inLanguage`, `url` auf eigene neue URL, `isPartOf.url` auf neue Hub-URL).
- **og:url-Sonderfall**: nur bei `festival` zeigt og:url im Original auf die
  Hub-Seite (Bestand von Manus, absichtlich beibehalten und in den neuen
  Sprachvarianten ebenfalls auf die jeweilige Hub-URL abgebildet); alle anderen
  11 zeigen wie im Original auf sich selbst.
- Hub-Update: Kartenlinks auf `de/anwendungen/index.html` und
  `en/applications/index.html` (alle 12) auf die neuen Unterseiten-URLs
  umgestellt, inkl. `data-href-<lang>` (Verbesserung 1), gleiches Muster wie bei
  den Produkt-Hub-Karten.
- `website-manager-url-structure.json` jetzt 30 Einträge (18 + 12),
  `url-mapping.csv` um 12 Zeilen ergänzt.

**Prüfung:** Byte-Vergleich nach dem Schreiben (alle 24 Unterseiten + 2
Hub-Seiten identisch), keine NUL-Bytes, `</html>`-Abschluss ok, `<div>`-Bilanz
je Seite unverändert (delta 0 bei allen 26 Dateien), `data-de`-Anzahl je Seite
unverändert, keine alten `nikos-*.html`-Linkziele übrig (Fragment- und
Next-Links eingeschlossen), bekannter JS-Fallback-String für den
Kontakt-Button je Datei genau 1× vorhanden (unverändert, wie bei den 8
Kernseiten), Python `html.parser` ohne Fehler bei allen 26 Dateien. Echter
Klicktest und GitHub-Pages-Stichprobe (Verbesserung 3) weiterhin offen (siehe
Tranche 1) — erst sinnvoll nach dem nächsten `deploy.bat`-Lauf.

Damit sind mit den 8 Kernseiten + 10 Produktunterseiten + 12
Anwendungsunterseiten 30 von ~30 Hauptseiten migriert. Offen: restliche
Rechts-/Infoseiten (letzte Tranche laut Plan Abschnitt 4, Schritt 2) sowie
Schritt 3 (GitHub-Pages-Stichprobe je Tranche, noch für keine Tranche
durchgeführt).
