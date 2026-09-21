// Test-Hilfen: falsches Google-Sheets + falsches Brevo (kein Netzwerk!)
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { SPREADSHEET_ID } from '../lib/config.mjs';

export function setupEnv() {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({
    client_email: 'sa@test.iam.gserviceaccount.com',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  });
  process.env.BREVO_API_KEY = 'test-brevo-key';
  process.env.NIKOS_SECRET = randomBytes(24).toString('hex');
  process.env.REPORT_SECRET = randomBytes(24).toString('hex');
  process.env.REPORT_ALLOWED_RECIPIENTS = 'info@radacom.de, Chef@Radacom.de';
  delete process.env.SITE_URL;
}

export const HEADERS = {
  Leads: ['name', 'firma', 'email', 'telefon', 'website', 'newsletter', 'typ', 'datum'],
  Zugangsanfragen: ['token', 'status', 'datum', 'name', 'firma', 'email', 'telefon', 'website', 'strasse', 'plz', 'ort', 'land', 'geschaeftsfeld', 'nachricht', 'techniker', 'technikerfirma'],
  Partnerliste: ['partner_id', 'firma', 'ansprechpartner', 'strasse', 'plz', 'ort', 'land', 'telefon', 'email', 'website', 'geschaeftsfeld', 'ist_radacom'],
  Technikerliste: ['datum', 'name', 'firma', 'email', 'telefon', 'website', 'kategorie'],
  Mitarbeiterliste: ['datum', 'name', 'firma', 'email', 'telefon', 'website', 'kategorie'],
};

/** Ersetzt globalThis.fetch. Liefert den "Zustand" (Tabellen, gesendete Mails …). */
export function installFakes() {
  const st = {
    tabs: Object.fromEntries(Object.entries(HEADERS).map(([k, v]) => [k, [v.slice()]])),
    mails: [], doi: [], failMail: false, failSheets: false, doiError: null,
  };
  const colIndex = (letters) => letters.split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

  globalThis.fetch = async (url, init = {}) => {
    url = String(url);
    const body = init.body && typeof init.body === 'string' && init.body.startsWith('{') ? JSON.parse(init.body) : init.body;
    const ok = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

    if (url.startsWith('https://oauth2.googleapis.com/token')) {
      if (String(body.get('assertion')).split('.').length !== 3) return ok({}, 400);
      return ok({ access_token: 'fake-token', expires_in: 3600 });
    }
    if (url.startsWith('https://api.brevo.com/v3/')) {
      if (init.headers['api-key'] !== 'test-brevo-key') return ok({ message: 'unauthorized' }, 401);
      if (url.endsWith('/smtp/email')) {
        if (st.failMail) return ok({ message: 'boom' }, 500);
        st.mails.push(body);
        return ok({ messageId: 'x' }, 201);
      }
      if (url.endsWith('/contacts/doubleOptinConfirmation')) {
        if (st.doiError) return ok(st.doiError.body, st.doiError.status);
        st.doi.push(body);
        return new Response(null, { status: 204 });
      }
    }
    if (url.startsWith(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`)) {
      if (init.headers.authorization !== 'Bearer fake-token') return ok({}, 401);
      if (st.failSheets) return ok({ error: 'boom' }, 500);
      const rest = url.slice(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`.length);
      if (rest === '/values:batchUpdate') {
        for (const d of body.data) {
          const m = /^'(.+)'!([A-Z]+)(\d+)$/.exec(d.range);
          const rows = st.tabs[m[1]];
          rows[Number(m[3]) - 1][colIndex(m[2])] = d.values[0][0];
        }
        return ok({});
      }
      const m = /^\/values\/([^?]+)/.exec(rest);
      const [tabPart, a1] = decodeURIComponent(m[1]).split('!');
      const tab = tabPart.replace(/^'|'$/g, '').replace(/''/g, "'");
      if (!st.tabs[tab]) return ok({ error: 'tab' }, 400);
      if (init.method === 'POST') {
        st.tabs[tab].push(body.values[0]);
        return ok({});
      }
      if (a1 === '1:1') return ok({ values: [st.tabs[tab][0]] });
      return ok({ values: st.tabs[tab].map((r) => r.slice()) });
    }
    throw new Error(`Unerwarteter Aufruf im Test: ${url}`);
  };
  return st;
}

export const post = (handler, url, body, headers = {}) =>
  handler(new Request(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) }));
export const get = (handler, url, headers = {}) => handler(new Request(url, { headers }));

export const addRow = (st, tab, obj) => st.tabs[tab].push(HEADERS[tab].map((h) => obj[h] ?? ''));
export const rowsOf = (st, tab) => st.tabs[tab].slice(1).map((r) => Object.fromEntries(HEADERS[tab].map((h, i) => [h, r[i] ?? ''])));
