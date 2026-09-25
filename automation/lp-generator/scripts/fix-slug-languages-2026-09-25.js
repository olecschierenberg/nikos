#!/usr/bin/env node
'use strict';
/**
 * EINMAL-REPARATUR 2026-09-25: "Der Slug muss bei allen Seiten immer in der passenden Sprache sein."
 *
 * Bestandsaufnahme (alle <sprache>/lp/<slug>-Seiten + alle lp-preview-Gruppen geprueft):
 *  A) LIVE, falscher Slug -> umbenennen (neuer Ordner, alle Verweise repo-weit, alter Ort = Weiterleitung):
 *     - en/lp/weerwaarschuwing-gentse-feesten  (niederlaendisch)  -> en/lp/weather-warning-gentse-feesten
 *     - de/lp/besucherin-formation-sail-amsterdam (zerteilt)      -> de/lp/besucherinformation-sail-amsterdam
 *     Sheet: Zeile "Unwetterwarnung / Gentse Feesten" (EN-Primaersprache) bekommt neuen slug/pfad.
 *  B) VORSCHAU, falscher Slug -> Vorschau loeschen, Sheet-Zeile zuruecksetzen (erstellen=x bleibt, slug/pfad/
 *     erstellt_am/deploy leer) -> der korrigierte Generator (Slug-Sprachpruefung) erzeugt sie neu:
 *     - emergency-announcements-sailing-event (NL-Seite mit englischem Slug)  [Notfalldurchsage / Sail Amsterdam 2030]
 *     - voice-alarm-sail                      (NL-Seite mit englischem Slug)  [Sprachalarmierung / Sail Amsterdam 2030]
 *     - bezoekerssturing-zeilevenement        (EN-Seite mit NL-Slug; verwaiste Vorschau ohne Sheet-Zeile --
 *       die Kombination ist laengst als en/lp/visitor-guidance-sail-amsterdam-2030 live) -> nur loeschen.
 *  C) Nebenfund: "Besucherlenkung / Basel Tattoo" steht im Sheet als veroeffentlicht (aktiv=x), die Seite
 *     de/lp/besucherlenkung-basel-tattoo existiert aber nicht (liegt noch in lp-preview) -> aktiv leeren,
 *     damit LP-Publish sie beim naechsten Lauf wirklich veroeffentlicht (deploy=x ist gesetzt). Die zweite, noch
 *     offene Zeile derselben Kombination bekommt erstellen leer (sonst wuerde die Seite doppelt erzeugt).
 *
 * Standard: Dry-Run. Mit --live wird geschrieben (Dateien; Commit/Push macht der Workflow).
 */
const fs = require('fs');
const path = require('path');
const sheets = require('../lib/sheets');

const LIVE = process.argv.includes('--live');
const ROOT = path.join(__dirname, '..', '..', '..');
const BASE = 'https://nikos.info';
const TAB = 'Keywordkombinationen';
const log = (m) => console.log(`[fix-slug-lang] ${m}`);
const fail = (m) => { console.error(`[fix-slug-lang] ABBRUCH: ${m}`); process.exit(1); };
const n = (v) => String(v ?? '').trim().toLowerCase();

const RENAMES = [
  { lang: 'en', oldSlug: 'weerwaarschuwing-gentse-feesten', newSlug: 'weather-warning-gentse-feesten',
    sheet: { Problem: 'unwetterwarnung', Einsatz: 'gentse feesten', Region: 'gent' } },
  { lang: 'de', oldSlug: 'besucherin-formation-sail-amsterdam', newSlug: 'besucherinformation-sail-amsterdam', sheet: null },
];
const REGENERATE = [
  { group: 'emergency-announcements-sailing-event', Problem: 'notfalldurchsage', Einsatz: 'sail amsterdam 2030', Region: 'amsterdam' },
  { group: 'voice-alarm-sail', Problem: 'sprachalarmierung', Einsatz: 'sail amsterdam 2030', Region: 'amsterdam' },
];
const ORPHANS = ['bezoekerssturing-zeilevenement'];
const REPUBLISH = [{ slug: 'besucherlenkung-basel-tattoo', lang: 'de' }];

