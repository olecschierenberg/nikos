#!/usr/bin/env node
'use strict';
/**
 * Offline-Trockentest der reinen JS-Pipeline-Logik (Filter/Ranking,
 * HTML-Bau, Feinschliff, SEO-Gate) mit synthetischen Daten — OHNE echte
 * Google-Sheets-, OpenAI- oder GitHub-Aufrufe. Prüft, dass der 1:1 aus
 * n8n übernommene Code im neuen Shim korrekt läuft, bevor überhaupt
 * Secrets/Kosten im Spiel sind.
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

  // ---- Synthetische Warteschlange (entspricht Google-Sheet-Zeilen) ----
  const warteschlangeItems = [
    { json: { row_number: 2, erstellen: 'x', slug: '', Problem: 'Besucherlenkung', Einsatz: 'Stadtfest', Region: 'Musterstadt', Relevanz: '' } },
    { json: { row_number: 3, erstellen: '', slug: '', Problem: 'Perimeterschutz', Einsatz: 'Baustelle', Region: 'Musterstadt', Relevanz: '' } },
  ];
  const stadtFaktenItems = [
    { json: { Region: 'Musterstadt', Einwohner: '120000', Regionstyp: 'Stadt', OpenAir_Gelaende: 'ja', Grossbaustellen: 'ja', Festivalort: 'nein', Karnevalshochburg: 'nein' } },
  ];
  nodeOutputs.set('Stadt-Fakten lesen', stadtFaktenItems);

  const vorabResult = runAllItems('vorab_begrenzung.js', { items: warteschlangeItems, nodeOutputs, staticData, executionId });
  assert.strictEqual(vorabResult.length, 1, 'Vorab-Begrenzung sollte genau 1 Kandidat (erstellen=x) durchlassen');
  log(`Vorab-Begrenzung: ${vorabResult.length} Kandidat(en) OK`);

  const filterResult = runAllItems('filter_relevanz.js', { items: vorabResult, nodeOutputs, staticData, executionId });
  assert.ok(filterResult.length >= 1, 'Filter + Relevanz-Ranking sollte den Stadtfest-Kandidaten durchlassen');
  nodeOutputs.set('Filter + Relevanz-Ranking', filterResult);
  log(`Filter + Relevanz-Ranking: ${filterResult.length} Treffer, Relevanz=${filterResult[0].json._relevanz}, Sprache=${filterResult[0].json._lang_mode}`);

  const limited = runAllItems('limit.js', { items: filterResult, nodeOutputs, staticData, executionId });
  const filterItem = limited[0];
  assert.strictEqual(filterItem.json.Region, 'Musterstadt');

  const lockedItem = runEachItem('run_lock.js', { item: filterItem, nodeOutputs, staticData, executionId });
  assert.ok(lockedItem.json._lp_job_key, 'Run Lock sollte einen _lp_job_key erzeugen');
  log('Run Lock & Payload Budget: OK');

  // ---- Synthetische Textbausteine (minimal, aber mit den von kontext_trimmen erwarteten Abschnitten) ----
  const textbausteineContent = [
    '# LANDINGPAGES_Textbausteine (Test-Fixture)',
    '## Freigegebene Bausteine',
    'NIKOS ist ein modulares, autarkes Kommunikations- und Sicherheitssystem.',
    '## Terminologie & Wording-Regeln',
    'NIKOS [audio]² immer mit hochgestelltem Zweier.',
    '## Verbotene Formulierungen / Regeln',
    'Keine Weichmacher.',
    '## Modulschreibweise',
    'NIKOS [audio]², NIKOS [dispatcher]²',
    '## Modul-Funktionsdetails',
    'NIKOS [audio]²: Durchsagen, Akku bis 16h.',
    '## FAQ-Prioritäten',
    'faq1 = Normkonformität (DIN EN 50849).',
    '## Pain Points je Einsatzart',
    '- **Stadtfest:** Lärm, Sicherheit, Nachtruhe.',
  ].join('\n');
  nodeOutputs.set('Textbausteine laden', [{ json: { data: textbausteineContent } }]);

  const kontextResult = runAllItems('kontext_trimmen.js', { items: [lockedItem], nodeOutputs, staticData, executionId });
  nodeOutputs.set('Kontext trimmen', kontextResult);
  assert.ok(kontextResult[0].json.data.length > 0, 'Kontext trimmen sollte nicht-leeren Text liefern');
  log(`Kontext trimmen: ${kontextResult[0].json._context_chars} Zeichen`);

  // ---- Fake-AI-Antwort simulieren (ersetzt echten OpenAI-Call) ----
  const fakeAiJson = {
    headline_de: 'Besucherlenkung für das Stadtfest in Musterstadt: Sofortige Durchsagen bei Engpässen',
    headline_en: '', subhead_de: 'Besucher sicher lenken – per Knopfdruck', subhead_en: '',
    intro_de: 'Beim Stadtfest in Musterstadt sorgt NIKOS für gezielte Besucherlenkung auch bei Stromausfall. NIKOS ist ein modulares, autarkes System.',
    intro_en: '', usp_de: 'Gezielte Durchsagen ersetzen zusätzliches Personal an neuralgischen Punkten.', usp_en: '',
    faq1_q_de: 'Ist NIKOS normkonform?', faq1_a_de: 'NIKOS ist technisch nach DIN EN 50849 ausgelegt.', faq1_q_en: '', faq1_a_en: '',
    faq2_q_de: 'Wie unabhängig ist NIKOS?', faq2_a_de: 'NIKOS funkt autark, NIKOS [audio]² hat bis zu 16 h Akkulaufzeit.', faq2_q_en: '', faq2_a_en: '',
    faq3_q_de: 'Wie schnell ist NIKOS einsatzbereit?', faq3_a_de: 'Ohne feste Infrastruktur, flexibel installierbar.', faq3_q_en: '', faq3_a_en: '',
    faq4_q_de: 'Was passiert bei Netzausfall?', faq4_a_de: 'NIKOS funkt unabhängig vom öffentlichen Netz weiter.', faq4_q_en: '', faq4_a_en: '',
    slug_kw: '',
  };
  nodeOutputs.set('AI Texte (DE+EN)', [{ json: { text: '```json\n' + JSON.stringify(fakeAiJson) + '\n```' } }]);

  const texteJsonResult = runAllItems('texte_json.js', { items: [nodeOutputs.get('AI Texte (DE+EN)')[0]], nodeOutputs, staticData, executionId });
  nodeOutputs.set('Texte JSON', texteJsonResult);
  const texteOk = JSON.stringify(texteJsonResult[0].json.output || texteJsonResult[0].json).includes('headline_de');
  assert.ok(texteOk, '"Texte ok?"-Gate sollte mit der Fake-Antwort erfüllt sein');
  log('Texte JSON + "Texte ok?"-Gate: OK');

  // QA-Agent simulieren: keine Mängel
  nodeOutputs.set('QA-Agent', [{ json: { text: JSON.stringify(Object.assign({}, fakeAiJson, { _maengel: [] })) } }]);
  const qaJsonResult = runAllItems('qa_json.js', { items: [nodeOutputs.get('QA-Agent')[0]], nodeOutputs, staticData, executionId });
  nodeOutputs.set('QA JSON', qaJsonResult);
  const maengel = (qaJsonResult[0].json.output && qaJsonResult[0].json.output._maengel) || [];
  assert.strictEqual(maengel.length, 0, 'Fake-QA-Antwort sollte keine Mängel enthalten');
  log('QA JSON + "Nachbessern?"-Gate: OK (keine Mängel, Nachbesserungs-Zweig wird in diesem Trockentest nicht durchlaufen)');

  const htmlBauenResult = runAllItems('html_bauen.js', { items: [qaJsonResult[0]], nodeOutputs, staticData, executionId });
  nodeOutputs.set('HTML bauen', htmlBauenResult);
  const slug = htmlBauenResult[0].json.slug;
  assert.ok(slug && slug.length > 0, 'HTML bauen sollte einen Slug erzeugen');
  assert.ok(htmlBauenResult[0].json.html.includes('<title>'), 'HTML bauen sollte ein <title> enthalten');
  log(`HTML bauen: slug="${slug}"`);

  const feinschliffResult = runEachItem('feinschliff.js', { item: htmlBauenResult[0], nodeOutputs, staticData, executionId });
  nodeOutputs.set('Feinschliff', [feinschliffResult]);
  assert.ok(feinschliffResult.json.previewB64, 'Feinschliff sollte previewB64 erzeugen');
  log('Feinschliff: OK (previewB64/liveB64 erzeugt)');

  const seoResult = runEachItem('seo_gate.js', { item: feinschliffResult, nodeOutputs, staticData, executionId });
  assert.ok(seoResult.json.seo_gate === 'pass' || seoResult.json.seo_gate === 'warning', 'SEO-Gate sollte pass/warning liefern, nicht blockieren');
  log(`SEO-Gate: ${seoResult.json.seo_gate}${seoResult.json.seo_warnings.length ? ' (' + seoResult.json.seo_warnings.join(', ') + ')' : ''}`);

  runEachItem('lock_freigeben.js', { item: { json: { error: false } }, nodeOutputs, staticData, executionId });

  console.log('\n[dry-run] ALLE PRÜFUNGEN BESTANDEN — die portierte JS-Logik läuft fehlerfrei durch die komplette Kette:');
  console.log('[dry-run] Warteschlange -> Vorab-Begrenzung -> Filter+Relevanz -> Limit -> Run Lock -> Kontext trimmen');
  console.log('[dry-run] -> (Fake-)AI-Texte -> Texte-ok? -> (Fake-)QA -> Nachbessern? -> HTML bauen -> Feinschliff -> SEO-Gate.');
  console.log(`[dry-run] Erzeugter Test-Slug: ${slug}`);
}

main().catch((err) => {
  console.error('[dry-run] FEHLGESCHLAGEN:', err);
  process.exitCode = 1;
});
