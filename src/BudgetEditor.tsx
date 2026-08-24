import { useMemo, useState } from "react";
import {
  ValidationError,
  formatCad,
  monthSummary,
  setBudget,
  type Household,
  type MonthKey,
  type UndoToken,
} from "./core/index.ts";

export function BudgetEditor({
  household,
  monthKey,
  monthLabel,
  onSave,
}: {
  household: Household;
  monthKey: MonthKey;
  monthLabel: string;
  onSave: (household: Household, undo?: UndoToken) => void;
}) {
  const summary = useMemo(() => monthSummary(household, monthKey), [household, monthKey]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const rows = summary.categories.filter((row) => row.type === "expense" || row.type === "income");
  const expenses = rows.filter((row) => row.type === "expense");
  const income = rows.filter((row) => row.type === "income");

  function dollarsFor(row: (typeof rows)[number]): string {
    return drafts[row.subcategoryId] ?? (row.budgetedCents / 100).toFixed(2);
  }

  function save(row: (typeof rows)[number]) {
    try {
      const result = setBudget(household, {
        monthKey,
        subcategoryId: row.subcategoryId,
        amount: dollarsFor(row),
      });
      onSave(result.household, result.undo);
      setDrafts((current) => {
        const next = { ...current };
        delete next[row.subcategoryId];
        return next;
      });
      setError("");
      setSavingId(row.subcategoryId);
    } catch (caught) {
      setError(caught instanceof ValidationError ? caught.message : String(caught));
    }
  }

  function Section({ title, items }: { title: string; items: typeof rows }) {
    if (!items.length) return null;
    return (
      <>
        <p className="muted" style={{ marginTop: 12 }}>{title}</p>
        {items.map((row) => {
          const pct = row.budgetedCents ? Math.min(140, (row.actualCents / row.budgetedCents) * 100) : 0;
          return (
            <div key={row.subcategoryId} className="budget-row">
              <div className="row">
                <span>
                  {row.name}
                  {row.groupName ? <span className="muted"> · {row.groupName}</span> : null}
                </span>
                <span className="muted">{formatCad(row.actualCents)} spent</span>
              </div>
              <div className="bar"><i className={pct > 100 ? "over" : ""} style={{ width: `${Math.min(pct, 100)}%` }} /></div>
              <div className="row">
                <label>
                  This month’s job (CAD)
                  <input
                    inputMode="decimal"
                    value={dollarsFor(row)}
                    onChange={(event) => setDrafts((current) => ({ ...current, [row.subcategoryId]: event.target.value }))}
                    aria-label={`${row.name} budget`}
                  />
                </label>
                <button
                  className="chip selected"
                  type="button"
                  onClick={() => save(row)}
                >
                  {savingId === row.subcategoryId ? "Saved" : "Save job"}
                </button>
              </div>
            </div>
          );
        })}
      </>
    );
  }

  return (
    <section className="card budget-editor">
      <header>
        <h2>Set this month’s jobs</h2>
        <span className="muted">{monthLabel}</span>
      </header>
      <p className="muted">
        Quiet categories can still get a plan. $0 is an explicit job, not a hidden row. Sit-down Copy jobs can fill these from last month.
      </p>
      <Section title="Expenses" items={expenses} />
      <Section title="Income" items={income} />
      {error && <p className="danger">{error}</p>}
    </section>
  );
}
