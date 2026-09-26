/**
 * The three door signs of the Court (BUILD_PLAN §2 #22): the tower (Loft),
 * the cellar stair and the cistern, each one line in plain words and one
 * aria label in full words. Unknown money reads "—", never "$0".
 *
 * Pure over `HarbourReading`; no core import, no jargon.
 *
 * W5 #1 extends this file to the whole island: `placeSigns` gives every place
 * its own sign, read from that place's own reading, so a building on the path
 * says what it holds before you go in.
 */
import type { HarbourReading } from "../data/reading.ts";
import type { HarbourPlaceId } from "../flag.ts";

export type DoorId = "tower" | "cellar" | "cistern";
export type DoorSign = { line: string; aria: string };
export type DoorSigns = Record<DoorId, DoorSign>;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** Whole dollars with thousands separators: 124000 → "$1,240"; -12050 → "-$121"; null → "—". */
export function plainDollars(cents: number | null): string {
  if (cents === null || !Number.isFinite(cents)) return "—";
  const dollars = Math.round(Math.abs(cents) / 100);
  const digits = String(dollars).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${cents < 0 && dollars > 0 ? "-" : ""}$${digits}`;
}

/** "2026-09-18" → "Sep 18". Anything that is not a civil date comes back unchanged. */
export function shortDate(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return date;
  const month = MONTHS[Number(match[2]) - 1];
  return month ? `${month} ${Number(match[3])}` : date;
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * The three signs, read from the slice-2 reading where it is richer than the
 * slice-1 counts: the tower counts the banks standing on the rack's shelves,
 * the cellar counts the jars on the rail, and the cistern reads its own water
 * before falling back to the Protect bank. An empty extension keeps the
 * slice-1 numbers, so a sign is never blanker than it was.
 */
export type DoorSignReading = Pick<HarbourReading, "banks" | "jars" | "build" | "protect" | "next"> & Partial<Pick<HarbourReading, "tower" | "cellar" | "cistern">>;

export function doorSigns(reading: DoorSignReading): DoorSigns {
  const saved = plainDollars(reading.build.cents);
  // The sign counts what is actually on the rack, so the door and the room agree:
  // a tower with a bare shelf says so rather than promising banks it does not hold.
  // OPEN PRODUCT QUESTION (raised with Jonathan): whether the Loft's ledge should
  // hold every goal bank, not only those filed under Build. Money model untouched.
  const onShelves = (reading.tower?.shelves ?? []).reduce((sum, shelf) => sum + shelf.banks.length, 0);
  const banks = reading.tower ? onShelves : reading.banks;
  const tower = {
    line: `${count(banks, "bank", "banks")} · ${saved} saved`,
    aria: reading.build.cents === null
      ? `The tower. ${count(banks, "kitty bank", "kitty banks")}; what is saved is not known yet. Opens the Loft.`
      : `The tower. ${count(banks, "kitty bank", "kitty banks")}, ${saved} saved. Opens the Loft.`,
  };

  const nextBill = reading.next && reading.next.target === "cellar-bills" ? reading.next : null;
  const jars = reading.cellar?.jars.length || reading.jars;
  const cellar = {
    line: nextBill
      ? `${count(jars, "bill", "bills")} · next ${nextBill.label} ${shortDate(nextBill.date)}`
      : `${count(jars, "bill", "bills")} · nothing dated`,
    aria: nextBill
      ? `The cellar stair. ${count(jars, "bill jar", "bill jars")} this month; the next is ${nextBill.label} on ${shortDate(nextBill.date)}${nextBill.daysAhead === 0 ? ", today" : nextBill.daysAhead === 1 ? ", tomorrow" : nextBill.daysAhead > 1 ? `, in ${nextBill.daysAhead} days` : ""}. Opens the Cellar.`
      : `The cellar stair. ${count(jars, "bill jar", "bill jars")} this month; no dated bill is next. Opens the Cellar.`,
  };

  const cents = reading.cistern?.cents ?? reading.protect.cents;
  const target = reading.cistern?.target || reading.protect.target;
  const water = plainDollars(cents);
  const cistern = cents === null
    ? { line: "—", aria: "The cistern. The buffer is not known yet. Opens the Protect bank." }
    : target > 0
      ? { line: `${water} of ${plainDollars(target)}`, aria: `The cistern. ${water} of a ${plainDollars(target)} buffer. Opens the Protect bank.` }
      : { line: `${water} set aside`, aria: `The cistern. ${water} set aside; no buffer agreed yet. Opens the Protect bank.` };

  return { tower, cellar, cistern };
}

/* ──────────────────────────────────────────────────────────────────────────
 * The door signs of the island (W5 #1)
 *
 * Every building on the island carries its key numbers on the outside, so you
 * never have to go in to know. A sign is **one short line** you can read from
 * the path and one line in full words for a screen reader, and both are pure
 * over the room's own reading: counts and the figures that room already
 * shows, never its private contents and never an amount it would not itself
 * put on a plate.
 *
 * The Court's own three doors keep `doorSigns` above (the tower, the cellar
 * stair, the cistern); `placeSigns` is the whole island, one sign per place,
 * and `courtSignLines` is what the Court's lawn plates are engraved with.
 * ────────────────────────────────────────────────────────────────────────── */

/** A sign line must fit the plate and a phone's path view: longer than this and it would be carved too small to read. */
export const SIGN_LINE_MAX = 34;

const MONTH_KEY = /^(\d{4})-(\d{2})$/;

/** "2026-09" → "Sep". Anything else comes back unchanged. */
export function shortMonth(monthKey: string): string {
  const match = MONTH_KEY.exec(monthKey);
  const month = match ? MONTHS[Number(match[2]) - 1] : null;
  return month ?? monthKey;
}

const BOOK_WORDS: Record<string, string> = { current: "current", stale: "not fresh", offline: "offline" };

/**
 * One sign per place, read from that place's own pure reading. The keys are
 * `HarbourPlaceId`, so a place added to the island without a sign is a type
 * error, not a bare wall.
 */
export function placeSigns(reading: HarbourReading): Record<HarbourPlaceId, DoorSign> {
  const court = doorSigns(reading);

  const everyday = plainDollars(reading.everyday);
  const state = reading.condition.state;

  const glass = reading.glasshouse;
  const standing = glass.pots.length + glass.overflow;
  const glasshouse: DoorSign = standing === 0
    ? { line: "Clear benches", aria: "The Glasshouse. Every bench is clear. Opens the Master Planner." }
    : {
      line: `${count(standing, "pot", "pots")} · ${glass.dry === 0 ? "all watered" : `${glass.dry} dry`}`,
      aria: `The Glasshouse. ${count(standing, "pot", "pots")} standing${glass.dry === 0 ? ", all watered" : `, ${count(glass.dry, "one dry", "dry")}`}. Opens the Master Planner.`,
    };

  const cards = reading.kitchen.cards.length + reading.kitchen.overflow;
  const month = reading.kitchen.monthKey ? shortMonth(reading.kitchen.monthKey) : null;
  const kitchen: DoorSign = cards === 0
    ? { line: "No plan on the wall", aria: "The Kitchen. The cookbook wall is bare and an empty card is waiting. Opens the Plan Studio." }
    : {
      line: `${count(cards, "card", "cards")}${month ? ` · ${month}` : ""}`,
      aria: `The Kitchen. ${count(cards, "recipe card", "recipe cards")} on the wall${month ? ` for ${month}` : ""}${reading.kitchen.waiting ? ", one waiting for the other of you" : ""}. Opens the Plan Studio.`,
    };

  const shore = reading.boathouse;
  const boathouse: DoorSign = {
    line: `${count(shore.wishes, "wish", "wishes")} · ${count(shore.memories, "memory", "memories")}`,
    aria: `The Boathouse. ${count(shore.wishes, "wish in the light", "wishes in the light")}, ${count(shore.memories, "memory kept", "memories kept")}${shore.letters > 0 ? `, ${count(shore.letters, "letter placed", "letters placed")}` : ""}. Opens the Conservatory.`,
  };

  const his = reading.cottage;
  const cottage: DoorSign = {
    line: `${count(his.looks, "look", "looks")} · ${count(his.keepsakes, "keepsake", "keepsakes")}`,
    aria: `${his.name}’s Cottage. ${count(his.looks, "look kept", "looks kept")} and ${count(his.keepsakes, "keepsake", "keepsakes")} on the shelves${his.worn > 0 ? `; he has ${count(his.worn, "piece", "pieces")} on` : ""}. Opens the dressing room.`,
  };

  const fire = reading.kiln;
  const heat = fire.sinceFiring === null ? "cold" : fire.sinceFiring === 0 ? "still hot" : fire.warmth > 0 ? "warm" : "cold";
  const kiln: DoorSign = {
    line: `${count(fire.fired, "piece", "pieces")} fired · ${heat}`,
    aria: `The Kiln. ${count(fire.fired, "piece", "pieces")} fired and the bricks are ${heat}${fire.onTheWheel > 0 ? `; ${count(fire.onTheWheel, "piece is", "pieces are")} still clay` : ""}. Opens the Kiln.`,
  };

  const ring = reading.campfire;
  const seatWords = ring.close === "proposed" ? "a closing on the table"
    : ring.close === "awaiting-partner" ? "one seat empty"
      : ring.close === "sealed" ? "sealed"
        : ring.month ? (ring.overdue ? "still open" : "open") : "no Chapter";
  const campfire: DoorSign = !ring.lit
    ? { line: "Unlit kindling", aria: "The Campfire. Unlit kindling; the fire is lit at your first Sitdown. Opens the Plan Studio." }
    : {
      line: `${count(ring.stones, "stone", "stones")} · ${seatWords}`,
      aria: `The Campfire. ${count(ring.stones, "stone laid", "stones laid")} on the path${ring.month ? `; this Chapter is ${seatWords === "sealed" ? "sealed" : seatWords}` : ""}. Opens the Plan Studio.`,
    };

  const map = reading.atlas;
  const era = map.era;
  const atlas: DoorSign = era === null
    ? { line: "No era yet", aria: "The Atlas. No era has been agreed yet. Opens Journey." }
    : {
      line: `${map.eras > 1 ? `Era ${era.index} of ${map.eras}` : "The first era"} · ${count(map.stones, "stone", "stones")}`,
      aria: `The Atlas. ${era.name}, ${map.eras > 1 ? `era ${era.index} of ${map.eras}` : "the first era"}, ${count(map.stones, "stone", "stones")} on the path${map.gate ? `; the gate reads ${map.gate.words}` : ""}. Opens Journey.`,
    };

  const books = BOOK_WORDS[reading.freshness] ?? "current";
  const library: DoorSign = {
    line: `Books ${books} · ${state}`,
    aria: `The Library. The books are ${books} and the house is ${state}. Opens the Standing Book.`,
  };

  return {
    bank: {line:"Your shared Fund",aria:"The Fund bank. The Queen stands here. Opens the shared Fund."},
    court: {
      line: `${everyday} everyday · ${state}`,
      aria: reading.everyday === null
        ? `The square. What is left for everyday is not known yet; the house is ${state}. Opens the Fund bank.`
        : `The square. ${everyday} left for everyday; the house is ${state}. Opens the Fund bank.`,
    },
    tower: court.tower,
    cellar: court.cellar,
    library,
    glasshouse,
    kitchen,
    boathouse,
    cottage,
    kiln,
    campfire,
    atlas,
  };
}

/**
 * The buildings standing on the Court's lawn, by the anchor id the Court gives
 * each one, and the place whose sign that building carries. The Court's own
 * three doors are not here — the rook, the bishop and the knight already wear
 * their engraved plates.
 */
export const COURT_SIGN_PLACES: Readonly<Record<string, HarbourPlaceId>> = Object.freeze({
  "library-hall": "library",
  "glasshouse-shed": "glasshouse",
  "kitchen-cottage": "kitchen",
  boathouse: "boathouse",
  "hercules-cottage": "cottage",
  "kiln-house": "kiln",
  campfire: "campfire",
});

/** A lawn sign: the two lines carved on the plate, and the words its twin reads. */
export type CourtSign = { place: HarbourPlaceId; plate: string; line: string; aria: string };

/**
 * The lawn signs, keyed by the Court's own anchor id: the building's name over
 * its sign line on the plate, and the room's full words for the twin. Tolerant
 * of a reading that has not arrived yet (or arrived from an older build) — the
 * Court is drawn before the books answer, so a missing room is an empty table,
 * never a blank wall and never a throw.
 */
export function courtSigns(reading: HarbourReading | null | undefined): Record<string, CourtSign> {
  if (!reading) return {};
  let signs: Record<HarbourPlaceId, DoorSign>;
  try { signs = placeSigns(reading); } catch { return {}; }
  const lawn: Record<string, CourtSign> = {};
  for (const [anchor, place] of Object.entries(COURT_SIGN_PLACES)) {
    const sign = signs[place];
    if (sign) lawn[anchor] = { place, plate: `${SIGN_TITLES[place]}\n${sign.line}`, line: sign.line, aria: sign.aria };
  }
  return lawn;
}

/** The name carved above each sign line — the building's own, as short as the plate allows. */
export const SIGN_TITLES: Readonly<Record<HarbourPlaceId, string>> = Object.freeze({
  bank:"Fund Bank",
  court: "The Court", tower: "The Tower", cellar: "The Cellar", library: "The Library",
  glasshouse: "The Glasshouse", kitchen: "The Kitchen", boathouse: "The Boathouse",
  cottage: "The Cottage", kiln: "The Kiln", campfire: "The Campfire", atlas: "The Atlas",
});
