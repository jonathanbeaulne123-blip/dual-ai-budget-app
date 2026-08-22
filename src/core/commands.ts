import { TIMEZONE, todayKey, monthKeyFromDateKey, type DateKey, type MonthKey } from "./calendar.ts";
import { advanceCadence, DEFAULT_REMINDER_HOURS_BEFORE, EMPTY_CALENDAR, inferRecurrenceKind } from "./recurrence.ts";
import { detectRhythms } from "./rhythm.ts";
import { CURRENCY, parseWholeCents } from "./money.ts";
import { nextId, nowIso, randomHouseholdId, randomInviteCode, slug, uniquePrefixedId } from "./ids.ts";
import { cloneHousehold } from "./household.ts";
import { duplicateKey, describeSimilarMatches, findSimilarTransactions, refreshDuplicateFlags } from "./duplicate.ts";
import { jointSplit } from "./splits.ts";
import { calcShiftAmounts, parseShiftInput, shiftSettingsFingerprint, DEFAULT_SHIFT_SETTINGS } from "./shift.ts";
import {
  incomeSubcategory,
  parseAmount,
  parseDate,
  requireAccount,
  requireCadAccounts,
  requireMember,
  requireSubcategory,
  requireTimezone,
  validateOwnedAmount as catalogValidateOwned,
} from "./catalog.ts";
import { shapeAccount, normalizeAccountKind, emptyCreditDesk } from "./accountKinds.ts";
import { creditCardView, savingsView } from "./accounts.ts";
import { sitDownPreview } from "./insights.ts";
import { bookBalanceAsOf, isMonthClosed } from "./statements.ts";
import { COSMETIC_BY_ID, isCosmeticUnlocked } from "./companion.ts";
import { EMPTY_KITCHEN, MAX_CHALK_CHARS, MAX_CHALK_NOTES, MAX_COMPANION_NAME, MAX_HERCULES_CHAT_CHARS, MAX_HERCULES_CHATS, MAX_HERCULES_MEMORIES, MAX_HERCULES_MEMORY_CHARS, closedPeriodId, isCosmeticSlot, shapeKitchen } from "./kitchen.ts";
import {
  EMPTY_GOOGLE,
  findActiveGoogleLink,
  findActiveGoogleLinkByEmail,
  findActiveGoogleLinkBySubject,
  googleLinkTombstoneId,
  shapeGoogle,
  uniqueGoogleServices,
} from "./google.ts";
import { mergeTombstones } from "./sync.ts";
import { parseVisibility, visibleForDuplicateScan } from "./visibility.ts";
import { savedCentsFromContributions } from "./goals.ts";
import type {
  AccountKind,
  Activity,
  BudgetPlan,
  Category,
  CommitResult,
  CreditRewardRule,
  Household,
  HerculesMemoryKind,
  HerculesTalkSource,
  InvestmentVehicle,
  Recurrence,
  RecurrenceKind,
  RecurrenceOrigin,
  Split,
  Transaction,
  UndoToken,
  Visibility,
} from "./types.ts";
import { NeedsConfirmationError, ValidationError } from "./types.ts";

export type ActorInput = {
  createdBy?: string;
  visibility?: Visibility;
};

function requireOpenPeriod(household: Household, date: DateKey, confirmed?: boolean): void {
  const monthKey = monthKeyFromDateKey(date);
  if (!isMonthClosed(household, monthKey)) return;
  if (confirmed) return;
  throw new NeedsConfirmationError(
    "closedMonth",
    `${monthKey} is closed. Posting into a closed month restates the period. Confirm if you mean it.`,
  );
}

function resolveActor(household: Household, input?: ActorInput, fallbackMemberId?: string): { createdBy: string; visibility: Visibility } {
  const visibility = parseVisibility(input?.visibility);
  const createdBy = input?.createdBy || fallbackMemberId || household.members.find((member) => member.active)?.id;
  if (!createdBy) throw new ValidationError("Add a household member before posting.");
  requireMember(household, createdBy);
  return { createdBy, visibility };
}

function commit(previous: Household, next: Household, action: string, summary: string, postedIds: string[], warnings: string[] = []): CommitResult {
  requireTimezone(next);
  requireCadAccounts(next);
  next.transactions = refreshDuplicateFlags(next.transactions);
  next.lastCommittedAt = nowIso();
  const activity: Activity = {
    id: nextId("ACT-", next.activity.map((item) => item.id), 6),
    at: next.lastCommittedAt,
    action,
    summary,
    updatedAt: next.lastCommittedAt,
  };
  next.activity = [...next.activity, activity].slice(-200);
  return {
    household: next,
    warnings,
    postedIds,
    undo: { id: activity.id, label: summary, snapshot: previous, postedIds: [...postedIds] },
  };
}

function baseTx(household: Household, input: {
  date: DateKey;
  type: Transaction["type"];
  amountCents: number;
  accountId: string;
  categoryId: string | null;
  subcategoryId: string | null;
  note: string;
  place?: string;
  splits: Split[];
  source: Transaction["source"];
  sourceId?: string;
  transferPairId?: string;
  refundOfId?: string;
  createdAt: string;
  createdBy: string;
  visibility: Visibility;
}): Transaction {
  const account = requireAccount(household, input.accountId);
  return {
    id: "",
    date: input.date,
    type: input.type,
    amountCents: input.amountCents,
    currency: account.currency,
    accountId: account.id,
    categoryId: input.categoryId,
    subcategoryId: input.subcategoryId,
    note: input.note.trim(),
    place: (input.place ?? "").trim(),
    splits: input.splits,
    transferPairId: input.transferPairId,
    refundOfId: input.refundOfId,
    source: input.source,
    sourceId: input.sourceId,
    duplicateKey: duplicateKey({
      date: input.date,
      amountCents: input.amountCents,
      accountId: account.id,
      type: input.type,
      note: input.note,
      place: input.place,
    }),
    potentialDuplicate: false,
    isDuplicate: false,
    reviewed: true,
    createdBy: input.createdBy,
    visibility: input.visibility,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  };
}

