'use strict';
/**
 * Partnerliste als lesbarer Text auf der Vermietungsseite.
 *
 * Warum: Die Partnerkarte (partner-karte.html, per iframe eingebunden) laedt
 * ihre Daten erst im Browser aus dem Google Sheet "NIKOS-Listen". Suchmaschinen
 * und KI-Suchen sehen die Partnernamen dort nicht. Dieses Skript schreibt die
 * Partner deshalb zusaetzlich als normalen HTML-Text in
 *   de/vermietung/index.html  und  en/rental/index.html
 * zwischen die Marker <!-- PARTNERLISTE:START --> und <!-- PARTNERLISTE:END -->.
 *
 * Regeln (Nutzer-Vorgabe 2026-09-28):
 *  - Nur Partner auflisten, denen mindestens eine Region zugeordnet ist.
 *  - RADACOM wird ebenfalls gelistet (zuletzt, als "alle uebrigen Laender (direkt)" --
 *    RADACOM vermietet auch ausserhalb Europas, dort immer direkt).
 *  - Regionen mit selectable = FALSE werden nicht genannt.
 *
 * Datenquelle: die oeffentliche CSV-Ausgabe des Sheets (dieselbe URL, die auch
 * die Partnerkarte im Browser nutzt) -- kein Zugangsschluessel noetig.
 * Lokal/offline: node update-partnerliste.js --data daten.json
 *   (JSON: {"partners":[{id,firma,ort,land,website,ist_radacom}],"regions":[{ids,name,sel}]})
 *
 * Schreibt nur, wenn sich der Inhalt tatsaechlich aendert.
 */
const fs = require('fs');
const path = require('path');

const SHEET = 'https://docs.google.com/spreadsheets/d/1_JhSXcyg9IEtrMqBSSx0Pt616emHrLsmUx4kH5_umwQ/gviz/tq?tqx=out:csv&sheet=';
const SITE = path.resolve(__dirname, '..', '..');
const FILES = ['de/vermietung/index.html', 'en/rental/index.html'];
const START = '<!-- PARTNERLISTE:START -->';
const END = '<!-- PARTNERLISTE:END -->';

// Regionsnamen DE -> EN (unbekannte Namen bleiben deutsch)
const EN = {
  'Baden-Württemberg': 'Baden-Württemberg', 'Bayern Nordost': 'Bavaria North-East', 'Bayern Südwest': 'Bavaria South-West',
  'Berlin / Brandenburg': 'Berlin / Brandenburg', 'Hessen': 'Hesse', 'Mecklenburg-Vorpommern': 'Mecklenburg-Western Pomerania',
  'Niedersachsen / Bremen': 'Lower Saxony / Bremen', 'Nordrhein-Westfalen': 'North Rhine-Westphalia',
  'Rheinland-Pfalz / Saarland': 'Rhineland-Palatinate / Saarland', 'Sachsen': 'Saxony', 'Sachsen-Anhalt': 'Saxony-Anhalt',
  'Schleswig-Holstein / Hamburg': 'Schleswig-Holstein / Hamburg', 'Thüringen': 'Thuringia',
  'Österreich Ost': 'Eastern Austria', 'Österreich West': 'Western Austria', 'Österreich': 'Austria',
  'Albanien': 'Albania', 'Belgien / Luxemburg': 'Belgium / Luxembourg', 'Bosnien-Herzegowina': 'Bosnia and Herzegovina',
  'Bulgarien': 'Bulgaria', 'Dänemark': 'Denmark', 'Estland': 'Estonia', 'Finnland': 'Finland', 'Frankreich': 'France',
  'Griechenland': 'Greece', 'Irland': 'Ireland', 'Island': 'Iceland', 'Italien': 'Italy', 'Kosovo': 'Kosovo',
  'Kroatien': 'Croatia', 'Lettland': 'Latvia', 'Litauen': 'Lithuania', 'Montenegro': 'Montenegro',
  'Niederlande': 'Netherlands', 'Nordmazedonien': 'North Macedonia', 'Norwegen': 'Norway', 'Polen': 'Poland',
  'Portugal': 'Portugal', 'Moldau': 'Moldova', 'Rumänien': 'Romania', 'Schweden': 'Sweden', 'Schweiz': 'Switzerland',
  'Serbien': 'Serbia', 'Slowakei': 'Slovakia', 'Slowenien': 'Slovenia', 'Spanien': 'Spain', 'Tschechien': 'Czech Republic',
  'Ungarn': 'Hungary', 'Vereinigtes Königreich': 'United Kingdom', 'Deutschland': 'Germany',
};

function parseCSV(text) {
  const rows = []; let row = []; let cur = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

function toObjects(rows) {
  const head = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] || '').trim()])));
}

