import { useMemo, useState } from "react";
import {
  applySitDown,
  formatCad,
  formatMonthLabel,
  monthKeyFromDateKey,
  sitDownPreview,
  todayKey,
  type Household,
  type UndoToken,
} from "./core/index.ts";

export function SitDownGuide({
  household,
  onApply,
  hidden,
}: {
  household: Household;
  onApply: (household: Household, undo?: UndoToken) => void;
  hidden?: boolean;
}) {
  const [step, setStep] = useState(0);
  const monthKey = monthKeyFromDateKey(todayKey());
  const preview = useMemo(() => sitDownPreview(household, monthKey), [household, monthKey]);
  const trims = preview.rows.filter((row) => row.trimSuggested);
  const jobs = preview.rows.filter((row) => row.suggestedCents > 0 && !row.alreadyPlanned);

  if (hidden) {
    return (
      <section className="card">
        <header><h2>Sit-down</h2></header>
        <p className="muted">Household view plans for both of you.</p>
      </section>
    );
  }

  if (!jobs.length) {
    return (
      <section className="card sit-guide">
        <header><h2>Sit-down</h2><span className="muted">{formatMonthLabel(preview.targetMonth)}</span></header>
        <p>Nothing left to copy. {formatMonthLabel(preview.targetMonth)} already has jobs, or last month was quiet.</p>
      </section>
    );
  }

  return (
    <section className="card sit-guide">
      <header>
        <h2>Sit-down</h2>
        <span className="muted">{step + 1} / 3</span>
      </header>
      {step === 0 && (
        <>
          <p className="sit-q">Copy {formatMonthLabel(preview.sourceMonth)} into {formatMonthLabel(preview.targetMonth)}?</p>
          <p className="muted">Same jobs. You still confirm. Hercules loafs.</p>
          <button className="primary" onClick={() => setStep(1)}>Look</button>
        </>
      )}
      {step === 1 && (
        <>
          <p className="sit-q">
            {trims.length
              ? `${trims.length} ran hot. Next month meets them in the middle.`
              : "Nothing ran hot. Next month copies last month."}
          </p>
          {trims.slice(0, 4).map((row) => (
            <div className="row" key={row.subcategoryId}>
              <span>{row.name}</span>
              <span className="muted">{formatCad(row.lastActualCents)} → {formatCad(row.suggestedCents)}</span>
            </div>
          ))}
          <div className="chips">
            <button className="chip" type="button" onClick={() => setStep(0)}>Back</button>
            <button className="primary" type="button" onClick={() => setStep(2)}>That's the plan</button>
          </div>
        </>
      )}
      {step === 2 && (
        <>
          <p className="sit-q">Apply {jobs.length} jobs to {formatMonthLabel(preview.targetMonth)}?</p>
          <p className="muted">Writes budgets. Not a post. Close pack on Books is the lock.</p>
          <div className="chips">
            <button className="chip" type="button" onClick={() => setStep(1)}>Back</button>
            <button
              className="primary"
              type="button"
              onClick={() => {
                const result = applySitDown(household, preview.sourceMonth, {});
                setStep(0);
                onApply(result.household, result.undo);
              }}
            >
              Apply
            </button>
          </div>
        </>
      )}
    </section>
  );
}
