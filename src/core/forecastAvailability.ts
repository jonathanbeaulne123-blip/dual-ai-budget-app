import { addDays, dateKeyInZone, type DateKey } from "./calendar.ts";
import { askRoutesByCount, type AskRoute } from "./askRoutes.ts";
import { householdAsk } from "./ask.ts";
import { projectedCountable } from "./budget.ts";
import { sha256Hex } from "./commandIdentity.ts";
import { observeTipShifts } from "./tipScience.ts";
import { workShiftTransactionIds, workShiftIsReversed } from "./work.ts";
import { nextWorkScheduleDate } from "./workSettlement.ts";
import { reviewScenarioSources, type ScenarioAcceptedSource } from "./scenarioSources.ts";
import { reviewFundScenarioRequest, type FundScenarioRequest, type ScenarioBasis, type ScenarioRefusal } from "./fundScenario.ts";
import type { AvailableTranche, EarningsAvailability } from "./earningsAvailability.ts";
import type { Household } from "./types.ts";

export type ForecastReceiptPolicy = "net-cash-on-shift-day" | "net-card-at-next-recorded-payout";
export type NamedScenarioRoute = Readonly<{id: string; factsDigest: string; count: number; route: AskRoute}>;
export type ForecastRouteReview =
  | Readonly<{kind: "unavailable"; reasons: readonly ScenarioRefusal[] }>
  | Readonly<{
      kind: "forecast-review";
      basis: ScenarioBasis;
      jobId: string;
      roleId: string;
      policy: ForecastReceiptPolicy;
      observationPoolIds: readonly string[];
      families: readonly Readonly<{count: number; routes: readonly NamedScenarioRoute[]}>[];
      policyDigest: string;
    }>;
export type ForecastAvailabilityAssumption = Readonly<{
  routeId: string;
  reviewedRouteDigest: string;
  reviewedPolicyDigest: string;
  chosenByMemberId: string;
  policy: ForecastReceiptPolicy;
  acknowledgesForecastReceiptAssumption: true;
}>;
const MODEL_VERSION = "single-channel-net-tips-1";
const unavailable = (code: ScenarioRefusal["code"], message: string): Extract<ForecastRouteReview, {kind: "unavailable"}> => ({kind: "unavailable", reasons: [{code, message}]});
const safe = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

