// NEU: fuegt den in verwandte_verlinken.js gebauten Block idempotent in
// eine einzelne LP-HTML-Seite ein -- ersetzt einen vorhandenen Block
// anhand der Marker-Kommentare (falls die Seite schon einen hat, z. B.
// weil sich die Kategorie-Zusammensetzung seit dem letzten Lauf geaendert
// hat), sonst wird der Block direkt vor <footer eingefuegt. Ohne
// blockHtml (z. B. weil die Seite jetzt allein in ihrer Kategorie ist)
// wird ein vorhandener Block sauber wieder entfernt.
const html = $json.html || '';
const blockHtml = $json.blockHtml; // string oder null/undefined
const START = '<!-- VERWANDTE-ANWENDUNGSBEISPIELE:START -->';
const END = '<!-- VERWANDTE-ANWENDUNGSBEISPIELE:END -->';

const startIdx = html.indexOf(START);
const endIdx = startIdx >= 0 ? html.indexOf(END, startIdx) : -1;
let withoutBlock = html;
if (startIdx >= 0 && endIdx >= 0) {
  // Spiegelbildlich zum Einfuegen unten (blockHtml + '\n\n'): die beim
  // Einfuegen hinzugefuegten Trennzeilen nach dem Block wieder mit entfernen,
  // damit ein Entfernen-Durchlauf exakt den Ausgangszustand wiederherstellt.
  let afterEnd = endIdx + END.length;
  if (html.slice(afterEnd, afterEnd + 2) === '\n\n') afterEnd += 2;
  else if (html.slice(afterEnd, afterEnd + 1) === '\n') afterEnd += 1;
  withoutBlock = html.slice(0, startIdx) + html.slice(afterEnd);
}

if (!blockHtml) {
  return { json: { newHtml: withoutBlock, changed: withoutBlock !== html } };
}

const footerIdx = withoutBlock.indexOf('<footer');
if (footerIdx < 0) {
  return { json: { newHtml: html, changed: false, reason: 'kein <footer gefunden' } };
}
const newHtml = withoutBlock.slice(0, footerIdx) + blockHtml + '\n\n' + withoutBlock.slice(footerIdx);
return { json: { newHtml, changed: newHtml !== html } };
