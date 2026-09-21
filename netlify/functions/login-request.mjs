// POST /api/login-request  – Magic-Link-Login: Anmeldelink per Mail anfordern
// (ersetzt in n8n "Magic-Link-Login" → "WH Login-Anfrage")
import { handleOptions, json, readJson } from '../lib/http.mjs';
import { text, isEmail, maskEmail } from '../lib/util.mjs';
import { readTab } from '../lib/sheets.mjs';
import { sendMail } from '../lib/mail.mjs';
import { createLoginToken } from '../lib/tokens.mjs';
import { loginLinkMail } from '../lib/templates.mjs';

export const config = { path: '/api/login-request' };

// [Kategorie, Tab, Spalte mit dem Namen]
const LISTEN = [
  ['Partner', 'Partnerliste', 'ansprechpartner'],
  ['Techniker', 'Technikerliste', 'name'],
  ['Mitarbeiter', 'Mitarbeiterliste', 'name'],
];

export default async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json(req, 405, { ok: false });

  let b;
  try { b = await readJson(req, 5000); } catch { return json(req, 400, { ok: false }); }

  const email = text(b.email, 254).toLowerCase();
  // Bot-Feld ausgefüllt oder keine gültige Adresse: still "ok" antworten (nichts verraten)
  if (!isEmail(email) || text(b.website_hp) !== '') return json(req, 200, { ok: true });

  try {
    const tabs = await Promise.all(LISTEN.map(([, tab]) => readTab(tab)));
    let found = null;
    LISTEN.forEach(([kategorie, , nameCol], i) => {
      if (found) return;
      const row = tabs[i].rows.find((r) => (r.data.email || '').trim().toLowerCase() === email);
      if (row) found = { kategorie, name: row.data[nameCol] || '' };
    });

    if (found) {
      const token = createLoginToken({ email, kategorie: found.kategorie });
      try {
        await sendMail({ to: email, senderName: 'NIKOS', replyTo: { email: 'info@radacom.de', name: 'RADACOM' }, ...loginLinkMail({ ...found, token }) });
      } catch (e) {
        console.error('login-request: Mail fehlgeschlagen', maskEmail(email), e.message);
      }
    }
    // Antwort ist immer gleich – so lässt sich nicht herausfinden, wer in den Listen steht.
    return json(req, 200, { ok: true });
  } catch (e) {
    console.error('login-request: Fehler', e.message);
    return json(req, 502, { ok: false });
  }
};
