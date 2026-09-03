'use strict';
// NEU (2026-09-03): Analog zu run_compare.js, aber fuer die einmalige
// Terra-Uebersetzung des FIXEN FAQ1-Normkonformitaets-Textbausteins
// (kanonischer Text aus LANDINGPAGES_Textbausteine.md, siehe
// source_de_faq1.json). Schreibt NACH out/results_faq1.json (separate
// Datei), damit die bestehende out/results.json (Terra-vs-Luna-Vergleich)
// unangetastet bleibt. KEIN API-Key im Output, KEIN API-Key im Log.
const fs = require('fs');
const path = require('path');
require('./lib/proxy_fetch_shim'); // muss vor lib/openai.js geladen werden
const { chatCompletion } = require('./lib/openai');
const { renderExpr } = require('./lib/expr');
const { runAllItems } = require('./lib/runCodeNode');
const LANG_META = require('./lib/lang_meta');

const APIKEY = process.env.OPENAI_API_KEY;
if (!APIKEY) { console.error('OPENAI_API_KEY fehlt'); process.exit(1); }

const src = JSON.parse(fs.readFileSync(path.join(__dirname, 'source_de_faq1.json'), 'utf8'));
const TARGET_LANGS = process.env.TEST_LANGS ? process.env.TEST_LANGS.split(',') : ['en', 'fr', 'it', 'es', 'nl', 'da', 'pl'];
const MODELS = process.env.TEST_MODELS ? process.env.TEST_MODELS.split(',') : ['gpt-5.6-terra'];

function readPrompt(name) {
  return fs.readFileSync(path.join(__dirname, 'lib', 'prompts', name), 'utf8');
}

async function callTranslation({ lang, model, deFields, problem, einsatz, region, nodeOutputs, staticData, executionId }) {
  const lm = LANG_META[lang] || { label: lang };
  const userPrompt = renderExpr(readPrompt('uebersetzung.user.txt'), {
    $json: {
      zielsprache_label: lm.label, zielsprache_code: lang,
      problem, einsatz, region_oder_ueberregional: region || 'ueberregional/kein fester Ort',
      quelltext_json: JSON.stringify(deFields),
    },
    $now: new Date(),
  });
  const t0 = Date.now();
  const result = await chatCompletion({
    apiKey: APIKEY, model,
    system: readPrompt('uebersetzung.system.txt'), user: userPrompt,
    maxTokens: 1800, timeoutMs: 180000, maxRetries: 1,
  });
  const elapsedMs = Date.now() - t0;
  const parsed = runAllItems('uebersetzung_json.js', { items: [result], nodeOutputs, staticData, executionId })[0].json.output;
  const check = runAllItems('mini_check.js', {
    items: [{ json: { translated: parsed, source: deFields, lang } }], nodeOutputs, staticData, executionId,
  })[0].json;
  return { parsed, check, elapsedMs, usage: result.json.usage || null };
}

async function main() {
  const nodeOutputs = new Map();
  const staticData = {};
  const executionId = 'faq1-textbaustein-' + Date.now();
  const outFile = path.join(__dirname, 'out', 'results_faq1.json');
  let out = { source: src, models: [], langs: [], results: {} };
  if (fs.existsSync(outFile)) {
    try { out = JSON.parse(fs.readFileSync(outFile, 'utf8')); } catch (e) { /* start fresh */ }
  }
  out.source = src;
  for (const m of MODELS) if (!out.models.includes(m)) out.models.push(m);
  for (const l of TARGET_LANGS) if (!out.langs.includes(l)) out.langs.push(l);

  for (const model of MODELS) {
    out.results[model] = out.results[model] || {};
    for (const lang of TARGET_LANGS) {
      process.stderr.write(`[${model}] ${lang} ...\n`);
      try {
        const r = await callTranslation({
          lang, model, deFields: src.fields, problem: src.problem, einsatz: src.einsatz, region: src.region,
          nodeOutputs, staticData, executionId,
        });
        out.results[model][lang] = { ok: true, ...r };
        process.stderr.write(`[${model}] ${lang} OK (${r.elapsedMs}ms, issues=${r.check.issues.length})\n`);
      } catch (err) {
        out.results[model][lang] = { ok: false, error: err.message };
        process.stderr.write(`[${model}] ${lang} FEHLER: ${err.message}\n`);
      }
      fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
      fs.writeFileSync(outFile, JSON.stringify(out, null, 2), 'utf8');
    }
  }
  process.stderr.write('FERTIG -> out/results_faq1.json\n');
}

main().catch((err) => { console.error(err); process.exit(1); });
