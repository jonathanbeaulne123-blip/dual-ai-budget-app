import type { CourtMode } from "../camera/poses.ts";
import { HARBOUR_PLACE_LEVELS, type HarbourPlaceId } from "../flag.ts";

/**
 * Little Harbour · travel between the places of one room (BUILD_PLAN_SLICE2 §1).
 *
 * Everything here is pure: the plan a journey follows, the eased value of the
 * roof and the lid part-way through it, and the return slot a place's camera
 * is remembered in. `scene/runtime.ts` drives a real camera and real handles
 * through these; nothing in this file reads three.js, the DOM, time or money.
 *
 * The motions, in the vision's own words:
 *
 * - **court → tower** — the tower's roof lifts and hangs (0 → 1 over 900 ms)
 *   and the camera rises into the tower's own pose.
 * - **court → cellar** — the court's floor lifts away as a lid (0 → 1 over
 *   900 ms) and the camera descends through it.
 * - **back** — the reverse, in 700 ms, settling into the destination
 *   village room's authored camera pose.
 * - **reduced motion** — a cut: no duration, roof and lid already at their end
 *   states, so the roof is simply absent or present.
 */

export type TravelCamera = { mode: CourtMode; anchor: string | null };

export type TravelPlan = {
  /** How long the journey takes, in milliseconds. 0 is a cut. */
  ms: number;
  /** The tower's roof, from its value where you started to its value where you arrive. */
  roof: [number, number];
  /** The court's floor as the cellar's lid, on the same terms. */
  lid: [number, number];
  /** The pose to settle in on arrival. */
  camera: TravelCamera;
  /** Which way the camera travels: +1 up into the tower, −1 down into the cellar, 0 on the level. */
  rise: -1 | 0 | 1;
  /** No motion: apply the end states at once and dispose the place you left. */
  cut: boolean;
};

export const TRAVEL_UP_MS = 900;
export const TRAVEL_BACK_MS = 700;

/** Where the tower's roof rests while you stand in a place: lifted off only while you are inside the tower. */
export const roofFor = (place: HarbourPlaceId): number => (place === "tower" ? 1 : 0);
/** Where the court's floor rests: lifted away as a lid only while you are down in the cellar. */
export const lidFor = (place: HarbourPlaceId): number => (place === "cellar" ? 1 : 0);

/** Levels run above → middle → below; travelling toward a lower level descends. */
const HEIGHT: Readonly<Record<string, number>> = Object.freeze({ above: 1, middle: 0, below: -1 });
const riseBetween = (from: HarbourPlaceId, to: HarbourPlaceId): -1 | 0 | 1 => {
  const delta = (HEIGHT[HARBOUR_PLACE_LEVELS[to]] ?? 0) - (HEIGHT[HARBOUR_PLACE_LEVELS[from]] ?? 0);
  return delta > 0 ? 1 : delta < 0 ? -1 : 0;
};

/**
 * The journey from one place to another. Leaving the court takes 900 ms;
 * coming back takes 700 ms and frames the destination. Reduced motion
 * (and standing still) is a cut with the roof and the lid already where they
 * belong.
 */
export function travelPlan(from: HarbourPlaceId, to: HarbourPlaceId, reduced: boolean): TravelPlan {
  const camera: TravelCamera = { mode: "court", anchor: null };
  const rise = riseBetween(from, to);
  const still = from === to || reduced;
  const ms = still ? 0 : to === "court" ? TRAVEL_BACK_MS : TRAVEL_UP_MS;
  const roof: [number, number] = still ? [roofFor(to), roofFor(to)] : [roofFor(from), roofFor(to)];
  const lid: [number, number] = still ? [lidFor(to), lidFor(to)] : [lidFor(from), lidFor(to)];
  return { ms, roof, lid, camera, rise: still ? 0 : rise, cut: still };
}

/** The turn's easing: slow out of the court, slow into the tower. `k` outside 0–1 is clamped. */
export function travelEase(k: number): number {
  const t = Math.max(0, Math.min(1, Number.isFinite(k) ? k : 1));
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export type TravelFrame = { k: number; roof: number; lid: number; done: boolean };

/** Where the roof and the lid stand `elapsed` milliseconds into a plan. A cut is done on its first frame. */
export function travelAt(plan: TravelPlan, elapsed: number): TravelFrame {
  const raw = plan.ms <= 0 ? 1 : Math.max(0, Math.min(1, elapsed / plan.ms));
  const k = travelEase(raw);
  const lerp = (pair: [number, number]) => pair[0] + (pair[1] - pair[0]) * k;
  return { k, roof: lerp(plan.roof), lid: lerp(plan.lid), done: raw >= 1 };
}

export const HARBOUR_CAMERA_SLOT_PREFIX = "camera:v4:village";

/** A return record's camera slot, one per composition **and** per place: the tower keeps its own eye. */
export const harbourCameraSlot = (composition: "phone" | "desktop", place: HarbourPlaceId): string =>
  `${HARBOUR_CAMERA_SLOT_PREFIX}:${composition}:${place}`;
