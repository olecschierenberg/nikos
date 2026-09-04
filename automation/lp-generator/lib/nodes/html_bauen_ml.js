// NEU (2026-09-03, kein n8n-Vorbild): HTML-Bauer fuer den NEUEN Multi-Sprach-
// URL-Schema-Pfad (nikos.info/<lang>/lp/<slug>/), siehe
// /nikos/Konzept_Mehrsprachige-LPs_2026-09-03_v2.md. Baut GENAU EINE
// einsprachige, eigenstaendige Seite (kein data-de/data-en-Toggle wie im
// Alt-Pfad lib/nodes/html_bauen.js -- dieser bleibt vollstaendig unangetastet
// und unveraendert fuer alle bestehenden/unmigrierten LPs).
//
// Erwartet $json = {
//   lang, isPrimary, fields:{headline,subhead,intro,usp_intro,usp,
//     faq1_q,faq1_a,...,faq4_a,slug_kw}, region, einsatz, problem,
//   uiL10n:{...UI_L10N[lang]}, langMeta:{label,flag,locale},
//   siblings:[{lang,slug,url}, ...alle erfolgreichen Sprachen inkl. sich
//     selbst], defaultLang:'de', robots:'' | '<meta name="robots" ...>'
// }
// Gibt { json:{ lang, slug, url, previewHtml, html, title, linkTitle } }.

function cleanForSlug(t){ if(!t) return ''; var s=t.toString().toLowerCase().trim();
  s=s.replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss');
  s=s.replace(/ı/g,'i').replace(/ğ/g,'g').replace(/ş/g,'s').replace(/ł/g,'l').replace(/ø/g,'o').replace(/đ/g,'d');
  if(s.normalize){ s=s.normalize('NFKD').replace(/[̀-ͯ]/g,''); }
  return s.replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''); }
function trimSlug(s){ s=cleanForSlug(s); if(s.length<=80) return s.replace(/^-+|-+$/g,'');
  var c=s.substring(0,80), i=c.lastIndexOf('-'); if(i>40) c=c.substring(0,i); return c.replace(/^-+|-+$/g,''); }
function splitCo(t){ t=(t||'').toString(); var i=t.indexOf(': '); return i>=0?t.slice(0,i):t; }
function clampByBoundary(t,max,minBreak){ t=(t||'').toString().replace(/\s+/g,' ').trim(); if(t.length<=max) return t;
  var w=t.slice(0,max); var lastEnd=Math.max(w.lastIndexOf('. '),w.lastIndexOf('! '),w.lastIndexOf('? '));
  if(lastEnd>minBreak) return w.slice(0,lastEnd+1).trim();
  if(/[.!?]/.test(w.slice(-1))&&w.length>minBreak) return w.trim();
  var budget=max-1; var s=t.slice(0,budget); var i=s.lastIndexOf(' '); if(i>minBreak) s=s.slice(0,i);
  return s.replace(/[\s.,;:–-]+$/,'')+'…'; }
function clampTitle(t,max){ return clampByBoundary(t,max,30); }
function clampDesc(t,max){ return clampByBoundary(t,max,60); }
function buildTitle(shortHead){ var suf=' – NIKOS'; var max=60-suf.length; return clampTitle(shortHead,max)+suf; }
function esc(s){ return s==null?'':String(s); }

