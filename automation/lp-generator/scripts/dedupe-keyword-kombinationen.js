#!/usr/bin/env node
'use strict';
/**
 * NIKOS Einmal-Reparaturskript (2026-09-09, Nutzer-Auftrag): findet alle
 * Zeilen im Tab "Keywordkombinationen" mit IDENTISCHER Keywordkombination
 * (Problem+Einsatz+Region, gleiche Normalisierung wie der produktive
 * Dedup-Check in automation/keyword-kombinationen/lib/nodes/
 * relevanz_berechnen.js: trim + lowercase) und raeumt Duplikate auf.
 *
 * HINTERGRUND: der produktive Dedup-Check verhindert NEUE Doppelungen beim
 * taeglichen Anhaengen von KI-Vorschlaegen zuverlaessig. Die hier
 * gefundenen Duplikate sind aeltere/manuell entstandene Faelle (u. a.
 * ein Nebeneffekt des fruehreren Teil-1-Zeilen-Resets beim
 * Auslands-Slug-Bug, siehe Memory-Datei nikos-landingpages-seo.md) -- sie
 * werden von der taeglichen Pipeline nicht rueckwirkend erkannt.
 *
 * ENTSCHEIDUNGSREGEL je Duplikat-Gruppe ("welche Zeile bleibt stehen"):
 *   1. aktiv==='x'            -> eindeutig bereits live (Score 100)
 *   2. SONDERFALL (siehe LIVE_TROTZ_LEEREM_AKTIV unten): bekannter
 *      Bookkeeping-Bug, wo eine Zeile trotz aktiv="" bereits echt live ist
 *      -> wird wie Score 100 behandelt.
 *   3. deploy==='x' & slug & pfad gefuellt  -> Score 50 (naechster
 *      lp-publish-Lauf wuerde sie live schalten)
 *   4. erstellen==='x' & slug & pfad gefuellt -> Score 30 (Vorschau bereits
 *      generiert, wartet auf deploy-Freigabe)
 *   5. deploy==='x' (slug/pfad noch leer) -> Score 10
 *   6. erstellen==='x' (noch nichts generiert) -> Score 5
 *   7. nichts gesetzt -> Score 0
 * Hoechster Score gewinnt und bleibt unveraendert stehen. Bei Gleichstand:
 * niedrigste row_number (aelteste Zeile) gewinnt.
 *
 * SICHERHEIT: haben 2+ Zeilen einer Gruppe Score 100 (also ZWEI vermeintlich
 * bereits live stehende Duplikate) -> das ist kein automatisch aufloesbarer
 * Fall (koennte zwei echte, unterschiedliche Live-Seiten fuer denselben
 * Themenkomplex bedeuten) -- die GESAMTE Gruppe wird uebersprungen und laut
 * geloggt, es wird NICHTS an ihr veraendert.
 *
 * FIX-METHODE: bewusst NICHT physisches Loeschen der Sheet-Zeile (Risiko:
 * deleteDimension-Zeilenverschiebung + Race Condition mit dem taeglichen
 * Sortier-Workflow, der ebenfalls Zeilen verschiebt). Stattdessen werden
 * bei den unterlegenen Zeilen NUR die Ablauf-Spalten geleert (erstellen,
 * deploy, aktiv, slug, pfad, erstellt_am) -- Problem/Einsatz/Region/
 * Relevanz/Ende bleiben zur Nachvollziehbarkeit stehen. Funktional
 * identisch zum Loeschen (keine Pipeline-Filterung matcht mehr, die Zeile
 * wird nie generiert/veroeffentlicht), aber reversibel und ohne
 * Zeilenverschiebungs-Risiko.
 *
 * Aufruf: node dedupe-keyword-kombinationen.js (Dry-Run) / --live (schreibt wirklich)
 */

const sheets = require('../lib/sheets.js');

const LIVE = process.argv.includes('--live');
const SHEET_NAME = 'Keywordkombinationen';

function norm(v) { return String(v || '').trim(); }
function low(v) { return norm(v).toLowerCase(); }
function keyOf(p, e, r) { return [low(p), low(e), low(r)].join('|'); }

