import { useState } from "react";
import {
  formatCad,
  formatDateLabel,
  goalLedger,
  goalsVaultAccount,
  JARS_EMPTY,
  purchaseGoal,
  retiredGoals,
  unallocatedVaultCents,
  vaultReceiptBlurb,
} from "../core/index.ts";
import type { Dashboard } from "../core/insights.ts";
import type { DateKey } from "../core/calendar.ts";
import type { CommitResult, Household } from "../core/index.ts";

function Piggy({ fill, late, clipId, retired }: { fill: number; late?: boolean; clipId: string; retired?: boolean }) {
  const level = Math.max(0, Math.min(1, fill));
  const clipY = 62 - level * 34;
  const clip = `pig-fill-${clipId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg className={`piggy ${late ? "is-late" : ""} ${retired ? "is-retired" : ""}`} viewBox="0 0 88 72" aria-hidden="true">
      <defs>
        <clipPath id={clip}>
          <rect x="8" y={clipY} width="72" height="48" />
        </clipPath>
      </defs>
      <ellipse cx="46" cy="42" rx="28" ry="20" fill="#fdfbf6" stroke="#1b1712" strokeWidth="1.6" />
      <ellipse cx="46" cy="42" rx="28" ry="20" fill={retired ? "#c9a227" : "#c9a884"} opacity="0.35" clipPath={`url(#${clip})`} />
      <rect x="42" y="16" width="10" height="5" rx="1.4" fill="#1b1712" />
      <ellipse cx="22" cy="40" rx="8" ry="7" fill="#fdfbf6" stroke="#1b1712" strokeWidth="1.4" />
      <circle cx="19" cy="38" r="1.1" fill="#1b1712" />
      <circle cx="24" cy="38" r="1.1" fill="#1b1712" />
      <ellipse cx="22" cy="43" rx="3.2" ry="2" fill="#e8d7c0" stroke="#1b1712" strokeWidth="0.8" />
      <path d="M70 34c6 2 10 8 8 14" fill="none" stroke="#1b1712" strokeWidth="1.6" strokeLinecap="round" />
      <ellipse cx="36" cy="60" rx="5" ry="3.2" fill="#e8d7c0" stroke="#1b1712" strokeWidth="1.1" />
      <ellipse cx="56" cy="60" rx="5" ry="3.2" fill="#e8d7c0" stroke="#1b1712" strokeWidth="1.1" />
      <circle cx="38" cy="36" r="3.2" fill="#c9a884" opacity="0.55" />
      <circle cx="58" cy="46" r="2.4" fill="#c9a884" opacity="0.45" />
      {late && <path d="M18 14h12l-2 8h-8z" fill="#c45c26" />}
    </svg>
  );
}

export function JarsGlance({ dashboard }: { dashboard: Dashboard }) {
  const nearest = dashboard.goals[0];
  if (!nearest) return <span>shelf</span>;
  return <span>{nearest.goal.name} · {Math.round(nearest.progress * 100)}%</span>;
}

export function PurchaseGoalSheet({
  household,
  goalId,
  busy,
  onCommand,
  onClose,
}: {
  household: Household;
  goalId: string;
  busy: boolean;
  onCommand: (fn: (current: Household) => CommitResult) => void;
  onClose: () => void;
}) {
  const goal = household.goals.find((item) => item.id === goalId);
  const [total, setTotal] = useState(goal ? (goal.savedCents / 100).toFixed(2) : "");
  const [lineNote, setLineNote] = useState("");
  const [lineAmount, setLineAmount] = useState("");
  const [lines, setLines] = useState<{ note: string; amount: string }[]>([]);
  const [error, setError] = useState("");
  if (!goal) return null;
  return (
    <div className="purchase-sheet">
      <p className="muted">How much did {goal.name} actually cost? Leftover in the vault stays unallocated. Confirm posts an expense from the Goals vault.</p>
      <label>
        Spent
        <input inputMode="decimal" value={total} onChange={(event) => setTotal(event.target.value)} aria-label="Amount spent" />
      </label>
      {lines.map((line, index) => (
        <p key={`${line.note}-${index}`} className="muted">{line.note || "Line"} · {line.amount}</p>
      ))}
      <div className="row">
        <input placeholder="Receipt line" value={lineNote} onChange={(event) => setLineNote(event.target.value)} />
        <input inputMode="decimal" placeholder="0.00" value={lineAmount} onChange={(event) => setLineAmount(event.target.value)} />
        <button
          type="button"
          className="chip"
          onClick={() => {
            if (!lineAmount.trim()) return;
            setLines((current) => [...current, { note: lineNote.trim(), amount: lineAmount.trim() }]);
            setLineNote("");
            setLineAmount("");
          }}
        >
          Add line
        </button>
      </div>
      {error && <p className="muted">{error}</p>}
      <div className="row">
        <button type="button" className="chip quiet" onClick={onClose}>Not yet</button>
        <button
          type="button"
          className="primary"
          disabled={busy}
          onClick={() => {
            try {
              onCommand((current) => purchaseGoal(current, {
                goalId,
                amount: total,
                lines: lines.length ? lines : undefined,
              }));
              onClose();
              setError("");
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : String(caught));
            }
          }}
        >
          Purchased
        </button>
      </div>
    </div>
  );
}

