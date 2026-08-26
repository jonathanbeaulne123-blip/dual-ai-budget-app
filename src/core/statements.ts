import { calendarDaysBetween, monthEndKey, monthStartKey, shiftMonthKey, addDays, type DateKey, type MonthKey } from "./calendar.ts";
import { expenseEffect, incomeEffect, monthSummary, type CategoryActual } from "./budget.ts";
import { isCashLikeKind, isCreditKind, isInvestmentKind, isReceivableKind } from "./accountKinds.ts";
import { runHealthCheck } from "./health.ts";
import {
  accountRegister,
  booksEquation,
  compileHousehold,
  trialBalance,
  type CompiledBooks,
} from "./journal.ts";
import { formatCad, sumCents } from "./money.ts";
import type { Household } from "./types.ts";

export type AuditOpinionKind = "unmodified" | "qualified" | "adverse";

export type AuditOpinion = {
  kind: AuditOpinionKind;
  hercules: string;
  cpa: string;
  trialInBalance: boolean;
  equationHolds: boolean;
  healthFindings: number;
  asOf: DateKey | null;
};

export type StatementLine = {
  id: string;
  code: string;
  name: string;
  cents: number;
};

export type BalanceSheet = {
  asOf: DateKey | null;
  assets: StatementLine[];
  liabilities: StatementLine[];
  equity: StatementLine[];
  assetCents: number;
  liabilityCents: number;
  equityCents: number;
  holds: boolean;
};

export type IncomeStatement = {
  monthKey: MonthKey;
  income: StatementLine[];
  expenses: StatementLine[];
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  budgetedNetCents: number;
  varianceCents: number;
};

export type CashFlowStatement = {
  monthKey: MonthKey;
  operatingInCents: number;
  operatingOutCents: number;
  cardSpendCents: number;
  debtPaydownCents: number;
  investingInCents: number;
  investingOutCents: number;
  netCashCents: number;
};

export type VarianceRow = {
  id: string;
  name: string;
  essential: boolean;
  budgetedCents: number;
  actualCents: number;
  varianceCents: number;
};

export type AgedBucket = "current" | "1-7" | "8-30" | "31+";

export type AgedPayable = {
  id: string;
  note: string;
  nextDate: DateKey;
  amountCents: number;
  daysOverdue: number;
  bucket: AgedBucket;
};

export type EquityMovement = {
  monthKey: MonthKey;
  openingCents: number;
  netIncomeCents: number;
  closingCents: number;
  rolls: boolean;
  householdEquityCents: number;
};

export type ComparativeIncome = {
  monthKey: MonthKey;
  priorKey: MonthKey;
  current: IncomeStatement;
  prior: IncomeStatement;
  incomeDeltaCents: number;
  expenseDeltaCents: number;
  netDeltaCents: number;
};

export type WorkingCapital = {
  currentAssetCents: number;
  currentLiabilityCents: number;
  workingCapitalCents: number;
  currentRatio: number | null;
  classified: string;
};

export type GoingConcernKind = "comfortable" | "tight" | "material-uncertainty";

export type LiquidityWatch = {
  asOf: DateKey;
  cashCents: number;
  billsNext30Cents: number;
  workingCapital: WorkingCapital;
  goingConcern: GoingConcernKind;
  hercules: string;
};

export type SubsequentEvents = {
  monthKey: MonthKey;
  count: number;
  incomeCents: number;
  expenseCents: number;
  hercules: string;
};

export type StatementNote = {
  id: string;
  title: string;
  body: string;
};

export type HouseholdMateriality = {
  monthKey: MonthKey;
  thresholdCents: number;
  basis: string;
};

function lastEntryDate(books: CompiledBooks): DateKey | null {
  return books.entries.at(-1)?.date ?? null;
}

function cashLike(kind: Household["accounts"][number]["kind"]): boolean {
  return isCashLikeKind(kind);
}

