import type { DateKey } from "./calendar.ts";
import { monthKeyFromDateKey, weekBounds } from "./calendar.ts";
import {
  activeHouseholdFundEvents,
  projectHouseholdFund,
  type HouseholdFundProjection,
} from "./householdFund.ts";
import { LEDGER_CUSTODY_DISCLOSURE } from "./ledgerExperience.ts";
import type { Household, HouseholdFundEvent } from "./types.ts";

export type FundFlowNodeId =
  | "contributions"
  | "operating"
  | "purchases"
  | "due"
  | "credit"
  | "reserve"
  | "freeToSpend"
  | "kitty";

export type FundFlowNode = {
  id: FundFlowNodeId;
  label: string;
  cents: number;
  empty: boolean;
  source: string;
  state: "idle" | "top-up" | "credit" | "deficit";
};

export type FundFlowEdge = {
  from: FundFlowNodeId;
  to: FundFlowNodeId;
  direction: "forward" | "reduce" | "credit" | "conserve";
};

export type FundFlowDiagram = {
  configured: boolean;
  nodes: FundFlowNode[];
  edges: FundFlowEdge[];
  conservationCents: number;
};

export type SharedActionKind =
  | "books-health"
  | "setup-fund"
  | "top-up"
  | "transfer-due"
  | "confirm-contribution"
  | "upcoming-reserve"
  | "reconciliation"
  | "rollover";

export type SharedActionItem = {
  id: string;
  kind: SharedActionKind;
  priority: number;
  title: string;
  reason: string;
  actorMemberId: string | null;
  actorLabel: string;
  amountCents: number | null;
  sourceTab: "home" | "ledger" | "more";
};

export type SharedWeekEvent = {
  id: string;
  date: DateKey;
  kind: HouseholdFundEvent["kind"];
  label: string;
  amountCents: number;
  actorLabel: string | null;
  destinationLabel: string | null;
};

export type SharedMonthlyArc = {
  monthKey: string;
  openingOperatingCents: number;
  confirmedContributionsCents: number;
  monthlyTargetCents: number;
  purchasesCents: number;
  refundsCents: number;
  settledCents: number;
  upcomingReserveCents: number;
  bufferCents: number;
  reconciliationTied: boolean | null;
  lastReconciledAt: string | null;
  safeRolloverCents: number;
  closingOperatingCents: number;
  kittyCents: number;
};

export type SharedTrustFacts = {
  custodyDisclosure: string;
  lastReconciledAt: string | null;
  reconciliationTied: boolean | null;
  pendingProposalCount: number;
  environment: Household["environment"];
  lastCommittedAt: string | null;
  auditLabel: string;
};

export type SharedOpening = {
  configured: boolean;
  headline: string;
  body: string;
  operatingBalanceCents: number;
  transferDueCents: number;
  transferCreditCents: number;
  upcomingReserveCents: number;
  freeToSpendCents: number;
  topUpNeededCents: number;
  monthlyTargetCents: number;
  targetProgressCents: number;
  reconciliationTied: boolean | null;
  lastReconciledAt: string | null;
};

export type SharedLedgerStory = {
  opening: SharedOpening;
  flow: FundFlowDiagram;
  queue: SharedActionItem[];
  weekly: SharedWeekEvent[];
  monthly: SharedMonthlyArc;
  trust: SharedTrustFacts;
};

function memberLabel(household: Household, memberId: string | null | undefined): string | null {
  if (!memberId) return null;
  return household.members.find((member) => member.id === memberId)?.name ?? null;
}

function sharedAccountName(household: Household, accountId: string | null | undefined): string | null {
  if (!accountId) return null;
  const account = household.accounts.find((row) => row.id === accountId);
  if (!account || account.scope === "personal") return null;
  return account.name;
}

function custodianLabel(household: Household): string {
  const id = household.householdFund?.custodianMemberId;
  return memberLabel(household, id) ?? "the custodian";
}

