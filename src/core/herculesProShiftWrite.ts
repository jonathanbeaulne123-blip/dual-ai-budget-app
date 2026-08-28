import { commandIdentityHash, financialAuditHash, rememberReceipt } from "./commandIdentity.ts";
import { postWorkShift } from "./commands.ts";
import { assertAcceptableBooks } from "./commandRuntime.ts";
import { shapeSevenShiftsEvidenceBundle, type SevenShiftsEvidenceBundle } from "./evidence.ts";
import { herculesProSharedProjection } from "./herculesProWrite.ts";
import { formatCad } from "./money.ts";
import { buildAutomatedWorkShiftInput, sevenShiftsAutomationEligibility, type AutomationPolicy } from "./sevenShiftsAutomation.ts";
import { personalReplicaForMember } from "./sync.ts";
import {
  NeedsConfirmationError,
  ValidationError,
  type CommandReceipt,
  type Household,
  type LedgerView,
  type PersonalEnvelope,
  type Shift,
  type ShiftEventTag,
  type Transaction,
} from "./types.ts";

export type HerculesProShiftOverrides = {
  cashTipsCents?: number;
  cardTipsCents?: number;
  salesCents?: number;
  salesByFieldCents?: Record<string, number>;
  customersServed?: number;
  staffingCount?: number;
  eventTag?: ShiftEventTag;
  weatherGlass?: string;
};

export type HerculesProShiftPreview = {
  date: string;
  job: string;
  role: string;
  startedAt: string;
  endedAt: string;
  workedMinutes: number;
  paidBreakMinutes: number;
  grossWages: string;
  wagesRecognized: string;
  cashTips: string;
  cardTips: string;
  immediateTipOut: string;
  withheldTipOut: string;
  deferredTipOut: string;
  cardTipsAfterTipOut: string;
  totalRecognized: string;
  affectedLedgers: LedgerView[];
  warnings: string[];
  duplicateShiftIds: string[];
};

export type PreparedHerculesProShift = {
  candidate: Household;
  bundle: SevenShiftsEvidenceBundle;
  postedIds: string[];
  postedTransactions: Transaction[];
  postedShift: Shift;
  identityHash: string;
  publishView: LedgerView;
  requiresPersonalWrite: boolean;
  requiresHouseholdWrite: boolean;
  preview: HerculesProShiftPreview;
};

export type AcceptedHerculesProShift = PreparedHerculesProShift & {
  accepted: Household;
  sharedProjection: Household;
  personalProjection: PersonalEnvelope | null;
  receipt: CommandReceipt;
  snapshotHash: string;
};

const MAX_CENTS = 100_000_000;

function optionalInteger(value: unknown, label: string, min: number, max: number): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) throw new ValidationError(`${label} is invalid.`);
  return parsed;
}

function normalizeOverrides(value: unknown): HerculesProShiftOverrides {
  const row = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const eventTag = row.eventTag;
  const allowedEvents = ["regular", "holiday", "sports", "festival", "private_party", "short_staffed", "vacation_cover", "illness_cover", "other"];
  if (eventTag !== undefined && !allowedEvents.includes(String(eventTag))) throw new ValidationError("eventTag is invalid.");
  const weatherGlass = row.weatherGlass === undefined ? undefined : String(row.weatherGlass).trim();
  if (weatherGlass && weatherGlass.length > 80) throw new ValidationError("weatherGlass is too long.");
  const salesByFieldCents: Record<string, number> = {};
  if (row.salesByFieldCents !== undefined) {
    if (!row.salesByFieldCents || typeof row.salesByFieldCents !== "object" || Array.isArray(row.salesByFieldCents)) throw new ValidationError("salesByFieldCents is invalid.");
    for (const [fieldId, amount] of Object.entries(row.salesByFieldCents as Record<string, unknown>)) {
      if (!/^[A-Za-z0-9][A-Za-z0-9:_-]{0,99}$/.test(fieldId)) throw new ValidationError("A sales field id is invalid.");
      salesByFieldCents[fieldId] = optionalInteger(amount, `salesByFieldCents.${fieldId}`, 0, 1_000_000_000)!;
    }
  }
  return {
    cashTipsCents: optionalInteger(row.cashTipsCents, "cashTipsCents", 0, MAX_CENTS),
    cardTipsCents: optionalInteger(row.cardTipsCents, "cardTipsCents", 0, MAX_CENTS),
    salesCents: optionalInteger(row.salesCents, "salesCents", 0, 1_000_000_000),
    ...(Object.keys(salesByFieldCents).length ? { salesByFieldCents } : {}),
    customersServed: optionalInteger(row.customersServed, "customersServed", 0, 5_000),
    staffingCount: optionalInteger(row.staffingCount, "staffingCount", 1, 500),
    ...(eventTag !== undefined ? { eventTag: String(eventTag) as ShiftEventTag } : {}),
    ...(weatherGlass ? { weatherGlass } : {}),
  };
}

