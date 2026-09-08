#!/usr/bin/env node
'use strict';
/**
 * NIKOS Schritt 4 -- Korrektur-Suche (rein lesend, schreibt NIE ins Sheet):
 * Der Schritt-4-Reset (2026-09-05) hatte 15 Sheet-Zeilen ueber ihre
 * ZEILENNUMMER identifiziert. Der taegliche "Keyword-Kombinationen"-Workflow
 * sortiert das Blatt danach aber jeden Tag komplett neu nach Relevanz
 * (sheets.sortByRelevanceDesc) -- Zeilennummern sind damit NICHT stabil.
 * Dieses Skript sucht deshalb inhaltlich: alle Zeilen mit erstellen='x'
 * UND leerem slug/pfad (also die aktuelle "Warteschlange"), damit man die
 * urspruenglich zurueckgesetzten 15 Zeilen anhand von Problem/Einsatz/Region
 * wiedererkennen kann, unabhaengig von ihrer aktuellen Zeilennummer.
 *
 * Aufruf: node find-legacy-foreign-rows.js
 */

const sheets = require('../lib/sheets.js');

async function main() {
    const rows = await sheets.readSheetAsItems('Keywordkombinationen');

  const offen = rows.filter((r) => {
        const j = r.json;
        return String(j.erstellen || '').trim() === 'x' && !j.slug && !j.pfad;
  });

  console.log(`---- ${offen.length} offene (erstellen=x, slug/pfad leer) Zeilen im aktuellen Sheet-Stand ----`);
    for (const r of offen) {
          const j = r.json;
          console.log(
                  `Zeile ${j.row_number}: Problem="${j.Problem || ''}" | Einsatz="${j.Einsatz || ''}" | Region="${j.Region || ''}" | Relevanz="${j.Relevanz || ''}" | Ende="${j.Ende || ''}"`
                );
    }
    console.log(`---- Ende (${offen.length} Zeilen gesamt) ----`);
}

main().catch((err) => {
    console.error('FEHLER:', err);
    process.exit(1);
});
