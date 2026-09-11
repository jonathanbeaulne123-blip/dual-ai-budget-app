import { KittyBankRoom, type KittyPlanContext, type KittyCommandOptions, type KittySubmissionReader } from "./kitty/KittyBankRoom.tsx";
import { useEffect, useRef, useState } from "react";
import {
  addGoal,
  goalsVaultAccount,
  isCashLikeKind,
  type Environment,
  describeGoalContributors,
  formatCad,
  fundGoal,
  fundRolloverByGoal,
  goalIsFull,
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
import { goalFundingBasis } from "./goalFundingReview.ts";
import { displayedKittyPiece } from "./core/kittyStudio.ts";
import { bisqueHex } from "./kitty/studio/paintCanvas.ts";
import { studioHex } from "./kitty/studio/palette.ts";
import { GoalFill, fillDraftCents } from "./GoalFill.tsx";
import { useAsyncScope } from "./asyncScope.ts";
import { ConfirmSheet } from "./Confirm.tsx";
import { CollapsibleCard } from "./theme/PaperTheme.tsx";
import { PurchaseGoalSheet } from "./widgets/Jars.tsx";

/** Coarse studio reflection on the shelf: dip colour, ears, eyes and mouth from the displayed piece. */
function paperBankLook(goal: Goal) {
  const piece = displayedKittyPiece(goal.envelope?.studio);
  if (!piece) return null;
  const fired = Boolean(piece.firedAt);
  const tone = (hex: string) => (fired ? studioHex(hex) : bisqueHex(hex));
  return {
    body: tone(piece.paint.parts.body ?? piece.paint.base),
    head: tone(piece.paint.parts.head ?? piece.paint.base),
    ears: piece.sculpt.ears,
    eyes: piece.sculpt.eyes,
    mouth: piece.sculpt.mouth,
    fired,
  };
}
function PaperBank({ goal, role }: { goal: Goal; role: "subaccount" | "goal" }) {
  const step = kittyBankStep(goal);
  const fill = Math.round(kittyBankFill(goal) * 100);
  const belly = 16 + step * 2.2;
  const slips = Math.max(0, step);
  const look = paperBankLook(goal);
  const lidY = 16 - step * 0.3, lidR = 14 + step * 0.9;
  return (
    <div
      className="paper-bank"
      data-kitty-step={step}
      data-kitty-role={role}
      data-kitty-fired={look ? String(look.fired) : undefined}
      style={{ ["--kitty-step" as string]: String(step), ...(look ? { ["--kitty-glaze" as string]: look.body, ["--kitty-head" as string]: look.head } : {}) }}
    >
      <svg className="paper-bank-shape" viewBox="0 0 80 100" aria-hidden="true">
        {look && look.ears !== "none" && (
          look.ears === "round"
            ? <><circle className="paper-bank-ear" cx={40 - lidR * 0.7} cy={lidY - 4} r={4} /><circle className="paper-bank-ear" cx={40 + lidR * 0.7} cy={lidY - 4} r={4} /></>
            : <path className="paper-bank-ear" d={`M${40 - lidR * 0.9} ${lidY} l3 ${look.ears === "folded" ? -5 : -10} l5 ${look.ears === "folded" ? 3 : 8} Z M${40 + lidR * 0.9} ${lidY} l-3 ${look.ears === "folded" ? -5 : -10} l-5 ${look.ears === "folded" ? 3 : 8} Z`} />
        )}
        <ellipse className="paper-bank-lid" cx="40" cy={lidY} rx={lidR} ry={7 + step * 0.2} />
        {look && (
          <g className="paper-bank-face">
            {look.eyes === "happy" || look.eyes === "sleepy"
              ? <path d={`M34 ${lidY} q2 ${look.eyes === "happy" ? -3 : 3} 4 0 M42 ${lidY} q2 ${look.eyes === "happy" ? -3 : 3} 4 0`} fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" />
              : <><circle cx={36} cy={lidY} r={look.eyes === "wide" ? 1.8 : 1.3} fill="currentColor" /><circle cx={44} cy={lidY} r={look.eyes === "wide" ? 1.8 : 1.3} fill="currentColor" /></>}
            <path d={look.mouth === "smile" || look.mouth === "grin" ? `M37 ${lidY + 3} q3 3 6 0` : look.mouth === "serene" ? `M38 ${lidY + 3.5} h4` : `M37 ${lidY + 3} q1.5 2 3 0 q1.5 2 3 0`} fill="none" stroke="currentColor" strokeWidth={1} strokeLinecap="round" />
          </g>
        )}
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
export function KittyBanks(props: KittyBanksProps) {
  const [open,setOpen]=useState(false);
  if (props.planContext || (open && props.surface !== "home")) return <KittyBankRoom household={props.booksHousehold} view={props.view} memberId={props.createdBy} busy={props.busy} identity={`${props.environment ?? props.booksHousehold.environment}:${props.household.householdId}:${props.createdBy}:${props.view}`} context={props.planContext} onReadSubmission={props.onReadSubmission} onCommand={props.onCommand} onClose={props.planContext?.onClose ?? (()=>setOpen(false))}/>;
  if (props.surface !== "home") return <section className="card"><h2>Kitty Banks</h2><p>Your goals, reserves and future plans have a room of their own.</p><button onClick={()=>setOpen(true)}>Enter Kitty Banks</button></section>;
  return <KittyBanksScope key={`${props.environment ?? props.booksHousehold.environment}:${props.household.householdId}:${props.createdBy}:${props.view}:${props.surface ?? "plan"}`} {...props} />;
}
type KittyBanksProps = {
  planContext?: KittyPlanContext;
  onReadSubmission?:KittySubmissionReader;
  environment?: Environment;
  household: Household;
  booksHousehold: Household;
  view: LedgerView;
  createdBy: string;
  busy?: boolean;
  surface?: "home" | "plan";
  onCommand: (fn: (current: Household) => CommitResult, options?:KittyCommandOptions) => unknown;
  onAskStartJar?: (appointmentId: string, summary: string) => void;
  onShowHome?: () => void;
  onOpenPlan?: () => void;
};
function KittyBanksScope({
  environment: suppliedEnvironment,
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
}: KittyBanksProps) {
  const environment = suppliedEnvironment ?? booksHousehold.environment;
  const [phone, setPhone] = useState(() => window.innerWidth < 720);
  useEffect(() => { const resize = () => setPhone(window.innerWidth < 720); window.addEventListener("resize", resize); return () => window.removeEventListener("resize", resize); }, []);
  const scope = useAsyncScope(`${environment}:${household.householdId}:${createdBy}:${view}`);
  const latestBooks = useRef(booksHousehold); latestBooks.current = booksHousehold;
  const [sources, setSources] = useState<Record<string, string>>({});
  const [name, setName] = useState("New bank");
  const [target, setTarget] = useState("500");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const goalDraftBasis = JSON.stringify(household.goals.map(goal => [goal.id, goal.name, goal.savedCents, goal.targetCents, goal.shared, goal.ownerMemberId, goal.status]));
  const priorGoalBasis = useRef(goalDraftBasis);
  useEffect(() => {
    if (priorGoalBasis.current !== goalDraftBasis) { priorGoalBasis.current = goalDraftBasis; setAmounts({}); }
  }, [goalDraftBasis]);
  const [buying, setBuying] = useState<string | null>(null);
  const [pending, setPending] = useState<{ goalId: string; name: string; amount: string; fromAccountId: string; basis: string; date: string } | null>(null);
  const today = todayKey();
  const live = kittyBanksInView(household, view, createdBy);
  const retired = retiredGoals({ goals: household.goals }).filter((goal) => (
    view === "household" ? goal.shared : !goal.shared && goal.ownerMemberId === createdBy
  ));
  const shared = view === "household";
  const rollover = fundRolloverByGoal(booksHousehold);
  const proposals = shared ? upcomingVisitProposals(household, today) : [];
  const manage = surface === "plan";
  const role = shared ? "subaccount" : "goal";

  function amountFor(goalId: string): string {
    if (priorGoalBasis.current !== goalDraftBasis) return phone ? "0" : "25";
    return amounts[goalId] ?? (phone ? "0" : "25");
  }

  function fundingSources(goal: Goal) {
    return booksHousehold.accounts.filter(account => account.active && isCashLikeKind(account.kind)
      && account.id !== goalsVaultAccount(booksHousehold)?.id
      && (goal.shared ? account.scope !== "personal" : account.scope === "personal" && account.ownerMemberId === createdBy));
  }
  function requestContribute(goal: Goal) {
    const fromAccountId = sources[goal.id];
    const cents = fillDraftCents(amountFor(goal.id));
    if (busy || !environment || !cents || !fromAccountId || !fundingSources(goal).some(account => account.id === fromAccountId)) return;
    setPending({ goalId: goal.id, name: goal.name, amount: amountFor(goal.id), fromAccountId,
      basis: goalFundingBasis(booksHousehold, goal.id, fromAccountId), date: today });
  }
  const pendingCurrent = pending && pending.basis === goalFundingBasis(booksHousehold, pending.goalId, pending.fromAccountId);
  useEffect(() => { if (pending && !pendingCurrent) setPending(null); }, [pending, pendingCurrent]);
  function fundingControls(goal: Goal) {
    return <>
      <label>From · {goal.shared ? "Shared cash" : "My Personal cash"}
        <select aria-label={`Source for ${goal.name}`} value={sources[goal.id] ?? ""} disabled={busy}
          onChange={event => setSources(current => ({ ...current, [goal.id]: event.target.value }))}>
          <option value="">Choose an account</option>
          {fundingSources(goal).map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
        </select>
      </label>
      {!fundingSources(goal).length && <p className="muted">Open {goal.shared ? "a Shared" : "your own Personal"} cash account first.</p>}
      <button type="button" className="chip" disabled={busy || !environment || !sources[goal.id] || !fillDraftCents(amountFor(goal.id))}
        onClick={() => requestContribute(goal)}>Review contribution</button>
    </>;
  }

  return (
    <section className={`card kitty-banks ${manage ? "is-plan" : "is-home"}`} data-kitty-banks={view} data-kitty-surface={surface}>
      <header><h2>Kitty Banks</h2></header>
      {phone && manage ? <p className="fill-scope">{shared ? "Shared banks" : "Personal · only you"}</p> : <>      {shared ? (
        <p className="muted">
          Shared banks keep their recorded contributions. Fund surplus earmarks are shown separately; that cash remains in the shared pool.
        </p>
      ) : (
        <p className="muted">
          Personal goals on this folio. Fund surplus does not land here.
        </p>
      )}
      {shared && rollover.allocatedCents > 0 ? (
        <p className="muted">
          Fund surplus rolled here: {formatCad(rollover.allocatedCents)}
          {rollover.releasedCents > 0
            ? `, of which ${formatCad(rollover.releasedCents)} has since been released back to the pool and is not held against one bank.`
            : "."}
        </p>
      ) : null}
      {manage && shared ? <p className="muted">{vaultReceiptBlurb(household, today)}</p> : null}
</>}
      {live.length === 0 ? (
        <p className="muted">{shared ? "No shared banks yet." : "No personal banks yet."}</p>
      ) : (
        <div className="kitty-banks-shelf">
          {live.map((goal) => {
            const fill = Math.round(kittyBankFill(goal) * 100);
            const contributors = describeGoalContributors(household, goal.id);
            return (
              <div className="kitty-bank" data-goal-id={goal.id} tabIndex={-1} key={goal.id} data-kitty-step={kittyBankStep(goal)}>
                {!(phone && manage) && <PaperBank goal={goal} role={role} />}
                <div className="kitty-bank-copy">
                  <strong>{goal.name}</strong>
                  {!(phone && manage) && <><div className="muted">
                    {formatCad(goal.savedCents)} / {formatCad(goal.targetCents)}
                    {contributors ? ` · ${contributors}` : ""}
                  </div>
                  <span className="kitty-bank-pct">{fill}% · {shared ? "sub-account" : "goal"}</span></>}
                  {shared && rollover.byGoalId[goal.id] ? (
                    <span className="kitty-bank-rolled">
                      Fund has rolled {formatCad(rollover.byGoalId[goal.id]!)} into this bank. The cash stays in the shared pool.
                    </span>
                  ) : null}
                </div>
                {manage && (phone ? <GoalFill key={goalDraftBasis} goal={goal} amount={amountFor(goal.id)} busy={busy}
                  onChange={amount => setAmounts(current => ({ ...current, [goal.id]: amount }))}>
                  {fundingControls(goal)}
                </GoalFill> : <div className="goal-add">
                  <input inputMode="decimal" aria-label={`Contribution for ${goal.name}`} value={amountFor(goal.id)}
                    onChange={event => setAmounts(current => ({ ...current, [goal.id]: event.target.value }))} />
                  {fundingControls(goal)}
                </div>)}
                {manage && goalIsFull(goal) && <button type="button" className="primary" disabled={busy} onClick={() => setBuying(goal.id)}>Mark purchased</button>}
                {manage && goalIsFull(goal) && buying === goal.id && (
                  <PurchaseGoalSheet
                    household={booksHousehold}
                    goalId={goal.id}
                    createdBy={createdBy}
                    scopeKey={`${environment}:${household.householdId}:${createdBy}:${view}`}
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
      {phone && manage && <details className="fill-background"><summary>About these banks</summary>
      {shared ? (
        <p className="muted">
          Shared banks keep their recorded contributions. Fund surplus earmarks are shown separately; that cash remains in the shared pool.
        </p>
      ) : (
        <p className="muted">
          Personal goals on this folio. Fund surplus does not land here.
        </p>
      )}
      {shared && rollover.allocatedCents > 0 ? (
        <p className="muted">
          Fund surplus rolled here: {formatCad(rollover.allocatedCents)}
          {rollover.releasedCents > 0
            ? `, of which ${formatCad(rollover.releasedCents)} has since been released back to the pool and is not held against one bank.`
            : "."}
        </p>
      ) : null}
      {manage && shared ? <p className="muted">{vaultReceiptBlurb(household, today)}</p> : null}
      </details>}
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
      {pending && pendingCurrent ? (
        <ConfirmSheet
          title="Confirm this bank"
          body={`Record ${formatCad(fillDraftCents(pending.amount)!)} for ${pending.name} on ${pending.date}, from ${
            booksHousehold.accounts.find(account => account.id === pending.fromAccountId)?.name
          } to ${goalsVaultAccount(booksHousehold)?.name ?? "new Goals savings"}. Scope: ${shared ? "Shared" : "Personal · only you"}.`}
          extra="Confirm records the transfer and contribution. Hearth does not move money at your bank."
          confirmLabel="Confirm"
          busy={busy}
          onCancel={() => setPending(null)}
          onConfirm={() => {
            if (busy) return;
            const next = pending;
            const token = scope.capture();
            setPending(null);
            onCommand((current) => {
              if (!scope.isCurrent(token) || next.basis !== goalFundingBasis(latestBooks.current, next.goalId, next.fromAccountId)
                || next.basis !== goalFundingBasis(current, next.goalId, next.fromAccountId)) throw new Error("The bank or books changed. Review the contribution again.");
              return fundGoal(current, {
              date: next.date,
              goalId: next.goalId,
              amount: next.amount,
              fromAccountId: next.fromAccountId,
              createdBy,
            }); });
          }}
        />
      ) : null}
    </section>
  );
}
