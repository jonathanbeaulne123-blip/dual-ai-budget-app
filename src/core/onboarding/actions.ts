import type { Household } from "../types.ts";
import type { ChapterId, SemanticActionKind } from "./types.ts";

export type SemanticAction = {
  kind: SemanticActionKind;
  chapterId: ChapterId;
  memberId: string;
  revision: string | null;
  origin: "button" | "affirmative";
  at: string;
};

export type ActionOutcome =
  | { kind: "local"; nextResumePoint: string }
  | { kind: "command"; command: string }
  | { kind: "refused"; reason: string };

export const AFFIRMATIVE_ALLOWED: readonly SemanticActionKind[] = ["continue", "pause", "reopen"];

const REVISION_BOUND: readonly SemanticActionKind[] = ["submit", "approve", "edit"];
const COMMAND_ACTIONS: readonly SemanticActionKind[] = ["stop-setup", "skip-personal", "submit", "approve"];

/**
 * Resolve intent only. Execution and mutation remain behind their existing command boundaries.
 */
export function resolveAction(household: Household, action: SemanticAction): ActionOutcome {
  if (action.origin === "affirmative" && !AFFIRMATIVE_ALLOWED.includes(action.kind)) {
    return { kind: "refused", reason: "Typed text cannot perform that action." };
  }
  if (REVISION_BOUND.includes(action.kind) && action.revision !== String(household.revision)) {
    return { kind: "refused", reason: "This onboarding step changed. Review it again." };
  }
  if (COMMAND_ACTIONS.includes(action.kind)) {
    return { kind: "command", command: action.kind };
  }
  return { kind: "local", nextResumePoint: action.chapterId };
}