export function auditOpinion(household: Household): AuditOpinion {
  const findings = runHealthCheck(household);
  const books = compileHousehold(household);
  const trial = trialBalance(books, { recognizedOnly: true });
  const equation = booksEquation(books);
  let kind: AuditOpinionKind = "unmodified";
  if (!trial.inBalance || !equation.holds) kind = "adverse";
  else if (findings.length) kind = "qualified";
  const healthFindings = findings.length;
  const hercules =
    kind === "unmodified"
      ? "Unmodified. Debits match credits. I loaf."
      : kind === "qualified"
        ? `Qualified. Trial balances, but Health has ${healthFindings} finding${healthFindings === 1 ? "" : "s"}. I hide until that's honest.`
        : "Adverse. The journal does not balance. Nobody should post until this is fixed.";
  const cpa =
    kind === "unmodified"
      ? "In our opinion, the household statements present fairly, in all material respects, the financial position and results in CAD, America/Toronto."
      : kind === "qualified"
        ? "Qualified opinion: the trial balance holds, but Health findings mean we cannot call the books clean."
        : "Adverse opinion: the trial balance or accounting equation does not hold. These statements should not be relied on.";
  return {
    kind,
    hercules,
    cpa,
    trialInBalance: trial.inBalance,
    equationHolds: equation.holds,
    healthFindings,
    asOf: lastEntryDate(books),
  };
}

export function balanceSheet(household: Household): BalanceSheet {
  const books = compileHousehold(household);
  const trial = trialBalance(books, { recognizedOnly: true });
  const equation = booksEquation(books);
  const assets: StatementLine[] = [];
  const liabilities: StatementLine[] = [];
  for (const row of trial.rows) {
    if (row.accountType === "asset") {
      assets.push({ id: row.id, code: row.code, name: row.name, cents: row.netCents });
    }
    if (row.accountType === "liability") {
      liabilities.push({ id: row.id, code: row.code, name: row.name, cents: -row.netCents });
    }
  }
  const equity: StatementLine[] = [
    {
      id: "EQ-RETAINED",
      code: trial.rows.find((row) => row.id === "EQ-RETAINED")?.code ?? "3900",
      name: "Retained earnings",
      cents: equation.netIncomeCents,
    },
  ];
  const assetCents = sumCents(assets.map((line) => line.cents));
  const liabilityCents = sumCents(liabilities.map((line) => line.cents));
  const equityCents = sumCents(equity.map((line) => line.cents));
  return {
    asOf: lastEntryDate(books),
    assets,
    liabilities,
    equity,
    assetCents,
    liabilityCents,
    equityCents,
    holds: assetCents === liabilityCents + equityCents,
  };
}

function toLines(rows: CategoryActual[], type: "income" | "expense"): StatementLine[] {
  return rows
    .filter((row) => row.type === type && (row.actualCents || row.budgetedCents))
    .map((row) => ({
      id: row.subcategoryId,
      code: row.groupName,
      name: row.name,
      cents: row.actualCents,
    }));
}

export function incomeStatement(household: Household, monthKey: MonthKey): IncomeStatement {
  const month = monthSummary(household, monthKey);
  return {
    monthKey,
    income: toLines(month.categories, "income"),
    expenses: toLines(month.categories, "expense"),
    incomeCents: month.incomeActualCents,
    expenseCents: month.expenseActualCents,
    netCents: month.netActualCents,
    budgetedNetCents: month.netBudgetedCents,
    varianceCents: month.netActualCents - month.netBudgetedCents,
  };
}

export function cashFlowStatement(household: Household, monthKey: MonthKey): CashFlowStatement {
  const start = `${monthKey}-01`;
  const end = monthEndKey(monthKey);
  const byId = new Map(household.accounts.map((account) => [account.id, account]));
  let operatingInCents = 0;
  let operatingOutCents = 0;
  let cardSpendCents = 0;
  let debtPaydownCents = 0;
  let investingInCents = 0;
  let investingOutCents = 0;
  const seen = new Set<string>();

  for (const tx of household.transactions) {
    if (tx.isDuplicate) continue;
    if (tx.date < start || tx.date > end) continue;
    const account = byId.get(tx.accountId);
    if (!account) continue;
    if (tx.type === "income") {
      if (isCashLikeKind(account.kind)) operatingInCents += tx.amountCents;
      continue;
    }
    if (tx.type === "expense") {
      if (isCashLikeKind(account.kind)) operatingOutCents += tx.amountCents;
      else if (isCreditKind(account.kind)) cardSpendCents += tx.amountCents;
      continue;
    }
    if (tx.type === "refund") {
      if (isCashLikeKind(account.kind)) operatingInCents += tx.amountCents;
      else if (isCreditKind(account.kind)) cardSpendCents -= tx.amountCents;
      continue;
    }
    if (tx.type === "transfer") {
      const pairId = tx.transferPairId || tx.id;
      if (seen.has(pairId) || seen.has(tx.id)) continue;
      seen.add(tx.id);
      if (tx.transferPairId) seen.add(tx.transferPairId);
      const from = byId.get(tx.transferFromAccountId || tx.accountId);
      const to = byId.get(tx.transferToAccountId || "");
      if (from && to && isCashLikeKind(from.kind) && isCreditKind(to.kind)) {
        debtPaydownCents += tx.amountCents;
      } else if (from && to && isCashLikeKind(from.kind) && isInvestmentKind(to.kind)) {
        investingOutCents += tx.amountCents;
      } else if (from && to && isInvestmentKind(from.kind) && isCashLikeKind(to.kind)) {
        investingInCents += tx.amountCents;
      } else if (from && to && isReceivableKind(from.kind) && isCashLikeKind(to.kind)) {
        operatingInCents += tx.amountCents;
      } else if (from && to && isCashLikeKind(from.kind) && isReceivableKind(to.kind)) {
        operatingOutCents += tx.amountCents;
      }
    }
  }

  return {
    monthKey,
    operatingInCents,
    operatingOutCents,
    cardSpendCents,
    debtPaydownCents,
    investingInCents,
    investingOutCents,
    netCashCents: operatingInCents - operatingOutCents - debtPaydownCents - investingOutCents + investingInCents,
  };
}

