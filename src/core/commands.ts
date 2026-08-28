import { TIMEZONE, addDays, todayKey, monthKeyFromDateKey, shiftMonthKey, type DateKey, type MonthKey } from "./calendar.ts";
import { advanceCadence, DEFAULT_REMINDER_HOURS_BEFORE, EMPTY_CALENDAR, inferRecurrenceKind, normalizeRecurrenceCadence, shapeCalendar } from "./recurrence.ts";
import { detectHabits, detectRhythms } from "./rhythm.ts";
import { CURRENCY, parseWholeCents } from "./money.ts";
import { nextId, nowIso, randomHouseholdId, randomInviteCode, slug, uniquePrefixedId } from "./ids.ts";
import { cloneHousehold } from "./household.ts";
import { duplicateKey, describeSimilarMatches, findSimilarTransactions, refreshDuplicateFlags } from "./duplicate.ts";
import { jointSplit } from "./splits.ts";
import { calcShiftAmounts, parseShiftInput, shiftSettingsFingerprint, DEFAULT_SHIFT_SETTINGS } from "./shift.ts";
import { calculateWorkShift, previousWorkWeekHours, shapeWorkJob, workJobFingerprint, workShiftIsReversed } from "./work.ts";
import {
  incomeSubcategory,
  parseAmount,
  parseDate,
  requireAccount,
  requireCadAccounts,
  requireIanaTimeZone,
  requireMember,
  requireSubcategory,
  requireTimezone,
  validateOwnedAmount as catalogValidateOwned,
} from "./catalog.ts";
import { shapeTransactionLocation } from "./transactionLocation.ts";
import { shapeAccount, normalizeAccountKind, emptyCreditDesk, isReceivableKind } from "./accountKinds.ts";
import { creditCardView, savingsView } from "./accounts.ts";
import { sitDownPreview } from "./insights.ts";
import { leftoverProjection, leftoverSourceAccountId, jarParkingAccountId, plannedAllocation, shapeSitDownSessions, openSitDownSession } from "./sitDown.ts";
import { goalsVaultAccount, vaultSpendableCents } from "./goalVault.ts";
import { savedCentsFromContributions, goalStatus } from "./goals.ts";
import { touchDevicePresence } from "./devices.ts";
import type { AllocationSlice } from "./allocate.ts";
import { bookBalanceAsOf, isMonthClosed } from "./statements.ts";
import { COSMETIC_BY_ID, isCosmeticUnlocked } from "./companion.ts";
import { EMPTY_TICTACTOE, emptyHangman, hangmanMisses, hangmanWon, MAX_HANGMAN_MISSES, pickHangmanWord, shapeGames, tttWinner } from "./deskGames.ts";
import { EMPTY_KITCHEN, MAX_CHALK_CHARS, MAX_CHALK_NOTES, MAX_COMPANION_NAME, MAX_HERCULES_CHAT_CHARS, MAX_HERCULES_CHATS, MAX_HERCULES_MEMORIES, MAX_HERCULES_MEMORY_CHARS, closedPeriodId, isCosmeticSlot, shapeKitchen } from "./kitchen.ts";
import { detectChalkLetters, hasChalkInk, organizeNeatText, shapeChalkInk } from "./chalkLetters.ts";
import { activeOpenShift, openShiftConflicts } from "./shiftClock.ts";
import { assertSevenShiftsBundleMatchesShift, type SevenShiftsEvidenceBundle } from "./evidence.ts";
import { automationPayrollWeekStart } from "./sevenShiftsAutomation.ts";
import { shapeSevenShiftsSchedules, type SevenShiftsScheduledShift } from "./sevenShiftsCalendar.ts";
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
import {
  advanceAppointmentCadence,
  assertLinesSum,
  DEFAULT_RECEIVABLE_ID,
  defaultClaimKind,
  defaultCraEligible,
  defaultReceivableAccountId,
  deriveClaimStatus,
  estimateRecoveryCents,
  proposeVisitGoal,
  shapeAppointment,
  shapeBillLines,
  shapeCadence,
  claimRemainingCents,
  visitPostedDefaults,
} from "./appointments.ts";
import type {
  AccountKind,
  Activity,
  Appointment,
  AppointmentCadence,
  AppointmentKind,
  AppointmentMemberId,
  AppointmentSensitivity,
  BudgetPlan,
  Category,
  Claim,
  ClaimKind,
  CommitResult,
  ChalkInk,
  CreditRewardRule,
  Household,
  HouseholdFundFundingDefault,
  HouseholdFundTransactionFunding,
  HerculesMemoryKind,
  HerculesTalkSource,
  InvestmentVehicle,
  Preset,
  PresetOrigin,
  Recurrence,
  RecurrenceKind,
  RecurrenceOrigin,
  SavingsPurpose,
  SitDownSession,
  Split,
  ShiftEventTag,
  Transaction,
  UndoToken,
  Visibility,
  WorkJob,
  AccountScope,
} from "./types.ts";
import { COMPANION, JOINT, NeedsConfirmationError, ValidationError, isShiftEventTag } from "./types.ts";
import {
  HOUSEHOLD_FUND_ID,
  HOUSEHOLD_FUND_DIRECT_DESTINATION,
  HOUSEHOLD_FUND_NAME,
  matchHouseholdFundBankEvidence,
  projectHouseholdFund,
  shapeHouseholdFundConfig,
  shapeHouseholdFundEvents,
  shapeHouseholdFundKittyAllocations,
  shapeHouseholdFundMonthPlans,
  shapeHouseholdFundPrivate,
  shapeHouseholdFundSettlementAllocations,
  type HouseholdFundBankEvidence,
} from "./householdFund.ts";

export type ActorInput = {
  createdBy?: string;
  visibility?: Visibility;
};

function requireOpenPeriod(household: Household, date: DateKey): void {
  const monthKey = monthKeyFromDateKey(date);
  if (!isMonthClosed(household, monthKey)) return;
  throw new ValidationError(
    `${monthKey} is closed. Reopen that month from Books, or post a prior-period adjustment dated in an open month.`,
  );
}

function resolveActor(household: Household, input?: ActorInput, fallbackMemberId?: string): { createdBy: string; visibility: Visibility } {
  const visibility = parseVisibility(input?.visibility);
  const createdBy = input?.createdBy || fallbackMemberId || household.members.find((member) => member.active)?.id;
  if (!createdBy) throw new ValidationError("Add a household member before posting.");
  requireMember(household, createdBy);
  return { createdBy, visibility };
}

function requireAccountScopeForWrite(household: Household, accountId: string, actor: { createdBy: string; visibility: Visibility }): void {
  const account = requireAccount(household, accountId);
  if (account.scope !== "personal") return;
  if (account.ownerMemberId !== actor.createdBy || actor.visibility !== "personal") {
    throw new ValidationError("A Personal account can only be used in its owner's Personal ledger.");
  }
}

function resolveHouseholdFundFunding(
  household: Household,
  type: "expense" | "income" | "refund",
  amountCents: number,
  input: HouseholdFundTransactionFunding | undefined,
  refundOfId?: string,
): HouseholdFundTransactionFunding | undefined {
  const inherited = !input && type === "refund" && refundOfId
    ? household.transactions.find((tx) => tx.id === refundOfId)?.funding
    : undefined;
  const funding = input ?? (inherited ? { ...inherited, fundedCents: Math.min(amountCents, inherited.fundedCents) } : undefined);
  if (!funding) return undefined;
  const config = shapeHouseholdFundConfig(household.householdFund);
  if (!config || funding.fundId !== config.id) throw new ValidationError("Set up the Hearth Household Fund before using it.");
  if (type === "income") throw new ValidationError("Income cannot be spent from the Household Fund.");
  if (funding.fundedCents === 0) return undefined;
  if (!Number.isInteger(funding.fundedCents) || funding.fundedCents <= 0 || funding.fundedCents > amountCents) {
    throw new ValidationError("Household Fund use must be positive CAD cents no greater than the transaction.");
  }
  const directDebit = funding.directDebit === true && funding.destinationAccountId === HOUSEHOLD_FUND_DIRECT_DESTINATION;
  const destination = directDebit ? null : requireAccount(household, funding.destinationAccountId);
  if (destination?.scope === "personal") throw new ValidationError("Choose a shared card or transfer destination for Household Fund clearing.");
  return {
    fundId: config.id,
    fundedCents: funding.fundedCents,
    destinationAccountId: destination?.id ?? HOUSEHOLD_FUND_DIRECT_DESTINATION,
    ...(typeof funding.positionId === "string" && funding.positionId ? { positionId: funding.positionId } : {}),
    ...(funding.directDebit === true ? { directDebit: true } : {}),
  };
}

function resolveHouseholdFundFundingDefault(
  household: Household,
  type: "expense" | "income" | "transfer",
  amountCents: number,
  input: HouseholdFundFundingDefault | null | undefined,
): HouseholdFundFundingDefault | null {
  if (!input) return null;
  if (type !== "expense") throw new ValidationError("Only recurring expenses can reserve the Household Fund.");
  const fundedCents = input.fundedCents === "full" ? "full" : Math.round(Number(input.fundedCents));
  const resolved = resolveHouseholdFundFunding(household, "expense", amountCents, {
    fundId: input.fundId,
    fundedCents: fundedCents === "full" ? amountCents : fundedCents,
    destinationAccountId: input.destinationAccountId,
  });
  if (!resolved) return null;
  const projection = projectHouseholdFund(household, todayKey());
  if (projection.topUpNeededCents > 0) {
    throw new ValidationError(`Top up the Household Fund by $${(projection.topUpNeededCents / 100).toFixed(2)} before adding a new planned commitment.`);
  }
  return { fundId: resolved.fundId, fundedCents, destinationAccountId: resolved.destinationAccountId };
}

function signedHouseholdFundDirection(household: Household, transactionId: string, stack = new Set<string>()): number {
  if (stack.has(transactionId)) return 0;
  const transaction = household.transactions.find((row) => row.id === transactionId);
  if (!transaction?.funding) return 0;
  if (transaction.reversalOfId) {
    return -signedHouseholdFundDirection(household, transaction.reversalOfId, new Set(stack).add(transactionId));
  }
  return transaction.type === "refund" ? -1 : transaction.type === "expense" ? 1 : 0;
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
  next.sharing = next.sharing ?? { mode: next.linked ? "linked" : "local", linked: next.linked, lastTransportAt: null, lastError: null, pending: false };
  next.commandReceipts = next.commandReceipts ?? [];
  next.conflicts = next.conflicts ?? [];
  next.baseRevision = next.baseRevision ?? 0;
  next.booksAcceptedHash = next.booksAcceptedHash ?? null;
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
  occurredAt?: string;
  location?: Transaction["location"];
  splits: Split[];
  source: Transaction["source"];
  sourceId?: string;
  transferPairId?: string;
  refundOfId?: string;
  reversalOfId?: string;
  createdAt: string;
  createdBy: string;
  visibility: Visibility;
  funding?: HouseholdFundTransactionFunding;
}): Transaction {
  const account = requireAccount(household, input.accountId);
  const location = shapeTransactionLocation(input.location);
  const occurredAt =
    typeof input.occurredAt === "string" && input.occurredAt.trim() && !Number.isNaN(Date.parse(input.occurredAt))
      ? new Date(input.occurredAt).toISOString()
      : undefined;
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
    ...(occurredAt ? { occurredAt } : {}),
    ...(location ? { location } : {}),
    splits: input.splits,
    transferPairId: input.transferPairId,
    refundOfId: input.refundOfId,
    reversalOfId: input.reversalOfId,
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
    ...(input.funding ? { funding: input.funding } : {}),
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
  occurredAt?: string;
  location?: Transaction["location"];
  splits?: Split[];
  confirmDuplicate?: boolean;
  refundOfId?: string;
  reversalOfId?: string;
  source?: Transaction["source"];
  sourceId?: string;
  createdBy?: string;
  visibility?: Visibility;
  funding?: HouseholdFundTransactionFunding;
}): CommitResult {
  requireTimezone(household);
  const date = parseDate(input.date);
  const amountCents = parseAmount(input.amount);
  const actor = resolveActor(household, input);
  requireAccountScopeForWrite(household, input.accountId, actor);
  requireOpenPeriod(household, date);
  const subcategory = requireSubcategory(
    household,
    input.subcategoryId,
    input.type === "refund" ? "expense" : input.type,
  );
  const splits = catalogValidateOwned(input.splits ?? jointSplit(amountCents), amountCents, household);
  const funding = resolveHouseholdFundFunding(household, input.type, amountCents, input.funding, input.refundOfId);
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
    occurredAt: input.occurredAt,
    location: input.location,
    splits,
    source: input.source ?? (input.reversalOfId ? "reversal" : "manual"),
    sourceId: input.sourceId,
    refundOfId: input.refundOfId,
    reversalOfId: input.reversalOfId,
    createdAt,
    createdBy: actor.createdBy,
    visibility: actor.visibility,
    funding,
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
  const postedIds = [draft.id];
  if (funding) {
    const events = shapeHouseholdFundEvents(next.fundEvents);
    const fundEventAt = nextFundEventAt(next);
    const eventId = nextFundEventId(next);
    const reversedDirection = input.reversalOfId ? -signedHouseholdFundDirection(household, input.reversalOfId) : 0;
    const fundingEventKind = reversedDirection > 0 || (!input.reversalOfId && input.type !== "refund")
      ? "purchase-funded"
      : "refund-funded";
    const relatedTransactionId = input.refundOfId ?? input.reversalOfId ?? null;
    const relatedTransaction = relatedTransactionId
      ? household.transactions.find((transaction) => transaction.id === relatedTransactionId)
      : undefined;
    const relatedPositionId = relatedTransaction?.funding?.positionId ?? relatedTransactionId;
    const relatedFundingEvent = relatedPositionId
      ? events.find((event) => (event.kind === "purchase-funded" || event.kind === "refund-funded") && event.relatedTransactionIds.includes(relatedPositionId))
      : null;
    const purchaseEvent = relatedFundingEvent?.kind === "purchase-funded"
      ? relatedFundingEvent
      : relatedFundingEvent?.relatedEventId
        ? events.find((event) => event.id === relatedFundingEvent.relatedEventId && event.kind === "purchase-funded")
        : null;
    const positionTransactionId = purchaseEvent?.relatedTransactionIds[0]
      ?? relatedPositionId
      ?? (actor.visibility === "personal" ? eventId : draft.id);
    draft.funding = { ...funding, positionId: positionTransactionId };
    const publicRelatedIds = actor.visibility === "personal"
      ? [positionTransactionId]
      : [...new Set([positionTransactionId, draft.id])];
    next.fundEvents = [...events, {
      id: eventId,
      fundId: funding.fundId,
      kind: fundingEventKind,
      amountCents: funding.fundedCents,
      date,
      createdBy: actor.createdBy,
      confirmedByMemberId: null,
      contributorMemberId: null,
      destinationAccountId: funding.destinationAccountId,
      relatedEventId: relatedFundingEvent?.id ?? null,
      relatedTransactionIds: publicRelatedIds,
      evidenceDigests: [],
      reconciliationTied: null,
      note: "",
      createdAt: fundEventAt,
      updatedAt: fundEventAt,
    }];
    postedIds.push(eventId);
  }
  const warnings = matches.length ? ["Saved with a duplicate fingerprint. Review it when you have a moment."] : [];
  return commit(previous, next, input.type === "income" ? "Add Income" : input.type === "refund" ? "Add Refund" : "Add Expense", `${draft.id}: ${input.type} $${(amountCents / 100).toFixed(2)} (${subcategory.name}) on ${date}`, postedIds, warnings);
}

/** Books civil timezone is fixed to America/Toronto (D-126 Q2 C). Phone display zones are phone-local. */
export function setHouseholdTimezone(household: Household, timeZone: string): CommitResult {
  const nextZone = requireIanaTimeZone(timeZone);
  if (nextZone !== TIMEZONE) {
    throw new ValidationError(
      `Books civil dates stay ${TIMEZONE}. Change this phone’s clock in More → Clock & place.`,
    );
  }
  if (household.timezone === nextZone) {
    return {
      household,
      warnings: [],
      postedIds: [],
      undo: { id: `tz-${nextZone}`, label: "Timezone unchanged", snapshot: household, postedIds: [] },
    };
  }
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  next.timezone = nextZone;
  return commit(previous, next, "Timezone", `Household calendar is ${nextZone}`, []);
}

export function postTransfer(household: Household, input: {
  date: string;
  amount: string | number;
  fromAccountId: string;
  toAccountId: string;
  note?: string;
  source?: Transaction["source"];
  sourceId?: string;
  confirmDuplicate?: boolean;
  reversalOfId?: string;
  createdBy?: string;
  visibility?: Visibility;
}): CommitResult {
  requireTimezone(household);
  const date = parseDate(input.date);
  const amountCents = parseAmount(input.amount);
  const actor = resolveActor(household, input);
  requireAccountScopeForWrite(household, input.fromAccountId, actor);
  requireAccountScopeForWrite(household, input.toAccountId, actor);
  requireOpenPeriod(household, date);
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
    source: input.source ?? (input.reversalOfId ? "reversal" : "manual"),
    sourceId: input.sourceId,
    reversalOfId: input.reversalOfId,
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
    source: input.source ?? (input.reversalOfId ? "reversal" : "manual"),
    sourceId: input.sourceId,
    reversalOfId: input.reversalOfId,
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
    source: input.source ?? "manual",
    sourceId: input.sourceId,
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
  customersServed?: string | number;
  staffingCount?: string | number;
  eventTag?: string;
  weatherGlass?: string;
  settingsFingerprint?: string;
  confirmDuplicate?: boolean;
  createdBy?: string;
  visibility?: Visibility;
}): CommitResult {
  requireTimezone(household);
  const parsed = parseShiftInput({ ...input, timeZone: household.timezone });
  const member = requireMember(household, input.memberId);
  const actor = resolveActor(household, input, member.id);
  requireOpenPeriod(household, parsed.date);
  const account = requireAccount(household, input.accountId);
  const wagesCat = incomeSubcategory(household, "Wages");
  const tipsCat = incomeSubcategory(household, "Tips");
  const settings = household.shiftSettings;
  const fingerprint = shiftSettingsFingerprint(settings);
  if (input.settingsFingerprint && input.settingsFingerprint !== fingerprint) {
    throw new NeedsConfirmationError("settingsChanged", "Tip rules changed since the preview. Review the new amounts before posting.", [], calcShiftAmounts(parsed, settings));
  }
  const tippedLegacy = parsed.cashTipsCents > 0 || parsed.ccTipsCents > 0 || parsed.salesCents > 0;
  const covariates = tippedLegacy
    ? parseTippedShiftCovariates(input, { requireSales: true, salesCents: parsed.salesCents })
    : parseOptionalShiftCovariates(input);
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
    customersServed: covariates.customersServed,
    staffingCount: covariates.staffingCount,
    eventTag: covariates.eventTag,
    weatherGlass: covariates.weatherGlass,
  });
  const warnings = [];
  if (amounts.netTipsCents < 0) warnings.push("Net tips are negative after tip-out. The shift was still saved.");
  next.kitchen = shapeKitchen(next.kitchen);
  const punch = activeOpenShift(next.kitchen, member.id);
  if (punch && punch.memberId === member.id) {
    next.kitchen.openShifts = next.kitchen.openShifts.map((row) => row.id === punch.id ? { ...row, status: "cleared", updatedAt: createdAt } : row);
  }
  return commit(previous, next, "Add Shift", `${shiftId}: ${member.name} on ${parsed.date}`, [shiftId, wagesTx.id, tipsTx.id], warnings);
}

function optionalMoneyCents(value: string | number | undefined, label: string): number {
  if (value == null || value === "" || Number(value) === 0) return 0;
  return parseAmount(value, label);
}

