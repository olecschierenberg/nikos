'use strict';
/**
 * Feste Werte der beiden Newsletter-Abgleiche.
 *
 * ACHTUNG: Das ist das Sheet "NIKOS-Listen" (Tabs Leads, Partnerliste, ...),
 * NICHT das Sheet "Landingpagedaten" der Keyword-/LP-Automatisierungen.
 * Das Service-Account-Konto aus GOOGLE_SERVICE_ACCOUNT_JSON muss diesem
 * Sheet als Bearbeiter freigegeben sein.
 */
module.exports = {
  SPREADSHEET_ID: '1_JhSXcyg9IEtrMqBSSx0Pt616emHrLsmUx4kH5_umwQ',
  LEADS_TAB: 'Leads',
  // Brevo-Liste "NIKOS Newsletter"
  BREVO_LIST_ID: 2,
  // Werte der Spalte "newsletter" im Blatt Leads:
  //   x = Newsletter aktiv, leer = neutral/neu, - = abgemeldet
  SUBSCRIBED_MARK: 'x',
  UNSUBSCRIBED_MARK: '-',
};
