import { addDays, monthKeyFromDateKey, type DateKey } from "./calendar.ts";
import type {
  Household,
  HouseholdFundConfig,
  HouseholdFundEvent,
  HouseholdFundKittyAllocation,
  HouseholdFundMonthPlan,
  HouseholdFundPrivateState,
  HouseholdFundSettlementAllocation,
  Recurrence,
  Transaction,
} from "./types.ts";
import { ValidationError } from "./types.ts";
import { projectCadence } from "./recurrence.ts";

export const HOUSEHOLD_FUND_ID = "FUND-HOUSEHOLD";
export const HOUSEHOLD_FUND_NAME = "Hearth Household Fund";
/** Shared clearing label for a debit whose real savings account stays in the custodian's Personal envelope. */
export const HOUSEHOLD_FUND_DIRECT_DESTINATION = "FUND-DIRECT-DEBIT";

export type HouseholdFundTransactionPosition = {
  transactionId: string;
  destinationAccountId: string;
  fundedCents: number;
  refundedCents: number;
  settledCents: number;
  outstandingCents: number;
};

export type HouseholdFundDestinationPosition = {
  destinationAccountId: string;
  dueCents: number;
  creditCents: number;
};

export type HouseholdFundProjection = {
  configured: boolean;
  operatingBalanceCents: number;
  confirmedContributionsCents: number;
  pendingContributionsCents: number;
  settledCents: number;
  transferDueCents: number;
  transferCreditCents: number;
  upcomingReserveCents: number;
  bufferCents: number;
  freeToSpendCents: number;
  topUpNeededCents: number;
  safeRolloverCents: number;
  kittyCents: number;
  monthlyTargetCents: number;
  targetProgressCents: number;
  lastReconciledAt: string | null;
  reconciliationTied: boolean | null;
  transactionPositions: HouseholdFundTransactionPosition[];
  destinationPositions: HouseholdFundDestinationPosition[];
};

export type HouseholdFundBankEvidence = {
  id: string;
  digest: string;
  date: DateKey;
  direction: "in" | "out";
  amountCents: number;
  accountDigest: string;
  destinationAccountId: string | null;
};

export type HouseholdFundBankMatch =
  | { kind: "exact"; eventIds: string[]; evidenceIds: string[]; amountCents: number; direction: "in" | "out" }
  | { kind: "competing"; eventIds: string[]; evidenceIds: string[] }
  | { kind: "near"; eventIds: string[]; evidenceIds: string[] }
  | { kind: "unmatched"; eventIds: []; evidenceIds: string[] };

function asNonNegativeCents(value: unknown): number {
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : 0;
}

function isoOrFallback(value: unknown, fallback: string): string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : fallback;
}

export function shapeHouseholdFundConfig(value: unknown): HouseholdFundConfig | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<HouseholdFundConfig>;
  if (!row.id || !row.custodianMemberId || !/^\d{4}-\d{2}-\d{2}$/.test(String(row.openedOn ?? ""))) return null;
  const createdAt = isoOrFallback(row.createdAt, "1970-01-01T00:00:00.000Z");
  return {
    id: String(row.id),
    name: String(row.name || HOUSEHOLD_FUND_NAME).trim().slice(0, 60) || HOUSEHOLD_FUND_NAME,
    custodianMemberId: String(row.custodianMemberId),
    mode: row.mode === "connected" ? "connected" : "practice",
    openedOn: String(row.openedOn) as DateKey,
    createdAt,
    updatedAt: isoOrFallback(row.updatedAt, createdAt),
  };
}

export function shapeHouseholdFundMonthPlans(value: unknown): HouseholdFundMonthPlan[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const row = raw as Partial<HouseholdFundMonthPlan>;
    if (!row.id || !row.fundId || !/^\d{4}-\d{2}$/.test(String(row.monthKey ?? ""))) return [];
    const createdAt = isoOrFallback(row.createdAt, "1970-01-01T00:00:00.000Z");
    return [{
      id: String(row.id),
      fundId: String(row.fundId),
      monthKey: String(row.monthKey) as HouseholdFundMonthPlan["monthKey"],
      targetCents: asNonNegativeCents(row.targetCents),
      bufferCents: asNonNegativeCents(row.bufferCents),
      agreedByMemberIds: Array.isArray(row.agreedByMemberIds)
        ? [...new Set(row.agreedByMemberIds.filter((id): id is string => typeof id === "string" && Boolean(id)))].sort()
        : [],
      createdAt,
      updatedAt: isoOrFallback(row.updatedAt, createdAt),
    }];
  });
}

