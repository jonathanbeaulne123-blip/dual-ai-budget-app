import { COMPANION, JOINT, type Goal, type Household, type LedgerView, type Shift, type Transaction, type Visibility } from "./types.ts";

export const VISIBILITIES: Visibility[] = ["household", "personal", "both"];

function shiftForHercules(shift: Shift): Shift {
  const {
    sevenShiftsPunchDigest: _sevenShiftsPunchDigest,
    sevenShiftsEvidenceBundle: _sevenShiftsEvidenceBundle,
    shiftBible: _shiftBible,
    ...safe
  } = shift;
  return safe;
}

function shiftForConfirmedToolFacts(shift: Shift): Shift {
  const { sevenShiftsPunchDigest: _digest, sevenShiftsEvidenceBundle: _evidence, ...safe } = shift;
  return safe;
}

export function parseVisibility(value: unknown): Visibility {
  if (value === "household" || value === "personal" || value === "both") return value;
  return "household";
}

export function visibilityLabel(visibility: Visibility): string {
  if (visibility === "personal") return "Personal";
  if (visibility === "both") return "Both";
  return "Shared";
}

export function isVisibleInView(
  item: { visibility?: Visibility; createdBy?: string },
  memberId: string,
  view: LedgerView,
): boolean {
  const visibility = parseVisibility(item.visibility);
  if (view === "household") return visibility === "household" || visibility === "both";
  return item.createdBy === memberId && (visibility === "personal" || visibility === "both");
}

export function visibleForDuplicateScan(
  item: { visibility?: Visibility; createdBy?: string },
  memberId: string,
): boolean {
  return parseVisibility(item.visibility) !== "personal" || item.createdBy === memberId;
}

function activitySafeForMember(household: Household, memberId: string) {
  const partnerPrivateTokens = [
    ...household.transactions.filter((row) => row.visibility === "personal" && row.createdBy !== memberId).map((row) => row.id),
    ...household.accounts.filter((row) => row.scope === "personal" && row.ownerMemberId !== memberId).flatMap((row) => [row.id, row.name]),
    ...household.goals.filter((row) => !row.shared && row.ownerMemberId !== memberId).flatMap((row) => [row.id, row.name]),
    ...(household.sevenShiftsSchedules ?? []).filter((row) => row.memberId !== memberId).flatMap((row) => [row.id, row.provenanceId]),
    ...(household.shiftEnvelopes ?? []).filter((row) => row.memberId !== memberId).flatMap((row) => [row.id, row.canonicalShiftKey]),
    ...(household.shiftBibles ?? []).filter((row) => row.memberId !== memberId).map((row) => row.id),
    ...(household.fundPrivate?.bankBindings ?? []).filter((row) => row.memberId !== memberId).map((row) => row.id),
    ...(household.fundPrivate?.reconciliations ?? []).filter((row) => row.memberId !== memberId).map((row) => row.id),
  ].filter((token) => token.length >= 4);
  return (household.activity ?? []).filter((row) => !partnerPrivateTokens.some((token) => row.summary.includes(token)));
}

/**
 * Member-scoped household for Hercules model payloads (D-115 / D-126 Q6).
 * Partner `personal` money, goals, and kitchen memories never enter aggregates,
 * notices, or the ledger excerpt. Shared accounts, appointments, and Health
 * still run on the full snapshot outside this projection.
 * Coordinates are stripped unless `shareCoordsWithModel` is true (member opt-in).
 */
export function householdForAiDisclosure(
  household: Household,
  memberId: string,
  options: { shareCoordsWithModel?: boolean; view?: LedgerView } = {},
): Household {
  const contextual = householdForHerculesContext(household, memberId, options.view ?? "household");
  const keepCoords = Boolean(options.shareCoordsWithModel);
  const transactions = contextual.transactions
    .map((tx) => {
      if (keepCoords || !tx.location) return tx;
      const { location: _coords, ...rest } = tx;
      return rest;
    });
  const shifts = contextual.shifts.map(shiftForHercules);
  const goals = contextual.goals;
  const desk = contextual.kitchen.hercules;
  const hercules = desk
    ? {
        ...desk,
        memories: desk.memories.filter((row) => row.createdBy === memberId),
        // Chat history never goes to the model; keep the array empty in the projection.
        chats: [] as typeof desk.chats,
      }
    : desk;
  return {
    ...contextual,
    coworkers: [],
    coworkerAttendance: [],
    coworkerSchedules: [],
    shiftEnvelopes: [],
    shiftBibles: [],
    transactions,
    shifts,
    goals,
    kitchen: {
      ...contextual.kitchen,
      hercules,
    },
  };
}

/**
 * Exact books scope used before Hercules answers a money question.
 * Household view means shared/both rows only. Personal view means only the
 * requesting member's personal/both rows. Partner-personal rows never cross
 * either boundary.
 */
