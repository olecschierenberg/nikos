#!/usr/bin/env node
'use strict';
/**
 * NIKOS Einmal-Migrationsskript (2026-09-09, Nutzer-Auftrag "Nachruestskript
 * fuer die Text-Varianz bauen"): stellt bereits veroeffentlichte LPs (die vor
 * der 6-Varianten-Umstellung vom 2026-09-09 erzeugt wurden und deshalb noch
 * den alten EINZELNEN fixen USP-Intro-/FAQ1-Text tragen) auf die passende,
 * deterministisch aus Problem+Einsatz+Region gewaehlte Variante um -- OHNE
 * neue KI-Aufrufe, rein Text-Ersetzung in bereits vorhandenen HTML-Dateien.
 *
 * WARUM NOETIG: die Umstellung auf textbausteine.js (6 Varianten statt 1
 * fixem Text) wirkt nur bei NEUER Generierung/Regenerierung (siehe index.js
 * toGenericFieldsForLang()/13c-Block). Bestehende Live-Seiten werden davon
 * nicht rueckwirkend erfasst -- dieses Skript holt das nach.
 *
 * ZWEI PFADE MIT UNTERSCHIEDLICHER SICHERHEIT (siehe Memory
 * nikos-landingpages-seo.md, Abschnitt "RETROFIT..."):
 *  - Klassischer Pfad (loesungen/<slug>/index.html, nur data-de relevant --
 *    data-en ist im ueberwiegenden single-de-Fall leer/Boilerplate, siehe
 *    ai-texte.system.txt "Modus DEUTSCH"):
 *      usp_intro: EXAKTER Text-Ersatz (Variante 0 in textbausteine.js ist
 *        laut dortigem Kommentar "bisherige, seit 2026-09-03 einzige
 *        Fassung, dient als Anker/unveraendert" -- also identisch zum alten
 *        fixen Satz).
 *      FAQ1 (Frage+Antwort): STRUKTURELLER Ersatz (erstes
 *        <span class="faq-q" data-de>...</span> bzw. erstes
 *        <div class="faq-item__body" data-de>...</div> im Dokument -- FAQ1
 *        steht in der Vorlage IMMER an erster Stelle, siehe html_bauen.js
 *        TEMPLATE), NICHT Exact-Match -- FAQ1 war auf diesem Pfad vor dem
 *        13c-Fix nie hart eingefroren, der Text variiert schon heute frei
 *        pro Seite.
 *  - Mehrsprachiger Pfad (<lang>/lp/<slug>/index.html): usp_intro UND FAQ1
 *    (Frage+Antwort) beide EXAKTER Text-Ersatz (hartes Override griff hier
 *    von Anfang an durchgehend, siehe toGenericFieldsForLang()).
 *
 * NIKOS-Wort-Verlinkung: alte wie neue Textbausteine werden vor dem
 * Vergleichen/Ersetzen durch dieselbe Verlinkungs-Logik wie feinschliff.js /
 * html_bauen_ml.js geschickt (linkifyNikos()), damit der Exact-Match/die
 * Struktur-Ersetzung auf dem tatsaechlich im Live-HTML stehenden, bereits
 * verlinkten Text funktioniert.
 *
 * Problem/Einsatz/Region je Seite: aus dem Sheet gelesen. Klassischer Pfad:
 * Zeile per slug-Spalte gefunden. ML-Pfad: die Zeile, deren pfad-Spalte mit
 * der hreflang="x-default"-URL DIESER Datei uebereinstimmt (zeigt bei JEDER
 * Sprachversion einer Gruppe -- auch der Primaersprache selbst -- auf die
 * Primaer-URL, die exakt der Sheet-pfad-Spalte entspricht). Dieselbe
 * Problem/Einsatz/Region-Kombination gilt fuer ALLE Sprachversionen einer
 * Gruppe (siehe pickUspIndex/pickFaqIndex: gleicher Seed = gleicher Index in
 * jeder Sprache -- das ist die Grundlage des ganzen Varianten-Systems).
 *
 * SICHERHEIT: eine Datei wird NUR geaendert, wenn der erwartete alte Text/
 * die erwartete Struktur EXAKT gefunden wird (bei Exact-Match: genau 1x,
 * nicht 0x, nicht >1x) -- sonst wird das betroffene Feld uebersprungen und
 * geloggt (NICHT_GEFUNDEN/MEHRDEUTIG), NIE geraten oder teilweise ersetzt.
 * Seiten, deren Variante zufaellig bereits Index 0 (= alter Text) ist,
 * werden als "kein Unterschied" geloggt, nicht als Fehler.
 *
 * Aufruf: node retrofit-existing-lp-variants.js (Dry-Run) / --live
 */

