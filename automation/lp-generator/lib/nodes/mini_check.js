// NEU (2026-09-03, kein n8n-Vorbild): "minimaler automatischer Check" fuer
// Uebersetzungen (siehe Konzept_Mehrsprachige-LPs_2026-09-03_v2.md Abschnitt
// 3 -- bewusst KEIN voller QA-Agent-/Nachbesserungs-Loop pro Sprache,
// sondern ein mechanischer Sicherheitsnetz-Check: Platzhalter-Reste,
// fehlende Felder, verlorene Modulnamen, grobe Laengen-/Kopier-Anomalien).
// Erwartet $json = { translated:{...}, source:{...gleiche Schluessel, DE},
// lang:'fr', region, einsatz, problem }. Gibt { ok, issues[], translated }.

const REQUIRED_KEYS = ['headline','subhead','intro','usp_intro','usp',
  'faq1_q','faq1_a','faq2_q','faq2_a','faq3_q','faq3_a','faq4_q','faq4_a','faq5_q','faq5_a','slug_kw'];
const MODULE_RE = /NIKOS \[(audio|dispatcher|horn|flash|relay|clamp|LED|XLR|moon)\]²/g;

function allText(o){ return REQUIRED_KEYS.map(k => String(o[k] || '')).join(' ␟ '); }

const j = $json;
const t = j.translated || {};
const s = j.source || {};
const lang = j.lang || '?';
// sourceLang (NEU 2026-09-09, Primaersprache-Umstellung): frueher war die
// Quelle IMMER Deutsch, daher genuegte "lang !== 'de'" fuer den
// Unveraendert-Check unten. Jetzt kann die Quelle jede Baseline-Sprache sein
// (z.B. Franzoesisch primaer -> Deutsch als Zielsprache) -- Default 'de' fuer
// Rueckwaertskompatibilitaet, falls sourceLang (noch) nicht mitgegeben wird.
const sourceLang = j.sourceLang || 'de';
const issues = [];

// 1) Alle Felder vorhanden und nicht leer
for (const k of REQUIRED_KEYS) {
  if (!t[k] || !String(t[k]).trim()) issues.push('LEER:' + k);
}

// 2) Keine Template-/Platzhalter-Reste
const joined = allText(t);
if (/\{\{|\$json\.|```/.test(joined)) issues.push('TEMPLATE_RESTE');

// 3) Modulnamen 1:1 erhalten (Menge der im Deutschen vorkommenden Module
//    muss Teilmenge/gleich der im Zielsprachtext vorkommenden sein)
const srcModules = new Set((allText(s).match(MODULE_RE) || []));
const tgtModules = new Set((joined.match(MODULE_RE) || []));
for (const m of srcModules) { if (!tgtModules.has(m)) issues.push('MODUL_FEHLT:' + m); }

// 4) NIKOS muss erwaehnt werden, wenn es im Original erwaehnt wird
if (/\bNIKOS\b/.test(allText(s)) && !/\bNIKOS\b/.test(joined)) issues.push('NIKOS_FEHLT');

// 5) Grobe Laengen-Plausibilitaet je Feld (verhindert Abschneiden/Leerlauf-
//    Kopien) -- nur fuer Felder mit nennenswerter Quelllaenge, slug_kw
//    ausgenommen (bewusst kurz).
for (const k of REQUIRED_KEYS) {
  if (k === 'slug_kw') continue;
  const sl = String(s[k] || '').length;
  const tl = String(t[k] || '').length;
  if (sl >= 8) {
    if (tl < sl * 0.35) issues.push('ZU_KURZ:' + k);
    if (tl > sl * 3.0) issues.push('ZU_LANG:' + k);
  }
}

// 6) Kein 1:1-Kopieren des Originals (Non-Op-Uebersetzung), ausser bei sehr
//    kurzen/technischen Feldern wo Ueberschneidung normal ist. Vergleich
//    gegen die tatsaechliche Ausgangssprache (sourceLang), nicht hart gegen
//    'de' -- sonst wuerde dieser Check bei einer Uebersetzung NACH Deutsch
//    (moeglich, seit die Primaersprache auch Franzoesisch/Italienisch/... sein
//    kann) faelschlich uebersprungen.
if (lang !== sourceLang) {
  for (const k of ['headline','subhead','intro','usp']) {
    const sv = String(s[k] || '').trim();
    const tv = String(t[k] || '').trim();
    if (sv.length > 15 && sv === tv) issues.push('UNVERAENDERT:' + k);
  }
}

// 7) slug_kw: keine Satzzeichen/Anfuehrungszeichen, 2-6 "Woerter"
const slugKw = String(t.slug_kw || '').trim();
if (slugKw) {
  if (/["'.,;:!?]/.test(slugKw)) issues.push('SLUG_KW_SATZZEICHEN');
  const wc = slugKw.split(/\s+/).filter(Boolean).length;
  if (wc < 1 || wc > 6) issues.push('SLUG_KW_WORTZAHL');
}

// 8) (2026-11-09) Headline: hoechstens 64 Zeichen (wird zum Seitentitel) und Region enthalten,
//    wenn die Ausgangs-headline sie enthaelt (Region = Teil der Keywordkombination).
const rn = x => String(x || '').replace(/ß/g,'ss').replace(/æ/g,'ae').replace(/ø/g,'o').replace(/ł/g,'l').replace(/đ/g,'d').replace(/ı/g,'i').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'');
const ABBR = { 'nordrheinwestfalen':['nrw'], 'badenwurttemberg':['bw','bawu'], 'rheinlandpfalz':['rlp'], 'mecklenburgvorpommern':['mv'], 'schleswigholstein':['sh'], 'niedersachsen':['nds'], 'sachsenanhalt':['lsa'], 'vereinigtesonigreich':['uk'], 'vereinigtekonigreich':['uk'], 'vereinigtestaaten':['usa','us'], 'deutschland':['de'] };
const hasRegion = (headline, reg) => {
  const h = rn(headline), r = rn(reg); if (!r) return true;
  if (h.includes(r)) return true;
  const low = String(headline || '').replace(/ß/g,'ss').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  return (ABBR[r] || []).some(a => new RegExp('(^|[^a-z0-9])' + a + '([^a-z0-9]|$)').test(low));
};
const hl = String(t.headline || '');
if (hl.length > 64) issues.push('HEADLINE_ZU_LANG:' + hl.length + '_Zeichen_max_62_kuerzen_Region_behalten');
const regionSrc = String(j.region || ''), einsatzSrc = String(j.einsatz || '');
if (regionSrc && !rn(einsatzSrc).includes(rn(regionSrc)) && hasRegion(s.headline, regionSrc)) {
  const rl = String(t.region_local || '');
  if (!rl.trim()) issues.push('REGION_LOCAL_FEHLT');
  else if (!hasRegion(hl, rl)) issues.push('REGION_NICHT_IN_HEADLINE:' + rl);
}

return { json: { ok: issues.length === 0, issues, translated: t, lang } };
