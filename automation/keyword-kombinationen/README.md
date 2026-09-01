# NIKOS Keyword-Kombinationserstellung — GitHub-Actions-Portierung (ohne n8n)

Ersetzt schrittweise den n8n-Workflow **"Keyword-Kombinationen"**
(Workflow-ID `IfVqfMX9aFoqbCOq`, aktiv, täglich 23:13 Uhr) durch ein
Node.js-Skript, das in GitHub Actions läuft. Hintergrund und der
vollständige Migrationsplan stehen in
`/nikos/Migrationsplan_Keywordkombis-und-Veroeffentlichung_ohne-n8n_2026-08-28.md`.

## Wie fertig ist das?

**Fertig gebaut, noch nicht getestet.** Der komplette Code steht, die
reine Verarbeitungslogik (Vorrat/Ausschluss aufbereiten, Dedup/Unmöglich-
Filter/Relevanz-Scoring) ist mit synthetischen Testdaten erfolgreich
durchgelaufen (`npm run dry-run`, ohne echte API-Aufrufe). Ein echter Lauf
mit echten Daten/Kosten (Google Sheet, OpenAI, Brevo) steht noch aus —
dafür fehlen die drei Secrets unten. Der laufende n8n-Betrieb ist davon
**nicht berührt**.

## Warum das inhaltlich dasselbe Ergebnis liefert

Die beiden Rechenschritte (`lib/nodes/vorrat_ausschluss.js`,
`lib/nodes/relevanz_berechnen.js`) sind **unveränderte Kopien** des
jeweiligen n8n-Node-Codes, direkt aus dem aktiven Workflow ausgelesen —
keine Neuentwicklung "nach bestem Wissen". Ebenso der System-Prompt für
die KI-Vorschläge (`lib/prompts/kombinationen-vorschlagen.system.txt`,
Regeln 1–11 unverändert) und dasselbe Modell (`gpt-5.4-mini`).

**Eine bewusste Abweichung** (keine 1:1-Kopie, weil mechanisch nicht
möglich): n8n injiziert bei einem konfigurierten "Structured Output
Parser" automatisch eine Formatierungsanweisung in den Prompt und parst
die Antwort gegen ein festes Schema (`{ kombinationen: [{ Problem,
Einsatz, Region }] }`). Ein direkter OpenAI-API-Aufruf hat das nicht
eingebaut — deshalb steht die JSON-Ausgabeanweisung explizit am Ende des
System-Prompts, und `response_format: "json_object"` + `JSON.parse()`
(`lib/openai.js`) übernehmen dieselbe Aufgabe. Gleiches Modell, gleicher
inhaltlicher Prompt, gleiches Zielschema — nur der Mechanismus, der die
JSON-Form erzwingt, ist notwendigerweise anders gebaut.

**Ein gefundener Fehler in der n8n-Vorlage, hier bewusst korrigiert:** Der
Mailtext der n8n-Node "Vorschlags-Mail (Brevo)" bittet darum, Zeilen in
der Spalte **"freigeben"** zu markieren — tatsächlich prüft die
Freigabe-Logik aber die Spalte **"erstellen"** (so schreibt es auch der
n8n-Append-Node "Vorschläge ins Sheet", und so liest es der LP-Generator-
Worker). `lib/brevo.js` verwendet hier den korrekten Spaltennamen
"erstellen" statt der veralteten Mailtext-Formulierung — das ändert keine
Logik, nur einen irreführenden Hinweistext.

## Sicherheitsdesign: paralleler Testbetrieb ohne Risiko

Dieser Baustein ist von den drei Migrationsteilen der **risikoärmste**:
Er schreibt zu keinem Zeitpunkt auf die Website oder nach GitHub.

- **Nur lesend** auf dem gemeinsamen Google Sheet ("Landingpagedaten"),
  solange nicht `--live` übergeben wird.
- Ohne `--live`: kein Sheet-Append, keine Sortierung —
  das Skript loggt nur, was es tun *würde*.
- Ausführung nur manuell per Klick (`workflow_dispatch`), kein Zeitplan.
- Selbst im `--live`-Modus ist der Blast-Radius klein: es werden nur
  **unfreigegebene** Vorschlagszeilen angehängt (Spalte "erstellen" bleibt
  leer) — ohne manuelle Freigabe im Sheet wirkt keine davon irgendwo.

Erst wenn über mehrere Testläufe hinweg die Ergebnisse nachweislich
plausibel/gleichwertig zum n8n-Ergebnis sind, wird ein echter Zeitplan
(täglich, wie aktuell in n8n) der nächste Schritt.

## Was du noch einrichten musst (2 Secrets)

### 1. `OPENAI_API_KEY`
Kann derselbe wie beim LP-Generator sein (`automation/lp-generator`).

### 2. `GOOGLE_SERVICE_ACCOUNT_JSON`
Ebenfalls derselbe Service-Account wie beim LP-Generator, falls dort schon
eingerichtet — er braucht ohnehin Zugriff auf dasselbe Sheet
"Landingpagedaten". Siehe `automation/lp-generator/README.md`, Abschnitt
"Was du noch einrichten musst", Punkt 2, für die Einrichtung von Grund auf.

**Hinweis Fehler-Benachrichtigung:** Diese Automatisierung verschickt keine
E-Mail mehr bei neuen Kombinationen. Stattdessen sendet die GitHub-Action-
Datei `keyword-kombinationen.yml` bei einem fehlgeschlagenen Lauf automatisch
eine Telegram-Nachricht (Secrets `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`,
gemeinsam mit den anderen drei Automatisierungen genutzt, siehe
`/nikos/project_memory.md`).

### Secrets hinterlegen (GitHub-Weboberfläche)

Repo → **Settings → Secrets and variables → Actions → New repository
secret** → Name + Wert eintragen, für alle drei oben genannten Namen.

Danach: Actions-Tab → "Keyword-Kombinationen (Test, ohne n8n)" →
**Run workflow**.

## Lokal testen (ohne GitHub Actions)

```bash
cd automation/keyword-kombinationen
npm install
npm run dry-run     # reine Logik, keine echten API-Aufrufe, keine Secrets nötig
```

Mit echten Secrets lokal (z. B. zum Debuggen):

```bash
export OPENAI_API_KEY=...
export GOOGLE_SERVICE_ACCOUNT_JSON="$(cat pfad/zum/service-account.json)"
node index.js          # Test-Modus (Standard, kein Schreibzugriff)
node index.js --live   # schreibt wirklich ins Sheet
```

## Struktur

```
index.js                          Orchestrator — bildet den n8n-Graphen nach
lib/runCodeNode.js                 n8n-Kompatibilitäts-Shim ($input/$json/$('Node')/...)
lib/expr.js                        Rendert n8n-{{ }}-Ausdrücke (User-Prompt)
lib/openai.js                      Strukturierter OpenAI-Aufruf (ersetzt LangChain-Agent+Parser)
lib/sheets.js                      Google-Sheets-Zugriff (lesen/anhängen/sortieren)
lib/nodes/vorrat_ausschluss.js      UNVERÄNDERTE Kopie des n8n-Code-Node-Inhalts
lib/nodes/relevanz_berechnen.js     UNVERÄNDERTE Kopie des n8n-Code-Node-Inhalts
lib/prompts/*.txt                   System-/User-Prompt (Regeln unverändert aus n8n)
test/dry-run.js                     Offline-Trockentest der reinen Logik
```
