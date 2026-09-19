import { householdFundMarker, personalFundMarker } from "./core/fundRules.ts";
import { householdPlanGuard, migrateFundModel, migrateMyFundModel, personalPlanGuard } from "./core/fundModelCommands.ts";
import type { CommitResult, Household } from "./core/types.ts";
import { clientFundModelVersion, fundModelReloadRequired } from "./ledgerSync/fundModelStamp.ts";

/**
 * Money model boot (D-269, adopt on patch).
 *
 * Release N+1 (flag on) sorts the household the first time an active member's
 * phone opens it, then sorts that member's own private rows on that same
 * phone. Before the household step the phone saves an automatic local
 * snapshot (Q-D default: an export, not an in-app undo). Release N never
 * migrates; it only shows the reload banner once someone else has.
 *
 * Returns the step this phone should take now, or null. Pure apart from the
 * snapshot write, so the App's effect stays a one-liner.
 */
export type FundModelBootStep =
  | { kind: "household"; run: (current: Household) => CommitResult }
  | { kind: "personal"; run: (current: Household) => CommitResult };

export function fundModelBootStep(household: Household, memberId: string, clientVersion: 1 | 2 = clientFundModelVersion()): FundModelBootStep | null {
  if (clientVersion !== 2) return null;
  if (!household.members.some((member) => member.active && member.id === memberId)) return null;
  if (!householdFundMarker(household)) {
    if (householdPlanGuard(household)) return null;
    return { kind: "household", run: (current) => migrateFundModel(current, { memberId }) };
  }
  if (!personalFundMarker(household, memberId) && !personalPlanGuard(household, memberId)) {
    return { kind: "personal", run: (current) => migrateMyFundModel(current, { memberId }) };
  }
  return null;
}

/**
 * Why this phone is not sorting yet, in words (review M5): a plan that still keeps
 * bills in Protect stops the step, and the couple should hear it instead of silence.
 */
export function fundModelBootNotice(household: Household, memberId: string, clientVersion: 1 | 2 = clientFundModelVersion()): string | null {
  if (clientVersion !== 2 || !household.members.some((member) => member.active && member.id === memberId)) return null;
  if (!householdFundMarker(household)) return householdPlanGuard(household);
  if (!personalFundMarker(household, memberId)) return personalPlanGuard(household, memberId);
  return null;
}

/** Another phone sorted first: the refusal is expected and says nothing new. */
export function harmlessFundModelBootRefusal(message: string | null | undefined): boolean {
  return /already sorted the new way/i.test(message ?? "");
}

export const fundModelSnapshotKey = (household: Pick<Household, "environment" | "householdId">, memberId: string) =>
  `hearth:fund-model-before:${household.environment}:${household.householdId}:${memberId}`;

/** Best effort: keep this phone's pre-migration copy. Returns false when storage refused it; the migration still runs. */
export function saveFundModelSnapshot(household: Household, memberId: string, storage: Pick<Storage, "setItem"> | null = typeof localStorage === "undefined" ? null : localStorage): boolean {
  if (!storage) return false;
  try {
    storage.setItem(fundModelSnapshotKey(household, memberId), JSON.stringify({ savedAt: new Date().toISOString(), revision: household.revision, household }));
    return true;
  } catch {
    return false;
  }
}

export { fundModelReloadRequired };
