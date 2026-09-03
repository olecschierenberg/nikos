'use strict';
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
