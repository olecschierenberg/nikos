#!/usr/bin/env node
'use strict';
/**
 * NIKOS Einmal-Skript (2026-09-10), zwei unabhaengige Teile:
 *
 * Teil 1: Vervollstaendigt die Stadt-Fakten-Zeile fuer Tuebingen (Region-
 * Match, aktuell nur Regionstyp+Region+Events="ChocolART" gefuellt, alle
 * anderen Spalten leer). Werte recherchiert (WebSearch, 2026-09-10):
 * Wikidata Q3806, Einwohner ~91470 (Mai 2024, tuebingen.de/Wikipedia),
 * Groessenklasse "Mittelstadt" (unter 100.000, konsistent mit anderen
 * Sheet-Eintraegen wie Sindelfingen/Plauen/Vechta), keine bekannte
 * Grossbaustelle/Karnevalshochburg/festes OpenAir-Gelaende -> alle vier
 * ja/nein-Spalten "nein". Events um weitere real bestaetigte, wiederkehrende
 * Tuebinger Veranstaltungen ergaenzt (Stocherkahnrennen, Umbrisch-
 * Provenzalischer Markt, Weihnachtsmarkt) neben dem bereits vorhandenen
 * ChocolART. Land="Deutschland" ergaenzt (bei anderen DE-Staedten so
 * gepflegt).
 *
 * Teil 2: Haengt eine NEUE Zeile in "Keywordkombinationen" an, um die vom
 * Nutzer angeforderte Wiederherstellung der ISF-Sindelfingen-Landingpage
 * anzustossen (Problem/Einsatz/Region identisch zur vor dem Bestandsaudit
 * geloeschten Seite -- siehe Commit b1af596 -- damit lp-generator denselben
 * Slug "sprachalarmierung-internationales-strassenfest-sindelfingen"
 * reproduziert und die bestehenden Links im Loesungen-Hub sowie auf
 * de/referenzen/ und de/anwendungen/stadtfest/ automatisch wieder gueltig
 * werden, ohne dass diese drei Dateien angefasst werden muessen). Relevanz
 * wird explizit auf 10 gesetzt, damit die Zeile im taeglichen 164-Zeilen-
 * Rueckstau (siehe project memory) nicht hinten ansteht, sondern von
 * lp-generate.yml zeitnah verarbeitet wird. erstellen=x, deploy bewusst LEER
 * (Vorschau wird erst manuell geprueft, dann deploy=x gesetzt -- Standard-
 * Sheet-Konvention, siehe README/lp-publish.yml-Kommentar).
 *
 * Sicherheitschecks: Teil 1 bricht ab, falls die Tuebingen-Zeile inzwischen
 * NICHT mehr die erwartete leere Ausgangslage hat (koennte dann schon von
 * anderer Stelle gepflegt worden sein). Teil 2 bricht ab, falls es bereits
 * eine Zeile mit Region="Sindelfingen" gibt (verhindert Duplikate bei
 * mehrfachem Lauf).
 *
 * Aufruf: node tuebingen-stadtfakten-und-sindelfingen-lp.js (Dry-Run) / --live
 */

const sheets = require('../lib/sheets.js');

const LIVE = process.argv.includes('--live');

function log(msg) { console.log(`[tuebingen-sindelfingen] ${msg}`); }
function norm(v) { return String(v || '').trim(); }

const TUEBINGEN_UPDATE = {
  Wikidata_QID: 'Q3806',
  Einwohner: '91470',
  Groessenklasse: 'Mittelstadt',
  OpenAir_Gelaende: 'nein',
  Grossbaustellen: 'nein',
  Karnevalshochburg: 'nein',
  Festivalort: 'nein',
  Events: 'ChocolART; Tübinger Stocherkahnrennen; Umbrisch-Provenzalischer Markt; Tübinger Weihnachtsmarkt',
  Land: 'Deutschland',
};
const TUEBINGEN_EXPECT_EMPTY = ['Wikidata_QID', 'Einwohner', 'Groessenklasse', 'OpenAir_Gelaende', 'Grossbaustellen', 'Karnevalshochburg', 'Festivalort', 'Land'];

