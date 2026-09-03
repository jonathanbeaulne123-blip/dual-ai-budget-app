// Flavor variants — the only warmth onboarding v1 is allowed. No model call
// backs this: a small, fixed, hand-written pool, chosen deterministically
// from household id + chapter id (ONBOARDING_BUILD_MANUAL.md §0.13 and
// Appendix E.8). A variant may add warmth; it may never add a fact, a
// number, or an instruction the script did not already make — every string
// below is checked for that in test/onboarding-copy.test.ts.

import { stableImportHash } from "../importInbox/hash.ts";
import { COPY_DECK_VERSION } from "./copy.ts";
import type { ChapterId } from "./types.ts";

/**
 * One shared pool, not a set per chapter: nothing here names or depends on
 * what a specific chapter is about, so the same warm line is honest beside
 * any of them. Three to five entries per Appendix E.8 — this pool has four.
 */
export const FLAVOR_POOL: readonly string[] = [
  "Nice pace so far.",
  "This part moves quick.",
  "Good place to be.",
  "Nothing to rush here.",
];

/**
 * Same householdId + chapterId, always the same variant — a plain,
 * reproducible string hash, never a source of runtime randomness.
 * COPY_DECK_VERSION is folded in so a future revision of the pool can shift
 * the mapping deliberately, on purpose, rather than by accident of
 * insertion order.
 */
export function flavorFor(chapterId: ChapterId, householdId: string): string {
  const digest = stableImportHash(`${COPY_DECK_VERSION}|${householdId}|${chapterId}`);
  const index = Number.parseInt(digest.slice(0, 8), 16) % FLAVOR_POOL.length;
  return FLAVOR_POOL[index]!;
}
