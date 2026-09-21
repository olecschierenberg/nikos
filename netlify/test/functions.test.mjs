import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupEnv, installFakes, post, get, addRow, rowsOf } from './helpers.mjs';

import form from '../functions/form.mjs';
import confirm from '../functions/zugang-confirm.mjs';
import classify from '../functions/zugang-classify.mjs';
import loginRequest from '../functions/login-request.mjs';
import loginVerify from '../functions/login-verify.mjs';
import loginCheck from '../functions/login-check.mjs';
import seoReport from '../functions/seo-report.mjs';
import { createLoginToken, verifyLoginToken, classifySig } from '../lib/tokens.mjs';

const U = 'https://nikos.info';
let st;
beforeEach(() => { setupEnv(); st = installFakes(); });

const good = (extra = {}) => ({ email: 'kunde@example.com', name: 'Max Muster', company: 'Muster GmbH', phone: '+49 711 123', fill_ms: 8000, website_hp: '', consent: true, ...extra });
const hrefsIn = (html) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));

// ---------- Tokens ----------
test('Login-Token: gültig, abgelaufen, manipuliert', () => {
  const t = createLoginToken({ email: 'a@b.de', kategorie: 'Partner' });
  assert.deepEqual(verifyLoginToken(t), { valid: true, email: 'a@b.de', kategorie: 'Partner' });
  assert.equal(verifyLoginToken(t, Date.now() + 25 * 3600 * 1000).valid, false);
  const [p, s] = t.split('.');
  const evil = Buffer.from(JSON.stringify({ e: 'x@y.de', k: 'Partner', x: Date.now() + 1e9 })).toString('base64url');
  assert.equal(verifyLoginToken(`${evil}.${s}`).valid, false);
  assert.equal(verifyLoginToken(`${p}.abc`).valid, false);
  assert.equal(verifyLoginToken('').valid, false);
  assert.equal(verifyLoginToken('a.b.c').valid, false);
  const wrongCat = createLoginToken({ email: 'a@b.de', kategorie: 'Admin' });
  assert.equal(verifyLoginToken(wrongCat).valid, false);
});

// ---------- Formular ----------
test('Form: Spam, fehlende E-Mail, falsche Methode', async () => {
  assert.equal((await post(form, `${U}/api/form`, good({ website_hp: 'http://spam' }))).status, 400);
  assert.equal((await post(form, `${U}/api/form`, good({ fill_ms: 500 }))).status, 400);
  assert.equal((await post(form, `${U}/api/form`, good({ fill_ms: undefined }))).status, 400);
  const r = await post(form, `${U}/api/form`, good({ email: '' }));
  assert.equal(r.status, 400);
  assert.deepEqual(await r.json(), { status: 'error', message: 'E-Mail fehlt' });
  assert.equal((await post(form, `${U}/api/form`, '{kaputt')).status, 400);
  assert.equal((await get(form, `${U}/api/form`)).status, 405);
  assert.equal(st.mails.length, 0);
  assert.equal(rowsOf(st, 'Leads').length, 0);
});

test('Form: Beratungsanfrage → 2 Mails + Lead-Zeile, Eingaben werden escaped', async () => {
  const r = await post(form, `${U}/api/form`, good({ formType: 'beratung', message: 'Hallo <script>alert(1)</script>\nZweite Zeile', name: 'Max <b>Muster</b>', newsletter: true }));
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { status: 'ok' });
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.equal(st.mails.length, 2);
  const intern = st.mails.find((m) => m.to[0].email === 'info@radacom.de');
  const kunde = st.mails.find((m) => m.to[0].email === 'kunde@example.com');
  assert.equal(intern.subject, 'Neue Beratungsanfrage über nikos.audio');
  assert.equal(intern.replyTo.email, 'kunde@example.com');
  assert.equal(intern.sender.email, 'info@radacom.de');
  assert.ok(!intern.htmlContent.includes('<script>'));
  assert.ok(intern.htmlContent.includes('&lt;script&gt;'));
  assert.ok(intern.htmlContent.includes('Zweite Zeile'));
  assert.ok(!intern.htmlContent.includes('<b>Muster</b>'));
  assert.equal(kunde.subject, 'Ihre Anfrage über nikos.audio – Eingangsbestätigung');
  assert.equal(kunde.replyTo.email, 'info@radacom.de');
  const [lead] = rowsOf(st, 'Leads');
  assert.equal(lead.email, 'kunde@example.com');
  assert.equal(lead.firma, 'Muster GmbH');
  assert.equal(lead.typ, 'Beratung');
  assert.equal(lead.newsletter, 'x');
  assert.match(lead.datum, /^\d{2}\.\d{2}\.\d{4}$/);
});

