// ═════════════════════════════════════════════════════════════════════════
// NIKOS Stufe B — Filter + Relevanz-Ranking (ersetzt "Nur erstellen=x & slug leer")
// Liest: Keywordkombinationen (vorheriger Node) + Stadt-Fakten (Node "Stadt-Fakten lesen")
// Tut:   1) Grundfilter erstellen=x & slug leer
//        2) HARTE Filter: feste Infrastruktur (Messe/Stadion/Konzertsaal/-haus/-halle) raus;
//           Einsatz×Region-Plausibilität gegen Stadt-Fakten; Problem×Einsatz-Matrix
//        3) Relevanz 1–10 (Sheet-Spalte ODER berechnet) + Sortierung desc (10 zuerst)
//        4) Grenzfälle für nano markieren (_grenzfall=true), aber deterministisch durchlassen
// Gibt:  passende Items, sortiert nach Relevanz (höchste zuerst)
// ════════════════════════════════════════════════════════════════════════

const norm = s => String(s ?? '').trim();
const low  = s => norm(s).toLowerCase();

// ---- Stadt-Fakten als Lookup (Region -> Merkmale) ----
let sfItems = [];
try { sfItems = $('Stadt-Fakten lesen').all().map(i => i.json); } catch(e) { sfItems = []; }
const SF = {};
for (const r of sfItems) {
  const reg = norm(r.Region);
  if (reg) SF[reg.toLowerCase()] = r;
}
const sf = reg => SF[low(reg)] || null;
const ja = v => low(v) === 'ja';
// istAusland: Regionstyp enthaelt 'Ausland' -> fuer Auslands-Diversitaets-Bonus in relevanzBerechnen()
// (Pendant zur gleichnamigen Logik in automation/keyword-kombinationen/lib/nodes/relevanz_berechnen.js).
const istAusland = reg => { const r = sf(reg); return r ? low(r.Regionstyp || '').includes('ausland') : false; };

