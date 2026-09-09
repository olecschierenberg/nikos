#!/usr/bin/env node
'use strict';
/**
 * NIKOS Einmal-Check-Skript (2026-09-09, autonomes Monitoring, rein lesend):
 * Prueft den aktuellen Sheet-Stand aller Zeilen, deren Einsatz/Region auf
 * "Sail Amsterdam 2030"/"Amsterdam" passt (Zeilennummern sind wegen des
 * taeglichen Relevanz-Sortierlaufs NICHT stabil -- inhaltsbasierte Suche).
 * Zweck: pruefen, ob die per fix-en-slug-full-reset.js zurueckgesetzte
 * Zeile (urspruenglich "besucherlenkung-sail-amsterdam-2030") inzwischen
 * neu generiert wurde -- UND ob es dabei zu einer Kollision/einem
 * Duplikat mit der bereits live stehenden Seite
 * (visitor-guidance-sail-amsterdam-2030, siehe Teil 2/3 im Memory) kommt.
 * Schreibt NICHTS.
 */

const sheets = require('../lib/sheets.js');

const SHEET_NAME = 'Keywordkombinationen';

function norm(v) { return String(v || '').trim(); }
function low(v) { return norm(v).toLowerCase(); }

async function main() {
  const rows = await sheets.readSheetAsItems(SHEET_NAME);
  console.log(`Gesamt: ${rows.length} Zeile(n) im Tab "${SHEET_NAME}".`);

  const matches = rows.filter((r) => {
    const j = r.json;
    return low(j.Einsatz).includes('sail amsterdam') || low(j.Region).includes('amsterdam');
  });

  console.log(`\n${matches.length} Zeile(n) mit Bezug zu Sail Amsterdam/Amsterdam gefunden:\n`);
  for (const r of matches) {
    const j = r.json;
    console.log(`Zeile ${j.row_number}: Problem="${j.Problem || ''}" Einsatz="${j.Einsatz || ''}" Region="${j.Region || ''}" erstellen="${j.erstellen || ''}" deploy="${j.deploy || ''}" aktiv="${j.aktiv || ''}" slug="${j.slug || ''}" pfad="${j.pfad || ''}" erstellt_am="${j.erstellt_am || ''}"`);
  }
}

main().catch((err) => { console.error('FEHLER:', err); process.exit(1); });
