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
