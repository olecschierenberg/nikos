// GET /api/login-check?token=…  – prüft ein gespeichertes Login-Token (von der Login-Seite aufgerufen)
// (ersetzt in n8n "Magic-Link-Login" → "WH Login-Check")
import { handleOptions, json } from '../lib/http.mjs';
import { verifyLoginToken } from '../lib/tokens.mjs';

export const config = { path: '/api/login-check' };

export default async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  if (req.method !== 'GET') return json(req, 405, { valid: false });
  const token = new URL(req.url).searchParams.get('token') || '';
  try {
    const { valid, email, kategorie } = verifyLoginToken(token);
    return json(req, 200, { valid, email, kategorie });
  } catch (e) {
    console.error('login-check: Konfigurationsfehler', e.message);
    return json(req, 500, { valid: false, email: '', kategorie: '' });
  }
};
