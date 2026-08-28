#!/usr/bin/env node
'use strict';
/**
 * Offline-Trockentest der reinen JS-Pipeline-Logik (Limit/Dedup, Vorschau-
 * Gültigkeitsprüfung, noindex-Entfernung + Linktext-Extraktion, Hub-Merge,
 * Ablauf-Prüfung) mit synthetischen Daten — OHNE echte Google-Sheets-,
 * Dateisystem- oder IndexNow-Aufrufe.
 *
 * Aufruf: npm run dry-run   (bzw. node test/dry-run.js)
 */

const assert = require('assert');
const { runAllItems, runEachItem } = require('../lib/runCodeNode');

function log(msg) { console.log(`[dry-run] ${msg}`); }

async function main() {
  const nodeOutputs = new Map();
  const staticData = {};
  const executionId = 'dry-run';

  // ---- Limit (max 5/Batch, Dedup nach slug) ----
  const kandidaten = [
    { json: { row_number: 2, slug: 'a-slug' } },
    { json: { row_number: 3, slug: 'a-slug' } }, // Duplikat -> muss verworfen werden
    { json: { row_number: 4, slug: 'b-slug' } },
    { json: { row_number: 5, slug: 'c-slug' } },
    { json: { row_number: 6, slug: 'd-slug' } },
    { json: { row_number: 7, slug: 'e-slug' } },
    { json: { row_number: 8, slug: 'f-slug' } }, // 6. eindeutiger Slug -> muss über dem Limit rausfallen
  ];
  const limited = runAllItems('limit.js', { items: kandidaten, nodeOutputs, staticData, executionId });
  assert.strictEqual(limited.length, 5, 'Limit sollte auf 5 eindeutige Slugs begrenzen');
  assert.ok(!limited.some((it, i) => limited.findIndex((o) => o.json.slug === it.json.slug) !== i), 'Keine doppelten Slugs im Ergebnis');
  log(`Limit: ${limited.length} von ${kandidaten.length} durchgelassen (Dedup + Cap korrekt).`);

  // ---- Vorschau gültig? ----
  const validPreview = { json: { row_number: 2, slug: 'gueltig', previewHtml: '<html><head></head><body>' + 'x'.repeat(300) + '</body></html>' } };
  const emptyPreview = { json: { row_number: 3, slug: 'leer', previewHtml: '' } };
  const brokenPreview = { json: { row_number: 4, slug: 'kaputt', previewHtml: '<html>zu kurz</html>' } };
  const gueltigResult = runAllItems('vorschau_gueltig.js', { items: [validPreview, emptyPreview, brokenPreview], nodeOutputs, staticData, executionId });
  assert.strictEqual(gueltigResult.length, 1, 'Nur die plausible Vorschau sollte durchgelassen werden');
  assert.strictEqual(gueltigResult[0].json.slug, 'gueltig');
  log(`Vorschau gültig?: ${gueltigResult.length}/3 durchgelassen (leere/kaputte Vorschauen korrekt aussortiert).`);

  // ---- noindex entfernen + Linktext-Extraktion ----
  const previewHtml = [
    '<!DOCTYPE html><html data-lang="de"><head>',
    '<meta name="robots" content="noindex,nofollow">',
    '</head><body>',
    '<h1>Besucherlenkung beim Stadtfest in Musterstadt</h1>',
    '<h2 class="heading-l" style="margin-top:12px;" data-de>Schnelle Durchsagen bei Engpässen</h2>',
    '</body></html>',
  ].join('\n');
  const entfernt = runEachItem('noindex_entfernen.js', {
    item: { json: { row_number: 2, slug: 'besucherlenkung-stadtfest-musterstadt', previewHtml } },
    nodeOutputs, staticData, executionId,
  }).json;
  assert.ok(!entfernt.liveHtml.includes('noindex'), 'noindex-Meta-Zeile sollte entfernt sein');
  assert.strictEqual(entfernt.liveUrl, 'https://nikos.info/loesungen/besucherlenkung-stadtfest-musterstadt/index.html');
  assert.strictEqual(entfernt.linkTitle, 'Besucherlenkung beim Stadtfest in Musterstadt: Schnelle Durchsagen bei Engpässen');
  log(`noindex entfernen: OK (linkTitle="${entfernt.linkTitle}")`);

  // ---- Hub mergen ----
  const hubHtml = '<html><body><ul class="loesungen-list">\n      <li><a href="https://nikos.info/loesungen/bestehend/">Bestehend</a></li>\n    </ul></body></html>';
  const hubResult = runAllItems('hub_mergen.js', {
    items: [{ json: { entries: [{ slug: entfernt.slug, title: entfernt.linkTitle }, { slug: 'bestehend', title: 'Dublette, sollte nicht doppelt eingefügt werden' }], hubHtml } }],
    nodeOutputs, staticData, executionId,
  })[0].json;
  assert.strictEqual(hubResult.changed, true);
  assert.strictEqual(hubResult.added, 1, 'Nur der neue Slug sollte eingefügt werden, die Dublette nicht erneut');
  assert.ok(hubResult.newHtml.includes(entfernt.slug), 'Neuer Slug sollte im Hub-HTML stehen');
  log(`Hub mergen: ${hubResult.added} neue Verlinkung eingefügt, Dubletten-Schutz OK.`);

  // ---- Ablauf prüfen ----
  const now = new Date();
  const vergangenerMonat = `${String(((now.getMonth() + 11) % 12) + 1).padStart(2, '0')}.${now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()}`;
  const zukuenftigerMonat = `${String(((now.getMonth() + 1) % 12) + 1).padStart(2, '0')}.${now.getFullYear() + 1}`;
  const ablaufKandidaten = [
    { json: { row_number: 2, Problem: 'Notfalldurchsage', Einsatz: 'Stadtfest XY', Region: 'Musterstadt', Ende: vergangenerMonat, aktiv: '' } }, // abgelaufen -> markieren
    { json: { row_number: 3, Problem: 'Besucherlenkung', Einsatz: 'Oktoberfest', Region: 'München', Ende: vergangenerMonat, aktiv: '' } }, // Referenzschutz -> NICHT markieren
    { json: { row_number: 4, Problem: 'Perimeterschutz', Einsatz: 'Baustelle', Region: 'Musterstadt', Ende: zukuenftigerMonat, aktiv: '' } }, // noch nicht abgelaufen
    { json: { row_number: 5, Problem: 'Crowd Management', Einsatz: 'Weihnachtsmarkt', Region: 'Beispielhausen', Ende: '', aktiv: '' } }, // kein Ende -> Dauerfall
  ];
  const abgelaufen = runAllItems('ablauf_pruefen.js', { items: ablaufKandidaten, nodeOutputs, staticData, executionId });
  assert.strictEqual(abgelaufen.length, 1, 'Genau 1 Zeile sollte als abgelaufen markiert werden');
  assert.strictEqual(abgelaufen[0].json.row_number, 2);
  assert.strictEqual(abgelaufen[0].json.aktiv, 'abgelaufen');
  log(`Ablauf prüfen: ${abgelaufen.length} Zeile(n) markiert (Referenzschutz + Dauerfall korrekt übersprungen).`);

  console.log('\n[dry-run] ALLE PRÜFUNGEN BESTANDEN — die portierte JS-Logik (Limit, Vorschau-Guard, noindex-Entfernung, Hub-Merge, Ablauf-Check) läuft fehlerfrei.');
}

main().catch((err) => {
  console.error('[dry-run] FEHLGESCHLAGEN:', err);
  process.exitCode = 1;
});
