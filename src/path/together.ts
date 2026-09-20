import { monthKeyFromDateKey, type DateKey } from "../core/calendar.ts";
import { pathWords } from "../core/pathWords.ts";
import type { Household } from "../core/types.ts";
import type { GrownIsland } from "./grow.ts";
import { pathObjectNearAnchor } from "./world/pathGeometry.ts";

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
  return pathWords(purpose, max, "");
}

/**
 * Where the Charter's stone square stands: off the first month's stable spot.
 * The legacy `avoid` argument remains source-compatible, but accepted object
 * corrections cannot move the Charter, so it no longer participates in placement.
 */
export function charterSpot(island: GrownIsland, avoid: { x: number; z: number; r: number }[] = []): { x: number; z: number; a: number } {
  void avoid;
  return fixedSpotNearFirstMonth(island, "charter", Math.PI);
}

/**
 * Where Hercules's cottage (Play) stands: a stable quarter turn from the Charter.
 */
export function cottageSpot(island: GrownIsland, avoid: { x: number; z: number; r: number }[] = [], charter = false): { x: number; z: number; a: number } {
  void avoid; void charter;
  return fixedSpotNearFirstMonth(island, "cottage", Math.PI / 2);
}

function fixedSpotNearFirstMonth(island: GrownIsland, id: "charter" | "cottage", turn: number): { x: number; z: number; a: number } {
  const p = island.spot(0);
  const spot = pathObjectNearAnchor(id, id, p, { turn, angleSpread: 0.28, distance: 8.5, distanceSpread: 2 });
  return { x: spot.x, z: spot.z, a: Math.atan2(p.z - spot.z, p.x - spot.x) };
}
