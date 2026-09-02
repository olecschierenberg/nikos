#!/usr/bin/env node
'use strict';
/**
 * NIKOS Landingpage-Veröffentlichung — GitHub-Actions-Portierung des
 * n8n-Workflows "Landingpages veröffentlichen" (Workflow-ID
 * VJaUw0kTrsO17iHX, aktiv, Webhook on-demand + monatlicher Ablauf-Check).
 * Dieses Skript deckt den Live-Deploy-Zweig ab; der monatliche
 * Ablauf-Check steht separat in ablauf.js (siehe README).
 *
 * Ablauf (1:1 aus dem n8n-Workflow, Live-Deploy-Zweig):
 *   Keywordkombinationen lesen -> Filter (deploy=x & aktiv leer & slug da)
 *   -> Limit (5/Batch) -> je Zeile: Vorschau lesen -> Vorschau gültig? ->
 *   noindex entfernen -> live schreiben -> Vorschau löschen -> Sheet
 *   aktiv=x -> je Batch: Lösungen-Hub aktualisieren + IndexNow pingen ->
 *   nächster Batch, bis nichts mehr offen ist (Ersatz für den n8n-
 *   Selbst-Retrigger, siehe README "Self-Retrigger -> while-Schleife").
 *
 * BEWUSST WEGGELASSEN: die Sitemap-Nodes des n8n-Workflows — die
 * bestehende GitHub Action refresh-sitemap.yml aktualisiert sitemap.xml
 * bei jedem Push ohnehin automatisch (siehe Migrationsplan Teil 2,
 * Abschnitt 4.2). Ein zweiter, redundanter Sitemap-Schreibvorgang hier
 * würde nur unnötig Commits erzeugen.
 *
 * Details/Migrationsplan: /nikos/Migrationsplan_Keywordkombis-und-
 * Veroeffentlichung_ohne-n8n_2026-08-28.md
 *
 * SICHERHEITSDESIGN (siehe README.md):
 *  - Standardmäßig TEST-MODUS: liest die echte Vorschau (lp-preview/<slug>),
 *    schreibt das Ergebnis aber NUR nach loesungen/_ghtest-<slug>/,
 *    NIEMALS in den produktiven loesungen/<slug>/-Pfad, löscht NICHT die
 *    echte Vorschau, schreibt NICHT ins Sheet, aktualisiert NICHT den
 *    Lösungen-Hub, pingt NICHT IndexNow.
 *  - Erst mit --live (nach nachgewiesener Gleichwertigkeit) verhält sich
 *    der Lauf wie der n8n-Workflow: promotet echt, löscht die Vorschau,
 *    aktualisiert Sheet/Hub, pingt IndexNow.
 */

const fs = require('fs');
const path = require('path');

const { runAllItems, runEachItem } = require('./lib/runCodeNode');
const sheets = require('./lib/sheets');
const { extractCategory, extractTitle } = require('./lib/relatedLinksUtil');

const REPO_ROOT = path.join(__dirname, '..', '..'); // .../site
const LIVE = process.argv.includes('--live');
const executionId = process.env.GITHUB_RUN_ID ? `gha-${process.env.GITHUB_RUN_ID}` : `local-${Date.now()}`;
const SHEET_TAB = 'Keywordkombinationen';
const MAX_BATCHES = 20; // Sicherheitsdeckel für die while-Schleife (Ersatz-Retrigger), 20 x 5 = 100 Zeilen/Lauf
const INDEXNOW_KEY = 'dcd30c88402ff1902ab3957179107fec'; // 1:1 aus n8n-Node "IndexNow senden" — öffentlicher Schlüssel (per Design: über .txt-Datei auf der Site verifizierbar, kein Secret)
const INDEXNOW_KEY_LOCATION = `https://nikos.info/${INDEXNOW_KEY}.txt`;

function log(msg) {
  console.log(`[lp-publish] ${msg}`);
}

// Entspricht dem n8n-Filter-Node "Nur deploy=x & aktiv leer".
function filterDeployReady(items) {
  return items.filter((it) => {
    const j = it.json;
    return String(j.deploy || '').trim().toLowerCase() === 'x'
      && String(j.aktiv || '').trim() === ''
      && String(j.slug || '').trim() !== '';
  });
}