async function loadData() {
  const i = process.argv.indexOf('--data');
  if (i > 0) return JSON.parse(fs.readFileSync(process.argv[i + 1], 'utf8'));
  const get = async (tab) => {
    const res = await fetch(SHEET + encodeURIComponent(tab), { redirect: 'follow' });
    if (!res.ok) throw new Error(`Sheet-Tab ${tab}: HTTP ${res.status}`);
    return toObjects(parseCSV(await res.text()));
  };
  const partners = (await get('Partnerliste')).map((p) => ({
    id: p.partner_id, firma: p.firma, ort: p.ort, land: p.land, website: p.website, ist_radacom: p.ist_radacom,
  }));
  const regions = (await get('Regionszuordnung')).map((r) => ({ ids: r.partner_ids, name: r.region_name_de, sel: r.selectable }));
  return { partners, regions };
}

const isRadacom = (p) => String(p.ist_radacom).toUpperCase() === 'TRUE';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const url = (w) => (!w ? '' : /^https?:\/\//i.test(w) ? w : 'https://' + w.replace(/^\/+/, ''));

function buildModel({ partners, regions }) {
  const byId = new Map();
  for (const p of partners) if (p.id && p.firma && !byId.has(p.id)) byId.set(p.id, { ...p, firma: p.firma.trim(), regions: [] });
  for (const r of regions) {
    if (!r.name || String(r.sel).toUpperCase() === 'FALSE') continue;
    for (const id of String(r.ids || '').split(',').map((s) => s.trim()).filter(Boolean)) {
      const p = byId.get(id); if (p && !p.regions.includes(r.name)) p.regions.push(r.name);
    }
  }
  const list = [...byId.values()].filter((p) => p.regions.length);
  const isRad = isRadacom;
  const others = list.filter((p) => !isRad(p)).sort((a, b) => a.regions[0].localeCompare(b.regions[0], 'de') || a.firma.localeCompare(b.firma, 'de'));
  return [...others, ...list.filter(isRad)];
}

function buildBlock(model) {
  const NL = '\r\n';
  const li = (p) => {
    const name = p.website ? `<a href="${esc(url(p.website))}" target="_blank" rel="noopener">${esc(p.firma)}</a>` : esc(p.firma);
    const ort = p.ort ? ` <span class="partner-list__ort">(${esc(p.ort)})</span>` : '';
    // RADACOM vermietet ueberall dort direkt, wo kein Partner zustaendig ist -- auch
    // ausserhalb Europas. Deshalb keine Laenderliste, sondern ein Sammelbegriff.
    const de = isRadacom(p) ? 'alle übrigen Länder (direkt)' : p.regions.join(', ');
    const en = isRadacom(p) ? 'all other countries (direct)' : p.regions.map((r) => EN[r] || r).join(', ');
    return `      <li class="partner-list__item"><div class="partner-list__name">${name}${ort}</div>` +
      `<div class="partner-list__reg" data-de>${esc(de)}</div><div class="partner-list__reg" data-en>${esc(en)}</div></li>`;
  };
  const ld = {
    '@context': 'https://schema.org', '@type': 'ItemList', name: 'NIKOS-Partner / NIKOS partners',
    itemListElement: model.map((p, i) => ({
      '@type': 'ListItem', position: i + 1,
      item: { '@type': 'Organization', name: p.firma, ...(p.website ? { url: url(p.website) } : {}),
        ...(p.ort ? { address: { '@type': 'PostalAddress', addressLocality: p.ort, ...(p.land ? { addressCountry: p.land } : {}) } } : {}),
        areaServed: isRadacom(p) ? 'Alle übrigen Länder weltweit / all other countries worldwide' : p.regions },
    })),
  };
  return [
    START,
    '<section class="nk-section partner-list-section" id="partnerliste">',
    '  <div class="nk-section__inner">',
    '    <h2 class="heading-m" data-de>NIKOS-Partner nach Region</h2><h2 class="heading-m" data-en>NIKOS partners by region</h2>',
    '    <ul class="partner-list">',
    ...model.map(li),
    '    </ul>',
    '  </div>',
    '</section>',
    '<script type="application/ld+json">',
    JSON.stringify(ld, null, 2).replace(/\n/g, NL),
    '</script>',
    END,
  ].join(NL);
}

async function main() {
  const model = buildModel(await loadData());
  if (model.length < 2) throw new Error(`Nur ${model.length} Partner mit Region gefunden -- Abbruch (Sheet-Problem?).`);
  const block = buildBlock(model);
  let changed = 0;
  for (const rel of FILES) {
    const file = path.join(SITE, rel);
    const html = fs.readFileSync(file, 'utf8');
    const a = html.indexOf(START); const b = html.indexOf(END);
    if (a < 0 || b < a) throw new Error(`Marker fehlen in ${rel}`);
    const next = html.slice(0, a) + block + html.slice(b + END.length);
    if (next !== html) { fs.writeFileSync(file, next, 'utf8'); changed++; console.log(`aktualisiert: ${rel}`); }
    else console.log(`unveraendert: ${rel}`);
  }
  console.log(`${model.length} Partner gelistet, ${changed} Datei(en) geaendert.`);
}

if (require.main === module) main().catch((e) => { console.error('Partnerliste fehlgeschlagen:', e.message); process.exit(1); });
module.exports = { parseCSV, buildModel, buildBlock };
