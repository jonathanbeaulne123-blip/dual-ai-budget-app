import { addDays, monthEndKey, shiftMonthKey, type DateKey, type MonthKey } from "./calendar.ts";
import { projectCadence } from "./recurrence.ts";
import { creditCardView } from "./accounts.ts";
import { isCashLikeKind } from "./accountKinds.ts";
import { compileHousehold, trialBalance } from "./journal.ts";
import { bookBalanceAsOf, closePackageText } from "./statements.ts";
import { monthSummary } from "./budget.ts";
import { formatCad, sumCents } from "./money.ts";
import { shiftPostingStreak } from "./shiftStreak.ts";
import { outstandingClaims, appointmentPublicTitle, claimPublicLabel } from "./appointments.ts";
import { quietSecrets, scrubQuietText } from "./herculesPrivacy.ts";
import { allocateLeftover, type AllocationResult, type AllocationSlice } from "./allocate.ts";
import { sitDownAnomalies, sitDownForecast, likelyMiscoded } from "./autoCode.ts";
import { goalsVaultAccount } from "./goalVault.ts";
import { goalStatus } from "./goals.ts";
import type { Household, SitDownSession, SitDownSessionStatus } from "./types.ts";

export type LeftoverBillHint = {
  recurrenceId: string;
  date: DateKey;
  amountCents: number;
  title: string;
};

export type LeftoverProjection = {
  asOf: DateKey;
  cashLikeCents: number;
  billsNext30Cents: number;
  minPaymentsCents: number;
  reservedCents: number;
  leftoverCents: number;
  shortfallCents: number;
  cashLikeAccountIds: string[];
  bills: LeftoverBillHint[];
  formula: string;
};

export type SitDownFact = {
  id: string;
  act: 1 | 2;
  title: string;
  detail: string;
  cents?: number;
  transactionIds: string[];
  tone: "good" | "info" | "watch";
};

const MAX_SITDOWNS = 24;

function outgoingRecurrence(item: Household["recurrences"][number]): boolean {
  if (!item.active || item.type !== "expense") return false;
  return item.kind === "bill" || item.kind === "subscription" || item.kind === "other";
}

export function leftoverProjection(household: Household, asOf: DateKey): LeftoverProjection {
  const until = addDays(asOf, 30);
  const cashLikeAccounts = household.accounts.filter((account) => account.active && isCashLikeKind(account.kind));
  const cashLikeCents = sumCents(cashLikeAccounts.map((account) => bookBalanceAsOf(household, account.id, asOf)));
  const bills: LeftoverBillHint[] = [];
  for (const item of household.recurrences) {
    if (!outgoingRecurrence(item)) continue;
    for (const date of projectCadence(item.nextDate, item.cadence, asOf, until)) {
      bills.push({
        recurrenceId: item.id,
        date,
        amountCents: item.amountCents,
        title: item.note.trim() || "Bill",
      });
    }
  }
  const billsNext30Cents = sumCents(bills.map((row) => row.amountCents));
  const minPaymentsCents = sumCents(
    household.accounts
      .filter((account) => account.active && account.kind === "credit")
      .map((account) => creditCardView(household, account, asOf).minPaymentCents),
  );
  const reservedCents = billsNext30Cents + minPaymentsCents;
  const leftoverCents = Math.max(0, cashLikeCents - reservedCents);
  const shortfallCents = Math.max(0, reservedCents - cashLikeCents);
  return {
    asOf,
    cashLikeCents,
    billsNext30Cents,
    minPaymentsCents,
    reservedCents,
    leftoverCents,
    shortfallCents,
    cashLikeAccountIds: cashLikeAccounts.map((account) => account.id),
    bills,
    formula: `cash-like ${formatCad(cashLikeCents)} − outgoing bills next 30 days ${formatCad(billsNext30Cents)} − card minimums ${formatCad(minPaymentsCents)} = leftover ${formatCad(leftoverCents)}`,
  };
}

export function leftoverSourceAccountId(household: Household, leftoverCents: number, asOf: DateKey): string | null {
  const cashLike = household.accounts.filter((account) => account.active && isCashLikeKind(account.kind));
  const chequing = cashLike.find((account) => account.kind === "chequing");
  if (chequing && bookBalanceAsOf(household, chequing.id, asOf) >= leftoverCents) return chequing.id;
  const ranked = cashLike
    .map((account) => ({ id: account.id, cents: bookBalanceAsOf(household, account.id, asOf) }))
    .sort((left, right) => right.cents - left.cents);
  return ranked[0]?.id ?? null;
}

