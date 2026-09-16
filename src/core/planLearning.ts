import { formatCad } from "./money.ts";
import type { PlanLens } from "./planSystem.ts";
import type { PlanProjection } from "./planProjection.ts";
import { PLAN_CURRICULUM } from "./planSystem.ts";
import type { FoundationChapterId } from "./chapters.ts";

const BUDGET = "https://www.canada.ca/en/financial-consumer-agency/services/make-budget.html";
const EMERGENCY = "https://www.canada.ca/en/financial-consumer-agency/services/savings-investments/setting-up-emergency-funds.html";
export const PLAN_LESSONS = {
  protect: { id: "cashflow-balance", title: "A balanced month can still run short", explain: "The date matters as much as the amount. Money expected after a bill is due cannot cover that bill on time. A rehearsal lets you change the timing before making a commitment.", experiment: "Delay an expected contribution by three days in Protect. Find the first promise affected, then restore the date.", question: "Can money arriving Monday cover a bill due Friday?", answer: "Only if other available money covers the gap. A positive month-end total does not solve the timing problem.", source: BUDGET },
  prepare: { id: "true-expenses", title: "An occasional cost is still a real cost", explain: "Known renewals and seasonal costs belong in preparation. An emergency reserve serves surprises you cannot reasonably schedule. Divide a future cost across remaining paydays, using backed reserves rather than wishful progress.", experiment: "Try a $1,200 target, $300 backed reserve and six paydays: $900 remains, or $150 per payday. Change the date and compare the schedule.", question: "Does spending a reserve on its intended bill mean you failed to save?", answer: "No. The reserve did its job. Record the payment, then prepare the next cycle without counting the same expense twice.", source: EMERGENCY },
  build: { id: "goals-tradeoffs", title: "One outcome can have several workable paths", explain: "Start with the life you want, then compare the cost, timing and effort of different paths. Include recurring costs and time commitments. More work is one possible choice, never the default answer.", experiment: "Keep a goal's date and reduce its target, then keep its target and move its date. Compare this month's contribution and protected commitments.", question: "If a goal moves faster, what needs another look?", answer: "The money and time it uses, the other promises it affects, and whether this is still the path you want.", source: BUDGET },
  everyday: { id: "everyday-flexibility", title: "A choice is easier when its consequence is clear", explain: "An allowance makes room for ordinary life after your commitments. Today's available money and future flexibility are different. Uneven spending can be intentional; compare upcoming plans before calling it drift.", experiment: "Rehearse a purchase today and on the next payday. Compare the amount left and the assumption that makes the difference.", question: "Does a larger grocery week always mean the Plan is wrong?", answer: "No. It may cover several weeks. Review what you bought, what is still coming, and the remaining allowance before changing the Plan.", source: BUDGET },
} as const;

/**
 * v2 lessons (D-270): the timing lesson belongs to Prepare (bills), Protect
 * teaches the buffer, and Everyday is what's left ("Now"). Same ids for
 * Build/Everyday so earlier progress still counts.
 */
export const PLAN_LESSONS_V2 = {
  prepare: { id: "cashflow-balance", title: "A balanced month can still run short", explain: "Prepare holds what has to leave. The date matters as much as the amount: money expected after a bill is due cannot cover that bill on time. A rehearsal lets you change the timing before making a commitment.", experiment: "Delay an expected contribution by three days. Find the first bill in Prepare it affects, then restore the date.", question: "Can money arriving Monday cover a bill due Friday?", answer: "Only if other available money covers the gap. A positive month-end total does not solve the timing problem.", source: BUDGET },
  protect: { id: "buffers", title: "A buffer is for the month you didn't plan", explain: "Protect is the buffer you agree on together. Known bills and costs that come around belong in Prepare; the buffer covers what you could not reasonably schedule. Prepare fills first, so Protect only holds money once the bills are covered.", experiment: "Set a buffer, then add an unexpected cost. See Prepare stay whole and Protect take the difference.", question: "Should the buffer pay for a bill we forgot to plan?", answer: "It can, once. Then put that bill in Prepare so next month expects it. If the buffer lends money to another fund, the custodian suggests it and the partner confirms.", source: EMERGENCY },
  build: PLAN_LESSONS.build,
  everyday: { ...PLAN_LESSONS.everyday, explain: "Now is what is left after Prepare, Protect and Build. Today's available money and future flexibility are different. Uneven spending can be intentional; compare upcoming plans before calling it drift." },
} as const;

export function planLesson(projection: PlanProjection, preferred?: PlanLens, completedIds: readonly string[] = [], mode: 1 | 2 = 1) {
  const lessons = mode === 2 ? PLAN_LESSONS_V2 : PLAN_LESSONS;
  const timing = mode === 2 ? "prepare" : "protect";
  const lens = preferred ?? (projection.firstExposed ? timing : projection.lines.find(row => row.remainingCents > 0 && !completedIds.includes(lessons[row.line.lens].id))?.line.lens ?? "everyday");
  const lesson = lessons[lens];
  const evidence = projection.firstExposed && lens === timing ? `${projection.firstExposed.label} is exposed by ${formatCad(projection.firstExposed.gapCents)} on ${projection.firstExposed.date}.`
    : lens === "everyday" && projection.everydayNowCents !== null ? `This projection leaves ${formatCad(projection.everydayNowCents)} for Everyday from current money.`
    : projection.lines.find(row => row.line.lens === lens) ? `${projection.lines.find(row => row.line.lens === lens)!.line.labelSnapshot} is a visible decision to explore.` : "Start with the clearly labelled example, then try your own decision.";
  return { ...lesson, lens, evidence, jurisdiction: "Canada", reviewedOn: "2026-09-11" };
}

