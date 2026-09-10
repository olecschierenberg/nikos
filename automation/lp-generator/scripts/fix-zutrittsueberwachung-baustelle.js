#!/usr/bin/env node
'use strict';
/**
 * NIKOS Einmal-Skript (2026-09-10) -- Sonderfall EINE Seite:
 * loesungen/zutrittsueberwachung-baustelle/index.html
 *
 * HINTERGRUND: Beim Lauf von fix-missing-en-content.js wurde diese Seite als
 * Anomalie geloggt: "USP-Text beginnt nicht mit erwarteter usp_intro-Variante 0".
 * Grund: pickUspIndex()/pickFaqIndex() berechnen den erwarteten Varianten-Index
 * live aus den AKTUELLEN Sheet-Werten (Problem/Einsatz/Region) -- die Seite
 * wurde aber offenbar mit einem damals ANDEREN Region-Wert erzeugt (vermutlich
 * einem leeren String statt des heutigen Sheet-Werts), wodurch der Hash heute
 * einen anderen Index liefert als beim Erzeugen der Seite.
 *
 * VERIFIKATION (siehe Session-Log, 2026-09-10): mit Region='' (statt dem
 * heutigen Sheet-Wert) liefert pickUspIndex('Zutrittsüberwachung','Baustelle','')
 * exakt Index 2 -- das USP-Intro auf der Seite beginnt tatsaechlich exakt mit
 * USP_INTRO_DE_VARIANTS[2] ("Eine Plattform für alles: ..."). Ebenso liefert
 * pickFaqIndex(...) mit Region='' exakt Index 4 -- die erste FAQ-Frage auf der
 * Seite ("Hält sich NIKOS bei Durchsagen an die geltenden Normen?") ist
 * WORTIDENTISCH mit FAQ1_Q_DE_VARIANTS[4], und die zugehoerige Antwort
 * (ohne Schlusssatz) ist WORTIDENTISCH mit FAQ1_A_DE_VARIANTS[4]. Beide
 * Treffer sind exakte String-Uebereinstimmungen (kein Zufall) -- die Seite
 * wurde also mit Region='' generiert.
 *
 * DIESES SKRIPT: identische Logik wie processPage() in
 * fix-missing-en-content.js, aber mit FEST VERDRAHTETEN, oben verifizierten
 * Indizes (uspIdx=2, faqIdx=4) statt live berechneten -- NUR fuer genau diese
 * eine Seite. Gleiche Sicherheits-Checks (exakte 1x-/4x-Treffer, Byte-
 * Rueckvergleich beim Schreiben, KEIN Raten).
 *
 * Aufruf: node scripts/fix-zutrittsueberwachung-baustelle.js (Dry-Run) / --live
 */

const fs = require('fs');
const path = require('path');
const { chatCompletion } = require('../lib/openai.js');
const { runAllItems } = require('../lib/runCodeNode.js');
const { renderExpr } = require('../lib/expr.js');
const { LANG_META } = require('../lib/i18n.js');
const {
  USP_INTRO_DE_VARIANTS, USP_INTRO_TRANSLATIONS,
  FAQ1_Q_DE_VARIANTS, FAQ1_Q_TRANSLATIONS,
  FAQ1_A_DE_VARIANTS, FAQ1_A_TRANSLATIONS,
  FAQ1_A_CLOSING_DE, FAQ1_A_CLOSING_TRANSLATIONS,
} = require('../lib/textbausteine.js');

const LIVE = process.argv.includes('--live');
const SLUG = 'zutrittsueberwachung-baustelle';
// Verifizierte, mit der Live-Seite exakt uebereinstimmende Indizes (siehe
// Kopfkommentar) -- NICHT live aus dem Sheet berechnet.
const USP_IDX = 2;
const FAQ_IDX = 4;
// Kontext nur fuer den Uebersetzungs-Prompt (Anzeige-Kontext, siehe
// uebersetzung.user.txt) -- keine Auswirkung auf die Varianten-Auswahl mehr.
const PROBLEM = 'Zutrittsüberwachung';
const EINSATZ = 'Baustelle';
const REGION = '';

const REPO_ROOT = path.join(__dirname, '..', '..', '..');
const LOESUNGEN_DIR = path.join(REPO_ROOT, 'loesungen');
const PROMPTS_DIR = path.join(__dirname, '..', 'lib', 'prompts');
const executionId = process.env.GITHUB_RUN_ID ? `gha-${process.env.GITHUB_RUN_ID}` : `local-${Date.now()}`;

