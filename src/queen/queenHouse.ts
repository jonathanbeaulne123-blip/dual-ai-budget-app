/**
 * The house axis (2026-09-14).
 *
 * Hearth's shared home is three floors on one line and the line is vertical:
 * **the loft is Build, overhead; the hearth is What now, where you stand; the
 * cellar is Protect, underfoot.** Everything in this file is that one axis, and
 * one rule governs all of it — **up goes up**. A swipe up, a haul up, ArrowUp:
 * all three climb one floor, and down descends one. No gesture means "move the
 * camera the other way", because a person who has to work out which thing moved
 * has already lost the spatial memory the direction was for.
 *
 * Horizontal is the room's own business, not the house's: the cellar's ribbon
 * runs through time, the loft's ledge runs through order, and Home runs across
 * her three banks. This file only says which way a key or a drag pointed.
 *
 * Pure: no React, no DOM, no money. The hook that listens for pointers lives in
 * `useHouseAxis`, and every room reaches the same floors through the rail, so
 * the gesture is never the only way in.
 */
export type HousePlace = "loft" | "home" | "cellar";
/** Top to bottom, the way the house is stacked. */
export const HOUSE_FLOORS = ["loft", "home", "cellar"] as const;
export type HouseMove = "up" | "down";
export type HouseTurn = -1 | 1;

export const HOUSE_WORDS: Record<HousePlace, { name: string; role: string; toward: string }> = {
  loft: { name: "The loft", role: "Build", toward: "Up to the loft" },
  home: { name: "The hearth", role: "Everyday · now", toward: "Back to her" },
  cellar: { name: "The cellar", role: "Protect", toward: "Down to the cellar" },
};

/** One floor in the given direction, clamped: the loft has no upstairs and the cellar no down. */
export function houseStep(place: HousePlace, move: HouseMove): HousePlace {
  const at = HOUSE_FLOORS.indexOf(place);
  const next = at + (move === "up" ? -1 : 1);
  return HOUSE_FLOORS[Math.max(0, Math.min(HOUSE_FLOORS.length - 1, next))]!;
}
/** Whether that step would actually move. The rail disables a stair that goes nowhere. */
export const houseCan = (place: HousePlace, move: HouseMove) => houseStep(place, move) !== place;

/** How far a haul must travel before it is a floor and not a twitch. */
export const HOUSE_DRAG_MIN = 56;
/** A flick this fast (px per ms) counts at half the distance. */
export const HOUSE_FLICK = 0.45;
/** Vertical must beat horizontal by this much, so a ribbon scrub is never a stair. */
export const HOUSE_DOMINANCE = 1.5;

export type HouseDrag = {
  /** Pointer travel, in CSS pixels. Up the screen is negative, as the DOM has it. */
  dx: number;
  dy: number;
  /** How long the drag took, in ms. Optional: a flick only counts when it is timed. */
  ms?: number;
  /** The height the gesture happened in, so a short phone asks for less travel than a desk. */
  reach?: number;
};

/**
 * What a finished drag meant, or null for "nothing — leave the floor alone".
 * Distance or a flick will do; vertical dominance is required either way.
 */
export function houseSwipe(drag: HouseDrag): HouseMove | null {
  const { dx, dy } = drag;
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
  if (Math.abs(dy) <= Math.abs(dx) * HOUSE_DOMINANCE) return null;
  const reach = Number.isFinite(drag.reach) && (drag.reach ?? 0) > 0 ? drag.reach! : 0;
  const far = reach ? Math.min(HOUSE_DRAG_MIN, Math.max(28, reach * 0.12)) : HOUSE_DRAG_MIN;
  const flicked = Number.isFinite(drag.ms) && (drag.ms ?? 0) > 0 && Math.abs(dy) / drag.ms! >= HOUSE_FLICK;
  if (Math.abs(dy) < (flicked ? far / 2 : far)) return null;
  return dy < 0 ? "up" : "down";
}

/** Which way an arrow key pointed on the house's axis, or null for a key the house does not own. */
export function houseKey(key: string): HouseMove | null {
  return key === "ArrowUp" ? "up" : key === "ArrowDown" ? "down" : null;
}
/** Which way an arrow key pointed across a room. The room decides what across means. */
export function houseTurnKey(key: string): HouseTurn | null {
  return key === "ArrowLeft" ? -1 : key === "ArrowRight" ? 1 : null;
}

/**
 * Whether the house may answer this event, or whether something nearer the
 * pointer already owns it.
 *
 * Almost nothing needs to claim anything, because the axes already separate the
 * gestures: the ribbon and the ledge run *across*, and both refuse a drag that
 * leans vertical, so up and down stay the house's everywhere — including over a
 * ledge that fills a phone. Fields and scrubbers own theirs outright. Anything
 * carrying `data-house-hold` owns both directions, unless it names a single
 * direction, in which case it keeps only that one: she keeps the pull **down**
 * that tips her over, and lets the climb up to the loft pass through her.
 *
 * `move` is absent when a drag has only just started and its direction is not
 * known yet. A one-direction holder lets that grab begin and is asked again the
 * moment the direction settles.
 */
export function houseOwnsEvent(target: EventTarget | null, move?: HouseMove): boolean {
  const element = target as Element | null;
  if (!element || typeof element.closest !== "function") return true;
  if (element.closest("input, textarea, select, [contenteditable=true]")) return false;
  const holder = element.closest("[data-house-hold]");
  if (!holder) return true;
  const kept = holder.getAttribute("data-house-hold");
  if (kept === "up" || kept === "down") return move === undefined || move !== kept;
  return false;
}
