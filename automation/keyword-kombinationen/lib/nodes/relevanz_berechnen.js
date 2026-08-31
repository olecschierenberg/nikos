// NIKOS Stufe A — Relevanz berechnen + Dedup + Unmöglich-Filter
// Eingang: je Item neue Kombination {Problem, Einsatz, Region}.
// 1) DEDUP: gegen Bestand (Vorhandene Kombis lesen) UND innerhalb des Laufs.
// 2) UNMÖGLICH: ortsgebundener Eventname + fremde Region -> verwerfen.
// 3) RELEVANZ 1-10 (gleiches Schema wie Stufe-B-Filter).
const norm = s => String(s ?? '').trim();
const low  = s => norm(s).toLowerCase();

let sfItems = [];
try { sfItems = $('Stadt-Fakten lesen A').all().map(i => i.json); } catch(e) { sfItems = []; }
const SF = {};
for (const r of sfItems) { const reg = norm(r.Region); if (reg) SF[reg.toLowerCase()] = r; }
const sf = reg => SF[low(reg)] || null;

// ---- DEDUP-Set aus Bestand ----
let existing = [];
try { existing = $('Vorhandene Kombis lesen').all().map(i => i.json); } catch(e) { existing = []; }
const keyOf = (p,e,r) => [low(p),low(e),low(r)].join('|');
const seen = new Set(existing.map(r => keyOf(r.Problem, r.Einsatz, r.Region)));

// ---- UNMÖGLICH: ortsgebundene Eventnamen -> erlaubte Region(en) ----
// Wenn der Einsatz einen dieser Namen enthält, MUSS die Region passen, sonst verwerfen.
const ORTSGEBUNDEN = [
  {kw:'wacken', regionen:['wacken','schleswig-holstein']},
  {kw:'cannstatter', regionen:['stuttgart','baden-württemberg','baden-wuerttemberg']},
  {kw:'wasen', regionen:['stuttgart','baden-württemberg','baden-wuerttemberg']},
  {kw:'oktoberfest', regionen:['münchen','muenchen','bayern']},
  {kw:'wiesn', regionen:['münchen','muenchen','bayern']},
  {kw:'kölner karneval', regionen:['köln','koeln','nordrhein-westfalen']},
  {kw:'düsseldorfer karneval', regionen:['düsseldorf','duesseldorf','nordrhein-westfalen']},
  {kw:'bremer freimarkt', regionen:['bremen']},
  {kw:'hamburger', regionen:['hamburg']},
  {kw:'hafengeburtstag', regionen:['hamburg']},
  {kw:'sail bremerhaven', regionen:['bremerhaven','bremen']},
  {kw:'hanse sail', regionen:['rostock','mecklenburg-vorpommern']},
  {kw:'gillamoos', regionen:['abensberg','bayern']},
  {kw:'barthelmarkt', regionen:['manching','bayern']},
  {kw:'stoppelmarkt', regionen:['vechta','niedersachsen']},
  {kw:'rakoczy', regionen:['bad kissingen','bayern']},
  {kw:'freimarkt', regionen:['bremen']},
];

// ---- Plausibilität gegen Stadt-Fakten (Regionstyp/Ausland) ----
// NUR echte deutsche Institutionen/Einzeltraditionen (Kirchentag, Landesgartenschauen, Ländertage, Bremer
// Freimarkt-Namensrecht etc.) -> im Ausland nie plausibel. Generische, europaweit verbreitete Eventtypen wie
// Kirmes/Jahrmarkt, Karneval, Weinfest, CSD/Pride, Rosenmontag/Fasnacht sind NICHT mehr blockiert, weil sie
// in Benelux/Frankreich/Polen/Schweiz/Österreich/Tschechien/Dänemark ("nahes Ausland", Europäisierung) real
// vorkommen (Tilburgse Kermis, Karneval von Binche, Rosenmontagszug Eupen, Luzerner Fasnacht, Elsässer
// Weinfeste, Amsterdam Pride ...). Ortsgebundene deutsche Editionen (Kölner Karneval, Bremer Freimarkt) bleiben
// weiterhin über die ORTSGEBUNDEN-Liste oben region-gesperrt.
const AUSLAND_DE_EVENTS = ['tag der deutschen einheit','katholikentag','kirchentag','schützenfest','schuetzenfest',
  'hessentag','tag der sachsen','tag der niedersachsen','rheinland-pfalz-tag','brandenburg-tag','thüringentag',
  'sachsen-anhalt-tag','tag der bundeswehr','bundesgartenschau','buga','landesgartenschau','freimarkt',
  'schützenumzug'];
