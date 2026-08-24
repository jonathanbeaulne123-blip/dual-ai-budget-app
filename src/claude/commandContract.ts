import type { CommandErrorClass, CommandOutcome, CommandUiKind } from "../core/commandOutcome.ts";
import type { SharingMode } from "../core/types.ts";

/**
 * Claude-facing command surface. Presentation may render these fields.
 * It must not infer posting from toast timing or generic exceptions.
 */
export type CommandSurfaceState = {
  kind: CommandUiKind;
  ok: boolean;
  confirmationId: string;
  revision: number;
  sharingMode: SharingMode;
  errorClass: CommandErrorClass | null;
  userMessage: string | null;
  retryable: boolean;
  postedExactlyOnce: boolean;
  postedNothing: boolean;
  recoveryAvailable: boolean;
  duplicateOfReceiptId?: string;
};

export type CommandRetryRule =
  | "do-not-retry"
  | "retry-same-confirmation"
  | "wait-for-human-conflict"
  | "open-recovery";

export function toCommandSurface(outcome: CommandOutcome): CommandSurfaceState {
  return {
    kind: outcome.kind,
    ok: outcome.ok,
    confirmationId: outcome.confirmationId,
    revision: outcome.revision,
    sharingMode: outcome.sharingMode,
    errorClass: outcome.errorClass,
    userMessage: outcome.userMessage,
    retryable: outcome.retryable,
    postedExactlyOnce: outcome.postedExactlyOnce,
    postedNothing: outcome.postedNothing,
    recoveryAvailable: outcome.recoveryAvailable,
    duplicateOfReceiptId: outcome.duplicateOfReceiptId,
  };
}

export function retryRuleFor(state: CommandSurfaceState): CommandRetryRule {
  if (state.kind === "conflict-needs-attention") return "wait-for-human-conflict";
  if (state.kind === "recovery-available") return "open-recovery";
  if (state.retryable) return "retry-same-confirmation";
  return "do-not-retry";
}

export function guaranteesPostedNothing(state: CommandSurfaceState): boolean {
  return state.postedNothing === true && state.postedExactlyOnce === false;
}

export function guaranteesPostedExactlyOnce(state: CommandSurfaceState): boolean {
  return state.postedExactlyOnce === true && state.postedNothing === false;
}

export const COMMAND_SURFACE_FIXTURES: Record<
  | "saving"
  | "accepted-local"
  | "pending-transport"
  | "synchronized"
  | "rejected-no-write"
  | "retryable-failure"
  | "permanent-validation-failure"
  | "conflict-needs-attention"
  | "recovery-available",
  CommandSurfaceState
> = {
  saving: {
    kind: "saving",
    ok: false,
    confirmationId: "fixture-saving",
    revision: 0,
    sharingMode: "local",
    errorClass: null,
    userMessage: null,
    retryable: false,
    postedExactlyOnce: false,
    postedNothing: false,
    recoveryAvailable: false,
  },
  "accepted-local": {
    kind: "accepted-local",
    ok: true,
    confirmationId: "fixture-local",
    revision: 1,
    sharingMode: "local",
    errorClass: null,
    userMessage: null,
    retryable: false,
    postedExactlyOnce: true,
    postedNothing: false,
    recoveryAvailable: false,
  },
  "pending-transport": {
    kind: "pending-transport",
    ok: true,
    confirmationId: "fixture-pending",
    revision: 2,
    sharingMode: "pending-transport",
    errorClass: "pending-transport",
    userMessage: "Saved on this phone. Sharing can retry from More.",
    retryable: true,
    postedExactlyOnce: true,
    postedNothing: false,
    recoveryAvailable: false,
  },
  synchronized: {
    kind: "synchronized",
    ok: true,
    confirmationId: "fixture-synced",
    revision: 3,
    sharingMode: "synchronized",
    errorClass: null,
    userMessage: null,
    retryable: false,
    postedExactlyOnce: true,
    postedNothing: false,
    recoveryAvailable: false,
  },
  "rejected-no-write": {
    kind: "rejected-no-write",
    ok: false,
    confirmationId: "fixture-rejected",
    revision: 1,
    sharingMode: "local",
    errorClass: "validation-rejected",
    userMessage: "That change did not post. The previous household is still the live one.",
    retryable: false,
    postedExactlyOnce: false,
    postedNothing: true,
    recoveryAvailable: false,
  },
  "retryable-failure": {
    kind: "retryable-failure",
    ok: false,
    confirmationId: "fixture-retry",
    revision: 1,
    sharingMode: "local",
    errorClass: "books-unavailable",
    userMessage: "The books engine could not accept that change. Nothing was posted.",
    retryable: true,
    postedExactlyOnce: false,
    postedNothing: true,
    recoveryAvailable: false,
  },
  "permanent-validation-failure": {
    kind: "permanent-validation-failure",
    ok: false,
    confirmationId: "fixture-invalid",
    revision: 1,
    sharingMode: "local",
    errorClass: "unbalanced-journal",
    userMessage: "The journal is not balanced. Nothing was posted.",
    retryable: false,
    postedExactlyOnce: false,
    postedNothing: true,
    recoveryAvailable: false,
  },
  "conflict-needs-attention": {
    kind: "conflict-needs-attention",
    ok: true,
    confirmationId: "fixture-conflict",
    revision: 4,
    sharingMode: "conflicted",
    errorClass: "conflict-detected",
    userMessage: "This phone and the shared copy both have new work. Nothing was overwritten.",
    retryable: true,
    postedExactlyOnce: true,
    postedNothing: false,
    recoveryAvailable: true,
  },
  "recovery-available": {
    kind: "recovery-available",
    ok: false,
    confirmationId: "fixture-recovery",
    revision: 1,
    sharingMode: "local",
    errorClass: "persist-failed",
    userMessage: "The last valid household is still here. This phone could not save the new snapshot.",
    retryable: true,
    postedExactlyOnce: false,
    postedNothing: true,
    recoveryAvailable: true,
  },
};
