#!/usr/bin/env node
'use strict';
/**
 * NIKOS Ablauf-Check — GitHub-Actions-Portierung des zweiten Zweigs des
 * n8n-Workflows "Landingpages veröffentlichen" (VJaUw0kTrsO17iHX),
 * Nodes "Monatlich (Ablauf)" -> "Kombis lesen (Ablauf)" -> "Ablauf
 * prüfen" -> "Sheet abgelaufen markieren". Läuft bewusst als eigenes
 * Skript/eigener Workflow, nicht zusammen mit index.js (siehe
 * Migrationsplan Teil 2, Abschnitt 4.3 — "sauberer getrennt als in n8n").
 *
 * Markiert Zeilen mit abgelaufenem "Ende"-Datum (MM.YYYY) als
 * aktiv=abgelaufen — löscht NICHTS, siehe lib/nodes/ablauf_pruefen.js
 * (1:1 unveränderte Kopie des n8n-Node-Codes) für die genaue Logik
 * inkl. Referenz-Schutzliste.
 *
 * SICHERHEITSDESIGN: Standardmäßig TEST-MODUS (nur Log-Ausgabe, kein
 * Sheet-Write). Erst --live schreibt wirklich.
 */

const { runAllItems } = require('./lib/runCodeNode');
const sheets = require('./lib/sheets');

const LIVE = process.argv.includes('--live');
const executionId = process.env.GITHUB_RUN_ID ? `gha-${process.env.GITHUB_RUN_ID}` : `local-${Date.now()}`;
const SHEET_TAB = 'Keywordkombinationen';

function log(msg) {
  console.log(`[lp-publish:ablauf] ${msg}`);
}

async function main() {
  log(`Start (${LIVE ? 'LIVE' : 'TEST'}-Modus), executionId=${executionId}`);
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    console.error('[lp-publish:ablauf] ABBRUCH: GOOGLE_SERVICE_ACCOUNT_JSON fehlt (siehe README.md).');
    process.exitCode = 1;
    return;
  }

  const items = await sheets.readSheetAsItems(SHEET_TAB);
  log(`  ${items.length} Zeile(n) im Sheet "${SHEET_TAB}" gelesen.`);

  const toMark = runAllItems('ablauf_pruefen.js', {
    items, nodeOutputs: new Map(), staticData: {}, executionId,
  });

  if (!toMark.length) {
    log('  Keine neu abgelaufenen Kombinationen gefunden.');
    return;
  }

  log(`  ${toMark.length} Kombination(en) als abgelaufen zu markieren:`);
  for (const it of toMark) {
    log(`    - Zeile ${it.json.row_number}: ${it.json._info}`);
  }

  if (LIVE) {
    for (const it of toMark) {
      await sheets.updateRowByRowNumber(SHEET_TAB, it.json.row_number, { aktiv: it.json.aktiv });
    }
    log(`  FERTIG (LIVE): ${toMark.length} Zeile(n) auf aktiv=abgelaufen gesetzt.`);
  } else {
    log(`  TEST-Modus: Sheet-Update übersprungen.`);
  }
}

main().catch((err) => {
  console.error('[lp-publish:ablauf] Lauf abgebrochen:', err.message);
  process.exitCode = process.exitCode || 1;
});
