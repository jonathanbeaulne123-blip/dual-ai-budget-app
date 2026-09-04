import { isLiabilityKind } from "../accountKinds.ts";
import {
  charterCeilingLabel,
  charterSignatureStatus,
  shapeHouseholdCharter,
} from "../charter.ts";
import {
  CHARTER_SPLIT_HEADING,
  charterCadenceLabel,
  charterSignatureDateLabel,
  signatureLines,
} from "../charterView.ts";
import {
  HOUSEHOLD_FUND_SETUP_RULES,
  householdFundConfigurationApprovalState,
  shapeHouseholdFundConfig,
} from "../householdFund.ts";
import { formatCad } from "../money.ts";
import {
  hasOnlyOpeningCorrectionHistory,
  hasPostedOpeningTruth,
  householdHasAcceptedMoney,
  openingBatchRows,
} from "../openingTruth.ts";
import { resolveSwipeCardAccount } from "../swipe.ts";
import type { Account, Household, Transaction } from "../types.ts";
import { acceptedHouseholdOnboarding, onboardingIsActive, shapeHouseholdOnboarding } from "./mode.ts";
import { chapterById } from "./registry.ts";
import { onboardingRecurrenceCadenceLabel, onboardingRecurrenceProbe } from "./recurrences.ts";
import { onboardingCadenceProbe, onboardingCadenceSentence } from "./cadence.ts";
import {
  validateHouseholdScopeObservation,
  type HouseholdScopeFailure,
  type HouseholdScopeObservation,
} from "./householdScope.ts";
import type { ChapterId } from "./types.ts";

export type EvidenceScope = "household" | "self-personal";
export type IneligibleReason =
  | "malformed"
  | "stale"
  | "conflicted"
  | "untied"
  | "privacy"
  | "identity"
  | "membership"
  | "scope"
  | "offline"
  | "retry"
  | "revoked"
  | "custody";

export type EvidenceCard = {
  chapterId: ChapterId;
  scope: EvidenceScope;
  kind: "transaction" | "receipt" | "account" | "configuration" | "household" | "recurrence" | "submission" | "approval";
  sourceIds: string[];
  lines: Array<{ label: string; value: string }>;
  observedAt: string;
};

export type EvidenceResult =
  | { kind: "accepted"; card: EvidenceCard }
  | { kind: "empty" }
  | { kind: "ineligible"; reason: IneligibleReason };

export type EvidenceContext = {
  /** Sanitized transient Chapter 2 observation; never stored on Household. */
  householdScope?: HouseholdScopeObservation | null;
};

type Projection = {
  household: EvidenceCard | null;
  personal: EvidenceCard | null;
  ineligible?: IneligibleReason;
};

const EMPTY: Projection = { household: null, personal: null };

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => Boolean(value.trim())).map((value) => value.trim()))].sort();
}

function latestIso(values: readonly string[]): string | null {
  const normalized = values.map((value) => {
    if (!value.trim() || Number.isNaN(Date.parse(value))) return null;
    return new Date(value).toISOString();
  });
  if (normalized.some((value) => value === null)) return null;
  const valid = normalized.filter((value): value is string => value !== null);
  return valid.sort().at(-1) ?? null;
}

function cardResult(card: EvidenceCard | null): EvidenceResult {
  if (!card) return { kind: "empty" };
  const sourceIds = unique(card.sourceIds);
  const observedAt = latestIso([card.observedAt]);
  if (!sourceIds.length || !observedAt || card.lines.some((line) => !line.label.trim() || !line.value.trim())) {
    return { kind: "ineligible", reason: "malformed" };
  }
  return { kind: "accepted", card: { ...card, sourceIds, observedAt } };
}

function memberName(household: Household, memberId: string): string {
  return household.members.find((member) => member.id === memberId)?.name ?? memberId;
}

function accountName(household: Household, accountId: string): string {
  return household.accounts.find((account) => account.id === accountId)?.name ?? accountId;
}

