'use strict';
/**
 * Ersatz für die n8n Data Table "QA-Lektionen" (Nodes "QA-Lektionen laden" /
 * "Lektion speichern"): eine einfache JSON-Datei im Repo statt einer
 * n8n-internen Tabelle (siehe Migrationsplan Abschnitt 5). Diese Datei ist
 * unabhängig von n8n — es gibt keine Kollisionsgefahr mit dem laufenden
 * n8n-Betrieb, auch nicht im Test-Modus.
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_PATH = path.join(__dirname, '..', 'data', 'qa-lektionen.json');

function load(filePath = DEFAULT_PATH) {
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

// Entspricht "QA-Lektionen laden" (limit 15, orderBy): jüngste 15 Einträge
// als n8n-kompatible Items.
function loadAsItems(filePath = DEFAULT_PATH) {
  const all = load(filePath);
  return all.slice(-15).map((row) => ({ json: row }));
}

// Entspricht "Lektion speichern" (upsert, matched auf "mangel"): vorhandenen
// Eintrag mit gleichem mangel-Wert ersetzen, sonst neu anhängen.
function upsert(row, filePath = DEFAULT_PATH) {
  const all = load(filePath);
  const idx = all.findIndex((r) => r.mangel === row.mangel);
  if (idx >= 0) all[idx] = row;
  else all.push(row);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(all, null, 2) + '\n', 'utf8');
}

module.exports = { load, loadAsItems, upsert, DEFAULT_PATH };