// ---- Sprache je Region: deutschsprachiger Raum -> 'de'; erkannte Auslandsregionen -> Landessprache; unbekannt -> 'en' ----
// REGION_LANG: Region/Land (lowercase) -> ISO-Sprachcode der Landessprache. Bewusst mehrsprachig-
// mehrdeutige Regionen (z. B. Belgien, Luxemburg) sind explizit auf 'en' gesetzt (kein Rateschritt).
// Voellig unbekannte/nicht gelistete Regionen fallen auf 'de' zurueck (bestehendes Verhalten).
const REGION_LANG = {
  'aalst':'nl','aarhus':'da',"alpe d'huez":'fr','amsterdam':'nl','barcelona':'es','belgien':'en',
  'benicàssim':'es','benicassim':'es','bergen':'no','beuningen':'nl','biddinghuizen':'nl','bilbao':'es',
  'boom':'nl','bourges':'fr','brünn':'cs','bruenn':'cs','budapest':'hu','budva':'en','buñol':'es','bunol':'es',
  'české budějovice':'cs','ceske budejovice':'cs','cluj-napoca':'ro',"cortina d'ampezzo":'it',
  'dänemark':'da','daenemark':'da','dessel':'nl','évora':'pt','evora':'pt','frankreich':'fr','gdynia':'pl',
  'genf':'fr','gent':'nl','glastonbury':'en','göteborg':'sv','goeteborg':'sv','grossbritannien':'en',
  'großbritannien':'en','helsinki':'fi','hilvarenbeek':'nl','imola':'it','irland':'en','istanbul':'tr',
  'italien':'it','kiruna':'sv','kopenhagen':'da','kostrzyn':'pl','krakau':'pl','landgraaf':'nl',
  'liepāja':'lv','liepaja':'lv','lissabon':'pt','luxemburg':'en','maastricht':'nl','madrid':'es',
  'mailand':'it','marseille':'fr','miskolc':'hu','montreux':'fr','niederlande':'nl','nizza':'fr',
  'norrköping':'sv','norrkoeping':'sv','novi sad':'sr','nyon':'fr','odense':'da','oslo':'no','ostrava':'cs',
  'oulu':'fi','perth (schottland)':'en','pilton':'en','polen':'pl','porto':'pt','portugal':'pt','pula':'hr',
  'roskilde':'da','rotterdam':'nl','san fermín/pamplona':'es','san fermin/pamplona':'es','seinäjoki':'fi',
  'seinajoki':'fi','sevilla':'es','siena':'it','skanderborg':'da','skopje':'mk','sopron':'hu','spanien':'es',
  'split':'hr','stavern':'no','stockholm':'sv','thessaloniki':'el','tisno':'hr','trenčín':'sk','trencin':'sk',
  'tschechien':'cs','turku':'fi','ungarn':'hu','valencia':'es','venedig':'it','verona':'it','viareggio':'it',
  'werchter':'nl','wiltz':'en','zamárdi':'hu','zamardi':'hu','schweden':'sv','norwegen':'no','finnland':'fi',
  'kroatien':'hr','rumänien':'ro','rumaenien':'ro','serbien':'sr','montenegro':'en','griechenland':'el',
  'lettland':'lv','slowakei':'sk','nordmazedonien':'mk','türkei':'tr','tuerkei':'tr',
  // NEU (Europäisierung nahes Ausland, 2026-08): Benelux/FR/PL/CZ-Städte mit eindeutiger Landessprache.
  // Belgische Städte mit klarer Sprachzugehörigkeit bekommen die Landessprache; 'brüssel' bleibt wie
  // 'belgien' bewusst auf 'en' (zweisprachig FR/NL, keine Ratelösung). AT/CH-Städte brauchen keinen
  // Eintrag (Fallback 'de' ist dort korrekt).
  'straßburg':'fr','strassburg':'fr','lille':'fr','lyon':'fr','binche':'fr',
  'nijmegen':'nl','tilburg':'nl','brüssel':'en','bruessel':'en',
  'luxemburg (stadt)':'fr',
  'poznań':'pl','poznan':'pl','wrocław':'pl','wroclaw':'pl','warschau':'pl',
  'prag':'cs','hradec králové':'cs','hradec kralove':'cs','karlovy vary':'cs'
};
// LANG_META: ISO-Code -> Anzeigename (Landessprache), Flagge, og:locale. Fuer HTML-Ausgabe (Toggle/SEO).
const LANG_META = {
  de:{label:'Deutsch',flag:'🇩🇪',locale:'de_DE'}, en:{label:'English',flag:'🇬🇧',locale:'en_GB'},
  da:{label:'Dansk',flag:'🇩🇰',locale:'da_DK'}, nl:{label:'Nederlands',flag:'🇳🇱',locale:'nl_NL'},
  es:{label:'Español',flag:'🇪🇸',locale:'es_ES'}, no:{label:'Norsk',flag:'🇳🇴',locale:'nb_NO'},
  cs:{label:'Čeština',flag:'🇨🇿',locale:'cs_CZ'}, hu:{label:'Magyar',flag:'🇭🇺',locale:'hu_HU'},
  ro:{label:'Română',flag:'🇷🇴',locale:'ro_RO'}, pt:{label:'Português',flag:'🇵🇹',locale:'pt_PT'},
  pl:{label:'Polski',flag:'🇵🇱',locale:'pl_PL'}, fr:{label:'Français',flag:'🇫🇷',locale:'fr_FR'},
  sv:{label:'Svenska',flag:'🇸🇪',locale:'sv_SE'}, fi:{label:'Suomi',flag:'🇫🇮',locale:'fi_FI'},
  tr:{label:'Türkçe',flag:'🇹🇷',locale:'tr_TR'}, lv:{label:'Latviešu',flag:'🇱🇻',locale:'lv_LV'},
  hr:{label:'Hrvatski',flag:'🇭🇷',locale:'hr_HR'}, sr:{label:'Srpski',flag:'🇷🇸',locale:'sr_RS'},
  mk:{label:'Makedonski',flag:'🇲🇰',locale:'mk_MK'}, el:{label:'Ελληνικά',flag:'🇬🇷',locale:'el_GR'},
  sk:{label:'Slovenčina',flag:'🇸🇰',locale:'sk_SK'}, it:{label:'Italiano',flag:'🇮🇹',locale:'it_IT'}
};
function langFor(region){ const r = low(region); return REGION_LANG[r] || 'de'; } // unbekannte/nicht gelistete Regionen -> 'de' (bestehendes Verhalten)

