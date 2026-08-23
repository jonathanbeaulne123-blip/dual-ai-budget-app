import { formatCad } from "./money.ts";
import { hourInToronto, monthKeyFromDateKey, type DateKey } from "./calendar.ts";
import { monthSummary } from "./budget.ts";
import { householdWallet } from "./accounts.ts";
import { appointmentPublicTitle, outstandingClaims, upcomingVisitBoard } from "./appointments.ts";
import { buildMonthBoard } from "./board.ts";
import { activeOpenShift, previewHoursLabel } from "./shiftClock.ts";
import { herculesPageBrief, kettlePhase, type HearthTab } from "./hercules.ts";
import type { Household } from "./types.ts";

export type HerculesPageSurface = {
  tab: HearthTab;
  spoken: string;
  lesson: string | null;
  chips: string[];
  placeholder: string;
  fact: { label: string; value: string } | null;
};

function visitFact(household: Household, today: DateKey): { label: string; value: string } | null {
  const next = upcomingVisitBoard(household, today)[0];
  if (!next) return null;
  const appointment = household.appointments.find((row) => row.id === next.appointmentId);
  const title = appointment ? appointmentPublicTitle(appointment, "hercules") : next.title;
  return { label: "Next visit", value: `${next.date} · ${title}` };
}

function billFact(household: Household, today: DateKey): { label: string; value: string } | null {
  const next = buildMonthBoard(household, monthKeyFromDateKey(today), today).upcoming
    .find((item) => item.kind !== "visit" && item.kind !== "google" && item.kind !== "shift");
  if (!next) return null;
  return { label: "Next date", value: `${next.date} · ${next.title}` };
}

export function herculesPageSurface(
  tab: HearthTab,
  household: Household,
  today: DateKey,
  now = new Date(),
): HerculesPageSurface {
  const spoken = herculesPageBrief(household, tab, today, now);
  const month = monthSummary(household, monthKeyFromDateKey(today));
  const wallet = householdWallet(household, today);
  const groceries = month.categories.find((row) => row.name.toLowerCase() === "groceries");
  const groceryLeft = groceries && groceries.budgetedCents > 0
    ? groceries.budgetedCents - groceries.actualCents
    : null;
  const owing = outstandingClaims(household)[0];
  const punch = activeOpenShift(household.kitchen);

  if (tab === "add") {
    return {
      tab,
      spoken,
      lesson: "I'll loaf. Confirm still writes. I don't.",
      chips: [],
      placeholder: "loafing…",
      fact: punch ? { label: "On the clock", value: previewHoursLabel(punch.startedAt, now.getTime()) } : null,
    };
  }

  if (tab === "plan") {
    return {
      tab,
      spoken,
      lesson: "Sit-down copies last month. In dollars. Apply writes the plan, not the milk.",
      chips: ["Sit-down?", "Groceries left?", "We good?"],
      placeholder: "ask about the plan…",
      fact: groceryLeft == null ? { label: "Budgeted net", value: formatCad(month.netBudgetedCents) } : {
        label: "Groceries left",
        value: formatCad(groceryLeft),
      },
    };
  }

  if (tab === "calendar") {
    return {
      tab,
      spoken,
      lesson: "Dates remind. Mark paid writes. Visits stay quiet in my mouth.",
      chips: ["Which bill?", "What's owed?", "Start this jar"],
      placeholder: "ask about a date…",
      fact: visitFact(household, today) ?? billFact(household, today),
    };
  }

  if (tab === "ledger") {
    return {
      tab,
      spoken,
      lesson: "Fieldwork. I walk the journal. I don't write it.",
      chips: ["Opinion?", "Working capital?", "Balance sheet"],
      placeholder: "ask the books…",
      fact: { label: "Month net", value: formatCad(month.netActualCents) },
    };
  }

  if (tab === "more") {
    return {
      tab,
      spoken,
      lesson: "Health is the adult screen. I hide when it's dirty.",
      chips: ["Health", "What broke?", "We good?"],
      placeholder: "ask Health…",
      fact: owing ? { label: "Owed to us", value: formatCad(owing.expectedCents - owing.receivedCents - owing.writtenOffCents) } : {
        label: "Hour",
        value: `${hourInToronto(now)}h ${kettlePhase(today, hourInToronto(now))}`,
      },
    };
  }

  const hot = wallet.hottestCard;
  return {
    tab: "home",
    spoken,
    lesson: punch
      ? "Hours are a preview until sign-out Confirm."
      : "The desk projects the books. Confirm still posts.",
    chips: punch ? ["Log shift", "What's on the Visa?", "We good?"] : ["We good?", "What's on the Visa?", "What now?"],
    placeholder: "ask Hercules…",
    fact: punch
      ? { label: "On the clock", value: previewHoursLabel(punch.startedAt, now.getTime()) }
      : hot
        ? { label: hot.account.name, value: formatCad(hot.statementBalanceCents) }
        : { label: "Month net", value: formatCad(month.netActualCents) },
  };
}
