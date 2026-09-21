// GET /api/login-verify?token=…  – Klick auf den Anmeldelink aus der Mail
// (ersetzt in n8n "Magic-Link-Login" → "WH Login-Verify")
import { html, redirect } from '../lib/http.mjs';
import { card, WARN } from '../lib/pages.mjs';
import { siteUrl } from '../lib/config.mjs';
import { verifyLoginToken } from '../lib/tokens.mjs';

export const config = { path: '/api/login-verify' };

export default async (req) => {
  if (req.method !== 'GET') return html(405, 'Nur GET erlaubt');
  const token = (new URL(req.url).searchParams.get('token') || '').trim();
  let v;
  try { v = verifyLoginToken(token); } catch (e) {
    console.error('login-verify: Konfigurationsfehler', e.message);
    return html(500, 'Konfigurationsfehler');
  }
  if (v.valid) return redirect(`${siteUrl()}/nikos-login.html#nk=${encodeURIComponent(token)}`);
  return html(400, card({
    icon: WARN, title: 'Anmeldelink ungültig', heading: 'Anmeldelink ungültig oder abgelaufen',
    bodyHtml: 'Anmeldelinks sind 24 Stunden gültig.<br>Bitte fordern Sie einfach einen neuen Link an.',
    button: { label: 'Neuen Anmeldelink anfordern', href: `${siteUrl()}/nikos-login.html` },
  }));
};