export function JarsBody({
  dashboard,
  household,
  today,
  busy,
  onPlan,
  onCommand,
}: {
  dashboard: Dashboard;
  household: Household;
  today: DateKey;
  busy?: boolean;
  onPlan: () => void;
  onCommand?: (fn: (current: Household) => CommitResult) => void;
}) {
  const [buying, setBuying] = useState<string | null>(null);
  const vault = goalsVaultAccount(household);
  const retired = retiredGoals(household);
  const receipt = goalLedger(household);
  const loose = unallocatedVaultCents(household, today);

  if (!dashboard.goals.length && !retired.length) {
    return (
      <>
        <p className="muted">{JARS_EMPTY}</p>
        <p className="muted">{vaultReceiptBlurb(household, today)}</p>
        <button type="button" className="cabinet-handle" onClick={onPlan}>Add a goal</button>
      </>
    );
  }
  return (
    <>
      <p className="muted">{vaultReceiptBlurb(household, today)}</p>
      <div className="piggy-shelf">
        {dashboard.goals.map((item) => {
          const late = Boolean(item.goal.deadline && item.goal.deadline < today && item.progress < 1);
          const full = item.progress >= 1;
          return (
            <div key={item.goal.id} className="piggy-card">
              <Piggy fill={item.progress} late={late} clipId={item.goal.id} />
              <div className="piggy-meter" aria-hidden="true">
                <i style={{ width: `${Math.round(item.progress * 100)}%` }} />
              </div>
              <div className="row">
                <span>{item.goal.name}</span>
                <span>{Math.round(item.progress * 100)}%</span>
              </div>
              <p className="muted">
                {formatCad(item.goal.savedCents)} / {formatCad(item.goal.targetCents)}
                {item.goal.deadline ? ` · ${formatDateLabel(item.goal.deadline)}` : ""}
              </p>
              {full && onCommand && (
                buying === item.goal.id ? (
                  <PurchaseGoalSheet
                    household={household}
                    goalId={item.goal.id}
                    busy={Boolean(busy)}
                    onCommand={onCommand}
                    onClose={() => setBuying(null)}
                  />
                ) : (
                  <button type="button" className="primary" onClick={() => setBuying(item.goal.id)}>Purchased?</button>
                )
              )}
            </div>
          );
        })}
      </div>
      {vault && (
        <details className="vault-receipt">
          <summary>Goals vault receipt</summary>
          <p className="muted">{vault.name}. Unallocated {formatCad(loose)} stays in the vault, not a pig.</p>
          {receipt.length === 0 ? (
            <p className="muted">No parking, contributions, or purchases yet.</p>
          ) : receipt.slice(-12).reverse().map((row) => (
            <p key={row.id} className="muted">
              {row.date} · {row.label} · {formatCad(row.amountCents)}
            </p>
          ))}
        </details>
      )}
      {retired.length > 0 && (
        <div className="retirement-home">
          <h4>Retirement home</h4>
          <p className="muted">Jars you actually bought. The rows stay on the books.</p>
          <div className="piggy-shelf">
            {retired.map((goal) => (
              <div key={goal.id} className="piggy-card is-retired">
                <Piggy fill={1} clipId={`${goal.id}-retired`} retired />
                <div className="row">
                  <span>{goal.name}</span>
                  <span>home</span>
                </div>
                <p className="muted">
                  Saved {formatCad(goal.savedCents)}
                  {goal.retiredAt ? ` · ${formatDateLabel(goal.retiredAt.slice(0, 10))}` : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="muted">Pigs fill from posted contributions. Cash lives in the Goals vault. Contribute stays on Plan.</p>
      <button type="button" className="cabinet-handle" onClick={onPlan}>Plan</button>
    </>
  );
}