const EVENT_KINDS = new Set<HouseholdFundEvent["kind"]>([
  "contribution-proposed",
  "contribution-confirmed",
  "purchase-funded",
  "refund-funded",
  "settlement-confirmed",
  "kitty-allocated",
  "kitty-released",
  "reconciliation-recorded",
  "bank-verified",
  "reversal",
]);

export function shapeHouseholdFundEvents(value: unknown): HouseholdFundEvent[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const row = raw as Partial<HouseholdFundEvent>;
    if (!row.id || !row.fundId || !EVENT_KINDS.has(row.kind as HouseholdFundEvent["kind"]) || !/^\d{4}-\d{2}-\d{2}$/.test(String(row.date ?? ""))) return [];
    const createdAt = isoOrFallback(row.createdAt, "1970-01-01T00:00:00.000Z");
    return [{
      id: String(row.id),
      fundId: String(row.fundId),
      kind: row.kind as HouseholdFundEvent["kind"],
      amountCents: asNonNegativeCents(row.amountCents),
      date: String(row.date) as DateKey,
      createdBy: String(row.createdBy ?? ""),
      confirmedByMemberId: typeof row.confirmedByMemberId === "string" && row.confirmedByMemberId ? row.confirmedByMemberId : null,
      contributorMemberId: typeof row.contributorMemberId === "string" && row.contributorMemberId ? row.contributorMemberId : null,
      destinationAccountId: typeof row.destinationAccountId === "string" && row.destinationAccountId ? row.destinationAccountId : null,
      relatedEventId: typeof row.relatedEventId === "string" && row.relatedEventId ? row.relatedEventId : null,
      relatedTransactionIds: Array.isArray(row.relatedTransactionIds)
        ? [...new Set(row.relatedTransactionIds.filter((id): id is string => typeof id === "string" && Boolean(id)))].sort()
        : [],
      evidenceDigests: Array.isArray(row.evidenceDigests)
        ? [...new Set(row.evidenceDigests.filter((id): id is string => typeof id === "string" && Boolean(id)))].sort()
        : [],
      reconciliationTied: typeof row.reconciliationTied === "boolean" ? row.reconciliationTied : null,
      note: String(row.note ?? "").trim().slice(0, 180),
      createdAt,
      updatedAt: isoOrFallback(row.updatedAt, createdAt),
    }];
  }).sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
}

function shapeAllocations<T extends HouseholdFundSettlementAllocation | HouseholdFundKittyAllocation>(
  value: unknown,
  relationKey: "transactionId" | "goalId",
): T[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const row = raw as Partial<T> & Record<string, unknown>;
    const related = row[relationKey];
    if (!row.id || !row.fundId || !row.eventId || typeof related !== "string" || !related || !Number.isInteger(row.amountCents) || Number(row.amountCents) <= 0) return [];
    const createdAt = isoOrFallback(row.createdAt, "1970-01-01T00:00:00.000Z");
    return [{
      id: String(row.id),
      fundId: String(row.fundId),
      eventId: String(row.eventId),
      [relationKey]: related,
      amountCents: Number(row.amountCents),
      createdAt,
      updatedAt: isoOrFallback(row.updatedAt, createdAt),
    } as T];
  });
}

export function shapeHouseholdFundSettlementAllocations(value: unknown): HouseholdFundSettlementAllocation[] {
  return shapeAllocations<HouseholdFundSettlementAllocation>(value, "transactionId");
}

export function shapeHouseholdFundKittyAllocations(value: unknown): HouseholdFundKittyAllocation[] {
  return shapeAllocations<HouseholdFundKittyAllocation>(value, "goalId");
}

