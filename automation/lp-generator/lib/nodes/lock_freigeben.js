const state = $getWorkflowStaticData('global');
const released = state.lpWorkerLock || null;
state.lpWorkerLock = null;
const input = $input.item.json || {};
const failed = Boolean(input.error);
return { json: { ...input, worker_status: failed ? 'failed' : 'done', lock_released_at: new Date().toISOString(), released_lock: released } };
