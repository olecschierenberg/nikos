#!/usr/bin/env node
'use strict';
/**
 * NIKOS Einmal-Reparaturskript (2026-09-09, Nutzer-Auftrag nach Diagnose
 * per diagnose-sheet-states.js / Lauf 34337400854):
 *
 * 12 Zeilen im Tab "Keywordkombinationen" hatten VON HAND (nicht durch die
 * Pipeline, die diesen Zustand nie selbst erzeugt) erstellen=x, deploy=x
 * UND aktiv=x bei komplett leerem slug/pfad/erstellt_am gesetzt.
 *
 * Risiko: diese Zeilen matchen den lp-generator-Grundfilter
 * (erstellen=x & slug leer) und werden normal generiert -- aber sobald
 * slug befuellt ist, verhindert das schon gesetzte aktiv=x, dass
 * lp-publish sie jemals live schaltet (dessen Filter verlangt aktiv LEER).
 * Ergebnis waere eine Seite, die für immer unsichtbar in lp-preview/
 * haengen bleibt.
 *
 * Fix: NUR die Spalte "aktiv" bei genau diesen Zeilen leeren (erstellen
 * und deploy bleiben unangetastet) -- damit lp-publish sie nach der
 * Generierung normal aufgreifen und live schalten kann.
 *
 * Sicherheitsfilter (bewusst eng, um NUR die bekannte Anomalie zu treffen):
 * erstellen=x & deploy=x & aktiv=x & slug leer & pfad leer & erstellt_am leer.
 *
 * Aufruf: node fix-stray-aktiv-flags.js (Dry-Run) / --live (schreibt wirklich)
 */

const sheets = require('../lib/sheets.js');

const LIVE = process.argv.includes('--live');
const SHEET_NAME = 'Keywordkombinationen';

function norm(v) { return String(v || '').trim(); }
function low(v) { return norm(v).toLowerCase(); }

function log(msg) { console.log(`[fix-stray-aktiv-flags] ${msg}`); }

async function main() {
  console.log(`Modus: ${LIVE ? 'LIVE (schreibt wirklich)' : 'DRY-RUN (schreibt NICHTS, nur Vorschau)'}`);

  const rows = await sheets.readSheetAsItems(SHEET_NAME);
  log(`${rows.length} Zeile(n) im Sheet "${SHEET_NAME}" gelesen.`);

  const targets = rows.filter((r) => {
    const j = r.json;
    return low(j.erstellen) === 'x'
      && low(j.deploy) === 'x'
      && low(j.aktiv) === 'x'
      && norm(j.slug) === ''
      && norm(j.pfad) === ''
      && norm(j.erstellt_am) === '';
  });

  log(`${targets.length} betroffene Zeile(n) gefunden (erwartet: 12).`);
  for (const r of targets) {
    const j = r.json;
    log(`  Zeile ${j.row_number}: Problem="${j.Problem || ''}" Einsatz="${j.Einsatz || ''}" Region="${j.Region || ''}" -- aktiv "x" -> "" (erstellen/deploy bleiben "x")`);
  }

  if (LIVE) {
    for (const r of targets) {
      await sheets.updateRowByRowNumber(SHEET_NAME, r.json.row_number, { aktiv: '' });
      log(`  Zeile ${r.json.row_number}: GESCHRIEBEN (aktiv geleert).`);
    }
  } else {
    log('(TEST) wuerde alle oben gelisteten Zeilen schreiben.');
  }

  console.log('\n---- Fertig ----');
  console.log(`${targets.length} Zeile(n) ${LIVE ? 'aktualisiert' : 'wuerden aktualisiert'}.`);
  if (!LIVE) console.log('Dies war ein DRY-RUN. Zum wirklichen Ausfuehren erneut mit --live aufrufen.');
}

main().catch((err) => { console.error('FEHLER:', err); process.exit(1); });
