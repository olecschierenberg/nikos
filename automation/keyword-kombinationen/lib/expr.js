'use strict';
/**
 * Rendert n8n-Ausdrucksfelder (Strings mit {{ ... }}-Platzhaltern) außerhalb
 * von Code-Nodes — hier: das User-Prompt-Textfeld der Node "Kombinationen
 * vorschlagen". 1:1 aus automation/lp-generator/lib/expr.js übernommen.
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
