'use strict';
/**
 * Kompatibilitäts-Shim für die 1:1 aus n8n übernommenen Code-Node-Dateien
 * unter lib/nodes/*.js.
 *
 * Diese Dateien sind UNVERÄNDERTE Kopien des jsCode-Parameters der
 * jeweiligen Node aus dem aktiven n8n-Workflow "Landingpages erzeugen —
 * Worker stabilisiert" (Workflow-ID 8ApbaHN6gZYrl4ZO, Stand 27.08.2026).
 * Sie erwarten dieselben freien Variablen, die n8n einem Code-Node zur
 * Laufzeit bereitstellt: $input, $json, $('NodeName'), $now, $execution,
 * $getWorkflowStaticData. Dieses Modul bildet genau diese Variablen nach,
 * damit der Original-Code ohne inhaltliche Änderung ausgeführt werden kann
 * — Übersetzung der Ausführungsumgebung, nicht Neuschreiben der Logik.
 *
 * Absichtlich NICHT nachgebaut: n8n-Pairing/Binary-Handling (hier nicht
 * benötigt, die Pipeline verarbeitet ausschließlich JSON-Items).
 */

const fs = require('fs');
const path = require('path');
const { DateTime } = require('luxon');

const NODES_DIR = path.join(__dirname, 'nodes');
const sourceCache = new Map();

function loadSource(fileName) {
  if (!sourceCache.has(fileName)) {
    sourceCache.set(fileName, fs.readFileSync(path.join(NODES_DIR, fileName), 'utf8'));
  }
  return sourceCache.get(fileName);
}

// Baut die $('NodeName')-Funktion nach: liefert { item, all() } auf Basis
// der bisher im Lauf gesammelten Node-Outputs (nodeOutputs: Map<name, items[]>).
function buildNodeRef(nodeOutputs, itemIndex) {
  return function $(name) {
    const out = nodeOutputs.get(name);
    if (!out) {
      throw new Error(
        `n8n-shim: Node-Referenz "${name}" ist an dieser Stelle nicht verfügbar ` +
        `(kein gespeicherter Output – Reihenfolge im Orchestrator prüfen).`
      );
    }
    const idx = itemIndex < out.length ? itemIndex : 0;
    return {
      item: out[idx],
      all: () => out,
    };
  };
}

function runFunction(source, args) {
  const names = Object.keys(args);
  const values = names.map((n) => args[n]);
  const fn = new Function(...names, '"use strict";\n' + source);
  return fn(...values);
}

// HINWEIS: Absichtlich KEIN "items"-Parameter in den Funktionssignaturen
// unten. Drei der Original-Node-Dateien (filter_relevanz.js, limit.js,
// vorab_begrenzung.js) deklarieren "const items = $input.all();" selbst
// ganz oben in ihrem Code — ein zusätzlich injizierter Funktionsparameter
// gleichen Namens würde dort zu "Identifier 'items' has already been
// declared" führen. $input.all() liefert exakt dieselben Daten, ist also
// keine Funktionseinbuße.

/**
 * Führt einen Code-Node im n8n-Modus "Run Once for All Items" aus.
 * items: aktuelle Eingabe-Items ([{json:{...}}, ...]).
 * Gibt immer ein Array von Items zurück (auch wenn der Node-Code ein
 * einzelnes {json:...}-Objekt zurückgibt, wie es einige der Original-Nodes
 * trotz "All Items"-Modus tun).
 */
function runAllItems(fileName, { items, nodeOutputs, staticData, executionId }) {
  const result = runFunction(loadSource(fileName), {
    $: buildNodeRef(nodeOutputs, 0),
    $input: {
      all: () => items,
      first: () => items[0],
      last: () => items[items.length - 1],
    },
    $json: items[0] ? items[0].json : undefined,
    $now: DateTime.now(),
    $execution: { id: executionId },
    $getWorkflowStaticData: () => staticData,
  });
  return Array.isArray(result) ? result : [result];
}

/**
 * Führt einen Code-Node im n8n-Modus "Run Once for Each Item" aus.
 * Unsere Pipeline führt an diesen Stellen ohnehin immer genau ein Item durch
 * (Original-Workflow limitiert selbst auf 1 Kombination/Lauf, Kommentar
 * "OOM-Schutz" in vorab_begrenzung.js/limit.js) — daher hier bewusst kein
 * echtes Mehrfach-Item-Looping, sondern ein einzelner Aufruf mit index 0.
 */
function runEachItem(fileName, { item, nodeOutputs, staticData, executionId }) {
  const items = [item];
  return runFunction(loadSource(fileName), {
    $: buildNodeRef(nodeOutputs, 0),
    $input: {
      all: () => items,
      item,
    },
    $json: item.json,
    $now: DateTime.now(),
    $execution: { id: executionId },
    $getWorkflowStaticData: () => staticData,
  });
}

module.exports = { runAllItems, runEachItem, buildNodeRef, loadSource };