export function budgetVariance(household: Household, monthKey: MonthKey): VarianceRow[] {
  const month = monthSummary(household, monthKey);
  return month.categories
    .filter((row) => row.type === "expense" && (row.budgetedCents || row.actualCents))
    .map((row) => ({
      id: row.subcategoryId,
      name: row.name,
      essential: row.essential,
      budgetedCents: row.budgetedCents,
      actualCents: row.actualCents,
      varianceCents: row.budgetedCents - row.actualCents,
    }))
    .sort((left, right) => left.varianceCents - right.varianceCents);
}

function agingBucket(daysOverdue: number): AgedBucket {
  if (daysOverdue <= 0) return "current";
  if (daysOverdue <= 7) return "1-7";
  if (daysOverdue <= 30) return "8-30";
  return "31+";
}

export function agedPayables(household: Household, today: DateKey): AgedPayable[] {
  return household.recurrences
    .filter((item) => item.active && item.type === "expense")
    .map((item) => {
      const daysOverdue = calendarDaysBetween(item.nextDate, today);
      return {
        id: item.id,
        note: item.note?.trim() || "a bill",
        nextDate: item.nextDate,
        amountCents: item.amountCents,
        daysOverdue,
        bucket: agingBucket(daysOverdue),
      };
    })
    .sort((left, right) => right.daysOverdue - left.daysOverdue || left.nextDate.localeCompare(right.nextDate));
}

function recognizedNetThrough(household: Household, asOf: DateKey | null): number {
  let net = 0;
  for (const tx of household.transactions) {
    if (asOf && tx.date > asOf) continue;
    net += incomeEffect(tx) - expenseEffect(tx);
  }
  return net;
}

export function statementOfChangesInEquity(household: Household, monthKey: MonthKey): EquityMovement {
  const openingCents = recognizedNetThrough(household, addDays(monthStartKey(monthKey), -1));
  const netIncomeCents = incomeStatement(household, monthKey).netCents;
  const closingCents = recognizedNetThrough(household, monthEndKey(monthKey));
  return {
    monthKey,
    openingCents,
    netIncomeCents,
    closingCents,
    rolls: openingCents + netIncomeCents === closingCents,
    householdEquityCents: balanceSheet(household).equityCents,
  };
}

export function comparativeIncome(household: Household, monthKey: MonthKey): ComparativeIncome {
  const priorKey = shiftMonthKey(monthKey, -1);
  const current = incomeStatement(household, monthKey);
  const prior = incomeStatement(household, priorKey);
  return {
    monthKey,
    priorKey,
    current,
    prior,
    incomeDeltaCents: current.incomeCents - prior.incomeCents,
    expenseDeltaCents: current.expenseCents - prior.expenseCents,
    netDeltaCents: current.netCents - prior.netCents,
  };
}

