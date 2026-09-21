'use strict';
/**
 * Brevo-API-Zugriff (Secret BREVO_API_KEY). Bei kurzzeitigen Fehlern
 * (HTTP 429 = zu viele Anfragen, 5xx = Serverfehler) wird bis zu 3-mal
 * mit wachsender Wartezeit wiederholt.
 */
const BASE = 'https://api.brevo.com/v3';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function brevoFetch(apiKey, path, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(BASE + path, {
      ...options,
      headers: { accept: 'application/json', 'content-type': 'application/json', 'api-key': apiKey },
    });
    if (res.status === 429 || res.status >= 500) {
      lastError = new Error(`Brevo HTTP ${res.status} (Versuch ${attempt}/3)`);
      await sleep(1000 * attempt * attempt);
      continue;
    }
    return res;
  }
  throw lastError;
}

// Alle Kontakte einer Liste, seitenweise (Brevo liefert max. 500 pro Aufruf).
async function listContacts(apiKey, listId) {
  const limit = 500;
  const all = [];
  for (let page = 0; page < 200; page++) {
    const res = await brevoFetch(apiKey, `/contacts/lists/${listId}/contacts?limit=${limit}&offset=${page * limit}`);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Brevo-Kontaktliste: HTTP ${res.status} ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    const contacts = data.contacts || [];
    all.push(...contacts);
    if (contacts.length < limit) return all;
  }
  throw new Error('Brevo-Kontaktliste: mehr als 100000 Kontakte, Abbruch (Sicherheitsgrenze).');
}

// Kontakt sperren (emailBlacklisted = true). Ergebnis: 'gesperrt' | 'nicht-in-brevo'
async function blacklistContact(apiKey, email) {
  const res = await brevoFetch(apiKey, `/contacts/${encodeURIComponent(email)}`, {
    method: 'PUT',
    body: JSON.stringify({ emailBlacklisted: true }),
  });
  if (res.status === 404) return 'nicht-in-brevo';
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${body.slice(0, 200)}`);
  }
  return 'gesperrt';
}

module.exports = { listContacts, blacklistContact, sleep };
