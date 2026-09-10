#!/usr/bin/env node
'use strict';
/**
 * NIKOS Nachruestskript (2026-09-10, expliziter Nutzer-Auftrag): "Die Texte sollen in
 * der englischen Version selbstverstaendlich nicht leer sein. Das ist ein Fehler und
 * war nie so gewollt." -- bestehende klassische Landingpages (loesungen/<slug>/index.html,
 * Modus DEUTSCH / IS_DUAL=false) haben bislang NUR data-de-Inhalte; alle data-en-Slots
 * (Subhead, Intro, USP, FAQ1-4 Q+A) sind leer, UND es gibt gar kein <h1 data-en> (nur
 * <h1 data-de>) -- siehe lib/nodes/html_bauen.js h1BlockHtml/USP_EN/SUBHEAD_EN etc.
 * Dieses Skript uebersetzt die vorhandenen deutschen Inhalte ins Englische und schreibt
 * sie in die bisher leeren data-en-Slots (inkl. Ergaenzung des fehlenden <h1 data-en>).
 *
 * WICHTIG -- warum dieses Skript index.js NICHT einfach require()t: index.js fuehrt
 * beim Laden sofort main() aus (kein require.main-Guard) und ist fuer GENAU 1 neue
 * Seite pro Lauf gebaut, nicht fuer eine Nachbearbeitung bestehender Seiten. Die fuer
 * die Uebersetzung noetige Logik (callTranslation/translateToLanguage: Modell
 * gpt-5.6-luna, Prompts lib/prompts/uebersetzung.*.txt, gepoolte/freigegebene
 * usp_intro-/FAQ1-Bausteine ueber pickUspIndex/pickFaqIndex aus lib/textbausteine.js)
 * wird deshalb hier 1:1 dupliziert (identisches Vorgehen wie schon bei
 * retrofit-existing-lp-variants.js/html_bauen.js OPEN_DE_VARIANTS).
 *
 * SICHERHEIT (siehe Skill website-regeln):
 *  - Nur Seiten, bei denen VOR jeder Aenderung exakt die erwartete leere Struktur
 *    gefunden wird (1x <h1 data-de>, kein <h1 data-en>, genau 1x leerer Subhead-/
 *    Intro-/USP-data-en-Tag, genau 4x leere FAQ-Q-/FAQ-A-data-en-Tags), werden
 *    angefasst -- alles andere wird uebersprungen und als ANOMALIE geloggt, NIE
 *    geraten oder teilweise ersetzt.
 *  - Deutsche Ausgangstexte werden aus dem LIVE-HTML extrahiert (inkl. Rueckwandlung
 *    bereits eingefuegter Modul-Logo-Links in reinen Text), an die KI geschickt,
 *    danach wird die NIKOS-Logo-Verlinkung (identisch zu feinschliff.js modLogos()/
 *    nikosWord()) erneut auf die neuen EN-Texte angewendet.
 *  - FAQ1 (Normkonformitaet) wird NIE frisch von der KI uebersetzt, sondern immer aus
 *    dem bereits geprueft-freigegebenen Pool (lib/textbausteine.js) gebaut -- exakt wie
 *    im produktiven callTranslation() in index.js.
 *  - Datei-Schreiben mit Byte-Rueckvergleich (Integritaetspruefung).
 *
 * Aufruf:
 *   node scripts/fix-missing-en-content.js                    Dry-Run: nur Diagnose,
 *                                                              KEINE KI-Aufrufe, KEIN Schreiben.
 *   node scripts/fix-missing-en-content.js --live              Live: uebersetzt + schreibt
 *                                                              ALLE qualifizierenden Seiten.
 *   node scripts/fix-missing-en-content.js --live --limit=5    Live, aber nur die ersten 5
 *                                                              (fuer Stichprobenpruefung).
 *   node scripts/fix-missing-en-content.js --slug=<slug>       nur eine bestimmte Seite.
 */

const fs = require('fs');
const path = require('path');
const sheets = require('../lib/sheets.js');
const { chatCompletion } = require('../lib/openai.js');
const { runAllItems } = require('../lib/runCodeNode.js');
const { renderExpr } = require('../lib/expr.js');
const { LANG_META } = require('../lib/i18n.js');
const {
  USP_INTRO_DE_VARIANTS, USP_INTRO_TRANSLATIONS,
  FAQ1_Q_DE_VARIANTS, FAQ1_Q_TRANSLATIONS,
  FAQ1_A_DE_VARIANTS, FAQ1_A_TRANSLATIONS,
  FAQ1_A_CLOSING_DE, FAQ1_A_CLOSING_TRANSLATIONS,
  pickUspIndex, pickFaqIndex,
} = require('../lib/textbausteine.js');

