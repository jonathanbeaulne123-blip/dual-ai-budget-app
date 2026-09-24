import { formatCad } from "../../core/money.ts";

/**
 * The Desk's one home for the engraved-money rule: an unknown amount reads
 * "—", never "$0". It lived in the Court's flat edition (`CourtFlat`) until
 * SIMPLE_VIEW_DESK S6 retired that edition; the implementations moved here
 * unchanged. (The scene's `court/engraved.ts` `engravedWords` is the same
 * rule, for the stone.)
 */
export function engravedCents(cents: number | null | undefined): string {
  return cents === null || cents === undefined || !Number.isFinite(cents) ? "—" : formatCad(cents);
}

/**
 * Noon is 0; a commitment 31 or more days ahead sits on the rim (π/2). The
 * same rule as `court/sundial.ts`, kept pure here so the Desk never loads
 * three.js.
 */
export function sundialAngle(daysAhead: number): number {
  if (!Number.isFinite(daysAhead)) return Math.PI / 2;
  const clamped = Math.max(0, Math.min(31, daysAhead));
  return (clamped / 31) * (Math.PI / 2);
}
