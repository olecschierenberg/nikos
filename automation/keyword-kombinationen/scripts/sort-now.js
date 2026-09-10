#!/usr/bin/env node
'use strict';
/**
 * NIKOS Einmal-Fix-Skript (2026-09-10): sortiert den Tab
 * "Keywordkombinationen" JETZT sofort absteigend nach "Relevanz" (Spalte J,
 * A:K = 11 Spalten -- exakt dieselbe Operation wie index.js Schritt 7 /
 * sheets.sortByRelevanceDesc). Noetig, weil der taegliche Live-Lauf die
 * Sortierung bisher UEBERSPRUNGEN hat, wenn die KI an dem Tag keine neuen
 * Kombinationen vorgeschlagen hat (siehe Fix in index.js, Schritt 7 laeuft
 * ab jetzt IMMER). Dieses Skript holt die aktuell aufgelaufene Unordnung
 * einmalig sofort nach, statt auf den naechsten Live-Lauf zu warten.
 *
 * Standardmaessig TEST-Modus (liest nur und zeigt an, was passieren wuerde
 * -- hier: einfach die Anzahl Zeilen). Erst mit --live wird wirklich
 * sortiert. Schreibt NICHTS anderes als die Sortierung selbst (keine
 * Zeileninhalte werden veraendert).
 */

const sheets = require('../lib/sheets.js');

const SHEET_NAME = 'Keywordkombinationen';
const LIVE = process.argv.includes('--live');

async function main() {
  const rows = await sheets.readSheetAsItems(SHEET_NAME);
  console.log(`Gesamt: ${rows.length} Zeile(n) im Tab "${SHEET_NAME}".`);

  if (LIVE) {
    await sheets.sortByRelevanceDesc(SHEET_NAME, 9, 11);
    console.log('LIVE: Sheet nach Relevanz absteigend sortiert (Spalte J, A:K).');
  } else {
    console.log('TEST-Modus: Sortierung wuerde jetzt ausgefuehrt (Spalte J, A:K). Mit --live wirklich schreiben.');
  }
}

main().catch((err) => { console.error('FEHLER:', err); process.exit(1); });