function log(msg) { console.log(`[fix-zutrittsueberwachung-baustelle] ${msg}`); }
function readPrompt(name) { return fs.readFileSync(path.join(PROMPTS_DIR, name), 'utf8'); }

function modLogos(x) {
  return String(x || '').replace(/NIKOS \[([A-Za-z0-9]+)\](?:²|&sup2;)/g, (m, name) => {
    const a = (name === 'audio' || name === 'dispatcher' || name === 'moon') ? name : 'zubehoer';
    return `<a class="nk-mod" href="https://nikos.info/de/produkte/#${a}"><img src="https://nikos.info/assets/logos/nikos/SVG/NIKOS ${name}.svg" alt="NIKOS [${name}]²" loading="lazy"></a>`;
  });
}
const NIKOSLOGO = '<a class="nk-mod" href="https://nikos.info/index.html"><img src="https://nikos.info/assets/logos/nikos/SVG/NIKOS.svg" alt="NIKOS" loading="lazy"></a>';
function nkWordInner(inner) {
  const st = [];
  inner = inner.replace(/<a class="nk-mod[^>]*>[\s\S]*?<\/a>/g, (mm) => { st.push(mm); return `%%NKM${st.length - 1}%%`; });
  inner = inner.replace(/NIKOS(?!-|[A-Za-z0-9²]| \[)/g, NIKOSLOGO);
  inner = inner.replace(/%%NKM(\d+)%%/g, (mm, i) => st[+i]);
  return inner;
}
function linkify(text) { return nkWordInner(modLogos(text)); }

function delinkify(html) {
  if (!html) return '';
  let t = String(html);
  t = t.replace(/<a class="nk-mod"[^>]*>\s*<img[^>]*alt="([^"]*)"[^>]*>\s*<\/a>/g, '$1');
  t = t.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/g, '$1');
  return t;
}
function hasStrayTags(text) { return /<[a-z!][\s\S]*>/i.test(String(text || '')); }

async function callTranslation({ deFields, correctionNote }) {
  const lm = LANG_META.en || { label: 'Englisch' };
  const srcLm = LANG_META.de || { label: 'Deutsch' };
  const userPromptFinal = renderExpr(readPrompt('uebersetzung.user.txt'), {
    $: () => {},
    $json: {
      quellsprache_label: srcLm.label,
      zielsprache_label: lm.label,
      zielsprache_code: 'en',
      problem: PROBLEM, einsatz: EINSATZ, region_oder_ueberregional: REGION || 'ueberregional/kein fester Ort',
      quelltext_json: JSON.stringify(deFields) + (correctionNote ? (`\n\nHINWEIS (WICHTIG, unbedingt beachten): ${correctionNote}`) : ''),
    },
    $now: null,
  });
  const systemPrompt = readPrompt('uebersetzung.system.txt');
  const result = await chatCompletion({
    apiKey: process.env.OPENAI_API_KEY, model: 'gpt-5.6-luna',
    system: systemPrompt, user: userPromptFinal,
    maxTokens: 1800, timeoutMs: 180000, maxRetries: 1,
  });
  const parsed = runAllItems('uebersetzung_json.js', {
    items: [result], nodeOutputs: new Map(), staticData: {}, executionId,
  })[0].json.output;

  // Gepoolte Bausteine NICHT von der KI uebersetzen lassen -- exakt wie im
  // Original-Skript, aber mit den verifizierten Indizes USP_IDX/FAQ_IDX.
  if (USP_INTRO_TRANSLATIONS.en) parsed.usp_intro = USP_INTRO_TRANSLATIONS.en[USP_IDX];
  if (FAQ1_Q_TRANSLATIONS.en) parsed.faq1_q = FAQ1_Q_TRANSLATIONS.en[FAQ_IDX];
  if (FAQ1_A_TRANSLATIONS.en) {
    parsed.faq1_a = `${FAQ1_A_TRANSLATIONS.en[FAQ_IDX]} ${FAQ1_A_CLOSING_TRANSLATIONS.en || FAQ1_A_CLOSING_DE}`;
  }

  const check = runAllItems('mini_check.js', {
    items: [{ json: { translated: parsed, source: deFields, lang: 'en', sourceLang: 'de' } }],
    nodeOutputs: new Map(), staticData: {}, executionId,
  })[0].json;
  return { parsed, check };
}

