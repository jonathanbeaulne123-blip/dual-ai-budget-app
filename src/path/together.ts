import { monthKeyFromDateKey, type DateKey } from "../core/calendar.ts";
import type { Household } from "../core/types.ts";
import type { GrownIsland } from "./grow.ts";

/**
 * Together on the island (Jonathan, 2026-09-15): the campfire is a door to the
 * Together tab, the fire knows the Sitdown, the Charter stands as a stone
 * square and agreed decisions fork the path. Pure reads only; nothing here
 * writes, and nothing here reads an amount.
 */

export type PathSitdown = "none" | "open" | "closed";

/**
 * The Shared Sitdown for a span of months. The live signal is
 * `planHerculesSessions` (Plan System V2: the Shared Sitdown that Together
 * resumes; `state` goes "active" → "closed" only when both partners have
 * acknowledged the exact Plan). The older `sitDownSessions` never reach
 * "closed" through today's commands and stay "open"/"moved" for good, so they
 * count only as a fallback: closed when closed, open only in the current month.
 */
export function pathSitdownFor(household: Household, fromMonth: string, toMonth: string, today: DateKey): PathSitdown {
  const inSpan = (key: string) => key >= fromMonth && key <= toMonth;
  const shared = (household.planHerculesSessions ?? [])
    .filter((row) => row && typeof row.monthKey === "string" && inSpan(row.monthKey))
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))[0];
  if (shared) return shared.state === "closed" ? "closed" : "open";
  const nowMonth = monthKeyFromDateKey(today);
  const legacy = (household.sitDownSessions ?? [])
    .filter((row) => row && typeof row.monthKey === "string" && inSpan(row.monthKey))
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))[0];
  if (!legacy) return "none";
  if (legacy.status === "closed") return "closed";
  return legacy.monthKey === nowMonth ? "open" : "none";
}

/** Months whose Shared Sitdown closed: their land sets. */
export function pathSitdownClosedMonths(household: Household): Set<string> {
  const out = new Set<string>();
  for (const row of household.planHerculesSessions ?? []) if (row?.state === "closed" && row.monthKey) out.add(row.monthKey);
  for (const row of household.sitDownSessions ?? []) if (row?.status === "closed" && row.monthKey) out.add(row.monthKey);
  return out;
}

/** The Charter's purpose as words only: any figure is removed, then cut at a word boundary. */
export function charterPurposeWords(purpose: string, max = 120): string {
  const words = (purpose ?? "").replace(/\$?\d[\d,]*(\.\d+)?/g, " ").replace(/\s+/g, " ").replace(/\s+([.,;:!?])/g, "$1").trim();
  if (words.length <= max) return words;
  const cut = words.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > 40 ? cut.slice(0, space) : cut).replace(/[\s.,;:]+$/, "")}…`;
}

/**
 * Where the Charter's stone square stands: off the first month's spot, clear of
 * the pieces, the other month stones and whatever else the caller lists (the
 * landmarks and the kiln). Deterministic; falls back to the first candidate.
 */
export function charterSpot(island: GrownIsland, avoid: { x: number; z: number; r: number }[] = []): { x: number; z: number; a: number } {
  const p = island.spot(0);
  const blockers = [
    ...avoid,
    ...island.pieces.map((piece) => ({ x: piece.x, z: piece.z, r: piece.kind === "loop" || piece.kind === "dogMeadow" ? 8 : 5.5 })),
    ...Array.from({ length: island.cur + 2 }, (_, m) => ({ ...island.spot(m), r: 4.5 })),
  ];
  let first: { x: number; z: number; a: number } | null = null;
  for (const radius of [8, 11, 14]) {
    for (let k = 0; k < 12; k++) {
      const a = p.a + Math.PI + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.45;
      const x = p.x + Math.cos(a) * radius, z = p.z + Math.sin(a) * radius;
      const candidate = { x, z, a: Math.atan2(p.z - z, p.x - x) };
      first ??= candidate;
      const reach = Math.hypot(x, z);
      if (reach > island.radiusAt(Math.atan2(z, x)) - 7) continue;
      if (blockers.some((b) => Math.hypot(b.x - x, b.z - z) < b.r + 3)) continue;
      return candidate;
    }
  }
  return first!;
}

const FORK_SLOTS = [0, 0.55, -0.55, 1.1, -1.1, 1.65, -1.65, 2.2];
/** A decision fork's direction off its month spot: eight slots fixed by index, fanned toward the island's middle (the spiral's newest months sit near the coast). */
export function forkAngle(spot: { x: number; z: number }, index: number): number {
  return Math.atan2(-spot.z, -spot.x) + FORK_SLOTS[index % 8]!;
}