function meetEvidence(household: Household, chapterId: ChapterId): Projection {
  if (!household.householdOnboarding) return EMPTY;
  const shaped = shapeHouseholdOnboarding(household.householdOnboarding);
  if (!shaped) return { ...EMPTY, ineligible: "malformed" };
  if (shaped.environment !== household.environment || shaped.householdId !== household.householdId) {
    return { ...EMPTY, ineligible: "privacy" };
  }
  if (shaped.state === "repair") return { ...EMPTY, ineligible: "stale" };
  const accepted = acceptedHouseholdOnboarding(household);
  if (!accepted || !onboardingIsActive(household)) return EMPTY;
  if (!accepted.startedAt) return { ...EMPTY, ineligible: "malformed" };
  const names = accepted.confirmedByMemberIds.map((memberId) => memberName(household, memberId)).sort();
  return {
    ...EMPTY,
    household: {
      chapterId,
      scope: "household",
      kind: "approval",
      sourceIds: [accepted.id],
      lines: [
        { label: "State", value: "Started together" },
        { label: "Confirmed by", value: names.join(" and ") },
      ],
      observedAt: accepted.startedAt ?? accepted.updatedAt,
    },
  };
}

function householdFailureReason(reason: HouseholdScopeFailure): IneligibleReason {
  switch (reason) {
    case "missing-auth": return "identity";
    case "missing-partner-membership": return "membership";
    case "ambiguous-household-scope": return "scope";
    case "revoked-membership": return "revoked";
    case "offline-cached-identity": return "offline";
    case "probe-failed": return "retry";
    case "scope-changed": return "stale";
  }
}

function householdEvidence(
  household: Household,
  chapterId: ChapterId,
  viewerMemberId: string,
  observation?: HouseholdScopeObservation | null,
): Projection {
  const validation = validateHouseholdScopeObservation(household, viewerMemberId, observation);
  if (validation.kind === "checking") return EMPTY;
  if (validation.kind === "blocked") {
    return { ...EMPTY, ineligible: householdFailureReason(validation.reason) };
  }
  const memberIds = new Set(validation.memberIds);
  const members = household.members
    .filter((member) => member.active && memberIds.has(member.id))
    .sort((left, right) => left.id.localeCompare(right.id));
  return {
    ...EMPTY,
    household: {
      chapterId,
      scope: "household",
      kind: "household",
      sourceIds: [household.householdId, ...members.map((member) => member.id)],
      lines: [
        { label: "Household", value: household.name },
        { label: "Members", value: members.map((member) => member.name).join(" and ") },
        { label: "Environment", value: household.environment },
      ],
      observedAt: validation.observedAt,
    },
  };
}

function charterEvidence(household: Household, chapterId: ChapterId): Projection {
  if (!household.charter) return EMPTY;
  const charter = shapeHouseholdCharter(household.charter, {
    members: household.members,
    householdFund: household.householdFund ?? null,
  });
  if (!charter) return { ...EMPTY, ineligible: "malformed" };
  const activeMemberIds = new Set(household.members.filter((member) => member.active).map((member) => member.id));
  const signatures = signatureLines(charter, household.members).filter((signature) => activeMemberIds.has(signature.memberId));
  if (signatures.some((signature) => charterSignatureStatus(charter, signature.memberId) === "stale")) {
    return { ...EMPTY, ineligible: "stale" };
  }
  if (signatures.length !== activeMemberIds.size
    || signatures.some((signature) => !signature.signedAt)) return EMPTY;
  const custodian = memberName(household, charter.custodianMemberId);
  return {
    ...EMPTY,
    household: {
      chapterId,
      scope: "household",
      kind: "configuration",
      sourceIds: [charter.id],
      lines: [
        { label: "Purpose", value: charter.purpose || "Left open for now" },
        { label: "Custodian", value: custodian },
        { label: "Split", value: CHARTER_SPLIT_HEADING[charter.splitRule] },
        ...(charter.splitNote ? [{ label: "In your words", value: charter.splitNote }] : []),
        { label: "Ceiling", value: charterCeilingLabel(charter) },
        { label: "Cadence", value: charterCadenceLabel(charter) },
        ...signatures.map((signature) => ({
          label: `${signature.name} signed`,
          value: charterSignatureDateLabel(signature.signedAt!),
        })),
      ],
      observedAt: latestIso(signatures.map((signature) => signature.signedAt!)) ?? "",
    },
  };
}

