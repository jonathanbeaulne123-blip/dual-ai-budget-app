import type { PlanBridgeDecision } from "./planSystem.ts";

/**
 * The cellar's roll-over consent rows (D-281, filtered in D-282).
 *
 * The cellar's "custodian offers, partner says yes" walk for a missing
 * subscription is stored as Plan Bridge rows, because the money model's
 * proposal records (division, refill) cannot say "roll $X into goal bank Y"
 * without a new synced shape. Those rows belong to the cellar only: the
 * Sitdown brief, the Bridge section, the Our Path island, the Fund pulse
 * (the crown) and the studio badge leave them out. Pure, no imports beyond types.
 */
export const CELLAR_BRIDGE_SUFFIX = " — from the cellar";
/**
 * An invisible separator (U+2063) leads every label the cellar writes (review M3). People's own Bridge labels
 * never carry it: the Bridge draft and Hercules's Bridge action strip it, so a typed "Roll … — from the cellar"
 * stays an ordinary offer.
 */
export const CELLAR_BRIDGE_MARK = "\u2063";
export const CELLAR_BRIDGE_PATTERN = /^\u2063Roll (.+) into (.+) — from the cellar$/;
export const stripCellarBridgeMark = (label: string): string => label.replace(/\u2063/g, "");

export function isCellarBridgeRow(row: Pick<PlanBridgeDecision, "kind" | "label" | "expectedDate">): boolean {
  return row.kind === "shared-goal" && Boolean(row.expectedDate) && CELLAR_BRIDGE_PATTERN.test(row.label);
}

/** The Bridge rows every surface outside the cellar reads. */
export function sharedBridgeDecisions<T extends Pick<PlanBridgeDecision, "kind" | "label" | "expectedDate">>(rows: readonly T[] | undefined): T[] {
  return (rows ?? []).filter((row) => !isCellarBridgeRow(row));
}