// BASELINE_LANGS (NEU 2026-09-03, Konzept Mehrsprachige LPs Schritt 2): einheitliche
// 8-Sprachen-Zielliste fuer alle regionslosen LPs (und spaeter alle Nicht-Deutschland-
// Regions-LPs, siehe Konzept_Mehrsprachige-LPs_2026-09-03_v2.md). Bewusst als Array
// hier definiert (nicht importiert -- lib/nodes/*.js laufen ohne require(), siehe
// lib/runCodeNode.js), damit spaetere Ausbaustufen (alle 24 EU-Sprachen) nur diese
// eine Zeile aendern muessen. index.js haelt zusaetzlich lib/i18n.js mit denselben
// 8 Codes synchron (dortige Quelle fuer UI_L10N-Chrome-Texte im neuen Multi-Sprach-Pfad).
const BASELINE_LANGS = ['de','en','fr','it','es','nl','da','pl'];


// ---- Anlass-Klassen ----
const FIXED_INFRA = ['messe','stadionevent','konzertsaal','konzerthaus','konzerthalle']; // feste SAA -> NIKOS unwahrscheinlich. 'Konzert' NICHT pauschal (kann Open-Air sein).
// Anlass -> benötigtes Stadt-Merkmal (Spalte in Stadt-Fakten). Fehlt das Merkmal => unplausibel.
const ANLASS_REQUIRES = {
  'hafenfest':'Festivalort',         // maritime/Sail-Events: über Events/OpenAir abgedeckt; kein hartes Flag mehr
  'open-air-veranstaltung':'OpenAir_Gelaende',
  'festival':'OpenAir_Gelaende',
  'musikfestival':'OpenAir_Gelaende',
  'rave':'OpenAir_Gelaende',
  'baustelle':'Grossbaustellen',
  'karnevalsumzug':'Karnevalshochburg',
  'karneval der kulturen':'Karnevalshochburg',
};
// Anlässe, die überall plausibel sind (kein Region-Filter):
const ANLASS_UNIVERSAL = ['krisenlage','katastrophenschutz-übung','katastrophenschutz-uebung','veranstaltung',
  'großveranstaltung','grossveranstaltung','mobiler einsatz','mobil','temporär','temporaer','zeitweise',
  'kurzzeitig','vstättvo','vstaettvo','stadtfest','volksfest','weihnachtsmarkt','kirmes','jahrmarkt',
  'altstadtfest','familientag','festumzug','gedenkfeier','marathon','stadtlauf','triathlon','sportveranstaltung',
  'firmenveranstaltung','firmenjubiläum','firmenjubilaeum','landesfest','hafengeburtstag','weinfest','schützenfest',
  'schuetzenfest','open-air-veranstaltung','miete',''];

// ---- Problem×Einsatz-Plausibilitätsmatrix ----
// Sicherheits-/Crowd-Probleme passen zu Menschenmengen-Anlässen; technische Probleme zu Bau/Infrastruktur.
const SECURITY_PROBLEM = ['notfalldurchsage','sprachalarmierung','sprachalarmierungsanlage','sprachalarmanlage',
  'räumungsdurchsage','raeumungsdurchsage','evakuierung','notfallwarnsystem','alarmierung','crowd management',
  'besuchersicherheit','besucherlenkung','besucherzählung','besucherzaehlung','durchsageanlage','lautsprecherdurchsage',
  'ansagetechnik','durchsagetechnik','besucherinformation','mobiles durchsagesystem','veranstaltungssicherheit',
  'eventsicherheit','festivalsicherheit','mobile sicherheitstechnik','funkleitstelle','krisenkommunikation',
  'sicherheitskommunikation','dmr-digitalfunk','statusmonitoring','text-to-speech-durchsage','terrorwarnung',
  'sturmwarnung','unwetterwarnung','sicherheitskonzept','din en 50849','elektroakustische notfallwarnsysteme',
  'notfallkommunikationssystem','eventkommunikationssystem','evakuierungsbeschallung',
  'temporäre sicherheitsbeschallung','temporaere sicherheitsbeschallung','ducking-funktion für notfalldurchsagen',
  'mobile evakuierungsanlage ohne kabelverlegung','entfluchtung','evakuierungsansage','hintergrundmusik','werbeansagen'];
