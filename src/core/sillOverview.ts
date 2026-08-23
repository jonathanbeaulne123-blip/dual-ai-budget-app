import { formatCad } from "./money.ts";
import type { DateKey } from "./calendar.ts";
import type { Dashboard } from "./insights.ts";
import { householdWallet } from "./accounts.ts";
import { appointmentPublicTitle, upcomingVisitBoard } from "./appointments.ts";
import { shiftPostingStreak } from "./shiftStreak.ts";
import { activeOpenShift, previewHoursLabel } from "./shiftClock.ts";
import type { Household } from "./types.ts";
import type { InstrumentId } from "./officeLayout.ts";

export type SillFigure = {
  id: string;
  label: string;
  value: string;
  warn: boolean;
  instrument: InstrumentId | "window";
};

export type SillOverview = {
  needsMe: string;
  figures: SillFigure[];
};

/** Mint-style header + YNAB “what needs me,” on paper, never on the glass. */
export function sillOverview(household: Household, dashboard: Dashboard, today: DateKey, nowMs = Date.now()): SillOverview {
  const wallet = householdWallet(household, today);
  const hot = wallet.hottestCard;
  const groceries = dashboard.month.categories.find((row) => row.name.toLowerCase() === "groceries");
  const groceryLeft = groceries && groceries.budgetedCents > 0
    ? groceries.budgetedCents - groceries.actualCents
    : null;
  const nextBill = dashboard.upcoming.find((item) => item.kind !== "visit" && item.kind !== "google" && item.kind !== "shift");
  const nextVisit = upcomingVisitBoard(household, today)[0];
  const visitAppointment = nextVisit
    ? household.appointments.find((row) => row.id === nextVisit.appointmentId)
    : undefined;
  const visitTitle = visitAppointment
    ? appointmentPublicTitle(visitAppointment, "hercules")
    : nextVisit
      ? "a visit"
      : null;
  const punch = activeOpenShift(household.kitchen);
  const streak = shiftPostingStreak(household, today);
  const overdueBill = dashboard.upcoming.find((item) => item.due || item.date < today);

  let needsMe = "Quiet desk. Milk whenever.";
  if (punch) needsMe = `On the clock · ${previewHoursLabel(punch.startedAt, nowMs)}`;
  else if (overdueBill) needsMe = `${overdueBill.title} is lifted. Mark paid writes.`;
  else if (hot && (hot.daysUntilDue < 3 || (hot.utilization != null && hot.utilization >= 0.8))) {
    needsMe = hot.daysUntilDue < 0
      ? `${hot.account.name} is past due. Paydown is a transfer.`
      : `${hot.account.name} needs you. Paydown is a transfer.`;
  } else if (streak.waiting) needsMe = streak.spoken;
  else if (groceryLeft != null && groceryLeft < 0) needsMe = `Groceries are ${formatCad(-groceryLeft)} over plan.`;
  else if (nextVisit && nextVisit.overdue) needsMe = `${visitTitle} is overdue. Dates remind.`;

  const figures: SillFigure[] = [
    {
      id: "net",
      label: "Month net",
      value: dashboard.month.incomeActualCents === 0 && dashboard.month.expenseActualCents === 0
        ? "—"
        : formatCad(dashboard.month.netActualCents),
      warn: dashboard.month.netActualCents < 0,
      instrument: "blotter",
    },
    {
      id: "wallet",
      label: hot ? hot.account.name : "Cash",
      value: hot
        ? (hot.daysUntilDue < 0 ? "past due" : `${hot.daysUntilDue}d`)
        : formatCad(wallet.cashCents),
      warn: Boolean(hot && (hot.daysUntilDue < 3 || (hot.utilization != null && hot.utilization >= 0.8))),
      instrument: "wallet",
    },
    {
      id: "bill",
      label: "Next bill",
      value: nextBill ? nextBill.title : "clear",
      warn: Boolean(nextBill && (nextBill.due || nextBill.date < today)),
      instrument: "mail",
    },
    {
      id: "visit",
      label: "Next visit",
      value: nextVisit ? visitTitle ?? nextVisit.title : "none",
      warn: Boolean(nextVisit?.overdue),
      instrument: "appointments",
    },
    {
      id: "groceries",
      label: "Groceries",
      value: groceryLeft == null ? "unplanned" : formatCad(groceryLeft),
      warn: groceryLeft != null && groceryLeft < groceries!.budgetedCents * 0.1,
      instrument: "blotter",
    },
  ];

  if (punch) {
    figures.unshift({
      id: "punch",
      label: "On the clock",
      value: `${previewHoursLabel(punch.startedAt, nowMs).split(" · ")[0]}`,
      warn: false,
      instrument: "timesheet",
    });
  }

  return { needsMe, figures: figures.slice(0, punch ? 6 : 5) };
}
