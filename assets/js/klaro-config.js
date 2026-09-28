// Klaro Consent Manager — Konfiguration für nikos.info
// Dienste: Statistik (Umami + Ahrefs Web Analytics, Widerspruchslösung), Brevo Newsletter
// Klaro-Version: aktuell via CDN (kiprotect.com)

var klaroConfig = {
  version: 1,
  elementID: 'klaro',
  storageMethod: 'localStorage',
  cookieName: 'nikos_consent',
  cookieExpiresAfterDays: 365,
  privacyPolicy: '/de/datenschutz/',

  // Sprache: DE primär, EN als Fallback
  lang: 'de',
  translations: {
    de: {
      consentModal: {
        title: 'Datenschutz-Einstellungen',
        description:
          'Wir verwenden optionale Dienste, um unsere Website zu verbessern. ' +
          'Sie können selbst entscheiden, welche Dienste Sie zulassen möchten. ' +
          'Bitte beachten Sie, dass bei Ablehnung bestimmter Dienste Funktionen eingeschränkt sein können.',
      },
      consentNotice: {
        title: 'Datenschutz-Hinweis',
        description:
          'Wir nutzen optionale Dienste (Analyse, Newsletter). ' +
          'Mehr dazu in unserer {privacyPolicy}.',
        privacyPolicy: {
          name: 'Datenschutzerklärung',
          text: 'Mehr dazu in unserer {privacyPolicy}.',
        },
        learnMore: 'Einstellungen',
      },
      acceptAll: 'Alle akzeptieren',
      acceptSelected: 'Auswahl bestätigen',
      decline: 'Nur notwendige',
      close: 'Schließen',
      save: 'Einstellungen speichern',
      purposes: {
        analytics: 'Statistik (anonym, ohne Cookies)',
        marketing: 'Marketing & Newsletter',
      },
      service: {
        disableAll: {
          title: 'Alle Dienste deaktivieren',
          description: 'Deaktiviert alle optionalen Dienste.',
        },
      },
    },
    en: {
      consentModal: {
        title: 'Privacy Settings',
        description:
          'We use optional services to improve our website. ' +
          'You can decide which services you wish to allow.',
      },
      consentNotice: {
        title: 'Privacy Notice',
        description:
          'We use optional services (analytics, newsletter). ' +
          'See our {privacyPolicy} for details.',
        privacyPolicy: {
          name: 'Privacy Policy',
          text: 'See our {privacyPolicy} for details.',
        },
        learnMore: 'Settings',
      },
      acceptAll: 'Accept all',
      acceptSelected: 'Confirm selection',
      decline: 'Necessary only',
      close: 'Close',
      save: 'Save settings',
      purposes: {
        analytics: 'Statistics (anonymous, no cookies)',
        marketing: 'Marketing & Newsletter',
      },
    },
  },

  services: [
    {
      // Statistik (Umami + Ahrefs Web Analytics) — cookiefrei, anonym.
      // Rechtsgrundlage berechtigtes Interesse: standardmäßig an (optOut), Besucher kann widersprechen.
      // Geladen wird beides über assets/js/nk-analytics.js; dieser Schalter setzt nur den Widerspruch
      // (localStorage 'nk-analytics-optout'), der auf allen Seiten inkl. Landingpages gilt.
      name: 'statistik',
      title: 'Statistik (Umami, Ahrefs Web Analytics)',
      purposes: ['analytics'],
      required: false,
      default: true,
      optOut: true,
      description:
        'Anonyme, cookiefreie Besucherstatistik. Es werden keine personenbezogenen Daten gespeichert. ' +
        'Anonymous, cookie-free visitor statistics. No personal data is stored.',
      callback: function (consent) {
        try {
          if (consent) { localStorage.removeItem('nk-analytics-optout'); localStorage.removeItem('umami.disabled'); }
          else { localStorage.setItem('nk-analytics-optout', '1'); localStorage.setItem('umami.disabled', '1'); }
        } catch (e) {}
      },
    },
    {
      // Brevo Newsletter-Einbettung (falls Formular eingebettet wird)
      name: 'brevo',
      title: 'Brevo (Newsletter)',
      purposes: ['marketing'],
      required: false,
      default: false,
      description:
        'Wir nutzen Brevo (ehemals Sendinblue) für den Versand unseres Newsletters. ' +
        'Bei Anmeldung werden Ihre E-Mail-Adresse und ggf. Ihr Name an Brevo übermittelt.',
    },
  ],
};