export function shapeHouseholdFundPrivate(value: unknown, memberId?: string): HouseholdFundPrivateState {
  const row = value && typeof value === "object" ? value as Partial<HouseholdFundPrivateState> : {};
  const bindings = Array.isArray(row.bankBindings) ? row.bankBindings.filter((item) => (
    item && typeof item.id === "string" && typeof item.fundId === "string" && typeof item.memberId === "string"
      && (!memberId || item.memberId === memberId)
  )).map((item) => ({
    ...item,
    provider: item.provider === "flinks" ? "flinks" as const : "manual" as const,
    status: item.status === "connected" || item.status === "revoked" ? item.status : "manual" as const,
    accountDigest: typeof item.accountDigest === "string" && item.accountDigest ? item.accountDigest : null,
  })) : [];
  const reconciliations = Array.isArray(row.reconciliations) ? row.reconciliations.filter((item) => (
    item && typeof item.id === "string" && typeof item.fundId === "string" && typeof item.memberId === "string"
      && (!memberId || item.memberId === memberId)
  )).map((item) => ({
    ...item,
    bankTotalCents: asNonNegativeCents(item.bankTotalCents),
    operatingFundCents: asNonNegativeCents(item.operatingFundCents),
    kittyCents: asNonNegativeCents(item.kittyCents),
    personalRemainderCents: Math.round(Number(item.personalRemainderCents) || 0),
    differenceCents: Math.round(Number(item.differenceCents) || 0),
  })) : [];
  return { bankBindings: bindings, reconciliations };
}

function eventIsActive(event: HouseholdFundEvent, events: HouseholdFundEvent[], stack = new Set<string>()): boolean {
  if (stack.has(event.id)) return false;
  const next = new Set(stack).add(event.id);
  const reversals = events.filter((candidate) => candidate.kind === "reversal" && candidate.relatedEventId === event.id);
  return !reversals.some((reversal) => eventIsActive(reversal, events, next));
}

export function activeHouseholdFundEvents(household: Pick<Household, "fundEvents">, fundId = HOUSEHOLD_FUND_ID): HouseholdFundEvent[] {
  const events = shapeHouseholdFundEvents(household.fundEvents).filter((event) => event.fundId === fundId);
  return events.filter((event) => event.kind !== "reversal" && eventIsActive(event, events));
}

function signedFundingForTransaction(tx: Transaction, byId: Map<string, Transaction>, stack = new Set<string>()): number {
  if (stack.has(tx.id)) return 0;
  if (tx.reversalOfId) {
    const original = byId.get(tx.reversalOfId);
    return original ? -signedFundingForTransaction(original, byId, new Set(stack).add(tx.id)) : 0;
  }
  if (!tx.funding || tx.funding.fundedCents <= 0) return 0;
  return tx.type === "refund" ? -tx.funding.fundedCents : tx.type === "expense" ? tx.funding.fundedCents : 0;
}

function reserveForRecurrence(recurrence: Recurrence, fundId: string, today: DateKey, monthEnd: DateKey): number {
  if (!recurrence.active || recurrence.type !== "expense" || !recurrence.fundingDefault || recurrence.fundingDefault.fundId !== fundId) return 0;
  if (recurrence.nextDate > monthEnd) return 0;
  const amount = recurrence.fundingDefault.fundedCents === "full" ? recurrence.amountCents : recurrence.fundingDefault.fundedCents;
  const occurrenceCount = projectCadence(recurrence.nextDate, recurrence.cadence, today, monthEnd).length;
  return Math.min(recurrence.amountCents, amount) * occurrenceCount;
}

function monthEnd(date: DateKey): DateKey {
  const nextMonth = new Date(`${date.slice(0, 7)}-01T00:00:00.000Z`);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  return addDays(nextMonth.toISOString().slice(0, 10) as DateKey, -1);
}

