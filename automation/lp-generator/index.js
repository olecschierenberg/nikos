#!/usr/bin/env node
'use strict';
/**
 * NIKOS Landingpage-Generator — GitHub-Actions-Portierung des n8n-Workflows
 * "Landingpages erzeugen — Worker stabilisiert" (Workflow-ID 8ApbaHN6gZYrl4ZO).
 *
 * WICHTIG: Dies ist eine Übersetzung der Ausführungsumgebung, keine
 * Neuentwicklung. Jeder inhaltliche Verarbeitungsschritt (Filter/Ranking,
 * Prompt-Texte, HTML-Bau, Feinschliff, SEO-Gate) ist eine unveränderte
 * Kopie des jeweiligen n8n-Node-Codes (siehe lib/nodes/*.js und
 * lib/prompts/*.txt) — nur die Ausführungsumgebung (n8n → dieses Skript)
 * und die Anbindungen (Sheets/GitHub/OpenAI/QA-Lektionen) sind neu.
 * Details: /nikos/Migrationsplan_Landingpage-Generator_ohne-n8n_2026-08-27.md
 *
 * SICHERHEITSDESIGN (siehe README.md):
 *  - Läuft standardmäßig im TEST-MODUS: schreibt NUR nach
 *    lp-preview/_ghtest-<slug>/index.html, NIEMALS in den produktiven
 *    lp-preview/<slug>/-Pfad, und schreibt NICHT ins gemeinsame
 *    Google Sheet zurück (nur lesend). So kann dieser neue Prozess beliebig
 *    oft parallel zum laufenden n8n-Betrieb getestet werden, ohne ihn zu
 *    stören.
 *  - Erst mit dem Flag --live (nach nachgewiesener Gleichwertigkeit,
 *    siehe Migrationsplan Abschnitt 6) schreibt der Lauf in den echten
 *    lp-preview/<slug>/-Pfad und aktualisiert das Sheet.
 */

const fs = require('fs');
const path = require('path');
const { DateTime } = require('luxon');

const { runAllItems, runEachItem, buildNodeRef } = require('./lib/runCodeNode');
const { renderExpr } = require('./lib/expr');
const { chatCompletion } = require('./lib/openai');
const sheets = require('./lib/sheets');
const qaLektionen = require('./lib/qaLektionen');
const { UI_L10N, LANG_META } = require('./lib/i18n');
const {
  USP_INTRO_DE_VARIANTS, USP_INTRO_TRANSLATIONS,
  FAQ1_Q_DE_VARIANTS, FAQ1_Q_TRANSLATIONS,
  FAQ1_A_DE_VARIANTS, FAQ1_A_TRANSLATIONS,
  FAQ1_A_CLOSING_DE, FAQ1_A_CLOSING_TRANSLATIONS,
  pickUspIndex, pickFaqIndex,
} = require('./lib/textbausteine');

const REPO_ROOT = path.join(__dirname, '..', '..'); // .../site
const TEXTBAUSTEINE_PATH = path.join(REPO_ROOT, 'nikos', 'LANDINGPAGES_Textbausteine.md');
const PROMPTS_DIR = path.join(__dirname, 'lib', 'prompts');

const LIVE = process.argv.includes('--live');
const executionId = process.env.GITHUB_RUN_ID ? `gha-${process.env.GITHUB_RUN_ID}` : `local-${Date.now()}`;

function log(msg) {
  console.log(`[lp-generator] ${msg}`);
}
function abort(reason) {
  console.error(`[lp-generator] ABBRUCH: ${reason}`);
  process.exitCode = 1;
  throw new Error(reason);
}
function readPrompt(name) {
  return fs.readFileSync(path.join(PROMPTS_DIR, name), 'utf8');
}

