// GET /api/zugang-confirm?token=…  – Antragsteller bestätigt seine Zugangsanfrage
// (ersetzt in n8n "Zugangsanfragen" → "WH Bestätigung")
import { html } from '../lib/http.mjs';
import { card, OK, WARN } from '../lib/pages.mjs';
import { NOTIFY_EMAIL, siteUrl } from '../lib/config.mjs';
import { readTab, updateCells } from '../lib/sheets.mjs';
import { sendMail } from '../lib/mail.mjs';
import { cleanToken } from '../lib/tokens.mjs';
import { classifyMail } from '../lib/templates.mjs';

export const config = { path: '/api/zugang-confirm' };

const invalid = () => html(400, card({
  icon: WARN, title: 'Link ungültig', heading: 'Link ungültig oder abgelaufen',
  bodyHtml: 'Dieser Bestätigungslink ist nicht (mehr) gültig.<br>Bitte stellen Sie Ihre Zugangsanfrage erneut oder kontaktieren Sie uns unter <a href="mailto:info@radacom.de" style="color:#FF6600;">info@radacom.de</a>.',
  button: { label: 'Neue Anfrage stellen', href: `${siteUrl()}/nikos-vermietung-partner-werden.html` },
}));

const done = () => html(200, card({
  icon: OK, title: 'Anfrage bestätigt', heading: 'Vielen Dank!',
  bodyHtml: 'Ihre Zugangsanfrage wurde bestätigt.<br>RADACOM prüft sie nun und meldet sich in Kürze bei Ihnen.',
  button: { label: 'Zur NIKOS-Website', href: `${siteUrl()}/` },
}));

export default async (req) => {
  if (req.method !== 'GET') return html(405, 'Nur GET erlaubt');
  const token = cleanToken(new URL(req.url).searchParams.get('token'));
  if (!token) return invalid();

  try {
    const { header, rows } = await readTab('Zugangsanfragen');
    const hit = rows.find((r) => r.data.token && r.data.token.trim() === token);
    if (!hit) return invalid();

    // Nur beim ersten Klick ("neu") wirklich etwas tun – mehrfaches Klicken/Link-Scanner schaden so nicht.
    const status = (hit.data.status || '').trim().toLowerCase();
    if (status === 'neu' || status === '') {
      await sendMail({ to: NOTIFY_EMAIL, senderName: 'NIKOS Website', ...classifyMail(hit.data) });
      await updateCells('Zugangsanfragen', header, hit.rowNumber, { status: 'bestätigt' })
        .catch((e) => console.error('zugang-confirm: Status konnte nicht gesetzt werden', e.message));
    }
    return done();
  } catch (e) {
    console.error('zugang-confirm: Fehler', e.message);
    return html(500, card({
      icon: WARN, title: 'Fehler', heading: 'Das hat leider nicht geklappt',
      bodyHtml: 'Bitte versuchen Sie es in ein paar Minuten noch einmal oder schreiben Sie uns an <a href="mailto:info@radacom.de" style="color:#FF6600;">info@radacom.de</a>.',
    }));
  }
};
