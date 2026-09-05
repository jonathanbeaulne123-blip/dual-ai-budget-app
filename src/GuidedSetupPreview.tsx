import { useState } from "react";
import {
  SITTING_MARK_COUNT,
  SHELL_VIEW,
  copy,
  flavorFor,
  householdChapters,
  taskLengthLabel,
  type Household,
  type OnboardingChapter,
} from "./core/index.ts";
import "./onboarding.css";
import "./guided-setup-preview.css";

const ACTION_COPY: Record<string, string> = {
  "ch-01-meet": "continue.next",
  "ch-02-household": "probe.retry",
  "ch-03-charter": "charter.write",
  "ch-04-accounts": "accounts.open",
  "ch-05-opening": "opening.open",
  "ch-06-fund": "fund.open",
  "ch-07-recurrences": "recurrences.open",
  "ch-08-cadence": "cadence.open",
  "ch-09-categories": "categories.open",
  "ch-10-estimates": "estimates.open",
  "ch-11-plan": "proposal.open",
  "ch-12-ready": "ready.open-books",
};

function destinationLabel(chapter: OnboardingChapter): string {
  if (!chapter.target) return "Here with Hercules";
  const names: Record<string, string> = {
    more: "More",
    ledger: "Books",
    calendar: "Calendar",
    shift: "Shift",
    plan: "Plan",
  };
  return names[chapter.target.tab] ?? chapter.target.tab;
}

/**
 * A Development-only, read-only gallery of the shipped conductor copy.
 * It never receives onCommit and cannot touch the accepted household.
 */
export function GuidedSetupPreview({ household }: { household: Household }) {
  const chapters = householdChapters();
  const [index, setIndex] = useState(0);
  const chapter = chapters[index] ?? chapters[0]!;
  const railIndex = Math.max(0, (chapter.sitting ?? 1) - 1);

  return (
    <section className="card guided-preview" aria-labelledby="guided-preview-title">
      <header>
        <div>
          <p className="eyebrow">Development preview · read only</p>
          <h2 id="guided-preview-title">Guided household setup</h2>
        </div>
        <span className="guided-preview__safe">Nothing is saved</span>
      </header>
      <p className="muted">
        Look through every chapter without changing this household. Preview actions do not post money, approve anything, or contact the cloud.
      </p>
      <details className="guided-preview__details">
        <summary>Preview guided setup</summary>
        <div className="guided-preview__workspace">
          <nav className="guided-preview__chapters" aria-label="Guided setup chapters">
            {chapters.map((row, chapterIndex) => (
              <button
                key={row.id}
                type="button"
                className={chapterIndex === index ? "is-current" : ""}
                aria-current={chapterIndex === index ? "step" : undefined}
                onClick={() => setIndex(chapterIndex)}
              >
                <span>{row.order}</span>
                <small>Sitting {row.sitting}</small>
              </button>
            ))}
          </nav>

          <div
            className="onboarding-shell guided-preview__shell"
            style={{ paddingTop: SHELL_VIEW.padTop, paddingLeft: SHELL_VIEW.padSide, paddingRight: SHELL_VIEW.padSide }}
          >
            <div className="onboarding-rail" aria-hidden="true">
              {Array.from({ length: SITTING_MARK_COUNT }, (_, mark) => (
                <span
                  key={mark}
                  className={`onboarding-rail-mark${mark === railIndex ? " is-current" : ""}`}
                  style={{ width: SHELL_VIEW.railMarkWidth, height: SHELL_VIEW.railMarkHeight, marginRight: mark < SITTING_MARK_COUNT - 1 ? SHELL_VIEW.railGap : 0 }}
                />
              ))}
            </div>
            <p className="onboarding-turn" style={{ marginTop: SHELL_VIEW.railToTurn }}>
              Chapter {chapter.order} of {chapters.length} · {taskLengthLabel(chapter.timeBudgetSeconds)}
            </p>
            <p className="onboarding-herc" style={{ marginTop: SHELL_VIEW.turnToHerc, marginBottom: SHELL_VIEW.hercToCard, maxWidth: `${SHELL_VIEW.hercMaxEm}em` }}>
              {flavorFor(chapter.id, household.householdId)}
            </p>
            <section className="onboarding-card" style={{ marginBottom: SHELL_VIEW.cardToAction }}>
              <p className="onboarding-card-label">What you will do</p>
              <p className="onboarding-card-task">{copy(chapter.copyKey)}</p>
              <p className="onboarding-card-provenance">Opens: {destinationLabel(chapter)}</p>
            </section>
            <div className="onboarding-actions guided-preview__sample-action">
              <button type="button" disabled aria-describedby="guided-preview-action-help">
                {copy(ACTION_COPY[chapter.id] ?? "continue.next")}
              </button>
            </div>
            <p id="guided-preview-action-help" className="guided-preview__action-help">
              Sample only — the live guide enables this when the chapter is active.
            </p>
          </div>

          <div className="guided-preview__nav">
            <button type="button" className="ghost" disabled={index === 0} onClick={() => setIndex((current) => Math.max(0, current - 1))}>Previous chapter</button>
            <span>{index + 1} / {chapters.length}</span>
            <button type="button" className="ghost" disabled={index === chapters.length - 1} onClick={() => setIndex((current) => Math.min(chapters.length - 1, current + 1))}>Next chapter</button>
          </div>
        </div>
      </details>
    </section>
  );
}
