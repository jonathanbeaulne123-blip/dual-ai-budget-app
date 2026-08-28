import { expenseEffect, incomeEffect } from "./budget.ts";
import { sumCents } from "./money.ts";
import { isLiabilityKind, normalizeAccountKind } from "./accountKinds.ts";
import { JOINT, ValidationError, type Account, type Environment, type Household, type Member, type Transaction, type Visibility } from "./types.ts";

export type AccountType = "asset" | "liability" | "equity" | "income" | "expense";
export type NormalBalance = "debit" | "credit";

export type ChartAccount = {
  id: string;
  code: string;
  name: string;
  accountType: AccountType;
  normalBalance: NormalBalance;
  source: "bank" | "category" | "equity";
  bankAccountId?: string;
  categoryId?: string;
  ownerMemberId?: string;
  active: boolean;
};

export type JournalLine = {
  id: string;
  lineNo: number;
  accountId: string;
  debitCents: number;
  creditCents: number;
  partyId: string;
  note: string;
};

export type JournalEntry = {
  id: string;
  date: string;
  memo: string;
  place: string;
  source: Transaction["source"] | "reversal" | "opening";
  sourceId?: string;
  originTransactionIds: string[];
  visibility: Visibility;
  createdBy: string;
  recognized: boolean;
  duplicateKey: string;
  lines: JournalLine[];
};

export type CompiledBooks = {
  householdId: string;
  name: string;
  environment: Environment;
  timezone: Household["timezone"];
  currency: Household["currency"];
  invitePhrase: string;
  linked: boolean;
  revision: number;
  lastCommittedAt: string | null;
  members: Member[];
  bankAccounts: Account[];
  chart: ChartAccount[];
  entries: JournalEntry[];
  shifts: Household["shifts"];
  recurrences: Household["recurrences"];
  goals: Household["goals"];
  budgetPlans: Household["budgetPlans"];
  categories: Household["categories"];
  activity: Household["activity"];
};

export type TrialBalanceRow = ChartAccount & {
  debitCents: number;
  creditCents: number;
  netCents: number;
  displayDebitCents: number;
  displayCreditCents: number;
};

export type TrialBalance = {
  rows: TrialBalanceRow[];
  totalDebitCents: number;
  totalCreditCents: number;
  inBalance: boolean;
};

export type BooksEquation = {
  assetCents: number;
  liabilityCents: number;
  incomeCents: number;
  expenseCents: number;
  openingEquityCents: number;
  netWorthCents: number;
  netIncomeCents: number;
  holds: boolean;
};

export type RegisterRow = {
  entryId: string;
  date: string;
  memo: string;
  debitCents: number;
  creditCents: number;
  runningCents: number;
  recognized: boolean;
};

const KIND_BASE: Record<Account["kind"], number> = {
  chequing: 1100,
  savings: 1200,
  other: 1300,
  receivable: 1320,
  investment: 1400,
  credit: 2100,
};

export function plAccountId(subcategoryId: string): string {
  return `PL-${subcategoryId}`;
}

function takeCode(used: Set<string>, preferred: number): string {
  let n = preferred;
  while (used.has(String(n))) n += 1;
  used.add(String(n));
  return String(n);
}

export function buildChart(household: Household): ChartAccount[] {
  const used = new Set<string>();
  const chart: ChartAccount[] = [];
  const kindCount: Record<Account["kind"], number> = { chequing: 0, savings: 0, other: 0, receivable: 0, investment: 0, credit: 0 };

  for (const account of household.accounts) {
    const kind = normalizeAccountKind(account.kind);
    const offset = kindCount[kind];
    kindCount[kind] += 1;
    const accountType: AccountType = isLiabilityKind(kind) ? "liability" : "asset";
    chart.push({
      id: account.id,
      code: takeCode(used, KIND_BASE[kind] + offset * 10),
      name: account.name,
      accountType,
      normalBalance: accountType === "asset" ? "debit" : "credit",
      source: "bank",
      bankAccountId: account.id,
      ownerMemberId: account.ownerMemberId,
      active: account.active,
    });
  }

  chart.push({
    id: "EQ-OPENING",
    code: takeCode(used, 3000),
    name: "Opening equity",
    accountType: "equity",
    normalBalance: "credit",
    source: "equity",
    active: true,
  });

  chart.push({
    id: "EQ-RETAINED",
    code: takeCode(used, 3900),
    name: "Retained earnings",
    accountType: "equity",
    normalBalance: "credit",
    source: "equity",
    active: true,
  });

  for (const category of household.categories.filter((item) => item.recordType === "category")) {
    const income = category.transactionType === "income";
    chart.push({
      id: plAccountId(category.id),
      code: takeCode(used, (income ? 4000 : 5000) + category.sortOrder),
      name: category.name,
      accountType: income ? "income" : "expense",
      normalBalance: income ? "credit" : "debit",
      source: "category",
      categoryId: category.id,
      active: category.active,
    });
  }

  return chart;
}

