// Google-Dienstkonto: Anmeldung (JWT) ohne Zusatzpakete, Zugangstoken je Berechtigung zwischengespeichert.
import { createSign } from 'node:crypto';

const cache = new Map(); // scope -> { token, exp }

function credentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON fehlt');
  let c;
  try { c = JSON.parse(raw); } catch { throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON ist kein gültiges JSON'); }
  if (!c.client_email || !c.private_key) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON: client_email/private_key fehlen');
  return { email: c.client_email, key: String(c.private_key).replace(/\\n/g, '\n') };
}

const b64u = (s) => Buffer.from(s).toString('base64url');

export async function googleAccessToken(scope) {
  const now = Math.floor(Date.now() / 1000);
  const hit = cache.get(scope);
  if (hit && hit.exp - 60 > now) return hit.token;
  const { email, key } = credentials();
  const head = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64u(JSON.stringify({ iss: email, scope, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
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
  cache.set(scope, { token: j.access_token, exp: now + Number(j.expires_in || 3600) });
  return j.access_token;
}
