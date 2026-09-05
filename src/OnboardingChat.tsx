import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { CommitResult, DateKey, EvidenceResult, Household, PersonalModuleOffer } from "./core/index.ts";
import {
  SHELL_VIEW,
  SITTING_MARK_COUNT,
  acceptedHouseholdOnboarding,
  chapterRoleFor,
  charterSignatureStatus,
  completePersonalModule,
  confirmHouseholdOnboarding,
  copy,
  declinePersonalModuleOffer,
  evidenceCardLabel,
  evidenceFor,
  evidenceProvenanceLabel,
  flavorFor,
  handshakeExpired,
  hasPostedOpeningTruth,
  householdFundConfigurationApprovalState,
  isSittingFinalChapter,
  isSittingFirstChapter,
  memberProgress,
  nextChapterFor,
  proposeHouseholdOnboarding,
  recordChapterAcknowledgement,
  recordObservedChapterCompletion,
  selfPersonalAccountsEvidenceFor,
  setOnboardingOffersMuted,
  skipChapterFourPersonalAccounts,
  skipPersonalStep,
  sittingRailIndex,
  stopHouseholdOnboarding,
  taskLengthLabel,
  witnessEvidenceFor,
} from "./core/index.ts";
import { OnboardingNotice, OnboardingWitness, noticedEvidenceKey } from "./OnboardingWitness.tsx";
import { useHouseholdScopeProbe } from "./onboardingHouseholdScope.ts";
import "./onboarding.css";

// The conductor shell (ONBOARDING_BUILD_MANUAL.md slice 7; HEARTH_UX_PACKET.md
// §13). This is not a chatbot: it is a page Hercules is writing, one chapter
// at a time. Every sentence on screen comes from copy() or flavorFor() — see
// the fence in test/onboarding-conductor.test.ts. Every spacing rule comes
// from SHELL_VIEW in src/core/onboarding/shellView.ts — see the same fence.
//
// Part 2 slices add one chapter at a time without turning this into a form.
// Slice 12 routes Chapter 3 to the existing Charter surfaces, then returns
// here for typed evidence and acknowledgement. Unwritten chapters still use
// copy()'s honest key fallback rather than an invented sentence.
//
// Deliberately out of scope here, disclosed rather than silently skipped:
// - Later chapters' approve/submit/edit actions remain their own slices.
//   Chapter 3 is the first chapter-specific navigate action: it opens the
//   established Charter UI and never collects an answer or signature here.
// - The noticed strip only fires from a signal this slice actually has:
//   evidence already accepted for a chapter the viewer has not acknowledged
//   yet. A richer "you already handled this outside the app" probe is a
//   later slice's job.
//
// Onboarding slice 10 adds the pre-active "offered" / "handshake-pending"
// screens below (the invitation and the handshake, HEARTH_UX_PACKET.md
// §13.7-§13.8). App.tsx now mounts this component standalone — outside the
// mobile focus surface and outside Hercules's desktop presence container,
// with no enclosing ".hercules-focus-shell" — specifically so these two
// screens can render before shouldShowOnboardingShell() would ever allow
// this component's other two mount points to open. The keyboard-trap
// fallback a few lines below ("standalone renders fall back to this
// shell") already anticipated exactly this. Two judgment calls, disclosed
// rather than silently decided: the "Not now" control on both new screens
// reuses the existing personal.decline copy key ("Not now") rather than a
// new invite-specific key, since Appendix E has no dedicated one and every
// on-screen sentence must come from copy(); and the confirmer's screen
// shows invite.explain's own "Three sittings, about an hour all in" line
// rather than a per-sitting length table (plate 10's mockup) — Appendix E
// has no row labels for that table and evidence.ts's card projector (the
// only existing mechanism for a computed-data row) is outside this slice's
// file list.