export function projectHouseholdFund(household: Household, today: DateKey): HouseholdFundProjection {
  const config = shapeHouseholdFundConfig(household.householdFund);
  if (!config) return {
    configured: false,
    operatingBalanceCents: 0,
    confirmedContributionsCents: 0,
    pendingContributionsCents: 0,
    settledCents: 0,
    transferDueCents: 0,
    transferCreditCents: 0,
    upcomingReserveCents: 0,
    bufferCents: 0,
    freeToSpendCents: 0,
    topUpNeededCents: 0,
    safeRolloverCents: 0,
    kittyCents: 0,
    monthlyTargetCents: 0,
    targetProgressCents: 0,
    lastReconciledAt: null,
    reconciliationTied: null,
    transactionPositions: [],
    destinationPositions: [],
  };
  const events = activeHouseholdFundEvents(household, config.id);
  const confirmedContributionsCents = events.filter((event) => event.kind === "contribution-confirmed").reduce((sum, event) => sum + event.amountCents, 0);
  const pendingContributionsCents = events.filter((event) => event.kind === "contribution-proposed" && !events.some((confirmed) => confirmed.kind === "contribution-confirmed" && confirmed.relatedEventId === event.id)).reduce((sum, event) => sum + event.amountCents, 0);
  const settledCents = events.filter((event) => event.kind === "settlement-confirmed").reduce((sum, event) => sum + event.amountCents, 0);
  const kittyAllocated = events.filter((event) => event.kind === "kitty-allocated").reduce((sum, event) => sum + event.amountCents, 0);
  const kittyReleased = events.filter((event) => event.kind === "kitty-released").reduce((sum, event) => sum + event.amountCents, 0);
  const kittyCents = kittyAllocated - kittyReleased;
  const operatingBalanceCents = confirmedContributionsCents - settledCents - kittyAllocated + kittyReleased;

  const txById = new Map(household.transactions.map((tx) => [tx.id, tx]));
  const positions = new Map<string, HouseholdFundTransactionPosition>();
  const fundingEvents = events.filter((event) => event.kind === "purchase-funded" || event.kind === "refund-funded");
  const fundingEventById = new Map(fundingEvents.map((event) => [event.id, event]));
  const rootPurchaseEvent = (event: HouseholdFundEvent, seen = new Set<string>()): HouseholdFundEvent | null => {
    if (seen.has(event.id)) return null;
    if (!event.relatedEventId) return event.kind === "purchase-funded" ? event : null;
    const related = fundingEventById.get(event.relatedEventId);
    if (!related) return event.kind === "purchase-funded" ? event : null;
    return rootPurchaseEvent(related, new Set(seen).add(event.id));
  };
  for (const event of fundingEvents) {
    const purchaseEvent = rootPurchaseEvent(event);
    const transactionId = purchaseEvent?.relatedTransactionIds[0] ?? event.relatedTransactionIds[0];
    const destinationAccountId = purchaseEvent?.destinationAccountId ?? event.destinationAccountId;
    if (!transactionId || !destinationAccountId) continue;
    const current = positions.get(transactionId) ?? {
      transactionId,
      destinationAccountId,
      fundedCents: 0,
      refundedCents: 0,
      settledCents: 0,
      outstandingCents: 0,
    };
    if (event.kind === "purchase-funded") current.fundedCents += event.amountCents;
    else current.refundedCents += event.amountCents;
    positions.set(transactionId, current);
  }
  const representedTransactionIds = new Set(fundingEvents.flatMap((event) => event.relatedTransactionIds));
  for (const tx of household.transactions) {
    if (representedTransactionIds.has(tx.id) || (tx.funding?.positionId && representedTransactionIds.has(tx.funding.positionId))) continue;
    const signed = signedFundingForTransaction(tx, txById);
    if (!signed) continue;
    const original = tx.refundOfId ? txById.get(tx.refundOfId) : undefined;
    const target = original?.funding?.fundId === config.id ? original : tx;
    const funding = target.funding;
    if (!funding || funding.fundId !== config.id) continue;
    const positionId = funding.positionId ?? target.id;
    const current = positions.get(positionId) ?? {
      transactionId: positionId,
      destinationAccountId: funding.destinationAccountId,
      fundedCents: 0,
      refundedCents: 0,
      settledCents: 0,
      outstandingCents: 0,
    };
    if (signed >= 0) current.fundedCents += signed;
    else current.refundedCents += -signed;
    positions.set(positionId, current);
  }
  const activeSettlementIds = new Set(events.filter((event) => event.kind === "settlement-confirmed").map((event) => event.id));
  for (const allocation of shapeHouseholdFundSettlementAllocations(household.fundSettlementAllocations)) {
    if (allocation.fundId !== config.id || !activeSettlementIds.has(allocation.eventId)) continue;
    const current = positions.get(allocation.transactionId);
    if (current) current.settledCents += allocation.amountCents;
  }
  for (const position of positions.values()) {
    position.outstandingCents = position.fundedCents - position.refundedCents - position.settledCents;
  }
  const destinationMap = new Map<string, number>();
  for (const position of positions.values()) {
    destinationMap.set(position.destinationAccountId, (destinationMap.get(position.destinationAccountId) ?? 0) + position.outstandingCents);
  }
  const destinationPositions = [...destinationMap.entries()].map(([destinationAccountId, outstanding]) => ({
    destinationAccountId,
    dueCents: Math.max(0, outstanding),
    creditCents: Math.max(0, -outstanding),
  })).sort((left, right) => left.destinationAccountId.localeCompare(right.destinationAccountId));
  const transferDueCents = destinationPositions.reduce((sum, item) => sum + item.dueCents, 0);
  const transferCreditCents = destinationPositions.reduce((sum, item) => sum + item.creditCents, 0);
  const upcomingReserveCents = (household.recurrences ?? []).reduce((sum, recurrence) => (
    sum + reserveForRecurrence(recurrence, config.id, today, monthEnd(today))
  ), 0);
  const plan = shapeHouseholdFundMonthPlans(household.fundMonthPlans)
    .filter((item) => item.fundId === config.id && item.monthKey === monthKeyFromDateKey(today))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
  const bufferCents = plan?.bufferCents ?? 0;
  const freeToSpendCents = operatingBalanceCents - transferDueCents + transferCreditCents - upcomingReserveCents;
  const topUpNeededCents = Math.max(0, -freeToSpendCents);
  const reconciliations = events.filter((event) => event.kind === "reconciliation-recorded").sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  return {
    configured: true,
    operatingBalanceCents,
    confirmedContributionsCents,
    pendingContributionsCents,
    settledCents,
    transferDueCents,
    transferCreditCents,
    upcomingReserveCents,
    bufferCents,
    freeToSpendCents,
    topUpNeededCents,
    safeRolloverCents: Math.max(0, freeToSpendCents - bufferCents),
    kittyCents,
    monthlyTargetCents: plan?.targetCents ?? 0,
    targetProgressCents: Math.min(plan?.targetCents ?? confirmedContributionsCents, confirmedContributionsCents),
    lastReconciledAt: reconciliations[0]?.createdAt ?? null,
    reconciliationTied: reconciliations[0]?.reconciliationTied ?? null,
    transactionPositions: [...positions.values()].sort((left, right) => left.transactionId.localeCompare(right.transactionId)),
    destinationPositions,
  };
}

