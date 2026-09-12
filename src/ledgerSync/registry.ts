import { executeHerculesAction, cancelHerculesSubmission } from '../core/herculesExecution.ts';
import { addQuickSampleData, addQuickSampleScenario } from '../core/quickSampleData.ts';
import {commitCompanionGallery} from '../core/herculesWardrobe.ts';
import { reviewedDuplicateRequest } from "../core/duplicateReview.ts";
import { eraseDevelopmentActivity, restoreSharedPoint } from "./lifecycle.ts";
import type { Scope } from "./protocol.ts";
import { buildBatchImport } from "../core/importInbox/command.ts";
import { commitCompanion } from "../core/herculesCompanion.ts";
import * as commands from "../core/commands.ts";
import * as rehearsal from "../core/monthRehearsal.ts";
import * as chapterCommands from "../core/chapters.ts";
import { stampWeeklyDocument } from "../core/weeklyDocumentStamp.ts";
import { commitCharterFounding } from "../core/charterFounding.ts";
import type { CommitResult, Household } from "../core/types.ts";
import { ValidationError } from "../core/types.ts";

type Fn = (household: Household, ...args: never[]) => CommitResult;
type Policy = { fn: Fn; bind: (args: unknown[], actor: string) => void };
const policies = new Map<string, Policy>();
const functions = {
  addQuickSampleData, addQuickSampleScenario,
  ...commands,
  executeHerculesAction, cancelHerculesSubmission,
  commitCompanion,
  commitCompanionGallery,
  ...rehearsal,
  openChapter: chapterCommands.openChapter, addRitual: chapterCommands.addRitual, recordRitualHeld: chapterCommands.recordRitualHeld, setRitualState: chapterCommands.setRitualState,
  offerMove: chapterCommands.offerMove, respondToMove: chapterCommands.respondToMove, completeMove: chapterCommands.completeMove, recordWin: chapterCommands.recordWin, keepWinAsMemory: chapterCommands.keepWinAsMemory, dismissWin: chapterCommands.dismissWin, closeChapter: chapterCommands.closeChapter,
  eraseDevelopmentActivity,
  restoreSharedPoint,
  stampWeeklyDocument,
  commitCharterFounding,
} as unknown as Record<string, Fn>;
function bind(args: unknown[], index: number, path: string, actor: string) {
  if (!path) {
    args[index] = actor;
    return;
  }
  let object = (args[index] ??= {}) as Record<string, unknown>;
  if (!object || typeof object !== "object" || Array.isArray(object))
    throw new Error("INVALID_ARGUMENT");
  const keys = path.split(".");
  for (const key of keys.slice(0, -1)) {
    object = (object[key] ??= {}) as Record<string, unknown>;
    if (!object || typeof object !== "object" || Array.isArray(object))
      throw new Error("INVALID_ARGUMENT");
  }
  const key = keys.at(-1)!;
  if (object[key] != null && object[key] !== actor)
    throw new Error("ACTOR_MISMATCH");
  object[key] = actor;
}
function register(names: string, paths: string[] = []) {
  for (const name of names.split(/\s+/).filter(Boolean)) {
    const fn = functions[name];
    if (!fn) throw new Error(`UNKNOWN_REGISTRATION:${name}`);
    policies.set(name, {
      fn,
      bind: (args, actor) => {
        for (const path of paths) bind(args, 0, path, actor);
      },
    });
  }
}
register(
  `adoptExistingOnboardingEvidence recordChapterAcknowledgement recordObservedChapterCompletion skipPersonalStep skipChapterFourPersonalAccounts setOnboardingOffersMuted recordPersonalModuleOffer declinePersonalModuleOffer completePersonalModule submitOnboardingCategories mergeOnboardingCategories submitOnboardingEstimates approveOnboardingProposal approveOnboardingReady completeHouseholdOnboarding setLandingSurface setFundRailSlot resetFundRail setGlanceAccount setHerculesProPermissions setFundCardAccount savePlanDraft createPlanScenario lockPersonalPlan savePlanLearningProgress setPlanCoachingIntensity updatePlanNudgeState savePlanReflection markPlanReflectionReviewed savePlanBridgeDraft sharePlanBridgeDraft proposeHouseholdPlan adoptLegacyHouseholdPlan acknowledgeHouseholdPlan proposePlanBridge withdrawPlanBridge holdPlanBridge declinePlanBridge addPlanBridgeToDraft postShift postWorkShift refreshSevenShiftsSchedule refreshShiftEnvelopesFromEvidence confirmShiftEnvelopeOutcome appendShiftBibleWeather retireResolvedShiftEnvelope reconcileWorkWeekFromEvidence recordEarningCadence postWorkShiftWithAttendanceReview approveHouseholdFundConfiguration adoptFirstBudget`,
  ["createdBy", "memberId"],
);
register(
  `submitAccountHistoryReview acceptReviewedAccountHistory approveAccountHistoryReview postEntry postOpeningBalances postTransfer settleWorkReceivable payDeferredWorkTipOut postCardInterest postCardRewards postSavingsInterest saveSitDownSession executeSitDownMoves adoptSitDownStandingOrders fundGoal purchaseGoal saveGoalEnvelope recordReconciliation closeBooksMonth postVisit openClaim settleClaim writeOffClaim configureHouseholdFund addPotentialExpense updatePotentialExpense movePotentialExpense removePotentialExpense dismissPotentialExpenseNotice postPotentialExpense`,
  ["createdBy"],
);
register(
  `offerHouseholdOnboarding proposeHouseholdOnboarding confirmHouseholdOnboarding stopHouseholdOnboarding resumeHouseholdOnboarding clockInShift clockOutShift startShiftBreak endShiftBreak updateOpenShiftTimeline abandonOpenShift chooseOpenShiftTimeline moveAskGoalClaimToNextMonth playTicTacToe guessHangman foundHouseholdCharter signHouseholdCharter grantCharterPermission revokeCharterPermission proposeCharterAmendment proposeCharterCeilingAmendment confirmCharterAmendment holdCharterAmendment bindHouseholdFundBackingAccount setHouseholdFundMonthPlan replaceHouseholdFundContributionSource proposeHouseholdFundContribution holdHouseholdFundContribution releaseHouseholdFundHold withdrawHouseholdFundContribution confirmHouseholdFundContribution confirmHouseholdFundSettlement allocateHouseholdFundSurplus releaseHouseholdFundKitty postHouseholdFundDirectDebit recordHouseholdFundReconciliation reverseHouseholdFundEvent activateHouseholdFundConnection recordHouseholdFundBankVerification commitCharterFounding startRehearsalTask recordRehearsalOutcome linkRehearsalReceipt archiveMonthRehearsal stampWeeklyDocument`,
  ["memberId"],
);
register("executeHerculesAction cancelHerculesSubmission", ["memberId"]);
register("recordBillPayment", ["createdBy"]);
register("addQuickSampleData addQuickSampleScenario", ["memberId"]);
register("saveNativeEvent", ["memberId"]);
register("appendPlanSitdownTurn", ["memberId"]);
register("commitCompanion", ["scope.memberId"]);
register("commitCompanionGallery", ["scope.memberId"]);
register("forceUnlockOnboarding", ["memberId", "createdBy"]);
register("saveBoardTask removeBoardTask saveBoardMilestone removeBoardMilestone setBoardPhoto", ["memberId"]);
register("linkGoogleIdentity touchHouseholdDevice", ["memberId"]);
register("setGoogleServices setRecurrenceGoogleSync");
register("startMonthRehearsal", ["startedByMemberId"]);
register("openChapter addRitual recordRitualHeld setRitualState offerMove respondToMove completeMove recordWin keepWinAsMemory dismissWin closeChapter", ["memberId"]);
register("upsertCoworker importCoworkerRoster recordCoworkerAttendance", [
  "ownerMemberId",
]);
register("upsertWorkJob", ["job.memberId"]);
register(
  `setHouseholdTimezone addCategory setBudget archiveAccount markInvestmentValue applySitDown recordSitDownDrive ensureGoalsVault addRecurrence updateRecurrence adoptRhythm dismissRhythm pauseRecurrence skipOccurrence markDuplicate updateShiftSettings archiveWorkJob scribbleChalk neatenChalk wipeChalk reviseChalkInk reopenBooksMonth renameCompanion equipCosmetic recordHerculesTalk forgetHerculesMemory wipeHerculesChat submitClaim addPreset archivePreset acceptPresetNotice dismissNotice addAppointment updateAppointment addAccount updateAccount addGoal`,
);
for (const [name, index, path] of [
  ["eraseDevelopmentActivity", 0, ""],
  ["restoreSharedPoint", 1, ""],
  ["unlinkGoogleIdentity", 0, ""],
  ["touchGoogleConfirmation", 0, ""],
  ["postOneRecurrence", 2, "createdBy"],
  ["postDueRecurrences", 2, "createdBy"],
  ["contributeToGoal", 2, "createdBy"],
  ["reversePostedMoney", 1, "createdBy"],
  ["beginShiftBibleCorrection", 1, "createdBy"],
  ["acceptVisitGoal", 1, ""],
  ["resetTicTacToe", 0, ""],
  ["resetHangman", 0, ""],
] as const)
  policies.set(name, {
    fn: functions[name]!,
    bind: (args, actor) => bind(args, index, path, actor),
  });