export function postEntry(household: Household, input: {
  date: string;
  type: "expense" | "income" | "refund";
  amount: string | number;
  accountId: string;
  subcategoryId: string;
  note?: string;
  place?: string;
  splits?: Split[];
  confirmDuplicate?: boolean;
  confirmClosedMonth?: boolean;
  refundOfId?: string;
  source?: Transaction["source"];
  sourceId?: string;
  createdBy?: string;
  visibility?: Visibility;
}): CommitResult {
  requireTimezone(household);
  const date = parseDate(input.date);
  const amountCents = parseAmount(input.amount);
  const actor = resolveActor(household, input);
  requireOpenPeriod(household, date, input.confirmClosedMonth);
  const subcategory = requireSubcategory(
    household,
    input.subcategoryId,
    input.type === "refund" ? "expense" : input.type,
  );
  const splits = catalogValidateOwned(input.splits ?? jointSplit(amountCents), amountCents, household);
  if (input.type === "refund" && input.refundOfId) {
    const original = household.transactions.find((tx) => tx.id === input.refundOfId);
    if (!original) throw new ValidationError("The original expense for this refund no longer exists.");
    if (original.type !== "expense") throw new ValidationError("Refunds can only reverse an expense.");
  }
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const createdAt = nowIso();
  const draft = baseTx(next, {
    date,
    type: input.type,
    amountCents,
    accountId: input.accountId,
    categoryId: subcategory.parentId,
    subcategoryId: subcategory.id,
    note: input.note ?? "",
    place: input.place ?? "",
    splits,
    source: input.source ?? "manual",
    sourceId: input.sourceId,
    refundOfId: input.refundOfId,
    createdAt,
    createdBy: actor.createdBy,
    visibility: actor.visibility,
  });
  const matches = findSimilarTransactions(next.transactions.filter((tx) => visibleForDuplicateScan(tx, actor.createdBy)), {
    date: draft.date,
    amountCents: draft.amountCents,
    accountId: draft.accountId,
    type: draft.type,
    note: draft.note,
    place: draft.place,
    subcategoryId: draft.subcategoryId,
    source: draft.source,
    sourceId: draft.sourceId,
  });
  if (matches.length && !input.confirmDuplicate) {
    throw new NeedsConfirmationError("duplicate", describeSimilarMatches(matches), matches.map((match) => match.transaction));
  }
  draft.id = nextId(input.type === "income" ? "TXN-IN-" : input.type === "refund" ? "TXN-RF-" : "TXN-EX-", next.transactions.map((tx) => tx.id));
  next.transactions.push(draft);
  const warnings = matches.length ? ["Saved with a duplicate fingerprint. Review it when you have a moment."] : [];
  return commit(previous, next, input.type === "income" ? "Add Income" : input.type === "refund" ? "Add Refund" : "Add Expense", `${draft.id}: ${input.type} $${(amountCents / 100).toFixed(2)} (${subcategory.name}) on ${date}`, [draft.id], warnings);
}

export function postTransfer(household: Household, input: {
  date: string;
  amount: string | number;
  fromAccountId: string;
  toAccountId: string;
  note?: string;
  confirmDuplicate?: boolean;
  confirmClosedMonth?: boolean;
  createdBy?: string;
  visibility?: Visibility;
}): CommitResult {
  requireTimezone(household);
  const date = parseDate(input.date);
  const amountCents = parseAmount(input.amount);
  const actor = resolveActor(household, input);
  requireOpenPeriod(household, date, input.confirmClosedMonth);
  if (input.fromAccountId === input.toAccountId) throw new ValidationError("Choose two different accounts to move money.");
  requireAccount(household, input.fromAccountId);
  requireAccount(household, input.toAccountId);
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const createdAt = nowIso();
  const note = input.note ?? "Transfer";
  const outDraft = baseTx(next, {
    date,
    type: "transfer",
    amountCents,
    accountId: input.fromAccountId,
    categoryId: null,
    subcategoryId: null,
    note,
    splits: jointSplit(amountCents),
    source: "manual",
    createdAt,
    createdBy: actor.createdBy,
    visibility: actor.visibility,
  });
  const inDraft = baseTx(next, {
    date,
    type: "transfer",
    amountCents,
    accountId: input.toAccountId,
    categoryId: null,
    subcategoryId: null,
    note,
    splits: jointSplit(amountCents),
    source: "manual",
    createdAt,
    createdBy: actor.createdBy,
    visibility: actor.visibility,
  });
  const matches = findSimilarTransactions(next.transactions.filter((tx) => visibleForDuplicateScan(tx, actor.createdBy)), {
    date: outDraft.date,
    amountCents: outDraft.amountCents,
    accountId: outDraft.accountId,
    type: "transfer",
    note: outDraft.note,
    place: outDraft.place,
    source: "manual",
  });
  if (matches.length && !input.confirmDuplicate) {
    throw new NeedsConfirmationError("duplicate", describeSimilarMatches(matches), matches.map((match) => match.transaction));
  }
  outDraft.id = nextId("TXN-TR-", next.transactions.map((tx) => tx.id));
  inDraft.id = nextId("TXN-TR-", [...next.transactions.map((tx) => tx.id), outDraft.id]);
  outDraft.transferPairId = inDraft.id;
  inDraft.transferPairId = outDraft.id;
  outDraft.transferFromAccountId = input.fromAccountId;
  outDraft.transferToAccountId = input.toAccountId;
  inDraft.transferFromAccountId = input.fromAccountId;
  inDraft.transferToAccountId = input.toAccountId;
  next.transactions.push(outDraft, inDraft);
  return commit(previous, next, "Transfer", `Moved $${(amountCents / 100).toFixed(2)} on ${date}`, [outDraft.id, inDraft.id]);
}

export function postShift(household: Household, input: {
  date: string;
  memberId: string;
  accountId: string;
  sales?: string | number;
  cashTips?: string | number;
  ccTips?: string | number;
  hours: string | number;
  settingsFingerprint?: string;
  confirmDuplicate?: boolean;
  confirmClosedMonth?: boolean;
  createdBy?: string;
  visibility?: Visibility;
}): CommitResult {
  requireTimezone(household);
  const parsed = parseShiftInput({ ...input, timeZone: household.timezone });
  const member = requireMember(household, input.memberId);
  const actor = resolveActor(household, input, member.id);
  requireOpenPeriod(household, parsed.date, input.confirmClosedMonth);
  const account = requireAccount(household, input.accountId);
  const wagesCat = incomeSubcategory(household, "Wages");
  const tipsCat = incomeSubcategory(household, "Tips");
  const settings = household.shiftSettings;
  const fingerprint = shiftSettingsFingerprint(settings);
  if (input.settingsFingerprint && input.settingsFingerprint !== fingerprint) {
    throw new NeedsConfirmationError("settingsChanged", "Tip rules changed since the preview. Review the new amounts before posting.", [], calcShiftAmounts(parsed, settings));
  }
  const amounts = calcShiftAmounts(parsed, settings);
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const sameDay = next.shifts.filter((shift) => shift.memberId === member.id && shift.date === parsed.date);
  if (sameDay.length && !input.confirmDuplicate) {
    throw new NeedsConfirmationError(
      "sameShiftDay",
      `${member.name} already has a shift on ${parsed.date}. Double shifts are allowed — add this one too?`,
    );
  }
  const createdAt = nowIso();
  const shiftId = nextId("SHIFT-", next.shifts.map((shift) => shift.id));
  const wagesTx = baseTx(next, {
    date: parsed.date,
    type: "income",
    amountCents: amounts.wagesCents,
    accountId: account.id,
    categoryId: wagesCat.parentId,
    subcategoryId: wagesCat.id,
    note: `Wages — ${member.name}`,
    splits: [{ party: member.id, amountCents: amounts.wagesCents }],
    source: "shift",
    sourceId: shiftId,
    createdAt,
    createdBy: actor.createdBy,
    visibility: actor.visibility,
  });
  const tipsTx = baseTx(next, {
    date: parsed.date,
    type: "income",
    amountCents: amounts.netTipsCents,
    accountId: account.id,
    categoryId: tipsCat.parentId,
    subcategoryId: tipsCat.id,
    note: `Tips — ${member.name}`,
    splits: [{ party: member.id, amountCents: amounts.netTipsCents }],
    source: "shift",
    sourceId: shiftId,
    createdAt,
    createdBy: actor.createdBy,
    visibility: actor.visibility,
  });
  wagesTx.id = nextId("TXN-IN-", next.transactions.map((tx) => tx.id));
  tipsTx.id = nextId("TXN-IN-", [...next.transactions.map((tx) => tx.id), wagesTx.id]);
  next.transactions.push(wagesTx, tipsTx);
  next.shifts.push({
    id: shiftId,
    date: parsed.date,
    memberId: member.id,
    accountId: account.id,
    salesCents: parsed.salesCents,
    cashTipsCents: parsed.cashTipsCents,
    ccTipsCents: parsed.ccTipsCents,
    hours: parsed.hours,
    ...amounts,
    settings,
    settingsFingerprint: fingerprint,
    wagesTransactionId: wagesTx.id,
    tipsTransactionId: tipsTx.id,
    createdBy: actor.createdBy,
    visibility: actor.visibility,
    createdAt,
    updatedAt: createdAt,
  });
  const warnings = [];
  if (amounts.netTipsCents < 0) warnings.push("Net tips are negative after tip-out. The shift was still saved.");
  return commit(previous, next, "Add Shift", `${shiftId}: ${member.name} on ${parsed.date}`, [shiftId, wagesTx.id, tipsTx.id], warnings);
}