test('Form: Mietanfrage enthält Details; unbekannter Typ läuft als Anfrage', async () => {
  await post(form, `${U}/api/form`, good({ formType: 'mietanfrage', type: 'stadtfest', units: '4', period: 'Juli', location: 'Tübingen' }));
  const intern = st.mails.find((m) => m.to[0].email === 'info@radacom.de');
  assert.equal(intern.subject, 'Neue Mietanfrage über nikos.audio');
  for (const s of ['Stadtfest', 'Anzahl Durchsagestandorte', '<b>Anzahl Durchsagestandorte:</b> 4', 'Tübingen']) assert.ok(intern.htmlContent.includes(s), s);
  assert.equal(rowsOf(st, 'Leads')[0].typ, 'Mietanfrage');
  st.mails.length = 0;
  await post(form, `${U}/api/form`, good({ formType: 'sonstiges' }));
  assert.equal(st.mails[0].subject, 'Neue sonstiges-Anfrage über nikos.audio');
  assert.equal(rowsOf(st, 'Leads')[1].typ, 'sonstiges');
});

test('Form: Anfrage bleibt erfolgreich, wenn nur Teile ausfallen; sonst 502', async () => {
  st.failSheets = true;
  assert.equal((await post(form, `${U}/api/form`, good({ formType: 'beratung' }))).status, 200); // Mail kam an
  st.failSheets = false; st.failMail = true;
  assert.equal((await post(form, `${U}/api/form`, good({ formType: 'beratung' }))).status, 200); // Sheet hat's
  st.failSheets = true;
  assert.equal((await post(form, `${U}/api/form`, good({ formType: 'beratung' }))).status, 502);
});

test('Form: Newsletter → Double-Opt-in + Info-Mail, keine Lead-Zeile', async () => {
  const r = await post(form, `${U}/api/form`, good({ formType: 'newsletter' }));
  assert.equal(r.status, 200);
  assert.equal(st.doi.length, 1);
  assert.deepEqual(st.doi[0].includeListIds, [2]);
  assert.equal(st.doi[0].templateId, 2);
  assert.equal(st.doi[0].attributes.VORNAME, 'Max Muster');
  assert.equal(st.mails.length, 1);
  assert.equal(st.mails[0].subject, 'Neue Newsletter-Anmeldung über nikos.audio');
  assert.equal(rowsOf(st, 'Leads').length, 0);
});

test('Form: Newsletter – schon angemeldet gilt nicht als Fehler, echter Fehler schon', async () => {
  st.doiError = { status: 400, body: { code: 'invalid_parameter', message: 'Contact already exist' } };
  assert.equal((await post(form, `${U}/api/form`, good({ formType: 'newsletter' }))).status, 200);
  st.doiError = { status: 401, body: { message: 'Key not found' } };
  assert.equal((await post(form, `${U}/api/form`, good({ formType: 'newsletter' }))).status, 502);
});

test('Form: CORS nur für erlaubte Seiten', async () => {
  const ok = await post(form, `${U}/api/form`, good({ formType: 'beratung' }), { origin: 'https://nikos.audio' });
  assert.equal(ok.headers.get('access-control-allow-origin'), 'https://nikos.audio');
  const bad = await post(form, `${U}/api/form`, good({ formType: 'beratung' }), { origin: 'https://evil.example' });
  assert.equal(bad.headers.get('access-control-allow-origin'), null);
  const pre = await form(new Request(`${U}/api/form`, { method: 'OPTIONS', headers: { origin: 'https://nikos.info' } }));
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get('access-control-allow-origin'), 'https://nikos.info');
});

// ---------- Zugangsanfrage: Formular → Bestätigung → Klassifizierung ----------
async function neueZugangsanfrage(extra = {}) {
  const r = await post(form, `${U}/api/form`, good({ formType: 'partner-anfrage', geschaeftsfeld: ['funktechnik', 'sonstiges'], techniker: ['ja'], strasse: 'Weg 1', plz: '72070', ort: 'Tübingen', land: 'DE', message: 'Bitte freischalten', ...extra }));
  assert.equal(r.status, 200);
  const [row] = rowsOf(st, 'Zugangsanfragen').slice(-1);
  return row;
}