/** Strict whole-pool adapter: no inferred job, channel split, payout promise or second tip-out. */
export async function reviewForecastRoutes(household: Household, accepted: ScenarioAcceptedSource, asOf: DateKey, through: DateKey): Promise<ForecastRouteReview> {
  const h = structuredClone(household), marker = structuredClone(accepted);
  const sources = await reviewScenarioSources(h, marker, asOf, through);
  if (sources.kind === "unavailable") return sources;
  const memberId = marker.scope.memberId;
  const routeFamilies = askRoutesByCount(h, {askCents: householdAsk(h, asOf).askCents, memberId, from: asOf, to: through, unavailableDates: h.shifts.filter(shift => shift.memberId === memberId && !workShiftIsReversed(h, shift)).map(shift => shift.date)});
  if (routeFamilies.kind === "not-enough-data") return unavailable("route-unavailable", routeFamilies.copy);
  const observations = observeTipShifts(h, memberId);
  const jobIds = new Set(observations.map(row => row.jobId)), roleIds = new Set(observations.map(row => row.roleId));
  const job = h.workJobs.find(row => row.id === observations[0]?.jobId && row.memberId === memberId && row.active);
  const role = job?.roles.find(row => row.id === observations[0]?.roleId && row.active && row.tipped);
  if (jobIds.size !== 1 || roleIds.size !== 1 || !job || !role) return unavailable("forecast-model-unsupported", "These route observations do not identify one current job and tipped role.");
  const txById = new Map(h.transactions.map(row => [row.id, row]));
  let sawCash = false, sawCard = false, sawImmediate = false, sawWithheld = false;
  const currentRules = job.tipOutRules.filter(rule => rule.active);
  const policyFacts = currentRules.map(({id, basis, value, roundingCents, roundingMode, timing}) => ({id, basis, value, roundingCents, roundingMode, timing})).sort((a, b) => a.id.localeCompare(b.id));
  for (const observation of observations) {
    const shift = h.shifts.find(row => row.id === observation.shiftId)!;
    const bible = shift.shiftBible!;
    if (!bible.actualStart || !Number.isFinite(Date.parse(bible.actualStart)) || bible.actualStart !== shift.startedAt || bible.actualEnd !== shift.endedAt || bible.environment !== h.environment || bible.householdId !== h.householdId || dateKeyInZone(new Date(bible.actualStart), h.timezone) !== shift.date || shift.date > asOf || bible.memberId !== memberId || bible.jobId !== job.id || bible.roleId !== role.id || bible.linkedShiftId !== shift.id) return unavailable("source-not-accepted", "A route observation lacks a coherent accepted date, member or job link.");
    const elapsedMinutes = bible.actualEnd ? (Date.parse(bible.actualEnd) - Date.parse(bible.actualStart!)) / 60000 : NaN;
    if (!Number.isFinite(elapsedMinutes) || elapsedMinutes <= 0 || !safe(bible.workedMinutes) || bible.workedMinutes === 0
      || !safe(bible.paidBreakMinutes) || !safe(bible.unpaidBreakMinutes) || !Number.isFinite(shift.hours)
      || Math.abs(shift.hours * 60 - bible.workedMinutes) > 0.000001
      || Math.abs(bible.workedMinutes + bible.paidBreakMinutes + bible.unpaidBreakMinutes - elapsedMinutes) >= 1) return unavailable("source-not-accepted", "The route's permanent duration does not tie to its posted hours and clock.");
    const amounts = [bible.cashTipsCents, bible.cardTipsCents, bible.netTipsCents, bible.tipOutCents, shift.cashTipsCents, shift.ccTipsCents, shift.netTipsCents, shift.immediateTipOutCents, shift.withheldTipOutCents, shift.deferredTipOutCents];
    if (!amounts.every(safe)) return unavailable("tipout-timing-missing", "A route observation lacks supported receipt and tip-out amounts.");
    const tipOut = shift.immediateTipOutCents! + shift.withheldTipOutCents! + shift.deferredTipOutCents!;
    if (!Number.isSafeInteger(tipOut) || bible.cashTipsCents !== shift.cashTipsCents || bible.cardTipsCents !== shift.ccTipsCents || bible.netTipsCents !== shift.netTipsCents || bible.tipOutCents !== tipOut || shift.cashTipsCents + shift.ccTipsCents - tipOut !== shift.netTipsCents) return unavailable("source-not-accepted", "The route's receipt and permanent observation do not tie.");
    const ids = workShiftTransactionIds(shift);
    if (!ids.length || ids.some(id => !txById.has(id) || !projectedCountable(txById.get(id)!, txById))) return unavailable("source-not-accepted", "A route observation has missing or unrecognized posted evidence.");
    let snapshot: {v?: number; jobId?: string; roleId?: string; tipOutRules?: typeof job.tipOutRules};
    try { snapshot = JSON.parse(shift.settingsFingerprint); } catch { return unavailable("tipout-timing-missing", "A route observation has no supported tip-out policy snapshot."); }
    if (snapshot.v !== 1 || snapshot.jobId !== job.id || snapshot.roleId !== role.id || !Array.isArray(snapshot.tipOutRules)) return unavailable("tipout-timing-missing", "A route observation has no supported tip-out policy snapshot.");
    const historicPolicy = snapshot.tipOutRules.map(({id, basis, value, roundingCents, roundingMode, timing}) => ({id, basis, value, roundingCents, roundingMode, timing})).sort((a, b) => a.id.localeCompare(b.id));
    if (JSON.stringify(historicPolicy) !== JSON.stringify(policyFacts)) return unavailable("forecast-model-unsupported", "The current tip-out policy differs from this route's observation pool.");
    sawCash ||= shift.cashTipsCents > 0; sawCard ||= shift.ccTipsCents > 0;
    sawImmediate ||= shift.immediateTipOutCents! > 0; sawWithheld ||= shift.withheldTipOutCents! > 0;
    if (shift.deferredTipOutCents! > 0) return unavailable("tipout-timing-missing", "Deferred tip-outs need a supported future reservation policy.");
  }
  if (sawCash === sawCard) return unavailable("cash-card-split-missing", "These net-tip bands do not establish a single cash or card receipt channel.");
  const policy: ForecastReceiptPolicy = sawCash ? "net-cash-on-shift-day" : "net-card-at-next-recorded-payout";
  if ((sawCash && sawWithheld) || (sawCard && sawImmediate) || currentRules.some(rule => rule.timing !== (sawCash ? "immediate" : "withheld"))) return unavailable("tipout-timing-missing", "This route needs a supported receipt and tip-out timing policy.");
  const destinationAccountId = sawCash ? job.defaults.cashTipsAccountId : job.defaults.cardTipsDepositAccountId;
  if (!sources.cashAccounts.some(account => account.accountId === destinationAccountId)) return unavailable("source-not-owned", "The assumed payout needs an active owned CAD cash destination.");
  const observationPoolIds = observations.map(row => row.shiftId).sort();
  const policyDigest = await sha256Hex({version: MODEL_VERSION, basis: sources.basis, jobId: job.id, roleId: role.id, observationPoolIds, policy, policyFacts, destinationAccountId, tipSchedule: sawCash ? null : job.tipSchedule});
  const families = await Promise.all(routeFamilies.families.map(async family => ({count: family.count, routes: await Promise.all(family.routes.map(async route => {
    const factsDigest = await sha256Hex({version: MODEL_VERSION, policyDigest, shifts: route.shifts, ceiling: route.ceiling});
    return {id: `route:${factsDigest}`, factsDigest, count: family.count, route};
  }))})));
  if (families.some(family => family.routes.some(row => row.route.shifts.some(shift => !safe(shift.safeCents) || !safe(shift.expectedCents) || shift.safeCents > shift.expectedCents)))) return unavailable("forecast-model-unsupported", "The forecast bands cannot support nonnegative ordered availability.");
  return {kind: "forecast-review", basis: sources.basis, jobId: job.id, roleId: role.id, policy, observationPoolIds, families, policyDigest};
}

