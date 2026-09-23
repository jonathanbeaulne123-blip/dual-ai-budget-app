import type { HarbourReading } from "./reading.ts";
import { VILLAGE_SITES, VILLAGE_WATERFRONT } from "../village/layout.ts";
import { PLACE_PLACEMENTS, placementDoor } from "../scene/place.ts";

/**
 * Little Harbour · what, on this island, wants a person.
 *
 * Presentation over an existing pure reading, and nothing else. Every branch
 * below is a field `data/reading.ts` already computes and already shows
 * somewhere; this file only decides **which building it stands in front of**
 * and puts the reading's own words beside it. It reads no household, no
 * books, no clock. It invents nothing: a household whose reading says nothing
 * is waiting gets `null`, and a cat with nowhere to lead you simply walks at
 * your heel.
 *
 * It is a *sort*, not a judgement: the order below is the order the rooms
 * themselves put these in — a day that comes up short and a bill with a date
 * on it come before a chapter that has been open a while, which comes before
 * a plan waiting for the other chair, which comes before the slower things.
 */

/**
 * Where a cat can stand and wait. Each one is a door on the island — the
 * historic presentation keys. Their coordinates are deliberately derived
 * from today's village placements, so a layout move cannot leave a cat
 * walking to an old Court literal.
 */
export type AttentionSpot =
  | "stairhead"
  | "campfire"
  | "kitchen-cottage"
  | "glasshouse-shed"
  | "boathouse"
  | "kiln-house";

export type Attention = {
  spot: AttentionSpot;
  /**
   * A key that changes only when the *thing* changes, so a cat already
   * standing at a door is not sent to it again every frame.
   */
  key: string;
  /**
   * The reading's own sentence, for the announcement and for evidence. Never
   * a claim beyond the field it came from.
   */
  why: string;
};

/**
 * The building centres are the village's canonical sites. `stairhead` remains
 * a compatibility key, but bills now lead to the Kitchen's exterior door:
 * the Cellar is reached from inside Our home.
 */
const siteSpot = (site: { spot: readonly [number, number] }): readonly [number, number] => site.spot;
export const ATTENTION_SPOTS: Readonly<Record<AttentionSpot, readonly [number, number]>> = Object.freeze({
  stairhead: siteSpot(VILLAGE_SITES.home),
  campfire: siteSpot(VILLAGE_WATERFRONT),
  "kitchen-cottage": siteSpot(VILLAGE_SITES.home),
  "glasshouse-shed": siteSpot(VILLAGE_SITES.glasshouse),
  boathouse: siteSpot(VILLAGE_SITES.boathouse),
  "kiln-house": siteSpot(VILLAGE_SITES.studio),
});

/**
 * How far in front of a building its door is — a stride further out than the
 * door sign stands (`SIGN_STEP` is 1.7), so a cat waiting there is beside the
 * sign rather than through it. The stairhead is an opening in the paving and
 * is stood beside, not in.
 */
export const DOORSTEP = 2.35;
const STAIR_STEP = 0.8;

const placementForSpot: Readonly<Record<AttentionSpot, keyof typeof PLACE_PLACEMENTS>> = Object.freeze({
  stairhead: "kitchen",
  campfire: "campfire",
  "kitchen-cottage": "kitchen",
  "glasshouse-shed": "glasshouse",
  boathouse: "boathouse",
  "kiln-house": "kiln",
});

/** The point a cat waits at, and the way it faces: at the door, looking at the door. */
export function attentionDoor(spot: AttentionSpot): { x: number; z: number; yaw: number } {
  const [px, pz] = ATTENTION_SPOTS[spot];
  const placement = PLACE_PLACEMENTS[placementForSpot[spot]];
  if (!placement) throw new Error(`No canonical placement for attention spot ${spot}`);
  const door = placementDoor(placement);
  // Door direction is derived from the placement itself, rather than assuming
  // every building faces the Court. This survives the curved, expanded island.
  const dx = door[0] - px, dz = door[2] - pz;
  const length = Math.hypot(dx, dz) || 1;
  const step = spot === "stairhead" ? STAIR_STEP : DOORSTEP;
  const x = door[0] + (dx / length) * step, z = door[2] + (dz / length) * step;
  // Facing the thing he has brought you to: along the line from here to it.
  return { x, z, yaw: Math.atan2(door[0] - x, door[2] - z) };
}

/** A reading may arrive half-built (a place under test, a first paint). Every read below is optional. */
type Partialish = Partial<HarbourReading> | null | undefined;

/**
 * The one thing most wanting a person, or null.
 *
 * Every `why` is the reading's own count or label. Nothing here rounds a
 * number up, softens a state or says "you should".
 */
export function attentionOf(reading: Partialish): Attention | null {
  if (!reading) return null;

  // ── A day that comes up short, and a bill with a date on it ──────────────
  // Both live in the Cellar's rail of days and jars, reached through the
  // Kitchen's front door rather than an exterior stairhead.
  const short = reading.prepare?.shortOn;
  if (short) {
    return { spot: "stairhead", key: `short:${short.date}:${short.shortCents}`, why: `${short.label} on ${short.date} comes up short` };
  }
  const next = reading.next;
  if (next && next.target === "cellar-bills") {
    return { spot: "stairhead", key: `bill:${next.date}:${next.label}`, why: `${next.label} is due in ${next.daysAhead} day${next.daysAhead === 1 ? "" : "s"}` };
  }

  // ── A chapter ready to close ─────────────────────────────────────────────
  // `overdue` is the reading's word for "the month has ended and no Sitdown
  // has closed it"; `proposed` is "a closure is on the table and you have not
  // agreed to it yet". Both are a fire with an empty seat at it.
  const fire = reading.campfire;
  if (fire && (fire.overdue || fire.close === "proposed")) {
    const month = fire.month ?? "the open chapter";
    return {
      spot: "campfire",
      key: `chapter:${month}:${fire.close}:${fire.overdue ? "over" : "open"}`,
      why: fire.close === "proposed" ? `a close is proposed for ${month}` : `${month} is open past its end`,
    };
  }

  // ── A plan card waiting for the other chair ──────────────────────────────
  const kitchen = reading.kitchen;
  if (kitchen?.waiting) {
    return { spot: "kitchen-cottage", key: `plan:${kitchen.monthKey ?? "-"}:waiting`, why: "a plan is proposed and waiting for the other chair" };
  }

  // ── Pots gone dry in the Glasshouse ──────────────────────────────────────
  const glass = reading.glasshouse;
  if (glass && glass.dry > 0) {
    return { spot: "glasshouse-shed", key: `dry:${glass.dry}`, why: `${glass.dry} pot${glass.dry === 1 ? " has" : "s have"} gone dry` };
  }

  // ── A wish newly hung in the Boathouse ───────────────────────────────────
  const boathouse = reading.boathouse;
  if (boathouse && boathouse.hung > 0) {
    return { spot: "boathouse", key: `hung:${boathouse.hung}`, why: `${boathouse.hung} wish${boathouse.hung === 1 ? "" : "es"} newly hung` };
  }

  // ── Clay still on the wheel ──────────────────────────────────────────────
  const kiln = reading.kiln;
  if (kiln && kiln.onTheWheel > 0) {
    return { spot: "kiln-house", key: `wheel:${kiln.onTheWheel}`, why: `${kiln.onTheWheel} piece${kiln.onTheWheel === 1 ? "" : "s"} still on the wheel` };
  }

  return null;
}