export function householdForHerculesContext(
  household: Household,
  memberId: string,
  view: LedgerView,
): Household {
  const scoped = householdForView(household, memberId, view);
  // Old local Development snapshots can predate these collections. Shape the
  // read-only projection defensively so Hercules never crashes while the normal
  // household upgrader catches the snapshot up.
  const allAppointments = household.appointments ?? [];
  const allClaims = household.claims ?? [];
  const appointments = view === "household"
    ? allAppointments.filter((item) => item.sensitivity === "household")
    : allAppointments.filter((item) => item.memberId === memberId || item.memberId === JOINT || item.memberId === COMPANION);
  const appointmentIds = new Set(appointments.map((item) => item.id));
  const transactionIds = new Set(scoped.transactions.map((item) => item.id));
  const claims = allClaims.filter((claim) => (
    claim.appointmentId
      ? appointmentIds.has(claim.appointmentId)
      : transactionIds.has(claim.expenseTransactionId)
  ));
  const hercules = household.kitchen.hercules
    ? {
        ...household.kitchen.hercules,
        memories: (household.kitchen.hercules.memories ?? []).filter((row) => row.createdBy === memberId),
        chats: (household.kitchen.hercules.chats ?? []).filter((row) => row.createdBy === memberId),
      }
    : household.kitchen.hercules;
  return {
    ...scoped,
    activity: activitySafeForMember(household, memberId),
    commandReceipts: [],
    conflicts: [],
    restorePoints: [],
    tombstones: [],
    devices: [],
    coworkers: [],
    coworkerAttendance: [],
    coworkerSchedules: [],
    shiftEnvelopes: [],
    shiftBibles: [],
    accounts: scoped.accounts.filter((account) => account.scope !== "personal"),
    fundPrivate: { bankBindings: [], reconciliations: [] },
    shifts: scoped.shifts.map(shiftForHercules),
    sevenShiftsSchedules: (household.sevenShiftsSchedules ?? [])
      .filter((row) => row.memberId === memberId)
      .map((row) => {
        const {
          id: _id,
          provenanceId: _provenanceId,
          sequence: _sequence,
          sourceUpdatedAt: _sourceUpdatedAt,
          notesPresent: _notesPresent,
          selfMatch: _selfMatch,
          createdAt: _createdAt,
          updatedAt: _updatedAt,
          ...reduced
        } = row;
        return reduced;
      }) as Household["sevenShiftsSchedules"],
    appointments,
    claims,
    kitchen: { ...household.kitchen, hercules },
  };
}

export type HerculesQuestionGate =
  | { allow: true }
  | { allow: false; reason: "partner-personal" | "wrong-ledger"; spoken: string };

/** Text classification only chooses the ledger boundary; it never extracts CAD. */
export function gateHerculesQuestion(
  household: Household,
  question: string,
  memberId: string,
  view: LedgerView,
): HerculesQuestionGate {
  const q = question.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9\s]/g, " ");
  if (view === "household" && /\b(my|personal|private)\s+(ledger|spend|spending|income|shift|tips|wages|balance)\b/.test(q)) {
    return {
      allow: false,
      reason: "wrong-ledger",
      spoken: "That belongs in your personal ledger. Switch there and ask me again; I won't mix it into the household books.",
    };
  }
  if (view === "personal") {
    const partnerNamed = (household.members ?? []).some((member) => {
      if (!member.active || member.id === memberId) return false;
      const names = member.name.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((name) => name.length >= 3);
      return names.some((name) => new RegExp(`\\b${name}\\b`).test(q));
    });
    if (partnerNamed) return {
      allow: false,
      reason: "partner-personal",
      spoken: "I can only read your personal ledger here. Ask about shared household rows in the household ledger.",
    };
  }
  return { allow: true };
}

export function goalVisibleInView(goal: Goal, memberId: string, view: LedgerView): boolean {
  if (view === "household") return goal.shared;
  return !goal.shared && goal.ownerMemberId === memberId;
}

export function householdForView(household: Household, memberId: string, view: LedgerView): Household {
  return {
    ...household,
    accounts: (household.accounts ?? []).filter((account) => (
      account.scope !== "personal" || (view === "personal" && account.ownerMemberId === memberId)
    )),
    transactions: (household.transactions ?? []).filter((tx) => isVisibleInView(tx, memberId, view)),
    shifts: (household.shifts ?? []).filter((shift) => isVisibleInView(shift, memberId, view)),
    goals: (household.goals ?? []).filter((goal) => goalVisibleInView(goal, memberId, view)),
    fundPrivate: view === "personal" && household.householdFund?.custodianMemberId === memberId
      ? household.fundPrivate
      : { bankBindings: [], reconciliations: [] },
  };
}

/**
 * Shift/oracle reads in Personal view still need the worker's own posted history even
 * when legacy rows were stamped household-only. Partner-personal rows never cross.
 */
export function householdForShiftReadTools(
  household: Household,
  memberId: string,
  view: LedgerView,
  memberQuery?: string,
): Household {
  const contextual = householdForHerculesContext(household, memberId, view);
  const needle = memberQuery?.trim().toLowerCase();
  if (needle && needle !== "me") {
    const self = household.members.find((member) => member.id === memberId);
    const selfName = self?.name.trim().toLowerCase() ?? "";
    if (selfName && !selfName.includes(needle) && needle !== selfName) return contextual;
  }
  const ownShiftIds = new Set(
    (household.shifts ?? [])
      .filter((shift) => shift.memberId === memberId)
      .map((shift) => shift.id),
  );
  if (!ownShiftIds.size) return contextual;
  const merged = new Map(contextual.shifts.map((shift) => [shift.id, shift]));
  for (const shift of household.shifts ?? []) {
    if (ownShiftIds.has(shift.id)) merged.set(shift.id, shiftForConfirmedToolFacts(shift));
  }
  return { ...contextual, shifts: [...merged.values()] };
}

export function defaultVisibilityForView(view: LedgerView): Visibility {
  return view === "personal" ? "personal" : "household";
}

export function stampActor<T extends { createdBy?: string; visibility?: Visibility; createdAt: string; updatedAt?: string }>(
  item: T,
  createdBy: string,
  visibility: Visibility,
): T & { createdBy: string; visibility: Visibility; updatedAt: string } {
  return {
    ...item,
    createdBy,
    visibility,
    updatedAt: item.updatedAt ?? item.createdAt,
  };
}

export function isPersonalOnly(item: { visibility?: Visibility }): boolean {
  return parseVisibility(item.visibility) === "personal";
}

export function belongsToSharedLedger(item: Transaction | Shift): boolean {
  return !isPersonalOnly(item);
}