export function addCategory(household: Household, input: {
  name: string;
  type: "expense" | "income";
  parentId?: string;
  newGroupName?: string;
  essential?: boolean;
  incomeStability?: "fixed" | "variable";
  monthlyBudget?: string | number;
  monthKey?: MonthKey;
}): CommitResult {
  requireTimezone(household);
  const name = input.name.trim();
  if (!name) throw new ValidationError("Please fill in a name.");
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const existingIds = next.categories.map((category) => category.id);
  let parentId = input.parentId ?? "";
  let sortOrder = next.categories.reduce((max, category) => Math.max(max, category.sortOrder), 0);
  if (input.type === "income") {
    const income = next.categories.find((category) => category.recordType === "group" && category.transactionType === "income");
    if (!income) throw new ValidationError("The Income group is missing. Run Health Check.");
    parentId = income.id;
  } else if (parentId === "__new__" || !parentId) {
    const groupName = (input.newGroupName ?? name).trim();
    if (!groupName) throw new ValidationError("Please name the new category group.");
    sortOrder += 10;
    const groupId = uniquePrefixedId(`CAT-${slug(groupName)}`, existingIds);
    const at = nowIso();
    next.categories.push({
      id: groupId,
      parentId: null,
      recordType: "group",
      name: groupName,
      transactionType: "expense",
      essential: false,
      incomeStability: null,
      active: true,
      sortOrder,
      createdAt: at,
      updatedAt: at,
    });
    existingIds.push(groupId);
    parentId = groupId;
  }
  const parent = next.categories.find((category) => category.id === parentId && category.recordType === "group" && category.active);
  if (!parent) throw new ValidationError("Please choose a category group.");
  if (parent.transactionType !== input.type) throw new ValidationError("That group does not match Income/Expense.");
  const subId = uniquePrefixedId(`SUB-${slug(parent.name)}-${slug(name)}`, [...existingIds, parentId]);
  const at = nowIso();
  const category: Category = {
    id: subId,
    parentId,
    recordType: "category",
    name,
    transactionType: input.type,
    essential: input.type === "expense" ? Boolean(input.essential) : false,
    incomeStability: input.type === "income" ? input.incomeStability ?? "fixed" : input.type === "expense" ? input.incomeStability ?? "variable" : null,
    active: true,
    sortOrder: sortOrder + 1,
    createdAt: at,
    updatedAt: at,
  };
  next.categories.push(category);
  const posted = [subId];
  if (input.monthlyBudget !== undefined && input.monthlyBudget !== "" && Number(input.monthlyBudget) > 0) {
    const amountCents = parseAmount(input.monthlyBudget, "Monthly budget");
    const monthKey = input.monthKey ?? todayKey().slice(0, 7);
    const plan = seedBudgetPlan(next, monthKey, category, amountCents);
    next.budgetPlans.push(plan);
    posted.push(plan.id);
  }
  return commit(previous, next, "Add Category", `Added ${name}`, posted);
}

function seedBudgetPlan(household: Household, monthKey: MonthKey, category: Category, amountCents: number): BudgetPlan {
  const at = nowIso();
  return {
    id: nextId(`BUD-${monthKey.replace("-", "")}-`, household.budgetPlans.map((plan) => plan.id), 3),
    monthKey,
    subcategoryId: category.id,
    amountCents,
    essential: category.essential,
    incomeStability: category.incomeStability,
    active: true,
    createdAt: at,
    updatedAt: at,
  };
}

export function setBudget(household: Household, input: { monthKey: MonthKey; subcategoryId: string; amount: string | number }): CommitResult {
  requireTimezone(household);
  const amountCents = parseAmount(input.amount, "Budgeted amount");
  const category = requireSubcategory(household, input.subcategoryId);
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const existing = next.budgetPlans.find((plan) => plan.monthKey === input.monthKey && plan.subcategoryId === input.subcategoryId && plan.active);
  if (existing) {
    existing.amountCents = amountCents;
    existing.updatedAt = nowIso();
  } else next.budgetPlans.push(seedBudgetPlan(next, input.monthKey, category, amountCents));
  return commit(previous, next, "Set Budget", `${category.name} ${input.monthKey} → $${(amountCents / 100).toFixed(2)}`, []);
}

function parseBps(value: string | number | undefined, label: string, fallback = 0): number {
  if (value === undefined || value === null || value === "") return fallback;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(n) || n < 0 || n > 80) throw new ValidationError(`${label} must be a rate between 0 and 80%.`);
  return Math.round(n * 100);
}

function parseLimitCents(value: string | number | undefined, label: string): number {
  if (value === undefined || value === null || value === "") return 0;
  try {
    return parseWholeCents(value, label, { allowZero: true });
  } catch (error) {
    throw new ValidationError(error instanceof Error ? error.message : String(error));
  }
}

function requireIncomeNamed(household: Household, name: string): { household: Household; subcategoryId: string } {
  const found = household.categories.find((category) => (
    category.active
    && category.recordType === "category"
    && category.transactionType === "income"
    && category.name.toLowerCase() === name.toLowerCase()
  ));
  if (found) return { household, subcategoryId: found.id };
  const added = addCategory(household, { name, type: "income", incomeStability: "variable" });
  const created = added.household.categories.find((category) => category.id === added.postedIds[0]);
  if (!created) throw new ValidationError(`Could not add the ${name} income category.`);
  return { household: added.household, subcategoryId: created.id };
}

function requireExpenseNamed(household: Household, name: string, groupName = "Debt"): { household: Household; subcategoryId: string } {
  const found = household.categories.find((category) => (
    category.active
    && category.recordType === "category"
    && category.transactionType === "expense"
    && category.name.toLowerCase() === name.toLowerCase()
  ));
  if (found) return { household, subcategoryId: found.id };
  const group = household.categories.find((category) => (
    category.recordType === "group" && category.transactionType === "expense" && category.name.toLowerCase() === groupName.toLowerCase()
  ));
  const added = addCategory(household, {
    name,
    type: "expense",
    parentId: group?.id,
    newGroupName: group ? undefined : groupName,
    essential: true,
    incomeStability: "variable",
  });
  const created = added.household.categories.find((category) => category.id === added.postedIds[0]);
  if (!created) throw new ValidationError(`Could not add the ${name} category.`);
  return { household: added.household, subcategoryId: created.id };
}

