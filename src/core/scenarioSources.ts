import { accountRegister, compileHousehold } from "./journal.ts";
import { projectedCountable } from "./budget.ts";
import { isCashLikeKind } from "./accountKinds.ts";
import { sha256Hex } from "./commandIdentity.ts";
import { activeHouseholdFundEvents } from "./householdFund.ts";
import { prepareFundHorizon, type FundHorizon } from "./fundHorizon.ts";
import { reviewFundScenarioRequest, type ScenarioBasis, type ScenarioRefusal, type ScenarioScope } from "./fundScenario.ts";
import { workShiftIsReversed, workShiftTransactionIds } from "./work.ts";
import type { Household } from "./types.ts";

/** App must issue this marker only after accepted Shared + own Personal validation. */
export type ScenarioAcceptedSource = Readonly<{
  kind: "accepted";
  scope: ScenarioScope;
  acceptedRevision: number;
  acceptedStateId: string;
  ownBooks: "ready" | "unavailable";
}>;
export type RecordedScenarioCash = Readonly<{
  accountId: string;
  name: string;
  recordedCapacityCents: number;
  /** Fund contributions have no source-account attribution in the current books. */
  availableForFundCents: null;
  factsDigest: string;
}>;
export type ScenarioSourceReview =
  | Readonly<{ kind: "unavailable"; reasons: readonly ScenarioRefusal[] }>
  | Readonly<{
      kind: "source-review";
      basis: ScenarioBasis;
      horizon: FundHorizon;
      cashAccounts: readonly RecordedScenarioCash[];
      recordedNetCashCents: number;
      outstandingDeferredTipOutCents: number;
      /** Conservative member-wide cap after known deferred liabilities, not verified availability. */
      cashCapacityLimitCents: number;
      timingComplete: boolean;
      unattributedCommitments: true;
    }>;
const unavailable = (code: ScenarioRefusal["code"], message: string): ScenarioSourceReview => ({ kind: "unavailable", reasons: [{code, message}] });
const byId = <T extends {id: string}>(rows: readonly T[]) => [...rows].sort((a, b) => a.id.localeCompare(b.id));

