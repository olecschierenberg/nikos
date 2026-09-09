#!/usr/bin/env node
'use strict';
/**
 * NIKOS Einmal-Reparaturskript (2026-09-09):
 * Sheet-Zeile mit Problem="Besucherinformation", Einsatz="Weihnachtsmarkt",
 * Region="Hamburg" ist unter dem Slug "notfalldurchsage-weihnachtsmarkt-bremen"
 * live (loesungen/notfalldurchsage-weihnachtsmarkt-bremen/) -- Slug/Pfad-Thema
 * (Notfalldurchsage/Bremen) passt NICHT zu den Sheet-Spalten dieser Zeile
 * (Besucherinformation/Weihnachtsmarkt/Hamburg). Vermutlich wurden die
 * Problem/Einsatz/Region-Spalten nachtraeglich von Hand geaendert, ohne
 * slug/pfad nachzuziehen (siehe project_memory / nikos-landingpages-seo.md,
 * Nebenbefund vom 2026-09-09).
 *
 * Fix: die falsch betitelte Live-Seite UND eine evtl. noch vorhandene
 * Vorschau werden geloescht, die Sheet-Zeile wird auf erstellt_am/slug/pfad/
 * aktiv = leer zurueckgesetzt (erstellen/deploy bleiben unangetastet) --
 * lp-generator erzeugt beim naechsten Lauf eine neue, zum tatsaechlichen
 * Thema (Besucherinformation/Weihnachtsmarkt/Hamburg) passende Seite mit
 * korrektem Slug, lp-publish veroeffentlicht sie automatisch wieder (deploy
 * ist ja bereits gesetzt).
 *
 * Sicherheitscheck: bricht ab, falls die Sheet-Zeile inzwischen NICHT mehr
 * exakt Problem="Besucherinformation" & Einsatz="Weihnachtsmarkt" &
 * Region="Hamburg" traegt (Zustand hat sich dann anders geaendert als erwartet).
 *
 * Aufruf: node reset-bremen-weihnachtsmarkt-mismatch.js (Dry-Run) / --live
 */

const fs = require('fs');
const path = require('path');
const sheets = require('../lib/sheets.js');

const LIVE = process.argv.includes('--live');
const REPO_ROOT = path.join(__dirname, '..', '..', '..');
const TARGET_SLUG = 'notfalldurchsage-weihnachtsmarkt-bremen';
const EXPECT = { Problem: 'Besucherinformation', Einsatz: 'Weihnachtsmarkt', Region: 'Hamburg' };

function log(msg) { console.log(`[reset-bremen-weihnachtsmarkt-mismatch] ${msg}`); }

async function main() {
  console.log(`Modus: ${LIVE ? 'LIVE (schreibt wirklich)' : 'DRY-RUN (schreibt NICHTS, nur Vorschau)'}`);

  const liveDir = path.join(REPO_ROOT, 'loesungen', TARGET_SLUG);
  const previewDir = path.join(REPO_ROOT, 'lp-preview', TARGET_SLUG);
  const liveExists = fs.existsSync(liveDir);
  const previewExists = fs.existsSync(previewDir);
  log(`Live-Seite loesungen/${TARGET_SLUG}/: ${liveExists ? 'gefunden' : 'NICHT gefunden'}.`);
  log(`Vorschau lp-preview/${TARGET_SLUG}/: ${previewExists ? 'gefunden' : 'NICHT gefunden'}.`);

  const rows = await sheets.readSheetAsItems('Keywordkombinationen');
  const row = rows.find(r => String(r.json.slug || '').trim() === TARGET_SLUG);
  if (!row) {
    log(`ABBRUCH: keine Sheet-Zeile mit slug="${TARGET_SLUG}" gefunden -- Zustand hat sich vermutlich schon geaendert, nichts angefasst.`);
    return;
  }
  const j = row.json;
  log(`Sheet-Zeile ${j.row_number}: Problem="${j.Problem}", Einsatz="${j.Einsatz}", Region="${j.Region}", erstellt_am="${j.erstellt_am || ''}", pfad="${j.pfad || ''}", aktiv="${j.aktiv || ''}".`);

  const mismatch = Object.entries(EXPECT).filter(([k, v]) => String(j[k] || '').trim() !== v);
  if (mismatch.length) {
    log(`ABBRUCH: Sheet-Zeile entspricht nicht mehr der erwarteten Kombination (${mismatch.map(([k, v]) => `${k} erwartet "${v}", ist "${j[k]}"`).join(', ')}) -- nichts angefasst.`);
    return;
  }

  if (LIVE) {
    if (liveExists) {
      fs.rmSync(liveDir, { recursive: true, force: true });
      log(`GELOESCHT: loesungen/${TARGET_SLUG}/`);
    }
    if (previewExists) {
      fs.rmSync(previewDir, { recursive: true, force: true });
      log(`GELOESCHT: lp-preview/${TARGET_SLUG}/`);
    }
    await sheets.updateRowByRowNumber('Keywordkombinationen', j.row_number, {
      erstellt_am: '', slug: '', pfad: '', aktiv: '',
    });
    log(`Sheet-Zeile ${j.row_number}: erstellt_am/slug/pfad/aktiv geleert -- lp-generator erzeugt beim naechsten Lauf eine neue, thematisch passende Seite; lp-publish veroeffentlicht sie automatisch (deploy bleibt gesetzt).`);
  } else {
    log(`(TEST) wuerde loesungen/${TARGET_SLUG}/ und ggf. lp-preview/${TARGET_SLUG}/ loeschen und Sheet-Zeile ${j.row_number} zuruecksetzen.`);
  }

  console.log('\n---- Fertig ----');
  if (!LIVE) console.log('Dies war ein DRY-RUN. Zum wirklichen Ausfuehren erneut mit --live aufrufen.');
}

main().catch((err) => { console.error('FEHLER:', err); process.exit(1); });
