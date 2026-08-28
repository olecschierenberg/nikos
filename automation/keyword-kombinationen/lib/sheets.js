'use strict';
/**
 * Google-Sheets-Zugriff als Ersatz für die n8n-Google-Sheets-Nodes dieses
 * Workflows ("Keywordpool lesen", "Vorhandene Kombis lesen",
 * "Stadt-Fakten lesen A", "Vorschläge ins Sheet", "Blatt sortieren
 * (Relevanz)"). Bewusst unverändert: dieselbe Tabelle ("Landingpagedaten",
 * 1r9MYsig5_wDATq4V1kKcZIShTKU3rKssa-e36pM2zqM) bleibt die gemeinsame
 * Datenquelle für n8n UND diese neue Pipeline — siehe Migrationsplan
 * Teil 2, Abschnitt 3.3 ("bewusst NICHT ins Repo verschieben").
 *
 * 1:1 übernommen aus automation/lp-generator/lib/sheets.js (gleiche
 * Tabelle, gleicher Service-Account-Zugriff), um zwei Skripte mit
 * identischem Verhalten zu vermeiden — hier zusätzlich um appendRows()
 * und sortSheetByColumn() ergänzt, die der LP-Generator nicht braucht.
 *
 * Zugriff per Google Service Account (Secret GOOGLE_SERVICE_ACCOUNT_JSON),
 * nicht per OAuth2 wie im n8n-Node — das Service-Account-Konto muss dem
 * Sheet als Betrachter/Bearbeiter freigegeben werden (siehe README).
 */

const SPREADSHEET_ID = '1r9MYsig5_wDATq4V1kKcZIShTKU3rKssa-e36pM2zqM';
// Numerische Sheet-ID (gid) des Tabs "Keywordkombinationen" — für die
// batchUpdate-Sortierung wird zwingend die numerische ID benötigt, nicht
// der Tab-Name. 1:1 aus dem n8n-Node "Blatt sortieren (Relevanz)" (HTTP-
// Request an sheets.googleapis.com/.../batchUpdate) übernommen.
const KEYWORDKOMBINATIONEN_SHEET_GID = 2048692266;

let cachedAuth = null;
function getAuth() {
  if (cachedAuth) return cachedAuth;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON fehlt (als GitHub Secret hinterlegen, siehe README).');
  }
  const { google } = require('googleapis');
  const creds = JSON.parse(raw);
  cachedAuth = new google.auth.JWT(
    creds.client_email,
    null,
    creds.private_key,
    ['https://www.googleapis.com/auth/spreadsheets']
  );
  return cachedAuth;
}

function sheetsClient() {
  const { google } = require('googleapis');
  return google.sheets({ version: 'v4', auth: getAuth() });
}

// Liest ein Tab vollständig und liefert n8n-kompatible Items:
// [{ json: { <Spalte>: <Wert>, ..., row_number: N } }, ...]
// row_number folgt derselben Konvention wie n8n (Header = Zeile 1, erste
// Datenzeile = row_number 2).
async function readSheetAsItems(sheetName) {
  const sheets = sheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetName,
  });
  const rows = res.data.values || [];
  if (rows.length < 1) return [];
  const header = rows[0];
  return rows.slice(1).map((row, i) => {
    const obj = {};
    header.forEach((h, idx) => {
      if (!h) return;
      obj[h] = row[idx] !== undefined ? row[idx] : '';
    });
    obj.row_number = i + 2;
    return { json: obj };
  });
}

// Entspricht "Ergebnis ins Sheet" / "Sheet aktiv=x" (operation update,
// matchingColumns row_number): schreibt die übergebenen Spalten in die
// durch row_number identifizierte Zeile.
async function updateRowByRowNumber(sheetName, rowNumber, columns) {
  const sheets = sheetsClient();
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!1:1`,
  });
  const header = (headerRes.data.values || [[]])[0];
  const data = [];
  for (const [col, val] of Object.entries(columns)) {
    const idx = header.indexOf(col);
    if (idx === -1) continue; // unbekannte Spalte -> überspringen, wie n8n es tut
    const colLetter = columnLetter(idx);
    data.push({
      range: `${sheetName}!${colLetter}${rowNumber}`,
      values: [[val]],
    });
  }
  if (!data.length) return;
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { valueInputOption: 'USER_ENTERED', data },
  });
}

// Entspricht "Vorschläge ins Sheet" (operation append, definierte Spalten
// Problem/Einsatz/Region/erstellen/Relevanz/Ende). rows: Array von
// { Problem, Einsatz, Region, erstellen, Relevanz, Ende }.
async function appendRows(sheetName, rows) {
  if (!rows.length) return;
  const sheets = sheetsClient();
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!1:1`,
  });
  const header = (headerRes.data.values || [[]])[0];
  const values = rows.map((row) => header.map((h) => (row[h] !== undefined ? row[h] : '')));
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetName,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  });
}

// Entspricht "Blatt sortieren (Relevanz)": clearBasicFilter + sortRange
// (absteigend nach Spalte "Relevanz") + setBasicFilter, per direktem
// batchUpdate-Aufruf — 1:1 dieselbe Request-Struktur wie im n8n-HTTP-Node.
async function sortByRelevanceDesc(sheetName, relevanzColumnIndex, columnCount) {
  const sheets = sheetsClient();
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        { clearBasicFilter: { sheetId: KEYWORDKOMBINATIONEN_SHEET_GID } },
        {
          sortRange: {
            range: {
              sheetId: KEYWORDKOMBINATIONEN_SHEET_GID,
              startRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: columnCount,
            },
            sortSpecs: [{ dimensionIndex: relevanzColumnIndex, sortOrder: 'DESCENDING' }],
          },
        },
        {
          setBasicFilter: {
            filter: {
              range: {
                sheetId: KEYWORDKOMBINATIONEN_SHEET_GID,
                startRowIndex: 0,
                startColumnIndex: 0,
                endColumnIndex: columnCount,
              },
            },
          },
        },
      ],
    },
  });
}

function columnLetter(index) {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

module.exports = {
  readSheetAsItems,
  updateRowByRowNumber,
  appendRows,
  sortByRelevanceDesc,
  columnLetter,
  SPREADSHEET_ID,
  KEYWORDKOMBINATIONEN_SHEET_GID,
};
