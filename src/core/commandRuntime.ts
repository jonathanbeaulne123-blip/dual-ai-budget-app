import { booksEquation, compileHousehold, trialBalance, type CompiledBooks } from "./journal.ts";
import { ensureHouseholdShape } from "./sync.ts";
import {
  commandIdentityHash,
  commandMaterializationFacts,
  financialAuditHash,
  financialAuditHashForScope,
  findReceipt,
  newConfirmationId,
  rememberReceipt,
  sha256Hex,
} from "./commandIdentity.ts";
import {
  BooksRejectedError,
  classifyCommandError,
  outcome,
  type CommandOutcome,
} from "./commandOutcome.ts";
import {
  deriveSharing,
  markPendingTransport,
  markSynchronized,
  shapeSharing,
} from "./sharing.ts";
import { assembleHousehold, splitForSync } from "./sync.ts";
import { autoResolveSharedConflict, unresolvedConflicts } from "./conflict.ts";
import { assertHouseholdFundTransition } from "./householdFund.ts";
import {
  actorMayApplyHouseholdOnboardingTransition,
  acceptedHouseholdOnboarding,
} from "./onboarding/mode.ts";
import { shapeWeeklyDocumentStamps } from "./weeklyDocumentStamp.ts";
import { assertOnboardingSubmissionTransition, currentSubmission } from "./onboarding/submissions.ts";
import { assertOnboardingEstimateSubmissionScope } from "./onboarding/estimates.ts";
import { assertOnboardingCategoryMergeTransition } from "./onboarding/categories.ts";
import { assertOnboardingApprovalTransition } from "./onboarding/approvals.ts";
import {
  assertOnboardingCompletionTransition,
  assertReadyApprovalPrerequisites,
} from "./onboarding/ready.ts";
import {
  assertOnboardingAdoptionTransition,
  ONBOARDING_ADOPTION_COMMAND_KIND,
} from "./onboarding/adoption.ts";
import type { CommandReceipt, Household, PersonalEnvelope } from "./types.ts";
import { NeedsConfirmationError, ValidationError } from "./types.ts";
import { measureHearth, measureHearthSync } from "../performanceMetrics.ts";

export type BooksAcceptStatus = { ok: boolean; error?: string };

export type AcceptedBooksArtifact = {
  compiled: CompiledBooks;
  auditHash: string;
};

export type TransportResult =
  | { ok: true; remoteRevision?: number; remote?: Household; remotePersonal?: PersonalEnvelope }
  | {
      ok: false;
      errorClass: "pending-transport" | "conflict-detected" | "disconnected";
      remote?: Household;
      remotePersonal?: PersonalEnvelope;
      /** Compare-cancel the exact losing durable generation only after canonical local repair succeeds. */
      finalizeConflict?: () => Promise<boolean>;
      message: string;
    };

export type WriteAdapters = {
  persist: (household: Household) => Promise<void>;
  ingest: (household: Household, artifact?: AcceptedBooksArtifact & { previous: Household | null }) => Promise<BooksAcceptStatus>;
  /** Isolated PGlite/Postgres validation that must not mutate the active replica. */
  validateCandidate?: (household: Household, artifact?: AcceptedBooksArtifact & { previous: Household | null }) => Promise<BooksAcceptStatus>;
  /** Recreates the disposable active replica after cloud ack if its normal ingest fails. */
  repairIngest?: (household: Household, artifact?: AcceptedBooksArtifact) => Promise<BooksAcceptStatus>;
  /** Clears the isolated staged candidate after a definitive outcome. */
  clearCandidate?: (household: Household) => Promise<void>;
  /** Optional post-ingest PGlite/canonical-hash check. Fail closed when provided and not ok. */
  verifyBooks?: (household: Household, artifact?: AcceptedBooksArtifact) => Promise<BooksAcceptStatus>;
  restoreIngest?: (household: Household) => Promise<void>;
  transport?: (household: Household, expectedRevision: number) => Promise<TransportResult>;
};

