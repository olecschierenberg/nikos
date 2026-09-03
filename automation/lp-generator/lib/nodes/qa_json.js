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
// aktuellen Rechtsform verwenden -- ein evtl. vom QA-Agenten ergaenztes
// "GmbH" wird hart entfernt (siehe uebersetzung_json.js fuer Hintergrund).
function fixRadacom(t){ if(!t) return t; return String(t).replace(/\bRadacom\b(\s+GmbH\b)?/gi,'RADACOM'); }
const results=[];
for(const item of $input.all()){
  const j=item.json; let obj;
  if(j && typeof j==='object' && (j.headline_de!==undefined || j.output!==undefined)){
    obj=(j.output!==undefined)?j.output:j;
  } else {
    let raw=j.text ?? j.response ?? '';
    if(typeof raw==='object') obj=raw;
    else{let s=String(raw).trim().replace(/^```(json)?/i,'').replace(/```$/,'').trim();
      try{obj=JSON.parse(s);}catch(e){const a=s.indexOf('{'),b=s.lastIndexOf('}');if(a>=0&&b>a)obj=JSON.parse(s.slice(a,b+1));else throw new Error('Kein JSON');}}
  }
  const o2={};
  for(const k in obj){ o2[k]=(typeof obj[k]==='string')?fixRadacom(deDoppel(obj[k])):obj[k]; }
  results.push({json:{output:o2}});
}
return results;