export function fundFlowDiagram(household: Household, today: DateKey): FundFlowDiagram {
  const projection = projectHouseholdFund(household, today);
  const events = activeHouseholdFundEvents(household);
  const purchasesCents = events.filter((event) => event.kind === "purchase-funded").reduce((sum, event) => sum + event.amountCents, 0);
  const node = (
    id: FundFlowNodeId,
    label: string,
    cents: number,
    source: string,
    state: FundFlowNode["state"] = "idle",
  ): FundFlowNode => ({
    id,
    label,
    cents,
    empty: cents === 0,
    source,
    state,
  });
  const freeState: FundFlowNode["state"] = projection.topUpNeededCents
    ? "top-up"
    : projection.freeToSpendCents < 0
      ? "deficit"
      : "idle";
  const nodes: FundFlowNode[] = [
    node("contributions", "Confirmed contributions", projection.confirmedContributionsCents, "Fund events · confirmed"),
    node("operating", "Operating pool", projection.operatingBalanceCents, "Confirmed contributions − settlements − Kitty"),
    node("purchases", "Fund-backed purchases", purchasesCents, "Immutable purchase-funded events"),
    node("due", "Transfer due", projection.transferDueCents, "Unsettled Fund-backed destinations", projection.transferDueCents ? "idle" : "idle"),
    node("credit", "Fund credit", projection.transferCreditCents, "Refund after settlement", projection.transferCreditCents ? "credit" : "idle"),
    node("reserve", "Upcoming reserve", projection.upcomingReserveCents, "Fund-backed recurring bills this month"),
    node(
      "freeToSpend",
      projection.topUpNeededCents ? "Top-up needed" : "Fund free-to-spend",
      projection.topUpNeededCents || projection.freeToSpendCents,
      "Operating − due + credit − reserve. Not global safe-to-spend.",
      freeState,
    ),
    node("kitty", "Kitty rollover", projection.kittyCents, "No bank movement. Operating plus Kitty stays conserved."),
  ];
  const edges: FundFlowEdge[] = [
    { from: "contributions", to: "operating", direction: "forward" },
    { from: "operating", to: "purchases", direction: "forward" },
    { from: "purchases", to: "due", direction: "forward" },
    { from: "credit", to: "freeToSpend", direction: "credit" },
    { from: "due", to: "freeToSpend", direction: "reduce" },
    { from: "reserve", to: "freeToSpend", direction: "reduce" },
    { from: "operating", to: "kitty", direction: "conserve" },
  ];
  return {
    configured: projection.configured,
    nodes,
    edges,
    conservationCents: projection.operatingBalanceCents + projection.kittyCents,
  };
}