function explicitPolicy(bundle: SevenShiftsEvidenceBundle): AutomationPolicy {
  return {
    version: 1,
    environment: bundle.environment,
    householdId: bundle.householdId,
    memberId: bundle.memberId,
    jobId: bundle.jobId,
    enabled: true,
    stableWindowHours: 24,
    payrollWeekStarts: 0,
    correctionHorizonDays: 60,
    closedPeriodAction: "variance",
    updatedAt: new Date(0).toISOString(),
  };
}

function money(value: number | undefined): number | undefined {
  return value === undefined ? undefined : value / 100;
}

export async function prepareHerculesProShift(
  household: Household,
  memberId: string,
  rawBundle: SevenShiftsEvidenceBundle,
  rawOverrides: unknown,
): Promise<PreparedHerculesProShift> {
  const bundle = shapeSevenShiftsEvidenceBundle(rawBundle);
  if (bundle.memberId !== memberId || bundle.householdId !== household.householdId || bundle.environment !== household.environment) {
    throw new ValidationError("This worked evidence belongs to a different Hearth member or household.");
  }
  const authority = bundle.evidence.find((row) => row.evidenceId === bundle.authority.workedMinutesEvidenceId);
  if (!authority || authority.sourceKind === "email" || authority.sourceKind === "calendar-sync" || authority.sourceKind === "selected-ics" || authority.finality === "outlook") {
    throw new ValidationError("Schedules and notification email cannot establish worked time or money.");
  }
  const eligibility = sevenShiftsAutomationEligibility(bundle, explicitPolicy(bundle));
  if (!eligibility.eligible) throw new ValidationError(`Worked evidence is not eligible: ${eligibility.reason}`);
  const overrides = normalizeOverrides(rawOverrides);
  const base = buildAutomatedWorkShiftInput(bundle, explicitPolicy(bundle), memberId);
  const input = {
    ...base,
    ...(overrides.cashTipsCents !== undefined ? { cashTips: money(overrides.cashTipsCents) } : {}),
    ...(overrides.cardTipsCents !== undefined ? { cardTips: money(overrides.cardTipsCents) } : {}),
    ...(overrides.salesCents !== undefined ? { sales: money(overrides.salesCents) } : {}),
    ...(overrides.salesByFieldCents ? { salesByField: Object.fromEntries(Object.entries(overrides.salesByFieldCents).map(([fieldId, cents]) => [fieldId, cents / 100])) } : {}),
    ...(overrides.customersServed !== undefined ? { customersServed: overrides.customersServed } : {}),
    ...(overrides.staffingCount !== undefined ? { staffingCount: overrides.staffingCount } : {}),
    ...(overrides.eventTag ? { eventTag: overrides.eventTag } : {}),
    ...(overrides.weatherGlass ? { weatherGlass: overrides.weatherGlass } : {}),
    createdBy: memberId,
  };
  let duplicateShiftIds: string[] = [];
  let result;
  try {
    result = postWorkShift(household, input);
  } catch (error) {
    if (!(error instanceof NeedsConfirmationError) || error.code !== "sameShiftDay") throw error;
    duplicateShiftIds = error.matches.map((row) => row.sourceId).filter((value): value is string => typeof value === "string" && value.length > 0);
    result = postWorkShift(household, { ...input, confirmDuplicate: true });
  }
  const posted = new Set(result.postedIds);
  const postedShift = result.household.shifts.find((row) => posted.has(row.id));
  if (!postedShift) throw new ValidationError("Hearth did not create the reviewed shift candidate.");
  const postedTransactions = result.household.transactions.filter((row) => posted.has(row.id));
  const requiresPersonalWrite = postedShift.visibility === "personal" || postedTransactions.some((row) => row.visibility === "personal");
  const requiresHouseholdWrite = postedShift.visibility === "household" || postedTransactions.some((row) => row.visibility === "household");
  const publishView: LedgerView = requiresPersonalWrite ? "personal" : "household";
  const job = household.workJobs.find((row) => row.id === postedShift.jobId)!;
  const role = job.roles.find((row) => row.id === postedShift.roleId)!;
  const totalRecognized = postedTransactions.filter((row) => row.type === "income").reduce((sum, row) => sum + row.amountCents, 0);
  return {
    candidate: result.household,
    bundle,
    postedIds: result.postedIds,
    postedTransactions,
    postedShift,
    identityHash: await commandIdentityHash(household, result.household, result.postedIds),
    publishView,
    requiresPersonalWrite,
    requiresHouseholdWrite,
    preview: {
      date: postedShift.date,
      job: job.name,
      role: role.name,
      startedAt: postedShift.startedAt!,
      endedAt: postedShift.endedAt!,
      workedMinutes: Math.round(postedShift.hours * 60),
      paidBreakMinutes: Math.round((postedShift.paidBreakHours ?? 0) * 60),
      grossWages: formatCad(postedShift.grossWagesCents ?? 0),
      wagesRecognized: formatCad(postedShift.wagesCents),
      cashTips: formatCad(postedShift.cashTipsCents),
      cardTips: formatCad(postedShift.ccTipsCents),
      immediateTipOut: formatCad(postedShift.immediateTipOutCents ?? 0),
      withheldTipOut: formatCad(postedShift.withheldTipOutCents ?? 0),
      deferredTipOut: formatCad(postedShift.deferredTipOutCents ?? 0),
      cardTipsAfterTipOut: formatCad(postedShift.cardTipsAfterTipOutCents ?? 0),
      totalRecognized: formatCad(totalRecognized),
      affectedLedgers: [requiresPersonalWrite ? "personal" : null, requiresHouseholdWrite ? "household" : null].filter(Boolean) as LedgerView[],
      warnings: [...result.warnings],
      duplicateShiftIds,
    },
  };
}

