import { formatCad } from "./money.ts";
import type { Dashboard } from "./insights.ts";
import type { AuditOpinion } from "./statements.ts";
import type { Finding } from "./health.ts";
import type { CookOffScore, SitDownPostcard } from "./hercules.ts";
import type { ShiftStreak } from "./shiftStreak.ts";
import { monthKeyFromDateKey, weekBounds, type DateKey } from "./calendar.ts";
import { buildMonthBoard, isOutgoingBill } from "./board.ts";
import { appointmentPublicTitle, upcomingVisitBoard, upcomingVisitProposals } from "./appointments.ts";
import type { HouseholdWallet } from "./accounts.ts";
import { accountActivity, householdWallet } from "./accounts.ts";
import type { Household, Transaction } from "./types.ts";
import { activeOpenShift } from "./shiftClock.ts";

export const BLOTTER_EMPTY = "Nothing posted this month yet.";
export const MAIL_EMPTY = "No money dates in the next while.";
export const TIMESHEET_EMPTY = "No shifts posted yet.";
export const POSTCARD_EMPTY = "Next sit-down after the month turns.";
export const COOK_EMPTY = "Nothing cooked, nothing bought.";
export const JARS_EMPTY = "No goals yet.";
export const CLAIMS_EMPTY = "Nothing owed to this household right now.";
export const BOARD_EMPTY = "Nothing on the board.";
export const CALENDAR_EMPTY = "Nothing on the month yet.";
export const APPOINTMENTS_EMPTY = "No visits on the horizon.";
export const ACCOUNTS_EMPTY = "No accounts on the tray yet.";
export const GAMES_EMPTY = "Your move.";

export type CalendarDeskView = "day" | "week" | "month";

export function blotterFacts(dashboard: Dashboard, opinion: AuditOpinion, findings: number) {
  const empty = dashboard.month.incomeActualCents === 0 && dashboard.month.expenseActualCents === 0;
  return {
    netCents: dashboard.month.netActualCents,
    incomeCents: dashboard.month.incomeActualCents,
    expenseCents: dashboard.month.expenseActualCents,
    /** Household words on the wax. The audit enum stays in Books, where a
     *  CPA is reading an opinion — not on Home, where a kid is reading a net. */
    stamp: opinion.kind === "unmodified" ? "clean" : opinion.kind,
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
  return dashboard.upcoming.some((item) => isOutgoingBill(item) && (item.due || item.date < today));
}

export function claimsOverdue(household: { claims?: { expectedCents: number; receivedCents: number; writtenOffCents: number }[] }): boolean {
  return (household.claims ?? []).some((claim) => claim.expectedCents - claim.receivedCents - claim.writtenOffCents > 0);
}

export function timesheetEmpty(streak: ShiftStreak, kitchen?: Household["kitchen"], memberId?: string): boolean {
  if (activeOpenShift(kitchen, memberId)) return false;
  return streak.count === 0 && streak.lastDate == null;
}

export function cookOffEmpty(score: CookOffScore): boolean {
  return score.groceryCents === 0 && score.coffeeCents === 0;
}

export function postcardEmpty(card: SitDownPostcard): boolean {
  return !card.ready;
}

export function calendarDeskModel(household: Household, today: DateKey, view: CalendarDeskView, focus: DateKey) {
  const board = buildMonthBoard(household, monthKeyFromDateKey(focus), today);
  const week = weekBounds(focus);
  const days = view === "day"
    ? board.days.filter((day) => day.date === focus)
    : view === "week"
      ? board.days.filter((day) => day.date >= week.start && day.date <= week.end)
      : board.days;
  const items = days.flatMap((day) => day.items);
  return {
    view,
    focus,
    board,
    days,
    items,
    empty: items.length === 0,
    next: items.filter((item) => item.date >= today).sort((left, right) => left.date.localeCompare(right.date))[0]
      ?? items[0]
      ?? null,
  };
}

export function calendarDeskFacts(household: Household, today: DateKey) {
  const model = calendarDeskModel(household, today, "month", today);
  const upcoming = model.items
    .filter((item) => item.date >= today)
    .sort((left, right) => left.date.localeCompare(right.date) || left.title.localeCompare(right.title));
  return {
    empty: upcoming.length === 0 && model.items.length === 0,
    next: upcoming[0] ?? model.next,
    items: upcoming.slice(0, 6),
  };
}

export function accountsDeskFacts(household: Household, today: DateKey) {
  const wallet = householdWallet(household, today);
  const recent: Transaction[] = [...household.transactions]
    .filter((row) => !row.isDuplicate)
    .sort((left, right) => right.date.localeCompare(left.date) || right.createdAt.localeCompare(left.createdAt))
    .slice(0, 8);
  const lastByAccount = wallet.tiles.map((tile) => ({
    tile,
    last: accountActivity(household, tile.account.id)[0] ?? null,
  }));
  return {
    wallet,
    recent,
    lastByAccount,
    empty: wallet.tiles.length === 0,
    glance: wallet.hottestCard
      ? `${wallet.hottestCard.account.name} · ${formatCad(wallet.hottestCard.owedCents)}`
      : formatCad(wallet.netWorthCents),
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