function accountLine(account: Account): { label: string; value: string } {
  const suffix = account.last4 ? ` ending ${account.last4}` : "";
  return { label: account.name, value: `${account.kind}${suffix}` };
}

function accountsEvidence(household: Household, chapterId: ChapterId, viewerMemberId: string): Projection {
  const shared = household.accounts
    .filter((account) => account.active && account.scope !== "personal")
    .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));
  const own = household.accounts
    .filter((account) => account.active && account.scope === "personal" && account.ownerMemberId === viewerMemberId)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));
  const fundCardMemberId = household.charter?.custodianMemberId
    ?? household.householdFund?.custodianMemberId
    ?? viewerMemberId;
  const cardResolution = resolveSwipeCardAccount(household, fundCardMemberId);
  const fundCard = cardResolution.kind === "ready"
    ? shared.find((account) => account.id === cardResolution.accountId) ?? null
    : null;
  const householdCard = shared.length && fundCard
    ? {
        chapterId,
        scope: "household" as const,
        kind: "account" as const,
        sourceIds: shared.map((account) => account.id),
        lines: [
          { label: "Fund card", value: fundCard.name },
          ...shared.map(accountLine),
        ],
        observedAt: latestIso(shared.map((account) => account.updatedAt)) ?? "",
      }
    : null;
  const personalCard = own.length
    ? {
        chapterId,
        scope: "self-personal" as const,
        kind: "account" as const,
        sourceIds: own.map((account) => account.id),
        lines: own.map(accountLine),
        observedAt: latestIso(own.map((account) => account.updatedAt)) ?? "",
      }
    : null;
  const partnerPersonalCouldMasqueradeAsFundCard = household.accounts.some((account) => (
    account.active
    && account.scope === "personal"
    && account.ownerMemberId !== viewerMemberId
    && account.currency === "CAD"
    && account.kind === "credit"
  ));
  return {
    household: householdCard,
    personal: personalCard,
    // Never reveal which partner account caused this refusal. Chapter 4 may
    // only use Shared account facts, even when a private card happens to be
    // the only shape that would otherwise make the probe look complete.
    ineligible: !householdCard && partnerPersonalCouldMasqueradeAsFundCard ? "privacy" : undefined,
  };
}

function activeOpeningRows(household: Household): Transaction[] {
  const reversed = new Set(household.transactions
    .filter((transaction) => transaction.source === "reversal" && transaction.reversalOfId)
    .map((transaction) => transaction.reversalOfId!));
  return household.transactions.filter((transaction) => (
    transaction.source === "opening"
    && !transaction.reversalOfId
    && !reversed.has(transaction.id)
  ));
}

