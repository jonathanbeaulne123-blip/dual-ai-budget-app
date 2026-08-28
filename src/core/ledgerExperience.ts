import { COMPANION, JOINT, ValidationError, type Household, type LedgerView } from "./types.ts";
import type { DateKey } from "./calendar.ts";
import { ledgerNameForView } from "./ledgerNames.ts";
import {
  householdForHerculesContext,
  householdForShiftReadTools,
  householdForView,
} from "./visibility.ts";
import { assembleHousehold, splitForSync } from "./sync.ts";
import { runHealthCheck, type Finding } from "./health.ts";

export const LEDGER_CUSTODY_DISCLOSURE =
  "The money remains in Bianca’s savings. Hearth cannot move it.";

export type LedgerExperienceMode = LedgerView;
export type LedgerTab = "home" | "plan" | "calendar" | "shift" | "ledger" | "more";

export type LedgerRouteContract = {
  tab: LedgerTab;
  view: LedgerView;
  heading: string;
  purpose: string;
  projector: "shared" | "personal" | "member-specific";
  memberSpecific: boolean;
  commandsExposed: string[];
};

export type LedgerExperienceCapabilities = {
  canProposeContribution: boolean;
  canConfirmFund: boolean;
  canSeePrivateFundRecon: boolean;
};

export type LedgerExperience = {
  ok: true;
  mode: LedgerView;
  memberId: string;
  today: DateKey;
  label: string;
  heading: string;
  purpose: string;
  privacyDisclosure: string;
  custodyDisclosure: string | null;
  scopedHousehold: Household;
  booksHousehold: Household;
  herculesHousehold: Household;
  exportHousehold: Household;
  shiftHousehold: Household;
  integrityFindings: Finding[];
  integrityLabel: string;
  capabilities: LedgerExperienceCapabilities;
};

export type LedgerExperienceFailure = {
  ok: false;
  reason: "missing-member";
  spoken: string;
};

const SHARED_PURPOSE = "Coordinate the household: what is true together, what changed, what needs a person, what is next, and why this view is trustworthy.";
const PERSONAL_PURPOSE = "Understand and manage my private position: what is mine, what moved, my obligations and goals, what I chose to share, and what stays private.";

export function ledgerRouteContract(tab: LedgerTab, view: LedgerView): LedgerRouteContract {
  const shared = view === "household";
  if (tab === "home") {
    return {
      tab,
      view,
      heading: shared ? "Shared ledger" : "Personal ledger",
      purpose: shared ? SHARED_PURPOSE : PERSONAL_PURPOSE,
      projector: shared ? "shared" : "personal",
      memberSpecific: false,
      commandsExposed: ["postEntry", "postTransfer"],
    };
  }
  if (tab === "ledger") {
    return {
      tab,
      view,
      heading: shared ? "Household story" : "My books",
      purpose: shared
        ? "Shared books: household accounts, the Fund story, and statements for this ledger."
        : "My books: this member’s Personal accounts and activity. Partner Personal rows stay out.",
      projector: shared ? "shared" : "personal",
      memberSpecific: false,
      commandsExposed: ["recordReconciliation", "closeBooksMonth"],
    };
  }
  if (tab === "plan") {
    return {
      tab,
      view,
      heading: shared ? "Household plan" : "My plan",
      purpose: shared
        ? "Household target, funded commitments, buffer, and month close."
        : "Private goals, private budget, and my contribution decision.",
      projector: shared ? "shared" : "personal",
      memberSpecific: false,
      commandsExposed: ["applySitDown", "addGoal"],
    };
  }
  if (tab === "calendar") {
    return {
      tab,
      view,
      heading: shared ? "Household calendar" : "My calendar",
      purpose: shared
        ? "Shared and both bills, settlements, household appointments, and Fund-backed commitments. Reminders never post."
        : "My Personal and both dates. Inherently shared household dates stay labeled as shared. Reminders never post.",
      projector: shared ? "shared" : "personal",
      memberSpecific: false,
      commandsExposed: [],
    };
  }
  if (tab === "shift") {
    return {
      tab,
      view,
      heading: "Shift room",
      purpose: shared
        ? "This room is worker-centered, not a general Shared ledger page. Shared mode shows only shared or both posted shift outcomes. Open Personal Shift for the worker’s detailed work story."
        : "This room is worker-centered. Personal mode shows this worker’s own work story. Partner-personal work rows stay out.",
      projector: "member-specific",
      memberSpecific: true,
      commandsExposed: ["postWorkShift"],
    };
  }
  return {
    tab: "more",
    view,
    heading: shared ? "Household controls" : "My privacy and session",
    purpose: shared
      ? "Household membership, shared sync and restore, and books integrity for the full accepted snapshot."
      : "Account, session, consent, and member-scoped history. Dangerous controls still use Confirm.",
    projector: shared ? "shared" : "personal",
    memberSpecific: false,
    commandsExposed: [],
  };
}

function memberName(household: Household, memberId: string): string {
  return household.members.find((member) => member.id === memberId)?.name ?? "This member";
}

