#!/usr/bin/env node
'use strict';
/**
 * NIKOS Diagnose-Skript (2026-09-10, rein lesend, KEIN --live-Modus noetig):
 * Beantwortet die Nutzerfrage "Ich habe manuell neue Zeilen in
 * 'Keywordkombinationen' hinzugefuegt, die sollten laut Regel automatisch
 * in die Relevanz-Sortierung aufgenommen werden -- das passiert nicht."
 *
 * Liest den Tab "Keywordkombinationen" und prueft, ob die aktuelle
 * Zeilenreihenfolge tatsaechlich absteigend nach Spalte "Relevanz" sortiert
 * ist. Zeigt jede Stelle, an der die Reihenfolge davon abweicht, inkl. der
 * betroffenen Zeilen (Problem/Einsatz/Region/Relevanz/row_number). Schreibt
 * NICHTS.
 */

const sheets = require('../lib/sheets.js');

const SHEET_NAME = 'Keywordkombinationen';

function norm(v) { return String(v || '').trim(); }

function printRow(j) {
  console.log(`    Zeile ${j.row_number}: Relevanz="${j.Relevanz || ''}" Problem="${j.Problem || ''}" Einsatz="${j.Einsatz || ''}" Region="${j.Region || ''}" erstellen="${j.erstellen || ''}"`);
}

async function main() {
  const rows = await sheets.readSheetAsItems(SHEET_NAME);
  console.log(`Gesamt: ${rows.length} Zeile(n) im Tab "${SHEET_NAME}".`);

  // Relevanz als Zahl interpretieren, wie Google Sheets es beim Sortieren tut:
  // leere/nicht-numerische Werte gelten als "kleiner" als jede Zahl.
  function relScore(j) {
    const raw = norm(j.Relevanz);
    if (raw === '') return -Infinity;
    const n = Number(raw.replace(',', '.'));
    return Number.isFinite(n) ? n : -Infinity;
  }

  let leer = 0;
  const leerRows = [];
  for (const r of rows) {
    if (norm(r.json.Relevanz) === '') { leer++; leerRows.push(r.json); }
  }
  console.log(`\nZeilen ohne Relevanz-Wert: ${leer}`);
  for (const j of leerRows.slice(0, 30)) printRow(j);
  if (leerRows.length > 30) console.log(`    ... und ${leerRows.length - 30} weitere.`);

  console.log('\n---- Sortier-Pruefung (Ist-Reihenfolge vs. Relevanz absteigend) ----');
  let violations = 0;
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1].json;
    const cur = rows[i].json;
    if (relScore(prev) < relScore(cur)) {
      violations++;
      if (violations <= 30) {
        console.log(`  Verstoss bei Zeile ${cur.row_number}: davor Relevanz=${prev.Relevanz || '(leer)'} (Zeile ${prev.row_number}), danach Relevanz=${cur.Relevanz || '(leer)'} (Zeile ${cur.row_number}) -- sollte NICHT niedriger/gleich nach hoeher folgen.`);
        printRow(prev);
        printRow(cur);
      }
    }
  }
  if (violations > 30) console.log(`  ... und ${violations - 30} weitere Verstoesse.`);
  console.log(`\nGesamt: ${violations} Stelle(n), an denen die Reihenfolge NICHT absteigend nach Relevanz ist.`);

  if (violations === 0) {
    console.log('\n=> Sheet ist aktuell korrekt absteigend nach Relevanz sortiert.');
  } else {
    console.log('\n=> Sheet ist aktuell NICHT vollstaendig sortiert -- vermutlich weil der letzte Live-Lauf keine neuen KI-Vorschlaege hatte und die Sortierung deshalb uebersprungen wurde (siehe index.js Schritt 7).');
  }

  console.log('\n---- Fertig (rein lesend, nichts geschrieben) ----');
}

main().catch((err) => { console.error('FEHLER:', err); process.exit(1); });