async function translateToLanguage(initialDeFields) {
  let args = { deFields: initialDeFields };
  for (let attempt = 1; attempt <= 2; attempt++) {
    let outcome;
    try {
      outcome = await callTranslation(args);
    } catch (err) {
      log(`  Uebersetzung fehlgeschlagen (Versuch ${attempt}): ${err.message}`);
      if (attempt === 2) return null;
      continue;
    }
    if (outcome.check.ok) {
      if (attempt > 1) log('  Uebersetzung nach Korrektur OK.');
      return outcome.parsed;
    }
    log(`  minimaler Check meldet Probleme (Versuch ${attempt}): ${outcome.check.issues.join(', ')}`);
    if (attempt === 2) {
      log('  weiterhin Probleme nach Korrektur -- Seite wird uebersprungen.');
      return null;
    }
    args = { ...args, correctionNote: `Deine vorherige Uebersetzung hatte folgende Probleme -- behebe sie in dieser neuen Fassung: ${outcome.check.issues.join(', ')}` };
  }
  return null;
}

const RE = {
  h1De: /<h1 data-de>([\s\S]*?)<\/h1>/,
  h1EnExists: /<h1 data-en>/,
  subheadDe: /<h2 class="heading-l" style="margin-top:12px;" data-de>([\s\S]*?)<\/h2>/,
  introDe: /<p class="body-l" style="margin-top:14px;max-width:860px;color:var\(--mid\);" data-de>([\s\S]*?)<\/p>/,
  uspDe: /<p class="body-l" style="max-width:860px;" data-de>([\s\S]*?)<\/p>/,
  faqQDeAll: /<span class="faq-q" data-de>([\s\S]*?)<\/span>/g,
  faqADeAll: /<div class="faq-item__body" data-de>([\s\S]*?)<\/div>/g,
};
const EMPTY = {
  subheadEn: '<h2 class="heading-l" style="margin-top:12px;" data-en></h2>',
  introEn: '<p class="body-l" style="margin-top:14px;max-width:860px;color:var(--mid);" data-en></p>',
  uspEn: '<p class="body-l" style="max-width:860px;" data-en></p>',
  faqQEnOpen: '<span class="faq-q" data-en>', faqQEnClose: '</span>',
  faqAEnOpen: '<div class="faq-item__body" data-en>', faqAEnClose: '</div>',
};
EMPTY.faqQEn = EMPTY.faqQEnOpen + EMPTY.faqQEnClose;
EMPTY.faqAEn = EMPTY.faqAEnOpen + EMPTY.faqAEnClose;

function matchAllGroups(re, content) {
  const out = [];
  let m;
  const r = new RegExp(re.source, re.flags);
  while ((m = r.exec(content))) out.push(m[1]);
  return out;
}
function replaceExactlyOnce(content, oldStr, newStr, label, issues) {
  const count = content.split(oldStr).length - 1;
  if (count !== 1) { issues.push(`${label}: erwartet 1x, gefunden ${count}x`); return { content, ok: false }; }
  return { content: content.split(oldStr).join(newStr), ok: true };
}
function replaceEmptyTagsInOrder(content, emptyTag, openTag, closeTag, values, label, issues) {
  const parts = content.split(emptyTag);
  const count = parts.length - 1;
  if (count !== values.length) { issues.push(`${label}: erwartet ${values.length}x, gefunden ${count}x`); return { content, ok: false }; }
  let out = parts[0];
  for (let i = 0; i < values.length; i++) out += openTag + values[i] + closeTag + parts[i + 1];
  return { content: out, ok: true };
}
function writeVerified(file, content) {
  fs.writeFileSync(file, content, 'utf8');
  const back = fs.readFileSync(file, 'utf8');
  if (back !== content) throw new Error(`Integritaetspruefung fehlgeschlagen beim Schreiben von ${file}`);
}