type ShiftCovariateFields = {
  customersServed?: number;
  staffingCount?: number;
  eventTag?: ShiftEventTag;
  weatherGlass?: "clear" | "rain" | "snow" | "night" | "humid";
};

const WEATHER_GLASS_VALUES = new Set(["clear", "rain", "snow", "night", "humid"]);

function parseOptionalInteger(value: unknown, label: string, min: number, max: number): number | undefined {
  if (value == null || value === "") return undefined;
  const n = typeof value === "string" ? Number(value.trim()) : Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) throw new ValidationError(`${label} must be a whole number.`);
  if (n < min || n > max) throw new ValidationError(`${label} must be between ${min} and ${max}.`);
  return n;
}

function parseRequiredInteger(value: unknown, label: string, min: number, max: number): number {
  const parsed = parseOptionalInteger(value, label, min, max);
  if (parsed == null) throw new ValidationError(`Enter ${label.toLowerCase()} before confirming this shift.`);
  return parsed;
}

function parseEventTag(value: unknown, required: boolean): ShiftEventTag | undefined {
  if (value == null || value === "") {
    if (required) return "regular";
    return undefined;
  }
  if (!isShiftEventTag(value)) throw new ValidationError("Choose a valid event tag for this shift.");
  return value;
}

function parseWeatherGlass(value: unknown): ShiftCovariateFields["weatherGlass"] | undefined {
  if (value == null || value === "") return undefined;
  const glass = String(value).trim();
  if (!WEATHER_GLASS_VALUES.has(glass)) throw new ValidationError("Choose a valid weather glass stamp.");
  return glass as ShiftCovariateFields["weatherGlass"];
}

function parseTippedShiftCovariates(input: {
  customersServed?: string | number;
  staffingCount?: string | number;
  eventTag?: string;
  weatherGlass?: string;
}, opts: { requireSales: boolean; salesCents: number }): Required<Pick<ShiftCovariateFields, "customersServed" | "staffingCount" | "eventTag">> & Pick<ShiftCovariateFields, "weatherGlass"> {
  if (opts.requireSales && !(opts.salesCents > 0)) {
    throw new ValidationError("Enter sales before confirming a tipped shift.");
  }
  return {
    customersServed: parseRequiredInteger(input.customersServed, "Customers served", 0, 5000),
    staffingCount: parseRequiredInteger(input.staffingCount, "People on floor", 1, 200),
    eventTag: parseEventTag(input.eventTag, true) ?? "regular",
    weatherGlass: parseWeatherGlass(input.weatherGlass),
  };
}

function parseOptionalShiftCovariates(input: {
  customersServed?: string | number;
  staffingCount?: string | number;
  eventTag?: string;
  weatherGlass?: string;
}): ShiftCovariateFields {
  return {
    customersServed: parseOptionalInteger(input.customersServed, "Customers served", 0, 5000),
    staffingCount: parseOptionalInteger(input.staffingCount, "People on floor", 1, 200),
    eventTag: parseEventTag(input.eventTag, false),
    weatherGlass: parseWeatherGlass(input.weatherGlass),
  };
}

function ensureWorkPostingCategory(household: Household, input: {
  id: string;
  parentId: string;
  parentName: string;
  name: string;
  transactionType: "income" | "expense";
  at: string;
}): Category {
  let parent = household.categories.find((row) => row.id === input.parentId);
  if (!parent) {
    parent = {
      id: input.parentId,
      parentId: null,
      recordType: "group",
      name: input.parentName,
      transactionType: input.transactionType,
      essential: false,
      incomeStability: null,
      active: true,
      sortOrder: household.categories.reduce((max, row) => Math.max(max, row.sortOrder), 0) + 10,
      createdAt: input.at,
      updatedAt: input.at,
    };
    household.categories.push(parent);
  }
  let category = household.categories.find((row) => row.id === input.id);
  if (!category) {
    category = {
      id: input.id,
      parentId: parent.id,
      recordType: "category",
      name: input.name,
      transactionType: input.transactionType,
      essential: false,
      incomeStability: input.transactionType === "income" ? "variable" : null,
      active: true,
      sortOrder: household.categories.reduce((max, row) => Math.max(max, row.sortOrder), 0) + 1,
      createdAt: input.at,
      updatedAt: input.at,
    };
    household.categories.push(category);
  }
  return category;
}

export type PostWorkShiftInput = {
  date: string;
  memberId: string;
  jobId: string;
  roleId: string;
  workedHours: string | number;
  paidBreakHours?: string | number;
  sales?: string | number;
  salesByField?: Record<string, string | number>;
  cashTips?: string | number;
  cardTips?: string | number;
  /** Covers / customers served — required for tipped roles. */
  customersServed?: string | number;
  /** Floor headcount only — required for tipped roles; never names. */
  staffingCount?: string | number;
  eventTag?: string;
  weatherGlass?: string;
  cashTipsAccountId?: string;
  wagesDepositAccountId?: string;
  cardTipsDepositAccountId?: string;
  wagesVisibility?: Visibility;
  cashTipsVisibility?: Visibility;
  cardTipsVisibility?: Visibility;
  tipOutVisibility?: Visibility;
  startedAt?: string | null;
  endedAt?: string | null;
  note?: string;
  /** Optional D-126 stamp on every income/expense row this Confirm creates. */
  occurredAt?: string;
  location?: Transaction["location"];
  settingsFingerprint?: string;
  confirmDuplicate?: boolean;
  createdBy?: string;
  /** HMAC digest from the 7shifts Timesheet inbox. Exact duplicates refuse a second post. */
  sevenShiftsPunchDigest?: string;
  /** Unified D-158/D-159 evidence. Every reference must bind to this exact member/job/shift. */
  sevenShiftsEvidenceBundle?: SevenShiftsEvidenceBundle;
  /** Removed pre-main packet fields retained only so direct/replayed legacy payloads fail explicitly. */
  sevenShiftsEvidence?: unknown;
  sevenShiftsScreenEvidence?: unknown;
};

/**
 * Job-based Confirm boundary. Earnings first land in employer receivables; only
 * same-day cash tips touch cash. Payday and card-tip payout are later transfers.
 */
export function postWorkShift(household: Household, input: PostWorkShiftInput): CommitResult {
  requireTimezone(household);
  const date = parseDate(input.date);
  const member = requireMember(household, input.memberId);
  const actor = resolveActor(household, { createdBy: input.createdBy, visibility: input.wagesVisibility }, member.id);
  const job = (household.workJobs ?? []).find((row) => row.id === input.jobId && row.active && row.memberId === member.id);
  if (!job) throw new ValidationError("Choose one of this worker's active jobs.");
  const role = job.roles.find((row) => row.id === input.roleId && row.active);
  if (!role) throw new ValidationError("Choose an active role for this job.");
  requireOpenPeriod(household, date);
  requireAccount(household, job.wagesReceivableAccountId);
  if (role.tipped && !job.cardTipsReceivableAccountId) throw new ValidationError("This tipped job needs a Card tips owed account. Edit the job once to repair it.");

  const workedHours = Number(input.workedHours);
  const paidBreakHours = Number(input.paidBreakHours || 0);
  if (input.sevenShiftsEvidence !== undefined || input.sevenShiftsScreenEvidence !== undefined) {
    if (input.sevenShiftsEvidence !== undefined && input.sevenShiftsScreenEvidence !== undefined) {
      throw new ValidationError("A shift cannot attach separate 7shifts punch and screenshot evidence. Build one validated evidence bundle.");
    }
    throw new ValidationError("Legacy 7shifts evidence payloads are no longer accepted. Build one validated evidence bundle.");
  }
  const salesByField = Object.fromEntries(Object.entries(input.salesByField ?? {}).map(([id, value]) => [id, optionalMoneyCents(value, "Sales")]));
  for (const field of job.salesFields.filter((row) => row.requirement === "required")) {
    if (!(field.id in salesByField)) throw new ValidationError(`Enter ${field.label} before confirming this shift.`);
  }
  const fieldSalesCents = Object.values(salesByField).reduce((sum, value) => sum + value, 0);
  const salesCents = fieldSalesCents || optionalMoneyCents(input.sales, "Sales");
  const cashTipsCents = optionalMoneyCents(input.cashTips, "Cash tips");
  const cardTipsCents = optionalMoneyCents(input.cardTips, "Card tips");
  if (!role.tipped && (cashTipsCents || cardTipsCents)) throw new ValidationError(`${role.name} is not configured as a tipped role.`);
  const covariates = role.tipped
    ? parseTippedShiftCovariates(input, {
      requireSales: job.salesFields.some((field) => field.requirement !== "off"),
      salesCents,
    })
    : parseOptionalShiftCovariates(input);

  const previousWeekHours = previousWorkWeekHours(household, job.id, member.id, date);
  const calculation = calculateWorkShift(job, role.id, {
    date,
    workedHours,
    paidBreakHours,
    previousWeekHours,
    salesCents,
    cashTipsCents,
    cardTipsCents,
  });
  const fingerprint = workJobFingerprint(job, role.id, date);
  if (input.settingsFingerprint && input.settingsFingerprint !== fingerprint) {
    throw new NeedsConfirmationError("settingsChanged", "This job's pay or tip rules changed. Review the new amounts before confirming.", [], calculation);
  }
  const conflicts = openShiftConflicts(household.kitchen, member.id);
  if (conflicts.length > 1) throw new ValidationError("Two devices recorded an open shift for you. Choose the correct timeline before confirming pay.");
  const punchDigest = String(input.sevenShiftsPunchDigest || "").trim();
  if (punchDigest && input.sevenShiftsEvidenceBundle) {
    throw new ValidationError("A shift cannot attach both a legacy 7shifts digest and a unified evidence bundle.");
  }
  if (punchDigest) {
    if (!/^s7punch_[a-f0-9]{64}$/.test(punchDigest)) throw new ValidationError("This 7shifts punch id is not valid.");
    const already = household.shifts.find((shift) => shift.sevenShiftsPunchDigest === punchDigest && !workShiftIsReversed(household, shift));
    if (already) throw new ValidationError("This 7shifts punch is already on the books.");
  }
  let sevenShiftsEvidenceBundle: SevenShiftsEvidenceBundle | undefined;
  if (input.sevenShiftsEvidenceBundle) {
    if (!input.startedAt || !input.endedAt) throw new ValidationError("7shifts evidence requires exact start and end times.");
    try {
      sevenShiftsEvidenceBundle = assertSevenShiftsBundleMatchesShift({
        bundle: input.sevenShiftsEvidenceBundle,
        environment: household.environment,
        householdId: household.householdId,
        memberId: member.id,
        jobId: job.id,
        date,
        startedAt: input.startedAt,
        endedAt: input.endedAt,
        workedHours,
        paidBreakHours,
        roleId: role.id,
        salesCents,
        cashTipsCents,
        cardTipsCents,
        calculatedWagesCents: calculation.takeHomeWagesCents,
        customersServed: covariates.customersServed,
        staffingCount: covariates.staffingCount,
        eventTag: covariates.eventTag,
        weatherGlass: covariates.weatherGlass,
      });
    } catch (error) {
      throw new ValidationError(error instanceof Error ? error.message : "7shifts evidence is invalid.");
    }
    const prior = household.shifts.find((shift) => (
      shift.sevenShiftsEvidenceBundle?.canonicalShiftKey === sevenShiftsEvidenceBundle?.canonicalShiftKey
      && !workShiftIsReversed(household, shift)
    ));
    if (prior?.sevenShiftsEvidenceBundle?.materialHash === sevenShiftsEvidenceBundle.materialHash) {
      throw new ValidationError("This 7shifts evidence revision is already on the books.");
    }
    if (prior) throw new ValidationError("This 7shifts shift changed after posting. Reconcile it as a correction; Hearth will not overwrite history.");
  }
  const sameDay = household.shifts.filter((shift) => shift.memberId === member.id && shift.jobId === job.id && shift.date === date);
  if (sameDay.length && !input.confirmDuplicate) {
    const matches = household.transactions.filter((tx) => sameDay.some((shift) => tx.sourceId === shift.id));
    throw new NeedsConfirmationError("sameShiftDay", `${member.name} already has a ${job.name} shift on ${date}. Double shifts are allowed — confirm this is another one.`, matches);
  }

  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  next.kitchen = shapeKitchen(next.kitchen);
  const createdAt = nowIso();
  const shiftId = nextId("SHIFT-", next.shifts.map((shift) => shift.id));
  const wagesCat = incomeSubcategory(next, "Wages");
  const tipsCat = incomeSubcategory(next, "Tips");
  const paidBreakCat = ensureWorkPostingCategory(next, {
    id: "SUB-INCOME-PAID-BREAKS", parentId: "INCOME", parentName: "Income", name: "Paid breaks", transactionType: "income", at: createdAt,
  });
  const tipOutCat = ensureWorkPostingCategory(next, {
    id: "SUB-WORK-TIP-OUTS", parentId: "CAT-WORK", parentName: "Work", name: "Tip-outs", transactionType: "expense", at: createdAt,
  });
  const cashAccountId = input.cashTipsAccountId || job.defaults.cashTipsAccountId;
  if ((cashTipsCents || calculation.immediateTipOutCents) && !cashAccountId) throw new ValidationError("Choose where same-day cash tips land.");
  if (cashAccountId) requireAccount(next, cashAccountId);
  const splits = (amountCents: number): Split[] => [{ party: member.id, amountCents }];
  const transactionIds: string[] = [];
  let wagesTransactionId = "";
  let paidBreakTransactionId = "";
  let cashTipsTransactionId = "";
  let cardTipsTransactionId = "";
  const tipOutTransactionIds: string[] = [];

  const stamp = {
    occurredAt: input.occurredAt,
    location: input.location,
  };
  const push = (tx: Transaction, prefix: string): string => {
    tx.id = nextId(prefix, next.transactions.map((row) => row.id));
    next.transactions.push(tx);
    transactionIds.push(tx.id);
    return tx.id;
  };
  const wageWorkCents = calculation.takeHomeWagesCents - calculation.paidBreakIncomeCents;
  if (wageWorkCents > 0) {
    wagesTransactionId = push(baseTx(next, {
      date, type: "income", amountCents: wageWorkCents, accountId: job.wagesReceivableAccountId,
      categoryId: wagesCat.parentId, subcategoryId: wagesCat.id, note: `${job.name} wages earned — ${member.name}`,
      splits: splits(wageWorkCents), source: "shift", sourceId: shiftId, createdAt, createdBy: actor.createdBy,
      visibility: parseVisibility(input.wagesVisibility ?? job.defaults.wagesVisibility),
      ...stamp,
    }), "TXN-IN-");
  }
  if (calculation.paidBreakIncomeCents > 0) {
    paidBreakTransactionId = push(baseTx(next, {
      date, type: "income", amountCents: calculation.paidBreakIncomeCents, accountId: job.wagesReceivableAccountId,
      categoryId: paidBreakCat.parentId, subcategoryId: paidBreakCat.id, note: `${job.name} paid break — ${member.name}`,
      splits: splits(calculation.paidBreakIncomeCents), source: "shift", sourceId: shiftId, createdAt, createdBy: actor.createdBy,
      visibility: parseVisibility(input.wagesVisibility ?? job.defaults.wagesVisibility),
      ...stamp,
    }), "TXN-IN-");
  }
  if (cashTipsCents > 0) {
    cashTipsTransactionId = push(baseTx(next, {
      date, type: "income", amountCents: cashTipsCents, accountId: cashAccountId,
      categoryId: tipsCat.parentId, subcategoryId: tipsCat.id, note: `${job.name} cash tips — ${member.name}`,
      splits: splits(cashTipsCents), source: "shift", sourceId: shiftId, createdAt, createdBy: actor.createdBy,
      visibility: parseVisibility(input.cashTipsVisibility ?? job.defaults.cashTipsVisibility),
      ...stamp,
    }), "TXN-IN-");
  }
  if (cardTipsCents > 0) {
    cardTipsTransactionId = push(baseTx(next, {
      date, type: "income", amountCents: cardTipsCents, accountId: job.cardTipsReceivableAccountId,
      categoryId: tipsCat.parentId, subcategoryId: tipsCat.id, note: `${job.name} card tips earned — ${member.name}`,
      splits: splits(cardTipsCents), source: "shift", sourceId: shiftId, createdAt, createdBy: actor.createdBy,
      visibility: parseVisibility(input.cardTipsVisibility ?? job.defaults.cardTipsVisibility),
      ...stamp,
    }), "TXN-IN-");
  }
  for (const tipOut of calculation.tipOuts.filter((row) => row.amountCents > 0 && row.timing !== "deferred")) {
    const accountId = tipOut.timing === "immediate" ? cashAccountId : job.cardTipsReceivableAccountId;
    if (!accountId) throw new ValidationError(`${tipOut.label} needs a source account.`);
    tipOutTransactionIds.push(push(baseTx(next, {
      date, type: "expense", amountCents: tipOut.amountCents, accountId,
      categoryId: tipOutCat.parentId, subcategoryId: tipOutCat.id, note: `${job.name} ${tipOut.label} tip-out — ${member.name}`,
      splits: splits(tipOut.amountCents), source: "shift", sourceId: shiftId, createdAt, createdBy: actor.createdBy,
      visibility: parseVisibility(input.tipOutVisibility ?? job.defaults.tipOutVisibility),
      ...stamp,
    }), "TXN-EX-"));
  }
  if (!transactionIds.length) throw new ValidationError("This shift has no wages or tips to post.");

  const primaryTipsId = cashTipsTransactionId || cardTipsTransactionId;
  next.shifts.push({
    id: shiftId,
    date,
    memberId: member.id,
    accountId: job.wagesReceivableAccountId,
    salesCents,
    cashTipsCents,
    ccTipsCents: cardTipsCents,
    hours: calculation.regularHours + calculation.overtimeHours,
    floorTipOutCents: calculation.withheldTipOutCents,
    barTipOutCents: calculation.immediateTipOutCents,
    ccTipOutCents: 0,
    netTipsCents: calculation.netTipsCents,
    wagesCents: calculation.takeHomeWagesCents,
    settings: DEFAULT_SHIFT_SETTINGS,
    settingsFingerprint: fingerprint,
    wagesTransactionId: wagesTransactionId || paidBreakTransactionId,
    tipsTransactionId: primaryTipsId,
    createdBy: actor.createdBy,
    visibility: parseVisibility(input.wagesVisibility ?? job.defaults.wagesVisibility),
    createdAt,
    updatedAt: createdAt,
    jobId: job.id,
    roleId: role.id,
    startedAt: input.startedAt || null,
    endedAt: input.endedAt || null,
    grossWagesCents: calculation.grossWagesCents,
    paidBreakHours: calculation.paidBreakHours,
    paidBreakIncomeCents: calculation.paidBreakIncomeCents,
    overtimeHours: calculation.overtimeHours,
    cardTipsAfterTipOutCents: calculation.cardTipsAfterTipOutCents,
    immediateTipOutCents: calculation.immediateTipOutCents,
    withheldTipOutCents: calculation.withheldTipOutCents,
    deferredTipOutCents: calculation.deferredTipOutCents,
    deferredTipOutPaidCents: 0,
    salesByField,
    transactionIds,
    cashTipsTransactionId,
    cardTipsTransactionId,
    paidBreakTransactionId,
    tipOutTransactionIds,
    wagesVisibility: parseVisibility(input.wagesVisibility ?? job.defaults.wagesVisibility),
    cashTipsVisibility: parseVisibility(input.cashTipsVisibility ?? job.defaults.cashTipsVisibility),
    cardTipsVisibility: parseVisibility(input.cardTipsVisibility ?? job.defaults.cardTipsVisibility),
    tipOutVisibility: parseVisibility(input.tipOutVisibility ?? job.defaults.tipOutVisibility),
    wagesDepositAccountId: input.wagesDepositAccountId || job.defaults.wagesDepositAccountId,
    cashTipsAccountId: cashAccountId,
    cardTipsDepositAccountId: input.cardTipsDepositAccountId || job.defaults.cardTipsDepositAccountId,
    customersServed: covariates.customersServed,
    staffingCount: covariates.staffingCount,
    eventTag: covariates.eventTag,
    weatherGlass: covariates.weatherGlass,
    note: String(input.note || "").trim().slice(0, 500),
    ...(punchDigest ? { sevenShiftsPunchDigest: punchDigest } : {}),
    ...(sevenShiftsEvidenceBundle ? { sevenShiftsEvidenceBundle } : {}),
  });
  const punch = activeOpenShift(next.kitchen, member.id);
  if (punch) next.kitchen.openShifts = next.kitchen.openShifts.map((row) => row.id === punch.id ? { ...row, status: "cleared", updatedAt: createdAt } : row);
  const warnings = calculation.cardTipsAfterTipOutCents < 0 ? ["Withheld tip-outs are greater than this shift's card tips; the job's owed balance may be negative."] : [];
  return commit(previous, next, "Confirm Work Shift", `${shiftId}: ${member.name} at ${job.name} on ${date}`, [shiftId, ...transactionIds], warnings);
}

