import { addDays, calendarDaysBetween, isValidDateKey, monthKeyFromDateKey, monthStartKey, type DateKey } from "./calendar.ts";
import { activeHouseholdFundEvents, householdFundOperatingDelta, projectHouseholdFundOperatingBalanceBefore, shapeHouseholdFundMonthPlans, shapeHouseholdFundEvents } from "./householdFund.ts";
import { fundWalk, prepareFundInflows, prepareFundObligations, type FundWalk, type WalkPoint } from "./fundWalk.ts";
import { foldFundMovements, type FundMovement } from "./fundMovements.ts";
import { outstandingFundSources } from "./monthObligations.ts";
import { SCENARIO_MAX_DAYS, type ScenarioRefusal } from "./fundScenario.ts";
import type { Household } from "./types.ts";

export type FundHorizon = Readonly<{
  kind: "horizon";
  asOf: DateKey;
  through: DateKey;
  /** Exactly the existing monthly reader; never relabel the horizon as a monthly register tie. */
  acceptedMonthlyWalk: FundWalk;
  anchorCents: number;
  movements: readonly FundMovement[];
  future: readonly WalkPoint[];
  endBalanceCents: number;
  monthlyBuffers: readonly Readonly<{ monthKey: string; bufferCents: number }>[];
  assumptions: readonly string[];
}>;
export type FundHorizonResult = FundHorizon | Readonly<{ kind: "unavailable"; reasons: readonly ScenarioRefusal[] }>;
const unavailable = (code: ScenarioRefusal["code"], message: string): FundHorizonResult => ({ kind: "unavailable", reasons: [{ code, message }] });
const validDate = (date: string) => typeof date === "string" && date.length === 10 && isValidDateKey(date);