type Props = {
  household: Household;
  memberId: string;
  today: DateKey;
  busy?: boolean;
  onCommit: (fn: (current: Household) => CommitResult) => void;
  onDismiss: () => void;
  /** Chapter 3 opens the existing founding/document surface; chat never collects Charter answers. */
  onOpenCharter?: () => void;
  /** Chapter 4 opens the existing account surface with its account form expanded. */
  onOpenAccounts?: () => void;
  /** Chapter 5 opens the existing opening card, or the existing activity correction path. */
  onOpenOpeningBalances?: (mode: "entry" | "correction") => void;
  /** Chapter 6 opens the existing Fund surface; approval never happens in chat. */
  onOpenHouseholdFund?: () => void;
  /** Chapter 7 opens the existing Calendar repeating-items surface. */
  onOpenRecurrences?: () => void;
  /** Chapter 8 opens the current member's timing-only question on the Shift surface. */
  onOpenEarningCadence?: () => void;
  /** Chapter 9 opens the private choice flow on the existing Plan surface. */
  onOpenCategories?: () => void;
  /** Chapter 10 opens the private guessing flow on the existing Plan surface. */
  onOpenEstimates?: () => void;
  /** Chapter 11 opens the shared derivation and self-owned approval flow. */
  onOpenPlan?: () => void;
  /** Chapter 12 opens the isolated Practice and shared Ready finale on Books. */
  onOpenReady?: () => void;
  /** Optional member-owned guide. It never enters or changes the household conductor. */
  personalOffer?: PersonalModuleOffer | null;
  personalOfferSessionId?: string;
  personalOfferRecorded?: boolean;
  onOpenPersonalModule?: () => void;
  /**
   * ISO instant used only for the handshake-expiry check below — separate
   * from `today` (a DateKey, not enough precision for a fifteen-minute
   * window). Optional and defaulted to the real clock at render time so
   * the two existing mount points in Hercules.tsx (neither touched this
   * slice) keep compiling and behaving exactly as before; they can never
   * actually reach the offered/handshake-pending branches below in the
   * first place (shouldShowOnboardingShell is false in both states).
   * App.tsx's new standalone mount passes its own already-ticking `now`
   * state so this stays real-time there too, and tests can pass a fixed
   * value instead of depending on the real clock.
   */
  now?: string;
};

export type OnboardingBlockedPresentation = {
  copyKey: string;
  slots?: Record<string, string>;
  retryable: boolean;
};

/** Keep async Chapter 2 failures honest without making the shared shell guess. */
export function onboardingBlockedPresentation(
  evidence: EvidenceResult,
  otherName: string,
): OnboardingBlockedPresentation | null {
  if (evidence.kind !== "ineligible") return null;
  switch (evidence.reason) {
    case "conflicted": return { copyKey: "blocked.conflict", retryable: false };
    case "stale": return { copyKey: "blocked.stale", retryable: false };
    case "untied": return { copyKey: "blocked.untied", retryable: false };
    case "privacy": return { copyKey: "blocked.privacy", retryable: false };
    case "scope": return { copyKey: "blocked.scope", retryable: false };
    case "identity": return { copyKey: "blocked.identity", retryable: false };
    case "offline": return { copyKey: "blocked.offline", retryable: false };
    case "membership": return {
      copyKey: "blocked.membership",
      slots: { name: otherName },
      retryable: false,
    };
    case "revoked": return { copyKey: "blocked.revoked", retryable: false };
    case "retry": return { copyKey: "retry.honest", retryable: true };
    case "custody": return { copyKey: "fund.custody-mismatch", retryable: false };
    default: return { copyKey: "blocked.stale", retryable: false };
  }
}

export type OnboardingCharterPresentation =
  | { kind: "none" }
  | { kind: "write"; copyKey: "charter.write" }
  | { kind: "open"; copyKey: "charter.open" }
  | { kind: "review"; copyKey: "charter.review-sign" }
  | { kind: "waiting"; copyKey: "waiting.partner"; slots: { name: string } };

/** Chapter 3 asks only for the viewer's next safe act; it never turns the partner into a task. */
export function onboardingCharterPresentation(
  household: Household,
  memberId: string,
  evidence: EvidenceResult,
): OnboardingCharterPresentation {
  if (evidence.kind === "accepted") return { kind: "none" };
  if (evidence.kind === "ineligible" && evidence.reason !== "stale") return { kind: "none" };
  if (!household.charter) return { kind: "write", copyKey: "charter.write" };
  const status = charterSignatureStatus(household.charter, memberId);
  if (status === "stale") return { kind: "review", copyKey: "charter.review-sign" };
  if (status === "unsigned") return { kind: "open", copyKey: "charter.open" };
  const otherName = household.members.find((member) => member.active && member.id !== memberId)?.name ?? "your partner";
  return { kind: "waiting", copyKey: "waiting.partner", slots: { name: otherName } };
}