// NEU (2026-09-04, Fix fuer den "Kein JSON"-Abbruch): Manche OpenAI-Antworten
// sind trotz erfolgreichem HTTP-Request kein valides JSON (leer,
// abgeschnitten, mit Kommentartext drumherum o. Ae.) -- bisher brach ein
// einzelner missglueckter Aufruf sofort den ganzen Lauf ab, an wechselnden
// Stellen (AI-Texte/QA-Agent/Nachbesserung), je nachdem wo es gerade traf.
// callOpenAiAndParseJson() buendelt OpenAI-Aufruf + JSON-Parse zu einer
// Einheit und wiederholt BEIDES (nicht nur den HTTP-Request) bei einem
// Parse-Fehler -- analog zum bereits bestehenden Retry-Muster fuer
// Uebersetzungen (siehe translateToLanguage() unten).
async function callOpenAiAndParseJson({
  nodeFile, model, system, user, maxTokens, timeoutMs, maxRetries,
  nodeOutputs, staticData, executionId, label, maxAttempts,
}) {
  const attempts = Math.max(1, maxAttempts || 2);
  let lastErr;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    let result;
    try {
      result = await chatCompletion({
        apiKey: process.env.OPENAI_API_KEY, model, system, user, maxTokens, timeoutMs, maxRetries,
      });
    } catch (err) {
      lastErr = err;
      log(`  ${label}: OpenAI-Aufruf fehlgeschlagen (Versuch ${attempt}/${attempts}): ${err.message}`);
      if (attempt < attempts) { await new Promise((r) => setTimeout(r, 2000 * attempt)); continue; }
      throw new Error(`${label}: OpenAI-Aufruf nach ${attempts} Versuch(en) fehlgeschlagen: ${lastErr.message}`);
    }
    try {
      const parsed = runAllItems(nodeFile, { items: [result], nodeOutputs, staticData, executionId });
      if (attempt > 1) log(`  ${label}: JSON-Parse nach Wiederholung erfolgreich (Versuch ${attempt}).`);
      return { result, parsed };
    } catch (err) {
      lastErr = err;
      const snippet = String((result && result.json && result.json.text) || '').slice(0, 300).replace(/\s+/g, ' ').trim();
      log(`  ${label}: Antwort war kein gueltiges JSON (Versuch ${attempt}/${attempts}): ${err.message} -- Rohtext-Ausschnitt: "${snippet}"`);
      if (attempt < attempts) { await new Promise((r) => setTimeout(r, 2000 * attempt)); continue; }
      throw new Error(`${label}: nach ${attempts} Versuch(en) weiterhin kein gueltiges JSON (${err.message}). Letzter Rohtext-Ausschnitt: "${snippet}"`);
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════
// NEU (2026-09-03, kein n8n-Vorbild): Multi-Sprach-Pfad fuer regionslose LPs
// (Schritt 2, Konzept_Mehrsprachige-LPs_2026-09-03_v2.md). Rein additiv --
// wird NUR aufgerufen, wenn filter_relevanz.js das Item mit _ml=true markiert
// hat (aktuell: Region leer). Alle bestehenden regionsbezogenen Kombinationen
// (Deutschland UND -- bis Schritt 3 -- auch Nicht-Deutschland-Regionen)
// durchlaufen weiterhin unveraendert den bestehenden Single-/Dual-Sprach-Pfad
// (html_bauen.js/feinschliff.js/seo_gate.js, Zeilen "14) HTML bauen" ff.
// unten in main()).
// ══════════════════════════════════════════════════════════════════════════

// GEAENDERT (2026-09-09, Nutzer-Freigabe FAQ-Textvarianten_Entwurf_2026-09-09.md):
// aus den frueheren EINZELNEN FIXED_*-Konstanten (ein deutscher String) wurden
// die Arrays USP_INTRO_DE_VARIANTS/FAQ1_Q_DE_VARIANTS/FAQ1_A_DE_VARIANTS (je 6
// geprueft-freigegebene Varianten, siehe lib/textbausteine.js) + der separate
// Schlusssatz-Baustein FAQ1_A_CLOSING_DE (reine Marketing-/Kontakt-Formulierung
// ohne Normaussage, siehe dortiger Kommentar). Die Variantenwahl je LP erfolgt
// deterministisch ueber pickUspIndex()/pickFaqIndex() (geseedet aus
// Problem+Einsatz+Region) -- bleibt bei Regenerierung stabil und ist ueber alle
// Sprachversionen einer LP hinweg konsistent (siehe callTranslation() unten).
// faq1_q/faq1_a bleiben weiterhin compliance-relevante feste Textbausteine aus
// site/nikos/LANDINGPAGES_Textbausteine.md (dort als "WORTGENAU verwenden"
// markiert) -- HART auf allen Seiten verwendet statt der freien KI-Generierung,
// weil beobachtet wurde, dass diese die WORTGENAU-Anweisung nicht zuverlaessig
// einhaelt.
const GENERIC_KEYS = ['headline','subhead','intro','usp_intro','usp',
  'faq1_q','faq1_a','faq2_q','faq2_a','faq3_q','faq3_a','faq4_q','faq4_a','slug_kw'];

// Wandelt das bestehende _de-suffigierte AI-Texte-Ausgabeformat (siehe
// lib/prompts/ai-texte.system.txt, Modus DEUTSCH) in die generischen
// Feldnamen um, die html_bauen_ml.js/uebersetzung_json.js/mini_check.js
// erwarten. usp_intro ist im Alt-Format kein eigenes KI-Feld (die Zeile ist
// im Alt-Template fest einprogrammiert, siehe html_bauen.js OPEN_DE) --
// hier deshalb aus den Varianten-Arrays oben gesetzt. problem/einsatz/region
// steuern NUR die Varianten-AUSWAHL (siehe pickUspIndex/pickFaqIndex),
// fliessen aber nicht in den Text selbst ein (weiterhin ein kleiner,
// geprueften Varianten-Pool ohne Per-Seite-Anpassung, wie am 2026-09-03
// festgelegt).
// GEAENDERT (2026-09-09, Nutzer-Auftrag "Primaersprache auf die tatsaechliche
// Landessprache umstellen"): ersetzt die bisherigen ZWEI Funktionen
// toGenericFieldsDe()/toGenericFieldsEn() durch EINE, fuer jede Baseline-
// Sprache verwendbare Funktion. filter_relevanz.js liefert jetzt _primary_lang
// = 'de' | 'en' | 'fr' | 'it' | 'es' | 'nl' | 'da' | 'pl' (siehe dortiger
// Kommentar -- immer eine Sprache aus BASELINE_LANGS, damit lib/textbausteine.js
// garantiert eine freigegebene usp_intro/faq1-Uebersetzung dafuer hat).
//
// WICHTIG (Rohfeld-Suffix): ai-texte.system.txt liefert JE NACH ZIELSPRACHE-
// Modus (siehe lib/nodes/filter_relevanz.js _lang_mode) unterschiedliche
// Inhalte in den immer gleich benannten Feldern *_de/*_en:
//  - Modus DEUTSCH (_lang_mode='single-de', primaerLang='de'): *_de = echtes
//    Deutsch.
//  - Modus ENGLISCH (_lang_mode='single-en', primaerLang='en'): *_en = echtes
//    Englisch.
//  - Modus ZWEISPRACHIG (_lang_mode='dual', primaerLang = tatsaechliche
//    Landessprache, z.B. 'fr'): der *_de-Slot ist HIER trotz des Namens NICHT
//    Deutsch, sondern die eigenstaendig verfasste Landessprache (siehe
//    ai-texte.user.txt ZIELSPRACHE-Zeile: "_de-Felder auf ... der
//    Landessprache dieser Region — NICHT auf Deutsch!"); *_en enthaelt eine
//    unabhaengig formulierte englische Fassung.
// D.h. der Rohfeld-Suffix ist NICHT primaryLang selbst, sondern nur davon
// abgeleitet: '_en' ausschliesslich wenn primaryLang==='en', sonst IMMER
// '_de' (das deckt sowohl 'single-de' als auch 'dual' ab).
function toGenericFieldsForLang(o, problem, einsatz, region, lang) {
  const uspIdx = pickUspIndex(problem, einsatz, region);
  const faqIdx = pickFaqIndex(problem, einsatz, region);
  const suffix = lang === 'en' ? '_en' : '_de';
  const isDe = lang === 'de';
  const uspIntro = isDe ? USP_INTRO_DE_VARIANTS[uspIdx] : USP_INTRO_TRANSLATIONS[lang][uspIdx];
  const faq1Q = isDe ? FAQ1_Q_DE_VARIANTS[faqIdx] : FAQ1_Q_TRANSLATIONS[lang][faqIdx];
  const faq1AClosing = isDe ? FAQ1_A_CLOSING_DE : (FAQ1_A_CLOSING_TRANSLATIONS[lang] || FAQ1_A_CLOSING_DE);
  const faq1A = (isDe ? FAQ1_A_DE_VARIANTS[faqIdx] : FAQ1_A_TRANSLATIONS[lang][faqIdx]) + ' ' + faq1AClosing;
  const out = {
    usp_intro: uspIntro,
    // slug_kw: nur bei 'de' leer (die alte Problem+Einsatz-Slug-Logik greift
    // dort weiterhin, siehe runMultiLangBranch/trimSlugMl) -- bei jeder
    // anderen Baseline-Sprache liefert die AI-Texte-Antwort bereits ein
    // passendes slug_kw in genau dieser Sprache (siehe ai-texte.system.txt
    // SLUG_KW-Regel, gilt fuer Modus ENGLISCH UND ZWEISPRACHIG gleichermassen).
    slug_kw: isDe ? '' : (o.slug_kw || ''),
    faq1_q: faq1Q,
    faq1_a: faq1A,
  };
  for (const k of GENERIC_KEYS) {
    if (k === 'usp_intro' || k === 'slug_kw' || k === 'faq1_q' || k === 'faq1_a') continue;
    out[k] = o['' + k + suffix] || '';
  }
  return out;
}

function trimSlugMl(s) {
  s = (s || '').toString().toLowerCase().trim()
    .replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss')
    .replace(/ı/g,'i').replace(/ğ/g,'g').replace(/ş/g,'s').replace(/ł/g,'l').replace(/ø/g,'o').replace(/đ/g,'d');
  if (s.normalize) s = s.normalize('NFKD').replace(/[̀-ͯ]/g, '');
  s = s.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (s.length <= 80) return s;
  const c0 = s.substring(0, 80);
  const i = c0.lastIndexOf('-');
  return (i > 40 ? c0.substring(0, i) : c0).replace(/^-+|-+$/g, '');
}

// Uebersetzt die deutschen Primaer-Felder in EINE Zielsprache (starkes Modell,
// wie vom Nutzer gefordert), prueft das Ergebnis mit dem minimalen
// automatischen Check und wiederholt EINMAL mit Korrekturhinweis, falls der
// Check Probleme findet. Gibt bei anhaltendem Fehlschlag null zurueck (die
// Sprache wird dann fuer diesen Lauf uebersprungen, statt den ganzen Lauf
// abzubrechen -- Konzept: "minimaler automatischer Check", kein harter Gate
// wie beim primaeren QA-Agent).
async function callTranslation({ lang, deFields, sourceLang, problem, einsatz, region, render, nodeOutputs, staticData, executionId, correctionNote }) {
  const lm = LANG_META[lang] || { label: lang };
  // GEAENDERT (2026-09-09, Primaersprache-Umstellung): deFields ist trotz des
  // Namens (historisch: fruehe immer Deutsch) jetzt die tatsaechliche
  // Ausgangssprache sourceLang (Standard 'de' fuer Rueckwaertskompatibilitaet,
  // z.B. wenn kein sourceLang uebergeben wird). uebersetzung.user.txt/-system.txt
  // gingen bisher hart von deutschen Ausgangstexten aus -- quellsprache_label/
  // -code machen den User-Prompt sprachunabhaengig; fuer den (statischen)
  // System-Prompt wird bei einer Nicht-Deutsch-Quelle ein kurzer Hinweis
  // vorangestellt, der die dortigen "deutschen Ausgangstext"-Passagen korrekt
  // auf die tatsaechliche Quellsprache umlenkt, ohne die restliche, weiterhin
  // gueltige System-Anweisung neu schreiben zu muessen.
  const srcLang = sourceLang || 'de';
  const srcLm = LANG_META[srcLang] || { label: srcLang };
  const userPrompt = render(readPrompt('uebersetzung.user.txt'), {
    zielsprache_label: lm.label, zielsprache_code: lang,
    quellsprache_label: srcLm.label, quellsprache_code: srcLang,
    problem, einsatz, region_oder_ueberregional: region || 'ueberregional/kein fester Ort',
    quelltext_json: JSON.stringify(deFields) + (correctionNote ? ('\n\nHINWEIS (WICHTIG, unbedingt beachten): ' + correctionNote) : ''),
  });
  let systemPrompt = readPrompt('uebersetzung.system.txt');
  if (srcLang !== 'de') {
    systemPrompt = `HINWEIS: Die als "deutsche Ausgangstexte"/"deutschen Ausgangstext" bezeichneten Quelltexte in der folgenden Anweisung sind in diesem Fall NICHT auf Deutsch, sondern bereits fertig auf ${srcLm.label} (ISO ${srcLang}) verfasst -- behandle ueberall dort, wo unten von "Deutsch"/"deutsch" als Ausgangssprache die Rede ist, stattdessen ${srcLm.label} als Ausgangssprache. Alle uebrigen Anweisungen (Stil, Vollstaendigkeit, Modulnamen-Regeln, Format) gelten unveraendert.\n\n${systemPrompt}`;
  }
  const result = await chatCompletion({
    apiKey: process.env.OPENAI_API_KEY, model: 'gpt-5.6-luna',
    system: systemPrompt, user: userPrompt,
    maxTokens: 1800, timeoutMs: 180000, maxRetries: 1,
  });
  const parsed = runAllItems('uebersetzung_json.js', { items: [result], nodeOutputs, staticData, executionId })[0].json.output;
  // NEU (2026-09-03, Nutzer-Idee "Textbausteine wiederverwenden"; ERWEITERT
  // 2026-09-09 auf 6 rotierende Varianten, siehe lib/textbausteine.js):
  // usp_intro ist ein fester, seitenunabhaengiger Markensatz -- fuer die
  // Baseline-Sprachen liegt bereits eine einmalig geprueft-freigegebene
  // Uebersetzung JEDER der 6 Varianten vor. Diese wird IMMER verwendet,
  // unabhaengig davon, was das gerade produktive Modell fuer dieses eine
  // Feld geliefert haette. WICHTIG: pickUspIndex/pickFaqIndex sind reine
  // Funktionen von problem/einsatz/region (kein Zufall) -- derselbe Index
  // wie in toGenericFieldsForLang() fuer dieselbe LP, damit die Uebersetzung
  // hier zur tatsaechlich als Quelltext verschickten Variante
  // (deFields.usp_intro/faq1_q/faq1_a, in der Ausgangssprache sourceLang)
  // passt. Faellt eine Sprache (noch) nicht in die Liste, bleibt die frische
  // Modell-Uebersetzung fuer das jeweilige Feld unveraendert bestehen.
  const _uspIdx = pickUspIndex(problem, einsatz, region);
  const _faqIdx = pickFaqIndex(problem, einsatz, region);
  // WICHTIG (Fix 2026-09-09, Primaersprache-Umstellung): 'de' ist jetzt auch
  // als UEBERSETZUNGSZIEL erreichbar (z.B. Franzoesisch primaer -> Deutsch als
  // Sibling), nicht mehr nur als Quelle. Die deutschen Bausteine liegen aber
  // in eigenen DE-Konstanten (USP_INTRO_DE_VARIANTS etc.), NICHT unter
  // USP_INTRO_TRANSLATIONS['de'] (dieser Key existiert dort gar nicht) --
  // ohne diese Fallunterscheidung wuerde fuer lang==='de' der ungepruefte
  // Modell-Output stehen bleiben statt des freigegebenen Bausteins.
  if (lang === 'de') {
    parsed.usp_intro = USP_INTRO_DE_VARIANTS[_uspIdx];
  } else if (USP_INTRO_TRANSLATIONS[lang]) {
    parsed.usp_intro = USP_INTRO_TRANSLATIONS[lang][_uspIdx];
  }
  // NEU (2026-09-03, gleiches Prinzip fuer faq1_q/faq1_a; ERWEITERT
  // 2026-09-09 auf 6 rotierende Kernblock-Varianten + separaten, weiterhin
  // fest hinterlegten Schlusssatz FAQ1_A_CLOSING_DE/-TRANSLATIONS): compliance-
  // relevanter Normkonformitaets-Textbaustein, wird IMMER verwendet statt
  // einer frischen Modell-Uebersetzung, damit die rechtlich/inhaltlich
  // wichtige Normaussage auf jeder Seite garantiert identisch (zur
  // gewaehlten Variante) ist.
  if (lang === 'de') {
    parsed.faq1_q = FAQ1_Q_DE_VARIANTS[_faqIdx];
    parsed.faq1_a = FAQ1_A_DE_VARIANTS[_faqIdx] + ' ' + FAQ1_A_CLOSING_DE;
  } else {
    if (FAQ1_Q_TRANSLATIONS[lang]) parsed.faq1_q = FAQ1_Q_TRANSLATIONS[lang][_faqIdx];
    if (FAQ1_A_TRANSLATIONS[lang]) {
      parsed.faq1_a = FAQ1_A_TRANSLATIONS[lang][_faqIdx] + ' ' + (FAQ1_A_CLOSING_TRANSLATIONS[lang] || FAQ1_A_CLOSING_DE);
    }
  }
  const check = runAllItems('mini_check.js', {
    items: [{ json: { translated: parsed, source: deFields, lang, sourceLang: srcLang } }], nodeOutputs, staticData, executionId,
  })[0].json;
  return { parsed, check };
}

// Uebersetzt die deutschen Primaer-Felder in EINE Zielsprache (starkes Modell,
// wie vom Nutzer gefordert), prueft das Ergebnis mit dem minimalen
// automatischen Check und wiederholt EINMAL mit den konkreten Befunden als
// Korrekturhinweis, falls der Check Probleme findet. Gibt bei anhaltendem
// Fehlschlag (oder API-/Parse-Fehler in beiden Versuchen) null zurueck -- die
// Sprache wird dann fuer diesen Lauf uebersprungen statt den ganzen Lauf
// abzubrechen (Konzept: "minimaler automatischer Check", kein harter Gate
// wie beim primaeren QA-Agent).
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
      log(`    [${lang}] weiterhin Probleme nach Korrektur -- Sprache wird fuer diesen Lauf uebersprungen.`);
      return null;
    }
    args = { ...args, correctionNote: 'Deine vorherige Uebersetzung hatte folgende Probleme -- behebe sie in dieser neuen Fassung: ' + outcome.check.issues.join(', ') };
  }
  return null;
}