export function addAccount(household: Household, input: {
  name: string;
  kind: AccountKind | string;
  ownerMemberId?: string;
  institution?: string;
  last4?: string;
  creditLimit?: string | number;
  aprPercent?: string | number;
  statementDay?: number;
  dueDaysAfterStatement?: number;
  cashbackPercent?: string | number;
  groceryCashbackPercent?: string | number;
  apyPercent?: string | number;
  vehicle?: InvestmentVehicle;
}): CommitResult {
  requireTimezone(household);
  const name = input.name.trim();
  if (name.length < 2) throw new ValidationError("Give the account a name with at least two letters.");
  const kind = normalizeAccountKind(input.kind);
  if (input.ownerMemberId && input.ownerMemberId !== "joint") requireMember(household, input.ownerMemberId);
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const id = uniquePrefixedId(`ACC-${slug(name)}`, next.accounts.map((account) => account.id));
  const grocery = household.categories.find((category) => category.id === "SUB-FOOD-GROCERIES");
  const rules: CreditRewardRule[] = [];
  if (kind === "credit" && input.groceryCashbackPercent !== undefined && grocery) {
    rules.push({
      id: "RULE-GROCERIES",
      label: "Groceries",
      subcategoryId: grocery.id,
      bps: parseBps(input.groceryCashbackPercent, "Grocery cashback"),
    });
  }
  const at = nowIso();
  const draft = shapeAccount({
    id,
    name,
    kind,
    currency: CURRENCY,
    active: true,
    ownerMemberId: input.ownerMemberId || "joint",
    institution: input.institution ?? "",
    last4: input.last4 ?? "",
    sortOrder: (next.accounts.reduce((max, account) => Math.max(max, account.sortOrder), 0) || 0) + 10,
    credit: kind === "credit"
      ? {
        ...emptyCreditDesk(),
        creditLimitCents: parseLimitCents(input.creditLimit, "Credit limit"),
        aprBps: parseBps(input.aprPercent, "APR", 1999),
        statementDay: Math.min(28, Math.max(1, Math.round(Number(input.statementDay || 21)))),
        dueDaysAfterStatement: Math.min(30, Math.max(1, Math.round(Number(input.dueDaysAfterStatement || 21)))),
        defaultCashbackBps: parseBps(input.cashbackPercent, "Cashback", 100),
        rules,
      }
      : null,
    savings: kind === "savings" ? { apyBps: parseBps(input.apyPercent, "APY") } : null,
    investment: kind === "investment" ? { vehicle: input.vehicle ?? "tfsa", markedValueCents: null, markedAt: null } : null,
    createdAt: at,
    updatedAt: at,
  }, next.accounts.length);
  next.accounts = [...next.accounts, draft];
  return commit(previous, next, "Add Account", `Opened ${draft.name}`, [id]);
}

export function updateAccount(household: Household, input: {
  accountId: string;
  name?: string;
  institution?: string;
  last4?: string;
  creditLimit?: string | number;
  aprPercent?: string | number;
  statementDay?: number;
  dueDaysAfterStatement?: number;
  cashbackPercent?: string | number;
  apyPercent?: string | number;
  vehicle?: InvestmentVehicle;
}): CommitResult {
  requireTimezone(household);
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const account = next.accounts.find((row) => row.id === input.accountId);
  if (!account) throw new ValidationError("That account is gone.");
  if (input.name?.trim()) account.name = input.name.trim().slice(0, 40);
  if (input.institution !== undefined) account.institution = input.institution.trim().slice(0, 32);
  if (input.last4 !== undefined) account.last4 = input.last4.replace(/\D/g, "").slice(-4);
  if (account.kind === "credit") {
    const credit = account.credit ?? emptyCreditDesk();
    account.credit = {
      ...credit,
      creditLimitCents: input.creditLimit !== undefined ? parseLimitCents(input.creditLimit, "Credit limit") : credit.creditLimitCents,
      aprBps: input.aprPercent !== undefined ? parseBps(input.aprPercent, "APR", credit.aprBps) : credit.aprBps,
      statementDay: input.statementDay !== undefined ? Math.min(28, Math.max(1, Math.round(input.statementDay))) : credit.statementDay,
      dueDaysAfterStatement: input.dueDaysAfterStatement !== undefined
        ? Math.min(30, Math.max(1, Math.round(input.dueDaysAfterStatement)))
        : credit.dueDaysAfterStatement,
      defaultCashbackBps: input.cashbackPercent !== undefined
        ? parseBps(input.cashbackPercent, "Cashback", credit.defaultCashbackBps)
        : credit.defaultCashbackBps,
    };
  }
  if (account.kind === "savings" && input.apyPercent !== undefined) {
    account.savings = { apyBps: parseBps(input.apyPercent, "APY") };
  }
  if (account.kind === "investment" && input.vehicle) {
    account.investment = { ...(account.investment ?? { vehicle: input.vehicle, markedValueCents: null, markedAt: null }), vehicle: input.vehicle };
  }
  account.updatedAt = nowIso();
  next.accounts = next.accounts.map((row) => row.id === account.id ? shapeAccount(account) : row);
  return commit(previous, next, "Account", `Updated ${account.name}`, []);
}

export function archiveAccount(household: Household, accountId: string): CommitResult {
  requireTimezone(household);
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const account = next.accounts.find((row) => row.id === accountId);
  if (!account) throw new ValidationError("That account is gone.");
  const remaining = next.accounts.filter((row) => row.active && row.id !== accountId);
  if (remaining.length === 0) throw new ValidationError("Keep at least one active CAD account.");
  account.active = false;
  account.updatedAt = nowIso();
  return commit(previous, next, "Account", `Archived ${account.name}`, []);
}

export function markInvestmentValue(household: Household, input: {
  accountId: string;
  markedValue: string | number;
  markedAt?: string;
}): CommitResult {
  requireTimezone(household);
  const account = household.accounts.find((row) => row.id === input.accountId && row.active);
  if (!account || account.kind !== "investment") throw new ValidationError("Mark a value on an investment account.");
  let markedValueCents: number;
  try {
    markedValueCents = parseWholeCents(input.markedValue, "Market value", { allowZero: true });
  } catch (error) {
    throw new ValidationError(error instanceof Error ? error.message : String(error));
  }
  const markedAt = parseDate(input.markedAt || todayKey());
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  next.accounts = next.accounts.map((row) => (
    row.id === account.id
      ? shapeAccount({
        ...row,
        updatedAt: nowIso(),
        investment: { vehicle: row.investment?.vehicle ?? "tfsa", markedValueCents, markedAt },
      })
      : row
  ));
  return commit(previous, next, "Investment mark", `${account.name} marked at $${(markedValueCents / 100).toFixed(2)}`, []);
}

export function postCardInterest(household: Household, input: {
  accountId: string;
  date?: string;
  createdBy?: string;
  confirmDuplicate?: boolean;
  confirmClosedMonth?: boolean;
}): CommitResult {
  const account = requireAccount(household, input.accountId);
  if (account.kind !== "credit") throw new ValidationError("Interest posts on a credit card.");
  const date = parseDate(input.date || todayKey());
  const view = creditCardView(household, account, date);
  if (view.estimatedInterestCents <= 0) {
    throw new ValidationError("No estimated interest to post. Pay in full, or the card has no APR/balance.");
  }
  const named = requireExpenseNamed(household, "Card interest");
  return postEntry(named.household, {
    date,
    type: "expense",
    amount: view.estimatedInterestCents / 100,
    accountId: account.id,
    subcategoryId: named.subcategoryId,
    note: `Estimated interest · ${account.name}`,
    confirmDuplicate: input.confirmDuplicate,
    confirmClosedMonth: input.confirmClosedMonth,
    createdBy: input.createdBy,
  });
}

