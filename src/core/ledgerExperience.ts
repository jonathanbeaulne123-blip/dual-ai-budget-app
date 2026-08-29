import { COMPANION, JOINT, ValidationError, type Household, type LedgerView, type Transaction } from "./types.ts";
import type { DateKey } from "./calendar.ts";
import { ledgerNameForView } from "./ledgerNames.ts";
import {
  householdForHerculesContext,
  householdForShiftReadTools,
  householdForView,
  parseVisibility,
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

export type KitchenPrimaryNavId = "home" | "calendar" | "shift" | "ledger" | "plan" | "more";

/** Shared Home owns the kitchen table; Shift and Books stay on Personal primary nav. Household table stays a deep page from More. */
export function kitchenPrimaryNav(view: LedgerView): KitchenPrimaryNavId[] {
  if (view === "household") return ["home", "calendar", "plan", "more"];
  return ["home", "calendar", "shift", "ledger", "plan", "more"];
}

/** Home, Calendar, Shift, and Books already carry their own heading. Do not stack a second purpose card. */
export function showsLedgerPurposeBanner(tab: LedgerTab): boolean {
  return tab === "plan" || tab === "more";
}

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
      heading: shared ? "Household table" : "My books",
      purpose: shared
        ? "Fund, household cash, and cards. Net worth, trial, and statements stay in Audit — not the shared table opening."
        : "My books: this member’s listed Personal accounts. The opening figure is accepted-books position, not a partner-hidden envelope.",
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

function unionById<T extends { id: string }>(primary: T[], fallback: T[]): T[] {
  const ids = new Set(primary.map((row) => row.id));
  return [...primary, ...fallback.filter((row) => !ids.has(row.id))];
}

function transactionCompilesAgainstAccounts(tx: Transaction, accountIds: Set<string>): boolean {
  if (!accountIds.has(tx.accountId)) return false;
  if (tx.type === "transfer") {
    if (tx.transferFromAccountId && !accountIds.has(tx.transferFromAccountId)) return false;
    if (tx.transferToAccountId && !accountIds.has(tx.transferToAccountId)) return false;
  }
  return true;
}

/**
 * Presentation clones may drop Personal accounts, partner rows, or both-visibility
 * posts that still live on the accepted snapshot. Writers must never persist that
 * subset. Restore missing identity rows onto `next` while keeping `next`'s mutations.
 */
export function restoreAcceptedSnapshot(accepted: Household, next: Household): Household {
  if (next.householdId !== accepted.householdId || next.environment !== accepted.environment) {
    return next;
  }
  const nextAccountIds = new Set(next.accounts.map((row) => row.id));
  const nextTxIds = new Set(next.transactions.map((row) => row.id));
  const nextGoalIds = new Set(next.goals.map((row) => row.id));
  const missingAccounts = accepted.accounts.some((row) => !nextAccountIds.has(row.id));
  const missingTx = accepted.transactions.some((row) => !nextTxIds.has(row.id));
  const missingGoals = accepted.goals.some((row) => !nextGoalIds.has(row.id));
  if (!missingAccounts && !missingTx && !missingGoals) return next;
  const goals = unionById(next.goals, accepted.goals);
  const goalIds = new Set(goals.map((goal) => goal.id));
  return {
    ...next,
    accounts: unionById(next.accounts, accepted.accounts),
    transactions: unionById(next.transactions, accepted.transactions),
    shifts: unionById(next.shifts, accepted.shifts),
    goals,
    goalContributions: unionById(next.goalContributions ?? [], accepted.goalContributions ?? [])
      .filter((row) => goalIds.has(row.goalId)),
    goalPurchases: unionById(next.goalPurchases ?? [], accepted.goalPurchases ?? [])
      .filter((row) => goalIds.has(row.goalId)),
    recurrences: unionById(next.recurrences ?? [], accepted.recurrences ?? []),
    appointments: unionById(next.appointments ?? [], accepted.appointments ?? []),
    claims: unionById(next.claims ?? [], accepted.claims ?? []),
    fundEvents: unionById(next.fundEvents ?? [], accepted.fundEvents ?? []),
    sevenShiftsSchedules: unionById(next.sevenShiftsSchedules ?? [], accepted.sevenShiftsSchedules ?? []),
    fundPrivate: {
      bankBindings: unionById(next.fundPrivate?.bankBindings ?? [], accepted.fundPrivate?.bankBindings ?? []),
      reconciliations: unionById(next.fundPrivate?.reconciliations ?? [], accepted.fundPrivate?.reconciliations ?? []),
    },
  };
}

/**
 * Books presentation floor. Shared receives household/both books. Personal adds
 * this member's rooms while excluding every partner-personal account and row.
 * The accepted snapshot remains the write authority; this clone is read/export
 * input only.
 */
export function booksPresentationFloor(
  household: Household,
  memberId: string,
  view: LedgerView,
): Household {
  const contextual = householdForHerculesContext(household, memberId, view);
  const accounts = household.accounts.filter((account) => view === "household"
    ? account.scope !== "personal"
    : account.scope !== "personal" || account.ownerMemberId === memberId);
  const accountIds = new Set(accounts.map((account) => account.id));
  const transactions = household.transactions.filter((tx) => {
    if (!transactionCompilesAgainstAccounts(tx, accountIds)) return false;
    if (parseVisibility(tx.visibility) === "personal") return view === "personal" && tx.createdBy === memberId;
    return view === "personal" || parseVisibility(tx.visibility) !== "personal";
  });
  const recurrences = (household.recurrences ?? []).filter((row) => accountIds.has(row.accountId));
  const goals = household.goals.filter((goal) => view === "household"
    ? goal.shared
    : goal.shared || goal.ownerMemberId === memberId);
  const goalIds = new Set(goals.map((goal) => goal.id));
  const appointmentIds = new Set(contextual.appointments.map((item) => item.id));
  const transactionIds = new Set(transactions.map((item) => item.id));
  const claims = (household.claims ?? []).filter((claim) => claim.appointmentId
    ? appointmentIds.has(claim.appointmentId)
    : transactionIds.has(claim.expenseTransactionId));
  const custodian = view === "personal" && household.householdFund?.custodianMemberId === memberId;
  return {
    ...contextual,
    accounts,
    transactions,
    recurrences,
    presets: (household.presets ?? []).filter((preset) => (
      accountIds.has(preset.accountId) && parseVisibility(preset.visibility) !== "personal"
    )),
    goals,
    claims,
    goalContributions: (household.goalContributions ?? []).filter((row) => goalIds.has(row.goalId)),
    kitchen: {
      ...contextual.kitchen,
      books: {
        ...contextual.kitchen.books,
        reconciliations: (household.kitchen.books?.reconciliations ?? [])
          .filter((row) => accountIds.has(row.accountId)),
      },
    },
    ledgerNames: {
      ...contextual.ledgerNames,
      personal: view === "personal"
        ? Object.fromEntries(Object.entries(contextual.ledgerNames.personal).filter(([id]) => id === memberId))
        : {},
    },
    google: {
      ...contextual.google,
      links: (contextual.google.links ?? []).filter((row) => row.memberId === memberId),
    },
    activity: [],
    devices: [],
    sitDownSessions: [],
    tombstones: [],
    commandReceipts: [],
    conflicts: [],
    fundPrivate: custodian
      ? household.fundPrivate
      : { bankBindings: [], reconciliations: [] },
  };
}

/** Personal Books includes household-visible rooms plus this member's rooms. */
export function personalBooksFloor(household: Household, memberId: string): Household {
  return booksPresentationFloor(household, memberId, "personal");
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
  const transactions = scoped.transactions.filter((tx) => transactionCompilesAgainstAccounts(tx, accountIds));
  const transactionIds = new Set(transactions.map((item) => item.id));
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
    transactions,
  };
}

function sanitizeKitchen(household: Household, memberId: string): Household["kitchen"] {
  const hercules = household.kitchen.hercules;
  if (!hercules) return household.kitchen;
  return {
    ...household.kitchen,
    hercules: {
      ...hercules,
      chats: [],
      memories: (hercules.memories ?? []).filter((row) => row.createdBy === memberId),
    },
  };
}

function sanitizeExport(household: Household, memberId: string, view: LedgerView): Household {
  const scoped = applyPresentationScope(household, memberId, view);
  if (view === "household") {
    const shared = splitForSync(household, memberId).shared;
    const assembled = assembleHousehold(shared, null, { linked: household.linked });
    const cleaned = applyPresentationScope(assembled, memberId, "household");
    return { ...cleaned, kitchen: sanitizeKitchen(cleaned, memberId) };
  }
  return {
    ...scoped,
    kitchen: sanitizeKitchen(scoped, memberId),
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
