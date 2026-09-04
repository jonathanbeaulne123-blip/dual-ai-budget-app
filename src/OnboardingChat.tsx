import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { CommitResult, DateKey, Household } from "./core/index.ts";
import {
  SHELL_VIEW,
  SITTING_MARK_COUNT,
  acceptedHouseholdOnboarding,
  chapterRoleFor,
  copy,
  evidenceCardLabel,
  evidenceFor,
  evidenceProvenanceLabel,
  flavorFor,
  isSittingFinalChapter,
  isSittingFirstChapter,
  memberProgress,
  nextChapterFor,
  recordChapterAcknowledgement,
  sittingRailIndex,
  stopHouseholdOnboarding,
  taskLengthLabel,
  witnessEvidenceFor,
} from "./core/index.ts";
import { OnboardingNotice, OnboardingWitness, noticedEvidenceKey } from "./OnboardingWitness.tsx";
import "./onboarding.css";

// The conductor shell (ONBOARDING_BUILD_MANUAL.md slice 7; HEARTH_UX_PACKET.md
// §13). This is not a chatbot: it is a page Hercules is writing, one chapter
// at a time. Every sentence on screen comes from copy() or flavorFor() — see
// the fence in test/onboarding-conductor.test.ts. Every spacing rule comes
// from SHELL_VIEW in src/core/onboarding/shellView.ts — see the same fence.
//
// This is a Part 1 (foundation) slice. The twelve chapters' own content —
// their actual questions, forms, and specific approve/submit actions — are
// each their own Part 2 slice and do not exist yet. Until then, copy()
// resolving an unwritten copyKey to the key itself (by design, since slice
// 6) is what keeps this shell honest rather than crashing: a viewer sees a
// visibly-unfinished label, never a blank screen or a made-up sentence.
//
// Deliberately out of scope here, disclosed rather than silently skipped:
// - The return bar (HEARTH_UX_PACKET.md §13.5) lives in the app's shared nav
//   chrome, not in Hercules.tsx or this component, and that chrome is not in
//   this slice's file list. SHELL_VIEW.returnBarHeight is defined (the
//   manual's constant is byte-exact and this module must not edit it) but
//   has no consumer yet.
// - Per-chapter actions beyond "continue" (approve, submit, edit) call
//   commands that are specific to each of the twelve chapters and are not
//   built yet. This shell only ever offers Next and the stop link.
// - The noticed strip only fires from a signal this slice actually has:
//   evidence already accepted for a chapter the viewer has not acknowledged
//   yet. A richer "you already handled this outside the app" probe is a
//   later slice's job.

type Props = {
  household: Household;
  memberId: string;
  today: DateKey;
  busy?: boolean;
  onCommit: (fn: (current: Household) => CommitResult) => void;
  onDismiss: () => void;
};

export function OnboardingChat({ household, memberId, today, busy, onCommit, onDismiss }: Props) {
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

  const chapter = nextChapterFor(household, memberId, today);
  if (!chapter) return null;

  const custodianMemberId = household.charter?.custodianMemberId ?? household.householdFund?.custodianMemberId ?? null;
  const role = chapterRoleFor(chapter, memberId, custodianMemberId);
  const conductorName = role === "witness"
    ? household.members.find((member) => member.id === custodianMemberId)?.name ?? "your partner"
    : null;
  const turnLine = role === "conductor"
    ? copy("chapter.turn.conductor")
    : copy("chapter.turn.witness", { name: conductorName ?? "your partner" });

  // A sitting boundary gets its own Hercules line ("Good place to stop.") but
  // no separate Pause button — the foot's stop link (rendered unconditionally
  // below) already is the real, always-present Pause/stop control, and the
  // copy deck has no distinct wording for a button that would only duplicate
  // it. Duplicating the same "Stop setup for now" text twice on one screen
  // would read as a mistake, not emphasis.
  const sittingFinal = isSittingFinalChapter(chapter.id);
  const enteringSittingTwo = isSittingFirstChapter(chapter.id) && chapter.sitting === 2;
  const hercLine = sittingFinal
    ? copy("sitting.pause")
    : enteringSittingTwo
      ? copy("sitting.two.warning")
      : flavorFor(chapter.id, household.householdId);

  const evidence = role === "conductor"
    ? evidenceFor(household, chapter.id, memberId)
    : witnessEvidenceFor(household, chapter.id, memberId);
  const railIndex = sittingRailIndex(chapter.sitting);
  const chapterId = chapter.id;
  const progress = memberProgress(household, memberId);
  const probeEvidenceKey = progress.rows.find((row) => row.chapterId === chapterId)?.probeEvidenceKey ?? null;
  const noticeEventKey = probeEvidenceKey
    ?? (evidence.kind === "accepted" ? noticedEvidenceKey(evidence.card) : null);
  const noticeKey = noticeEventKey ? `${progress.id}:${chapterId}:${noticeEventKey}` : null;

  // resolveEvidence can come back "ineligible" — a real blocked read, not
  // merely "nothing to show yet". Showing the ordinary task card instead
  // would misrepresent a blocked state as an untouched one, so this is
  // checked ahead of the task/evidence-card choice below and also gates the
  // Next button off (there is nothing safe to continue past). Four of the
  // five IneligibleReason values have a committed Appendix E line to show.
  // "malformed" has no dedicated line, so it uses the deliberately generic
  // stale refusal rather than presenting invalid evidence as untouched work.
  const blockedCopyKey = evidence.kind !== "ineligible" ? null : evidence.reason === "conflicted"
    ? "blocked.conflict"
    : evidence.reason === "stale"
      ? "blocked.stale"
      : evidence.reason === "untied"
        ? "blocked.untied"
        : evidence.reason === "privacy"
          ? "blocked.privacy"
          : "blocked.stale";

  const showAction = role === "conductor"
    && !blockedCopyKey
    && chapter.actions.includes("continue");
  const cardMarginBottom = showAction ? SHELL_VIEW.cardToAction : 0;

  function acknowledge() {
    onCommit((current) => recordChapterAcknowledgement(current, {
      memberId,
      chapterId,
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
            <section className="onboarding-card" style={{ marginBottom: cardMarginBottom }}>
              <p className="onboarding-card-label">Held up</p>
              <p className="onboarding-card-task">{copy(blockedCopyKey)}</p>
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
      {showAction ? (
        <div className="onboarding-actions">
          <button
            type="button"
            disabled={busy}
            style={{ minHeight: SHELL_VIEW.navButtonHeight }}
            onClick={acknowledge}
          >
            {copy("continue.next")}
          </button>
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