/** Dedicated source digests include metadata which the accepted financial receipt does not cover. */
export async function reviewScenarioSources(household: Household, accepted: ScenarioAcceptedSource, asOf: string, through: string): Promise<ScenarioSourceReview> {
  // Copy before the first await: a changed caller object cannot produce a mixed-basis review.
  const h = structuredClone(household), marker = structuredClone(accepted);
  const initialBasis: ScenarioBasis = {scope: marker.scope, acceptedRevision: marker.acceptedRevision, acceptedStateId: marker.acceptedStateId, sharedFactsDigest: "pending-source-review", ownSourceFactsDigest: "pending-source-review", asOf, through};
  const identity = reviewFundScenarioRequest(h, initialBasis, {version: 1, basis: initialBasis, elections: []});
  if (identity.kind === "refused") return {kind: "unavailable", reasons: identity.reasons};
  if (marker.kind !== "accepted" || marker.ownBooks !== "ready") return unavailable("source-not-accepted", "Your accepted Personal books are not available for this scenario yet.");
  const horizon = prepareFundHorizon(h, asOf, through);
  if (horizon.kind === "unavailable") return horizon;
  const memberId = marker.scope.memberId;
  const accounts = byId(h.accounts.filter(account => account.active && account.ownerMemberId === memberId && isCashLikeKind(account.kind)
    && account.savings?.purpose !== "goals"));
  if (accounts.some(account => account.currency !== "CAD")) return unavailable("source-not-accepted", "Cash capacity needs accepted CAD account facts.");
  const ownAccountIds = new Set(accounts.map(account => account.id));
  const shifts = byId(h.shifts.filter(shift => shift.memberId === memberId));
  const transactionById = new Map(h.transactions.map(row => [row.id, row]));
  const ownShiftTransactionIds = new Set(shifts.flatMap(workShiftTransactionIds));
  const shiftReversals = h.transactions.filter(row => row.reversalOfId && ownShiftTransactionIds.has(row.reversalOfId));
  if (shiftReversals.some(row => row.date > asOf || !projectedCountable(row, transactionById)
    || h.transactions.some(next => next.reversalOfId === row.id))) return unavailable("source-remaining-unknown", "A shift correction has unsupported timing or recognition. Review it before using this cash capacity.");
  const liveShifts = shifts.filter(shift => !workShiftIsReversed(h, shift));
  const ownTransactions = byId(h.transactions.filter(row => row.createdBy === memberId || ownAccountIds.has(row.accountId)
    || (!!row.transferFromAccountId && ownAccountIds.has(row.transferFromAccountId)) || (!!row.transferToAccountId && ownAccountIds.has(row.transferToAccountId))));
  // Paid counters have no dated allocation back to each shift. Do not use a future
  // payment to release today's liability while its account debit is still in the future.
  if (liveShifts.some(shift => (shift.deferredTipOutPaidCents ?? 0) > 0)
    && ownTransactions.some(row => row.date > asOf && row.type === "expense")) return unavailable("source-remaining-unknown", "A future payment needs a dated tip-out review before using this cash capacity.");
  let outstandingDeferredTipOutCents = 0;
  let recordedPaidTipOutCents = 0;
  let timingComplete = true;
  for (const shift of liveShifts) {
    if (!shift.jobId || shift.deferredTipOutCents == null || shift.deferredTipOutPaidCents == null) timingComplete = false;
    const deferred = shift.deferredTipOutCents, paid = shift.deferredTipOutPaidCents;
    if ([deferred, paid].some(value => value != null && (!Number.isSafeInteger(value) || value < 0))) return unavailable("tipout-timing-missing", "A tip-out liability needs review before using this cash capacity.");
    if (deferred == null) {
      if ((paid ?? 0) > 0) return unavailable("tipout-timing-missing", "A paid tip-out counter has no supported original liability.");
      continue;
    }
    if ((paid ?? 0) > deferred) return unavailable("tipout-timing-missing", "A paid tip-out counter exceeds its recorded liability.");
    outstandingDeferredTipOutCents += deferred - (paid ?? 0);
    recordedPaidTipOutCents += paid ?? 0;
    if (![outstandingDeferredTipOutCents, recordedPaidTipOutCents].every(Number.isSafeInteger)) return unavailable("unsafe-cents", "Tip-out liabilities exceed the supported cent range.");
  }
  if (recordedPaidTipOutCents > 0) {
    const txById = new Map(h.transactions.map(row => [row.id, row]));
    const paymentCandidates = ownTransactions.filter(row => row.createdBy === memberId && row.type === "expense" && row.source === "manual" && row.subcategoryId === "SUB-WORK-TIP-OUTS");
    const reversedIds = new Set(h.transactions.flatMap(row => row.reversalOfId ? [row.reversalOfId] : []));
    // Necessary evidence only: counters have no transaction allocation link. An
    // aggregate match never upgrades the explicit cash assumption to verification.
    if (paymentCandidates.some(row => !projectedCountable(row, txById) || reversedIds.has(row.id) || row.date > asOf)
      || paymentCandidates.reduce((sum, row) => sum + row.amountCents, 0) !== recordedPaidTipOutCents) return unavailable("source-remaining-unknown", "Paid tip-out counters do not tie to the recognized payment records. Review this cash assumption after correcting them.");
  }
  let books: ReturnType<typeof compileHousehold>;
  try { books = compileHousehold(h); } catch { return unavailable("source-not-accepted", "The accepted Personal books could not supply cash capacity."); }
  let recordedNetCashCents = 0;
  let cashSumSafe = true;
  const readings = accounts.map(account => {
    const rows = accountRegister(books, account.id, {recognizedOnly: true});
    const recordedCapacityCents = rows.filter(row => row.date <= asOf).at(-1)?.runningCents ?? 0;
    if (!Number.isSafeInteger(recordedNetCashCents + recordedCapacityCents)) cashSumSafe = false;
    recordedNetCashCents += recordedCapacityCents;
    return {accountId: account.id, name: account.name, recordedCapacityCents, availableForFundCents: null};
  });
  if (!cashSumSafe || !Number.isSafeInteger(recordedNetCashCents) || readings.some(row => !Number.isSafeInteger(row.recordedCapacityCents))
    || !Number.isSafeInteger(recordedNetCashCents - outstandingDeferredTipOutCents)) return unavailable("unsafe-cents", "Recorded cash capacity exceeds the supported cent range.");
  const ownSourceFactsDigest = await sha256Hex({version: "scenario-sources-1", memberId, asOf, accounts, readings,
    shifts: shifts.map(shift => ({...shift, reversed: workShiftIsReversed(h, shift)})), ownTransactions,
    jobs: byId((h.workJobs ?? []).filter(job => job.memberId === memberId)),
    contributions: byId(activeHouseholdFundEvents(h, marker.scope.fundId).filter(row => row.contributorMemberId === memberId)),
    outstandingDeferredTipOutCents, recordedPaidTipOutCents, timingComplete});
  const sharedFactsDigest = await sha256Hex({version: "scenario-horizon-1", asOf, through, fundId: marker.scope.fundId, anchorCents: horizon.anchorCents, movements: horizon.movements, buffers: horizon.monthlyBuffers});
  const basis: ScenarioBasis = {...initialBasis, ownSourceFactsDigest, sharedFactsDigest};
  const cashAccounts: RecordedScenarioCash[] = await Promise.all(readings.map(async row => ({...row, factsDigest: await sha256Hex({ownSourceFactsDigest, accountId: row.accountId})})));
  return {kind: "source-review", basis, horizon, cashAccounts, recordedNetCashCents, outstandingDeferredTipOutCents,
    cashCapacityLimitCents: Math.max(0, recordedNetCashCents - outstandingDeferredTipOutCents), timingComplete, unattributedCommitments: true};
}
