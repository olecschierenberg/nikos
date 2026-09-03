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
const { USP_INTRO_TRANSLATIONS, FAQ1_Q_TRANSLATIONS, FAQ1_A_TRANSLATIONS } = require('./lib/textbausteine');

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

const FIXED_USP_INTRO_DE = 'NIKOS bündelt Durchsagen, Alarmierung, Besucherinformation und Steuerung in einer einzigen, netzunabhängigen Plattform.';
// NEU (2026-09-03, Nutzer-Vorgabe "Textbausteine wiederverwenden", nach
// Terra-vs-Luna-Test): faq1_q/faq1_a (Normkonformitaet, DIN EN 50849) sind
// ein fester, compliance-relevanter Textbaustein aus
// site/nikos/LANDINGPAGES_Textbausteine.md (dort ausdruecklich als
// "WORTGENAU verwenden -- compliance-relevant" markiert, ohne
// seitenspezifische Platzhalter). Wird HART auf allen Seiten verwendet --
// unabhaengig davon, was die KI-Generierung fuer dieses Feld frei erzeugen
// wuerde -- weil beobachtet wurde, dass die freie Generierung die
// WORTGENAU-Anweisung nicht zuverlaessig einhaelt (Abweichungen bei
// Wortwahl/Satzbau ggue. der freigegebenen Fassung).
const FIXED_FAQ1_Q_DE = 'Entsprechen Durchsagen mit NIKOS den geltenden Normen?';
const FIXED_FAQ1_A_DE = 'Ja. NIKOS erfüllt die Anforderungen der DIN EN 50849 (Elektroakustische Notfallwarnsysteme). NIKOS wurde speziell für sicherheitsrelevante Durchsage- und Alarmierungsanwendungen entwickelt und ist technisch für den Einsatz in Alltags- und Notfallsituationen ausgelegt. Für elektroakustische Notfallwarnsysteme (ELA-Anlagen) ist die DIN EN 50849 der maßgebliche Orientierungsrahmen. Die dort genannten Anforderungen werden von NIKOS – im Gegensatz zu mobilfunkbasierten Systemen – voll erfüllt, da keine Abhängigkeit von einem fremden Netz besteht und somit jederzeit eine sofortige Nutzbarkeit gewährleistet werden kann. Andere aus der Sicherheitstechnik bekannte Normen wie die DIN EN 54, DIN VDE 0833-4 sowie DIN 14675 (Sprachalarmierungsanlagen) sind auf das Einsatzgebiet und Funktionsspektrum von NIKOS nicht anwendbar und daher für eine Genehmigung nicht relevant. NIKOS ist das marktführende Durchsagesystem für temporäre und mobile Anwendungen und seit 2017 vielfach erfolgreich für die Umsetzung einsatzkritischer Kommunikationsaufgaben im Einsatz. RADACOM und Ihr regionaler NIKOS-Partner beraten Sie gerne zu den vielfältigen Funktionen von NIKOS und unterstützen Sie bei der kostenschonenden Umsetzung der Anforderungen.';
const GENERIC_KEYS = ['headline','subhead','intro','usp_intro','usp',
  'faq1_q','faq1_a','faq2_q','faq2_a','faq3_q','faq3_a','faq4_q','faq4_a','slug_kw'];

