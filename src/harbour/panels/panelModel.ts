/**
 * The compact panels' readings (brief §3.2 right-hand column, `SCALES` §4.3).
 *
 * Pure over `HarbourReading` (the island's one read-model) plus a few extras
 * the reading does not carry yet — the Fund's accepted balance and last
 * moves, each bill's recurrence, the month's in/out/leftover — which the
 * integrator hands in from existing selectors. Amounts stay explicit; an
 * unknown amount reads "—", never "$0". Nothing here writes, and nothing here
 * imports a command (A12, `test/glass-panels.test.ts`).
 */
import type { DateKey } from "../../core/calendar.ts";
import type { HarbourReading } from "../data/reading.ts";
import { shortDate, shortMonth } from "../nav/doorSigns.ts";

export type PanelHost = "bank" | "cellar" | "tower" | "kitchen" | "library" | "glasshouse" | "campfire" | "boathouse" | "atlas" | "cottage" | "hercules";

export type FundMove = { key: string; label: string; cents: number; date: DateKey };
export type CellarPanelBill = { key: string; label: string; cents: number; due: DateKey | null; recurrenceId: string | null };

/** What the reading does not carry; every field optional, every gap reads "—". */
export type PanelExtras = {
  memberId?: string;
  today?: DateKey;
  fund?: { acceptedCents: number | null; asOf: DateKey | null; moves: readonly FundMove[] };
  /** The next bills with their recurrence, so "Mark paid" can name one. */
  bills?: readonly CellarPanelBill[];
  books?: { inCents: number | null; outCents: number | null; leftoverCents: number | null; monthKey?: string | null };
  /** Recipe cards (or other Chapter items) waiting on this member. */
  needsYou?: number;
};

/** Exact dollars with thousands separators: 128450 → "$1,284.50"; unknown → "—", never "$0". */
export function engravedCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return "—";
  const [whole, part] = (Math.abs(cents) / 100).toFixed(2).split(".");
  return `${cents < 0 ? "-" : ""}\$${whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${part}`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Signed exact dollars for a move: "−$12.40", "+$1,200.00"; unknown "—". */
export function signedCents(cents: number | null): string {
  if (cents === null || !Number.isFinite(cents)) return "—";
  const plain = engravedCents(Math.abs(cents));
  return cents < 0 ? `−${plain}` : cents > 0 ? `+${plain}` : plain;
}

export type FundBankPanelReading = {
  everyday: string;
  accepted: string;
  asOf: string | null;
  moves: { key: string; label: string; amount: string; date: string }[];
};
export function fundBankPanel(reading: Pick<HarbourReading, "everyday"> | null, extras: PanelExtras = {}): FundBankPanelReading {
  const fund = extras.fund;
  return {
    everyday: engravedCents(reading?.everyday ?? null),
    accepted: engravedCents(fund?.acceptedCents ?? null),
    asOf: fund?.asOf ? shortDate(fund.asOf) : null,
    moves: (fund?.moves ?? []).slice(0, 3).map((move) => ({ key: move.key, label: move.label, amount: signedCents(move.cents), date: shortDate(move.date) })),
  };
}

export type CellarPanelReading = { bills: { key: string; label: string; amount: string; due: string; recurrenceId: string | null }[]; total: number };
/** The next three bills not yet paid, soonest first. */
export function cellarPanel(reading: Pick<HarbourReading, "cellar"> | null, extras: PanelExtras = {}): CellarPanelReading {
  const today = extras.today ?? null;
  const fromReading: CellarPanelBill[] = (reading?.cellar?.jars ?? [])
    .filter((jar) => jar.state !== "paid" && jar.due !== null)
    .map((jar) => ({ key: jar.key, label: jar.label, cents: jar.amountCents, due: jar.due, recurrenceId: null }));
  // The integrator's bills are already the unpaid ones (an overdue bill is the one most worth "Mark paid");
  // only the reading's fallback jars drop past dates.
  const bills = [...(extras.bills ?? fromReading.filter((bill) => !today || !bill.due || bill.due >= today))]
    .sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999"));
  return {
    total: bills.length,
    bills: bills.slice(0, 3).map((bill) => ({ key: bill.key, label: bill.label, amount: engravedCents(bill.cents), due: bill.due ? shortDate(bill.due) : "no date", recurrenceId: bill.recurrenceId })),
  };
}

export type LoftPanelReading = { banks: { key: string; name: string; line: string; step: number }[]; more: number };
export function loftPanel(reading: Pick<HarbourReading, "tower"> | null): LoftPanelReading {
  const banks = (reading?.tower?.shelves ?? []).flatMap((shelf) => shelf.banks);
  return {
    banks: banks.slice(0, 4).map((bank) => ({ key: bank.key, name: bank.name, line: bank.targetCents > 0 ? `${engravedCents(bank.cents)} of ${engravedCents(bank.targetCents)}` : engravedCents(bank.cents), step: Math.max(0, Math.min(10, bank.step)) })),
    more: Math.max(0, banks.length - 4),
  };
}

export type KitchenPanelReading = { title: string; line: string; waiting: boolean };
export function kitchenPanel(reading: Pick<HarbourReading, "kitchen"> | null): KitchenPanelReading {
  const kitchen = reading?.kitchen;
  const cards = kitchen ? kitchen.cards.length + kitchen.overflow : 0;
  const month = kitchen?.monthKey ? shortMonth(kitchen.monthKey) : null;
  if (!kitchen || cards === 0) return { title: "This month's card", line: "No recipe card yet", waiting: false };
  const state = kitchen.state === "proposed" ? "proposed" : kitchen.state === "scheduled" ? "scheduled" : "agreed";
  return {
    title: month ? `${month}'s recipe card` : "This month's card",
    line: `${plural(cards, "line", "lines")} · ${state}${kitchen.waiting ? " · waiting for a second chair" : ""}`,
    waiting: kitchen.waiting,
  };
}

