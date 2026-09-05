#!/usr/bin/env node
'use strict';
/**
 * NIKOS Schritt 4 -- Status-Check (rein lesend, schreibt NIE ins Sheet):
 * zeigt fuer die 15 per Schritt-4-Reset (2026-09-05) zurueckgesetzten Zeilen
 * den aktuellen Sheet-Stand (erstellt_am/slug/pfad) UND prueft per HTTP, ob
 * eine neu erzeugte Seite unter dem neuen Schema (nikos.info/<lang>/lp/<slug>/)
 * bereits wirklich live ist (Status 200) oder nur im Sheet steht, aber noch
 * nicht veroeffentlicht wurde (lp-publish.yml laeuft nur stuendlich).
 *
 * Aufruf: node check-schritt4-status.js
 */

const https = require('https');
const sheets = require('../lib/sheets.js');

// Bekannte Ausgangslage (alte Sheet-Zeile, alter Slug) je Zeilennummer, aus
// dem Schritt-4-Reset-Dry-Run vom 2026-09-05 -- rein zur Anzeige/zum Vergleich,
// keine Schreiblogik haengt daran.
const ROWS = [
  { row: 30, oldSlug: 'besucherlenkung-basel-tattoo-basel' },
  { row: 53, oldSlug: 'besuchersicherheit-basel-tattoo-basel' },
  { row: 63, oldSlug: 'bezoekersveiligheid-stadsfeest-gent' },
  { row: 74, oldSlug: 'crowd-management-basel-tattoo-basel' },
  { row: 98, oldSlug: 'crowdmanagement-carnaval-bezoekerssturing-aalst' },
  { row: 99, oldSlug: 'crowdmanagement-gentse-feesten-gent' },
  { row: 136, oldSlug: 'evakuierung-tomorrowland-winter-alpe-d-huez' },
  { row: 139, oldSlug: 'evakuierungsansage-basel-tattoo-basel' },
  { row: 146, oldSlug: 'evakuierungsbeschallung-bergenfest-bergen' },
  { row: 203, oldSlug: 'nodvarsling-bergenfest-bergen' },
  { row: 204, oldSlug: 'nooddoorgave-carnaval-aalst' },
  { row: 208, oldSlug: 'notfalldurchsage-basel-tattoo-basel' },
  { row: 250, oldSlug: 'notfallwarnsystem-basel-tattoo-basel' },
  { row: 298, oldSlug: 'sprachalarmierung-basel-tattoo-basel' },
  { row: 344, oldSlug: 'unwetterwarnung-basel-tattoo-basel' },
];

function looksNewScheme(pfad) {
  return /\/[a-z]{2}\/lp\//i.test(String(pfad || ''));
}

function httpHeadOk(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(false);
    const req = https.request(url, { method: 'HEAD', timeout: 8000 }, (res) => {
      resolve(res.statusCode >= 200 && res.statusCode < 400);
      res.resume();
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

async function main() {
  const rows = await sheets.readSheetAsItems('Keywordkombinationen');
  const byRow = new Map(rows.map((r) => [r.json.row_number, r.json]));

  console.log('---- Schritt-4-Status (rein lesend, keine Sheet-Aenderung) ----');
  let offen = 0;
  let neuErzeugt = 0;
  let liveCount = 0;

  for (const target of ROWS) {
    const j = byRow.get(target.row);
    if (!j) {
      console.log(`Zeile ${target.row} (alt: ${target.oldSlug}): NICHT MEHR IM SHEET GEFUNDEN`);
      continue;
    }
    const slug = j.slug || '';
    const pfad = j.pfad || '';
    const erstelltAm = j.erstellt_am || '';

    if (!slug && !pfad) {
      offen++;
      console.log(`Zeile ${target.row} (alt: ${target.oldSlug}): NOCH OFFEN (leer, wartet auf naechsten Generator-Lauf)`);
      continue;
    }

    if (looksNewScheme(pfad)) {
      neuErzeugt++;
      const ok = await httpHeadOk(pfad);
      if (ok) liveCount++;
      console.log(
        `Zeile ${target.row} (alt: ${target.oldSlug}): NEU ERZEUGT -- neuer Slug="${slug}", pfad="${pfad}" -- HTTP-Check: ${
          ok ? 'LIVE (200)' : 'noch NICHT live (evtl. lp-publish steht noch aus)'
        }`
      );
    } else {
      console.log(
        `Zeile ${target.row} (alt: ${target.oldSlug}): UNERWARTETER STAND -- slug="${slug}", pfad="${pfad}", erstellt_am="${erstelltAm}"`
      );
    }
  }

  console.log('\n---- Zusammenfassung ----');
  console.log(`${offen} noch offen, ${neuErzeugt} neu erzeugt (davon ${liveCount} bereits live/200 erreichbar).`);
}

main().catch((err) => {
  console.error('FEHLER:', err);
  process.exit(1);
});