function regionstyp(region){ const r=sf(region); return r ? low(r.Regionstyp||'') : ''; }
function istAusland(region){ return regionstyp(region).includes('ausland'); }
function istReinerFestivalort(region){ const t=regionstyp(region); return t.includes('festivalort') && !t.includes('stadt'); }
function militaerstandort(region){
  // grobe Heuristik: Bundeswehr-Standorte sind Städte/Regionen; reine Festival-/Auslandsorte NICHT
  return !istAusland(region) && !istReinerFestivalort(region);
}
const STADTFEST_TYPISCH = ['weihnachtsmarkt','volksfest','stadtfest','altstadtfest','bürgerfest','buergerfest',
  'schützenfest','schuetzenfest','weinfest','kirmes','jahrmarkt','karneval','festumzug','rosenmontag'];

function unplausibel(einsatz, region){
  const e=low(einsatz), r=low(region);
  // (a) Typisch deutsche Feste im Ausland -> unplausibel
  if (istAusland(region) && AUSLAND_DE_EVENTS.some(k=>e.includes(k))) return true;
  // (b) Tag der Bundeswehr nur an Militärstandorten
  if (e.includes('bundeswehr') && !militaerstandort(region)) return true;
  // (c) Stadtfest-typische Events an reinem Festivalort (ohne Stadtcharakter) -> unplausibel
  if (istReinerFestivalort(region) && STADTFEST_TYPISCH.some(k=>e.includes(k))) return true;
  return false;
}

function unmoeglich(einsatz, region){
  const e = low(einsatz), r = low(region);
  for (const o of ORTSGEBUNDEN){
    if (e.includes(o.kw)){
      // Eventname ist ortsgebunden -> Region muss in erlaubter Liste sein
      if (!o.regionen.some(x => r === x || r.includes(x) || x.includes(r))) return true;
    }
  }
  return false;
}

const FIXED_INFRA = ['messe','stadionevent','konzertsaal','konzerthaus','konzerthalle'];
const SECURITY_PROBLEM = ['notfalldurchsage','sprachalarmierung','sprachalarmierungsanlage','sprachalarmanlage',
  'räumungsdurchsage','raeumungsdurchsage','evakuierung','notfallwarnsystem','alarmierung','crowd management',
  'besuchersicherheit','besucherlenkung','besucherzählung','besucherzaehlung','durchsageanlage','lautsprecherdurchsage',
  'ansagetechnik','durchsagetechnik','besucherinformation','mobiles durchsagesystem','veranstaltungssicherheit',
  'eventsicherheit','festivalsicherheit','mobile sicherheitstechnik','funkleitstelle','krisenkommunikation',
  'sicherheitskommunikation','dmr-digitalfunk','statusmonitoring','text-to-speech-durchsage','terrorwarnung',
  'sturmwarnung','unwetterwarnung','sicherheitskonzept','din en 50849','elektroakustische notfallwarnsysteme',
  'notfallkommunikationssystem','eventkommunikationssystem','evakuierungsbeschallung','entfluchtung','evakuierungsansage'];
const BIG_EVENT_ANLASS = ['großveranstaltung','grossveranstaltung','oktoberfest','festival','musikfestival',
  'karnevalsumzug','karneval der kulturen','hafengeburtstag','marathon','volksfest','rave','open-air-veranstaltung'];