function log(msg) { console.log(`[dedupe-keyword-kombinationen] ${msg}`); }

// Bekannter Bookkeeping-Bug (siehe Memory nikos-landingpages-seo.md,
// Abschnitt Multi-Lang-LP-Projekt): diese Zeile ist trotz aktiv="" bereits
// tatsaechlich live (manuell am 2026-09-09 auf nikos.info verifiziert).
// Bewusst als expliziter Einzelfall gepflegt statt als generische Regel
// ("aktiv leer koennte trotzdem live sein"), damit die automatische
// Entscheidung fuer alle anderen 370+ Zeilen konservativ bleibt.
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

async function main() {
  console.log(`Modus: ${LIVE ? 'LIVE (schreibt wirklich)' : 'DRY-RUN (schreibt NICHTS, nur Vorschau)'}`);

  const rows = await sheets.readSheetAsItems(SHEET_NAME);
  log(`${rows.length} Zeile(n) im Sheet "${SHEET_NAME}" gelesen.`);

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
  log(`${dupGroups.length} Duplikat-Gruppe(n) gefunden (von ${groups.size} eindeutigen Kombinationen insgesamt).`);

  const toClear = [];
  let conflictCount = 0;

  for (const g of dupGroups) {
    const scored = g.map((r) => ({ r, s: score(r.json) }));
    const maxScore = Math.max(...scored.map((x) => x.s));
    const winners = scored.filter((x) => x.s === maxScore);

    const label = `"${g[0].json.Problem}" | "${g[0].json.Einsatz}" | "${g[0].json.Region}"`;

    if (maxScore >= 100 && winners.length > 1) {
      conflictCount++;
      log(`\n!!! KONFLIKT (Score ${maxScore} bei ${winners.length} Zeilen, KEINE automatische Aufloesung) ${label}`);
      for (const x of scored) {
        const j = x.r.json;
        log(`    Zeile ${j.row_number}: Score=${x.s} erstellen="${j.erstellen}" deploy="${j.deploy}" aktiv="${j.aktiv}" slug="${j.slug}" pfad="${j.pfad}" erstellt_am="${j.erstellt_am}"`);
      }
      continue;
    }

    winners.sort((a, b) => a.r.json.row_number - b.r.json.row_number);
    const winner = winners[0];
    const losers = scored.filter((x) => x !== winner);

    log(`\nGruppe ${label} (${g.length} Zeilen):`);
    log(`  BLEIBT: Zeile ${winner.r.json.row_number} (Score ${winner.s}) slug="${winner.r.json.slug}" pfad="${winner.r.json.pfad}" aktiv="${winner.r.json.aktiv}"`);
    for (const x of losers) {
      const j = x.r.json;
      log(`  WIRD GELEERT: Zeile ${j.row_number} (Score ${x.s}) erstellen="${j.erstellen}" deploy="${j.deploy}" aktiv="${j.aktiv}" slug="${j.slug}" pfad="${j.pfad}" erstellt_am="${j.erstellt_am}"`);
      toClear.push(j.row_number);
    }
  }

  console.log('\n---- Zusammenfassung ----');
  console.log(`${dupGroups.length} Duplikat-Gruppe(n), davon ${conflictCount} Konflikt(e) (uebersprungen, keine Aenderung).`);
  console.log(`${toClear.length} Zeile(n) wuerden geleert (erstellen/deploy/aktiv/slug/pfad/erstellt_am).`);

  if (LIVE) {
    for (const rn of toClear) {
      await sheets.updateRowByRowNumber(SHEET_NAME, rn, {
        erstellen: '', deploy: '', aktiv: '', slug: '', pfad: '', erstellt_am: '',
      });
      log(`  Zeile ${rn}: GESCHRIEBEN (geleert).`);
    }
    console.log(`\n${toClear.length} Zeile(n) aktualisiert.`);
  } else {
    console.log('Dies war ein DRY-RUN. Zum wirklichen Ausfuehren erneut mit --live aufrufen.');
  }
}

main().catch((err) => { console.error('FEHLER:', err); process.exit(1); });
