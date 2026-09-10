#!/usr/bin/env node
'use strict';
/**
 * NIKOS Diagnose-Skript (2026-09-10, rein lesend):
 * Dumpt die exakten Spaltennamen (Header) der Tabs "Stadt-Fakten" und
 * "Keywordkombinationen" sowie die aktuelle Tuebingen-Zeile und eine evtl.
 * noch vorhandene Sindelfingen/Internationales-Strassenfest-Zeile, als
 * Vorbereitung fuer:
 * 1) Vervollstaendigung der Stadt-Fakten fuer Tuebingen
 * 2) Neue Keywordkombinationen-Zeile fuer die wiederherzustellende
 *    ISF-Sindelfingen-Landingpage
 * Schreibt NICHTS.
 */

const sheets = require('../lib/sheets.js');

function norm(v) { return String(v || '').trim(); }

async function main() {
  const sf = await sheets.readSheetAsItems('Stadt-Fakten');
  console.log(`Stadt-Fakten: ${sf.length} Zeile(n).`);
  if (sf.length) {
    console.log('Header (Spaltennamen):', Object.keys(sf[0].json).join(' | '));
  }
  const tue = sf.find(r => norm(r.json.Region).toLowerCase() === 'tübingen' || norm(r.json.Region).toLowerCase() === 'tuebingen');
  if (tue) {
    console.log(`\nTuebingen-Zeile (row_number ${tue.json.row_number}):`);
    for (const [k, v] of Object.entries(tue.json)) console.log(`  ${k} = "${v}"`);
  } else {
    console.log('\nTuebingen-Zeile: NICHT gefunden.');
  }

  const kk = await sheets.readSheetAsItems('Keywordkombinationen');
  console.log(`\nKeywordkombinationen: ${kk.length} Zeile(n).`);
  if (kk.length) {
    console.log('Header (Spaltennamen):', Object.keys(kk[0].json).join(' | '));
  }
  const sindelfingen = kk.filter(r => norm(r.json.Region).toLowerCase() === 'sindelfingen');
  console.log(`\nZeilen mit Region="Sindelfingen": ${sindelfingen.length}`);
  for (const r of sindelfingen) {
    console.log(`  row_number ${r.json.row_number}: Problem="${r.json.Problem}" Einsatz="${r.json.Einsatz}" erstellen="${r.json.erstellen}" deploy="${r.json.deploy}" aktiv="${r.json.aktiv}" slug="${r.json.slug}" pfad="${r.json.pfad}"`);
  }

  console.log('\n---- Fertig (rein lesend, nichts geschrieben) ----');
}

main().catch((err) => { console.error('FEHLER:', err); process.exit(1); });
