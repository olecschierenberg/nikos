#!/usr/bin/env node
'use strict';
/**
 * NIKOS Keyword-Kombinationserstellung — GitHub-Actions-Portierung des
 * n8n-Workflows "Keyword-Kombinationen" (Workflow-ID IfVqfMX9aFoqbCOq,
 * Stufe A, aktiv, täglich 23:13 Uhr).
 *
 * Ablauf (1:1 aus dem n8n-Workflow, siehe Connections dort):
 *   Stadt-Fakten lesen A -> Keywordpool lesen -> Vorhandene Kombis lesen
 *   -> Vorrat + Ausschluss aufbereiten (Code) -> Kombinationen vorschlagen
 *   (KI) -> In Zeilen aufteilen -> Relevanz berechnen (Code)
 *   -> Vorschläge ins Sheet -> Vorschlags-Mail (Brevo) -> Blatt sortieren.
 *
 * Details/Migrationsplan: /nikos/Migrationsplan_Keywordkombis-und-
 * Veroeffentlichung_ohne-n8n_2026-08-28.md
 *
 * SICHERHEITSDESIGN (siehe README.md):
 *  - Dieser Workflow schreibt NIE auf die Website oder nach GitHub — nur
 *    unfreigegebene Vorschlagszeilen ins gemeinsame Google Sheet + eine
 *    Info-Mail. Trotzdem: Standardmäßig TEST-MODUS (kein Sheet-Write, keine
 *    Mail) — erst mit --live werden Zeilen wirklich angehängt/sortiert und
 *    die Mail verschickt.
 */

const path = require('path');
const { DateTime } = require('luxon');

const { runAllItems, buildNodeRef } = require('./lib/runCodeNode');
const { renderExpr } = require('./lib/expr');
const { chatCompletionJson } = require('./lib/openai');
const { sendVorschlagsMail } = require('./lib/brevo');
const sheets = require('./lib/sheets');