const EXCLUDE = ['backups', 'lp-preview', '.git', 'node_modules', 'automation'];
function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    const rel = path.relative(ROOT, full);
    if (EXCLUDE.includes(rel.split(path.sep)[0])) continue;
    if (e.isDirectory()) walk(full, out);
    else if (/\.(html|xml|txt|json)$/.test(e.name)) out.push(full);
  }
  return out;
}
function stub(newUrl, lang) {
  return `<!DOCTYPE html>\n<html lang="${lang}">\n<head>\n<meta charset="UTF-8">\n<meta name="robots" content="noindex, follow">\n<meta http-equiv="refresh" content="0; url=${newUrl}">\n<link rel="canonical" href="${newUrl}">\n<title>NIKOS</title>\n<script>location.replace(${JSON.stringify(newUrl)});</script>\n</head>\n<body>\n<p><a href="${newUrl}">${newUrl}</a></p>\n</body>\n</html>\n`;
}
const rowMatch = (r, k) => n(r.Problem) === k.Problem && n(r.Einsatz) === k.Einsatz && n(r.Region) === k.Region;

(async () => {
  log(`Modus: ${LIVE ? 'LIVE' : 'DRY-RUN'}`);
  const rows = (await sheets.readSheetAsItems(TAB)).map((i) => i.json);

  // ---- Vorpruefung ----
  for (const r of RENAMES) {
    const oldF = path.join(ROOT, r.lang, 'lp', r.oldSlug, 'index.html');
    const newD = path.join(ROOT, r.lang, 'lp', r.newSlug);
    if (!fs.existsSync(oldF)) fail(`${r.lang}/lp/${r.oldSlug} fehlt.`);
    if (fs.existsSync(newD)) fail(`${r.lang}/lp/${r.newSlug} existiert bereits.`);
    if (/http-equiv="refresh"/.test(fs.readFileSync(oldF, 'utf8'))) fail(`${r.lang}/lp/${r.oldSlug} ist bereits eine Weiterleitung.`);
    if (r.sheet) {
      const m = rows.filter((x) => rowMatch(x, r.sheet) && n(x.slug) === r.oldSlug);
      if (m.length !== 1) fail(`Sheet-Zeile fuer ${r.oldSlug}: ${m.length} Treffer (erwartet 1).`);
      r.row = m[0].row_number;
    }
  }
  for (const g of REGENERATE) {
    const m = rows.filter((x) => rowMatch(x, g) && n(x.slug) === g.group);
    if (m.length !== 1) fail(`Sheet-Zeile fuer ${g.group}: ${m.length} Treffer (erwartet 1).`);
    if (n(m[0].aktiv) === 'x') fail(`${g.group} ist bereits veroeffentlicht (aktiv=x) -- bitte manuell pruefen.`);
    for (const l of ['de', 'en', 'fr', 'it', 'es', 'nl', 'da', 'pl']) {
      if (fs.existsSync(path.join(ROOT, l, 'lp', g.group))) fail(`${l}/lp/${g.group} existiert live -- nicht nur Vorschau.`);
    }
    g.row = m[0].row_number;
  }

  // ---- A) Live-Umbenennungen ----
  const originals = new Map(RENAMES.map((r) => [r, fs.readFileSync(path.join(ROOT, r.lang, 'lp', r.oldSlug, 'index.html'), 'utf8')]));
  const files = walk(ROOT, []);
  let hits = 0;
  for (const f of files) {
    let c = fs.readFileSync(f, 'utf8'); let changed = false;
    for (const r of RENAMES) {
      const o = `${BASE}/${r.lang}/lp/${r.oldSlug}/`; const nw = `${BASE}/${r.lang}/lp/${r.newSlug}/`;
      const k = c.split(o).length - 1;
      if (k) { c = c.split(o).join(nw); hits += k; changed = true; }
    }
    if (changed) { log(`Verweise ersetzt: ${path.relative(ROOT, f)}`); if (LIVE) fs.writeFileSync(f, c, 'utf8'); }
  }
  log(`Verweise gesamt: ${hits}`);
  for (const r of RENAMES) {
    const o = `${BASE}/${r.lang}/lp/${r.oldSlug}/`; const nw = `${BASE}/${r.lang}/lp/${r.newSlug}/`;
    log(`Umbenennen: ${r.lang}/lp/${r.oldSlug} -> ${r.lang}/lp/${r.newSlug} (alter Ort: Weiterleitung)`);
    if (LIVE) {
      fs.mkdirSync(path.join(ROOT, r.lang, 'lp', r.newSlug), { recursive: true });
      fs.writeFileSync(path.join(ROOT, r.lang, 'lp', r.newSlug, 'index.html'), originals.get(r).split(o).join(nw), 'utf8');
      fs.writeFileSync(path.join(ROOT, r.lang, 'lp', r.oldSlug, 'index.html'), stub(nw, r.lang), 'utf8');
    }
    if (r.row) {
      log(`Sheet Zeile ${r.row}: slug=${r.newSlug}, pfad=${nw}`);
      if (LIVE) await sheets.updateRowByRowNumber(TAB, r.row, { slug: r.newSlug, pfad: nw });
    }
  }

  // ---- B) Vorschauen neu erzeugen lassen ----
  for (const g of REGENERATE) {
    log(`Vorschau loeschen: lp-preview/${g.group}; Sheet Zeile ${g.row} zuruecksetzen (slug/pfad/erstellt_am/deploy leer)`);
    if (LIVE) {
      fs.rmSync(path.join(ROOT, 'lp-preview', g.group), { recursive: true, force: true });
      await sheets.updateRowByRowNumber(TAB, g.row, { slug: '', pfad: '', erstellt_am: '', deploy: '' });
    }
  }
  for (const o of ORPHANS) {
    if (rows.some((x) => n(x.slug) === o)) fail(`${o} hat doch eine Sheet-Zeile -- nicht geloescht.`);
    log(`Verwaiste Vorschau loeschen: lp-preview/${o}`);
    if (LIVE) fs.rmSync(path.join(ROOT, 'lp-preview', o), { recursive: true, force: true });
  }

  // ---- C) Basel Tattoo erneut veroeffentlichen lassen ----
  for (const p of REPUBLISH) {
    const m = rows.filter((x) => n(x.slug) === p.slug);
    const live = fs.existsSync(path.join(ROOT, p.lang, 'lp', p.slug, 'index.html'));
    const prev = fs.existsSync(path.join(ROOT, 'lp-preview', p.slug));
    log(`${p.slug}: Sheet-Zeilen ${m.map((x) => `${x.row_number}(deploy=${x.deploy},aktiv=${x.aktiv})`).join(', ')}, live=${live}, Vorschau=${prev}`);
    if (m.length === 1 && n(m[0].aktiv) === 'x' && n(m[0].deploy) === 'x' && !live && prev) {
      log(`  -> aktiv leeren (LP-Publish veroeffentlicht beim naechsten Lauf)`);
      if (LIVE) await sheets.updateRowByRowNumber(TAB, m[0].row_number, { aktiv: '' });
    } else {
      log('  -> Bedingungen nicht erfuellt, nichts geaendert.');
    }
    // Doppelte, noch offene Zeile derselben Kombination (wuerde die Seite ein zweites Mal erzeugen) -> erstellen leeren.
    if (m.length === 1) {
      const dupes = rows.filter((x) => x !== m[0] && n(x.Problem) === n(m[0].Problem) && n(x.Einsatz) === n(m[0].Einsatz)
        && n(x.Region) === n(m[0].Region) && n(x.slug) === '' && n(x.erstellen) === 'x');
      for (const x of dupes) {
        log(`  Doppelte offene Zeile ${x.row_number} -> erstellen leeren`);
        if (LIVE) await sheets.updateRowByRowNumber(TAB, x.row_number, { erstellen: '' });
      }
    }
  }
  log('FERTIG.');
})().catch((e) => fail(e.stack || e.message));
