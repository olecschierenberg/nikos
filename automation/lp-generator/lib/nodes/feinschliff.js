const b = $('HTML bauen').item.json;
const src = $('Filter + Relevanz-Ranking').item.json;
const region=(src.Region||''), einsatz=(src.Einsatz||''), problem=(src.Problem||'');
const lang=(src._lang==='en')?'en':'de';
const USPHEADS=[['Ein einheitliches Kommunikations- und Steuerungssystem für Alltag und Ernstfall','One unified communication and control system for everyday use and emergencies'],['Durchsagen, Alarmierung und Steuerung auf einer Plattform','Announcements, alerting and control on one platform'],['Alltagstauglich und im Ernstfall sofort zur Stelle','Suited to everyday use and instantly ready in an emergency'],['Kommunikation und Sicherheitstechnik aus einem System','Communication and safety technology from a single system'],['Ein System für Besucherinformation, Ablaufsteuerung und Notfallmanagement','One system for visitor information, process control and emergency management']];
function pickIdx(key,n){var h=0;key=(key||'').toString();for(var i=0;i<key.length;i++){h=((h<<5)-h+key.charCodeAt(i))|0;}return Math.abs(h)%n;}
const USPHEAD=USPHEADS[pickIdx(einsatz+'|'+problem+'|'+region,USPHEADS.length)];
function heroFor(ev){ev=(ev||'').toLowerCase();
if(/\bchio\b|reitturnier|pferdesport|springreiten|dressur|vielseitigkeit/.test(ev))return['CHIO.jpg','CHIO Aachen – Pferdesport'];
if(/oktoberfest|wiesn|volksfest/.test(ev))return['Volksfest.jpg','Volksfest'];
if(/schützenfest|schuetzenfest/.test(ev))return['Volksfest.jpg','Volksfest'];
if(/gillamoos/.test(ev))return['Volksfest.jpg','Volksfest'];
if(/tattoo/.test(ev))return['Tattoo.jpg','Basel Tattoo'];
if(/csd|christopher street|pride/.test(ev))return['CSD.jpg','CSD'];
if(/karneval|fastnacht|fasching|umzug|parade|festumzug|rosenmontag/.test(ev))return['Festumzug.jpg','Festumzug'];
if(/marathon|stadtlauf/.test(ev))return['Marathon.jpg','Marathon'];
if(/triathlon|sportevent|stadion|fanmeile|fanzone|fan-zone/.test(ev))return['Sportevent.jpg','Sportevent'];
if(/weihnachtsmarkt|christkindl|adventsmarkt|weihnachtsdorf/.test(ev))return['Weihnachtsmarkt.jpg','Weihnachtsmarkt'];
if(/hafenfest|hafengeburtstag|sail bremerhaven/.test(ev))return['Hafen.jpg','Hafen'];
if(/lange nacht der museen|museumsnacht/.test(ev))return['Museum.jpg','Lange Nacht der Museen'];
if(/tag der bundeswehr/.test(ev))return['Bundeswehr.jpg','Tag der Bundeswehr'];
if(/großveranstaltung|grossveranstaltung/.test(ev))return['Kirchentag.jpg','Großveranstaltung'];
if(/fre(?:ß|ss)gassfest/.test(ev))return['Stadtfest.jpg','Freßgassfest'];
if(/stadtfest|altstadtfest|cityfest|city-fest|buergerfest|bürgerfest|rakoczy|tag der niedersachsen/.test(ev))return['Stadtfest.jpg','Stadtfest'];
if(/straßenfest|strassenfest/.test(ev))return['Anwendungen.jpg','Straßenfest'];
if(/kirchentag|katholikentag/.test(ev))return['Kirchentag.jpg','Kirchentag'];
if(/weinfest|wurstmarkt|winzerfest|weinmarkt/.test(ev))return['Weinfest.jpg','Weinfest'];
if(/jahrmarkt|kirmes|rummel|freimarkt|kram(er)?markt|hamburger dom|\bdom\b|wasen|cranger|annafest|plärrer|plaerrer/.test(ev))return['Jahrmarkt.jpg','Jahrmarkt'];
if(/\bwacken\b|rock am ring|rock im park|berlin festival|lollapalooza|tomorrowland|glastonbury/.test(ev))return['Festival.jpg','Festival'];
if(/festival|musikfestival|open[\s-]?air|rave|bergenfest/.test(ev)){var fp=['Festival.jpg','Stage.jpg'][pickIdx(ev+'|fest-pick',2)];return[fp,fp==='Stage.jpg'?'Stage':'Festival'];}
if(/baustelle/.test(ev))return['Baustelle.jpg','Baustelle'];
if(/krisenlage|katastrophenschutz|katastrophe/.test(ev))return['Krisenlage.jpg','Krisenlage'];
if(/firmenveranstaltung|betriebsfeier|firmenfeier|firmenevent/.test(ev))return['Firmenveranstaltung.jpg','Firmenveranstaltung'];
if(/jubiläum|jubilaeum/.test(ev))return['Jubiläumsfeier.jpg','Jubiläumsfeier'];
if(/parkfest/.test(ev))return['Parkfest.jpg','Parkfest'];
if(/bundesgartenschau|landesgartenschau|gartenschau|\bbuga\b|\biga\b/.test(ev))return['Parkfest.jpg','Parkfest'];
if(/tag der deutschen einheit/.test(ev))return['Jubiläumsfeier.jpg','Tag der deutschen Einheit'];
if(/\b\w+-tag\b|hessentag|bayerntag|landesfest/.test(ev))return['Stadtfest.jpg','Landesfest'];
return['Gedenkveranstaltung.jpg','Gedenkveranstaltung'];}
const hf=heroFor(einsatz+' '+problem);
const HERO='https://nikos.info/assets/img/Banner/'+hf[0];
const HALT='NIKOS – '+hf[1];
const OBJPOS=(hf[0]==='Hafen.jpg'||hf[0]==='Stage.jpg')?' style="object-position:center bottom"':'';
const NKMOD='.nk-mod{display:inline-block;vertical-align:baseline}\n.nk-mod img{height:0.95em;width:auto;max-width:none;display:inline-block;vertical-align:-0.23em;transition:opacity .15s}\n.nk-mod:hover img{opacity:.6}\n.intro-s2__inner .heading-l,.nk-section__inner .heading-l,.nk-section__inner .heading-m{max-width:860px}\n.nk-nav .nav__links{flex:0 1 auto;overflow:visible}\n.nk-nav .lang-flag__btn .flag{font-size:16px;line-height:1}\n.nk-nav .lang-flag__option{gap:10px;padding:10px 14px;font-size:13px}\n.nk-nav .lang-flag__option .flag{font-size:18px}\n.nk-nav .lang-flag__dropdown{box-shadow:0 8px 24px rgba(0,0,0,.12)}\n.nk-nav .nav__burger span{width:24px;border-radius:2px}\n';
function esc(s){return s==null?'':String(s);}
function splitCo(s){s=esc(s);var i=s.indexOf(': ');return i>=0?[s.slice(0,i),s.slice(i+2)]:[s,''];}
function modLogos(x){return x.replace(/NIKOS \[([A-Za-z0-9]+)\](?:²|&sup2;)/g,function(m,name){var a=(name==='audio'||name==='dispatcher'||name==='moon')?name:'zubehoer';return '<a class="nk-mod" href="https://nikos.info/de/produkte/#'+a+'"><img src="https://nikos.info/assets/logos/nikos/SVG/NIKOS '+name+'.svg" alt="NIKOS ['+name+']²" loading="lazy"></a>';});}
var NIKOSLOGO='<a class="nk-mod" href="https://nikos.info/index.html"><img src="https://nikos.info/assets/logos/nikos/SVG/NIKOS.svg" alt="NIKOS" loading="lazy"></a>';
function nkWordInner(inner){var st=[];inner=inner.replace(/<a class="nk-mod[^>]*>[\s\S]*?<\/a>/g,function(mm){st.push(mm);return '%%NKM'+(st.length-1)+'%%';});inner=inner.replace(/NIKOS(?!-|[A-Za-z0-9²]| \[)/g,NIKOSLOGO);inner=inner.replace(/%%NKM(\d+)%%/g,function(mm,i){return st[+i];});return inner;}
function nikosWord(x){x=x.replace(/<div class="faq-item__body"([^>]*)>([\s\S]*?)<\/div>/g,function(m,a,inner){return '<div class="faq-item__body"'+a+'>'+nkWordInner(inner)+'</div>';});x=x.replace(/<p class="body-l"([^>]*)>([\s\S]*?)<\/p>/g,function(m,a,inner){return '<p class="body-l"'+a+'>'+nkWordInner(inner)+'</p>';});return x;}
function transform(html){
if(!html) return html;
html=html.replace('<html lang="de" data-lang="de">','<html lang="'+lang+'" data-lang="'+lang+'">');
html=html.replace("setLang(saved==='en'?'en':'de');","setLang('"+lang+"');");
html=html.replace(/https:\/\/nikos\.(?:audio|info)\/assets\/img\/Banner\/NIKOS-Hero4\.jpg/g,HERO);
html=html.replace('alt="NIKOS" loading="eager"','alt="'+HALT+'" loading="eager"'+OBJPOS);
if(html.indexOf('.nk-mod{')<0){html=html.replace('a{color:inherit}\n','a{color:inherit}\n'+NKMOD);}
var pDe='',pEn='';
html=html.replace(/<h1 data-de>([\s\S]*?)<\/h1>/,function(m,t){var s=splitCo(t);pDe=s[1];return '<h1 data-de>'+s[0]+'</h1>';});
html=html.replace(/<h1 data-en>([\s\S]*?)<\/h1>/,function(m,t){var s=splitCo(t);pEn=s[1];return '<h1 data-en>'+s[0]+'</h1>';});
if(pDe){html=html.replace(/(<h2 class="heading-l" style="margin-top:12px;" data-de>)[\s\S]*?(<\/h2>)/,function(m,a,z){return a+pDe+z;});}
if(pEn){html=html.replace(/(<h2 class="heading-l" style="margin-top:12px;" data-en>)[\s\S]*?(<\/h2>)/,function(m,a,z){return a+pEn+z;});}
html=html.replace('data-de>Eine einheitliche Lösung für Alltag und Ernstfall</h2>','data-de>'+USPHEAD[0]+'</h2>');
html=html.replace('data-en>One unified solution for everyday use and emergencies</h2>','data-en>'+USPHEAD[1]+'</h2>');
html=html.split('finden Sie hier.</div>').join('finden Sie <a href="https://nikos.info/de/anwendungen/#wirtschaftlichkeit">hier</a>.</div>');
var bi=html.indexOf('<body>'); if(bi>=0){html=html.slice(0,bi)+nikosWord(modLogos(html.slice(bi)));}
return html;
}
const previewHtml=transform(b.previewHtml);
const liveHtml=transform(b.html);
const b64=function(s){return Buffer.from(s,'utf8').toString('base64');};
return { json: Object.assign({}, b, { html: liveHtml, previewHtml: previewHtml, previewB64: b64(previewHtml), liveB64: b64(liveHtml) }) };