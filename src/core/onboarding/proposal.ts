import {
  addDays,
  calendarDaysBetween,
  monthEndKey,
  monthStartKey,
  parseDateKey,
  parseMonthKey,
  type DateKey,
  type MonthKey,
} from "../calendar.ts";
import { houseRunRate, RUN_RATE_MIN_WEEKS } from "../houseRunRate.ts";
import { advanceCadence, projectCadence } from "../recurrence.ts";
import { ValidationError, type Household, type Recurrence } from "../types.ts";
import { onboardingCategoryState } from "./categories.ts";
import { onboardingRecurrenceProbe } from "./recurrences.ts";
import { currentSubmission } from "./submissions.ts";

export const PROPOSAL_FORMULA_VERSION = 1;

export type ProposalBasis = "both-estimates" | "single-estimate" | "recurrence-floor" | "run-rate-raised";

export type ProposalInput = {
  subcategoryId: string;
  label: string;
  estimatesCents: Array<{ memberId: string; amountCents: number | null }>;
  recurrenceFloorCents: number;
  runRate:
    | { eligible: false; reason: "insufficient-weeks" | "untied" | "absent" }
    | { eligible: true; monthlyCents: number; weeksWatched: number };
};

export type ProposalRow = ProposalInput & { proposedCents: number; basis: ProposalBasis };

export type ProposalSource = {
  categoryIds: string[];
  estimateSubmissions: Array<{
    memberId: string;
    submissionId: string | null;
    revision: number | null;
  }>;
};

export type BudgetProposal = {
  monthKey: MonthKey;
  formulaVersion: number;
  rows: ProposalRow[];
  totalCents: number;
  capacityCents: number | null;
  capacitySourceRevision: string | null;
  source: ProposalSource;
  sourceDigest: string;
};

const SHA256_WORDS = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
] as const;

function rotateRight(value: number, count: number): number {
  return (value >>> count) | (value << (32 - count));
}

/** Browser-safe synchronous SHA-256 for the synchronous public proposal contract. */
function proposalSha256(value: string): string {
  const source = new TextEncoder().encode(value);
  const byteLength = Math.ceil((source.length + 9) / 64) * 64;
  const bytes = new Uint8Array(byteLength);
  bytes.set(source);
  bytes[source.length] = 0x80;
  const bitLength = source.length * 8;
  const view = new DataView(bytes.buffer);
  view.setUint32(byteLength - 8, Math.floor(bitLength / 0x1_0000_0000));
  view.setUint32(byteLength - 4, bitLength >>> 0);

  const state = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const schedule = new Uint32Array(64);
  for (let offset = 0; offset < byteLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) schedule[index] = view.getUint32(offset + index * 4);
    for (let index = 16; index < 64; index += 1) {
      const before15 = schedule[index - 15]!;
      const before2 = schedule[index - 2]!;
      const small0 = rotateRight(before15, 7) ^ rotateRight(before15, 18) ^ (before15 >>> 3);
      const small1 = rotateRight(before2, 17) ^ rotateRight(before2, 19) ^ (before2 >>> 10);
      schedule[index] = (schedule[index - 16]! + small0 + schedule[index - 7]! + small1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = state;
    for (let index = 0; index < 64; index += 1) {
      const large1 = rotateRight(e!, 6) ^ rotateRight(e!, 11) ^ rotateRight(e!, 25);
      const choose = (e! & f!) ^ (~e! & g!);
      const first = (h! + large1 + choose + SHA256_WORDS[index]! + schedule[index]!) >>> 0;
      const large0 = rotateRight(a!, 2) ^ rotateRight(a!, 13) ^ rotateRight(a!, 22);
      const majority = (a! & b!) ^ (a! & c!) ^ (b! & c!);
      const second = (large0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d! + first) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (first + second) >>> 0;
    }
    state[0] = (state[0]! + a!) >>> 0;
    state[1] = (state[1]! + b!) >>> 0;
    state[2] = (state[2]! + c!) >>> 0;
    state[3] = (state[3]! + d!) >>> 0;
    state[4] = (state[4]! + e!) >>> 0;
    state[5] = (state[5]! + f!) >>> 0;
    state[6] = (state[6]! + g!) >>> 0;
    state[7] = (state[7]! + h!) >>> 0;
  }
  return [...state].map((word) => word.toString(16).padStart(8, "0")).join("");
}

function checkedCents(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new ValidationError(`${label} must be a non-negative whole-cent amount.`);
  }
  return value;
}

