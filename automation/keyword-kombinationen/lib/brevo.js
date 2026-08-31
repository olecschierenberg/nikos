'use strict';
/**
 * Direkter Brevo-API-Aufruf als Ersatz für den n8n-HTTP-Request-Node
 * "Vorschlags-Mail (Brevo)". 1:1 derselbe Endpunkt, Absender, Empfänger
 * und Mailtext wie im n8n-Node — nur der API-Key wandert vom n8n-Credential
 * ins GitHub-Secret BREVO_API_KEY.
 */

async function sendVorschlagsMail({ apiKey, sheetUrl, count }) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      sender: { name: 'NIKOS Landingpages', email: 'info@radacom.de' },
      to: [{ email: 'o.schierenberg@radacom.de' }],
      subject: 'Neue Landingpage-Kombinationen automatisch angelegt',
      htmlContent:
        `<p>Es wurden ${count != null ? count : ''} neue Landingpage-Kombinationen automatisch erzeugt und freigegeben (Spalte <b>erstellen</b> = x, keine manuelle Freigabe mehr noetig).</p>` +
        '<p>Der stuendliche LP-Generator baut daraus automatisch neue Landingpages.</p>' +
        `<p><a href="${sheetUrl}">Sheet ansehen</a></p>`,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Brevo-Fehler: HTTP ${res.status} ${body.slice(0, 300)}`);
  }
}

module.exports = { sendVorschlagsMail };
