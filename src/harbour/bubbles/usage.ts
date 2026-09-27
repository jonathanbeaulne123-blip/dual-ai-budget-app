/**
 * Per-viewer conveniences for the glass (brief §4.2, §3.4): how many times
 * this person has used a bubble (`hearth:atlas:used:<memberId>:<id>`) and the
 * last three tools they opened from All tools (`hearth:atlas:recent:<memberId>`).
 *
 * Never truth: a cleared browser forgets them and nothing breaks. Every read
 * and write is guarded; storage can be missing or throw.
 */
type Reader = Pick<Storage, "getItem">;
type Writer = Pick<Storage, "getItem" | "setItem">;

export const LABEL_HIDE_AFTER = 5;
export const RECENT_LIMIT = 3;

function store(storage?: Reader | Writer): Writer | null {
  if (storage) return storage as Writer;
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}

const safeMember = (memberId: string | null | undefined) => (memberId && memberId.trim()) || "anyone";
export const usedKey = (memberId: string | null | undefined, bubbleId: string) => `hearth:atlas:used:${safeMember(memberId)}:${bubbleId}`;
export const recentKey = (memberId: string | null | undefined) => `hearth:atlas:recent:${safeMember(memberId)}`;

/** Uses so far; 0 when unknown. */
export function readUsedCount(memberId: string | null | undefined, bubbleId: string, storage?: Reader): number {
  try {
    const raw = store(storage)?.getItem(usedKey(memberId, bubbleId));
    const n = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch { return 0; }
}

/** Count one use. Stops counting past the threshold's neighbourhood so the key never grows. Returns the new count. */
export function countUse(memberId: string | null | undefined, bubbleId: string, storage?: Writer): number {
  const next = Math.min(readUsedCount(memberId, bubbleId, storage) + 1, 99);
  try { store(storage)?.setItem(usedKey(memberId, bubbleId), String(next)); } catch { /* a convenience */ }
  return next;
}

/** The last tools opened, newest first, at most three. */
export function readRecentTools(memberId: string | null | undefined, storage?: Reader): string[] {
  try {
    const raw = store(storage)?.getItem(recentKey(memberId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string").slice(0, RECENT_LIMIT) : [];
  } catch { return []; }
}

/** Put a tool at the front of the recent row. Returns the row. */
export function rememberRecentTool(memberId: string | null | undefined, toolId: string, storage?: Writer): string[] {
  const next = [toolId, ...readRecentTools(memberId, storage).filter((id) => id !== toolId)].slice(0, RECENT_LIMIT);
  try { store(storage)?.setItem(recentKey(memberId), JSON.stringify(next)); } catch { /* a convenience */ }
  return next;
}