const fs = require('fs');
const path = require('path');
const sheets = require('../lib/sheets.js');
const {
  USP_INTRO_DE_VARIANTS, USP_INTRO_TRANSLATIONS,
  FAQ1_Q_DE_VARIANTS, FAQ1_Q_TRANSLATIONS,
  FAQ1_A_DE_VARIANTS, FAQ1_A_TRANSLATIONS,
  FAQ1_A_CLOSING_DE, FAQ1_A_CLOSING_TRANSLATIONS,
  pickUspIndex, pickFaqIndex,
} = require('../lib/textbausteine.js');

const LIVE = process.argv.includes('--live');
const REPO_ROOT = path.join(__dirname, '..', '..', '..');
const SHEET_NAME = 'Keywordkombinationen';
const BASELINE_LANGS = ['de', 'en', 'fr', 'it', 'es', 'nl', 'da', 'pl'];

function log(msg) { console.log(`[retrofit-existing-lp-variants] ${msg}`); }
function norm(v) { return String(v || '').trim(); }

// ---- NIKOS-Wort-Verlinkung: 1:1 dieselbe Regel wie feinschliff.js / html_bauen_ml.js ----
const NIKOSLOGO = '<a class="nk-mod" href="https://nikos.info/index.html"><img src="https://nikos.info/assets/logos/nikos/SVG/NIKOS.svg" alt="NIKOS" loading="lazy"></a>';
function linkifyNikos(s) {
  return String(s || '').replace(/NIKOS(?!-|[A-Za-z0-9²]| \[)/g, NIKOSLOGO);
}

function uspFor(lang, idx) {
  return linkifyNikos(lang === 'de' ? USP_INTRO_DE_VARIANTS[idx] : USP_INTRO_TRANSLATIONS[lang][idx]);
}
function faq1QFor(lang, idx) {
  return linkifyNikos(lang === 'de' ? FAQ1_Q_DE_VARIANTS[idx] : FAQ1_Q_TRANSLATIONS[lang][idx]);
}
function faq1AFor(lang, idx) {
  const core = lang === 'de' ? FAQ1_A_DE_VARIANTS[idx] : FAQ1_A_TRANSLATIONS[lang][idx];
  const closing = lang === 'de' ? FAQ1_A_CLOSING_DE : (FAQ1_A_CLOSING_TRANSLATIONS[lang] || FAQ1_A_CLOSING_DE);
  return linkifyNikos(core + ' ' + closing);
}

function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  let count = 0, pos = 0;
  for (;;) {
    const i = haystack.indexOf(needle, pos);
    if (i === -1) break;
    count++;
    pos = i + needle.length;
  }
  return count;
}

// Exakter Text-Ersatz -- nur wenn oldStr GENAU 1x vorkommt.
function replaceExactlyOnce(content, oldStr, newStr, label, stats) {
  const n = countOccurrences(content, oldStr);
  if (n === 0) { stats.notFound.push(label); return { content, changed: false }; }
  if (n > 1) { stats.ambiguous.push(label); return { content, changed: false }; }
  if (oldStr === newStr) { stats.alreadyVariant0.push(label); return { content, changed: false }; }
  return { content: content.split(oldStr).join(newStr), changed: true };
}