function daysBetween(left: DateKey, right: DateKey): number {
  return Math.abs(Date.parse(`${left}T00:00:00.000Z`) - Date.parse(`${right}T00:00:00.000Z`)) / 86400000;
}

function bankCandidateEvents(household: Household): HouseholdFundEvent[] {
  return activeHouseholdFundEvents(household).filter((event) => event.kind === "contribution-confirmed" || event.kind === "settlement-confirmed");
}

export function matchHouseholdFundBankEvidence(input: {
  household: Household;
  evidence: HouseholdFundBankEvidence[];
  bindingAccountDigest: string;
  selectedEventIds?: string[];
  windowDays?: number;
}): HouseholdFundBankMatch {
  const evidence = input.evidence.filter((row) => row.accountDigest === input.bindingAccountDigest && row.amountCents > 0);
  const evidenceIds = evidence.map((row) => row.id).sort();
  if (!evidence.length) return { kind: "unmatched", eventIds: [], evidenceIds };
  const direction = evidence[0]?.direction;
  if (!direction || evidence.some((row) => row.direction !== direction)) return { kind: "near", eventIds: [], evidenceIds };
  const amountCents = evidence.reduce((sum, row) => sum + row.amountCents, 0);
  const windowDays = input.windowDays ?? 3;
  if (input.selectedEventIds && input.selectedEventIds.length > 1) {
    const selected = bankCandidateEvents(input.household).filter((event) => input.selectedEventIds!.includes(event.id));
    const destinations = [...new Set(evidence.map((row) => row.destinationAccountId).filter(Boolean))];
    const exactGroup = selected.length === new Set(input.selectedEventIds).size
      && selected.every((event) => (event.kind === "contribution-confirmed" ? "in" : "out") === direction)
      && selected.reduce((sum, event) => sum + event.amountCents, 0) === amountCents
      && selected.every((event) => evidence.every((row) => daysBetween(row.date, event.date) <= windowDays))
      && (direction === "in" || (destinations.length === 1 && selected.every((event) => event.destinationAccountId === destinations[0])));
    if (exactGroup) {
      return { kind: "exact", eventIds: selected.map((event) => event.id).sort(), evidenceIds, amountCents, direction };
    }
    return selected.length
      ? { kind: "near", eventIds: selected.map((event) => event.id).sort(), evidenceIds }
      : { kind: "unmatched", eventIds: [], evidenceIds };
  }
  const candidates = bankCandidateEvents(input.household).filter((event) => {
    if (input.selectedEventIds?.length && !input.selectedEventIds.includes(event.id)) return false;
    const eventDirection = event.kind === "contribution-confirmed" ? "in" : "out";
    if (eventDirection !== direction || event.amountCents !== amountCents) return false;
    if (!evidence.every((row) => daysBetween(row.date, event.date) <= windowDays)) return false;
    if (direction === "out") {
      const destinations = [...new Set(evidence.map((row) => row.destinationAccountId).filter(Boolean))];
      if (destinations.length !== 1 || destinations[0] !== event.destinationAccountId) return false;
    }
    return true;
  });
  if (candidates.length === 1) return { kind: "exact", eventIds: [candidates[0]!.id], evidenceIds, amountCents, direction };
  if (candidates.length > 1) return { kind: "competing", eventIds: candidates.map((event) => event.id).sort(), evidenceIds };
  const near = bankCandidateEvents(input.household).filter((event) => (
    (event.kind === "contribution-confirmed" ? "in" : "out") === direction
      && evidence.some((row) => daysBetween(row.date, event.date) <= windowDays)
  ));
  return near.length
    ? { kind: "near", eventIds: near.map((event) => event.id).sort(), evidenceIds }
    : { kind: "unmatched", eventIds: [], evidenceIds };
}

