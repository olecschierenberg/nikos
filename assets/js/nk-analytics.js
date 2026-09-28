/* NIKOS – cookiefreie Statistik (Umami + Ahrefs Web Analytics) mit Widerspruchsmöglichkeit.
 * Lädt beide Dienste nur, wenn der Besucher nicht widersprochen hat.
 * Widerspruch wird nur im eigenen Browser gespeichert (localStorage 'nk-analytics-optout' = '1')
 * und gilt für alle Seiten auf nikos.info (inkl. Landingpages).
 * Gesetzt über: Datenschutz-Einstellungen (Klaro) oder die Schaltfläche in der Datenschutzerklärung.
 * Browser-Signal "Global Privacy Control" wird ebenfalls als Widerspruch gewertet. */
(function () {
  var KEY = 'nk-analytics-optout';
  function optedOut() {
    try { if (localStorage.getItem(KEY) === '1') return true; } catch (e) {}
    try { if (navigator.globalPrivacyControl === true) return true; } catch (e) {}
    return false;
  }
  // Klaro-Einstellung mitziehen, damit Klaro den Widerspruch beim nächsten Laden nicht überschreibt
  function syncKlaro(consent) {
    try {
      if (window.klaro && klaro.getManager) {
        var m = klaro.getManager(); m.updateConsent('statistik', consent); m.saveAndApplyConsents();
      }
    } catch (e) {}
  }
  window.nkAnalytics = {
    isOptedOut: optedOut,
    optOut: function () {
      try { localStorage.setItem(KEY, '1'); localStorage.setItem('umami.disabled', '1'); } catch (e) {}
      syncKlaro(false);
    },
    optIn: function () {
      try { localStorage.removeItem(KEY); localStorage.removeItem('umami.disabled'); } catch (e) {}
      syncKlaro(true);
    }
  };
  if (optedOut()) return;
  function add(src, attrs) {
    var s = document.createElement('script');
    s.src = src; s.async = true;
    for (var k in attrs) { if (Object.prototype.hasOwnProperty.call(attrs, k)) s.setAttribute(k, attrs[k]); }
    (document.head || document.documentElement).appendChild(s);
  }
  add('https://cloud.umami.is/script.js', { 'data-website-id': '4f48b5b5-93c8-4493-be71-2c1cefc6e440' });
  add('https://analytics.ahrefs.com/analytics.js', { 'data-key': 'QPBi7D5b8OKPmyaZADAAiA' });
})();
