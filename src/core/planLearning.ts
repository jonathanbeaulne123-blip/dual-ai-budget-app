import { formatCad } from "./money.ts";
import type { PlanLens } from "./planSystem.ts";
import type { PlanProjection } from "./planProjection.ts";

const BUDGET = "https://www.canada.ca/en/financial-consumer-agency/services/make-budget.html";
const EMERGENCY = "https://www.canada.ca/en/financial-consumer-agency/services/savings-investments/setting-up-emergency-funds.html";
export const PLAN_LESSONS = {
  protect: { id: "cashflow-balance", title: "A balanced month can still run short", explain: "The date matters as much as the amount. Money expected after a bill is due cannot cover that bill on time. A rehearsal lets you change the timing before making a commitment.", experiment: "Delay an expected contribution by three days in Protect. Find the first promise affected, then restore the date.", question: "Can money arriving Monday cover a bill due Friday?", answer: "Only if other available money covers the gap. A positive month-end total does not solve the timing problem.", source: BUDGET },
  prepare: { id: "true-expenses", title: "An occasional cost is still a real cost", explain: "Known renewals and seasonal costs belong in preparation. An emergency reserve serves surprises you cannot reasonably schedule. Divide a future cost across remaining paydays, using backed reserves rather than wishful progress.", experiment: "Try a $1,200 target, $300 backed reserve and six paydays: $900 remains, or $150 per payday. Change the date and compare the schedule.", question: "Does spending a reserve on its intended bill mean you failed to save?", answer: "No. The reserve did its job. Record the payment, then prepare the next cycle without counting the same expense twice.", source: EMERGENCY },
  build: { id: "goals-tradeoffs", title: "One outcome can have several workable paths", explain: "Start with the life you want, then compare the cost, timing and effort of different paths. Include recurring costs and time commitments. More work is one possible choice, never the default answer.", experiment: "Keep a goal's date and reduce its target, then keep its target and move its date. Compare this month's contribution and protected commitments.", question: "If a goal moves faster, what needs another look?", answer: "The money and time it uses, the other promises it affects, and whether this is still the path you want.", source: BUDGET },
  everyday: { id: "everyday-flexibility", title: "A choice is easier when its consequence is clear", explain: "An allowance makes room for ordinary life after your commitments. Today's available money and future flexibility are different. Uneven spending can be intentional; compare upcoming plans before calling it drift.", experiment: "Rehearse a purchase today and on the next payday. Compare the amount left and the assumption that makes the difference.", question: "Does a larger grocery week always mean the Plan is wrong?", answer: "No. It may cover several weeks. Review what you bought, what is still coming, and the remaining allowance before changing the Plan.", source: BUDGET },
} as const;

export function planLesson(projection: PlanProjection, preferred?: PlanLens, completedIds: readonly string[] = []) {
  const lens = preferred ?? (projection.firstExposed ? "protect" : projection.lines.find(row => row.remainingCents > 0 && !completedIds.includes(PLAN_LESSONS[row.line.lens].id))?.line.lens ?? "everyday");
  const lesson = PLAN_LESSONS[lens];
  const evidence = projection.firstExposed && lens === "protect" ? `${projection.firstExposed.label} is exposed by ${formatCad(projection.firstExposed.gapCents)} on ${projection.firstExposed.date}.`
    : lens === "everyday" && projection.everydayNowCents !== null ? `This projection leaves ${formatCad(projection.everydayNowCents)} for Everyday from current money.`
    : projection.lines.find(row => row.line.lens === lens) ? `${projection.lines.find(row => row.line.lens === lens)!.line.labelSnapshot} is a visible decision to explore.` : "Start with the clearly labelled example, then try your own decision.";
  return { ...lesson, lens, evidence, jurisdiction: "Canada", reviewedOn: "2026-09-11" };
}
