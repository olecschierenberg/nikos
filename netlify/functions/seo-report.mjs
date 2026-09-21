// POST /api/seo-report  – verschickt den SEO-/GEO-Report per Mail
// (ersetzt den n8n-Workflow "SEO-/GEO-Report Versand")
//
// Aufruf: POST mit Header  Authorization: Bearer <REPORT_SECRET>
//         und JSON  { "recipient": "…", "subject": "…", "html": "…" }
// Empfänger müssen in REPORT_ALLOWED_RECIPIENTS stehen (kommagetrennt) – so kann
// die Funktion nie als offenes Mail-Relay missbraucht werden.
import { plain, readJson, HttpError } from '../lib/http.mjs';
import { text, oneLine, isEmail } from '../lib/util.mjs';
import { safeEqual } from '../lib/tokens.mjs';
import { sendMail } from '../lib/mail.mjs';

export const config = { path: '/api/seo-report' };

export default async (req) => {
  if (req.method !== 'POST') return plain(405, 'Nur POST erlaubt');

  const secret = process.env.REPORT_SECRET || '';
  const allowed = (process.env.REPORT_ALLOWED_RECIPIENTS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (secret.length < 24 || !allowed.length) {
    console.error('seo-report: REPORT_SECRET (mind. 24 Zeichen) und REPORT_ALLOWED_RECIPIENTS müssen gesetzt sein');
    return plain(500, 'Nicht konfiguriert');
  }
  const auth = req.headers.get('authorization') || '';
  if (!safeEqual(auth, `Bearer ${secret}`)) return plain(401, 'Nicht autorisiert');

  let b;
  try { b = await readJson(req, 600_000); } catch (e) {
    return plain(e instanceof HttpError ? e.status : 400, e.message);
  }
  const recipient = text(b.recipient, 254).toLowerCase();
  const subject = oneLine(b.subject, 300);
  const body = text(b.html, 500_000);
  if (!isEmail(recipient) || !subject || !body) return plain(400, 'recipient, subject und html sind erforderlich');
  if (!allowed.includes(recipient)) return plain(403, 'Empfänger nicht erlaubt');

  try {
    await sendMail({ to: recipient, senderName: 'NIKOS Report', subject, html: body });
    return plain(200, 'OK');
  } catch (e) {
    console.error('seo-report: Versand fehlgeschlagen', e.message);
    return plain(502, 'Versand fehlgeschlagen');
  }
};