async function buildAndGateCheck({ lang, isPrimary, fields, region, einsatz, problem, siblings, defaultLang, nodeOutputs, staticData, executionId }) {
  const built = runAllItems('html_bauen_ml.js', {
    items: [{ json: {
      lang, isPrimary, fields, region, einsatz, problem,
      uiL10n: UI_L10N[lang] || UI_L10N.en, langMeta: LANG_META[lang] || { label: lang, flag: '🏳️', locale: lang },
      siblings, defaultLang, robots: '<meta name="robots" content="noindex,nofollow">',
    } }],
    nodeOutputs, staticData, executionId,
  })[0];
  try {
    runEachItem('seo_gate_ml.js', { item: built, nodeOutputs, staticData, executionId });
    return { ok: true, built };
  } catch (err) {
    return { ok: false, reason: err.message, built };
  }
}

async function runMultiLangBranch({ filterItem, primaryFields, primaryLang, render, nodeOutputs, staticData, executionId, LIVE, REPO_ROOT }) {
  const problem = filterItem.json.Problem || '';
  const einsatz = filterItem.json.Einsatz || '';
  const region = filterItem.json.Region || ''; // regionslos -> leer; Nicht-Deutschland-Region (Schritt 3) -> gefuellt
  const targetLangs = (filterItem.json._target_langs || [primaryLang]).slice();
  const slugPrimary = primaryLang === 'de' ? trimSlugMl(problem + ' ' + einsatz) : (trimSlugMl(primaryFields.slug_kw) || trimSlugMl(problem + ' ' + einsatz));

  log(`  Multi-Sprach-Pfad (${region ? 'Region "' + region + '", primaer ' + primaryLang.toUpperCase() : 'regionslos'}): Ziel-Sprachen = ${targetLangs.join(', ')}, Primaer-Slug = "${slugPrimary}"`);

  const fieldsByLang = { [primaryLang]: primaryFields };
  const slugByLang = { [primaryLang]: slugPrimary };

  async function translateOnce(lang) {
    log(`  Uebersetze von ${primaryLang} nach ${lang} (gpt-5.6-luna) …`);
    return translateToLanguage({
      lang, deFields: primaryFields, sourceLang: primaryLang, problem, einsatz, region, render, nodeOutputs, staticData, executionId,
    });
  }

  // ---- Phase 1: Uebersetzen (mit 1 sofortigem Wiederholungsversuch bei Uebersetzungsfehler) ----
  for (const lang of targetLangs) {
    if (lang === primaryLang) continue;
    let translated = await translateOnce(lang);
    if (!translated) {
      log(`    [${lang}] Uebersetzung fehlgeschlagen -- sofortiger 2. Versuch …`);
      translated = await translateOnce(lang);
    }
    if (!translated) { log(`    [${lang}] uebersprungen (Uebersetzung nach 2 Versuchen fehlgeschlagen).`); continue; }
    fieldsByLang[lang] = translated;
    slugByLang[lang] = trimSlugMl(translated.slug_kw) || (slugPrimary + '-' + lang);
  }

  // ---- Phase 2: Bauen + SEO-Gate (ML), mit 1 sofortigem Wiederholungsversuch (neue Uebersetzung) bei Gate-Ablehnung ----
  // Vorlaeufige Sibling-Liste NUR fuer den Gate-Check -- das Gate prueft ausschliesslich eigene Meta-Werte
  // (z. B. Meta-Beschreibungslaenge), keine hreflang-Konsistenz, daher unschaedlich als Zwischenstand.
  let provisionalSiblings = Object.keys(fieldsByLang).map((lang) => ({
    lang, slug: slugByLang[lang], url: `https://nikos.info/${lang}/lp/${slugByLang[lang]}/`, meta: LANG_META[lang],
  }));

  const gateOkLangs = new Set();
  for (const lang of Object.keys(fieldsByLang)) {
    let result = await buildAndGateCheck({
      lang, isPrimary: lang === primaryLang, fields: fieldsByLang[lang], region, einsatz, problem,
      siblings: provisionalSiblings, defaultLang: primaryLang, nodeOutputs, staticData, executionId,
    });
    if (!result.ok && lang !== primaryLang) {
      log(`    [${lang}] SEO-Gate (ML) blockiert: ${result.reason} -- sofortiger 2. Versuch (neue Uebersetzung) …`);
      const retried = await translateOnce(lang);
      if (retried) {
        fieldsByLang[lang] = retried; // Slug bleibt unveraendert (bereits in provisionalSiblings referenziert)
        result = await buildAndGateCheck({
          lang, isPrimary: false, fields: retried, region, einsatz, problem,
          siblings: provisionalSiblings, defaultLang: primaryLang, nodeOutputs, staticData, executionId,
        });
      }
      if (!result.ok) {
        log(`    [${lang}] SEO-Gate (ML) weiterhin blockiert (2. Versuch): ${result.reason} -- Kandidat fuer Schlussphase.`);
      }
    }
    if (result.ok) gateOkLangs.add(lang);
  }

  // ---- Phase 3: Schlussphase -- am Ende des gesamten Laufs fehlende Sprachen noch einmal komplett versuchen ----
  // Zweck (Nutzer-Vorgabe 2026-09-05): moeglichst immer alle Sprachen vorhanden -- UND die Wartezeit bis hierhin
  // (alle bisherigen Uebersetzungen/Builds) plus eine zusaetzliche kurze Pause wirken als natuerliche Verzoegerung
  // fuer den Fall einer kurzfristigen Server-Ueberlastung, bevor der letzte Versuch startet.
  const stillMissing = targetLangs.filter((lang) => lang !== primaryLang && !gateOkLangs.has(lang));
  if (stillMissing.length > 0) {
    log(`  Schlussphase: ${stillMissing.length} Sprache(n) fehlen noch (${stillMissing.join(', ')}) -- warte 30s, dann letzter Versuch …`);
    await new Promise((resolve) => setTimeout(resolve, 30000));
    for (const lang of stillMissing) {
      const translated = await translateOnce(lang);
      if (!translated) { log(`    [${lang}] Schlussphase: Uebersetzung erneut fehlgeschlagen -- endgueltig uebersprungen.`); continue; }
      fieldsByLang[lang] = translated;
      if (!slugByLang[lang]) slugByLang[lang] = trimSlugMl(translated.slug_kw) || (slugPrimary + '-' + lang);
      const result = await buildAndGateCheck({
        lang, isPrimary: false, fields: translated, region, einsatz, problem,
        siblings: provisionalSiblings, defaultLang: primaryLang, nodeOutputs, staticData, executionId,
      });
      if (result.ok) { gateOkLangs.add(lang); log(`    [${lang}] Schlussphase erfolgreich.`); }
      else { log(`    [${lang}] Schlussphase: SEO-Gate weiterhin blockiert (${result.reason}) -- endgueltig uebersprungen.`); }
    }
  }

  // ---- Finale Sibling-Liste NUR aus tatsaechlich erfolgreichen Sprachen ----
  // (behebt Bug: vorher konnten hreflang-Verweise auf Sprachen zeigen, die am Gate scheiterten und nie
  // geschrieben wurden -- kaputte hreflang-Links auf 404-Seiten.)
  const okLangs = Object.keys(fieldsByLang).filter((lang) => gateOkLangs.has(lang));
  const siblings = okLangs.map((lang) => ({
    lang, slug: slugByLang[lang], url: `https://nikos.info/${lang}/lp/${slugByLang[lang]}/`, meta: LANG_META[lang],
  }));

  // ---- Alle finalen Seiten mit der VOLLSTAENDIGEN Sibling-Liste bauen (billig, keine erneuten KI-Aufrufe) und schreiben ----
  const groupDir = LIVE ? slugPrimary : `_ghtest-${slugPrimary}`;
  const writtenLangs = [];
  for (const lang of okLangs) {
    const finalResult = await buildAndGateCheck({
      lang, isPrimary: lang === primaryLang, fields: fieldsByLang[lang], region, einsatz, problem,
      siblings, defaultLang: primaryLang, nodeOutputs, staticData, executionId,
    });
    if (!finalResult.ok) {
      log(`    [${lang}] Unerwarteter Gate-Fehler beim Endbau (${finalResult.reason}) -- Sprachversion uebersprungen.`);
      continue;
    }
    const built = finalResult.built;

    const langDir = path.join(REPO_ROOT, 'lp-preview', groupDir, lang);
    fs.mkdirSync(langDir, { recursive: true });
    const htmlFile = path.join(langDir, 'index.html');
    fs.writeFileSync(htmlFile, built.json.html, 'utf8');
    const readBack = fs.readFileSync(htmlFile, 'utf8');
    if (readBack !== built.json.html) {
      log(`    [${lang}] Integritaetspruefung fehlgeschlagen bei ${htmlFile} -- Sprachversion uebersprungen.`);
      continue;
    }
    // meta.json: Sidecar mit dem sprachspezifischen Slug + primary-Flag, damit lp-publish
    // beim Promoten den korrekten Live-Pfad je Sprache UND die Primaersprache dieser Gruppe
    // kennt (Primaersprache ist 'de' bei regionslos, 'en' bei Nicht-Deutschland-Region -- siehe
    // filter_relevanz.js _primary_lang, Schritt 3).
    fs.writeFileSync(path.join(langDir, 'meta.json'), JSON.stringify({ slug: slugByLang[lang], url: built.json.url, primary: lang === primaryLang }, null, 2), 'utf8');
    writtenLangs.push(lang);
    log(`    [${lang}] geschrieben: lp-preview/${groupDir}/${lang}/index.html (Slug "${slugByLang[lang]}").`);
  }

  log(`  Erfolgreich: ${writtenLangs.length}/${targetLangs.length} Sprachversion(en) (${writtenLangs.join(', ')}).`);

  if (!writtenLangs.includes(primaryLang)) {
    abort(`Multi-Sprach-Pfad: Primaersprache ${primaryLang.toUpperCase()} konnte nicht geschrieben werden (SEO-Gate/Integritaet) -- Lauf abgebrochen.`);
  }

  // ---- Sheet aktualisieren (nur --live): slug = Gruppenordner (Primaersprachen-Slug), pfad = primaere Live-URL ----
  if (LIVE) {
    await sheets.updateRowByRowNumber('Keywordkombinationen', filterItem.json.row_number, {
      Relevanz: filterItem.json._relevanz,
      slug: slugPrimary,
      pfad: `https://nikos.info/${primaryLang}/lp/${slugPrimary}/`,
      erstellt_am: DateTime.now().toFormat('dd.MM.yyyy'),
      Problem: problem, Einsatz: einsatz, Region: region,
    });
    log(`  Sheet "Keywordkombinationen" aktualisiert (Zeile ${filterItem.json.row_number}), slug="${slugPrimary}".`);
  } else {
    log(`  TEST-Modus: Sheet-Update uebersprungen (würde Zeile ${filterItem.json.row_number} mit slug="${slugPrimary}" als erledigt markieren).`);
  }

  log(`FERTIG (${LIVE ? 'LIVE' : 'TEST'}, Multi-Sprach, primaer ${primaryLang.toUpperCase()}): ${writtenLangs.length} Sprachversion(en) unter lp-preview/${groupDir}/<lang>/index.html`);
}