function openingEvidence(household: Household, chapterId: ChapterId): Projection {
  const sharedTransactions = household.transactions.filter((transaction) => transaction.visibility !== "personal");
  const sharedHousehold = { ...household, transactions: sharedTransactions };
  const sharedAccountIds = household.accounts
    .filter((account) => account.active && account.scope !== "personal")
    .map((account) => account.id)
    .sort();
  const rows = activeOpeningRows(sharedHousehold)
    .filter((transaction) => household.accounts.some((account) => (
      account.id === transaction.accountId && account.scope !== "personal"
    )))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
  if (!rows.length) {
    if (householdHasAcceptedMoney(sharedHousehold) && !hasOnlyOpeningCorrectionHistory(sharedHousehold)) {
      return { ...EMPTY, ineligible: "stale" };
    }
    return EMPTY;
  }
  const sourceId = rows[0]?.sourceId;
  if (!sourceId || rows.some((row) => row.sourceId !== sourceId || row.date !== rows[0]?.date)) {
    return { ...EMPTY, ineligible: "untied" };
  }
  const batchRows = openingBatchRows(sharedHousehold, sourceId)
    .filter((transaction) => transaction.visibility !== "personal");
  if (batchRows.length !== rows.length || !hasPostedOpeningTruth(sharedHousehold)) {
    return { ...EMPTY, ineligible: "untied" };
  }
  const coveredAccountIds = new Set(rows.map((row) => row.accountId));
  if (!sharedAccountIds.length || sharedAccountIds.some((accountId) => !coveredAccountIds.has(accountId))) {
    // A partial opening is real accepted history, but it is not completion.
    // The existing whole-batch reversal is the only correction path.
    return EMPTY;
  }
  const receipt = household.commandReceipts.find((candidate) => (
    candidate.commandKind === "postOpeningBalances"
    && candidate.confirmationId === sourceId
    && rows.every((row) => candidate.postedIds.includes(row.id))
  ));
  if (!receipt) return { ...EMPTY, ineligible: "untied" };
  const equityCents = rows.reduce((sum, row) => {
    const account = household.accounts.find((candidate) => candidate.id === row.accountId);
    return sum + (account && isLiabilityKind(account.kind) ? -row.amountCents : row.amountCents);
  }, 0);
  return {
    ...EMPTY,
    household: {
      chapterId,
      scope: "household",
      kind: "receipt",
      sourceIds: [receipt.confirmationId, ...rows.map((row) => row.id)],
      lines: [
        { label: "Accounts covered", value: rows.map((row) => accountName(household, row.accountId)).join(", ") },
        { label: "Civil date", value: rows[0]!.date },
        { label: "Opening equity", value: formatCad(equityCents) },
      ],
      observedAt: receipt.acceptedAt,
    },
  };
}

function fundEvidence(household: Household, chapterId: ChapterId): Projection {
  if (!household.householdFund) return EMPTY;
  const fund = shapeHouseholdFundConfig(household.householdFund);
  if (!fund) return { ...EMPTY, ineligible: "malformed" };
  if (!household.members.some((member) => member.active && member.id === fund.custodianMemberId)) {
    return { ...EMPTY, ineligible: "malformed" };
  }
  const charter = household.charter ? shapeHouseholdCharter(household.charter, {
    members: household.members,
    householdFund: null,
  }) : null;
  if (charter && charter.custodianMemberId !== fund.custodianMemberId) {
    return { ...EMPTY, ineligible: "custody" };
  }
  const approvalState = householdFundConfigurationApprovalState(household);
  if (!approvalState) return { ...EMPTY, ineligible: "malformed" };
  if (approvalState.kind === "stale") return { ...EMPTY, ineligible: "stale" };
  if (approvalState.kind !== "complete") return EMPTY;
  const activeMembers = household.members
    .filter((member) => member.active)
    .sort((left, right) => left.id.localeCompare(right.id));
  const approvalByMember = new Map(approvalState.approvals
    .filter((approval) => approval.revision === approvalState.revision)
    .map((approval) => [approval.memberId, approval]));
  if (activeMembers.length < 2 || activeMembers.some((member) => !approvalByMember.has(member.id))) return EMPTY;
  const sharedAccounts = household.accounts
    .filter((account) => account.active && account.scope !== "personal")
    .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
  if (!sharedAccounts.length) return EMPTY;
  const cardResolution = resolveSwipeCardAccount(household, fund.custodianMemberId);
  const orderedAccounts = cardResolution.kind === "ready"
    ? [
        ...sharedAccounts.filter((account) => account.id === cardResolution.accountId),
        ...sharedAccounts.filter((account) => account.id !== cardResolution.accountId),
      ]
    : sharedAccounts;
  const approvals = activeMembers.map((member) => ({
    member,
    approval: approvalByMember.get(member.id)!,
  }));
  return {
    ...EMPTY,
    household: {
      chapterId,
      scope: "household",
      kind: "approval",
      sourceIds: [
        fund.id,
        ...orderedAccounts.map((account) => account.id),
        ...approvals.map(({ member }) => `${fund.id}:${member.id}:${fund.configurationRevision}`),
      ],
      lines: [
        { label: "Fund", value: fund.name },
        { label: "Custodian", value: memberName(household, fund.custodianMemberId) },
        { label: "Backing account", value: "Custodian's Personal savings · details stay private" },
        { label: "Operating accounts", value: orderedAccounts.map((account) => account.name).join(", ") },
        { label: "Rules", value: HOUSEHOLD_FUND_SETUP_RULES.join(" ") },
        ...approvals.map(({ member, approval }) => ({
          label: `${member.name} approved`,
          value: approval.approvedAt.slice(0, 10),
        })),
      ],
      observedAt: latestIso(approvals.map(({ approval }) => approval.approvedAt)) ?? "",
    },
  };
}

