import {
  addDays,
  daysInMonthKey,
  formatDayLabel,
  formatMonthLabel,
  inInclusiveRange,
  monthEndKey,
  monthStartKey,
  weekdaySunday0,
  weekBounds,
  type DateKey,
  type MonthKey,
} from "./calendar.ts";
import { projectCadence } from "./recurrence.ts";
import { appointmentPublicTitle, claimExpectedLandingDate, claimRemainingCents, outstandingClaims, projectAppointmentDates } from "./appointments.ts";
import { detectRhythms, type Rhythm } from "./rhythm.ts";
import { workOwedFactsInRange, type WorkOwedFact } from "./workSettlement.ts";
import { workShiftIsReversed } from "./work.ts";
import type { Household, Recurrence, RecurrenceKind } from "./types.ts";

export type BoardKind = RecurrenceKind | "shift" | "google" | "detected" | "visit" | "claim" | "work-pay" | "work-tip" | "work-tipout";

export type OverlayEvent = {
  id: string;
  date: DateKey;
  title: string;
  memberId: string;
  memberColor: string;
  hearthOwned: boolean;
};

export type BoardItem = {
  id: string;
  date: DateKey;
  title: string;
  amountCents: number;
  direction: "in" | "out" | "work" | "busy";
  kind: BoardKind;
  source: "recurrence" | "rhythm" | "shift" | "google" | "appointment" | "claim" | "work-settlement";
  recurrenceId?: string;
  appointmentId?: string;
  rhythmKey?: string;
  memberId?: string;
  memberColor?: string;
  workJobId?: string;
  workSettlementKind?: WorkOwedFact["kind"];
  due: boolean;
};

export type BoardDay = {
  date: DateKey;
  inMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  items: BoardItem[];
  outCents: number;
  inCents: number;
  heat: number;
};

export type PayWeek = {
  start: DateKey;
  end: DateKey;
  inCents: number;
  outCents: number;
  clash: boolean;
  current: boolean;
};

export type MonthBoard = {
  monthKey: MonthKey;
  monthLabel: string;
  weeks: BoardDay[][];
  days: BoardDay[];
  upcoming: BoardItem[];
  clashes: PayWeek[];
  payWeeks: PayWeek[];
  dueCount: number;
  weekPressure: PayWeek | null;
  rhythms: Rhythm[];
};

function categoryName(household: Household, subcategoryId: string): string {
  return household.categories.find((item) => item.id === subcategoryId)?.name ?? "Item";
}

function recurrenceTitle(household: Household, item: Recurrence): string {
  return item.note.trim() || categoryName(household, item.subcategoryId);
}

export function upcomingFromHousehold(household: Household, today: DateKey, horizonDays = 21): BoardItem[] {
  return buildMonthBoard(household, today.slice(0, 7), today).upcoming.filter((item) => {
    const last = addDays(today, horizonDays);
    return item.date >= today && item.date <= last;
  });
}

/** Bills and subscriptions leaving the house. Never paychecks, never Bianca pay, never visits. */
export function isOutgoingBill(item: Pick<BoardItem, "kind" | "direction">): boolean {
  if (item.direction !== "out") return false;
  return item.kind === "bill" || item.kind === "subscription" || item.kind === "detected" || item.kind === "other";
}