async function processBatch(batch, staticData) {
  const nodeOutputs = new Map();
  const liveEntries = []; // { slug, liveUrl, linkTitle } — für Hub + IndexNow dieses Batches

  for (const item of batch) {
    const slug = item.json.slug;
    const previewFile = path.join(REPO_ROOT, 'lp-preview', slug, 'index.html');
    if (!fs.existsSync(previewFile)) {
      log(`  ÜBERSPRUNGEN (${slug}): keine Vorschaudatei lp-preview/${slug}/index.html gefunden.`);
      continue;
    }
    const previewHtml = fs.readFileSync(previewFile, 'utf8');

    // ---- Vorschau gültig? (Guard) ----
    const gueltigResult = runAllItems('vorschau_gueltig.js', {
      items: [{ json: { row_number: item.json.row_number, slug, previewHtml } }],
      nodeOutputs, staticData, executionId,
    });
    if (!gueltigResult.length) {
      log(`  ÜBERSPRUNGEN (${slug}): Vorschau nicht plausibel (leer/kaputt) — entspricht dem n8n-404/Fehler-Fall.`);
      continue;
    }

    // ---- noindex entfernen ----
    const entfernt = runEachItem('noindex_entfernen.js', {
      item: { json: { row_number: item.json.row_number, slug, previewHtml } },
      nodeOutputs, staticData, executionId,
    }).json;

    // ---- Live schreiben ----
    const targetSlugDir = LIVE ? slug : `_ghtest-${slug}`;
    const targetDir = path.join(REPO_ROOT, 'loesungen', targetSlugDir);
    const targetFile = path.join(targetDir, 'index.html');
    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(targetFile, entfernt.liveHtml, 'utf8');
    const readBack = fs.readFileSync(targetFile, 'utf8');
    if (readBack !== entfernt.liveHtml) {
      log(`  ABBRUCH (${slug}): Integritätsprüfung beim Schreiben fehlgeschlagen.`);
      continue;
    }
    log(`  ${LIVE ? 'LIVE' : 'TEST'}: loesungen/${targetSlugDir}/index.html geschrieben (${entfernt.liveHtml.length} Zeichen).`);

    if (LIVE) {
      // ---- Vorschau löschen (nur im --live-Modus — im Test-Modus bleibt die echte Vorschau unangetastet) ----
      fs.rmSync(path.join(REPO_ROOT, 'lp-preview', slug), { recursive: true, force: true });

      // ---- Sheet aktiv=x ----
      await sheets.updateRowByRowNumber(SHEET_TAB, item.json.row_number, {
        aktiv: 'x',
        pfad: `https://nikos.info/loesungen/${slug}/`,
      });
      log(`  Sheet "${SHEET_TAB}" Zeile ${item.json.row_number}: aktiv=x, pfad gesetzt.`);

      liveEntries.push({ slug, liveUrl: entfernt.liveUrl, title: entfernt.linkTitle });
    } else {
      log(`  TEST-Modus: Vorschau NICHT gelöscht, Sheet NICHT aktualisiert.`);
    }
  }

  if (LIVE && liveEntries.length) {
    await updateHub(liveEntries);
    await pingIndexNow(liveEntries);
  }

  return liveEntries;
}

async function updateHub(entries) {
  const hubFile = path.join(REPO_ROOT, 'loesungen', 'index.html');
  if (!fs.existsSync(hubFile)) {
    log('  Lösungen-Hub: loesungen/index.html nicht gefunden — Hub-Update übersprungen.');
    return;
  }
  const hubHtml = fs.readFileSync(hubFile, 'utf8');
  const { runAllItems: run } = require('./lib/runCodeNode');
  const result = run('hub_mergen.js', {
    items: [{ json: { entries, hubHtml } }],
    nodeOutputs: new Map(), staticData: {}, executionId,
  })[0].json;
  if (!result.changed) {
    log(`  Lösungen-Hub: keine Änderung (${result.reason || 'keine neuen Slugs'}).`);
    return;
  }
  fs.writeFileSync(hubFile, result.newHtml, 'utf8');
  log(`  Lösungen-Hub: ${result.added} neue Verlinkung(en) eingefügt.`);
}

async function pingIndexNow(entries) {
  const urls = [...new Set(entries.map((e) => e.liveUrl.replace(/index\.html$/, '')))];
  if (!urls.length) return;
  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host: 'nikos.info', key: INDEXNOW_KEY, keyLocation: INDEXNOW_KEY_LOCATION, urlList: urls }),
    });
    log(`  IndexNow: ${urls.length} URL(s) gemeldet (HTTP ${res.status}).`);
  } catch (err) {
    log(`  IndexNow-Ping fehlgeschlagen (nicht kritisch): ${err.message}`);
  }
}