function recurrenceEvidence(household: Household, chapterId: ChapterId): Projection {
  const probe = onboardingRecurrenceProbe(household);
  if (!probe.complete) return EMPTY;
  return {
    ...EMPTY,
    household: {
      chapterId,
      scope: "household",
      kind: "recurrence",
      sourceIds: probe.rows.map((row) => row.id),
      lines: probe.rows.map((row) => ({
        label: row.note || household.categories.find((category) => category.id === row.subcategoryId)?.name || "Regular money",
        value: `${onboardingRecurrenceCadenceLabel(row.cadence)} · ${formatCad(row.amountCents)} · next ${row.nextDate}`,
      })),
      observedAt: latestIso(probe.rows.map((row) => row.updatedAt)) ?? "",
    },
  };
}

function cadenceEvidence(household: Household, chapterId: ChapterId, viewerMemberId: string): Projection {
  const probe = onboardingCadenceProbe(household, viewerMemberId);
  if (!probe.complete || !probe.schedule || !probe.sourceId || !probe.observedAt) return EMPTY;
  const name = memberName(household, viewerMemberId);
  return {
    ...EMPTY,
    household: {
      chapterId,
      scope: "household",
      kind: "configuration",
      sourceIds: [probe.sourceId],
      lines: [{ label: "Earning rhythm", value: onboardingCadenceSentence(name, probe.schedule) }],
      observedAt: probe.observedAt,
    },
  };
}

function planEvidence(household: Household, chapterId: ChapterId): Projection {
  const receipt = [...household.commandReceipts]
    .filter((candidate) => candidate.commandKind === "adoptFirstBudget")
    .sort((left, right) => right.acceptedAt.localeCompare(left.acceptedAt))[0];
  if (!receipt) return EMPTY;
  if (!receipt.postedIds.length) return { ...EMPTY, ineligible: "untied" };
  const planIds = new Set(household.budgetPlans.map((plan) => plan.id));
  if (receipt.postedIds.some((id) => !planIds.has(id))) return { ...EMPTY, ineligible: "untied" };
  return {
    ...EMPTY,
    household: {
      chapterId,
      scope: "household",
      kind: "submission",
      sourceIds: [receipt.confirmationId, ...receipt.postedIds],
      lines: [{ label: "Accepted plan", value: `${receipt.postedIds.length} plan rows` }],
      observedAt: receipt.acceptedAt,
    },
  };
}

function transactionCard(
  household: Household,
  chapterId: ChapterId,
  transaction: Transaction | undefined,
  scope: EvidenceScope,
): Projection {
  if (!transaction) return EMPTY;
  const receipt = household.commandReceipts.find((candidate) => candidate.postedIds.includes(transaction.id));
  if (!receipt) return { ...EMPTY, ineligible: "untied" };
  const result: EvidenceCard = {
    chapterId,
    scope,
    kind: "transaction",
    sourceIds: [receipt.confirmationId, transaction.id],
    lines: [
      { label: "Entry", value: transaction.note || transaction.type },
      { label: "Date", value: transaction.date },
      { label: "Amount", value: formatCad(transaction.amountCents) },
    ],
    observedAt: receipt.acceptedAt,
  };
  return scope === "household"
    ? { household: result, personal: null }
    : { household: null, personal: result };
}

