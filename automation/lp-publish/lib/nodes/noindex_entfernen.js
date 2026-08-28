// ANGEPASST (keine 1:1-Kopie möglich) aus dem n8n-Workflow "Landingpages
// veröffentlichen" (VJaUw0kTrsO17iHX), Node "noindex entfernen".
//
// WARUM ANGEPASST: Der n8n-Node bekam eine GitHub-GET-contents-Response
// (base64 "content", "sha" für den späteren DELETE-Aufruf). Dieses Skript
// liest/schreibt Dateien direkt im ausgecheckten Repo (git mv statt PUT+
// DELETE per API, siehe Migrationsplan Teil 2, Abschnitt 4.3) — deshalb
// entfällt das base64-Dekodieren/Encodieren und die sha-Übergabe komplett.
//
// UNVERÄNDERT geblieben: die noindex-Entfern-Regel und die komplette
// extractLinkTitle()-Funktion (reine String-Logik, kein GitHub-Bezug) —
// 1:1 aus dem Original übernommen.
const src = $json; // { row_number, slug, previewHtml }
const decoded = src.previewHtml;
// noindex-Meta-Zeile entfernen (Live-Seite soll indexierbar sein)
const live = decoded.replace(/\s*<meta name="robots" content="noindex,nofollow">\s*\n?/i, '\n');

function extractLinkTitle(html){
  const h1m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  const h1 = h1m ? h1m[1].replace(/<[^>]+>/g,'').trim() : '';
  if (!h1) return '';
  const afterH1 = html.slice(h1m.index + h1m[0].length, h1m.index + h1m[0].length + 2000);
  const h2ms = [...afterH1.matchAll(/<h2 class="heading-l" style="margin-top:12px;" data-(?:de|en)>([\s\S]*?)<\/h2>/g)];
  let sub = '';
  for (const m of h2ms) { const s = m[1].replace(/<[^>]+>/g,'').trim(); if (s) { sub = s; break; } }
  return sub ? (h1 + ': ' + sub) : h1;
}
const linkTitle = extractLinkTitle(live);
return { json: {
  row_number: src.row_number,
  slug: src.slug,
  liveHtml: live,
  liveUrl: 'https://nikos.info/loesungen/' + src.slug + '/index.html',
  linkTitle
} };
