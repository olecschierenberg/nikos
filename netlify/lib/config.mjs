// Feste Einstellungen (keine Geheimnisse!). Geheimnisse liegen als
// Umgebungsvariablen in Netlify (siehe netlify/README.md).

// Google-Sheet "NIKOS-Listen" (Tabs: Leads, Partnerliste, Technikerliste,
// Mitarbeiterliste, Zugangsanfragen)
export const SPREADSHEET_ID = '1_JhSXcyg9IEtrMqBSSx0Pt616emHrLsmUx4kH5_umwQ';
export const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`;

export const NOTIFY_EMAIL = 'info@radacom.de'; // Empfänger der internen Benachrichtigungen + Absender aller Mails

// Brevo: Newsletter-Liste + Double-Opt-in-Vorlage
export const BREVO_LIST_ID = 2;
export const DOI_TEMPLATE_ID = 2;
export const DOI_REDIRECT = 'https://olecschierenberg.github.io/nikos/danke.html';

// Website-Adresse (für Links in E-Mails und Weiterleitungen).
// Für Tests kann in Netlify SITE_URL überschrieben werden.
export function siteUrl() {
  return (process.env.SITE_URL || 'https://nikos.info').replace(/\/+$/, '');
}

// Nur diese Seiten dürfen die Funktionen per Browser (fetch) aufrufen.
export const ALLOWED_ORIGINS = [
  'https://nikos.info',
  'https://www.nikos.info',
  'https://nikos.audio',
  'https://www.nikos.audio',
  'https://nikos2.netlify.app',
];

export const KATEGORIEN = ['Partner', 'Techniker', 'Mitarbeiter'];
