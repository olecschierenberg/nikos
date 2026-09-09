#!/usr/bin/env node
'use strict';
/**
 * NIKOS Einmal-Reparaturskript (2026-09-08, Teil 2 des EN-Slug-Bugfixes):
 * Der heutige Reparaturlauf fix-stuck-multilang-rows.js hat die Sheet-Zeile
 * "besucherlenkung-sail-amsterdam-2030" nur PARTIAL zurueckgesetzt (aktiv+pfad
 * geleert, slug behalten), damit lp-publish sie aus der VORHANDENEN Vorschau
 * erneut veroeffentlicht. Diese Vorschau (lp-preview/besucherlenkung-sail-
 * amsterdam-2030/en/) wurde aber VOR dem EN-Slug-Bugfix in index.js erzeugt
 * und traegt den falschen, unuebersetzten deutschen Slug fest in ihrem
 * HTML/meta.json. Ein einfaches erneutes Publish wuerde denselben Fehler
 * nur wiederholen.
 *
 * Dieses Skript macht daraus stattdessen einen VOLLEN Reset (wie beim
 * urspruenglichen Schritt-4-Reset): loescht die veraltete Vorschau UND leert
 * erstellt_am/slug/pfad/aktiv im Sheet, damit lp-generator die Seite mit dem
 * jetzt gefixten Code komplett neu erzeugt (inkl. korrektem englischen Slug).
 *
 * Betrifft NUR diese eine Zeile -- crowd-management-gentse-feesten (ebenfalls
 * PARTIAL, aber deren Problem "Crowd Management" ist bereits ein englischer
 * Begriff) bleibt bewusst unangetastet.
 *
 * Aufruf: node fix-en-slug-full-reset.js (Dry-Run) / --live (schreibt wirklich)
 */

const fs = require('fs');
const path = require('path');
const sheets = require('../lib/sheets.js');

const LIVE = process.argv.includes('--live');
const REPO_ROOT = path.join(__dirname, '..', '..', '..');
const TARGET_SLUG = 'besucherlenkung-sail-amsterdam-2030';

function log(msg) { console.log(`[fix-en-slug-full-reset] ${msg}`); }

async function main() {
    console.log(`Modus: ${LIVE ? 'LIVE (schreibt wirklich)' : 'DRY-RUN (schreibt NICHTS, nur Vorschau)'}`);

  const previewDir = path.join(REPO_ROOT, 'lp-preview', TARGET_SLUG);
    const previewExists = fs.existsSync(previewDir);
    log(`Vorschau lp-preview/${TARGET_SLUG}/: ${previewExists ? 'gefunden' : 'NICHT gefunden'}.`);

  const rows = await sheets.readSheetAsItems('Keywordkombinationen');
    const row = rows.find(r => String(r.json.slug || '').trim() === TARGET_SLUG);
    if (!row) {
          log(`ABBRUCH: keine Sheet-Zeile mit slug="${TARGET_SLUG}" gefunden -- Zustand hat sich vermutlich schon geaendert, nichts angefasst.`);
          return;
    }
    const j = row.json;
    log(`Sheet-Zeile ${j.row_number} gefunden: erstellt_am="${j.erstellt_am || ''}", slug="${j.slug}", pfad="${j.pfad || ''}", aktiv="${j.aktiv || ''}".`);
    if (String(j.aktiv || '').trim() !== '') {
          log(`ABBRUCH: aktiv="${j.aktiv}" ist nicht leer -- Zeile ist offenbar schon (wieder) live oder in einem anderen Zustand, nichts angefasst.`);
          return;
    }

  if (LIVE) {
        if (previewExists) {
                fs.rmSync(previewDir, { recursive: true, force: true });
                log(`GELOESCHT: lp-preview/${TARGET_SLUG}/`);
        }
        await sheets.updateRowByRowNumber('Keywordkombinationen', j.row_number, {
                erstellt_am: '', slug: '', pfad: '', aktiv: '',
        });
        log(`Sheet-Zeile ${j.row_number}: erstellt_am/slug/pfad/aktiv geleert -- lp-generator erzeugt die Seite beim naechsten Lauf komplett neu.`);
  } else {
      log(`(TEST) wuerde lp-preview/${TARGET_SLUG}/ loeschen und Sheet-Zeile ${j.row_number} voll zuruecksetzen.`);
  }

  console.log('\n---- Fertig ----');
    if (!LIVE) console.log('Dies war ein DRY-RUN. Zum wirklichen Ausfuehren erneut mit --live aufrufen.');
}

main().catch((err) => { console.error('FEHLER:', err); process.exit(1); });
