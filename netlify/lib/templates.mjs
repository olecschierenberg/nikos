// Mail-Texte (Wortlaut wie bisher in n8n; alle Fremdwerte werden escaped)
import { esc, nl2br, mapFelder } from './util.mjs';
import { SHEET_URL, siteUrl } from './config.mjs';
import { classifySig } from './tokens.mjs';

const ANLIEGEN = { beratung: 'Beratungsanfrage', mietanfrage: 'Mietanfrage', 'partner-anfrage': 'Partneranfrage' };
export const anliegenLabel = (formType) => ANLIEGEN[formType] || `${formType}-Anfrage`;

const cap = (v) => (v ? v.charAt(0).toUpperCase() + v.slice(1) : '–');
const li = (label, value) => `<li><b>${label}:</b> ${esc(value)}</li>`;

/** Interne Mail an RADACOM: neue Beratungs-/Miet-/sonstige Anfrage */
export function anfrageNotify({ formType, f, felder, details }) {
  const label = anliegenLabel(formType);
  const feld = mapFelder(felder);
  let h = `<h2>Neue ${esc(label)}</h2><ul>${li('Name', f.name)}${li('Firma', f.firma)}${li('E-Mail', f.email)}${li('Telefon', f.telefon)}`;
  if (f.website) h += li('Website', f.website);
  if (f.address) h += li('Adresse', f.address);
  if (feld) h += li('Geschäftsfeld', feld);
  h += '</ul>';
  if (formType === 'mietanfrage') {
    h += `<h3>Mietanfrage-Details</h3><ul>${li('Anwendung', cap(details.type))}${li('Anzahl Durchsagestandorte', details.units || '–')}${li('Einsatzzeitraum', details.period || '–')}${li('Einsatzort', details.location || '–')}</ul>`;
  }
  h += `<p><b>Nachricht:</b><br>${nl2br(esc(f.message))}</p><p><a href="${SHEET_URL}">Lead im Leads-Blatt öffnen</a></p>`;
  return { subject: `Neue ${label} über nikos.audio`, html: h };
}

/** Eingangsbestätigung an den Absender der Anfrage */
export function anfrageConfirm({ formType, f }) {
  return {
    subject: 'Ihre Anfrage über nikos.audio – Eingangsbestätigung',
    html: `<p>Guten Tag ${esc(f.name || f.firma)},</p><p>vielen Dank für Ihre Anfrage über nikos.audio. Wir haben Ihre Nachricht erhalten und melden uns zeitnah bei Ihnen. Diese E-Mail ist eine automatische Eingangsbestätigung mit einer Zusammenfassung Ihrer Angaben.</p><h3>Ihre Angaben</h3><ul>${li('Anliegen', anliegenLabel(formType))}${li('Name', f.name)}${li('Firma', f.firma)}${li('E-Mail', f.email)}${li('Telefon', f.telefon)}</ul><p><b>Ihre Nachricht:</b><br>${nl2br(esc(f.message))}</p><p>Wenn etwas nicht stimmt oder Sie etwas ergänzen möchten, antworten Sie einfach auf diese E-Mail.</p><p>Mit freundlichen Grüßen<br>Ihr RADACOM-Team<br>info@radacom.de · www.radacom.de</p>`,
  };
}

export function newsletterInfo(email) {
  return { subject: 'Neue Newsletter-Anmeldung über nikos.audio', html: `<p>${esc(email)} hat sich zum Newsletter angemeldet.</p>` };
}

/** Bestätigungs-Mail an den Antragsteller (Zugangsanfrage) */
export function zugangConfirmMail({ name, token }) {
  const link = `${siteUrl()}/api/zugang-confirm?token=${encodeURIComponent(token)}`;
  return {
    subject: 'Bitte bestätigen Sie Ihre NIKOS-Zugangsanfrage',
    html: `<p>Guten Tag ${esc(name)},</p><p>bitte bestätigen Sie Ihre Zugangsanfrage mit einem Klick:</p><p><a href="${esc(link)}">Anfrage bestätigen</a></p><p>Falls Sie diese Anfrage nicht gestellt haben, ignorieren Sie diese E-Mail.</p><p>Mit freundlichen Grüßen<br>Ihr RADACOM-Team</p>`,
  };
}

