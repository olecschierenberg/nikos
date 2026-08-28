'use strict';
/**
 * Google-Sheets-Zugriff als Ersatz für die n8n-Google-Sheets-Nodes
 * "Keywordkombinationen lesen" (Tab "Keywordkombinationen", Filter
 * deploy=x & aktiv leer & slug vorhanden) und "Sheet aktiv=x" (Tab
 * "Keywordkombinationen", update per row_number: aktiv, pfad). Sowie für
 * den monatlichen Ablauf-Check ("Kombis lesen (Ablauf)" / "Sheet
 * abgelaufen markieren").
 *
 * 1:1 aus automation/lp-generator/lib/sheets.js übernommen (gleiche
 * Tabelle "Landingpagedaten", 1r9MYsig5_wDATq4V1kKcZIShTKU3rKssa-e36pM2zqM,
 * gleicher Service-Account-Zugriff) — siehe Migrationsplan Teil 2,
 * Abschnitt 4.3 ("bewusst NICHT ins Repo verschieben").
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

// Entspricht "Sheet aktiv=x" / "Sheet abgelaufen markieren" (operation
// update, matchingColumns row_number).
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

module.exports = { readSheetAsItems, updateRowByRowNumber, columnLetter, SPREADSHEET_ID };