export function postCardRewards(household: Household, input: {
  accountId: string;
  date?: string;
  as?: "statement-credit" | "deposit";
  depositAccountId?: string;
  createdBy?: string;
  confirmDuplicate?: boolean;
  confirmClosedMonth?: boolean;
}): CommitResult {
  const account = requireAccount(household, input.accountId);
  if (account.kind !== "credit") throw new ValidationError("Rewards post from a credit card.");
  const date = parseDate(input.date || todayKey());
  const view = creditCardView(household, account, date);
  if (view.cashbackCycleCents <= 0) {
    throw new ValidationError("No cashback accrued this cycle to post.");
  }
  const as = input.as ?? "statement-credit";
  if (as === "deposit") {
    const depositId = input.depositAccountId || household.accounts.find((row) => row.kind === "chequing" && row.active)?.id;
    if (!depositId) throw new ValidationError("Pick a chequing account to deposit cashback.");
    const named = requireIncomeNamed(household, "Rewards");
    return postEntry(named.household, {
      date,
      type: "income",
      amount: view.cashbackCycleCents / 100,
      accountId: depositId,
      subcategoryId: named.subcategoryId,
      note: `${view.rewardsName} · ${account.name}`,
      confirmDuplicate: input.confirmDuplicate,
      confirmClosedMonth: input.confirmClosedMonth,
      createdBy: input.createdBy,
    });
  }
  const named = requireIncomeNamed(household, "Rewards");
  return postEntry(named.household, {
    date,
    type: "income",
    amount: view.cashbackCycleCents / 100,
    accountId: account.id,
    subcategoryId: named.subcategoryId,
    note: `${view.rewardsName} · ${account.name}`,
    confirmDuplicate: input.confirmDuplicate,
    confirmClosedMonth: input.confirmClosedMonth,
    createdBy: input.createdBy,
  });
}

export function postSavingsInterest(household: Household, input: {
  accountId: string;
  date?: string;
  createdBy?: string;
  confirmDuplicate?: boolean;
  confirmClosedMonth?: boolean;
}): CommitResult {
  const account = requireAccount(household, input.accountId);
  if (account.kind !== "savings") throw new ValidationError("Savings interest posts on a savings account.");
  const date = parseDate(input.date || todayKey());
  const view = savingsView(household, account, date);
  if (view.estimatedMonthlyInterestCents <= 0) {
    throw new ValidationError("No estimated savings interest to post. Set an APY and a balance first.");
  }
  const named = requireIncomeNamed(household, "Interest");
  return postEntry(named.household, {
    date,
    type: "income",
    amount: view.estimatedMonthlyInterestCents / 100,
    accountId: account.id,
    subcategoryId: named.subcategoryId,
    note: `Estimated interest · ${account.name}`,
    confirmDuplicate: input.confirmDuplicate,
    confirmClosedMonth: input.confirmClosedMonth,
    createdBy: input.createdBy,
  });
}

export function applySitDown(household: Household, sourceMonth: MonthKey, amounts: Record<string, number>): CommitResult {
  const preview = sitDownPreview(household, sourceMonth);
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  for (const row of preview.rows) {
    if (row.alreadyPlanned) continue;
    const amountCents = amounts[row.subcategoryId] ?? row.suggestedCents;
    if (amountCents <= 0) continue;
    const category = requireSubcategory(next, row.subcategoryId);
    next.budgetPlans.push(seedBudgetPlan(next, preview.targetMonth, category, amountCents));
  }
  return commit(previous, next, "Monthly Sit-Down", `Planned ${preview.targetMonth} from ${sourceMonth}`, []);
}

export function addGoal(household: Household, input: {
  name: string;
  target: string | number;
  deadline?: string | null;
  shared?: boolean;
  ownerMemberId?: string | null;
  subcategoryId?: string | null;
}): CommitResult {
  const targetCents = parseAmount(input.target, "Goal target");
  if (input.shared === false && !input.ownerMemberId) {
    throw new ValidationError("A personal goal needs an owner. Hidden screens are not private.");
  }
  if (input.ownerMemberId) requireMember(household, input.ownerMemberId);
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const id = nextId("GOAL-", next.goals.map((goal) => goal.id), 3);
  const at = nowIso();
  next.goalContributions = [...(next.goalContributions ?? [])];
  next.goals.push({
    id,
    name: input.name.trim(),
    targetCents,
    savedCents: 0,
    deadline: input.deadline ? parseDate(input.deadline) : null,
    shared: input.shared !== false,
    ownerMemberId: input.ownerMemberId ?? null,
    subcategoryId: input.subcategoryId ?? null,
    createdAt: at,
    updatedAt: at,
  });
  return commit(previous, next, "Add Goal", input.name.trim(), [id]);
}

export function contributeToGoal(household: Household, goalId: string, amount: string | number, input: ActorInput & { date?: string } = {}): CommitResult {
  const amountCents = parseAmount(amount, "Contribution");
  const actor = resolveActor(household, input);
  const date = input.date ? parseDate(input.date) : todayKey();
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const goal = next.goals.find((item) => item.id === goalId);
  if (!goal) throw new ValidationError("That goal no longer exists.");
  const at = nowIso();
  next.goalContributions = [...(next.goalContributions ?? [])];
  const id = nextId("GCON-", next.goalContributions.map((row) => row.id), 4);
  next.goalContributions.push({
    id,
    goalId,
    memberId: actor.createdBy,
    amountCents,
    date,
    createdAt: at,
    updatedAt: at,
  });
  goal.savedCents = savedCentsFromContributions(next.goalContributions, goal.id);
  goal.updatedAt = at;
  return commit(previous, next, "Goal Progress", `${goal.name} +$${(amountCents / 100).toFixed(2)}`, [id]);
}

export function addRecurrence(household: Household, input: {
  cadence: Recurrence["cadence"];
  nextDate: string;
  type: "expense" | "income";
  amount: string | number;
  accountId: string;
  subcategoryId: string;
  note?: string;
  splits?: Split[];
  kind?: RecurrenceKind;
  origin?: RecurrenceOrigin;
  reminderHoursBefore?: number;
}): CommitResult {
  const amountCents = parseAmount(input.amount);
  requireAccount(household, input.accountId);
  const subcategory = requireSubcategory(household, input.subcategoryId, input.type);
  const splits = catalogValidateOwned(input.splits ?? jointSplit(amountCents), amountCents, household);
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const id = nextId("REC-", next.recurrences.map((item) => item.id), 3);
  const at = nowIso();
  const note = input.note ?? "";
  next.recurrences.push({
    id,
    cadence: input.cadence,
    nextDate: parseDate(input.nextDate),
    type: input.type,
    amountCents,
    accountId: input.accountId,
    subcategoryId: input.subcategoryId,
    note,
    splits,
    active: true,
    autoPost: false,
    kind: input.kind ?? inferRecurrenceKind({ type: input.type, note, subcategoryName: subcategory.name }),
    origin: input.origin ?? "manual",
    reminderHoursBefore: input.reminderHoursBefore ?? DEFAULT_REMINDER_HOURS_BEFORE,
    googleSync: {},
    createdAt: at,
    updatedAt: at,
  });
  return commit(previous, next, "Add Recurring", `${note || "Recurring"} ${input.cadence}`, [id]);
}

