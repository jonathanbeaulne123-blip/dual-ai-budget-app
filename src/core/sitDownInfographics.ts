import { formatCad } from "./money.ts";
import { leftoverProjection, type LeftoverProjection } from "./sitDown.ts";
import { categorySpendBars, monthInOutBars, type PaperBarRow } from "./officeWide.ts";
import { projectHouseholdFund } from "./householdFund.ts";
import { householdWallet } from "./accounts.ts";
import { kittyBanksInView } from "./kittyBanks.ts";
import type { DateKey } from "./calendar.ts";
import type { Dashboard } from "./insights.ts";
import type { Household, LedgerView } from "./types.ts";

export type SitDownChart = {
  id: string;
  caption: string;
  rows: PaperBarRow[];
  lines: { label: string; cents: number; strong?: boolean }[];
  note: string;
  empty: string;
};

function leftoverChart(leftover: LeftoverProjection): SitDownChart {
  return {
    id: "leftover",
    caption: "Cash versus bills. Leftover is not month net.",
    rows: [
      { label: "Cash-like", cents: leftover.cashLikeCents, tone: "pine" },
      { label: "Bills 30d", cents: leftover.billsNext30Cents, tone: "copper" },
      { label: "Leftover", cents: leftover.leftoverCents, tone: leftover.leftoverCents > 0 ? "ink" : "copper" },
    ],
    lines: [
      { label: "Cash-like", cents: leftover.cashLikeCents },
      { label: "− Bills next 30 days", cents: leftover.billsNext30Cents },
      { label: "− Card minimums", cents: leftover.minPaymentsCents },
      { label: "Leftover", cents: leftover.leftoverCents, strong: true },
    ],
    note: leftover.shortfallCents > 0
      ? `Shortfall ${formatCad(leftover.shortfallCents)}. Do not invent CAD to fill it.`
      : "If leftover is positive, Confirm parks goal cash in Kitty Banks — not month net, not everyday HIS.",
    empty: "No cash-like or bills to graph yet.",
  };
}

/** View-safe paper charts. Shared leftover stays off Personal. Never invents CAD. */
export function sitDownInfographicDeck(input: {
  view: LedgerView;
  household: Household;
  dashboard: Dashboard;
  today: DateKey;
  leftover?: LeftoverProjection | null;
  memberId?: string;
}): SitDownChart[] {
  const month = input.dashboard.month;
  const inOut = monthInOutBars(month);
  const spend = categorySpendBars(month.categories, 4);
  const flow: SitDownChart = {
    id: "month-flow",
    caption: input.view === "personal" ? "My in and out this month." : "Household in and out this month.",
    rows: inOut,
    lines: [
      { label: "In", cents: month.incomeActualCents },
      { label: "Out", cents: month.expenseActualCents },
      { label: "Month net", cents: month.incomeActualCents - month.expenseActualCents, strong: true },
    ],
    note: "Posted actuals only. This is not leftover and not Fund free-to-spend.",
    empty: "Nothing posted this month yet.",
  };
  const topSpend: SitDownChart = {
    id: "spend",
    caption: "Top spend this month.",
    rows: spend,
    lines: spend.map((row) => ({ label: row.label, cents: row.cents })),
    note: "Largest expense categories from posted rows.",
    empty: "No expenses posted this month yet.",
  };

  if (input.view === "personal") {
    const wallet = householdWallet(input.household, input.today);
    const banks = kittyBanksInView(input.household, "personal", input.memberId);
    const walletChart: SitDownChart = {
      id: "wallet",
      caption: "Cash and cards on this folio.",
      rows: [
        { label: "Cash", cents: wallet.cashCents, tone: "pine" },
        { label: "Card owed", cents: wallet.owedCents, tone: "copper" },
      ],
      lines: [
        { label: "Cash-like", cents: wallet.cashCents },
        { label: "Card owed", cents: wallet.owedCents, strong: wallet.owedCents > 0 },
      ],
      note: "Personal-scope accounts on this folio. Confirm still posts.",
      empty: "No Personal accounts on this folio yet.",
    };
    const bankChart: SitDownChart = {
      id: "banks",
      caption: "My Kitty Banks.",
      rows: banks.slice(0, 4).map((goal) => ({
        label: goal.name,
        cents: goal.savedCents,
        tone: "ink" as const,
      })),
      lines: banks.slice(0, 4).map((goal) => ({ label: goal.name, cents: goal.savedCents })),
      note: "These are existing personal goals, paper-named. Hearth does not invent a second envelope.",
      empty: "No personal banks yet. Open Kitty Banks on Plan to start one.",
    };
    return [flow, topSpend, walletChart, bankChart].filter((chart) => chart.rows.length > 0 || chart.id === "month-flow");
  }

  const leftover = input.leftover ?? leftoverProjection(input.household, input.today);
  const fund = projectHouseholdFund(input.household, input.today);
  const banks = kittyBanksInView(input.household, "household", input.memberId);
  const fundChart: SitDownChart | null = fund.configured
    ? {
      id: "fund",
      caption: "Household Fund. Operating plus Kitty stays conserved.",
      rows: [
        { label: "Operating", cents: fund.operatingBalanceCents, tone: "pine" },
        { label: "Fund kitty", cents: fund.kittyCents, tone: "ink" },
        { label: "Transfer due", cents: fund.transferDueCents, tone: "copper" },
      ],
      lines: [
        { label: "Operating", cents: fund.operatingBalanceCents },
        { label: "Fund kitty", cents: fund.kittyCents },
        { label: "Transfer due", cents: fund.transferDueCents, strong: fund.transferDueCents > 0 },
      ],
      note: "Fund kitty is surplus rolled into existing shared goals. The money remains in Bianca’s savings. Hearth cannot move it.",
      empty: "Fund is not set up yet.",
    }
    : null;
  const bankChart: SitDownChart = {
    id: "banks",
    caption: "Shared Kitty Banks.",
    rows: banks.slice(0, 4).map((goal) => ({
      label: goal.name,
      cents: goal.savedCents,
      tone: "ink" as const,
    })),
    lines: banks.slice(0, 4).map((goal) => ({ label: goal.name, cents: goal.savedCents })),
    note: "Fund surplus rolls into these existing shared goals. Not a new envelope system.",
    empty: "No shared banks yet. Customize them on Plan.",
  };
  return [leftoverChart(leftover), flow, topSpend, fundChart, bankChart]
    .filter((chart): chart is SitDownChart => Boolean(chart));
}