test('Zugangsanfrage: Zeile + Bestätigungsmail mit zufälligem Token', async () => {
  const row = await neueZugangsanfrage();
  assert.match(row.token, /^zg-[a-z0-9]+-[0-9a-f]{24}$/);
  assert.equal(row.status, 'neu');
  assert.equal(row.geschaeftsfeld, 'funktechnik, sonstiges');
  assert.equal(row.techniker, 'ja');
  assert.equal(row.ort, 'Tübingen');
  assert.equal(st.mails.length, 1);
  assert.equal(st.mails[0].to[0].email, 'kunde@example.com');
  assert.ok(hrefsIn(st.mails[0].htmlContent).includes(`${U}/api/zugang-confirm?token=${row.token}`));
  const row2 = await neueZugangsanfrage();
  assert.notEqual(row.token, row2.token);
});

test('Zugangsanfrage: kompletter Ablauf bis zur Freischaltung (inkl. Schutz vor Doppel-/Fremdklicks)', async () => {
  const { token } = await neueZugangsanfrage();
  st.mails.length = 0;

  // 1) ungültiger Token
  assert.equal((await get(confirm, `${U}/api/zugang-confirm?token=zg-nope`)).status, 400);
  assert.equal((await get(confirm, `${U}/api/zugang-confirm`)).status, 400);

  // 2) Bestätigung durch Antragsteller (zweimal geklickt → nur eine Mail)
  assert.equal((await get(confirm, `${U}/api/zugang-confirm?token=${token}`)).status, 200);
  assert.equal((await get(confirm, `${U}/api/zugang-confirm?token=${token}`)).status, 200);
  assert.equal(rowsOf(st, 'Zugangsanfragen')[0].status, 'bestätigt');
  assert.equal(st.mails.length, 1);
  const m = st.mails[0];
  assert.equal(m.to[0].email, 'info@radacom.de');
  assert.equal(m.subject, 'Zugangsanfrage bestätigt – bitte klassifizieren');
  assert.ok(m.htmlContent.includes('Funktechnik, Sonstiges'));
  const links = hrefsIn(m.htmlContent).filter((h) => h.includes('/api/zugang-classify'));
  assert.equal(links.length, 4);
  const partnerLink = links.find((l) => l.includes('kat=partner'));

  // 3) Selbst gebastelter Link ohne/mit falscher Unterschrift wird abgelehnt
  assert.equal((await get(classify, `${U}/api/zugang-classify?token=${token}&kat=partner`)).status, 400);
  assert.equal((await get(classify, `${U}/api/zugang-classify?token=${token}&kat=partner&sig=${classifySig(token, 'techniker')}`)).status, 400);
  assert.equal(rowsOf(st, 'Partnerliste').length, 0);

  // 4) GET zeigt nur die Rückfrage – ändert nichts
  const page = await get(classify, partnerLink);
  assert.equal(page.status, 200);
  assert.ok((await page.text()).includes('method="POST"'));
  assert.equal(rowsOf(st, 'Partnerliste').length, 0);
  assert.equal(rowsOf(st, 'Zugangsanfragen')[0].status, 'bestätigt');

  // 5) POST führt aus
  const u = new URL(partnerLink);
  const doPost = () => classify(new Request(`${U}/api/zugang-classify`, { method: 'POST', body: new URLSearchParams({ token, kat: 'partner', sig: u.searchParams.get('sig') }) }));
  st.mails.length = 0;
  const res = await doPost();
  assert.equal(res.status, 200);
  assert.ok((await res.text()).includes('Klassifizierung gespeichert'));
  const [p] = rowsOf(st, 'Partnerliste');
  assert.equal(p.partner_id, 'muster-gmbh');
  assert.equal(p.ansprechpartner, 'Max Muster');
  assert.equal(p.email, 'kunde@example.com');
  assert.equal(p.geschaeftsfeld, 'Funktechnik, Sonstiges');
  assert.equal(p.ist_radacom, 'FALSE');
  assert.equal(p.ort, 'Tübingen');
  assert.equal(rowsOf(st, 'Zugangsanfragen')[0].status, 'partner');
  assert.equal(st.mails.length, 1);
  assert.equal(st.mails[0].to[0].email, 'kunde@example.com');
  assert.equal(st.mails[0].subject, 'Ihr NIKOS-Zugang ist freigeschaltet');

  // 6) nochmal → keine Doppel-Einträge, keine zweite Mail
  const again = await doPost();
  assert.ok((await again.text()).includes('Bereits bearbeitet'));
  assert.equal(rowsOf(st, 'Partnerliste').length, 1);
  assert.equal(st.mails.length, 1);
});