// NEU (02.09.2026, kein n8n-Vorbild): thematische LP-zu-LP-Verlinkung nach
// Einsatz-Kategorie (siehe lib/nodes/verwandte_verlinken.js fuer Hintergrund
// und Auftrag). Laeuft bei JEDEM Live-Lauf unabhaengig davon, ob in diesem
// Batch neue Seiten dazugekommen sind -- so bleibt die Verlinkung immer
// konsistent mit dem tatsaechlichen aktuellen Bestand, und der einmalige
// Nachtrag fuer die bereits bestehenden Landingpages passiert automatisch
// beim naechsten Lauf (kein separates Backfill-Skript noetig).
async function updateRelatedLinks() {
  const loesungenDir = path.join(REPO_ROOT, 'loesungen');
  let dirs;
  try {
    dirs = fs.readdirSync(loesungenDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('_ghtest-'))
      .map((d) => d.name);
  } catch (err) {
    log(`  Verwandte Verlinkung: loesungen/ nicht lesbar (${err.message}) -- uebersprungen.`);
    return;
  }

  const pages = [];
  const htmlBySlug = new Map();
  for (const slug of dirs) {
    const file = path.join(loesungenDir, slug, 'index.html');
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, 'utf8');
    htmlBySlug.set(slug, html);
    pages.push({ slug, title: extractTitle(html), category: extractCategory(html) });
  }

  const { blocks } = runAllItems('verwandte_verlinken.js', {
    items: [{ json: { pages } }], nodeOutputs: new Map(), staticData: {}, executionId,
  })[0].json;

  let updated = 0;
  let failed = 0;
  for (const slug of dirs) {
    const html = htmlBySlug.get(slug);
    if (html === undefined) continue;
    const blockHtml = blocks[slug] || null;
    const result = runEachItem('verwandte_einfuegen.js', {
      item: { json: { html, blockHtml } }, nodeOutputs: new Map(), staticData: {}, executionId,
    }).json;
    if (!result.changed) continue;
    const file = path.join(loesungenDir, slug, 'index.html');
    fs.writeFileSync(file, result.newHtml, 'utf8');
    const readBack = fs.readFileSync(file, 'utf8');
    if (readBack !== result.newHtml) {
      log(`  WARNUNG: Integritaetspruefung fehlgeschlagen bei loesungen/${slug}/index.html (verwandte Verlinkung) -- Datei ggf. inkonsistent, bitte pruefen.`);
      failed++;
      continue;
    }
    updated++;
  }
  log(`  Verwandte Verlinkung: ${updated} von ${dirs.length} Landingpage(s) aktualisiert${failed ? `, ${failed} Integritaetsfehler` : ''}.`);
}

async function main() {
  log(`Start (${LIVE ? 'LIVE' : 'TEST'}-Modus), executionId=${executionId}`);
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    console.error('[lp-publish] ABBRUCH: GOOGLE_SERVICE_ACCOUNT_JSON fehlt (auch im Test-Modus zum Lesen der Warteschlange nötig, siehe README.md).');
    process.exitCode = 1;
    return;
  }

  const staticData = {};
  const handledSlugs = new Set(); // lokales Dedup — Ersatz/Ergänzung zum n8n-Selbst-Retrigger (siehe README)
  let totalPublished = 0;

  for (let batchNum = 1; batchNum <= MAX_BATCHES; batchNum++) {
    const allItems = await sheets.readSheetAsItems(SHEET_TAB);
    const ready = filterDeployReady(allItems).filter((it) => !handledSlugs.has(it.json.slug));
    if (!ready.length) {
      if (batchNum === 1) log('Keine Zeile mit deploy=x & aktiv leer & slug vorhanden. Nichts zu tun.');
      break;
    }

    const limited = runAllItems('limit.js', { items: ready, nodeOutputs: new Map(), staticData, executionId });
    log(`Batch ${batchNum}: ${limited.length} Kombination(en) ausgewählt (von ${ready.length} offenen).`);
    limited.forEach((it) => handledSlugs.add(it.json.slug));

    const published = await processBatch(limited, staticData);
    totalPublished += published.length;

    if (!LIVE) {
      // Im TEST-Modus ändert sich das Sheet nicht — ohne das lokale Dedup
      // oben würde die nächste Iteration dieselben Zeilen erneut finden.
      // Ein Testlauf verarbeitet bewusst nur einen Batch (mehr bringt im
      // Test-Modus keinen zusätzlichen Erkenntnisgewinn).
      break;
    }
  }

  if (LIVE) {
    await updateRelatedLinks();
  } else {
    log('  TEST-Modus: verwandte Verlinkung uebersprungen (aendert nur echte Live-Dateien).');
  }

  log(`FERTIG (${LIVE ? 'LIVE' : 'TEST'}): ${totalPublished} Landingpage(s) verarbeitet.`);
}

main().catch((err) => {
  console.error('[lp-publish] Lauf abgebrochen:', err.message);
  process.exitCode = process.exitCode || 1;
});
