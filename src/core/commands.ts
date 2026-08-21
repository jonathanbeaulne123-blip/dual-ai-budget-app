import { TIMEZONE, todayKey, type DateKey, type MonthKey } from "./calendar.ts";
import { CURRENCY } from "./money.ts";
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
import { sitDownPreview } from "./insights.ts";
import { mergeTombstones } from "./sync.ts";
import { parseVisibility, visibleForDuplicateScan } from "./visibility.ts";
import type {
  Activity,
  BudgetPlan,
  Category,
  CommitResult,
  Household,
  Recurrence,
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
  };
  next.activity = [...next.activity, activity].slice(-200);
  return {
    household: next,
    warnings,
    postedIds,
    undo: { id: activity.id, label: summary, snapshot: previous },
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
  createdBy?: string;
  visibility?: Visibility;
}): CommitResult {
  requireTimezone(household);
  const date = parseDate(input.date);
  const amountCents = parseAmount(input.amount);
  const actor = resolveActor(household, input);
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
  createdBy?: string;
  visibility?: Visibility;
}): CommitResult {
  requireTimezone(household);
  const parsed = parseShiftInput({ ...input, timeZone: household.timezone });
  const member = requireMember(household, input.memberId);
  const actor = resolveActor(household, input, member.id);
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
    });
    existingIds.push(groupId);
    parentId = groupId;
  }
  const parent = next.categories.find((category) => category.id === parentId && category.recordType === "group" && category.active);
  if (!parent) throw new ValidationError("Please choose a category group.");
  if (parent.transactionType !== input.type) throw new ValidationError("That group does not match Income/Expense.");
  const subId = uniquePrefixedId(`SUB-${slug(parent.name)}-${slug(name)}`, [...existingIds, parentId]);
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
  return {
    id: nextId(`BUD-${monthKey.replace("-", "")}-`, household.budgetPlans.map((plan) => plan.id), 3),
    monthKey,
    subcategoryId: category.id,
    amountCents,
    essential: category.essential,
    incomeStability: category.incomeStability,
    active: true,
  };
}

export function setBudget(household: Household, input: { monthKey: MonthKey; subcategoryId: string; amount: string | number }): CommitResult {
  requireTimezone(household);
  const amountCents = parseAmount(input.amount, "Budgeted amount");
  const category = requireSubcategory(household, input.subcategoryId);
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const existing = next.budgetPlans.find((plan) => plan.monthKey === input.monthKey && plan.subcategoryId === input.subcategoryId && plan.active);
  if (existing) existing.amountCents = amountCents;
  else next.budgetPlans.push(seedBudgetPlan(next, input.monthKey, category, amountCents));
  return commit(previous, next, "Set Budget", `${category.name} ${input.monthKey} → $${(amountCents / 100).toFixed(2)}`, []);
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
  next.goals.push({
    id,
    name: input.name.trim(),
    targetCents,
    savedCents: 0,
    deadline: input.deadline ? parseDate(input.deadline) : null,
    shared: input.shared !== false,
    ownerMemberId: input.ownerMemberId ?? null,
    subcategoryId: input.subcategoryId ?? null,
  });
  return commit(previous, next, "Add Goal", input.name.trim(), [id]);
}

export function contributeToGoal(household: Household, goalId: string, amount: string | number): CommitResult {
  const amountCents = parseAmount(amount, "Contribution");
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const goal = next.goals.find((item) => item.id === goalId);
  if (!goal) throw new ValidationError("That goal no longer exists.");
  goal.savedCents += amountCents;
  return commit(previous, next, "Goal Progress", `${goal.name} +$${(amountCents / 100).toFixed(2)}`, [goalId]);
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
}): CommitResult {
  const amountCents = parseAmount(input.amount);
  requireAccount(household, input.accountId);
  requireSubcategory(household, input.subcategoryId, input.type);
  const splits = catalogValidateOwned(input.splits ?? jointSplit(amountCents), amountCents, household);
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const id = nextId("REC-", next.recurrences.map((item) => item.id), 3);
  next.recurrences.push({
    id,
    cadence: input.cadence,
    nextDate: parseDate(input.nextDate),
    type: input.type,
    amountCents,
    accountId: input.accountId,
    subcategoryId: input.subcategoryId,
    note: input.note ?? "",
    splits,
    active: true,
    autoPost: false,
  });
  return commit(previous, next, "Add Recurring", `${input.note || "Recurring"} ${input.cadence}`, [id]);
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
      source: "recurring",
      sourceId: item.id,
    });
    next = result.household;
    postedIds.push(...result.postedIds);
    const current = next.recurrences.find((row) => row.id === item.id);
    if (current) current.nextDate = advance(item.nextDate, item.cadence);
  }
  return commit(previous, next, "Post Recurring", `Posted ${due.length} recurring ${due.length === 1 ? "item" : "items"}`, postedIds);
}

function advance(date: DateKey, cadence: Recurrence["cadence"]): DateKey {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  if (cadence === "weekly") return new Date(Date.UTC(year, month - 1, day + 7)).toISOString().slice(0, 10);
  if (cadence === "biweekly") return new Date(Date.UTC(year, month - 1, day + 14)).toISOString().slice(0, 10);
  const next = new Date(Date.UTC(year, month, day));
  return next.toISOString().slice(0, 10);
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

export function undo(current: Household, token: UndoToken): Household {
  if (!token?.snapshot) throw new ValidationError("Nothing to undo.");
  const restored = cloneHousehold(token.snapshot);
  const removedTx = current.transactions.filter((tx) => !restored.transactions.some((row) => row.id === tx.id));
  const removedShifts = current.shifts.filter((shift) => !restored.shifts.some((row) => row.id === shift.id));
  restored.tombstones = mergeTombstones(restored.tombstones ?? [], [
    ...removedTx.map((tx) => ({ id: tx.id, deletedAt: nowIso() })),
    ...removedShifts.map((shift) => ({ id: shift.id, deletedAt: nowIso() })),
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
    },
  ];
  restored.lastCommittedAt = nowIso();
  restored.transactions = refreshDuplicateFlags(restored.transactions);
  return restored;
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
    goals: [],
    budgetPlans: [],
    activity: [],
    shiftSettings: DEFAULT_SHIFT_SETTINGS,
    lastCommittedAt: null,
  };
}

export { DEFAULT_SHIFT_SETTINGS };