async function main() {
  console.log(`Modus: ${LIVE ? 'LIVE (uebersetzt + schreibt wirklich)' : 'DRY-RUN (keine KI-Aufrufe, schreibt NICHTS, nur Diagnose)'}`);
  if (LIVE && !process.env.OPENAI_API_KEY) { console.error('ABBRUCH: OPENAI_API_KEY fehlt.'); process.exit(1); }

  const file = path.join(LOESUNGEN_DIR, SLUG, 'index.html');
  if (!fs.existsSync(file)) { console.error(`ABBRUCH: ${file} existiert nicht.`); process.exit(1); }
  const orig = fs.readFileSync(file, 'utf8');
  const issues = [];

  if (!/var IS_DUAL=false;/.test(orig)) { console.error('ABBRUCH: Seite ist nicht IS_DUAL=false (klassischer Modus).'); process.exit(1); }
  if (RE.h1EnExists.test(orig)) { console.error('ABBRUCH: Seite hat bereits <h1 data-en> -- nichts zu tun.'); process.exit(1); }

  const h1m = RE.h1De.exec(orig);
  const subheadM = RE.subheadDe.exec(orig);
  const introM = RE.introDe.exec(orig);
  const uspM = RE.uspDe.exec(orig);
  const faqQs = matchAllGroups(RE.faqQDeAll, orig);
  const faqAs = matchAllGroups(RE.faqADeAll, orig);

  if (!h1m || !subheadM || !introM || !uspM || faqQs.length !== 4 || faqAs.length !== 4) {
    console.error(`ABBRUCH: unerwartete DE-Struktur (h1=${!!h1m} subhead=${!!subheadM} intro=${!!introM} usp=${!!uspM} faqQ=${faqQs.length} faqA=${faqAs.length})`);
    process.exit(1);
  }
  const subheadEnCount = orig.split(EMPTY.subheadEn).length - 1;
  const introEnCount = orig.split(EMPTY.introEn).length - 1;
  const uspEnCount = orig.split(EMPTY.uspEn).length - 1;
  const faqQEnCount = orig.split(EMPTY.faqQEn).length - 1;
  const faqAEnCount = orig.split(EMPTY.faqAEn).length - 1;
  if (subheadEnCount !== 1 || introEnCount !== 1 || uspEnCount !== 1 || faqQEnCount !== 4 || faqAEnCount !== 4) {
    console.error(`ABBRUCH: unerwartete leere EN-Slots (subhead=${subheadEnCount} intro=${introEnCount} usp=${uspEnCount} faqQ=${faqQEnCount} faqA=${faqAEnCount})`);
    process.exit(1);
  }

  const headlineDe = delinkify(h1m[1]);
  const subheadDe = delinkify(subheadM[1]);
  const introDe = delinkify(introM[1]);
  const uspDeFull = delinkify(uspM[1]);
  const faqQDe = faqQs.map(delinkify);
  const faqADe = faqAs.map(delinkify);

  for (const [label, t] of [['headline', headlineDe], ['subhead', subheadDe], ['intro', introDe], ['usp', uspDeFull],
    ...faqQDe.map((t, i) => [`faq${i + 1}_q`, t]), ...faqADe.map((t, i) => [`faq${i + 1}_a`, t])]) {
    if (hasStrayTags(t)) issues.push(`unerwartetes HTML in ${label} nach Rueckwandlung: "${t.slice(0, 80)}"`);
  }
  if (issues.length) { console.error('ABBRUCH:', issues.join(' | ')); process.exit(1); }

  const uspPrefix = `${USP_INTRO_DE_VARIANTS[USP_IDX]} `;
  if (!uspDeFull.startsWith(uspPrefix)) {
    console.error(`ABBRUCH: USP-Text passt weiterhin nicht zu Variante ${USP_IDX}: "${uspDeFull.slice(0, 90)}"`);
    process.exit(1);
  }
  const uspDeBody = uspDeFull.slice(uspPrefix.length);

  const faq1QExpected = FAQ1_Q_DE_VARIANTS[FAQ_IDX];
  const faq1AExpected = `${FAQ1_A_DE_VARIANTS[FAQ_IDX]} ${FAQ1_A_CLOSING_DE}`;
  if (faqQDe[0] !== faq1QExpected) { console.error(`ABBRUCH: FAQ1-Frage passt nicht zu Variante ${FAQ_IDX}.\nSeite:    "${faqQDe[0]}"\nErwartet: "${faq1QExpected}"`); process.exit(1); }
  if (faqADe[0] !== faq1AExpected) { console.error(`ABBRUCH: FAQ1-Antwort passt nicht zu Variante ${FAQ_IDX}.\nSeite:    "${faqADe[0]}"\nErwartet: "${faq1AExpected}"`); process.exit(1); }
  log(`Verifiziert: USP-Text = Variante ${USP_IDX}, FAQ1 = Variante ${FAQ_IDX} (exakte Uebereinstimmung mit der Live-Seite).`);

  const deFields = {
    headline: headlineDe, subhead: subheadDe, intro: introDe,
    usp_intro: USP_INTRO_DE_VARIANTS[USP_IDX], usp: uspDeBody,
    faq1_q: faq1QExpected, faq1_a: faq1AExpected,
    faq2_q: faqQDe[1], faq2_a: faqADe[1],
    faq3_q: faqQDe[2], faq3_a: faqADe[2],
    faq4_q: faqQDe[3], faq4_a: faqADe[3],
    slug_kw: '',
  };

  log('Qualifizierend. ' + (LIVE ? 'Uebersetze ...' : '(Dry-Run -- keine KI-Aufrufe.)'));
  if (!LIVE) { console.log('\nDies war ein DRY-RUN. Zum wirklichen Ausfuehren erneut mit --live aufrufen.'); return; }

  const parsed = await translateToLanguage(deFields);
  if (!parsed) { console.error('ABBRUCH: Uebersetzung fehlgeschlagen.'); process.exit(1); }

  const headlineEn = parsed.headline;
  const subheadEn = parsed.subhead;
  const introEn = linkify(parsed.intro);
  const uspEn = linkify(`${parsed.usp_intro} ${parsed.usp}`);
  const faqQEn = [parsed.faq1_q, parsed.faq2_q, parsed.faq3_q, parsed.faq4_q];
  const faqAEn = [parsed.faq1_a, parsed.faq2_a, parsed.faq3_a, parsed.faq4_a].map(linkify);

  for (const [label, t] of [['headline_en', headlineEn], ['subhead_en', subheadEn]]) {
    if (!t || !String(t).trim()) { console.error(`ABBRUCH: leeres Uebersetzungsfeld ${label}`); process.exit(1); }
  }

  let content = orig;
  let ok = true;
  const patchIssues = [];
  ({ content, ok } = replaceExactlyOnce(content, h1m[0], `${h1m[0]}\n      <h1 data-en>${headlineEn}</h1>`, 'h1', patchIssues)); if (!ok) { console.error('ABBRUCH:', patchIssues.join(' | ')); process.exit(1); }
  ({ content, ok } = replaceExactlyOnce(content, EMPTY.subheadEn, `<h2 class="heading-l" style="margin-top:12px;" data-en>${subheadEn}</h2>`, 'subhead_en', patchIssues)); if (!ok) { console.error('ABBRUCH:', patchIssues.join(' | ')); process.exit(1); }
  ({ content, ok } = replaceExactlyOnce(content, EMPTY.introEn, `<p class="body-l" style="margin-top:14px;max-width:860px;color:var(--mid);" data-en>${introEn}</p>`, 'intro_en', patchIssues)); if (!ok) { console.error('ABBRUCH:', patchIssues.join(' | ')); process.exit(1); }
  ({ content, ok } = replaceExactlyOnce(content, EMPTY.uspEn, `<p class="body-l" style="max-width:860px;" data-en>${uspEn}</p>`, 'usp_en', patchIssues)); if (!ok) { console.error('ABBRUCH:', patchIssues.join(' | ')); process.exit(1); }
  ({ content, ok } = replaceEmptyTagsInOrder(content, EMPTY.faqQEn, EMPTY.faqQEnOpen, EMPTY.faqQEnClose, faqQEn, 'faq_q_en', patchIssues)); if (!ok) { console.error('ABBRUCH:', patchIssues.join(' | ')); process.exit(1); }
  ({ content, ok } = replaceEmptyTagsInOrder(content, EMPTY.faqAEn, EMPTY.faqAEnOpen, EMPTY.faqAEnClose, faqAEn, 'faq_a_en', patchIssues)); if (!ok) { console.error('ABBRUCH:', patchIssues.join(' | ')); process.exit(1); }

  writeVerified(file, content);
  log('OK -- EN-Inhalte ergaenzt und geschrieben.');
}

main().catch((err) => { console.error('FEHLER:', err); process.exit(1); });
