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