const LIVE = process.argv.includes('--live');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;
const slugArg = process.argv.find((a) => a.startsWith('--slug='));
const ONLY_SLUG = slugArg ? slugArg.split('=')[1] : null;

const REPO_ROOT = path.join(__dirname, '..', '..', '..'); // .../site
const LOESUNGEN_DIR = path.join(REPO_ROOT, 'loesungen');
const PROMPTS_DIR = path.join(__dirname, '..', 'lib', 'prompts');
const SHEET_NAME = 'Keywordkombinationen';
const executionId = process.env.GITHUB_RUN_ID ? `gha-${process.env.GITHUB_RUN_ID}` : `local-${Date.now()}`;

function log(msg) { console.log(`[fix-missing-en-content] ${msg}`); }
function readPrompt(name) { return fs.readFileSync(path.join(PROMPTS_DIR, name), 'utf8'); }
function norm(v) { return String(v || '').trim(); }

// ── Modul-Logo-Verlinkung -- 1:1 identische Logik wie lib/nodes/feinschliff.js ──
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

// ── Rueckwandlung bereits verlinkter DE-Inhalte in reinen Text (fuer den KI-Prompt) ──
function delinkify(html) {
  if (!html) return '';
  let t = String(html);
  t = t.replace(/<a class="nk-mod"[^>]*>\s*<img[^>]*alt="([^"]*)"[^>]*>\s*<\/a>/g, '$1');
  t = t.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/g, '$1');
  return t;
}
function hasStrayTags(text) { return /<[a-z!][\s\S]*>/i.test(String(text || '')); }

// ── 1:1 Kopie aus index.js: callTranslation()/translateToLanguage() ──
// (Begruendung fuer die Duplizierung siehe Kopfkommentar oben.)
async function callTranslation({ lang, deFields, sourceLang, problem, einsatz, region, correctionNote }) {
  const lm = LANG_META[lang] || { label: lang };
  const srcLang = sourceLang || 'de';
  const srcLm = LANG_META[srcLang] || { label: srcLang };
  // renderExpr erwartet {{ $json.feld }}-Platzhalter -- wir bauen den Kontext hier
  // direkt nach, wie es index.js per render(tpl, {...}) tut (siehe dortige Aufruf-
  // stelle callTranslation()).
  const userPromptFinal = renderExpr(readPrompt('uebersetzung.user.txt'), {
    $: () => {},
    $json: {
      quellsprache_label: srcLm.label,
      zielsprache_label: lm.label,
      zielsprache_code: lang,
      problem, einsatz, region_oder_ueberregional: region || 'ueberregional/kein fester Ort',
      quelltext_json: JSON.stringify(deFields) + (correctionNote ? (`\n\nHINWEIS (WICHTIG, unbedingt beachten): ${correctionNote}`) : ''),
    },
    $now: null,
  });
  let systemPrompt = readPrompt('uebersetzung.system.txt');
  if (srcLang !== 'de') {
    systemPrompt = `HINWEIS: Die als "deutsche Ausgangstexte"/"deutschen Ausgangstext" bezeichneten Quelltexte in der folgenden Anweisung sind in diesem Fall NICHT auf Deutsch, sondern bereits fertig auf ${srcLm.label} (ISO ${srcLang}) verfasst -- behandle ueberall dort, wo unten von "Deutsch"/"deutsch" als Ausgangssprache die Rede ist, stattdessen ${srcLm.label} als Ausgangssprache. Alle uebrigen Anweisungen (Stil, Vollstaendigkeit, Modulnamen-Regeln, Format) gelten unveraendert.\n\n${systemPrompt}`;
  }
  const result = await chatCompletion({
    apiKey: process.env.OPENAI_API_KEY, model: 'gpt-5.6-luna',
    system: systemPrompt, user: userPromptFinal,
    maxTokens: 1800, timeoutMs: 180000, maxRetries: 1,
  });
  const parsed = runAllItems('uebersetzung_json.js', {
    items: [result], nodeOutputs: new Map(), staticData: {}, executionId,
  })[0].json.output;

  const _uspIdx = pickUspIndex(problem, einsatz, region);
  const _faqIdx = pickFaqIndex(problem, einsatz, region);
  if (lang === 'de') {
    parsed.usp_intro = USP_INTRO_DE_VARIANTS[_uspIdx];
  } else if (USP_INTRO_TRANSLATIONS[lang]) {
    parsed.usp_intro = USP_INTRO_TRANSLATIONS[lang][_uspIdx];
  }
  if (lang === 'de') {
    parsed.faq1_q = FAQ1_Q_DE_VARIANTS[_faqIdx];
    parsed.faq1_a = `${FAQ1_A_DE_VARIANTS[_faqIdx]} ${FAQ1_A_CLOSING_DE}`;
  } else {
    if (FAQ1_Q_TRANSLATIONS[lang]) parsed.faq1_q = FAQ1_Q_TRANSLATIONS[lang][_faqIdx];
    if (FAQ1_A_TRANSLATIONS[lang]) {
      parsed.faq1_a = `${FAQ1_A_TRANSLATIONS[lang][_faqIdx]} ${FAQ1_A_CLOSING_TRANSLATIONS[lang] || FAQ1_A_CLOSING_DE}`;
    }
  }
  const check = runAllItems('mini_check.js', {
    items: [{ json: { translated: parsed, source: deFields, lang, sourceLang: srcLang } }],
    nodeOutputs: new Map(), staticData: {}, executionId,
  })[0].json;
  return { parsed, check };
}