export function refreshSevenShiftsSchedule(household: Household, input: {
  memberId: string;
  schedules: SevenShiftsScheduledShift[];
  confirmedPersonalFeed?: boolean;
  createdBy?: string;
}): CommitResult {
  const member = requireMember(household, input.memberId);
  const actor = input.createdBy ?? input.memberId;
  if (actor !== input.memberId) throw new ValidationError("A 7shifts schedule can only be saved by its Hearth member.");
  requireMember(household, actor);
  if (!Array.isArray(input.schedules) || input.schedules.length > 2_000) throw new ValidationError("7shifts schedule refresh is too large.");
  const schedules = shapeSevenShiftsSchedules(input.schedules, input.memberId);
  if (schedules.length !== input.schedules.length) throw new ValidationError("7shifts schedule contains invalid or cross-member rows.");
  if (schedules.some((row) => row.selfMatch === "personal-feed-assertion") && input.confirmedPersonalFeed !== true) {
    throw new ValidationError("Confirm that this unnamed calendar is the member's private 7shifts Calendar Sync feed before saving it.");
  }
  for (const row of schedules) {
    if (row.jobId != null) {
      const job = household.workJobs.find((item) => item.id === row.jobId && item.active && item.memberId === input.memberId);
      if (!job || row.roleId == null || !job.roles.some((role) => role.id === row.roleId && role.active)) {
        throw new ValidationError("7shifts schedule references an unavailable Hearth job or role.");
      }
    } else if (row.roleId != null) {
      throw new ValidationError("7shifts schedule cannot retain a role without a member-owned job.");
    }
  }
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  next.sevenShiftsSchedules = [
    ...(next.sevenShiftsSchedules ?? []).filter((row) => row.memberId !== input.memberId),
    ...schedules,
  ];
  return commit(previous, next, "Refresh 7shifts schedule", `${member.name} saved ${schedules.length} published schedule shift${schedules.length === 1 ? "" : "s"} for outlook only`, schedules.map((row) => row.id), [
    "Published schedule rows are projections only. They do not post hours, wages, tips, or money.",
  ]);
}

export function reconcileWorkWeekFromEvidence(household: Household, input: {
  memberId: string;
  jobId: string;
  payrollWeekStarts: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  replacements: PostWorkShiftInput[];
  createdBy: string;
}): CommitResult {
  const member = requireMember(household, input.memberId);
  if (input.createdBy !== member.id) throw new ValidationError("7shifts reconciliation must run as the evidence-owning member.");
  const job = (household.workJobs ?? []).find((row) => row.id === input.jobId && row.memberId === member.id && row.active);
  if (!job) throw new ValidationError("7shifts reconciliation needs this member's active mapped job.");
  if (!Array.isArray(input.replacements) || !input.replacements.length || input.replacements.length > 14) {
    throw new ValidationError("7shifts reconciliation must contain the complete affected payroll week.");
  }
  const dates = input.replacements.map((row) => parseDate(row.date));
  const weekStart = automationPayrollWeekStart(dates[0]!, input.payrollWeekStarts);
  const weekEnd = addDays(weekStart, 6);
  if (dates.some((date) => date < weekStart || date > weekEnd)) throw new ValidationError("Every replacement must belong to one payroll week.");
  const replacementKeys = new Set<string>();
  for (const replacement of input.replacements) {
    if (replacement.memberId !== member.id || replacement.jobId !== job.id || replacement.createdBy !== member.id || !replacement.sevenShiftsEvidenceBundle) {
      throw new ValidationError("Every payroll-week replacement needs member-owned 7shifts evidence for the exact job.");
    }
    const key = replacement.sevenShiftsEvidenceBundle.canonicalShiftKey;
    if (replacementKeys.has(key)) throw new ValidationError("7shifts reconciliation repeats a canonical shift.");
    replacementKeys.add(key);
    requireOpenPeriod(household, parseDate(replacement.date));
  }
  const originals = household.shifts
    .filter((shift) => shift.memberId === member.id && shift.jobId === job.id && shift.date >= weekStart && shift.date <= weekEnd && shift.sevenShiftsEvidenceBundle && !workShiftIsReversed(household, shift))
    .sort((left, right) => left.date.localeCompare(right.date) || String(left.startedAt).localeCompare(String(right.startedAt)) || left.id.localeCompare(right.id));
  if (!originals.length) throw new ValidationError("There is no active evidence-backed payroll week to reconcile.");
  if (originals.some((shift) => (shift.deferredTipOutPaidCents ?? 0) > 0)) throw new ValidationError("A settled tip-out keeps this payroll week in variance review.");
  const receivableAccounts = new Set([job.wagesReceivableAccountId, job.cardTipsReceivableAccountId].filter(Boolean));
  const hasLaterSettlement = household.transactions.some((transaction) => (
    transaction.type === "transfer"
    && transaction.source !== "reversal"
    && transaction.date >= weekStart
    && transaction.transferFromAccountId != null
    && receivableAccounts.has(transaction.transferFromAccountId)
  ));
  if (hasLaterSettlement) throw new ValidationError("A settled wage or card-tip receivable keeps this payroll week in variance review.");
  for (const original of originals) {
    if (!replacementKeys.has(original.sevenShiftsEvidenceBundle!.canonicalShiftKey)) {
      throw new ValidationError("Reconciliation must include every active evidence-backed shift in the affected payroll week so overtime is recalculated in order.");
    }
    requireOpenPeriod(household, original.date);
  }

  const previous = cloneHousehold(household);
  let next = cloneHousehold(household);
  const postedIds: string[] = [];
  for (const original of originals) {
    const firstTransactionId = original.transactionIds?.[0] ?? original.wagesTransactionId;
    const reversed = reversePostedMoney(next, firstTransactionId, { createdBy: member.id, visibility: original.visibility });
    next = reversed.household;
    postedIds.push(...reversed.postedIds);
  }
  const replacements = [...input.replacements].sort((left, right) => left.date.localeCompare(right.date)
    || String(left.startedAt).localeCompare(String(right.startedAt))
    || left.sevenShiftsEvidenceBundle!.canonicalShiftKey.localeCompare(right.sevenShiftsEvidenceBundle!.canonicalShiftKey));
  for (const replacement of replacements) {
    const posted = postWorkShift(next, { ...replacement, confirmDuplicate: true, createdBy: member.id });
    next = posted.household;
    postedIds.push(...posted.postedIds);
    const replacementId = posted.postedIds.find((id) => id.startsWith("SHIFT-"));
    const original = originals.find((row) => row.sevenShiftsEvidenceBundle!.canonicalShiftKey === replacement.sevenShiftsEvidenceBundle!.canonicalShiftKey);
    if (!replacementId || !original) throw new ValidationError("7shifts reconciliation could not link its replacement audit trail.");
    next.shifts = next.shifts.map((shift) => shift.id === original.id
      ? { ...shift, correctedByShiftId: replacementId, updatedAt: nowIso() }
      : shift.id === replacementId
        ? { ...shift, correctionOfShiftId: original.id, updatedAt: nowIso() }
        : shift);
  }
  return commit(previous, next, "Reconcile 7shifts Work Week", `${member.name} reconciled ${originals.length} source-backed shift${originals.length === 1 ? "" : "s"} for ${weekStart} through ${weekEnd}`, postedIds, [
    "Every original journal component remains with one exact reversal; replacements were recalculated chronologically for weekly overtime.",
  ]);
}

export type WorkSettlementKind = "wages" | "card-tips";

export function settleWorkReceivable(household: Household, input: {
  jobId: string;
  kind: WorkSettlementKind;
  date: string;
  amount: string | number;
  accountId?: string;
  createdBy: string;
}): CommitResult {
  const date = parseDate(input.date);
  const job = (household.workJobs ?? []).find((row) => row.id === input.jobId && row.active);
  if (!job) throw new ValidationError("That job is no longer active.");
  requireMember(household, input.createdBy);
  const receivableAccountId = input.kind === "wages" ? job.wagesReceivableAccountId : job.cardTipsReceivableAccountId;
  if (!receivableAccountId) throw new ValidationError(input.kind === "wages" ? "This job has no Wages owed account." : "This job has no Card tips owed account.");
  const amountCents = parseAmount(input.amount);
  const owedCents = Math.max(0, bookBalanceAsOf(household, receivableAccountId, date));
  if (amountCents > owedCents) throw new ValidationError(`Only $${(owedCents / 100).toFixed(2)} is currently recorded as owed.`);
  const accountId = input.accountId || (input.kind === "wages" ? job.defaults.wagesDepositAccountId : job.defaults.cardTipsDepositAccountId);
  if (!accountId) throw new ValidationError("Choose where the received money landed.");
  return postTransfer(household, {
    date,
    amount: amountCents / 100,
    fromAccountId: receivableAccountId,
    toAccountId: accountId,
    note: `${job.name} · ${input.kind === "wages" ? "paycheck received" : "tip envelope received"}`,
    confirmDuplicate: true,
    createdBy: input.createdBy,
    visibility: input.kind === "wages" ? job.defaults.wagesVisibility : job.defaults.cardTipsVisibility,
  });
}

export function payDeferredWorkTipOut(household: Household, input: {
  jobId: string;
  date: string;
  amount: string | number;
  accountId?: string;
  createdBy: string;
}): CommitResult {
  requireTimezone(household);
  const date = parseDate(input.date);
  requireOpenPeriod(household, date);
  const job = (household.workJobs ?? []).find((row) => row.id === input.jobId && row.active);
  if (!job) throw new ValidationError("That job is no longer active.");
  const member = requireMember(household, input.createdBy);
  const amountCents = parseAmount(input.amount);
  const eligible = household.shifts
    .filter((shift) => shift.jobId === job.id && shift.memberId === member.id && !workShiftIsReversed(household, shift))
    .sort((left, right) => left.date.localeCompare(right.date) || left.createdAt.localeCompare(right.createdAt));
  const unpaidCents = eligible.reduce((sum, shift) => sum + Math.max(0, (shift.deferredTipOutCents ?? 0) - (shift.deferredTipOutPaidCents ?? 0)), 0);
  if (amountCents > unpaidCents) throw new ValidationError(`Only $${(unpaidCents / 100).toFixed(2)} of deferred tip-outs are waiting.`);
  const accountId = input.accountId || job.defaults.cashTipsAccountId;
  if (!accountId) throw new ValidationError("Choose the account used to pay the deferred tip-out.");
  requireAccount(household, accountId);
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const at = nowIso();
  const tipOutCat = ensureWorkPostingCategory(next, {
    id: "SUB-WORK-TIP-OUTS", parentId: "CAT-WORK", parentName: "Work", name: "Tip-outs", transactionType: "expense", at,
  });
  const tx = baseTx(next, {
    date, type: "expense", amountCents, accountId, categoryId: tipOutCat.parentId, subcategoryId: tipOutCat.id,
    note: `${job.name} · deferred tip-out paid`, splits: [{ party: member.id, amountCents }], source: "manual",
    createdAt: at, createdBy: member.id, visibility: job.defaults.tipOutVisibility,
  });
  tx.id = nextId("TXN-EX-", next.transactions.map((row) => row.id));
  next.transactions.push(tx);
  let left = amountCents;
  next.shifts = next.shifts.map((shift) => {
    if (left <= 0 || shift.jobId !== job.id || shift.memberId !== member.id) return shift;
    const unpaid = Math.max(0, (shift.deferredTipOutCents ?? 0) - (shift.deferredTipOutPaidCents ?? 0));
    const applied = Math.min(left, unpaid);
    left -= applied;
    return { ...shift, deferredTipOutPaidCents: (shift.deferredTipOutPaidCents ?? 0) + applied, updatedAt: at };
  });
  return commit(previous, next, "Pay Deferred Tip-out", `${job.name}: paid $${(amountCents / 100).toFixed(2)} deferred tip-out`, [tx.id]);
}

export function clockInShift(household: Household, input: { memberId: string; scheduledItemId?: string | null; sourceDeviceId?: string | null }): CommitResult {
  const member = requireMember(household, input.memberId);
  const already = activeOpenShift(household.kitchen, member.id);
  if (already) throw new ValidationError(already.status === "confirming" ? "Finish confirming the previous shift before starting another." : "Already on the clock. Sign out when you know the hours.");
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  next.kitchen = shapeKitchen(next.kitchen);
  const at = nowIso();
  const id = uniquePrefixedId(`OPEN-${member.id}-${at.replace(/\D/g, "")}`, next.kitchen.openShifts.map((row) => row.id));
  next.kitchen.openShifts.push({
    id,
    memberId: member.id,
    startedAt: at,
    endedAt: null,
    breaks: [],
    scheduledItemId: input.scheduledItemId || null,
    sourceDeviceId: input.sourceDeviceId || null,
    updatedAt: at,
    status: "open",
  });
  return commit(previous, next, "Clock in", `${member.name} punched in.`, []);
}

export function clockOutShift(household: Household, input: { memberId: string }): CommitResult {
  const member = requireMember(household, input.memberId);
  const punch = activeOpenShift(household.kitchen, member.id);
  if (!punch) throw new ValidationError("There is no open shift to clock out.");
  if (punch.status === "confirming") throw new ValidationError("This shift is already waiting for confirmation.");
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  next.kitchen = shapeKitchen(next.kitchen);
  const at = nowIso();
  next.kitchen.openShifts = next.kitchen.openShifts.map((row) => row.id === punch.id ? {
    ...row,
    endedAt: at,
    breaks: row.breaks.map((item) => item.endedAt ? item : { ...item, endedAt: at, updatedAt: at }),
    status: "confirming",
    updatedAt: at,
  } : row);
  return commit(previous, next, "Clock out", `${member.name} clocked out; Confirm still posts the shift`, []);
}

export function startShiftBreak(household: Household, input: { memberId: string; kind: "paid" | "unpaid" | "custom"; label?: string }): CommitResult {
  const member = requireMember(household, input.memberId);
  const punch = activeOpenShift(household.kitchen, member.id);
  if (!punch || punch.status !== "open") throw new ValidationError("Clock in before starting a break.");
  if (punch.breaks.some((item) => !item.endedAt)) throw new ValidationError("End the current break before starting another.");
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  next.kitchen = shapeKitchen(next.kitchen);
  const at = nowIso();
  next.kitchen.openShifts = next.kitchen.openShifts.map((row) => row.id === punch.id ? {
    ...row,
    breaks: [...row.breaks, {
      id: uniquePrefixedId(`BREAK-${row.id}`, row.breaks.map((item) => item.id)),
      kind: input.kind,
      label: (input.label || (input.kind === "paid" ? "Paid break" : input.kind === "unpaid" ? "Unpaid break" : "Break")).trim().slice(0, 40),
      startedAt: at,
      endedAt: null,
      updatedAt: at,
    }],
    updatedAt: at,
  } : row);
  return commit(previous, next, "Start break", `${member.name} started a ${input.kind} break`, []);
}

export function endShiftBreak(household: Household, input: { memberId: string }): CommitResult {
  const member = requireMember(household, input.memberId);
  const punch = activeOpenShift(household.kitchen, member.id);
  const openBreak = punch?.breaks.find((item) => !item.endedAt);
  if (!punch || punch.status !== "open" || !openBreak) throw new ValidationError("There is no open break to end.");
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  next.kitchen = shapeKitchen(next.kitchen);
  const at = nowIso();
  next.kitchen.openShifts = next.kitchen.openShifts.map((row) => row.id === punch.id ? {
    ...row,
    breaks: row.breaks.map((item) => item.id === openBreak.id ? { ...item, endedAt: at, updatedAt: at } : item),
    updatedAt: at,
  } : row);
  return commit(previous, next, "End break", `${member.name} ended a break`, []);
}

export function updateOpenShiftTimeline(household: Household, input: { memberId: string; startedAt: string; endedAt: string; breaks: Household["kitchen"]["openShifts"][number]["breaks"] }): CommitResult {
  const member = requireMember(household, input.memberId);
  const punch = activeOpenShift(household.kitchen, member.id);
  if (!punch) throw new ValidationError("That shift is no longer open.");
  if (Number.isNaN(Date.parse(input.startedAt)) || Number.isNaN(Date.parse(input.endedAt)) || Date.parse(input.endedAt) <= Date.parse(input.startedAt)) {
    throw new ValidationError("Clock-out must be after clock-in.");
  }
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  next.kitchen = shapeKitchen(next.kitchen);
  const at = nowIso();
  next.kitchen.openShifts = next.kitchen.openShifts.map((row) => row.id === punch.id ? {
    ...row,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    breaks: input.breaks,
    status: "confirming",
    updatedAt: at,
  } : row);
  next.kitchen = shapeKitchen(next.kitchen);
  return commit(previous, next, "Edit timesheet", `${member.name} corrected clock and break times before Confirm`, []);
}

export function abandonOpenShift(household: Household, input?: { memberId?: string }): CommitResult {
  const punch = activeOpenShift(household.kitchen, input?.memberId);
  if (!punch) throw new ValidationError("Nobody is on the clock.");
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  next.kitchen = shapeKitchen(next.kitchen);
  const at = nowIso();
  next.kitchen.openShifts = next.kitchen.openShifts.map((row) => row.id === punch.id ? { ...row, status: "cleared", updatedAt: at } : row);
  return commit(previous, next, "Clock out", "Wiped an open punch. Not a reverse.", []);
}

