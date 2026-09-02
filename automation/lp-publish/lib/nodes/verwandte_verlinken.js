// NEU (kein n8n-Vorbild -- diese Funktion gab es im alten Workflow nicht):
// thematische Verlinkung der Landingpages UNTEREINANDER nach Einsatz-
// Kategorie. Kategorie = dasselbe Banner-Bild wie in feinschliff.js
// (heroFor()-Mapping) -- eine bereits bestehende, produktiv genutzte
// Einsatzart-Kategorisierung, hier wiederverwendet statt neu erfunden.
//
// Hintergrund/Auftrag (02.09.2026): 106+ Landingpages hingen nur am
// Loesungen-Hub (genau 1 eingehender Link). Ausdruecklicher Wunsch: KEINE
// sichtbaren Links von der Haupt-Website (Anwendungsseiten etc.) auf die
// LPs, da die meisten LPs AnwendungsBEISPIELE sind, keine echten
// Referenzen. Loesung deshalb bewusst NUR LP-zu-LP, die Haupt-Website
// bleibt unangetastet.
//
// Eingabe: $json.pages = [{slug, title, category}, ...] fuer ALLE aktuell
// live veroeffentlichten LPs (category = Banner-Dateiname ohne Endung,
// z. B. "Festival", oder null wenn nicht bestimmbar).
// Ausgabe: { json: { blocks: { <slug>: <blockHtml|null> } } }.
// blockHtml ist null, wenn fuer diese Seite keine sinnvolle Verlinkung
// moeglich ist (Kategorie unbekannt oder < 2 andere Mitglieder in der
// Kategorie).
//
// Verteilung: zirkulare Zuordnung (jede Seite verlinkt auf die naechsten
// bis zu 4 Seiten derselben Kategorie, im Kreis) -- dadurch bekommt JEDES
// Mitglied einer Kategorie gleich viele ein- UND ausgehende Links, statt
// dass wenige Seiten alle eingehenden Links absahnen.
const pages = $json.pages || [];
const MAX_RELATED = 4;

const esc = s => (s || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const byCategory = new Map();
for (const p of pages) {
  if (!p.category) continue;
  if (!byCategory.has(p.category)) byCategory.set(p.category, []);
  byCategory.get(p.category).push(p);
}
for (const list of byCategory.values()) list.sort((a, b) => a.slug.localeCompare(b.slug));

const blocks = {};
for (const p of pages) blocks[p.slug] = null;

function buildBlock(relatedList) {
  const items = relatedList.map(r =>
    `      <li><a href="https://nikos.info/loesungen/${r.slug}/" style="color:var(--orange-dk);text-decoration:none;font-weight:600;">${esc(r.title || r.slug)}</a></li>`
  ).join('\n');
  return `<!-- VERWANDTE-ANWENDUNGSBEISPIELE:START -->
<section class="nk-section" aria-label="Weitere Anwendungsbeispiele">
  <div class="nk-section__inner">
    <div class="nk-section__header">
      <span class="nk-label" data-de>Weitere Beispiele</span><span class="nk-label" data-en>More examples</span>
      <h2 class="heading-m" style="margin-top:10px;" data-de>Weitere Anwendungsbeispiele</h2>
      <h2 class="heading-m" style="margin-top:10px;" data-en>More application examples</h2>
    </div>
    <ul style="max-width:900px;display:flex;flex-direction:column;gap:10px;list-style:none;padding:0;">
${items}
    </ul>
  </div>
</section>
<!-- VERWANDTE-ANWENDUNGSBEISPIELE:END -->`;
}

for (const list of byCategory.values()) {
  const n = list.length;
  if (n < 2) continue; // allein in der Kategorie -> keine sinnvolle Verlinkung moeglich
  const k = Math.min(MAX_RELATED, n - 1);
  for (let i = 0; i < n; i++) {
    const related = [];
    for (let off = 1; off <= k; off++) related.push(list[(i + off) % n]);
    blocks[list[i].slug] = buildBlock(related);
  }
}

return { json: { blocks } };