export async function acceptPreparedHerculesProShift(
  previous: Household,
  prepared: PreparedHerculesProShift,
  memberId: string,
  confirmationId: string,
  acceptedAt = new Date().toISOString(),
): Promise<AcceptedHerculesProShift> {
  const revision = previous.revision + 1;
  const receipt: CommandReceipt = {
    confirmationId,
    identityHash: prepared.identityHash,
    auditHash: "",
    commandKind: "hercules-pro-shift",
    postedIds: prepared.postedIds,
    revision,
    acceptedAt,
  };
  const acceptedCandidate = prepared.requiresHouseholdWrite
    ? prepared.candidate
    : { ...prepared.candidate, activity: previous.activity };
  let accepted = rememberReceipt({
    ...acceptedCandidate,
    revision,
    baseRevision: previous.revision,
    lastCommittedAt: prepared.candidate.lastCommittedAt ?? acceptedAt,
  }, receipt);
  assertAcceptableBooks(accepted);
  accepted.booksAcceptedHash = await financialAuditHash(accepted);
  accepted = rememberReceipt(accepted, { ...receipt, auditHash: accepted.booksAcceptedHash });
  const finalReceipt = accepted.commandReceipts.find((row) => row.confirmationId === confirmationId)!;
  const sharedProjection = herculesProSharedProjection(accepted, memberId);
  return {
    ...prepared,
    accepted,
    sharedProjection,
    personalProjection: prepared.requiresPersonalWrite ? personalReplicaForMember(accepted, memberId) : null,
    receipt: finalReceipt,
    snapshotHash: await financialAuditHash(sharedProjection),
  };
}
