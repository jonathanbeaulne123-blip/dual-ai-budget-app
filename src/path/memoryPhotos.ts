import type { BoardPhoto } from "../core/sharedBoards.ts";

/**
 * Which household board photo hangs on which Memory flag (Our Path, step 9).
 * Pure: reads the kept Memories and the three shared board photos (already
 * visible to both partners), never personal media, never uploads.
 *
 * The rule:
 * 1. A photo whose caption contains a Memory's title (case-insensitive, trimmed,
 *    titles of at least 3 characters) belongs to that Memory. Newest Memory first;
 *    each photo and each Memory is used once.
 * 2. Any photo still unused is handed out in slot order (1, 2, 3) to whichever of
 *    the three most recent Memories still has no photo, newest first.
 * Photos without a stored image (`mediaId: null`) never match.
 */
export type MemoryPhotoMemory = { id: string; title: string; shownAt: string };
export type MemoryPhotoMatch = { mediaId: string; caption: string };

export function memoryPhotoMatches(memories: readonly MemoryPhotoMemory[], photos: readonly BoardPhoto[]): Map<string, MemoryPhotoMatch> {
  const out = new Map<string, MemoryPhotoMatch>();
  const newest = [...memories].sort((a, b) => b.shownAt.localeCompare(a.shownAt) || a.id.localeCompare(b.id));
  const usable = photos.filter((photo) => Boolean(photo.mediaId)).sort((a, b) => a.id.localeCompare(b.id));
  const used = new Set<string>();
  for (const memory of newest) {
    const title = memory.title.trim().toLowerCase();
    if (title.length < 3) continue;
    const photo = usable.find((row) => !used.has(row.id) && row.caption.toLowerCase().includes(title));
    if (!photo) continue;
    used.add(photo.id);
    out.set(memory.id, { mediaId: photo.mediaId!, caption: photo.caption });
  }
  const spare = usable.filter((row) => !used.has(row.id));
  for (const memory of newest.slice(0, 3)) {
    if (out.has(memory.id)) continue;
    const photo = spare.shift();
    if (!photo) break;
    out.set(memory.id, { mediaId: photo.mediaId!, caption: photo.caption });
  }
  return out;
}
