import type { CommandReceipt, Household, Transaction } from "./types.ts";

function byId<T extends { id: string }>(rows: T[] | undefined): T[] {
  return [...(rows ?? [])].sort((left, right) => left.id.localeCompare(right.id));
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, stable((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

export function financialAuditFacts(household: Household) {
  return stable({
    householdId: household.householdId,
    environment: household.environment,
    transactions: byId(household.transactions).map((tx) => ({
      id: tx.id,
      date: tx.date,
      type: tx.type,
      amountCents: tx.amountCents,
      accountId: tx.accountId,
      categoryId: tx.categoryId ?? null,
      subcategoryId: tx.subcategoryId ?? null,
      splits: [...tx.splits].sort((left, right) => left.party.localeCompare(right.party) || left.amountCents - right.amountCents),
      visibility: tx.visibility,
      createdBy: tx.createdBy,
      transferPairId: tx.transferPairId ?? null,
      transferFromAccountId: tx.transferFromAccountId ?? null,
      transferToAccountId: tx.transferToAccountId ?? null,
      refundOfId: tx.refundOfId ?? null,
      reversalOfId: tx.reversalOfId ?? null,
      source: tx.source,
      sourceId: tx.sourceId ?? null,
      funding: tx.funding ?? null,
    })),
    shifts: byId(household.shifts).map((shift) => ({
      id: shift.id,
      date: shift.date,
      memberId: shift.memberId,
      accountId: shift.accountId,
      salesCents: shift.salesCents,
      cashTipsCents: shift.cashTipsCents,
      ccTipsCents: shift.ccTipsCents,
      hours: shift.hours,
      wagesCents: shift.wagesCents,
      netTipsCents: shift.netTipsCents,
      jobId: shift.jobId ?? null,
      roleId: shift.roleId ?? null,
      grossWagesCents: shift.grossWagesCents ?? null,
      paidBreakHours: shift.paidBreakHours ?? null,
      deferredTipOutCents: shift.deferredTipOutCents ?? null,
      deferredTipOutPaidCents: shift.deferredTipOutPaidCents ?? null,
      correctedByShiftId: shift.correctedByShiftId ?? null,
      correctionOfShiftId: shift.correctionOfShiftId ?? null,
      transactionIds: [...(shift.transactionIds ?? [])].sort(),
      visibility: shift.visibility,
      createdBy: shift.createdBy,
      sevenShiftsPunchDigest: shift.sevenShiftsPunchDigest ?? null,
      sevenShiftsEvidenceBundle: shift.sevenShiftsEvidenceBundle ?? null,
      shiftBible: shift.shiftBible ?? null,
    })),
    goalContributions: byId(household.goalContributions).map((row) => ({
      id: row.id,
      goalId: row.goalId,
      memberId: row.memberId,
      amountCents: row.amountCents,
      date: row.date,
      transferId: row.transferId ?? null,
    })),
    goalPurchases: byId(household.goalPurchases).map((row) => ({
      id: row.id,
      goalId: row.goalId,
      spentCents: row.spentCents,
      vaultAccountId: row.vaultAccountId,
      transactionIds: [...row.transactionIds].sort(),
    })),
    claims: byId(household.claims).map((row) => ({
      id: row.id,
      expectedCents: row.expectedCents,
      receivedCents: row.receivedCents,
      writtenOffCents: row.writtenOffCents,
      expenseTransactionId: row.expenseTransactionId,
      status: row.status,
    })),
    sitDownSessions: byId(household.sitDownSessions).map((row) => ({
      id: row.id,
      leftoverCents: row.leftoverCents,
      transferIds: [...row.transferIds].sort(),
      contributionIds: [...row.contributionIds].sort(),
    })),
    workJobs: byId(household.workJobs ?? []).map((job) => ({
      id: job.id,
      memberId: job.memberId,
      active: job.active,
      roles: job.roles,
      paidBreakRate: job.paidBreakRate,
      paidBreakHourlyRateCents: job.paidBreakHourlyRateCents,
      overtimeEnabled: job.overtimeEnabled,
      overtimeWeeklyThresholdHours: job.overtimeWeeklyThresholdHours,
      overtimeMultiplier: job.overtimeMultiplier,
      tipOutRules: job.tipOutRules,
      salesFields: job.salesFields,
      paySchedule: job.paySchedule,
      tipSchedule: job.tipSchedule,
      defaults: job.defaults,
      wagesReceivableAccountId: job.wagesReceivableAccountId,
      cardTipsReceivableAccountId: job.cardTipsReceivableAccountId,
    })),
    householdFund: household.householdFund ?? null,
    fundMonthPlans: byId(household.fundMonthPlans ?? []),
    fundEvents: byId(household.fundEvents ?? []),
    fundSettlementAllocations: byId(household.fundSettlementAllocations ?? []),
    fundKittyAllocations: byId(household.fundKittyAllocations ?? []),
    fundPrivate: household.fundPrivate ?? null,
    tombstones: byId(household.tombstones).map((row) => ({ id: row.id, deletedAt: row.deletedAt })),
  });
}

/** Financial facts visible to exactly one hosted ledger scope. */
export function financialAuditFactsForScope(
  household: Household,
  scope: "shared" | "personal",
  memberId: string,
) {
  const sharedGoalIds = new Set(household.goals.filter((goal) => goal.shared).map((goal) => goal.id));
  const personalGoalIds = new Set(household.goals
    .filter((goal) => !goal.shared && goal.ownerMemberId === memberId)
    .map((goal) => goal.id));
  const goalIds = scope === "shared" ? sharedGoalIds : personalGoalIds;
  return financialAuditFacts({
    ...household,
    transactions: household.transactions.filter((row) => scope === "shared"
      ? row.visibility !== "personal"
      : row.visibility === "personal" && row.createdBy === memberId),
    shifts: household.shifts.filter((row) => scope === "shared"
      ? row.visibility !== "personal"
      : row.visibility === "personal" && row.createdBy === memberId),
    goalContributions: (household.goalContributions ?? []).filter((row) => goalIds.has(row.goalId)),
    goalPurchases: (household.goalPurchases ?? []).filter((row) => goalIds.has(row.goalId)),
    claims: scope === "shared" ? household.claims : [],
    sitDownSessions: scope === "shared" ? household.sitDownSessions : [],
    workJobs: scope === "shared" ? household.workJobs : [],
    householdFund: scope === "shared" ? household.householdFund : null,
    fundMonthPlans: scope === "shared" ? household.fundMonthPlans : [],
    fundEvents: scope === "shared" ? household.fundEvents : [],
    fundSettlementAllocations: scope === "shared" ? household.fundSettlementAllocations : [],
    fundKittyAllocations: scope === "shared" ? household.fundKittyAllocations : [],
    fundPrivate: scope === "personal" ? household.fundPrivate : { bankBindings: [], reconciliations: [] },
  });
}

export function commandIdentityFacts(previous: Household | null, next: Household, postedIds: string[]) {
  const posted = new Set(postedIds);
  const tx = next.transactions.filter((row) => posted.has(row.id));
  const shifts = next.shifts.filter((row) => posted.has(row.id)
    || Boolean(row.correctedByShiftId && posted.has(row.correctedByShiftId))
    || Boolean(row.correctionOfShiftId && posted.has(row.correctionOfShiftId)));
  const contributions = (next.goalContributions ?? []).filter((row) => posted.has(row.id));
  const fundEvents = (next.fundEvents ?? []).filter((row) => posted.has(row.id));
  const fundSettlementAllocations = (next.fundSettlementAllocations ?? []).filter((row) => posted.has(row.id));
  const fundKittyAllocations = (next.fundKittyAllocations ?? []).filter((row) => posted.has(row.id));
  const fundMonthPlans = (next.fundMonthPlans ?? []).filter((row) => posted.has(row.id));
  const fundConfigPosted = Boolean(next.householdFund && posted.has(next.householdFund.id));
  const coworkers = (next.coworkers ?? []).filter((row) => posted.has(row.id));
  const coworkerAttendance = (next.coworkerAttendance ?? []).filter((row) => posted.has(row.id));
  const coworkerSchedules = (next.coworkerSchedules ?? []).filter((row) => posted.has(row.id));
  const shiftEnvelopes = (next.shiftEnvelopes ?? []).filter((row) => posted.has(row.id));
  const shiftBibles = (next.shiftBibles ?? []).filter((row) => posted.has(row.id));
  const tombstones = (next.tombstones ?? []).filter((row) => posted.has(row.id));
  return stable({
    householdId: next.householdId,
    environment: next.environment,
    postedIds: [...postedIds].sort(),
    previousRevision: previous?.revision ?? 0,
    transactions: tx.map((row) => identityTransaction(row)),
    shifts: shifts.map((shift) => ({
      id: shift.id,
      date: shift.date,
      memberId: shift.memberId,
      accountId: shift.accountId,
      salesCents: shift.salesCents,
      cashTipsCents: shift.cashTipsCents,
      ccTipsCents: shift.ccTipsCents,
      hours: shift.hours,
      wagesCents: shift.wagesCents,
      netTipsCents: shift.netTipsCents,
      jobId: shift.jobId ?? null,
      roleId: shift.roleId ?? null,
      grossWagesCents: shift.grossWagesCents ?? null,
      paidBreakHours: shift.paidBreakHours ?? null,
      deferredTipOutCents: shift.deferredTipOutCents ?? null,
      deferredTipOutPaidCents: shift.deferredTipOutPaidCents ?? null,
      correctedByShiftId: shift.correctedByShiftId ?? null,
      correctionOfShiftId: shift.correctionOfShiftId ?? null,
      transactionIds: [...(shift.transactionIds ?? [])].sort(),
      visibility: shift.visibility,
      createdBy: shift.createdBy,
      sevenShiftsPunchDigest: shift.sevenShiftsPunchDigest ?? null,
      sevenShiftsEvidenceBundle: shift.sevenShiftsEvidenceBundle ?? null,
      shiftBible: shift.shiftBible ?? null,
    })),
    goalContributions: contributions.map((row) => ({
      id: row.id,
      goalId: row.goalId,
      memberId: row.memberId,
      amountCents: row.amountCents,
      date: row.date,
      transferId: row.transferId ?? null,
    })),
    householdFund: fundConfigPosted ? next.householdFund : null,
    fundMonthPlans,
    fundEvents,
    fundSettlementAllocations,
    fundKittyAllocations,
    coworkers,
    coworkerAttendance,
    coworkerSchedules: coworkerSchedules.map(({ sourceScheduleKey: _sourceScheduleKey, ...row }) => row),
    shiftEnvelopes,
    shiftBibles,
    tombstones,
    // Private reconciliation and binding details never affect a shared command identity.
    fundPrivate: null,
  });
}

function identityTransaction(tx: Transaction) {
  return {
    date: tx.date,
    type: tx.type,
    amountCents: tx.amountCents,
    accountId: tx.accountId,
    categoryId: tx.categoryId ?? null,
    subcategoryId: tx.subcategoryId ?? null,
    splits: [...tx.splits].sort((left, right) => left.party.localeCompare(right.party) || left.amountCents - right.amountCents),
    visibility: tx.visibility,
    createdBy: tx.createdBy,
    transferFromAccountId: tx.transferFromAccountId ?? null,
    transferToAccountId: tx.transferToAccountId ?? null,
    refundOfId: tx.refundOfId ?? null,
    reversalOfId: tx.reversalOfId ?? null,
    source: tx.source,
    sourceId: tx.sourceId ?? null,
    funding: tx.funding ?? null,
    note: tx.note,
    place: tx.place,
  };
}

export async function sha256Hex(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function financialAuditHash(household: Household): Promise<string> {
  return sha256Hex(financialAuditFacts(household));
}

export async function financialAuditHashForScope(
  household: Household,
  scope: "shared" | "personal",
  memberId: string,
): Promise<string> {
  return sha256Hex(financialAuditFactsForScope(household, scope, memberId));
}

export async function commandIdentityHash(
  previous: Household | null,
  next: Household,
  postedIds: string[],
): Promise<string> {
  return sha256Hex(commandIdentityFacts(previous, next, postedIds));
}

export function newConfirmationId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function findReceipt(
  household: Household | null | undefined,
  confirmationId: string,
  identityHash?: string,
): CommandReceipt | undefined {
  const receipts = household?.commandReceipts ?? [];
  if (identityHash) {
    return receipts.find((row) => row.confirmationId === confirmationId && row.identityHash === identityHash);
  }
  return receipts.find((row) => row.confirmationId === confirmationId);
}

export function rememberReceipt(household: Household, receipt: CommandReceipt): Household {
  const rest = (household.commandReceipts ?? []).filter((row) => row.confirmationId !== receipt.confirmationId);
  return {
    ...household,
    commandReceipts: [...rest, receipt].slice(-200),
  };
}
