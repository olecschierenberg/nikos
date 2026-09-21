// POST /api/form  – ersetzt den n8n-Workflow "Formular-Handling (Anfragen + Newsletter)"
import { handleOptions, json, readJson, HttpError } from '../lib/http.mjs';
import { text, oneLine, isEmail, maskEmail, today, fields } from '../lib/util.mjs';
import { NOTIFY_EMAIL } from '../lib/config.mjs';
import { sendMail, doubleOptIn } from '../lib/mail.mjs';
import { appendRow } from '../lib/sheets.mjs';
import { newRequestToken } from '../lib/tokens.mjs';
import { anfrageNotify, anfrageConfirm, newsletterInfo, zugangConfirmMail } from '../lib/templates.mjs';

export const config = { path: '/api/form' };

const TYP = { newsletter: 'Newsletter', beratung: 'Beratung', mietanfrage: 'Mietanfrage', 'partner-anfrage': 'Partner-Anfrage' };
const fail = (req, status, message) => json(req, status, { status: 'error', message });

export default async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  if (req.method !== 'POST') return fail(req, 405, 'Nur POST erlaubt');

  let b;
  try { b = await readJson(req); } catch (e) {
    return fail(req, e instanceof HttpError ? e.status : 400, e.message);
  }

  // Spam-Schutz: verstecktes Feld muss leer sein, Ausfüllzeit mind. 3 Sekunden
  if (text(b.website_hp) !== '' || !(Number(b.fill_ms || 0) >= 3000)) return fail(req, 400, 'Anfrage abgelehnt');

  const f = fields(b);
  if (!isEmail(f.email)) return fail(req, 400, 'E-Mail fehlt');

  const formType = oneLine(b.formType, 40);
  try {
    if (formType === 'newsletter') return await newsletter(req, f);
    if (formType === 'partner-anfrage') return await zugangsanfrage(req, b, f);
    return await anfrage(req, b, f, formType);
  } catch (e) {
    console.error('form: unerwarteter Fehler', formType, maskEmail(f.email), e.message);
    return fail(req, 502, 'Versand fehlgeschlagen');
  }
};

async function newsletter(req, f) {
  try {
    await doubleOptIn({ email: f.email, name: f.name, firma: f.firma, telefon: f.telefon });
  } catch (e) {
    // Bereits angemeldet o. ä.: dem Besucher nichts verraten, aber nicht als Fehler zeigen
    if (e.status === 400 && /already|exist/i.test(e.message)) console.log('newsletter: Kontakt existiert bereits', maskEmail(f.email));
    else throw e;
  }
  const info = newsletterInfo(f.email);
  await sendMail({ to: NOTIFY_EMAIL, senderName: 'NIKOS Website', ...info }).catch((e) => console.error('newsletter: Info-Mail fehlgeschlagen', e.message));
  return json(req, 200, { status: 'ok' });
}

async function anfrage(req, b, f, formType) {
  const notify = anfrageNotify({
    formType, f, felder: b.geschaeftsfeld,
    details: { type: text(b.type, 100), units: text(b.units, 100), period: text(b.period, 200), location: text(b.location, 300) },
  });
  const confirm = anfrageConfirm({ formType, f });
  const nl = Array.isArray(b.newsletter) ? b.newsletter[0] : b.newsletter;
  const lead = {
    name: f.name, firma: f.firma, email: f.email, telefon: f.telefon, website: f.website,
    newsletter: nl === true || nl === 'true' ? 'x' : '',
    typ: TYP[formType] || formType,
    datum: today(),
  };

  const [mailRadacom, mailKunde, sheet] = await Promise.allSettled([
    sendMail({ to: NOTIFY_EMAIL, senderName: 'NIKOS Website', replyTo: { email: f.email, name: f.name || f.firma || 'NIKOS-Website' }, ...notify }),
    sendMail({ to: f.email, replyTo: { email: NOTIFY_EMAIL, name: 'RADACOM' }, ...confirm }),
    appendRow('Leads', lead),
  ]);
  for (const [label, r] of [['Mail an RADACOM', mailRadacom], ['Bestätigung an Kunde', mailKunde], ['Leads-Sheet', sheet]]) {
    if (r.status === 'rejected') console.error(`anfrage: ${label} fehlgeschlagen`, maskEmail(f.email), r.reason?.message);
  }
  // Anfrage gilt als angekommen, wenn RADACOM sie per Mail ODER im Sheet hat.
  if (mailRadacom.status === 'rejected' && sheet.status === 'rejected') return fail(req, 502, 'Versand fehlgeschlagen');
  return json(req, 200, { status: 'ok' });
}

async function zugangsanfrage(req, b, f) {
  const token = newRequestToken();
  const techniker = b.techniker && (!Array.isArray(b.techniker) || b.techniker.length) ? 'ja' : '';
  await appendRow('Zugangsanfragen', {
    token, status: 'neu', datum: today(),
    name: f.name, firma: f.firma, email: f.email, telefon: f.telefon, website: f.website,
    strasse: oneLine(b.strasse, 200), plz: oneLine(b.plz, 20), ort: oneLine(b.ort, 200), land: oneLine(b.land, 100),
    geschaeftsfeld: text(b.geschaeftsfeld, 300), nachricht: f.message,
    techniker, technikerfirma: oneLine(b.technikerfirma, 200),
  });
  await sendMail({ to: f.email, replyTo: { email: NOTIFY_EMAIL, name: 'RADACOM' }, ...zugangConfirmMail({ name: f.name, token }) });
  return json(req, 200, { status: 'ok' });
}