const COUPLE = "https://www.canada.ca/en/financial-consumer-agency/services/living-as-couple.html";
const YMYG = "https://www.consumerfinance.gov/consumer-tools/educator-tools/your-money-your-goals/toolkit/";

export type ChapterLesson = {
  id: string;
  title: string;
  explain: string;
  experiment: string;
  question: string;
  answer: string;
  source: string;
  /** A couple skill taught alongside the financial one (Vision v2 §6: two curriculums run together). */
  coupleSkill: string;
  jurisdiction: "Canada";
  reviewedOn: string;
};

/**
 * Lessons keyed by id for the Chapter system. The four lens lessons are reused
 * for Chapters 2, 4 and 5; three lessons are added for Chapters 1, 3 and 6.
 * Learning never blocks agreement.
 */
export const CHAPTER_LESSONS: Record<string, ChapterLesson> = {
  "shared-operating-system": {
    id: "shared-operating-system",
    title: "What is mine, what is ours, and how a fact crosses between them",
    explain: "My Money is each person's private, exact record. Our Home holds only what the two of you have deliberately made shared: the Fund, its agreements, and the meaning you chose to bring across the Bridge. Sharing one fact never opens the rest of a ledger, and nothing crosses silently.",
    experiment: "Open the Charter and read the clause about who holds the Fund. Then find one Personal item that affects the home and notice what Share with Our Home would reveal — and what it would keep private.",
    question: "Does fair contribution planning need each person's exact income?",
    answer: "No. A range, a percentage, or an available-to-contribute amount is the normal planning language. Exact income is always optional.",
    source: COUPLE,
    coupleSkill: "Describe your current arrangement without implying that separate, partial, or merged finances are more committed.",
    jurisdiction: "Canada",
    reviewedOn: "2026-09-12",
  },
  "cashflow-balance": { ...PLAN_LESSONS.protect, coupleSkill: "Agree who watches, who acts, and what needs both of you before rent.", jurisdiction: "Canada", reviewedOn: "2026-09-11" },
  "mental-load": {
    id: "mental-load",
    title: "Paying a bill is visible; remembering it is not",
    explain: "Deciding, researching, remembering, executing, and monitoring are five different kinds of work. A household can run because one person quietly carries four of them. Giving a whole responsibility an owner, a definition of done, and a backup who knows where the record lives makes the invisible work visible without demanding identical participation.",
    experiment: "Pick one recurring responsibility. Write who owns it, what done looks like, and where the other person would find the authoritative record if the owner were away for a month.",
    question: "Does sharing the mental load mean splitting every task fifty-fifty?",
    answer: "No. Equal stake does not require identical work. It means ownership is explicit and willingly accepted, and the non-owner knows what done means and can respond if needed.",
    source: YMYG,
    coupleSkill: "Choose a fair responsibility model and recognize non-transactional work.",
    jurisdiction: "Canada",
    reviewedOn: "2026-09-12",
  },
  "true-expenses": { ...PLAN_LESSONS.prepare, coupleSkill: "Agree what the buffer protects and when using it is appropriate.", jurisdiction: "Canada", reviewedOn: "2026-09-11" },
  "goals-tradeoffs": { ...PLAN_LESSONS.build, coupleSkill: "Create a shared aspiration while preserving each person's autonomy and different preferences.", jurisdiction: "Canada", reviewedOn: "2026-09-11" },
  "everyday-flexibility": { ...PLAN_LESSONS.everyday, coupleSkill: "Treat agreed Personal autonomy as a legitimate financial outcome, not a leak.", jurisdiction: "Canada", reviewedOn: "2026-09-11" },
  "surprise-recovery": {
    id: "surprise-recovery",
    title: "A surprise is a prioritization problem, not a verdict",
    explain: "When a cost arrives that the plan did not hold, the order matters: name the impact, protect the commitments with the worst consequences if missed, decide one thing, and only then rebuild the rest. A buffer used for its purpose is a success. Earlier progress is not erased by a hard month.",
    experiment: "In the Plan's stress rehearsal, add an unexpected cost about the size of one car repair. Find which protected promise is affected first and what single change would cover it.",
    question: "If we use the buffer, did we fail?",
    answer: "No. The buffer did its job. Record the use, decide how you will replenish it, and keep the Chapter's earlier Wins where they are.",
    source: EMERGENCY,
    coupleSkill: "Separate the problem from blame and make one stabilizing decision together.",
    jurisdiction: "Canada",
    reviewedOn: "2026-09-12",
  },
};

export function chapterLesson(lessonId: string): ChapterLesson | null {
  return CHAPTER_LESSONS[lessonId] ?? null;
}

/**
 * Re-keys the twelve-module curriculum to the Chapters that teach each module.
 * The foundation teaches the first half; expansion Chapters carry the rest.
 */
export const CURRICULUM_BY_CHAPTER: Record<FoundationChapterId | "expansion", readonly (typeof PLAN_CURRICULUM)[number][0][]> = {
  "see-our-shared-life": ["values-roles-privacy"],
  "make-rent-boring": ["cashflow-balance", "bills-cadence"],
  "share-the-mental-load": ["bills-cadence"],
  "build-breathing-room": ["true-expenses", "buffers"],
  "make-room-for-joy": ["tradeoffs"],
  "handle-a-surprise-together": ["buffers", "debt"],
  expansion: ["credit-health", "insurance", "taxes", "investing", "annual-review"],
};
