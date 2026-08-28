// NIKOS Stufe A — Vorrat + Ausschluss aufbereiten (erweitert)
// Liest Pool + vorhandene Kombis + Stadt-Fakten (für aktuelle Events).
// Selbstlernend: erstellen='-' => Ablehnung; 'x' oder slug => Positiv-Beispiel.
// NEU: aktuelleEvents (für Event-Garantie), niedrigkombis (Relevanz<4, als Lehre),
//      topkombis (Relevanz>=8), exclude-Set (Dedup).
const pool = $('Keywordpool lesen').all().map(i => i.json);
const existing = $('Vorhandene Kombis lesen').all().map(i => i.json);
let sf = [];
try { sf = $('Stadt-Fakten lesen A').all().map(i => i.json); } catch(e) { sf = []; }

const col = (rows, key) => [...new Set(rows.map(r => (r[key] || '').toString().trim()).filter(Boolean))];
const probleme = col(pool, 'Problem');
const einsaetze = col(pool, 'Einsatz');
const regionen = col(pool, 'Region');

const norm = s => (s||'').toString().trim().toLowerCase();
const keyOf = r => [norm(r.Problem), norm(r.Einsatz), norm(r.Region)].join('|');
const label = r => [r.Problem, r.Einsatz, r.Region].map(x => (x||'').toString().trim()).filter(Boolean).join(' | ');
const exclude = new Set(existing.map(keyOf));
const flag = r => norm(r.erstellen);
const built = r => (r.slug || '').toString().trim() !== '';
const relOf = r => { const v = parseInt((r.Relevanz||'').toString().trim(), 10); return Number.isFinite(v) ? v : 0; };

const negativ = existing.filter(r => flag(r) === '-').map(label).filter(Boolean);
const positiv = existing.filter(r => flag(r) === 'x' || built(r)).map(label).filter(Boolean);
// Top-Kombis (Relevanz>=8) als Erfolgsformel
const topkombis = existing.filter(r => relOf(r) >= 8 && label(r))
  .sort((a,b) => relOf(b) - relOf(a)).map(r => label(r) + ' (Relevanz ' + relOf(r) + ')');
// NEU: Niedrig bewertete Kombis (1-3) als LEHRE, welche Muster schwach sind
const niedrigkombis = existing.filter(r => { const v = relOf(r); return v >= 1 && v < 4 && label(r); })
  .sort((a,b) => relOf(a) - relOf(b)).map(r => label(r) + ' (Relevanz ' + relOf(r) + ')');

// NEU: Aktuelle Events aus Stadt-Fakten (Region mit Aktuell gefüllt) -> für Event-Garantie
const aktuelleEvents = sf.filter(r => (r.Aktuell||'').toString().trim())
  .map(r => (r.Region||'').toString().trim() + ': ' + (r.Aktuell||'').toString().trim()
    + ((r.Zeitraum||'').toString().trim() ? ' [' + (r.Zeitraum||'').toString().trim() + ']' : ''))
  .filter(Boolean);

const lastN = (arr, n) => arr.slice(-n);
return [{ json: {
  probleme, einsaetze, regionen,
  exclude: Array.from(exclude),
  positiv: lastN(positiv, 25),
  negativ: lastN(negativ, 25),
  topkombis: topkombis.slice(0, 15),
  niedrigkombis: niedrigkombis.slice(0, 15),
  aktuelleEvents: aktuelleEvents.slice(0, 30),
  zielanzahl: 5
} }];