policies.set("markDuplicate",{
  fn:functions.markDuplicate!,
  bind:(args,actor)=>{if(args.length>2&&reviewedDuplicateRequest(args[2],args[0],args[1]).memberId!==actor)throw Error("ACTOR_MISMATCH");},
});
policies.set("buildBatchImport", {
  fn: ((household: Household, input: Parameters<typeof buildBatchImport>[0]) =>
    buildBatchImport({ ...input, household })) as Fn,
  bind: (args, actor) => bind(args, 0, "memberId", actor),
});
export const registeredCommands = [...policies.keys()].sort();
export const dedicatedCommands: string[] = [];
function privateReferences(h: Household, args: unknown[], actor: string) {
  const text = JSON.stringify(args);
  for (const account of h.accounts)
    if (
      account.scope === "personal" &&
      account.ownerMemberId !== actor &&
      text.includes(JSON.stringify(account.id))
    )
      throw new Error("FORBIDDEN_ACCOUNT");
  const input = args[0] as Record<string, unknown> | undefined;
  if (input?.accountId) {
    const existing = h.accounts.find((a) => a.id === input.accountId);
    if (
      (input.scope ?? existing?.scope) === "personal" &&
      (input.ownerMemberId ?? existing?.ownerMemberId) !== actor
    )
      throw new Error("FORBIDDEN_ACCOUNT");
  }
  if (input?.scope === "personal" && input.ownerMemberId !== actor)
    throw new Error("FORBIDDEN_ACCOUNT");
  if (input?.shared === false && input.ownerMemberId !== actor)
    throw new Error("FORBIDDEN_GOAL");
}
export function executeIntent(
  household: Household,
  kind: string,
  rawArgs: unknown[],
  actor: string,
  commandId: string,
  scope?: Pick<Scope, "identity" | "role">,
): CommitResult {
  const policy = policies.get(kind);
  if (!policy)
    throw new ValidationError(
      `This action needs its dedicated authority: ${kind}.`,
    );
  if (["recordHerculesTalk", "forgetHerculesMemory", "wipeHerculesChat"].includes(kind)) throw new ValidationError("HERCULES_UPDATE_REQUIRED: The shared chat archive is read-only. Reload Hearth to use private conversations.");
  const args = structuredClone(rawArgs);
  policy.bind(args, actor);
  // Accepted Shared setup times belong to the authority, not a caller's clock.
  if (["recordChapterAcknowledgement", "recordObservedChapterCompletion"].includes(kind)
    && args[0] && typeof args[0] === "object") (args[0] as Record<string, unknown>).at = new Date().toISOString();
  privateReferences(household, args, actor);
  const input = args[0] as Record<string, unknown> | undefined;
  if (
    ["eraseDevelopmentActivity", "restoreSharedPoint"].includes(kind) &&
    (scope?.role !== "owner" || household.environment !== "development")
  )
    throw new Error("OWNER_REQUIRED");
  if (kind === "forceUnlockOnboarding" && scope?.role !== "owner")
    throw new Error("OWNER_REQUIRED");
  if (
    kind === "linkGoogleIdentity" &&
    (!scope?.identity ||
      input?.subject !== scope.identity.subject ||
      String(input.email).toLowerCase() !== scope.identity.email.toLowerCase())
  )
    throw new Error("VERIFIED_IDENTITY_REQUIRED");
  if (
    input?.visibility != null &&
    !["household", "personal", "both"].includes(String(input.visibility))
  )
    throw new Error("INVALID_VISIBILITY");
  if (
    (kind === "postEntry" || kind === "postTransfer") &&
    input &&
    (input.reversalOfId != null || input.source === "reversal")
  )
    throw new Error("USE_REVERSAL_COMMAND");
  if (kind === "setRecurrenceGoogleSync")
    for (const patch of args[0] as Array<{ memberId: string }>) {
      if (patch.memberId !== actor) throw new Error("ACTOR_MISMATCH");
    }
  if(kind==='executeHerculesAction' && input?.submissionId!==commandId)throw new Error('CONFIRMATION_ID_MISMATCH');
  if (["postOpeningBalances", "acceptReviewedAccountHistory"].includes(kind) && input) input.confirmationId = commandId;
  if (
    kind === "reconcileWorkWeekFromEvidence" &&
    Array.isArray(input?.replacements)
  )
    for (const replacement of input.replacements) {
      if (
        replacement.memberId !== actor ||
        (replacement.createdBy && replacement.createdBy !== actor)
      )
        throw new Error("ACTOR_MISMATCH");
    }
  if (
    kind === "archiveWorkJob" &&
    household.workJobs?.find((r) => r.id === args[0])?.memberId !== actor
  )
    throw new Error("FORBIDDEN_JOB");
  return policy.fn(household, ...(args as never[]));
}
