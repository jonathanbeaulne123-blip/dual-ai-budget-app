/**
 * `layoutClock(board, chapterId)` (Horizon Clock Month, L3; PURE — no three, no DOM).
 *
 * The month as a clock: 31 day slots round the bezel road (`JOURNEY_DIORAMA.bezel.road`), day 1 at north on the top
 * arch, clockwise. SAME DATE → SAME SLOT: the slot is the day of the month, whatever the month, so the 15th always sits
 * at the same place on the dial. Days a month does not have (the 31st of September) keep their slot, drawn as the road
 * only. Each slot holds every stop on that date (board order); up to two stand as toys, a third shows as an ink bead.
 *
 * Money (contracts §"Money on the map"): a stop whose direction is in/out stands on a coin stack whose rings come ONLY
 * from `ringsFor(amountCents, "month")`; a null / unknown amount has NO stack (never zero, never a guessed height); a
 * known $0.00 is a single flat coin. Solid = recorded (paid / confirmed), see-through = not recorded. Income (mint)
 * stands on the island side of the slot, bills (gold) on the sea side. A slot with a `isToCheck` stop wears the honey
 * needs-you ring with its dark outline and "!" bead.
 */
import {
  JOURNEY_DIORAMA, isToCheck, ringsFor, type ChapterId, type DateKey, type JourneyBoard, type JourneyLevel, type MoneyDirection,
  type Point2, type StackFill, type StackRings, type Stop,
} from "../contracts.ts";
import { directionOf, isRecorded, knownCents } from "../model/money.ts";
import { polar, slotAngle } from "./geo.ts";
import { propKindFor, type PropKind } from "./kinds.ts";

/** Diorama units per ring on the Month / Week ruler ($100 a ring) and on the Year ruler ($1,000 a ring). */
export const RING_HEIGHT_DU = { month: 0.028, week: 0.028, year: 0.36 } as const satisfies Record<JourneyLevel, number>;
/** A known $0.00 (or a stack under one ring) is never thinner than one flat coin. */
export const MIN_STACK_DU = 0.012;
/** Up to this many toys stand on one slot; more show as a bead (the sheet lists them all). */
export const SLOT_TOYS = 2;

/** One stop's coin stack. Null on the item when the amount is unknown (no stack at all). */
export type CoinStack = { cents: number; rings: StackRings; fill: StackFill; direction: Exclude<MoneyDirection, "none">; heightDu: number };
/** Stack for a stop at a level, or null (no money direction, or unknown amount). Heights only from `ringsFor`. */
export function stackFor(stop: Stop, level: JourneyLevel): CoinStack | null {
  const direction = directionOf(stop);
  if (direction === "none") return null;
  const cents = knownCents(stop);
  const rings = ringsFor(cents, level);
  if (cents === null || !rings) return null;
  return { cents, rings, fill: isRecorded(stop) ? "solid" : "see-through", direction, heightDu: Math.max(MIN_STACK_DU, rings.drawnRings * RING_HEIGHT_DU[level]) };
}

export type ClockItem = {
  stopId: string;
  prop: PropKind;
  stack: CoinStack | null;
  /** Not recorded (scheduled, expected, estimate, overdue, …): the toy is drawn pale. */
  pale: boolean;
  /** Past and recorded: the toy is drawn a little faded. */
  faded: boolean;
  /** Plan offset from the slot centre, in slot-local units: +r = toward the sea (outside), −r = toward the island. */
  radial: number;
  /** Along the road (clockwise +). */
  along: number;
  /** Two toys share the slot: each draws smaller. */
  small: boolean;
};

export type ClockSlot = {
  /** 1…31, the day of the month. Same date → same slot. */
  slot: number;
  /** The date when the month has this day; null for a slot past the month's end. */
  date: DateKey | null;
  angle: number;
  /** Diorama plan (x, z) on the road centreline. */
  at: Point2;
  relation: "past" | "today" | "future" | null;
  stopIds: string[];
  items: ClockItem[];
  /** Stops beyond the toys (a bead shows; the sheet lists every one). */
  more: number;
  needsYou: boolean;
  /** Every stop here is not recorded: the pad is pale with a dashed rim. */
  allOpen: boolean;
};