function addCents(left: number, right: number, label: string): number {
  const total = left + right;
  if (!Number.isSafeInteger(total) || total < 0) {
    throw new ValidationError(`${label} is too large.`);
  }
  return total;
}

function cleanSourceId(value: string, label: string): string {
  if (typeof value !== "string"
    || value.length === 0
    || !/\S/.test(value)
    || value !== value.replace(/^\s+|\s+$/g, "")) {
    throw new ValidationError(`${label} is missing.`);
  }
  return value;
}

function sortedUniqueIds(values: readonly string[], label: string): string[] {
  const ids = values.map((value) => cleanSourceId(value, label));
  const unique = [...new Set(ids)].sort((left, right) => left.localeCompare(right));
  if (unique.length !== ids.length) throw new ValidationError(`${label} contains a duplicate.`);
  return unique;
}

function recurringFloor(recurrences: readonly Recurrence[], subcategoryId: string, monthKey: MonthKey): number {
  const start = monthStartKey(monthKey);
  const end = monthEndKey(monthKey);
  let total = 0;
  for (const recurrence of recurrences) {
    if (recurrence.type !== "expense" || recurrence.subcategoryId !== subcategoryId) continue;
    let first = recurrence.nextDate;
    if (first < start && recurrence.cadence !== "monthly") {
      const days = calendarDaysBetween(first, start);
      const step = recurrence.cadence === "daily" ? 1 : recurrence.cadence === "weekly" ? 7 : 14;
      first = addDays(first, Math.ceil(days / step) * step);
    }
    for (let monthSteps = 0; first < start && monthSteps < 12_000; monthSteps += 1) {
      const next = advanceCadence(first, recurrence.cadence);
      if (next <= first) throw new ValidationError("Recurring obligation dates are invalid.");
      first = next;
    }
    if (first < start) throw new ValidationError("Recurring obligation date is too far from the proposal month.");
    let dates = projectCadence(first, recurrence.cadence, start, end);
    let occurrences = dates.length;
    while (dates.length === 24 && dates[23]! < end) {
      const next = advanceCadence(dates[23]!, recurrence.cadence);
      if (next <= dates[23]!) throw new ValidationError("Recurring obligation dates are invalid.");
      dates = projectCadence(next, recurrence.cadence, next, end);
      occurrences += dates.length;
    }
    const amount = checkedCents(recurrence.amountCents, "Recurring obligation");
    const rowTotal = amount * occurrences;
    if (!Number.isSafeInteger(rowTotal)) throw new ValidationError("Recurring obligations are too large.");
    total = addCents(total, rowTotal, "Recurring obligations");
  }
  return total;
}

type RunRateReading = ReturnType<typeof houseRunRate> | null;

function readRunRate(household: Household, today: DateKey): RunRateReading {
  try {
    return houseRunRate(household, today);
  } catch {
    return null;
  }
}

function categoryRunRate(
  reading: RunRateReading,
  subcategoryId: string,
): ProposalInput["runRate"] {
  if (!reading) return { eligible: false, reason: "untied" };
  if (!Number.isSafeInteger(reading.weeksWatched) || reading.weeksWatched < RUN_RATE_MIN_WEEKS) {
    return { eligible: false, reason: "insufficient-weeks" };
  }
  const matches = reading.byCategory.filter((row) => row.subcategoryId === subcategoryId);
  if (matches.length === 0) return { eligible: false, reason: "absent" };
  const row = matches[0]!;
  if (matches.length !== 1
    || !Number.isSafeInteger(row.monthlyCents)
    || row.monthlyCents < 0) {
    return { eligible: false, reason: "untied" };
  }
  return { eligible: true, monthlyCents: row.monthlyCents, weeksWatched: reading.weeksWatched };
}

