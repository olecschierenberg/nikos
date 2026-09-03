const src = $('Filter + Relevanz-Ranking').item.json;
const region = String(src.Region||'').trim();
const einsatz = String(src.Einsatz||'').trim();
function deDoppel(text){
  if(!text || !region) return text;
  let t=String(text);
  const regStamm = region.replace(/[^A-Za-zÄÖÜäöüß]/g,'').slice(0,4).toLowerCase();
  if(regStamm.length<3) return t;
  if(!einsatz.toLowerCase().includes(regStamm)) return t;
  const re=new RegExp('\\s+in\\s+'+region.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','gi');
  t=t.replace(re,'');
  return t.replace(/\s{2,}/g,' ').replace(/\s+([.,;:])/g,'$1');
}
// NEU (2026-09-03, Nutzer-Vorgabe): Marke "RADACOM" unabhaengig von der
// aktuellen Rechtsform verwenden -- ein evtl. bei der Nachbesserung
// ergaenztes "GmbH" wird hart entfernt (siehe uebersetzung_json.js fuer
// Hintergrund).
function fixRadacom(t){ if(!t) return t; return String(t).replace(/\bRadacom\b(\s+GmbH\b)?/gi,'RADACOM'); }
const out=[];
for(const it of $input.all()){
  const j=it.json; let obj;
  if(j && typeof j==='object' && j.output!==undefined) obj=j.output;
  else if(j && typeof j==='object' && j.headline_de!==undefined) obj=j;
  else { let raw=j.text ?? j.response ?? ''; if(typeof raw==='object') obj=raw; else { let s=String(raw).trim().replace(/^```(json)?/i,'').replace(/```$/,'').trim(); try{obj=JSON.parse(s);}catch(e){const a=s.indexOf('{'),b=s.lastIndexOf('}'); obj=(a>=0&&b>a)?JSON.parse(s.slice(a,b+1)):{};} } }
  if(obj && obj._maengel!==undefined) delete obj._maengel;
  const o2={};
  for(const k in obj){ o2[k]=(typeof obj[k]==='string')?fixRadacom(deDoppel(obj[k])):obj[k]; }
  out.push({json:{output:o2}});
}
return out;