export function adoptRhythm(household: Household, key: string, today: DateKey): CommitResult {
  const rhythm = detectRhythms(household, today).find((item) => item.key === key);
  if (!rhythm || rhythm.status === "tracked") {
    throw new ValidationError("That repeating bill is no longer waiting to be adopted.");
  }
  const result = addRecurrence(household, {
    cadence: rhythm.cadence,
    nextDate: rhythm.nextDate,
    type: rhythm.type,
    amount: rhythm.amountCents / 100,
    accountId: rhythm.accountId,
    subcategoryId: rhythm.subcategoryId,
    note: rhythm.note,
    splits: rhythm.splits,
    kind: rhythm.kind,
    origin: "detected",
  });
  result.undo.label = `Adopted ${rhythm.note}`;
  result.household.calendar = {
    dismissedRhythmKeys: (result.household.calendar?.dismissedRhythmKeys ?? []).filter((item) => item !== key),
  };
  return result;
}

export function dismissRhythm(household: Household, key: string): CommitResult {
  if (!key.trim()) throw new ValidationError("Nothing to dismiss.");
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  next.calendar = {
    dismissedRhythmKeys: [...new Set([...(next.calendar?.dismissedRhythmKeys ?? []), key])].sort(),
  };
  return commit(previous, next, "Calendar", "Hid a detected repeating bill", []);
}

export function pauseRecurrence(household: Household, recurrenceId: string): CommitResult {
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const item = next.recurrences.find((row) => row.id === recurrenceId);
  if (!item) throw new ValidationError("That repeating item no longer exists.");
  item.active = !item.active;
  item.updatedAt = nowIso();
  return commit(previous, next, "Calendar", `${item.active ? "Resumed" : "Paused"} ${item.note || "recurring"}`, [item.id]);
}

export function skipOccurrence(household: Household, recurrenceId: string): CommitResult {
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const item = next.recurrences.find((row) => row.id === recurrenceId);
  if (!item) throw new ValidationError("That repeating item no longer exists.");
  item.nextDate = advanceCadence(item.nextDate, item.cadence);
  item.updatedAt = nowIso();
  return commit(previous, next, "Calendar", `Skipped ${item.note || "recurring"} · next ${item.nextDate}`, [item.id]);
}

export function postOneRecurrence(household: Household, recurrenceId: string, today: DateKey): CommitResult {
  const item = household.recurrences.find((row) => row.id === recurrenceId && row.active);
  if (!item) throw new ValidationError("That repeating item is not active.");
  if (item.nextDate > today) throw new ValidationError("That item is not due yet.");
  const previous = cloneHousehold(household);
  const posted = postEntry(household, {
    date: item.nextDate,
    type: item.type,
    amount: item.amountCents / 100,
    accountId: item.accountId,
    subcategoryId: item.subcategoryId,
    note: item.note,
    splits: item.splits,
    confirmDuplicate: true,
    confirmClosedMonth: true,
    source: "recurring",
    sourceId: item.id,
  });
  const next = posted.household;
  const current = next.recurrences.find((row) => row.id === item.id);
  if (current) {
    current.nextDate = advanceCadence(item.nextDate, item.cadence);
    current.updatedAt = nowIso();
  }
  return commit(previous, next, "Post Recurring", `Posted ${item.note || "recurring"}`, posted.postedIds);
}

export function setRecurrenceGoogleSync(
  household: Household,
  patches: { recurrenceId: string; memberId: string; calendarId: string; eventId: string }[],
): CommitResult {
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const at = nowIso();
  for (const patch of patches) {
    const item = next.recurrences.find((row) => row.id === patch.recurrenceId);
    if (!item) continue;
    item.googleSync = {
      ...item.googleSync,
      [patch.memberId]: { calendarId: patch.calendarId, eventId: patch.eventId },
    };
    item.updatedAt = at;
  }
  return commit(
    previous,
    next,
    "Calendar",
    patches.length ? `Linked ${patches.length} Google reminder${patches.length === 1 ? "" : "s"}` : "Google calendar unchanged",
    [],
  );
}

export function postDueRecurrences(household: Household, today: DateKey): CommitResult {
  const previous = cloneHousehold(household);
  let next = cloneHousehold(household);
  const postedIds: string[] = [];
  const due = next.recurrences.filter((item) => item.active && item.nextDate <= today);
  if (!due.length) throw new ValidationError("Nothing is due today.");
  for (const item of due) {
    const result = postEntry(next, {
      date: item.nextDate,
      type: item.type,
      amount: item.amountCents / 100,
      accountId: item.accountId,
      subcategoryId: item.subcategoryId,
      note: item.note,
      splits: item.splits,
      confirmDuplicate: true,
      confirmClosedMonth: true,
      source: "recurring",
      sourceId: item.id,
    });
    next = result.household;
    postedIds.push(...result.postedIds);
    const current = next.recurrences.find((row) => row.id === item.id);
    if (current) {
      current.nextDate = advanceCadence(item.nextDate, item.cadence);
      current.updatedAt = nowIso();
    }
  }
  return commit(previous, next, "Post Recurring", `Posted ${due.length} recurring ${due.length === 1 ? "item" : "items"}`, postedIds);
}

export function markDuplicate(household: Household, transactionId: string, isDuplicate: boolean): CommitResult {
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const tx = next.transactions.find((item) => item.id === transactionId);
  if (!tx) throw new ValidationError("That transaction no longer exists.");
  tx.isDuplicate = isDuplicate;
  tx.updatedAt = nowIso();
  return commit(previous, next, "Duplicate Review", `${tx.id} ${isDuplicate ? "excluded from totals" : "included in totals"}`, [tx.id]);
}

export function updateShiftSettings(household: Household, settings: Household["shiftSettings"]): CommitResult {
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  next.shiftSettings = settings;
  shiftSettingsFingerprint(settings);
  return commit(previous, next, "Shift Settings", "Updated tip-out and wage rules", []);
}

export function voidPostedMoney(household: Household, transactionId: string): CommitResult {
  const tx = household.transactions.find((item) => item.id === transactionId);
  if (!tx) throw new ValidationError("That row is already gone.");
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const ids = new Set<string>([tx.id]);
  if (tx.transferPairId) ids.add(tx.transferPairId);
  const shift = tx.source === "shift" && tx.sourceId
    ? next.shifts.find((item) => item.id === tx.sourceId)
    : undefined;
  if (shift) {
    ids.add(shift.id);
    ids.add(shift.wagesTransactionId);
    ids.add(shift.tipsTransactionId);
  }
  const at = nowIso();
  next.transactions = next.transactions.filter((item) => !ids.has(item.id));
  next.shifts = next.shifts.filter((item) => !ids.has(item.id));
  next.tombstones = mergeTombstones(next.tombstones, [...ids].map((id) => ({ id, deletedAt: at })));
  const dollars = `$${(tx.amountCents / 100).toFixed(2)}`;
  const label = shift
    ? `Removed ${tx.date} shift ${dollars}`
    : tx.type === "transfer"
      ? `Removed ${tx.date} transfer ${dollars}`
      : `Removed ${tx.date} ${tx.type} ${dollars}`;
  return commit(previous, next, "Remove", label, [...ids]);
}