export function buildMonthBoard(
  household: Household,
  monthKey: MonthKey,
  today: DateKey,
  overlays: OverlayEvent[] = [],
): MonthBoard {
  const start = monthStartKey(monthKey);
  const end = monthEndKey(monthKey);
  const pad = weekdaySunday0(start);
  const gridStart = addDays(start, -pad);
  const cellCount = Math.ceil((pad + daysInMonthKey(monthKey)) / 7) * 7;
  const gridEnd = addDays(gridStart, cellCount - 1);
  const rhythms = detectRhythms(household, today);
  const items: BoardItem[] = [];

  for (const item of household.recurrences.filter((row) => row.active)) {
    const dates = projectCadence(item.nextDate, item.cadence, gridStart, gridEnd);
    for (const date of dates) {
      items.push({
        id: `${item.id}:${date}`,
        date,
        title: recurrenceTitle(household, item),
        amountCents: item.amountCents,
        direction: item.type === "income" ? "in" : "out",
        kind: item.kind,
        source: "recurrence",
        recurrenceId: item.id,
        due: date <= today,
      });
    }
  }

  for (const rhythm of rhythms.filter((item) => item.status === "suggested")) {
    const dates = projectCadence(rhythm.nextDate, rhythm.cadence, gridStart, gridEnd);
    if (!dates.includes(rhythm.nextDate) && inInclusiveRange(rhythm.nextDate, gridStart, gridEnd)) {
      dates.push(rhythm.nextDate);
    }
    for (const date of dates) {
      const id = `${rhythm.key}:${date}`;
      if (items.some((item) => item.date === date && item.recurrenceId && item.title.toLowerCase() === rhythm.note.toLowerCase())) {
        continue;
      }
      items.push({
        id,
        date,
        title: rhythm.note,
        amountCents: rhythm.amountCents,
        direction: rhythm.type === "income" ? "in" : "out",
        kind: "detected",
        source: "rhythm",
        rhythmKey: rhythm.key,
        due: date <= today,
      });
    }
  }

  for (const shift of household.shifts.filter((row) => !workShiftIsReversed(household, row))) {
    if (!inInclusiveRange(shift.date, gridStart, gridEnd)) continue;
    const member = household.members.find((item) => item.id === shift.memberId);
    const job = (household.workJobs ?? []).find((item) => item.id === shift.jobId);
    items.push({
      id: `shift:${shift.id}`,
      date: shift.date,
      title: job
        ? `${job.name} · ${shift.hours.toFixed(2)}h · wages $${(shift.wagesCents / 100).toFixed(2)} · tips $${(shift.netTipsCents / 100).toFixed(2)}`
        : `${member?.name ?? "Shift"} · ${shift.hours}h`,
      amountCents: shift.wagesCents + shift.netTipsCents,
      direction: "work",
      kind: "shift",
      source: "shift",
      memberId: shift.memberId,
      memberColor: job?.color ?? member?.color,
      due: false,
    });
  }

  for (const fact of workOwedFactsInRange(household, today, gridStart, gridEnd)) {
    const member = household.members.find((item) => item.id === fact.memberId);
    items.push({
      id: fact.id,
      date: fact.date,
      title: fact.title,
      amountCents: fact.amountCents,
      direction: fact.kind === "deferred-tipout" ? "out" : "in",
      kind: fact.kind === "wages" ? "work-pay" : fact.kind === "card-tips" ? "work-tip" : "work-tipout",
      source: "work-settlement",
      memberId: fact.memberId,
      memberColor: fact.color || member?.color,
      workJobId: fact.jobId,
      workSettlementKind: fact.kind,
      due: fact.due,
    });
  }

  for (const overlay of overlays) {
    if (!inInclusiveRange(overlay.date, gridStart, gridEnd)) continue;
    items.push({
      id: `google:${overlay.memberId}:${overlay.id}`,
      date: overlay.date,
      title: overlay.title,
      amountCents: 0,
      direction: "busy",
      kind: "google",
      source: "google",
      memberId: overlay.memberId,
      memberColor: overlay.memberColor,
      due: false,
    });
  }

  for (const claim of outstandingClaims(household)) {
    const date = claimExpectedLandingDate(claim);
    if (!date || !inInclusiveRange(date, gridStart, gridEnd)) continue;
    items.push({
      id: `claim:${claim.id}:${date}`,
      date,
      title: `Owed · ${claim.label}`,
      amountCents: claimRemainingCents(claim),
      direction: "in",
      kind: "claim",
      source: "claim",
      due: date <= today,
    });
  }

  for (const appointment of (household.appointments ?? []).filter((row) => row.active)) {
    const netCents = Math.max(0, appointment.typicalCostCents - appointment.typicalRecoveryCents);
    const dates = projectAppointmentDates(appointment.nextDate, appointment.cadence, gridStart, gridEnd);
    if (appointment.nextDate < today && inInclusiveRange(today, gridStart, gridEnd) && !dates.includes(today)) {
      dates.push(today);
    }
    for (const date of dates) {
      items.push({
        id: `${appointment.id}:${date}`,
        date,
        title: appointmentPublicTitle(appointment, "card"),
        amountCents: netCents || appointment.typicalCostCents,
        direction: "out",
        kind: "visit",
        source: "appointment",
        appointmentId: appointment.id,
        due: date <= today,
      });
    }
  }

  const byDate = new Map<DateKey, BoardItem[]>();
  for (const item of items) {
    const list = byDate.get(item.date) ?? [];
    list.push(item);
    byDate.set(item.date, list);
  }

  const days: BoardDay[] = [];
  for (let i = 0; i < cellCount; i += 1) {
    const date = addDays(gridStart, i);
    const dayItems = (byDate.get(date) ?? []).sort((left, right) => {
      const order = { out: 0, in: 1, work: 2, busy: 3 };
      return order[left.direction] - order[right.direction] || left.title.localeCompare(right.title);
    });
    const weekday = weekdaySunday0(date);
    days.push({
      date,
      inMonth: date >= start && date <= end,
      isToday: date === today,
      isWeekend: weekday === 0 || weekday === 6,
      items: dayItems,
      outCents: dayItems.filter((item) => item.direction === "out").reduce((sum, item) => sum + item.amountCents, 0),
      inCents: dayItems.filter((item) => item.direction === "in").reduce((sum, item) => sum + item.amountCents, 0),
      heat: 0,
    });
  }

  const maxOut = Math.max(1, ...days.filter((day) => day.inMonth).map((day) => day.outCents));
  for (const day of days) day.heat = day.outCents / maxOut;

  const weeks: BoardDay[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const payWeeks: PayWeek[] = weeks.map((week) => {
    const inMonthDays = week.filter((day) => day.inMonth);
    const inCents = week.reduce((sum, day) => sum + day.inCents, 0);
    const outCents = week.reduce((sum, day) => sum + day.outCents, 0);
    const startDay = week[0]!.date;
    const endDay = week[6]!.date;
    const currentWeek = weekBounds(today);
    return {
      start: startDay,
      end: endDay,
      inCents,
      outCents,
      clash: inMonthDays.length > 0 && outCents >= 40000 && outCents > inCents && (inCents === 0 || outCents > inCents * 1.5),
      current: startDay === currentWeek.start,
    };
  });

  const horizon = addDays(today, 21);
  const upcoming = items
    .filter((item) => item.direction === "in" || item.direction === "out")
    .filter((item) => item.date >= today && item.date <= horizon)
    .sort((left, right) => left.date.localeCompare(right.date) || left.title.localeCompare(right.title))
    .slice(0, 10);

  return {
    monthKey,
    monthLabel: formatMonthLabel(monthKey),
    weeks,
    days,
    upcoming,
    clashes: payWeeks.filter((week) => week.clash),
    payWeeks,
    dueCount: household.recurrences.filter((item) => item.active && item.nextDate <= today).length
      + (household.appointments ?? []).filter((item) => item.active && item.nextDate <= today).length,
    weekPressure: payWeeks.find((week) => week.current) ?? null,
    rhythms,
  };
}

export function describeClash(week: PayWeek): string {
  if (week.inCents === 0) {
    return `${formatDayLabel(week.start)}–${formatDayLabel(week.end)} has outgoing bills and no paycheck on the board.`;
  }
  return `${formatDayLabel(week.start)}–${formatDayLabel(week.end)} bills are heavier than pay landing that week.`;
}
