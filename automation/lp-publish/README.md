# NIKOS Landingpage-Veröffentlichung — GitHub-Actions-Portierung (ohne n8n)

Ersetzt schrittweise den n8n-Workflow **"Landingpages veröffentlichen"**
(Workflow-ID `VJaUw0kTrsO17iHX`, aktiv, Webhook on-demand + monatlicher
Ablauf-Check). Hintergrund und der vollständige Migrationsplan stehen in
`/nikos/Migrationsplan_Keywordkombis-und-Veroeffentlichung_ohne-n8n_2026-08-28.md`.

## Wie fertig ist das?

**Fertig gebaut, noch nicht getestet.** Der komplette Code steht, die
reine Verarbeitungslogik (Limit/Dedup, Vorschau-Gültigkeitsprüfung,
noindex-Entfernung + Linktext-Extraktion, Hub-Merge, Ablauf-Prüfung) ist
mit synthetischen Testdaten erfolgreich durchgelaufen (`npm run dry-run`,
ohne echte Sheet-/Dateisystem-/IndexNow-Aufrufe). Ein echter Testlauf
gegen echte Vorschauseiten steht noch aus — dafür fehlt das Secret unten.
Der laufende n8n-Betrieb ist davon **nicht berührt**.

## Zwei getrennte Skripte, zwei getrennte Sorgen

- **`index.js`** — Live-Deploy-Zweig (entspricht dem Webhook-Zweig in n8n):
  promotet Vorschauseiten zu live.
- **`ablauf.js`** — monatlicher Ablauf-Check (entspricht dem
  "Monatlich (Ablauf)"-Zweig in n8n): markiert abgelaufene Kombinationen
  im Sheet. Bewusst getrennt gehalten, wie im Migrationsplan (Abschnitt
  4.3) empfohlen — "sauberer getrennt als in n8n, wo beide Zweige in
  derselben Workflow-Datei stecken".

## Was 1:1 übernommen ist — und was angepasst werden musste

**1:1 unveränderte Kopien** der jeweiligen n8n-Node-Codes:
`lib/nodes/limit.js`, `lib/nodes/ablauf_pruefen.js` — reine
JS-Logik ohne GitHub-API-Bezug, direkt aus dem aktiven Workflow
ausgelesen.

**Angepasst** (keine 1:1-Kopie möglich, weil sich die Datenquelle ändert):
`lib/nodes/vorschau_gueltig.js`, `lib/nodes/noindex_entfernen.js`,
`lib/nodes/hub_mergen.js`. Der n8n-Workflow holt/schreibt Vorschau- und
Hub-Seite per GitHub-Contents-API (base64-kodiert, mit `sha` für
Konflikt-Handling). Da dieses Skript im bereits ausgecheckten Repo läuft
(siehe `automation/lp-generator`, dieselbe Entscheidung), liest/schreibt
es die Dateien direkt über das Dateisystem — kein GitHub-API-Aufruf, kein
base64, kein `sha`-Handling nötig. Die **fachliche Kernlogik** jeder
dieser drei Node-Dateien (welche Zeile entfernt wird, welcher Linktext
extrahiert wird, wie die `<ul>`-Liste im Hub zusammengeführt wird) ist
dabei jeweils unverändert aus dem Original übernommen — nur die
Ein-/Ausgabe-Hülle (HTTP-Response ↔ Dateisystem-String) ist neu. Jede
dieser drei Dateien trägt einen Kommentarblock, der genau erklärt, was
sich geändert hat und was nicht.

**Bewusst weggelassen:** die vier Sitemap-Nodes des n8n-Workflows
("Sitemap: URLs sammeln/holen/mergen/schreiben"). Die bestehende GitHub
Action `refresh-sitemap.yml` aktualisiert `sitemap.xml` bei **jedem** Push
auf `main` automatisch aus dem tatsächlichen Dateibestand — sobald dieses
Skript per `git commit`+`push` eine neue Live-Seite einspielt, läuft diese
Action danach automatisch. Ein zweiter, redundanter Sitemap-Schreibschritt
hier würde nur unnötige Commits erzeugen (Details: Migrationsplan Teil 2,
Abschnitt 4.2).

**Self-Retrigger → while-Schleife:** n8n verarbeitet maximal 5
Kombinationen pro Ausführung und ruft sich bei offenen Resten selbst per
Webhook erneut auf (Node "Rest offen?" → "Naechsten Lauf anstossen"). Ein
einzelner GitHub-Actions-Lauf hat kein Webhook-Retrigger-Äquivalent nötig
— `index.js` bildet dasselbe Verhalten stattdessen mit einer normalen
`while`-Schleife (Batches von 5, bis zu 20 Batches = 100 Zeilen pro Lauf,
danach übernimmt der nächste geplante Lauf den Rest) innerhalb desselben
Prozesses nach.

