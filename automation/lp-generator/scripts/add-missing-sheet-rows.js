#!/usr/bin/env node
'use strict';
/**
 * NIKOS Einmal-Skript (2026-09-10) -- letzter offener Punkt aus dem
 * EN-Inhalte-Bugfix: fix-missing-en-content.js hat 2 Seiten als "ohne
 * Sheet-Zeile" uebersprungen:
 *   - loesungen/besucherinformation-augsburger-plaerrer-augsburg/index.html
 *   - loesungen/unwetterwarnung-iga-ruhrgebiet-2027-essen/index.html
 *
 * VERIFIZIERT (audit-lp-inventory.js, Lauf 2026-09-10, Abschnitt A): beide
 * Dateien existieren im Repo (erstellt 2026-07-08, also lange bevor der
 * EN-Bugfix begann), sind bereits live verlinkt (Canonical-URL vorhanden),
 * aber es gibt im Tab "Keywordkombinationen" WEDER unter "slug" NOCH unter
 * "pfad" eine passende Zeile -- reine Buchfuehrungsluecke (die Seiten wurden
 * offenbar vor der aktuellen Sheet-Buchfuehrungs-Konvention erstellt), keine
 * Duplikate, keine "tote Zeile" (Abschnitt B des Audits zeigt 2 GANZ ANDERE
 * verwaiste Zeilen: Sindelfingen/Basel-Tattoo).
 *
 * Ohne Sheet-Zeile qualifizieren diese 2 Seiten NIE fuer
 * fix-missing-en-content.js (das Skript braucht Problem/Einsatz/Region aus
 * dem Sheet fuer den Uebersetzungs-Prompt). Dieses Skript haengt je EINE neue
 * Zeile an "Keywordkombinationen" an, die den bereits existierenden LIVE-
 * Zustand der Seiten abbildet (erstellen=deploy=aktiv="x", slug/pfad/
 * erstellt_am gesetzt) -- KEINE Neu-Generierung wird ausgeloest (anders als
 * bei der Sindelfingen-Wiederherstellung in
 * tuebingen-stadtfakten-und-sindelfingen-lp.js, wo erstellen=x OHNE slug
 * bewusst eine neue Generierung anstossen sollte). Problem/Einsatz/Region
 * wurden aus dem jeweiligen H1 der Live-Seite abgeleitet (identisch zum
 * Muster aller Nachbar-Slugs mit demselben Einsatz/Region, z. B.
 * crowd-management-augsburger-plaerrer-augsburg fuer Augsburg bzw. den
 * anderen "*-essen"-Slugs fuer Essen).
 *
 * Sicherheit: bricht pro Zeile ab, falls es bereits eine Zeile mit exakt
 * diesem slug ODER dieser Problem+Einsatz+Region-Kombination gibt (verhindert
 * Duplikate bei mehrfachem Lauf).
 *
 * Aufruf: node add-missing-sheet-rows.js (Dry-Run) / --live
 */

const sheets = require('../lib/sheets.js');

const LIVE = process.argv.includes('--live');
const SHEET_NAME = 'Keywordkombinationen';
const BASE_URL = 'https://nikos.info';

function log(msg) { console.log(`[add-missing-sheet-rows] ${msg}`); }
function norm(v) { return String(v || '').trim(); }

const NEW_ROWS = [
  {
    slug: 'besucherinformation-augsburger-plaerrer-augsburg',
    Problem: 'Besucherinformation',
    Einsatz: 'Augsburger Plärrer',
    Region: 'Augsburg',
    erstellt_am: '2026-07-08',
  },
  {
    slug: 'unwetterwarnung-iga-ruhrgebiet-2027-essen',
    Problem: 'Unwetterwarnung',
    Einsatz: 'IGA Ruhrgebiet 2027',
    Region: 'Essen',
    erstellt_am: '2026-07-08',
  },
];

async function main() {
  console.log(`Modus: ${LIVE ? 'LIVE (schreibt wirklich)' : 'DRY-RUN (schreibt NICHTS, nur Vorschau)'}`);

  const rows = await sheets.readSheetAsItems(SHEET_NAME);
  log(`Sheet gelesen: ${rows.length} Zeile(n).`);

  let added = 0;
  let skipped = 0;
  for (const nr of NEW_ROWS) {
    const bySlug = rows.find((r) => norm(r.json.slug) === nr.slug);
    if (bySlug) {
      log(`UEBERSPRUNGEN: slug="${nr.slug}" existiert bereits in Zeile ${bySlug.json.row_number} -- nichts angefasst.`);
      skipped++;
      continue;
    }
    const byCombo = rows.find((r) => norm(r.json.Problem) === nr.Problem && norm(r.json.Einsatz) === nr.Einsatz && norm(r.json.Region) === nr.Region);
    if (byCombo) {
      log(`UEBERSPRUNGEN: Problem="${nr.Problem}" Einsatz="${nr.Einsatz}" Region="${nr.Region}" existiert bereits in Zeile ${byCombo.json.row_number} (slug="${byCombo.json.slug}") -- nichts angefasst.`);
      skipped++;
      continue;
    }

    const pfad = `${BASE_URL}/loesungen/${nr.slug}/`;
    const rowData = {
      erstellen: 'x', deploy: 'x', aktiv: 'x',
      Problem: nr.Problem, Einsatz: nr.Einsatz, Region: nr.Region,
      erstellt_am: nr.erstellt_am,
      slug: nr.slug, pfad,
    };
    log(`Neue Zeile fuer slug="${nr.slug}":`);
    for (const [k, v] of Object.entries(rowData)) log(`  ${k} = "${v}"`);

    if (LIVE) {
      await sheets.appendRow(SHEET_NAME, rowData);
      log(`  ANGEHAENGT.`);
    } else {
      log('  (TEST) wuerde angehaengt.');
    }
    added++;
  }

  console.log('\n---- Fertig ----');
  console.log(`${added} Zeile(n) ${LIVE ? 'angehaengt' : 'wuerden angehaengt'}, ${skipped} uebersprungen (bereits vorhanden).`);
  if (!LIVE) console.log('Dies war ein DRY-RUN. Zum wirklichen Ausfuehren erneut mit --live aufrufen.');
}

main().catch((err) => { console.error('FEHLER:', err); process.exit(1); });