// Wandelt das bestehende _de-suffigierte AI-Texte-Ausgabeformat (siehe
// lib/prompts/ai-texte.system.txt, Modus DEUTSCH) in die generischen
// Feldnamen um, die html_bauen_ml.js/uebersetzung_json.js/mini_check.js
// erwarten. usp_intro ist im Alt-Format kein eigenes KI-Feld (die Zeile ist
// im Alt-Template fest einprogrammiert, siehe html_bauen.js OPEN_DE) --
// hier deshalb aus der Konstante oben gesetzt.
function toGenericFieldsDe(o) {
  const out = { usp_intro: FIXED_USP_INTRO_DE, slug_kw: '', faq1_q: FIXED_FAQ1_Q_DE, faq1_a: FIXED_FAQ1_A_DE };
  for (const k of GENERIC_KEYS) {
    if (k === 'usp_intro' || k === 'slug_kw' || k === 'faq1_q' || k === 'faq1_a') continue;
    out[k] = o['' + k + '_de'] || '';
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
async function callTranslation({ lang, deFields, problem, einsatz, region, render, nodeOutputs, staticData, executionId, correctionNote }) {
  const lm = LANG_META[lang] || { label: lang };
  const userPrompt = render(readPrompt('uebersetzung.user.txt'), {
    zielsprache_label: lm.label, zielsprache_code: lang,
    problem, einsatz, region_oder_ueberregional: region || 'ueberregional/kein fester Ort',
    quelltext_json: JSON.stringify(deFields) + (correctionNote ? ('\n\nHINWEIS (WICHTIG, unbedingt beachten): ' + correctionNote) : ''),
  });
  const result = await chatCompletion({
    apiKey: process.env.OPENAI_API_KEY, model: 'gpt-5.6-terra',
    system: readPrompt('uebersetzung.system.txt'), user: userPrompt,
    maxTokens: 1800, timeoutMs: 180000, maxRetries: 1,
  });
  const parsed = runAllItems('uebersetzung_json.js', { items: [result], nodeOutputs, staticData, executionId })[0].json.output;
  // NEU (2026-09-03, Nutzer-Idee "Textbausteine wiederverwenden"): usp_intro
  // ist ein fester, seitenunabhaengiger Markensatz (siehe FIXED_USP_INTRO_DE
  // oben) -- fuer die Baseline-Sprachen liegt bereits eine einmalig mit
  // gpt-5.6-terra erzeugte und geprueft-freigegebene Uebersetzung vor
  // (lib/textbausteine.js). Diese wird IMMER verwendet, unabhaengig davon,
  // was das gerade produktive Modell fuer dieses eine Feld geliefert haette
  // -- spart einen Teil der Tokens/Kosten UND garantiert konstante, geprueft
  // gute Formulierung. Faellt eine Sprache (noch) nicht in die Liste, bleibt
  // die frische Modell-Uebersetzung fuer usp_intro unveraendert bestehen.
  if (USP_INTRO_TRANSLATIONS[lang]) parsed.usp_intro = USP_INTRO_TRANSLATIONS[lang];
  // NEU (2026-09-03, gleiches Prinzip fuer faq1_q/faq1_a, siehe
  // FIXED_FAQ1_Q_DE/FIXED_FAQ1_A_DE oben): compliance-relevanter
  // Normkonformitaets-Textbaustein, einmalig mit gpt-5.6-terra uebersetzt
  // und geprueft/freigegeben -- wird IMMER verwendet statt einer frischen
  // Modell-Uebersetzung, damit die rechtlich/inhaltlich wichtige
  // Normaussage auf jeder Seite garantiert identisch ist.
  if (FAQ1_Q_TRANSLATIONS[lang]) parsed.faq1_q = FAQ1_Q_TRANSLATIONS[lang];
  if (FAQ1_A_TRANSLATIONS[lang]) parsed.faq1_a = FAQ1_A_TRANSLATIONS[lang];
  const check = runAllItems('mini_check.js', {
    items: [{ json: { translated: parsed, source: deFields, lang } }], nodeOutputs, staticData, executionId,
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

async function runMultiLangBranch({ filterItem, deFieldsRaw, render, nodeOutputs, staticData, executionId, LIVE, REPO_ROOT }) {
  const problem = filterItem.json.Problem || '';
  const einsatz = filterItem.json.Einsatz || '';
  const region = filterItem.json.Region || ''; // regionslos -> immer leer in diesem Zweig
  const targetLangs = (filterItem.json._target_langs || ['de']).slice();
  const deFields = toGenericFieldsDe(deFieldsRaw);
  const slugDe = trimSlugMl(problem + ' ' + einsatz);

  log(`  Multi-Sprach-Pfad (regionslos): Ziel-Sprachen = ${targetLangs.join(', ')}, Primaer-Slug (DE) = "${slugDe}"`);

  // ---- Uebersetzungen fuer alle Sprachen außer DE ----
  const fieldsByLang = { de: deFields };
  const slugByLang = { de: slugDe };
  for (const lang of targetLangs) {
    if (lang === 'de') continue;
    log(`  Uebersetze nach ${lang} (gpt-5.6-terra) …`);
    const translated = await translateToLanguage({
      lang, deFields, problem, einsatz, region, render, nodeOutputs, staticData, executionId,
    });
    if (!translated) { log(`    [${lang}] uebersprungen (Uebersetzung/Check fehlgeschlagen).`); continue; }
    fieldsByLang[lang] = translated;
    slugByLang[lang] = trimSlugMl(translated.slug_kw) || (slugDe + '-' + lang);
  }

  const okLangs = Object.keys(fieldsByLang); // enthaelt mindestens 'de'
  log(`  Erfolgreich: ${okLangs.length}/${targetLangs.length} Sprachversion(en) (${okLangs.join(', ')}).`);

  // ---- Siblings-Liste (fuer hreflang + Sprachumschalter) ----
  const siblings = okLangs.map((lang) => ({
    lang, slug: slugByLang[lang], url: `https://nikos.info/${lang}/lp/${slugByLang[lang]}/`, meta: LANG_META[lang],
  }));

  // ---- Je Sprache: HTML bauen + SEO-Gate (ML) + Datei schreiben ----
  const groupDir = LIVE ? slugDe : `_ghtest-${slugDe}`;
  const writtenLangs = [];
  for (const lang of okLangs) {
    const built = runAllItems('html_bauen_ml.js', {
      items: [{ json: {
        lang, isPrimary: lang === 'de', fields: fieldsByLang[lang], region, einsatz, problem,
        uiL10n: UI_L10N[lang] || UI_L10N.en, langMeta: LANG_META[lang] || { label: lang, flag: '🏳️', locale: lang },
        siblings, defaultLang: 'de', robots: '<meta name="robots" content="noindex,nofollow">',
      } }],
      nodeOutputs, staticData, executionId,
    })[0];

    let seoOk = true;
    try {
      runEachItem('seo_gate_ml.js', { item: built, nodeOutputs, staticData, executionId });
    } catch (err) {
      log(`    [${lang}] SEO-Gate (ML) blockiert: ${err.message} -- diese Sprachversion wird in diesem Lauf uebersprungen.`);
      seoOk = false;
    }
    if (!seoOk) continue;

    const langDir = path.join(REPO_ROOT, 'lp-preview', groupDir, lang);
    fs.mkdirSync(langDir, { recursive: true });
    const htmlFile = path.join(langDir, 'index.html');
    fs.writeFileSync(htmlFile, built.json.html, 'utf8');
    const readBack = fs.readFileSync(htmlFile, 'utf8');
    if (readBack !== built.json.html) {
      log(`    [${lang}] Integritaetspruefung fehlgeschlagen bei ${htmlFile} -- Sprachversion uebersprungen.`);
      continue;
    }
    // meta.json: Sidecar mit dem sprachspezifischen Slug, damit lp-publish
    // beim Promoten den korrekten Live-Pfad je Sprache kennt (Slugs
    // unterscheiden sich je Sprache -- siehe uebersetzung.system.txt slug_kw).
    fs.writeFileSync(path.join(langDir, 'meta.json'), JSON.stringify({ slug: slugByLang[lang], url: built.json.url }, null, 2), 'utf8');
    writtenLangs.push(lang);
    log(`    [${lang}] geschrieben: lp-preview/${groupDir}/${lang}/index.html (Slug "${slugByLang[lang]}").`);
  }

  if (!writtenLangs.includes('de')) {
    abort('Multi-Sprach-Pfad: Primaersprache DE konnte nicht geschrieben werden (SEO-Gate/Integritaet) -- Lauf abgebrochen.');
  }

  // ---- Sheet aktualisieren (nur --live): slug = Gruppenordner (DE-Slug), pfad = primaere Live-URL ----
  if (LIVE) {
    await sheets.updateRowByRowNumber('Keywordkombinationen', filterItem.json.row_number, {
      Relevanz: filterItem.json._relevanz,
      slug: slugDe,
      pfad: `https://nikos.info/de/lp/${slugDe}/`,
      erstellt_am: DateTime.now().toFormat('dd.MM.yyyy'),
      Problem: problem, Einsatz: einsatz, Region: region,
    });
    log(`  Sheet "Keywordkombinationen" aktualisiert (Zeile ${filterItem.json.row_number}), slug="${slugDe}".`);
  } else {
    log(`  TEST-Modus: Sheet-Update uebersprungen (würde Zeile ${filterItem.json.row_number} mit slug="${slugDe}" als erledigt markieren).`);
  }

  log(`FERTIG (${LIVE ? 'LIVE' : 'TEST'}, Multi-Sprach): ${writtenLangs.length} Sprachversion(en) unter lp-preview/${groupDir}/<lang>/index.html`);
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
  const aiTexteResult = await chatCompletion({
    apiKey: process.env.OPENAI_API_KEY, model: 'gpt-5.6-terra',
    system: aiTexteSystem, user: aiTexteUser, maxTokens: 2600, timeoutMs: 180000, maxRetries: 1,
  });
  nodeOutputs.set('AI Texte (DE+EN)', [aiTexteResult]);

  // ---- 9) Texte JSON ----
  const texteJsonResult = runAllItems('texte_json.js', {
    items: [aiTexteResult], nodeOutputs, staticData, executionId,
  });
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
  const qaAgentResult = await chatCompletion({
    apiKey: process.env.OPENAI_API_KEY, model: 'gpt-5.6-luna',
    system: qaAgentSystem, user: qaAgentUser, maxTokens: 2600, timeoutMs: 180000, maxRetries: 1,
  });
  nodeOutputs.set('QA-Agent', [qaAgentResult]);

  // ---- 12) QA JSON ----
  const qaJsonResult = runAllItems('qa_json.js', { items: [qaAgentResult], nodeOutputs, staticData, executionId });
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
    const nachbesserungResult = await chatCompletion({
      apiKey: process.env.OPENAI_API_KEY, model: 'gpt-5.6-terra',
      system: undefined, // Original-Node hat keine eigene System-Message konfiguriert
      user: nachbesserungUser, maxTokens: 2600, timeoutMs: 180000, maxRetries: 2,
    });
    nodeOutputs.set('Nachbesserung', [nachbesserungResult]);

    const nachbesserungJsonResult = runAllItems('nachbesserung_json.js', {
      items: [nachbesserungResult], nodeOutputs, staticData, executionId,
    });
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
    await runMultiLangBranch({
      filterItem, deFieldsRaw: htmlBauenInput.json.output || {}, render, nodeOutputs, staticData, executionId, LIVE, REPO_ROOT,
    });
    runEachItem('lock_freigeben.js', { item: { json: { error: false } }, nodeOutputs, staticData, executionId });
    return;
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
