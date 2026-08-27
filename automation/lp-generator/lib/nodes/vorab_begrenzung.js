const CAP = 50;
const norm = v => String(v ?? '').trim();
const items = $input.all();
const eligible = items.filter(it => {
  const j = it.json || {};
  return norm(j.erstellen).toLowerCase() === 'x' && norm(j.slug) === '';
});
const total = eligible.length;
const capped = total > CAP;
let kept = eligible;
if (capped) {
  const scored = eligible.map((it, i) => {
    const n = Number(it.json && it.json.Relevanz);
    return { it, score: Number.isFinite(n) ? n : 0, i };
  });
  scored.sort((a, b) => (b.score - a.score) || (a.i - b.i));
  kept = scored.slice(0, CAP).map(s => s.it);
}
// Zeilennummer-Korrektur: 'Keywordkombinationen lesen' liest jetzt aus der 'Warteschlange'-Ansicht
// (QUERY-Formel in Google Sheets, sortiert nach Relevanz, nur offene Kombinationen). n8n's
// automatisches 'row_number' zeigt dadurch auf die Zeile INNERHALB DER WARTESCHLANGE, nicht auf
// die echte Zeile in 'Keywordkombinationen'. Spalte 'OrigZeile' (von der QUERY-Formel durchgereicht,
// via ARRAYFORMULA(ROW()) in Keywordkombinationen selbst berechnet) traegt die echte Original-
// Zeilennummer. Wir schreiben sie hier auf 'row_number', damit 'Ergebnis ins Sheet' am Ende der
// Pipeline weiterhin exakt die richtige Zeile in 'Keywordkombinationen' aktualisiert.
return kept.map(it => {
  const j = { ...it.json };
  if (j.OrigZeile !== undefined && j.OrigZeile !== '') {
    const orig = Number(j.OrigZeile);
    if (Number.isFinite(orig)) j.row_number = orig;
  }
  delete j.OrigZeile;
  return { json: { ...j, _precap_total: total, _precap_capped: capped }, pairedItem: it.pairedItem };
});
