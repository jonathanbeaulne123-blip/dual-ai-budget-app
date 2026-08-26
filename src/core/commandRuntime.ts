import { booksEquation, compileHousehold, trialBalance, type CompiledBooks } from "./journal.ts";
import { ensureHouseholdShape } from "./sync.ts";
import {
  commandIdentityHash,
  financialAuditHash,
  findReceipt,
  newConfirmationId,
  rememberReceipt,
} from "./commandIdentity.ts";
import {
  BooksRejectedError,
  classifyCommandError,
  outcome,
  type CommandOutcome,
} from "./commandOutcome.ts";
import {
  deriveSharing,
  hostedTransportAllowed,
  markConflicted,
  markPendingTransport,
  markSynchronized,
  shapeSharing,
} from "./sharing.ts";
import { canAutoMergeConflict, recordConflict } from "./conflict.ts";
import type { CommandReceipt, Household } from "./types.ts";
import { NeedsConfirmationError } from "./types.ts";

export type BooksAcceptStatus = { ok: boolean; error?: string };

export type TransportResult =
  | { ok: true; remoteRevision?: number }
  | { ok: false; errorClass: "pending-transport" | "conflict-detected" | "disconnected"; remote?: Household; message: string };

export type WriteAdapters = {
  persist: (household: Household) => Promise<void>;
  ingest: (household: Household) => Promise<BooksAcceptStatus>;
  /** Optional post-ingest PGlite/canonical-hash check. Fail closed when provided and not ok. */
  verifyBooks?: (household: Household) => Promise<BooksAcceptStatus>;
  restoreIngest?: (household: Household) => Promise<void>;
  transport?: (household: Household, expectedRevision: number) => Promise<TransportResult>;
};

export type AcceptWriteInput = {
  previous: Household | null;
  candidate: Household;
  confirmationId?: string;
  commandKind?: string;
  postedIds?: string[];
  /** Explicit D-114 Google continuity transport; legacy callers still require linked=true. */
  transportRequested?: boolean;
  adapters: WriteAdapters;
};

export function assertAcceptableBooks(household: Household, compiled = compileHousehold(household)): CompiledBooks {
  for (const entry of compiled.entries) {
    const debit = entry.lines.reduce((sum, line) => sum + line.debitCents, 0);
    const credit = entry.lines.reduce((sum, line) => sum + line.creditCents, 0);
    if (debit !== credit) {
      throw new BooksRejectedError(
        `Journal ${entry.id} is unbalanced (${debit} debit / ${credit} credit). Nothing was posted.`,
        "unbalanced-journal",
      );
    }
    if (!Number.isInteger(debit) || !Number.isInteger(credit)) {
      throw new BooksRejectedError("Books only accept integer CAD cents. Nothing was posted.", "validation-rejected");
    }
  }
  const tb = trialBalance(compiled);
  const equation = booksEquation(compiled);
  if (!tb.inBalance) {
    throw new BooksRejectedError("The trial balance does not hold. Nothing was posted.", "unbalanced-journal");
  }
  if (!equation.holds) {
    throw new BooksRejectedError("The accounting equation does not hold. Nothing was posted.", "unbalanced-journal");
  }
  return compiled;
}

function failedOutcome(
  previous: Household | null,
  confirmationId: string,
  error: unknown,
  recoveryAvailable = false,
): CommandOutcome {
  const classified = classifyCommandError(error);
  const household = previous ?? ({ sharing: shapeSharing({ linked: false }), revision: 0 } as Household);
  return outcome({
    kind: recoveryAvailable && classified.retryable ? "recovery-available" : classified.kind === "permanent-validation-failure" ? "permanent-validation-failure" : classified.retryable ? "retryable-failure" : "rejected-no-write",
    household,
    previous,
    postedIds: [],
    confirmationId,
    identityHash: null,
    revision: previous?.revision ?? 0,
    sharingMode: previous ? deriveSharing(previous).mode : "local",
    errorClass: classified.errorClass,
    userMessage: classified.userMessage,
    retryable: classified.retryable,
    recoveryAvailable,
    postedExactlyOnce: false,
    postedNothing: true,
    ok: false,
  });
}