// Struktureller Ersatz: Inhalt zwischen dem ERSTEN Vorkommen von openTagRe und
// dem naechsten closeTag wird ersetzt (FAQ1 steht in der Vorlage immer zuerst).
function replaceFirstTagContent(content, openTagRe, closeTag, newInner, label, stats) {
  const m = openTagRe.exec(content);
  if (!m) { stats.notFound.push(label); return { content, changed: false }; }
  const openEnd = m.index + m[0].length;
  const closeIdx = content.indexOf(closeTag, openEnd);
  if (closeIdx === -1) { stats.notFound.push(label + ' (kein schliessendes Tag gefunden)'); return { content, changed: false }; }
  const oldInner = content.slice(openEnd, closeIdx);
  if (oldInner === newInner) { stats.alreadyVariant0.push(label); return { content, changed: false }; }
  return { content: content.slice(0, openEnd) + newInner + content.slice(closeIdx), changed: true };
}

function writeVerified(file, content) {
  fs.writeFileSync(file, content, 'utf8');
  const back = fs.readFileSync(file, 'utf8');
  if (back !== content) throw new Error(`Integritaetspruefung fehlgeschlagen beim Schreiben von ${file}`);
}

async function main() {
  console.log(`Modus: ${LIVE ? 'LIVE (schreibt wirklich)' : 'DRY-RUN (schreibt NICHTS, nur Vorschau)'}`);

  const rows = await sheets.readSheetAsItems(SHEET_NAME);
  const bySlug = new Map();  // slug -> {Problem,Einsatz,Region}
  const byPfad = new Map();  // normalisierte pfad-URL -> {Problem,Einsatz,Region}
  for (const r of rows) {
    const j = r.json;
    const slug = norm(j.slug);
    if (!slug) continue;
    const ctx = { Problem: norm(j.Problem), Einsatz: norm(j.Einsatz), Region: norm(j.Region) };
    bySlug.set(slug, ctx);
    const pfad = norm(j.pfad);
    if (pfad) byPfad.set(pfad.replace(/\/?$/, '/'), ctx);
  }
  log(`Sheet gelesen: ${rows.length} Zeile(n), ${bySlug.size} mit slug, ${byPfad.size} mit pfad.`);

  const stats = { changedFiles: [], alreadyVariant0: [], notFound: [], ambiguous: [], noSheetRow: [] };

  // ---- Klassischer Pfad: loesungen/<slug>/index.html ----
  const loesungenDir = path.join(REPO_ROOT, 'loesungen');
  if (fs.existsSync(loesungenDir)) {
    const slugs = fs.readdirSync(loesungenDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    log(`Klassischer Pfad: ${slugs.length} Verzeichnis(se) in loesungen/.`);
    for (const slug of slugs) {
      const file = path.join(loesungenDir, slug, 'index.html');
      if (!fs.existsSync(file)) continue;
      const ctx = bySlug.get(slug);
      if (!ctx) { stats.noSheetRow.push(`loesungen/${slug}`); continue; }
      const uspIdx = pickUspIndex(ctx.Problem, ctx.Einsatz, ctx.Region);
      const faqIdx = pickFaqIndex(ctx.Problem, ctx.Einsatz, ctx.Region);
      let content = fs.readFileSync(file, 'utf8');
      let changedAny = false;

      {
        const res = replaceExactlyOnce(content, uspFor('de', 0), uspFor('de', uspIdx), `loesungen/${slug} usp_intro`, stats);
        content = res.content; changedAny = changedAny || res.changed;
      }
      {
        const res = replaceFirstTagContent(content, /<span class="faq-q" data-de>/, '</span>', faq1QFor('de', faqIdx), `loesungen/${slug} faq1_q`, stats);
        content = res.content; changedAny = changedAny || res.changed;
      }
      {
        const res = replaceFirstTagContent(content, /<div class="faq-item__body" data-de>/, '</div>', faq1AFor('de', faqIdx), `loesungen/${slug} faq1_a`, stats);
        content = res.content; changedAny = changedAny || res.changed;
      }

      if (changedAny) {
        stats.changedFiles.push(file);
        if (LIVE) writeVerified(file, content);
      }
    }
  }

  // ---- Mehrsprachiger Pfad: <lang>/lp/<slug>/index.html ----
  for (const lang of BASELINE_LANGS) {
    const lpDir = path.join(REPO_ROOT, lang, 'lp');
    if (!fs.existsSync(lpDir)) continue;
    const slugs = fs.readdirSync(lpDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    log(`ML-Pfad [${lang}]: ${slugs.length} Verzeichnis(se) in ${lang}/lp/.`);
    for (const slug of slugs) {
      const file = path.join(lpDir, slug, 'index.html');
      if (!fs.existsSync(file)) continue;
      let content = fs.readFileSync(file, 'utf8');

      const m = /<link rel="alternate" hreflang="x-default" href="([^"]+)">/.exec(content);
      if (!m) { stats.noSheetRow.push(`${lang}/lp/${slug} (kein x-default-Link gefunden)`); continue; }
      const primaryUrl = m[1].replace(/\/?$/, '/');
      const ctx = byPfad.get(primaryUrl);
      if (!ctx) { stats.noSheetRow.push(`${lang}/lp/${slug} (Sheet-Zeile fuer ${primaryUrl} nicht gefunden)`); continue; }

      const uspIdx = pickUspIndex(ctx.Problem, ctx.Einsatz, ctx.Region);
      const faqIdx = pickFaqIndex(ctx.Problem, ctx.Einsatz, ctx.Region);
      let changedAny = false;

      {
        const res = replaceExactlyOnce(content, uspFor(lang, 0), uspFor(lang, uspIdx), `${lang}/lp/${slug} usp_intro`, stats);
        content = res.content; changedAny = changedAny || res.changed;
      }
      {
        const res = replaceExactlyOnce(content, faq1QFor(lang, 0), faq1QFor(lang, faqIdx), `${lang}/lp/${slug} faq1_q`, stats);
        content = res.content; changedAny = changedAny || res.changed;
      }
      {
        const res = replaceExactlyOnce(content, faq1AFor(lang, 0), faq1AFor(lang, faqIdx), `${lang}/lp/${slug} faq1_a`, stats);
        content = res.content; changedAny = changedAny || res.changed;
      }

      if (changedAny) {
        stats.changedFiles.push(file);
        if (LIVE) writeVerified(file, content);
      }
    }
  }

  console.log('\n---- Zusammenfassung ----');
  console.log(`${stats.changedFiles.length} Datei(en) ${LIVE ? 'geaendert' : 'wuerden geaendert'}.`);
  console.log(`${stats.alreadyVariant0.length} Feld(er) bereits Variante 0 (kein Unterschied, uebersprungen).`);
  if (stats.noSheetRow.length) {
    console.log(`${stats.noSheetRow.length} Datei(en) OHNE Sheet-Zuordnung uebersprungen (erste 20): ${stats.noSheetRow.slice(0, 20).join(', ')}`);
  }
  if (stats.notFound.length) {
    console.log(`${stats.notFound.length} Feld(er) NICHT GEFUNDEN -- unerwartete Struktur, uebersprungen (erste 20): ${stats.notFound.slice(0, 20).join(', ')}`);
  }
  if (stats.ambiguous.length) {
    console.log(`${stats.ambiguous.length} Feld(er) MEHRDEUTIG (>1 Treffer) -- uebersprungen, BITTE PRUEFEN: ${stats.ambiguous.join(', ')}`);
  }
  if (!LIVE) console.log('\nDies war ein DRY-RUN. Zum wirklichen Ausfuehren erneut mit --live aufrufen.');
}

main().catch((err) => { console.error('FEHLER:', err); process.exit(1); });
