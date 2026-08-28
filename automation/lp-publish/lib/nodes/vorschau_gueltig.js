// ANGEPASST (keine 1:1-Kopie möglich) aus dem n8n-Workflow "Landingpages
// veröffentlichen" (VJaUw0kTrsO17iHX), Node "Vorschau gültig?".
//
// ORIGINAL-ZWECK (unverändert): nur Items mit gültiger Vorschau-Datei
// durchlassen, damit bei einem vorherigen Generierungs-Fehlschlag keine
// leere/kaputte Seite live geht.
//
// WARUM ANGEPASST: Der n8n-Node prüfte die HTTP-GET-Antwort der GitHub-
// Contents-API (base64 "content"-Feld, "sha", "type: file"). Dieses Skript
// liest die Vorschau-Datei stattdessen direkt aus dem ausgecheckten Repo
// (kein GitHub-API-Aufruf mehr nötig, siehe Migrationsplan Teil 1,
// Abschnitt 5) — die Eingabeform ist dadurch grundlegend anders
// (Dateisystem-String statt HTTP-Response-Objekt). Die Prüf-ABSICHT ist
// identisch nachgebildet: nicht-trivial langer, plausibler HTML-Inhalt.
const out = [];
for (const it of $input.all()) {
  const j = it.json || {};
  const html = (j.previewHtml || '').toString();
  const plausible = html.trim().length > 200 && /<html[\s>]/i.test(html) && /<\/html>/i.test(html);
  if (plausible) {
    out.push(it);
  }
}
return out;
