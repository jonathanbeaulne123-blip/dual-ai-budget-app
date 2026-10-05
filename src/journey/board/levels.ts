/**
 * The level pull (Horizon Clock, L3; PURE — no three, no DOM): ONE parameter `t` in [0, 2] (0 Year → 1 Month →
 * 2 Week, `LEVEL_T`) drives the camera and every pop, as in the approved prototype. Nothing here is time-based except
 * the two eased transitions (`levelTransition`, `chapterTurn`), and under reduced motion both are cuts.
 *
 * - `cameraAt(t, view)`: where the camera stands. Year frames the ring of twelve minis with the Month diorama shrunk
 *   in the middle; Month frames the clock (zoomed onto a selection when one is focused); Week dives onto the trail with
 *   the island turned so the week reads across (wide) or along (phone) the screen. Log-distance interpolation, so the
 *   dive feels even.
 * - `popsAt(t)`: the scale / visibility of each layer at `t` (month props shrink front-first past t 1.08, the bus at
 *   1.05, the week trail fades in from 1.3, tiles pop front-first from 1.45, the land calms from 1.15, Hercules leaves
 *   from 1.1, numerals and the gate hide past 1.3, the Week bus pops last).
 * - `chapterTurn(u, dir)`: the chapter turn as one parameter `u` in [0, 1] (1.5 s): one full spin of the island in
 *   `dir`, a small lift, the old month's props shrinking out by day, the swap at u 0.5, the new month's popping in.
 */
import { JOURNEY_DIORAMA, LEVEL_T, levelForT, type JourneyLevel, type Point2 } from "../contracts.ts";
import { angDiff, clamp, ease, lerp, popE } from "./geo.ts";
import { YEAR_MINI_SCALE, YEAR_RING_DU } from "./year.ts";

/** Below this width (px) the map is the phone composition (one kernel, two UI branches: < 720 / ≥ 720). */
export const PHONE_MAX_WIDTH = 720;
/** Seconds per unit of `t` for an animated pull (prototype: max(.45, |Δt|·.95)). */
export const LEVEL_SECONDS_PER_UNIT = 0.95;
export const LEVEL_MIN_SECONDS = 0.45;
/** A chapter turn lasts this long. */
export const CHAPTER_TURN_SECONDS = 1.5;
/** Pull per wheel pixel and per pinch doubling (prototype). */
export const WHEEL_T_PER_PX = 0.0022;
export const PINCH_T_PER_DOUBLING = 0.9;

export type SafeInset = { top: number; right: number; bottom: number; left: number };
export const NO_INSET: SafeInset = { top: 0, right: 0, bottom: 0, left: 0 };

/** Everything the camera needs about the stage and the week framing. */
export type CameraView = {
  width: number;
  height: number;
  /** Stage px under chrome per side: framing fits inside the uncovered rect (a view offset, the canvas stays full-bleed). */
  safe: SafeInset;
  /** Month zoom onto a selection: the target (diorama x, y, z) and the zoom factor (1 = the whole clock). */
  focus: { target: [number, number, number]; zoom: number };
  /** The Week framing (from `weekFrame`), or null when there is no week to frame. */
  week: WeekFrame | null;
  /** A Year mini being dived into (its plan position), so the Month grows straight out of it. */
  dive: Point2 | null;
};

/** The Week camera, island-local: the trail's framing centre, the island yaw that turns it to the screen, and how far. */
export type WeekFrame = {
  /** Island yaw (radians) at Week: the island turns, the camera keeps its heading. */
  yaw: number;
  /** Framing centre in island-local diorama units (x, y, z). */
  centre: [number, number, number];
  /** Rotated extents (du) of the tiles and the pile: across (x) and deep (z). */
  across: number;
  deep: number;
};

export type CameraPose = {
  position: [number, number, number];
  lookAt: [number, number, number];
  elevationDeg: number;
  distance: number;
  /** Projection view offset (px) so the target sits in the centre of the uncovered rect. */
  offset: [number, number];
  /** Island yaw blended toward the Week yaw (add the person's Month spin / Week orbit before it). */
  weekBlend: number;
  /** The Month diorama's scale and plan position (it shrinks to the centre of the Year ring, or into a dived mini). */
  worldScale: number;
  worldPosition: Point2;
  /** The Year ring's scale (0 hides it). */
  yearScale: number;
};

export const isPhone = (width: number) => width < PHONE_MAX_WIDTH;
/** Month / Year elevation: 66° on a phone, the contract's 50° wide. */
export const monthElevationDeg = (width: number) => (isPhone(width) ? 66 : JOURNEY_DIORAMA.elevationDeg);
export const weekElevationDeg = (width: number) => (isPhone(width) ? 62 : 60);

