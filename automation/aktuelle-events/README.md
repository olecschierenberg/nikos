# NIKOS Aktuelle-Events-Recherche — GitHub-Actions-Portierung (ohne n8n)

Ersetzt den n8n-Workflow **"Aktuelle Events"** (Workflow-ID
`8xWFAzCU5aU0DNuM`, biwoechentlicher Cron 1./15.). Recherchiert per
OpenAI-Websuche kommende Grossveranstaltungen und aktualisiert die Spalten
"Aktuell"/"Events" im Tab "Stadt-Fakten" der Tabelle "Landingpagedaten".

## Was neu ist ggue. dem n8n-Original

Auf ausdruecklichen Wunsch ("aktuell gibt es noch sehr wenige
Auslandsevents, sorge dafuer, dass zukuenftig mehr gesucht und gefunden
werden", 2026-08-31):

- **Woechentlich statt biwoechentlich.** Montags = DE+AT (Kernmaerkte),
  donnerstags = eine Auslandsgruppe.
- **Rotierende Kleingruppen statt einer einzigen Riesen-Anfrage.** Das
  n8n-Original durchsuchte am 15. alle ~30 uebrigen erlaubten Laender in
  EINER Anfrage -- das ergibt pro Land nur eine sehr oberflaechliche
  Websuche. Dieser Port teilt die Laender in Gruppen von ca. 6 auf
  (`GROUP_SIZE` in `index.js`) und durchsucht pro Donnerstagslauf nur eine
  Gruppe, rotierend nach ISO-Kalenderwoche -- pro Land bleibt so mehr
  "Suchbudget" (Tool-Iterationen des Modells) uebrig.
- **Explizite Auslands-Anweisung im Prompt.** `lib/prompts/aktuelle-
  events.user.txt` traegt dem Modell fuer Nicht-DE/AT-Laeufe ausdruecklich
  auf, pro Land mehrere gezielte Suchanfragen zu stellen statt vorschnell
  abzubrechen (Abschnitt "DIESER LAUF IST EIN AUSLANDS-LAUF").

Inhaltlich (Kriterien fuer "aktuell" vs. "Events", Loesch-/Ablaufregeln,
Antwortschema) ist alles andere eine unveraenderte Kopie des n8n-Prompts.

## Noch offen: erster echter Testlauf

Diese Automatisierung wurde noch **nicht** live gegen die echte OpenAI-
Responses-API mit Websuche getestet (anders als keyword-kombinationen und
lp-generator, die bereits mehrfach erfolgreich per `workflow_dispatch`
verifiziert wurden). Vor dem ersten geplanten Lauf unbedingt einmal
manuell ueber Actions -> "Aktuelle Events" -> Run workflow (ohne --live,
Standard-TEST-Modus ruft die KI trotzdem auf, schreibt aber nichts ins
Sheet) ausloesen und die Logs pruefen -- insbesondere ob der
`web_search`-Tool-Typ vom Modell akzeptiert wird (Fallback auf
`web_search_preview` ist eingebaut, siehe `lib/openaiWebSearch.js`).

## Sicherheitsdesign

- **TEST-Modus (Standard):** ruft OpenAI ganz normal auf (Websuche kostet
  in beiden Modi gleich viel), schreibt aber NICHTS ins Sheet -- nur
  Logging.
- **`--live`:** schreibt neue/aktualisierte Zeilen in "Stadt-Fakten" und
  sortiert das Blatt neu (wie im n8n-Original).

## Secrets

`OPENAI_API_KEY` und `GOOGLE_SERVICE_ACCOUNT_JSON` -- dieselben wie bei
`automation/keyword-kombinationen` und `automation/lp-generator`, sollten
also als Repo-Secrets bereits vorhanden sein.

## Lokal testen

```bash
cd automation/aktuelle-events
npm install
export OPENAI_API_KEY="..."
export GOOGLE_SERVICE_ACCOUNT_JSON="$(cat pfad/zum/service-account.json)"
node index.js                    # TEST, Scope "core" (Default ohne --scope)
node index.js --scope=foreign    # TEST, Auslandsgruppe (aktuelle Kalenderwoche)
node index.js --live             # schreibt wirklich
```

## Struktur

```
index.js                              Orchestrator + Sheet-Stand/Rotation/Merge-Logik (Code-Node-Ports)
lib/sheets.js                          Google-Sheets-Zugriff (Stadt-Fakten: lesen/anhaengen/aktualisieren/sortieren)
lib/openaiWebSearch.js                 OpenAI-Responses-API-Aufruf MIT Websuche-Tool
lib/prompts/aktuelle-events.system.txt System-Prompt (1:1 aus n8n)
lib/prompts/aktuelle-events.user.txt   User-Prompt (1:1 aus n8n + neuer Auslands-Absatz, siehe oben)
```
