/**
 * First-run lessons for instrument / page surfaces.
 * After a surface is seen, How can I help (eight-rung chips) replaces the jargon.
 */

const SEEN_KEY = "hearth.lessons.seen";

export function loadSeenLessons(storage?: { getItem(key: string): string | null }): Set<string> {
  const store = storage ?? (typeof localStorage !== "undefined" ? localStorage : undefined);
  if (!store) return new Set();
  try {
    const raw = store.getItem(SEEN_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((row): row is string => typeof row === "string"));
  } catch {
    return new Set();
  }
}

export function markLessonSeen(
  surfaceId: string,
  storage?: { getItem(key: string): string | null; setItem(key: string, value: string): void },
): void {
  const store = storage ?? (typeof localStorage !== "undefined" ? localStorage : undefined);
  if (!store || !surfaceId) return;
  const seen = loadSeenLessons(store);
  if (seen.has(surfaceId)) return;
  seen.add(surfaceId);
  store.setItem(SEEN_KEY, JSON.stringify([...seen].sort()));
}

export function firstRunLesson(
  surfaceId: string,
  lesson: string | null | undefined,
  storage?: { getItem(key: string): string | null; setItem(key: string, value: string): void },
): string | null {
  if (!lesson) return null;
  const store = storage ?? (typeof localStorage !== "undefined" ? localStorage : undefined);
  const seen = loadSeenLessons(store);
  if (seen.has(surfaceId)) return null;
  markLessonSeen(surfaceId, store);
  return lesson;
}