export function workingCapital(household: Household): WorkingCapital {
  const sheet = balanceSheet(household);
  return {
    currentAssetCents: sheet.assetCents,
    currentLiabilityCents: sheet.liabilityCents,
    workingCapitalCents: sheet.assetCents - sheet.liabilityCents,
    currentRatio: sheet.liabilityCents === 0 ? null : sheet.assetCents / sheet.liabilityCents,
    classified: "Cash-like, credit cards, and investments on this chart are treated as current household items. A mortgage or locked GIC will classify here when it exists — not as a YNAB envelope.",
  };
}

export function liquidityWatch(household: Household, today: DateKey): LiquidityWatch {
  const wc = workingCapital(household);
  const until = addDays(today, 30);
  const billsNext30Cents = sumCents(
    household.recurrences
      .filter((item) => item.active && item.type === "expense" && item.nextDate >= today && item.nextDate <= until)
      .map((item) => item.amountCents),
  );
  const cashCents = sumCents(
    household.accounts
      .filter((account) => account.active && cashLike(account.kind))
      .map((account) => bookBalanceAsOf(household, account.id, today)),
  );
  let goingConcern: GoingConcernKind = "comfortable";
  if (wc.workingCapitalCents < 0 || (billsNext30Cents > 0 && cashCents * 2 < billsNext30Cents)) {
    goingConcern = "material-uncertainty";
  } else if (billsNext30Cents > 0 && cashCents < billsNext30Cents) {
    goingConcern = "tight";
  }
  const hercules =
    goingConcern === "comfortable"
      ? "Liquidity is ordinary. Groceries, then bills, then treats."
      : goingConcern === "tight"
        ? "Cash covers less than the next 30 days of repeating bills. Not a prophecy. A look."
        : "Material uncertainty on 30-day bills vs cash, or working capital is negative. I hide from vibes. Health, then Calendar.";
  return { asOf: today, cashCents, billsNext30Cents, workingCapital: wc, goingConcern, hercules };
}

export function subsequentEvents(household: Household, monthKey: MonthKey, today: DateKey): SubsequentEvents {
  const end = monthEndKey(monthKey);
  const rows = household.transactions.filter((tx) => !tx.isDuplicate && tx.date > end && tx.date <= today);
  const count = rows.length;
  return {
    monthKey,
    count,
    incomeCents: sumCents(rows.map(incomeEffect)),
    expenseCents: sumCents(rows.map(expenseEffect)),
    hercules: count
      ? `${count} row${count === 1 ? "" : "s"} after ${monthKey}. Subsequent events. I don't hide them.`
      : `No subsequent events after ${monthKey}.`,
  };
}

export function householdMateriality(household: Household, monthKey: MonthKey): HouseholdMateriality {
  const incomeCents = Math.abs(incomeStatement(household, monthKey).incomeCents);
  const thresholdCents = Math.max(5000, Math.round(incomeCents * 0.05));
  return {
    monthKey,
    thresholdCents,
    basis: "5% of recognized month income, floor $50. Household materiality, not CPA assurance.",
  };
}