async function main() {
  log(`Start (${LIVE ? 'LIVE' : 'TEST'}-Modus), executionId=${executionId}`);
  if (!process.env.OPENAI_API_KEY) abort('OPENAI_API_KEY fehlt (GitHub Secret setzen, siehe README.md).');

  const nodeOutputs = new Map();
  const staticData = {}; // Ersatz für $getWorkflowStaticData('global') — nur für diesen Lauf gültig;
                          // die eigentliche Lauf-Exklusivität übernimmt GitHub Actions' `concurrency:`.
  const render = (tpl, currentJson) =>
    renderExpr(tpl, { $: buildNodeRef(nodeOutputs, 0), $json: currentJson, $now: DateTime.now() });

  // ---- 1) Warteschlange + Stadt-Fakten lesen (gemeinsames Google Sheet, wie n8n) ----
  log('Lese Warteschlange + Stadt-Fakten aus Google Sheet …');
  const warteschlangeItems = await sheets.readSheetAsItems('Warteschlange');
  const stadtFaktenItems = await sheets.readSheetAsItems('Stadt-Fakten');
  nodeOutputs.set('Stadt-Fakten lesen', stadtFaktenItems);
  log(`  Warteschlange: ${warteschlangeItems.length} Zeile(n), Stadt-Fakten: ${stadtFaktenItems.length} Zeile(n).`);

  // ---- 2) Vorab-Begrenzung (Sicherheitscap) ----
  const vorabResult = runAllItems('vorab_begrenzung.js', {
    items: warteschlangeItems, nodeOutputs, staticData, executionId,
  });
  nodeOutputs.set('Vorab-Begrenzung (Sicherheitscap)', vorabResult);

  // ---- 3) Filter + Relevanz-Ranking ----
  const filterResult = runAllItems('filter_relevanz.js', {
    items: vorabResult, nodeOutputs, staticData, executionId,
  });
  nodeOutputs.set('Filter + Relevanz-Ranking', filterResult);
  if (!filterResult.length) {
    log('Keine passende Kombination in der Warteschlange (erstellen=x, slug leer, alle Filter). Nichts zu tun.');
    return;
  }
  log(`  ${filterResult.length} relevante Kombination(en) gefunden, verarbeite die erste.`);

  // ---- 4) Limit (max 1/Lauf) ----
  const limited = runAllItems('limit.js', { items: filterResult, nodeOutputs, staticData, executionId });
  const filterItem = limited[0]; // inhaltsgleich mit filterResult[0] (siehe lib/nodes/limit.js)
  log(`  Ausgewählt: Problem="${filterItem.json.Problem}" / Einsatz="${filterItem.json.Einsatz}" / Region="${filterItem.json.Region}"`);

  // ---- 5) Run Lock & Payload Budget ----
  let lockedItem;
  try {
    lockedItem = runEachItem('run_lock.js', { item: filterItem, nodeOutputs, staticData, executionId });
  } catch (err) {
    abort(`Run Lock: ${err.message}`);
  }

  // ---- 6) Textbausteine laden (jetzt: direkter Dateizugriff statt GitHub-API) ----
  if (!fs.existsSync(TEXTBAUSTEINE_PATH)) abort(`Textbausteine-Datei nicht gefunden: ${TEXTBAUSTEINE_PATH}`);
  const textbausteineContent = fs.readFileSync(TEXTBAUSTEINE_PATH, 'utf8');
  nodeOutputs.set('Textbausteine laden', [{ json: { data: textbausteineContent } }]);

  // ---- 6b) QA-Lektionen laden (Ersatz fuer n8n Data Table "QA-Lektionen", siehe lib/qaLektionen.js) ----
  // BUGFIX: fehlte im urspruenglichen Port -- lib/prompts/nachbesserung.user.txt referenziert
  // $('QA-Lektionen laden'), aber dieser Node-Output wurde nie in nodeOutputs eingetragen, wodurch
  // der Nachbesserung-Zweig mit "Node-Referenz ... nicht verfuegbar" abbrach.
  nodeOutputs.set('QA-Lektionen laden', qaLektionen.loadAsItems());

  // ---- 7) Kontext trimmen ----
  const kontextResult = runAllItems('kontext_trimmen.js', {
    items: [lockedItem], nodeOutputs, staticData, executionId,
  });
  nodeOutputs.set('Kontext trimmen', kontextResult);
  log(`  Kontext getrimmt: ${kontextResult[0].json._context_chars} Zeichen (gekürzt: ${kontextResult[0].json._context_truncated}).`);

  // ---- 8) AI Texte (DE+EN) ----
  log('Rufe OpenAI (gpt-5.6-terra) für AI-Texte auf …');
  const aiTexteSystem = readPrompt('ai-texte.system.txt');
  const aiTexteUser = render(readPrompt('ai-texte.user.txt'), undefined);
  const { result: aiTexteResult, parsed: texteJsonResult } = await callOpenAiAndParseJson({
    nodeFile: 'texte_json.js', model: 'gpt-5.6-terra', system: aiTexteSystem, user: aiTexteUser,
    maxTokens: 2600, timeoutMs: 180000, maxRetries: 1, nodeOutputs, staticData, executionId,
    label: 'AI Texte (DE+EN)', maxAttempts: 2,
  });
  nodeOutputs.set('AI Texte (DE+EN)', [aiTexteResult]);

  // ---- 9) Texte JSON ----
  nodeOutputs.set('Texte JSON', texteJsonResult);

  // ---- 10) "Texte ok?" Gate ----
  const texteOk = JSON.stringify(texteJsonResult[0].json.output || texteJsonResult[0].json).includes('headline_de');
  if (!texteOk) {
    abort('Texte-ok?-Prüfung fehlgeschlagen — AI-Texte enthalten kein gültiges headline_de-Feld (entspricht dem n8n-Fehlerpfad "Fehler-Telegram"; hier stattdessen als fehlgeschlagener GitHub-Actions-Lauf sichtbar).');
  }

  // ---- 11) QA-Agent ----
  log('Rufe OpenAI (gpt-5.6-luna) für QA-Prüfung auf …');
  const qaAgentSystem = readPrompt('qa-agent.system.txt');
  const qaAgentUser = render(readPrompt('qa-agent.user.txt'), undefined);
  const { result: qaAgentResult, parsed: qaJsonResult } = await callOpenAiAndParseJson({
    nodeFile: 'qa_json.js', model: 'gpt-5.6-luna', system: qaAgentSystem, user: qaAgentUser,
    maxTokens: 2600, timeoutMs: 180000, maxRetries: 1, nodeOutputs, staticData, executionId,
    label: 'QA-Agent', maxAttempts: 2,
  });
  nodeOutputs.set('QA-Agent', [qaAgentResult]);

  // ---- 12) QA JSON ----
  nodeOutputs.set('QA JSON', qaJsonResult);

  // ---- 13) "Nachbessern?" Gate ----
  const maengel = (qaJsonResult[0].json.output && qaJsonResult[0].json.output._maengel) || [];
  let htmlBauenInput;
  if (maengel.length > 0) {
    log(`  QA-Agent fand ${maengel.length} Mangel/Mängel — Nachbesserung: ${maengel.join(' | ')}`);
    qaLektionen.upsert({
      datum: DateTime.now().toFormat('dd.MM.yyyy'),
      region: filterItem.json.Region,
      einsatz: filterItem.json.Einsatz,
      problem: filterItem.json.Problem,
      mangel: maengel.join(' | '),
    });

    log('Rufe OpenAI (gpt-5.6-terra) für Nachbesserung auf …');
    const nachbesserungUser = render(readPrompt('nachbesserung.user.txt'), qaJsonResult[0].json);
    const { result: nachbesserungResult, parsed: nachbesserungJsonResult } = await callOpenAiAndParseJson({
      nodeFile: 'nachbesserung_json.js', model: 'gpt-5.6-terra',
      system: undefined, // Original-Node hat keine eigene System-Message konfiguriert
      user: nachbesserungUser, maxTokens: 2600, timeoutMs: 180000, maxRetries: 2,
      nodeOutputs, staticData, executionId, label: 'Nachbesserung', maxAttempts: 2,
    });
    nodeOutputs.set('Nachbesserung', [nachbesserungResult]);
    nodeOutputs.set('Nachbesserung JSON', nachbesserungJsonResult);
    htmlBauenInput = nachbesserungJsonResult[0];
  } else {
    log('  QA-Agent: keine Mängel.');
    htmlBauenInput = qaJsonResult[0];
  }

  // ---- 13b) Multi-Sprach-Abzweigung (NEU 2026-09-03, regionslose LPs) ----
  // filter_relevanz.js markiert regionslose Kombinationen mit _ml=true (siehe
  // dortiger Kommentar). Diese verlassen main() hier ueber einen komplett
  // neuen, additiven Pfad (mehrere Sprachdateien statt einer); alle anderen
  // Kombinationen durchlaufen unveraendert die bestehenden Schritte 14-19.
  if (filterItem.json._ml) {
    const primaryLang = filterItem.json._primary_lang || 'de';
    const rawOutput = htmlBauenInput.json.output || {};
    const primaryFields = toGenericFieldsForLang(
      rawOutput, filterItem.json.Problem, filterItem.json.Einsatz, filterItem.json.Region, primaryLang
    );
    await runMultiLangBranch({
      filterItem, primaryFields, primaryLang, render, nodeOutputs, staticData, executionId, LIVE, REPO_ROOT,
    });
    runEachItem('lock_freigeben.js', { item: { json: { error: false } }, nodeOutputs, staticData, executionId });
    return;
  }

  // ---- 13c) Fest hinterlegte FAQ1-Textbausteine ueberschreiben (klassischer Pfad) ----
  // NEU (2026-09-09, Nutzer-Freigabe): bislang war der compliance-relevante
  // FAQ1 (DIN EN 50849) im klassischen (Nicht-ML-)Pfad -- also fuer die
  // grosse Mehrheit der Deutschland-Regions-LPs -- ANDERS als im
  // Multi-Sprach-Pfad NICHT hart ueberschrieben, sondern der freien
  // KI-Generierung ueberlassen (nur per Prompt-Hinweis auf DIN EN 50849
  // gelenkt, siehe ai-texte.system.txt). Das schliesst diese Luecke:
  // dieselbe Auswahl aus den 6 geprueften Kernblock-Varianten (siehe
  // lib/textbausteine.js) wird jetzt auch hier verwendet, konsistent mit
  // dem Multi-Sprach-Pfad. usp_intro wird HIER NICHT ueberschrieben, da es
  // im Alt-Template (html_bauen.js OPEN_DE/OPEN_EN) bereits eigenstaendig
  // (mit eigener Varianten-Auswahl) verankert ist.
  {
    const _o = htmlBauenInput.json.output || {};
    const _faqIdx = pickFaqIndex(filterItem.json.Problem, filterItem.json.Einsatz, filterItem.json.Region);
    if (_o.faq1_q_de) _o.faq1_q_de = FAQ1_Q_DE_VARIANTS[_faqIdx];
    if (_o.faq1_a_de) _o.faq1_a_de = FAQ1_A_DE_VARIANTS[_faqIdx] + ' ' + FAQ1_A_CLOSING_DE;
    if (_o.faq1_q_en) _o.faq1_q_en = FAQ1_Q_TRANSLATIONS.en[_faqIdx];
    if (_o.faq1_a_en) _o.faq1_a_en = FAQ1_A_TRANSLATIONS.en[_faqIdx] + ' ' + FAQ1_A_CLOSING_TRANSLATIONS.en;
  }

  // ---- 14) HTML bauen ----
  const htmlBauenResult = runAllItems('html_bauen.js', {
    items: [htmlBauenInput], nodeOutputs, staticData, executionId,
  });
  nodeOutputs.set('HTML bauen', htmlBauenResult);
  const slug = htmlBauenResult[0].json.slug;
  log(`  HTML gebaut, slug="${slug}"`);

  // ---- 15) Feinschliff ----
  const feinschliffResult = runEachItem('feinschliff.js', {
    item: htmlBauenResult[0], nodeOutputs, staticData, executionId,
  });
  nodeOutputs.set('Feinschliff', [feinschliffResult]);

  // ---- 16) SEO Gate v1 ----
  let seoResult;
  try {
    seoResult = runEachItem('seo_gate.js', { item: feinschliffResult, nodeOutputs, staticData, executionId });
  } catch (err) {
    abort(`SEO-Gate blockiert: ${err.message}`);
  }
  if (seoResult.json.seo_gate === 'warning') {
    log(`  SEO-Gate: WARNUNG — ${(seoResult.json.seo_warnings || []).join(', ')}`);
  } else {
    log('  SEO-Gate: bestanden.');
  }

  // ---- 17) Vorschau schreiben (statt SHA-holen + PUT: direkter Datei-Commit) ----
  const previewSubdir = LIVE ? slug : `_ghtest-${slug}`;
  const targetDir = path.join(REPO_ROOT, 'lp-preview', previewSubdir);
  const targetFile = path.join(targetDir, 'index.html');
  fs.mkdirSync(targetDir, { recursive: true });
  const content = feinschliffResult.json.previewHtml; // identisch zu n8n: previewB64 = base64(previewHtml)
  fs.writeFileSync(targetFile, content, 'utf8');
  const readBack = fs.readFileSync(targetFile, 'utf8');
  if (readBack !== content) abort(`Integritätsprüfung fehlgeschlagen beim Schreiben von ${targetFile}`);
  log(`  Vorschau geschrieben: lp-preview/${previewSubdir}/index.html (${content.length} Zeichen, Integrität geprüft).`);

  // ---- 18) Ergebnis ins Sheet (nur im --live-Modus) ----
  if (LIVE) {
    await sheets.updateRowByRowNumber('Keywordkombinationen', seoResult.json.row_number, {
      Relevanz: seoResult.json.relevanz,
      slug: seoResult.json.slug,
      pfad: seoResult.json.pfad,
      erstellt_am: seoResult.json.erstellt_am,
      Problem: seoResult.json.Problem,
      Einsatz: seoResult.json.Einsatz,
      Region: seoResult.json.Region,
    });
    log('  Sheet "Keywordkombinationen" aktualisiert (Zeile ' + seoResult.json.row_number + ').');
  } else {
    log(`  TEST-Modus: Sheet-Update übersprungen (würde Zeile ${seoResult.json.row_number} als erledigt markieren).`);
  }

  // ---- 19) Lock freigeben (Logging-Parität; echte Exklusivität übernimmt GH Actions concurrency) ----
  runEachItem('lock_freigeben.js', {
    item: { json: { error: false } }, nodeOutputs, staticData, executionId,
  });

  log(`FERTIG (${LIVE ? 'LIVE' : 'TEST'}): ${slug} → lp-preview/${previewSubdir}/index.html`);
}

main().catch((err) => {
  console.error('[lp-generator] Lauf abgebrochen:', err.message);
  process.exitCode = process.exitCode || 1;
});
