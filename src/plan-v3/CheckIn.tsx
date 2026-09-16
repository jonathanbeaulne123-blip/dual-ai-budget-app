import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { DateKey } from "../core/calendar.ts";
import { ChapterClose, RitualForm, SitdownBriefCard } from "../ChapterPanel.tsx";
import { acknowledgeHouseholdPlan, appendPlanSitdownTurn, type CommitResult, type Household, type LedgerView, type PlanLine } from "../core/index.ts";
import { sitdownBrief } from "../core/sitdownBrief.ts";
import { HerculesPortrait } from "../Hercules.tsx";
import type { PlanStudioSection } from "../PlanStudio.tsx";
import { PathMiniMap } from "../path/PathMiniMap.tsx";
import { usePathTent } from "../path/tentContext.ts";
import { Paw } from "./figures.tsx";
import { dayWords, moneyWords, pendingContributions, type FundRow, type PlanStudioV3Model } from "./model.ts";
import { FUND_WORDS } from "./RestScreen.tsx";
import { STEPS, stageForStep, type StepDef } from "./steps.ts";
import type { LookCloser } from "./tools.ts";

type Run = (fn: (current: Household) => CommitResult) => Promise<{ household?: Household } | null>;

function Row({ label, sub, amount, tone, children }: { label: ReactNode; sub?: ReactNode; amount?: ReactNode; tone?: "ok" | "soft" | "bad"; children?: ReactNode }) {
  return (
    <div className="pv3-row">
      <div className="pv3-row__grow">{label}{sub ? <small>{sub}</small> : null}{children}</div>
      {amount !== undefined && <span className={`pv3-amt${tone ? ` pv3-tone--${tone}` : ""}`}>{amount}</span>}
    </div>
  );
}

function LineRows({ lines, title }: { lines: readonly PlanLine[]; title?: string }) {
  if (!lines.length) return null;
  return <>{title && <p className="pv3-grp">{title}</p>}{lines.map(line => <Row key={line.id} label={line.labelSnapshot} sub={[line.dueDate ? dayWords(line.dueDate) : null, line.cadence !== "monthly" ? line.cadence : null].filter(Boolean).join(" · ") || "in the plan"} amount={moneyWords(line.amountCents)} />)}</>;
}

function FundRows({ rows, empty }: { rows: readonly FundRow[]; empty: string }) {
  if (!rows.length) return <p className="pv3-muted">{empty}</p>;
  return <>{rows.map(row => <Row key={row.id} label={row.label} sub={row.detail ?? undefined} amount={row.amountCents === null ? undefined : moneyWords(row.amountCents)} />)}</>;
}

/**
 * The one check-in (F2): the Sitdown and the guided draft as one path of
 * short questions. "Looks right" only moves on (F4). Pausing saves the place
 * in the Shared Sitdown session, so either partner can pick it up. Agreeing is
 * always a per-person act, and the Sitdown closes the Chapter.
 */
