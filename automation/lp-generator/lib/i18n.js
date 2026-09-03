'use strict';
/**
 * NIKOS Mehrsprachigkeit — gemeinsame Sprachdaten fuer den NEUEN Multi-Sprach-
 * Pfad (regionslose + spaeter regionsbezogene Nicht-Deutschland-LPs, siehe
 * /nikos/Konzept_Mehrsprachige-LPs_2026-09-03_v2.md).
 *
 * WICHTIG: Dies ist ein GEWOEHNLICHES Node-Modul (require() moeglich), NICHT
 * eine der lib/nodes/*.js-Pseudo-n8n-Code-Node-Dateien (die laufen ueber
 * lib/runCodeNode.js's `new Function(...)`-Shim OHNE require()). index.js
 * (normales Node-Skript) requires dieses Modul und reicht die benoetigten
 * Werte (UI_L10N[lang], BASELINE_LANGS, ...) als Teil des $json-Inputs an
 * die Pseudo-Nodes weiter (z.B. lib/nodes/html_bauen_ml.js).
 *
 * UI_L10N ist eine bewusste Kopie der Tabelle aus
 * lib/nodes/html_bauen.js (dort NICHT angetastet, um den bestehenden
 * Single-/Dual-Language-Pfad fuer alle unveraenderten Bestandsseiten
 * garantiert nicht zu beeinflussen). Die 8 Baseline-Sprachen sind bereits
 * alle in dieser Tabelle vorhanden (DE/EN/FR/IT/ES/NL/DA/PL) — fuer Schritt 2
 * (regionslose LPs) muss hier nichts ergaenzt werden.
 */

const BASELINE_LANGS = ['de', 'en', 'fr', 'it', 'es', 'nl', 'da', 'pl'];

// ISO-Code -> Anzeigename (Landessprache), Flagge, og:locale. Kopie aus
// filter_relevanz.js LANG_META (dort ebenfalls unangetastet).
const LANG_META = {
  de: { label: 'Deutsch', flag: '🇩🇪', locale: 'de_DE' },
  en: { label: 'English', flag: '🇬🇧', locale: 'en_GB' },
  da: { label: 'Dansk', flag: '🇩🇰', locale: 'da_DK' },
  nl: { label: 'Nederlands', flag: '🇳🇱', locale: 'nl_NL' },
  es: { label: 'Español', flag: '🇪🇸', locale: 'es_ES' },
  no: { label: 'Norsk', flag: '🇳🇴', locale: 'nb_NO' },
  cs: { label: 'Čeština', flag: '🇨🇿', locale: 'cs_CZ' },
  hu: { label: 'Magyar', flag: '🇭🇺', locale: 'hu_HU' },
  ro: { label: 'Română', flag: '🇷🇴', locale: 'ro_RO' },
  pt: { label: 'Português', flag: '🇵🇹', locale: 'pt_PT' },
  pl: { label: 'Polski', flag: '🇵🇱', locale: 'pl_PL' },
  fr: { label: 'Français', flag: '🇫🇷', locale: 'fr_FR' },
  sv: { label: 'Svenska', flag: '🇸🇪', locale: 'sv_SE' },
  fi: { label: 'Suomi', flag: '🇫🇮', locale: 'fi_FI' },
  tr: { label: 'Türkçe', flag: '🇹🇷', locale: 'tr_TR' },
  lv: { label: 'Latviešu', flag: '🇱🇻', locale: 'lv_LV' },
  hr: { label: 'Hrvatski', flag: '🇭🇷', locale: 'hr_HR' },
  sr: { label: 'Srpski', flag: '🇷🇸', locale: 'sr_RS' },
  mk: { label: 'Makedonski', flag: '🇲🇰', locale: 'mk_MK' },
  el: { label: 'Ελληνικά', flag: '🇬🇷', locale: 'el_GR' },
  sk: { label: 'Slovenčina', flag: '🇸🇰', locale: 'sk_SK' },
  it: { label: 'Italiano', flag: '🇮🇹', locale: 'it_IT' },
};