export function chooseOpenShiftTimeline(household: Household, input: { memberId: string; keepId: string }): CommitResult {
  const member = requireMember(household, input.memberId);
  const conflicts = openShiftConflicts(household.kitchen, member.id);
  const keep = conflicts.find((row) => row.id === input.keepId);
  if (!keep) throw new ValidationError("That device timeline is no longer waiting.");
  if (conflicts.length < 2) throw new ValidationError("There is only one timeline now; nothing needs choosing.");
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  next.kitchen = shapeKitchen(next.kitchen);
  const at = nowIso();
  next.kitchen.openShifts = next.kitchen.openShifts.map((row) => row.memberId === member.id && row.status !== "cleared" && row.id !== keep.id
    ? { ...row, status: "cleared", updatedAt: at }
    : row);
  return commit(previous, next, "Choose Timesheet", `${member.name} kept one device timeline; no money posted`, []);
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

function parseMoneyCents(
  value: string | number,
  label: string,
  options: { allowZero?: boolean; allowNegative?: boolean } = {},
): number {
  try {
    return parseWholeCents(value, label, options);
  } catch (error) {
    throw new ValidationError(error instanceof Error ? error.message : String(error));
  }
}

function parseLimitCents(value: string | number | undefined, label: string): number {
  if (value === undefined || value === null || value === "") return 0;
  return parseMoneyCents(value, label, { allowZero: true });
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
  scope?: AccountScope;
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
  purpose?: SavingsPurpose;
}): CommitResult {
  requireTimezone(household);
  const name = input.name.trim();
  if (name.length < 2) throw new ValidationError("Give the account a name with at least two letters.");
  const kind = normalizeAccountKind(input.kind);
  if (input.ownerMemberId && input.ownerMemberId !== "joint") requireMember(household, input.ownerMemberId);
  if (input.scope === "personal" && (!input.ownerMemberId || input.ownerMemberId === JOINT)) {
    throw new ValidationError("Choose the member who owns this Personal account.");
  }
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
    scope: input.scope === "personal" ? "personal" : "shared",
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
    savings: kind === "savings"
      ? { apyBps: parseBps(input.apyPercent, "APY"), purpose: input.purpose === "goals" ? "goals" : "general" }
      : null,
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
  purpose?: SavingsPurpose;
  vehicle?: InvestmentVehicle;
  ownerMemberId?: string;
  scope?: AccountScope;
}): CommitResult {
  requireTimezone(household);
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const account = next.accounts.find((row) => row.id === input.accountId);
  if (!account) throw new ValidationError("That account is gone.");
  const nextOwner = input.ownerMemberId ?? account.ownerMemberId;
  const nextScope = input.scope ?? account.scope ?? "shared";
  if (nextOwner !== JOINT) requireMember(household, nextOwner);
  if (nextScope === "personal" && nextOwner === JOINT) throw new ValidationError("A Personal account needs one member owner.");
  if (account.scope !== "personal" && nextScope === "personal") {
    const sharedUse = next.transactions.some((tx) => tx.accountId === account.id && tx.visibility !== "personal")
      || next.recurrences.some((row) => row.accountId === account.id || row.transferToAccountId === account.id)
      || next.transactions.some((tx) => tx.funding?.destinationAccountId === account.id);
    if (sharedUse) throw new ValidationError("Move shared rows and plans off this account before making its metadata Personal.");
  }
  account.ownerMemberId = nextOwner;
  account.scope = nextScope;
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
  if (account.kind === "savings" && (input.apyPercent !== undefined || input.purpose)) {
    account.savings = {
      apyBps: input.apyPercent !== undefined
        ? parseBps(input.apyPercent, "APY")
        : (account.savings?.apyBps ?? 0),
      purpose: input.purpose === "goals" || (input.purpose !== "general" && account.savings?.purpose === "goals")
        ? "goals"
        : "general",
    };
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
    createdBy: input.createdBy,
  });
}

