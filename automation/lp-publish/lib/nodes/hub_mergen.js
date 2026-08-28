// ANGEPASST (keine 1:1-Kopie möglich) aus dem n8n-Workflow "Landingpages
// veröffentlichen" (VJaUw0kTrsO17iHX), Nodes "Hub: URLs sammeln" (Logik
// UNVERÄNDERT als Parameter 'entries' übernommen) + "Hub mergen".
//
// WARUM ANGEPASST: Der n8n-Node bekam die Hub-Seite (loesungen/index.html)
// per GitHub-GET-contents-Response (base64 "content", "sha"). Dieses
// Skript liest/schreibt die Datei direkt im ausgecheckten Repo — deshalb
// entfällt base64-Dekodieren/Encodieren und die sha-Prüfung.
//
// UNVERÄNDERT geblieben: die komplette Einfüge-Logik (Suche nach
// <ul class="loesungen-list">...</ul>, HTML-Escaping, Dubletten-Check per
// href, <li><a>-Format) — 1:1 aus dem Original übernommen.
const entries = $json.entries || [];
const html = $json.hubHtml || '';
const ulOpenIdx = html.indexOf('<ul class="loesungen-list">');
const ulCloseIdx = ulOpenIdx >= 0 ? html.indexOf('</ul>', ulOpenIdx) : -1;
if (!html || ulOpenIdx < 0 || ulCloseIdx < 0) {
  return { json: { changed: false, added: 0, reason: 'Hub-Seite nicht lesbar oder loesungen-list nicht gefunden' } };
}
const esc = s => (s||'').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
let added = 0;
let insertion = '';
for (const e of entries) {
  const href = 'https://nikos.info/loesungen/' + e.slug + '/';
  if (html.includes('href="' + href + '"')) continue;
  const text = esc(e.title || e.slug);
  insertion += '      <li><a href="' + href + '">' + text + '</a></li>\n';
  added++;
}
if (added === 0) {
  return { json: { changed: false, added: 0, reason: 'keine neuen Slugs' } };
}
const newHtml = html.slice(0, ulCloseIdx) + insertion + html.slice(ulCloseIdx);
return { json: { changed: true, added, newHtml } };
