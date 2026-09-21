'use strict';
/**
 * Abmelde-Sync (Sheet -> Brevo). Ersetzt den n8n-Workflow "NIKOS – Abmelde-Sync
 * (Sheet → Brevo)" (ID 9GmhtntRPPRmdFCE).
 *
 * Liest das Blatt "Leads"; jede E-Mail mit newsletter = "-" wird in Brevo auf
 * "gesperrt" gesetzt (emailBlacklisted = true), damit sie keine Mails mehr bekommt.
 *
 * Ohne --live nur Probelauf: es wird nichts an Brevo geschickt.
 */
const { LEADS_TAB } = require('./lib/config');
const { readTab } = require('./lib/sheets');
const { blacklistContact, sleep } = require('./lib/brevo');
const { planUnsubscribes, maskEmail } = require('./lib/logic');

async function main() {
  const live = process.argv.includes('--live');
  console.log(`Abmelde-Sync – Modus: ${live ? 'LIVE' : 'PROBELAUF (nichts wird an Brevo gesendet)'}`);

  const { rows } = await readTab(LEADS_TAB, ['email', 'newsletter']);
  const { emails, withoutEmail } = planUnsubscribes(rows);
  console.log(`Leads-Zeilen: ${rows.length} | abgemeldet ("-"): ${emails.length} | ohne E-Mail uebersprungen: ${withoutEmail}`);

  if (!live) {
    emails.forEach((e) => console.log(`  wuerde sperren: ${maskEmail(e)}`));
    return;
  }

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error('BREVO_API_KEY fehlt (GitHub Secret, siehe README).');

  let gesperrt = 0;
  let nichtInBrevo = 0;
  const fehler = [];
  for (const email of emails) {
    try {
      const result = await blacklistContact(apiKey, email);
      if (result === 'gesperrt') gesperrt++;
      else nichtInBrevo++;
    } catch (err) {
      fehler.push(`${maskEmail(email)}: ${err.message}`);
    }
    await sleep(150); // freundlich zur API
  }
  console.log(`Ergebnis: gesperrt ${gesperrt} | nicht in Brevo ${nichtInBrevo} | Fehler ${fehler.length}`);
  if (fehler.length) {
    fehler.forEach((f) => console.error('  FEHLER ' + f));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Abmelde-Sync fehlgeschlagen:', err.message);
  process.exit(1);
});