/** Mail an RADACOM nach Bestätigung: 4 Klassifizierungs-Links (mit Unterschrift) */
export function classifyMail(r) {
  const link = (kat, label) => {
    const q = `token=${encodeURIComponent(r.token)}&kat=${kat}&sig=${classifySig(r.token, kat)}`;
    return `<p><a href="${esc(`${siteUrl()}/api/zugang-classify?${q}`)}">${label}</a></p>`;
  };
  const feld = mapFelder(r.geschaeftsfeld);
  let h = `<h2>Zugangsanfrage bestätigt</h2><ul>${li('Name', r.name)}${li('Firma', r.firma)}${li('E-Mail', r.email)}${li('Telefon', r.telefon)}`;
  if (feld) h += li('Geschäftsfeld', feld);
  if (r.techniker === 'ja') h += li('Techniker', 'ja');
  if ((r.technikerfirma || '').trim()) h += li('Techniker-Firma', r.technikerfirma);
  h += `</ul><p>Bitte klassifizieren:</p>${link('partner', 'Als Partner freischalten')}${link('techniker', 'Als Techniker freischalten')}${link('mitarbeiter', 'Als Mitarbeiter freischalten')}${link('abgelehnt', 'Ablehnen')}`;
  return { subject: 'Zugangsanfrage bestätigt – bitte klassifizieren', html: h };
}

/** Freischaltungs-Mail an den Antragsteller */
export function freigabeMail({ name, email, kat }) {
  const loginUrl = `${siteUrl()}/nikos-login.html`;
  return {
    subject: 'Ihr NIKOS-Zugang ist freigeschaltet',
    html: `<p>Guten Tag ${esc(name)},</p><p>Ihr Zugang zum geschützten NIKOS-Bereich (Kategorie: ${esc(kat)}) wurde freigeschaltet.</p><p><b>So melden Sie sich an – ganz ohne Passwort:</b></p><ol><li>Öffnen Sie die Anmeldeseite: <a href="${esc(loginUrl)}">nikos.info/nikos-login.html</a></li><li>Geben Sie dort Ihre E-Mail-Adresse ein (${esc(email)}).</li><li>Sie erhalten sofort eine E-Mail mit Ihrem persönlichen Anmeldelink – ein Klick darauf meldet Sie an.</li></ol><p>Jeder Anmeldelink ist 24 Stunden gültig. Ein Passwort müssen Sie sich nicht merken – fordern Sie einfach bei jedem Besuch einen neuen Link an.</p><p style="margin:24px 0;"><a href="${esc(loginUrl)}" style="background:#FF6600;color:#ffffff;padding:12px 28px;border-radius:4px;font-weight:600;text-decoration:none;">Zur Anmeldung</a></p><p>Mit freundlichen Grüßen<br>Ihr RADACOM-Team</p>`,
  };
}

/** Magic-Link-Mail */
export function loginLinkMail({ name, kategorie, token }) {
  const link = `${siteUrl()}/api/login-verify?token=${encodeURIComponent(token)}`;
  return {
    subject: 'Ihr NIKOS-Anmeldelink',
    html: `<p>Guten Tag ${esc(name)},</p><p>hier ist Ihr persönlicher Anmeldelink für den geschützten NIKOS-Bereich (Kategorie: ${esc(kategorie)}):</p><p style="margin:24px 0;"><a href="${esc(link)}" style="background:#FF6600;color:#ffffff;padding:12px 28px;border-radius:4px;font-weight:600;text-decoration:none;">Jetzt anmelden</a></p><p>Der Link ist <b>24 Stunden gültig</b>. Ein Passwort benötigen Sie nicht – fordern Sie bei Bedarf einfach jederzeit einen neuen Anmeldelink an.</p><p>Falls Sie diese Anmeldung nicht angefordert haben, können Sie diese E-Mail ignorieren.</p><p>Mit freundlichen Grüßen<br>Ihr RADACOM-Team</p>`,
  };
}
