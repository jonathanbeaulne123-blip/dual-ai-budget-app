import { useEffect, useMemo, useRef, useState } from "react";
import type { DateKey } from "../core/calendar.ts";
import { monthKeyFromDateKey } from "../core/calendar.ts";
import { newPathEraPlanId, proposePathEra, proposePathEraPlan, type PathEraView } from "../core/pathEras.ts";
import {
  PATH_ERA_HOMES,
  PATH_ERA_HOME_LABELS,
  PATH_ERA_MAX_SURVIVE_MONTHS,
  PATH_ERA_PLAN_KINDS,
  agreePathProposal,
  declinePathProposal,
  type PathEraHome,
  type PathEraPlan,
  type PathEraPlanKind,
} from "../core/pathWorld.ts";
import type { CommitResult, Household } from "../core/types.ts";
import { ERA_FINISH_LABELS, eraDraftOf, eraProposalTitle, eraMonthLabel, newEraDraft, type EraDraft, type EraFinishKind } from "./eras.ts";

/**
 * Plan our journey (D-268): as much or as little as you want. A plain form —
 * also the way in when the island can't be drawn. Edits stay on this screen
 * until one explicit Save, which sends one suggestion; it becomes part of the
 * journey once both of you agree. Words, months and Kitty Bank references
 * only — never an amount.
 */

export type EraRun = (fn: (current: Household) => CommitResult, done: string) => Promise<boolean>;

export const ERA_STATE_LABELS: Record<PathEraView["state"], string> = {
  past: "Past", current: "Now", future: "Ahead", sketched: "Suggested",
};
export const ERA_PLAN_KIND_LABELS: Record<PathEraPlanKind, string> = {
  bank: "A Kitty Bank", chapter: "A Chapter", trip: "A trip", milestone: "A milestone", note: "A note",
};
const SAVED = "Suggested. It becomes part of the journey once you both agree.";

function errorText(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "That can't be suggested yet.";
}
function eraRange(era: PathEraView): string {
  if (era.state === "past") return `${eraMonthLabel(era.months[0])} – ${eraMonthLabel(era.months.at(-1))}`;
  if (era.state === "current") return `Since ${eraMonthLabel(era.months[0] ?? era.spec.from)}${era.spec.by ? ` · by ${eraMonthLabel(era.spec.by)}` : ""}`;
  return `Starts ${eraMonthLabel(era.spec.from)}${era.spec.by ? ` · by ${eraMonthLabel(era.spec.by)}` : ""}`;
}

