#!/usr/bin/env node
'use strict';
/**
 * NIKOS Einmal-Reparaturskript (2026-09-08): behebt die 3 Sheet-Zeilen, die durch
 * den Publish-Bug (siehe audit-multilang-published.js) permanent auf aktiv=x
 * haengengeblieben sind, obwohl die Seite nie tatsaechlich live gegangen ist.
 * filterDeployReady() in lp-publish/index.js prueft nur deploy==='x' && aktiv==='' &&
 * slug!=='' -- eine Zeile mit aktiv=x wird NIE erneut versucht, auch wenn sie in
 * Wirklichkeit 404 ist. Der zugrunde liegende Bug (gitignore-Regel "lp/" +
 * fehlendes git-add in lp-publish.yml) ist bereits gefixt und live (Commit 8689568).
 *
 * Zwei verschiedene Reparaturen, je nachdem ob die lp-preview/<slug>/-Vorschau noch
 * existiert:
 *
 * PARTIAL (Vorschau existiert noch, per `ls lp-preview/` am 2026-09-08 verifiziert):
 *   - crowd-management-gentse-feesten
 *   - besucherlenkung-sail-amsterdam-2030
 *   Nur aktiv+pfad leeren. slug/erstellt_am/deploy bleiben stehen, damit
 *   filterDeployReady() die Zeile beim naechsten lp-publish-Lauf wieder aufgreift
 *   und aus der bereits vorhandenen Vorschau heraus (ohne Neu-Generierung) korrekt
 *   committet.
 *
 * FULL (Vorschau fehlt, wurde vom fehlerhaften Lauf geloescht, bevor die Live-Datei
 *   je committet wurde -- echter Datenverlust):
 *   - besuchersicherheit-gentse-feesten
 *   erstellt_am/slug/pfad/aktiv leeren, wie beim urspruenglichen Schritt-4-Reset
 *   (reset-legacy-foreign-rows.js) -- lp-generator erzeugt die Seite dann komplett neu.
 *
 * Aufruf: node fix-stuck-multilang-rows.js         (Dry-Run, schreibt nichts)
 *         node fix-stuck-multilang-rows.js --live  (schreibt wirklich)
 */

const sheets = require('../lib/sheets.js');

const LIVE = process.argv.includes('--live');

const PARTIAL_RESET_SLUGS = new Set([
  'crowd-management-gentse-feesten',
  'besucherlenkung-sail-amsterdam-2030',
]);

const FULL_RESET_SLUGS = new Set([
  'besuchersicherheit-gentse-feesten',
]);

const ALL_TARGET_SLUGS = new Set([...PARTIAL_RESET_SLUGS, ...FULL_RESET_SLUGS]);

// Sicherheitsnetz: nur anfassen, wenn die Zeile aktuell wirklich wie "haengengeblieben"
// aussieht (aktiv=x, pfad im neuen Schema) -- falls sich der Zustand seit der Diagnose
// (2026-09-08) schon von selbst geaendert hat (z.B. durch einen zwischenzeitlichen
// lp-publish-Lauf), NICHT anfassen.
function looksNewScheme(pfad) {
  return /\/[a-z]{2}\/lp\//i.test(String(pfad || ''));
}

async function main() {
  console.log(`Modus: ${LIVE ? 'LIVE (schreibt wirklich)' : 'DRY-RUN (schreibt NICHTS, nur Vorschau)'}`);
  const rows = await sheets.readSheetAsItems('Keywordkombinationen');
  console.log(`Gelesen: ${rows.length} Zeile(n) aus Tab "Keywordkombinationen".\n`);

  const found = new Set();
  let fixedCount = 0;
  const skipped = [];

  for (const row of rows) {
    const slug = String(row.json.slug || '').trim();
    if (!slug || !ALL_TARGET_SLUGS.has(slug)) continue;
    found.add(slug);

    const j = row.json;
    const isPartial = PARTIAL_RESET_SLUGS.has(slug);
    const kind = isPartial ? 'PARTIAL (aktiv+pfad leeren)' : 'FULL (erstellt_am+slug+pfad+aktiv leeren)';

    if (j.aktiv !== 'x' || !looksNewScheme(j.pfad)) {
      skipped.push({ slug, row_number: j.row_number, aktiv: j.aktiv, pfad: j.pfad });
      console.log(`[UEBERSPRUNGEN, Zustand hat sich geaendert] Zeile ${j.row_number} slug="${slug}" aktiv="${j.aktiv}" pfad="${j.pfad}" -- sieht nicht mehr wie "haengengeblieben" aus, nicht angefasst.`);
      continue;
    }

    console.log(`[${LIVE ? 'REPARIEREN' : 'WUERDE REPARIEREN'}] Zeile ${j.row_number} (${kind})`);
    console.log(`    bisher: erstellt_am="${j.erstellt_am || ''}", slug="${slug}", pfad="${j.pfad}", aktiv="${j.aktiv}"`);

    const patch = isPartial
      ? { aktiv: '', pfad: '' }
      : { erstellt_am: '', slug: '', pfad: '', aktiv: '' };

    if (LIVE) {
      await sheets.updateRowByRowNumber('Keywordkombinationen', j.row_number, patch);
    }
    fixedCount++;
  }

  const notFound = [...ALL_TARGET_SLUGS].filter((s) => !found.has(s));

  console.log('\n---- Zusammenfassung ----');
  console.log(`${fixedCount} Zeile(n) ${LIVE ? 'repariert' : 'wuerden repariert'}.`);
  console.log(`${skipped.length} Zeile(n) uebersprungen (Zustand nicht mehr wie erwartet).`);
  if (notFound.length) {
    console.log(`ACHTUNG -- ${notFound.length} erwartete(r) Slug(s) NICHT im Sheet gefunden:`);
    for (const s of notFound) console.log(`    - ${s}`);
  } else {
    console.log('Alle erwarteten Slugs wurden im Sheet gefunden.');
  }

  if (!LIVE) {
    console.log('\nDies war ein DRY-RUN. Zum wirklichen Reparieren erneut mit --live aufrufen.');
  }
}

main().catch((err) => {
  console.error('FEHLER:', err);
  process.exit(1);
});
