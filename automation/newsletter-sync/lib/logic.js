'use strict';
/**
 * Reine Entscheidungslogik ohne Netzwerk- oder Sheet-Zugriff (deshalb per
 * "npm test" mit Testdaten pruefbar).
 *
 * Eine Zeile aus dem Sheet hat die Form { rowNumber, values: { <Spalte>: <Text> } }.
 * Ein Brevo-Kontakt hat die Form { email, emailBlacklisted, attributes: { VORNAME, FIRMA, TELEFON } }.
 */
const { SUBSCRIBED_MARK, UNSUBSCRIBED_MARK } = require('./config');

const norm = (v) => String(v == null ? '' : v).trim();
const normEmail = (v) => norm(v).toLowerCase();

// Fuer Logausgaben: Die Logs eines Repos koennen oeffentlich sein, deshalb
// nie volle E-Mail-Adressen ausgeben ("m***@firma.de").
function maskEmail(email) {
  const e = norm(email);
  const at = e.indexOf('@');
  if (at < 1) return '***';
  return e[0] + '***' + e.slice(at);
}

// Abmelde-Sync: alle Zeilen mit newsletter = "-" -> Liste der E-Mail-Adressen
// (ohne Duplikate, ohne Zeilen ohne E-Mail).
function planUnsubscribes(rows) {
  const seen = new Set();
  const emails = [];
  let withoutEmail = 0;
  for (const r of rows) {
    if (norm(r.values.newsletter) !== UNSUBSCRIBED_MARK) continue;
    const email = norm(r.values.email);
    if (!email) {
      withoutEmail++;
      continue;
    }
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    emails.push(email);
  }
  return { emails, withoutEmail };
}

// Newsletter-Sync: Brevo-Kontakte (Liste 2) -> Leads-Blatt.
// Regeln:
//  - Gesperrte Kontakte (emailBlacklisted) werden nie als aktiv markiert.
//  - Steht in irgendeiner Zeile dieser E-Mail "-", gilt die Abmeldung
//    (sie wird spaetestens vom naechsten Abmelde-Sync in Brevo nachgezogen)
//    und der Kontakt wird NICHT wieder auf "x" gesetzt.
//  - Bekannte E-Mail: nur die Spalte "newsletter" wird auf "x" gesetzt (erste
//    Zeile dieser E-Mail); leere Spalten name/firma/telefon werden aus Brevo
//    ergaenzt. Vorhandene Werte werden nie ueberschrieben.
//  - Unbekannte E-Mail: neue Zeile (name/firma/telefon aus Brevo, typ=Newsletter).
function planImport(contacts, rows, today) {
  const byEmail = new Map();
  for (const r of rows) {
    const k = normEmail(r.values.email);
    if (!k) continue;
    if (!byEmail.has(k)) byEmail.set(k, []);
    byEmail.get(k).push(r);
  }

  const stats = {
    contacts: 0,
    skippedBlacklisted: 0,
    skippedUnsubscribedInSheet: 0,
    alreadyMarked: 0,
    marked: 0,
    appended: 0,
    filledCells: 0,
  };
  const cellUpdates = []; // { rowNumber, column, value }
  const appends = []; // { name, firma, email, telefon, newsletter, typ, datum }
  const seen = new Set();

  for (const c of contacts) {
    const key = normEmail(c.email);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    stats.contacts++;

    if (c.emailBlacklisted === true) {
      stats.skippedBlacklisted++;
      continue;
    }

    const attrs = c.attributes || {};
    const brevo = {
      name: norm(attrs.VORNAME),
      firma: norm(attrs.FIRMA),
      telefon: norm(attrs.TELEFON),
    };
    const matches = byEmail.get(key);

    if (!matches) {
      appends.push({
        name: brevo.name,
        firma: brevo.firma,
        email: norm(c.email),
        telefon: brevo.telefon,
        newsletter: SUBSCRIBED_MARK,
        typ: 'Newsletter',
        datum: today,
      });
      stats.appended++;
      continue;
    }

    if (matches.some((r) => norm(r.values.newsletter) === UNSUBSCRIBED_MARK)) {
      stats.skippedUnsubscribedInSheet++;
      continue;
    }
    if (matches.some((r) => ['x', 'true'].includes(norm(r.values.newsletter).toLowerCase()))) {
      stats.alreadyMarked++;
      continue;
    }

    const first = matches[0];
    cellUpdates.push({ rowNumber: first.rowNumber, column: 'newsletter', value: SUBSCRIBED_MARK });
    stats.marked++;
    for (const col of ['name', 'firma', 'telefon']) {
      if (brevo[col] && !norm(first.values[col])) {
        cellUpdates.push({ rowNumber: first.rowNumber, column: col, value: brevo[col] });
        stats.filledCells++;
      }
    }
  }

  return { cellUpdates, appends, stats };
}

module.exports = { norm, normEmail, maskEmail, planUnsubscribes, planImport };
