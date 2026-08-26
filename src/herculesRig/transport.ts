import type { HerculesRigCommand } from "./types.ts";
import { HERCULES_RIG_PATH, HERCULES_RIG_POLL_PATH } from "./validate.ts";

const RIG_SESSION_KEY = "hearth.rig.session";

export type RigQueueEntry = {
  id: string;
  at: number;
  commands: HerculesRigCommand[];
};

export function rigSessionId(): string {
  if (typeof sessionStorage === "undefined") return "dev-rig-session";
  let id = sessionStorage.getItem(RIG_SESSION_KEY);
  if (!id) {
    id = (typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, "")
      : `rig${Math.random().toString(36).slice(2)}`).slice(0, 32);
    sessionStorage.setItem(RIG_SESSION_KEY, id);
  }
  return id;
}

export async function submitHerculesRigCommands(
  commands: HerculesRigCommand[],
  fetchFn: typeof fetch = fetch,
): Promise<{ ok: boolean; at?: number; queueId?: string }> {
  const sessionId = rigSessionId();
  const res = await fetchFn(HERCULES_RIG_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, commands }),
  });
  if (!res.ok) return { ok: false };
  const data = await res.json() as { ok?: boolean; at?: number; queueId?: string };
  return { ok: Boolean(data.ok), at: data.at, queueId: data.queueId };
}

export async function pollHerculesRigQueue(
  since: number,
  fetchFn: typeof fetch = fetch,
): Promise<RigQueueEntry[]> {
  const sessionId = rigSessionId();
  const url = `${HERCULES_RIG_POLL_PATH}?sessionId=${encodeURIComponent(sessionId)}&since=${encodeURIComponent(String(since))}`;
  const res = await fetchFn(url, { method: "GET" });
  if (!res.ok) return [];
  const data = await res.json() as { ok?: boolean; entries?: RigQueueEntry[] };
  return data.ok && Array.isArray(data.entries) ? data.entries : [];
}

export function startHerculesRigPoller(
  apply: (command: HerculesRigCommand) => void,
  intervalMs = 2000,
): () => void {
  if (typeof window === "undefined") return () => {};
  let since = Date.now() - 500;
  let busy = false;
  const tick = async () => {
    if (busy || document.hidden) return;
    busy = true;
    try {
      const entries = await pollHerculesRigQueue(since);
      for (const entry of entries) {
        since = Math.max(since, entry.at);
        for (const command of entry.commands) apply(command);
      }
    } finally {
      busy = false;
    }
  };
  void tick();
  const id = window.setInterval(() => { void tick(); }, intervalMs);
  const onFocus = () => { void tick(); };
  window.addEventListener("focus", onFocus);
  return () => {
    window.clearInterval(id);
    window.removeEventListener("focus", onFocus);
  };
}