function assertImmutableRows<T extends { id: string }>(previous: T[] = [], candidate: T[] = [], label: string): void {
  const nextById = new Map(candidate.map((row) => [row.id, row]));
  for (const row of previous) {
    const next = nextById.get(row.id);
    if (!next) throw new ValidationError(`${label} history is append-only.`);
    if (JSON.stringify(row) !== JSON.stringify(next)) throw new ValidationError(`${label} history cannot be edited. Reverse and replace it.`);
  }
}

/** Validate the virtual subledger independently from the double-entry journal. */
export function assertHouseholdFundIntegrity(household: Household): void {
  const config = shapeHouseholdFundConfig(household.householdFund);
  const events = shapeHouseholdFundEvents(household.fundEvents);
  const settlements = shapeHouseholdFundSettlementAllocations(household.fundSettlementAllocations);
  const kitty = shapeHouseholdFundKittyAllocations(household.fundKittyAllocations);
  if (!config) {
    if (events.length || settlements.length || kitty.length || shapeHouseholdFundMonthPlans(household.fundMonthPlans).length) {
      throw new ValidationError("Household Fund facts require a configured fund.");
    }
    return;
  }
  if (!household.members.some((member) => member.id === config.custodianMemberId && member.active)) {
    throw new ValidationError("The Household Fund custodian must be an active household member.");
  }
  const eventIds = new Set<string>();
  for (const event of events) {
    if (eventIds.has(event.id)) throw new ValidationError("Household Fund event ids must be unique.");
    eventIds.add(event.id);
    if (event.fundId !== config.id || !household.members.some((member) => member.id === event.createdBy)) {
      throw new ValidationError("A Household Fund event is bound to the wrong fund or member.");
    }
    const custodianKinds = new Set<HouseholdFundEvent["kind"]>([
      "contribution-confirmed", "settlement-confirmed", "kitty-allocated", "kitty-released",
      "reconciliation-recorded", "bank-verified", "reversal",
    ]);
    if (custodianKinds.has(event.kind) && event.confirmedByMemberId !== config.custodianMemberId) {
      throw new ValidationError("Only the Household Fund custodian can confirm that action.");
    }
    if (event.kind === "contribution-proposed" && event.confirmedByMemberId) {
      throw new ValidationError("A contribution proposal cannot increase the fund balance.");
    }
    if ((event.kind === "purchase-funded" || event.kind === "refund-funded")
      && (event.confirmedByMemberId || !event.destinationAccountId || event.relatedTransactionIds.length === 0)) {
      throw new ValidationError("Household Fund purchase facts must remain unconfirmed shared allocations linked to a transaction.");
    }
    if (event.kind === "reversal" && (!event.relatedEventId || !events.some((row) => row.id === event.relatedEventId && row.id !== event.id))) {
      throw new ValidationError("A Household Fund reversal must reference an existing event.");
    }
  }
  const transactionById = new Map(household.transactions.map((row) => [row.id, row]));
  for (const tx of household.transactions) {
    if (!tx.funding) continue;
    if (tx.funding.fundId !== config.id || !Number.isInteger(tx.funding.fundedCents) || tx.funding.fundedCents <= 0 || tx.funding.fundedCents > tx.amountCents) {
      throw new ValidationError("Household Fund transaction allocations must be positive CAD cents within the posted amount.");
    }
    const directDebit = tx.funding.directDebit === true && tx.funding.destinationAccountId === HOUSEHOLD_FUND_DIRECT_DESTINATION;
    const destination = household.accounts.find((account) => account.id === tx.funding?.destinationAccountId);
    if (!directDebit && (!destination || destination.scope === "personal")) {
      throw new ValidationError("Household Fund destinations must be shared account metadata.");
    }
    if (tx.type !== "expense" && tx.type !== "refund" && !tx.reversalOfId) {
      throw new ValidationError("Only expenses and refunds can use the Household Fund.");
    }
    const expectedKind: HouseholdFundEvent["kind"] = signedFundingForTransaction(tx, transactionById) >= 0
      ? "purchase-funded"
      : "refund-funded";
    const matchingEvent = activeHouseholdFundEvents(household, config.id).find((event) => (
      event.kind === expectedKind
      && event.relatedTransactionIds.includes(tx.funding?.positionId ?? tx.id)
      && event.amountCents === tx.funding?.fundedCents
      && event.destinationAccountId === tx.funding?.destinationAccountId
    ));
    if (!matchingEvent) {
      throw new ValidationError("A visible Household Fund transaction must match its immutable shared funding fact.");
    }
  }
  const allocationIds = new Set<string>();
  for (const row of settlements) {
    if (allocationIds.has(row.id)) throw new ValidationError("Household Fund settlement allocation ids must be unique.");
    allocationIds.add(row.id);
    const owner = events.find((event) => event.id === row.eventId);
    if (row.fundId !== config.id || owner?.kind !== "settlement-confirmed") {
      throw new ValidationError("A Household Fund settlement allocation is bound to the wrong fund or event.");
    }
  }

  type IntegrityPosition = {
    destinationAccountId: string;
    fundedCents: number;
    refundedCents: number;
    settledCents: number;
  };
  const activeEvents = activeHouseholdFundEvents(household, config.id)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
  const activeById = new Map(activeEvents.map((event) => [event.id, event]));
  const positions = new Map<string, IntegrityPosition>();
  const purchaseRoot = (event: HouseholdFundEvent, seen = new Set<string>()): HouseholdFundEvent | null => {
    if (seen.has(event.id)) return null;
    if (event.kind === "purchase-funded") return event;
    if (!event.relatedEventId) return null;
    const related = activeById.get(event.relatedEventId);
    return related ? purchaseRoot(related, new Set(seen).add(event.id)) : null;
  };
  let operatingCents = 0;
  for (const event of activeEvents) {
    if (["contribution-proposed", "contribution-confirmed", "purchase-funded", "refund-funded", "settlement-confirmed", "kitty-allocated", "kitty-released"]
      .includes(event.kind) && event.amountCents <= 0) {
      throw new ValidationError("Household Fund money events require positive CAD cents.");
    }
    if (event.kind === "contribution-confirmed") operatingCents += event.amountCents;
    if (event.kind === "kitty-released") operatingCents += event.amountCents;
    if (event.kind === "purchase-funded") {
      const transactionId = event.relatedTransactionIds[0];
      if (!transactionId || !event.destinationAccountId) {
        throw new ValidationError("A Household Fund purchase fact must open a destination position.");
      }
      const existing = positions.get(transactionId);
      if (existing && existing.destinationAccountId !== event.destinationAccountId) {
        throw new ValidationError("A Household Fund correction cannot change the purchase destination.");
      }
      if (existing) existing.fundedCents += event.amountCents;
      else positions.set(transactionId, {
        destinationAccountId: event.destinationAccountId,
        fundedCents: event.amountCents,
        refundedCents: 0,
        settledCents: 0,
      });
    }
    if (event.kind === "refund-funded") {
      const root = purchaseRoot(event);
      const transactionId = root?.relatedTransactionIds[0];
      const position = transactionId ? positions.get(transactionId) : undefined;
      if (!root || !position || event.destinationAccountId !== position.destinationAccountId
        || position.refundedCents + event.amountCents > position.fundedCents) {
        throw new ValidationError("A Household Fund refund must reduce an existing funded purchase at the same destination.");
      }
      position.refundedCents += event.amountCents;
    }
    if (event.kind === "settlement-confirmed") {
      const rows = settlements.filter((row) => row.eventId === event.id);
      if (!event.destinationAccountId || rows.reduce((sum, row) => sum + row.amountCents, 0) !== event.amountCents) {
        throw new ValidationError("A Household Fund settlement must allocate every confirmed cent.");
      }
      if (event.amountCents > operatingCents) {
        throw new ValidationError("A transfer cannot exceed the confirmed Household Fund operating balance.");
      }
      for (const row of rows) {
        const position = positions.get(row.transactionId);
        const remaining = position
          ? position.fundedCents - position.refundedCents - position.settledCents
          : 0;
        if (!position || position.destinationAccountId !== event.destinationAccountId || row.amountCents > remaining) {
          throw new ValidationError("A Household Fund settlement cannot exceed the unsettled amount at its destination.");
        }
        position.settledCents += row.amountCents;
      }
      operatingCents -= event.amountCents;
    }
    if (event.kind === "kitty-allocated") {
      if (event.amountCents > operatingCents) throw new ValidationError("A Kitty rollover cannot exceed the operating balance.");
      operatingCents -= event.amountCents;
    }
  }
  for (const event of events.filter((row) => row.kind === "kitty-allocated")) {
    const rows = kitty.filter((row) => row.eventId === event.id);
    if (rows.reduce((sum, row) => sum + row.amountCents, 0) !== event.amountCents) {
      throw new ValidationError("A Kitty allocation must account for every confirmed cent.");
    }
    if (rows.some((row) => !household.goals.some((goal) => goal.id === row.goalId && goal.shared))) {
      throw new ValidationError("Household Fund Kitty allocations require shared goals.");
    }
  }
  const privateState = shapeHouseholdFundPrivate(household.fundPrivate, config.custodianMemberId);
  if (privateState.bankBindings.some((row) => row.memberId !== config.custodianMemberId)
    || privateState.reconciliations.some((row) => row.memberId !== config.custodianMemberId)) {
    throw new ValidationError("Household Fund bank details belong only to the custodian's Personal envelope.");
  }
  const projection = projectHouseholdFund(household, config.openedOn);
  if (projection.operatingBalanceCents < 0) throw new ValidationError("A transfer cannot drain more than the confirmed Household Fund balance.");
}