// Hero-Bildauswahl + NIKOS-Modul-Icon-Verlinkung: sprachunabhaengige,
// deterministische Nachbearbeitung -- 1:1 dieselbe Logik wie
// lib/nodes/feinschliff.js (dort fuer den Alt-Pfad belassen), hier separat
// eingebettet, da feinschliff.js von einer data-de/data-en-Struktur ausgeht,
// die neue einsprachige Seiten nicht mehr haben.
function pickIdx(key,n){ var h=0; key=(key||'').toString(); for(var i=0;i<key.length;i++){ h=((h<<5)-h+key.charCodeAt(i))|0; } return Math.abs(h)%n; }
function heroFor(ev){ ev=(ev||'').toLowerCase();
  if(/\bchio\b|reitturnier|pferdesport|springreiten|dressur|vielseitigkeit/.test(ev)) return ['CHIO.jpg','CHIO Aachen – Pferdesport'];
  if(/oktoberfest|wiesn|volksfest/.test(ev)) return ['Volksfest.jpg','Volksfest'];
  if(/schützenfest|schuetzenfest/.test(ev)) return ['Volksfest.jpg','Volksfest'];
  if(/gillamoos/.test(ev)) return ['Volksfest.jpg','Volksfest'];
  if(/tattoo/.test(ev)) return ['Tattoo.jpg','Basel Tattoo'];
  if(/csd|christopher street|pride/.test(ev)) return ['CSD.jpg','CSD'];
  if(/karneval|fastnacht|fasching|umzug|parade|festumzug|rosenmontag/.test(ev)) return ['Festumzug.jpg','Festumzug'];
  if(/marathon|stadtlauf/.test(ev)) return ['Marathon.jpg','Marathon'];
  if(/triathlon|sportevent|stadion|fanmeile|fanzone|fan-zone/.test(ev)) return ['Sportevent.jpg','Sportevent'];
  if(/weihnachtsmarkt|christkindl|adventsmarkt|weihnachtsdorf/.test(ev)) return ['Weihnachtsmarkt.jpg','Weihnachtsmarkt'];
  if(/hafenfest|hafengeburtstag|sail bremerhaven/.test(ev)) return ['Hafen.jpg','Hafen'];
  if(/lange nacht der museen|museumsnacht/.test(ev)) return ['Museum.jpg','Lange Nacht der Museen'];
  if(/tag der bundeswehr/.test(ev)) return ['Bundeswehr.jpg','Tag der Bundeswehr'];
  if(/großveranstaltung|grossveranstaltung/.test(ev)) return ['Kirchentag.jpg','Großveranstaltung'];
  if(/fre(?:ß|ss)gassfest/.test(ev)) return ['Stadtfest.jpg','Freßgassfest'];
  if(/stadtfest|altstadtfest|cityfest|city-fest|buergerfest|bürgerfest|rakoczy|tag der niedersachsen/.test(ev)) return ['Stadtfest.jpg','Stadtfest'];
  if(/straßenfest|strassenfest/.test(ev)) return ['Anwendungen.jpg','Straßenfest'];
  if(/kirchentag|katholikentag/.test(ev)) return ['Kirchentag.jpg','Kirchentag'];
  if(/weinfest|wurstmarkt|winzerfest|weinmarkt/.test(ev)) return ['Weinfest.jpg','Weinfest'];
  if(/jahrmarkt|kirmes|rummel|freimarkt|kram(er)?markt|hamburger dom|\bdom\b|wasen|cranger|annafest|plärrer|plaerrer/.test(ev)) return ['Jahrmarkt.jpg','Jahrmarkt'];
  if(/\bwacken\b|rock am ring|rock im park|berlin festival|lollapalooza|tomorrowland|glastonbury/.test(ev)) return ['Festival.jpg','Festival'];
  if(/festival|musikfestival|open[\s-]?air|rave|bergenfest/.test(ev)){ var fp=['Festival.jpg','Stage.jpg'][pickIdx(ev+'|fest-pick',2)]; return [fp, fp==='Stage.jpg'?'Stage':'Festival']; }
  if(/baustelle/.test(ev)) return ['Baustelle.jpg','Baustelle'];
  if(/krisenlage|katastrophenschutz|katastrophe/.test(ev)) return ['Krisenlage.jpg','Krisenlage'];
  if(/firmenveranstaltung|betriebsfeier|firmenfeier|firmenevent/.test(ev)) return ['Firmenveranstaltung.jpg','Firmenveranstaltung'];
  if(/jubiläum|jubilaeum/.test(ev)) return ['Jubiläumsfeier.jpg','Jubiläumsfeier'];
  if(/parkfest/.test(ev)) return ['Parkfest.jpg','Parkfest'];
  if(/bundesgartenschau|landesgartenschau|gartenschau|\bbuga\b|\biga\b/.test(ev)) return ['Parkfest.jpg','Parkfest'];
  if(/tag der deutschen einheit/.test(ev)) return ['Jubiläumsfeier.jpg','Tag der deutschen Einheit'];
  if(/\b\w+-tag\b|hessentag|bayerntag|landesfest/.test(ev)) return ['Stadtfest.jpg','Landesfest'];
  return ['Gedenkveranstaltung.jpg','Gedenkveranstaltung']; }
var NKMOD_CSS = '.nk-mod{display:inline-block;vertical-align:baseline}\n.nk-mod img{height:0.95em;width:auto;max-width:none;display:inline-block;vertical-align:-0.23em;transition:opacity .15s}\n.nk-mod:hover img{opacity:.6}\n';
function modLogos(x){ return x.replace(/NIKOS \[([A-Za-z0-9]+)\](?:²|&sup2;)/g,function(m,name){ var a=(name==='audio'||name==='dispatcher'||name==='moon')?name:'zubehoer';
  return '<a class="nk-mod" href="'+NAV_URLS.products+'#'+a+'"><img src="https://nikos.info/assets/logos/nikos/SVG/NIKOS '+name+'.svg" alt="NIKOS ['+name+']²" loading="lazy"></a>'; }); }