function readyEvidence(household: Household, chapterId: ChapterId, viewerMemberId: string): Projection {
  const candidates = household.transactions
    .filter((transaction) => !transaction.isDuplicate && transaction.source !== "reversal" && transaction.type !== "opening")
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || right.id.localeCompare(left.id));
  const shared = candidates.find((transaction) => transaction.visibility !== "personal");
  if (shared) return transactionCard(household, chapterId, shared, "household");
  const own = candidates.find((transaction) => (
    transaction.visibility === "personal" && transaction.createdBy === viewerMemberId
  ));
  return transactionCard(household, chapterId, own, "self-personal");
}

function project(
  household: Household,
  chapterId: ChapterId,
  viewerMemberId: string,
  context?: EvidenceContext,
): Projection {
  switch (chapterId) {
    case "ch-01-meet": return meetEvidence(household, chapterId);
    case "ch-02-household": return householdEvidence(household, chapterId, viewerMemberId, context?.householdScope);
    case "ch-03-charter": return charterEvidence(household, chapterId);
    case "ch-04-accounts": return accountsEvidence(household, chapterId, viewerMemberId);
    case "ch-05-opening": return openingEvidence(household, chapterId);
    case "ch-06-fund": return fundEvidence(household, chapterId);
    case "ch-07-recurrences": return recurrenceEvidence(household, chapterId);
    case "ch-08-cadence": return cadenceEvidence(household, chapterId, viewerMemberId);
    case "ch-09-categories":
    case "ch-10-estimates": return EMPTY;
    case "ch-11-plan": return planEvidence(household, chapterId);
    case "ch-12-ready": return readyEvidence(household, chapterId, viewerMemberId);
    default: return { ...EMPTY, ineligible: "malformed" };
  }
}

function resolveEvidence(
  household: Household,
  chapterId: ChapterId,
  viewerMemberId: string,
  witnessOnly: boolean,
  context?: EvidenceContext,
): EvidenceResult {
  if (!chapterById(chapterId)) return { kind: "ineligible", reason: "malformed" };
  if (!household.members.some((member) => member.active && member.id === viewerMemberId)) {
    return { kind: "ineligible", reason: "privacy" };
  }
  if (household.conflicts.some((conflict) => !conflict.resolved)) {
    return { kind: "ineligible", reason: "conflicted" };
  }
  const projection = project(household, chapterId, viewerMemberId, context);
  if (projection.ineligible) return { kind: "ineligible", reason: projection.ineligible };
  // Chapter 4 is a household gate. A viewer's own Personal accounts remain
  // separately projectable below, but they can never satisfy this resolver.
  const card = chapterId === "ch-04-accounts"
    ? projection.household
    : witnessOnly ? projection.household : projection.household ?? projection.personal;
  return cardResult(card);
}

export function evidenceFor(
  household: Household,
  chapterId: ChapterId,
  viewerMemberId: string,
  context?: EvidenceContext,
): EvidenceResult {
  return resolveEvidence(household, chapterId, viewerMemberId, false, context);
}

export function witnessEvidenceFor(
  household: Household,
  chapterId: ChapterId,
  viewerMemberId: string,
  context?: EvidenceContext,
): EvidenceResult {
  return resolveEvidence(household, chapterId, viewerMemberId, true, context);
}

/** Owner-only optional Chapter 4 evidence. It is never a household completion signal. */
export function selfPersonalAccountsEvidenceFor(
  household: Household,
  viewerMemberId: string,
): EvidenceResult {
  if (!household.members.some((member) => member.active && member.id === viewerMemberId)) {
    return { kind: "ineligible", reason: "privacy" };
  }
  if (household.conflicts.some((conflict) => !conflict.resolved)) {
    return { kind: "ineligible", reason: "conflicted" };
  }
  const projection = accountsEvidence(household, "ch-04-accounts", viewerMemberId);
  return cardResult(projection.personal);
}

export function probeEvidenceKey(card: EvidenceCard): string {
  return `${card.chapterId}:${[...card.sourceIds].sort().join("|")}:${card.observedAt}`;
}
