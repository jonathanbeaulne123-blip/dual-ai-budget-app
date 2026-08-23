import { addDays, calendarDaysBetween, daysInMonthKey, monthKeyFromDateKey, shiftMonthKey, type DateKey, type MonthKey } from "./calendar.ts";
import { ACCOUNT_KIND_LABEL, isCashLikeKind, isCreditKind, isInvestmentKind, isLiabilityKind, isReceivableKind } from "./accountKinds.ts";
import { accountRegister, compileHousehold } from "./journal.ts";
import { formatCad, sumCents } from "./money.ts";
import type { Account, AccountKind, Household, Transaction } from "./types.ts";

export function accountBookBalance(household: Household, accountId: string, asOf?: DateKey): number {
  const books = compileHousehold(household);
  const rows = accountRegister(books, accountId, { recognizedOnly: true });
  if (!asOf) return rows.at(-1)?.runningCents ?? 0;
  let last = 0;
  for (const row of rows) {
    if (row.date > asOf) break;
    last = row.runningCents;
  }
  return last;
}

export function cashbackBpsFor(account: Account, subcategoryId: string | null): number {
  const desk = account.credit;
  if (!desk) return 0;
  const rule = desk.rules.find((item) => item.subcategoryId && item.subcategoryId === subcategoryId);
  return rule?.bps ?? desk.defaultCashbackBps;
}

function padDay(monthKey: MonthKey, day: number): DateKey {
  const dim = daysInMonthKey(monthKey);
  return `${monthKey}-${String(Math.min(Math.max(day, 1), dim)).padStart(2, "0")}`;
}

export function statementCloseOn(monthKey: MonthKey, statementDay: number): DateKey {
  return padDay(monthKey, statementDay);
}

export function lastStatementDate(today: DateKey, statementDay: number): DateKey {
  const monthKey = monthKeyFromDateKey(today);
  const thisClose = statementCloseOn(monthKey, statementDay);
  if (today >= thisClose) return thisClose;
  return statementCloseOn(shiftMonthKey(monthKey, -1), statementDay);
}

export function nextStatementDate(today: DateKey, statementDay: number): DateKey {
  const last = lastStatementDate(today, statementDay);
  const nextMonth = shiftMonthKey(monthKeyFromDateKey(last), 1);
  return statementCloseOn(nextMonth, statementDay);
}

function transfersTo(household: Household, accountId: string, start: DateKey, end: DateKey): number {
  const seen = new Set<string>();
  let total = 0;
  for (const tx of household.transactions) {
    if (tx.isDuplicate || tx.type !== "transfer") continue;
    if (tx.date < start || tx.date > end) continue;
    const pairId = tx.transferPairId || tx.id;
    if (seen.has(pairId) || seen.has(tx.id)) continue;
    seen.add(tx.id);
    if (tx.transferPairId) seen.add(tx.transferPairId);
    if (tx.transferToAccountId === accountId) total += tx.amountCents;
  }
  return total;
}

function countableSpend(tx: Transaction): number {
  if (tx.isDuplicate) return 0;
  if (tx.type === "expense") return tx.amountCents;
  if (tx.type === "refund") return -tx.amountCents;
  return 0;
}

export type CreditCardView = {
  account: Account;
  owedCents: number;
  limitCents: number;
  availableCents: number;
  utilization: number | null;
  aprBps: number;
  statementDate: DateKey;
  dueDate: DateKey;
  daysUntilDue: number;
  statementBalanceCents: number;
  paidSinceStatementCents: number;
  paidInFull: boolean;
  minPaymentCents: number;
  estimatedInterestCents: number;
  interestIfMinPayCents: number;
  cashbackCycleCents: number;
  cashbackPostedCents: number;
  rewardsName: string;
  hercules: string;
};