function pushSigned(lines: Omit<JournalLine, "id" | "lineNo">[], accountId: string, signedDebit: number, partyId: string, note: string) {
  if (signedDebit === 0) return;
  if (signedDebit > 0) {
    lines.push({ accountId, debitCents: signedDebit, creditCents: 0, partyId, note });
    return;
  }
  lines.push({ accountId, debitCents: 0, creditCents: -signedDebit, partyId, note });
}

function finishEntry(draft: Omit<JournalEntry, "lines"> & { lines: Omit<JournalLine, "id" | "lineNo">[] }): JournalEntry | null {
  if (draft.lines.length === 0) return null;
  const debit = sumCents(draft.lines.map((line) => line.debitCents));
  const credit = sumCents(draft.lines.map((line) => line.creditCents));
  if (debit !== credit) {
    throw new ValidationError(`Journal ${draft.id} is out of balance (debit ${debit}, credit ${credit}).`);
  }
  if (debit === 0) return null;
  return {
    ...draft,
    lines: draft.lines.map((line, index) => ({
      ...line,
      lineNo: index + 1,
      id: `${draft.id}-L${String(index + 1).padStart(2, "0")}`,
    })),
  };
}

function accountName(household: Household, accountId: string | undefined): string {
  return household.accounts.find((account) => account.id === accountId)?.name ?? accountId ?? "account";
}

function compileTransfer(household: Household, tx: Transaction, pair: Transaction | undefined): JournalEntry | null {
  const fromId = tx.transferFromAccountId || pair?.transferFromAccountId || tx.accountId;
  const toId = tx.transferToAccountId || pair?.transferToAccountId || pair?.accountId;
  if (!fromId || !toId || fromId === toId) {
    throw new ValidationError(`${tx.id} cannot post to the books: the transfer is missing two accounts.`);
  }
  const origin = [tx.id, pair?.id].filter((id): id is string => Boolean(id));
  origin.sort();
  const lines: Omit<JournalLine, "id" | "lineNo">[] = [];
  pushSigned(lines, toId, tx.amountCents, JOINT, "");
  pushSigned(lines, fromId, -tx.amountCents, JOINT, "");
  return finishEntry({
    id: `JE-${origin[0]}`,
    date: tx.date,
    memo: tx.note || `Transfer · ${accountName(household, fromId)} → ${accountName(household, toId)}`,
    place: tx.place,
    source: tx.reversalOfId ? "reversal" : tx.source,
    sourceId: tx.sourceId,
    originTransactionIds: origin,
    visibility: tx.visibility,
    createdBy: tx.createdBy,
    recognized: !(tx.isDuplicate || pair?.isDuplicate),
    duplicateKey: tx.duplicateKey,
    lines,
  });
}

function compileOpening(household: Household, tx: Transaction): JournalEntry | null {
  if (tx.type !== "opening") throw new ValidationError(`${tx.id} is not an opening row.`);
  if (tx.amountCents <= 0) return null;
  const bank = household.accounts.find((account) => account.id === tx.accountId);
  if (!bank) throw new ValidationError(`${tx.id} points at a missing opening account.`);
  const liability = isLiabilityKind(normalizeAccountKind(bank.kind));
  const direction = tx.reversalOfId ? -1 : 1;
  const party = tx.splits[0]?.party || JOINT;
  const lines: Omit<JournalLine, "id" | "lineNo">[] = [];
  pushSigned(lines, bank.id, (liability ? -1 : 1) * tx.amountCents * direction, party, "");
  pushSigned(lines, "EQ-OPENING", (liability ? 1 : -1) * tx.amountCents * direction, party, "");
  return finishEntry({
    id: `JE-${tx.id}`,
    date: tx.date,
    memo: tx.note || `Opening - ${bank.name}`,
    place: tx.place,
    source: tx.reversalOfId ? "reversal" : "opening",
    sourceId: tx.sourceId,
    originTransactionIds: [tx.id],
    visibility: tx.visibility,
    createdBy: tx.createdBy,
    recognized: !tx.isDuplicate,
    duplicateKey: tx.duplicateKey,
    lines,
  });
}

