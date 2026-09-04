// ═══════════════════════════════════════════════════════════════════
// NIKOS Seitenkonfiguration
// ═══════════════════════════════════════════════════════════════════
//
// KONTAKT-BUTTON UMLEITUNG
// ─────────────────────────
// Standard (Kontaktseite):
//   window.NIKOS_CONTACT_URL = 'nikos-kontakt.html';
//
// Umstellen auf Vermietung (wenn Kundenkommunikation über Partner läuft):
//   window.NIKOS_CONTACT_URL = 'nikos-vermietung.html';
//
// Einfach die gewünschte Zeile aktivieren (die andere auskommentieren).
// ═══════════════════════════════════════════════════════════════════

window.NIKOS_CONTACT_URL = 'nikos-kontakt.html';
// window.NIKOS_CONTACT_URL = 'nikos-vermietung.html';

// ═══════════════════════════════════════════════════════════════════
// FORMULAR-VERSAND (n8n-Webhook)
// ─────────────────────────
// Alle drei Formulare (Partner-Anfrage, Kontakt-Beratung, Mietanfrage)
// senden ihre Daten per POST (JSON) an diese eine URL.
// → Hier die echte n8n-Webhook-URL eintragen (Production-URL, nicht Test-URL):
//   window.NIKOS_FORM_ENDPOINT = 'https://DEIN-N8N-HOST/webhook/nikos-formular';
//
// Solange der Platzhalter (leer) steht, zeigt das Formular einen Hinweis
// statt zu senden — so geht keine Anfrage verloren.
// ═══════════════════════════════════════════════════════════════════

window.NIKOS_FORM_ENDPOINT = 'https://olec.app.n8n.cloud/webhook/nikos-formular'; // Production-URL (Workflow muss in n8n auf 'Active' stehen)
