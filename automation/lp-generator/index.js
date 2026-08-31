#!/usr/bin/env node
'use strict';
/**
 * NIKOS Landingpage-Generator — GitHub-Actions-Portierung des n8n-Workflows
 * "Landingpages erzeugen — Worker stabilisiert" (Workflow-ID 8ApbaHN6gZYrl4ZO).
 *
 * WICHTIG: Dies ist eine Übersetzung der Ausführungsumgebung, keine
 * Neuentwicklung. Jeder inhaltliche Verarbeitungsschritt (Filter/Ranking,
 * Prompt-Texte, HTML-Bau, Feinschliff, SEO-Gate) ist eine unveränderte
 * Kopie des jeweiligen n8n-Node-Codes (siehe lib/nodes/*.js und
 * lib/prompts/*.txt) — nur die Ausführungsumgebung (n8n → dieses Skript)
 * und die Anbindungen (Sheets/GitHub/OpenAI/QA-Lektionen) sind neu.
 * Details: /nikos/Migrationsplan_Landingpage-Generator_ohne-n8n_2026-08-27.md
 *
 * SICHERHEITSDESIGN (siehe README.md):
 *  - Läuft standardmäßig im TEST-MODUS: schreibt NUR nach
 *    lp-preview/_ghtest-<slug>/index.html, NIEMALS in den produktiven
 *    lp-preview/<slug>/-Pfad, und schreibt NICHT ins gemeinsame
 *    Google Sheet zurück (nur lesend). So kann dieser neue Prozess beliebig
 *    oft parallel zum laufenden n8n-Betrieb getestet werden, ohne ihn zu
 *    stören.
 *  - Erst mit dem Flag --live (nach nachgewiesener Gleichwertigkeit,
 *    siehe Migrationsplan Abschnitt 6) schreibt der Lauf in den echten
 *    lp-preview/<slug>/-Pfad und aktualisiert das Sheet.
 */

const fs = require('fs');
const path = require('path');
const { DateTime } = require('luxon');

const { runAllItems, runEachItem, buildNodeRef } = require('./lib/runCodeNode');
const { renderExpr } = require('./lib/expr');
const { chatCompletion } = require('./lib/openai');
const sheets = require('./lib/sheets');
const qaLektionen = require('./lib/qaLektionen');

const REPO_ROOT = path.join(__dirname, '..', '..'); // .../site
const TEXTBAUSTEINE_PATH = path.join(REPO_ROOT, 'nikos', 'LANDINGPAGES_Textbausteine.md');
const PROMPTS_DIR = path.join(__dirname, 'lib', 'prompts');

const LIVE = process.argv.includes('--live');
const executionId = process.env.GITHUB_RUN_ID ? `gha-${process.env.GITHUB_RUN_ID}` : `local-${Date.now()}`;

function log(msg) {
  console.log(`[lp-generator] ${msg}`);
}
function abort(reason) {
  console.error(`[lp-generator] ABBRUCH: ${reason}`);
  process.exitCode = 1;
  throw new Error(reason);
}
function readPrompt(name) {
  return fs.readFileSync(path.join(PROMPTS_DIR, name), 'utf8');
}