export function jarParkingAccountId(household: Household): string | null {
  const vault = goalsVaultAccount(household);
  if (vault) return vault.id;
  const savings = household.accounts.find((account) => account.active && account.kind === "savings");
  if (savings) return savings.id;
  const other = household.accounts.find((account) => account.active && isCashLikeKind(account.kind));
  return other?.id ?? null;
}

export function proposeAllocation(household: Household, asOf: DateKey): AllocationSlice[] {
  const slices: AllocationSlice[] = [];
  for (const account of household.accounts.filter((item) => item.active && item.kind === "credit")) {
    const view = creditCardView(household, account, asOf);
    if (view.owedCents <= 0) continue;
    slices.push({
      id: `SLICE-${account.id}`,
      label: `${account.name} paydown`,
      kind: "account",
      targetId: account.id,
      mode: "weight",
      value: 3,
    });
  }
  for (const goal of household.goals.filter((item) => item.shared !== false && goalStatus(item) !== "retired")) {
    const remaining = Math.max(0, goal.targetCents - goal.savedCents);
    if (remaining <= 0) continue;
    slices.push({
      id: `SLICE-${goal.id}`,
      label: goal.name,
      kind: "goal",
      targetId: goal.id,
      mode: "weight",
      value: Math.max(1, Math.round(remaining / 10000)),
    });
  }
  for (const account of household.accounts.filter((item) => item.active && item.kind === "investment")) {
    slices.push({
      id: `SLICE-${account.id}`,
      label: account.name,
      kind: "account",
      targetId: account.id,
      mode: "weight",
      value: 1,
    });
  }
  if (!slices.length) {
    const parking = jarParkingAccountId(household);
    if (parking) {
      const account = household.accounts.find((item) => item.id === parking);
      slices.push({
        id: `SLICE-${parking}`,
        label: account?.name ?? "Savings",
        kind: "account",
        targetId: parking,
        mode: "weight",
        value: 1,
      });
    }
  }
  return slices;
}

export function plannedAllocation(leftoverCents: number, slices: AllocationSlice[]): AllocationResult {
  return allocateLeftover(leftoverCents, slices);
}

function postingDays(household: Household, monthKey: MonthKey): string[] {
  const start = `${monthKey}-01`;
  const end = monthEndKey(monthKey);
  const days = new Set<string>();
  for (const tx of household.transactions) {
    if (tx.isDuplicate || tx.date < start || tx.date > end) continue;
    days.add(tx.date);
  }
  return [...days].sort();
}

