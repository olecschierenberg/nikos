const state = $getWorkflowStaticData('global');
const now = Date.now();
const TTL_MS = 20 * 60 * 1000;
const src = $input.item.json || {};
const pageKey = [src.Problem, src.Einsatz, src.Region].map(v => String(v || '').trim().toLowerCase()).join('|');
if (!pageKey.replace(/\|/g, '')) throw new Error('LOCK_INPUT_INVALID: Problem, Einsatz oder Region fehlen.');
if (state.lpWorkerLock && Number(state.lpWorkerLock.expiresAt || 0) > now) {
  throw new Error('WORKER_LOCKED: Eine Landingpage-Ausführung besitzt noch den exklusiven Lock.');
}
const executionId = String($execution.id || 'unknown');
state.lpWorkerLock = { pageKey, executionId, lockedAt: now, expiresAt: now + TTL_MS };
const allowed = ['row_number','erstellen','deploy','aktiv','Relevanz','Problem','Einsatz','Region','_einwohner','_regionstyp','_lang_mode','_lang_label','_lang','_lang_locale','_lang_flag','_relevanz'];
const payload = {};
for (const key of allowed) if (Object.prototype.hasOwnProperty.call(src, key)) payload[key] = src[key];
payload._lp_job_key = pageKey;
payload._lp_lock_expires_at = new Date(now + TTL_MS).toISOString();
payload._lp_attempt = Number(src._lp_attempt || 0) + 1;
return { json: payload };
