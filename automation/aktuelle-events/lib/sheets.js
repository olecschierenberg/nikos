'use strict';
/**
 * Google-Sheets-Zugriff als Ersatz fuer die n8n-Google-Sheets-Nodes des
 * Workflows "Aktuelle Events" ("Stadt-Fakten lesen", "Erlaubte Regionen
 * lesen", "Neue Region anlegen" (append), "Aktuell/Zeitraum aktualisieren"
 * (update by Region), "Stadt-Fakten sortieren" (batchUpdate sortRange)).
 * Dieselbe Tabelle "Landingpagedaten"
 * (1r9MYsig5_wDATq4V1kKcZIShTKU3rKssa-e36pM2zqM) wie bei den anderen
 * Automations-Ordnern -- bewusst eigene Kopie dieser Datei (eigenstaendiges
 * npm-Paket), plus die fuer diesen Workflow zusaetzlich benoetigten
 * append-/match-Funktionen.
 */

const SPREADSHEET_ID = '1r9MYsig5_wDATq4V1kKcZIShTKU3rKssa-e36pM2zqM';
const STADT_FAKTEN_SHEET_ID = 397952407; // gid von Tab "Stadt-Fakten", fuer batchUpdate sortRange

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

async function getHeader(sheetName) {
  const sheets = sheetsClient();
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!1:1`,
  });
  return (headerRes.data.values || [[]])[0];
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

// Entspricht "Neue Region anlegen" (operation append): haengt eine neue Zeile
// an, Spalten per Name gegen den Header gemappt (fehlende Spalten -> leer).
async function appendRow(sheetName, columns) {
  const sheets = sheetsClient();
  const header = await getHeader(sheetName);
  const row = header.map((h) => (Object.prototype.hasOwnProperty.call(columns, h) ? columns[h] : ''));
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetName,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
}

// Entspricht "Aktuell/Zeitraum aktualisieren" (operation update, matchingColumns
// [matchColumn]): findet die Zeile(n), deren matchColumn === matchValue ist
// (case-insensitiv, getrimmt -- wie n8n's Google-Sheets-Matching), und
// schreibt dort die uebergebenen Spalten.
async function updateRowByColumnMatch(sheetName, matchColumn, matchValue, columns) {
  const items = await readSheetAsItems(sheetName);
  const norm = (v) => String(v ?? '').trim().toLowerCase();
  const target = items.find((it) => norm(it.json[matchColumn]) === norm(matchValue));
  if (!target) throw new Error(`updateRowByColumnMatch: keine Zeile mit ${matchColumn}="${matchValue}" in "${sheetName}" gefunden.`);
  const sheets = sheetsClient();
  const header = await getHeader(sheetName);
  const data = [];
  for (const [col, val] of Object.entries(columns)) {
    const idx = header.indexOf(col);
    if (idx === -1) continue;
    data.push({ range: `${sheetName}!${columnLetter(idx)}${target.json.row_number}`, values: [[val]] });
  }
  if (!data.length) return;
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { valueInputOption: 'USER_ENTERED', data },
  });
}

// Entspricht "Stadt-Fakten sortieren" (HTTP-Request-Node, direkter
// spreadsheets.batchUpdate-Call: clearBasicFilter -> sortRange (Spalte B =
// Region, aufsteigend) -> setBasicFilter). 1:1 dieselbe Request-Struktur.
async function sortStadtFaktenByRegion() {
  const sheets = sheetsClient();
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        { clearBasicFilter: { sheetId: STADT_FAKTEN_SHEET_ID } },
        { sortRange: { range: { sheetId: STADT_FAKTEN_SHEET_ID, startRowIndex: 1, startColumnIndex: 0, endColumnIndex: 12 }, sortSpecs: [{ dimensionIndex: 1, sortOrder: 'ASCENDING' }] } },
        { setBasicFilter: { filter: { range: { sheetId: STADT_FAKTEN_SHEET_ID, startRowIndex: 0, startColumnIndex: 0, endColumnIndex: 12 } } } },
      ],
    },
  });
}

module.exports = { readSheetAsItems, appendRow, updateRowByColumnMatch, sortStadtFaktenByRegion, SPREADSHEET_ID };