export function sharedActionQueue(
  household: Household,
  today: DateKey,
  options: { integrityFindingCount?: number } = {},
): SharedActionItem[] {
  const projection = projectHouseholdFund(household, today);
  const events = activeHouseholdFundEvents(household);
  const pending = events.filter((event) => (
    event.kind === "contribution-proposed"
    && !events.some((confirmed) => confirmed.kind === "contribution-confirmed" && confirmed.relatedEventId === event.id)
  ));
  const custodian = custodianLabel(household);
  const week = weekBounds(today);
  const reconDate = projection.lastReconciledAt?.slice(0, 10) ?? null;
  const reconStale = projection.configured && (!reconDate || reconDate < week.start);
  const items: SharedActionItem[] = [];

  if ((options.integrityFindingCount ?? 0) > 0) {
    items.push({
      id: "books-health",
      kind: "books-health",
      priority: 10,
      title: "Review books Health",
      reason: "The accepted household books have an integrity finding. This is the full-household signal, not a mode-scoped amount.",
      actorMemberId: null,
      actorLabel: "Either of us",
      amountCents: null,
      sourceTab: "more",
    });
  }
  if (!projection.configured) {
    items.push({
      id: "setup-fund",
      kind: "setup-fund",
      priority: 20,
      title: "Bianca confirms the $0.00 practice Fund",
      reason: "The shared operating pool is not open yet. The money remains in Bianca’s savings.",
      actorMemberId: household.members.find((member) => member.name.toLowerCase().includes("bianca"))?.id ?? household.householdFund?.custodianMemberId ?? null,
      actorLabel: custodian,
      amountCents: 0,
      sourceTab: "ledger",
    });
  }
  if (projection.topUpNeededCents > 0) {
    items.push({
      id: "top-up",
      kind: "top-up",
      priority: 30,
      title: "Exact top-up needed before a new planned commitment",
      reason: "Fund free-to-spend is short. Historical purchases stay recorded. New planned Fund commitments wait on this amount.",
      actorMemberId: null,
      actorLabel: "Either of us may propose",
      amountCents: projection.topUpNeededCents,
      sourceTab: "ledger",
    });
  }
  if (projection.transferDueCents > 0) {
    items.push({
      id: "transfer-due",
      kind: "transfer-due",
      priority: 40,
      title: `${custodian} confirms the destination transfer`,
      reason: "Fund-backed purchases are waiting to be cleared. This is a confirmation, not a bank movement by Hearth.",
      actorMemberId: household.householdFund?.custodianMemberId ?? null,
      actorLabel: custodian,
      amountCents: projection.transferDueCents,
      sourceTab: "ledger",
    });
  }
  for (const event of pending) {
    const contributor = memberLabel(household, event.contributorMemberId) ?? "A member";
    items.push({
      id: `confirm-${event.id}`,
      kind: "confirm-contribution",
      priority: 50,
      title: `${custodian} confirms receipt`,
      reason: `${contributor} proposed a contribution. A proposal never creates money.`,
      actorMemberId: household.householdFund?.custodianMemberId ?? null,
      actorLabel: custodian,
      amountCents: event.amountCents,
      sourceTab: "ledger",
    });
  }
  if (projection.upcomingReserveCents > 0) {
    items.push({
      id: "upcoming-reserve",
      kind: "upcoming-reserve",
      priority: 60,
      title: "Upcoming Fund-backed bill this month",
      reason: "A recurring Fund-backed expense is reserved so Fund free-to-spend stays honest.",
      actorMemberId: null,
      actorLabel: "Household",
      amountCents: projection.upcomingReserveCents,
      sourceTab: "home",
    });
  }
  if (projection.configured && (projection.reconciliationTied === false || reconStale)) {
    items.push({
      id: "reconciliation",
      kind: "reconciliation",
      priority: 70,
      title: projection.reconciliationTied === false ? "Shared slice needs review" : "Record this week’s shared reconciliation",
      reason: projection.reconciliationTied === false
        ? "The last shared slice did not tie. Private bank totals stay in Bianca’s Personal envelope."
        : "The shared slice has not been reconciled this week. Bianca records the private check; Shared only sees tied or needs review.",
      actorMemberId: household.householdFund?.custodianMemberId ?? null,
      actorLabel: custodian,
      amountCents: null,
      sourceTab: "ledger",
    });
  }
  if (projection.safeRolloverCents > 0) {
    items.push({
      id: "rollover",
      kind: "rollover",
      priority: 80,
      title: `${custodian} can confirm a safe Kitty rollover`,
      reason: "Operating plus Kitty stays conserved. No bank transfer occurs.",
      actorMemberId: household.householdFund?.custodianMemberId ?? null,
      actorLabel: custodian,
      amountCents: projection.safeRolloverCents,
      sourceTab: "ledger",
    });
  }
  return items.sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id));
}

function weekEventLabel(kind: HouseholdFundEvent["kind"]): string {
  if (kind === "contribution-proposed") return "Contribution proposed";
  if (kind === "contribution-confirmed") return "Contribution confirmed";
  if (kind === "purchase-funded") return "Fund-backed purchase";
  if (kind === "refund-funded") return "Fund-backed refund";
  if (kind === "settlement-confirmed") return "Settlement confirmed";
  if (kind === "reconciliation-recorded") return "Reconciliation recorded";
  if (kind === "reversal") return "Correction posted";
  if (kind === "kitty-allocated") return "Kitty allocated";
  if (kind === "kitty-released") return "Kitty released";
  if (kind === "bank-verified") return "Bank evidence verified";
  return kind;
}

export function sharedWeeklyStory(household: Household, today: DateKey): SharedWeekEvent[] {
  const week = weekBounds(today);
  const events = activeHouseholdFundEvents(household).filter((event) => event.date >= week.start && event.date <= week.end);
  return events.map((event) => ({
    id: event.id,
    date: event.date,
    kind: event.kind,
    label: weekEventLabel(event.kind),
    amountCents: event.amountCents,
    actorLabel: memberLabel(household, event.contributorMemberId ?? event.confirmedByMemberId ?? event.createdBy),
    destinationLabel: sharedAccountName(household, event.destinationAccountId),
  }));
}

