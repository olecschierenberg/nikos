'use strict';
// Hilfsfunktionen fuer die LP-zu-LP-Verlinkung (siehe lib/nodes/verwandte_verlinken.js).
// Eigenstaendiges, requirebares Modul (statt Node-Konvention), weil hier
// simple Text-Extraktion aus bereits geschriebenem HTML passiert, keine
// eigentliche Verarbeitungslogik -- die gehoert in die Nodes.

// Kategorie = Banner-Bilddatei ohne Endung (z. B. "Festival"), siehe
// heroFor()-Mapping in feinschliff.js. null, wenn keine Banner-Grafik
// gefunden wird (z. B. sehr alte LP-Vorlage ohne Banner-Bild).
function extractCategory(html) {
  const m = html.match(/assets\/img\/Banner\/([A-Za-zÄÖÜäöüß0-9_.\-]+)\.(?:jpg|jpeg|png)/i);
  return m ? m[1] : null;
}

// Linktext = <title> ohne den " – NIKOS"-Suffix (Bindestrich oder
// En-Dash). Funktioniert fuer alte UND neue LP-Vorlage gleichermassen, da
// <title> in beiden Generationen konsistent gesetzt wird (anders als die
// <h1>-Struktur, die sich zwischen den Generationen unterscheidet).
function extractTitle(html) {
  const m = html.match(/<title>([\s\S]*?)<\/title>/i);
  if (!m) return '';
  return m[1].replace(/\s*[–-]\s*NIKOS\s*$/, '').trim();
}

module.exports = { extractCategory, extractTitle };
