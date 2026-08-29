import { useState } from "react";
import {
  addGoal,
  describeGoalContributors,
  formatCad,
  fundGoal,
  goalIsFull,
  goalStatus,
  kittyBankFill,
  kittyBanksInView,
  retiredGoals,
  todayKey,
  upcomingVisitProposals,
  vaultReceiptBlurb,
  type CommitResult,
  type Household,
  type LedgerView,
} from "./core/index.ts";
import { PurchaseGoalSheet } from "./widgets/Jars.tsx";

/** Existing goals as paper banks. Shared Fund surplus (D-161) is not a second envelope. */
export function KittyBanks({
  household,
  booksHousehold,
  view,
  createdBy,
  busy = false,
  surface = "plan",
  onCommand,
  onAskStartJar,
  onShowHome,
  onOpenPlan,
}: {
  household: Household;
  booksHousehold: Household;
  view: LedgerView;
  createdBy: string;
  busy?: boolean;
  surface?: "home" | "plan";
  onCommand: (fn: (current: Household) => CommitResult) => void;
  onAskStartJar?: (appointmentId: string, summary: string) => void;
  onShowHome?: () => void;
  onOpenPlan?: () => void;
}) {
  const [name, setName] = useState("New bank");
  const [target, setTarget] = useState("500");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [buying, setBuying] = useState<string | null>(null);
  const today = todayKey();
  const live = kittyBanksInView(household, view, createdBy);
  const retired = retiredGoals({ goals: household.goals }).filter((goal) => (
    view === "household" ? goal.shared : !goal.shared
  ));
  const shared = view === "household";
  const proposals = shared ? upcomingVisitProposals(household, today) : [];
  const manage = surface === "plan";

  function amountFor(goalId: string): string {
    return amounts[goalId] ?? "25";
  }

  function contribute(goalId: string) {
    const fromAccountId = booksHousehold.accounts.find((account) => account.active && account.kind === "chequing")?.id
      ?? household.accounts.find((account) => account.active)?.id
      ?? booksHousehold.accounts.find((account) => account.active)?.id;
    if (!fromAccountId) return;
    onCommand((current) => fundGoal(current, {
      goalId,
      amount: amountFor(goalId),
      fromAccountId,
      createdBy,
    }));
  }

  return (
    <section className={`card kitty-banks ${manage ? "is-plan" : "is-home"}`} data-kitty-banks={view} data-kitty-surface={surface}>
      <header><h2>Kitty Banks</h2></header>
      {shared ? (
        <p className="muted">
          Fund surplus rolls into these existing shared goals. The money remains in Bianca’s savings. Hearth cannot move it. This is D-161, not a new envelope.
        </p>
      ) : (
        <p className="muted">
          Personal banks on this folio. They are existing goals, paper-named. Fund surplus does not land here.
        </p>
      )}
      {manage && shared ? <p className="muted">{vaultReceiptBlurb(household, today)}</p> : null}
      {live.length === 0 ? (
        <p className="muted">{shared ? "No shared banks yet." : "No personal banks yet."}</p>
      ) : live.map((goal) => {
        const fill = Math.round(kittyBankFill(goal) * 100);
        const contributors = describeGoalContributors(household, goal.id);
        return (
          <div className="kitty-bank" key={goal.id}>
            <div className="row">
              <div>
                <strong>{goal.name}</strong>
                <div className="muted">
                  {formatCad(goal.savedCents)} / {formatCad(goal.targetCents)}
                  {contributors ? ` · ${contributors}` : ""}
                </div>
              </div>
              <span className="kitty-bank-pct">{fill}%</span>
            </div>
            <div
              className="kitty-bank-fill"
              role="img"
              aria-label={`${goal.name} ${fill} percent saved, ${formatCad(goal.savedCents)} of ${formatCad(goal.targetCents)}`}
            >
              <i style={{ width: `${fill}%` }} />
            </div>
            {manage ? (
              <div className="goal-add">
                <input
                  inputMode="decimal"
                  aria-label={`Contribution for ${goal.name}`}
                  value={amountFor(goal.id)}
                  onChange={(event) => setAmounts((current) => ({ ...current, [goal.id]: event.target.value }))}
                />
                <button type="button" className="chip" disabled={busy} onClick={() => contribute(goal.id)}>
                  {goalStatus(goal) === "unfunded" ? "Fund bank" : "+ add"}
                </button>
                {goalIsFull(goal) && (
                  <button type="button" className="primary" disabled={busy} onClick={() => setBuying(goal.id)}>Mark purchased</button>
                )}
              </div>
            ) : null}
            {manage && goalIsFull(goal) && buying === goal.id && (
              <PurchaseGoalSheet
                household={booksHousehold}
                goalId={goal.id}
                busy={busy}
                onCommand={onCommand}
                onClose={() => setBuying(null)}
              />
            )}
          </div>
        );
      })}
      {manage && proposals.map((proposal) => (
        <div className="row" key={proposal.appointmentId}>
          <div>
            <strong>{proposal.title}</strong>
            <div className="muted">{proposal.hercules}</div>
          </div>
          <button
            type="button"
            className="chip selected"
            onClick={() => onAskStartJar?.(proposal.appointmentId, `${proposal.hercules} This creates a shared goal. Hercules does not write it.`)}
          >
            Start this bank
          </button>
        </div>
      ))}
      {manage && retired.length > 0 && (
        <div className="retirement-home">
          <h3>Completed banks</h3>
          <p className="muted">Banks you marked purchased. Contribution rows and the purchase expense stay on the books.</p>
          {retired.map((goal) => (
            <div className="row" key={goal.id}>
              <div>
                <strong>{goal.name}</strong>
                <div className="muted">Accomplished · saved {formatCad(goal.savedCents)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {manage ? (
        <>
          <label htmlFor="kitty-new-bank-name">New bank</label>
          <input id="kitty-new-bank-name" value={name} onChange={(event) => setName(event.target.value)} aria-label="New bank name" />
          <input value={target} onChange={(event) => setTarget(event.target.value)} aria-label="New bank target" />
          <button
            type="button"
            className="primary"
            disabled={busy}
            onClick={() => {
              onCommand((current) => addGoal(current, shared
                ? { name, target, shared: true }
                : { name, target, shared: false, ownerMemberId: createdBy }));
            }}
          >
            {shared ? "Add shared bank" : "Add personal bank"}
          </button>
          {onShowHome ? (
            <button type="button" className="chip" onClick={onShowHome}>Show on Home</button>
          ) : null}
        </>
      ) : (
        onOpenPlan ? (
          <button type="button" className="chip" onClick={onOpenPlan}>Customize on Plan</button>
        ) : null
      )}
    </section>
  );
}