export function EraPlanner({ household, memberId, today, busy, eras, startEraId, run, onClose, onShow, nameOf }: {
  household: Household;
  memberId: string;
  today: DateKey;
  busy: boolean;
  eras: PathEraView[];
  /** Open straight into one era ("Plan this era"); null opens the journey list. */
  startEraId: string | null;
  run: EraRun;
  onClose: () => void;
  /** Travel to an era on the island. */
  onShow?: (eraId: string) => void;
  nameOf: (memberId: string | null | undefined) => string;
}) {
  // "list", "new", or an era id.
  const [view, setView] = useState<string>(startEraId ?? "list");
  useEffect(() => { setView(startEraId ?? "list"); }, [startEraId]);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [view]);
  const editing = view === "list" ? null : view === "new" ? "new" : eras.find((era) => era.id === view) ?? null;
  // The era vanished (set aside elsewhere): back to the list.
  useEffect(() => { if (view !== "list" && view !== "new" && !eras.some((era) => era.id === view)) setView("list"); }, [view, eras]);
  const nowMonth = monthKeyFromDateKey(today);

  return (
    <section className="path-planner" aria-labelledby="path-planner-title">
      <header className="path-planner__head">
        <p className="kicker">The Journey of Life</p>
        <h3 id="path-planner-title" ref={heading} tabIndex={-1}>
          {editing === null ? "Plan our journey" : editing === "new" ? "Add an era" : `Plan “${editing.spec.name}”`}
        </h3>
        <p className="muted">One journey, cut into eras. Plan as much or as little as you want — nothing changes until you both agree.</p>
        <button type="button" className="path-planner__close" onClick={onClose}>Close the planner</button>
      </header>
      {editing === null ? (
        <>
          {eras.length ? (
            <ol className="path-planner__journey">
              {eras.map((era) => (
                <li key={era.id} className={`path-planner__era path-planner__era--${era.state}`}>
                  <span className={`path-era-chip path-era-chip--${era.state}`}>{ERA_STATE_LABELS[era.state]}</span>
                  <div className="path-planner__era-text">
                    <strong>{era.spec.name}</strong>
                    <span className="muted">{eraRange(era)} · {PATH_ERA_HOME_LABELS[era.spec.home]}</span>
                    {era.state === "sketched" && <span className="path-pencil">Suggested by {nameOf(era.pendingBy)}</span>}
                    {era.state !== "sketched" && era.pending && <span className="path-pencil">A change is waiting · {nameOf(era.pendingBy)}</span>}
                    {era.plans.length > 0 && <span className="muted">{era.plans.length === 1 ? "One plan" : `${era.plans.length} plans`}</span>}
                  </div>
                  <div className="path-planner__era-actions">
                    {onShow && era.state !== "current" && <button type="button" onClick={() => onShow(era.id)}>Show</button>}
                    <button type="button" className="primary" onClick={() => setView(era.id)} aria-label={`Plan ${era.spec.name}`}>Plan</button>
                  </div>
                </li>
              ))}
            </ol>
          ) : <p>No eras yet. Start with the one you are in — “Moving in”, “Our first year”, whatever it is for you.</p>}
          <div className="path-world__actions">
            <button type="button" className="primary" onClick={() => setView("new")}>Add an era</button>
          </div>
        </>
      ) : (
        <EraEditor
          // A new agreed version (or a suggestion set aside) is a new starting point for the draft.
          key={editing === "new" ? "new" : `${editing.id}:${editing.row.pendingRevision}:${editing.row.agreedByMemberIds.join(",")}:${editing.pending ? "waiting" : "agreed"}`}
          household={household}
          memberId={memberId}
          busy={busy}
          era={editing === "new" ? null : editing}
          initial={editing === "new" ? newEraDraft(eras, nowMonth) : eraDraftOf(editing)}
          run={run}
          nameOf={nameOf}
          onDone={() => setView("list")}
        />
      )}
    </section>
  );
}