function proposedRow(input: ProposalInput): ProposalRow {
  const estimates = input.estimatesCents
    .map((row) => row.amountCents)
    .filter((value): value is number => value !== null)
    .map((value) => checkedCents(value, "Estimate"));
  let proposedCents = 0;
  let basis: ProposalBasis = "recurrence-floor";
  if (estimates.length === 2) {
    const left = estimates[0]!;
    const right = estimates[1]!;
    proposedCents = Math.floor(left / 2)
      + Math.floor(right / 2)
      + ((left % 2) + (right % 2) >= 1 ? 1 : 0);
    basis = "both-estimates";
  } else if (estimates.length === 1) {
    proposedCents = estimates[0]!;
    basis = "single-estimate";
  }
  if (input.recurrenceFloorCents > proposedCents) {
    proposedCents = input.recurrenceFloorCents;
    basis = "recurrence-floor";
  }
  if (input.runRate.eligible && input.runRate.monthlyCents > proposedCents) {
    proposedCents = input.runRate.monthlyCents;
    basis = "run-rate-raised";
  }
  return { ...input, proposedCents, basis };
}

function normalizedSource(proposal: Omit<BudgetProposal, "sourceDigest">): ProposalSource {
  const rowIds = sortedUniqueIds(proposal.rows.map((row) => row.subcategoryId), "Proposal category id");
  const categoryIds = sortedUniqueIds(proposal.source.categoryIds, "Proposal source category id");
  if (JSON.stringify(categoryIds) !== JSON.stringify(rowIds)) {
    throw new ValidationError("Proposal source categories do not match its rows.");
  }
  const estimateSubmissions = proposal.source.estimateSubmissions
    .map((row) => {
      const memberId = cleanSourceId(row.memberId, "Proposal source member id");
      const submissionId = row.submissionId === null
        ? null
        : cleanSourceId(row.submissionId, "Proposal submission id");
      if ((submissionId === null) !== (row.revision === null)
        || (row.revision !== null && (!Number.isSafeInteger(row.revision) || row.revision < 1))) {
        throw new ValidationError("Proposal submission source is invalid.");
      }
      return { memberId, submissionId, revision: row.revision };
    })
    .sort((left, right) => left.memberId.localeCompare(right.memberId));
  if (new Set(estimateSubmissions.map((row) => row.memberId)).size !== estimateSubmissions.length) {
    throw new ValidationError("Proposal submission source contains a duplicate member.");
  }
  if (estimateSubmissions.length !== 2) {
    throw new ValidationError("Proposal source needs both household members.");
  }
  return { categoryIds, estimateSubmissions };
}

export function proposalDigest(proposal: Omit<BudgetProposal, "sourceDigest">): string {
  parseMonthKey(proposal.monthKey);
  if (proposal.formulaVersion !== PROPOSAL_FORMULA_VERSION) {
    throw new ValidationError("Proposal formula version is invalid.");
  }
  if (proposal.capacityCents !== null) checkedCents(proposal.capacityCents, "Capacity");
  if (proposal.capacitySourceRevision !== null) {
    cleanSourceId(proposal.capacitySourceRevision, "Capacity source revision");
  }
  if ((proposal.capacityCents === null) !== (proposal.capacitySourceRevision === null)) {
    throw new ValidationError("Capacity and its source revision must be accepted together.");
  }
  const source = normalizedSource(proposal);
  const sourceMemberIds = source.estimateSubmissions.map((row) => row.memberId);
  const rows = [...proposal.rows]
    .sort((left, right) => left.subcategoryId.localeCompare(right.subcategoryId))
    .map((row) => {
      cleanSourceId(row.subcategoryId, "Proposal category id");
      checkedCents(row.recurrenceFloorCents, "Recurring floor");
      checkedCents(row.proposedCents, "Proposed amount");
      const estimatesCents = [...row.estimatesCents]
        .map((estimate) => ({
          memberId: cleanSourceId(estimate.memberId, "Proposal estimate member id"),
          amountCents: estimate.amountCents === null
            ? null
            : checkedCents(estimate.amountCents, "Estimate"),
        }))
        .sort((left, right) => left.memberId.localeCompare(right.memberId));
      if (estimatesCents.length !== 2
        || new Set(estimatesCents.map((estimate) => estimate.memberId)).size !== 2
        || JSON.stringify(estimatesCents.map((estimate) => estimate.memberId)) !== JSON.stringify(sourceMemberIds)) {
        throw new ValidationError("Proposal estimates need both source members.");
      }
      if (estimatesCents.some((estimate, index) => (
        estimate.amountCents !== null && source.estimateSubmissions[index]!.submissionId === null
      ))) {
        throw new ValidationError("A proposal estimate needs an accepted submission source.");
      }
      const runRate = row.runRate.eligible
        ? {
            eligible: true as const,
            monthlyCents: checkedCents(row.runRate.monthlyCents, "Run-rate amount"),
            weeksWatched: row.runRate.weeksWatched,
          }
        : row.runRate.reason === "insufficient-weeks" || row.runRate.reason === "untied" || row.runRate.reason === "absent"
          ? { eligible: false as const, reason: row.runRate.reason }
          : null;
      if (!runRate) throw new ValidationError("Run-rate reason is invalid.");
      if (runRate.eligible
        && (!Number.isSafeInteger(runRate.weeksWatched) || runRate.weeksWatched < RUN_RATE_MIN_WEEKS)) {
        throw new ValidationError("Run-rate weeks are invalid.");
      }
      const expected = proposedRow({
        subcategoryId: row.subcategoryId,
        label: row.label,
        estimatesCents,
        recurrenceFloorCents: row.recurrenceFloorCents,
        runRate,
      });
      if (expected.proposedCents !== row.proposedCents || expected.basis !== row.basis) {
        throw new ValidationError("Proposal row does not match the frozen formula.");
      }
      return {
        subcategoryId: row.subcategoryId,
        recurrenceFloorCents: row.recurrenceFloorCents,
        runRate,
        proposedCents: row.proposedCents,
      };
    });
  const expectedTotal = rows.reduce((sum, row) => addCents(sum, row.proposedCents, "Proposal total"), 0);
  if (checkedCents(proposal.totalCents, "Proposal total") !== expectedTotal) {
    throw new ValidationError("Proposal total does not match its rows.");
  }
  return `proposal-v${proposal.formulaVersion}-${proposalSha256(JSON.stringify({
    monthKey: proposal.monthKey,
    formulaVersion: proposal.formulaVersion,
    source,
    rows,
    capacityCents: proposal.capacityCents,
    capacitySourceRevision: proposal.capacitySourceRevision,
  }))}`;
}

