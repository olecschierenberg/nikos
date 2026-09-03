// NEU (2026-09-03, kein n8n-Vorbild): Pendant zu
// automation/lp-publish/lib/nodes/noindex_entfernen.js (dort unangetastet
// fuer den Alt-Pfad belassen) fuer den neuen Multi-Sprach-URL-Schema-Pfad
// (nikos.info/<lang>/lp/<slug>/). Einziger inhaltlicher Unterschied: die
// neuen Seiten (html_bauen_ml.js) haben KEIN data-de/data-en-Toggle mehr --
// H1/H2 sind einfache, einsprachige Tags ohne data-Attribut, daher eine
// leicht vereinfachte extractLinkTitle()-Variante ohne data-(?:de|en)-Regex.
const src = $json; // { slug, url, previewHtml }
const decoded = src.previewHtml;
const live = decoded.replace(/\s*<meta name="robots" content="noindex,nofollow">\s*\n?/i, '\n');

function extractLinkTitle(html){
  const h1m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  const h1 = h1m ? h1m[1].replace(/<[^>]+>/g,'').trim() : '';
  if (!h1) return '';
  const afterH1 = html.slice(h1m.index + h1m[0].length, h1m.index + h1m[0].length + 2000);
  const h2m = afterH1.match(/<h2 class="heading-l" style="margin-top:12px;">([\s\S]*?)<\/h2>/);
  const sub = h2m ? h2m[1].replace(/<[^>]+>/g,'').trim() : '';
  return sub ? (h1 + ': ' + sub) : h1;
}
const linkTitle = extractLinkTitle(live);
return { json: {
  lang: src.lang,
  slug: src.slug,
  liveHtml: live,
  liveUrl: src.url, // bereits vollstaendig https://nikos.info/<lang>/lp/<slug>/ (aus html_bauen_ml.js)
  linkTitle,
} };