## Sicherheitsdesign: paralleler Testbetrieb ohne Risiko

- **Test-Modus (Standard):** liest die echte Vorschau
  (`lp-preview/<slug>/index.html`), schreibt das Ergebnis aber **nur**
  nach `loesungen/_ghtest-<slug>/`, **niemals** in den produktiven
  `loesungen/<slug>/`-Pfad. Löscht die echte Vorschau **nicht**,
  aktualisiert das Sheet **nicht**, den Lösungen-Hub **nicht**, pingt
  IndexNow **nicht**. Verarbeitet bewusst nur einen Batch (mehr Erkenntnis
  bringt ein größerer Testlauf nicht).
- **`--live`:** verhält sich wie der n8n-Workflow — promotet echt nach
  `loesungen/<slug>/`, löscht die Vorschau, setzt `aktiv=x` + `pfad` im
  Sheet, aktualisiert den Hub, pingt IndexNow.
- Der separate n8n-Workflow "Landingpages veröffentlichen" bleibt in
  dieser Phase komplett unangetastet und läuft parallel unverändert
  weiter.

Erst wenn über mehrere Testläufe hinweg die Ergebnisse (verglichen mit
zuletzt von n8n live geschalteten Seiten) nachweislich gleichwertig sind,
wird ein echter Zeitplan (bzw. `workflow_dispatch` bei Bedarf, wie
aktuell in n8n per Webhook) der nächste Schritt.

## Was du noch einrichten musst (1 Secret)

### `GOOGLE_SERVICE_ACCOUNT_JSON`

Derselbe Service-Account wie beim LP-Generator und bei der
Keyword-Kombinationserstellung — er muss dem Sheet "Landingpagedaten"
freigegeben sein. Siehe `automation/lp-generator/README.md`, Abschnitt
"Was du noch einrichten musst", Punkt 2, für die Einrichtung von Grund
auf. Kein OpenAI- oder Brevo-Key nötig — dieser Baustein ruft keine KI
auf und verschickt keine Mail.

### Secrets hinterlegen (GitHub-Weboberfläche)

Repo → **Settings → Secrets and variables → Actions → New repository
secret** (falls noch nicht vorhanden).

Danach: Actions-Tab → "Landingpage-Veröffentlichung (Test, ohne n8n)" →
**Run workflow**. Für den Ablauf-Check separat: "Landingpage-
Ablauf-Check (Test, ohne n8n)".

## Lokal testen (ohne GitHub Actions)

```bash
cd automation/lp-publish
npm install
npm run dry-run     # reine Logik, keine echten API-/Dateisystem-Aufrufe, keine Secrets nötig
```

Mit echtem Secret lokal (im Repo-Root `site/` ausgeführt, damit die
relativen Pfade `lp-preview/`/`loesungen/` stimmen):

```bash
export GOOGLE_SERVICE_ACCOUNT_JSON="$(cat pfad/zum/service-account.json)"
node automation/lp-publish/index.js            # Test-Modus (Standard, kein Schreibzugriff auf Sheet/Hub/IndexNow)
node automation/lp-publish/index.js --live     # promotet wirklich
node automation/lp-publish/ablauf.js           # Test-Modus
node automation/lp-publish/ablauf.js --live    # markiert wirklich abgelaufene Kombis
```

## Struktur

```
index.js                          Orchestrator Live-Deploy-Zweig (while-Schleife statt Selbst-Retrigger)
ablauf.js                          Orchestrator monatlicher Ablauf-Check
lib/runCodeNode.js                 n8n-Kompatibilitäts-Shim (wiederverwendet aus lp-generator)
lib/sheets.js                      Google-Sheets-Zugriff (lesen/aktualisieren)
lib/nodes/limit.js                  UNVERÄNDERTE Kopie des n8n-Code-Node-Inhalts
lib/nodes/ablauf_pruefen.js         UNVERÄNDERTE Kopie des n8n-Code-Node-Inhalts
lib/nodes/vorschau_gueltig.js       ANGEPASST: Dateisystem statt GitHub-API (Kommentar im Code)
lib/nodes/noindex_entfernen.js      ANGEPASST: Dateisystem statt GitHub-API (Kommentar im Code)
lib/nodes/hub_mergen.js             ANGEPASST: Dateisystem statt GitHub-API (Kommentar im Code)
test/dry-run.js                     Offline-Trockentest der reinen Logik
```