test('Klassifizierung: Techniker, Mitarbeiter, Ablehnen', async () => {
  for (const [kat, tab, label] of [['techniker', 'Technikerliste', 'Techniker'], ['mitarbeiter', 'Mitarbeiterliste', 'Mitarbeiter'], ['abgelehnt', null, null]]) {
    const { token } = await neueZugangsanfrage({ email: `${kat}@example.com` });
    await get(confirm, `${U}/api/zugang-confirm?token=${token}`);
    st.mails.length = 0;
    const res = await classify(new Request(`${U}/api/zugang-classify`, { method: 'POST', body: new URLSearchParams({ token, kat, sig: classifySig(token, kat) }) }));
    assert.equal(res.status, 200, kat);
    if (tab) {
      const [row] = rowsOf(st, tab);
      assert.equal(row.kategorie, label);
      assert.equal(row.email, `${kat}@example.com`);
      assert.equal(st.mails.length, 1);
    } else {
      assert.equal(st.mails.length, 0); // Ablehnung: keine Mail
      assert.equal(rowsOf(st, 'Zugangsanfragen').find((r) => r.token === token).status, 'abgelehnt');
    }
  }
});

test('Klassifizierung: Mail-Fehler wird gemeldet, Eintrag bleibt gespeichert', async () => {
  const { token } = await neueZugangsanfrage();
  await get(confirm, `${U}/api/zugang-confirm?token=${token}`);
  st.failMail = true;
  const res = await classify(new Request(`${U}/api/zugang-classify`, { method: 'POST', body: new URLSearchParams({ token, kat: 'partner', sig: classifySig(token, 'partner') }) }));
  assert.equal(res.status, 200);
  assert.ok((await res.text()).includes('nicht</b> gesendet'));
  assert.equal(rowsOf(st, 'Partnerliste').length, 1);
  assert.equal(rowsOf(st, 'Zugangsanfragen')[0].status, 'partner');
});

test('Bestätigung: Mail-Fehler → Fehlerseite, Status bleibt "neu" (erneut klickbar)', async () => {
  const { token } = await neueZugangsanfrage();
  st.failMail = true;
  assert.equal((await get(confirm, `${U}/api/zugang-confirm?token=${token}`)).status, 500);
  assert.equal(rowsOf(st, 'Zugangsanfragen')[0].status, 'neu');
});

// ---------- Magic-Link-Login ----------
test('Login: bekannte Adresse bekommt Link, der komplette Weg funktioniert', async () => {
  addRow(st, 'Partnerliste', { partner_id: 'muster', firma: 'Muster GmbH', ansprechpartner: 'Erika Muster', email: 'Erika@Muster.de' });
  const r = await post(loginRequest, `${U}/api/login-request`, { email: ' erika@muster.de ', website_hp: '' });
  assert.deepEqual(await r.json(), { ok: true });
  assert.equal(st.mails.length, 1);
  assert.equal(st.mails[0].to[0].email, 'erika@muster.de');
  assert.equal(st.mails[0].subject, 'Ihr NIKOS-Anmeldelink');
  assert.ok(st.mails[0].htmlContent.includes('Erika Muster'));
  const link = hrefsIn(st.mails[0].htmlContent).find((h) => h.includes('/api/login-verify'));
  assert.ok(link.startsWith(`${U}/api/login-verify?token=`));

  const v = await get(loginVerify, link);
  assert.equal(v.status, 302);
  const loc = v.headers.get('location');
  assert.ok(loc.startsWith(`${U}/nikos-login.html#nk=`));
  const token = decodeURIComponent(loc.split('#nk=')[1]);

  const c = await get(loginCheck, `${U}/api/login-check?token=${encodeURIComponent(token)}`, { origin: 'https://nikos.info' });
  assert.deepEqual(await c.json(), { valid: true, email: 'erika@muster.de', kategorie: 'Partner' });
  assert.equal(c.headers.get('cache-control'), 'no-store');
  assert.equal(c.headers.get('access-control-allow-origin'), 'https://nikos.info');
});