/** Camera distance that fits a `wu` × `hu` (du) frame inside the uncovered rect. */
export function fitDistance(wu: number, hu: number, view: Pick<CameraView, "width" | "height" | "safe">): number {
  const tan = Math.tan(((JOURNEY_DIORAMA.fovDeg / 2) * Math.PI) / 180);
  const aspect = view.width / Math.max(1, view.height);
  const freeW = Math.max(0.35, (view.width - view.safe.left - view.safe.right) / Math.max(1, view.width));
  const freeH = Math.max(0.35, (view.height - view.safe.top - view.safe.bottom) / Math.max(1, view.height));
  return Math.max(wu / (2 * tan * aspect * freeW), hu / (2 * tan * freeH));
}

/** The Week framing from the tiles' island-local plan points (+ the pile), the yaw and a ground height. */
export function weekFrame(points: readonly Point2[], yaw: number, groundY: number): WeekFrame {
  const cY = Math.cos(yaw), sY = Math.sin(yaw);
  const rot = (x: number, z: number): Point2 => [x * cY + z * sY, -x * sY + z * cY];
  const unrot = (x: number, z: number): Point2 => [x * cY - z * sY, x * sY + z * cY];
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const p of points) { const r = rot(p[0], p[1]); x0 = Math.min(x0, r[0]); x1 = Math.max(x1, r[0]); z0 = Math.min(z0, r[1]); z1 = Math.max(z1, r[1]); }
  if (!points.length) { x0 = x1 = z0 = z1 = 0; }
  const c = unrot((x0 + x1) / 2, (z0 + z1) / 2);
  return { yaw, centre: [c[0], groundY + 0.12, c[1]], across: x1 - x0, deep: z1 - z0 };
}

export function cameraAt(t: number, view: CameraView): CameraPose {
  const tt = clamp(Number.isFinite(t) ? t : LEVEL_T.month, 0, 2);
  const phone = isPhone(view.width);
  const yearT = 1 - clamp(tt, 0, 1);
  const wk = ease(clamp(tt - 1, 0, 1));
  const dMain = fitDistance(phone ? 11.2 : 12.2, phone ? 10.4 : 9.6, view);
  // The ring plus the labels under the nearest minis (perspective makes the near side larger): a little extra height.
  const dYear = fitDistance(2 * (YEAR_RING_DU + (phone ? 2.6 : 2.2)), 2 * (YEAR_RING_DU + 2.2) * 0.78 + 4.5, view);
  let distance = lerp(dMain / Math.max(0.2, view.focus.zoom), dYear, yearT);
  const f = view.focus.target;
  let target: [number, number, number] = [f[0] * (1 - yearT), f[1] * (1 - yearT), f[2] * (1 - yearT)];
  const monthElev = monthElevationDeg(view.width);
  let elevationDeg = monthElev;
  let lookUp = 0.3 * (1 - yearT);
  if (wk > 0 && view.week) {
    const W = view.week;
    // The Week centre in world space: island-local, turned by the Week yaw (the island is at that yaw when wk = 1).
    const cY = Math.cos(W.yaw), sY = Math.sin(W.yaw);
    const wx = W.centre[0] * cY + W.centre[2] * sY, wz = -W.centre[0] * sY + W.centre[2] * cY;
    target = [lerp(target[0], wx, wk), lerp(target[1], W.centre[1], wk), lerp(target[2], wz, wk)];
    const wElev = weekElevationDeg(view.width);
    const e = (wElev * Math.PI) / 180;
    const wu = W.across + (phone ? 1.1 : 1.4), hu = W.deep * Math.sin(e) + 0.8 * Math.cos(e) + (phone ? 0.9 : 0.45);
    const dWeek = fitDistance(wu, hu, view);
    distance = Math.exp(lerp(Math.log(distance), Math.log(dWeek), wk));
    elevationDeg = lerp(monthElev, wElev, wk);
    lookUp *= 1 - wk;
  }
  const el = (elevationDeg * Math.PI) / 180;
  const position: [number, number, number] = [target[0], target[1] + distance * Math.sin(el), target[2] + distance * Math.cos(el)];
  const lookAt: [number, number, number] = [target[0], target[1] + lookUp, target[2]];
  const cx = (view.safe.left + (view.width - view.safe.right)) / 2, cy = (view.safe.top + (view.height - view.safe.bottom)) / 2;
  const offset: [number, number] = [view.width / 2 - cx, view.height / 2 - cy];
  let worldScale = Math.max(0.001, 1 - yearT * 0.75);
  let worldPosition: Point2 = [0, 0];
  if (view.dive && yearT > 0) {
    worldScale = Math.max(0.001, lerp(1, YEAR_MINI_SCALE * 1.05, yearT));
    worldPosition = [view.dive[0] * yearT, view.dive[1] * yearT];
  }
  return { position, lookAt, elevationDeg, distance, offset, weekBlend: wk, worldScale, worldPosition, yearScale: Math.max(0.001, yearT) };
}