const PROMPTS_DIR = path.join(__dirname, 'lib', 'prompts');
const fs = require('fs');
const LIVE = process.argv.includes('--live');
const executionId = process.env.GITHUB_RUN_ID ? `gha-${process.env.GITHUB_RUN_ID}` : `local-${Date.now()}`;
const SHEET_TAB = 'Keywordkombinationen';
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${sheets.SPREADSHEET_ID}/edit`;

function log(msg) {
  console.log(`[keyword-kombinationen] ${msg}`);
}
function abort(reason) {
  console.error(`[keyword-kombinationen] ABBRUCH: ${reason}`);
  process.exitCode = 1;
  throw new Error(reason);
}
function readPrompt(name) {
  return fs.readFileSync(path.join(PROMPTS_DIR, name), 'utf8');
}

async function main() {
  log(`Start (${LIVE ? 'LIVE' : 'TEST'}-Modus), executionId=${executionId}`);
  if (!process.env.OPENAI_API_KEY) abort('OPENAI_API_KEY fehlt (GitHub Secret setzen, siehe README.md).');
  if (LIVE && !process.env.BREVO_API_KEY) abort('BREVO_API_KEY fehlt (für --live nötig, siehe README.md).');

  const nodeOutputs = new Map();
  const staticData = {};
  const render = (tpl, currentJson) =>
    renderExpr(tpl, { $: buildNodeRef(nodeOutputs, 0), $json: currentJson, $now: DateTime.now() });

  // ---- 1) Stadt-Fakten / Keywordpool / Vorhandene Kombis lesen ----
  log('Lese Stadt-Fakten, Keywordpool, vorhandene Kombinationen aus Google Sheet …');
  const stadtFaktenItems = await sheets.readSheetAsItems('Stadt-Fakten');
  const keywordpoolItems = await sheets.readSheetAsItems('Keywordpool');
  const vorhandeneKombisItems = await sheets.readSheetAsItems(SHEET_TAB);
  nodeOutputs.set('Stadt-Fakten lesen A', stadtFaktenItems);
  nodeOutputs.set('Keywordpool lesen', keywordpoolItems);
  nodeOutputs.set('Vorhandene Kombis lesen', vorhandeneKombisItems);
  log(`  Stadt-Fakten: ${stadtFaktenItems.length}, Keywordpool: ${keywordpoolItems.length}, vorhandene Kombis: ${vorhandeneKombisItems.length}.`);

  // ---- 2) Vorrat + Ausschluss aufbereiten (Code, 1:1 aus n8n) ----
  const vorratResult = runAllItems('vorrat_ausschluss.js', {
    items: keywordpoolItems, nodeOutputs, staticData, executionId,
  });
  nodeOutputs.set('Vorrat + Ausschluss aufbereiten', vorratResult);
  const vorrat = vorratResult[0].json;
  log(`  Vorrat aufbereitet: ${vorrat.probleme.length} Probleme, ${vorrat.einsaetze.length} Einsätze, ${vorrat.regionen.length} Regionen, Zielanzahl ${vorrat.zielanzahl}.`);

  // ---- 3) Kombinationen vorschlagen (KI, gpt-5.4-mini, strukturierte JSON-Ausgabe) ----
  log('Rufe OpenAI (gpt-5.4-mini) für neue Kombinationsvorschläge auf …');
  const system = readPrompt('kombinationen-vorschlagen.system.txt');
  const user = render(readPrompt('kombinationen-vorschlagen.user.txt'), vorrat);
  const aiResult = await chatCompletionJson({
    apiKey: process.env.OPENAI_API_KEY, model: 'gpt-5.4-mini',
    system, user, timeoutMs: 120000, maxRetries: 2,
  });
  nodeOutputs.set('Kombinationen vorschlagen', [{ json: { output: aiResult } }]);
  log(`  KI liefert ${aiResult.kombinationen.length} Vorschläge.`);

  // ---- 4) In Zeilen aufteilen (splitOut auf output.kombinationen) ----
  const zeilenItems = aiResult.kombinationen.map((k) => ({ json: k }));
  nodeOutputs.set('In Zeilen aufteilen', zeilenItems);

  // ---- 5) Relevanz berechnen (Code, 1:1 aus n8n — Dedup + Unmöglich-Filter + Scoring) ----
  const relevanzResult = runAllItems('relevanz_berechnen.js', {
    items: zeilenItems, nodeOutputs, staticData, executionId,
  });
  nodeOutputs.set('Relevanz berechnen', relevanzResult);
  log(`  Nach Dedup/Plausibilitätsfilter: ${relevanzResult.length} von ${zeilenItems.length} Vorschlägen übrig.`);
  if (!relevanzResult.length) {
    log('  Keine neuen Kombinationen nach Filterung. Nichts zu tun.');
    return;
  }
  for (const it of relevanzResult) {
    log(`    - ${it.json.Problem} | ${it.json.Einsatz} | ${it.json.Region} (Relevanz ${it.json.Relevanz}${it.json.Ende ? ', Ende ' + it.json.Ende : ''})`);
  }

  // ---- 6) Vorschläge ins Sheet (append, Spalten Problem/Einsatz/Region/erstellen/Relevanz/Ende) ----
  const rowsToAppend = relevanzResult.map((it) => ({
    Problem: it.json.Problem,
    Einsatz: it.json.Einsatz,
    Region: it.json.Region,
    erstellen: '',
    Relevanz: it.json.Relevanz,
    Ende: it.json.Ende,
  }));
  if (LIVE) {
    await sheets.appendRows(SHEET_TAB, rowsToAppend);
    log(`  ${rowsToAppend.length} Zeile(n) in Sheet "${SHEET_TAB}" angehängt (Spalte "erstellen" leer, wartet auf Freigabe).`);
  } else {
    log(`  TEST-Modus: Sheet-Append übersprungen (würde ${rowsToAppend.length} Zeile(n) anhängen).`);
  }

  // ---- 7) Vorschlags-Mail (Brevo) ----
  if (LIVE) {
    await sendVorschlagsMail({ apiKey: process.env.BREVO_API_KEY, sheetUrl: SHEET_URL });
    log('  Vorschlags-Mail an o.schierenberg@radacom.de verschickt.');
  } else {
    log('  TEST-Modus: Brevo-Mail übersprungen.');
  }

  // ---- 8) Blatt sortieren (Relevanz), absteigend — Spalte J = Index 9, A:K = 11 Spalten, 1:1 aus n8n ----
  if (LIVE) {
    await sheets.sortByRelevanceDesc(SHEET_TAB, 9, 11);
    log('  Sheet nach Relevanz absteigend sortiert.');
  } else {
    log('  TEST-Modus: Sortierung übersprungen.');
  }

  log(`FERTIG (${LIVE ? 'LIVE' : 'TEST'}): ${rowsToAppend.length} neue Kombination(en) verarbeitet.`);
}

main().catch((err) => {
  console.error('[keyword-kombinationen] Lauf abgebrochen:', err.message);
  process.exitCode = process.exitCode || 1;
});
