import { prepareDuplicateReview, reviewedDuplicateRequest } from "../core/duplicateReview.ts";
import type { Household } from "../core/types.ts";
import { canonical } from "./patch.ts";
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
  if(kind==="markDuplicate"&&args.length>2){
    const request=reviewedDuplicateRequest(args[2],args[0],args[1]),review=prepareDuplicateReview(household,request);
    return [{key:"duplicate-review",value:review.kind==="ready"?{kind:review.kind,basis:review.basis}:{kind:review.kind,reason:review.reason}}];
  }
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