export function assertHouseholdFundTransition(previous: Household | null, candidate: Household): void {
  assertHouseholdFundIntegrity(candidate);
  if (!previous || previous.householdId !== candidate.householdId) return;
  const before = shapeHouseholdFundConfig(previous.householdFund);
  const after = shapeHouseholdFundConfig(candidate.householdFund);
  if (before && (!after || before.id !== after.id || before.custodianMemberId !== after.custodianMemberId || before.openedOn !== after.openedOn)) {
    throw new ValidationError("The Household Fund identity, opening date, and custodian are immutable.");
  }
  if (before?.mode === "connected" && after?.mode !== "connected") {
    throw new ValidationError("Connected bank history cannot be reset to practice mode.");
  }
  assertImmutableRows(shapeHouseholdFundEvents(previous.fundEvents), shapeHouseholdFundEvents(candidate.fundEvents), "Household Fund event");
  assertImmutableRows(shapeHouseholdFundSettlementAllocations(previous.fundSettlementAllocations), shapeHouseholdFundSettlementAllocations(candidate.fundSettlementAllocations), "Household Fund settlement");
  assertImmutableRows(shapeHouseholdFundKittyAllocations(previous.fundKittyAllocations), shapeHouseholdFundKittyAllocations(candidate.fundKittyAllocations), "Household Fund Kitty allocation");
  const beforePrivate = shapeHouseholdFundPrivate(previous.fundPrivate);
  const afterPrivate = shapeHouseholdFundPrivate(candidate.fundPrivate);
  assertImmutableRows(beforePrivate.reconciliations, afterPrivate.reconciliations, "Household Fund reconciliation");
}