/** Canonical future from one accepted end-of-today anchor, across at most 31 inclusive days. */
export function prepareFundHorizon(household: Household, asOf: DateKey, through: DateKey): FundHorizonResult {
  if (!validDate(asOf) || !validDate(through) || through < asOf || calendarDaysBetween(asOf, through) + 1 > SCENARIO_MAX_DAYS) return unavailable("outside-horizon", "Choose an inclusive horizon of no more than 31 days.");
  const fund = household.householdFund;
  if (!fund) return unavailable("fund-missing", "The Shared Fund is not configured.");
  const events = activeHouseholdFundEvents(household, fund.id);
  const futureReversal = shapeHouseholdFundEvents(household.fundEvents).some(event => event.fundId === fund.id && event.kind === "reversal" && event.date > asOf);
  // These facts alter global position/allocation readers even beyond this horizon.
  // Supporting them requires a dated position policy, not an extra line on the chart.
  if (futureReversal || events.some(event => event.date > asOf && ["settlement-confirmed", "kitty-allocated", "kitty-released", "refund-funded", "reversal"].includes(event.kind))) return unavailable("forecast-model-unsupported", "A future settlement, goal movement or reversal needs a dated Fund review before this scenario.");
  const plannedSharedGoalIds = new Set(household.recurrences
    .filter(row => row.active && row.type === "transfer" && row.goalId
      && household.goals.some(goal => goal.id === row.goalId && goal.shared && goal.status !== "retired"))
    .map(row => row.goalId));
  if ((household.goalContributions ?? []).some(row => row.date > asOf && plannedSharedGoalIds.has(row.goalId))) return unavailable("forecast-model-unsupported", "Future goal progress needs a dated review before this scenario.");
  const acceptedMonthlyWalk = fundWalk(household, monthKeyFromDateKey(asOf), asOf);
  if (!acceptedMonthlyWalk.tiesToProjection) return unavailable("baseline-untied", "The current Fund month needs review before a scenario.");
  const anchorCents = projectHouseholdFundOperatingBalanceBefore(household, addDays(asOf, 1), fund.id);
  if (acceptedMonthlyWalk.todayBalanceCents !== anchorCents || !Number.isSafeInteger(anchorCents)) return unavailable("baseline-untied", "The accepted Fund anchor does not tie.");
  const monthKeys = new Set<string>();
  for (let offset = 0; offset <= calendarDaysBetween(asOf, through); offset++) monthKeys.add(monthKeyFromDateKey(addDays(asOf, offset)));
  const obligations = new Map<string, { date: DateKey; amountCents: number; label: string; sourceId: string }>();
  const goalClaims = new Map<string, number>();
  for (const monthKey of monthKeys) {
    const prepared = prepareFundObligations(household, monthKey, asOf);
    if (!prepared.obligations.tiesToProjection) return unavailable("baseline-untied", "A month inside this horizon needs Fund review.");
    for (const row of prepared.rows.filter(row => row.date >= asOf && row.date <= through)) {
      const existing = obligations.get(row.sourceId);
      if (existing && (existing.date !== row.date || existing.amountCents !== row.amountCents)) return unavailable("baseline-untied", "An obligation has conflicting dated amounts.");
      if (existing) continue;
      obligations.set(row.sourceId, row);
      const source = prepared.obligations.rows.find(source => source.id === row.sourceId);
      if (source?.source === "goal-claim" && source.goalId) {
        const total = (goalClaims.get(source.goalId) ?? 0) + row.amountCents;
        const goal = household.goals.find(goal => goal.id === source.goalId);
        if (!Number.isSafeInteger(total) || !goal || total > Math.max(0, goal.targetCents - goal.savedCents)) return unavailable("forecast-model-unsupported", "Repeated goal claims exceed the remaining target in this horizon.");
        goalClaims.set(source.goalId, total);
      }
    }
  }
  // Cover every outstanding position, including debt originating before the first month.
  for (const source of outstandingFundSources(household, fund.id, asOf)) {
    if (!source.date || !validDate(source.date)) return unavailable("baseline-untied", "An outstanding Fund claim has no supported date.");
    if (source.date > through) continue;
    if (source.date < monthStartKey(monthKeyFromDateKey(asOf))) {
      obligations.set(source.id, { date: asOf, amountCents: source.amountCents, label: source.label, sourceId: source.id });
    }
    const represented = obligations.get(source.id);
    if (!represented || represented.amountCents !== source.amountCents) return unavailable("baseline-untied", "An outstanding Fund claim is missing from this horizon.");
  }
  const movements: FundMovement[] = [
    ...prepareFundInflows(household, events, asOf, through).map(row => ({ date: row.date, deltaCents: row.amountCents, label: row.label, kind: "contribution" as const, estimated: row.estimated, memberId: row.memberId, sourceId: row.sourceId })),
    ...[...obligations.values()].map(row => ({ date: row.date, deltaCents: -row.amountCents, label: row.label, kind: "obligation" as const, estimated: false, memberId: null, sourceId: row.sourceId })),
  ];
  if (movements.some(row => !Number.isSafeInteger(row.deltaCents) || !row.sourceId)) return unavailable("unsafe-cents", "The dated Fund amounts exceed the supported cent range.");
  const ids = movements.map(row => row.sourceId);
  if (new Set(ids).size !== ids.length) return unavailable("baseline-untied", "A Fund source appears more than once.");
  const folded = foldFundMovements(anchorCents, movements);
  if (!folded.points.every(point => Number.isSafeInteger(point.balanceCents))) return unavailable("unsafe-cents", "The dated Fund balance exceeds the supported cent range.");
  // The anchor is independently conserved from accepted events, not clipped deficit comparisons.
  const acceptedSum = events.filter(event => event.date <= asOf).reduce((sum, event) => sum + householdFundOperatingDelta(event), 0);
  if (acceptedSum !== anchorCents) return unavailable("baseline-untied", "The accepted Fund movements do not conserve the anchor.");
  const plans = shapeHouseholdFundMonthPlans(household.fundMonthPlans).filter(plan => plan.fundId === fund.id);
  return {
    kind: "horizon", asOf, through, acceptedMonthlyWalk, anchorCents,
    movements: folded.points.map(({ balanceCents: _balance, actual: _actual, ...row }) => row), future: folded.points, endBalanceCents: folded.endBalanceCents,
    monthlyBuffers: [...monthKeys].map(monthKey => ({ monthKey, bufferCents: plans.find(plan => plan.monthKey === monthKey)?.bufferCents ?? 0 })),
    assumptions: ["Daily precision: contributions are ordered before obligations on the same day; this does not establish intraday availability.", "Observed contribution estimates are projections, not promised earnings or transfers."],
  };
}
