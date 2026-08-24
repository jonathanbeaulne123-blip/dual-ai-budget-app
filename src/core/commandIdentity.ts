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
      visibility: shift.visibility,
      createdBy: shift.createdBy,
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
    tombstones: byId(household.tombstones).map((row) => ({ id: row.id, deletedAt: row.deletedAt })),
  });
}

export function commandIdentityFacts(previous: Household | null, next: Household, postedIds: string[]) {
  const posted = new Set(postedIds);
  const tx = next.transactions.filter((row) => posted.has(row.id));
  const shifts = next.shifts.filter((row) => posted.has(row.id));
  const contributions = (next.goalContributions ?? []).filter((row) => posted.has(row.id));
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
      visibility: shift.visibility,
      createdBy: shift.createdBy,
    })),
    goalContributions: contributions.map((row) => ({
      id: row.id,
      goalId: row.goalId,
      memberId: row.memberId,
      amountCents: row.amountCents,
      date: row.date,
      transferId: row.transferId ?? null,
    })),
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
