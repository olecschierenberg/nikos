#!/usr/bin/env node
'use strict';
/**
 * Offline-Trockentest der reinen JS-Pipeline-Logik (Vorrat+Ausschluss
 * aufbereiten, Relevanz berechnen) mit synthetischen Daten — OHNE echte
 * Google-Sheets-, OpenAI- oder Brevo-Aufrufe.
 *
 * Aufruf: npm run dry-run   (bzw. node test/dry-run.js)
 */

const assert = require('assert');
const { runAllItems } = require('../lib/runCodeNode');

function log(msg) { console.log(`[dry-run] ${msg}`); }

async function main() {
  const nodeOutputs = new Map();
  const staticData = {};
  const executionId = 'dry-run';

  // ---- Synthetischer Keywordpool, vorhandene Kombis, Stadt-Fakten ----
  const keywordpoolItems = [
    { json: { row_number: 2, Problem: 'Besucherlenkung', Einsatz: 'Stadtfest', Region: 'Musterstadt' } },
    { json: { row_number: 3, Problem: 'Perimeterschutz', Einsatz: 'Baustelle', Region: 'Musterstadt' } },
    { json: { row_number: 4, Problem: 'Notfalldurchsage', Einsatz: 'Weihnachtsmarkt', Region: 'Beispielhausen' } },
  ];
  const vorhandeneKombisItems = [
    { json: { row_number: 2, Problem: 'Besucherlenkung', Einsatz: 'Stadtfest', Region: 'Altstadt', erstellen: 'x', slug: 'besucherlenkung-stadtfest-altstadt', Relevanz: '9' } },
    { json: { row_number: 3, Problem: 'Perimeterschutz', Einsatz: 'Messe', Region: 'Nirgendwo', erstellen: '-', slug: '', Relevanz: '2' } },
  ];
  const stadtFaktenItems = [
    { json: { Region: 'Musterstadt', Einwohner: '120000', Regionstyp: 'Stadt', Aktuell: 'Stadtfest Musterstadt', Zeitraum: '05.2027' } },
    { json: { Region: 'Beispielhausen', Einwohner: '30000', Regionstyp: 'Stadt', Aktuell: '', Zeitraum: '' } },
  ];
  nodeOutputs.set('Keywordpool lesen', keywordpoolItems);
  nodeOutputs.set('Vorhandene Kombis lesen', vorhandeneKombisItems);
  nodeOutputs.set('Stadt-Fakten lesen A', stadtFaktenItems);

  // ---- Vorrat + Ausschluss aufbereiten ----
  const vorratResult = runAllItems('vorrat_ausschluss.js', { items: keywordpoolItems, nodeOutputs, staticData, executionId });
  const vorrat = vorratResult[0].json;
  assert.ok(vorrat.probleme.includes('Besucherlenkung'), 'Vorrat sollte "Besucherlenkung" aus dem Pool enthalten');
  assert.ok(vorrat.exclude.length >= 2, 'Exclude-Set sollte aus vorhandenen Kombis gebildet werden');
  assert.ok(vorrat.topkombis.length >= 1, 'Top-Kombis (Relevanz>=8) sollten die Altstadt-Kombi enthalten');
  assert.ok(vorrat.aktuelleEvents.length >= 1, 'Aktuelle Events aus Stadt-Fakten sollten übernommen werden');
  log(`Vorrat + Ausschluss: ${vorrat.probleme.length} Probleme, exclude=${vorrat.exclude.length}, topkombis=${vorrat.topkombis.length}, aktuelleEvents=${vorrat.aktuelleEvents.length}, zielanzahl=${vorrat.zielanzahl}`);

  // ---- Fake-KI-Antwort simulieren (ersetzt echten OpenAI-Call) ----
  const fakeKombinationen = [
    { Problem: 'Besucherlenkung', Einsatz: 'Stadtfest', Region: 'Musterstadt' }, // neu, nicht in exclude
    { Problem: 'Perimeterschutz', Einsatz: 'Messe', Region: 'Nirgendwo' },       // Duplikat von exclude -> muss gefiltert werden
    { Problem: 'Notfalldurchsage', Einsatz: 'Weihnachtsmarkt', Region: 'Beispielhausen' },
    { Problem: 'Besucherlenkung', Einsatz: 'Stadionevent', Region: 'Musterstadt' }, // verbotener Einsatz -> muss gefiltert werden
  ];
  const zeilenItems = fakeKombinationen.map((k) => ({ json: k }));
  nodeOutputs.set('In Zeilen aufteilen', zeilenItems);

  // ---- Relevanz berechnen (Dedup + Unmöglich-Filter + Scoring) ----
  const relevanzResult = runAllItems('relevanz_berechnen.js', { items: zeilenItems, nodeOutputs, staticData, executionId });
  assert.ok(relevanzResult.length >= 2, 'Nach Filterung sollten mindestens 2 gültige Kombinationen übrig bleiben');
  assert.ok(!relevanzResult.some((it) => it.json.Einsatz === 'Messe' && it.json.Region === 'Nirgendwo'), 'Dedup gegen Bestand sollte die Messe/Nirgendwo-Kombi entfernen');
  assert.ok(!relevanzResult.some((it) => /stadion/i.test(it.json.Einsatz)), 'Verbotener Einsatz "Stadionevent" sollte gefiltert werden');
  for (const it of relevanzResult) {
    assert.ok(Number.isFinite(it.json.Relevanz) || typeof it.json.Relevanz === 'number', `Relevanz sollte eine Zahl sein für ${JSON.stringify(it.json)}`);
  }
  log(`Relevanz berechnen: ${relevanzResult.length} von ${zeilenItems.length} Vorschlägen übrig (Dedup/Filter korrekt angewendet)`);
  for (const it of relevanzResult) {
    log(`  - ${it.json.Problem} | ${it.json.Einsatz} | ${it.json.Region} (Relevanz ${it.json.Relevanz}${it.json.Ende ? ', Ende ' + it.json.Ende : ''})`);
  }

  console.log('\n[dry-run] ALLE PRÜFUNGEN BESTANDEN — die portierte JS-Logik (Vorrat+Ausschluss, Relevanz/Dedup/Filter) läuft fehlerfrei.');
}

main().catch((err) => {
  console.error('[dry-run] FEHLGESCHLAGEN:', err);
  process.exitCode = 1;
});
