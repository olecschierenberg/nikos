// Signierte Tokens (Login-Links, Klassifizierungs-Links)
import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import { KATEGORIEN } from './config.mjs';

const LOGIN_TTL_MS = 24 * 60 * 60 * 1000;

function secret() {
  const s = process.env.NIKOS_SECRET;
  if (!s || s.length < 24) throw new Error('NIKOS_SECRET fehlt oder ist zu kurz (mind. 24 Zeichen)');
  return s;
}
const sign = (msg) => createHmac('sha256', secret()).update(msg).digest('base64url');

export function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Login-Token: base64url({e,k,x}) + "." + HMAC (Format wie bisher, 24 h gültig). */
export function createLoginToken({ email, kategorie, now = Date.now() }) {
  const payload = Buffer.from(JSON.stringify({ e: email, k: kategorie, x: now + LOGIN_TTL_MS }), 'utf8').toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifyLoginToken(token, now = Date.now()) {
  const bad = { valid: false, email: '', kategorie: '' };
  const t = String(token || '').trim();
  if (t.length > 1000) return bad;
  const parts = t.split('.');
  if (parts.length !== 2) return bad;
  if (!safeEqual(sign(parts[0]), parts[1])) return bad;
  try {
    const p = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    if (!p || !p.x || now >= Number(p.x)) return bad;
    if (typeof p.e !== 'string' || !KATEGORIEN.includes(p.k)) return bad;
    return { valid: true, email: p.e, kategorie: p.k };
  } catch {
    return bad;
  }
}

/** Unterschrift für die Klassifizierungs-Links (nur RADACOM bekommt sie per Mail). */
export function classifySig(token, kat) {
  return sign(`classify:${token}:${kat}`);
}

/** Zufälliges, nicht erratbares Token für Zugangsanfragen. */
export function newRequestToken() {
  return `zg-${Date.now().toString(36)}-${randomBytes(12).toString('hex')}`;
}

/** Nur harmlose Zeichen zulassen. */
export function cleanToken(v) {
  const t = String(v || '').trim();
  return /^[A-Za-z0-9_-]{3,80}$/.test(t) ? t : '';
}
