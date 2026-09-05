import { useId, useState } from "react";
import {
  copy,
  currentSubmission,
  formatCad,
  onboardingEstimateState,
  parseWholeCents,
  submitOnboardingEstimates,
  type CommitResult,
  type Household,
} from "./core/index.ts";
import "./onboarding.css";

type OnboardingEstimatesProps = {
  household: Household;
  memberId: string;
  busy?: boolean;
  onCommit: (fn: (current: Household) => CommitResult) => void;
};

function initialDraft(household: Household, memberId: string): Record<string, string> {
  const submission = currentSubmission(household, memberId, "estimates");
  return Object.fromEntries((submission?.estimates ?? []).map((row) => [
    row.subcategoryId,
    (row.amountCents / 100).toFixed(2),
  ]));
}

export function OnboardingEstimates(props: OnboardingEstimatesProps) {
  const scopeKey = `${props.household.householdId}:${props.memberId}`;
  return <ScopedOnboardingEstimates key={scopeKey} {...props} />;
}

function ScopedOnboardingEstimates({
  household,
  memberId,
  busy,
  onCommit,
}: OnboardingEstimatesProps) {
  const state = onboardingEstimateState(household);
  const fieldPrefix = useId();
  const helpId = `${fieldPrefix}-help`;
  const errorId = `${fieldPrefix}-error`;
  const [draft, setDraft] = useState<Record<string, string>>(() => initialDraft(household, memberId));
  const [error, setError] = useState("");
  const [invalidCategoryId, setInvalidCategoryId] = useState<string | null>(null);
  const other = household.members.find((member) => member.active && member.id !== memberId);
  const selfNeedsSubmission = state.needsSubmissionMemberIds.includes(memberId);
  const selfStale = state.staleMemberIds.includes(memberId);

  function submit() {
    const estimates: Array<{ subcategoryId: string; amountCents: number }> = [];
    for (const categoryId of state.categoryIds) {
      const value = draft[categoryId]?.trim() ?? "";
      if (!value) continue;
      try {
        estimates.push({
          subcategoryId: categoryId,
          amountCents: parseWholeCents(value, "Estimate", { allowZero: true }),
        });
      } catch {
        setInvalidCategoryId(categoryId);
        setError(copy("estimates.invalid"));
        document.getElementById(`${fieldPrefix}-${state.categoryIds.indexOf(categoryId)}`)?.focus();
        return;
      }
    }
    onCommit((current) => submitOnboardingEstimates(current, {
      memberId,
      createdBy: memberId,
      estimates,
    }));
    setError("");
    setInvalidCategoryId(null);
  }

  return (
    <section className="card onboarding-estimate-card" data-testid="onboarding-estimates">
      <header className="onboarding-estimate-header">
        <p className="kicker">{copy("estimates.currency")}</p>
        <h2>{copy("estimates.title")}</h2>
        <p className="onboarding-estimate-reassure">{copy("guess.reassure")}</p>
      </header>

      {state.kind === "categories-pending" || state.kind === "invalid" ? (
        <p className="onboarding-estimate-status" role="status">
          {copy("estimates.categories-first")}
        </p>
      ) : state.kind === "complete" ? (
        <>
          <div className="onboarding-estimate-reveal" aria-live="polite">
            <h3>{copy("estimates.together")}</h3>
            <div className="onboarding-estimate-member-sets">
              {state.currentMemberIds.map((id) => {
                const name = household.members.find((member) => member.id === id)?.name ?? id;
                return (
                  <section key={id} aria-label={copy("estimates.member-set", { name })}>
                    <h3>{copy("estimates.member-set", { name })}</h3>
                    <dl>
                      {(state.bySubmitter[id] ?? []).map((answer) => (
                        <div key={answer.categoryId}>
                          <dt>{answer.label}</dt>
                          <dd>{answer.kind === "missing" ? copy("estimates.missing") : formatCad(answer.amountCents ?? 0)}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                );
              })}
            </div>
          </div>
          <p className="onboarding-estimate-done" role="status">{copy("estimates.done")}</p>
        </>
      ) : selfNeedsSubmission ? (
        <>
          <p className="onboarding-estimate-guide">
            {copy(selfStale ? "estimates.changed" : "estimates.guide")}
          </p>
          <p className="onboarding-estimate-blank-help" id={helpId}>{copy("estimates.blank-help")}</p>
          <div className="onboarding-estimate-fields">
            {state.categoryIds.map((categoryId, index) => {
              const label = household.categories.find((row) => row.id === categoryId)?.name ?? categoryId;
              const inputId = `${fieldPrefix}-${index}`;
              return (
                <label key={categoryId} className="onboarding-estimate-field" htmlFor={inputId}>
                  <span className="onboarding-estimate-field-name">{label}</span>
                  <span className="onboarding-estimate-field-caption">{copy("estimates.currency")}</span>
                  <input
                    id={inputId}
                    inputMode="decimal"
                    autoComplete="off"
                    value={draft[categoryId] ?? ""}
                    placeholder={copy("estimates.placeholder")}
                    aria-describedby={`${helpId}${invalidCategoryId === categoryId ? ` ${errorId}` : ""}`}
                    aria-invalid={invalidCategoryId === categoryId || undefined}
                    disabled={busy}
                    onChange={(event) => {
                      setDraft((current) => ({ ...current, [categoryId]: event.target.value }));
                      if (invalidCategoryId === categoryId) {
                        setInvalidCategoryId(null);
                        setError("");
                      }
                    }}
                  />
                </label>
              );
            })}
          </div>
          {error ? <p className="onboarding-estimate-error" id={errorId} role="alert">{error}</p> : null}
          <button type="button" className="primary onboarding-estimate-primary" disabled={busy} onClick={submit}>
            {copy("estimates.submit")}
          </button>
        </>
      ) : (
        <div className="onboarding-estimate-wait" role="status" aria-live="polite">
          <span aria-hidden="true">✓</span>
          <p>{copy("estimates.waiting", { name: other?.name ?? "your partner" })}</p>
        </div>
      )}
    </section>
  );
}
