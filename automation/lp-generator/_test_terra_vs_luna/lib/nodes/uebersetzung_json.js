// NEU (2026-09-03, kein n8n-Vorbild): Parser fuer die Antwort des
// Uebersetzungs-Prompts (lib/prompts/uebersetzung.*.txt), analog zu
// texte_json.js/qa_json.js/nachbesserung_json.js, aber fuer EIN
// Sprachziel mit generischen (nicht _de/_en-suffigierten) Feldnamen.
// Erwartete Schluessel im geparsten JSON: headline, subhead, intro,
// usp_intro, usp, faq1_q, faq1_a, faq2_q, faq2_a, faq3_q, faq3_a,
// faq4_q, faq4_a, slug_kw.
const REQUIRED_KEYS = ['headline','subhead','intro','usp_intro','usp',
  'faq1_q','faq1_a','faq2_q','faq2_a','faq3_q','faq3_a','faq4_q','faq4_a','slug_kw'];

function codeFix(t){
  if(!t) return t;
  t = String(t);
  t = t.replace(/\[(audio|dispatcher|horn|flash|relay|clamp|LED|XLR|moon)\]2\b/g,'[$1]²');
  // NEU (2026-09-03, Nutzer-Vorgabe): Marke "RADACOM" wird UNABHAENGIG von
  // der aktuellen Rechtsform des Unternehmens verwendet -- ein evtl. vom
  // Modell ergaenztes "GmbH" (oder eine andere Rechtsform) wird hart
  // entfernt, unabhaengig davon, welches Modell den Text erzeugt hat.
  // Grund: RADACOM GmbH koennte das Geschaeft aufgeben, die Marke RADACOM
  // soll aber unabhaengig davon in allen Texten weiterverwendbar bleiben.
  t = t.replace(/\bRadacom\b(\s+GmbH\b)?/gi, 'RADACOM');
  t = t.replace(/\{\{[^}]*\}\}/g,'');
  t = t.replace(/\$json\.[A-Za-z_]+/g,'');
  return t.replace(/\s{2,}/g,' ').replace(/\s+([.,;:])/g,'$1').trim();
}

const results = [];
for (const item of $input.all()) {
  const j = item.json;
  let obj;
  if (j && typeof j === 'object' && (j.headline !== undefined || j.output !== undefined)) {
    obj = (j.output !== undefined) ? j.output : j;
  } else {
    let raw = j.text ?? j.response ?? '';
    if (typeof raw === 'object') {
      obj = raw;
    } else {
      let s = String(raw).trim().replace(/^```(json)?/i,'').replace(/```$/,'').trim();
      try { obj = JSON.parse(s); }
      catch(e){
        const a = s.indexOf('{'), b = s.lastIndexOf('}');
        if (a >= 0 && b > a) obj = JSON.parse(s.slice(a, b+1));
        else throw new Error('Kein JSON (Uebersetzung)');
      }
    }
  }
  const o2 = {};
  for (const k of REQUIRED_KEYS) {
    o2[k] = (typeof obj[k] === 'string') ? codeFix(obj[k]) : (obj[k] || '');
  }
  results.push({ json: { output: o2 } });
}
return results;
