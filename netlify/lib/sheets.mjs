// Google Sheets ohne Zusatzpakete: Dienstkonto-Anmeldung (JWT) + REST-API per fetch.
import { googleAccessToken } from './google.mjs';
import { SPREADSHEET_ID } from './config.mjs';

const accessToken = () => googleAccessToken('https://www.googleapis.com/auth/spreadsheets');

async function api(path, { method = 'GET', body } = {}) {
  const token = await accessToken();
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(8000),
  });
  // Bewusst ohne Antworttext in der Fehlermeldung (könnte Daten enthalten).
  if (!res.ok) throw new Error(`Sheets-API HTTP ${res.status} (${method} ${path.split('?')[0].slice(0, 40)})`);
  return res.json();
}

const range = (tab, a1 = '') => encodeURIComponent(`'${tab.replace(/'/g, "''")}'${a1 ? '!' + a1 : ''}`);

export function colLetter(index) {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const normHeader = (row) => (row || []).map((h) => String(h).trim().toLowerCase());

/** Tab lesen -> { header:[…], rows:[{ rowNumber, data:{spalte:wert} }] } */
export async function readTab(tab) {
  const j = await api(`/values/${range(tab)}`);
  const vals = j.values || [];
  const header = normHeader(vals[0]);
  const rows = vals.slice(1).map((r, i) => {
    const data = {};
    header.forEach((h, c) => { if (h) data[h] = r[c] == null ? '' : String(r[c]); });
    return { rowNumber: i + 2, data };
  });
  return { header, rows };
}

/** Zeile anhängen; die Werte werden anhand der Spaltenüberschriften zugeordnet. */
export async function appendRow(tab, obj) {
  const head = await api(`/values/${range(tab, '1:1')}`);
  const header = normHeader((head.values || [])[0]);
  if (!header.length) throw new Error(`Tab "${tab}" hat keine Kopfzeile`);
  const row = header.map((h) => (obj[h] == null ? '' : String(obj[h])));
  // RAW = Werte bleiben Text (schützt vor Formel-Einschleusung durch Formulareingaben)
  await api(`/values/${range(tab, 'A1')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: 'POST',
    body: { values: [row] },
  });
}

/** Einzelne Zellen einer Zeile ändern: obj = { spaltenname: neuerWert } */
export async function updateCells(tab, header, rowNumber, obj) {
  const data = [];
  for (const [col, value] of Object.entries(obj)) {
    const i = header.indexOf(col.toLowerCase());
    if (i < 0) throw new Error(`Spalte "${col}" nicht in Tab "${tab}"`);
    data.push({ range: `'${tab.replace(/'/g, "''")}'!${colLetter(i)}${rowNumber}`, values: [[String(value)]] });
  }
  await api('/values:batchUpdate', { method: 'POST', body: { valueInputOption: 'RAW', data } });
}