export function undo(current: Household, token: UndoToken): Household {
  if (!token?.snapshot) throw new ValidationError("Nothing to undo.");
  const restored = cloneHousehold(token.snapshot);
  const removedTx = current.transactions.filter((tx) => !restored.transactions.some((row) => row.id === tx.id));
  const removedShifts = current.shifts.filter((shift) => !restored.shifts.some((row) => row.id === shift.id));
  const posted = token.postedIds ?? [];
  restored.tombstones = mergeTombstones(restored.tombstones ?? [], [
    ...removedTx.map((tx) => ({ id: tx.id, deletedAt: nowIso() })),
    ...removedShifts.map((shift) => ({ id: shift.id, deletedAt: nowIso() })),
    ...posted.map((id) => ({ id, deletedAt: nowIso() })),
  ]);
  restored.householdId = restored.householdId || current.householdId;
  restored.inviteCode = restored.inviteCode || current.inviteCode;
  restored.linked = restored.linked ?? current.linked;
  restored.revision = current.revision;
  restored.activity = [
    ...restored.activity,
    {
      id: nextId("ACT-", restored.activity.map((item) => item.id), 6),
      at: nowIso(),
      action: "Undo",
      summary: `Undid: ${token.label}`,
      updatedAt: nowIso(),
    },
  ];
  restored.lastCommittedAt = nowIso();
  restored.transactions = refreshDuplicateFlags(restored.transactions);
  return restored;
}

export function scribbleChalk(household: Household, input: { text: string; author: string }): CommitResult {
  const text = input.text.trim();
  if (!text) throw new ValidationError("Write something first.");
  if (text.length > MAX_CHALK_CHARS) throw new ValidationError(`Keep it to ${MAX_CHALK_CHARS} characters. Silly, not a novel.`);
  requireMember(household, input.author);
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  next.kitchen = shapeKitchen(next.kitchen);
  const at = nowIso();
  const id = nextId("CHALK-", next.kitchen.chalkboard.map((note) => note.id), 4);
  next.kitchen.chalkboard = [
    ...next.kitchen.chalkboard,
    { id, text, author: input.author, createdAt: at, updatedAt: at },
  ].slice(-MAX_CHALK_NOTES);
  return commit(previous, next, "Chalkboard", "Scribbled on the chalkboard", []);
}

export function wipeChalk(household: Household, id: string): CommitResult {
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  next.kitchen = shapeKitchen(next.kitchen);
  const note = next.kitchen.chalkboard.find((item) => item.id === id);
  if (!note) throw new ValidationError("That scribble is already gone.");
  next.kitchen.chalkboard = next.kitchen.chalkboard.filter((item) => item.id !== id);
  next.tombstones = mergeTombstones(next.tombstones, [{ id, deletedAt: nowIso() }]);
  return commit(previous, next, "Chalkboard", "Wiped a chalkboard note", []);
}

export function recordReconciliation(household: Household, input: {
  accountId: string;
  statementDate: string;
  statementAmount: string | number;
  createdBy?: string;
}): CommitResult {
  requireTimezone(household);
  const statementDate = parseDate(input.statementDate);
  let statementCents: number;
  try {
    statementCents = parseWholeCents(input.statementAmount, "Statement balance", { allowZero: true, allowNegative: true });
  } catch (error) {
    throw new ValidationError(error instanceof Error ? error.message : String(error));
  }
  const account = requireAccount(household, input.accountId);
  const actor = resolveActor(household, input);
  const bookCents = bookBalanceAsOf(household, account.id, statementDate);
  const differenceCents = statementCents - bookCents;
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  next.kitchen = shapeKitchen(next.kitchen);
  const id = nextId("REC-", next.kitchen.books.reconciliations.map((row) => row.id), 4);
  next.kitchen.books.reconciliations = [
    ...next.kitchen.books.reconciliations,
    {
      id,
      accountId: account.id,
      statementDate,
      statementCents,
      bookCents,
      differenceCents,
      status: differenceCents === 0 ? "tied" as const : "open" as const,
      createdAt: nowIso(),
      createdBy: actor.createdBy,
    },
  ].slice(-24);
  return commit(
    previous,
    next,
    "Bank rec",
    differenceCents === 0
      ? `${account.name} tied at ${statementDate}`
      : `${account.name} off by $${(Math.abs(differenceCents) / 100).toFixed(2)} at ${statementDate}`,
    [],
  );
}

export function closeBooksMonth(household: Household, input: { monthKey: MonthKey; createdBy?: string }): CommitResult {
  requireTimezone(household);
  if (!/^\d{4}-\d{2}$/.test(input.monthKey)) throw new ValidationError("Close a Toronto month (YYYY-MM).");
  if (isMonthClosed(household, input.monthKey)) {
    throw new ValidationError(`${input.monthKey} is already closed.`);
  }
  const actor = resolveActor(household, input);
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  next.kitchen = shapeKitchen(next.kitchen);
  next.kitchen.books.closedMonths = [
    ...next.kitchen.books.closedMonths,
    { id: closedPeriodId(input.monthKey), monthKey: input.monthKey, closedAt: nowIso(), closedBy: actor.createdBy },
  ];
  return commit(previous, next, "Close month", `Closed ${input.monthKey}. Posting in still needs a second look.`, []);
}

export function reopenBooksMonth(household: Household, monthKey: MonthKey): CommitResult {
  requireTimezone(household);
  if (!isMonthClosed(household, monthKey)) throw new ValidationError(`${monthKey} is not closed.`);
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  next.kitchen = shapeKitchen(next.kitchen);
  const row = next.kitchen.books.closedMonths.find((item) => item.monthKey === monthKey);
  next.kitchen.books.closedMonths = next.kitchen.books.closedMonths.filter((item) => item.monthKey !== monthKey);
  next.tombstones = mergeTombstones(next.tombstones, [{ id: row?.id || closedPeriodId(monthKey), deletedAt: nowIso() }]);
  return commit(previous, next, "Reopen month", `Reopened ${monthKey}`, []);
}

