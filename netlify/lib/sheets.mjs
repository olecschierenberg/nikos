// Google Sheets ohne Zusatzpakete: Dienstkonto-Anmeldung (JWT) + REST-API per fetch.
import { createSign } from 'node:crypto';
import { SPREADSHEET_ID } from './config.mjs';

let cached = null; // { token, exp }

function credentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON fehlt');
  let c;
  try { c = JSON.parse(raw); } catch { throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON ist kein gültiges JSON'); }
  if (!c.client_email || !c.private_key) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON: client_email/private_key fehlen');
  return { email: c.client_email, key: String(c.private_key).replace(/\\n/g, '\n') };
}

const b64u = (s) => Buffer.from(s).toString('base64url');

async function accessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.exp - 60 > now) return cached.token;
  const { email, key } = credentials();
  const head = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64u(JSON.stringify({
    iss: email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const sig = createSign('RSA-SHA256').update(`${head}.${claim}`).sign(key).toString('base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${head}.${claim}.${sig}`,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Google-Anmeldung fehlgeschlagen (HTTP ${res.status})`);
  const j = await res.json();
  cached = { token: j.access_token, exp: now + Number(j.expires_in || 3600) };
  return cached.token;
}

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