const TECH_PROBLEM = ['fernsteuerung','fernüberwachung','fernueberwachung','lichtmast fernsteuern','pumpensteuerung',
  'relay-schaltung','energiemanagement','lastüberwachung','lastueberwachung','baustromüberwachung','baustromueberwachung',
  'spannungsüberwachung','spannungsueberwachung','stromleitungsüberwachung','stromausfallüberwachung',
  'mobile spannungsüberwachung','perimeterschutz','perimeterschutz baustelle','baustellenüberwachung ohne kamera',
  'baustellenüberwachung','zutrittsüberwachung baustelle','öffnungsmelder funk','kontaktschleife überwachung',
  'türkontakt-überwachung','manipulationsüberwachung','sensorbasierter perimeterschutz','bauzaunüberwachung funk',
  'notbeleuchtung','notlicht','notlichtumschaltung','notfallbeleuchtung','led notfall-scheinwerfer',
  'mobile sicherheitsbeleuchtung','din en 1838','din vde 0833-4'];
const TECH_EINSATZ = ['baustelle','krisenlage','katastrophenschutz-übung','katastrophenschutz-uebung','mobiler einsatz',
  'mobil','temporär','temporaer','zeitweise','kurzzeitig','vstättvo','vstaettvo'];

// Problem×Einsatz: 'ok' | 'schwach' (Grenzfall -> nano) | 'unplausibel'
function problemEinsatzScore(problem, einsatz) {
  const p = low(problem), e = low(einsatz);
  if (!p || !e) return 'ok';
  const pSec = SECURITY_PROBLEM.includes(p);
  const pTech = TECH_PROBLEM.includes(p);
  const eTech = TECH_EINSATZ.includes(e);
  // Technik-Problem an Publikums-Event (z.B. Hintergrundmusik×Katastrophenschutz) -> unplausibel
  if (pTech && !eTech) {
    // Notbeleuchtung/Perimeter/Stromausfallueberwachung bei Outdoor-Events (v.a. weitlaeufige Gelaende ohne vollstaendigen optischen Ueberblick) kann sinnvoll sein -> Grenzfall statt hart raus
    if (['notbeleuchtung','perimeterschutz','mobile sicherheitsbeleuchtung','led notfall-scheinwerfer','stromausfallüberwachung'].includes(p)) return 'schwach';
    return 'unplausibel';
  }
  // Sicherheits-Problem an reinem Technik-Einsatz (z.B. Crowd Management×Baustelle) -> Grenzfall
  if (pSec && eTech && ['crowd management','besucherlenkung','besucherzählung','besucherzaehlung','festivalsicherheit'].includes(p)) return 'schwach';
  return 'ok';
}

// ---- Relevanz-Berechnung (falls Sheet-Spalte leer) ----
const BIG_EVENT_ANLASS = ['großveranstaltung','grossveranstaltung','oktoberfest','festival','musikfestival',
  'karnevalsumzug','karneval der kulturen','hafengeburtstag','marathon','volksfest','rave','open-air-veranstaltung'];
// Partner-Nähe: Bundesländer/AT mit Partnerabdeckung (Logistik). Ausland(ohne AT)=schwächer.
const PARTNER_BL = ['baden-württemberg','bayern','berlin','brandenburg','bremen','hamburg','hessen',
  'mecklenburg-vorpommern','niedersachsen','nordrhein-westfalen','rheinland-pfalz','saarland','sachsen',
  'sachsen-anhalt','schleswig-holstein','thüringen','österreich'];