async function translateToLanguage(initialArgs) {
  const { lang } = initialArgs;
  let args = initialArgs;
  for (let attempt = 1; attempt <= 2; attempt++) {
    let outcome;
    try {
      outcome = await callTranslation(args);
    } catch (err) {
      log(`    [${lang}] Uebersetzung fehlgeschlagen (Versuch ${attempt}): ${err.message}`);
      if (attempt === 2) return null;
      continue;
    }
    if (outcome.check.ok) {
      if (attempt > 1) log(`    [${lang}] Uebersetzung nach Korrektur OK.`);
      return outcome.parsed;
    }
    log(`    [${lang}] minimaler Check meldet Probleme (Versuch ${attempt}): ${outcome.check.issues.join(', ')}`);
    if (attempt === 2) {
      log(`    [${lang}] weiterhin Probleme nach Korrektur -- Seite wird uebersprungen.`);
      return null;
    }
    args = { ...args, correctionNote: `Deine vorherige Uebersetzung hatte folgende Probleme -- behebe sie in dieser neuen Fassung: ${outcome.check.issues.join(', ')}` };
  }
  return null;
}

// ── HTML-Extraktion (exakte Tag-Strings aus lib/nodes/html_bauen.js TEMPLATE) ──
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
  if (count !== 1) {
    issues.push(`${label}: erwartet 1x, gefunden ${count}x`);
    return { content, ok: false };
  }
  return { content: content.split(oldStr).join(newStr), ok: true };
}
function replaceEmptyTagsInOrder(content, emptyTag, openTag, closeTag, values, label, issues) {
  const parts = content.split(emptyTag);
  const count = parts.length - 1;
  if (count !== values.length) {
    issues.push(`${label}: erwartet ${values.length}x, gefunden ${count}x`);
    return { content, ok: false };
  }
  let out = parts[0];
  for (let i = 0; i < values.length; i++) out += openTag + values[i] + closeTag + parts[i + 1];
  return { content: out, ok: true };
}

function writeVerified(file, content) {
  fs.writeFileSync(file, content, 'utf8');
  const back = fs.readFileSync(file, 'utf8');
  if (back !== content) throw new Error(`Integritaetspruefung fehlgeschlagen beim Schreiben von ${file}`);
}

