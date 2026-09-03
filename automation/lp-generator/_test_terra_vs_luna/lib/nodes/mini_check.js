const REQUIRED_KEYS = ['headline','subhead','intro','usp_intro','usp',
  'faq1_q','faq1_a','faq2_q','faq2_a','faq3_q','faq3_a','faq4_q','faq4_a','slug_kw'];
const MODULE_RE = /NIKOS \[(audio|dispatcher|horn|flash|relay|clamp|LED|XLR|moon)\]²/g;

function allText(o){ return REQUIRED_KEYS.map(k => String(o[k] || '')).join(' ␟ '); }

const j = $json;
const t = j.translated || {};
const s = j.source || {};
const lang = j.lang || '?';
const issues = [];

for (const k of REQUIRED_KEYS) {
  if (!t[k] || !String(t[k]).trim()) issues.push('LEER:' + k);
}

const joined = allText(t);
if (/\{\{|\$json\.|```/.test(joined)) issues.push('TEMPLATE_RESTE');

const srcModules = new Set((allText(s).match(MODULE_RE) || []));
const tgtModules = new Set((joined.match(MODULE_RE) || []));
for (const m of srcModules) { if (!tgtModules.has(m)) issues.push('MODUL_FEHLT:' + m); }

if (/\bNIKOS\b/.test(allText(s)) && !/\bNIKOS\b/.test(joined)) issues.push('NIKOS_FEHLT');

for (const k of REQUIRED_KEYS) {
  if (k === 'slug_kw') continue;
  const sl = String(s[k] || '').length;
  const tl = String(t[k] || '').length;
  if (sl >= 8) {
    if (tl < sl * 0.35) issues.push('ZU_KURZ:' + k);
    if (tl > sl * 3.0) issues.push('ZU_LANG:' + k);
  }
}

if (lang !== 'de') {
  for (const k of ['headline','subhead','intro','usp']) {
    const sv = String(s[k] || '').trim();
    const tv = String(t[k] || '').trim();
    if (sv.length > 15 && sv === tv) issues.push('UNVERAENDERT:' + k);
  }
}

const slugKw = String(t.slug_kw || '').trim();
if (slugKw) {
  if (/["'.,;:!?]/.test(slugKw)) issues.push('SLUG_KW_SATZZEICHEN');
  const wc = slugKw.split(/\s+/).filter(Boolean).length;
  if (wc < 1 || wc > 6) issues.push('SLUG_KW_WORTZAHL');
}

return { json: { ok: issues.length === 0, issues, translated: t, lang } };