function compileDocument(tx: Transaction): JournalEntry | null {
  const pl = tx.subcategoryId ? plAccountId(tx.subcategoryId) : "";
  if (!pl) throw new ValidationError(`${tx.id} cannot post to the books: it has no category.`);
  let plSign = 0;
  let bankSign = 0;
  if (tx.type === "expense") {
    plSign = 1;
    bankSign = -1;
  } else if (tx.type === "income" || tx.type === "refund") {
    plSign = -1;
    bankSign = 1;
  } else {
    throw new ValidationError(`${tx.id} cannot post to the books.`);
  }
  if (tx.reversalOfId) {
    plSign *= -1;
    bankSign *= -1;
  }
  const splits = tx.splits.length ? tx.splits : [{ party: JOINT, amountCents: tx.amountCents }];
  const lines: Omit<JournalLine, "id" | "lineNo">[] = [];
  for (const split of splits) {
    pushSigned(lines, pl, split.amountCents * plSign, split.party, "");
  }
  pushSigned(lines, tx.accountId, tx.amountCents * bankSign, JOINT, "");
  return finishEntry({
    id: `JE-${tx.id}`,
    date: tx.date,
    memo: tx.note || tx.type,
    place: tx.place,
    source: tx.reversalOfId ? "reversal" : tx.source,
    sourceId: tx.sourceId,
    originTransactionIds: [tx.id],
    visibility: tx.visibility,
    createdBy: tx.createdBy,
    recognized: !tx.isDuplicate,
    duplicateKey: tx.duplicateKey,
    lines,
  });
}

export function compileHousehold(household: Household): CompiledBooks {
  const chart = buildChart(household);
  const known = new Set(chart.map((account) => account.id));
  const transactionsById = new Map(household.transactions.map((transaction) => [transaction.id, transaction]));
  const entries: JournalEntry[] = [];
  const seen = new Set<string>();

  for (const tx of household.transactions) {
    if (seen.has(tx.id)) continue;
    let entry: JournalEntry | null = null;
    if (tx.type === "opening") {
      seen.add(tx.id);
      entry = compileOpening(household, tx);
    } else if (tx.type === "transfer") {
      const pair = tx.transferPairId
        ? transactionsById.get(tx.transferPairId)
        : undefined;
      if (pair) seen.add(pair.id);
      seen.add(tx.id);
      entry = compileTransfer(household, tx, pair);
    } else {
      seen.add(tx.id);
      entry = compileDocument(tx);
    }
    if (!entry) continue;
    for (const line of entry.lines) {
      if (!known.has(line.accountId)) {
        throw new ValidationError(`Journal ${entry.id} posts to unknown account ${line.accountId}.`);
      }
    }
    entries.push(entry);
  }

  entries.sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id));
  return {
    householdId: household.householdId,
    name: household.name,
    environment: household.environment,
    timezone: household.timezone,
    currency: household.currency,
    invitePhrase: household.inviteCode,
    linked: household.linked,
    revision: household.revision,
    lastCommittedAt: household.lastCommittedAt,
    members: household.members,
    bankAccounts: household.accounts,
    chart,
    entries,
    shifts: household.shifts,
    recurrences: household.recurrences,
    goals: household.goals,
    budgetPlans: household.budgetPlans,
    categories: household.categories,
    activity: household.activity,
  };
}