export function renameCompanion(household: Household, name: string): CommitResult {
  const trimmed = name.trim();
  if (trimmed.length < 2) throw new ValidationError("Give Hercules a name with at least two letters.");
  if (trimmed.length > MAX_COMPANION_NAME) throw new ValidationError("Keep the name short enough to shout across the kitchen.");
  if (!/^[A-Za-z0-9][A-Za-z0-9 '\-]*$/.test(trimmed)) {
    throw new ValidationError("Use letters, numbers, spaces, or hyphens.");
  }
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  next.kitchen = shapeKitchen(next.kitchen);
  next.kitchen.companion = { ...next.kitchen.companion, name: trimmed, updatedAt: nowIso() };
  return commit(previous, next, "Companion", `Named the companion ${trimmed}`, []);
}

export function equipCosmetic(household: Household, input: {
  slot: string;
  itemId: string | null;
  today: DateKey;
}): CommitResult {
  if (!isCosmeticSlot(input.slot)) throw new ValidationError("Hats, chains, houses, or collars only.");
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  next.kitchen = shapeKitchen(next.kitchen);
  const itemId = input.itemId?.trim() && input.itemId !== "none" ? input.itemId.trim() : null;
  if (itemId) {
    const item = COSMETIC_BY_ID.get(itemId);
    if (!item || item.slot !== input.slot) throw new ValidationError("That upgrade does not exist.");
    if (!isCosmeticUnlocked(next, item, input.today)) {
      throw new ValidationError(`${item.name} is still locked. ${item.hint}.`);
    }
  }
  next.kitchen.companion = {
    ...next.kitchen.companion,
    equipped: { ...next.kitchen.companion.equipped, [input.slot]: itemId },
    updatedAt: nowIso(),
  };
  const label = itemId ? COSMETIC_BY_ID.get(itemId)?.name || itemId : `no ${input.slot}`;
  return commit(previous, next, "Companion", `Equipped ${label}`, []);
}

export function recordHerculesTalk(household: Household, input: {
  author: string;
  userText?: string;
  herculesText: string;
  source: HerculesTalkSource;
  memory?: { kind: HerculesMemoryKind; text: string; label: string } | null;
}): CommitResult {
  requireMember(household, input.author);
  const herculesText = input.herculesText.trim().slice(0, MAX_HERCULES_CHAT_CHARS);
  if (!herculesText) throw new ValidationError("Hercules needs a line to keep.");
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  next.kitchen = shapeKitchen(next.kitchen);
  const at = nowIso();
  const chats = [...next.kitchen.hercules.chats];
  const userText = input.userText?.trim().slice(0, MAX_HERCULES_CHAT_CHARS) || "";
  let sourceTurnId: string | null = null;
  if (userText) {
    const userId = nextId("CHAT-", chats.map((row) => row.id), 4);
    sourceTurnId = userId;
    chats.push({
      id: userId,
      role: "user",
      text: userText,
      source: input.source,
      createdAt: at,
      createdBy: input.author,
    });
  }
  const herculesId = nextId("CHAT-", chats.map((row) => row.id), 4);
  chats.push({
    id: herculesId,
    role: "hercules",
    text: herculesText,
    source: input.source,
    createdAt: at,
    createdBy: input.author,
  });
  next.kitchen.hercules.chats = chats.slice(-MAX_HERCULES_CHATS);
  if (input.memory?.text.trim()) {
    const memoId = nextId("MEMO-", next.kitchen.hercules.memories.map((row) => row.id), 4);
    next.kitchen.hercules.memories = [
      ...next.kitchen.hercules.memories,
      {
        id: memoId,
        kind: input.memory.kind,
        text: input.memory.text.trim().slice(0, MAX_HERCULES_MEMORY_CHARS),
        label: input.memory.label.trim().slice(0, 48) || input.memory.text.trim().slice(0, 48),
        sourceTurnId,
        createdAt: at,
        updatedAt: at,
        createdBy: input.author,
      },
    ].slice(-MAX_HERCULES_MEMORIES);
  }
  const summary = input.memory
    ? "Hercules kept a note in the kitchen ledger"
    : "Hercules talked; the books kept the chat";
  return commit(previous, next, "Hercules", summary, []);
}

export function forgetHerculesMemory(household: Household, id: string): CommitResult {
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  next.kitchen = shapeKitchen(next.kitchen);
  const row = next.kitchen.hercules.memories.find((item) => item.id === id);
  if (!row) throw new ValidationError("That note is already gone.");
  next.kitchen.hercules.memories = next.kitchen.hercules.memories.filter((item) => item.id !== id);
  next.tombstones = mergeTombstones(next.tombstones, [{ id, deletedAt: nowIso() }]);
  return commit(previous, next, "Hercules", "Forgot a Hercules note", []);
}

export function wipeHerculesChat(household: Household): CommitResult {
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  next.kitchen = shapeKitchen(next.kitchen);
  const ids = next.kitchen.hercules.chats.map((row) => row.id);
  if (!ids.length) throw new ValidationError("No chat to wipe.");
  next.kitchen.hercules.chats = [];
  next.tombstones = mergeTombstones(next.tombstones, ids.map((id) => ({ id, deletedAt: nowIso() })));
  return commit(previous, next, "Hercules", "Wiped Hercules chat from the kitchen ledger", []);
}

export function linkGoogleIdentity(household: Household, input: {
  memberId: string;
  email: string;
  subject: string;
  displayName?: string;
  grantedScopes?: string[];
}): CommitResult {
  requireMember(household, input.memberId);
  const email = (input.email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) throw new ValidationError("Google did not share an email.");
  const subject = (input.subject ?? "").trim();
  const claimedEmail = findActiveGoogleLinkByEmail(household, email);
  if (claimedEmail && claimedEmail.memberId !== input.memberId) {
    throw new ValidationError("That Google account is already linked to another person in this household.");
  }
  if (subject) {
    const claimedSubject = findActiveGoogleLinkBySubject(household, subject);
    if (claimedSubject && claimedSubject.memberId !== input.memberId) {
      throw new ValidationError("That Google account is already linked to another person in this household.");
    }
  }
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  next.google = shapeGoogle(next.google);
  const existing = findActiveGoogleLink(next, input.memberId) ?? next.google.links.find((link) => link.memberId === input.memberId);
  const at = nowIso();
  const link = {
    memberId: input.memberId,
    email,
    subject: subject || existing?.subject || "",
    displayName: (input.displayName ?? existing?.displayName ?? "").trim(),
    linkedAt: existing?.active ? existing.linkedAt : at,
    lastConfirmedAt: at,
    grantedScopes: input.grantedScopes ?? existing?.grantedScopes ?? [],
    updatedAt: at,
    active: true,
  };
  next.google = shapeGoogle({
    ...next.google,
    links: [...next.google.links.filter((item) => item.memberId !== input.memberId), link],
  });
  next.tombstones = next.tombstones.filter((tombstone) => tombstone.id !== googleLinkTombstoneId(input.memberId));
  const member = requireMember(next, input.memberId);
  return commit(previous, next, "Google", `Linked ${member.name} to ${email}`, []);
}

export function unlinkGoogleIdentity(household: Household, memberId: string): CommitResult {
  requireMember(household, memberId);
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  next.google = shapeGoogle(next.google);
  const link = findActiveGoogleLink(next, memberId);
  if (!link) throw new ValidationError("That person is not linked to Google.");
  const at = nowIso();
  next.google = shapeGoogle({
    ...next.google,
    links: next.google.links.filter((item) => item.memberId !== memberId),
  });
  next.tombstones = mergeTombstones(next.tombstones, [{ id: googleLinkTombstoneId(memberId), deletedAt: at }]);
  const member = requireMember(next, memberId);
  return commit(previous, next, "Google", `Unlinked ${member.name} from Google`, []);
}

export function touchGoogleConfirmation(household: Household, memberId: string): CommitResult {
  requireMember(household, memberId);
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  next.google = shapeGoogle(next.google);
  const link = next.google.links.find((item) => item.memberId === memberId && item.active);
  if (!link) throw new ValidationError("Link Google before asking it to confirm.");
  const at = nowIso();
  link.lastConfirmedAt = at;
  link.updatedAt = at;
  next.google = shapeGoogle(next.google);
  return commit(previous, next, "Google", "Confirmed with Google", []);
}

export function setGoogleServices(household: Household, services: Iterable<string>): CommitResult {
  const enabled = uniqueGoogleServices(services);
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  next.google = shapeGoogle({
    ...next.google,
    enabledServices: enabled,
    updatedAt: nowIso(),
  });
  const labels = enabled.filter((service) => service !== "identity").join(", ") || "sign-in only";
  return commit(previous, next, "Google", `Google services: ${labels}`, []);
}

export function emptyHousehold(environment: Household["environment"] = "development"): Household {
  return {
    version: 1,
    householdId: randomHouseholdId(),
    inviteCode: randomInviteCode(),
    linked: false,
    revision: 0,
    tombstones: [],
    name: "Jonathan & Bianca",
    timezone: TIMEZONE,
    currency: CURRENCY,
    environment,
    members: [],
    accounts: [],
    categories: [],
    transactions: [],
    shifts: [],
    recurrences: [],
    calendar: { ...EMPTY_CALENDAR },
    kitchen: shapeKitchen(EMPTY_KITCHEN),
    google: shapeGoogle(EMPTY_GOOGLE),
    goals: [],
    goalContributions: [],
    budgetPlans: [],
    activity: [],
    shiftSettings: DEFAULT_SHIFT_SETTINGS,
    lastCommittedAt: null,
  };
}

export { DEFAULT_SHIFT_SETTINGS };
