import { useState } from "react";
import {
  addGoal,
  describeGoalContributors,
  formatCad,
  fundGoal,
  goalIsFull,
  goalStatus,
  kittyBankFill,
  kittyBankStep,
  kittyBanksInView,
  retiredGoals,
  todayKey,
  upcomingVisitProposals,
  vaultReceiptBlurb,
  type CommitResult,
  type Goal,
  type Household,
  type LedgerView,
} from "./core/index.ts";
import { ConfirmSheet } from "./Confirm.tsx";
import { CollapsibleCard } from "./theme/PaperTheme.tsx";
import { PurchaseGoalSheet } from "./widgets/Jars.tsx";

function PaperBank({ goal, role }: { goal: Goal; role: "subaccount" | "goal" }) {
  const step = kittyBankStep(goal);
  const fill = Math.round(kittyBankFill(goal) * 100);
  const belly = 16 + step * 2.2;
  const slips = Math.max(0, step);
  return (
    <div
      className="paper-bank"
      data-kitty-step={step}
      data-kitty-role={role}
      style={{ ["--kitty-step" as string]: String(step) }}
    >
      <svg className="paper-bank-shape" viewBox="0 0 80 100" aria-hidden="true">
        <ellipse className="paper-bank-lid" cx="40" cy={16 - step * 0.3} rx={14 + step * 0.9} ry={7 + step * 0.2} />
        <path
          className="paper-bank-body"
          d={`M ${24 - step * 0.6} 22
            Q ${40 - belly} 55 ${16 - step * 0.8} ${86 + step * 0.4}
            Q 40 ${94 + step * 0.6} ${64 + step * 0.8} ${86 + step * 0.4}
            Q ${40 + belly} 55 ${56 + step * 0.6} 22 Z`}
        />
        {Array.from({ length: slips }, (_, index) => (
          <ellipse
            key={`slip-${index}`}
            className="paper-bank-slip"
            cx={40}
            cy={78 - index * (3.6 + step * 0.15)}
            rx={9 + index * 0.7 + step * 0.4}
            ry={2.4}
          />
        ))}
        {step >= 3 ? <circle className="paper-bank-coin" cx={32} cy={72} r={3.2 + step * 0.12} /> : null}
        {step >= 6 ? <circle className="paper-bank-coin" cx={48} cy={68} r={3.6 + step * 0.1} /> : null}
        {step >= 9 ? <circle className="paper-bank-coin" cx={40} cy={60} r={4.2} /> : null}
      </svg>
      <span className="sr-only">
        {goal.name} {fill} percent saved, {formatCad(goal.savedCents)} of {formatCad(goal.targetCents)}
      </span>
    </div>
  );
}

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
  const [pending, setPending] = useState<{ goalId: string; name: string; amount: string; fromAccountId: string } | null>(null);
  const today = todayKey();
  const live = kittyBanksInView(household, view, createdBy);
  const retired = retiredGoals({ goals: household.goals }).filter((goal) => (
    view === "household" ? goal.shared : !goal.shared
  ));
  const shared = view === "household";
  const proposals = shared ? upcomingVisitProposals(household, today) : [];
  const manage = surface === "plan";
  const role = shared ? "subaccount" : "goal";

  function amountFor(goalId: string): string {
    return amounts[goalId] ?? "25";
  }

  function requestContribute(goal: Goal) {
    const allowed = (account: Household["accounts"][number]) => (
      account.active && (account.scope !== "personal" || account.ownerMemberId === createdBy)
    );
    const fromAccountId = booksHousehold.accounts.find((account) => allowed(account) && account.kind === "chequing")?.id
      ?? household.accounts.find((account) => allowed(account) && account.kind === "chequing")?.id
      ?? booksHousehold.accounts.find((account) => allowed(account))?.id;
    if (!fromAccountId) return;
    setPending({
      goalId: goal.id,
      name: goal.name,
      amount: amountFor(goal.id),
      fromAccountId,
    });
  }

  return (
    <section className={`card kitty-banks ${manage ? "is-plan" : "is-home"}`} data-kitty-banks={view} data-kitty-surface={surface}>
      <header><h2>Kitty Banks</h2></header>
      {shared ? (
        <p className="muted">
          Sub-accounts of the shared pool. Fund surplus rolls here. The money remains in Bianca’s savings. Hearth cannot move it. This is D-161, not a new envelope.
        </p>
      ) : (
        <p className="muted">
          Personal goals on this folio. Fund surplus does not land here.
        </p>
      )}
      {manage && shared ? <p className="muted">{vaultReceiptBlurb(household, today)}</p> : null}
      {live.length === 0 ? (
        <p className="muted">{shared ? "No shared banks yet." : "No personal banks yet."}</p>
      ) : (
        <div className="kitty-banks-shelf">
          {live.map((goal) => {
            const fill = Math.round(kittyBankFill(goal) * 100);
            const contributors = describeGoalContributors(household, goal.id);
            return (
              <div className="kitty-bank" key={goal.id} data-kitty-step={kittyBankStep(goal)}>
                <PaperBank goal={goal} role={role} />
                <div className="kitty-bank-copy">
                  <strong>{goal.name}</strong>
                  <div className="muted">
                    {formatCad(goal.savedCents)} / {formatCad(goal.targetCents)}
                    {contributors ? ` · ${contributors}` : ""}
                  </div>
                  <span className="kitty-bank-pct">{fill}% · {shared ? "sub-account" : "goal"}</span>
                </div>
                {manage ? (
                  <div className="goal-add">
                    <input
                      inputMode="decimal"
                      aria-label={`Contribution for ${goal.name}`}
                      value={amountFor(goal.id)}
                      onChange={(event) => setAmounts((current) => ({ ...current, [goal.id]: event.target.value }))}
                    />
                    <button type="button" className="chip" disabled={busy} onClick={() => requestContribute(goal)}>
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
        </div>
      )}
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
        <CollapsibleCard
          title={shared ? "Add shared bank" : "Add personal bank"}
          hint="New goal. Not a second envelope."
          defaultOpen={false}
        >
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
        </CollapsibleCard>
      ) : (
        onOpenPlan ? (
          <button type="button" className="chip" onClick={onOpenPlan}>Customize on Plan</button>
        ) : null
      )}
      {pending ? (
        <ConfirmSheet
          title="Confirm this bank"
          body={`Post ${pending.amount} CAD into ${pending.name} from ${
            household.accounts.find((account) => account.id === pending.fromAccountId)?.name
            ?? booksHousehold.accounts.find((account) => account.id === pending.fromAccountId)?.name
            ?? "the source account"
          }. This writes a transfer into the goal.`}
          extra="Kitty Banks are existing goals. Confirm is the money boundary."
          confirmLabel="Confirm"
          busy={busy}
          onCancel={() => setPending(null)}
          onConfirm={() => {
            const next = pending;
            setPending(null);
            onCommand((current) => fundGoal(current, {
              goalId: next.goalId,
              amount: next.amount,
              fromAccountId: next.fromAccountId,
              createdBy,
            }));
          }}
        />
      ) : null}
    </section>
  );
}