// EUROPÄISIERUNG (nahes Ausland): Benelux, Frankreich, Polen, Schweiz, Österreich, Tschechien, Dänemark
// gelten logistisch als gleichwertig zu Inland/AT-Partnerregionen (kein Abzug) -- diese Länder liegen in
// Transportreichweite und sind Zielmärkte. NICHT in dieser Liste (= FERNES_AUSLAND, Logistik-Abzug):
// Spanien, Portugal, Italien, Ungarn, UK. Reine Länder-Einträge ('frankreich' etc.) tauchen hier bewusst
// NICHT auf, weil logistik() jetzt per Default 1 vergibt und nur FERNES_AUSLAND explizit abwertet.
const FERNES_AUSLAND = ['barcelona','italien','spanien','portugal','ungarn','imola','tisno','pula','benicàssim',
  'san fermín/pamplona','buñol','sevilla','valencia','venedig','viareggio','siena','verona','glastonbury',
  'budapest','nyon','lissabon','mailand'];
// Rückwärtskompatibler Alias, falls andere Nodes/Referenzen noch den alten Namen erwarten.
const AUSLAND_OHNE_PARTNER = FERNES_AUSLAND;

function groesseZuschlag(reg, einsatz){
  const r=sf(reg); const kl=r?low(r.Groessenklasse):''; let s=0;
  if(['metropole','land'].includes(kl)) s=2; else if(['großstadt','grossstadt','bundesland'].includes(kl)) s=1;
  if(BIG_EVENT_ANLASS.includes(low(einsatz))) s+=1; return Math.min(s,3);
}
function logistik(reg){
  const rl=low(reg);
  // Fernes Ausland (ES/PT/IT/HU/UK) bleibt abgewertet, außer bekannte AT/CH-Partnerstädte-Regex greift.
  if(FERNES_AUSLAND.includes(rl)) return rl.match(/wien|graz|linz|salzburg|innsbruck|zürich|bern|genf|basel/)?1:0;
  // Inland, AT/CH sowie nahes Ausland (Benelux/FR/PL/CZ/DK) -> gleichauf, kein Logistik-Abzug (Europäisierung).
  return 1;
}
function relevanz(problem, einsatz, reg){
  const r=sf(reg);
  const aktuell=r && norm(r.Aktuell)!=='';
  const events=r?low(r.Events):'';
  const wiederk=events && (events.includes(low(einsatz)) ||
    (low(einsatz).includes('karneval')&&events.includes('karneval')) ||
    (low(einsatz).includes('marathon')&&events.includes('marathon')) ||
    (low(einsatz).includes('weihnacht')&&events.includes('weihnacht')));
  let lo,hi,base;
  if(aktuell){base=8;lo=7;hi=10;} else if(wiederk){base=7;lo=6;hi=9;} else {base=3;lo=1;hi=5;}
  let score=base + groesseZuschlag(reg,einsatz);
  if(logistik(reg)>=2) score+=1;
  if(logistik(reg)===0) score-=1;
  // AUSLAND-DIVERSITAETS-BONUS (2026-08-31): aktuelle/wiederkehrende Events in echtem Ausland
  // (Regionstyp='Ausland') bekommen +1, um den Logistik-Abzug fuer 'fernes Ausland' auszugleichen
  // und 'nahes Ausland' einen kleinen Vorsprung vor gleichwertigen Inlands-Kombis zu geben — auf
  // ausdruecklichen Wunsch, auslaendische Events bei Erstellung und Relevanz zu priorisieren.
  if((aktuell||wiederk) && istAusland(reg)) score+=1;
  if(SECURITY_PROBLEM.includes(low(problem))) score+=1;
  if(FIXED_INFRA.includes(low(einsatz))) return Math.max(1,Math.min(score-4,4));
  return Math.max(lo,Math.min(score,hi));
}


// --- Ende-Datum (MM.YYYY) aus Stadt-Fakten-Zeitraum, +2 Jahre nach Event-Ende ---
function endeAusZeitraum(z){
  if(!z) return '';
  z=String(z);
  const monate={jan:1,feb:2,'mär':3,mar:3,apr:4,mai:5,jun:6,jul:7,aug:8,sep:9,okt:10,nov:11,dez:12};
  const jahre=(z.match(/\b(20\d{2})\b/g)||[]).map(Number);
  if(!jahre.length) return '';
  const endjahr=Math.max(...jahre);
  let endmonat=null;
  const dmy=z.match(/\.(\d{1,2})\.(20\d{2})/g);
  if(dmy && dmy.length){ const last=dmy[dmy.length-1].match(/\.(\d{1,2})\.(20\d{2})/); endmonat=parseInt(last[1],10); }
  if(endmonat===null){ const lower=z.toLowerCase(); let lastPos=-1,lastM=null; for(const k in monate){ const p=lower.lastIndexOf(k); if(p>lastPos){lastPos=p;lastM=monate[k];} } if(lastM) endmonat=lastM; }
  if(endmonat===null) endmonat=12;
  return String(endmonat).padStart(2,'0')+'.'+(endjahr+2);
}