// EUROPÄISIERUNG (nahes Ausland): Benelux, Frankreich, Polen, Schweiz, Österreich, Tschechien, Dänemark
// gelten logistisch als gleichwertig zu Inland (kein Abzug) -- Zielmärkte in Transportreichweite. Nur
// FERNES_AUSLAND (Spanien, Portugal, Italien, Ungarn, UK) wird noch abgewertet (siehe logistik()).
const FERNES_AUSLAND = ['barcelona','italien','spanien','portugal','ungarn','imola','tisno','pula','benicàssim',
  'san fermín/pamplona','buñol','sevilla','valencia','venedig','viareggio','siena','verona','glastonbury',
  'budapest','nyon','lissabon','mailand'];
// Rückwärtskompatibler Alias, falls andere Nodes/Referenzen noch den alten Namen erwarten.
const AUSLAND_OHNE_PARTNER = FERNES_AUSLAND;

function groesseZuschlag(reg, einsatz) {
  const r = sf(reg); const kl = r ? low(r.Groessenklasse) : '';
  let s = 0;
  if (['metropole','land'].includes(kl)) s = 2;
  else if (['großstadt','grossstadt','bundesland'].includes(kl)) s = 1;
  if (BIG_EVENT_ANLASS.includes(low(einsatz))) s += 1;
  return Math.min(s, 3);
}
function logistik(reg) {
  const rl = low(reg);
  // Fernes Ausland (ES/PT/IT/HU/UK) bleibt abgewertet, außer bekannte AT/CH-Partnerstädte-Regex greift.
  if (FERNES_AUSLAND.includes(rl)) return rl.match(/wien|graz|linz|salzburg|innsbruck|zürich|bern|genf|basel/) ? 1 : 0;
  return 1; // DE/AT sowie nahes Ausland (Benelux/FR/PL/CZ/DK) -> gleichauf (Europäisierung)
}
function relevanzBerechnen(problem, einsatz, reg, pe) {
  const regionLeer = !norm(reg);
  const r = sf(reg);
  const aktuell = r && norm(r.Aktuell) !== '';
  const events  = r ? low(r.Events) : '';
  const wiederk = events && (
    events.includes(low(einsatz)) ||
    (low(einsatz).includes('karneval') && events.includes('karneval')) ||
    (low(einsatz).includes('marathon') && events.includes('marathon')) ||
    (low(einsatz).includes('weihnacht') && events.includes('weihnacht'))
  );
  let lo, hi, base;
  if (aktuell) { base = 8; lo = 7; hi = 10; }
  else if (wiederk) { base = 7; lo = 6; hi = 9; }
  else if (regionLeer && pe === 'ok') {
    // Ueberregionaler Einsatz ohne feste Region (z. B. Baustellen bundesweit): kein Stadt-Fakten-Abgleich
    // moeglich, aber Problem x Einsatz ist eine plausible, dauerhaft gesuchte Kombination -> wie
    // "wiederkehrend" behandeln statt pauschal niedrig zu bewerten (statt base=3).
    base = 7; lo = 6; hi = 9;
  }
  else { base = 3; lo = 1; hi = 5; }
  let score = base;
  score += groesseZuschlag(reg, einsatz);
  if (logistik(reg) >= 2) score += 1;
  if (logistik(reg) === 0) score -= 1;
  // AUSLAND-DIVERSITAETS-BONUS (2026-08-31): siehe Pendant in keyword-kombinationen/relevanz_berechnen.js —
  // aktuelle/wiederkehrende Auslands-Events sollen bei der LP-Auswahl nicht benachteiligt, sondern
  // bevorzugt werden (groessere geografische Diversitaet der generierten Landingpages).
  if ((aktuell || wiederk) && istAusland(reg)) score += 1;
  if (SECURITY_PROBLEM.includes(low(problem))) score += 1;
  if (FIXED_INFRA.includes(low(einsatz))) return Math.max(1, Math.min(score - 4, 4));
  return Math.max(lo, Math.min(score, hi));
}

