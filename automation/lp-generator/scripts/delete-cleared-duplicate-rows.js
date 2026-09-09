#!/usr/bin/env node
'use strict';
/**
 * NIKOS Einmal-Reparaturskript (2026-09-09, Nutzer-Auftrag "physisch loeschen"):
 * physisches Loeschen der Sheet-Zeilen, die dedupe-keyword-kombinationen.js
 * bereits GELEERT hat (erstellen/deploy/aktiv/slug/pfad/erstellt_am leer),
 * WEIL sie Verlierer einer Problem+Einsatz+Region-Duplikat-Gruppe waren.
 *
 * WARUM NEU EINGELESEN STATT ALTE row_number WIEDERVERWENDET: der taegliche
 * keyword-kombinationen-Workflow sortiert die GESAMTE Tabelle nach Relevanz
 * neu -- row_number ist NICHT tagesuebergreifend stabil (siehe Memory
 * nikos-landingpages-seo.md). Die frueher notierten Zeilennummern (2, 43,
 * 24, 25, 28, 90, 307) koennen deshalb inzwischen andere Inhalte tragen.
 * Dieses Skript wiederholt daher die IDENTISCHE Gruppierungs-/Scoring-Logik
 * aus dedupe-keyword-kombinationen.js auf dem AKTUELLEN Sheet-Stand und
 * loescht nur Zeilen, die (a) Verlierer einer Duplikat-Gruppe mit einem
 * echten Gewinner (Score > 0) sind UND (b) bereits vollstaendig geleert
 * sind (sonst waere es keine bereits bearbeitete Dublette, sondern ein noch
 * unbehandelter Fall -- der wird dann NICHT geloescht, sondern nur geloggt;
 * dedupe-keyword-kombinationen.js danach erneut laufen lassen).
 *
 * Sicherheits-Timing: NICHT waehrend/kurz nach dem taeglichen 03:00-UTC-
 * Sortierlauf ausfuehren (Race-Condition-Risiko mit dem Zeilen-Verschieben
 * dieses Workflows).
 *
 * FIX-METHODE diesmal bewusst physisches Loeschen (deleteDimension), nicht
 * nur Leeren -- die Zeilen sind bereits funktional tot (Schritt 1), dieser
 * Schritt raeumt sie nur noch sichtbar aus der Tabelle.
 *
 * Aufruf: node delete-cleared-duplicate-rows.js (Dry-Run) / --live
 */

const sheets = require('../lib/sheets.js');

const LIVE = process.argv.includes('--live');
const SHEET_NAME = 'Keywordkombinationen';

function norm(v) { return String(v || '').trim(); }
function low(v) { return norm(v).toLowerCase(); }
function keyOf(p, e, r) { return [low(p), low(e), low(r)].join('|'); }

function log(msg) { console.log(`[delete-cleared-duplicate-rows] ${msg}`); }

// Identisch zu dedupe-keyword-kombinationen.js
const LIVE_TROTZ_LEEREM_AKTIV = new Set(['visitor-guidance-sail-amsterdam-2030']);

function score(j) {
  const aktiv = low(j.aktiv);
  const deploy = low(j.deploy);
  const erstellen = low(j.erstellen);
  const hasSlug = norm(j.slug) !== '' && norm(j.pfad) !== '';
  if (aktiv === 'x') return 100;
  if (LIVE_TROTZ_LEEREM_AKTIV.has(norm(j.slug))) return 100;
  if (deploy === 'x' && hasSlug) return 50;
  if (erstellen === 'x' && hasSlug) return 30;
  if (deploy === 'x') return 10;
  if (erstellen === 'x') return 5;
  return 0;
}

function isFullyCleared(j) {
  return ['erstellen', 'deploy', 'aktiv', 'slug', 'pfad', 'erstellt_am'].every((k) => norm(j[k]) === '');
}

async function main() {
  console.log(`Modus: ${LIVE ? 'LIVE (loescht wirklich)' : 'DRY-RUN (loescht NICHTS, nur Vorschau)'}`);

  const rows = await sheets.readSheetAsItems(SHEET_NAME);
  log(`${rows.length} Zeile(n) im Sheet "${SHEET_NAME}" gelesen (aktueller Stand, row_number frisch ermittelt).`);

  const groups = new Map();
  for (const r of rows) {
    const j = r.json;
    const p = norm(j.Problem), e = norm(j.Einsatz), reg = norm(j.Region);
    if (!p && !e && !reg) continue;
    const k = keyOf(p, e, reg);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  const dupGroups = [...groups.values()].filter((g) => g.length > 1);
  log(`${dupGroups.length} Duplikat-Gruppe(n) im aktuellen Stand gefunden.`);

  const toDelete = [];
  const stillDirty = [];

  for (const g of dupGroups) {
    const scored = g.map((r) => ({ r, s: score(r.json) }));
    const maxScore = Math.max(...scored.map((x) => x.s));
    if (maxScore === 0) continue; // keine Gruppe mit echtem Gewinner -- nichts zu tun
    const winners = scored.filter((x) => x.s === maxScore);
    if (winners.length > 1) continue; // Konfliktfall -- wie im Hauptskript uebersprungen, nichts loeschen

    const label = `"${g[0].json.Problem}" | "${g[0].json.Einsatz}" | "${g[0].json.Region}"`;
    const losers = scored.filter((x) => x.s !== maxScore);
    for (const x of losers) {
      const j = x.r.json;
      if (x.s === 0 && isFullyCleared(j)) {
        log(`  LOESCHEN: Zeile ${j.row_number} (${label}) -- bereits geleerter Verlierer, Gewinner ist Zeile ${winners[0].r.json.row_number}.`);
        toDelete.push(j.row_number);
      } else if (x.s !== maxScore) {
        log(`  UEBERSPRUNGEN (nicht bereits geleert, Score=${x.s}): Zeile ${j.row_number} (${label}) -- vermutlich noch unbehandelter Fall, bitte zuerst dedupe-keyword-kombinationen.js --live laufen lassen.`);
        stillDirty.push(j.row_number);
      }
    }
  }

  console.log('\n---- Zusammenfassung ----');
  console.log(`${toDelete.length} Zeile(n) werden physisch geloescht: [${toDelete.sort((a, b) => a - b).join(', ')}]`);
  if (stillDirty.length) {
    console.log(`${stillDirty.length} Zeile(n) UEBERSPRUNGEN (noch nicht geleert): [${stillDirty.sort((a, b) => a - b).join(', ')}]`);
  }

  if (LIVE) {
    if (!toDelete.length) {
      console.log('Nichts zu loeschen.');
      return;
    }
    await sheets.deleteRowsByRowNumbers(SHEET_NAME, toDelete);
    console.log(`\n${toDelete.length} Zeile(n) physisch geloescht.`);
  } else {
    console.log('Dies war ein DRY-RUN. Zum wirklichen Ausfuehren erneut mit --live aufrufen.');
  }
}

main().catch((err) => { console.error('FEHLER:', err); process.exit(1); });
