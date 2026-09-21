// GET/POST /api/zugang-classify  – RADACOM ordnet eine bestätigte Zugangsanfrage zu
// (ersetzt in n8n "Zugangsanfragen" → "WH Klassifizierung")
//
// Neu gegenüber n8n:
//  - Links sind signiert (sig) → der Antragsteller kann sich nicht selbst freischalten
//  - GET zeigt nur eine Bestätigungsseite, erst der Button (POST) führt aus
//    → Link-Scanner in Mail-Programmen lösen nichts aus
//  - bereits bearbeitete Anfragen werden nicht doppelt eingetragen
import { html } from '../lib/http.mjs';
import { card, OK, WARN } from '../lib/pages.mjs';
import { NOTIFY_EMAIL, SHEET_URL } from '../lib/config.mjs';
import { esc, today, mapFelder, maskEmail } from '../lib/util.mjs';
import { readTab, appendRow, updateCells } from '../lib/sheets.mjs';
import { sendMail } from '../lib/mail.mjs';
import { cleanToken, classifySig, safeEqual } from '../lib/tokens.mjs';
import { freigabeMail } from '../lib/templates.mjs';

export const config = { path: '/api/zugang-classify' };

const KATS = ['partner', 'techniker', 'mitarbeiter', 'abgelehnt'];
const LABEL = { partner: 'Partner', techniker: 'Techniker', mitarbeiter: 'Mitarbeiter', abgelehnt: 'abgelehnt' };
const LISTE = { partner: 'Partnerliste', techniker: 'Technikerliste', mitarbeiter: 'Mitarbeiterliste' };
const sheetBtn = { label: 'Zum NIKOS-Listen-Sheet', href: SHEET_URL };

const invalid = () => html(400, card({
  icon: WARN, title: 'Link ungültig', heading: 'Link ungültig oder abgelaufen',
  bodyHtml: 'Dieser Klassifizierungs-Link ist nicht (mehr) gültig.<br>Bitte prüfen Sie den Eintrag direkt im Sheet.',
  button: sheetBtn,
}));

const slug = (s) => (s || 'partner').toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export default async (req) => {
  if (req.method !== 'GET' && req.method !== 'POST') return html(405, 'Nur GET/POST erlaubt');

  let token; let kat; let sig;
  if (req.method === 'GET') {
    const q = new URL(req.url).searchParams;
    token = cleanToken(q.get('token')); kat = String(q.get('kat') || '').toLowerCase(); sig = String(q.get('sig') || '');
  } else {
    const fd = await req.formData().catch(() => null);
    if (!fd) return invalid();
    token = cleanToken(fd.get('token')); kat = String(fd.get('kat') || '').toLowerCase(); sig = String(fd.get('sig') || '');
  }
  if (!token || !KATS.includes(kat)) return invalid();
  try {
    if (!safeEqual(classifySig(token, kat), sig)) return invalid();
  } catch (e) {
    console.error('zugang-classify: Konfigurationsfehler', e.message);
    return html(500, 'Konfigurationsfehler');
  }

  try {
    const { header, rows } = await readTab('Zugangsanfragen');
    const hit = rows.find((r) => r.data.token && r.data.token.trim() === token);
    if (!hit) return invalid();
    const r = hit.data;

    const status = (r.status || '').trim().toLowerCase();
    if (KATS.includes(status)) {
      return html(200, card({
        icon: OK, title: 'Bereits bearbeitet', heading: 'Bereits bearbeitet',
        bodyHtml: `Diese Zugangsanfrage wurde schon bearbeitet (Status: ${esc(status)}). Es wurde nichts geändert.`,
        button: sheetBtn,
      }));
    }

    if (req.method === 'GET') {
      const form = `<form method="POST" style="margin:0 0 20px;"><input type="hidden" name="token" value="${esc(token)}"><input type="hidden" name="kat" value="${esc(kat)}"><input type="hidden" name="sig" value="${esc(sig)}"><button type="submit" style="background:#FF6600;color:#fff;padding:12px 28px;border:0;border-radius:4px;font-size:15px;font-weight:600;cursor:pointer;">Jetzt „${esc(LABEL[kat])}“ bestätigen</button></form>`;
      return html(200, card({
        icon: '❓', title: 'Klassifizierung bestätigen', heading: 'Bitte bestätigen',
        bodyHtml: `<b>${esc(r.name)}</b>${r.firma ? ` (${esc(r.firma)})` : ''}<br>${esc(r.email)}<br><br>Einstufung: <b>${esc(LABEL[kat])}</b>`,
        extraHtml: form,
      }));
    }

    // --- POST: ausführen ---
    let mailFailed = false;
    if (kat !== 'abgelehnt') {
      const liste = LISTE[kat];
      const existing = await readTab(liste);
      const already = existing.rows.some((x) => (x.data.email || '').trim().toLowerCase() === (r.email || '').trim().toLowerCase());
      if (!already) {
        if (kat === 'partner') {
          await appendRow(liste, {
            partner_id: slug(r.firma || r.name), firma: r.firma, ansprechpartner: r.name, telefon: r.telefon, email: r.email,
            website: r.website, ist_radacom: 'FALSE', strasse: r.strasse, plz: r.plz, ort: r.ort, land: r.land,
            geschaeftsfeld: mapFelder(r.geschaeftsfeld),
          });
        } else {
          await appendRow(liste, {
            datum: today(), name: r.name, firma: r.firma, email: r.email, telefon: r.telefon, website: r.website,
            kategorie: LABEL[kat],
          });
        }
      }
      try {
        await sendMail({ to: r.email, replyTo: { email: NOTIFY_EMAIL, name: 'RADACOM' }, ...freigabeMail({ name: r.name, email: r.email, kat }) });
      } catch (e) {
        mailFailed = true;
        console.error('zugang-classify: Freigabe-Mail fehlgeschlagen', maskEmail(r.email), e.message);
      }
    }
    await updateCells('Zugangsanfragen', header, hit.rowNumber, { status: kat });

    return html(200, card({
      icon: mailFailed ? WARN : OK, title: 'Klassifizierung gespeichert', heading: 'Klassifizierung gespeichert',
      bodyHtml: mailFailed
        ? `Der Eintrag wurde gespeichert, aber die Login-Mail an ${esc(r.email)} konnte <b>nicht</b> gesendet werden. Bitte den Antragsteller manuell informieren.`
        : 'Die Zugangsanfrage wurde verarbeitet.<br>Bei Freischaltung erhält der Antragsteller automatisch eine Login-Mail.',
      button: sheetBtn,
    }));
  } catch (e) {
    console.error('zugang-classify: Fehler', e.message);
    return html(500, card({
      icon: WARN, title: 'Fehler', heading: 'Das hat leider nicht geklappt',
      bodyHtml: 'Bitte den Link später noch einmal öffnen oder den Eintrag direkt im Sheet bearbeiten.',
      button: sheetBtn,
    }));
  }
};
