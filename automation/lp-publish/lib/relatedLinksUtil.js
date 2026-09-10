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

// Linktext (DE) = <title> ohne den " – NIKOS"-Suffix (Bindestrich oder
// En-Dash). Funktioniert fuer alte UND neue LP-Vorlage gleichermassen, da
// <title> in beiden Generationen konsistent gesetzt wird (anders als die
// <h1>-Struktur, die sich zwischen den Generationen unterscheidet).
function extractTitle(html) {
  const m = html.match(/<title>([\s\S]*?)<\/title>/i);
  if (!m) return '';
  return m[1].replace(/\s*[–-]\s*NIKOS\s*$/, '').trim();
}

// Linktext (EN) -- NEU (2026-09-10, Teil des Bugfixes fuer deutsche
// Linktexte auf englischen Seiten, siehe verwandte_verlinken.js). <title>
// hat KEIN EN-Gegenstueck (wird nie pro Sprache dupliziert), deshalb wird
// stattdessen der EN-Text der <h1> gelesen -- die existiert auf JEDER Seite
// zweisprachig, in einer von zwei bekannten Strukturen:
//   Variante 1 (klassisch): <h1 data-de>TEXT</h1><h1 data-en>TEXT</h1>
//   Variante 2 (neuer):     <h1><span data-de>TEXT</span><span data-en>TEXT</span></h1>
// Beide Varianten decken alle aktuellen loesungen/-Seiten ab (verifiziert,
// 2026-09-10: 0 von 198 Seiten liefern einen leeren EN-Titel). Faellt beides
// nicht, wird '' zurueckgegeben -- der Aufrufer faellt dann auf den DE-Titel
// bzw. den Slug zurueck (siehe buildBlock() in verwandte_verlinken.js).
function extractTitleEn(html) {
  let m = html.match(/<h1[^>]*\bdata-en\b[^>]*>([\s\S]*?)<\/h1>/i);
  if (m) return m[1].replace(/<[^>]+>/g, '').trim();
  m = html.match(/<h1[^>]*>[\s\S]*?<span[^>]*\bdata-en\b[^>]*>([\s\S]*?)<\/span>[\s\S]*?<\/h1>/i);
  if (m) return m[1].replace(/<[^>]+>/g, '').trim();
  return '';
}

module.exports = { extractCategory, extractTitle, extractTitleEn };
