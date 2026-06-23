// ═══════════════════════════════════════════════════════════════════
// NIKOS Formular-Versand — zentral für alle Seiten
// ───────────────────────────────────────────────────────────────────
// Fängt die drei Formulare ab (Partner-Anfrage, Kontakt-Beratung,
// Mietanfrage), validiert Pflichtfelder + Einwilligung, sendet die
// Daten per POST (JSON) an window.NIKOS_FORM_ENDPOINT (n8n-Webhook)
// und blendet die jeweilige .form-success-Box ein.
//
// Endpoint wird in nikos-config.js gesetzt (window.NIKOS_FORM_ENDPOINT).
// ═══════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  // Welche Sprache ist aktiv? (data-de/data-en-Toggle der Seite)
  function isEN() {
    return document.documentElement.lang === 'en' ||
           document.body.classList.contains('lang-en') ||
           document.body.getAttribute('data-lang') === 'en';
  }
  function t(de, en) { return isEN() ? en : de; }

  // Formular-Registry: ID → { type, successId }
  var FORMS = [
    { id: 'partnerForm',   type: 'partner-anfrage', successId: 'partnerSuccess' },
    { id: 'form-beratung', type: 'beratung',        successId: 'success-beratung' },
    { id: 'form-miete',    type: 'mietanfrage',     successId: 'success-miete' },
    { id: 'form-newsletter', type: 'newsletter',    successId: 'success-newsletter' }
  ];

  // Sammelt alle Felder eines Formulars als Key/Value-Objekt.
  // Nutzt name= falls vorhanden, sonst id (ohne führendes Präfix wie "p-").
  function collect(form) {
    var data = {};
    var els = form.querySelectorAll('input, textarea, select');
    els.forEach(function (el) {
      if (el.type === 'submit' || el.type === 'button') return;
      var key = el.name || el.id || '';
      if (!key) return;
      key = key.replace(/^[a-z]-/, ''); // "p-company" → "company"

      if (el.type === 'checkbox') {
        // consent + newsletter immer als echtes true/false senden
        if (key === 'consent' || key === 'newsletter') { data[key] = el.checked; return; }
        if (el.checked) {
          (data[key] = data[key] || []).push(el.value || true);
        }
      } else if (el.type === 'radio') {
        if (el.checked) data[key] = el.value;
      } else {
        if (el.value !== '') data[key] = el.value;
      }
    });
    return data;
  }

  // Pflichtfeld-Prüfung (required-Attribut + Consent-Checkbox).
  function validate(form) {
    var bad = [];
    form.querySelectorAll('[required]').forEach(function (el) {
      var ok = (el.type === 'checkbox') ? el.checked : (el.value || '').trim() !== '';
      if (!ok) bad.push(el);
      el.classList.toggle('input-error', !ok);
    });
    return bad;
  }

  function showSuccess(successEl, btns) {
    if (successEl) successEl.classList.add('is-shown');
    btns.forEach(function (b) { b.disabled = true; });
  }

  function showError(form, msg) {
    var box = form.querySelector('.form-error');
    if (!box) {
      box = document.createElement('div');
      box.className = 'form-error';
      box.setAttribute('role', 'alert');
      box.style.cssText = 'margin-top:14px;font-size:14px;color:#b00020;font-weight:600;';
      var wrap = form.querySelector('.form-submit-wrap');
      if (wrap) wrap.appendChild(box); else form.appendChild(box);
    }
    box.textContent = msg;
  }
  function clearError(form) {
    var box = form.querySelector('.form-error');
    if (box) box.textContent = '';
  }

  // Honeypot field: visible to bots, hidden from humans. Real users never fill it.
  function addHoneypot(form) {
    if (form.querySelector('input[name="website_hp"]')) return;
    var wrap = document.createElement('div');
    wrap.setAttribute('aria-hidden', 'true');
    wrap.style.cssText = 'position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden;';
    wrap.innerHTML = '<label>Website (bitte freilassen)<input type="text" name="website_hp" tabindex="-1" autocomplete="off"></label>';
    form.appendChild(wrap);
  }

  function wire(cfg) {
    var form = document.getElementById(cfg.id);
    if (!form) return;
    var successEl = document.getElementById(cfg.successId);
    var btns = Array.prototype.slice.call(form.querySelectorAll('button[type="submit"]'));

    addHoneypot(form);
    var formReadyAt = Date.now(); // for the time-trap (bots submit too fast)

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearError(form);

      // Honeypot check (client-side, defense in depth): if filled -> treat as done, send nothing
      var hp = form.querySelector('input[name="website_hp"]');
      if (hp && hp.value.trim() !== '') { showSuccess(successEl, btns); return; }

      var bad = validate(form);
      if (bad.length) {
        showError(form, t('Bitte füllen Sie alle Pflichtfelder aus und bestätigen Sie die Einwilligung.',
                          'Please fill in all required fields and confirm consent.'));
        if (bad[0].focus) bad[0].focus();
        return;
      }

      var endpoint = window.NIKOS_FORM_ENDPOINT || '';
      var payload = collect(form);
      payload.formType = cfg.type;
      payload.page = location.pathname;
      payload.submittedAt = new Date().toISOString();
      payload.fill_ms = Date.now() - formReadyAt; // fill duration (time-trap, checked server-side)

      // Kein Endpoint konfiguriert → nicht senden, klar melden (keine stille Datenvernichtung).
      if (!endpoint) {
        showError(form, t('Formularversand ist noch nicht aktiviert. Bitte kontaktieren Sie uns direkt unter info@radacom.de.',
                          'Form submission is not yet activated. Please contact us directly at info@radacom.de.'));
        return;
      }

      btns.forEach(function (b) { b.disabled = true; });
      var labelDe = form.querySelector('button[type="submit"][data-de]');
      var prev = labelDe ? labelDe.textContent : '';
      if (labelDe) labelDe.textContent = t('Wird gesendet …', 'Sending …');

      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        form.reset();
        showSuccess(successEl, btns);
      })
      .catch(function () {
        btns.forEach(function (b) { b.disabled = false; });
        if (labelDe) labelDe.textContent = prev;
        showError(form, t('Senden fehlgeschlagen. Bitte später erneut versuchen oder info@radacom.de.',
                          'Submission failed. Please try again later or email info@radacom.de.'));
      });
    });
  }

  function init() { FORMS.forEach(wire); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