export function sharedMonthlyArc(household: Household, today: DateKey, projection: HouseholdFundProjection): SharedMonthlyArc {
  const monthKey = monthKeyFromDateKey(today);
  const monthStart = `${monthKey}-01`;
  const events = activeHouseholdFundEvents(household);
  const openingOperatingCents = events.filter((event) => event.date < monthStart).reduce((sum, event) => {
    if (event.kind === "contribution-confirmed" || event.kind === "kitty-released") return sum + event.amountCents;
    if (event.kind === "settlement-confirmed" || event.kind === "kitty-allocated") return sum - event.amountCents;
    return sum;
  }, 0);
  const inMonth = events.filter((event) => event.date.startsWith(monthKey));
  return {
    monthKey,
    openingOperatingCents,
    confirmedContributionsCents: inMonth.filter((event) => event.kind === "contribution-confirmed").reduce((sum, event) => sum + event.amountCents, 0),
    monthlyTargetCents: projection.monthlyTargetCents,
    purchasesCents: inMonth.filter((event) => event.kind === "purchase-funded").reduce((sum, event) => sum + event.amountCents, 0),
    refundsCents: inMonth.filter((event) => event.kind === "refund-funded").reduce((sum, event) => sum + event.amountCents, 0),
    settledCents: inMonth.filter((event) => event.kind === "settlement-confirmed").reduce((sum, event) => sum + event.amountCents, 0),
    upcomingReserveCents: projection.upcomingReserveCents,
    bufferCents: projection.bufferCents,
    reconciliationTied: projection.reconciliationTied,
    lastReconciledAt: projection.lastReconciledAt,
    safeRolloverCents: projection.safeRolloverCents,
    closingOperatingCents: projection.operatingBalanceCents,
    kittyCents: projection.kittyCents,
  };
}

export function buildSharedLedgerStory(
  projectedShared: Household,
  today: DateKey,
  options: { integrityFindingCount?: number } = {},
): SharedLedgerStory {
  const projection = projectHouseholdFund(projectedShared, today);
  const pendingCount = activeHouseholdFundEvents(projectedShared).filter((event) => (
    event.kind === "contribution-proposed"
    && !activeHouseholdFundEvents(projectedShared).some((confirmed) => confirmed.kind === "contribution-confirmed" && confirmed.relatedEventId === event.id)
  )).length;
  const opening: SharedOpening = projection.configured
    ? {
        configured: true,
        headline: "Together, right now",
        body: "Household Fund is the shared operating pool. Fund free-to-spend is not global safe-to-spend.",
        operatingBalanceCents: projection.operatingBalanceCents,
        transferDueCents: projection.transferDueCents,
        transferCreditCents: projection.transferCreditCents,
        upcomingReserveCents: projection.upcomingReserveCents,
        freeToSpendCents: projection.freeToSpendCents,
        topUpNeededCents: projection.topUpNeededCents,
        monthlyTargetCents: projection.monthlyTargetCents,
        targetProgressCents: projection.targetProgressCents,
        reconciliationTied: projection.reconciliationTied,
        lastReconciledAt: projection.lastReconciledAt,
      }
    : {
        configured: false,
        headline: "Together, right now",
        body: `${LEDGER_CUSTODY_DISCLOSURE} The Household Fund is a shared operating subledger over Bianca’s existing savings. It opens at $0.00. Bianca confirms the opening.`,
        operatingBalanceCents: 0,
        transferDueCents: 0,
        transferCreditCents: 0,
        upcomingReserveCents: 0,
        freeToSpendCents: 0,
        topUpNeededCents: 0,
        monthlyTargetCents: 0,
        targetProgressCents: 0,
        reconciliationTied: null,
        lastReconciledAt: null,
      };
  return {
    opening,
    flow: fundFlowDiagram(projectedShared, today),
    queue: sharedActionQueue(projectedShared, today, options),
    weekly: sharedWeeklyStory(projectedShared, today),
    monthly: sharedMonthlyArc(projectedShared, today, projection),
    trust: {
      custodyDisclosure: LEDGER_CUSTODY_DISCLOSURE,
      lastReconciledAt: projection.lastReconciledAt,
      reconciliationTied: projection.reconciliationTied,
      pendingProposalCount: pendingCount,
      environment: projectedShared.environment,
      lastCommittedAt: projectedShared.lastCommittedAt,
      auditLabel: "Open Fund books",
    },
  };
}
