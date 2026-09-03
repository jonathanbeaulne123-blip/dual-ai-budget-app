/**
 * Shared desk plates — the legacy six or the Fund ten — plus six Personal.
 *
 * Presentation only. Every figure is one of the six primitives in plates.ts.
 * Kickers are household questions. Glance is the closed-strip line. Verdicts
 * stay sentences for tests and spoken labels. Footings keep the scope honest.
 * Nothing here posts, settles, or moves a cent.
 */

import { addDays, calendarDaysBetween, formatDateLabel, monthKeyFromDateKey, monthStartKey, weekdaySunday0, type DateKey } from "./calendar.ts";
import { formatCad } from "./money.ts";
import { creditCardView, householdWallet, isCreditKind } from "./accounts.ts";
import { appointmentPublicTitle, claimPublicLabel, claimRemainingCents, outstandingClaims } from "./appointments.ts";
import { projectedExpenseEffect, projectedIncomeEffect } from "./budget.ts";
import { openGoals } from "./goalVault.ts";
import { runHealthCheck, type Finding } from "./health.ts";
import type { Dashboard } from "./insights.ts";
import type { InstrumentId } from "./officeLayout.ts";
import { activeOpenShift } from "./shiftClock.ts";
import type { ShiftStreak } from "./shiftStreak.ts";
import type { Goal, Household } from "./types.ts";
import { goalVisibleInView } from "./visibility.ts";
import { workOwedFacts } from "./workSettlement.ts";
import type { PlatePrimitive } from "./plates.ts";
import { fundPlates } from "./fundPlates.ts";

export const SHARED_PLATE_IDS = ["fund-level", "waiting", "next-out", "spoken-for", "settle", "accounts", "week", "saving", "shape", "streams"] as const;
/** The plates the Fund library retired, and what answers each question now. */
export const LEGACY_SHARED_PLATE_IDS = ["due", "cards", "owed", "coming", "trust"] as const;
export const PERSONAL_PLATE_IDS = ["clock", "tips", "pay", "wallet", "mine-saving", "month"] as const;
export const FORBIDDEN_SHARED_PLATE_IDS = ["now", "attention", "change"] as const;

export type SharedPlateId = (typeof SHARED_PLATE_IDS)[number] | (typeof LEGACY_SHARED_PLATE_IDS)[number];
export type PersonalPlateId = (typeof PERSONAL_PLATE_IDS)[number];
export type DeskPlateId = SharedPlateId | PersonalPlateId;
export type PlateEdge = "clear" | "attention" | "live" | "quiet";

export type TrackMark = { day: number; cents: number; label: string };
export type FillWell = { savedCents: number; targetCents: number; name: string };

export type PlateFigure =
  | { primitive: "track"; days: number; marks: TrackMark[]; room: number }
  | { primitive: "pair"; upCents: number; downCents: number; upLabel: string; downLabel: string; room: number }
  | { primitive: "fill"; wells: FillWell[] }
  | { primitive: "spark"; points: number[]; room: number; actualCount?: number }
  | { primitive: "tally"; count: number }
  | { primitive: "gauge"; pct: number; threshold: number; label: string };

