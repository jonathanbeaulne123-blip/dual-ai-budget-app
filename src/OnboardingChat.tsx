import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { CommitResult, DateKey, EvidenceResult, Household } from "./core/index.ts";
import {
  SHELL_VIEW,
  SITTING_MARK_COUNT,
  acceptedHouseholdOnboarding,
  chapterRoleFor,
  charterSignatureStatus,
  confirmHouseholdOnboarding,
  copy,
  evidenceCardLabel,
  evidenceFor,
  evidenceProvenanceLabel,
  flavorFor,
  handshakeExpired,
  isSittingFinalChapter,
  isSittingFirstChapter,
  memberProgress,
  nextChapterFor,
  proposeHouseholdOnboarding,
  recordChapterAcknowledgement,
  recordObservedChapterCompletion,
  selfPersonalAccountsEvidenceFor,
  skipChapterFourPersonalAccounts,
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
  const { observation: householdScopeObservation, retry: retryHouseholdScopeProbe } = useHouseholdScopeProbe({
    active: record?.state === "active" && chapter?.id === "ch-02-household",
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

  if (!chapter) return null;

  const custodianMemberId = household.charter?.custodianMemberId ?? household.householdFund?.custodianMemberId ?? null;
  const role = chapterRoleFor(chapter, memberId, custodianMemberId);
  const conductorName = role === "witness"
    ? household.members.find((member) => member.id === custodianMemberId)?.name ?? "your partner"
    : null;
  const turnLine = role === "conductor"
    ? copy("chapter.turn.conductor")
    : copy("chapter.turn.witness", { name: conductorName ?? "your partner" });
  const evidence = role === "conductor"
    ? evidenceFor(household, chapter.id, memberId, { householdScope: householdScopeObservation })
    : witnessEvidenceFor(household, chapter.id, memberId, { householdScope: householdScopeObservation });

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
  const hercLine = sittingBoundaryReady
    ? copy("sitting.pause")
    : enteringSittingTwo
      ? copy("sitting.two.warning")
      : flavorFor(chapter.id, household.householdId);

  const railIndex = sittingRailIndex(chapter.sitting);
  const chapterId = chapter.id;
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
  const blocked = onboardingBlockedPresentation(evidence, otherName);
  const waitingForPartner = charterPresentation.kind === "waiting";
  const blockedCopyKey = waitingForPartner ? charterPresentation.copyKey : blocked?.copyKey ?? null;
  const blockedCopySlots = waitingForPartner ? charterPresentation.slots : blocked?.slots;
  const autoCompletable = chapter.skip === "auto-completable";
  const charterNeedsNavigation = charterPresentation.kind === "write"
    || charterPresentation.kind === "open"
    || charterPresentation.kind === "review";
  const accountsNeedNavigation = chapterId === "ch-04-accounts"
    && !blockedCopyKey
    && (evidence.kind !== "accepted" || personalAccountChoicePending);

  const showAction = role === "conductor"
    && !blockedCopyKey
    && !charterNeedsNavigation
    && !accountsNeedNavigation
    && (!autoCompletable || evidence.kind === "accepted")
    && chapter.actions.includes("continue");
  const showRetryAction = role === "conductor" && blocked?.retryable === true;
  const showCharterAction = role === "conductor" && charterNeedsNavigation && Boolean(onOpenCharter);
  const showAccountsAction = role === "conductor" && accountsNeedNavigation && Boolean(onOpenAccounts);
  const showPersonalSkipAction = showAccountsAction && personalAccountChoicePending;
  const cardMarginBottom = showAction || showRetryAction || showCharterAction || showAccountsAction
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
              <p className="onboarding-card-task">{copy(chapter.copyKey)}</p>
              <p className="onboarding-card-provenance">{taskLengthLabel(chapter.timeBudgetSeconds)}</p>
            </section>
          )}
        </>
      )}
      {showAction || showRetryAction || showCharterAction || showAccountsAction ? (
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
                  : acknowledge}
          >
            {copy(showRetryAction
              ? "probe.retry"
              : showCharterAction
                ? charterPresentation.copyKey
                : showAccountsAction
                  ? "accounts.open"
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
        </div>
      ) : null}
      <div className="onboarding-foot" style={{ marginTop: SHELL_VIEW.actionToFoot }}>
        <button
          type="button"
          className="onboarding-stop-link"
          disabled={busy}
          style={{ minHeight: SHELL_VIEW.minTouch, minWidth: SHELL_VIEW.minTouch }}
          onClick={requestStop}
        >
          {copy("stop.offer")}
        </button>
      </div>
    </div>
  );
}
