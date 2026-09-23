#!/usr/bin/env node
'use strict';
/**
 * EINMAL-REPARATUR 2026-09-23 (Tab "Keywordkombinationen")
 *
 * Hintergrund: Seit 2026-09-10 war die Hilfsspalte "OrigZeile" leer (durch die Sortierung
 * verschoben). Der LP-Generator hat dadurch immer dieselbe Kombination (Besucherinformation /
 * Internationales Strassenfest / Sindelfingen) erzeugt und bei jedem Lauf Zeile 2 ueberschrieben.
 * Betroffen waren 2 bereits veroeffentlichte Sail-Amsterdam-2030-Zeilen (Relevanz 10, standen oben):
 *   - Besucherlenkung  -> en/lp/visitor-guidance-sail-amsterdam-2030/
 *   - Besucherinformation -> en/lp/visitor-information-sail-amsterdam-2030/
 * Der taegliche Keyword-Lauf hat beide Kombinationen danach als "offen" neu angelegt (sonst wuerden
 * sie erneut generiert). Diese Reparatur:
 *   1) markiert die beiden neu angelegten offenen Sail-Zeilen wieder als veroeffentlicht
 *      (slug/pfad/deploy/aktiv/erstellt_am wie die Geschwister-Zeilen vom 06.09.2026),
 *   2) loescht die 2 falschen Sindelfingen-Kopien (slug gesetzt, obwohl die echte Zeile offen ist),
 *   3) legt die fehlende Zeile fuer die live-Seite besucherinformation-augsburger-plaerrer-augsburg an.
 * Die echte, offene Sindelfingen-Zeile bleibt unveraendert -> der reparierte Generator erzeugt sie regulaer.
 *
 * Standard: Dry-Run (nur Log). Mit --live wird geschrieben.
 */
const sheets = require('../lib/sheets');
const LIVE = process.argv.includes('--live');
const TAB = 'Keywordkombinationen';
const n = (v) => String(v ?? '').trim().toLowerCase();
const log = (m) => console.log(`[repair-2026-09-23] ${m}`);
const fail = (m) => { console.error(`[repair-2026-09-23] ABBRUCH: ${m}`); process.exit(1); };

const SINDEL_SLUG = 'besucherinformation-internationales-strassenfest-sindelfingen';
const SAIL = [
  { Problem: 'Besucherlenkung', slug: 'visitor-guidance-sail-amsterdam-2030' },
  { Problem: 'Besucherinformation', slug: 'visitor-information-sail-amsterdam-2030' },
];

