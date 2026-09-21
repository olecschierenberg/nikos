// Kleine Hilfsfunktionen

/** HTML-Sonderzeichen entschärfen (Formularwerte kommen von Fremden!). */
export function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Formularwert -> getrimmter, gekürzter Text (Arrays werden zu "a, b"). */
export function text(v, max = 2000) {
  if (v == null || v === false) return '';
  if (Array.isArray(v)) v = v.map((x) => text(x, max)).filter(Boolean).join(', ');
  else if (typeof v === 'object') return '';
  else if (v === true) v = 'ja';
  // eslint-disable-next-line no-control-regex
  return String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
}

/** Text ohne Zeilenumbrüche (für Namen, Betreffzeilen). */
export function oneLine(v, max = 300) {
  return text(v, max).replace(/[\r\n]+/g, ' ').trim();
}

export function isEmail(s) {
  s = String(s || '');
  return s.length <= 254 && /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/.test(s);
}

/** m***@domain.tld – für Logs. */
export function maskEmail(e) {
  const s = String(e || '');
  const i = s.indexOf('@');
  return i < 1 ? '***' : s[0] + '***' + s.slice(i);
}

/** Heutiges Datum als dd.MM.yyyy (Zeitzone Berlin). */
export function today(now = new Date()) {
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(now);
}

/** Zeilenumbrüche im (bereits escapten) Text zu <br>. */
export function nl2br(escaped) {
  return String(escaped).replace(/\r?\n/g, '<br>');
}

const FELD = {
  veranstaltungstechnik: 'Veranstaltungstechnik',
  funktechnik: 'Funktechnik',
  sicherheitstechnik: 'Sicherheitstechnik',
  baustellensicherheit: 'Baustellensicherheit',
  sonstiges: 'Sonstiges',
};

/** "funktechnik, sonstiges" oder ['funktechnik'] -> "Funktechnik, Sonstiges" */
export function mapFelder(v) {
  const list = (Array.isArray(v) ? v : String(v ?? '').split(','))
    .map((x) => String(x).trim())
    .filter(Boolean);
  return list.map((x) => FELD[x] || x.charAt(0).toUpperCase() + x.slice(1)).join(', ');
}

/** Formular-Felder einheitlich einlesen (deutsche + englische Feldnamen). */
export function fields(b) {
  return {
    name: oneLine(text(b.name) || text(b.contact), 200),
    firma: oneLine(text(b.company) || text(b.firma), 200),
    email: text(b.email, 254),
    telefon: oneLine(text(b.phone) || text(b.telefon), 80),
    website: oneLine(text(b.website), 300),
    address: oneLine(text(b.address), 300),
    message: text(b.message, 5000),
  };
}
