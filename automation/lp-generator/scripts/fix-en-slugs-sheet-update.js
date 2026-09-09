#!/usr/bin/env node
'use strict';
/**
 * NIKOS Einmal-Reparaturskript (2026-09-09, Teil 4 des EN-Slug-Bugfixes):
 * Der Batch-Rename (fix-en-slugs-batch-rename.js/.yml, Commit 4338024) hat
 * die 4 betroffenen Auslands-LPs direkt im Repo auf ihren korrekten
 * englischen Slug umgezogen und an der alten URL einen Redirect-Stub
 * hinterlassen -- das war eine reine Datei-Operation OHNE Sheet-Zugriff.
 * Die Google-Sheet-Spalten "slug" und "pfad" (Tab "Keywordkombinationen")
 * zeigen fuer diese 4 Zeilen deshalb noch den ALTEN deutschen Slug bzw. die
 * alte URL -- das ist jetzt nur noch Buchfuehrung (der Pipeline-Code liest
 * diese Werte nicht fuers Routing), aber fuer Nachvollziehbarkeit und
 * zukuenftige Audits soll das Sheet den tatsaechlichen Live-Zustand zeigen.
 *
 * Dieses Skript sucht pro Mapping die Zeile, deren "slug"-Spalte noch den
 * ALTEN Slug traegt, und ueberschreibt slug+pfad mit den neuen, korrekten
 * Werten (loescht damit faktisch den alten Slug aus dem Sheet).
 *
 * Aufruf: node fix-en-slugs-sheet-update.js (Dry-Run) / --live (schreibt wirklich)
 */

const sheets = require('../lib/sheets.js');

const LIVE = process.argv.includes('--live');
const SHEET_NAME = 'Keywordkombinationen';
const BASE_URL = 'https://nikos.info';

const MAPPINGS = [
  { oldSlug: 'besucherinformation-sail-amsterdam-2030', newSlug: 'visitor-information-sail-amsterdam-2030' },
  { oldSlug: 'besucherlenkung-sail-amsterdam-2030', newSlug: 'visitor-guidance-sail-amsterdam-2030' },
  { oldSlug: 'besuchersicherheit-gentse-feesten', newSlug: 'visitor-safety-gentse-feesten' },
  { oldSlug: 'unwetterwarnung-sail-amsterdam-2030', newSlug: 'weather-warning-sail-amsterdam-2030' },
];

function log(msg) { console.log(`[fix-en-slugs-sheet-update] ${msg}`); }

async function main() {
  console.log(`Modus: ${LIVE ? 'LIVE (schreibt wirklich)' : 'DRY-RUN (schreibt NICHTS, nur Vorschau)'}`);

  const rows = await sheets.readSheetAsItems(SHEET_NAME);

  let updated = 0;
  let missing = 0;
  for (const m of MAPPINGS) {
    const row = rows.find((r) => String(r.json.slug || '').trim() === m.oldSlug);
    if (!row) {
      log(`NICHT GEFUNDEN: keine Zeile mit slug="${m.oldSlug}" -- vermutlich schon aktualisiert oder Zustand hat sich geaendert. Uebersprungen.`);
      missing++;
      continue;
    }
    const j = row.json;
    const newUrl = `${BASE_URL}/en/lp/${m.newSlug}/`;
    log(`Zeile ${j.row_number}: slug="${j.slug}" -> "${m.newSlug}", pfad="${j.pfad || ''}" -> "${newUrl}" (aktiv="${j.aktiv || ''}" bleibt unveraendert).`);

    if (LIVE) {
      await sheets.updateRowByRowNumber(SHEET_NAME, j.row_number, {
        slug: m.newSlug,
        pfad: newUrl,
      });
      log(`  GESCHRIEBEN.`);
    } else {
      log(`  (TEST) wuerde schreiben.`);
    }
    updated++;
  }

  console.log('\n---- Fertig ----');
  console.log(`${updated} Zeile(n) ${LIVE ? 'aktualisiert' : 'wuerden aktualisiert'}, ${missing} nicht gefunden.`);
  if (!LIVE) console.log('Dies war ein DRY-RUN. Zum wirklichen Ausfuehren erneut mit --live aufrufen.');
}

main().catch((err) => { console.error('FEHLER:', err); process.exit(1); });
