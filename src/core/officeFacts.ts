import { formatCad } from "./money.ts";
import type { Dashboard } from "./insights.ts";
import type { AuditOpinion } from "./statements.ts";
import type { Finding } from "./health.ts";
import type { CookOffScore, SitDownPostcard } from "./hercules.ts";
import type { ShiftStreak } from "./shiftStreak.ts";
import type { HouseholdWallet } from "./accounts.ts";
import { monthKeyFromDateKey, type DateKey } from "./calendar.ts";
import { buildMonthBoard } from "./board.ts";
import { appointmentPublicTitle, upcomingVisitBoard, upcomingVisitProposals } from "./appointments.ts";
import type { Household } from "./types.ts";
import { activeOpenShift } from "./shiftClock.ts";

export const BLOTTER_EMPTY = "Nothing posted this month yet.";
export const MAIL_EMPTY = "No money dates in the next while.";
export const TIMESHEET_EMPTY = "No shifts posted yet.";
export const POSTCARD_EMPTY = "Next sit-down after the month turns.";
export const COOK_EMPTY = "Nothing cooked, nothing bought.";
export const JARS_EMPTY = "No jars on the shelf yet.";
export const CLAIMS_EMPTY = "Nothing owed to this household right now.";
export const BOARD_EMPTY = "Nothing on the board.";
export const CALENDAR_EMPTY = "Nothing on the month yet.";
export const APPOINTMENTS_EMPTY = "No visits on the horizon.";

export function blotterFacts(dashboard: Dashboard, opinion: AuditOpinion, findings: number) {
  const empty = dashboard.month.incomeActualCents === 0 && dashboard.month.expenseActualCents === 0;
  return {
    netCents: dashboard.month.netActualCents,
    incomeCents: dashboard.month.incomeActualCents,
    expenseCents: dashboard.month.expenseActualCents,
    stamp: opinion.kind,
    /** Unmodified is the clean stamp. Spec said "clean"; the books use unmodified. */
    warn: opinion.kind !== "unmodified",
    lampDot: findings > 0,
    empty,
    glance: empty ? BLOTTER_EMPTY : formatCad(dashboard.month.netActualCents),
  };
}

export function lampIsDark(findings: Finding[]): boolean {
  return findings.length === 0;
}

export function walletWarn(wallet: HouseholdWallet): boolean {
  const card = wallet.hottestCard;
  if (!card) return false;
  if (card.daysUntilDue < 0) return true;
  return card.utilization != null && card.utilization >= 0.8;
}

export function mailOverdue(dashboard: Dashboard, today: DateKey): boolean {
  return dashboard.upcoming.some((item) => item.due || item.date < today);
}

export function claimsOverdue(household: { claims?: { expectedCents: number; receivedCents: number; writtenOffCents: number }[] }): boolean {
  return (household.claims ?? []).some((claim) => claim.expectedCents - claim.receivedCents - claim.writtenOffCents > 0);
}

export function timesheetEmpty(streak: ShiftStreak, kitchen?: Household["kitchen"]): boolean {
  if (activeOpenShift(kitchen)) return false;
  return streak.count === 0 && streak.lastDate == null;
}

export function cookOffEmpty(score: CookOffScore): boolean {
  return score.groceryCents === 0 && score.coffeeCents === 0;
}

export function postcardEmpty(card: SitDownPostcard): boolean {
  return !card.ready;
}

export function calendarDeskFacts(household: Household, today: DateKey) {
  const items = buildMonthBoard(household, monthKeyFromDateKey(today), today).upcoming.slice(0, 5);
  return {
    empty: items.length === 0,
    next: items[0] ?? null,
    items,
  };
}

export function appointmentsDeskFacts(household: Household, today: DateKey) {
  const items = upcomingVisitBoard(household, today).slice(0, 5);
  const next = items[0] ?? null;
  const appointment = next
    ? household.appointments.find((row) => row.id === next.appointmentId)
    : undefined;
  return {
    empty: items.length === 0,
    next,
    items,
    quietTitle: appointment ? appointmentPublicTitle(appointment, "hercules") : null,
    proposal: upcomingVisitProposals(household, today)[0] ?? null,
  };
}
