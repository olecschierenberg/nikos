'use strict';
/**
 * Newsletter-Sync (Brevo -> Sheet). Ersetzt den n8n-Workflow mit der ID
 * fY1tXDSbXmzvurvm (Newsletter-Sync, derzeit umbenannt in "NIKOS – Formular-Handling").
 *
 * Holt alle Kontakte der Brevo-Liste "NIKOS Newsletter" (ID 2) und markiert sie
 * im Blatt "Leads" mit newsletter = "x" (bzw. legt neue Zeilen an).
 * Die genauen Regeln stehen in lib/logic.js (planImport).
 *
 * Ohne --live nur Probelauf: es wird nichts ins Sheet geschrieben.
 */
const { LEADS_TAB, BREVO_LIST_ID } = require('./lib/config');
const { readTab, setCells, appendRows } = require('./lib/sheets');
const { listContacts } = require('./lib/brevo');
const { planImport } = require('./lib/logic');

function todayBerlin() {
  return new Date().toLocaleDateString('de-DE', {
    timeZone: 'Europe/Berlin',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

async function main() {
  const live = process.argv.includes('--live');
  console.log(`Newsletter-Sync – Modus: ${live ? 'LIVE' : 'PROBELAUF (nichts wird ins Sheet geschrieben)'}`);

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error('BREVO_API_KEY fehlt (GitHub Secret, siehe README).');

  const contacts = await listContacts(apiKey, BREVO_LIST_ID);
  const { header, rows } = await readTab(LEADS_TAB, ['email', 'newsletter']);
  const { cellUpdates, appends, stats } = planImport(contacts, rows, todayBerlin());

  console.log(
    `Brevo-Kontakte: ${stats.contacts} | Leads-Zeilen: ${rows.length}\n` +
      `  bereits "x": ${stats.alreadyMarked} | neu auf "x" gesetzt: ${stats.marked} | neue Zeilen: ${stats.appended}\n` +
      `  uebersprungen (in Brevo gesperrt): ${stats.skippedBlacklisted} | uebersprungen (im Sheet "-"): ${stats.skippedUnsubscribedInSheet}\n` +
      `  leere Felder aus Brevo ergaenzt: ${stats.filledCells}`
  );

  if (!live) return;

  await setCells(LEADS_TAB, header, cellUpdates);
  await appendRows(LEADS_TAB, header, appends);
  console.log('Sheet aktualisiert.');
}

main().catch((err) => {
  console.error('Newsletter-Sync fehlgeschlagen:', err.message);
  process.exit(1);
});