async function main() {
  log(`Start (${LIVE ? 'LIVE' : 'TEST'}-Modus), executionId=${executionId}`);
  if (!process.env.OPENAI_API_KEY) abort('OPENAI_API_KEY fehlt (GitHub Secret setzen, siehe README.md).');

  const nodeOutputs = new Map();
  const staticData = {}; // Ersatz für $getWorkflowStaticData('global') — nur für diesen Lauf gültig;
                          // die eigentliche Lauf-Exklusivität übernimmt GitHub Actions' `concurrency:`.
  const render = (tpl, currentJson) =>
    renderExpr(tpl, { $: buildNodeRef(nodeOutputs, 0), $json: currentJson, $now: DateTime.now() });

  // ---- 1) Warteschlange + Stadt-Fakten lesen (gemeinsames Google Sheet, wie n8n) ----
  log('Lese Warteschlange + Stadt-Fakten aus Google Sheet …');
  const warteschlangeItems = await sheets.readSheetAsItems('Warteschlange');
  const stadtFaktenItems = await sheets.readSheetAsItems('Stadt-Fakten');
  nodeOutputs.set('Stadt-Fakten lesen', stadtFaktenItems);
  log(`  Warteschlange: ${warteschlangeItems.length} Zeile(n), Stadt-Fakten: ${stadtFaktenItems.length} Zeile(n).`);

  // ---- 2) Vorab-Begrenzung (Sicherheitscap) ----
  const vorabResult = runAllItems('vorab_begrenzung.js', {
    items: warteschlangeItems, nodeOutputs, staticData, executionId,
  });
  nodeOutputs.set('Vorab-Begrenzung (Sicherheitscap)', vorabResult);

  // ---- 3) Filter + Relevanz-Ranking ----
  const filterResult = runAllItems('filter_relevanz.js', {
    items: vorabResult, nodeOutputs, staticData, executionId,
  });
  nodeOutputs.set('Filter + Relevanz-Ranking', filterResult);
  if (!filterResult.length) {
    log('Keine passende Kombination in der Warteschlange (erstellen=x, slug leer, alle Filter). Nichts zu tun.');
    return;
  }
  log(`  ${filterResult.length} relevante Kombination(en) gefunden, verarbeite die erste.`);

  // ---- 4) Limit (max 1/Lauf) ----
  const limited = runAllItems('limit.js', { items: filterResult, nodeOutputs, staticData, executionId });
  const filterItem = limited[0]; // inhaltsgleich mit filterResult[0] (siehe lib/nodes/limit.js)
  log(`  Ausgewählt: Problem="${filterItem.json.Problem}" / Einsatz="${filterItem.json.Einsatz}" / Region="${filterItem.json.Region}"`);

  // ---- 5) Run Lock & Payload Budget ----
  let lockedItem;
  try {
    lockedItem = runEachItem('run_lock.js', { item: filterItem, nodeOutputs, staticData, executionId });
  } catch (err) {
    abort(`Run Lock: ${err.message}`);
  }

  // ---- 6) Textbausteine laden (jetzt: direkter Dateizugriff statt GitHub-API) ----
  if (!fs.existsSync(TEXTBAUSTEINE_PATH)) abort(`Textbausteine-Datei nicht gefunden: ${TEXTBAUSTEINE_PATH}`);
  const textbausteineContent = fs.readFileSync(TEXTBAUSTEINE_PATH, 'utf8');
  nodeOutputs.set('Textbausteine laden', [{ json: { data: textbausteineContent } }]);

  // ---- 6b) QA-Lektionen laden (Ersatz fuer n8n Data Table "QA-Lektionen", siehe lib/qaLektionen.js) ----
  // BUGFIX: fehlte im urspruenglichen Port -- lib/prompts/nachbesserung.user.txt referenziert
  // $('QA-Lektionen laden'), aber dieser Node-Output wurde nie in nodeOutputs eingetragen, wodurch
  // der Nachbesserung-Zweig mit "Node-Referenz ... nicht verfuegbar" abbrach.
  nodeOutputs.set('QA-Lektionen laden', qaLektionen.loadAsItems());

  // ---- 7) Kontext trimmen ----
  const kontextResult = runAllItems('kontext_trimmen.js', {
    items: [lockedItem], nodeOutputs, staticData, executionId,
  });
  nodeOutputs.set('Kontext trimmen', kontextResult);
  log(`  Kontext getrimmt: ${kontextResult[0].json._context_chars} Zeichen (gekürzt: ${kontextResult[0].json._context_truncated}).`);

  // ---- 8) AI Texte (DE+EN) ----
  log('Rufe OpenAI (gpt-5.6-terra) für AI-Texte auf …');
  const aiTexteSystem = readPrompt('ai-texte.system.txt');
  const aiTexteUser = render(readPrompt('ai-texte.user.txt'), undefined);
  const aiTexteResult = await chatCompletion({
    apiKey: process.env.OPENAI_API_KEY, model: 'gpt-5.6-terra',
    system: aiTexteSystem, user: aiTexteUser, maxTokens: 2600, timeoutMs: 180000, maxRetries: 1,
  });
  nodeOutputs.set('AI Texte (DE+EN)', [aiTexteResult]);

  // ---- 9) Texte JSON ----
  const texteJsonResult = runAllItems('texte_json.js', {
    items: [aiTexteResult], nodeOutputs, staticData, executionId,
  });
  nodeOutputs.set('Texte JSON', texteJsonResult);

  // ---- 10) "Texte ok?" Gate ----
  const texteOk = JSON.stringify(texteJsonResult[0].json.output || texteJsonResult[0].json).includes('headline_de');
  if (!texteOk) {
    abort('Texte-ok?-Prüfung fehlgeschlagen — AI-Texte enthalten kein gültiges headline_de-Feld (entspricht dem n8n-Fehlerpfad "Fehler-Telegram"; hier stattdessen als fehlgeschlagener GitHub-Actions-Lauf sichtbar).');
  }

  // ---- 11) QA-Agent ----
  log('Rufe OpenAI (gpt-5.6-luna) für QA-Prüfung auf …');
  const qaAgentSystem = readPrompt('qa-agent.system.txt');
  const qaAgentUser = render(readPrompt('qa-agent.user.txt'), undefined);
  const qaAgentResult = await chatCompletion({
    apiKey: process.env.OPENAI_API_KEY, model: 'gpt-5.6-luna',
    system: qaAgentSystem, user: qaAgentUser, maxTokens: 2600, timeoutMs: 180000, maxRetries: 1,
  });
  nodeOutputs.set('QA-Agent', [qaAgentResult]);

  // ---- 12) QA JSON ----
  const qaJsonResult = runAllItems('qa_json.js', { items: [qaAgentResult], nodeOutputs, staticData, executionId });
  nodeOutputs.set('QA JSON', qaJsonResult);

  // ---- 13) "Nachbessern?" Gate ----
  const maengel = (qaJsonResult[0].json.output && qaJsonResult[0].json.output._maengel) || [];
  let htmlBauenInput;
  if (maengel.length > 0) {
    log(`  QA-Agent fand ${maengel.length} Mangel/Mängel — Nachbesserung: ${maengel.join(' | ')}`);
    qaLektionen.upsert({
      datum: DateTime.now().toFormat('dd.MM.yyyy'),
      region: filterItem.json.Region,
      einsatz: filterItem.json.Einsatz,
      problem: filterItem.json.Problem,
      mangel: maengel.join(' | '),
    });

    log('Rufe OpenAI (gpt-5.6-terra) für Nachbesserung auf …');
    const nachbesserungUser = render(readPrompt('nachbesserung.user.txt'), qaJsonResult[0].json);
    const nachbesserungResult = await chatCompletion({
      apiKey: process.env.OPENAI_API_KEY, model: 'gpt-5.6-terra',
      system: undefined, // Original-Node hat keine eigene System-Message konfiguriert
      user: nachbesserungUser, maxTokens: 2600, timeoutMs: 180000, maxRetries: 2,
    });
    nodeOutputs.set('Nachbesserung', [nachbesserungResult]);

    const nachbesserungJsonResult = runAllItems('nachbesserung_json.js', {
      items: [nachbesserungResult], nodeOutputs, staticData, executionId,
    });
    nodeOutputs.set('Nachbesserung JSON', nachbesserungJsonResult);
    htmlBauenInput = nachbesserungJsonResult[0];
  } else {
    log('  QA-Agent: keine Mängel.');
    htmlBauenInput = qaJsonResult[0];
  }

  // ---- 14) HTML bauen ----
  const htmlBauenResult = runAllItems('html_bauen.js', {
    items: [htmlBauenInput], nodeOutputs, staticData, executionId,
  });
  nodeOutputs.set('HTML bauen', htmlBauenResult);
  const slug = htmlBauenResult[0].json.slug;
  log(`  HTML gebaut, slug="${slug}"`);

  // ---- 15) Feinschliff ----
  const feinschliffResult = runEachItem('feinschliff.js', {
    item: htmlBauenResult[0], nodeOutputs, staticData, executionId,
  });
  nodeOutputs.set('Feinschliff', [feinschliffResult]);

  // ---- 16) SEO Gate v1 ----
  let seoResult;
  try {
    seoResult = runEachItem('seo_gate.js', { item: feinschliffResult, nodeOutputs, staticData, executionId });
  } catch (err) {
    abort(`SEO-Gate blockiert: ${err.message}`);
  }
  if (seoResult.json.seo_gate === 'warning') {
    log(`  SEO-Gate: WARNUNG — ${(seoResult.json.seo_warnings || []).join(', ')}`);
  } else {
    log('  SEO-Gate: bestanden.');
  }

  // ---- 17) Vorschau schreiben (statt SHA-holen + PUT: direkter Datei-Commit) ----
  const previewSubdir = LIVE ? slug : `_ghtest-${slug}`;
  const targetDir = path.join(REPO_ROOT, 'lp-preview', previewSubdir);
  const targetFile = path.join(targetDir, 'index.html');
  fs.mkdirSync(targetDir, { recursive: true });
  const content = feinschliffResult.json.previewHtml; // identisch zu n8n: previewB64 = base64(previewHtml)
  fs.writeFileSync(targetFile, content, 'utf8');
  const readBack = fs.readFileSync(targetFile, 'utf8');
  if (readBack !== content) abort(`Integritätsprüfung fehlgeschlagen beim Schreiben von ${targetFile}`);
  log(`  Vorschau geschrieben: lp-preview/${previewSubdir}/index.html (${content.length} Zeichen, Integrität geprüft).`);

  // ---- 18) Ergebnis ins Sheet (nur im --live-Modus) ----
  if (LIVE) {
    await sheets.updateRowByRowNumber('Keywordkombinationen', seoResult.json.row_number, {
      Relevanz: seoResult.json.relevanz,
      slug: seoResult.json.slug,
      pfad: seoResult.json.pfad,
      erstellt_am: seoResult.json.erstellt_am,
      Problem: seoResult.json.Problem,
      Einsatz: seoResult.json.Einsatz,
      Region: seoResult.json.Region,
    });
    log('  Sheet "Keywordkombinationen" aktualisiert (Zeile ' + seoResult.json.row_number + ').');
  } else {
    log(`  TEST-Modus: Sheet-Update übersprungen (würde Zeile ${seoResult.json.row_number} als erledigt markieren).`);
  }

  // ---- 19) Lock freigeben (Logging-Parität; echte Exklusivität übernimmt GH Actions concurrency) ----
  runEachItem('lock_freigeben.js', {
    item: { json: { error: false } }, nodeOutputs, staticData, executionId,
  });

  log(`FERTIG (${LIVE ? 'LIVE' : 'TEST'}): ${slug} → lp-preview/${previewSubdir}/index.html`);
}

main().catch((err) => {
  console.error('[lp-generator] Lauf abgebrochen:', err.message);
  process.exitCode = process.exitCode || 1;
});