export function OnboardingChat({
  household,
  memberId,
  today,
  busy,
  onCommit,
  onDismiss,
  onOpenCharter,
  onOpenAccounts,
  onOpenOpeningBalances,
  onOpenHouseholdFund,
  onOpenRecurrences,
  onOpenEarningCadence,
  onOpenCategories,
  onOpenEstimates,
  onOpenPlan,
  onOpenReady,
  personalOffer,
  personalOfferSessionId,
  personalOfferRecorded = false,
  onOpenPersonalModule,
  now,
}: Props) {
  const shellRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    function trap(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const shell = shellRef.current;
      if (!shell) return;
      // The existing focus surface owns the dialog and its Close control.
      // Trap across that whole surface when mounted there so keyboard users
      // can still reach Close; standalone renders fall back to this shell.
      const focusScope = shell.closest<HTMLElement>(".hercules-focus-shell") ?? shell;
      const focusable = [...focusScope.querySelectorAll<HTMLElement>(
        "button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex='-1'])",
      )].filter((node) => node.getClientRects().length > 0);
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey && (active === first || !focusScope.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !focusScope.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", trap, true);
    return () => window.removeEventListener("keydown", trap, true);
  }, []);

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onDismiss();
    }
  }

  function requestStop() {
    onCommit((current) => stopHouseholdOnboarding(current, { memberId }));
  }

  const record = acceptedHouseholdOnboarding(household);
  const nowIso = now ?? new Date().toISOString();
  const chapter = nextChapterFor(household, memberId, today);
  const newMemberCatchUp = record?.state === "complete" && !record.confirmedByMemberIds.includes(memberId);
  const { observation: householdScopeObservation, retry: retryHouseholdScopeProbe } = useHouseholdScopeProbe({
    active: (record?.state === "active" || newMemberCatchUp) && chapter?.id === "ch-02-household",
    household,
    memberId,
  });

  if (record?.state === "offered") {
    return (
      <div
        ref={shellRef}
        className="onboarding-shell"
        style={{ paddingTop: SHELL_VIEW.padTop, paddingLeft: SHELL_VIEW.padSide, paddingRight: SHELL_VIEW.padSide }}
        onKeyDown={onKeyDown}
      >
        <p
          className="onboarding-herc"
          style={{ marginBottom: SHELL_VIEW.hercToCard, maxWidth: `${SHELL_VIEW.hercMaxEm}em` }}
          ref={headingRef}
          tabIndex={-1}
        >
          {copy("invite.offer")}
        </p>
        <section className="onboarding-card" style={{ marginBottom: SHELL_VIEW.cardToAction }}>
          <p className="onboarding-card-task">{copy("invite.explain")}</p>
        </section>
        <div className="onboarding-actions">
          <button
            type="button"
            disabled={busy}
            style={{ minHeight: SHELL_VIEW.navButtonHeight }}
            onClick={() => onCommit((current) => proposeHouseholdOnboarding(current, { memberId, at: nowIso }))}
          >
            {copy("invite.propose")}
          </button>
        </div>
        <div className="onboarding-foot" style={{ marginTop: SHELL_VIEW.actionToFoot }}>
          <button
            type="button"
            className="onboarding-stop-link"
            disabled={busy}
            style={{ minHeight: SHELL_VIEW.minTouch, minWidth: SHELL_VIEW.minTouch }}
            onClick={onDismiss}
          >
            {copy("personal.decline")}
          </button>
        </div>
      </div>
    );
  }

  if (record?.state === "handshake-pending") {
    const expired = handshakeExpired(record, nowIso);
    const isProposer = record.proposedByMemberId === memberId;
    const otherName = household.members.find((member) => member.active && member.id !== memberId)?.name ?? "your partner";

    if (expired) {
      return (
        <div
          ref={shellRef}
          className="onboarding-shell"
          style={{ paddingTop: SHELL_VIEW.padTop, paddingLeft: SHELL_VIEW.padSide, paddingRight: SHELL_VIEW.padSide }}
          onKeyDown={onKeyDown}
        >
          <p
            className="onboarding-herc"
            role="status"
            aria-live="polite"
            style={{ marginBottom: SHELL_VIEW.hercToCard, maxWidth: `${SHELL_VIEW.hercMaxEm}em` }}
            ref={headingRef}
            tabIndex={-1}
          >
            {copy("invite.expired")}
          </p>
          <div className="onboarding-actions">
            <button
              type="button"
              disabled={busy}
              style={{ minHeight: SHELL_VIEW.navButtonHeight }}
              onClick={() => onCommit((current) => proposeHouseholdOnboarding(current, { memberId, at: nowIso }))}
            >
              {copy("invite.propose")}
            </button>
          </div>
        </div>
      );
    }

    if (isProposer) {
      return (
        <div
          ref={shellRef}
          className="onboarding-shell"
          style={{ paddingTop: SHELL_VIEW.padTop, paddingLeft: SHELL_VIEW.padSide, paddingRight: SHELL_VIEW.padSide }}
          onKeyDown={onKeyDown}
        >
          <p
            className="onboarding-herc"
            role="status"
            aria-live="polite"
            style={{ maxWidth: `${SHELL_VIEW.hercMaxEm}em` }}
            ref={headingRef}
            tabIndex={-1}
          >
            {copy("invite.waiting", { name: otherName })}
          </p>
        </div>
      );
    }

    return (
      <div
        ref={shellRef}
        className="onboarding-shell"
        style={{ paddingTop: SHELL_VIEW.padTop, paddingLeft: SHELL_VIEW.padSide, paddingRight: SHELL_VIEW.padSide }}
        onKeyDown={onKeyDown}
      >
        <p
          className="onboarding-herc"
          style={{ marginBottom: SHELL_VIEW.hercToCard, maxWidth: `${SHELL_VIEW.hercMaxEm}em` }}
          ref={headingRef}
          tabIndex={-1}
        >
          {copy("invite.explain")}
        </p>
        <div className="onboarding-actions" style={{ marginBottom: SHELL_VIEW.actionToFoot }}>
          <button
            type="button"
            disabled={busy}
            style={{ minHeight: SHELL_VIEW.navButtonHeight }}
            onClick={() => onCommit((current) => confirmHouseholdOnboarding(current, { memberId, at: nowIso }))}
          >
            {copy("invite.confirm")}
          </button>
        </div>
        <div className="onboarding-foot">
          <button
            type="button"
            className="onboarding-stop-link"
            disabled={busy}
            style={{ minHeight: SHELL_VIEW.minTouch, minWidth: SHELL_VIEW.minTouch }}
            onClick={onDismiss}
          >
            {copy("personal.decline")}
          </button>
        </div>
      </div>
    );
  }

  if (record?.state === "waiting-member" && record.stoppedByMemberIds.includes(memberId)) {
    const otherName = household.members.find((member) => member.active && member.id !== memberId)?.name ?? "your partner";
    return (
      <div
        ref={shellRef}
        className="onboarding-shell"
        style={{ paddingTop: SHELL_VIEW.padTop, paddingLeft: SHELL_VIEW.padSide, paddingRight: SHELL_VIEW.padSide }}
        onKeyDown={onKeyDown}
      >
        <p className="onboarding-herc" style={{ maxWidth: `${SHELL_VIEW.hercMaxEm}em` }} ref={headingRef} tabIndex={-1}>
          {copy("waiting.partner", { name: otherName })}
        </p>
      </div>
    );
  }

  if (personalOffer && personalOfferSessionId) {
    const module = personalOffer.module;
    const sessionId = personalOfferSessionId;
    const actionCopyKey = module.id === "pm-01-own-books"
      ? "personal.open.books"
      : module.id === "pm-02-shifts"
        ? "personal.open.shifts"
        : module.id === "pm-03-tips"
          ? "personal.open.tips"
          : module.id === "pm-04-own-plan"
            ? "personal.open.plan"
            : module.id === "pm-05-office"
              ? "personal.open.office"
              : "personal.module.done";

    function finishPersonalModule() {
      onCommit((current) => completePersonalModule(current, {
        memberId,
        createdBy: memberId,
        moduleId: module.id,
        sessionId,
      }));
      onDismiss();
    }

    function declinePersonalModule() {
      onCommit((current) => declinePersonalModuleOffer(current, {
        memberId,
        createdBy: memberId,
        moduleId: module.id,
        sessionId,
      }));
      onDismiss();
    }

    function skipPersonalModule() {
      onCommit((current) => skipPersonalStep(current, {
        memberId,
        createdBy: memberId,
        chapterId: module.id,
      }));
      onDismiss();
    }

    function mutePersonalModules() {
      onCommit((current) => setOnboardingOffersMuted(current, {
        memberId,
        createdBy: memberId,
        muted: true,
      }));
      onDismiss();
    }

    return (
      <div
        ref={shellRef}
        className="onboarding-shell onboarding-personal-shell"
        style={{ paddingTop: SHELL_VIEW.padTop, paddingLeft: SHELL_VIEW.padSide, paddingRight: SHELL_VIEW.padSide }}
        onKeyDown={onKeyDown}
        aria-busy={!personalOfferRecorded}
      >
        <p className="onboarding-personal-label">{copy("personal.module.label")}</p>
        <p
          className="onboarding-herc"
          style={{ marginBottom: SHELL_VIEW.hercToCard, maxWidth: `${SHELL_VIEW.hercMaxEm}em` }}
          ref={headingRef}
          tabIndex={-1}
        >
          {copy("personal.offer")}
        </p>
        <section className="onboarding-card onboarding-personal-card" style={{ marginBottom: SHELL_VIEW.cardToAction }}>
          <p className="onboarding-card-task">{copy(module.copyKey)}</p>
          <div className="onboarding-personal-reason">
            <p className="onboarding-card-label">{copy("personal.module.why")}</p>
            <p>{copy(personalOffer.triggerCopyKey)}</p>
          </div>
          <p className="onboarding-card-provenance">{copy("personal.module.private")}</p>
        </section>
        {!personalOfferRecorded ? (
          <p className="onboarding-personal-saving" role="status" aria-live="polite">{copy("personal.module.saving")}</p>
        ) : (
          <div className="onboarding-actions onboarding-personal-actions">
            {module.target && onOpenPersonalModule ? (
              <button type="button" disabled={busy} style={{ minHeight: SHELL_VIEW.navButtonHeight }} onClick={onOpenPersonalModule}>
                {copy(actionCopyKey)}
              </button>
            ) : null}
            <button type="button" disabled={busy} style={{ minHeight: SHELL_VIEW.navButtonHeight }} onClick={finishPersonalModule}>
              {copy("personal.module.done")}
            </button>
            <button type="button" disabled={busy} style={{ minHeight: SHELL_VIEW.navButtonHeight }} onClick={declinePersonalModule}>
              {copy("personal.decline")}
            </button>
          </div>
        )}
        <div className="onboarding-foot onboarding-personal-foot" style={{ marginTop: SHELL_VIEW.actionToFoot }}>
          <button
            type="button"
            className="onboarding-stop-link"
            disabled={busy || !personalOfferRecorded}
            style={{ minHeight: SHELL_VIEW.minTouch, minWidth: SHELL_VIEW.minTouch }}
            onClick={skipPersonalModule}
          >
            {copy("skip.personal")}
          </button>
          <button
            type="button"
            className="onboarding-stop-link"
            disabled={busy || !personalOfferRecorded}
            style={{ minHeight: SHELL_VIEW.minTouch, minWidth: SHELL_VIEW.minTouch }}
            onClick={mutePersonalModules}
          >
            {copy("personal.off")}
          </button>
        </div>
      </div>
    );
  }

  if (!chapter) return null;

  const chapterId = chapter.id;
  const custodianMemberId = household.charter?.custodianMemberId ?? household.householdFund?.custodianMemberId ?? null;
  const baseRole = chapterRoleFor(chapter, memberId, custodianMemberId);
  const fundApprovalState = chapterId === "ch-06-fund"
    ? householdFundConfigurationApprovalState(household)
    : null;
  const viewerHasCurrentFundApproval = Boolean(fundApprovalState?.approvals.some((approval) => (
    approval.memberId === memberId && approval.revision === fundApprovalState.revision
  )));
  // Once the Fund exists, the non-custodian stops being a passive witness
  // through their own review, approval, and final acknowledgement. The
  // approval itself remains on the Fund surface.
  const fundApprovalActor = chapterId === "ch-06-fund"
    && baseRole === "witness"
    && Boolean(fundApprovalState);
  // Chapter 7's named witness may add a standing fact and must acknowledge
  // the shared evidence on their own device. This makes them an actor without
  // pretending they are leading the chapter.
  const recurrenceContributor = chapterId === "ch-07-recurrences" && baseRole === "witness";
  const role = fundApprovalActor || recurrenceContributor ? "conductor" : baseRole;
  const conductorName = baseRole === "witness"
    ? household.members.find((member) => member.id === custodianMemberId)?.name ?? "your partner"
    : null;
  const turnLine = recurrenceContributor
    ? copy("recurrences.witness-add", { name: conductorName ?? "your partner" })
    : role === "conductor"
      ? copy("chapter.turn.conductor")
      : copy("chapter.turn.witness", { name: conductorName ?? "your partner" });
  const evidence = role === "conductor"
    ? evidenceFor(household, chapter.id, memberId, { householdScope: householdScopeObservation, today })
    : witnessEvidenceFor(household, chapter.id, memberId, { householdScope: householdScopeObservation, today });

  // A sitting boundary gets its own Hercules line ("Good place to stop.") but
  // no separate Pause button — the foot's stop link (rendered unconditionally
  // below) already is the real, always-present Pause/stop control, and the
  // copy deck has no distinct wording for a button that would only duplicate
  // it. Duplicating the same "Stop setup for now" text twice on one screen
  // would read as a mistake, not emphasis.
  const sittingFinal = isSittingFinalChapter(chapter.id);
  const enteringSittingTwo = isSittingFirstChapter(chapter.id) && chapter.sitting === 2;
  // Chapter 3 is the first real routed chapter. Calling it a good place to
  // stop before the Charter is written reads like a dismissal, so its sitting
  // boundary line waits until the typed Charter evidence is actually ready.
  const sittingBoundaryReady = sittingFinal
    && (chapter.id !== "ch-03-charter" || evidence.kind === "accepted");
  const hercLine = newMemberCatchUp && chapter.id === "ch-01-meet"
    ? copy("lifecycle.new-member.intro")
    : sittingBoundaryReady
      ? copy("sitting.pause")
      : enteringSittingTwo
        ? copy("sitting.two.warning")
        : flavorFor(chapter.id, household.householdId);

  const railIndex = sittingRailIndex(chapter.sitting);
  const progress = memberProgress(household, memberId);
  const chapterProgress = progress.rows.find((row) => row.chapterId === chapterId);
  const probeEvidenceKey = chapterProgress?.probeEvidenceKey ?? null;
  const personalAccountsEvidence = chapterId === "ch-04-accounts"
    ? selfPersonalAccountsEvidenceFor(household, memberId)
    : { kind: "empty" as const };
  const personalAccountChoicePending = chapterId === "ch-04-accounts"
    && evidence.kind === "accepted"
    && personalAccountsEvidence.kind === "empty"
    && !chapterProgress?.personalAccountSetupSkippedAt;
  const noticeEventKey = probeEvidenceKey
    ?? (evidence.kind === "accepted" ? noticedEvidenceKey(evidence.card) : null);
  const noticeKey = noticeEventKey ? `${progress.id}:${chapterId}:${noticeEventKey}` : null;

  // resolveEvidence can come back "ineligible" — a real blocked read, not
  // merely "nothing to show yet". Showing the ordinary task card instead
  // would misrepresent a blocked state as an untouched one, so this is
  // checked ahead of the task/evidence-card choice below and also gates the
  // Next button off (there is nothing safe to continue past).
  // "malformed" has no dedicated line, so it uses the deliberately generic
  // stale refusal rather than presenting invalid evidence as untouched work.
  const otherName = household.members.find((member) => member.active && member.id !== memberId)?.name ?? "your partner";
  const charterPresentation = chapterId === "ch-03-charter"
    ? onboardingCharterPresentation(household, memberId, evidence)
    : { kind: "none" as const };
  const baseBlocked = onboardingBlockedPresentation(evidence, otherName);
  const openingStaleConflict = chapterId === "ch-05-opening"
    && evidence.kind === "ineligible"
    && evidence.reason === "stale";
  const openingHasBatch = chapterId === "ch-05-opening" && hasPostedOpeningTruth(household);
  const openingNeedsCorrection = openingStaleConflict
    || (chapterId === "ch-05-opening" && evidence.kind === "empty" && openingHasBatch);
  const blocked = openingStaleConflict
    ? { copyKey: "opening.stale", retryable: false }
    : baseBlocked;
  const fundWaitingForPartner = chapterId === "ch-06-fund"
    && Boolean(fundApprovalState)
    && viewerHasCurrentFundApproval
    && fundApprovalState?.kind !== "complete";
  const waitingForPartner = charterPresentation.kind === "waiting" || fundWaitingForPartner;
  const blockedCopyKey = charterPresentation.kind === "waiting"
    ? charterPresentation.copyKey
    : fundWaitingForPartner
      ? "waiting.partner"
      : blocked?.copyKey ?? null;
  const blockedCopySlots = charterPresentation.kind === "waiting"
    ? charterPresentation.slots
    : fundWaitingForPartner
      ? { name: otherName }
      : blocked?.slots;
  const autoCompletable = chapter.skip === "auto-completable";
  const charterNeedsNavigation = charterPresentation.kind === "write"
    || charterPresentation.kind === "open"
    || charterPresentation.kind === "review";
  const accountsNeedNavigation = chapterId === "ch-04-accounts"
    && !blockedCopyKey
    && (evidence.kind !== "accepted" || personalAccountChoicePending);
  const openingNeedsNavigation = chapterId === "ch-05-opening"
    && (evidence.kind === "empty" || openingStaleConflict);
  const fundNeedsNavigation = chapterId === "ch-06-fund"
    && !fundWaitingForPartner
    && !(evidence.kind === "ineligible" && evidence.reason === "custody")
    && evidence.kind !== "accepted";
  const recurrenceNeedsNavigation = chapterId === "ch-07-recurrences"
    && evidence.kind !== "accepted";
  const cadenceNeedsNavigation = chapterId === "ch-08-cadence"
    && evidence.kind !== "accepted";
  const categoriesNeedNavigation = chapterId === "ch-09-categories"
    && evidence.kind !== "accepted";
  const estimatesNeedNavigation = chapterId === "ch-10-estimates"
    && evidence.kind !== "accepted";
  const planNeedsNavigation = chapterId === "ch-11-plan"
    && evidence.kind !== "accepted";
  const readyNeedsNavigation = chapterId === "ch-12-ready";

  const showAction = role === "conductor"
    && !blockedCopyKey
    && !charterNeedsNavigation
    && !accountsNeedNavigation
    && !openingNeedsNavigation
    && !fundNeedsNavigation
    && !recurrenceNeedsNavigation
    && !cadenceNeedsNavigation
    && !categoriesNeedNavigation
    && !estimatesNeedNavigation
    && !planNeedsNavigation
    && !readyNeedsNavigation
    && (!autoCompletable || evidence.kind === "accepted")
    && chapter.actions.includes("continue");
  const showRetryAction = role === "conductor" && blocked?.retryable === true;
  const showCharterAction = role === "conductor" && charterNeedsNavigation && Boolean(onOpenCharter);
  const showAccountsAction = role === "conductor" && accountsNeedNavigation && Boolean(onOpenAccounts);
  const showPersonalSkipAction = showAccountsAction && personalAccountChoicePending;
  const showOpeningAction = role === "conductor" && openingNeedsNavigation && Boolean(onOpenOpeningBalances);
  const showFundAction = role === "conductor" && fundNeedsNavigation && Boolean(onOpenHouseholdFund);
  const showRecurrenceAction = role === "conductor"
    && chapterId === "ch-07-recurrences"
    && !blockedCopyKey
    && Boolean(onOpenRecurrences);
  const showRecurrencePrimaryAction = showRecurrenceAction && recurrenceNeedsNavigation;
  const showRecurrenceOptionalAction = showRecurrenceAction && evidence.kind === "accepted";
  const showCadenceAction = role === "conductor"
    && chapterId === "ch-08-cadence"
    && cadenceNeedsNavigation
    && !blockedCopyKey
    && Boolean(onOpenEarningCadence);
  const showCategoriesAction = role === "conductor"
    && chapterId === "ch-09-categories"
    && categoriesNeedNavigation
    && !blockedCopyKey
    && Boolean(onOpenCategories);
  const showEstimatesAction = role === "conductor"
    && chapterId === "ch-10-estimates"
    && estimatesNeedNavigation
    && !blockedCopyKey
    && Boolean(onOpenEstimates);
  const showPlanAction = role === "conductor"
    && chapterId === "ch-11-plan"
    && planNeedsNavigation
    && !blockedCopyKey
    && Boolean(onOpenPlan);
  const showReadyAction = role === "conductor"
    && chapterId === "ch-12-ready"
    && !blockedCopyKey
    && Boolean(onOpenReady);
  const cardMarginBottom = showAction || showRetryAction || showCharterAction || showAccountsAction || showOpeningAction || showFundAction || showRecurrenceAction || showCadenceAction || showCategoriesAction || showEstimatesAction || showPlanAction || showReadyAction
    ? SHELL_VIEW.cardToAction
    : 0;

  function acknowledge() {
    if (autoCompletable && householdScopeObservation) {
      onCommit((current) => recordObservedChapterCompletion(current, {
        memberId,
        chapterId,
        createdBy: memberId,
        observation: householdScopeObservation,
      }));
      return;
    }
    onCommit((current) => recordChapterAcknowledgement(current, { memberId, chapterId, createdBy: memberId }));
  }

  function skipPersonalAccounts() {
    onCommit((current) => skipChapterFourPersonalAccounts(current, {
      memberId,
      createdBy: memberId,
    }));
  }

  return (
    <div
      ref={shellRef}
      className="onboarding-shell"
      style={{ paddingTop: SHELL_VIEW.padTop, paddingLeft: SHELL_VIEW.padSide, paddingRight: SHELL_VIEW.padSide }}
      onKeyDown={onKeyDown}
    >
      <div
        className="onboarding-rail"
        aria-hidden="true"
        style={{ gap: SHELL_VIEW.railGap, marginBottom: SHELL_VIEW.railToTurn }}
      >
        {Array.from({ length: SITTING_MARK_COUNT }, (_, index) => (
          <span
            key={index}
            className={`onboarding-rail-mark ${index === railIndex ? "is-current" : ""}`}
            style={{ width: SHELL_VIEW.railMarkWidth, height: SHELL_VIEW.railMarkHeight }}
          />
        ))}
      </div>
      {role === "witness" ? (
        <OnboardingWitness
          turnLine={turnLine}
          hercLine={hercLine}
          chapter={chapter}
          evidence={evidence}
          blockedCopyKey={blockedCopyKey}
          blockedCopySlots={blockedCopySlots}
          noticeKey={noticeKey}
        />
      ) : (
        <>
          {evidence.kind === "accepted" && noticeKey
            ? <OnboardingNotice key={noticeKey} noticeKey={noticeKey} />
            : null}
          <p className="onboarding-turn" style={{ marginBottom: SHELL_VIEW.turnToHerc }}>{turnLine}</p>
          <p
            className="onboarding-herc"
            style={{ marginBottom: SHELL_VIEW.hercToCard, maxWidth: `${SHELL_VIEW.hercMaxEm}em` }}
            ref={headingRef}
            tabIndex={-1}
          >
            {hercLine}
          </p>
          {blockedCopyKey ? (
            <section className="onboarding-card" role="status" aria-live="polite" style={{ marginBottom: cardMarginBottom }}>
              <p className="onboarding-card-label">{waitingForPartner ? "Waiting together" : "Held up"}</p>
              <p className="onboarding-card-task">{copy(blockedCopyKey, blockedCopySlots)}</p>
            </section>
          ) : personalAccountChoicePending ? (
            <section className="onboarding-card" style={{ marginBottom: cardMarginBottom }}>
              <p className="onboarding-card-label">Your Personal books</p>
              <p className="onboarding-card-task">{copy("accounts.personal.offer")}</p>
              <p className="onboarding-card-provenance">{copy("accounts.personal.provenance")}</p>
            </section>
          ) : evidence.kind === "accepted" ? (
            <section className="onboarding-card" style={{ marginBottom: cardMarginBottom }}>
              <p className="onboarding-card-label">{evidenceCardLabel(evidence.card.kind)}</p>
              {evidence.card.lines.map((line) => (
                <p className="onboarding-card-row" key={`${line.label}-${line.value}`}>
                  <span className="onboarding-card-row-label">{line.label}</span>
                  <span className="onboarding-card-row-value">{line.value}</span>
                </p>
              ))}
              <p className="onboarding-card-provenance">{evidenceProvenanceLabel(evidence.card.kind)}</p>
            </section>
          ) : (
            <section className="onboarding-card" style={{ marginBottom: cardMarginBottom }}>
              <p className="onboarding-card-label">This one's yours</p>
              <p className="onboarding-card-task">{copy(openingNeedsCorrection ? "opening.partial" : chapter.copyKey)}</p>
              <p className="onboarding-card-provenance">{taskLengthLabel(chapter.timeBudgetSeconds)}</p>
            </section>
          )}
        </>
      )}
      {showAction || showRetryAction || showCharterAction || showAccountsAction || showOpeningAction || showFundAction || showRecurrencePrimaryAction || showCadenceAction || showCategoriesAction || showEstimatesAction || showPlanAction || showReadyAction ? (
        <div className="onboarding-actions">
          <button
            type="button"
            disabled={busy}
            style={{ minHeight: SHELL_VIEW.navButtonHeight }}
            onClick={showRetryAction
              ? retryHouseholdScopeProbe
              : showCharterAction
                ? onOpenCharter
                : showAccountsAction
                  ? onOpenAccounts
                  : showOpeningAction
                    ? () => onOpenOpeningBalances?.(openingNeedsCorrection ? "correction" : "entry")
                    : showFundAction
                      ? onOpenHouseholdFund
                    : showRecurrencePrimaryAction
                      ? onOpenRecurrences
                    : showCadenceAction
                      ? onOpenEarningCadence
                    : showCategoriesAction
                      ? onOpenCategories
                    : showEstimatesAction
                      ? onOpenEstimates
                    : showPlanAction
                      ? onOpenPlan
                    : showReadyAction
                      ? onOpenReady
                  : acknowledge}
          >
            {copy(showRetryAction
              ? "probe.retry"
              : showCharterAction
                ? charterPresentation.copyKey
                : showAccountsAction
                  ? "accounts.open"
                  : showOpeningAction
                    ? openingNeedsCorrection ? "opening.review" : "opening.open"
                    : showFundAction
                      ? "fund.open"
                    : showRecurrencePrimaryAction
                      ? "recurrences.open"
                    : showCadenceAction
                      ? "cadence.open"
                    : showCategoriesAction
                      ? "categories.open"
                    : showEstimatesAction
                      ? "estimates.open"
                    : showPlanAction
                      ? "proposal.open"
                    : showReadyAction
                      ? "ready.open"
                  : "continue.next")}
          </button>
          {showPersonalSkipAction ? (
            <button
              type="button"
              disabled={busy}
              style={{ minHeight: SHELL_VIEW.navButtonHeight }}
              onClick={skipPersonalAccounts}
            >
              {copy("skip.personal")}
            </button>
          ) : null}
          {showRecurrenceOptionalAction ? (
            <button
              type="button"
              disabled={busy}
              style={{ minHeight: SHELL_VIEW.navButtonHeight }}
              onClick={onOpenRecurrences}
            >
              {copy("recurrences.add-another")}
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="onboarding-foot" style={{ marginTop: SHELL_VIEW.actionToFoot }}>
        <button
          type="button"
          className="onboarding-stop-link"
          disabled={busy}
          style={{ minHeight: SHELL_VIEW.minTouch, minWidth: SHELL_VIEW.minTouch }}
          onClick={newMemberCatchUp ? onDismiss : requestStop}
        >
          {newMemberCatchUp ? copy("personal.decline") : copy("stop.offer")}
        </button>
      </div>
    </div>
  );
}