const SINDELFINGEN_ROW = {
  erstellen: 'x',
  deploy: '',
  aktiv: '',
  Relevanz: '10',
  Problem: 'Sprachalarmierung',
  Einsatz: 'Internationales Straßenfest',
  Region: 'Sindelfingen',
  erstellt_am: '',
  slug: '',
  pfad: '',
  Ende: '',
  indiziert: '',
  OrigZeile: '',
};

async function teil1() {
  log('---- Teil 1: Stadt-Fakten Tuebingen vervollstaendigen ----');
  const rows = await sheets.readSheetAsItems('Stadt-Fakten');
  const row = rows.find(r => norm(r.json.Region).toLowerCase() === 'tübingen' || norm(r.json.Region).toLowerCase() === 'tuebingen');
  if (!row) {
    log('ABBRUCH Teil 1: keine Stadt-Fakten-Zeile mit Region="Tübingen" gefunden.');
    return;
  }
  const j = row.json;
  log(`Gefunden: row_number ${j.row_number}, Region="${j.Region}", Events aktuell="${j.Events}".`);

  const nichtLeer = TUEBINGEN_EXPECT_EMPTY.filter(k => norm(j[k]) !== '');
  if (nichtLeer.length) {
    log(`ABBRUCH Teil 1: folgende Spalten sind NICHT mehr leer wie erwartet (evtl. schon anderweitig gepflegt): ${nichtLeer.map(k => `${k}="${j[k]}"`).join(', ')} -- nichts angefasst.`);
    return;
  }

  log('Neue Werte:');
  for (const [k, v] of Object.entries(TUEBINGEN_UPDATE)) log(`  ${k} = "${v}"`);

  if (LIVE) {
    await sheets.updateRowByRowNumber('Stadt-Fakten', j.row_number, TUEBINGEN_UPDATE);
    log(`Stadt-Fakten-Zeile ${j.row_number} (Tübingen) aktualisiert.`);
  } else {
    log('(TEST) wuerde obige Werte in die Tuebingen-Zeile schreiben.');
  }
}

async function teil2() {
  console.log('');
  log('---- Teil 2: Neue Keywordkombinationen-Zeile fuer ISF Sindelfingen ----');
  const rows = await sheets.readSheetAsItems('Keywordkombinationen');
  const existing = rows.filter(r => norm(r.json.Region).toLowerCase() === 'sindelfingen');
  if (existing.length) {
    log(`ABBRUCH Teil 2: es gibt bereits ${existing.length} Zeile(n) mit Region="Sindelfingen" (row_number ${existing.map(r => r.json.row_number).join(', ')}) -- nichts angefasst, um Duplikate zu vermeiden.`);
    return;
  }

  log('Neue Zeile:');
  for (const [k, v] of Object.entries(SINDELFINGEN_ROW)) log(`  ${k} = "${v}"`);

  if (LIVE) {
    await sheets.appendRow('Keywordkombinationen', SINDELFINGEN_ROW);
    log('Neue Zeile an "Keywordkombinationen" angehaengt (erstellen=x, Relevanz=10). lp-generate.yml (naechster Lauf oder manueller Dispatch) sollte daraus die Vorschau unter lp-preview/sprachalarmierung-internationales-strassenfest-sindelfingen/ erzeugen.');
  } else {
    log('(TEST) wuerde obige Zeile an "Keywordkombinationen" anhaengen.');
  }
}

async function main() {
  console.log(`Modus: ${LIVE ? 'LIVE (schreibt wirklich)' : 'DRY-RUN (schreibt NICHTS, nur Vorschau)'}`);
  await teil1();
  await teil2();
  console.log('\n---- Fertig ----');
  if (!LIVE) console.log('Dies war ein DRY-RUN. Zum wirklichen Ausfuehren erneut mit --live aufrufen.');
}

main().catch((err) => { console.error('FEHLER:', err); process.exit(1); });