export function creditCardView(household: Household, account: Account, today: DateKey): CreditCardView {
  const desk = account.credit;
  const owedCents = Math.max(0, accountBookBalance(household, account.id, today));
  const limitCents = desk?.creditLimitCents ?? 0;
  const availableCents = limitCents > 0 ? Math.max(0, limitCents - owedCents) : 0;
  const utilization = limitCents > 0 ? owedCents / limitCents : null;
  const statementDay = desk?.statementDay ?? 21;
  const statementDate = lastStatementDate(today, statementDay);
  const dueDate = addDays(statementDate, desk?.dueDaysAfterStatement ?? 21);
  const statementBalanceCents = Math.max(0, accountBookBalance(household, account.id, statementDate));
  const paidSinceStatementCents = transfersTo(household, account.id, addDays(statementDate, 1), today);
  const paidInFull = statementBalanceCents > 0 && paidSinceStatementCents >= statementBalanceCents;
  const remaining = Math.max(0, statementBalanceCents - paidSinceStatementCents);
  const minBps = desk?.minPaymentBps ?? 200;
  const floor = desk?.minPaymentFloorCents ?? 1000;
  const minPaymentCents = statementBalanceCents <= 0
    ? 0
    : Math.min(statementBalanceCents, Math.max(floor, Math.round(statementBalanceCents * minBps / 10000)));
  const aprBps = desk?.aprBps ?? 0;
  const monthlyRate = aprBps / 10000 / 12;
  const estimatedInterestCents = !desk || paidInFull || remaining <= 0 || aprBps <= 0
    ? 0
    : Math.round(remaining * monthlyRate);
  const afterMin = Math.max(0, remaining - minPaymentCents);
  const interestIfMinPayCents = !desk || remaining <= 0 || aprBps <= 0
    ? 0
    : Math.round(afterMin * monthlyRate);
  const cycleStart = addDays(statementDate, 1);
  const cycleEnd = nextStatementDate(today, statementDay);
  let cashbackCycleCents = 0;
  let cashbackPostedCents = 0;
  for (const tx of household.transactions) {
    if (tx.accountId !== account.id || tx.isDuplicate) continue;
    if (tx.date >= cycleStart && tx.date <= cycleEnd) {
      const spend = countableSpend(tx);
      if (spend > 0) cashbackCycleCents += Math.round(spend * cashbackBpsFor(account, tx.subcategoryId) / 10000);
    }
    if ((tx.type === "refund" || tx.type === "income") && (
      /cashback|reward/i.test(`${tx.note} ${tx.place}`)
      || (desk?.rewardsName && tx.note.toLowerCase().includes(desk.rewardsName.toLowerCase()))
    )) {
      cashbackPostedCents += tx.amountCents;
    }
  }
  const rewardsName = desk?.rewardsName ?? "Cashback";
  const utilPct = utilization == null ? null : Math.round(utilization * 100);
  const hercules = paidInFull
    ? `${account.name} is paid in full this cycle. Grace holds. I loaf.`
    : utilPct != null && utilPct >= 80
      ? `${account.name} is at ${utilPct}% utilization. Pay it down. I don't levy a fee.`
      : estimatedInterestCents
        ? `${account.name} will accrue about ${formatCad(estimatedInterestCents)} if the statement isn't paid in full. That's a look, not a post.`
        : `${account.name} owes ${formatCad(owedCents)}. Paydown is a transfer.`;
  return {
    account,
    owedCents,
    limitCents,
    availableCents,
    utilization,
    aprBps,
    statementDate,
    dueDate,
    daysUntilDue: calendarDaysBetween(today, dueDate),
    statementBalanceCents,
    paidSinceStatementCents,
    paidInFull,
    minPaymentCents,
    estimatedInterestCents,
    interestIfMinPayCents,
    cashbackCycleCents,
    cashbackPostedCents,
    rewardsName,
    hercules,
  };
}

export type SavingsView = {
  account: Account;
  balanceCents: number;
  apyBps: number;
  estimatedMonthlyInterestCents: number;
  hercules: string;
};

export function savingsView(household: Household, account: Account, today: DateKey): SavingsView {
  const balanceCents = accountBookBalance(household, account.id, today);
  const apyBps = account.savings?.apyBps ?? 0;
  const estimatedMonthlyInterestCents = balanceCents > 0 && apyBps > 0
    ? Math.round(balanceCents * (apyBps / 10000) / 12)
    : 0;
  return {
    account,
    balanceCents,
    apyBps,
    estimatedMonthlyInterestCents,
    hercules: account.savings?.purpose === "goals"
      ? `${account.name} is the sinking-fund vault. Pigs are envelopes on it. Leftover parks here after sit-down Confirm. I don't post it.`
      : estimatedMonthlyInterestCents
        ? `${account.name} would earn about ${formatCad(estimatedMonthlyInterestCents)} this month at ${(apyBps / 100).toFixed(2)}% APY. I don't post it.`
        : `${account.name} is ${formatCad(balanceCents)} on the books.`,
  };
}