// ---- Numerus: Einzahl bei Stadt <200k, Plural/allgemein bei Bundesland/Land/Region ----
function einwohner(region){ const r=sf(region); const v=parseInt(String(r&&r.Einwohner||'').replace(/[^0-9]/g,''),10); return Number.isFinite(v)?v:null; }
function istGrossregion(region){
  const t=regionstyp(region);
  return t.includes('bundesland')||t.includes('land')||t.includes('region');
}
// generische, pluralfähige Einsätze (nur die bekommen Singular-Artikel bei kleiner Stadt)
const PLURALISIERBAR = ['weihnachtsmarkt','stadtfest','volksfest','altstadtfest','weinfest','schützenfest','schuetzenfest',
  'kirmes','jahrmarkt','festumzug','firmenveranstaltung','marathon','baustelle','open-air-veranstaltung','festival'];
function numerusHinweis(einsatz, region){
  const e=low(einsatz);
  // konkreter Eventname (enthält Region/Eigenname) -> kein Hinweis nötig
  if (!PLURALISIERBAR.some(k=>e===k || e.includes(k))) return '';
  if (istGrossregion(region)) return 'plural';        // Weihnachtsmärkte in Hessen
  const ew=einwohner(region);
  if (ew!==null && ew<200000) return 'singular';      // der Weihnachtsmarkt in Magdeburg
  return '';                                          // große Stadt: offen lassen
}

const out = [];
for (const it of $input.all()){
  const j = it.json;
  const p = norm(j.Problem), e = norm(j.Einsatz), r = norm(j.Region);
  if (!p && !e && !r) continue;
  const k = keyOf(p,e,r);
  if (seen.has(k)) continue;        // DEDUP: schon vorhanden oder doppelt im Lauf
  seen.add(k);
  // FIXED INFRA: Messe/Stadion/Konzert(saal/haus/halle) NIE erzeugen (nicht mehr im Pool)
  const eLow = low(e);
  const FORBIDDEN_EINSATZ = ['messe','stadionevent','stadion','konzert','konzertsaal','konzerthaus','konzerthalle'];
  if (FORBIDDEN_EINSATZ.includes(eLow) || /stadion|messe|konzertsaal|konzerthaus|konzerthalle/.test(eLow)) continue;
  if (unmoeglich(e, r)) continue;   // UNMÖGLICH: ortsgebundener Event + fremde Region
  if (unplausibel(e, r)) continue;  // UNPLAUSIBEL: Ausland/Festivalort/Bundeswehr-Heuristik
  const rel = relevanz(p, e, r);
  // Ende: Einsatz-basiert (datiertes Event) – unabhängig von Stadt-Fakten-Zeitraum
  let ende='';
  { const eLow=low(e); const ym=String(e).match(/20\d\d/);
    if(ym){ const y=parseInt(ym[0],10)+2; const mm=m=>String(m).padStart(2,'0')+'.'+y;
      if(/katholikentag/.test(eLow)) ende=mm(5);
      else if(/kirchentag/.test(eLow)) ende=mm(5);
      else if(/\biga\b/.test(eLow)) ende=mm(10);
      else if(/\bbuga\b/.test(eLow)) ende=mm(10);
      else if(/hessentag/.test(eLow)) ende=mm(6);
      else if(/tag der sachsen/.test(eLow)) ende=mm(6);
      else if(/tag der deutschen einheit/.test(eLow)) ende=mm(10);
    } }
  out.push({ json: { ...j, Relevanz: rel, Ende: ende, EinsatzNumerus: numerusHinweis(e, r) } });
}
return out;