export type ClockLayout = {
  chapterId: ChapterId;
  daysInMonth: number;
  slots: ClockSlot[];
  /** Today's slot when today falls in this chapter (the bus stands there), else null. */
  todaySlot: number | null;
  /** The bus: just clockwise of today's slot, on the island side of the road. Null off today's chapter. */
  bus: { at: Point2; heading: number } | null;
  /** The chapter arch over the gap between day 31 and day 1 (the top of the dial), with its "1". */
  gate: { at: Point2; angle: number };
  /** Bezel numerals (8, 15, 22, 29) and where they stand, outside the road. Day 1's numeral rides the gate. */
  numerals: { day: number; at: Point2 }[];
};

export const CLOCK_NUMERAL_DAYS = [8, 15, 22, 29] as const;
const NUMERAL_R = 5.3;
const BUS_INSET = 0.13;
const BUS_LEAD = 0.075;

export function slotOfDate(date: DateKey): number {
  return Number(date.slice(8, 10));
}

export function layoutClock(board: JourneyBoard, chapterId: ChapterId = board.currentChapterId): ClockLayout {
  const R = JOURNEY_DIORAMA.bezel.road;
  const chapter = board.chapters.find((c) => c.id === chapterId);
  const byId = new Map(board.stops.map((s) => [s.id, s] as const));
  const byDay = new Map<number, Stop[]>();
  for (const stop of board.stops) {
    if (stop.chapterId !== chapterId) continue;
    const day = slotOfDate(stop.date);
    (byDay.get(day) ?? byDay.set(day, []).get(day)!).push(stop);
  }
  const daysInMonth = chapter?.days.length ?? 31;
  const slots: ClockSlot[] = [];
  for (let day = 1; day <= JOURNEY_DIORAMA.slots; day += 1) {
    const cell = chapter?.days[day - 1] ?? null;
    const stops = (cell ? cell.stopIds.map((id) => byId.get(id)).filter((s): s is Stop => !!s) : byDay.get(day) ?? []);
    // Every stop of this chapter on this day, even one the chapter's day cells missed.
    for (const s of byDay.get(day) ?? []) if (!stops.includes(s)) stops.push(s);
    const angle = slotAngle(day);
    const shown = stops.slice(0, SLOT_TOYS);
    const two = shown.length > 1;
    const dirs = shown.map(directionOf);
    const mixed = two && (dirs[0] === "in") !== (dirs[1] === "in");
    const items: ClockItem[] = shown.map((stop, i) => {
      const inc = directionOf(stop) === "in";
      // Prototype: income on the island side, bills on the sea side; two of a kind stand side by side along the road.
      const radial = mixed ? (inc ? -0.13 : 0.13) : (inc ? -0.07 : 0.05) + (two ? (i ? 0.04 : -0.04) : 0);
      const along = two && !mixed ? (i ? 0.12 : -0.12) : 0;
      return {
        stopId: stop.id, prop: propKindFor(stop), stack: stackFor(stop, "month"), pale: !isRecorded(stop) && stop.kind !== "review" && stop.kind !== "memory" && stop.kind !== "milestone",
        faded: stop.relation === "past" && isRecorded(stop), radial, along, small: two,
      };
    });
    slots.push({
      slot: day, date: cell?.date ?? null, angle, at: polar(angle, R), relation: cell?.relation ?? null,
      stopIds: stops.map((s) => s.id), items, more: Math.max(0, stops.length - SLOT_TOYS),
      needsYou: stops.some(isToCheck), allOpen: stops.length > 0 && stops.every((s) => !isRecorded(s) && directionOf(s) !== "none"),
    });
  }
  const todaySlot = board.today.slice(0, 7) === chapterId ? slotOfDate(board.today) : null;
  let bus: ClockLayout["bus"] = null;
  if (todaySlot !== null) {
    const th = slotAngle(todaySlot) + BUS_LEAD;
    const at = polar(th, R - BUS_INSET);
    // Facing clockwise along the road (the prototype's atan2(−sin, cos)).
    bus = { at, heading: Math.atan2(-Math.sin(th), Math.cos(th)) };
  }
  const gateAngle = slotAngle(1) - Math.PI / JOURNEY_DIORAMA.slots;
  return {
    chapterId, daysInMonth, slots, todaySlot, bus,
    gate: { at: polar(gateAngle, R), angle: gateAngle },
    numerals: CLOCK_NUMERAL_DAYS.map((day) => ({ day, at: polar(slotAngle(day), NUMERAL_R) })),
  };
}

/** The slot holding a stop (by its date), or null when the stop is not in this layout's chapter. */
export function slotForStop(layout: ClockLayout, stopId: string): ClockSlot | null {
  return layout.slots.find((s) => s.stopIds.includes(stopId)) ?? null;
}
