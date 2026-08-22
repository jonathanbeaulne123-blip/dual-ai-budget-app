import { formatCad } from "./money.ts";
import { detectHabits, type Habit } from "./rhythm.ts";
import {
  agedReceivables,
  appointmentPublicTitle,
  visitDriftSentence,
} from "./appointments.ts";
import type { DateKey } from "./calendar.ts";
import type { Household } from "./types.ts";

/**
 * On-device science Hercules can act on. Named Notice, not Finding —
 * `health.ts` already owns Finding (D-057).
 */
export type HerculesNoticeKind = "habit-preset" | "claim-aging" | "visit-drift" | "amount-anomaly";
export type HerculesNoticeAction = "acceptPreset" | "none";

export type HerculesNotice = {
  key: string;
  kind: HerculesNoticeKind;
  rank: number;
  spoken: string;
  lesson: string;
  cad: string | null;
  amountCents: number | null;
  action: HerculesNoticeAction;
  habitKey?: string;
};

function dismissed(household: Household): Set<string> {
  return new Set(household.calendar?.dismissedNoticeKeys ?? []);
}

function habitNotice(habit: Habit): HerculesNotice {
  const cad = formatCad(habit.amountCents);
  return {
    key: habit.key,
    kind: "habit-preset",
    rank: 80 + Math.min(18, habit.count) + Math.round(habit.confidence * 10),
    spoken: `${cad} · ${habit.note} ${habit.count} times. Save it as a preset? One tap on Add after that.`,
    lesson: "I noticed. You save. Confirm still posts. I never write the coffee.",
    cad,
    amountCents: habit.amountCents,
    action: "acceptPreset",
    habitKey: habit.key,
  };
}

export function composeNotices(household: Household, today: DateKey): HerculesNotice[] {
  const hidden = dismissed(household);
  const notices: HerculesNotice[] = [];

  for (const habit of detectHabits(household, today)) {
    const notice = habitNotice(habit);
    if (hidden.has(notice.key)) continue;
    notices.push(notice);
  }

  for (const row of agedReceivables(household, today)) {
    if (row.daysOutstanding < 30) continue;
    const key = `claim:${row.claim.id}`;
    if (hidden.has(key)) continue;
    const cad = formatCad(row.remainingCents);
    notices.push({
      key,
      kind: "claim-aging",
      rank: row.daysOutstanding >= 45 ? 62 + Math.min(20, row.daysOutstanding - 45) : 48,
      spoken: `${cad} still outstanding · ${row.daysOutstanding}d. Settlement is a transfer, never income.`,
      lesson: "The Office tray already holds this. I won't nag twice.",
      cad,
      amountCents: row.remainingCents,
      action: "none",
    });
  }

  for (const appointment of household.appointments ?? []) {
    if (!appointment.active) continue;
    const drift = visitDriftSentence(household, appointment);
    if (!drift) continue;
    const key = `drift:${appointment.id}`;
    if (hidden.has(key)) continue;
    notices.push({
      key,
      kind: "visit-drift",
      rank: 38,
      spoken: drift.replace(appointment.title, appointmentPublicTitle(appointment, "hercules")),
      lesson: "I count posted visits. You still confirm the next one.",
      cad: appointment.typicalCostCents ? formatCad(appointment.typicalCostCents) : null,
      amountCents: appointment.typicalCostCents || null,
      action: "none",
    });
  }

  return notices.sort((left, right) => right.rank - left.rank || left.key.localeCompare(right.key));
}

/** Unsolicited card. Only a habit-preset earns a shoulder-tap (D-057). Inert during Add. */
export function bubbleNotice(household: Household, today: DateKey): HerculesNotice | null {
  return composeNotices(household, today).find((item) => item.kind === "habit-preset" && item.action === "acceptPreset") ?? null;
}

export function deskNotices(household: Household, today: DateKey): HerculesNotice[] {
  const bubble = bubbleNotice(household, today);
  return composeNotices(household, today).filter((item) => item.key !== bubble?.key);
}
