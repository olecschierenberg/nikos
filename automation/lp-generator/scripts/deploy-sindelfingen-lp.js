#!/usr/bin/env node
'use strict';
/**
 * NIKOS Einmal-Skript (2026-09-10): setzt deploy=x fuer die Keywordkombinationen-
 * Zeile Region="Sindelfingen" (Problem="Sprachalarmierung", Einsatz=
 * "Internationales Straßenfest"), nachdem die generierte Vorschau unter
 * lp-preview/sprachalarmierung-internationales-strassenfest-sindelfingen/
 * inhaltlich geprueft wurde (Keyword "Sprachalarmierung" kommt wörtlich in
 * Title, H1, Meta-Description, Intro und FAQ vor -- SEO-Keyword-Konsistenz
 * erfuellt). Setzen von deploy=x ist laut Sheet-Konvention bewusst der
 * manuelle menschliche Freigabeschritt vor lp-publish.yml.
 *
 * Sicherheitscheck: bricht ab, falls keine oder mehr als eine passende Zeile
 * gefunden wird, oder falls erstellen != "x" oder aktiv bereits gesetzt ist
 * (dann waere die Seite schon live oder noch nicht generiert).
 *
 * Aufruf: node deploy-sindelfingen-lp.js (Dry-Run) / --live
 */

const sheets = require('../lib/sheets.js');

const LIVE = process.argv.includes('--live');

function log(msg) { console.log(`[deploy-sindelfingen] ${msg}`); }
function norm(v) { return String(v || '').trim(); }

async function main() {
  console.log(`Modus: ${LIVE ? 'LIVE (schreibt wirklich)' : 'DRY-RUN (schreibt NICHTS, nur Vorschau)'}`);
  const rows = await sheets.readSheetAsItems('Keywordkombinationen');
  const matches = rows.filter(r => norm(r.json.Region).toLowerCase() === 'sindelfingen');

  if (matches.length !== 1) {
    log(`ABBRUCH: erwarte genau 1 Zeile mit Region="Sindelfingen", gefunden: ${matches.length}. Nichts angefasst.`);
    return;
  }

  const j = matches[0].json;
  log(`Gefunden: row_number ${j.row_number}, Problem="${j.Problem}", Einsatz="${j.Einsatz}", erstellen="${j.erstellen}", deploy="${j.deploy}", aktiv="${j.aktiv}", slug="${j.slug}", pfad="${j.pfad}".`);

  if (norm(j.erstellen).toLowerCase() !== 'x') {
    log(`ABBRUCH: erstellen ist nicht "x" (ist "${j.erstellen}"). Nichts angefasst.`);
    return;
  }
  if (norm(j.aktiv) !== '') {
    log(`ABBRUCH: aktiv ist bereits "${j.aktiv}" gesetzt -- Seite scheint schon live/publiziert. Nichts angefasst.`);
    return;
  }
  if (norm(j.deploy).toLowerCase() === 'x') {
    log('ABBRUCH: deploy ist bereits "x" -- nichts zu tun.');
    return;
  }
  if (norm(j.slug) === '') {
    log('ABBRUCH: slug ist noch leer -- Vorschau scheint noch nicht generiert worden zu sein. Nichts angefasst.');
    return;
  }

  log(`Setze deploy="x" fuer row_number ${j.row_number}.`);
  if (LIVE) {
    await sheets.updateRowByRowNumber('Keywordkombinationen', j.row_number, { deploy: 'x' });
    log(`Zeile ${j.row_number} aktualisiert: deploy=x. lp-publish.yml (naechster Lauf oder manueller Dispatch) sollte die Seite jetzt live schalten.`);
  } else {
    log('(TEST) wuerde deploy=x fuer diese Zeile setzen.');
  }
  console.log('\n---- Fertig ----');
  if (!LIVE) console.log('Dies war ein DRY-RUN. Zum wirklichen Ausfuehren erneut mit --live aufrufen.');
}

main().catch((err) => { console.error('FEHLER:', err); process.exit(1); });