var NIKOSLOGO = '<a class="nk-mod" href="https://nikos.info/index.html"><img src="https://nikos.info/assets/logos/nikos/SVG/NIKOS.svg" alt="NIKOS" loading="lazy"></a>';
function nkWordInner(inner){ var st=[]; inner=inner.replace(/<a class="nk-mod[^>]*>[\s\S]*?<\/a>/g,function(mm){ st.push(mm); return '%%NKM'+(st.length-1)+'%%'; });
  inner=inner.replace(/NIKOS(?!-|[A-Za-z0-9²]| \[)/g,NIKOSLOGO); inner=inner.replace(/%%NKM(\d+)%%/g,function(mm,i){ return st[+i]; }); return inner; }
function nikosWord(x){ x=x.replace(/<div class="faq-item__body"([^>]*)>([\s\S]*?)<\/div>/g,function(m,a,inner){ return '<div class="faq-item__body"'+a+'>'+nkWordInner(inner)+'</div>'; });
  x=x.replace(/<p class="body-l"([^>]*)>([\s\S]*?)<\/p>/g,function(m,a,inner){ return '<p class="body-l"'+a+'>'+nkWordInner(inner)+'</p>'; }); return x; }

// ── Eingaben ─────────────────────────────────────────────────────────────
const j = $json;
const lang = j.lang;
const f = j.fields || {};
const LOC = j.uiL10n || {};
const lm = j.langMeta || { label: lang, flag: '🏳️', locale: lang };
const region = j.region || '', einsatz = j.einsatz || '', problem = j.problem || '';
const defaultLang = j.defaultLang || 'de';
const siblings = j.siblings || [];
const self = siblings.find(s => s.lang === lang) || null;

const slugCore = trimSlug(f.slug_kw && lang !== defaultLang ? f.slug_kw : (problem + ' ' + einsatz));
const slug = self ? self.slug : trimSlug([slugCore, region].filter(Boolean).join('-'));
const url = 'https://nikos.info/' + lang + '/lp/' + slug + '/';
const defaultSib = siblings.find(s => s.lang === defaultLang) || siblings[0];
const canonical = url;

const title = buildTitle(splitCo(f.headline));
const metaDesc = clampDesc(f.intro, 155);
const uspFull = (f.usp_intro ? (f.usp_intro + ' ') : '') + (f.usp || '');
const hf = heroFor(einsatz + ' ' + problem);
const HERO = 'https://nikos.info/assets/img/Banner/' + hf[0];
const HALT = 'NIKOS – ' + hf[1];
const OBJPOS = (hf[0] === 'Hafen.jpg' || hf[0] === 'Stage.jpg') ? ' style="object-position:center bottom"' : '';

const jsonldObj = { '@context': 'https://schema.org', '@type': 'FAQPage',
  mainEntity: [1,2,3,4].map(n => ({ '@type': 'Question', name: esc(f['faq'+n+'_q']), acceptedAnswer: { '@type': 'Answer', text: esc(f['faq'+n+'_a']) } })) };
if (region) jsonldObj.about = { '@type': 'Place', name: region };
const jsonldStr = '<script type="application/ld+json">\n' + JSON.stringify(jsonldObj, null, 2) + '\n<' + '/script>';

const hreflangLinks = siblings.map(s => '<link rel="alternate" hreflang="' + s.lang + '" href="' + s.url + '">').join('\n')
  + (defaultSib ? ('\n<link rel="alternate" hreflang="x-default" href="' + defaultSib.url + '">') : '');

const switcherItems = siblings.map(s => {
  const active = s.lang === lang ? ' active' : '';
  const flag = (s.lang === lang) ? lm.flag : ((s.meta && s.meta.flag) || '🏳️');
  const label = (s.lang === lang) ? lm.label : ((s.meta && s.meta.label) || s.lang.toUpperCase());
  return '<a class="lang-flag__option' + active + '" href="' + s.url + '"><span class="flag">' + flag + '</span> ' + esc(label) + '</a>';
}).join('\n          ');

// ── CSS (identisch zum Alt-Pfad-Design, Toggle-Regeln entfernt) ─────────
const CSS = "*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}\n:root{\n  --brand-orange:#FF6600;--brand-orange-dk:#E05500;\n  --brand-dark:#4D4D4D;--brand-mid:#595959;--brand-light:#999999;\n  --surface-primary:#FFFFFF;--surface-secondary:#E3E6EA;--surface-tertiary:#C7CBD1;--border-default:#B5BBC2;\n  --card-soft:#FFFFFF;--sec-dark:#253341;--surface-footer:#2E3236;--card-border:#D8DCE0;--banner-bar:#1D2F49;\n  --orange:var(--brand-orange);--orange-dk:var(--brand-orange-dk);--dark:var(--brand-dark);--mid:var(--brand-mid);--light:var(--brand-light);\n  --white:var(--surface-primary);--s2:var(--surface-secondary);--s3:var(--surface-tertiary);--border:var(--border-default);\n  --font:'Source Sans 3',system-ui,sans-serif;--claim:'Exo 2',system-ui,sans-serif;\n  --r:4px;--r-lg:4px;\n  --shadow:0 1px 3px rgba(30,42,53,.06),0 4px 14px rgba(30,42,53,.08);\n  --shadow-lg:0 8px 32px rgba(30,42,53,.14);\n  --max-w:1280px;\n}\nhtml{font-size:16px;scroll-behavior:smooth}\nbody{font-family:var(--font);color:var(--dark);background:var(--white);line-height:1.6;-webkit-font-smoothing:antialiased}\na{color:inherit}\n.heading-l{font-size:clamp(24px,3vw,40px);font-weight:700;line-height:1.2;color:var(--dark);font-family:var(--claim);hyphens:auto;-webkit-hyphens:auto;-ms-hyphens:auto;overflow-wrap:break-word}\n.heading-m{font-size:clamp(20px,2.2vw,28px);font-weight:700;line-height:1.3;color:var(--dark);font-family:var(--claim);hyphens:auto;-webkit-hyphens:auto;-ms-hyphens:auto;overflow-wrap:break-word}\n.body-l{font-size:18px;font-weight:400;line-height:1.65;color:var(--dark);hyphens:auto;-webkit-hyphens:auto;-ms-hyphens:auto;overflow-wrap:break-word}\n.nk-label{font-family:var(--font);font-size:15px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--orange);display:inline-block}\n.btn-primary{display:inline-block;background:var(--orange);color:#fff;padding:12px 28px;border-radius:var(--r);font-size:17px;font-weight:600;text-decoration:none;border:none;cursor:pointer;font-family:var(--font);transition:background .15s,transform .12s}\n.btn-primary:hover{background:var(--orange-dk);transform:translateY(-1px)}\n.btn-secondary{display:inline-block;background:transparent;color:var(--dark);padding:11px 28px;border-radius:var(--r);font-size:17px;font-weight:600;text-decoration:none;border:1px solid var(--border);cursor:pointer;font-family:var(--font);transition:border-color .15s,color .15s}\n.btn-secondary:hover{border-color:var(--orange);color:var(--orange)}\n.nk-nav{position:sticky;top:0;z-index:100;background:var(--white);border-bottom:4px solid var(--orange);box-shadow:0 1px 12px rgba(0,0,0,.06)}\n.nav__inner{max-width:var(--max-w);margin:0 auto;padding:0 24px;height:60px;display:flex;align-items:center;gap:16px}\n.nav__logo{height:60px;display:flex;align-items:center;flex-shrink:0;margin-right:32px}\n.nav__logo svg{height:26px;width:auto;display:block}\n.nav__links{display:flex;align-items:center;gap:16px;list-style:none;flex-wrap:nowrap;min-width:0;flex:1;overflow:hidden}\n.nav__links a{font-size:16px;color:var(--mid);text-decoration:none;font-weight:600;transition:color .15s;white-space:nowrap}\n.nav__links a:hover,.nav__links a.active{color:var(--orange)}\n.nav__right{display:flex;align-items:center;gap:8px;flex-shrink:0;margin-left:auto}\n.nav__cta{background:var(--orange)!important;color:#fff!important;padding:6px 14px;border-radius:var(--r);font-weight:600!important;white-space:nowrap;text-decoration:none;font-size:12px;transition:background .15s;line-height:1.4}\n.nav__cta:hover{background:var(--orange-dk)!important}\n.nav__cta-sec{display:inline-block;background:transparent;color:var(--dark,#4D4D4D);padding:5px 13px;border-radius:var(--r,6px);font-weight:600;white-space:nowrap;text-decoration:none;font-size:12px;line-height:1.4;border:1px solid var(--border,#E0E0E0);transition:border-color .15s,color .15s}\n.nav__cta-sec:hover{border-color:var(--orange);color:var(--orange)}\n@media(max-width:1180px){.nav__cta-sec{display:none!important}}\n.lang-flag{position:relative;flex-shrink:0}\n.lang-flag__btn{display:flex;align-items:center;gap:5px;padding:5px 8px;border:1px solid var(--border);border-radius:var(--r);background:var(--s2);cursor:pointer;font-family:var(--font);font-size:12px;font-weight:600;color:var(--dark);transition:border-color .15s;line-height:1;white-space:nowrap}\n.lang-flag__btn:hover{border-color:var(--orange)}\n.lang-flag__dropdown{position:absolute;top:calc(100% + 6px);right:0;background:#fff;border:1px solid var(--border);border-radius:var(--r);box-shadow:var(--shadow);min-width:160px;overflow:hidden;display:none;z-index:200}\n.lang-flag__dropdown.open{display:block}\n.lang-flag__option{display:flex;align-items:center;gap:8px;width:100%;padding:9px 14px;border:none;background:none;cursor:pointer;font-family:var(--font);font-size:14px;color:var(--dark);text-align:left;text-decoration:none}\n.lang-flag__option:hover{background:var(--s2)}\n.lang-flag__option.active{color:var(--orange);font-weight:700}\n.nav__burger{display:none;flex-direction:column;gap:4px;background:none;border:none;cursor:pointer;padding:8px}\n.nav__burger span{width:22px;height:2px;background:var(--dark);display:block}\n.nav__mobile{display:none;background:#fff;border-bottom:1px solid var(--border)}\n.nav__mobile.open{display:block}\n.nav__mobile ul{list-style:none;padding:12px 24px}\n.nav__mobile li{padding:8px 0}\n.nav__mobile a{color:var(--mid);text-decoration:none;font-weight:600}\n.nk-banner{position:relative;width:100%}\n.nk-banner__img{position:relative;height:clamp(200px,28vw,300px);overflow:hidden;background:var(--sec-dark)}\n.nk-banner__img img{width:100%;height:100%;object-fit:cover;object-position:center;display:block}\n.nk-banner__img::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 45%,rgba(0,0,0,.20) 70%,rgba(0,0,0,.55) 100%)}\n.nk-banner__claim{position:absolute;inset:0;z-index:2;display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-end;text-align:left;padding:0 clamp(20px,5vw,80px) 30px}\n.nk-banner__claim h1{font-family:var(--claim);font-weight:600;color:#fff;font-size:clamp(28px,4vw,46px);line-height:1.05;margin:0;text-shadow:0 2px 16px rgba(0,0,0,.45)}\n.nk-banner__bar{background:var(--banner-bar);display:flex;align-items:center;gap:clamp(16px,3vw,32px);padding:16px clamp(20px,5vw,80px);flex-wrap:wrap}\n.nk-banner__kw{flex:1 1 220px;font-family:var(--claim);font-weight:600;color:#fff;font-size:clamp(18px,2vw,22px);display:flex;align-items:center;gap:14px;flex-wrap:wrap;min-width:200px}\n.nk-banner__kw .dot{width:7px;height:7px;border-radius:50%;background:var(--orange);display:inline-block;position:relative;top:-0.08em}\n.intro-s2{background:var(--s2);padding:48px 0}\n.intro-s2__inner{max-width:var(--max-w);margin:0 auto;padding:0 clamp(20px,5vw,80px)}\n.nk-section{padding:56px 0 72px}\n.nk-section--surface{background:var(--s2)}\n.nk-section__inner{max-width:var(--max-w);margin:0 auto;padding:0 clamp(20px,5vw,80px)}\n.nk-section__header{margin-bottom:32px}\n.faq-list{max-width:900px;display:flex;flex-direction:column;gap:14px}\n.faq-item{background:var(--card-soft);border:1.5px solid var(--card-border);border-radius:var(--r-lg);box-shadow:var(--shadow);overflow:hidden}\n.faq-item summary{list-style:none;cursor:pointer;padding:20px 24px;font-family:var(--claim);font-weight:700;font-size:18px;color:var(--dark);display:flex;justify-content:space-between;align-items:center;gap:16px}\n.faq-item summary::-webkit-details-marker{display:none}\n.faq-q{flex:1}\n.faq-icon{color:var(--orange);font-size:26px;font-weight:400;line-height:1;flex-shrink:0;margin-left:auto;transition:transform .2s}\n.faq-item[open] .faq-icon{transform:rotate(45deg)}\n.faq-item__body{padding:0 24px 22px;color:var(--mid);font-size:16px;line-height:1.7;hyphens:auto;-webkit-hyphens:auto;-ms-hyphens:auto;overflow-wrap:break-word}\n.cta-band{background:var(--white);padding:56px 0 72px}\n.cta-band__card{max-width:720px;margin:0 auto;background:var(--sec-dark);border-radius:var(--r-lg);box-shadow:var(--shadow-lg);padding:44px clamp(24px,5vw,56px);text-align:center}\n.cta-band h2{font-family:var(--claim);color:#fff;font-size:clamp(22px,2.6vw,32px);margin-bottom:10px}\n.cta-band p{color:#C8D0D8;margin-bottom:24px;font-size:18px}\n.lp-footer{background:var(--surface-footer);color:#C8CDD2;padding:40px 0 28px}\n.lp-footer__inner{max-width:var(--max-w);margin:0 auto;padding:0 clamp(20px,5vw,80px);display:flex;flex-wrap:wrap;gap:24px;align-items:center;justify-content:space-between}\n.lp-footer__links{list-style:none;display:flex;flex-wrap:wrap;gap:18px;font-size:14px}\n.lp-footer__links a{color:#C8CDD2;text-decoration:none}\n.lp-footer__links a:hover{color:var(--orange)}\n.lp-footer__copy{font-size:14px;color:#C8CDD2}\n@media(max-width:900px){\n  .nav__links{display:none !important}\n  .nav__burger{display:flex !important}\n  .lp-footer__inner{flex-direction:column;align-items:flex-start}\n}\n" + NKMOD_CSS;

const NAV_URLS = (lang==='de') ? {
  system: 'https://nikos.info/de/system/', apps: 'https://nikos.info/de/anwendungen/', products: 'https://nikos.info/de/produkte/',
  refs: 'https://nikos.info/de/referenzen/', rental: 'https://nikos.info/de/vermietung/', insights: 'https://nikos.info/de/wissen/',
  contact: 'https://nikos.info/de/kontakt/', terms: 'https://nikos.info/de/agb/', rentalterms: 'https://nikos.info/de/mietbedingungen/',
  privacy: 'https://nikos.info/de/datenschutz/', legal: 'https://nikos.info/de/impressum/'
} : {
  system: 'https://nikos.info/en/system/', apps: 'https://nikos.info/en/applications/', products: 'https://nikos.info/en/products/',
  refs: 'https://nikos.info/en/references/', rental: 'https://nikos.info/en/rental/', insights: 'https://nikos.info/en/insights/',
  contact: 'https://nikos.info/en/contact/', terms: 'https://nikos.info/en/terms/', rentalterms: 'https://nikos.info/en/rental-terms/',
  privacy: 'https://nikos.info/en/privacy/', legal: 'https://nikos.info/en/imprint/'
};

const NAV_LINKS = '\n    <ul class="nav__links">\n      <li><a href="' + NAV_URLS.system + '">' + esc(LOC.NAV_SYSTEM) + '</a></li>\n      <li><a href="' + NAV_URLS.apps + '">' + esc(LOC.NAV_APPS) + '</a></li>\n      <li><a href="' + NAV_URLS.products + '">' + esc(LOC.NAV_PRODUCTS) + '</a></li>\n      <li><a href="' + NAV_URLS.refs + '">' + esc(LOC.NAV_REFS) + '</a></li>\n      <li><a href="' + NAV_URLS.rental + '">' + esc(LOC.NAV_RENTAL) + '</a></li>\n      <li><a href="' + NAV_URLS.insights + '">' + esc(LOC.NAV_INSIGHTS) + '</a></li>\n    </ul>\n    <div class="nav__right">\n      <a href="https://nikos.info/de/vermietung/#partnerauswahl" class="nav__cta-sec">' + esc(LOC.NAV_RENTNOW) + '</a><a href="' + NAV_URLS.contact + '" class="nav__cta">' + esc(LOC.NAV_CONTACT) + '</a>\n      <div class="lang-flag" id="langFlag">\n        <button class="lang-flag__btn" id="langFlagBtn" aria-haspopup="true" aria-expanded="false"><span class="flag">' + esc(lm.flag) + '</span><span class="chevron">▾</span></button>\n        <div class="lang-flag__dropdown" id="langFlagDropdown" role="listbox">\n          ' + switcherItems + '\n        </div>\n      </div>\n    </div>\n    <button class="nav__burger" id="navBurger" aria-label="Menu"><span></span><span></span><span></span></button>';

const NAV_MOBILE = '<div class="nav__mobile" id="navMobile"><ul>\n    <li><a href="' + NAV_URLS.system + '">' + esc(LOC.NAV_SYSTEM) + '</a></li>\n    <li><a href="' + NAV_URLS.apps + '">' + esc(LOC.NAV_APPS) + '</a></li>\n    <li><a href="' + NAV_URLS.products + '">' + esc(LOC.NAV_PRODUCTS) + '</a></li>\n    <li><a href="' + NAV_URLS.refs + '">' + esc(LOC.NAV_REFS) + '</a></li>\n    <li><a href="' + NAV_URLS.rental + '">' + esc(LOC.NAV_RENTAL) + '</a></li>\n    <li><a href="' + NAV_URLS.insights + '">' + esc(LOC.NAV_INSIGHTS) + '</a></li>\n    <li><a href="' + NAV_URLS.contact + '">' + esc(LOC.NAV_CONTACT) + '</a></li>\n  </ul></div>';

function faqBlock(n){
  return '      <details class="faq-item">\n        <summary><span class="faq-q">' + esc(f['faq'+n+'_q']) + '</span><span class="faq-icon">+</span></summary>\n        <div class="faq-item__body">' + esc(f['faq'+n+'_a']) + '</div>\n      </details>';
}

let html = '<!DOCTYPE html>\n<html lang="' + lang + '">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<link rel="icon" type="image/x-icon" href="https://nikos.info/assets/logos/A.ico">\n' + (j.robots || '') + '\n<title>' + esc(title) + '</title>\n<meta name="description" content="' + esc(metaDesc) + '">\n<link rel="canonical" href="' + canonical + '">\n' + hreflangLinks + '\n\n<meta property="og:type" content="website">\n<meta property="og:url" content="' + canonical + '">\n<meta property="og:title" content="' + esc(title) + '">\n<meta property="og:description" content="' + esc(metaDesc) + '">\n<meta property="og:image" content="https://nikos.info/assets/img/Banner/NIKOS-Hero4.jpg">\n<meta property="og:locale" content="' + esc(lm.locale) + '">\n<meta property="og:site_name" content="NIKOS – Kommunikationsplattform von RADACOM">\n<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:title" content="' + esc(title) + '">\n<meta name="twitter:description" content="' + esc(metaDesc) + '">\n<meta name="twitter:image" content="https://nikos.info/assets/img/Banner/NIKOS-Hero4.jpg">\n\n<!-- FAQPage-Schema -->\n' + jsonldStr + '\n\n<style>\n@font-face{font-family:\'Source Sans 3\';font-style:normal;font-weight:300 700;font-display:swap;src:url(\'https://nikos.info/assets/fonts/SourceSans3-VariableFont_wght.woff2\') format(\'woff2-variations\'),url(\'https://nikos.info/assets/fonts/SourceSans3-VariableFont_wght.ttf\') format(\'truetype-variations\');}\n@font-face{font-family:\'Source Sans 3\';font-style:italic;font-weight:300 700;font-display:swap;src:url(\'https://nikos.info/assets/fonts/SourceSans3-Italic-VariableFont_wght.woff2\') format(\'woff2-variations\'),url(\'https://nikos.info/assets/fonts/SourceSans3-Italic-VariableFont_wght.ttf\') format(\'truetype-variations\');}\n@font-face{font-family:\'Exo 2\';font-style:normal;font-weight:400 700;font-display:swap;src:url(\'https://nikos.info/assets/fonts/Exo2-VariableFont_wght.woff2\') format(\'woff2-variations\'),url(\'https://nikos.info/assets/fonts/Exo2-VariableFont_wght.ttf\') format(\'truetype-variations\');}\n</style>\n<style>\n' + CSS + '\n</style>\n<script defer src="https://cloud.umami.is/script.js" data-website-id="4f48b5b5-93c8-4493-be71-2c1cefc6e440"></script>\n<script src="https://analytics.ahrefs.com/analytics.js" data-key="QPBi7D5b8OKPmyaZADAAiA" async></script>\n</head>\n<body>\n\n<nav class="nk-nav" id="mainNav">\n  <div class="nav__inner">\n    <a href="https://nikos.info/index.html" class="nav__logo" aria-label="NIKOS Startseite">\n      <svg xmlns="http://www.w3.org/2000/svg" viewBox="344.188 -0.500 356.378 66.750"><path fill="#4D4D4D" d="M344.688,0.688h26.75l32.935,47.026h0.003V0.688h17.313v64.375h-26.75l-32.935-47.026h-0.003v47.026h-17.313V0.688z"/><path fill="#4D4D4D" d="M433.706,0.688h17.313v64.375h-17.313V0.688z"/><path fill="#4D4D4D" d="M463.267,0.688h17.313v23.625h8.248l21.799-23.625h23.516l-30.438,31.399l33.938,32.976h-24.619L488.295,40.25h-7.716v24.813h-17.313V0.688z"/><path fill="#4D4D4D" d="M541.403,42.651v-18.99c0-8.42,1.828-14.462,5.484-18.124C550.567,1.846,556.927,0,565.964,0h28.557c8.834,0,15.117,1.846,18.848,5.537c3.732,3.691,5.598,9.632,5.598,17.821v19.249c-0.127,8.363-2.031,14.318-5.711,17.865c-3.656,3.519-9.836,5.277-18.543,5.277h-28.748c-8.605,0-14.852-1.729-18.734-5.19C543.345,57.07,541.403,51.101,541.403,42.651z M559.278,29.548v6.266c0,5.473,0.711,9.088,2.131,10.844c1.42,1.729,4.197,2.593,8.332,2.593h21.42c4.008,0,6.658-0.922,7.951-2.766c1.318-1.871,1.979-5.299,1.979-10.282v-6.524c0-5.127-0.811-8.598-2.434-10.412c-1.6-1.844-4.377-2.766-8.332-2.766h-20.014c-4.135,0-7.014,0.937-8.637,2.809C560.077,21.182,559.278,24.595,559.278,29.548z"/><path fill="#4D4D4D" d="M646.131,44.313c0.229,2.889,0.748,4.796,1.561,5.72c0.813,0.896,2.805,1.343,5.978,1.343h22.234c4.568,0,6.853-1.805,6.853-5.415c0-2.311-0.901-3.885-2.702-4.723c-1.777-0.866-6.078-1.3-12.904-1.3h-10.658c-8.273,0-14.363-0.533-18.271-1.601c-3.883-1.067-6.472-3.058-7.766-5.972c-1.092-2.394-1.637-6.533-1.637-12.418c0-8.048,1.712-13.385,5.138-16.01C637.407,1.313,643.218,0,651.388,0h24.358c8.551,0,14.336,1.354,17.355,4.063s4.529,7.493,4.529,14.353v2.334h-17.313c0-2.544-0.521-4.235-1.561-5.074c-1.041-0.867-3.376-1.301-7.005-1.301h-18.541c-4.721,0-7.081,1.706-7.081,5.117c0,3.412,1.649,5.189,4.948,5.334c3.324,0.116,6.445,0.174,9.364,0.174h11.762c8.044,0,14.021,0.605,17.929,1.816c3.933,1.212,6.622,3.346,8.069,6.402c1.243,2.625,1.865,6.735,1.865,12.329c0,5.682-0.647,9.85-1.941,12.502c-1.421,2.885-4.009,4.889-7.764,6.013c-3.73,1.125-9.466,1.688-17.204,1.688h-22.646c-8.373,0-14.082-1.268-17.127-3.804c-3.045-2.535-4.567-6.929-4.567-13.182v-4.452H646.131z"/></svg>\n    </a>' + NAV_LINKS + '\n  </div>\n  ' + NAV_MOBILE + '\n</nav>\n\n<div class="nk-banner">\n  <div class="nk-banner__img">\n    <img src="' + HERO + '" alt="' + esc(HALT) + '" loading="eager"' + OBJPOS + '>\n    <div class="nk-banner__claim">\n      <h1>' + esc(f.headline) + '</h1>\n    </div>\n  </div>\n  <div class="nk-banner__bar">\n    <div class="nk-banner__kw">' + LOC.BANNER_KW + '</div>\n  </div>\n</div>\n\n<section class="intro-s2">\n  <div class="intro-s2__inner">\n    <span class="nk-label">' + esc(LOC.EYEBROW_CHALLENGE) + '</span>\n    <h2 class="heading-l" style="margin-top:12px;">' + esc(f.subhead) + '</h2>\n    <p class="body-l" style="margin-top:14px;max-width:860px;color:var(--mid);">' + esc(f.intro) + '</p>\n  </div>\n</section>\n\n<section class="nk-section">\n  <div class="nk-section__inner">\n    <div class="nk-section__header">\n      <span class="nk-label">' + esc(LOC.EYEBROW_SOLUTION) + '</span>\n      <h2 class="heading-l" style="margin-top:10px;">' + esc(LOC.USP_HEADING) + '</h2>\n    </div>\n    <p class="body-l" style="max-width:860px;">' + esc(uspFull) + '</p>\n  </div>\n</section>\n\n<section class="nk-section nk-section--surface">\n  <div class="nk-section__inner">\n    <div class="nk-section__header">\n      <span class="nk-label">' + esc(LOC.EYEBROW_FAQ) + '</span>\n      <h2 class="heading-m" style="margin-top:10px;">' + esc(LOC.FAQ_HEADING) + '</h2>\n    </div>\n    <div class="faq-list">\n' + [1,2,3,4].map(faqBlock).join('\n') + '\n    </div>\n  </div>\n</section>\n\n<section class="cta-band">\n  <div class="cta-band__card">\n    <h2>' + esc(LOC.CTA_HEADING) + '</h2>\n    <p>' + esc(LOC.CTA_BODY) + '</p>\n    <a href="https://nikos.info/de/vermietung/#partnerauswahl" class="btn-primary">' + esc(LOC.CTA_BUTTON) + '</a>\n  </div>\n</section>\n\n<footer class="lp-footer">\n  <div class="lp-footer__inner">\n    <span class="lp-footer__copy">' + esc(LOC.FOOTER_COPY) + '</span>\n    <ul class="lp-footer__links">\n      <li><a href="https://nikos.info/index.html">' + esc(LOC.FOOTER_HOME) + '</a></li>\n      <li><a href="' + NAV_URLS.terms + '">' + esc(LOC.FOOTER_TERMS) + '</a></li>\n      <li><a href="' + NAV_URLS.rentalterms + '">' + esc(LOC.FOOTER_RENTALTERMS) + '</a></li>\n      <li><a href="' + NAV_URLS.privacy + '">' + esc(LOC.FOOTER_PRIVACY) + '</a></li>\n      <li><a href="' + NAV_URLS.legal + '">' + esc(LOC.FOOTER_LEGAL) + '</a></li>\n      <li><a href="https://nikos.info/loesungen/">' + esc(LOC.FOOTER_ALLCASES) + '</a></li>\n    </ul>\n  </div>\n</footer>\n\n<script>\n(function(){\n  var btn=document.getElementById(\'langFlagBtn\');\n  var dd=document.getElementById(\'langFlagDropdown\');\n  if(btn&&dd){\n    btn.addEventListener(\'click\',function(e){e.stopPropagation();dd.classList.toggle(\'open\');});\n    document.addEventListener(\'click\',function(){dd.classList.remove(\'open\');});\n  }\n  var burger=document.getElementById(\'navBurger\');\n  var mob=document.getElementById(\'navMobile\');\n  if(burger&&mob){burger.addEventListener(\'click\',function(){mob.classList.toggle(\'open\');});}\n})();\n</script>\n</body>\n</html>\n';

// Modul-Icons + NIKOS-Wort-Verlinkung (nur im <body>, wie im Alt-Pfad)
(function(){
  var bi = html.indexOf('<body>');
  if (bi >= 0) html = html.slice(0, bi) + nikosWord(modLogos(html.slice(bi)));
})();

const linkTitle = f.subhead ? (splitCo(f.headline) + ': ' + f.subhead) : f.headline;

return { json: { lang, slug, url, html, title, metaDesc, linkTitle } };
