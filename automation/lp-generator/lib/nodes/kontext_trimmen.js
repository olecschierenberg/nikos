// Kontext trimmen (Lever 1): nur die fuer diesen Einsatz relevanten Textbaustein-Abschnitte
// an das Sprachmodell geben statt der kompletten Datei. Spart Input-Tokens ohne Qualitaetsverlust.
const src = $('Filter + Relevanz-Ranking').item.json;
const md = ($('Textbausteine laden').item.json.data) || '';
const einsatz = String(src.Einsatz || '').toLowerCase();
const problem = String(src.Problem || '').toLowerCase();

// Immer benoetigte Abschnitte (vollstaendig behalten):
const KEEP_FULL = [
  'Freigegebene Bausteine',
  'Terminologie & Wording-Regeln',
  'Verbotene Formulierungen / Regeln',
  'Modulschreibweise',
  'Modul-Funktionsdetails',
  'FAQ-Prioritäten'
];

// Einsatz/Problem -> Pain-Point-Typ(en) (bolded Label im Pain-Points-Abschnitt)
function matchTypes(e) {
  const map = [
    [/stra(ß|ss)enfest/, 'Straßenfest'],
    [/weihnachtsmarkt|christkindl|adventsmarkt/, 'Weihnachtsmarkt'],
    [/kirmes|jahrmarkt|rummel|freimarkt|\bdom\b|wasen|dult|volksfest|oktoberfest|wiesn|pl(ä|ae)rrer|wurstmarkt|\bsend\b|libori|gillamoos|stoppelmarkt|barthelmarkt|bergkirchweih|kirchweih|kirtag/, 'Volksfest'],
    [/stadtfest|altstadtfest|b(ü|ue)rgerfest|cityfest|stadtjubil|zissel/, 'Stadtfest'],
    [/sch(ü|ue)tzenfest/, 'Schützenfest'],
    [/karneval|fastnacht|fasching|rosenmontag|\bcsd\b|christopher|pride|karnevalsumzug/, 'Karneval'],
    [/festumzug|umzug|parade/, 'Festumzug'],
    [/marathon|stadtlauf|triathlon|-lauf\b|osterlauf|radrennen/, 'Marathon'],
    [/weinfest|weindorf|weinmarkt|weinwoche|weinmarkt/, 'Weinfest'],
    [/hafen|sail/, 'Hafenfest'],
    [/fanmeile|fanzone|public viewing|fu(ß|ss)ball-em/, 'Fanmeile'],
    [/baustelle/, 'Baustelle'],
    [/krisenlage|krise/, 'Krisenlage'],
    [/katastrophenschutz/, 'Katastrophenschutzübung'],
    [/firmen|betriebs|jubil(ä|ae)um|familientag/, 'Firmenveranstaltung'],
    [/tag der bundeswehr/, 'Tag der Bundeswehr'],
    [/gartenschau|\bbuga\b|\biga\b|parkfest/, 'Bundesgartenschau'],
    [/kirchentag|katholikentag/, 'Kirchentag'],
    [/tag der deutschen einheit/, 'Tag der Deutschen Einheit'],
    [/hessentag|sachsen-anhalt-tag|rheinland-pfalz-tag|nrw-tag|th(ü|ue)ringentag|tag der niedersachsen|tag der sachsen|landesfest/, 'Landesfest'],
    [/festival|open[\s-]?air|konzert|musikfestival|rave|wacken|tomorrowland|lollapalooza|hurricane|roskilde|sziget|primavera|deichbrand|melt\b/, 'Open-Air-Musikfestival'],
    [/gedenk/, 'Gedenkveranstaltung'],
    [/skirennen|\bski\b/, 'Skirennen']
  ];
  const hits = [];
  for (const [re, t] of map) { if (re.test(e)) hits.push(t); }
  return hits;
}
const wantTypes = matchTypes(einsatz + ' ' + problem);

function head(sec) { const m = sec.match(/^##\s+(.*)/); return m ? m[1].trim() : ''; }

const parts = md.split(/\n(?=## )/);
const outParts = [];
for (const sec of parts) {
  const h = head(sec);
  if (!h) continue; // Titel/Praeambel weglassen
  if (KEEP_FULL.some(k => h.indexOf(k) === 0)) { outParts.push(sec); continue; }
  if (h.indexOf('Pain Points je Einsatzart') === 0) {
    const lines = sec.split('\n');
    const kept = [];
    for (const ln of lines) {
      const isPP = /^\-\s\*\*/.test(ln);
      if (!isPP) { kept.push(ln); continue; } // Header/Intro/Extrapolation behalten
      const lab = (ln.match(/\*\*(.+?):\*\*/) || [])[1] || '';
      const labFirst = lab.split(' ')[0];
      const labMatch = wantTypes.some(t => lab.indexOf(t.split(' ')[0]) >= 0 || (labFirst && t.indexOf(labFirst) >= 0));
      if (wantTypes.length === 0 || labMatch || /Querschnitt/.test(lab)) kept.push(ln);
    }
    outParts.push(kept.join('\n'));
    continue;
  }
  // Zweck, Referenztexte, Aenderungshistorie -> weglassen
}
const data = outParts.join('\n').replace(/\n{3,}/g, '\n\n');
const MAX_CONTEXT_CHARS = 12000;
const boundedData = data.length > MAX_CONTEXT_CHARS ? data.slice(0, MAX_CONTEXT_CHARS) + '\n\n[Kontext wegen Sicherheitsbudget gekürzt]' : data;
return [{ json: Object.assign({}, src, { data: boundedData, _context_chars: boundedData.length, _context_truncated: data.length > MAX_CONTEXT_CHARS }), pairedItem: { item: 0 } }];