/** Selection is not consent: only the separately acknowledged receipt assumption supplies tranches. */
export async function resolveForecastAvailability(household: Household, accepted: ScenarioAcceptedSource, request: FundScenarioRequest, assumptions: readonly ForecastAvailabilityAssumption[]): Promise<EarningsAvailability> {
  const h = structuredClone(household), marker = structuredClone(accepted), choice = structuredClone(request), inputs = structuredClone(assumptions);
  const review = await reviewForecastRoutes(h, marker, choice.basis.asOf, choice.basis.through);
  if (review.kind === "unavailable") return review;
  const validation = reviewFundScenarioRequest(h, review.basis, choice);
  if (validation.kind === "refused") return {kind: "unavailable", reasons: validation.reasons};
  if (!Array.isArray(inputs) || inputs.length > 1) return unavailable("invalid-election", "Choose one named route for this scenario.");
  const seenRoutes = new Set<string>(), tranches = new Map<string, AvailableTranche>();
  for (const input of inputs) {
    if (!input || input.chosenByMemberId !== marker.scope.memberId) return unavailable("source-not-owned", "Choose only your own route assumption.");
    const named = review.families.flatMap(family => family.routes).find(row => row.id === input.routeId);
    if (!named || seenRoutes.has(named.id)) return unavailable("route-unavailable", "Choose one distinct named route from this review.");
    seenRoutes.add(named.id);
    if (input.reviewedRouteDigest !== named.factsDigest || input.reviewedPolicyDigest !== review.policyDigest) return unavailable("baseline-stale", "That named route or receipt policy changed.");
    if (input.acknowledgesForecastReceiptAssumption !== true || input.policy !== review.policy) return unavailable("availability-date-missing", "Explicitly review how and when this route's net tips would arrive.");
    if (named.route.ceiling.kind === "over") return unavailable("route-unavailable", "This route exceeds the recorded work ceiling.");
    const job = h.workJobs.find(job => job.id === review.jobId)!;
    for (const shift of named.route.shifts) {
      const availableOn = review.policy === "net-cash-on-shift-day" ? shift.date : nextWorkScheduleDate(job.tipSchedule, addDays(shift.date, 1));
      if (!availableOn || availableOn > review.basis.through) return unavailable("availability-date-missing", "The recorded payout assumption has no supported day inside this horizon.");
      const id = `forecast:${review.jobId}:${review.roleId}:${shift.date}:${shift.meal}`;
      const factsDigest = await sha256Hex({policyDigest: review.policyDigest, shift, availableOn});
      // Two route alternatives can contain the same shift; it is one allowance.
      if (tranches.has(id)) { if (tranches.get(id)!.source.factsDigest !== factsDigest) return unavailable("baseline-stale", "A shared candidate has conflicting availability."); continue; }
      tranches.set(id, {id, source: {kind: "named-route", id, ownerMemberId: marker.scope.memberId, factsDigest}, component: "net-tips", availableOn, lowerCents: shift.safeCents, expectedCents: shift.expectedCents,
        capacityGroupId: id, evidence: "forecast-availability", deductions: []});
    }
  }
  const rows = [...tranches.values()].sort((a, b) => a.availableOn.localeCompare(b.availableOn) || a.id.localeCompare(b.id));
  return {kind: "available", basis: review.basis, modelVersion: MODEL_VERSION, tranches: rows, capacityGroups: rows.map(row => ({id: row.capacityGroupId, lowerCents: row.lowerCents, expectedCents: row.expectedCents})),
    assumptions: inputs.length ? [review.policy === "net-cash-on-shift-day" ? "You assume these named shifts continue the single cash channel in the observation pool, with net tips arriving on each shift day." : "You assume these named shifts continue the single card channel, with net tips arriving on the next recorded payout day after each shift. The schedule does not prove cutoff or payment.", "The existing forecast is already net of tip-outs. No second tip-out or wages are added.", "Forecast receipt availability is hypothetical; route selection does not choose a Fund contribution."] : []};
}
