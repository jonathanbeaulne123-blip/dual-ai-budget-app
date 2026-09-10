import type { LedgerView } from "./types.ts";
import type { HerculesReadToolName } from "./herculesTools.ts";

/** Declarations only. Slice 3 must supply a verified handler before showing a card. */
export const HERCULES_CAPABILITY_IDS = [
  "explain-page", "guide-entry", "explain-account", "bills-before-payday",
  "explain-spending", "compare-periods", "review-plan", "review-goal",
  "review-health", "resume-shift", "explain-fund", "dress-hercules",
] as const;
export type HerculesCapabilityId = typeof HERCULES_CAPABILITY_IDS[number];
export type CompanionActionKey =
  | "explain-current-page" | "open-entry-review" | "open-account-source"
  | "open-bills-calendar" | "open-spending-source" | "open-period-comparison"
  | "open-current-plan" | "open-goal" | "open-health-review"
  | "resume-own-shift" | "open-fund-context" | "open-hercules-closet";
export type CapabilityRequirement =
  | "current-page" | "selected-account" | "selected-payday" | "recorded-period"
  | "two-recorded-periods" | "plan-projection" | "selected-goal"
  | "health-finding" | "own-unfinished-shift" | "visible-fund-item" | "wardrobe-handler";
export type CapabilityDefinition = {
  id: HerculesCapabilityId;
  outcome: string;
  example: string;
  views: readonly LedgerView[];
  requires: readonly CapabilityRequirement[];
  readTools: readonly HerculesReadToolName[];
  action: CompanionActionKey;
  completion: string;
};

export const HERCULES_CAPABILITIES = [
  { id: "explain-page", outcome: "Understand this page", example: "What can I do here?", views: ["household", "personal"], requires: ["current-page"], readTools: [], action: "explain-current-page", completion: "Explanation shown for the same active page and scope." },
  { id: "guide-entry", outcome: "Walk through an entry", example: "Help me enter my groceries.", views: ["household", "personal"], requires: [], readTools: [], action: "open-entry-review", completion: "User completes or exits the existing entry/review flow; only its Confirm posts." },
  { id: "explain-account", outcome: "Understand this balance", example: "Why does this account show that balance?", views: ["household", "personal"], requires: ["selected-account"], readTools: ["account_balance", "explain_balance"], action: "open-account-source", completion: "Current selected-account explanation and its source are shown." },
  { id: "bills-before-payday", outcome: "See what's due before payday", example: "Walk me through what's due before payday.", views: ["household", "personal"], requires: ["selected-payday"], readTools: ["bills_due"], action: "open-bills-calendar", completion: "Bills are shown for the explicit date range; missing payday prompts for a date." },
  { id: "explain-spending", outcome: "Understand recorded spending", example: "Where did my spending go this month?", views: ["household", "personal"], requires: ["recorded-period"], readTools: ["spending_summary", "category_breakdown"], action: "open-spending-source", completion: "Scoped recorded-period breakdown and source are shown." },
  { id: "compare-periods", outcome: "Compare two periods", example: "How does this week compare with last week?", views: ["household", "personal"], requires: ["two-recorded-periods"], readTools: ["compare_spending"], action: "open-period-comparison", completion: "Comparison is shown with both date ranges and coverage limitations." },
  { id: "review-plan", outcome: "Walk through our plan", example: "Help me understand what's left after bills.", views: ["household"], requires: ["plan-projection"], readTools: ["budget_status", "cash_position"], action: "open-current-plan", completion: "Existing projection and assumptions shown; no guarantee or silent allocation." },
  { id: "review-goal", outcome: "Review a goal", example: "What is the next step for this goal?", views: ["household", "personal"], requires: ["selected-goal"], readTools: ["goal_progress"], action: "open-goal", completion: "Selected goal's existing next action is shown or explicitly completed." },
  { id: "review-health", outcome: "Understand something that needs review", example: "Help me understand this warning.", views: ["household", "personal"], requires: ["health-finding"], readTools: ["audit_health", "duplicate_review"], action: "open-health-review", completion: "Current finding is explained and its review destination opens; suppress once resolved." },
  { id: "resume-shift", outcome: "Finish a shift entry", example: "Help me finish the shift I started.", views: ["household", "personal"], requires: ["own-unfinished-shift"], readTools: ["shift_summary"], action: "resume-own-shift", completion: "Same actor's unfinished workflow opens; suppress after completion or abandonment." },
  { id: "explain-fund", outcome: "Understand this Fund item", example: "Explain this contribution or claim.", views: ["household"], requires: ["visible-fund-item"], readTools: [], action: "open-fund-context", completion: "Current visible Fund projection/source opens without exposing private backing money." },
  { id: "dress-hercules", outcome: "Make a look for Hercules", example: "Let's find you something to wear.", views: ["household", "personal"], requires: ["wardrobe-handler"], readTools: [], action: "open-hercules-closet", completion: "Personal fitting preview opens; wearing/saving remains an explicit action." },
] as const satisfies readonly CapabilityDefinition[];

/** No suggestion is available merely because its declaration exists. */
export function registeredCompanionCapabilities(
  implementedActions: ReadonlySet<CompanionActionKey>,
  view: LedgerView,
): readonly CapabilityDefinition[] {
  return (HERCULES_CAPABILITIES as readonly CapabilityDefinition[])
    .filter(row => implementedActions.has(row.action) && row.views.includes(view));
}
