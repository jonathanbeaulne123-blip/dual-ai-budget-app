import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  adoptFirstBudget,
  approveOnboardingProposal,
  copy,
  currentSubmission,
  firstPlanPresentation,
  formatCad,
  monthKeyFromDateKey,
  onboardingRecurrenceCadenceLabel,
  parseWholeCents,
  submitOnboardingEstimates,
  type CommandOutcome,
  type CommitResult,
  type DateKey,
  type Household,
  type ProposalBasis,
} from "./core/index.ts";
import "./onboarding.css";

type PlanCommit = (fn: (current: Household) => CommitResult) => Promise<CommandOutcome | null>;

type OnboardingPlanProps = {
  household: Household;
  memberId: string;
  today: DateKey;
  busy?: boolean;
  onCommit: PlanCommit;
};

type Phase = "review" | "approving" | "adopting" | "failed";
type FailureContext = "edit" | "approve" | "adopt" | null;

function basisCopyKey(basis: ProposalBasis): string {
  if (basis === "both-estimates") return "proposal.basis.both";
  if (basis === "single-estimate") return "proposal.basis.single";
  if (basis === "run-rate-raised") return "proposal.basis.runrate";
  return "proposal.basis.floor";
}

function initialDraft(household: Household, memberId: string): Record<string, string> {
  const submission = currentSubmission(household, memberId, "estimates");
  return Object.fromEntries((submission?.estimates ?? []).map((row) => [
    row.subcategoryId,
    (row.amountCents / 100).toFixed(2),
  ]));
}

export function OnboardingPlan(props: OnboardingPlanProps) {
  const scopeKey = `${props.household.householdId}:${props.memberId}`;
  return <ScopedOnboardingPlan key={scopeKey} {...props} />;
}

