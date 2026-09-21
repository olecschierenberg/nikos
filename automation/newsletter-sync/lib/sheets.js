'use strict';
/**
 * Google-Sheets-Zugriff fuer das Blatt "Leads" im Sheet "NIKOS-Listen".
 * Zugriff per Service Account (Secret GOOGLE_SERVICE_ACCOUNT_JSON), wie bei
 * den anderen Automatisierungen. Spalten werden IMMER ueber die Namen der
 * Kopfzeile gefunden, nie ueber feste Positionen.
 * Geschrieben wird als RAW (Text bleibt Text): sonst wuerde Google z. B. eine
 * Telefonnummer "+49 ..." als Formel/Zahl umdeuten.
 */
const { SPREADSHEET_ID } = require('./config');

let cachedClient = null;
function sheetsClient() {
  if (cachedClient) return cachedClient;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON fehlt (GitHub Secret, siehe README).');
  }
  const { google } = require('googleapis');
  const creds = JSON.parse(raw);
  const auth = new google.auth.JWT(creds.client_email, null, creds.private_key, [
    'https://www.googleapis.com/auth/spreadsheets',
  ]);
  cachedClient = google.sheets({ version: 'v4', auth });
  return cachedClient;
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

// Liest ein Tab komplett. Ergebnis: { header: [Spaltennamen], rows: [{ rowNumber, values }] }
// rowNumber: Kopfzeile = 1, erste Datenzeile = 2 (wie in der Google-Tabelle sichtbar).
async function readTab(tab, requiredColumns = []) {
  const sheets = sheetsClient();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: tab });
  const all = res.data.values || [];
  if (all.length < 1) throw new Error(`Tab "${tab}" ist leer (keine Kopfzeile).`);
  const header = all[0].map((h) => String(h || '').trim());
  for (const col of requiredColumns) {
    if (!header.includes(col)) {
      throw new Error(`Spalte "${col}" fehlt im Tab "${tab}" (Kopfzeile: ${header.join(', ')}).`);
    }
  }
  const rows = all.slice(1).map((cells, i) => {
    const values = {};
    header.forEach((h, idx) => {
      if (h) values[h] = cells[idx] !== undefined ? cells[idx] : '';
    });
    return { rowNumber: i + 2, values };
  });
  return { header, rows };
}

// Einzelne Zellen setzen: updates = [{ rowNumber, column, value }]
async function setCells(tab, header, updates) {
  if (!updates.length) return;
  const data = [];
  for (const u of updates) {
    const idx = header.indexOf(u.column);
    if (idx === -1) continue; // Spalte gibt es nicht -> ueberspringen
    data.push({ range: `${tab}!${columnLetter(idx)}${u.rowNumber}`, values: [[u.value]] });
  }
  if (!data.length) return;
  await sheetsClient().spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { valueInputOption: 'RAW', data },
  });
}

// Neue Zeilen unten anhaengen. rows = [{ <Spalte>: <Wert> }]
async function appendRows(tab, header, rows) {
  if (!rows.length) return;
  const values = rows.map((row) => header.map((h) => (row[h] !== undefined ? row[h] : '')));
  await sheetsClient().spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: tab,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  });
}

module.exports = { readTab, setCells, appendRows };
