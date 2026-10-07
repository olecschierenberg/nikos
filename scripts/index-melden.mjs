// Meldet neue/geaenderte Seiten an Suchmaschinen (laeuft in GitHub Actions, ohne PC).
//  1) IndexNow (Bing, Yandex u. a.; Google nutzt IndexNow nicht)
//  2) Google Search Console: Sitemap-Index neu einreichen (Sitemaps-API)
// Beide Schritte sind unabhaengig; ein Fehler bei einem stoppt den anderen nicht.
import { readFileSync, readdirSync } from 'node:fs';
import { createSign } from 'node:crypto';

const HOST = 'nikos.info';
const TAGE = Number(process.env.LOOKBACK_DAYS || 2);
const KEY = readdirSync('.').find(f => /^[0-9a-f]{32}\.txt$/.test(f))?.replace('.txt', '');
let fehler = 0;

// --- URLs mit lastmod der letzten TAGE Tage aus sitemap.xml ---
const xml = readFileSync('sitemap.xml', 'utf8');
const grenze = Date.now() - TAGE * 86400000;
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)]
  .filter(m => Date.parse(m[2]) >= grenze).map(m => m[1]);
console.log(`Geaenderte URLs (letzte ${TAGE} Tage): ${urls.length}`);

// --- 1) IndexNow ---
if (!KEY) { console.log('IndexNow: keine Key-Datei gefunden, uebersprungen.'); }
else if (urls.length) {
  for (let i = 0; i < urls.length; i += 9000) {
    const r = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: urls.slice(i, i + 9000) }),
    });
    const txt = r.status >= 400 ? await r.text() : '';
    console.log(`IndexNow: HTTP ${r.status} ${txt}`);
    if (r.status >= 400) { console.log(`::error title=IndexNow::HTTP ${r.status} ${txt}`); fehler++; }
  }
}

// --- 2) Google Search Console: Sitemap einreichen ---
const sa = process.env.GSC_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
if (!sa) console.log('GSC: Secret GSC_SERVICE_ACCOUNT_JSON fehlt, uebersprungen.');
else {
  try {
    const k = JSON.parse(sa), b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url'), now = Math.floor(Date.now() / 1000);
    const head = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: k.client_email, scope: 'https://www.googleapis.com/auth/webmasters', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
    const sig = createSign('RSA-SHA256').update(head).sign(k.private_key, 'base64url');
    const t = await (await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${head}.${sig}` })).json();
    if (!t.access_token) throw new Error('Token: ' + JSON.stringify(t));
    const site = encodeURIComponent('sc-domain:nikos.info'), sm = encodeURIComponent(`https://${HOST}/sitemap-index.xml`);
    const r = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${site}/sitemaps/${sm}`, { method: 'PUT', headers: { Authorization: `Bearer ${t.access_token}`, 'Content-Length': '0' } });
    console.log(`GSC Sitemap-Submit: HTTP ${r.status} ${r.status >= 400 ? await r.text() : ''}`);
    if (r.status >= 400) { console.log(`::error title=Google Sitemap::HTTP ${r.status}`); fehler++; }
  } catch (e) { console.log(`::error title=Google-Fehler::${e.message}`); fehler++; }
}
process.exit(fehler ? 1 : 0);
