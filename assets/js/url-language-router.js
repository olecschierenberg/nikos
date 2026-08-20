/* NIKOS: Sprach- und URL-Router für die parallele Struktur /de/ und /en/.
 * Aktiv ausschließlich auf den parallel erzeugten Seiten mit data-url-lang.
 */
(function () {
  'use strict';

  var html = document.documentElement;
  var language = html.getAttribute('data-url-lang');
  if (language !== 'de' && language !== 'en') return;

  var paths = {
    '': { de: '/de/', en: '/en/' },
    'index.html': { de: '/de/', en: '/en/' },
    'nikos-system': { de: '/de/system/', en: '/en/system/' },
    'nikos-system.html': { de: '/de/system/', en: '/en/system/' },
    'nikos-anwendungen': { de: '/de/anwendungen/', en: '/en/applications/' },
    'nikos-anwendungen.html': { de: '/de/anwendungen/', en: '/en/applications/' },
    'nikos-produkte': { de: '/de/produkte/', en: '/en/products/' },
    'nikos-produkte.html': { de: '/de/produkte/', en: '/en/products/' },
    'nikos-referenzen': { de: '/de/referenzen/', en: '/en/references/' },
    'nikos-referenzen.html': { de: '/de/referenzen/', en: '/en/references/' },
    'nikos-vermietung': { de: '/de/vermietung/', en: '/en/rental/' },
    'nikos-vermietung.html': { de: '/de/vermietung/', en: '/en/rental/' },
    'nikos-downloads': { de: '/de/wissen/', en: '/en/insights/' },
    'nikos-downloads.html': { de: '/de/wissen/', en: '/en/insights/' },
    'nikos-kontakt': { de: '/de/kontakt/', en: '/en/contact/' },
    'nikos-kontakt.html': { de: '/de/kontakt/', en: '/en/contact/' }
  };

  function splitHref(value) {
    var match = value.match(/^([^?#]*)(.*)$/);
    return { path: match ? match[1] : value, suffix: match ? match[2] : '' };
  }

  function mappedHref(value) {
    if (!value || value.charAt(0) === '#' || /^(?:https?:|mailto:|tel:|javascript:)/i.test(value)) return null;
    var parts = splitHref(value);
    var candidate = parts.path.replace(/^\.\//, '').replace(/^\//, '');
    if (candidate === '') return paths[''][language] + parts.suffix;
    if (!Object.prototype.hasOwnProperty.call(paths, candidate)) return null;
    return paths[candidate][language] + parts.suffix;
  }

  document.querySelectorAll('a[href]').forEach(function (link) {
    var next = mappedHref(link.getAttribute('href'));
    if (next) link.setAttribute('href', next);
  });

  document.addEventListener('click', function (event) {
    var option = event.target.closest('[data-lang-opt]');
    if (!option) return;
    var requestedLanguage = option.getAttribute('data-lang-opt');
    if (requestedLanguage !== 'de' && requestedLanguage !== 'en') return;
    var target = html.getAttribute('data-lang-url-' + requestedLanguage);
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.assign(target);
  }, true);
}());
