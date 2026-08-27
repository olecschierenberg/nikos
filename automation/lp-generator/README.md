# NIKOS Landingpage-Generator — GitHub-Actions-Portierung (ohne n8n)

Ersetzt schrittweise den n8n-Workflow **"Landingpages erzeugen — Worker
stabilisiert"** (Workflow-ID `8ApbaHN6gZYrl4ZO`) durch ein Node.js-Skript,
das in GitHub Actions läuft. Hintergrund, Motivation und der vollständige
Migrationsplan stehen in
`/nikos/Migrationsplan_Landingpage-Generator_ohne-n8n_2026-08-27.md`.

## Wie fertig ist das?

**Fertig gebaut, noch nicht getestet.** Der komplette Code steht, die reine
Verarbeitungslogik (Filtern, Texte aufbereiten, HTML bauen, SEO-Prüfung) ist
mit synthetischen Testdaten erfolgreich durchgelaufen (`npm run dry-run`,
ohne echte API-Aufrufe). Ein echter Lauf mit echten Daten/Kosten
(Google Sheet, OpenAI) steht noch aus — dafür fehlen die beiden Secrets
unten. Der laufende n8n-Betrieb ist davon **nicht berührt** — dieser
Workflow schreibt nur in einen eigenen Test-Pfad (siehe unten).

## Warum das 1:1 dieselbe Qualität liefert

Alle inhaltlichen Schritte (`lib/nodes/*.js`) sind **unveränderte Kopien**
des jeweiligen n8n-Node-Codes, direkt aus dem aktiven Workflow ausgelesen —
keine Neuentwicklung "nach bestem Wissen". Ebenso die drei KI-Prompts
(`lib/prompts/*.txt`, System- und User-Nachrichten) und dieselben Modelle
(`gpt-5.6-terra`, `gpt-5.6-luna`). `lib/runCodeNode.js` und `lib/expr.js`
bilden nur die paar n8n-Hilfsvariablen nach, die der Original-Code erwartet
(`$input`, `$json`, `$('NodeName')`, `$now`, `$execution`,
`$getWorkflowStaticData`) — eine Übersetzung der Ausführungsumgebung, keine
Änderung der Logik.

## Sicherheitsdesign: paralleler Testbetrieb ohne Risiko

- **Nur lesend** auf dem gemeinsamen Google Sheet ("Landingpagedaten") —
  es wird nichts markiert/verändert, solange nicht `--live` übergeben wird.
- Schreibt **ausschließlich** nach `lp-preview/_ghtest-<slug>/index.html`,
  niemals in den produktiven `lp-preview/<slug>/`-Pfad.
- Der separate n8n-Workflow **"Landingpages veröffentlichen"** bleibt
  komplett unangetastet — er entscheidet weiterhin, was live geht.
- `data/qa-lektionen.json` ersetzt die n8n Data Table "QA-Lektionen"
  vollständig unabhängig — keine Berührung mit n8n-internen Daten.
- Ausführung nur manuell per Klick (`workflow_dispatch`), kein Zeitplan.

Erst wenn über mehrere Testläufe hinweg die Ergebnisse nachweislich
gleichwertig zum n8n-Ergebnis sind (Migrationsplan Abschnitt 6), wird der
Umstieg auf einen echten Zeitplan + `--live`-Modus (schreibt in den
produktiven Pfad + aktualisiert das Sheet) der nächste Schritt — das ist
noch NICHT Teil dieses ersten Baus.

## Was du noch einrichten musst (2 Secrets)

Dieses Skript kann nicht laufen, ohne dass du zwei Zugangsdaten hinterlegst
— die liegen aus gutem Grund nicht in n8n zur Auslese bereit (Sicherheit),
sondern müssen einmalig neu angelegt werden:

### 1. `OPENAI_API_KEY`

Der OpenAI-API-Key, mit dem `gpt-5.6-terra`/`gpt-5.6-luna` erreichbar sind
(dieselbe Quelle wie n8n-Credential "OpenAI Radacom").

### 2. `GOOGLE_SERVICE_ACCOUNT_JSON`

Ein Google-Service-Account (nicht dieselbe OAuth2-Verbindung wie n8n):

1. In der Google Cloud Console ein Service-Account-Konto anlegen (oder ein
   bestehendes RADACOM-Projekt nutzen), JSON-Schlüssel herunterladen.
2. Die E-Mail-Adresse des Service-Accounts (`...@...iam.gserviceaccount.com`)
   im Google Sheet **"Landingpagedaten"** als Betrachter/Bearbeiter
   freigeben (Teilen-Dialog, wie bei einer normalen Person).
3. Den kompletten Inhalt der heruntergeladenen JSON-Datei (unverändert, als
   ein Textblock) als Secret-Wert hinterlegen.

### Secrets hinterlegen (GitHub-Weboberfläche)

Repo → **Settings → Secrets and variables → Actions → New repository
secret** → Name + Wert eintragen, für beide oben genannten Namen.

Danach: Actions-Tab → "LP-Generator (Test, ohne n8n)" → **Run workflow**.

## Lokal testen (ohne GitHub Actions)

```bash
cd automation/lp-generator
npm install
npm run dry-run     # reine Logik, keine echten API-Aufrufe, keine Secrets nötig
```

Mit echten Secrets lokal (z. B. zum Debuggen):

```bash
export OPENAI_API_KEY=...
export GOOGLE_SERVICE_ACCOUNT_JSON="$(cat pfad/zum/service-account.json)"
node index.js          # Test-Modus (Standard)
```

## Struktur

```
index.js                    Orchestrator — bildet den n8n-Graphen nach
lib/runCodeNode.js           n8n-Kompatibilitäts-Shim ($input/$json/$('Node')/...)
lib/expr.js                  Rendert n8n-{{ }}-Ausdrücke (URLs, Prompts, Sheet-Spalten)
lib/openai.js                Chat-Completion-Aufruf (ersetzt die LangChain-Nodes)
lib/sheets.js                Google-Sheets-Zugriff (ersetzt die Sheets-Nodes)
lib/qaLektionen.js           JSON-Datei statt n8n Data Table "QA-Lektionen"
lib/nodes/*.js                UNVERÄNDERTE Kopien der n8n-Code-Node-Inhalte
lib/prompts/*.txt             UNVERÄNDERTE Kopien der n8n-KI-Prompt-Felder
data/qa-lektionen.json       QA-Lektionen-Speicher (wächst mit jedem Lauf)
test/dry-run.js              Offline-Trockentest der reinen Logik
```