export type InvestmentView = {
  account: Account;
  costBasisCents: number;
  markedValueCents: number | null;
  markedAt: DateKey | null;
  unrealizedCents: number | null;
  vehicle: string;
  hercules: string;
};

export function investmentView(household: Household, account: Account, today: DateKey): InvestmentView {
  const costBasisCents = accountBookBalance(household, account.id, today);
  const markedValueCents = account.investment?.markedValueCents ?? null;
  const markedAt = account.investment?.markedAt ?? null;
  const unrealizedCents = markedValueCents == null ? null : markedValueCents - costBasisCents;
  const vehicle = account.investment?.vehicle ?? "tfsa";
  return {
    account,
    costBasisCents,
    markedValueCents,
    markedAt,
    unrealizedCents,
    vehicle,
    hercules: markedValueCents == null
      ? `${account.name} cost basis ${formatCad(costBasisCents)}. Mark a value. I don't invent a market.`
      : `${account.name} is marked ${formatCad(markedValueCents)} vs cost ${formatCad(costBasisCents)}. Unrealized is not money until you sell.`,
  };
}

export type WalletTile = {
  account: Account;
  kind: AccountKind;
  group: string;
  balanceCents: number;
  displayCents: number;
  sub: string;
  tone: "good" | "warn" | "neutral";
  credit?: CreditCardView;
  savings?: SavingsView;
  investment?: InvestmentView;
};

export type HouseholdWallet = {
  tiles: WalletTile[];
  groups: { kind: AccountKind; label: string; tiles: WalletTile[] }[];
  cashCents: number;
  owedCents: number;
  receivableCents: number;
  investedCostCents: number;
  investedMarkedCents: number | null;
  netWorthCents: number;
  hottestCard: CreditCardView | null;
};

function tileSub(household: Household, account: Account, today: DateKey): { sub: string; tone: "good" | "warn" | "neutral"; credit?: CreditCardView; savings?: SavingsView; investment?: InvestmentView } {
  if (isCreditKind(account.kind)) {
    const credit = creditCardView(household, account, today);
    const pct = credit.utilization == null ? "" : ` · ${Math.round(credit.utilization * 100)}% used`;
    return {
      sub: credit.limitCents
        ? `Available ${formatCad(credit.availableCents)}${pct}`
        : `Owed ${formatCad(credit.owedCents)}`,
      tone: credit.utilization != null && credit.utilization >= 0.8 ? "warn" : "neutral",
      credit,
    };
  }
  if (account.kind === "savings") {
    const savings = savingsView(household, account, today);
    const vault = account.savings?.purpose === "goals" ? "Goals vault · " : "";
    return {
      sub: savings.apyBps
        ? `${vault}${(savings.apyBps / 100).toFixed(2)}% APY · est. ${formatCad(savings.estimatedMonthlyInterestCents)}/mo`
        : vault
          ? `${vault}pigs live here`
          : "Savings",
      tone: "good",
      savings,
    };
  }
  if (isInvestmentKind(account.kind)) {
    const investment = investmentView(household, account, today);
    return {
      sub: investment.markedValueCents == null
        ? `${investment.vehicle.toUpperCase()} · cost ${formatCad(investment.costBasisCents)}`
        : `${investment.vehicle.toUpperCase()} · marked ${formatCad(investment.markedValueCents)}`,
      tone: "neutral",
      investment,
    };
  }
  if (isReceivableKind(account.kind)) {
    const balanceCents = accountBookBalance(household, account.id, today);
    return {
      sub: balanceCents ? `Outstanding ${formatCad(balanceCents)}` : "Nothing outstanding",
      tone: balanceCents > 0 ? "warn" : "good",
    };
  }
  return { sub: account.institution || ACCOUNT_KIND_LABEL[account.kind], tone: "neutral" };
}

