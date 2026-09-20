/**
 * The three door signs of the Court (BUILD_PLAN §2 #22): the tower (Loft),
 * the cellar stair and the cistern, each one line in plain words and one
 * aria label in full words. Unknown money reads "—", never "$0".
 *
 * Pure over `HarbourReading`; no core import, no jargon.
 */
import type { HarbourReading } from "../data/reading.ts";

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
