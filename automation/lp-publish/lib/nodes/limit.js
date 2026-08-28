// UNVERÄNDERTE Kopie aus dem n8n-Workflow "Landingpages veröffentlichen"
// (VJaUw0kTrsO17iHX), Node "Limit (max 25/Lauf)".
// HINWEIS (Fund beim Portieren, nicht verändert): Der Node-NAME sagt
// "max 25/Lauf", der tatsächliche Code begrenzt aber auf 5
// (MAX_PRO_LAUF = 5) — dieselbe Diskrepanz wie im Original, hier bewusst
// unangetastet übernommen. Die Gesamtzahl pro Tag ergibt sich in n8n erst
// aus dem Selbst-Retrigger ("Rest offen?"); dieses Skript bildet das über
// eine while-Schleife in index.js nach (siehe README, Abschnitt
// "Self-Retrigger -> while-Schleife").
const MAX_PRO_LAUF = 5;
const seen = new Set();
const out = [];
for (const it of $input.all()) {
  const slug = (it.json.slug || '').toString().trim();
  if (!slug) continue;
  if (seen.has(slug)) continue;   // gleiche slug pro Lauf nur 1x
  seen.add(slug);
  out.push(it);
  if (out.length >= MAX_PRO_LAUF) break;
}
return out;
