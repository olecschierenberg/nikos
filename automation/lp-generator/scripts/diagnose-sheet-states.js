#!/usr/bin/env node
'use strict';
/**
 * NIKOS Diagnose-Skript (2026-09-09, rein lesend, KEIN --live-Modus noetig):
 * Beantwortet die Nutzerfrage "Zeilen mit deploy=x & aktiv=x, aber ohne
 * slug/Pfad/Erstellungsdatum -- welchen Status haben die?" mit echten
 * Sheet-Daten statt Vermutung.
 *
 * Bucketed alle Zeilen im Tab "Keywordkombinationen" nach Pipeline-Status
 * (erstellen/deploy/aktiv/slug) und druckt Beispielzeilen fuer jeden
 * ungewoehnlichen Bucket vollstaendig ins Log. Schreibt NICHTS.
 */

const sheets = require('../lib/sheets.js');

const SHEET_NAME = 'Keywordkombinationen';

function norm(v) { return String(v || '').trim(); }
function low(v) { return norm(v).toLowerCase(); }

function printRow(j) {
  console.log(`    Zeile ${j.row_number}: Problem="${j.Problem || ''}" Einsatz="${j.Einsatz || ''}" Region="${j.Region || ''}" ` +
    `erstellen="${j.erstellen || ''}" deploy="${j.deploy || ''}" aktiv="${j.aktiv || ''}" slug="${j.slug || ''}" pfad="${j.pfad || ''}" erstellt_am="${j.erstellt_am || ''}"`);
}

async function main() {
  const rows = await sheets.readSheetAsItems(SHEET_NAME);
  console.log(`Gesamt: ${rows.length} Zeile(n) im Tab "${SHEET_NAME}".`);

  const buckets = {
    'A: deploy=x & aktiv=x & slug LEER (Nutzerfrage)': [],
    'B: aktiv=x & slug LEER (jede deploy-Auspraegung)': [],
    'C: deploy=x & aktiv leer & slug LEER (haette generiert werden muessen, aber slug fehlt)': [],
    'D: deploy=x & aktiv leer & slug DA (bereit fuer lp-publish)': [],
    'E: erstellen=x & slug LEER (bereit fuer lp-generator)': [],
    'F: aktiv="abgelaufen"': [],
    'G: slug DA aber erstellt_am LEER (inkonsistent)': [],
  };

  for (const r of rows) {
    const j = r.json;
    const erstellen = low(j.erstellen), deploy = low(j.deploy), aktiv = low(j.aktiv);
    const hasSlug = norm(j.slug) !== '';
    const hasErstellt = norm(j.erstellt_am) !== '';

    if (deploy === 'x' && aktiv === 'x' && !hasSlug) buckets['A: deploy=x & aktiv=x & slug LEER (Nutzerfrage)'].push(j);
    if (aktiv === 'x' && !hasSlug) buckets['B: aktiv=x & slug LEER (jede deploy-Auspraegung)'].push(j);
    if (deploy === 'x' && aktiv === '' && !hasSlug) buckets['C: deploy=x & aktiv leer & slug LEER (haette generiert werden muessen, aber slug fehlt)'].push(j);
    if (deploy === 'x' && aktiv === '' && hasSlug) buckets['D: deploy=x & aktiv leer & slug DA (bereit fuer lp-publish)'].push(j);
    if (erstellen === 'x' && !hasSlug) buckets['E: erstellen=x & slug LEER (bereit fuer lp-generator)'].push(j);
    if (aktiv === 'abgelaufen') buckets['F: aktiv="abgelaufen"'].push(j);
    if (hasSlug && !hasErstellt) buckets['G: slug DA aber erstellt_am LEER (inkonsistent)'].push(j);
  }

  console.log('\n---- Buckets ----');
  for (const [name, list] of Object.entries(buckets)) {
    console.log(`\n${name}: ${list.length} Zeile(n)`);
    for (const j of list.slice(0, 15)) printRow(j);
    if (list.length > 15) console.log(`    ... und ${list.length - 15} weitere.`);
  }

  console.log('\n---- Fertig (rein lesend, nichts geschrieben) ----');
}

main().catch((err) => { console.error('FEHLER:', err); process.exit(1); });