export function trialBalance(books: CompiledBooks, options: { recognizedOnly?: boolean } = {}): TrialBalance {
  const recognizedOnly = options.recognizedOnly ?? true;
  const totals = new Map<string, { debit: number; credit: number }>();
  for (const entry of books.entries) {
    if (recognizedOnly && !entry.recognized) continue;
    for (const line of entry.lines) {
      const current = totals.get(line.accountId) ?? { debit: 0, credit: 0 };
      current.debit += line.debitCents;
      current.credit += line.creditCents;
      totals.set(line.accountId, current);
    }
  }
  const rows: TrialBalanceRow[] = books.chart.map((account) => {
    const current = totals.get(account.id) ?? { debit: 0, credit: 0 };
    const netCents = current.debit - current.credit;
    return {
      ...account,
      debitCents: current.debit,
      creditCents: current.credit,
      netCents,
      displayDebitCents: netCents > 0 ? netCents : 0,
      displayCreditCents: netCents < 0 ? -netCents : 0,
    };
  }).filter((row) => row.debitCents !== 0 || row.creditCents !== 0 || row.source === "bank");

  const totalDebitCents = sumCents(rows.map((row) => row.displayDebitCents));
  const totalCreditCents = sumCents(rows.map((row) => row.displayCreditCents));
  return {
    rows,
    totalDebitCents,
    totalCreditCents,
    inBalance: totalDebitCents === totalCreditCents,
  };
}

export function booksEquation(books: CompiledBooks): BooksEquation {
  const tb = trialBalance(books, { recognizedOnly: true });
  let assetCents = 0;
  let liabilityCents = 0;
  let incomeCents = 0;
  let expenseCents = 0;
  let openingEquityCents = 0;
  for (const row of tb.rows) {
    if (row.accountType === "asset") assetCents += row.netCents;
    if (row.accountType === "liability") liabilityCents += -row.netCents;
    if (row.accountType === "income") incomeCents += -row.netCents;
    if (row.accountType === "expense") expenseCents += row.netCents;
    if (row.accountType === "equity") openingEquityCents += -row.netCents;
  }
  const netWorthCents = assetCents - liabilityCents;
  const netIncomeCents = incomeCents - expenseCents;
  return {
    assetCents,
    liabilityCents,
    incomeCents,
    expenseCents,
    openingEquityCents,
    netWorthCents,
    netIncomeCents,
    holds: assetCents === liabilityCents + openingEquityCents + netIncomeCents,
  };
}

export function snapshotPnL(household: Household): { incomeCents: number; expenseCents: number } {
  return {
    incomeCents: sumCents(household.transactions.map(incomeEffect)),
    expenseCents: sumCents(household.transactions.map(expenseEffect)),
  };
}

export function accountRegister(books: CompiledBooks, accountId: string, options: { recognizedOnly?: boolean } = {}): RegisterRow[] {
  const account = books.chart.find((item) => item.id === accountId);
  if (!account) return [];
  const recognizedOnly = options.recognizedOnly ?? true;
  const sign = account.normalBalance === "debit" ? 1 : -1;
  let running = 0;
  const rows: RegisterRow[] = [];
  for (const entry of books.entries) {
    if (recognizedOnly && !entry.recognized) continue;
    for (const line of entry.lines) {
      if (line.accountId !== accountId) continue;
      running += sign * (line.debitCents - line.creditCents);
      rows.push({
        entryId: entry.id,
        date: entry.date,
        memo: entry.memo,
        debitCents: line.debitCents,
        creditCents: line.creditCents,
        runningCents: running,
        recognized: entry.recognized,
      });
    }
  }
  return rows;
}

export type BooksFinding = { section: string; message: string; id?: string };

export function booksFindings(household: Household): BooksFinding[] {
  const findings: BooksFinding[] = [];
  try {
    const books = compileHousehold(household);
    const tb = trialBalance(books, { recognizedOnly: false });
    if (!tb.inBalance) {
      findings.push({
        section: "Books",
        message: `Trial balance is off by ${Math.abs(tb.totalDebitCents - tb.totalCreditCents)} cents.`,
      });
    }
    const equation = booksEquation(books);
    if (!equation.holds) {
      findings.push({
        section: "Books",
        message: `Net worth ${equation.netWorthCents} does not equal opening equity ${equation.openingEquityCents} plus retained net income ${equation.netIncomeCents}.`,
      });
    }
    const snapshot = snapshotPnL(household);
    if (equation.incomeCents !== snapshot.incomeCents) {
      findings.push({
        section: "Books",
        message: `Income on the books (${equation.incomeCents}) does not match the household snapshot (${snapshot.incomeCents}).`,
      });
    }
    if (equation.expenseCents !== snapshot.expenseCents) {
      findings.push({
        section: "Books",
        message: `Expenses on the books (${equation.expenseCents}) do not match the household snapshot (${snapshot.expenseCents}).`,
      });
    }
  } catch (caught) {
    findings.push({
      section: "Books",
      message: caught instanceof Error ? caught.message : String(caught),
    });
  }
  return findings;
}
