import { heightAt, type GrownIsland } from "./grow.ts";

/**
 * The road the two walkers take between months (Our Path journey). Pure and
 * deterministic: it follows the month spiral (fractional months sit on the
 * same spiral the thread is drawn through) and reads the ground from the
 * grown island, so a backwards walk is exactly the forward walk reversed.
 */
export type WalkPoint = { x: number; y: number; z: number };

export function walkPath(island: Pick<GrownIsland, "H" | "spot">, fromMonth: number, toMonth: number, steps: number): WalkPoint[] {
  const n = Math.max(1, Math.floor(steps));
  const out: WalkPoint[] = [];
  for (let k = 0; k <= n; k++) {
    // Pin both ends to the exact month spots.
    const m = k === 0 ? fromMonth : k === n ? toMonth : fromMonth + (toMonth - fromMonth) * (k / n);
    const p = island.spot(m);
    out.push({ x: p.x, y: heightAt(island, p.x, p.z), z: p.z });
  }
  return out;
}

/** How long a walk takes: about 0.8 s per month, never longer than a few seconds for a big jump. */
export const WALK_SECONDS_PER_MONTH = 0.8;
export const WALK_MAX_SECONDS = 3.2;
export function walkSeconds(fromMonth: number, toMonth: number): number {
  return Math.min(WALK_MAX_SECONDS, Math.abs(toMonth - fromMonth) * WALK_SECONDS_PER_MONTH);
}