export type AcceptWriteInput = {
  previous: Household | null;
  candidate: Household;
  confirmationId?: string;
  commandKind?: string;
  postedIds?: string[];
  /** Authenticated/local active member performing this command. Required for member-owned weekly stamps. */
  actingMemberId?: string;
  /** Explicit continuity transport request (App sets this for membership-matched Google continuity). `linked` alone never enables transport (D-147). */
  transportRequested?: boolean;
  /** Launch mode: cloud acknowledgement is the commit boundary; no accepted-local fallback is permitted. */
  requireSynchronized?: boolean;
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

function transportUncertainOutcome(
  previous: Household | null,
  confirmationId: string,
  message: string,
): CommandOutcome {
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
    errorClass: "pending-transport",
    userMessage: message || "Hearth could not confirm the shared result yet. It will check the same Confirm before another change is allowed.",
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
    if (input.commandKind?.endsWith("HouseholdOnboarding")) {
      const incoming = acceptedHouseholdOnboarding(candidate);
      if (!previous
        || !input.actingMemberId
        || !incoming
        || postedIds.length !== 1
        || postedIds[0] !== incoming.id
        || !actorMayApplyHouseholdOnboardingTransition({
          household: previous,
          incoming,
          commandKind: input.commandKind,
          actingMemberId: input.actingMemberId,
        })) {
        throw new BooksRejectedError(
          "Household setup can record only the signed-in member's action. Nothing changed.",
          "validation-rejected",
        );
      }
    }
    if (input.commandKind === "stampWeeklyDocument") {
      if (!previous) {
        throw new BooksRejectedError("Open accepted household books before stamping. Nothing changed.", "validation-rejected");
      }
      const previousStamps = shapeWeeklyDocumentStamps(previous.weeklyDocumentStamps, previous.members);
      const candidateStamps = shapeWeeklyDocumentStamps(candidate.weeklyDocumentStamps, candidate.members);
      const previousById = new Map(previousStamps.map((stamp) => [stamp.id, stamp]));
      const newStamps = candidateStamps.filter((stamp) => !previousById.has(stamp.id));
      const existingUnchanged = previousStamps.every((stamp) => {
        const retained = candidateStamps.find((candidateStamp) => candidateStamp.id === stamp.id);
        return retained && JSON.stringify(retained) === JSON.stringify(stamp);
      });
      const otherwiseUnchanged = JSON.stringify({
        ...candidate,
        weeklyDocumentStamps: previousStamps,
        lastCommittedAt: previous.lastCommittedAt,
      }) === JSON.stringify(previous);
      if (!input.actingMemberId
        || !candidate.members.some((member) => member.active && member.id === input.actingMemberId)
        || postedIds.length !== 1
        || newStamps.length !== 1
        || candidateStamps.length !== previousStamps.length + 1
        || newStamps[0]!.id !== postedIds[0]
        || newStamps[0]!.memberId !== input.actingMemberId
        || !existingUnchanged
        || !otherwiseUnchanged) {
        throw new BooksRejectedError("You can stamp only your own weekly line. Nothing changed.", "validation-rejected");
      }
    }
    const sameHousehold = Boolean(previous && previous.householdId === candidate.householdId);
    if (input.commandKind === ONBOARDING_ADOPTION_COMMAND_KIND
      && (!sameHousehold
        || !input.actingMemberId
        || !previous?.members.some((member) => member.active && member.id === input.actingMemberId))) {
      throw new ValidationError("Only an active household member can adopt the first plan.");
    }
    const identityHash = await commandIdentityHash(sameHousehold ? previous : null, candidate, postedIds);
    const existing = sameHousehold && previous ? findReceipt(previous, confirmationId) : undefined;
    if (existing && previous) {
      return outcome({
        kind: input.transportRequested && previous.sharing?.pending ? "pending-transport" : previous.sharing?.mode === "synchronized" ? "synchronized" : "accepted-local",
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

    assertHouseholdFundTransition(previous, candidate);
    const isOnboardingSubmissionCommand = input.commandKind === "submitOnboardingCategories"
      || input.commandKind === "submitOnboardingEstimates";
    const onboardingSubmissionStateChanged = JSON.stringify(previous?.onboardingSubmissions ?? [])
      !== JSON.stringify(candidate.onboardingSubmissions ?? []);
    if (isOnboardingSubmissionCommand || onboardingSubmissionStateChanged) {
      assertOnboardingSubmissionTransition(previous, candidate, {
        actorMemberId: input.actingMemberId,
        commandKind: input.commandKind,
        postedIds,
      });
      if (input.commandKind === "submitOnboardingEstimates" && input.actingMemberId) {
        if (!previous) throw new ValidationError("Only you can submit your own.");
        const estimateSubmission = currentSubmission(candidate, input.actingMemberId, "estimates");
        if (!estimateSubmission) throw new ValidationError("Only you can submit your own.");
        assertOnboardingEstimateSubmissionScope(previous, estimateSubmission);
      }
    }
    const onboardingCategoryMergeStateChanged = JSON.stringify(previous?.onboardingCategoryMerges ?? [])
      !== JSON.stringify(candidate.onboardingCategoryMerges ?? []);
    if (input.commandKind === "mergeOnboardingCategories" || onboardingCategoryMergeStateChanged) {
      assertOnboardingCategoryMergeTransition(previous, candidate, {
        actorMemberId: input.actingMemberId,
        commandKind: input.commandKind,
        postedIds,
      });
    }
    const isOnboardingApprovalCommand = input.commandKind === "approveOnboardingProposal"
      || input.commandKind === "approveOnboardingReady";
    const onboardingApprovalStateChanged = JSON.stringify(previous?.onboardingApprovals ?? [])
      !== JSON.stringify(candidate.onboardingApprovals ?? []);
    if (isOnboardingApprovalCommand || onboardingApprovalStateChanged) {
      assertOnboardingApprovalTransition(previous, candidate, {
        actorMemberId: input.actingMemberId,
        commandKind: input.commandKind,
        postedIds,
      });
      if (input.commandKind === "approveOnboardingReady" && previous && input.actingMemberId) {
        assertReadyApprovalPrerequisites(previous, candidate, input.actingMemberId);
      }
    }
    if (input.commandKind === "completeHouseholdOnboarding" && previous) {
      assertOnboardingCompletionTransition(previous, candidate);
    }
    if (input.commandKind === ONBOARDING_ADOPTION_COMMAND_KIND) {
      assertOnboardingAdoptionTransition(previous, candidate, {
        actorMemberId: input.actingMemberId,
        commandKind: input.commandKind,
        confirmationId,
        postedIds,
      });
    }
    const candidateCompiled = measureHearthSync(
      "hearth:command:compile",
      () => assertAcceptableBooks(candidate),
    );

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
      materializationHash: input.commandKind === "updateMonthRehearsal"
        ? await sha256Hex(commandMaterializationFacts({ monthRehearsals: accepted.monthRehearsals ?? [] }))
        : input.commandKind === "moveAskGoalClaimToNextMonth"
          ? await sha256Hex(commandMaterializationFacts({
            recurrences: accepted.recurrences.filter((row) => postedIds.includes(row.id)),
          }))
          : input.commandKind === "stampWeeklyDocument"
            ? await sha256Hex(shapeWeeklyDocumentStamps(
              accepted.weeklyDocumentStamps,
              accepted.members,
            ).filter((row) => postedIds.includes(row.id)))
            : input.commandKind?.endsWith("HouseholdOnboarding") && accepted.householdOnboarding
              ? await sha256Hex(commandMaterializationFacts({ householdOnboarding: accepted.householdOnboarding }))
              : input.commandKind?.startsWith("submitOnboarding")
                ? await sha256Hex(commandMaterializationFacts({
                  onboardingSubmissions: (accepted.onboardingSubmissions ?? [])
                    .filter((row) => postedIds.includes(row.id)),
                  onboardingCategoryProposals: (accepted.onboardingCategoryProposals ?? [])
                    .filter((row) => postedIds.includes(row.id)),
                }))
              : input.commandKind === "mergeOnboardingCategories"
                ? await sha256Hex(commandMaterializationFacts({
                  onboardingCategoryMerges: (accepted.onboardingCategoryMerges ?? [])
                    .filter((row) => postedIds.includes(row.id)),
                  categories: accepted.categories.filter((row) => postedIds.includes(row.id)),
                }))
              : input.commandKind === "approveOnboardingProposal" || input.commandKind === "approveOnboardingReady"
                ? await sha256Hex(commandMaterializationFacts({
                  onboardingApprovals: (accepted.onboardingApprovals ?? [])
                    .filter((row) => postedIds.includes(row.id)),
                }))
              : input.commandKind === ONBOARDING_ADOPTION_COMMAND_KIND
                ? await sha256Hex(commandMaterializationFacts({
                  budgetPlans: accepted.budgetPlans.filter((row) => postedIds.includes(row.id)),
                }))
            : undefined,
      postedIds,
      revision,
      acceptedAt,
    };
    accepted = rememberReceipt(accepted, receipt);
    accepted.booksAcceptedHash = await financialAuditHash(accepted);
    const validatedActingMemberId = input.actingMemberId
      && accepted.members.some((member) => member.active && member.id === input.actingMemberId)
      ? input.actingMemberId
      : null;
    const actorMemberId = validatedActingMemberId ?? [
      ...accepted.transactions.filter((row) => postedIds.includes(row.id)).map((row) => row.createdBy),
      ...accepted.shifts.filter((row) => postedIds.includes(row.id)).map((row) => row.createdBy),
      ...(accepted.fundEvents ?? []).filter((row) => postedIds.includes(row.id)).map((row) => row.createdBy),
      ...(accepted.weeklyDocumentStamps ?? []).filter((row) => postedIds.includes(row.id)).map((row) => row.memberId),
      ...(accepted.onboardingSubmissions ?? []).filter((row) => postedIds.includes(row.id)).map((row) => row.memberId),
      ...(accepted.onboardingCategoryProposals ?? []).filter((row) => postedIds.includes(row.id)).map((row) => row.memberId),
      ...(accepted.onboardingCategoryMerges ?? []).filter((row) => postedIds.includes(row.id)).map((row) => row.mergedByMemberId),
    ].find(Boolean) ?? accepted.members.find((member) => member.active)?.id ?? accepted.members[0]?.id ?? "MEM-001";
    accepted = rememberReceipt(accepted, {
      ...receipt,
      auditHash: accepted.booksAcceptedHash,
      scopedAuditHashes: {
        shared: await financialAuditHashForScope(accepted, "shared", actorMemberId),
        personal: await financialAuditHashForScope(accepted, "personal", actorMemberId),
      },
    });
    let acceptedArtifact: AcceptedBooksArtifact = {
      compiled: {
        ...candidateCompiled,
        revision: accepted.revision,
        lastCommittedAt: accepted.lastCommittedAt,
      },
      auditHash: accepted.booksAcceptedHash!,
    };

    const transportAllowed = input.transportRequested === true;
    let cloudAcknowledged = false;
    const clearCandidate = async () => {
      const cleanup = Promise.resolve()
        .then(() => input.adapters.clearCandidate?.(accepted))
        .catch(() => undefined);
      // The stage is isolated and never authoritative. Its generation is
      // invalidated synchronously by the browser adapter, so a slow IndexedDB
      // close/delete must not leave the visible command stuck on Saving.
      await Promise.race([
        cleanup,
        new Promise<void>((resolve) => setTimeout(resolve, 100)),
      ]);
    };
    if (input.requireSynchronized) {
      if (!input.adapters.validateCandidate) {
        return failedOutcome(
          previous,
          confirmationId,
          new BooksRejectedError(
            "The isolated books validator is unavailable. Nothing was posted.",
            "books-unavailable",
          ),
        );
      }
      try {
        const staged = await measureHearth(
          "hearth:command:books-stage",
          () => input.adapters.validateCandidate!(accepted, { ...acceptedArtifact, previous }),
        );
        if (!staged.ok) {
          await clearCandidate();
          return failedOutcome(
            previous,
            confirmationId,
            new BooksRejectedError(staged.error || "PGlite rejected the staged journal. Nothing was posted.", "books-unavailable"),
          );
        }
      } catch (error) {
        await clearCandidate();
        return failedOutcome(
          previous,
          confirmationId,
          new BooksRejectedError(
            error instanceof Error ? error.message : String(error),
            "books-unavailable",
          ),
        );
      }
      if (!transportAllowed || !input.adapters.transport) {
        await clearCandidate();
        return failedOutcome(
          previous,
          confirmationId,
          new BooksRejectedError(
            "Continue with Google before changing the shared books. Nothing was posted.",
            "disconnected",
          ),
        );
      }
      const expectedRevision = sameHousehold
        ? (previous?.baseRevision ?? Math.max(0, (previous?.revision ?? revision) - 1))
        : (candidate.baseRevision ?? candidate.revision ?? 0);
      try {
        const transported = await input.adapters.transport(accepted, expectedRevision);
        if (!transported.ok) {
          if (transported.errorClass === "conflict-detected") {
            if (transported.remote && transported.remotePersonal && input.actingMemberId) {
              let canonical: Household;
              try {
                const remoteShared = splitForSync(transported.remote, input.actingMemberId).shared;
                canonical = markSynchronized(assembleHousehold(remoteShared, transported.remotePersonal, { linked: true }));
                canonical.booksAcceptedHash = await financialAuditHash(canonical);
                const canonicalArtifact: AcceptedBooksArtifact = {
                  compiled: assertAcceptableBooks(canonical),
                  auditHash: canonical.booksAcceptedHash,
                };
                const ingested = input.adapters.repairIngest
                  ? await input.adapters.repairIngest(canonical, canonicalArtifact)
                  : await input.adapters.ingest(canonical, { ...canonicalArtifact, previous });
                if (!ingested.ok) throw new Error(ingested.error || "The latest cloud books could not replace the local projection.");
                if (input.adapters.verifyBooks) {
                  const verified = await input.adapters.verifyBooks(canonical, canonicalArtifact);
                  if (!verified.ok) throw new Error(verified.error || "The latest cloud books did not match the local projection.");
                }
                await input.adapters.persist(canonical);
                if (transported.finalizeConflict) {
                  if (!await transported.finalizeConflict()) {
                    throw new Error("The exact conflicted retry changed before it could be cancelled.");
                  }
                } else {
                  await clearCandidate();
                }
              } catch (caught) {
                return failedOutcome(
                  previous,
                  confirmationId,
                  new BooksRejectedError(
                    `Another device saved first. Hearth kept the exact retry blocked because the latest cloud books could not finish local repair. ${caught instanceof Error ? caught.message : String(caught)}`,
                    "books-unavailable",
                  ),
                );
              }
              return outcome({
                kind: "rejected-no-write",
                household: canonical,
                previous,
                postedIds: [],
                confirmationId,
                identityHash: null,
                revision: canonical.revision,
                sharingMode: "synchronized",
                errorClass: "conflict-detected",
                userMessage: "Another device saved first. Hearth opened the latest complete books; review them and Confirm your change again.",
                retryable: false,
                recoveryAvailable: false,
                postedExactlyOnce: false,
                postedNothing: true,
                ok: false,
              });
            }
            await clearCandidate();
            return failedOutcome(
              previous,
              confirmationId,
              new BooksRejectedError(
                "Another device saved first. Hearth is catching up; review the latest books, then Confirm again.",
                "conflict-detected",
              ),
            );
          }
          if (transported.errorClass === "disconnected") {
            await clearCandidate();
            return failedOutcome(
              previous,
              confirmationId,
              new BooksRejectedError(transported.message, "disconnected"),
            );
          }
          return transportUncertainOutcome(previous, confirmationId, transported.message);
        }
        if (transported.remote && transported.remote.revision > accepted.revision) {
          if (!input.actingMemberId || !transported.remotePersonal) {
            return transportUncertainOutcome(
              previous,
              confirmationId,
              "The Confirm reached the shared household, which already has a newer change. Hearth is pairing the latest Shared and Personal copies before writes reopen.",
            );
          }
          const remoteShared = splitForSync(transported.remote, input.actingMemberId).shared;
          accepted = markSynchronized(assembleHousehold(remoteShared, transported.remotePersonal, { linked: true }));
          accepted.booksAcceptedHash = await financialAuditHash(accepted);
          acceptedArtifact = {
            compiled: assertAcceptableBooks(accepted),
            auditHash: accepted.booksAcceptedHash,
          };
        }
        cloudAcknowledged = true;
      } catch {
        return transportUncertainOutcome(
          previous,
          confirmationId,
          "Hearth could not confirm the shared result yet. It will check the same Confirm before another change is allowed.",
        );
      }
    }

    try {
      const status = await measureHearth(
        "hearth:command:books-ingest",
        () => input.adapters.ingest(accepted, { ...acceptedArtifact, previous }),
      );
      if (!status.ok) {
        const message = status.error || "PGlite rejected the journal. Nothing was posted.";
        const errorClass = /unbalanced|trial balance|accounting equation/i.test(message)
          ? "unbalanced-journal"
          : "books-unavailable";
        throw new BooksRejectedError(message, errorClass);
      }
      if (input.adapters.verifyBooks) {
        const verified = await measureHearth(
          "hearth:command:books-verify",
          () => input.adapters.verifyBooks!(accepted, acceptedArtifact),
        );
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
      if (cloudAcknowledged) {
        const synced = markSynchronized(accepted);
        if (input.adapters.repairIngest) {
          try {
            const repaired = await input.adapters.repairIngest(synced, acceptedArtifact);
            if (repaired.ok) {
              await measureHearth("hearth:command:persist", () => input.adapters.persist(synced));
              return outcome({
                kind: "synchronized",
                household: synced,
                previous,
                postedIds,
                confirmationId,
                identityHash,
                revision: synced.revision,
                sharingMode: "synchronized",
                errorClass: null,
                userMessage: null,
                retryable: false,
                recoveryAvailable: false,
                ok: true,
                postedExactlyOnce: true,
                postedNothing: false,
              });
            }
          } catch {
            // Persist the cloud-accepted snapshot and keep local books blocked below.
          }
        }
        try {
          await measureHearth("hearth:command:persist", () => input.adapters.persist(synced));
        } catch {
          // Cloud remains authoritative even if both disposable local copies need repair.
        }
        return outcome({
          kind: "synchronized",
          household: synced,
          previous,
          postedIds,
          confirmationId,
          identityHash,
          revision: synced.revision,
          sharingMode: "synchronized",
          errorClass: "books-unavailable",
          userMessage: "Saved to the shared household. This device is repairing its local books from that accepted copy.",
          retryable: false,
          recoveryAvailable: true,
          ok: true,
          postedExactlyOnce: true,
          postedNothing: false,
        });
      }
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

    if (input.requireSynchronized) {
      const synced = markSynchronized(accepted);
      try {
        await measureHearth("hearth:command:persist", () => input.adapters.persist(synced));
      } catch {
        return outcome({
          kind: "synchronized",
          household: synced,
          previous,
          postedIds,
          confirmationId,
          identityHash,
          revision: synced.revision,
          sharingMode: "synchronized",
          errorClass: "persist-failed",
          userMessage: "Saved to the shared household. This device could not cache the update, so reload to restore it from the shared copy.",
          retryable: false,
          recoveryAvailable: true,
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
        revision: synced.revision,
        sharingMode: "synchronized",
        errorClass: null,
        userMessage: null,
        retryable: false,
        recoveryAvailable: false,
      });
    }

    try {
      await measureHearth("hearth:command:persist", () => input.adapters.persist(accepted));
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

    if (unresolvedConflicts(accepted).length > 0) {
      return outcome({
        kind: "conflict-needs-attention",
        household: accepted,
        previous,
        postedIds,
        confirmationId,
        identityHash,
        revision,
        sharingMode: "conflicted",
        errorClass: "conflict-detected",
        userMessage: "This phone and the shared copy differ on the same financial fact. Both versions are preserved for review.",
        retryable: false,
        recoveryAvailable: true,
        ok: true,
        postedExactlyOnce: true,
        postedNothing: false,
      });
    }

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
        const memberId = accepted.members.find((member) => member.active)?.id ?? accepted.members[0]?.id ?? "MEM-001";
        const reconciled = await autoResolveSharedConflict(accepted, transported.remote, memberId, "local");
        try {
          const status = await input.adapters.ingest(reconciled);
          if (!status.ok) throw new Error("conflict reconciliation ingest refused");
        } catch {
          const pending = markPendingTransport(accepted, "Saved on this phone. Sharing will retry.");
          try {
            await input.adapters.persist(pending);
          } catch {
            /* local books already accepted */
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
            userMessage: "Saved on this phone. Sharing in the background.",
            retryable: true,
            recoveryAvailable: false,
            ok: true,
            postedExactlyOnce: true,
            postedNothing: false,
          });
        }
        try {
          await input.adapters.persist(reconciled);
        } catch {
          const pending = markPendingTransport(accepted, "Saved on this phone. Sharing will retry.");
          try {
            await input.adapters.persist(pending);
          } catch {
            /* keep accepted in memory */
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
            userMessage: "Saved on this phone. Sharing in the background.",
            retryable: true,
            recoveryAvailable: false,
            ok: true,
            postedExactlyOnce: true,
            postedNothing: false,
          });
        }
        if (unresolvedConflicts(reconciled).length > 0) {
          return outcome({
            kind: "conflict-needs-attention",
            household: reconciled,
            previous,
            postedIds,
            confirmationId,
            identityHash,
            revision: reconciled.revision,
            sharingMode: "conflicted",
            errorClass: "conflict-detected",
            userMessage: "This phone and the shared copy differ on the same financial fact. Both versions are preserved for review.",
            retryable: false,
            recoveryAvailable: true,
            ok: true,
            postedExactlyOnce: true,
            postedNothing: false,
          });
        }
        const sharing = deriveSharing(reconciled);
        const syncedHousehold = sharing.mode === "synchronized" ? markSynchronized(reconciled) : reconciled;
        return outcome({
          kind: sharing.mode === "synchronized"
            ? "synchronized"
            : sharing.mode === "pending-transport"
              ? "pending-transport"
              : "accepted-local",
          household: syncedHousehold,
          previous,
          postedIds,
          confirmationId,
          identityHash,
          revision: reconciled.revision,
          sharingMode: sharing.mode,
          errorClass: sharing.mode === "pending-transport" ? "pending-transport" : null,
          userMessage: sharing.mode === "pending-transport" ? "Saved on this phone. Sharing in the background." : null,
          retryable: sharing.mode === "pending-transport",
          recoveryAvailable: false,
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
        kind: "pending-transport",
        household: pending,
        previous,
        postedIds,
        confirmationId,
        identityHash,
        revision,
        sharingMode: "pending-transport",
        errorClass: transported.errorClass,
        userMessage: transported.message,
        retryable: true,
        recoveryAvailable: false,
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
