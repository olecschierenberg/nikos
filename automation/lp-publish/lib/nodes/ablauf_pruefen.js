// UNVERÄNDERTE Kopie aus dem n8n-Workflow "Landingpages veröffentlichen"
// (VJaUw0kTrsO17iHX), Node "Ablauf prüfen" (Zweig 2, monatlicher Cron).
// NIKOS Stufe C — Ablauf prüfen (markieren, NICHT löschen)
// Liest alle Keywordkombinationen. Für Zeilen mit Ende (MM.YYYY) < aktueller Monat:
//  - Event in Referenzen genannt?  -> NICHT markieren (Referenz-Schutz; Ende sollte geleert werden -> Hinweis)
//  - sonst -> zum Markieren (aktiv = 'abgelaufen')
// Gibt nur die zu markierenden Zeilen aus (row_number + aktiv='abgelaufen').
const norm = s => String(s ?? '').trim();
const low  = s => norm(s).toLowerCase();

// Referenz-Events (aus nikos-referenzen.html) — bei Treffer LP behalten (Referenz-Schutz)
const REFERENZ_EVENTS = [
  'oktoberfest','fußball-em','fanmeile','karneval der kulturen','iaa mobility','iaa',
  'christopher street day','csd','firmenveranstaltung','gillamoos','barthelmarkt','stoppelmarkt',
  'sail bremerhaven','rakoczy','bürgerfest regensburg','isf sindelfingen','altstadtfest fürstenfeldbruck',
  'stadtfest kufstein','ikarus festival','feel festival','brass wiesn','puls festival',
  '75 jahre grundgesetz','35 jahre mauerfall','bmw','mercedes','miele','amg'
];
function istReferenz(problem, einsatz, region){
  const hay = (low(einsatz)+' '+low(problem)+' '+low(region));
  return REFERENZ_EVENTS.some(ev => hay.includes(ev));
}

// Ende (MM.YYYY) -> Vergleichszahl YYYYMM
function endeZahl(ende){
  const m = norm(ende).match(/^(\d{1,2})\.(\d{4})$/);
  if(!m) return null;
  const mon = parseInt(m[1],10), jahr = parseInt(m[2],10);
  if(mon<1||mon>12) return null;
  return jahr*100 + mon;
}

const now = new Date();
const heuteZahl = now.getFullYear()*100 + (now.getMonth()+1);

const out = [];
for (const it of $input.all()){
  const j = it.json;
  const ende = endeZahl(j.Ende);
  if (ende === null) continue;                 // kein/ungültiges Ablaufdatum -> Dauerfall, nie markieren
  if (ende >= heuteZahl) continue;             // noch nicht abgelaufen
  // abgelaufen:
  if (istReferenz(j.Problem, j.Einsatz, j.Region)) continue;  // Referenz-Schutz -> behalten
  if (low(j.aktiv) === 'abgelaufen') continue; // schon markiert
  out.push({ json: { row_number: j.row_number, aktiv: 'abgelaufen',
    _info: 'abgelaufen seit '+norm(j.Ende)+': '+[j.Problem,j.Einsatz,j.Region].filter(Boolean).join(' | ') } });
}
return out;