export function buildProposal(household: Household, monthKey: MonthKey, today: DateKey): BudgetProposal {
  parseMonthKey(monthKey);
  parseDateKey(today);
  const categoryState = onboardingCategoryState(household);
  if (categoryState.kind !== "complete") {
    throw new ValidationError("Finish the household category set before building its first plan.");
  }
  const memberIds = [...categoryState.currentMemberIds].sort((left, right) => left.localeCompare(right));
  if (memberIds.length !== 2) throw new ValidationError("The first plan needs two active household members.");
  const submissions = memberIds.map((memberId) => ({
    memberId,
    submission: currentSubmission(household, memberId, "estimates"),
  }));
  const source: ProposalSource = {
    categoryIds: [...categoryState.unionIds].sort((left, right) => left.localeCompare(right)),
    estimateSubmissions: submissions.map(({ memberId, submission }) => ({
      memberId,
      submissionId: submission?.id ?? null,
      revision: submission?.revision ?? null,
    })),
  };
  const recurrenceRows = onboardingRecurrenceProbe(household).rows;
  const runRate = readRunRate(household, today);
  const rows = source.categoryIds.map((subcategoryId) => {
    const category = household.categories.find((row) => row.id === subcategoryId
      && row.active
      && row.recordType === "category"
      && row.transactionType === "expense");
    if (!category) throw new ValidationError("The accepted category set is no longer valid.");
    const estimatesCents = submissions.map(({ memberId, submission }) => ({
      memberId,
      amountCents: submission?.categoryIds.includes(subcategoryId)
        ? submission.estimates.find((row) => row.subcategoryId === subcategoryId)?.amountCents ?? null
        : null,
    }));
    return proposedRow({
      subcategoryId,
      label: category.name,
      estimatesCents,
      recurrenceFloorCents: recurringFloor(recurrenceRows, subcategoryId, monthKey),
      runRate: categoryRunRate(runRate, subcategoryId),
    });
  });
  const totalCents = rows.reduce((sum, row) => addCents(sum, row.proposedCents, "Proposal total"), 0);
  const proposal = {
    monthKey,
    formulaVersion: PROPOSAL_FORMULA_VERSION,
    rows,
    totalCents,
    // No accepted household capacity fact exists yet. Absence stays explicit.
    capacityCents: null,
    capacitySourceRevision: null,
    source,
  } satisfies Omit<BudgetProposal, "sourceDigest">;
  return { ...proposal, sourceDigest: proposalDigest(proposal) };
}