// ════════════════════════════════════════════════════════════════════════
const items = $input.all();
const out = [];
for (const it of items) {
  const j = it.json;
  const erstellen = low(j.erstellen);
  const slug = norm(j.slug);
  if (erstellen !== 'x' || slug !== '') continue;   // Grundfilter (wie bisher)

  const problem = norm(j.Problem), einsatz = norm(j.Einsatz), region = norm(j.Region);

  // HARTER Filter 1: feste Infrastruktur
  if (FIXED_INFRA.includes(low(einsatz))) continue;

  // HARTER Filter 2: Einsatz×Region gegen Stadt-Fakten (nur wenn Merkmal gefordert + Region bekannt)
  const reqCol = ANLASS_REQUIRES[low(einsatz)];
  if (reqCol && !ANLASS_UNIVERSAL.includes(low(einsatz))) {
    const r = sf(region);
    if (r && !ja(r[reqCol])) continue;   // Merkmal fehlt -> unplausibel, überspringen
  }

  // Filter 3: Problem×Einsatz-Plausibilität
  const pe = problemEinsatzScore(problem, einsatz);
  if (pe === 'unplausibel') continue;
  const grenzfall = (pe === 'schwach');

  // Relevanz: Sheet-Spalte bevorzugen, sonst berechnen
  let rel = parseInt(norm(j.Relevanz), 10);
  if (!Number.isFinite(rel) || rel < 1 || rel > 10) rel = relevanzBerechnen(problem, einsatz, region, pe);

  const rInfo = sf(region);
  const einwohner = rInfo ? (Number.isFinite(Number(rInfo.Einwohner)) ? Number(rInfo.Einwohner) : null) : null;
  // _regionstyp/_grossregion: Bundesland/Land-Regionen umfassen immer mehrere Orte -> generische
  // Gattungsbegriffe (Volksfest/Weinfest/...) muessen dort IMMER Plural sein (NUMERUS-Regel), unabhaengig
  // von der (bei Bundeslaendern ohnehin leeren) Einwohnerzahl. Siehe LANDINGPAGES_Textbausteine.md + QA-Agent Regel 11.
  const regionstyp = rInfo ? norm(rInfo.Regionstyp) : '';
  const _grossregion = /^(bundesland|land)$/i.test(regionstyp);
  const _lc = langFor(region);
  const _lm = LANG_META[_lc] || LANG_META.en;
  const _lmode = _lc === 'de' ? 'single-de' : (_lc === 'en' ? 'single-en' : 'dual');
  // _ml/_target_langs (NEU 2026-09-03): regionslose Kombinationen (Region leer) gehen ab
  // sofort ueber den neuen Multi-Sprach-Pfad (siehe index.js) mit der 8er-Baseline. Rein
  // additiv -- Kombinationen MIT Region behalten exakt das bisherige Verhalten (index.js
  // prueft _ml und faellt sonst unveraendert auf den bestehenden Single-/Dual-Pfad zurueck).
  out.push({ json: { ...j, _relevanz: rel, _grenzfall: grenzfall, _lang: _lc, _lang_label: _lm.label, _lang_flag: _lm.flag, _lang_locale: _lm.locale, _lang_mode: _lmode, _einwohner: einwohner, _regionstyp: regionstyp, _grossregion: _grossregion, _ml: !region, _target_langs: !region ? BASELINE_LANGS.slice() : null } });
}

// Sortierung: höchste Relevanz zuerst (10 -> 1)
out.sort((a, b) => b.json._relevanz - a.json._relevanz);
// Dedup: identische Kombination (gleicher slug) pro Lauf nur 1x bauen (verhindert GitHub-SHA-Konflikt).
// Verschiedene Kombinationen bleiben erhalten (gewollte Duplikate wie Berlin+Marathon / Berlin+Silvester).
function slugKey(j){
  const s=[j.Problem,j.Einsatz,j.Region].filter(Boolean).join('-').toLowerCase().trim()
    .replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  return s.substring(0,75);
}
const seen=new Set(); const dedup=[];
for(const it of out){ const k=slugKey(it.json); if(seen.has(k)) continue; seen.add(k); dedup.push(it); }
// Pro Lauf nur die Top-N relevantesten (verschiedenen) Kombinationen bauen
const MAX_PRO_LAUF = 5;
return dedup.slice(0, MAX_PRO_LAUF);

