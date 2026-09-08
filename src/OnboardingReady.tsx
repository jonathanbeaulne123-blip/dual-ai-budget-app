import { useEffect, useMemo, useRef, useState } from "react";
import {
  approveOnboardingReady,
  completeHouseholdOnboarding,
  copy,
  onboardingReadyPresentation,
  recordChapterAcknowledgement,
  memberRequirementSatisfied,
  runMonthRehearsalCorrectionPractice,
  type CommandOutcome,
  type CommitResult,
  type CorrectionPracticeProof,
  type DateKey,
  type Household,
} from "./core/index.ts";
import "./onboarding.css";

type ReadyCommit = (fn: (current: Household) => CommitResult) => Promise<CommandOutcome | null>;

type OnboardingReadyProps = {
  household: Household;
  memberId: string;
  today: DateKey;
  busy?: boolean;
  onCommit: ReadyCommit;
  onDismiss: () => void;
};
export function OnboardingReady(props: OnboardingReadyProps) {
  const { household, memberId, today } = props;
  return <ScopedOnboardingReady key={`${household.environment}:${household.householdId}:${memberId}:${today}`} {...props} />;
}
function ScopedOnboardingReady({ household, memberId, today, busy, onCommit, onDismiss }: OnboardingReadyProps) {
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const [practiceStep, setPracticeStep] = useState<0 | 1 | 2>(0);
  const [practiceProof, setPracticeProof] = useState<CorrectionPracticeProof | null>(null);
  const [working, setWorking] = useState(false);
  const [failed, setFailed] = useState(false);
  const outcomeRef = useRef<HTMLHeadingElement>(null);
  const presentation = useMemo(
    () => onboardingReadyPresentation(household, memberId, today, practiceProof),
    [household, memberId, practiceProof, today],
  );
  const locked = Boolean(busy) || working;
  const offline = household.sharing.mode === "disconnected" || household.sharing.mode === "transport-error";

  async function runPractice() {
    setWorking(true);
    setFailed(false);
    try {
      const proof = await runMonthRehearsalCorrectionPractice({ date: today, memberId });
      if (!live.current) return;
      setPracticeProof(proof);
      setPracticeStep(2);
    } catch {
      if (live.current) setFailed(true);
    } finally {
      if (live.current) setWorking(false);
    }
  }

  async function finish() {
    const result = await onCommit((latest) => completeHouseholdOnboarding(latest, {
      memberId,
      createdBy: memberId,
    }));
    if (!live.current) return;
    if (!result?.ok) {
      setFailed(true);
      return;
    }
    setFailed(false);
    requestAnimationFrame(() => { if (live.current) outcomeRef.current?.focus(); });
  }

  async function approve() {
    setWorking(true);
    setFailed(false);
    try {
      let current = household;
      if (!memberRequirementSatisfied(current, memberId, "ch-12-ready")) {
        const proofResult = await onCommit((latest) => recordChapterAcknowledgement(latest, {
          memberId,
          createdBy: memberId,
          chapterId: "ch-12-ready",
          today,
          ...(practiceProof ? { practiceProof } : {}),
        }));
        if (!live.current) return;
        if (!proofResult?.ok) {
          setFailed(true);
          return;
        }
        // Saving Practice and reviewing the final Ready facts are separate actions.
        return;
      }
      const currentPresentation = onboardingReadyPresentation(current, memberId, today, practiceProof);
      if (currentPresentation.outstanding.length > 0) return;
      if (!currentPresentation.viewerApproved) {
        const approval = await onCommit((latest) => approveOnboardingReady(latest, {
          memberId,
          createdBy: memberId,
          digest: presentation.digest,
        }));
        if (!live.current) return;
        if (!approval?.ok) {
          setFailed(true);
          return;
        }
        current = approval.household;
      }
      if (onboardingReadyPresentation(current, memberId, today, practiceProof).bothApproved) {
        await finish();
      }
    } finally {
      if (live.current) setWorking(false);
    }
  }

  if (presentation.completed) {
    return (
      <section className="card onboarding-ready is-unlocked" data-testid="onboarding-ready" role="status">
        <p className="kicker">{copy("ready.complete")}</p>
        <h2 ref={outcomeRef} tabIndex={-1}>{copy("unlock.done")}</h2>
        <p>{copy("unlock.honest")}</p>
        <div className="onboarding-ready-established">
          <p>{copy("ready.checklist")}</p>
          <ul>{presentation.checklist.map((item) => <li key={item.chapterId}>{copy(item.copyKey)}</li>)}</ul>
        </div>
        <p>{copy("personal.offer")}</p>
        <button type="button" className="primary" onClick={onDismiss}>{copy("ready.open-books")}</button>
      </section>
    );
  }

  return (
    <section className="card onboarding-ready" data-testid="onboarding-ready" aria-busy={locked || undefined}>
      <header className="onboarding-ready-header">
        <p className="kicker">{copy("ready.chapter.12")}</p>
        <h2>{copy("ready.title")}</h2>
        <p>{copy("ready.subtitle")}</p>
      </header>

      {presentation.practiceAccepted ? (
        <article className="onboarding-ready-proof is-practice" role="status">
          <p className="onboarding-card-label">{copy("ready.practice.title")}</p>
          <p>{copy("ready.practice.done")}</p>
        </article>
      ) : (
        <article className="onboarding-ready-practice">
          <h3>{copy("ready.practice.title")}</h3>
          <p>{copy("ready.practice.explain")}</p>
          <div className="onboarding-ready-practice-row" aria-hidden="true">
            <span className={practiceStep >= 1 ? "is-done" : ""}>$45</span>
            <span className={practiceStep >= 2 ? "is-done" : ""}>↶ $45</span>
            <strong>$0</strong>
          </div>
          {practiceStep === 0 ? (
            <button type="button" className="secondary" disabled={locked} onClick={() => setPracticeStep(1)}>{copy("ready.practice.add")}</button>
          ) : (
            <button type="button" className="secondary" disabled={locked || practiceStep === 2} onClick={() => void runPractice()}>
              {working ? copy("ready.practice.running") : copy("ready.practice.correct")}
            </button>
          )}
        </article>
      )}

      <div className="onboarding-ready-truth" aria-label={copy("ready.books")}>
        <article>
          <span>{copy("ready.books")}</span>
          <strong>{copy(presentation.booksInBalance && presentation.equationHolds ? "ready.books.tied" : "ready.books.attention")}</strong>
        </article>
        <article>
          <span>{copy("ready.health")}</span>
          <strong>{presentation.healthFindingCount === 0
            ? copy("ready.health.clean")
            : copy("ready.health.findings", { count: String(presentation.healthFindingCount) })}</strong>
        </article>
      </div>

      <div className="onboarding-ready-checklist">
        <h3>{copy("ready.checklist")}</h3>
        <ul>
          {presentation.checklist.map((item) => (
            <li className={item.complete ? "is-complete" : ""} key={item.chapterId}>
              <span aria-hidden="true">{item.complete ? "✓" : "○"}</span>
              <span>{copy(item.copyKey)}</span>
              <small>{copy(item.complete ? "ready.complete" : "ready.pending")}</small>
            </li>
          ))}
        </ul>
      </div>

      {offline ? <p className="onboarding-ready-offline" role="status">{copy("ready.offline")}</p> : null}
      {failed ? <p className="onboarding-ready-error" role="alert">{copy("ready.failure")}</p> : null}
      {memberRequirementSatisfied(household, memberId, "ch-12-ready") && presentation.outstanding.length > 0 ? (
        <p role="status">{copy("ready.practice.waiting")}</p>
      ) : presentation.viewerApproved ? (
        <div className="onboarding-ready-wait" role="status" aria-live="polite">
          <p>{copy("ready.current")}</p>
          {presentation.bothApproved ? (
            <button type="button" className="primary" disabled={locked} onClick={() => void finish()}>{copy("ready.finish")}</button>
          ) : presentation.waitingMemberName ? <p>{copy("ready.waiting", { name: presentation.waitingMemberName })}</p> : null}
        </div>
      ) : (
        <button
          type="button"
          className="primary onboarding-ready-approve"
          disabled={locked || offline || !presentation.proofAccepted || presentation.outstanding.some((id) => id !== "ch-12-ready")}
          onClick={() => void approve()}
        >
          {copy(memberRequirementSatisfied(household, memberId, "ch-12-ready") ? "ready.self" : "ready.practice.save")}
        </button>
      )}
    </section>
  );
}
