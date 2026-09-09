#!/usr/bin/env node
'use strict';
/**
 * NIKOS Bestandsaudit (2026-09-09, Nutzer-Auftrag nach dem Text-Varianz-
 * Retrofit: "Verifiziere die verwaisten Landingpages genauer ... Jede LP
 * soll ueber das Sheet klar sichtbar und deaktivierbar sein" + Bestaetigung
 * gewuenscht, dass es keine versteckten Dateileichen/Duplikate mehr gibt).
 *
 * REIN LESEND -- aendert weder Dateien noch das Sheet. Liefert einen
 * vollstaendigen Kreuzabgleich in beide Richtungen:
 *
 *  A) DATEI ohne SHEET-ZEILE ("Dateileiche"): Verzeichnis unter loesungen/
 *     bzw. <lang>/lp/ existiert, aber keine Sheet-Zeile referenziert es
 *     (Slug- bzw. x-default/pfad-Abgleich, identische Logik wie
 *     retrofit-existing-lp-variants.js). Fuer jeden Fund: Titel, H1,
 *     Canonical-URL, (bei ML) x-default-Ziel, erstes/letztes Git-Datum +
 *     letzte Commit-Message (zeigt, welches Skript zuletzt daran beteiligt
 *     war) -- als Entscheidungsgrundlage fuer "loeschen" vs. "Sheet-Zeile
 *     nachtragen".
 *  B) SHEET-ZEILE ohne DATEI ("tote Zeile"): Zeile hat aktiv gesetzt
 *     (bzw. slug+pfad gesetzt), aber die referenzierte Datei existiert
 *     nicht (mehr) im Repo -- zeigt Inkonsistenzen in der anderen Richtung.
 *  C) DUPLIKAT-INHALTE: Intro-Text (data-de, das einzige wirklich pro Seite
 *     frei generierte Feld) wird ueber ALLE gefundenen Verzeichnisse
 *     gehasht; identische Hashes an unterschiedlichen Pfaden = Verdacht auf
 *     inhaltlich identische/duplizierte Seiten (unabhaengig vom bereits
 *     erledigten USP-Intro/FAQ1-Varianz-Retrofit).
 *
 * Aufruf: node audit-lp-inventory.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const sheets = require('../lib/sheets.js');

const REPO_ROOT = path.join(__dirname, '..', '..', '..');
const SHEET_NAME = 'Keywordkombinationen';
const BASELINE_LANGS = ['de', 'en', 'fr', 'it', 'es', 'nl', 'da', 'pl'];

function log(msg) { console.log(`[audit-lp-inventory] ${msg}`); }
function norm(v) { return String(v || '').trim(); }

function extract(re, content) {
  const m = re.exec(content);
  return m ? m[1].trim() : '';
}
function gitInfo(relPath) {
  try {
    const first = execSync(`git log --diff-filter=A --follow --format=%ad --date=short -1 -- "${relPath}"`, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
    const last = execSync(`git log -1 --format=%ad --date=short -- "${relPath}"`, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
    const lastMsg = execSync(`git log -1 --format=%s -- "${relPath}"`, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
    return { first: first || '?', last: last || '?', lastMsg: lastMsg || '?' };
  } catch (e) {
    return { first: '?', last: '?', lastMsg: '(git-Fehler: ' + e.message.split('\n')[0] + ')' };
  }
}
function fingerprint(content) {
  // Intro-Text (data-de) ist das einzige durchgehend pro Seite frei per KI
  // generierte, nicht gepoolte Feld -- geeigneter Kandidat fuer einen
  // Duplikat-Fingerprint als USP/FAQ1 (die jetzt bewusst aus einem kleinen
  // Pool kommen und deshalb absichtlich MEHRFACH identisch vorkommen
  // koennen, ohne ein echtes Duplikat zu sein).
  const intro = extract(/<p class="body-l"[^>]*data-de>([\s\S]*?)<\/p>/, content)
    || extract(/<p class="body-l"[^>]*>([\s\S]*?)<\/p>/, content); // ML-Pfad: kein data-de-Attribut
  const h1 = extract(/<h1[^>]*data-de>([\s\S]*?)<\/h1>/, content) || extract(/<h1[^>]*>([\s\S]*?)<\/h1>/, content);
  const basis = (h1 + '|' + intro).replace(/\s+/g, ' ').trim();
  if (basis.length < 20) return null; // zu kurz/leer, kein verlaesslicher Fingerprint
  return crypto.createHash('sha256').update(basis).digest('hex').slice(0, 16);
}

async function main() {
  const rows = await sheets.readSheetAsItems(SHEET_NAME);
  const bySlug = new Map();
  const byPfad = new Map();
  for (const r of rows) {
    const j = r.json;
    const slug = norm(j.slug);
    const entry = { row_number: j.row_number, Problem: norm(j.Problem), Einsatz: norm(j.Einsatz), Region: norm(j.Region), aktiv: norm(j.aktiv), deploy: norm(j.deploy), erstellen: norm(j.erstellen), slug, pfad: norm(j.pfad) };
    if (slug) bySlug.set(slug, entry);
    if (entry.pfad) byPfad.set(entry.pfad.replace(/\/?$/, '/'), entry);
  }
  log(`Sheet gelesen: ${rows.length} Zeile(n), ${bySlug.size} mit slug, ${byPfad.size} mit pfad.`);

  const inventory = []; // { relPath, matched, sheetEntry, title, h1, canonical, xdefault, fp }
  const seenSlugRefs = new Set(); // welche bySlug/byPfad-Eintraege tatsaechlich durch eine Datei "abgeholt" wurden

  // ---- Klassischer Pfad ----
  const loesungenDir = path.join(REPO_ROOT, 'loesungen');
  if (fs.existsSync(loesungenDir)) {
    const slugs = fs.readdirSync(loesungenDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    for (const slug of slugs) {
      const file = path.join(loesungenDir, slug, 'index.html');
      if (!fs.existsSync(file)) continue;
      const content = fs.readFileSync(file, 'utf8');
      const entry = bySlug.get(slug);
      if (entry) seenSlugRefs.add('slug:' + slug);
      inventory.push({
        relPath: `loesungen/${slug}/index.html`,
        kind: 'classic',
        matched: !!entry,
        sheetEntry: entry || null,
        title: extract(/<title>([\s\S]*?)<\/title>/, content),
        h1: extract(/<h1[^>]*data-de>([\s\S]*?)<\/h1>/, content),
        canonical: extract(/<link rel="canonical" href="([^"]+)">/, content),
        xdefault: '',
        fp: fingerprint(content),
      });
    }
  }

  // ---- ML-Pfad ----
  for (const lang of BASELINE_LANGS) {
    const lpDir = path.join(REPO_ROOT, lang, 'lp');
    if (!fs.existsSync(lpDir)) continue;
    const slugs = fs.readdirSync(lpDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    for (const slug of slugs) {
      const file = path.join(lpDir, slug, 'index.html');
      if (!fs.existsSync(file)) continue;
      const content = fs.readFileSync(file, 'utf8');
      const xdefault = extract(/<link rel="alternate" hreflang="x-default" href="([^"]+)">/, content);
      const pfadKey = xdefault ? xdefault.replace(/\/?$/, '/') : '';
      const entry = pfadKey ? byPfad.get(pfadKey) : null;
      if (entry) seenSlugRefs.add('pfad:' + pfadKey);
      inventory.push({
        relPath: `${lang}/lp/${slug}/index.html`,
        kind: 'ml:' + lang,
        matched: !!entry,
        sheetEntry: entry || null,
        title: extract(/<title>([\s\S]*?)<\/title>/, content),
        h1: extract(/<h1[^>]*>([\s\S]*?)<\/h1>/, content),
        canonical: extract(/<link rel="canonical" href="([^"]+)">/, content),
        xdefault,
        fp: fingerprint(content),
      });
    }
  }

  log(`Bestand: ${inventory.length} Verzeichnis(se) gesamt (${inventory.filter(x => x.kind === 'classic').length} klassisch, ${inventory.filter(x => x.kind !== 'classic').length} ML).`);

  // ---- A) Dateien ohne Sheet-Zeile ----
  const orphans = inventory.filter((x) => !x.matched);
  console.log(`\n==== A) ${orphans.length} DATEI(EN) OHNE SHEET-ZUORDNUNG ====`);
  for (const o of orphans) {
    const gi = gitInfo(o.relPath);
    console.log(`\n- ${o.relPath}`);
    console.log(`  Titel: ${o.title}`);
    console.log(`  H1: ${o.h1}`);
    console.log(`  Canonical: ${o.canonical}`);
    if (o.xdefault) console.log(`  x-default-Ziel: ${o.xdefault}`);
    console.log(`  Git: erstellt ${gi.first}, zuletzt geaendert ${gi.last} ("${gi.lastMsg}")`);
  }

  // ---- B) Sheet-Zeilen mit aktiv/deploy/slug/pfad, aber Datei fehlt ----
  const deadRows = [];
  for (const [slug, e] of bySlug) {
    if (!e.aktiv && !e.deploy) continue; // nur Zeilen betrachten, die live sein SOLLTEN
    if (!seenSlugRefs.has('slug:' + slug)) {
      // Pruefen ob evtl. unter einem ML-Pfad via pfad gefunden -- sonst echte Luecke
      const viaPfad = e.pfad && seenSlugRefs.has('pfad:' + e.pfad.replace(/\/?$/, '/'));
      if (!viaPfad) deadRows.push(e);
    }
  }
  console.log(`\n==== B) ${deadRows.length} SHEET-ZEILE(N) MIT aktiv/deploy, ABER KEINE PASSENDE DATEI GEFUNDEN ====`);
  for (const e of deadRows) {
    console.log(`- Zeile ${e.row_number}: Problem="${e.Problem}" Einsatz="${e.Einsatz}" Region="${e.Region}" slug="${e.slug}" pfad="${e.pfad}" aktiv="${e.aktiv}" deploy="${e.deploy}"`);
  }

  // ---- C) Duplikat-Inhalte (Fingerprint-Kollisionen) ----
  const byFp = new Map();
  for (const x of inventory) {
    if (!x.fp) continue;
    if (!byFp.has(x.fp)) byFp.set(x.fp, []);
    byFp.get(x.fp).push(x);
  }
  const dupGroups = [...byFp.values()].filter((g) => g.length > 1);
  console.log(`\n==== C) ${dupGroups.length} GRUPPE(N) MIT IDENTISCHEM INTRO-TEXT AN MEHREREN PFADEN ====`);
  for (const g of dupGroups) {
    console.log(`\n- ${g.length}x identischer Intro/H1-Text:`);
    for (const x of g) {
      console.log(`   ${x.relPath} (matched=${x.matched}, Titel: ${x.title})`);
    }
  }

  console.log('\n---- Zusammenfassung ----');
  console.log(`Gesamt Verzeichnisse: ${inventory.length}`);
  console.log(`A) Dateien ohne Sheet-Zeile: ${orphans.length}`);
  console.log(`B) Sheet-Zeilen (aktiv/deploy) ohne Datei: ${deadRows.length}`);
  console.log(`C) Duplikat-Gruppen (identischer Intro-Text): ${dupGroups.length}`);
}

main().catch((err) => { console.error('FEHLER:', err); process.exit(1); });