export function householdWallet(household: Household, today: DateKey): HouseholdWallet {
  const tiles: WalletTile[] = household.accounts
    .filter((account) => account.active)
    .map((account) => {
      const balanceCents = accountBookBalance(household, account.id, today);
      const extra = tileSub(household, account, today);
      return {
        account,
        kind: account.kind,
        group: ACCOUNT_KIND_LABEL[account.kind],
        balanceCents,
        displayCents: isLiabilityKind(account.kind) ? -Math.abs(balanceCents) : balanceCents,
        ...extra,
      };
    });
  const groups = (["chequing", "savings", "credit", "investment", "receivable", "other"] as AccountKind[])
    .map((kind) => ({
      kind,
      label: ACCOUNT_KIND_LABEL[kind],
      tiles: tiles.filter((tile) => tile.kind === kind),
    }))
    .filter((group) => group.tiles.length);
  const cashCents = sumCents(tiles.filter((tile) => isCashLikeKind(tile.kind)).map((tile) => tile.balanceCents));
  const owedCents = sumCents(tiles.filter((tile) => isCreditKind(tile.kind)).map((tile) => Math.max(0, tile.balanceCents)));
  const receivableCents = sumCents(tiles.filter((tile) => isReceivableKind(tile.kind)).map((tile) => tile.balanceCents));
  const investedCostCents = sumCents(tiles.filter((tile) => isInvestmentKind(tile.kind)).map((tile) => tile.balanceCents));
  const markedValues = tiles
    .filter((tile) => tile.investment?.markedValueCents != null)
    .map((tile) => tile.investment!.markedValueCents!);
  const investedMarkedCents = markedValues.length ? sumCents(markedValues) : null;
  const hottestCard = tiles
    .map((tile) => tile.credit)
    .filter((row): row is CreditCardView => Boolean(row))
    .sort((left, right) => (right.utilization ?? 0) - (left.utilization ?? 0))[0] ?? null;
  return {
    tiles,
    groups,
    cashCents,
    owedCents,
    receivableCents,
    investedCostCents,
    investedMarkedCents,
    netWorthCents: cashCents + investedCostCents + receivableCents - owedCents,
    hottestCard,
  };
}

export function accountActivity(household: Household, accountId: string): Transaction[] {
  const seen = new Set<string>();
  const rows: Transaction[] = [];
  for (const tx of household.transactions) {
    if (seen.has(tx.id)) continue;
    const hit = tx.accountId === accountId
      || (tx.type === "transfer" && (tx.transferFromAccountId === accountId || tx.transferToAccountId === accountId));
    if (!hit) continue;
    seen.add(tx.id);
    rows.push(tx);
  }
  return rows.sort((left, right) => right.date.localeCompare(left.date) || right.createdAt.localeCompare(left.createdAt));
}

export function addFormDefaults(household: Household, focusedId?: string | null): {
  accountId: string;
  fromAccountId: string;
  toAccountId: string;
  suggestedMode: "expense" | "income" | "shift" | "transfer";
} {
  const active = household.accounts.filter((account) => account.active);
  const chequing = active.find((account) => account.kind === "chequing");
  const card = active.find((account) => account.kind === "credit");
  const focused = active.find((account) => account.id === focusedId) ?? card ?? chequing ?? active[0];
  if (!focused) {
    return { accountId: "", fromAccountId: "", toAccountId: "", suggestedMode: "expense" };
  }
  if (focused.kind === "credit") {
    return {
      accountId: focused.id,
      fromAccountId: chequing?.id ?? focused.id,
      toAccountId: focused.id,
      suggestedMode: "expense",
    };
  }
  if (focused.kind === "savings" || focused.kind === "investment") {
    return {
      accountId: focused.id,
      fromAccountId: chequing?.id ?? focused.id,
      toAccountId: focused.id,
      suggestedMode: "transfer",
    };
  }
  if (focused.kind === "other") {
    return {
      accountId: focused.id,
      fromAccountId: focused.id,
      toAccountId: chequing?.id ?? focused.id,
      suggestedMode: "shift",
    };
  }
  if (focused.kind === "receivable") {
    return {
      accountId: focused.id,
      fromAccountId: focused.id,
      toAccountId: chequing?.id ?? focused.id,
      suggestedMode: "transfer",
    };
  }
  return {
    accountId: focused.id,
    fromAccountId: focused.id,
    toAccountId: card?.id ?? focused.id,
    suggestedMode: "expense",
  };
}

export function formatApr(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

export { ACCOUNT_KIND_LABEL, ACCOUNT_KINDS, ACCOUNT_KIND_HINT, INVESTMENT_VEHICLES, accountLabel, accountOptionLabel, isCashLikeKind, isCreditKind, isInvestmentKind, isLiabilityKind, isReceivableKind, normalizeAccountKind, shapeAccount, shapeAccounts } from "./accountKinds.ts";
