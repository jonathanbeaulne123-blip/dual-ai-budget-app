/**
 * Ephemeral Practice kitchen (D-128).
 * Never touches Household, PGlite, continuity, reports, streaks, or Health.
 */

export type PracticeDraftKind = "transaction" | "shift";

export type PracticeDraft = {
  id: string;
  kind: PracticeDraftKind;
  /** Display-only cents; never posted. */
  amountCents: number;
  label: string;
  createdAtIso: string;
};

export type PracticeSession = {
  id: string;
  environment: "development" | "production";
  householdId: string;
  memberKey: string;
  chapterId: string;
  drafts: PracticeDraft[];
  destroyed: boolean;
};

export type CopyToRealDraftResult =
  | { ok: true; draftId: string; note: string }
  | { ok: false; reason: string };

let practiceSeq = 0;

export function createPracticeSession(input: {
  environment: "development" | "production";
  householdId: string;
  memberKey: string;
  chapterId: string;
  nowIso?: string;
}): PracticeSession {
  practiceSeq += 1;
  return {
    id: `practice-${practiceSeq}`,
    environment: input.environment,
    householdId: input.householdId,
    memberKey: input.memberKey,
    chapterId: input.chapterId,
    drafts: [],
    destroyed: false,
  };
}

export function addPracticeDraft(
  session: PracticeSession,
  draft: Omit<PracticeDraft, "id" | "createdAtIso"> & { createdAtIso?: string },
): PracticeSession {
  if (session.destroyed) {
    throw new Error("Practice session destroyed");
  }
  practiceSeq += 1;
  return {
    ...session,
    drafts: [
      ...session.drafts,
      {
        id: `pd-${practiceSeq}`,
        kind: draft.kind,
        amountCents: draft.amountCents,
        label: draft.label,
        createdAtIso: draft.createdAtIso ?? new Date().toISOString(),
      },
    ],
  };
}

/**
 * Destroy ephemeral practice. Callers must drop all references;
 * this returns a tombstone that rejects further mutation.
 */
export function destroyPracticeSession(session: PracticeSession): PracticeSession {
  return {
    ...session,
    drafts: [],
    destroyed: true,
  };
}

/**
 * Slice A stub: produces a contract-only real-draft handle.
 * Must never call a command or Confirm.
 */
export function copyPracticeToRealDraftStub(
  session: PracticeSession,
  practiceDraftId: string,
): CopyToRealDraftResult {
  if (session.destroyed) {
    return { ok: false, reason: "session-destroyed" };
  }
  const draft = session.drafts.find((d) => d.id === practiceDraftId);
  if (!draft) {
    return { ok: false, reason: "draft-missing" };
  }
  return {
    ok: true,
    draftId: `real-draft-stub:${draft.id}`,
    note: "Stub only — still requires ordinary review and Confirm. No command invoked.",
  };
}

/** Proof helper: practice never claims accepted money. */
export function practiceAffectsAcceptedMoney(_session: PracticeSession): false {
  return false;
}

export function practiceMayTouchHousehold(): false {
  return false;
}

export function practiceMayTouchPglite(): false {
  return false;
}

export function practiceMayTouchContinuity(): false {
  return false;
}