(async () => {
  log(`Modus: ${LIVE ? 'LIVE' : 'DRY-RUN'}`);
  const rows = (await sheets.readSheetAsItems(TAB)).map((i) => i.json);

  // 1) Falsche Sindelfingen-Kopien: slug gesetzt. Die echte Zeile ist offen (slug leer).
  const dupes = rows.filter((r) => n(r.slug) === SINDEL_SLUG);
  const openSindel = rows.filter((r) => n(r.Problem) === 'besucherinformation'
    && n(r.Einsatz) === 'internationales straßenfest' && n(r.Region) === 'sindelfingen' && n(r.slug) === '');
  log(`Sindelfingen-Kopien mit slug: ${dupes.map((r) => r.row_number).join(', ') || '-'}; offene echte Zeile(n): ${openSindel.map((r) => r.row_number).join(', ') || '-'}`);
  // Wiederholbar (2. Lauf 2026-09-23): 0 Kopien = bereits erledigt.
  if (dupes.length !== 0 && dupes.length !== 2) fail(`erwartet 2 (oder 0 = erledigt) Sindelfingen-Kopien, gefunden ${dupes.length}.`);
  if (openSindel.length !== 1) fail(`erwartet genau 1 offene echte Sindelfingen-Zeile, gefunden ${openSindel.length}.`);

  // 2) Offene Sail-Zeilen finden
  const sailTargets = [];
  for (const s of SAIL) {
    const done = rows.filter((r) => n(r.slug) === s.slug);
    if (done.length) {
      // 1. Lauf hat das Datum teils als echtes Datum (Anzeige 2026-09-06) statt als Text abgelegt -> angleichen.
      const r0 = done[0];
      if (String(r0.erstellt_am).trim() !== '06.09.2026') {
        log(`${s.slug}: Zeile ${r0.row_number} erstellt_am "${r0.erstellt_am}" -> "06.09.2026" (Text).`);
        if (LIVE) await sheets.updateRowByRowNumber(TAB, r0.row_number, { erstellt_am: "'06.09.2026" });
      } else {
        log(`${s.slug}: bereits im Sheet -- uebersprungen.`);
      }
      continue;
    }
    const open = rows.filter((r) => n(r.Problem) === n(s.Problem) && n(r.Einsatz) === 'sail amsterdam 2030'
      && n(r.Region) === 'amsterdam' && n(r.slug) === '');
    log(`${s.Problem} / Sail Amsterdam 2030: offene Zeile(n) ${open.map((r) => r.row_number).join(', ') || '-'}`);
    if (open.length !== 1) fail(`erwartet genau 1 offene Zeile fuer ${s.Problem} / Sail Amsterdam 2030, gefunden ${open.length}.`);
    sailTargets.push({ row: open[0].row_number, s });
  }

  for (const t of sailTargets) {
    const cols = { deploy: 'x', aktiv: 'x', slug: t.s.slug, pfad: `https://nikos.info/en/lp/${t.s.slug}/`, erstellt_am: "'06.09.2026" };
    log(`Zeile ${t.row}: setze ${JSON.stringify(cols)}`);
    if (LIVE) await sheets.updateRowByRowNumber(TAB, t.row, cols);
  }
  // 3) Fehlende Zeile fuer die veroeffentlichte Seite loesungen/besucherinformation-augsburger-plaerrer-augsburg
  //    (live seit 18.08.2026, Geschwister-Zeilen Relevanz 9) -- Nutzer-Auftrag 2026-09-23.
  const AUG_SLUG = 'besucherinformation-augsburger-plaerrer-augsburg';
  const augCols = {
    erstellen: 'x', deploy: 'x', aktiv: 'x', Relevanz: 9,
    Problem: 'Besucherinformation', Einsatz: 'Augsburger Plärrer', Region: 'Augsburg',
    erstellt_am: "'18.08.2026", slug: AUG_SLUG, pfad: `https://nikos.info/loesungen/${AUG_SLUG}/`,
  };
  const augBySlug = rows.filter((r) => n(r.slug) === AUG_SLUG);
  const augOpen = rows.filter((r) => n(r.Problem) === 'besucherinformation' && n(r.Einsatz) === 'augsburger plärrer'
    && n(r.Region) === 'augsburg' && n(r.slug) === '');
  if (augBySlug.length) {
    log(`Augsburg: Zeile mit slug existiert bereits (${augBySlug.map((r) => r.row_number).join(', ')}) -- nichts zu tun.`);
  } else if (augOpen.length === 1) {
    log(`Augsburg: offene Zeile ${augOpen[0].row_number} wird als veroeffentlicht markiert: ${JSON.stringify(augCols)}`);
    if (LIVE) await sheets.updateRowByRowNumber(TAB, augOpen[0].row_number, augCols);
  } else if (augOpen.length === 0) {
    log(`Augsburg: neue Zeile wird angehaengt: ${JSON.stringify(augCols)}`);
    if (LIVE) await sheets.appendRow(TAB, augCols);
  } else {
    fail(`Augsburg: ${augOpen.length} offene Zeilen -- unklar.`);
  }

  if (dupes.length) {
    log(`Loesche Sindelfingen-Kopien in Zeilen ${dupes.map((r) => r.row_number).join(', ')}`);
    if (LIVE) await sheets.deleteRowsByRowNumbers(TAB, dupes.map((r) => r.row_number));
  } else {
    log('Sindelfingen-Kopien: bereits entfernt -- uebersprungen.');
  }

  if (LIVE) {
    const after = (await sheets.readSheetAsItems(TAB)).map((i) => i.json);
    const d = after.filter((r) => n(r.slug) === SINDEL_SLUG).length;
    const s = SAIL.map((x) => after.filter((r) => n(r.slug) === x.slug).length);
    const a = after.filter((r) => n(r.slug) === AUG_SLUG).length;
    log(`Kontrolle: Sindelfingen-Kopien=${d} (soll 0), Sail-Zeilen=${s.join('/')} (soll 1/1), Augsburg=${a} (soll 1)`);
    if (d !== 0 || s.some((c) => c !== 1) || a !== 1) fail('Kontrolle fehlgeschlagen.');
  }
  log('FERTIG.');
})().catch((e) => fail(e.stack || e.message));