function uncertainRecoveryOutcome(
  previous: Household | null,
  confirmationId: string,
  error: unknown,
): CommandOutcome {
  const classified = classifyCommandError(error);
  const household = previous ?? ({ sharing: shapeSharing({ linked: false }), revision: 0 } as Household);
  return outcome({
    kind: "recovery-available",
    household,
    previous,
    postedIds: [],
    confirmationId,
    identityHash: null,
    revision: previous?.revision ?? 0,
    sharingMode: previous ? deriveSharing(previous).mode : "local",
    errorClass: classified.errorClass,
    userMessage:
      "The books engine accepted this entry, but this phone could not save the snapshot. Recovery is available. Do not Confirm again with a new id.",
    retryable: true,
    recoveryAvailable: true,
    postedExactlyOnce: false,
    postedNothing: false,
    ok: false,
  });
}

export async function acceptHouseholdWrite(input: AcceptWriteInput): Promise<CommandOutcome> {
  const confirmationId = input.confirmationId || newConfirmationId();
  const previous = input.previous ? ensureHouseholdShape(input.previous) : null;
  try {
    const candidate = ensureHouseholdShape(input.candidate);
    if (previous && candidate.environment !== previous.environment) {
      throw new BooksRejectedError("Development and Production stay on separate books. Nothing was posted.", "validation-rejected");
    }
    const postedIds = input.postedIds ?? [];
    const sameHousehold = Boolean(previous && previous.householdId === candidate.householdId);
    const identityHash = await commandIdentityHash(sameHousehold ? previous : null, candidate, postedIds);
    const existing = sameHousehold && previous ? findReceipt(previous, confirmationId) : undefined;
    if (existing && previous) {
      return outcome({
        kind: (hostedTransportAllowed(previous) || input.transportRequested) && previous.sharing?.pending ? "pending-transport" : previous.sharing?.mode === "synchronized" ? "synchronized" : "accepted-local",
        household: previous,
        previous,
        postedIds: existing.postedIds,
        confirmationId,
        identityHash: existing.identityHash,
        revision: existing.revision,
        sharingMode: deriveSharing(previous).mode,
        errorClass: null,
        userMessage: null,
        retryable: false,
        recoveryAvailable: false,
        duplicateOfReceiptId: existing.confirmationId,
        postedExactlyOnce: true,
        postedNothing: false,
      });
    }

    assertAcceptableBooks(candidate);

    const bumped = (sameHousehold ? previous?.revision ?? 0 : candidate.revision ?? 0) + 1;
    // Continuity absorb / conflict-local may already set tip+1 above previous+1.
    const revision = Math.max(bumped, candidate.revision ?? 0);
    const acceptedAt = new Date().toISOString();
    let accepted: Household = {
      ...candidate,
      revision,
      lastCommittedAt: candidate.lastCommittedAt ?? acceptedAt,
      sharing: shapeSharing(candidate),
      conflicts: candidate.conflicts ?? previous?.conflicts ?? [],
    };
    const receipt: CommandReceipt = {
      confirmationId,
      identityHash,
      auditHash: "",
      commandKind: input.commandKind ?? "commit",
      postedIds,
      revision,
      acceptedAt,
    };
    accepted = rememberReceipt(accepted, receipt);
    accepted.booksAcceptedHash = await financialAuditHash(accepted);
    accepted = rememberReceipt(accepted, { ...receipt, auditHash: accepted.booksAcceptedHash });

    try {
      const status = await input.adapters.ingest(accepted);
      if (!status.ok) {
        const message = status.error || "PGlite rejected the journal. Nothing was posted.";
        const errorClass = /unbalanced|trial balance|accounting equation/i.test(message)
          ? "unbalanced-journal"
          : "books-unavailable";
        throw new BooksRejectedError(message, errorClass);
      }
      if (input.adapters.verifyBooks) {
        const verified = await input.adapters.verifyBooks(accepted);
        if (!verified.ok) {
          throw new BooksRejectedError(
            verified.error || "PGlite and the snapshot hash do not agree. Nothing was posted.",
            "books-unavailable",
          );
        }
      }
      const expectedHash = accepted.booksAcceptedHash;
      const recomputed = await financialAuditHash(accepted);
      if (expectedHash && expectedHash !== recomputed) {
        throw new BooksRejectedError(
          "The accepted books hash changed during ingest. Nothing was posted.",
          "books-unavailable",
        );
      }
    } catch (error) {
      if (error instanceof NeedsConfirmationError) throw error;
      const booksError = error instanceof BooksRejectedError
        ? error
        : new BooksRejectedError(
            error instanceof Error ? error.message : String(error),
            "books-unavailable",
          );
      if (previous && input.adapters.restoreIngest) {
        try {
          await input.adapters.restoreIngest(previous);
          return failedOutcome(previous, confirmationId, booksError, true);
        } catch {
          return uncertainRecoveryOutcome(previous, confirmationId, booksError);
        }
      }
      return failedOutcome(previous, confirmationId, booksError);
    }

    try {
      await input.adapters.persist(accepted);
    } catch {
      const persistError = new BooksRejectedError(
        "The last valid household is still here. This phone could not save the new snapshot.",
        "persist-failed",
      );
      if (previous && input.adapters.restoreIngest) {
        try {
          await input.adapters.restoreIngest(previous);
          return failedOutcome(previous, confirmationId, persistError, true);
        } catch {
          return uncertainRecoveryOutcome(previous, confirmationId, persistError);
        }
      }
      return uncertainRecoveryOutcome(previous, confirmationId, persistError);
    }

    const transportAllowed = hostedTransportAllowed(accepted) || input.transportRequested === true;
    if (!transportAllowed || !input.adapters.transport) {
      return outcome({
        kind: "accepted-local",
        household: accepted,
        previous,
        postedIds,
        confirmationId,
        identityHash,
        revision,
        sharingMode: deriveSharing(accepted).mode,
        errorClass: null,
        userMessage: null,
        retryable: false,
        recoveryAvailable: false,
      });
    }

    const expectedRevision = sameHousehold
      ? (previous?.baseRevision ?? Math.max(0, (previous?.revision ?? revision) - 1))
      : (candidate.baseRevision ?? candidate.revision ?? 0);
    try {
      const transported = await input.adapters.transport(accepted, expectedRevision);
      if (transported.ok) {
        const synced = markSynchronized(accepted);
        try {
          await input.adapters.persist(synced);
        } catch {
          return outcome({
            kind: "pending-transport",
            household: markPendingTransport(accepted, "Saved locally. Share is still waiting."),
            previous,
            postedIds,
            confirmationId,
            identityHash,
            revision,
            sharingMode: "pending-transport",
            errorClass: "pending-transport",
            userMessage: "Saved on this phone. Sharing can retry from More.",
            retryable: true,
            recoveryAvailable: false,
            ok: true,
            postedExactlyOnce: true,
            postedNothing: false,
          });
        }
        return outcome({
          kind: "synchronized",
          household: synced,
          previous,
          postedIds,
          confirmationId,
          identityHash,
          revision,
          sharingMode: "synchronized",
          errorClass: null,
          userMessage: null,
          retryable: false,
          recoveryAvailable: false,
        });
      }
      if (transported.errorClass === "conflict-detected" && transported.remote) {
        const auto = canAutoMergeConflict(accepted, transported.remote);
        let conflicted = await recordConflict(accepted, transported.remote, auto);
        if (auto) {
          try {
            const status = await input.adapters.ingest(conflicted);
            if (!status.ok) throw new Error("auto-merge ingest refused");
          } catch {
            conflicted = await recordConflict(accepted, transported.remote, false);
            try {
              await input.adapters.persist(conflicted);
            } catch {
              /* keep the unresolved bundle in memory */
            }
            return outcome({
              kind: "conflict-needs-attention",
              household: conflicted,
              previous,
              postedIds,
              confirmationId,
              identityHash,
              revision,
              sharingMode: "conflicted",
              errorClass: "conflict-detected",
              userMessage:
                "This phone and the shared copy both have new work. Auto-merge did not reach the books. Nothing was overwritten.",
              retryable: true,
              recoveryAvailable: true,
              ok: true,
              postedExactlyOnce: true,
              postedNothing: false,
            });
          }
          try {
            await input.adapters.persist(conflicted);
          } catch {
            let booksRestored = false;
            if (input.adapters.restoreIngest) {
              try {
                await input.adapters.restoreIngest(accepted);
                booksRestored = true;
              } catch {
                /* recovery stays explicitly uncertain */
              }
            }
            conflicted = await recordConflict(accepted, transported.remote, false);
            return outcome({
              kind: "conflict-needs-attention",
              household: conflicted,
              previous,
              postedIds,
              confirmationId,
              identityHash,
              revision: conflicted.revision,
              sharingMode: "conflicted",
              errorClass: "conflict-detected",
              userMessage: booksRestored
                ? "The local post is safe, but this phone could not save the automatic merge. Both sides are still available."
                : "The books accepted an automatic merge, but this phone could not save or restore it. Recovery is available; do not Confirm again.",
              retryable: true,
              recoveryAvailable: true,
              ok: true,
              postedExactlyOnce: true,
              postedNothing: false,
            });
          }
        } else {
          try {
            await input.adapters.persist(conflicted);
          } catch {
            return outcome({
              kind: "conflict-needs-attention",
              household: conflicted,
              previous,
              postedIds,
              confirmationId,
              identityHash,
              revision: conflicted.revision,
              sharingMode: "conflicted",
              errorClass: "conflict-detected",
              userMessage:
                "This phone and the shared copy both have new work. The conflict is in memory but could not be saved. Recovery is available.",
              retryable: true,
              recoveryAvailable: true,
              ok: true,
              postedExactlyOnce: true,
              postedNothing: false,
            });
          }
        }
        return outcome({
          kind: auto ? "accepted-local" : "conflict-needs-attention",
          household: conflicted,
          previous,
          postedIds,
          confirmationId,
          identityHash,
          revision: conflicted.revision,
          sharingMode: auto ? deriveSharing(conflicted).mode : "conflicted",
          errorClass: auto ? null : "conflict-detected",
          userMessage: auto ? null : "This phone and the shared copy both have new work. Nothing was overwritten.",
          retryable: !auto,
          recoveryAvailable: !auto,
          ok: true,
          postedExactlyOnce: true,
          postedNothing: false,
        });
      }
      const pending = markPendingTransport(accepted, transported.message);
      try {
        await input.adapters.persist(pending);
      } catch {
        /* local books already accepted */
      }
      return outcome({
        kind: transported.errorClass === "conflict-detected" ? "conflict-needs-attention" : "pending-transport",
        household: transported.errorClass === "conflict-detected" ? markConflicted(accepted, transported.message) : pending,
        previous,
        postedIds,
        confirmationId,
        identityHash,
        revision,
        sharingMode: transported.errorClass === "conflict-detected" ? "conflicted" : "pending-transport",
        errorClass: transported.errorClass,
        userMessage: transported.message,
        retryable: true,
        recoveryAvailable: transported.errorClass === "conflict-detected",
        ok: true,
        postedExactlyOnce: true,
        postedNothing: false,
      });
    } catch (error) {
      const pending = markPendingTransport(accepted, "Saved on this phone. Sharing can retry from More.");
      try {
        await input.adapters.persist(pending);
      } catch {
        /* already accepted locally */
      }
      return outcome({
        kind: "pending-transport",
        household: pending,
        previous,
        postedIds,
        confirmationId,
        identityHash,
        revision,
        sharingMode: "pending-transport",
        errorClass: "pending-transport",
        userMessage: error instanceof Error ? "Saved on this phone. Sharing can retry from More." : "Saved on this phone. Sharing can retry from More.",
        retryable: true,
        recoveryAvailable: false,
        ok: true,
        postedExactlyOnce: true,
        postedNothing: false,
      });
    }
  } catch (error) {
    if (error instanceof NeedsConfirmationError) throw error;
    return failedOutcome(previous, confirmationId, error);
  }
}