export function CheckIn({ household, memberId, view, today, model, busy, run, initialStep, onLook, onExit }: {
  household: Household; memberId: string; view: LedgerView; today: DateKey;
  model: PlanStudioV3Model;
  busy: boolean;
  run: Run;
  initialStep: number;
  onLook: (look: LookCloser, from: HTMLElement) => void;
  onExit: (message?: string) => void;
}) {
  const steps = useMemo(() => STEPS.filter(step => (view === "household" || !step.householdOnly) && (step.id !== "back" || !model.firstVisit)), [view, model.firstVisit]);
  const [index, setIndex] = useState(() => {
    const wanted = STEPS[Math.max(0, Math.min(STEPS.length - 1, initialStep))]!.id;
    const at = steps.findIndex(step => step.id === wanted);
    return at >= 0 ? at : 0;
  });
  // A resumed check-in shows the steps already walked; jumping ahead marks nothing as answered.
  const [answered, setAnswered] = useState<Set<string>>(() => new Set(model.session.state === "active" && initialStep === model.session.stage ? steps.slice(0, index).map(step => step.id) : []));
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [remember, setRemember] = useState("");
  const [announce, setAnnounce] = useState("");
  const heading = useRef<HTMLHeadingElement | null>(null);
  const tent = usePathTent();
  const step = steps[index]!;
  const household_ = view === "household";
  const partner = model.agreement.paws.find(paw => paw.memberId !== memberId);
  const { snapshot } = model;

  useEffect(() => {
    heading.current?.focus();
    setAnnounce(`Step ${index + 1} of ${steps.length}, ${step.title}`);
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (next: number) => { setIndex(Math.max(0, Math.min(steps.length - 1, next))); };
  const advance = () => { setAnswered(current => new Set(current).add(step.id)); if (index < steps.length - 1) go(index + 1); else onExit(); };
  const checkpoint = async (text: string, extra: { decision?: string; close?: boolean; planVersionId?: string } = {}, stage = stageForStep(STEPS.findIndex(row => row.id === step.id))) => {
    const open = model.session.state === "active" ? model.session : null;
    const openRow = open ? household.planHerculesSessions?.find(row => row.id === open.sessionId) : undefined;
    const draftId = (household.planDrafts ?? []).find(row => row.ownerMemberId === memberId && row.scope === "household" && row.targetMonth === model.monthKey)?.id ?? `PLAN-${model.monthKey}`;
    return run(current => appendPlanSitdownTurn(current, {
      ...(openRow ? { sessionId: openRow.id, expectedUpdatedAt: openRow.updatedAt } : {}),
      sitDownSessionId: openRow?.sitDownSessionId ?? `SITDOWN-${crypto.randomUUID()}`,
      monthKey: model.monthKey, planDraftId: draftId, memberId, text, checkpoint: { stage, ...extra },
    }));
  };
  const pause = async () => {
    if (!household_) { onExit("Paused. On your own plan, the check-in starts again from Hello next time."); return; }
    const saved = await checkpoint(`Paused at ${step.title}.`);
    if (saved) onExit(`I'll keep your place: ${step.title}, step ${index + 1} of ${steps.length}.`);
  };
  const look = (label: string, tool: LookCloser["tool"], section: PlanStudioSection) => ({ label, tool, section });
  const chips = (list: LookCloser[]) => (
    <div className="pv3-chips" role="group" aria-label="Look closer">
      {list.map(item => <button key={item.label} type="button" className="pv3-chipbtn" aria-haspopup="dialog" onClick={event => onLook(item, event.currentTarget)}>{item.label}</button>)}
    </div>
  );
  const nav = (primary: string, onPrimary: () => void = advance, disabled = false) => (
    <div className="pv3-stepnav">
      {index > 0 && <button type="button" className="pv3-btn pv3-btn--quiet" onClick={() => go(index - 1)}>Back</button>}
      <button type="button" className="pv3-btn" disabled={disabled || busy} onClick={onPrimary}>{primary}</button>
    </div>
  );
  const collapsed = (lens: StepDef["lens"]) => Boolean(lens && model.lenses[lens].sameAsLast && !expanded.has(step.id));
  const routine = (lens: NonNullable<StepDef["lens"]>, body: ReactNode) => collapsed(lens) ? (
    <div className="pv3-card pv3-same">
      <p><b>Same as {model.previousMonthLabel}.</b> {model.lenses[lens].lines.length} {model.lenses[lens].lines.length === 1 ? "line" : "lines"}, unchanged.</p>
      <div className="pv3-stepnav">
        <button type="button" className="pv3-btn pv3-btn--quiet" onClick={() => setExpanded(current => new Set(current).add(step.id))}>Show them</button>
        <button type="button" className="pv3-btn" onClick={advance}>Still right</button>
      </div>
    </div>
  ) : body;

  const agreementBlock = () => {
    const version = model.agreement.version;
    const mine = model.agreement.paws.find(paw => paw.memberId === memberId);
    return (
      <>
        <div className="pv3-seal" role="img" aria-label={`Agreement: ${model.agreement.paws.map(paw => `${paw.name} ${paw.agreed ? "agreed" : "not yet"}`).join(", ")}`}>
          {model.agreement.paws.map((paw, i) => <span key={paw.memberId} className="pv3-seal__paw"><Paw on={paw.agreed} tone={i ? "b" : "a"} /><small>{paw.name.split(" ")[0]}</small></span>)}
        </div>
        <p className="pv3-center pv3-muted">{
          model.agreement.kind === "agreed" ? "Agreed by both of you."
            : model.agreement.kind === "kept" ? "Kept as your plan."
            : model.agreement.kind === "waiting-partner" ? `You agreed. Waiting for ${partner?.name ?? "your partner"}; agreeing is their own step.`
            : model.agreement.kind === "waiting-me" ? `${partner && model.agreement.paws.find(p => p.memberId === partner.memberId)?.agreed ? `${partner.name} agreed. ` : ""}Your turn to read it and agree.`
            : "Not sent yet."
        }</p>
        {household_ && version?.state === "proposed" && !mine?.agreed && (
          <button type="button" className="pv3-btn" disabled={busy} onClick={() => void run(current => acknowledgeHouseholdPlan(current, { planVersionId: version.id, expectedDigest: version.digest, memberId, createdBy: memberId }))}>I agree to this plan<small>Only for me; {partner?.name ?? "your partner"} agrees separately</small></button>
        )}
        {(model.agreement.kind === "draft" || model.agreement.kind === "none") && (
          <button type="button" className="pv3-btn" aria-haspopup="dialog" onClick={event => onLook(look(household_ ? `Send to ${partner?.name ?? "your partner"} to agree` : "Keep this as my plan", "chairs", "review"), event.currentTarget)}>
            {household_ ? `Send to ${partner?.name ?? "your partner"} to agree` : "Keep this as my plan"}<small>Opens the exact review first</small>
          </button>
        )}
      </>
    );
  };

  let body: ReactNode;
  switch (step.id) {
    case "hello":
      body = <>
        {household_ ? <>
          <button type="button" className="pv3-btn" onClick={advance}>We're doing this together</button>
          <button type="button" className="pv3-btn pv3-btn--quiet" onClick={advance}>Just me first, to get my thoughts down</button>
        </> : <button type="button" className="pv3-btn" onClick={advance}>Let's start</button>}
        {household_ && <details className="pv3-details"><summary>What changed since last time</summary><SitdownBriefCard household={household} memberId={memberId} today={today} /></details>}
        {chips([look("Jot something just for me", "chairs", "sitdown")])}
        <button type="button" className="pv3-link" onClick={() => onExit()}>Skip to the plan</button>
      </>;
      break;
    case "back": {
      const brief = sitdownBrief(household, { memberId, today });
      body = <>
        <div className="pv3-card">
          {brief.chapter && <Row label={`Chapter: ${brief.chapter.title}`} sub={`Rituals held ${brief.chapter.ritualsHeld} times · ${brief.chapter.movesDone} Moves done · ${brief.chapter.movesOpen} still open`} />}
          {brief.settled.map(row => <Row key={row.id} label={row.text} amount="✓" tone="ok" />)}
          {brief.changed.map(row => <Row key={row.id} label={row.text} />)}
          {!brief.chapter && !brief.settled.length && !brief.changed.length && <p className="pv3-muted">Nothing material changed. That counts too.</p>}
        </div>
        {household_ && <label className="pv3-field">One thing we'd like to remember <span className="pv3-muted">(optional, shared with both of you)</span><input value={remember} onChange={event => setRemember(event.target.value)} placeholder="e.g. Grocery runs are bigger than we think" /></label>}
        {chips([look("Match receipts to the plan", "past", "reflection"), look("Past versions and why", "past", "history")])}
        {nav("Save and continue", async () => {
          if (household_ && remember.trim()) { const saved = await checkpoint(`We looked back. ${remember.trim()}`, { decision: remember.trim() }, stageForStep(STEPS.findIndex(row => row.id === "in"))); if (!saved) return; setRemember(""); }
          advance();
        })}
      </>;
      break;
    }
    case "in": {
      const incoming = snapshot.flow?.days.flatMap(day => day.contributions.map(row => ({ ...row, date: day.date }))) ?? [];
      const pending = household_ ? pendingContributions(household, memberId) : [];
      body = <>
        <div className="pv3-card">
          {incoming.map(row => <Row key={row.id} label={row.memberName} sub={`${dayWords(row.date)} · ${row.estimated ? "expected, not certain yet" : row.actual ? "arrived" : "planned"}`} amount={`+${moneyWords(row.amountCents)}`} tone={row.estimated ? "soft" : "ok"} />)}
          {pending.map(row => <Row key={row.id} label={`${row.memberName} (waiting to confirm)`} sub={`${dayWords(row.date)} · ${row.waitingOnMe ? "yours to confirm in the Fund" : "the custodian confirms"}; not counted yet`} amount={moneyWords(row.amountCents)} tone="soft" />)}
          {snapshot.undividedContributions.map(row => <Row key={row.id} label={`${row.memberName} · not divided yet`} sub={row.waitingOn.length ? `Waiting for ${row.waitingOn.join(" and ")} to confirm the split` : "You both confirm the split"} amount={moneyWords(row.amountCents)} tone="soft" />)}
          {!incoming.length && !pending.length && <p className="pv3-muted">Nothing dated is coming in yet this month.</p>}
          {incoming.length > 0 && <Row label={<b>Coming in</b>} amount={moneyWords(snapshot.flow!.totalInCents)} />}
        </div>
        {chips([look("Where do these come from?", "tracing", "assumptions"), look("What if a pay is late?", "tracing", "protect"), ...(household_ ? [look(`Offers waiting between us${model.badge?.tool === "letter" ? ` (${model.badge.text.split(" ")[0]})` : ""}`, "letter", "bridge")] : [])])}
        {nav("Looks right")}
        <button type="button" className="pv3-link" aria-haspopup="dialog" onClick={event => onLook(look("Change something", "tracing", "assumptions"), event.currentTarget)}>Change something</button>
      </>;
      break;
    }
    case "prepare": {
      const bills = snapshot.flow?.days.flatMap(day => day.outflows.filter(row => row.fund === "prepare").map(row => ({ ...row, date: day.date }))) ?? [];
      const low = snapshot.flow?.lowPoint;
      body = routine("prepare", <>
        <div className="pv3-card">
          <p className="pv3-grp">Bills this month</p>
          {bills.length ? bills.map(row => <Row key={`${row.id}:${row.date}`} label={row.label} sub={`${dayWords(row.date)}${row.actual ? " · paid" : ""}`} amount={moneyWords(row.amountCents)} />) : <p className="pv3-muted">No dated bills in the Fund's month.</p>}
          <p className="pv3-grp">Now and then</p>
          <FundRows rows={snapshot.prepare.rows} empty="Nothing set aside for costs coming around yet." />
          <LineRows title="In the plan" lines={model.lenses.prepare.lines} />
          {low && <p className="pv3-muted">Tightest day: <b>{dayWords(low.date)}</b> · the Fund about <b className="pv3-amt">{moneyWords(low.balanceCents)}</b>.</p>}
        </div>
        {chips([look("Add or edit a bill", "tracing", "prepare"), look("Try a what-if", "tracing", "scenarios")])}
        {nav("All here")}
      </>);
      break;
    }
    case "protect":
      body = routine("protect", <>
        <div className="pv3-card">
          <Row label={<b>Protect</b>} sub={snapshot.protect.line ?? "Our backup"} amount={snapshot.protect.amountCents === null ? "—" : moneyWords(snapshot.protect.amountCents)} />
          <p className="pv3-grp">Held in Protect</p>
          <FundRows rows={snapshot.protect.rows} empty="Nothing held in Protect yet." />
          <LineRows title="In the plan" lines={model.lenses.protect.lines} />
        </div>
        {chips([look("Open the Kitty bank", "kitty", "goals"), look("What if costs rise?", "tracing", "protect")])}
        {nav("Looks right")}
      </>);
      break;
    case "build":
      body = routine("build", <>
        <div className="pv3-card">
          <p className="pv3-grp">Growing in Build</p>
          <FundRows rows={snapshot.build.rows} empty="No goals growing yet." />
          <LineRows title="In the plan" lines={model.lenses.build.lines} />
        </div>
        {chips([look("Try another path", "tracing", "scenarios"), look("Open the nest", "kitty", "goals")])}
        {nav("Looks right")}
      </>);
      break;
    case "everyday":
      body = routine("everyday", <>
        <div className="pv3-card pv3-now">
          <p className="pv3-kicker">Now</p>
          <p className="pv3-amt pv3-now__big">{snapshot.now.amountCents === null ? "—" : moneyWords(snapshot.now.amountCents)}</p>
          {snapshot.now.line && <p className="pv3-muted">{snapshot.now.line}</p>}
          <LineRows title="In the plan" lines={model.lenses.everyday.lines} />
        </div>
        {chips([look("Can we afford…?", "tracing", "everyday"), look("One useful idea", "recipe", "learn")])}
        {nav("Feels livable")}
      </>);
      break;
    case "together": {
      const lines = model.agreement.version?.lines ?? Object.values(model.lenses).flatMap(lens => lens.lines);
      body = <>
        <div className="pv3-card pv3-card--ruled">
          {snapshot.flow && <Row label="Coming in" amount={moneyWords(snapshot.flow.totalInCents)} />}
          {(["prepare", "protect", "build"] as const).map(key => <Row key={key} label={FUND_WORDS[key].name} sub={snapshot[key].line ?? undefined} amount={snapshot[key].amountCents === null ? "—" : moneyWords(snapshot[key].amountCents!)} />)}
          <Row label={<b>Everyday · Now</b>} amount={snapshot.now.amountCents === null ? "—" : moneyWords(snapshot.now.amountCents)} />
          <details className="pv3-details"><summary>Read every line ({lines.length})</summary>{lines.length ? <LineRows lines={lines} /> : <p className="pv3-muted">No lines yet.</p>}</details>
        </div>
        {household_ && model.chapter && <details className="pv3-details"><summary>One small habit for the Chapter (optional)</summary><RitualForm household={household} memberId={memberId} onCommand={run} busy={busy} /></details>}
        {agreementBlock()}
        {chips([look("Read every line exactly", "chairs", "review"), look("Suggest a change", "chairs", "review")])}
        {household_ ? nav("Next: the Sitdown") : nav("Done", () => onExit())}
      </>;
      break;
    }
    case "sitdown": {
      const version = model.agreement.version;
      const closable = model.agreement.kind === "agreed" && Boolean(version && ["active", "scheduled"].includes(version.state));
      body = model.monthSet ? <>
        <div className="pv3-card pv3-set">
          <span className="pv3-set__map" aria-hidden="true"><PathMiniMap household={household} today={today} size={140} /></span>
          <p><b>{model.monthLabel} is set on our island.</b> The Sitdown kept what you chose; the land for this Chapter has set.</p>
        </div>
        <ChapterClose household={household} memberId={memberId} today={today} sitdownId={model.session.sessionId} onCommand={run} busy={busy} />
        {tent && <button type="button" className="pv3-btn" onClick={tent.leaveTent}>See it on our island</button>}
        <button type="button" className="pv3-btn pv3-btn--quiet" onClick={() => onExit()}>Back to the plan</button>
      </> : <>
        <ChapterClose household={household} memberId={memberId} today={today} sitdownId={model.session.sessionId} onCommand={run} busy={busy} />
        {closable
          ? <button type="button" className="pv3-btn" disabled={busy} onClick={async () => { const saved = await checkpoint(`We are carrying the ${model.monthLabel} plan forward.`, { close: true, planVersionId: version!.id }); if (saved) setAnnounce(`${model.monthLabel} is set on our island.`); }}>Close the Sitdown with our agreed plan<small>The island sets this month's land</small></button>
          : <p className="pv3-note">The Sitdown closes once you've both agreed to the plan.</p>}
        {nav("Back to the plan", () => onExit())}
      </>;
      break;
    }
  }

  return (
    <section className="pv3-checkin" aria-labelledby="pv3-step-h" data-step={step.id}>
      <p className="pv3-sr" aria-live="polite">{announce}</p>
      <div className="pv3-checkin__top">
        <p className="pv3-kicker">{model.monthLabel} check-in · {index + 1} of {steps.length}</p>
        <button type="button" className="pv3-link" disabled={busy} onClick={() => void pause()}>Pause</button>
      </div>
      <ol className="pv3-trail" aria-label="Progress">
        {steps.map((row, i) => (
          <li key={row.id} aria-current={i === index ? "step" : undefined} className={answered.has(row.id) ? "is-done" : ""}>
            <span className="pv3-sr">{row.title}{answered.has(row.id) ? ", done" : ""}</span>
            <Paw on={answered.has(row.id) || i === index} tone={i % 2 ? "b" : "a"} />
          </li>
        ))}
      </ol>
      <article className="pv3-step">
        <div className="pv3-host">
          <HerculesPortrait pose={step.id === "together" || step.id === "sitdown" ? "loaf" : "sit"} size={56} mood="content" hat={null} chain={null} house={null} collar={null} />
          <div className="pv3-bubble">
            {step.tag && <p className="pv3-kicker">{step.title} · {step.tag}</p>}
            <h2 id="pv3-step-h" ref={heading} tabIndex={-1}>{(!household_ && step.personal) || step.question}</h2>
            <p className="pv3-why">{step.id === "prepare" && snapshot.flow?.shortFrom
              ? <span className="pv3-tone--bad">{snapshot.flow.shortFrom.label} on {dayWords(snapshot.flow.shortFrom.date)} is short {moneyWords(snapshot.flow.shortFrom.shortCents)}.</span>
              : step.id === "prepare" && snapshot.prepare.line && !snapshot.prepare.line.includes("if expected")
                ? <span className="pv3-tone--ok">{snapshot.prepare.line}.</span>
                : step.why}</p>
          </div>
        </div>
        {body}
      </article>
      <div className="pv3-tally" aria-live="polite">
        <span>Left for everyday <small>Now</small></span>
        <b className="pv3-amt">{snapshot.now.amountCents === null ? "—" : moneyWords(snapshot.now.amountCents)}</b>
      </div>
    </section>
  );
}