export type DeskPlateModel = {
  id: DeskPlateId;
  kicker: string;
  /** Short closed-strip line. Never a paragraph. */
  glance: string;
  verdict: string;
  footing: string;
  edge: PlateEdge;
  copperVerdict: boolean;
  figure: PlateFigure;
  empty: string | null;
  cabinet: InstrumentId;
  cabinetName: string;
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const CARD_GAUGE_THRESHOLD = 0.30;
const TRACK_ROOM = 28;
const PAIR_ROOM = 36;
const SPARK_ROOM = 28;

function sentenceAmount(cents: number): string {
  return formatCad(Math.abs(cents));
}

/** Dates inside the week are weekdays. Past that, the civil label. */
export function plateWhen(date: DateKey, today: DateKey): string {
  if (date === today) return "today";
  if (date === addDays(today, 1)) return "tomorrow";
  const horizon = addDays(today, 6);
  if (date > today && date <= horizon) return WEEKDAYS[weekdaySunday0(date)] ?? formatDateLabel(date);
  return formatDateLabel(date);
}

function inWindow(date: DateKey, today: DateKey, days: number): boolean {
  return date >= today && date <= addDays(today, days);
}

function sharedGoals(household: Pick<Household, "goals">): Goal[] {
  return openGoals(household).filter((goal) => goal.shared);
}

function personalGoals(household: Pick<Household, "goals">, memberId: string): Goal[] {
  return openGoals(household).filter((goal) => !goal.shared && goalVisibleInView(goal, memberId, "personal"));
}

function fillWells(goals: Goal[], limit: number): FillWell[] {
  return goals.slice(0, limit).map((goal) => ({
    savedCents: Math.max(0, goal.savedCents),
    targetCents: Math.max(0, goal.targetCents),
    name: goal.name,
  }));
}

function monthRunningNet(household: Household, today: DateKey): number[] {
  const monthKey = monthKeyFromDateKey(today);
  const start = monthStartKey(monthKey);
  const lastDay = Number(today.slice(8, 10)) || 1;
  const inMonth = household.transactions.filter((tx) => tx.date >= start && tx.date <= today);
  const transactionById = new Map(household.transactions.map((tx) => [tx.id, tx]));
  const points: number[] = [];
  let running = 0;
  for (let day = 1; day <= lastDay; day += 1) {
    const date = `${monthKey}-${String(day).padStart(2, "0")}` as DateKey;
    for (const tx of inMonth) {
      if (tx.date !== date) continue;
      running += projectedIncomeEffect(tx, transactionById) - projectedExpenseEffect(tx, transactionById);
    }
    points.push(running);
  }
  return points;
}

export function sharedPlates(input: {
  household: Household;
  dashboard: Dashboard;
  today: DateKey;
  findings?: Finding[];
}): DeskPlateModel[] {
  const { household, dashboard, today } = input;
  const findings = input.findings ?? runHealthCheck(household);
  // A household with a Fund gets the Fund library. Without one there is no walk
  // to draw, so the original board stands until the Fund is configured.
  const fund = fundPlates({ household, today, findings });
  if (fund.length) return fund;
  const dueItems = dashboard.upcoming.filter((item) => item.direction === "out" && inWindow(item.date, today, 29));
  const nextDue = dueItems[0] ?? null;
  const cards = household.accounts.filter((account) => (
    account.active && isCreditKind(account.kind) && account.scope !== "personal"
  ));
  const cardViews = cards.map((account) => creditCardView(household, account, today));
  const hottest = [...cardViews].sort((left, right) => (right.utilization ?? 0) - (left.utilization ?? 0))[0] ?? null;
  const claims = outstandingClaims(household);
  const claimCount = claims.length;
  const claimTotal = claims.reduce((sum, claim) => sum + claimRemainingCents(claim), 0);
  const banks = sharedGoals(household).slice(0, 3);
  const visits = (household.appointments ?? []).filter((row) => row.active && inWindow(row.nextDate, today, 89));
  const nextVisit = [...visits].sort((left, right) => left.nextDate.localeCompare(right.nextDate))[0] ?? null;
  const findingCount = findings.length;

  const dueFigure: PlateFigure = {
    primitive: "track",
    days: 30,
    room: TRACK_ROOM,
    marks: dueItems.map((item) => ({
      day: Math.min(30, Math.max(1, calendarDaysBetween(today, item.date) + 1)),
      cents: Math.max(0, item.amountCents),
      label: item.title,
    })),
  };
  const cardsPct = hottest?.utilization ?? 0;
  const owedCountable = claimCount >= 1 && claimCount <= 31;
  const trustCountable = findingCount >= 1 && findingCount <= 31;

  return [
    {
      id: "due",
      kicker: "What is due next",
      glance: nextDue
        ? `${nextDue.title} · ${plateWhen(nextDue.date, today)}`
        : "Nothing due in 30 days",
      verdict: nextDue
        ? `${nextDue.title}, ${plateWhen(nextDue.date, today)}.`
        : "Nothing is due in the next 30 days.",
      footing: nextDue
        ? `${sentenceAmount(nextDue.amountCents)} leaving the house · next 30 days`
        : "Bills and outgoing dates on the 30-day rail. Nothing posted from here.",
      edge: nextDue && (nextDue.due || nextDue.date <= addDays(today, 2)) ? "attention" : nextDue ? "live" : "quiet",
      copperVerdict: Boolean(nextDue && (nextDue.due || nextDue.date <= addDays(today, 2))),
      figure: dueFigure,
      empty: nextDue ? null : "Nothing is due in the next 30 days.",
      cabinet: "mail",
      cabinetName: "next bill",
    },
    {
      id: "cards",
      kicker: "What the cards are doing",
      glance: hottest
        ? `${hottest.account.name} · ${Math.round(cardsPct * 100)}% used`
        : "No cards yet",
      verdict: hottest
        ? `${hottest.account.name} is at ${Math.round(cardsPct * 100)}% of its limit.`
        : "No cards are carrying a balance.",
      footing: hottest
        ? `Threshold drawn at 30%. Owed ${sentenceAmount(hottest.owedCents)} · due ${plateWhen(hottest.dueDate, today)}`
        : "Utilization against the 30% mark. Paydown is a transfer.",
      edge: hottest && cardsPct > CARD_GAUGE_THRESHOLD ? "attention" : hottest ? "clear" : "quiet",
      copperVerdict: Boolean(hottest && cardsPct > CARD_GAUGE_THRESHOLD),
      figure: {
        primitive: "gauge",
        pct: cardsPct,
        threshold: CARD_GAUGE_THRESHOLD,
        label: hottest?.account.name ?? "Cards",
      },
      empty: hottest ? null : "No cards are carrying a balance.",
      cabinet: "wallet",
      cabinetName: "wallet",
    },
    {
      id: "owed",
      kicker: "Who owes us",
      glance: claimCount === 0
        ? "Nobody owes us"
        : claimCount === 1
          ? `${claimPublicLabel(household, claims[0]!, "card")} · ${sentenceAmount(claimTotal)}`
          : `${claimCount} claims · ${sentenceAmount(claimTotal)}`,
      verdict: claimCount === 0
        ? "Nobody owes the house right now."
        : claimCount === 1
          ? `${claimPublicLabel(household, claims[0]!, "card")} still owes ${sentenceAmount(claimTotal)}.`
          : owedCountable
            ? `${claimCount} claims still owe the house ${sentenceAmount(claimTotal)}.`
            : `The house is still owed ${sentenceAmount(claimTotal)} across open claims.`,
      footing: "Outstanding claims only. Remaining cents, not the original bill.",
      edge: claimCount > 0 ? "attention" : "clear",
      copperVerdict: claimCount > 0,
      figure: { primitive: "tally", count: owedCountable ? claimCount : 0 },
      empty: claimCount === 0 ? "Nobody owes the house right now." : null,
      cabinet: "claims",
      cabinetName: "claims",
    },
    {
      id: "saving",
      kicker: "What we are saving toward",
      glance: banks.length === 0
        ? "No shared banks yet"
        : banks.length === 1
          ? banks[0]!.name
          : `${banks.length} shared banks`,
      verdict: banks.length === 0
        ? "No shared banks are open yet."
        : banks.length === 1
          ? `${banks[0]!.name} is the open shared bank.`
          : `The house is saving toward ${banks.length} shared banks.`,
      footing: "Existing shared goals. Arrival dates sit in the wells. Surplus is a claim, not a second envelope.",
      edge: banks.length ? "clear" : "quiet",
      copperVerdict: false,
      figure: { primitive: "fill", wells: fillWells(banks, 3) },
      empty: banks.length === 0 ? "No shared banks are open yet." : null,
      cabinet: "jars",
      cabinetName: "goals",
    },
    {
      id: "coming",
      kicker: "What is coming to the house",
      glance: nextVisit
        ? `${appointmentPublicTitle(nextVisit, "card")} · ${plateWhen(nextVisit.nextDate, today)}`
        : "No visits in 90 days",
      verdict: nextVisit
        ? `${appointmentPublicTitle(nextVisit, "card")}, ${plateWhen(nextVisit.nextDate, today)}.`
        : "No visits are on the 90-day rail.",
      footing: nextVisit
        ? `Typical cost ${sentenceAmount(nextVisit.typicalCostCents)} · next 90 days, not posted`
        : "Appointments on the 90-day rail. Typical cost is a mark, not a post.",
      edge: nextVisit && nextVisit.nextDate <= addDays(today, 7) ? "live" : nextVisit ? "clear" : "quiet",
      copperVerdict: Boolean(nextVisit && nextVisit.nextDate <= today),
      figure: {
        primitive: "track",
        days: 90,
        room: TRACK_ROOM,
        marks: visits.map((visit) => ({
          day: Math.min(90, Math.max(1, calendarDaysBetween(today, visit.nextDate) + 1)),
          cents: Math.max(0, visit.typicalCostCents),
          label: appointmentPublicTitle(visit, "card"),
        })),
      },
      empty: nextVisit ? null : "No visits are on the 90-day rail.",
      cabinet: "appointments",
      cabinetName: "appointments",
    },
    {
      id: "trust",
      kicker: "Whether to trust this",
      glance: findingCount === 0
        ? "Books look clean"
        : trustCountable
          ? `${findingCount} need a look`
          : "Too many findings to tick",
      verdict: findingCount === 0
        ? "The books have no open findings."
        : trustCountable
          ? `${findingCount} finding${findingCount === 1 ? "" : "s"} need a look.`
          : "The health check has more findings than a month of ticks can show.",
      footing: "Health findings on this floor. Open the lamp to read them.",
      edge: findingCount > 0 ? "attention" : "clear",
      copperVerdict: findingCount > 0,
      figure: { primitive: "tally", count: trustCountable ? findingCount : 0 },
      empty: findingCount === 0 ? "The books have no open findings." : null,
      cabinet: "lamp",
      cabinetName: "health",
    },
  ];
}

export function personalPlates(input: {
  household: Household;
  dashboard: Dashboard;
  today: DateKey;
  memberId: string;
  streak: ShiftStreak;
}): DeskPlateModel[] {
  const { household, dashboard, today, memberId, streak } = input;
  const punch = activeOpenShift(household.kitchen, memberId);
  const streakCount = streak.count;
  const clockCountable = streakCount >= 1 && streakCount <= 31;
  const tipPoints = dashboard.tipWeather.byWeekday.map((row) => row.tipsCents);
  const tipPeak = Math.max(0, ...tipPoints);
  const owed = workOwedFacts(household, today, memberId).filter((fact) => inWindow(fact.date, today, 13));
  const nextPay = owed[0] ?? null;
  const wallet = householdWallet(household, today);
  const mine = personalGoals(household, memberId).slice(0, 1);
  const running = monthRunningNet(household, today);
  const latestNet = running[running.length - 1] ?? 0;

  return [
    {
      id: "clock",
      kicker: "Am I on the clock",
      glance: punch
        ? "On the clock"
        : streak.waiting
          ? "Shift waiting to post"
          : clockCountable
            ? `${streakCount}-day streak`
            : "Not on the clock",
      verdict: punch
        ? "You are on the clock right now."
        : streak.waiting
          ? "A shift is waiting to be posted."
          : clockCountable
            ? `The posting streak is ${streakCount} day${streakCount === 1 ? "" : "s"} long.`
            : "You are not on the clock.",
      footing: "Open shift and posting streak over 14 days. The pad still posts the shift.",
      edge: punch ? "live" : streak.waiting ? "attention" : clockCountable ? "clear" : "quiet",
      copperVerdict: Boolean(punch || streak.waiting),
      figure: { primitive: "tally", count: punch ? 1 : clockCountable ? streakCount : 0 },
      empty: punch || clockCountable || streak.waiting ? null : "You are not on the clock.",
      cabinet: "timesheet",
      cabinetName: "shifts",
    },
    {
      id: "tips",
      kicker: "What a shift is worth",
      glance: tipPeak > 0
        ? `${sentenceAmount(dashboard.tipWeather.fourWeekTipsCents)} over 4 weeks`
        : "No tips yet",
      verdict: tipPeak > 0
        ? `Four-week tips run ${sentenceAmount(dashboard.tipWeather.fourWeekTipsCents)} across the week.`
        : "No tips are on the four-week spark yet.",
      footing: "Tip weather by weekday. A spark, not a forecast you can post.",
      edge: tipPeak > 0 ? "clear" : "quiet",
      copperVerdict: false,
      figure: { primitive: "spark", points: tipPoints, room: SPARK_ROOM },
      empty: tipPeak > 0 ? null : "No tips are on the four-week spark yet.",
      cabinet: "timesheet",
      cabinetName: "shifts",
    },
    {
      id: "pay",
      kicker: "When money lands next",
      glance: nextPay
        ? `${nextPay.title.replace(" · confirm paycheck", "").replace(" · confirm tip envelope", "")} · ${plateWhen(nextPay.date, today)}`
        : "No pay in 14 days",
      verdict: nextPay
        ? `${nextPay.title.replace(" · confirm paycheck", "").replace(" · confirm tip envelope", "")} lands ${plateWhen(nextPay.date, today)}.`
        : "No work pay is on the 14-day rail.",
      footing: nextPay
        ? `${sentenceAmount(nextPay.amountCents)} owed · confirm it on Shifts when it lands`
        : "Work owed facts on the 14-day rail. Confirm still posts.",
      edge: nextPay?.due ? "attention" : nextPay ? "live" : "quiet",
      copperVerdict: Boolean(nextPay?.due),
      figure: {
        primitive: "track",
        days: 14,
        room: TRACK_ROOM,
        marks: owed.map((fact) => ({
          day: Math.min(14, Math.max(1, calendarDaysBetween(today, fact.date) + 1)),
          cents: Math.max(0, fact.amountCents),
          label: fact.title,
        })),
      },
      empty: nextPay ? null : "No work pay is on the 14-day rail.",
      cabinet: "timesheet",
      cabinetName: "shifts",
    },
    {
      id: "wallet",
      kicker: "My cash against my cards",
      glance: wallet.tiles.length === 0
        ? "No wallet rooms yet"
        : `Cash ${sentenceAmount(wallet.cashCents)} · cards ${sentenceAmount(wallet.owedCents)}`,
      verdict: wallet.tiles.length === 0
        ? "This folio has no wallet rooms yet."
        : `Cash ${sentenceAmount(wallet.cashCents)} against cards ${sentenceAmount(wallet.owedCents)}.`,
      footing: "One scale for both sides. Cash above, cards below.",
      edge: wallet.owedCents > wallet.cashCents && wallet.owedCents > 0 ? "attention" : wallet.tiles.length ? "clear" : "quiet",
      copperVerdict: wallet.owedCents > wallet.cashCents && wallet.owedCents > 0,
      figure: {
        primitive: "pair",
        upCents: Math.max(0, wallet.cashCents),
        downCents: Math.max(0, wallet.owedCents),
        upLabel: "Cash",
        downLabel: "Cards",
        room: PAIR_ROOM,
      },
      empty: wallet.tiles.length === 0 ? "This folio has no wallet rooms yet." : null,
      cabinet: "wallet",
      cabinetName: "wallet",
    },
    {
      id: "mine-saving",
      kicker: "What I am saving toward",
      glance: mine.length === 0
        ? "No personal bank yet"
        : mine[0]!.name,
      verdict: mine.length === 0
        ? "You have no personal bank open yet."
        : `${mine[0]!.name} is the open personal bank.`,
      footing: "Personal goals on this folio. Not the shared Kitty.",
      edge: mine.length ? "clear" : "quiet",
      copperVerdict: false,
      figure: { primitive: "fill", wells: fillWells(mine, 1) },
      empty: mine.length === 0 ? "You have no personal bank open yet." : null,
      cabinet: "jars",
      cabinetName: "goals",
    },
    {
      id: "month",
      kicker: "How my month is running",
      glance: running.every((point) => point === 0)
        ? "No running net yet"
        : latestNet >= 0
          ? `Running ${sentenceAmount(latestNet)} in`
          : `Running ${sentenceAmount(latestNet)} out`,
      verdict: running.every((point) => point === 0)
        ? "This month has no posted running net yet."
        : latestNet >= 0
          ? `This month is running ${sentenceAmount(latestNet)} in.`
          : `This month is running ${sentenceAmount(latestNet)} out.`,
      footing: `${dashboard.monthLabel}. Posted in minus posted expenses through today. Leftover spend on the seals is the same arithmetic.`,
      edge: latestNet < 0 ? "attention" : running.some((point) => point !== 0) ? "clear" : "quiet",
      copperVerdict: latestNet < 0,
      figure: { primitive: "spark", points: running, room: SPARK_ROOM },
      empty: running.every((point) => point === 0) ? "This month has no posted running net yet." : null,
      cabinet: "blotter",
      cabinetName: "month net",
    },
  ];
}

export function platePrimitive(plate: DeskPlateModel): PlatePrimitive {
  return plate.figure.primitive;
}

export function isForbiddenSharedPlateId(id: string): boolean {
  return (FORBIDDEN_SHARED_PLATE_IDS as readonly string[]).includes(id);
}
