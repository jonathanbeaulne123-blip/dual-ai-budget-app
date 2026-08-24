import { NeedsConfirmationError, ValidationError } from "./types.ts";
import type { Household, SharingMode } from "./types.ts";

export type CommandErrorClass =
  | "validation-rejected"
  | "unbalanced-journal"
  | "books-unavailable"
  | "persist-failed"
  | "pending-transport"
  | "conflict-detected"
  | "disconnected";

export type CommandUiKind =
  | "saving"
  | "accepted-local"
  | "pending-transport"
  | "synchronized"
  | "rejected-no-write"
  | "retryable-failure"
  | "permanent-validation-failure"
  | "conflict-needs-attention"
  | "recovery-available";

export type CommandOutcome = {
  kind: CommandUiKind;
  ok: boolean;
  household: Household;
  previous: Household | null;
  postedIds: string[];
  confirmationId: string;
  identityHash: string | null;
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

export class BooksRejectedError extends Error {
  readonly errorClass: CommandErrorClass;
  constructor(message: string, errorClass: CommandErrorClass = "unbalanced-journal") {
    super(message);
    this.name = "BooksRejectedError";
    this.errorClass = errorClass;
  }
}

export function classifyCommandError(error: unknown): {
  errorClass: CommandErrorClass;
  userMessage: string;
  retryable: boolean;
  kind: CommandUiKind;
} {
  if (error instanceof NeedsConfirmationError) throw error;
  if (error instanceof ValidationError) {
    return {
      errorClass: "validation-rejected",
      userMessage: error.message,
      retryable: false,
      kind: "permanent-validation-failure",
    };
  }
  if (error instanceof BooksRejectedError) {
    return {
      errorClass: error.errorClass,
      userMessage: error.message,
      retryable: error.errorClass === "books-unavailable" || error.errorClass === "persist-failed",
      kind:
        error.errorClass === "unbalanced-journal" || error.errorClass === "validation-rejected"
          ? "permanent-validation-failure"
          : error.errorClass === "conflict-detected"
            ? "conflict-needs-attention"
            : "retryable-failure",
    };
  }
  const raw = error instanceof Error ? error.message : String(error);
  if (/quota|indexeddb|persist|save the ledger|localStorage/i.test(raw)) {
    return {
      errorClass: "persist-failed",
      userMessage: "The last valid household is still here. This phone could not save the new snapshot.",
      retryable: true,
      kind: "retryable-failure",
    };
  }
  if (/unbalanced|trial balance|accounting equation/i.test(raw)) {
    return {
      errorClass: "unbalanced-journal",
      userMessage: "The journal is not balanced. Nothing was posted.",
      retryable: false,
      kind: "permanent-validation-failure",
    };
  }
  if (/pglite|postgres|books|ingest/i.test(raw)) {
    return {
      errorClass: "books-unavailable",
      userMessage: "The books engine could not accept that change. Nothing was posted.",
      retryable: true,
      kind: "retryable-failure",
    };
  }
  return {
    errorClass: "books-unavailable",
    userMessage: "That change did not post. The previous household is still the live one.",
    retryable: true,
    kind: "retryable-failure",
  };
}

export function outcome(
  partial: Omit<CommandOutcome, "ok" | "postedExactlyOnce" | "postedNothing"> & {
    ok?: boolean;
    postedExactlyOnce?: boolean;
    postedNothing?: boolean;
  },
): CommandOutcome {
  const kind = partial.kind;
  const postedNothing = partial.postedNothing ?? (kind === "rejected-no-write" || kind === "permanent-validation-failure");
  const postedExactlyOnce =
    partial.postedExactlyOnce ??
    (kind === "accepted-local" || kind === "pending-transport" || kind === "synchronized");
  return {
    ...partial,
    ok: partial.ok ?? (kind === "accepted-local" || kind === "pending-transport" || kind === "synchronized"),
    postedExactlyOnce,
    postedNothing,
  };
}