async function processPage(slug, ctx, stats) {
  const file = path.join(LOESUNGEN_DIR, slug, 'index.html');
  const orig = fs.readFileSync(file, 'utf8');
  const issues = [];

  if (!/var IS_DUAL=false;/.test(orig)) { stats.notClassic.push(slug); return; }
  if (RE.h1EnExists.test(orig)) { stats.alreadyHasEn.push(slug); return; }

  const h1m = RE.h1De.exec(orig);
  const subheadM = RE.subheadDe.exec(orig);
  const introM = RE.introDe.exec(orig);
  const uspM = RE.uspDe.exec(orig);
  const faqQs = matchAllGroups(RE.faqQDeAll, orig);
  const faqAs = matchAllGroups(RE.faqADeAll, orig);

  if (!h1m || !subheadM || !introM || !uspM || faqQs.length !== 4 || faqAs.length !== 4) {
    issues.push(`unerwartete DE-Struktur (h1=${!!h1m} subhead=${!!subheadM} intro=${!!introM} usp=${!!uspM} faqQ=${faqQs.length} faqA=${faqAs.length})`);
    stats.anomalies.push({ slug, issues });
    return;
  }
  // Erwartete leere EN-Slots muessen VOR jeder Aenderung exakt vorhanden sein.
  const subheadEnCount = orig.split(EMPTY.subheadEn).length - 1;
  const introEnCount = orig.split(EMPTY.introEn).length - 1;
  const uspEnCount = orig.split(EMPTY.uspEn).length - 1;
  const faqQEnCount = orig.split(EMPTY.faqQEn).length - 1;
  const faqAEnCount = orig.split(EMPTY.faqAEn).length - 1;
  if (subheadEnCount !== 1 || introEnCount !== 1 || uspEnCount !== 1 || faqQEnCount !== 4 || faqAEnCount !== 4) {
    issues.push(`unerwartete leere EN-Slots (subhead=${subheadEnCount} intro=${introEnCount} usp=${uspEnCount} faqQ=${faqQEnCount} faqA=${faqAEnCount})`);
    stats.anomalies.push({ slug, issues });
    return;
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
  if (issues.length) { stats.anomalies.push({ slug, issues }); return; }

  const { Problem: problem, Einsatz: einsatz, Region: region } = ctx;
  const uspIdx = pickUspIndex(problem, einsatz, region);
  const faqIdx = pickFaqIndex(problem, einsatz, region);
  const uspPrefix = `${USP_INTRO_DE_VARIANTS[uspIdx]} `;
  if (!uspDeFull.startsWith(uspPrefix)) {
    stats.anomalies.push({ slug, issues: [`USP-Text beginnt nicht mit erwarteter usp_intro-Variante ${uspIdx}: "${uspDeFull.slice(0, 90)}"`] });
    return;
  }
  const uspDeBody = uspDeFull.slice(uspPrefix.length);

  const deFields = {
    headline: headlineDe, subhead: subheadDe, intro: introDe,
    usp_intro: USP_INTRO_DE_VARIANTS[uspIdx], usp: uspDeBody,
    faq1_q: FAQ1_Q_DE_VARIANTS[faqIdx], faq1_a: `${FAQ1_A_DE_VARIANTS[faqIdx]} ${FAQ1_A_CLOSING_DE}`,
    faq2_q: faqQDe[1], faq2_a: faqADe[1],
    faq3_q: faqQDe[2], faq3_a: faqADe[2],
    faq4_q: faqQDe[3], faq4_a: faqADe[3],
    slug_kw: '',
  };

  stats.qualifying.push(slug);
  if (!LIVE) return; // Dry-Run: keine KI-Aufrufe, kein Schreiben.

  log(`  [${slug}] uebersetze (Problem="${problem}", Einsatz="${einsatz}", Region="${region || '(ueberregional)'}") ...`);
  const parsed = await translateToLanguage({ lang: 'en', deFields, sourceLang: 'de', problem, einsatz, region });
  if (!parsed) { stats.translationFailed.push(slug); return; }

  const headlineEn = parsed.headline;
  const subheadEn = parsed.subhead;
  const introEn = linkify(parsed.intro);
  const uspEn = linkify(`${parsed.usp_intro} ${parsed.usp}`);
  const faqQEn = [parsed.faq1_q, parsed.faq2_q, parsed.faq3_q, parsed.faq4_q];
  const faqAEn = [parsed.faq1_a, parsed.faq2_a, parsed.faq3_a, parsed.faq4_a].map(linkify);

  for (const [label, t] of [['headline_en', headlineEn], ['subhead_en', subheadEn]]) {
    if (!t || !String(t).trim()) { stats.anomalies.push({ slug, issues: [`leeres Uebersetzungsfeld ${label}`] }); return; }
  }

  let content = orig;
  let ok = true;
  const patchIssues = [];
  ({ content, ok } = replaceExactlyOnce(content, h1m[0], `${h1m[0]}\n      <h1 data-en>${headlineEn}</h1>`, 'h1', patchIssues)); if (!ok) { stats.anomalies.push({ slug, issues: patchIssues }); return; }
  ({ content, ok } = replaceExactlyOnce(content, EMPTY.subheadEn, `<h2 class="heading-l" style="margin-top:12px;" data-en>${subheadEn}</h2>`, 'subhead_en', patchIssues)); if (!ok) { stats.anomalies.push({ slug, issues: patchIssues }); return; }
  ({ content, ok } = replaceExactlyOnce(content, EMPTY.introEn, `<p class="body-l" style="margin-top:14px;max-width:860px;color:var(--mid);" data-en>${introEn}</p>`, 'intro_en', patchIssues)); if (!ok) { stats.anomalies.push({ slug, issues: patchIssues }); return; }
  ({ content, ok } = replaceExactlyOnce(content, EMPTY.uspEn, `<p class="body-l" style="max-width:860px;" data-en>${uspEn}</p>`, 'usp_en', patchIssues)); if (!ok) { stats.anomalies.push({ slug, issues: patchIssues }); return; }
  ({ content, ok } = replaceEmptyTagsInOrder(content, EMPTY.faqQEn, EMPTY.faqQEnOpen, EMPTY.faqQEnClose, faqQEn, 'faq_q_en', patchIssues)); if (!ok) { stats.anomalies.push({ slug, issues: patchIssues }); return; }
  ({ content, ok } = replaceEmptyTagsInOrder(content, EMPTY.faqAEn, EMPTY.faqAEnOpen, EMPTY.faqAEnClose, faqAEn, 'faq_a_en', patchIssues)); if (!ok) { stats.anomalies.push({ slug, issues: patchIssues }); return; }

  writeVerified(file, content);
  stats.changed.push(slug);
  log(`  [${slug}] OK -- EN-Inhalte ergaenzt und geschrieben.`);
}

async function main() {
  console.log(`Modus: ${LIVE ? 'LIVE (uebersetzt + schreibt wirklich)' : 'DRY-RUN (keine KI-Aufrufe, schreibt NICHTS, nur Diagnose)'}`);
  if (LIVE && !process.env.OPENAI_API_KEY) { console.error('ABBRUCH: OPENAI_API_KEY fehlt.'); process.exit(1); }

  const rows = await sheets.readSheetAsItems(SHEET_NAME);
  const bySlug = new Map();
  for (const r of rows) {
    const j = r.json;
    const slug = norm(j.slug);
    if (!slug) continue;
    bySlug.set(slug, { Problem: norm(j.Problem), Einsatz: norm(j.Einsatz), Region: norm(j.Region) });
  }
  log(`Sheet gelesen: ${rows.length} Zeile(n), ${bySlug.size} mit slug.`);

  const allSlugs = fs.readdirSync(LOESUNGEN_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  const slugs = ONLY_SLUG ? allSlugs.filter((s) => s === ONLY_SLUG) : allSlugs;
  log(`${allSlugs.length} Verzeichnis(se) in loesungen/, ${slugs.length} werden geprueft.`);

  const stats = {
    notClassic: [], alreadyHasEn: [], noSheetRow: [], anomalies: [],
    qualifying: [], changed: [], translationFailed: [],
  };

  let processed = 0;
  for (const slug of slugs) {
    const file = path.join(LOESUNGEN_DIR, slug, 'index.html');
    if (!fs.existsSync(file)) continue;
    const ctx = bySlug.get(slug);
    if (!ctx) { stats.noSheetRow.push(slug); continue; }
    if (processed >= LIMIT) break;
    await processPage(slug, ctx, stats);
    if (stats.changed.includes(slug) || (!LIVE && stats.qualifying.includes(slug))) processed++;
  }

  console.log('\n---- Zusammenfassung ----');
  console.log(`Klassische Seiten (IS_DUAL=false) qualifizierend: ${stats.qualifying.length}`);
  console.log(`${LIVE ? 'Tatsaechlich geaendert' : 'Wuerden bei --live uebersetzt/geaendert'}: ${LIVE ? stats.changed.length : stats.qualifying.length}`);
  console.log(`Bereits mit <h1 data-en> (schon vollstaendig/dual, uebersprungen): ${stats.alreadyHasEn.length}`);
  console.log(`Nicht IS_DUAL=false (anderer Modus, uebersprungen): ${stats.notClassic.length}`);
  console.log(`Ohne Sheet-Zeile (slug nicht gefunden, uebersprungen): ${stats.noSheetRow.length}${stats.noSheetRow.length ? ' -- ' + stats.noSheetRow.slice(0, 15).join(', ') : ''}`);
  console.log(`Anomalien (unerwartete Struktur, uebersprungen, BITTE PRUEFEN): ${stats.anomalies.length}`);
  for (const a of stats.anomalies.slice(0, 60)) console.log(`  - ${a.slug}: ${a.issues.join(' | ')}`);
  if (LIVE) console.log(`Uebersetzung fehlgeschlagen (KI-Fehler/Check nach Korrektur weiterhin fehlerhaft): ${stats.translationFailed.length}${stats.translationFailed.length ? ' -- ' + stats.translationFailed.join(', ') : ''}`);
  if (!LIVE) console.log('\nDies war ein DRY-RUN. Zum wirklichen Ausfuehren erneut mit --live aufrufen (ggf. zuerst mit --limit=N testen).');
}

main().catch((err) => { console.error('FEHLER:', err); process.exit(1); });