export function sitDownFacts(household: Household, monthKey: MonthKey, today: DateKey): SitDownFact[] {
  const month = monthSummary(household, monthKey);
  const facts: SitDownFact[] = [];
  const streak = shiftPostingStreak(household, today);
  if (streak.count >= 2) {
    facts.push({
      id: "positive-streak",
      act: 1,
      title: `Posted shifts ${streak.count} days in a row`,
      detail: streak.lastDate
        ? `Walking back from ${streak.lastDate}. A day off does not kill the cat.`
        : streak.lesson,
      transactionIds: household.shifts.filter((shift) => shift.date).map((shift) => shift.wagesTransactionId),
      tone: "good",
    });
  }
  const days = postingDays(household, monthKey);
  if (days.length >= 3) {
    facts.push({
      id: "positive-days",
      act: 1,
      title: `You posted on ${days.length} days this month`,
      detail: "The ritual is the posting, not a grade.",
      transactionIds: household.transactions.filter((tx) => days.includes(tx.date) && !tx.isDuplicate).map((tx) => tx.id).slice(0, 40),
      tone: "good",
    });
  }
  for (const row of month.categories) {
    if (row.type !== "expense" || row.budgetedCents <= 0 || row.actualCents >= row.budgetedCents) continue;
    const under = row.budgetedCents - row.actualCents;
    if (under < 500) continue;
    facts.push({
      id: `positive-under-${row.subcategoryId}`,
      act: 1,
      title: `${row.name} came in ${formatCad(under)} under plan`,
      detail: `${formatCad(row.actualCents)} spent of ${formatCad(row.budgetedCents)} planned.`,
      cents: under,
      transactionIds: household.transactions
        .filter((tx) => tx.subcategoryId === row.subcategoryId && tx.date.startsWith(monthKey) && !tx.isDuplicate)
        .map((tx) => tx.id),
      tone: "good",
    });
  }
  const landed = (household.claims ?? []).filter((claim) => claim.settledAt && claim.settledAt.slice(0, 7) === monthKey);
  if (landed.length) {
    facts.push({
      id: "positive-claims",
      act: 1,
      title: `${landed.length} claim${landed.length === 1 ? "" : "s"} landed`,
      detail: "Settlement is a transfer, never income.",
      transactionIds: landed.flatMap((claim) => claim.settleTransferIds),
      tone: "good",
    });
  }
  if (month.netActualCents > 0) {
    facts.push({
      id: "positive-net",
      act: 1,
      title: `The month net is ${formatCad(month.netActualCents)}`,
      detail: "Income minus expenses. Transfers are not in this number. Month net is not leftover.",
      cents: month.netActualCents,
      transactionIds: [],
      tone: "good",
    });
  }
  if (!facts.filter((fact) => fact.act === 1).length) {
    facts.push({
      id: "positive-showed",
      act: 1,
      title: "You showed up",
      detail: "A quiet month is still a month you kept the books. That counts.",
      transactionIds: [],
      tone: "good",
    });
  }

  const leftover = leftoverProjection(household, today);
  facts.push({
    id: "info-leftover",
    act: 2,
    title: leftover.leftoverCents ? `Leftover to assign: ${formatCad(leftover.leftoverCents)}` : "Nothing leftover to move",
    detail: leftover.formula,
    cents: leftover.leftoverCents,
    transactionIds: [],
    tone: leftover.shortfallCents ? "watch" : "info",
  });
  const books = compileHousehold(household);
  const trial = trialBalance(books, { recognizedOnly: true });
  facts.push({
    id: "info-trial",
    act: 2,
    title: trial.inBalance ? "Trial balance ticks" : "Trial balance is off",
    detail: trial.inBalance
      ? `Debits ${formatCad(trial.totalDebitCents)} match credits. The journal wins if a chart disagrees.`
      : "Health first. Do not move leftover on an unbalanced journal.",
    transactionIds: [],
    tone: trial.inBalance ? "info" : "watch",
  });
  for (const anomaly of sitDownAnomalies(household, monthKey).slice(0, 6)) {
    facts.push({
      id: anomaly.id,
      act: 2,
      title: anomaly.title,
      detail: anomaly.detail,
      cents: anomaly.thisMonthCents,
      transactionIds: anomaly.transactionIds,
      tone: "watch",
    });
  }
  const forecast = sitDownForecast(household, today);
  facts.push({
    id: "info-forecast",
    act: 2,
    title: `Next month looks like ${formatCad(forecast.fixedCents + forecast.variableCents)} out`,
    detail: forecast.detail,
    cents: forecast.fixedCents + forecast.variableCents,
    transactionIds: [],
    tone: "info",
  });
  for (const row of month.categories.filter((item) => item.type === "expense" && (item.actualCents || item.budgetedCents)).slice(0, 8)) {
    facts.push({
      id: `info-cat-${row.subcategoryId}`,
      act: 2,
      title: `${row.name}: ${formatCad(row.actualCents)} vs ${formatCad(row.budgetedCents)} plan`,
      detail: row.actualCents > row.budgetedCents && row.budgetedCents
        ? "Ran hot. Sit-down can meet it in the middle when you copy jobs."
        : "Plan versus actual. Tap for the rows.",
      cents: row.actualCents,
      transactionIds: household.transactions
        .filter((tx) => tx.subcategoryId === row.subcategoryId && tx.date.startsWith(monthKey) && !tx.isDuplicate)
        .map((tx) => tx.id),
      tone: row.actualCents > row.budgetedCents && row.budgetedCents ? "watch" : "info",
    });
  }
  const miscoded = likelyMiscoded(household, monthKey);
  if (miscoded.length) {
    facts.push({
      id: "info-miscode",
      act: 2,
      title: `${miscoded.length} row${miscoded.length === 1 ? "" : "s"} look miscoded`,
      detail: "Guessed from merchant tokens on this phone. Confirm still recodes. Nothing auto-posts.",
      transactionIds: miscoded.map((row) => row.transactionId),
      tone: "watch",
    });
  }
  const owing = outstandingClaims(household);
  if (owing.length) {
    facts.push({
      id: "info-claims",
      act: 2,
      title: `${owing.length} still owing to us`,
      detail: owing.map((claim) => claimPublicLabel(household, claim, "hercules")).join(" · "),
      transactionIds: owing.map((claim) => claim.expenseTransactionId),
      tone: "info",
    });
  }
  return facts;
}