// UI_L10N: Chrome-Texte (Nav/Footer/CTA/Eyebrow) je Sprache. 1:1-Kopie der
// Bloecke aus lib/nodes/html_bauen.js fuer die 8 Baseline-Sprachen (dort
// bereits vollstaendig vorhanden). Spaeter (Ausbaustufe alle EU-Sprachen)
// hier ergaenzen, NICHT in html_bauen.js (Alt-Pfad bleibt unberuehrt).
const UI_L10N = {
  de: { NAV_SYSTEM: 'System', NAV_APPS: 'Anwendungen', NAV_PRODUCTS: 'Produkte', NAV_REFS: 'Referenzen', NAV_RENTAL: 'Vermietung', NAV_INSIGHTS: 'Wissen', NAV_RENTNOW: 'Jetzt mieten', NAV_CONTACT: 'Kontakt', BANNER_KW: 'autark <span class="dot"></span> zuverlässig <span class="dot"></span> kostengünstig', EYEBROW_WHY: 'Warum NIKOS', EYEBROW_CHALLENGE: 'Herausforderung', EYEBROW_SOLUTION: 'Lösung', USP_HEADING: 'Eine einheitliche Lösung für Alltag und Ernstfall', EYEBROW_FAQ: 'Häufige Fragen', FAQ_HEADING: 'Informationen für Planer und Veranstalter', CTA_HEADING: 'NIKOS für Ihren Einsatz mieten', CTA_BODY: 'Sprechen Sie mit uns über Ihre Anforderungen – wir beraten Sie unverbindlich.', CTA_BUTTON: 'Miete anfragen', FOOTER_COPY: '© 2026 RADACOM GmbH · Alle Rechte vorbehalten', FOOTER_HOME: 'Startseite', FOOTER_TERMS: 'AGB', FOOTER_RENTALTERMS: 'Mietbedingungen', FOOTER_PRIVACY: 'Datenschutz', FOOTER_LEGAL: 'Impressum', FOOTER_ALLCASES: 'Alle Einsatzbeispiele' },
  en: { NAV_SYSTEM: 'System', NAV_APPS: 'Applications', NAV_PRODUCTS: 'Products', NAV_REFS: 'References', NAV_RENTAL: 'Rental', NAV_INSIGHTS: 'Insights', NAV_RENTNOW: 'Rent now', NAV_CONTACT: 'Contact', BANNER_KW: 'autonomous <span class="dot"></span> reliable <span class="dot"></span> cost-effective', EYEBROW_WHY: 'Why NIKOS', EYEBROW_CHALLENGE: 'Challenge', EYEBROW_SOLUTION: 'Solution', USP_HEADING: 'One unified solution for everyday use and emergencies', EYEBROW_FAQ: 'FAQ', FAQ_HEADING: 'Information for planners and organisers', CTA_HEADING: 'Rent NIKOS for your operation', CTA_BODY: 'Talk to us about your requirements – we will advise you with no obligation.', CTA_BUTTON: 'Request rental', FOOTER_COPY: '© 2026 RADACOM GmbH · All rights reserved', FOOTER_HOME: 'Home', FOOTER_TERMS: 'Terms', FOOTER_RENTALTERMS: 'Rental terms', FOOTER_PRIVACY: 'Privacy', FOOTER_LEGAL: 'Legal notice', FOOTER_ALLCASES: 'All use cases' },
  fr: { NAV_SYSTEM: 'Système', NAV_APPS: 'Applications', NAV_PRODUCTS: 'Produits', NAV_REFS: 'Références', NAV_RENTAL: 'Location', NAV_INSIGHTS: 'Ressources', NAV_RENTNOW: 'Louer maintenant', NAV_CONTACT: 'Contact', BANNER_KW: 'autonome <span class="dot"></span> fiable <span class="dot"></span> rentable', EYEBROW_WHY: 'Pourquoi NIKOS', EYEBROW_CHALLENGE: 'Défi', EYEBROW_SOLUTION: 'Solution', USP_HEADING: "Une solution unifiée pour le quotidien et les situations d'urgence", EYEBROW_FAQ: 'Questions fréquentes', FAQ_HEADING: 'Informations pour les organisateurs et planificateurs', CTA_HEADING: 'Louer NIKOS pour votre intervention', CTA_BODY: 'Parlez-nous de vos besoins – nous vous conseillons sans engagement.', CTA_BUTTON: 'Demander la location', FOOTER_COPY: '© 2026 RADACOM GmbH · Tous droits réservés', FOOTER_HOME: 'Accueil', FOOTER_TERMS: 'CGV', FOOTER_RENTALTERMS: 'Conditions de location', FOOTER_PRIVACY: 'Confidentialité', FOOTER_LEGAL: 'Mentions légales', FOOTER_ALLCASES: "Tous les exemples d'utilisation" },
  it: { NAV_SYSTEM: 'Sistema', NAV_APPS: 'Applicazioni', NAV_PRODUCTS: 'Prodotti', NAV_REFS: 'Referenze', NAV_RENTAL: 'Noleggio', NAV_INSIGHTS: 'Risorse', NAV_RENTNOW: 'Noleggia ora', NAV_CONTACT: 'Contatti', BANNER_KW: 'autonomo <span class="dot"></span> affidabile <span class="dot"></span> conveniente', EYEBROW_WHY: 'Perché NIKOS', EYEBROW_CHALLENGE: 'Sfida', EYEBROW_SOLUTION: 'Soluzione', USP_HEADING: "Un'unica soluzione per la quotidianità e le emergenze", EYEBROW_FAQ: 'Domande frequenti', FAQ_HEADING: 'Informazioni per organizzatori e pianificatori', CTA_HEADING: 'Noleggia NIKOS per il tuo evento', CTA_BODY: 'Raccontaci le tue esigenze – ti consigliamo senza impegno.', CTA_BUTTON: 'Richiedi il noleggio', FOOTER_COPY: '© 2026 RADACOM GmbH · Tutti i diritti riservati', FOOTER_HOME: 'Home', FOOTER_TERMS: 'Termini', FOOTER_RENTALTERMS: 'Condizioni di noleggio', FOOTER_PRIVACY: 'Privacy', FOOTER_LEGAL: 'Note legali', FOOTER_ALLCASES: 'Tutti gli esempi di utilizzo' },
  es: { NAV_SYSTEM: 'Sistema', NAV_APPS: 'Aplicaciones', NAV_PRODUCTS: 'Productos', NAV_REFS: 'Referencias', NAV_RENTAL: 'Alquiler', NAV_INSIGHTS: 'Recursos', NAV_RENTNOW: 'Alquilar ahora', NAV_CONTACT: 'Contacto', BANNER_KW: 'autónomo <span class="dot"></span> fiable <span class="dot"></span> rentable', EYEBROW_WHY: 'Por qué NIKOS', EYEBROW_CHALLENGE: 'Reto', EYEBROW_SOLUTION: 'Solución', USP_HEADING: 'Una solución unificada para el día a día y las emergencias', EYEBROW_FAQ: 'Preguntas frecuentes', FAQ_HEADING: 'Información para organizadores y planificadores', CTA_HEADING: 'Alquile NIKOS para su evento', CTA_BODY: 'Cuéntenos sus necesidades: le asesoramos sin compromiso.', CTA_BUTTON: 'Solicitar alquiler', FOOTER_COPY: '© 2026 RADACOM GmbH · Todos los derechos reservados', FOOTER_HOME: 'Inicio', FOOTER_TERMS: 'Condiciones', FOOTER_RENTALTERMS: 'Condiciones de alquiler', FOOTER_PRIVACY: 'Privacidad', FOOTER_LEGAL: 'Aviso legal', FOOTER_ALLCASES: 'Todos los casos de uso' },
  nl: { NAV_SYSTEM: 'Systeem', NAV_APPS: 'Toepassingen', NAV_PRODUCTS: 'Producten', NAV_REFS: 'Referenties', NAV_RENTAL: 'Verhuur', NAV_INSIGHTS: 'Inzichten', NAV_RENTNOW: 'Nu huren', NAV_CONTACT: 'Contact', BANNER_KW: 'autonoom <span class="dot"></span> betrouwbaar <span class="dot"></span> kostenefficiënt', EYEBROW_WHY: 'Waarom NIKOS', EYEBROW_CHALLENGE: 'Uitdaging', EYEBROW_SOLUTION: 'Oplossing', USP_HEADING: 'Eén uniforme oplossing voor dagelijks gebruik en noodgevallen', EYEBROW_FAQ: 'Veelgestelde vragen', FAQ_HEADING: 'Informatie voor planners en organisatoren', CTA_HEADING: 'Huur NIKOS voor uw evenement', CTA_BODY: 'Vertel ons over uw behoeften – wij adviseren u vrijblijvend.', CTA_BUTTON: 'Huur aanvragen', FOOTER_COPY: '© 2026 RADACOM GmbH · Alle rechten voorbehouden', FOOTER_HOME: 'Home', FOOTER_TERMS: 'Algemene voorwaarden', FOOTER_RENTALTERMS: 'Huurvoorwaarden', FOOTER_PRIVACY: 'Privacybeleid', FOOTER_LEGAL: 'Colofon', FOOTER_ALLCASES: 'Alle toepassingen' },
  da: { NAV_SYSTEM: 'System', NAV_APPS: 'Anvendelser', NAV_PRODUCTS: 'Produkter', NAV_REFS: 'Referencer', NAV_RENTAL: 'Udlejning', NAV_INSIGHTS: 'Indsigt', NAV_RENTNOW: 'Lej nu', NAV_CONTACT: 'Kontakt', BANNER_KW: 'autonomt <span class="dot"></span> pålideligt <span class="dot"></span> omkostningseffektivt', EYEBROW_WHY: 'Hvorfor NIKOS', EYEBROW_CHALLENGE: 'Udfordring', EYEBROW_SOLUTION: 'Løsning', USP_HEADING: 'Én samlet løsning til hverdag og nødsituationer', EYEBROW_FAQ: 'Ofte stillede spørgsmål', FAQ_HEADING: 'Information til planlæggere og arrangører', CTA_HEADING: 'Lej NIKOS til dit arrangement', CTA_BODY: 'Fortæl os om dine behov – vi rådgiver dig uforpligtende.', CTA_BUTTON: 'Anmod om leje', FOOTER_COPY: '© 2026 RADACOM GmbH · Alle rettigheder forbeholdes', FOOTER_HOME: 'Forside', FOOTER_TERMS: 'Vilkår', FOOTER_RENTALTERMS: 'Lejebetingelser', FOOTER_PRIVACY: 'Privatliv', FOOTER_LEGAL: 'Juridisk meddelelse', FOOTER_ALLCASES: 'Alle anvendelseseksempler' },
  pl: { NAV_SYSTEM: 'System', NAV_APPS: 'Zastosowania', NAV_PRODUCTS: 'Produkty', NAV_REFS: 'Referencje', NAV_RENTAL: 'Wynajem', NAV_INSIGHTS: 'Wiedza', NAV_RENTNOW: 'Wynajmij teraz', NAV_CONTACT: 'Kontakt', BANNER_KW: 'autonomiczny <span class="dot"></span> niezawodny <span class="dot"></span> opłacalny', EYEBROW_WHY: 'Dlaczego NIKOS', EYEBROW_CHALLENGE: 'Wyzwanie', EYEBROW_SOLUTION: 'Rozwiązanie', USP_HEADING: 'Jedno rozwiązanie na co dzień i w sytuacjach awaryjnych', EYEBROW_FAQ: 'Najczęstsze pytania', FAQ_HEADING: 'Informacje dla organizatorów i planistów', CTA_HEADING: 'Wynajmij NIKOS na swoje wydarzenie', CTA_BODY: 'Opowiedz nam o swoich potrzebach – doradzimy bez zobowiązań.', CTA_BUTTON: 'Zapytaj o wynajem', FOOTER_COPY: '© 2026 RADACOM GmbH · Wszelkie prawa zastrzeżone', FOOTER_HOME: 'Strona główna', FOOTER_TERMS: 'Regulamin', FOOTER_RENTALTERMS: 'Warunki najmu', FOOTER_PRIVACY: 'Prywatność', FOOTER_LEGAL: 'Nota prawna', FOOTER_ALLCASES: 'Wszystkie przykłady zastosowań' },
};

module.exports = { BASELINE_LANGS, LANG_META, UI_L10N };
