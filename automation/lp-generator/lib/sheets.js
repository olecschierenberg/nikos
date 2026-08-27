'use strict';
/**
 * Google-Sheets-Zugriff als Ersatz für die n8n-Google-Sheets-Nodes
 * "Keywordkombinationen lesen" (Tab "Warteschlange"), "Stadt-Fakten lesen"
 * (Tab "Stadt-Fakten") und "Ergebnis ins Sheet" (Tab "Keywordkombinationen",
 * update per row_number). Bewusst unverändert: dieselbe Tabelle
 * ("Landingpagedaten", 1r9MYsig5_wDATq4V1kKcZIShTKU3rKssa-e36pM2zqM) bleibt
 * die gemeinsame Datenquelle für n8n UND diese neue Pipeline — siehe
 * Migrationsplan Abschnitt 5 ("bewusst NICHT ins Repo verschieben").
 *
 * Zugriff per Google Service Account (Secret GOOGLE_SERVICE_ACCOUNT_JSON),
 * nicht per OAuth2 wie im n8n-Node — das Service-Account-Konto muss dem
 * Sheet als Betrachter/Bearbeiter freigegeben werden (siehe README).
 */

const SPREADSHEET_ID = '1r9MYsig5_wDATq4V1kKcZIShTKU3rKssa-e36pM2zqM';

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

// Entspricht "Ergebnis ins Sheet" (operation update, matchingColumns
// row_number) auf Tab "Keywordkombinationen": schreibt die übergebenen
// Spalten in die durch row_number identifizierte Zeile.
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
    if (idx === -1) continue; // unbekannte Spalte -> überspringen, wie n8n es bei "removed" Spalten tut
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

module.exports = { readSheetAsItems, updateRowByRowNumber, SPREADSHEET_ID };
