// Klaro Consent Manager — Konfiguration für nikos.audio
// Dienste: Umami Analytics, Brevo Newsletter
// Klaro-Version: aktuell via CDN (kiprotect.com)

var klaroConfig = {
  version: 1,
  elementID: 'klaro',
  storageMethod: 'localStorage',
  cookieName: 'nikos_consent',
  cookieExpiresAfterDays: 365,
  privacyPolicy: '/nikos-datenschutz.html',

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
        analytics: 'Analyse',
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
        analytics: 'Analytics',
        marketing: 'Marketing & Newsletter',
      },
    },
  },

  services: [
    {
      // Umami Analytics — kein Cookie, daher nur als Information
      // Umami setzt selbst kein Cookie und benötigt kein Consent-Banner
      // Wir zeigen es trotzdem transparent an
      name: 'umami',
      title: 'Umami Analytics',
      purposes: ['analytics'],
      required: false,
      default: true, // datenschutzfreundlich — standardmäßig an
      description:
        'Anonyme Besucherstatistiken ohne Cookies und ohne persönliche Daten. ' +
        'Datenschutzfreundliche Alternative zu Google Analytics.',
      onAccept: `
        // Umami wird über data-website-id im Script-Tag gesteuert
        // Kein zusätzlicher Code nötig — das Script wird beim Laden aktiviert
      `,
      onDecline: `
        // Umami-Script deaktivieren
        var s = document.querySelector('script[data-umami]');
        if (s) s.remove();
      `,
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
