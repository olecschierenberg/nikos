#!/usr/bin/env node
'use strict';
/**
 * NIKOS Einmal-Fix-Skript (2026-09-10): sortiert den Tab
 * "Keywordkombinationen" JETZT sofort absteigend nach "Relevanz" -- exakt
 * dieselbe Operation wie index.js Schritt 7 / sheets.sortByRelevanceDesc.
 * Noetig, weil der taegliche Live-Lauf die Sortierung bisher UEBERSPRUNGEN
 * hat, wenn die KI an dem Tag keine neuen Kombinationen vorgeschlagen hat
 * (siehe Fix in index.js, Schritt 7 laeuft ab jetzt IMMER). Dieses Skript
 * holt die aktuell aufgelaufene Unordnung einmalig sofort nach, statt auf
 * den naechsten Live-Lauf zu warten.
 *
 * WICHTIG (Fix 2026-09-10, zweiter Fund): sortByRelevanceDesc() nimmt
 * Spalte und Spaltenzahl inzwischen NICHT mehr als hartcodierte Parameter
 * entgegen, sondern ermittelt sie selbst aus der echten Kopfzeile -- die
 * alte Annahme "Relevanz = Spalte J, A:K = 11 Spalten" war laengst veraltet
 * (echte Kopfzeile: erstellen, deploy, aktiv, Relevanz, Problem, Einsatz,
 * Region, erstellt_am, slug, pfad, Ende, indiziert, OrigZeile -- Relevanz
 * ist Spalte D, nicht J). Mit der alten Annahme wurde faelschlich nach der
 * "pfad"-Spalte (einer Text-URL) sortiert statt nach Relevanz.
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
    await sheets.sortByRelevanceDesc(SHEET_NAME);
    console.log('LIVE: Sheet nach Relevanz absteigend sortiert (Spalte automatisch aus Kopfzeile ermittelt).');
  } else {
    console.log('TEST-Modus: Sortierung wuerde jetzt ausgefuehrt (Spalte automatisch aus Kopfzeile ermittelt). Mit --live wirklich schreiben.');
  }
}

main().catch((err) => { console.error('FEHLER:', err); process.exit(1); });
