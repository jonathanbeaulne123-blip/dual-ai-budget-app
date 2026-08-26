/** @typedef {{ id: string; at: number; commands: import("../src/herculesRig/types.ts").HerculesRigCommand[] }} RigQueueEntry */

const QUEUE_TTL_SECONDS = 300;
const MAX_QUEUE = 64;

/** @type {Map<string, RigQueueEntry[]>} */
const memoryQueues = new Map();

function queueKey(sessionId) {
  return `rig:${sessionId}`;
}

function trimQueue(rows) {
  return rows.slice(-MAX_QUEUE);
}

/**
 * @param {import("../src/herculesRig/types.ts").HerculesRigCommand[]} commands
 */
export async function enqueueRigCommands(env, sessionId, commands) {
  const entry = { id: crypto.randomUUID(), at: Date.now(), commands };
  const kv = env?.HERCULES_RATE;
  if (kv?.put && kv?.get) {
    const key = queueKey(sessionId);
    const raw = await kv.get(key);
    const rows = raw ? trimQueue(JSON.parse(raw)) : [];
    rows.push(entry);
    await kv.put(key, JSON.stringify(trimQueue(rows)), { expirationTtl: QUEUE_TTL_SECONDS });
    return entry;
  }
  const rows = memoryQueues.get(sessionId) ?? [];
  rows.push(entry);
  memoryQueues.set(sessionId, trimQueue(rows));
  return entry;
}

export async function pollRigCommands(env, sessionId, since = 0) {
  const kv = env?.HERCULES_RATE;
  if (kv?.get) {
    const raw = await kv.get(queueKey(sessionId));
    const rows = raw ? JSON.parse(raw) : [];
    return rows.filter((row) => row.at > since);
  }
  const rows = memoryQueues.get(sessionId) ?? [];
  return rows.filter((row) => row.at > since);
}

/** Test helper */
export function resetRigQueueMemory() {
  memoryQueues.clear();
}