export function notesToFinancialStatements(household: Household, monthKey: MonthKey, today: DateKey): StatementNote[] {
  const opinion = auditOpinion(household);
  const liq = liquidityWatch(household, today);
  const events = subsequentEvents(household, monthKey, today);
  const mat = householdMateriality(household, monthKey);
  const closed = closedMonthKeys(household);
  const wc = liq.workingCapital;
  return [
    {
      id: "basis",
      title: "1. Basis of presentation",
      body: "These statements are projections over Hearth's command kernel. CAD. America/Toronto civil dates. Integer cents. They are not a second ledger. If a figure disagrees with the journal, the journal wins.",
    },
    {
      id: "recognition",
      title: "2. Recognition",
      body: "Income and expense are recognized when a member confirms a command. Recurring bills are not accrued until mark-paid. Transfers are not P&L. Refunds reverse category spend. Negative net tips are allowed. Duplicates use a five-day scorer; isDuplicate is the reviewed control.",
    },
    {
      id: "cards",
      title: "3. Credit cards and cash",
      body: "Credit cards are liabilities. Card spend is not cash. Paying a card is a transfer (debit liability, credit chequing), never an expense. Interest and cashback are looks until a command posts them. Cash-flow distinguishes operating cash, non-cash card spend, debt paydown, and investing in/out (chequing ↔ TFSA).",
    },
    {
      id: "related",
      title: "4. Related parties",
      body: "The reporting entity is a two-member Toronto household. Splits must sum. Joint is explicit. Personal visibility is a filter, not a privacy boundary until Auth exists. Hercules will not name who spent more.",
    },
    {
      id: "materiality",
      title: "5. Materiality",
      body: `${mat.basis} Threshold this month: ${formatCad(mat.thresholdCents)}.`,
    },
    {
      id: "liquidity",
      title: "6. Liquidity and going concern",
      body: `Cash-like ${formatCad(liq.cashCents)}. Repeating bills in 30 days ${formatCad(liq.billsNext30Cents)}. Working capital ${formatCad(wc.workingCapitalCents)}${wc.currentRatio == null ? "" : ` · current ratio ${wc.currentRatio.toFixed(2)}`}. Watch: ${liq.goingConcern}. ${wc.classified} This is not a bank covenant. Hosted access control is a separate matter from journal math.`,
    },
    {
      id: "close",
      title: "7. Subsequent events and closed periods",
      body: `${events.hercules} Closed months: ${closed.join(", ") || "none"}. A close is a hard lock: posting into that month is refused until you reopen it. Reverse a row instead of deleting it. Opinion on these statements: ${opinion.kind}.`,
    },
    {
      id: "controls",
      title: "8. Control environment",
      body: "Every money write is a command. Cosmetics never post. Bank rec never posts. Hercules never posts. Health refuses an unbalanced journal. Bank feeds, Interac, and issued cards wait on Auth + RLS.",
    },
    {
      id: "claims",
      title: "9. Receivables",
      body: "Money owed to this household is a receivable asset, not a jar. On visit day the full cost posts as an expense and expected recovery posts as a refund onto Owed-to-us, so the category shows out-of-pocket. When the money lands it is a transfer into the account that received it, never income. A shortfall writes the remainder back to the expense. Quiet visit labels hide the title from Hercules; they do not encrypt the snapshot. Hosted copies remain disclosed until Auth.",
    },
  ];
}

export function bookBalanceAsOf(household: Household, accountId: string, asOf: DateKey): number {
  const books = compileHousehold(household);
  const rows = accountRegister(books, accountId, { recognizedOnly: true });
  let last = 0;
  for (const row of rows) {
    if (row.date > asOf) break;
    last = row.runningCents;
  }
  return last;
}

export function closedMonthKeys(household: Household): MonthKey[] {
  return [...(household.kitchen.books?.closedMonths ?? [])]
    .sort((left, right) => left.monthKey.localeCompare(right.monthKey))
    .map((item) => item.monthKey);
}

export function isMonthClosed(household: Household, monthKey: MonthKey): boolean {
  return (household.kitchen.books?.closedMonths ?? []).some((item) => item.monthKey === monthKey);
}