function applyPresentationScope(household: Household, memberId: string, view: LedgerView): Household {
  const scoped = householdForView(household, memberId, view);
  const accounts = view === "personal"
    ? scoped.accounts.filter((account) => account.scope === "personal" && account.ownerMemberId === memberId)
    : scoped.accounts.filter((account) => account.scope !== "personal");
  const accountIds = new Set(accounts.map((account) => account.id));
  const recurrences = (household.recurrences ?? []).filter((row) => {
    const account = household.accounts.find((item) => item.id === row.accountId);
    if (view === "household") return account?.scope !== "personal";
    if (account?.scope === "personal") return account.ownerMemberId === memberId;
    return true;
  });
  const appointments = (household.appointments ?? []).filter((item) => {
    if (view === "household") return item.sensitivity === "household";
    return item.memberId === memberId || item.memberId === JOINT || item.memberId === COMPANION;
  });
  const appointmentIds = new Set(appointments.map((item) => item.id));
  const transactionIds = new Set(scoped.transactions.map((item) => item.id));
  const claims = (household.claims ?? []).filter((claim) => (
    claim.appointmentId
      ? appointmentIds.has(claim.appointmentId)
      : transactionIds.has(claim.expenseTransactionId)
  ));
  return {
    ...scoped,
    accounts,
    recurrences,
    appointments,
    claims,
    transactions: scoped.transactions.filter((tx) => (
      view === "personal" || accountIds.has(tx.accountId) || !household.accounts.some((account) => account.id === tx.accountId && account.scope === "personal")
    )),
  };
}

function sanitizeExport(household: Household, memberId: string, view: LedgerView): Household {
  const scoped = applyPresentationScope(household, memberId, view);
  if (view === "household") {
    const shared = splitForSync(household, memberId).shared;
    const assembled = assembleHousehold(shared, null, { linked: household.linked });
    return applyPresentationScope(assembled, memberId, "household");
  }
  return {
    ...scoped,
    fundPrivate: household.householdFund?.custodianMemberId === memberId
      ? scoped.fundPrivate
      : { bankBindings: [], reconciliations: [] },
  };
}

export function findingsSafeForView(
  findings: Finding[],
  household: Household,
  memberId: string,
  view: LedgerView,
): Finding[] {
  const hiddenAccounts = household.accounts.filter((account) => {
    if (account.scope !== "personal") return false;
    if (view === "personal") return account.ownerMemberId !== memberId;
    return true;
  });
  const tokens = hiddenAccounts.flatMap((account) => (
    [account.id, account.name, account.institution, account.last4].filter((value): value is string => Boolean(value))
  ));
  if (!tokens.length) return findings;
  return findings.map((finding) => {
    const leaks = tokens.some((token) => finding.message.includes(token) || finding.id === token);
    if (!leaks) return finding;
    return {
      section: "Personal envelope",
      message: view === "household"
        ? "A Personal account needs review. Open that member’s Personal ledger."
        : "A partner Personal account is not part of this folio.",
      id: finding.id,
    };
  });
}

export function projectLedgerExperience(
  household: Household,
  memberId: string,
  view: LedgerView,
  today: DateKey,
): LedgerExperience | LedgerExperienceFailure {
  const member = household.members.find((row) => row.id === memberId && row.active);
  if (!member) {
    return {
      ok: false,
      reason: "missing-member",
      spoken: "Choose who is using this ledger before opening Shared or Personal.",
    };
  }
  if (view !== "household" && view !== "personal") {
    throw new ValidationError("Ledger mode must be Shared or Personal.");
  }
  const home = ledgerRouteContract("home", view);
  const scopedHousehold = applyPresentationScope(household, memberId, view);
  const custodianId = household.householdFund?.custodianMemberId ?? null;
  const isCustodian = custodianId === memberId;
  return {
    ok: true,
    mode: view,
    memberId,
    today,
    label: ledgerNameForView(household, memberId, view),
    heading: home.heading,
    purpose: home.purpose,
    privacyDisclosure: view === "personal"
      ? `${memberName(household, memberId)}’s account metadata, institution, last four digits, totals, and private Fund reconciliation stay in this Personal envelope.`
      : "Shared ledger shows household and both facts only. Personal accounts, Personal rows, and private Fund reconciliation stay in each member’s Personal envelope.",
    custodyDisclosure: view === "household" ? LEDGER_CUSTODY_DISCLOSURE : null,
    scopedHousehold,
    booksHousehold: household,
    herculesHousehold: householdForHerculesContext(household, memberId, view),
    exportHousehold: sanitizeExport(household, memberId, view),
    shiftHousehold: view === "personal"
      ? {
          ...householdForView(household, memberId, "personal"),
          shifts: householdForShiftReadTools(household, memberId, "personal").shifts,
        }
      : applyPresentationScope(household, memberId, "household"),
    integrityFindings: findingsSafeForView(runHealthCheck(household), household, memberId, view),
    integrityLabel: "Books integrity (full household)",
    capabilities: {
      canProposeContribution: Boolean(household.householdFund),
      canConfirmFund: isCustodian,
      canSeePrivateFundRecon: isCustodian && view === "personal",
    },
  };
}
