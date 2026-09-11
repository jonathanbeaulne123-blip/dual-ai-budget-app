import { fundContributionReviewDigest } from "../core/fundContributionSources.ts";
import { accountHistoryState, type AccountHistoryReview } from "../core/accountHistory.ts";
import { requirementFingerprint } from "../core/onboarding/attestations.ts";
import { onboardingCompletionDigest } from "../core/onboarding/ready.ts";
import {reviewedClaimInput} from "../core/claimSettlementReview.ts";
import {dueOccurrenceReview,reviewedDueRequest} from "../core/dueOccurrenceReview.ts";
import { reviewedSwipeEntry } from "../core/swipe.ts";
import { prepareDuplicateReview, reviewedDuplicateRequest } from "../core/duplicateReview.ts";
import type { Household } from "../core/types.ts";
import { canonical } from "./patch.ts";
import { shapeSharedBoards } from "../core/sharedBoards.ts";
export type Resource = { key: string; value: unknown };
const additive = new Set([
  "postEntry",
  "postTransfer",
  "postShift",
  "postWorkShift",
  "postWorkShiftWithAttendanceReview",
  "postCardInterest",
  "postCardRewards",
  "postSavingsInterest",
  "addCategory",
  "addAccount",
  "addGoal",
  "addRecurrence",
  "addPotentialExpense",
  "postVisit",
  "openClaim",
  "recordHerculesTalk",
  "touchHouseholdDevice",
]);
function strings(value: unknown, output = new Set<string>()): Set<string> {
  if (typeof value === "string") output.add(value);
  else if (Array.isArray(value)) value.forEach((v) => strings(v, output));
  else if (value && typeof value === "object")
    Object.values(value).forEach((v) => strings(v, output));
  return output;
}
/** Explicit semantic resources; never revision, activity, receipt rings or entire books. */
export function observedResources(
  household: Household,
  kind: string,
  args: unknown[],
): Resource[] {
  if (kind === "addQuickSampleData" || kind === "addQuickSampleScenario") return [{ key: "quick-sample-catalog", value: { accounts: household.accounts, categories: household.categories, closedMonths: household.kitchen.books.closedMonths } }];
  if(kind==='saveNativeEvent'){const input=args[0] as {id:string};return [{key:`native-event/${input.id}`,value:household.nativeEvents?.find(r=>r.id===input.id)??null}];}
  if (kind === "commitCompanion" || kind === "commitCompanionGallery") return []; // Typed resource revisions and conversation generations are rechecked by the authority.
  if (['proposeHouseholdFundContribution','replaceHouseholdFundContributionSource'].includes(kind)) {
    return [{key:'fund-source-allocation',value:{fund:household.householdFund,events:household.fundEvents,claims:household.fundContributionSourceClaims,
      transactions:household.transactions,accounts:household.accounts}}];
  }
  if (kind === 'confirmHouseholdFundContribution') {
    const input = args[0] as {proposalEventId:string};
    return [{key:'fund-contribution-review',value:fundContributionReviewDigest(household,input.proposalEventId)}];
  }
  if (["acceptReviewedAccountHistory", "approveAccountHistoryReview", "submitAccountHistoryReview"].includes(kind)) {
    const input = args[0] as { review: AccountHistoryReview };
    return [{key: "account-history", value: accountHistoryState(household, input.review)}];
  }
  if (["recordChapterAcknowledgement", "recordObservedChapterCompletion"].includes(kind)) {
    const input = args[0] as { chapterId?: string } | undefined;
    return [{ key: `onboarding-requirement/${input?.chapterId}`, value: requirementFingerprint(household, input?.chapterId ?? "") }];
  }
  if (["approveOnboardingReady", "completeHouseholdOnboarding"].includes(kind)) {
    return [{ key: "onboarding-ready-version", value: onboardingCompletionDigest(household) }];
  }
  if (["saveBoardTask", "removeBoardTask", "saveBoardMilestone", "removeBoardMilestone", "setBoardPhoto"].includes(kind)) {
    const input = args[0] as { id?: string; slot?: number };
    const boards = shapeSharedBoards(household.kitchen.boards);
    const field = kind === "setBoardPhoto" ? "photos" : kind.includes("Milestone") ? "milestones" : "tasks";
    const id = field === "photos" ? `BOARD-PHOTO-${input?.slot}` : input?.id;
    return [{ key: `boards/${field}/${id}`, value: { row: boards[field].find(r => r.id === id) ?? null, removed: household.tombstones.some(t => t.id === id) } }];
  }
  if(kind==="markDuplicate"&&args.length>2){
    const request=reviewedDuplicateRequest(args[2],args[0],args[1]),review=prepareDuplicateReview(household,request);
    return [{key:"duplicate-review",value:review.kind==="ready"?{kind:review.kind,basis:review.basis}:{kind:review.kind,reason:review.reason}}];
  }
  if(kind==='postEntry'&&args[0]&&typeof args[0]==='object'&&(args[0] as Record<string,unknown>).swipeReviewed!==undefined){
    let value:unknown;try{value={kind:'ready',basis:reviewedSwipeEntry(household,args[0]).basis};}catch(caught){value={kind:'unavailable',reason:caught instanceof Error?caught.message:String(caught)};}
    return [{key:'swipe-review',value}];
  }
  if(kind==='postOneRecurrence'&&args[2]&&typeof args[2]==='object'&&(args[2] as Record<string,unknown>).dueReview!==undefined){
    const options=args[2] as Record<string,unknown>;let value:unknown;
    try{const request=reviewedDueRequest(options.dueReview,args[0],args[1],options.createdBy,options.allowNotDue),reading=dueOccurrenceReview(household,request);value=reading.kind==='ready'?{kind:'ready',basis:reading.basis}:reading;}catch(e){value={kind:'unavailable',reason:e instanceof Error?e.message:String(e)};}
    return [{key:'due-occurrence-review',value}];
  }
  if(kind==='settleClaim'&&args[0]&&typeof args[0]==='object'&&(args[0] as Record<string,unknown>).claimReview!==undefined){let value:unknown;try{value={kind:'ready',basis:reviewedClaimInput(household,args[0]).basis};}catch(e){value={kind:'unavailable',reason:e instanceof Error?e.message:String(e)};}return [{key:'claim-settlement-review',value}];}
  if (["saveGoalEnvelope", "purchaseGoal", "fundGoal", "releaseHouseholdFundKitty", "allocateHouseholdFundSurplus"].includes(kind)) return [{ key: "kitty-backing-review", value: { goals: household.goals, contributions: household.goalContributions, purchases: household.goalPurchases, accounts: household.accounts, transactions: household.transactions, fund: household.householdFund, events: household.fundEvents, allocations: household.fundKittyAllocations } }];
  if (additive.has(kind)) return [];
  if (
    [
      "eraseDevelopmentActivity",
      "restoreSharedPoint",
      "regenerateDemoSuite",
    ].includes(kind)
  )
    return [
      { key: "lifecycle-sequence", value: household.revision },
      ...(kind === "restoreSharedPoint"
        ? [
            {
              key: "restore-point",
              value:
                household.restorePoints?.find(
                  (point) => point.id === args[0],
                ) ?? null,
            },
          ]
        : []),
    ];
  const result: Resource[] = [],
    ids = strings(args),
    h = household as unknown as Record<string, unknown>;
  for (const field of [
    "accounts",
    "categories",
    "recurrences",
    "potentialExpenses",
    "transactions",
    "shifts",
    "goals",
    "goalContributions",
    "claims",
    "workJobs",
    "appointments",
    "fundEvents",
    "fundMonthPlans",
    "fundSettlementAllocations",
    "fundKittyAllocations",
    "onboardingSubmissions",
    "onboardingCategoryMerges",
    "onboardingApprovals",
    "planDrafts",
    "planVersions",
    "planAcknowledgements",
    "planScenarios",
    "planReflections",
    "planLearningProgress",
    "planBridgeDecisions",
    "planHerculesSessions",
  ]) {
    const rows = h[field];
    if (Array.isArray(rows))
      for (const row of rows)
        if (row && typeof row.id === "string" && ids.has(row.id))
          result.push({ key: `${field}/${row.id}`, value: row });
  }
  const input = args[0] as Record<string, unknown> | undefined;
  if (kind === "setBudget")
    result.push({
      key: `budget/${String(input?.monthKey)}/${String(input?.subcategoryId)}`,
      value:
        household.budgetPlans.find(
          (r) =>
            r.active &&
            r.monthKey === input?.monthKey &&
            r.subcategoryId === input?.subcategoryId,
        ) ?? null,
    });
  if (["proposeHouseholdPlan", "adoptLegacyHouseholdPlan", "acknowledgeHouseholdPlan"].includes(kind)) {
    const versionId = String(input?.planVersionId ?? input?.draftId ?? "");
    result.push({
      key: `plan-authority/${versionId}`,
      value: {
        versions: household.planVersions ?? [],
        acknowledgements: household.planAcknowledgements ?? [],
        activationJobs: household.planActivationJobs ?? [],
        budgetPlans: household.budgetPlans,
      },
    });
  }
  if (kind === "setHouseholdFundMonthPlan")
    result.push({
      key: `fund-plan/${String(input?.monthKey)}`,
      value:
        household.fundMonthPlans?.find((r) => r.monthKey === input?.monthKey) ??
        null,
    });
  if (kind === "closeBooksMonth" || kind === "reopenBooksMonth") {
    const month =
      kind === "closeBooksMonth" ? String(input?.monthKey) : String(args[0]);
    result.push({
      key: `closed-month/${month}`,
      value:
        household.kitchen.books.closedMonths.find(
          (r) => r.monthKey === month,
        ) ?? null,
    });
    if (kind === "closeBooksMonth")
      result.push({
        key: `month-money/${month}`,
        value: household.transactions
          .filter((t) => t.date.startsWith(month))
          .map((t) => ({ id: t.id, amountCents: t.amountCents, type: t.type })),
      });
  }
  if (kind === "setHouseholdTimezone")
    result.push({ key: "timezone", value: household.timezone });
  if (kind === "updateShiftSettings")
    result.push({ key: "shiftSettings", value: household.shiftSettings });
  if (
    kind === "configureHouseholdFund" ||
    kind === "approveHouseholdFundConfiguration"
  )
    result.push({
      key: "householdFund",
      value: household.householdFund ?? null,
    });
  if (/Charter/.test(kind))
    result.push({ key: "charter", value: household.charter ?? null });
  return result.sort((a, b) => a.key.localeCompare(b.key));
}
export function snapshotResources(
  household: Household,
  kind: string,
  args: unknown[],
) {
  return observedResources(household, kind, args).map((r) => ({
    key: r.key,
    canonical: canonical(r.value),
  }));
}