function ScopedOnboardingPlan({ household, memberId, today, busy, onCommit }: OnboardingPlanProps) {
  const monthKey = monthKeyFromDateKey(today);
  const presentation = useMemo(
    () => firstPlanPresentation(household, memberId, monthKey, today),
    [household, memberId, monthKey, today],
  );
  const prefix = useId();
  const outcomeHeadingRef = useRef<HTMLHeadingElement>(null);
  const editHelpId = `${prefix}-edit-help`;
  const editErrorId = `${prefix}-edit-error`;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>(() => initialDraft(household, memberId));
  const [invalidCategoryId, setInvalidCategoryId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("review");
  const [failureContext, setFailureContext] = useState<FailureContext>(null);
  const [failureDetail, setFailureDetail] = useState("");
  const [adoptionUncertain, setAdoptionUncertain] = useState(false);
  const locked = Boolean(busy) || phase === "approving" || phase === "adopting";
  const firstRun = presentation.rows.every((row) => (
    !row.runRate.eligible && row.runRate.reason !== "untied"
  ));

  useEffect(() => {
    if (presentation.adoptionReceipt || phase === "failed") outcomeHeadingRef.current?.focus();
  }, [presentation.adoptionReceipt, phase]);

  function openEditor() {
    setDraft(initialDraft(household, memberId));
    setInvalidCategoryId(null);
    setFailureDetail("");
    setFailureContext(null);
    setAdoptionUncertain(false);
    setEditing(true);
  }

  async function saveEdit() {
    const estimates: Array<{ subcategoryId: string; amountCents: number }> = [];
    for (const row of presentation.rows) {
      const value = draft[row.subcategoryId]?.trim() ?? "";
      if (!value) continue;
      try {
        estimates.push({
          subcategoryId: row.subcategoryId,
          amountCents: parseWholeCents(value, "Estimate", { allowZero: true }),
        });
      } catch {
        setInvalidCategoryId(row.subcategoryId);
        document.getElementById(`${prefix}-${row.subcategoryId}`)?.focus();
        return;
      }
    }
    setPhase("approving");
    const outcome = await onCommit((current) => submitOnboardingEstimates(current, {
      memberId,
      createdBy: memberId,
      estimates,
    }));
    if (!outcome?.ok) {
      setFailureDetail(outcome?.userMessage ?? "");
      setFailureContext("edit");
      setPhase("failed");
      return;
    }
    setEditing(false);
    setInvalidCategoryId(null);
    setPhase("review");
  }

  async function approve() {
    setPhase("approving");
    const outcome = await onCommit((current) => approveOnboardingProposal(current, {
      memberId,
      createdBy: memberId,
      digest: presentation.proposal.sourceDigest,
    }));
    if (!outcome?.ok) {
      setFailureDetail(outcome?.userMessage ?? "");
      setFailureContext("approve");
      setPhase("failed");
      return;
    }
    setPhase("review");
  }

  async function adopt() {
    setPhase("adopting");
    const outcome = await onCommit((current) => adoptFirstBudget(current, {
      memberId,
      createdBy: memberId,
      monthKey,
      proposalDigest: presentation.proposal.sourceDigest,
    }));
    if (!outcome?.ok) {
      setFailureDetail(outcome?.userMessage ?? "");
      setFailureContext("adopt");
      setAdoptionUncertain(Boolean(outcome && (!outcome.postedNothing || outcome.recoveryAvailable)));
      setPhase("failed");
      return;
    }
    setPhase("review");
  }

  return (
    <section
      className="card onboarding-first-plan"
      data-testid="onboarding-first-plan"
      aria-busy={locked || undefined}
    >
      <header className="onboarding-first-plan-header">
        <p className="kicker">{monthKey}</p>
        <h2 ref={outcomeHeadingRef} tabIndex={-1}>{copy("proposal.title")}</h2>
        <p>{copy("proposal.subtitle")}</p>
      </header>

      {presentation.adoptionReceipt ? (
        <div className="onboarding-plan-outcome is-adopted" role="status" aria-live="polite">
          <p>{copy("adopt.done")}</p>
        </div>
      ) : (
        <>
          {firstRun ? <p className="onboarding-plan-runrate" role="status">{copy("runrate.absent")}</p> : null}
          {presentation.editedAfterApproval ? (
            <p className="onboarding-plan-version" role="status" aria-live="polite">{copy("proposal.edit.changed")}</p>
          ) : null}

          <div className="onboarding-plan-rows">
            {presentation.rows.map((row) => (
              <article className="onboarding-plan-row" key={row.subcategoryId}>
                <header>
                  <h3>{row.label}</h3>
                  <div>
                    <span>{copy("proposal.result")}</span>
                    <strong>{formatCad(row.proposedCents)}</strong>
                  </div>
                </header>
                <dl className="onboarding-plan-derivation">
                  <div className="onboarding-plan-fact is-wide">
                    <dt>{copy("proposal.guesses")}</dt>
                    <dd className="onboarding-plan-member-inputs">
                      {row.estimatesCents.map((estimate) => {
                        const name = presentation.members.find((member) => member.id === estimate.memberId)?.name ?? estimate.memberId;
                        return (
                          <span key={estimate.memberId}>
                            <span>{name}</span>
                            <strong>{estimate.amountCents === null ? copy("estimates.missing") : formatCad(estimate.amountCents)}</strong>
                          </span>
                        );
                      })}
                    </dd>
                  </div>
                  <div className="onboarding-plan-fact">
                    <dt>{copy("proposal.recurrences")}</dt>
                    <dd>
                      {row.anchors.length ? row.anchors.map((anchor) => (
                        <span className="onboarding-plan-anchor" key={anchor.id}>
                          <strong>{anchor.label}</strong>
                          <span>{copy("proposal.recurrence.value", {
                            amount: formatCad(anchor.amountCents),
                            cadence: onboardingRecurrenceCadenceLabel(anchor.cadence),
                            date: anchor.nextDate,
                          })}</span>
                          <span>{copy("proposal.recurrence.month", {
                            count: String(anchor.occurrenceDates.length),
                            amount: formatCad(anchor.amountCents),
                            total: formatCad(anchor.monthTotalCents),
                            dates: anchor.occurrenceDates.length <= 5
                              ? anchor.occurrenceDates.join(", ")
                              : `${anchor.occurrenceDates[0]} to ${anchor.occurrenceDates.at(-1)}`,
                          })}</span>
                        </span>
                      )) : copy("proposal.recurrence.none")}
                      {row.anchors.length ? <strong>{copy("proposal.recurrence.floor", {
                        amount: formatCad(row.recurrenceFloorCents),
                      })}</strong> : null}
                    </dd>
                  </div>
                  <div className="onboarding-plan-fact">
                    <dt>{copy("proposal.history")}</dt>
                    <dd>{row.runRate.eligible
                      ? copy("proposal.history.ready", {
                          amount: formatCad(row.runRate.monthlyCents),
                          weeks: String(row.runRate.weeksWatched),
                        })
                      : copy(row.runRate.reason === "insufficient-weeks"
                          ? "proposal.history.short"
                          : row.runRate.reason === "untied"
                            ? "proposal.history.untied"
                            : "proposal.history.empty")}</dd>
                  </div>
                  <div className="onboarding-plan-fact is-result">
                    <dt>{copy(basisCopyKey(row.basis))}</dt>
                    <dd>{formatCad(row.proposedCents)}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>

          <section className="onboarding-plan-total">
            <span>{copy("proposal.total")}</span>
            <strong>{formatCad(presentation.proposal.totalCents)}</strong>
            <p>{presentation.proposal.capacityCents === null
              ? copy("proposal.capacity.absent")
              : copy("proposal.capacity", {
                  total: formatCad(presentation.proposal.totalCents),
                  capacity: formatCad(presentation.proposal.capacityCents),
                })}</p>
          </section>

          {editing ? (
            <section className="onboarding-plan-editor">
              {presentation.approvals.length ? (
                <p className="onboarding-plan-edit-warning">{copy("proposal.edit.warn")}</p>
              ) : null}
              <h3>{copy("proposal.edit.title")}</h3>
              <p id={editHelpId}>{copy("estimates.blank-help")}</p>
              <div className="onboarding-plan-edit-fields">
                {presentation.rows.map((row) => (
                  <label key={row.subcategoryId} htmlFor={`${prefix}-${row.subcategoryId}`}>
                    <span>{row.label}</span>
                    <span className="onboarding-estimate-field-caption">{copy("estimates.currency")}</span>
                    <input
                      id={`${prefix}-${row.subcategoryId}`}
                      inputMode="decimal"
                      autoComplete="off"
                      value={draft[row.subcategoryId] ?? ""}
                      placeholder={copy("estimates.placeholder")}
                      aria-describedby={`${editHelpId}${invalidCategoryId === row.subcategoryId ? ` ${editErrorId}` : ""}`}
                      aria-invalid={invalidCategoryId === row.subcategoryId || undefined}
                      disabled={locked}
                      onChange={(event) => {
                        setDraft((current) => ({ ...current, [row.subcategoryId]: event.target.value }));
                        if (invalidCategoryId === row.subcategoryId) setInvalidCategoryId(null);
                      }}
                    />
                  </label>
                ))}
              </div>
              {invalidCategoryId ? <p id={editErrorId} role="alert">{copy("proposal.edit.invalid")}</p> : null}
              <div className="onboarding-plan-actions">
                <button type="button" className="primary" disabled={locked} onClick={() => { void saveEdit(); }}>
                  {copy("proposal.edit.save")}
                </button>
                <button type="button" disabled={locked} onClick={() => setEditing(false)}>
                  {copy("proposal.edit.cancel")}
                </button>
              </div>
            </section>
          ) : (
            <button type="button" className="onboarding-plan-edit" disabled={locked} onClick={openEditor}>
              {copy("proposal.edit")}
            </button>
          )}

          <section className="onboarding-plan-approvals">
            <h3>{copy("approve.title")}</h3>
            <p>{copy("proposal.review-pause")}</p>
            <ul>
              {presentation.members.map((member) => (
                <li key={member.id}>
                  <span>{member.name}</span>
                  <strong>{member.approved
                    ? member.id === memberId ? copy("approve.mine") : copy("approve.recorded", { name: member.name })
                    : copy("approve.pending")}</strong>
                </li>
              ))}
            </ul>
            <div className="onboarding-plan-actions" aria-live="polite">
              {!presentation.viewerApproved ? (
                <button type="button" className="primary" disabled={locked || editing} onClick={() => { void approve(); }}>
                  {copy("approve.self")}
                </button>
              ) : presentation.bothApproved ? (
                <p>{copy("approve.complete")}</p>
              ) : (
                <p>{copy("approve.waiting", { name: presentation.pendingMemberName ?? "your partner" })}</p>
              )}
              {presentation.bothApproved ? (
                <button type="button" className="primary" disabled={locked || editing} onClick={() => { void adopt(); }}>
                  {copy("adopt.self")}
                </button>
              ) : null}
              {phase === "adopting" ? <p>{copy("adopt.working")}</p> : null}
            </div>
          </section>

          {phase === "failed" ? (
            <div className="onboarding-plan-outcome is-failed" role="alert">
              <p>{copy(failureContext === "adopt"
                ? adoptionUncertain ? "adopt.recovery" : "adopt.failed"
                : "retry.honest")}</p>
              {failureDetail ? <p>{failureDetail}</p> : null}
              {failureContext === "adopt" && !adoptionUncertain && presentation.bothApproved ? (
                <button type="button" disabled={locked} onClick={() => { void adopt(); }}>{copy("adopt.retry")}</button>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
