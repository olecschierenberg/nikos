// Brevo: Transaktions-Mails + Double-Opt-in
import { NOTIFY_EMAIL, BREVO_LIST_ID, DOI_TEMPLATE_ID, DOI_REDIRECT } from './config.mjs';

export class BrevoError extends Error {
  constructor(status, detail) {
    super(`Brevo HTTP ${status}: ${String(detail).slice(0, 200)}`);
    this.status = status;
  }
}

async function brevo(path, body) {
  const key = process.env.BREVO_API_KEY;
  if (!key) throw new Error('BREVO_API_KEY fehlt');
  const res = await fetch(`https://api.brevo.com/v3${path}`, {
    method: 'POST',
    headers: { 'api-key': key, accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new BrevoError(res.status, await res.text().catch(() => ''));
  return res;
}

/** E-Mail senden. Absender-Adresse ist immer info@radacom.de (bei Brevo verifiziert). */
export async function sendMail({ to, subject, html, senderName = 'RADACOM', replyTo }) {
  const body = {
    sender: { name: senderName, email: NOTIFY_EMAIL },
    to: [{ email: to }],
    subject,
    htmlContent: html,
  };
  if (replyTo) body.replyTo = replyTo;
  await brevo('/smtp/email', body);
}

/** Newsletter-Anmeldung mit Bestätigungs-Mail (Double-Opt-in). */
export async function doubleOptIn({ email, name = '', firma = '', telefon = '' }) {
  await brevo('/contacts/doubleOptinConfirmation', {
    email,
    includeListIds: [BREVO_LIST_ID],
    templateId: DOI_TEMPLATE_ID,
    redirectionUrl: DOI_REDIRECT,
    attributes: { VORNAME: name, FIRMA: firma, TELEFON: telefon },
  });
}