export function postSavingsInterest(household: Household, input: {
  accountId: string;
  date?: string;
  createdBy?: string;
  confirmDuplicate?: boolean;
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
  next.sitDownSessions = shapeSitDownSessions(next.sitDownSessions);
  const session = next.sitDownSessions.find((row) => row.monthKey === sourceMonth && row.status !== "closed");
  if (session) {
    session.budgetPosted = true;
    session.updatedAt = nowIso();
  }
  return commit(previous, next, "Monthly Sit-Down", `Planned ${preview.targetMonth} from ${sourceMonth}`, []);
}

function upsertSitDownSession(household: Household, patch: Partial<SitDownSession> & { monthKey: MonthKey; createdBy: string }): SitDownSession {
  const leftover = leftoverProjection(household, todayKey());
  const existing = openSitDownSession(household, patch.monthKey);
  const at = nowIso();
  const row: SitDownSession = {
    id: existing?.id || nextId("SIT-", (household.sitDownSessions ?? []).map((item) => item.id), 4),
    monthKey: patch.monthKey,
    targetMonth: patch.targetMonth || existing?.targetMonth || shiftMonthKey(patch.monthKey, 1),
    act: patch.act ?? existing?.act ?? 1,
    leftoverCents: patch.leftoverCents ?? leftover.leftoverCents,
    cashLikeCents: leftover.cashLikeCents,
    billsNext30Cents: leftover.billsNext30Cents,
    minPaymentsCents: leftover.minPaymentsCents,
    slices: patch.slices ?? existing?.slices ?? [],
    transferIds: patch.transferIds ?? existing?.transferIds ?? [],
    contributionIds: patch.contributionIds ?? existing?.contributionIds ?? [],
    budgetPosted: patch.budgetPosted ?? existing?.budgetPosted ?? false,
    closedMonth: patch.closedMonth ?? existing?.closedMonth ?? false,
    driveFileId: patch.driveFileId === undefined ? existing?.driveFileId ?? null : patch.driveFileId,
    status: patch.status ?? existing?.status ?? "open",
    createdBy: existing?.createdBy || patch.createdBy,
    createdAt: existing?.createdAt || at,
    updatedAt: at,
  };
  const rest = (household.sitDownSessions ?? []).filter((item) => item.id !== row.id);
  household.sitDownSessions = shapeSitDownSessions([...rest, row]);
  return row;
}

export function saveSitDownSession(household: Household, input: {
  monthKey: MonthKey;
  act?: 1 | 2 | 3;
  slices?: AllocationSlice[];
  createdBy?: string;
}): CommitResult {
  const actor = resolveActor(household, input);
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  next.sitDownSessions = shapeSitDownSessions(next.sitDownSessions);
  upsertSitDownSession(next, {
    monthKey: input.monthKey,
    act: input.act,
    slices: input.slices,
    createdBy: actor.createdBy,
  });
  return commit(previous, next, "Sit-down", `Saved the ${input.monthKey} sit-down`, []);
}

export function executeSitDownMoves(household: Household, input: {
  monthKey: MonthKey;
  slices: AllocationSlice[];
  createdBy?: string;
}): CommitResult {
  const actor = resolveActor(household, input);
  const date = todayKey();
  requireOpenPeriod(household, date);
  const withVault = ensureGoalsVault(household);
  const working = withVault.household;
  const leftover = leftoverProjection(working, date);
  const plan = plannedAllocation(leftover.leftoverCents, input.slices);
  if (!plan.ok) throw new ValidationError(plan.reason);
  if (plan.allocatedCents <= 0) {
    throw new ValidationError(leftover.leftoverCents
      ? "Nothing in the plan moves leftover. Add a jar, a paydown, or a savings line."
      : leftover.formula);
  }
  const sourceId = leftoverSourceAccountId(working, plan.allocatedCents, date);
  if (!sourceId) throw new ValidationError("No cash-like account holds leftover.");
  const sourceBalance = bookBalanceAsOf(working, sourceId, date);
  if (sourceBalance < plan.allocatedCents) {
    throw new ValidationError(`Chequing/cash-like only holds $${(sourceBalance / 100).toFixed(2)}. Shrink the plan.`);
  }
  const parkingId = jarParkingAccountId(working);
  const previous = cloneHousehold(household);
  let next = cloneHousehold(working);
  const transferIds: string[] = [];
  const contributionIds: string[] = [];
  const warnings: string[] = [...withVault.warnings];
  for (const line of plan.lines) {
    if (line.cents <= 0) continue;
    if (line.kind === "account") {
      if (line.targetId === sourceId) throw new ValidationError("Pick a destination that is not the leftover source.");
      const moved = postTransfer(next, {
        date,
        amount: line.cents / 100,
        fromAccountId: sourceId,
        toAccountId: line.targetId,
        note: `Sit-down · ${line.label}`,
        confirmDuplicate: true,
        createdBy: actor.createdBy,
      });
      next = moved.household;
      transferIds.push(...moved.postedIds);
      continue;
    }
    const goal = next.goals.find((item) => item.id === line.targetId);
    if (!goal) throw new ValidationError(`The ${line.label} jar is gone.`);
    if (parkingId && parkingId !== sourceId) {
      const moved = postTransfer(next, {
        date,
        amount: line.cents / 100,
        fromAccountId: sourceId,
        toAccountId: parkingId,
        note: `Sit-down jar · ${goal.name}`,
        confirmDuplicate: true,
        createdBy: actor.createdBy,
      });
      next = moved.household;
      transferIds.push(...moved.postedIds);
      const contributed = contributeToGoal(next, goal.id, line.cents / 100, {
        createdBy: actor.createdBy,
        date,
        transferId: moved.postedIds[0] ?? null,
        markFunded: true,
      });
      next = contributed.household;
      contributionIds.push(...contributed.postedIds);
    } else if (!parkingId) {
      warnings.push(`${goal.name} is tracked on the jar. Cash stayed in the leftover source because there is no separate savings account.`);
      const contributed = contributeToGoal(next, goal.id, line.cents / 100, { createdBy: actor.createdBy, date });
      next = contributed.household;
      contributionIds.push(...contributed.postedIds);
    } else {
      const contributed = contributeToGoal(next, goal.id, line.cents / 100, {
        createdBy: actor.createdBy,
        date,
        markFunded: true,
      });
      next = contributed.household;
      contributionIds.push(...contributed.postedIds);
    }
  }
  upsertSitDownSession(next, {
    monthKey: input.monthKey,
    slices: input.slices,
    transferIds,
    contributionIds,
    status: "moved",
    act: 3,
    leftoverCents: leftover.leftoverCents,
    createdBy: actor.createdBy,
  });
  return commit(
    previous,
    next,
    "Sit-down move",
    `Moved $${(plan.allocatedCents / 100).toFixed(2)} from the ${input.monthKey} sit-down`,
    [...transferIds, ...contributionIds],
    warnings,
  );
}

export function recordSitDownDrive(household: Household, sessionId: string, driveFileId: string | null): CommitResult {
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  next.sitDownSessions = shapeSitDownSessions(next.sitDownSessions);
  const session = next.sitDownSessions.find((row) => row.id === sessionId);
  if (!session) throw new ValidationError("That sit-down is gone.");
  session.driveFileId = driveFileId;
  session.updatedAt = nowIso();
  return commit(previous, next, "Sit-down", "Remembered a Drive file id (not the file)", []);
}

/**
 * Turn this month's sit-down weights into monthly transfer standing orders for next month.
 * Confirm still posts each due transfer. Never auto-posts.
 */
export function adoptSitDownStandingOrders(household: Household, input: {
  monthKey: MonthKey;
  slices?: AllocationSlice[];
} & ActorInput): CommitResult {
  const actor = resolveActor(household, input);
  const date = todayKey();
  const leftover = leftoverProjection(household, date);
  const session = openSitDownSession(household, input.monthKey);
  const slices = input.slices?.length ? input.slices : session?.slices ?? [];
  if (!slices.length) throw new ValidationError("Save a sit-down plan before remembering standing orders.");
  const cents = Math.max(leftover.leftoverCents, 100); // weights need a positive pool; amounts are proportional
  const plan = plannedAllocation(cents, slices);
  if (!plan.ok) throw new ValidationError(plan.reason);
  const nextMonth = shiftMonthKey(input.monthKey, 1);
  const nextDate = `${nextMonth}-01`;
  let working = ensureGoalsVault(household).household;
  const sourceId = leftoverSourceAccountId(working, cents, date)
    ?? working.accounts.find((a) => a.active && a.kind === "chequing")?.id;
  if (!sourceId) throw new ValidationError("Need a cash-like account for standing orders.");
  const parkingId = jarParkingAccountId(working);
  const postedIds: string[] = [];
  const warnings: string[] = [];
  for (const line of plan.lines) {
    if (line.cents <= 0) continue;
    if (line.kind === "goal") {
      if (!parkingId) {
        warnings.push(`Skipped ${line.label} — no Goals savings.`);
        continue;
      }
      const goal = working.goals.find((g) => g.id === line.targetId);
      const result = addRecurrence(working, {
        cadence: "monthly",
        nextDate,
        type: "transfer",
        amount: line.cents / 100,
        accountId: sourceId,
        transferToAccountId: parkingId,
        goalId: line.targetId,
        note: `Standing · jar · ${goal?.name ?? line.label}`,
        kind: "other",
        origin: "manual",
      });
      working = result.household;
      postedIds.push(...result.postedIds);
      continue;
    }
    if (line.targetId === sourceId) continue;
    const result = addRecurrence(working, {
      cadence: "monthly",
      nextDate,
      type: "transfer",
      amount: line.cents / 100,
      accountId: sourceId,
      transferToAccountId: line.targetId,
      note: `Standing · ${line.label}`,
      kind: "other",
      origin: "manual",
    });
    working = result.household;
    postedIds.push(...result.postedIds);
  }
  if (!postedIds.length) {
    throw new ValidationError(warnings[0] ?? "Nothing in the sit-down plan became a standing order.");
  }
  // Also seed next month's sit-down with the same weights so the ceremony opens configured.
  working = saveSitDownSession(working, {
    monthKey: nextMonth,
    act: 3,
    slices,
    createdBy: actor.createdBy,
  }).household;
  return {
    household: working,
    warnings,
    postedIds,
    undo: {
      id: `sit-orders-${input.monthKey}`,
      label: "Sit-down standing orders",
      snapshot: household,
      postedIds,
    },
  };
}

export function addGoal(household: Household, input: {
  name: string;
  target: string | number;
  deadline?: string | null;
  arrivalDate?: string | null;
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
  const arrival = input.arrivalDate
    ? parseDate(input.arrivalDate)
    : input.deadline
      ? parseDate(input.deadline)
      : null;
  next.goalContributions = [...(next.goalContributions ?? [])];
  next.goals.push({
    id,
    name: input.name.trim(),
    targetCents,
    savedCents: 0,
    deadline: input.deadline ? parseDate(input.deadline) : arrival,
    arrivalDate: arrival,
    shared: input.shared !== false,
    ownerMemberId: input.ownerMemberId ?? null,
    subcategoryId: input.subcategoryId ?? null,
    status: "unfunded",
    funded: false,
    retiredAt: null,
    purchaseId: null,
    createdAt: at,
    updatedAt: at,
  });
  return commit(previous, next, "Add Goal", input.name.trim(), [id]);
}

export function contributeToGoal(household: Household, goalId: string, amount: string | number, input: ActorInput & {
  date?: string;
  transferId?: string | null;
  markFunded?: boolean;
} = {}): CommitResult {
  const amountCents = parseAmount(amount, "Contribution");
  const actor = resolveActor(household, input);
  const date = input.date ? parseDate(input.date) : todayKey();
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const goal = next.goals.find((item) => item.id === goalId);
  if (!goal) throw new ValidationError("That goal no longer exists.");
  if (goalStatus(goal) === "retired") {
    throw new ValidationError("That jar already lives in the retirement home. Start a new one if you are saving again.");
  }
  const at = nowIso();
  next.goalContributions = [...(next.goalContributions ?? [])];
  const id = nextId("GCON-", next.goalContributions.map((row) => row.id), 4);
  next.goalContributions.push({
    id,
    goalId,
    memberId: actor.createdBy,
    amountCents,
    date,
    transferId: input.transferId ?? null,
    createdAt: at,
    updatedAt: at,
  });
  goal.savedCents = savedCentsFromContributions(next.goalContributions, goal.id);
  if (input.markFunded || input.transferId) {
    goal.funded = true;
    if (goal.status !== "retired") goal.status = "open";
  }
  goal.updatedAt = at;
  return commit(previous, next, "Goal Progress", `${goal.name} +$${(amountCents / 100).toFixed(2)}`, [id]);
}

/**
 * Move cash into the Goals vault, then append the envelope contribution.
 * Confirm still writes. Hercules never calls this.
 */
export function fundGoal(household: Household, input: {
  goalId: string;
  amount: string | number;
  fromAccountId: string;
  date?: string;
} & ActorInput): CommitResult {
  const actor = resolveActor(household, input);
  const date = input.date ? parseDate(input.date) : todayKey();
  const amountCents = parseAmount(input.amount, "Contribution");
  const goal = household.goals.find((item) => item.id === input.goalId);
  if (!goal) throw new ValidationError("That goal no longer exists.");
  if (goalStatus(goal) === "retired") {
    throw new ValidationError("That jar already lives in the retirement home.");
  }
  let working = household;
  const withVault = ensureGoalsVault(working);
  working = withVault.household;
  const vault = goalsVaultAccount(working);
  if (!vault) throw new ValidationError("Open Goals savings first.");
  if (input.fromAccountId === vault.id) {
    throw new ValidationError("Pick a source account that is not Goals savings.");
  }
  requireOpenPeriod(working, date);
  const moved = postTransfer(working, {
    date,
    amount: amountCents / 100,
    fromAccountId: input.fromAccountId,
    toAccountId: vault.id,
    note: `Fund goal · ${goal.name}`,
    confirmDuplicate: true,
    createdBy: actor.createdBy,
  });
  const transferId = moved.postedIds[0] ?? null;
  const contributed = contributeToGoal(moved.household, goal.id, amountCents / 100, {
    createdBy: actor.createdBy,
    date,
    transferId,
    markFunded: true,
  });
  return {
    household: contributed.household,
    warnings: [...withVault.warnings, ...moved.warnings, ...contributed.warnings],
    postedIds: [...withVault.postedIds, ...moved.postedIds, ...contributed.postedIds],
    undo: {
      id: contributed.undo.id,
      label: `Fund ${goal.name}`,
      snapshot: household,
      postedIds: [...withVault.postedIds, ...moved.postedIds, ...contributed.postedIds],
    },
  };
}

export function ensureGoalsVault(household: Household): CommitResult {
  if (goalsVaultAccount(household)) {
    return {
      household,
      warnings: [],
      postedIds: [],
      undo: { id: "vault-present", label: "Goals savings already open", snapshot: household, postedIds: [] },
    };
  }
  return addAccount(household, {
    name: "Goals savings",
    kind: "savings",
    purpose: "goals",
    institution: "EQ Bank",
    apyPercent: 0,
  });
}

export function purchaseGoal(household: Household, input: {
  goalId: string;
  amount: string | number;
  lines?: { note: string; amount: string | number }[];
  date?: string;
  subcategoryId?: string;
} & ActorInput): CommitResult {
  const actor = resolveActor(household, input);
  const date = input.date ? parseDate(input.date) : todayKey();
  requireOpenPeriod(household, date);
  const spentCents = parseAmount(input.amount, "Purchase");
  const goal = household.goals.find((item) => item.id === input.goalId);
  if (!goal) throw new ValidationError("That goal no longer exists.");
  if (goalStatus(goal) === "retired") {
    throw new ValidationError("That jar already lives in the retirement home.");
  }
  if (!goal.funded) {
    throw new ValidationError("Fund this goal with a real transfer into Goals savings first. Envelope-only progress is unfunded.");
  }
  if (goal.savedCents < goal.targetCents) {
    throw new ValidationError("Fill the jar before you buy it. Contribute stays on Plan.");
  }
  const vault = goalsVaultAccount(household);
  if (!vault) throw new ValidationError("Open Goals savings first. Sit-down Confirm can create one.");
  const spendable = vaultSpendableCents(household, goal.id, date);
  if (spentCents > spendable) {
    throw new ValidationError(
      `Goals savings can spare $${(spendable / 100).toFixed(2)} without raiding other goals. Transfer extra in, or spend less.`,
    );
  }
  const lines = (input.lines ?? []).map((row) => ({
    note: String(row.note ?? "").trim().slice(0, 80),
    amountCents: parseAmount(row.amount, "Purchase line"),
  })).filter((row) => row.amountCents > 0);
  const lineSum = lines.reduce((sum, row) => sum + row.amountCents, 0);
  if (lines.length && lineSum !== spentCents) {
    throw new ValidationError(`Itemized lines add to $${(lineSum / 100).toFixed(2)}, not $${(spentCents / 100).toFixed(2)}.`);
  }
  const posting = lines.length ? lines : [{ note: `Purchased ${goal.name}`, amountCents: spentCents }];
  const subcategoryId = input.subcategoryId ?? goal.subcategoryId ?? "SUB-LIFE-FUN";
  requireSubcategory(household, subcategoryId, "expense");
  const previous = cloneHousehold(household);
  let next = cloneHousehold(household);
  next.goalPurchases = [...(next.goalPurchases ?? [])];
  const purchaseId = nextId("GPUR-", next.goalPurchases.map((row) => row.id), 4);
  const transactionIds: string[] = [];
  for (const line of posting) {
    const posted = postEntry(next, {
      date,
      type: "expense",
      amount: line.amountCents / 100,
      accountId: vault.id,
      subcategoryId,
      note: line.note || `Purchased ${goal.name}`,
      confirmDuplicate: true,
      createdBy: actor.createdBy,
      source: "manual",
      sourceId: purchaseId,
    });
    next = posted.household;
    transactionIds.push(...posted.postedIds);
  }
  const at = nowIso();
  next.goalPurchases = [...(next.goalPurchases ?? [])];
  next.goalPurchases.push({
    id: purchaseId,
    goalId: goal.id,
    spentCents,
    vaultAccountId: vault.id,
    transactionIds,
    lines: posting,
    memberId: actor.createdBy,
    date,
    createdAt: at,
    updatedAt: at,
  });
  const live = next.goals.find((item) => item.id === goal.id);
  if (live) {
    live.status = "retired";
    live.retiredAt = at;
    live.purchaseId = purchaseId;
    live.updatedAt = at;
    live.savedCents = savedCentsFromContributions(next.goalContributions, live.id);
  }
  return commit(
    previous,
    next,
    "Goal purchased",
    `${goal.name} · spent $${(spentCents / 100).toFixed(2)}`,
    [purchaseId, ...transactionIds],
  );
}

export function addRecurrence(household: Household, input: {
  cadence: Recurrence["cadence"];
  nextDate: string;
  type: "expense" | "income" | "transfer";
  amount: string | number;
  accountId: string;
  transferToAccountId?: string | null;
  goalId?: string | null;
  subcategoryId?: string;
  note?: string;
  splits?: Split[];
  kind?: RecurrenceKind;
  origin?: RecurrenceOrigin;
  reminderHoursBefore?: number;
  fundingDefault?: HouseholdFundFundingDefault | null;
}): CommitResult {
  const amountCents = parseAmount(input.amount);
  const fundingDefault = resolveHouseholdFundFundingDefault(household, input.type, amountCents, input.fundingDefault);
  requireAccount(household, input.accountId);
  if (input.type === "transfer") {
    if (!input.transferToAccountId) throw new ValidationError("A transfer standing order needs a destination account.");
    requireAccount(household, input.transferToAccountId);
    if (input.transferToAccountId === input.accountId) {
      throw new ValidationError("Choose two different accounts for a transfer standing order.");
    }
  } else {
    if (!input.subcategoryId) throw new ValidationError("Pick a category.");
    requireSubcategory(household, input.subcategoryId, input.type);
  }
  const subcategory = input.type === "transfer" || !input.subcategoryId
    ? null
    : requireSubcategory(household, input.subcategoryId, input.type);
  const splits = catalogValidateOwned(input.splits ?? jointSplit(amountCents), amountCents, household);
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const id = nextId("REC-", next.recurrences.map((item) => item.id), 3);
  const at = nowIso();
  const note = input.note ?? "";
  next.recurrences.push({
    id,
    cadence: normalizeRecurrenceCadence(input.cadence),
    nextDate: parseDate(input.nextDate),
    type: input.type,
    amountCents,
    accountId: input.accountId,
    transferToAccountId: input.type === "transfer" ? (input.transferToAccountId ?? null) : null,
    goalId: input.type === "transfer" ? (input.goalId ?? null) : null,
    subcategoryId: input.subcategoryId || "SUB-LIFE-FUN",
    note,
    splits,
    active: true,
    autoPost: false,
    kind: input.kind ?? inferRecurrenceKind({
      type: input.type === "transfer" ? "expense" : input.type,
      note,
      subcategoryName: subcategory?.name ?? note,
    }),
    origin: input.origin ?? "manual",
    reminderHoursBefore: input.reminderHoursBefore ?? DEFAULT_REMINDER_HOURS_BEFORE,
    googleSync: {},
    fundingDefault,
    createdAt: at,
    updatedAt: at,
  });
  return commit(previous, next, "Add Recurring", `${note || "Recurring"} ${input.cadence}`, [id]);
}

export function updateRecurrence(household: Household, input: {
  id: string;
  cadence: Recurrence["cadence"];
  nextDate: string;
  type: "expense" | "income" | "transfer";
  amount: string | number;
  accountId: string;
  transferToAccountId?: string | null;
  goalId?: string | null;
  subcategoryId?: string;
  note?: string;
  splits?: Split[];
  kind?: RecurrenceKind;
  fundingDefault?: HouseholdFundFundingDefault | null;
}): CommitResult {
  const amountCents = parseAmount(input.amount);
  const fundingDefault = resolveHouseholdFundFundingDefault(household, input.type, amountCents, input.fundingDefault);
  requireAccount(household, input.accountId);
  if (input.type === "transfer") {
    if (!input.transferToAccountId) throw new ValidationError("A transfer standing order needs a destination account.");
    requireAccount(household, input.transferToAccountId);
    if (input.transferToAccountId === input.accountId) {
      throw new ValidationError("Choose two different accounts for a transfer standing order.");
    }
  } else {
    if (!input.subcategoryId) throw new ValidationError("Pick a category.");
    requireSubcategory(household, input.subcategoryId, input.type);
  }
  const subcategory = input.type === "transfer" || !input.subcategoryId
    ? null
    : requireSubcategory(household, input.subcategoryId, input.type);
  const splits = catalogValidateOwned(input.splits ?? jointSplit(amountCents), amountCents, household);
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const item = next.recurrences.find((row) => row.id === input.id);
  if (!item) throw new ValidationError("That repeating item no longer exists.");
  const note = input.note ?? "";
  item.cadence = normalizeRecurrenceCadence(input.cadence);
  item.nextDate = parseDate(input.nextDate);
  item.type = input.type;
  item.amountCents = amountCents;
  item.accountId = input.accountId;
  item.transferToAccountId = input.type === "transfer" ? (input.transferToAccountId ?? null) : null;
  item.goalId = input.type === "transfer" ? (input.goalId ?? null) : null;
  item.subcategoryId = input.subcategoryId || item.subcategoryId || "SUB-LIFE-FUN";
  item.note = note;
  item.splits = splits;
  item.kind = input.kind ?? inferRecurrenceKind({
    type: input.type === "transfer" ? "expense" : input.type,
    note,
    subcategoryName: subcategory?.name ?? note,
  });
  item.fundingDefault = fundingDefault;
  item.updatedAt = nowIso();
  return commit(previous, next, "Edit Recurring", `${note || "Recurring"} ${item.cadence}`, [item.id]);
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
    ...shapeCalendar(result.household.calendar),
    dismissedRhythmKeys: (result.household.calendar?.dismissedRhythmKeys ?? []).filter((item) => item !== key),
  };
  return result;
}

export function dismissRhythm(household: Household, key: string): CommitResult {
  if (!key.trim()) throw new ValidationError("Nothing to dismiss.");
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  next.calendar = {
    ...shapeCalendar(next.calendar),
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

export function postOneRecurrence(
  household: Household,
  recurrenceId: string,
  today: DateKey,
  options: { allowNotDue?: boolean } = {},
): CommitResult {
  const item = household.recurrences.find((row) => row.id === recurrenceId && row.active);
  if (!item) throw new ValidationError("That repeating item is not active.");
  if (!options.allowNotDue && item.nextDate > today) throw new ValidationError("That item is not due yet.");
  const previous = cloneHousehold(household);
  let working = household;
  const postedIds: string[] = [];
  if (item.type === "transfer") {
    if (!item.transferToAccountId) throw new ValidationError("That standing order is missing a destination account.");
    const moved = postTransfer(working, {
      date: item.nextDate,
      amount: item.amountCents / 100,
      fromAccountId: item.accountId,
      toAccountId: item.transferToAccountId,
      note: item.note || "Standing transfer",
      confirmDuplicate: true,
    });
    working = moved.household;
    postedIds.push(...moved.postedIds);
    if (item.goalId) {
      const contributed = contributeToGoal(working, item.goalId, item.amountCents / 100, {
        date: item.nextDate,
        transferId: moved.postedIds[0] ?? null,
        markFunded: true,
      });
      working = contributed.household;
      postedIds.push(...contributed.postedIds);
    }
  } else {
    const posted = postEntry(working, {
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
      funding: item.fundingDefault ? {
        fundId: item.fundingDefault.fundId,
        fundedCents: item.fundingDefault.fundedCents === "full" ? item.amountCents : item.fundingDefault.fundedCents,
        destinationAccountId: item.fundingDefault.destinationAccountId,
      } : undefined,
    });
    working = posted.household;
    postedIds.push(...posted.postedIds);
  }
  const next = cloneHousehold(working);
  const current = next.recurrences.find((row) => row.id === item.id);
  if (current) {
    current.nextDate = advanceCadence(item.nextDate, item.cadence);
    current.updatedAt = nowIso();
  }
  return commit(previous, next, "Post Recurring", `Posted ${item.note || "recurring"}`, postedIds);
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

export function postDueRecurrences(household: Household, today: DateKey, recurrenceIds?: string[]): CommitResult {
  const previous = cloneHousehold(household);
  let next = cloneHousehold(household);
  const postedIds: string[] = [];
  const selected = recurrenceIds
    ? recurrenceIds.map((id) => next.recurrences.find((item) => item.id === id)).filter((item): item is Recurrence => Boolean(item))
    : next.recurrences.filter((item) => item.active && item.nextDate <= today);
  const due = selected.filter((item) => item.active && item.nextDate <= today);
  if (!due.length) throw new ValidationError("Nothing is due today.");
  for (const item of due) {
    const result = postOneRecurrence(next, item.id, today);
    next = result.household;
    postedIds.push(...result.postedIds);
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

function workReceivableAccount(household: Household, id: string, name: string, memberId: string, at: string) {
  return shapeAccount({
    id,
    name,
    kind: "receivable",
    currency: CURRENCY,
    active: true,
    ownerMemberId: memberId,
    institution: "Employer",
    last4: "",
    sortOrder: (household.accounts.reduce((max, account) => Math.max(max, account.sortOrder), 0) || 0) + 10,
    createdAt: at,
    updatedAt: at,
  }, household.accounts.length, at);
}

/** Add/Edit Job is catalog-only. It creates job-specific receivable accounts but never posts money. */
export function upsertWorkJob(household: Household, input: { job: WorkJob }): CommitResult {
  requireTimezone(household);
  const member = requireMember(household, input.job.memberId);
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const at = nowIso();
  const existing = (next.workJobs ?? []).find((row) => row.id === input.job.id);
  const jobId = existing?.id || uniquePrefixedId(`JOB-${slug(input.job.name || "work")}`, (next.workJobs ?? []).map((row) => row.id));
  const accountIds = next.accounts.map((account) => account.id);
  const wagesReceivableAccountId = existing?.wagesReceivableAccountId
    || input.job.wagesReceivableAccountId
    || uniquePrefixedId(`ACC-${slug(input.job.name || "work")}-WAGES-OWED`, accountIds);
  if (!next.accounts.some((account) => account.id === wagesReceivableAccountId)) {
    next.accounts.push(workReceivableAccount(next, wagesReceivableAccountId, `${input.job.name} · Wages owed`, member.id, at));
    accountIds.push(wagesReceivableAccountId);
  }
  const tipped = input.job.roles.some((role) => role.active && role.tipped);
  const cardTipsReceivableAccountId = tipped
    ? existing?.cardTipsReceivableAccountId
      || input.job.cardTipsReceivableAccountId
      || uniquePrefixedId(`ACC-${slug(input.job.name || "work")}-CARD-TIPS-OWED`, accountIds)
    : "";
  if (cardTipsReceivableAccountId && !next.accounts.some((account) => account.id === cardTipsReceivableAccountId)) {
    next.accounts.push(workReceivableAccount(next, cardTipsReceivableAccountId, `${input.job.name} · Card tips owed`, member.id, at));
  }

  const fallbackCash = next.accounts.find((account) => account.active && account.kind === "other")?.id
    || next.accounts.find((account) => account.active && account.kind === "chequing")?.id
    || "";
  const fallbackDeposit = next.accounts.find((account) => account.active && account.kind === "chequing")?.id || fallbackCash;
  const shaped = shapeWorkJob({
    ...input.job,
    id: jobId,
    memberId: member.id,
    wagesReceivableAccountId,
    cardTipsReceivableAccountId,
    defaults: {
      ...input.job.defaults,
      wagesDepositAccountId: input.job.defaults.wagesDepositAccountId || fallbackDeposit,
      cashTipsAccountId: input.job.defaults.cashTipsAccountId || fallbackCash,
      cardTipsDepositAccountId: input.job.defaults.cardTipsDepositAccountId || fallbackCash,
    },
    createdAt: existing?.createdAt || input.job.createdAt || at,
    updatedAt: at,
  }, at);
  if (!shaped.name.trim()) throw new ValidationError("Give this job a name.");
  if (!shaped.roles.some((role) => role.active)) throw new ValidationError("Add at least one active role.");
  for (const role of shaped.roles.filter((row) => row.active)) {
    const latest = role.rates.at(-1);
    if (!latest || (latest.grossHourlyRateCents <= 0 && latest.takeHomeHourlyRateCents <= 0)) {
      throw new ValidationError(`Add a wage rate for ${role.name}.`);
    }
  }
  next.workJobs = [...(next.workJobs ?? []).filter((row) => row.id !== jobId), shaped]
    .sort((left, right) => left.name.localeCompare(right.name));
  return commit(previous, next, existing ? "Edit Job" : "Add Job", `${existing ? "Updated" : "Added"} ${shaped.name}`, [jobId]);
}

export function archiveWorkJob(household: Household, jobId: string): CommitResult {
  const existing = (household.workJobs ?? []).find((job) => job.id === jobId);
  if (!existing) throw new ValidationError("That job is gone.");
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const at = nowIso();
  next.workJobs = (next.workJobs ?? []).map((job) => job.id === jobId ? { ...job, active: false, updatedAt: at } : job);
  return commit(previous, next, "Archive Job", `Archived ${existing.name}; shifts and owed balances remain`, []);
}

export function reversePostedMoney(household: Household, transactionId: string, input: ActorInput = {}): CommitResult {
  const tx = household.transactions.find((item) => item.id === transactionId);
  if (!tx) throw new ValidationError("That row is already gone.");
  const pair = tx.transferPairId
    ? household.transactions.find((item) => item.id === tx.transferPairId)
    : undefined;
  const shift = tx.source === "shift" && tx.sourceId
    ? household.shifts.find((item) => item.id === tx.sourceId)
    : undefined;
  const watched = [tx.id, pair?.id, ...(shift?.transactionIds ?? []), shift?.wagesTransactionId, shift?.tipsTransactionId].filter((id): id is string => Boolean(id));
  if (household.transactions.some((item) => item.reversalOfId && watched.includes(item.reversalOfId))) {
    throw new ValidationError("Already reversed. Reverse the reversing entry if you meant to reinstate.");
  }
  const date = todayKey();
  requireOpenPeriod(household, date);
  const actor = resolveActor(household, { ...input, visibility: input.visibility ?? tx.visibility }, tx.createdBy);
  const previous = cloneHousehold(household);
  let next = cloneHousehold(household);
  const postedIds: string[] = [];
  const dollars = `$${(tx.amountCents / 100).toFixed(2)}`;

  const shiftTransactionIds = shift?.transactionIds?.length
    ? shift.transactionIds
    : [shift?.wagesTransactionId, shift?.tipsTransactionId].filter((id): id is string => Boolean(id));
  const targets = shift
    ? next.transactions.filter((item) => shiftTransactionIds.includes(item.id))
    : tx.type === "transfer"
      ? []
      : [tx];

  if (tx.type === "transfer") {
    const fromId = tx.transferFromAccountId || tx.accountId;
    const toId = tx.transferToAccountId || pair?.accountId;
    if (!fromId || !toId) throw new ValidationError("That transfer is missing two accounts.");
    const moved = postTransfer(next, {
      date,
      amount: tx.amountCents / 100,
      fromAccountId: toId,
      toAccountId: fromId,
      note: `Reversal of ${tx.id}`,
      confirmDuplicate: true,
      reversalOfId: tx.id,
      createdBy: actor.createdBy,
      visibility: actor.visibility,
    });
    next = moved.household;
    postedIds.push(...moved.postedIds);
  } else {
    for (const original of targets) {
      if (!original.subcategoryId) throw new ValidationError("That row has no category to reverse.");
      const posted = postEntry(next, {
        date,
        type: original.type === "income" ? "income" : original.type === "refund" ? "refund" : "expense",
        amount: original.amountCents / 100,
        accountId: original.accountId,
        subcategoryId: original.subcategoryId,
        note: `Reversal of ${original.id}`,
        place: original.place,
        splits: original.splits,
        confirmDuplicate: true,
        reversalOfId: original.id,
        source: "reversal",
        createdBy: actor.createdBy,
        visibility: shift ? original.visibility : actor.visibility,
        funding: original.funding,
      });
      next = posted.household;
      postedIds.push(...posted.postedIds);
    }
  }

  const label = shift
    ? `Reversed ${tx.date} shift ${dollars}`
    : tx.type === "transfer"
      ? `Reversed ${tx.date} transfer ${dollars}`
      : `Reversed ${tx.date} ${tx.type} ${dollars}`;
  return commit(previous, next, "Reverse", label, postedIds);
}

/**
 * @deprecated Whole-snapshot undo — unsafe in dual-use (can tombstone partner live-pulled rows).
 * Product path uses {@link undoLedgerConfirm} (confirmation-scoped, postedIds only).
 * Retained for regression tests documenting the legacy hazard.
 */
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

export function scribbleChalk(household: Household, input: { text?: string; author: string; ink?: ChalkInk | null }): CommitResult {
  const ink = shapeChalkInk(input.ink ?? null);
  let text = (input.text ?? "").trim();
  if (!text && ink) text = detectChalkLetters(ink);
  if (!text && !hasChalkInk(ink)) throw new ValidationError("Write something first.");
  if (text.length > MAX_CHALK_CHARS) throw new ValidationError(`Keep it to ${MAX_CHALK_CHARS} characters. Silly, not a novel.`);
  requireMember(household, input.author);
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  next.kitchen = shapeKitchen(next.kitchen);
  const at = nowIso();
  const id = nextId("CHALK-", next.kitchen.chalkboard.map((note) => note.id), 4);
  next.kitchen.chalkboard = [
    ...next.kitchen.chalkboard,
    { id, text, author: input.author, createdAt: at, updatedAt: at, ink },
  ].slice(-MAX_CHALK_NOTES);
  return commit(previous, next, "Chalkboard", ink ? "Drew on the chalkboard" : "Scribbled on the chalkboard", []);
}

export function neatenChalk(household: Household, id: string): CommitResult {
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  next.kitchen = shapeKitchen(next.kitchen);
  const note = next.kitchen.chalkboard.find((item) => item.id === id);
  if (!note) throw new ValidationError("That scribble is already gone.");
  if (!hasChalkInk(note.ink)) throw new ValidationError("Nothing to neaten. Draw first.");
  const neat = organizeNeatText(detectChalkLetters(note.ink) || note.text);
  if (!neat) throw new ValidationError("I couldn't read that hand. Keep the drawing, or type it.");
  note.text = neat.slice(0, MAX_CHALK_CHARS);
  note.updatedAt = nowIso();
  return commit(previous, next, "Chalkboard", "Neatened a chalkboard note", []);
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

/** Replace a chalk note's ink after letter-erasing. Empty ink wipes the note. */
export function reviseChalkInk(household: Household, id: string, ink: ChalkInk | null): CommitResult {
  if (!hasChalkInk(ink)) return wipeChalk(household, id);
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  next.kitchen = shapeKitchen(next.kitchen);
  const note = next.kitchen.chalkboard.find((item) => item.id === id);
  if (!note) throw new ValidationError("That scribble is already gone.");
  const shaped = shapeChalkInk(ink);
  note.ink = shaped;
  const read = detectChalkLetters(shaped);
  if (read) note.text = read.slice(0, MAX_CHALK_CHARS);
  note.updatedAt = nowIso();
  return commit(previous, next, "Chalkboard", "Erased chalk", []);
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
  return commit(previous, next, "Close month", `Closed ${input.monthKey}. That month accepts no new posts until you reopen it.`, []);
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

function requireAppointmentParty(household: Household, memberId: AppointmentMemberId): void {
  if (memberId === JOINT || memberId === COMPANION) return;
  requireMember(household, memberId);
}

function ensureReceivableAccount(next: Household, at: string): string {
  try {
    return defaultReceivableAccountId(next);
  } catch {
    const taken = next.accounts.map((account) => account.id);
    const id = taken.includes(DEFAULT_RECEIVABLE_ID)
      ? uniquePrefixedId("ACC-CLAIMS", taken)
      : DEFAULT_RECEIVABLE_ID;
    const sortOrder = (next.accounts.reduce((max, account) => Math.max(max, account.sortOrder), 0) || 0) + 10;
    next.accounts = [...next.accounts, shapeAccount({
      id,
      name: "Benefits owing",
      kind: "receivable",
      currency: CURRENCY,
      active: true,
      ownerMemberId: JOINT,
      institution: "",
      last4: "",
      sortOrder,
      createdAt: at,
      updatedAt: at,
    }, next.accounts.length, at)];
    return id;
  }
}

function scanDuplicate(
  household: Household,
  actorCreatedBy: string,
  draft: Pick<Transaction, "date" | "amountCents" | "accountId" | "type" | "note" | "place" | "subcategoryId" | "source" | "sourceId">,
  confirmDuplicate?: boolean,
): void {
  const matches = findSimilarTransactions(household.transactions.filter((tx) => visibleForDuplicateScan(tx, actorCreatedBy)), draft);
  if (matches.length && !confirmDuplicate) {
    throw new NeedsConfirmationError("duplicate", describeSimilarMatches(matches), matches.map((match) => match.transaction));
  }
}

function assignTxId(next: Household, type: Transaction["type"]): string {
  const prefix = type === "income" ? "TXN-IN-" : type === "refund" ? "TXN-RF-" : type === "transfer" ? "TXN-TR-" : "TXN-EX-";
  return nextId(prefix, next.transactions.map((tx) => tx.id));
}

export function addAppointment(household: Household, input: {
  title: string;
  kind?: AppointmentKind;
  memberId?: AppointmentMemberId;
  place?: string;
  practitioner?: string;
  sensitivity?: AppointmentSensitivity;
  coverage?: Appointment["coverage"];
  nextDate: string;
  cadence?: AppointmentCadence | AppointmentCadence["kind"];
  typicalCost?: string | number;
  typicalRecovery?: string | number;
  subcategoryId: string;
  accountId: string;
}): CommitResult {
  requireTimezone(household);
  const title = input.title.trim();
  if (title.length < 2) throw new ValidationError("Name the visit.");
  const memberId = input.memberId ?? JOINT;
  requireAppointmentParty(household, memberId);
  requireAccount(household, input.accountId);
  requireSubcategory(household, input.subcategoryId, "expense");
  const typicalCostCents = input.typicalCost == null || input.typicalCost === ""
    ? 0
    : parseMoneyCents(input.typicalCost, "Typical cost", { allowZero: true });
  const typicalRecoveryCents = input.typicalRecovery == null || input.typicalRecovery === ""
    ? 0
    : parseMoneyCents(input.typicalRecovery, "Typical recovery", { allowZero: true });
  if (typicalRecoveryCents > typicalCostCents) throw new ValidationError("Expected recovery cannot exceed the visit cost.");
  const cadence = typeof input.cadence === "string" ? shapeCadence({ kind: input.cadence }) : shapeCadence(input.cadence);
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const at = nowIso();
  const id = nextId("APT-", next.appointments.map((item) => item.id), 3);
  const appointment = shapeAppointment({
    id,
    title,
    kind: input.kind ?? "other",
    memberId,
    place: input.place ?? "",
    practitioner: input.practitioner ?? "",
    sensitivity: input.sensitivity ?? "household",
    coverage: input.coverage ?? "private",
    nextDate: parseDate(input.nextDate),
    cadence,
    typicalCostCents,
    typicalRecoveryCents,
    subcategoryId: input.subcategoryId,
    accountId: input.accountId,
    lastVisitDate: null,
    lastPostedTransactionId: null,
    savingGoalId: null,
    active: true,
    createdAt: at,
    updatedAt: at,
  }, at);
  next.appointments = [...next.appointments, appointment];
  return commit(previous, next, "Appointment", appointment.title, [id]);
}

export function updateAppointment(household: Household, input: {
  appointmentId: string;
  title?: string;
  kind?: AppointmentKind;
  memberId?: AppointmentMemberId;
  nextDate?: string;
  cadence?: AppointmentCadence;
  typicalCost?: string | number;
  typicalRecovery?: string | number;
  sensitivity?: AppointmentSensitivity;
  coverage?: Appointment["coverage"];
  practitioner?: string;
  place?: string;
  active?: boolean;
  accountId?: string;
  subcategoryId?: string;
}): CommitResult {
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const appointment = next.appointments.find((item) => item.id === input.appointmentId);
  if (!appointment) throw new ValidationError("That visit is gone.");
  if (input.accountId) requireAccount(next, input.accountId);
  if (input.subcategoryId) requireSubcategory(next, input.subcategoryId, "expense");
  if (input.memberId) requireAppointmentParty(next, input.memberId);
  if (input.title != null) {
    const title = input.title.trim();
    if (title.length < 2) throw new ValidationError("Name the visit.");
    appointment.title = title;
  }
  if (input.kind) appointment.kind = input.kind;
  if (input.memberId) appointment.memberId = input.memberId;
  if (input.nextDate) appointment.nextDate = parseDate(input.nextDate);
  if (input.cadence) appointment.cadence = shapeCadence(input.cadence);
  if (input.typicalCost != null) appointment.typicalCostCents = parseMoneyCents(input.typicalCost, "Typical cost", { allowZero: true });
  if (input.typicalRecovery != null) appointment.typicalRecoveryCents = parseMoneyCents(input.typicalRecovery, "Typical recovery", { allowZero: true });
  if (appointment.typicalRecoveryCents > appointment.typicalCostCents) {
    throw new ValidationError("Expected recovery cannot exceed the visit cost.");
  }
  if (input.sensitivity) appointment.sensitivity = input.sensitivity;
  if (input.coverage) appointment.coverage = input.coverage;
  if (input.practitioner != null) appointment.practitioner = input.practitioner.trim().slice(0, 80);
  if (input.place != null) appointment.place = input.place.trim().slice(0, 80);
  if (input.active != null) appointment.active = input.active;
  if (input.accountId) appointment.accountId = input.accountId;
  if (input.subcategoryId) appointment.subcategoryId = input.subcategoryId;
  appointment.updatedAt = nowIso();
  return commit(previous, next, "Appointment", appointment.title, []);
}

export function postVisit(household: Household, input: {
  date: string;
  amount: string | number;
  accountId?: string;
  subcategoryId?: string;
  appointmentId?: string | null;
  expectedRecovery?: string | number;
  receivableAccountId?: string;
  claimKind?: ClaimKind;
  claimLabel?: string;
  craEligible?: boolean;
  lines?: Array<{ code?: string; description?: string; amountCents?: number; amount?: string | number }>;
  note?: string;
  place?: string;
  splits?: Split[];
  confirmDuplicate?: boolean;
  createdBy?: string;
  visibility?: Visibility;
}): CommitResult {
  requireTimezone(household);
  const date = parseDate(input.date);
  const amountCents = parseAmount(input.amount);
  const actor = resolveActor(household, input);
  requireOpenPeriod(household, date);
  const appointment = input.appointmentId
    ? household.appointments.find((item) => item.id === input.appointmentId)
    : undefined;
  if (input.appointmentId && !appointment) throw new ValidationError("That visit is gone.");
  const accountId = input.accountId || appointment?.accountId;
  if (!accountId) throw new ValidationError("Choose the account that paid.");
  requireAccount(household, accountId);
  const subcategoryId = input.subcategoryId || appointment?.subcategoryId;
  if (!subcategoryId) throw new ValidationError("Choose a category for the visit.");
  const subcategory = requireSubcategory(household, subcategoryId, "expense");
  const expectedRecoveryCents = input.expectedRecovery == null || input.expectedRecovery === ""
    ? (appointment ? estimateRecoveryCents(household, appointment) : 0)
    : parseMoneyCents(input.expectedRecovery, "Expected recovery", { allowZero: true });
  if (expectedRecoveryCents < 0 || expectedRecoveryCents > amountCents) {
    throw new ValidationError("Expected recovery must sit between $0 and the visit total.");
  }
  const lines = shapeBillLines((input.lines ?? []).map((line, index) => ({
    id: `LINE-${index + 1}`,
    code: line.code ?? "",
    description: line.description ?? "Item",
    amountCents: line.amountCents ?? (line.amount != null && line.amount !== "" ? parseAmount(line.amount, "Line") : 0),
  })));
  assertLinesSum(lines, amountCents);
  const splits = catalogValidateOwned(input.splits ?? jointSplit(amountCents), amountCents, household);
  const posted = visitPostedDefaults(appointment, {
    note: input.note,
    place: input.place,
    claimLabel: input.claimLabel,
  });
  const note = posted.note;
  const place = posted.place;
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const createdAt = nowIso();
  const expense = baseTx(next, {
    date,
    type: "expense",
    amountCents,
    accountId,
    categoryId: subcategory.parentId,
    subcategoryId: subcategory.id,
    note,
    place,
    splits,
    source: "visit",
    createdAt,
    createdBy: actor.createdBy,
    visibility: actor.visibility,
  });
  scanDuplicate(next, actor.createdBy, expense, input.confirmDuplicate);
  expense.id = assignTxId(next, "expense");
  next.transactions.push(expense);
  const postedIds = [expense.id];
  let claim: Claim | null = null;
  if (expectedRecoveryCents > 0) {
    const receivableAccountId = input.receivableAccountId || ensureReceivableAccount(next, createdAt);
    const receivable = requireAccount(next, receivableAccountId);
    if (!isReceivableKind(receivable.kind)) {
      throw new ValidationError("Expected recovery posts to an Owed-to-us account, not a jar.");
    }
    const recoverySplits = catalogValidateOwned(jointSplit(expectedRecoveryCents), expectedRecoveryCents, next);
    const refund = baseTx(next, {
      date,
      type: "refund",
      amountCents: expectedRecoveryCents,
      accountId: receivable.id,
      categoryId: subcategory.parentId,
      subcategoryId: subcategory.id,
      note: `Expected recovery · ${note}`,
      place,
      splits: recoverySplits,
      source: "visit",
      refundOfId: expense.id,
      createdAt,
      createdBy: actor.createdBy,
      visibility: actor.visibility,
    });
    refund.id = assignTxId(next, "refund");
    next.transactions.push(refund);
    postedIds.push(refund.id);
    const claimId = nextId("CLM-", next.claims.map((item) => item.id), 3);
    refund.sourceId = claimId;
    expense.sourceId = claimId;
    const kind = input.claimKind ?? (appointment ? defaultClaimKind(appointment.kind) : "insurance");
    claim = {
      id: claimId,
      kind,
      label: posted.claimLabel,
      appointmentId: appointment?.id ?? null,
      expenseTransactionId: expense.id,
      recoveryTransactionId: refund.id,
      settleTransferIds: [],
      writeOffTransactionId: null,
      expectedCents: expectedRecoveryCents,
      receivedCents: 0,
      writtenOffCents: 0,
      receivableAccountId: receivable.id,
      status: "pending",
      submittedAt: null,
      settledAt: null,
      craEligible: input.craEligible ?? (appointment ? defaultCraEligible(appointment.kind) : false),
      lines,
      createdAt,
      updatedAt: createdAt,
    };
    claim.status = deriveClaimStatus(claim);
    next.claims = [...next.claims, claim];
    postedIds.push(claim.id);
  } else {
    expense.sourceId = appointment?.id;
    if (lines.length) {
      const receivableAccountId = input.receivableAccountId || ensureReceivableAccount(next, createdAt);
      const receivable = requireAccount(next, receivableAccountId);
      if (!isReceivableKind(receivable.kind)) {
        throw new ValidationError("Itemized visits still need an Owed-to-us account, even with $0 expected back.");
      }
      const claimId = nextId("CLM-", next.claims.map((item) => item.id), 3);
      expense.sourceId = claimId;
      claim = {
        id: claimId,
        kind: input.claimKind ?? (appointment ? defaultClaimKind(appointment.kind) : "other"),
        label: posted.claimLabel,
        appointmentId: appointment?.id ?? null,
        expenseTransactionId: expense.id,
        recoveryTransactionId: null,
        settleTransferIds: [],
        writeOffTransactionId: null,
        expectedCents: 0,
        receivedCents: 0,
        writtenOffCents: 0,
        receivableAccountId: receivable.id,
        status: "pending",
        submittedAt: null,
        settledAt: createdAt,
        craEligible: input.craEligible ?? (appointment ? defaultCraEligible(appointment.kind) : false),
        lines,
        createdAt,
        updatedAt: createdAt,
      };
      claim.status = deriveClaimStatus(claim);
      next.claims = [...next.claims, claim];
      postedIds.push(claim.id);
    }
  }
  if (appointment) {
    const row = next.appointments.find((item) => item.id === appointment.id);
    if (row) {
      row.lastVisitDate = date;
      row.lastPostedTransactionId = expense.id;
      row.typicalCostCents = amountCents;
      if (expectedRecoveryCents) row.typicalRecoveryCents = expectedRecoveryCents;
      if (row.cadence.kind === "once") {
        row.nextDate = date;
      } else {
        row.nextDate = advanceAppointmentCadence(date, row.cadence);
      }
      row.updatedAt = createdAt;
    }
  }
  const summary = claim
    ? `${note} ${formatVisitAmount(amountCents)} · ${formatVisitAmount(claim.expectedCents)} owing`
    : `${note} ${formatVisitAmount(amountCents)}`;
  return commit(previous, next, "Visit", summary, postedIds);
}

function formatVisitAmount(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function openClaim(household: Household, input: {
  expenseTransactionId: string;
  expectedRecovery: string | number;
  receivableAccountId?: string;
  claimKind?: ClaimKind;
  claimLabel?: string;
  craEligible?: boolean;
  appointmentId?: string | null;
  createdBy?: string;
  visibility?: Visibility;
}): CommitResult {
  requireTimezone(household);
  const expense = household.transactions.find((tx) => tx.id === input.expenseTransactionId);
  if (!expense || expense.type !== "expense") throw new ValidationError("Open a claim against a posted expense.");
  if (household.claims.some((claim) => claim.expenseTransactionId === expense.id)) {
    throw new ValidationError("That expense already has a claim.");
  }
  const expectedCents = parseAmount(input.expectedRecovery, "Expected recovery");
  if (expectedCents <= 0 || expectedCents > expense.amountCents) {
    throw new ValidationError("Expected recovery must sit between $0.01 and the expense total.");
  }
  if (!expense.subcategoryId) throw new ValidationError("That expense has no category to recover.");
  const actor = resolveActor(household, input, expense.createdBy);
  requireOpenPeriod(household, expense.date);
  const subcategory = requireSubcategory(household, expense.subcategoryId, "expense");
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const createdAt = nowIso();
  const receivable = requireAccount(next, input.receivableAccountId || ensureReceivableAccount(next, createdAt));
  if (!isReceivableKind(receivable.kind)) throw new ValidationError("Expected recovery posts to an Owed-to-us account, not a jar.");
  const refund = baseTx(next, {
    date: expense.date,
    type: "refund",
    amountCents: expectedCents,
    accountId: receivable.id,
    categoryId: subcategory.parentId,
    subcategoryId: subcategory.id,
    note: `Expected recovery · ${expense.note || "expense"}`,
    place: expense.place,
    splits: jointSplit(expectedCents),
    source: "visit",
    refundOfId: expense.id,
    createdAt,
    createdBy: actor.createdBy,
    visibility: actor.visibility,
  });
  refund.id = assignTxId(next, "refund");
  next.transactions.push(refund);
  const claimId = nextId("CLM-", next.claims.map((item) => item.id), 3);
  refund.sourceId = claimId;
  const claim: Claim = {
    id: claimId,
    kind: input.claimKind ?? "other",
    label: input.claimLabel?.trim() || expense.note || "Claim",
    appointmentId: input.appointmentId ?? null,
    expenseTransactionId: expense.id,
    recoveryTransactionId: refund.id,
    settleTransferIds: [],
    writeOffTransactionId: null,
    expectedCents,
    receivedCents: 0,
    writtenOffCents: 0,
    receivableAccountId: receivable.id,
    status: "pending",
    submittedAt: null,
    settledAt: null,
    craEligible: input.craEligible === true,
    lines: [],
    createdAt,
    updatedAt: createdAt,
  };
  claim.status = deriveClaimStatus(claim);
  next.claims = [...next.claims, claim];
  return commit(previous, next, "Claim", `${claim.label} ${formatVisitAmount(expectedCents)} owing`, [refund.id, claim.id]);
}

export function submitClaim(household: Household, claimId: string): CommitResult {
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const claim = next.claims.find((item) => item.id === claimId);
  if (!claim) throw new ValidationError("That claim is gone.");
  if (claimRemainingCents(claim) <= 0) throw new ValidationError("Nothing left to submit.");
  const at = nowIso();
  claim.submittedAt = at;
  claim.updatedAt = at;
  claim.status = deriveClaimStatus(claim);
  return commit(previous, next, "Claim", `Submitted ${claim.label}`, []);
}

export function settleClaim(household: Household, input: {
  claimId: string;
  amount?: string | number;
  toAccountId: string;
  date?: string;
  confirmDuplicate?: boolean;
  createdBy?: string;
  visibility?: Visibility;
}): CommitResult {
  requireTimezone(household);
  const claim = household.claims.find((item) => item.id === input.claimId);
  if (!claim) throw new ValidationError("That claim is gone.");
  const remaining = claimRemainingCents(claim);
  if (remaining <= 0) throw new ValidationError("That claim is already closed.");
  const receivedCents = input.amount == null || input.amount === "" ? remaining : parseAmount(input.amount, "Amount received");
  if (receivedCents <= 0) throw new ValidationError("Received amount must be more than zero.");
  const date = parseDate(input.date || todayKey());
  const actor = resolveActor(household, input);
  requireOpenPeriod(household, date);
  requireAccount(household, claim.receivableAccountId);
  requireAccount(household, input.toAccountId);
  if (input.toAccountId === claim.receivableAccountId) {
    throw new ValidationError("Settle into the account that received the money, not the claim itself.");
  }
  const toAccount = requireAccount(household, input.toAccountId);
  if (isReceivableKind(toAccount.kind)) throw new ValidationError("Settlement lands in cash, savings, or a card — not another claim.");
  const applyCents = Math.min(receivedCents, remaining);
  const extraCents = receivedCents - applyCents;
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const createdAt = nowIso();
  const postedIds: string[] = [];
  const note = `Claim landed · ${claim.label}`;
  const outDraft = baseTx(next, {
    date,
    type: "transfer",
    amountCents: applyCents,
    accountId: claim.receivableAccountId,
    categoryId: null,
    subcategoryId: null,
    note,
    splits: jointSplit(applyCents),
    source: "manual",
    createdAt,
    createdBy: actor.createdBy,
    visibility: actor.visibility,
  });
  const inDraft = baseTx(next, {
    date,
    type: "transfer",
    amountCents: applyCents,
    accountId: input.toAccountId,
    categoryId: null,
    subcategoryId: null,
    note,
    splits: jointSplit(applyCents),
    source: "manual",
    createdAt,
    createdBy: actor.createdBy,
    visibility: actor.visibility,
  });
  scanDuplicate(next, actor.createdBy, outDraft, input.confirmDuplicate);
  outDraft.id = assignTxId(next, "transfer");
  inDraft.id = assignTxId({ ...next, transactions: [...next.transactions, outDraft] }, "transfer");
  outDraft.transferPairId = inDraft.id;
  inDraft.transferPairId = outDraft.id;
  outDraft.transferFromAccountId = claim.receivableAccountId;
  outDraft.transferToAccountId = input.toAccountId;
  inDraft.transferFromAccountId = claim.receivableAccountId;
  inDraft.transferToAccountId = input.toAccountId;
  next.transactions.push(outDraft, inDraft);
  postedIds.push(outDraft.id, inDraft.id);
  const row = next.claims.find((item) => item.id === claim.id)!;
  row.receivedCents += applyCents;
  row.settleTransferIds = [...row.settleTransferIds, outDraft.id, inDraft.id];
  if (extraCents > 0) {
    const expense = next.transactions.find((tx) => tx.id === row.expenseTransactionId);
    if (!expense?.subcategoryId) throw new ValidationError("Cannot post extra recovery without the original expense.");
    const subcategory = requireSubcategory(next, expense.subcategoryId, "expense");
    const refund = baseTx(next, {
      date,
      type: "refund",
      amountCents: extraCents,
      accountId: input.toAccountId,
      categoryId: subcategory.parentId,
      subcategoryId: subcategory.id,
      note: `Extra recovery · ${claim.label}`,
      place: expense.place,
      splits: jointSplit(extraCents),
      source: "visit",
      sourceId: row.id,
      refundOfId: expense.id,
      createdAt,
      createdBy: actor.createdBy,
      visibility: actor.visibility,
    });
    refund.id = assignTxId(next, "refund");
    next.transactions.push(refund);
    postedIds.push(refund.id);
  }
  row.updatedAt = createdAt;
  if (claimRemainingCents(row) <= 0) row.settledAt = createdAt;
  row.status = deriveClaimStatus(row);
  return commit(previous, next, "Claim", `${claim.label} landed ${formatVisitAmount(receivedCents)}`, postedIds);
}

export function writeOffClaim(household: Household, input: {
  claimId: string;
  amount?: string | number;
  denied?: boolean;
  date?: string;
  createdBy?: string;
  visibility?: Visibility;
}): CommitResult {
  requireTimezone(household);
  const claim = household.claims.find((item) => item.id === input.claimId);
  if (!claim) throw new ValidationError("That claim is gone.");
  const remaining = claimRemainingCents(claim);
  if (remaining <= 0) throw new ValidationError("That claim is already closed.");
  const writeOffCents = input.amount == null || input.amount === "" ? remaining : parseAmount(input.amount, "Write-off");
  if (writeOffCents <= 0 || writeOffCents > remaining) {
    throw new ValidationError("Write-off must sit between $0.01 and the amount still owing.");
  }
  const expense = household.transactions.find((tx) => tx.id === claim.expenseTransactionId);
  if (!expense?.subcategoryId) throw new ValidationError("The original visit expense is gone.");
  const date = parseDate(input.date || todayKey());
  const actor = resolveActor(household, input);
  requireOpenPeriod(household, date);
  const subcategory = requireSubcategory(household, expense.subcategoryId, "expense");
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const createdAt = nowIso();
  const writeOff = baseTx(next, {
    date,
    type: "expense",
    amountCents: writeOffCents,
    accountId: claim.receivableAccountId,
    categoryId: subcategory.parentId,
    subcategoryId: subcategory.id,
    note: input.denied ? `Claim denied · ${claim.label}` : `Claim shortfall · ${claim.label}`,
    place: expense.place,
    splits: jointSplit(writeOffCents),
    source: "visit",
    sourceId: claim.id,
    createdAt,
    createdBy: actor.createdBy,
    visibility: actor.visibility,
  });
  writeOff.id = assignTxId(next, "expense");
  next.transactions.push(writeOff);
  const row = next.claims.find((item) => item.id === claim.id)!;
  row.writtenOffCents += writeOffCents;
  row.writeOffTransactionId = writeOff.id;
  row.updatedAt = createdAt;
  if (input.denied) row.status = "denied";
  if (claimRemainingCents(row) <= 0) row.settledAt = createdAt;
  if (row.status !== "denied") row.status = deriveClaimStatus(row);
  return commit(previous, next, "Claim", `${claim.label} ${input.denied ? "denied" : "short"} ${formatVisitAmount(writeOffCents)}`, [writeOff.id]);
}

export function acceptVisitGoal(household: Household, appointmentId: string, createdBy?: string): CommitResult {
  void createdBy;
  const today = todayKey();
  const proposal = proposeVisitGoal(household, appointmentId, today);
  if (!proposal) throw new ValidationError("Nothing to save toward. Set a typical cost, or the jar already exists.");
  const appointment = household.appointments.find((item) => item.id === appointmentId);
  if (!appointment) throw new ValidationError("That visit is gone.");
  const named = addGoal(household, {
    name: proposal.title,
    target: proposal.targetCents / 100,
    deadline: proposal.nextDate,
    shared: true,
    subcategoryId: appointment.subcategoryId,
  });
  const next = cloneHousehold(named.household);
  const row = next.appointments.find((item) => item.id === appointmentId);
  if (row) {
    row.savingGoalId = named.postedIds[0] ?? next.goals.at(-1)?.id ?? null;
    row.updatedAt = nowIso();
  }
  return { ...named, household: next };
}

export function activePresets(household: Household): Preset[] {
  return (household.presets ?? [])
    .filter((item) => item.active)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.note.localeCompare(right.note));
}

export function addPreset(household: Household, input: {
  type: "expense" | "income";
  amount?: string | number;
  accountId: string;
  subcategoryId: string;
  note?: string;
  place?: string;
  splits?: Split[];
  visibility?: Visibility;
  origin?: PresetOrigin;
  detectionKey?: string | null;
}): CommitResult {
  requireAccount(household, input.accountId);
  const subcategory = requireSubcategory(household, input.subcategoryId, input.type);
  const amountCents = input.amount == null || input.amount === ""
    ? 0
    : parseMoneyCents(input.amount, "Preset amount", { allowZero: true });
  const splits = amountCents > 0
    ? catalogValidateOwned(input.splits ?? jointSplit(amountCents), amountCents, household)
    : [];
  const note = (input.note ?? "").trim() || "Preset";
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  next.presets = [...(next.presets ?? [])];
  const id = nextId("PRE-", next.presets.map((item) => item.id), 3);
  const at = nowIso();
  const sortOrder = next.presets.reduce((max, item) => Math.max(max, item.sortOrder), 0) + 1;
  next.presets.push({
    id,
    type: input.type,
    amountCents,
    accountId: input.accountId,
    subcategoryId: subcategory.id,
    note,
    place: input.place ?? "",
    splits,
    visibility: parseVisibility(input.visibility),
    sortOrder,
    origin: input.origin ?? "manual",
    detectionKey: input.detectionKey ?? null,
    active: true,
    createdAt: at,
    updatedAt: at,
  });
  return commit(previous, next, "Preset", `Saved ${note} as a preset`, [id]);
}

export function archivePreset(household: Household, presetId: string): CommitResult {
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  next.presets = [...(next.presets ?? [])];
  const row = next.presets.find((item) => item.id === presetId);
  if (!row) throw new ValidationError("That preset is gone.");
  row.active = false;
  row.updatedAt = nowIso();
  return commit(previous, next, "Preset", `Forgot ${row.note}`, [row.id]);
}

export function acceptPresetNotice(household: Household, key: string): CommitResult {
  if (!key.trim()) throw new ValidationError("Nothing to save.");
  const today = todayKey();
  const habit = detectHabits(household, today).find((item) => item.key === key);
  if (!habit) throw new ValidationError("That habit is no longer waiting to be saved.");
  if ((household.presets ?? []).some((preset) => preset.active && (preset.detectionKey === key
    || (preset.type === habit.type && preset.subcategoryId === habit.subcategoryId
      && preset.amountCents === habit.amountCents && preset.note.trim().toLowerCase() === habit.note.trim().toLowerCase())))) {
    throw new ValidationError("That preset is already on Add.");
  }
  const result = addPreset(household, {
    type: habit.type,
    amount: habit.amountCents / 100,
    accountId: habit.accountId,
    subcategoryId: habit.subcategoryId,
    note: habit.note,
    splits: habit.splits.length ? habit.splits : undefined,
    origin: "detected",
    detectionKey: habit.key,
  });
  result.undo.label = `Saved ${habit.note} as a preset`;
  result.household.calendar = {
    ...shapeCalendar(result.household.calendar),
    dismissedNoticeKeys: (result.household.calendar?.dismissedNoticeKeys ?? []).filter((item) => item !== key),
  };
  return result;
}

export function dismissNotice(household: Household, key: string): CommitResult {
  if (!key.trim()) throw new ValidationError("Nothing to dismiss.");
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  next.calendar = {
    ...shapeCalendar(next.calendar),
    dismissedNoticeKeys: [...new Set([...(next.calendar?.dismissedNoticeKeys ?? []), key])].sort(),
  };
  return commit(previous, next, "Hercules", "Hid a notice", []);
}

function gamesMemberCount(household: Household): number {
  return household.members.filter((member) => member.active).length;
}

function assertGameTurn(household: Household, lastMemberId: string, memberId: string, hasStarted: boolean): void {
  requireMember(household, memberId);
  if (hasStarted && lastMemberId === memberId && gamesMemberCount(household) > 1) {
    throw new ValidationError("Wait for the other person. Two phones, one turn.");
  }
}

export function resetTicTacToe(household: Household, memberId: string): CommitResult {
  requireMember(household, memberId);
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  next.kitchen = shapeKitchen(next.kitchen);
  const at = nowIso();
  next.kitchen.games = shapeGames(next.kitchen.games);
  next.kitchen.games.tictactoe = {
    ...EMPTY_TICTACTOE,
    updatedAt: at,
    updatedBy: memberId,
  };
  return commit(previous, next, "Desk game", "New tic-tac-toe", []);
}

export function playTicTacToe(household: Household, input: { memberId: string; index: number }): CommitResult {
  const member = requireMember(household, input.memberId);
  const index = Math.round(input.index);
  if (!Number.isInteger(index) || index < 0 || index > 8) throw new ValidationError("That square is off the board.");
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  next.kitchen = shapeKitchen(next.kitchen);
  const game = next.kitchen.games.tictactoe;
  if (game.winner) throw new ValidationError("That game is over. Start a new one.");
  if (game.cells[index]) throw new ValidationError("That square is taken.");
  const started = game.cells.some(Boolean);
  assertGameTurn(household, game.lastMemberId, member.id, started);
  const mark = game.turn;
  game.cells[index] = mark;
  game.turn = mark === "x" ? "o" : "x";
  game.winner = tttWinner(game.cells);
  game.lastMemberId = member.id;
  game.updatedAt = nowIso();
  game.updatedBy = member.id;
  const summary = game.winner === "draw"
    ? "Cat's game."
    : game.winner
      ? `${member.name} wins tic-tac-toe.`
      : `${member.name} played ${mark.toUpperCase()}.`;
  return commit(previous, next, "Desk game", summary, []);
}

export function resetHangman(household: Household, memberId: string): CommitResult {
  requireMember(household, memberId);
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  next.kitchen = shapeKitchen(next.kitchen);
  const at = nowIso();
  next.kitchen.games = shapeGames(next.kitchen.games);
  next.kitchen.games.hangman = {
    ...emptyHangman(at),
    word: pickHangmanWord(at.replace(/\D/g, "")),
    updatedAt: at,
    updatedBy: memberId,
  };
  return commit(previous, next, "Desk game", "New hangman", []);
}

export function guessHangman(household: Household, input: { memberId: string; letter: string }): CommitResult {
  const member = requireMember(household, input.memberId);
  const letter = input.letter.trim().toLowerCase();
  if (!/^[a-z]$/.test(letter)) throw new ValidationError("Guess one letter.");
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  next.kitchen = shapeKitchen(next.kitchen);
  const game = next.kitchen.games.hangman;
  if (game.lost || game.winnerMemberId) throw new ValidationError("That word is done. Start a new one.");
  if (game.guessed.includes(letter)) throw new ValidationError("Already guessed.");
  const started = game.guessed.length > 0;
  assertGameTurn(household, game.updatedBy, member.id, started);
  game.guessed = [...game.guessed, letter];
  game.turnMemberId = member.id;
  game.updatedAt = nowIso();
  game.updatedBy = member.id;
  if (hangmanWon(game)) game.winnerMemberId = member.id;
  if (hangmanMisses(game) >= MAX_HANGMAN_MISSES) game.lost = true;
  const summary = game.winnerMemberId
    ? `${member.name} got the word.`
    : game.lost
      ? "Hung. New word when you're ready."
      : `${member.name} guessed ${letter.toUpperCase()}.`;
  return commit(previous, next, "Desk game", summary, []);
}

export function touchHouseholdDevice(household: Household, input: {
  deviceId: string;
  label: string;
  memberId?: string | null;
}): CommitResult {
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  next.devices = touchDevicePresence({
    devices: next.devices ?? [],
    deviceId: input.deviceId,
    label: input.label,
    memberId: input.memberId ?? null,
    environment: next.environment,
  });
  return {
    household: next,
    warnings: [],
    postedIds: [],
    undo: { id: `presence-${input.deviceId}`, label: `Saw ${input.label}`, snapshot: previous, postedIds: [] },
  };
}

function requireHouseholdFund(household: Household) {
  const fund = shapeHouseholdFundConfig(household.householdFund);
  if (!fund) throw new ValidationError("Set up the Hearth Household Fund first.");
  return fund;
}

function requireFundCustodian(household: Household, memberId: string) {
  const fund = requireHouseholdFund(household);
  requireMember(household, memberId);
  if (memberId !== fund.custodianMemberId) throw new ValidationError("Only the Household Fund custodian can confirm that action.");
  return fund;
}

function nextFundEventId(household: Household): string {
  return nextId("FUND-EVT-", shapeHouseholdFundEvents(household.fundEvents).map((row) => row.id), 4);
}

/** Preserve causal ledger order even when several confirmations share one clock millisecond. */
function nextFundEventAt(household: Household): string {
  const latest = shapeHouseholdFundEvents(household.fundEvents).reduce(
    (max, event) => Math.max(max, Date.parse(event.createdAt) || 0),
    0,
  );
  return new Date(Math.max(Date.now(), latest + 1)).toISOString();
}

export function configureHouseholdFund(household: Household, input: {
  custodianMemberId: string;
  openedOn: string;
  createdBy: string;
  name?: string;
}): CommitResult {
  requireTimezone(household);
  if (shapeHouseholdFundConfig(household.householdFund)) throw new ValidationError("The Hearth Household Fund is already configured.");
  requireMember(household, input.custodianMemberId);
  requireMember(household, input.createdBy);
  if (input.createdBy !== input.custodianMemberId) throw new ValidationError("The custodian must confirm the Household Fund setup.");
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const at = nowIso();
  next.householdFund = {
    id: HOUSEHOLD_FUND_ID,
    name: input.name?.trim().slice(0, 60) || HOUSEHOLD_FUND_NAME,
    custodianMemberId: input.custodianMemberId,
    mode: "practice",
    openedOn: parseDate(input.openedOn),
    createdAt: at,
    updatedAt: at,
  };
  next.fundMonthPlans = [];
  next.fundEvents = [];
  next.fundSettlementAllocations = [];
  next.fundKittyAllocations = [];
  next.fundPrivate = { bankBindings: [], reconciliations: [] };
  return commit(previous, next, "Household Fund", `Opened ${next.householdFund.name} at $0.00`, [next.householdFund.id]);
}

export function bindHouseholdFundBackingAccount(household: Household, input: {
  memberId: string;
  accountId: string;
  provider?: "manual" | "flinks";
  accountDigest?: string | null;
  connected?: boolean;
}): CommitResult {
  const fund = requireFundCustodian(household, input.memberId);
  const account = requireAccount(household, input.accountId);
  if (account.scope !== "personal" || account.ownerMemberId !== input.memberId) {
    throw new ValidationError("The backing savings account must be Bianca's Personal account metadata.");
  }
  if (account.kind !== "savings") throw new ValidationError("The Household Fund backing account must be savings.");
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const state = shapeHouseholdFundPrivate(next.fundPrivate, input.memberId);
  const at = nowIso();
  const id = `FUND-BANK-${fund.id}-${input.memberId}`;
  const row = {
    id,
    fundId: fund.id,
    memberId: input.memberId,
    provider: input.provider === "flinks" ? "flinks" as const : "manual" as const,
    accountId: account.id,
    accountDigest: input.accountDigest?.trim() || null,
    status: input.connected === true ? "connected" as const : "manual" as const,
    createdAt: state.bankBindings.find((item) => item.id === id)?.createdAt ?? at,
    updatedAt: at,
  };
  next.fundPrivate = { ...state, bankBindings: [...state.bankBindings.filter((item) => item.id !== id), row] };
  return commit(previous, next, "Household Fund", "Updated the custodian-only backing account", [id]);
}

export function setHouseholdFundMonthPlan(household: Household, input: {
  memberId: string;
  monthKey: MonthKey;
  target: string | number;
  buffer?: string | number;
  agreedByMemberIds?: string[];
}): CommitResult {
  const fund = requireFundCustodian(household, input.memberId);
  if (!/^\d{4}-\d{2}$/.test(input.monthKey)) throw new ValidationError("Choose a valid funding month.");
  const targetCents = parseWholeCents(input.target, "Monthly target", { allowZero: true });
  const bufferCents = parseWholeCents(input.buffer ?? 0, "Fund buffer", { allowZero: true });
  const agreedByMemberIds = [...new Set(input.agreedByMemberIds ?? [input.memberId])];
  for (const memberId of agreedByMemberIds) requireMember(household, memberId);
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const plans = shapeHouseholdFundMonthPlans(next.fundMonthPlans);
  const id = `FUND-PLAN-${input.monthKey}`;
  const at = nowIso();
  const prior = plans.find((row) => row.id === id);
  const plan = { id, fundId: fund.id, monthKey: input.monthKey, targetCents, bufferCents, agreedByMemberIds: agreedByMemberIds.sort(), createdAt: prior?.createdAt ?? at, updatedAt: at };
  next.fundMonthPlans = [...plans.filter((row) => row.id !== id), plan];
  return commit(previous, next, "Household Fund", `Agreed ${input.monthKey} target $${(targetCents / 100).toFixed(2)}`, [id]);
}

export function proposeHouseholdFundContribution(household: Household, input: {
  memberId: string;
  contributorMemberId: string;
  amount: string | number;
  date: string;
  note?: string;
}): CommitResult {
  const fund = requireHouseholdFund(household);
  requireMember(household, input.memberId);
  requireMember(household, input.contributorMemberId);
  const amountCents = parseAmount(input.amount);
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const at = nextFundEventAt(next);
  const id = nextFundEventId(next);
  next.fundEvents = [...shapeHouseholdFundEvents(next.fundEvents), {
    id,
    fundId: fund.id,
    kind: "contribution-proposed",
    amountCents,
    date: parseDate(input.date),
    createdBy: input.memberId,
    confirmedByMemberId: null,
    contributorMemberId: input.contributorMemberId,
    destinationAccountId: null,
    relatedEventId: null,
    relatedTransactionIds: [],
    evidenceDigests: [],
    reconciliationTied: null,
    note: input.note?.trim().slice(0, 180) || "",
    createdAt: at,
    updatedAt: at,
  }];
  return commit(previous, next, "Household Fund", `Proposed $${(amountCents / 100).toFixed(2)} contribution`, [id]);
}

export function confirmHouseholdFundContribution(household: Household, input: {
  memberId: string;
  proposalEventId: string;
  date?: string;
}): CommitResult {
  const fund = requireFundCustodian(household, input.memberId);
  const events = shapeHouseholdFundEvents(household.fundEvents);
  const proposal = events.find((row) => row.id === input.proposalEventId && row.kind === "contribution-proposed");
  if (!proposal) throw new ValidationError("That contribution proposal no longer exists.");
  if (events.some((row) => row.kind === "contribution-confirmed" && row.relatedEventId === proposal.id)) {
    throw new ValidationError("That contribution was already confirmed.");
  }
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const at = nextFundEventAt(next);
  const id = nextFundEventId(next);
  next.fundEvents = [...events, {
    ...proposal,
    id,
    kind: "contribution-confirmed",
    date: parseDate(input.date ?? proposal.date),
    createdBy: input.memberId,
    confirmedByMemberId: fund.custodianMemberId,
    relatedEventId: proposal.id,
    createdAt: at,
    updatedAt: at,
  }];
  return commit(previous, next, "Household Fund", `Received $${(proposal.amountCents / 100).toFixed(2)} contribution`, [id]);
}

export function confirmHouseholdFundSettlement(household: Household, input: {
  memberId: string;
  amount: string | number;
  destinationAccountId: string;
  date: string;
  allocations?: Array<{ transactionId: string; amount: string | number }>;
  note?: string;
}): CommitResult {
  const fund = requireFundCustodian(household, input.memberId);
  const isDirectDebit = input.destinationAccountId === HOUSEHOLD_FUND_DIRECT_DESTINATION;
  const destination = isDirectDebit ? null : requireAccount(household, input.destinationAccountId);
  if (destination?.scope === "personal") throw new ValidationError("Choose a shared settlement destination.");
  const destinationId = destination?.id ?? HOUSEHOLD_FUND_DIRECT_DESTINATION;
  const amountCents = parseAmount(input.amount);
  const projection = projectHouseholdFund(household, parseDate(input.date));
  if (amountCents > projection.operatingBalanceCents) throw new ValidationError("That transfer exceeds the confirmed Household Fund balance.");
  const eligible = projection.transactionPositions
    .filter((row) => row.destinationAccountId === destinationId && row.outstandingCents > 0)
    .sort((left, right) => {
      const leftDate = household.transactions.find((tx) => tx.id === left.transactionId)?.date ?? "";
      const rightDate = household.transactions.find((tx) => tx.id === right.transactionId)?.date ?? "";
      return leftDate.localeCompare(rightDate) || left.transactionId.localeCompare(right.transactionId);
    });
  if (amountCents > eligible.reduce((sum, row) => sum + row.outstandingCents, 0)) {
    throw new ValidationError("That transfer exceeds the outstanding amount for this destination.");
  }
  let allocations: Array<{ transactionId: string; amountCents: number }>;
  if (input.allocations?.length) {
    allocations = input.allocations.map((row) => ({ transactionId: row.transactionId, amountCents: parseAmount(row.amount) }));
    if (allocations.reduce((sum, row) => sum + row.amountCents, 0) !== amountCents) throw new ValidationError("Settlement allocations must equal the transfer amount.");
    for (const row of allocations) {
      const position = eligible.find((item) => item.transactionId === row.transactionId);
      if (!position || row.amountCents > position.outstandingCents) throw new ValidationError("A settlement allocation exceeds that transaction's outstanding amount.");
    }
  } else {
    allocations = [];
    let remaining = amountCents;
    for (const row of eligible) {
      if (remaining <= 0) break;
      const amount = Math.min(remaining, row.outstandingCents);
      allocations.push({ transactionId: row.transactionId, amountCents: amount });
      remaining -= amount;
    }
  }
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const at = nextFundEventAt(next);
  const id = nextFundEventId(next);
  next.fundEvents = [...shapeHouseholdFundEvents(next.fundEvents), {
    id, fundId: fund.id, kind: "settlement-confirmed", amountCents, date: parseDate(input.date),
    createdBy: input.memberId, confirmedByMemberId: fund.custodianMemberId, contributorMemberId: null,
    destinationAccountId: destinationId, relatedEventId: null,
    relatedTransactionIds: allocations.map((row) => row.transactionId).sort(), evidenceDigests: [],
    reconciliationTied: null, note: input.note?.trim().slice(0, 180) || "",
    createdAt: at, updatedAt: at,
  }];
  const existing = shapeHouseholdFundSettlementAllocations(next.fundSettlementAllocations);
  next.fundSettlementAllocations = [...existing, ...allocations.map((row, index) => ({
    id: `${id}-A${index + 1}`,
    fundId: fund.id,
    eventId: id,
    transactionId: row.transactionId,
    amountCents: row.amountCents,
    createdAt: at,
    updatedAt: at,
  }))];
  return commit(previous, next, "Household Fund", isDirectDebit
    ? `Confirmed $${(amountCents / 100).toFixed(2)} direct debit`
    : `Transferred $${(amountCents / 100).toFixed(2)} to ${destination!.name}`, [id, ...next.fundSettlementAllocations.filter((row) => row.eventId === id).map((row) => row.id)]);
}

export function allocateHouseholdFundSurplus(household: Household, input: {
  memberId: string;
  date: string;
  allocations: Array<{ goalId: string; amount: string | number }>;
  note?: string;
}): CommitResult {
  const fund = requireFundCustodian(household, input.memberId);
  const allocations = input.allocations.map((row) => ({ goalId: row.goalId, amountCents: parseAmount(row.amount) }));
  const amountCents = allocations.reduce((sum, row) => sum + row.amountCents, 0);
  if (!amountCents) throw new ValidationError("Choose a surplus amount to move into Kitty Banks.");
  for (const row of allocations) {
    if (!household.goals.some((goal) => goal.id === row.goalId && goal.shared && goal.status !== "retired")) {
      throw new ValidationError("Kitty rollover can only use active shared goals.");
    }
  }
  const projection = projectHouseholdFund(household, parseDate(input.date));
  if (amountCents > projection.safeRolloverCents) throw new ValidationError("That rollover exceeds the safe surplus after transfers, bills, and buffer.");
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const at = nextFundEventAt(next);
  const id = nextFundEventId(next);
  next.fundEvents = [...shapeHouseholdFundEvents(next.fundEvents), {
    id, fundId: fund.id, kind: "kitty-allocated", amountCents, date: parseDate(input.date),
    createdBy: input.memberId, confirmedByMemberId: fund.custodianMemberId, contributorMemberId: null,
    destinationAccountId: null, relatedEventId: null, relatedTransactionIds: [], evidenceDigests: [],
    reconciliationTied: null, note: input.note?.trim().slice(0, 180) || "Month-end rollover",
    createdAt: at, updatedAt: at,
  }];
  next.fundKittyAllocations = [...shapeHouseholdFundKittyAllocations(next.fundKittyAllocations), ...allocations.map((row, index) => ({
    id: `${id}-K${index + 1}`, fundId: fund.id, eventId: id, goalId: row.goalId,
    amountCents: row.amountCents, createdAt: at, updatedAt: at,
  }))];
  return commit(previous, next, "Household Fund", `Rolled $${(amountCents / 100).toFixed(2)} into Kitty Banks`, [id, ...next.fundKittyAllocations.filter((row) => row.eventId === id).map((row) => row.id)]);
}

export function releaseHouseholdFundKitty(household: Household, input: {
  memberId: string;
  amount: string | number;
  date: string;
  note?: string;
}): CommitResult {
  const fund = requireFundCustodian(household, input.memberId);
  const amountCents = parseAmount(input.amount, "Kitty release");
  const projection = projectHouseholdFund(household, parseDate(input.date));
  if (amountCents > projection.kittyCents) throw new ValidationError("That release exceeds the amount in Kitty Banks.");
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const at = nextFundEventAt(next);
  const id = nextFundEventId(next);
  next.fundEvents = [...shapeHouseholdFundEvents(next.fundEvents), {
    id, fundId: fund.id, kind: "kitty-released", amountCents, date: parseDate(input.date),
    createdBy: input.memberId, confirmedByMemberId: fund.custodianMemberId, contributorMemberId: null,
    destinationAccountId: null, relatedEventId: null, relatedTransactionIds: [], evidenceDigests: [],
    reconciliationTied: null, note: input.note?.trim().slice(0, 180) || "Released from Kitty Banks",
    createdAt: at, updatedAt: at,
  }];
  return commit(previous, next, "Household Fund", `Released $${(amountCents / 100).toFixed(2)} from Kitty Banks`, [id]);
}

/** One visible confirmation records a direct-debit expense and its matching fund settlement. */
export function postHouseholdFundDirectDebit(household: Household, input: {
  memberId: string;
  date: string;
  amount: string | number;
  accountId: string;
  subcategoryId: string;
  note?: string;
  place?: string;
  splits?: Split[];
  visibility?: Visibility;
  confirmDuplicate?: boolean;
}): CommitResult {
  const fund = requireFundCustodian(household, input.memberId);
  const amountCents = parseAmount(input.amount);
  const source = requireAccount(household, input.accountId);
  if (source.scope !== "personal" || source.ownerMemberId !== input.memberId || source.kind !== "savings") {
    throw new ValidationError("A Household Fund direct debit must use Bianca’s Personal savings account.");
  }
  const posted = postEntry(household, {
    date: input.date,
    type: "expense",
    amount: amountCents / 100,
    accountId: input.accountId,
    subcategoryId: input.subcategoryId,
    note: input.note,
    place: input.place,
    splits: input.splits,
    visibility: "personal",
    createdBy: input.memberId,
    confirmDuplicate: input.confirmDuplicate,
    funding: { fundId: fund.id, fundedCents: amountCents, destinationAccountId: HOUSEHOLD_FUND_DIRECT_DESTINATION, directDebit: true },
  });
  const transactionId = posted.postedIds[0]!;
  const settlementPositionId = posted.household.transactions.find((row) => row.id === transactionId)?.funding?.positionId ?? transactionId;
  const settled = confirmHouseholdFundSettlement(posted.household, {
    memberId: input.memberId,
    amount: amountCents / 100,
    destinationAccountId: HOUSEHOLD_FUND_DIRECT_DESTINATION,
    date: input.date,
    allocations: [{ transactionId: settlementPositionId, amount: amountCents / 100 }],
    note: "Direct debit confirmed with the expense",
  });
  return {
    household: settled.household,
    warnings: [...posted.warnings, ...settled.warnings],
    postedIds: [...posted.postedIds, ...settled.postedIds],
    undo: { id: settled.undo.id, label: `Direct debit $${(amountCents / 100).toFixed(2)}`, snapshot: household, postedIds: [...posted.postedIds, ...settled.postedIds] },
  };
}

export function recordHouseholdFundReconciliation(household: Household, input: {
  memberId: string;
  date: string;
  bankTotal: string | number;
  personalRemainder?: string | number;
  note?: string;
}): CommitResult {
  const fund = requireFundCustodian(household, input.memberId);
  const date = parseDate(input.date);
  const bankTotalCents = parseWholeCents(input.bankTotal, "Savings balance", { allowZero: true });
  const projection = projectHouseholdFund(household, date);
  const computedPersonal = bankTotalCents - projection.operatingBalanceCents - projection.kittyCents;
  const personalRemainderCents = input.personalRemainder === undefined
    ? computedPersonal
    : parseWholeCents(input.personalRemainder, "Personal remainder", { allowZero: true, allowNegative: true });
  const differenceCents = computedPersonal - personalRemainderCents;
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const at = nextFundEventAt(next);
  const eventId = nextFundEventId(next);
  next.fundEvents = [...shapeHouseholdFundEvents(next.fundEvents), {
    id: eventId, fundId: fund.id, kind: "reconciliation-recorded", amountCents: 0, date,
    createdBy: input.memberId, confirmedByMemberId: fund.custodianMemberId, contributorMemberId: null,
    destinationAccountId: null, relatedEventId: null, relatedTransactionIds: [], evidenceDigests: [],
    reconciliationTied: differenceCents === 0, note: input.note?.trim().slice(0, 180) || "Weekly reconciliation",
    createdAt: at, updatedAt: at,
  }];
  const state = shapeHouseholdFundPrivate(next.fundPrivate, input.memberId);
  const id = `FUND-REC-${eventId}`;
  next.fundPrivate = { ...state, reconciliations: [...state.reconciliations, {
    id, fundId: fund.id, memberId: input.memberId, date, bankTotalCents,
    operatingFundCents: projection.operatingBalanceCents, kittyCents: projection.kittyCents,
    personalRemainderCents, differenceCents, sharedEventId: eventId, createdAt: at, updatedAt: at,
  }] };
  return commit(previous, next, "Household Fund", differenceCents === 0 ? "Household Fund reconciliation tied" : `Household Fund reconciliation is off by $${(Math.abs(differenceCents) / 100).toFixed(2)}`, [eventId, id]);
}

export function reverseHouseholdFundEvent(household: Household, input: {
  memberId: string;
  eventId: string;
  date: string;
  reason: string;
}): CommitResult {
  const fund = requireFundCustodian(household, input.memberId);
  const events = shapeHouseholdFundEvents(household.fundEvents);
  const target = events.find((row) => row.id === input.eventId);
  if (!target || target.kind === "reversal") throw new ValidationError("Choose an original Household Fund event to reverse.");
  if (events.some((row) => row.kind === "reversal" && row.relatedEventId === target.id)) throw new ValidationError("That Household Fund event was already reversed.");
  if (!input.reason.trim()) throw new ValidationError("Give the correction a reason.");
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const at = nextFundEventAt(next);
  const id = nextFundEventId(next);
  next.fundEvents = [...events, {
    id, fundId: fund.id, kind: "reversal", amountCents: target.amountCents, date: parseDate(input.date),
    createdBy: input.memberId, confirmedByMemberId: fund.custodianMemberId, contributorMemberId: target.contributorMemberId,
    destinationAccountId: target.destinationAccountId, relatedEventId: target.id,
    relatedTransactionIds: [...target.relatedTransactionIds], evidenceDigests: [], reconciliationTied: null,
    note: input.reason.trim().slice(0, 180), createdAt: at, updatedAt: at,
  }];
  return commit(previous, next, "Household Fund", `Reversed ${target.id}: ${input.reason.trim()}`, [id]);
}

export function activateHouseholdFundConnection(household: Household, input: { memberId: string }): CommitResult {
  const fund = requireFundCustodian(household, input.memberId);
  const binding = shapeHouseholdFundPrivate(household.fundPrivate, input.memberId).bankBindings
    .find((row) => row.fundId === fund.id && row.provider === "flinks" && row.status === "connected" && row.accountDigest);
  if (!binding) throw new ValidationError("Complete the approved read-only Flinks connection before enabling connected mode.");
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  next.householdFund = { ...fund, mode: "connected", updatedAt: nowIso() };
  return commit(previous, next, "Household Fund", "Enabled read-only bank evidence", [fund.id]);
}

export function recordHouseholdFundBankVerification(household: Household, input: {
  memberId: string;
  evidence: HouseholdFundBankEvidence[];
  selectedEventIds?: string[];
  windowDays?: number;
}): CommitResult {
  const fund = requireFundCustodian(household, input.memberId);
  if (fund.mode !== "connected") throw new ValidationError("Bank verification is disabled during September practice mode.");
  const binding = shapeHouseholdFundPrivate(household.fundPrivate, input.memberId).bankBindings
    .find((row) => row.fundId === fund.id && row.status === "connected" && row.accountDigest);
  if (!binding?.accountDigest) throw new ValidationError("The read-only bank binding is unavailable.");
  const match = matchHouseholdFundBankEvidence({ household, evidence: input.evidence, bindingAccountDigest: binding.accountDigest, selectedEventIds: input.selectedEventIds, windowDays: input.windowDays });
  if (match.kind !== "exact") throw new ValidationError("Only one unique exact bank match can verify automatically. Review this evidence without posting.");
  const matchedEvidenceIds = new Set(match.evidenceIds);
  const matchedEvidence = input.evidence.filter((row) => matchedEvidenceIds.has(row.id));
  const digests = [...new Set(matchedEvidence.map((row) => row.digest))].sort();
  const existing = shapeHouseholdFundEvents(household.fundEvents);
  if (existing.some((event) => event.kind === "bank-verified" && event.evidenceDigests.some((digest) => digests.includes(digest)))) {
    throw new ValidationError("That bank evidence was already used.");
  }
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const at = nextFundEventAt(next);
  const id = nextFundEventId(next);
  const firstEvidence = matchedEvidence.slice().sort((left, right) => left.date.localeCompare(right.date))[0];
  next.fundEvents = [...existing, {
    id, fundId: fund.id, kind: "bank-verified", amountCents: match.amountCents, date: firstEvidence?.date ?? fund.openedOn,
    createdBy: input.memberId, confirmedByMemberId: fund.custodianMemberId, contributorMemberId: null,
    destinationAccountId: matchedEvidence.find((row) => row.destinationAccountId)?.destinationAccountId ?? null,
    relatedEventId: match.eventIds.length === 1 ? match.eventIds[0]! : null,
    relatedTransactionIds: [], evidenceDigests: digests, reconciliationTied: true,
    note: `Exact ${match.direction} bank evidence`, createdAt: at, updatedAt: at,
  }];
  return commit(previous, next, "Household Fund", `Verified $${(match.amountCents / 100).toFixed(2)} against read-only bank evidence`, [id]);
}

export function emptyHousehold(environment: Household["environment"] = "development"): Household {
  return {
    version: 1,
    householdId: randomHouseholdId(),
    inviteCode: randomInviteCode(),
    linked: false,
    revision: 0,
    baseRevision: 0,
    booksAcceptedHash: null,
    tombstones: [],
    name: "Jonathan & Bianca",
    ledgerNames: { shared: "Household Ledger", personal: {} },
    timezone: TIMEZONE,
    currency: CURRENCY,
    environment,
    members: [],
    accounts: [],
    categories: [],
    transactions: [],
    shifts: [],
    recurrences: [],
    appointments: [],
    claims: [],
    presets: [],
    calendar: { ...EMPTY_CALENDAR },
    kitchen: shapeKitchen(EMPTY_KITCHEN),
    google: shapeGoogle(EMPTY_GOOGLE),
    goals: [],
    goalContributions: [],
    goalPurchases: [],
    householdFund: null,
    fundMonthPlans: [],
    fundEvents: [],
    fundSettlementAllocations: [],
    fundKittyAllocations: [],
    fundPrivate: { bankBindings: [], reconciliations: [] },
    budgetPlans: [],
    sitDownSessions: [],
    activity: [],
    devices: [],
    workJobs: [],
    shiftSettings: DEFAULT_SHIFT_SETTINGS,
    lastCommittedAt: null,
    commandReceipts: [],
    sharing: {
      mode: "local",
      linked: false,
      lastTransportAt: null,
      lastError: null,
      pending: false,
    },
    conflicts: [],
  };
}

export { DEFAULT_SHIFT_SETTINGS };
