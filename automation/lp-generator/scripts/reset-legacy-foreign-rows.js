#!/usr/bin/env node
'use strict';
/**
 * NIKOS Schritt 4 -- Einmal-Migrationsskript: setzt fuer bekannte "Alt-Schema"-Zeilen
 * (Fremdlaender-LPs, die vor der Mehrsprachen-Pipeline oder vor dem Schritt-3-Fix
 * entstanden sind) die Felder erstellt_am/slug/pfad in Tab "Keywordkombinationen"
 * zurueck auf leer -- OHNE Problem/Einsatz/Region/erstellen/Relevanz anzufassen.
 *
 * Wirkung: der naechste LP-Generator-Lauf (index.js, bereits mit Schritt-3-Fix +
 * Retry-Logik live) sieht diese Zeilen wieder als "erstellen=x & slug leer" und
 * erzeugt sie NEU ueber den Multi-Sprach-Pfad (primaer Englisch + Landessprache +
 * 8er-Baseline), siehe filter_relevanz.js NON_DE_REGIONS/_target_langs.
 *
 * Die physischen Alt-Seiten (lp-preview/<slug>/index.html bzw. loesungen/<slug>/) werden
 * hier NICHT geloescht/angefasst -- das ist bewusst ein separater, spaeterer Schritt
 * (Redirect-Stub fuer bereits LIVE gewesene Seiten; einfaches Aufraeumen fuer reine
 * Vorschau-Leichen). Dieses Skript aendert NUR das Google Sheet.
 *
 * Aufruf: node reset-legacy-foreign-rows.js         (Dry-Run, schreibt nichts)
 *         node reset-legacy-foreign-rows.js --live  (schreibt wirklich)
 */

const sheets = require('../lib/sheets.js');

const LIVE = process.argv.includes('--live');

// ---- Gruppe A: bereits LIVE unter altem Schema (loesungen/<slug>/) -- brauchen nach
// der Neu-Erzeugung + Veroeffentlichung noch einen Redirect-Stub auf der alten URL. ----
const LIVE_LEGACY_SLUGS = [
  'besucherlenkung-basel-tattoo-basel',
  'besuchersicherheit-basel-tattoo-basel',
  'crowd-management-basel-tattoo-basel',
  'evakuierungsansage-basel-tattoo-basel',
  'notfalldurchsage-basel-tattoo-basel',
  'notfallwarnsystem-basel-tattoo-basel',
  'sprachalarmierung-basel-tattoo-basel',
  'unwetterwarnung-basel-tattoo-basel',
  'evakueringsvarsling-bergenfest-bergen',
  'nodvarsling-bergenfest-bergen',
  'evakuierung-tomorrowland-winter-alpe-d-huez',
  'emergency-warning-system-glastonbury-festival-glastonbury',
  'crowdmanagement-carnaval-bezoekerssturing-aalst',
  'nooddoorgave-carnaval-aalst',
  'crowdmanagement-gentse-feesten-gent',
  'bezoekersveiligheid-stadsfeest-gent',
];

// ---- Gruppe B: nur als Vorschau in lp-preview/ liegengeblieben (nie veroeffentlicht,
// unter dem alten Ein-Sprachen-Schema erzeugt, vor dem Schritt-3-Fix). Kein Redirect
// noetig -- die stehengebliebene Vorschau-Datei wird separat aufgeraeumt. ----
const PREVIEW_ONLY_SLUGS = [
  'bezoekerssturing-carnaval-aalst',
  'bezoekersveiligheid-stadsfeesten-gent',
  'latogatoi-tajekoztatas-fesztival-budapest',
];

const ALL_TARGET_SLUGS = new Set([...LIVE_LEGACY_SLUGS, ...PREVIEW_ONLY_SLUGS]);

// Sicherheitsnetz: NICHT anfassen, wenn "pfad" bereits nach neuem Schema aussieht
// (".../<lang>/lp/..."), z. B. falls das Skript versehentlich 2x laeuft, nachdem
// eine Zeile schon neu erzeugt wurde.
function looksAlreadyMigrated(pfad) {
  return /\/[a-z]{2}\/lp\//i.test(String(pfad || ''));
}

async function main() {
  console.log(`Modus: ${LIVE ? 'LIVE (schreibt wirklich)' : 'DRY-RUN (schreibt NICHTS, nur Vorschau)'}`);
  const rows = await sheets.readSheetAsItems('Keywordkombinationen');
  console.log(`Gelesen: ${rows.length} Zeile(n) aus Tab "Keywordkombinationen".\n`);

  const found = new Set();
  const resetRows = [];
  const skippedAlreadyMigrated = [];

  for (const row of rows) {
    const slug = String(row.json.slug || '').trim();
    if (!slug || !ALL_TARGET_SLUGS.has(slug)) continue;
    found.add(slug);

    const pfad = row.json.pfad || '';
    const erstelltAm = row.json.erstellt_am || '';
    const gruppe = LIVE_LEGACY_SLUGS.includes(slug) ? 'LIVE-LEGACY' : 'PREVIEW-ONLY';

    if (looksAlreadyMigrated(pfad)) {
      skippedAlreadyMigrated.push({ slug, pfad });
      console.log(`[UEBERSPRUNGEN, schon neues Schema] Zeile ${row.json.row_number} (${gruppe}) slug="${slug}" pfad="${pfad}"`);
      continue;
    }

    console.log(`[${LIVE ? 'ZURUECKSETZEN' : 'WUERDE ZURUECKSETZEN'}] Zeile ${row.json.row_number} (${gruppe})`);
    console.log(`    bisher: erstellt_am="${erstelltAm}", slug="${slug}", pfad="${pfad}"`);

    if (LIVE) {
      await sheets.updateRowByRowNumber('Keywordkombinationen', row.json.row_number, {
        erstellt_am: '',
        slug: '',
        pfad: '',
      });
    }
    resetRows.push({ row_number: row.json.row_number, slug, pfad, gruppe });
  }

  const notFound = [...ALL_TARGET_SLUGS].filter((s) => !found.has(s));

  console.log('\n---- Zusammenfassung ----');
  console.log(`${resetRows.length} Zeile(n) ${LIVE ? 'zurueckgesetzt' : 'wuerden zurueckgesetzt'}.`);
  console.log(`${skippedAlreadyMigrated.length} Zeile(n) uebersprungen (bereits neues Schema).`);
  if (notFound.length) {
    console.log(`ACHTUNG -- ${notFound.length} erwartete(r) Slug(s) NICHT im Sheet gefunden (Tippfehler? bereits anders benannt?):`);
    for (const s of notFound) console.log(`    - ${s}`);
  } else {
    console.log('Alle erwarteten Slugs wurden im Sheet gefunden.');
  }

  if (!LIVE) {
    console.log('\nDies war ein DRY-RUN. Zum wirklichen Zuruecksetzen erneut mit --live aufrufen.');
  }
}

main().catch((err) => {
  console.error('FEHLER:', err);
  process.exit(1);
});
