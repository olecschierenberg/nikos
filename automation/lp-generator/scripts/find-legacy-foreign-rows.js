#!/usr/bin/env node
'use strict';
/**
 * NIKOS Schritt 4 -- Korrektur-Suche (rein lesend, schreibt NIE ins Sheet):
 * Der Schritt-4-Reset (2026-09-05) hatte 15 Sheet-Zeilen ueber ihre
 * ZEILENNUMMER identifiziert. Der taegliche "Keyword-Kombinationen"-Workflow
 * sortiert das Blatt danach aber jeden Tag komplett neu nach Relevanz
 * (sheets.sortByRelevanceDesc) -- Zeilennummern sind damit NICHT stabil.
 * Dieses Skript sucht deshalb inhaltlich: (1) alle Zeilen mit erstellen='x'
 * UND leerem slug/pfad (die aktuelle Warteschlange) UND (2) zusaetzlich
 * ALLE Zeilen (auch bereits erzeugte), deren Einsatz-Feld eines der
 * gesuchten Stichworte enthaelt -- damit man auch Zeilen findet, die
 * bereits verarbeitet wurden (slug/pfad gefuellt).
 *
 * Aufruf: node find-legacy-foreign-rows.js
 */

const sheets = require('../lib/sheets.js');

const SUCHBEGRIFFE = ['gent', 'aalst', 'basel tattoo', 'bergenfest', 'tomorrowland', 'huez'];

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

  const treffer = rows.filter((r) => {
          const hay = `${r.json.Einsatz || ''} ${r.json.Region || ''}`.toLowerCase();
          return SUCHBEGRIFFE.some((b) => hay.includes(b));
  });
      console.log(`\n---- ${treffer.length} Zeilen (egal ob offen oder schon erzeugt) mit Treffer auf [${SUCHBEGRIFFE.join(', ')}] ----`);
      for (const r of treffer) {
              const j = r.json;
              console.log(
                        `Zeile ${j.row_number}: Problem="${j.Problem || ''}" | Einsatz="${j.Einsatz || ''}" | Region="${j.Region || ''}" | slug="${j.slug || ''}" | pfad="${j.pfad || ''}" | erstellt_am="${j.erstellt_am || ''}"`
                      );
      }
      console.log(`---- Ende Treffer-Suche ----`);
}

main().catch((err) => {
      console.error('FEHLER:', err);
      process.exit(1);
});