export function shapeSitDownSessions(list: SitDownSession[] | undefined): SitDownSession[] {
  if (!Array.isArray(list)) return [];
  return list.filter((row) => row && row.id && /^\d{4}-\d{2}$/.test(row.monthKey)).map((row) => ({
    id: row.id,
    monthKey: row.monthKey as MonthKey,
    targetMonth: (row.targetMonth || shiftMonthKey(row.monthKey, 1)) as MonthKey,
    act: (row.act === 2 || row.act === 3 ? row.act : 1) as 1 | 2 | 3,
    leftoverCents: Math.round(row.leftoverCents || 0),
    cashLikeCents: Math.round(row.cashLikeCents || 0),
    billsNext30Cents: Math.round(row.billsNext30Cents || 0),
    minPaymentsCents: Math.round(row.minPaymentsCents || 0),
    slices: Array.isArray(row.slices) ? row.slices : [],
    transferIds: Array.isArray(row.transferIds) ? row.transferIds : [],
    contributionIds: Array.isArray(row.contributionIds) ? row.contributionIds : [],
    budgetPosted: Boolean(row.budgetPosted),
    closedMonth: Boolean(row.closedMonth),
    driveFileId: row.driveFileId || null,
    status: (row.status === "moved" || row.status === "closed" ? row.status : "open") as SitDownSessionStatus,
    createdBy: row.createdBy || "",
    createdAt: row.createdAt || "",
    updatedAt: row.updatedAt || row.createdAt || "",
  })).slice(-MAX_SITDOWNS);
}

export function openSitDownSession(household: Household, monthKey: MonthKey): SitDownSession | undefined {
  return [...(household.sitDownSessions ?? [])]
    .reverse()
    .find((row) => row.monthKey === monthKey && row.status !== "closed");
}

export function sitDownWorkbookCsv(household: Household, monthKey: MonthKey, session?: SitDownSession | null): string {
  const secrets = quietSecrets(household);
  const books = compileHousehold(household);
  const trial = trialBalance(books, { recognizedOnly: true });
  const month = monthSummary(household, monthKey);
  const leftover = leftoverProjection(household, monthEndKey(monthKey));
  const lines: string[] = [
    "section,field,value",
    `meta,household,${csv(household.name)}`,
    `meta,month,${monthKey}`,
    `meta,leftover_formula,${csv(leftover.formula)}`,
    `meta,leftover_cents,${leftover.leftoverCents}`,
    "",
    "journal_date,entry_id,memo,debit,credit",
  ];
  for (const entry of books.entries.filter((item) => item.date.startsWith(monthKey))) {
    const memo = scrubQuietText(entry.memo, secrets);
    for (const line of entry.lines) {
      lines.push([
        entry.date,
        entry.id,
        csv(memo),
        line.debitCents ? (line.debitCents / 100).toFixed(2) : "",
        line.creditCents ? (line.creditCents / 100).toFixed(2) : "",
      ].join(","));
    }
  }
  lines.push("", "trial_account,debit,credit");
  for (const row of trial.rows) {
    lines.push([csv(row.name), (row.displayDebitCents / 100).toFixed(2), (row.displayCreditCents / 100).toFixed(2)].join(","));
  }
  lines.push(["TOTAL", (trial.totalDebitCents / 100).toFixed(2), (trial.totalCreditCents / 100).toFixed(2)].join(","));
  lines.push("", "category,plan,actual");
  for (const row of month.categories.filter((item) => item.budgetedCents || item.actualCents)) {
    lines.push([csv(row.name), (row.budgetedCents / 100).toFixed(2), (row.actualCents / 100).toFixed(2)].join(","));
  }
  lines.push("", "allocation_label,kind,cents");
  for (const slice of session?.slices ?? []) {
    lines.push([csv(slice.label), slice.kind, String(slice.value)].join(","));
  }
  lines.push("", "claim_label,status,expected,received");
  for (const claim of household.claims ?? []) {
    const appointment = household.appointments.find((item) => item.id === claim.appointmentId);
    const label = appointment?.sensitivity === "quiet"
      ? appointmentPublicTitle(appointment, "hercules")
      : claimPublicLabel(household, claim, "card");
    lines.push([csv(label), claim.status, (claim.expectedCents / 100).toFixed(2), (claim.receivedCents / 100).toFixed(2)].join(","));
  }
  return lines.join("\n");
}

export function sitDownExportText(household: Household, monthKey: MonthKey, today: DateKey, session?: SitDownSession | null): string {
  const leftover = leftoverProjection(household, today);
  const secrets = quietSecrets(household);
  const pack = scrubQuietText(closePackageText(household, monthKey, today), secrets);
  const allocation = session
    ? session.slices.map((slice) => `  ${slice.label} (${slice.mode} ${slice.value})`).join("\n")
    : "  (none yet)";
  return [
    pack,
    "",
    "SIT-DOWN LEFTOVER",
    leftover.formula,
    `Shortfall ${formatCad(leftover.shortfallCents)}`,
    "",
    "ALLOCATION CHOSEN",
    allocation,
    session?.driveFileId ? `Drive file id ${session.driveFileId}` : "Drive file not stored as contents — id only if uploaded.",
    "",
  ].join("\n");
}

function csv(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