function samePlans(a: PathEraPlan[], b: PathEraPlan[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function EraEditor({ household, memberId, busy, era, initial, run, nameOf, onDone }: {
  household: Household;
  memberId: string;
  busy: boolean;
  era: PathEraView | null;
  initial: EraDraft;
  run: EraRun;
  nameOf: (memberId: string | null | undefined) => string;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState<EraDraft>(initial);
  const [error, setError] = useState("");
  const [planDraft, setPlanDraft] = useState<{ kind: PathEraPlanKind; label: string; month: string; goalId: string }>({ kind: "milestone", label: "", month: "", goalId: "" });
  const id = `path-era-${era?.id ?? "new"}`;
  const banks = useMemo(() => household.goals.filter((goal) => goal.shared && goal.status !== "retired" && !goal.retiredAt), [household.goals]);
  const bankName = (goalId: string | null) => household.goals.find((goal) => goal.id === goalId)?.name ?? "A Kitty Bank";
  const past = era?.state === "past";
  const current = era?.state === "current";
  const sketched = era?.state === "sketched";
  // A suggestion is waiting on an agreed era: it must be agreed or set aside before anything else is suggested.
  const blocked = Boolean(era && era.pending && !sketched);
  const pendingMine = Boolean(era?.row.agreedByMemberIds.includes(memberId));
  const changed = JSON.stringify(draft) !== JSON.stringify(initial);
  const set = (patch: Partial<EraDraft>) => { setError(""); setDraft((value) => ({ ...value, ...patch })); };
  const finishKind = draft.finish.kind;
  const setFinish = (kind: EraFinishKind) => set({ finish: kind === "agree" ? { kind } : kind === "survive" ? { kind, months: draft.finish.kind === "survive" ? draft.finish.months : 12 } : { kind, goalIds: draft.finish.kind === "banks" ? draft.finish.goalIds : [] } });
  // The pencil plans a sketched era carries are in the draft already; an agreed era's waiting plans are shown read-only.
  const waitingPlans = era && !sketched ? era.plans.filter((plan) => plan.sketched) : [];

  const addPlan = () => {
    const label = planDraft.label.trim();
    if (!label) { setError("A plan needs a few words."); return; }
    if (planDraft.kind === "bank" && !planDraft.goalId) { setError("Choose which shared Kitty Bank."); return; }
    const plan: PathEraPlan = { id: newPathEraPlanId(draft), kind: planDraft.kind, label, goalId: planDraft.kind === "bank" ? planDraft.goalId : null, month: planDraft.month || null };
    set({ plans: [...draft.plans, plan] });
    setPlanDraft({ kind: planDraft.kind, label: "", month: "", goalId: "" });
  };

  /** One suggestion for everything changed on this screen. A single plan change on an agreed era reads as that plan. */
  const command = (): ((h: Household) => CommitResult) => {
    const { retired, ...rest } = draft;
    const spec = { ...rest, finishLine: rest.finishLine.trim(), name: rest.name.trim(), retired };
    if (era && !sketched) {
      const { plans: _ignored, ...before } = initial;
      const { plans: _alsoIgnored, ...after } = draft;
      void _ignored; void _alsoIgnored;
      if (JSON.stringify(before) === JSON.stringify(after) && !samePlans(initial.plans, draft.plans)) {
        const added = draft.plans.filter((plan) => !initial.plans.some((p) => JSON.stringify(p) === JSON.stringify(plan)));
        const removed = initial.plans.filter((plan) => !draft.plans.some((p) => p.id === plan.id));
        if (added.length === 1 && removed.length === 0) return (h) => proposePathEraPlan(h, { memberId, rowId: era.id, plan: added[0]! });
        if (added.length === 0 && removed.length === 1) return (h) => proposePathEraPlan(h, { memberId, rowId: era.id, plan: { id: removed[0]!.id, remove: true } });
      }
    }
    return (h) => proposePathEra(h, { memberId, rowId: era?.id ?? null, spec });
  };
  const save = async () => {
    if (!draft.name.trim()) { setError("An era needs a name."); return; }
    if (draft.finish.kind === "banks" && !draft.finish.goalIds.length) { setError("Choose at least one shared Kitty Bank for the finish line."); return; }
    const fn = command();
    // Check first, on the books as they are, so a rule the journey keeps reads as words on this screen.
    try { fn(household); } catch (e) { setError(errorText(e)); return; }
    if (await run(fn, SAVED)) onDone();
  };
  const respond = async (agree: boolean) => {
    if (!era) return;
    const revision = era.row.pendingRevision;
    const fn = (h: Household) => (agree ? agreePathProposal : declinePathProposal)(h, { memberId, rowId: era.id, revision });
    try { fn(household); } catch (e) { setError(errorText(e)); return; }
    await run(fn, agree ? "Agreed." : "Set aside.");
  };

  return (
    <form className="path-planner__editor" onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
      {era && era.pending && (
        <div className="path-planner__waiting" role="note">
          <p>
            {sketched
              ? `${nameOf(era.pendingBy)} suggested this era. It joins the journey once you both agree.`
              : `${eraProposalTitle(era.row, nameOf)}. Agree to it or set it aside before planning more here.`}
          </p>
          <p className="muted">Agreed so far: {era.row.agreedByMemberIds.map(nameOf).join(", ") || "nobody yet"}.</p>
          <div className="path-world__actions">
            {!pendingMine && <button type="button" className="primary" disabled={busy} onClick={() => void respond(true)}>Agree</button>}
            <button type="button" disabled={busy} onClick={() => void respond(false)}>{pendingMine ? "Withdraw" : "Set aside"}</button>
          </div>
        </div>
      )}
      <fieldset className="path-planner__fields" disabled={blocked}>
        <legend className="sr-only">The era</legend>
        <label htmlFor={`${id}-name`}>Name <span className="muted">(required)</span></label>
        <input id={`${id}-name`} value={draft.name} maxLength={40} required placeholder="For example: Moving in" onChange={(e) => set({ name: e.target.value })} />
        <label htmlFor={`${id}-line`}>The finish line, in your words</label>
        <input id={`${id}-line`} value={draft.finishLine} maxLength={120} placeholder="For example: survive our first year without going broke" onChange={(e) => set({ finishLine: e.target.value })} />
        <div className="path-planner__row">
          <span className="path-planner__cell">
            <label htmlFor={`${id}-from`}>Starts</label>
            <input id={`${id}-from`} type="month" value={draft.from} disabled={past || current} onChange={(e) => { if (e.target.value) set({ from: e.target.value }); }} />
          </span>
          <span className="path-planner__cell">
            <label htmlFor={`${id}-by`}>Hope to finish by <span className="muted">(optional)</span></label>
            <input id={`${id}-by`} type="month" value={draft.by ?? ""} disabled={past} onChange={(e) => set({ by: e.target.value || null })} />
          </span>
        </div>
        {(past || current) && <p className="muted path-planner__hint">{past ? "A crossed era keeps its months, home and finish line. Its words and plans can still change." : "The era you are in keeps its start."}</p>}
        <label htmlFor={`${id}-home`}>Our home in this era</label>
        <select id={`${id}-home`} value={draft.home} disabled={past} onChange={(e) => set({ home: e.target.value as PathEraHome })}>
          {PATH_ERA_HOMES.map((home) => <option key={home} value={home}>{PATH_ERA_HOME_LABELS[home]}</option>)}
        </select>
        <label htmlFor={`${id}-finish`}>When is this era finished?</label>
        <select id={`${id}-finish`} value={finishKind} disabled={past} onChange={(e) => setFinish(e.target.value as EraFinishKind)}>
          <option value="agree">{ERA_FINISH_LABELS.agree}</option>
          <option value="survive">Get through a number of months without going broke</option>
          <option value="banks">{ERA_FINISH_LABELS.banks}</option>
        </select>
        {draft.finish.kind === "survive" && (
          <span className="path-planner__cell">
            <label htmlFor={`${id}-months`}>How many months?</label>
            <input id={`${id}-months`} type="number" inputMode="numeric" min={1} max={PATH_ERA_MAX_SURVIVE_MONTHS} value={draft.finish.months} disabled={past}
              onChange={(e) => set({ finish: { kind: "survive", months: Math.max(1, Math.min(PATH_ERA_MAX_SURVIVE_MONTHS, Math.round(Number(e.target.value) || 1))) } })} />
          </span>
        )}
        {draft.finish.kind === "banks" && (
          <fieldset className="path-planner__banks" disabled={past}>
            <legend>Shared Kitty Banks on the finish line</legend>
            {banks.length ? banks.map((goal) => {
              const chosen = draft.finish.kind === "banks" && draft.finish.goalIds.includes(goal.id);
              return (
                <label key={goal.id} htmlFor={`${id}-bank-${goal.id}`} className="path-planner__check">
                  <input id={`${id}-bank-${goal.id}`} type="checkbox" checked={chosen} onChange={(e) => {
                    const ids = draft.finish.kind === "banks" ? draft.finish.goalIds : [];
                    set({ finish: { kind: "banks", goalIds: e.target.checked ? [...ids, goal.id] : ids.filter((gid) => gid !== goal.id) } });
                  }} />
                  {goal.name}
                </label>
              );
            }) : <p className="muted">No shared Kitty Banks yet.</p>}
          </fieldset>
        )}

        <fieldset className="path-planner__plans">
          <legend>Plans in this era</legend>
          {draft.plans.length || waitingPlans.length ? (
            <ul>
              {draft.plans.map((plan) => (
                <li key={plan.id} className={sketched ? "path-pencil" : undefined}>
                  <span><strong>{plan.label}</strong> <span className="muted">· {ERA_PLAN_KIND_LABELS[plan.kind]}{plan.goalId ? ` · ${bankName(plan.goalId)}` : ""}{plan.month ? ` · ${eraMonthLabel(plan.month)}` : ""}{sketched ? ` · suggested by ${nameOf(era?.pendingBy)}` : ""}</span></span>
                  <button type="button" aria-label={`Remove ${plan.label}`} onClick={() => set({ plans: draft.plans.filter((p) => p.id !== plan.id) })}>Remove</button>
                </li>
              ))}
              {waitingPlans.map((plan) => (
                <li key={`waiting-${plan.id}`} className="path-pencil">
                  <span><strong>{plan.label}</strong> <span className="muted">· {ERA_PLAN_KIND_LABELS[plan.kind]} · suggested by {nameOf(era?.pendingBy)}</span></span>
                </li>
              ))}
            </ul>
          ) : <p className="muted">Nothing planned here yet. That's fine.</p>}
          <div className="path-planner__add">
            <span className="path-planner__cell">
              <label htmlFor={`${id}-plan-kind`}>Kind</label>
              <select id={`${id}-plan-kind`} value={planDraft.kind} onChange={(e) => setPlanDraft({ ...planDraft, kind: e.target.value as PathEraPlanKind })}>
                {PATH_ERA_PLAN_KINDS.map((kind) => <option key={kind} value={kind} disabled={kind === "bank" && !banks.length}>{ERA_PLAN_KIND_LABELS[kind]}</option>)}
              </select>
            </span>
            <span className="path-planner__cell path-planner__cell--wide">
              <label htmlFor={`${id}-plan-label`}>In a few words</label>
              <input id={`${id}-plan-label`} value={planDraft.label} maxLength={60} placeholder="For example: a road trip east" onChange={(e) => setPlanDraft({ ...planDraft, label: e.target.value })} />
            </span>
            {planDraft.kind === "bank" && (
              <span className="path-planner__cell">
                <label htmlFor={`${id}-plan-bank`}>Which shared Kitty Bank?</label>
                <select id={`${id}-plan-bank`} value={planDraft.goalId} onChange={(e) => setPlanDraft({ ...planDraft, goalId: e.target.value })}>
                  <option value="">Choose…</option>
                  {banks.map((goal) => <option key={goal.id} value={goal.id}>{goal.name}</option>)}
                </select>
              </span>
            )}
            <span className="path-planner__cell">
              <label htmlFor={`${id}-plan-month`}>Month <span className="muted">(optional)</span></label>
              <input id={`${id}-plan-month`} type="month" value={planDraft.month} onChange={(e) => setPlanDraft({ ...planDraft, month: e.target.value })} />
            </span>
            <button type="button" onClick={addPlan}>Add this plan</button>
          </div>
        </fieldset>

        {era && (era.state === "future" || era.state === "sketched") && (
          <label htmlFor={`${id}-retire`} className="path-planner__check">
            <input id={`${id}-retire`} type="checkbox" checked={draft.retired} onChange={(e) => set({ retired: e.target.checked })} />
            Take this era off the journey
          </label>
        )}
      </fieldset>
      {error && <p className="path-planner__error" role="alert">{error}</p>}
      <div className="path-world__actions">
        <button type="submit" className="primary" disabled={busy || blocked || !changed}>{era ? "Suggest these changes" : "Suggest this era"}</button>
        <button type="button" onClick={onDone}>Back to the journey</button>
      </div>
      {!blocked && changed && <p className="muted path-planner__hint">Nothing is sent until you save. One save sends one suggestion.</p>}
    </form>
  );
}