export function closePackageText(household: Household, monthKey: MonthKey, today: DateKey): string {
  const opinion = auditOpinion(household);
  const sheet = balanceSheet(household);
  const income = incomeStatement(household, monthKey);
  const cash = cashFlowStatement(household, monthKey);
  const equity = statementOfChangesInEquity(household, monthKey);
  const comparative = comparativeIncome(household, monthKey);
  const liq = liquidityWatch(household, today);
  const aging = agedPayables(household, today);
  const notes = notesToFinancialStatements(household, monthKey, today);
  const events = subsequentEvents(household, monthKey, today);
  const books = compileHousehold(household);
  const trial = trialBalance(books, { recognizedOnly: true });
  const recs = (household.kitchen.books?.reconciliations ?? []).slice(-6);
  const ratio = liq.workingCapital.currentRatio;
  const lines = [
    `HEARTH CLOSE PACKAGE`,
    `Household: ${household.name}`,
    `Environment: ${household.environment}`,
    `Timezone: ${household.timezone} · Currency: CAD`,
    `Period: ${monthKey} · Printed: ${today}`,
    ``,
    `AUDIT OPINION: ${opinion.kind.toUpperCase()}`,
    opinion.cpa,
    `Hercules: ${opinion.hercules}`,
    `Trial balance: ${opinion.trialInBalance ? "in balance" : "OFF"} · Equation: ${opinion.equationHolds ? "holds" : "OFF"} · Health findings: ${opinion.healthFindings}`,
    ``,
    `BALANCE SHEET${sheet.asOf ? ` as of ${sheet.asOf}` : ""}`,
    `Assets ${formatCad(sheet.assetCents)}`,
    ...sheet.assets.map((line) => `  ${line.code} ${line.name} ${formatCad(line.cents)}`),
    `Liabilities ${formatCad(sheet.liabilityCents)}`,
    ...sheet.liabilities.map((line) => `  ${line.code} ${line.name} ${formatCad(line.cents)}`),
    `Equity ${formatCad(sheet.equityCents)}`,
    ...sheet.equity.map((line) => `  ${line.code} ${line.name} ${formatCad(line.cents)}`),
    `Assets ${sheet.holds ? "=" : "≠"} Liabilities + Equity`,
    ``,
    `STATEMENT OF CHANGES IN EQUITY ${monthKey}`,
    `Opening retained earnings ${formatCad(equity.openingCents)}`,
    `Net income ${formatCad(equity.netIncomeCents)}`,
    `Closing retained earnings ${formatCad(equity.closingCents)}`,
    `Rolls: ${equity.rolls ? "yes" : "NO"} · Household equity as of last posting ${formatCad(equity.householdEquityCents)}`,
    ``,
    `INCOME STATEMENT ${monthKey}`,
    `Income ${formatCad(income.incomeCents)}`,
    ...income.income.map((line) => `  ${line.name} ${formatCad(line.cents)}`),
    `Expenses ${formatCad(income.expenseCents)}`,
    ...income.expenses.map((line) => `  ${line.name} ${formatCad(line.cents)}`),
    `Net ${formatCad(income.netCents)} · budgeted net ${formatCad(income.budgetedNetCents)} · variance ${formatCad(income.varianceCents)}`,
    `vs ${comparative.priorKey}: income Δ ${formatCad(comparative.incomeDeltaCents)} · expense Δ ${formatCad(comparative.expenseDeltaCents)} · net Δ ${formatCad(comparative.netDeltaCents)}`,
    ``,
    `CASH FLOW ${monthKey}`,
    `Operating in ${formatCad(cash.operatingInCents)}`,
    `Operating out ${formatCad(cash.operatingOutCents)}`,
    `Card spend (non-cash) ${formatCad(cash.cardSpendCents)}`,
    `Visa / debt paydown ${formatCad(cash.debtPaydownCents)}`,
    `Investing in ${formatCad(cash.investingInCents)}`,
    `Investing out ${formatCad(cash.investingOutCents)}`,
    `Net cash ${formatCad(cash.netCashCents)}`,
    ``,
    `WORKING CAPITAL / LIQUIDITY`,
    `Working capital ${formatCad(liq.workingCapital.workingCapitalCents)} · current ratio ${ratio == null ? "n/a (no liabilities)" : ratio.toFixed(2)}`,
    `Cash-like ${formatCad(liq.cashCents)} · bills next 30 days ${formatCad(liq.billsNext30Cents)}`,
    `Going-concern watch: ${liq.goingConcern}`,
    liq.hercules,
    ``,
    `TRIAL BALANCE`,
    ...trial.rows.map((row) => `${row.code} ${row.name}  dr ${formatCad(row.displayDebitCents)}  cr ${formatCad(row.displayCreditCents)}`),
    `Total dr ${formatCad(trial.totalDebitCents)}  cr ${formatCad(trial.totalCreditCents)}`,
    ``,
    `AGED BILLS`,
    ...(aging.length
      ? aging.map((item) => `${item.nextDate} ${item.note} ${formatCad(item.amountCents)} (${item.bucket})`)
      : ["None"]),
    ``,
    `SUBSEQUENT EVENTS`,
    events.hercules,
    `Income after period ${formatCad(events.incomeCents)} · expenses after period ${formatCad(events.expenseCents)}`,
    ``,
    `BANK RECS (latest)`,
    ...(recs.length
      ? recs.map((item) => {
          const account = household.accounts.find((row) => row.id === item.accountId)?.name ?? item.accountId;
          return `${item.statementDate} ${account} statement ${formatCad(item.statementCents)} books ${formatCad(item.bookCents)} Δ ${formatCad(item.differenceCents)} ${item.status}`;
        })
      : ["None yet. A rec is not a bank feed."]),
    ``,
    `Closed months: ${closedMonthKeys(household).join(", ") || "none"}`,
    ``,
    `NOTES TO THE FINANCIAL STATEMENTS`,
    ...notes.flatMap((note) => [note.title, note.body, ""]),
    `This package is a projection over the command kernel. It does not post money.`,
    `Visa payments are transfers, not expenses. Splits must sum. Tips preview as posted.`,
    ``,
  ];
  return lines.join("\n");
}