test('Login: Techniker/Mitarbeiter-Listen, unbekannte Adressen, Bot-Feld', async () => {
  addRow(st, 'Technikerliste', { name: 'Tom Tech', email: 'tom@tech.de', kategorie: 'Techniker' });
  addRow(st, 'Mitarbeiterliste', { name: 'Mia Mit', email: 'mia@radacom.de', kategorie: 'Mitarbeiter' });
  await post(loginRequest, `${U}/api/login-request`, { email: 'tom@tech.de' });
  await post(loginRequest, `${U}/api/login-request`, { email: 'mia@radacom.de' });
  assert.equal(st.mails.length, 2);
  st.mails.length = 0;
  for (const body of [{ email: 'fremd@x.de' }, { email: 'tom@tech.de', website_hp: 'bot' }, { email: 'kaputt' }, {}]) {
    const r = await post(loginRequest, `${U}/api/login-request`, body);
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { ok: true });
  }
  assert.equal(st.mails.length, 0);
});

test('Login: Sheet-Fehler → 502; Mail-Fehler verrät nichts', async () => {
  addRow(st, 'Partnerliste', { ansprechpartner: 'E', email: 'e@m.de' });
  st.failMail = true;
  assert.equal((await post(loginRequest, `${U}/api/login-request`, { email: 'e@m.de' })).status, 200);
  st.failSheets = true;
  assert.equal((await post(loginRequest, `${U}/api/login-request`, { email: 'e@m.de' })).status, 502);
});

test('Login: ungültige / abgelaufene / fremde Tokens', async () => {
  const bad = await get(loginVerify, `${U}/api/login-verify?token=abc.def`);
  assert.equal(bad.status, 400);
  assert.ok((await bad.text()).includes('ungültig'));
  assert.equal((await get(loginVerify, `${U}/api/login-verify`)).status, 400);
  const c = await get(loginCheck, `${U}/api/login-check?token=abc`);
  assert.deepEqual(await c.json(), { valid: false, email: '', kategorie: '' });
  const old = createLoginToken({ email: 'a@b.de', kategorie: 'Partner', now: Date.now() - 25 * 3600 * 1000 });
  assert.equal((await get(loginVerify, `${U}/api/login-verify?token=${old}`)).status, 400);
  // Token mit anderem Geheimnis (z. B. altes n8n-Token) wird abgelehnt
  const t = createLoginToken({ email: 'a@b.de', kategorie: 'Partner' });
  process.env.NIKOS_SECRET = 'ein-ganz-anderes-geheimnis-1234567890';
  assert.equal((await get(loginCheck, `${U}/api/login-check?token=${t}`).then((r) => r.json())).valid, false);
});

test('Login: ohne NIKOS_SECRET keine Tokens', async () => {
  delete process.env.NIKOS_SECRET;
  assert.equal((await get(loginCheck, `${U}/api/login-check?token=x.y`)).status, 500);
});

// ---------- SEO-Report ----------
test('SEO-Report: Auth, Empfänger-Liste, Versand', async () => {
  const url = `${U}/api/seo-report`;
  const body = { recipient: 'info@radacom.de', subject: 'Report\nKW38', html: '<h1>Hi</h1>' };
  assert.equal((await post(seoReport, url, body)).status, 401);
  assert.equal((await post(seoReport, url, body, { authorization: 'Bearer falsch' })).status, 401);
  const auth = { authorization: `Bearer ${process.env.REPORT_SECRET}` };
  assert.equal((await post(seoReport, url, { ...body, recipient: 'fremd@example.com' }, auth)).status, 403);
  assert.equal((await post(seoReport, url, { ...body, html: '' }, auth)).status, 400);
  assert.equal(st.mails.length, 0);
  const ok = await post(seoReport, url, body, auth);
  assert.equal(ok.status, 200);
  assert.equal(await ok.text(), 'OK');
  assert.equal(st.mails[0].subject, 'Report KW38');
  assert.equal(st.mails[0].htmlContent, '<h1>Hi</h1>');
  assert.equal((await post(seoReport, url, { ...body, recipient: 'CHEF@radacom.de' }, auth)).status, 200);
  st.failMail = true;
  assert.equal((await post(seoReport, url, body, auth)).status, 502);
  delete process.env.REPORT_ALLOWED_RECIPIENTS;
  assert.equal((await post(seoReport, url, body, auth)).status, 500);
});