/** Island yaw at `t`: the person's Month spin, blended toward the Week yaw (+ the Week orbit) as the pull dives. */
export function islandYawAt(t: number, spin: number, week: WeekFrame | null, orbit: number): number {
  const wk = ease(clamp(t - 1, 0, 1));
  return wk > 0 && week ? spin + angDiff(week.yaw + orbit, spin) * wk : spin;
}

export type Pops = {
  /** Month slot props at a front-first order `ord` (0 = nearest the camera). */
  monthProp(ord: number): number;
  bus: number;
  weekVisible: boolean;
  /** Trail ribbon opacity factor. */
  trail: number;
  /** Week tile pop (0…1, before the back-out ease) at its order. */
  weekTile(ord: number): number;
  /** How calm the land off the trail is (0 = as drawn, 1 = fully calm). */
  calm: number;
  hercules: number;
  numerals: boolean;
  /** The Week bus pop (0…1). */
  weekBus: number;
  yearVisible: boolean;
};

export function popsAt(t: number, reducedMotion: boolean): Pops {
  const tt = clamp(t, 0, 2);
  return {
    monthProp: (ord) => 1 - ease(clamp((tt - 1.08 - ord * 0.22) / 0.18, 0, 1)),
    bus: 1 - ease(clamp((tt - 1.05) / 0.15, 0, 1)),
    weekVisible: tt > 1.3,
    trail: clamp((tt - 1.3) / 0.3, 0, 1),
    weekTile: (ord) => (reducedMotion ? (tt > 1.5 ? 1 : 0) : clamp((tt - 1.45 - ord * 0.3) / 0.22, 0, 1)),
    calm: ease(clamp((tt - 1.15) / 0.55, 0, 1)),
    hercules: 1 - ease(clamp((tt - 1.1) / 0.3, 0, 1)),
    numerals: tt < 1.3,
    weekBus: reducedMotion ? (tt > 1.5 ? 1 : 0) : popE(clamp((tt - 1.86) / 0.12, 0, 1)),
    yearVisible: tt < 0.98,
  };
}
/** The back-out pop applied to a Week tile's raw pop value. */
export const tilePop = popE;

/** An animated pull from `from` to `to`: duration in seconds (0 under reduced motion = a cut) and `t` at elapsed `s`. */
export function levelTransition(from: number, to: number, reducedMotion: boolean) {
  const a = clamp(from, 0, 2), b = clamp(to, 0, 2);
  const duration = reducedMotion || a === b ? 0 : Math.max(LEVEL_MIN_SECONDS, Math.abs(b - a) * LEVEL_SECONDS_PER_UNIT);
  return {
    duration,
    at(seconds: number): number { return duration <= 0 ? b : a + (b - a) * ease(clamp(seconds / duration, 0, 1)); },
    done(seconds: number): boolean { return duration <= 0 || seconds >= duration; },
  };
}

/** The rest a pull settles on (the nearest level). */
export const restOf = (t: number) => LEVEL_T[levelForT(t)];
export const levelOf = (t: number): JourneyLevel => levelForT(t);

export type TurnFrame = {
  /** Island yaw added by the turn (one full spin in `dir` at u 1). */
  yaw: number;
  /** Island lift (du). */
  lift: number;
  /** True from u 0.5: the new chapter's props are built. */
  swapped: boolean;
  /** A slot's prop scale by its day fraction (day / 31). */
  prop(dayFrac: number): number;
  bus: number;
};
/** The chapter turn at `u` in [0, 1]. Reduced motion never calls this (the swap is a cut). */
export function chapterTurn(u: number, dir: -1 | 1, startYaw = 0): TurnFrame {
  const t = clamp(u, 0, 1), e = ease(t);
  const swapped = t >= 0.5;
  return {
    yaw: startYaw * (1 - e) + dir * Math.PI * 2 * e,
    lift: Math.sin(Math.PI * t) * 0.35,
    swapped,
    prop: (fr) => (swapped ? popE(clamp((t - 0.55 - fr * 0.3) / 0.18, 0, 1)) : Math.max(0.001, 1 - clamp(t / 0.4 - fr * 0.25, 0, 1))),
    bus: swapped ? popE(clamp((t - 0.8) / 0.2, 0, 1)) : Math.max(0.001, 1 - clamp(t / 0.3, 0, 1)),
  };
}