export type LibraryPanelReading = { month: string | null; rows: { label: "In" | "Out" | "Leftover"; amount: string }[]; freshness: string };
export function libraryPanel(reading: Pick<HarbourReading, "freshness"> | null, extras: PanelExtras = {}): LibraryPanelReading {
  const books = extras.books;
  const words: Record<string, string> = { current: "Books current", stale: "Books not fresh", offline: "Books offline" };
  return {
    month: books?.monthKey ? shortMonth(books.monthKey) : null,
    rows: [
      { label: "In", amount: engravedCents(books?.inCents ?? null) },
      { label: "Out", amount: engravedCents(books?.outCents ?? null) },
      { label: "Leftover", amount: engravedCents(books?.leftoverCents ?? null) },
    ],
    freshness: words[reading?.freshness ?? "current"] ?? "Books current",
  };
}

export type GlasshousePanelReading = { rows: { state: "To start" | "Under way" | "Done this week"; count: number }[]; late: number; mine: number };
/** Steps by state — the Glasshouse's plants are the art, never "pots" on screen. */
export function glasshousePanel(reading: Pick<HarbourReading, "glasshouse"> | null): GlasshousePanelReading {
  const glass = reading?.glasshouse;
  const standing = glass?.pots ?? [];
  const seed = standing.filter((pot) => pot.state === "seed").length;
  const sprout = standing.filter((pot) => pot.state === "sprout").length;
  const mine = glass ? glass.mine.seed + glass.mine.sprout : 0;
  return {
    rows: [
      { state: "To start", count: seed + (glass?.overflow ?? 0) },
      { state: "Under way", count: sprout },
      { state: "Done this week", count: glass?.harvested ?? 0 },
    ],
    late: glass?.dry ?? 0,
    mine,
  };
}

/** Days from `today` to the last day of `monthKey` (0 on the last day). */
export function daysToMonthEnd(monthKey: string, today: DateKey): number | null {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today);
  if (!match || !day) return null;
  const end = Date.UTC(Number(match[1]), Number(match[2]), 0);
  const now = Date.UTC(Number(day[1]), Number(day[2]) - 1, Number(day[3]));
  return Math.round((end - now) / 86_400_000);
}

export type CampfirePanelReading = { line: string; waitingFor: string[] };
/**
 * "Chapter closes in 5 days · 1 card needs you"; on the phone of the one who
 * has already sat, "… waiting for Bianca".
 */
export function campfirePanel(reading: Pick<HarbourReading, "campfire"> | null, extras: PanelExtras = {}): CampfirePanelReading {
  const ring = reading?.campfire;
  if (!ring || !ring.month) return { line: ring?.lit ? "No Chapter open" : "The fire is lit at your first Sitdown", waitingFor: [] };
  const days = extras.today ? daysToMonthEnd(ring.month, extras.today) : null;
  const closes = ring.close === "sealed" ? "Chapter sealed"
    : ring.overdue || (days !== null && days < 0) ? "Chapter ready to close"
      : days === null ? "Chapter open"
        : days === 0 ? "Chapter closes today"
          : `Chapter closes in ${plural(days, "day", "days")}`;
  const me = extras.memberId;
  const iSat = me ? ring.seats.some((seat) => seat.memberId === me && seat.seated) : false;
  const waitingFor = iSat ? ring.seats.filter((seat) => !seat.seated && seat.memberId !== me).map((seat) => seat.name) : [];
  const needs = extras.needsYou ?? 0;
  const tail = waitingFor.length > 0 ? ` · waiting for ${waitingFor.join(" and ")}` : needs > 0 ? ` · ${plural(needs, "card needs", "cards need")} you` : "";
  return { line: `${closes}${tail}`, waitingFor };
}

export type BoathousePanelReading = { line: string };
export function boathousePanel(reading: Pick<HarbourReading, "boathouse"> | null): BoathousePanelReading {
  const shore = reading?.boathouse;
  if (!shore) return { line: "—" };
  return { line: `${plural(shore.wishes, "wish", "wishes")} · ${plural(shore.memories, "memory", "memories")} · ${plural(shore.letters, "letter", "letters")}` };
}

export type AtlasPanelReading = { era: string; line: string };
export function atlasPanel(reading: Pick<HarbourReading, "atlas"> | null): AtlasPanelReading {
  const map = reading?.atlas;
  if (!map || !map.era) return { era: "No era yet", line: "Agree an era together to begin the Journey map" };
  return {
    era: map.era.name,
    line: `${map.eras > 1 ? `Era ${map.era.index} of ${map.eras}` : "The first era"} · ${plural(map.era.months, "month", "months")} walked${map.gate ? ` · ${map.gate.words}` : ""}`,
  };
}

export type CottagePanelReading = { line: string };
export function cottagePanel(reading: Pick<HarbourReading, "cottage"> | null): CottagePanelReading {
  const his = reading?.cottage;
  if (!his) return { line: "—" };
  return { line: `${plural(his.looks, "look", "looks")} · ${plural(his.keepsakes, "keepsake", "keepsakes")}` };
}

/** The panel's heading, in the brief's words. */
export const PANEL_TITLES: Readonly<Record<PanelHost, string>> = Object.freeze({
  bank: "The Fund bank",
  cellar: "The Cellar",
  tower: "The Loft",
  kitchen: "The Kitchen",
  library: "The Library",
  glasshouse: "The Glasshouse",
  campfire: "The Campfire",
  boathouse: "The Boathouse",
  atlas: "The Atlas",
  cottage: "Hercules's Cottage",
  hercules: "Hercules",
});
