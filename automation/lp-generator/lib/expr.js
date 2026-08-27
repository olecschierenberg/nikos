'use strict';
/**
 * Rendert n8n-Ausdrucksfelder (Strings, die mit "=" beginnen und {{ ... }}
 * -Platzhalter enthalten können) außerhalb von Code-Nodes — also die Felder,
 * die im n8n-Workflow direkt in Node-Parametern stehen: HTTP-URLs, JSON-
 * Bodies, Google-Sheets-Spaltenwerte und die AI-Prompt-Textfelder.
 *
 * Jeder {{ ... }}-Block ist ein eigenständiger JS-Ausdruck (identische
 * Syntax wie in n8n selbst, siehe die 1:1 aus den Node-Parametern
 * übernommenen Vorlagen in lib/prompts.js). Text außerhalb von {{ }} bleibt
 * unverändert stehen.
 */

function renderExpr(template, ctx) {
  if (template == null) return template;
  let body = String(template);
  if (body.startsWith('=')) body = body.slice(1);
  return body.replace(/\{\{([\s\S]*?)\}\}/g, (_, expr) => {
    const fn = new Function('$', '$json', '$now', '"use strict";\nreturn (' + expr + ');');
    const val = fn(ctx.$, ctx.$json, ctx.$now);
    if (val === undefined || val === null) return '';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  });
}

module.exports = { renderExpr };
