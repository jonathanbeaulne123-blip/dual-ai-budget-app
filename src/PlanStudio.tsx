import { useMemo, useState } from "react";
import {
  PLAN_CURRICULUM,
  PLAN_LENSES,
  PLAN_LENS_COPY,
  addDays,
  acknowledgeHouseholdPlan,
  adoptLegacyHouseholdPlan,
  appendPlanSitdownTurn,
  createPlanScenario,
  currentPlanVersion,
  executeHerculesReadToolPlan,
  evaluatePlanDrift,
  formatCad,
  monthKeyFromDateKey,
  planAcknowledgementState,
  planLensTotals,
  proposeHouseholdPlan,
  savePlanDraft,
  savePlanLearningProgress,
  shiftMonthKey,
  lockPersonalPlan,
  updatePlanNudgeState,
  type CommitResult,
  type DateKey,
  type Household,
  type LedgerView,
  type MonthKey,
  type PlanLens,
  type PlanLine,
} from "./core/index.ts";
import "./plan-studio.css";
import { PlanBridgeEditor } from "./PlanBridgeEditor.tsx";
import { PlanReflectionEditor } from "./PlanReflectionEditor.tsx";

type Section = "overview" | PlanLens | "scenarios" | "learn" | "reflection" | "history" | "sitdown";
type PlanTool = "plan_overview" | "plan_cashflow_runway" | "plan_assumptions" | "plan_version_diff" | "plan_actual" | "plan_drift" | "plan_bridge_status" | "plan_sitdown_status" | "plan_learning_context";

const SITDOWN_STEPS = [
  ["Arrive", "Bring private preparation into a shared agenda only when you choose."],
  ["Notice", "Recognize verified progress at the size it deserves."],
  ["Reflect", "Compare what you intended with what actually happened."],
  ["Update reality", "Refresh income, obligations, Fund needs, and true expenses."],
  ["Build the month", "Make decisions through Protect, Prepare, Build, and Everyday."],
  ["Learn", "Use one useful, skippable lesson for the decision in front of you."],
  ["Resolve the Bridge", "Decide what should cross from Personal into Household."],
  ["Acknowledge", "Review the exact Plan; each partner decides independently."],
] as const;

function toolForQuestion(question: string): PlanTool {
  const value = question.toLowerCase();
  if (/runway|low point|cash/.test(value)) return "plan_cashflow_runway";
  if (/assumption|uncertain|risk/.test(value)) return "plan_assumptions";
  if (/changed|difference|acknowledged/.test(value)) return "plan_version_diff";
  if (/actual|paid|happen/.test(value)) return "plan_actual";
  if (/drift|pace|exposed|forget/.test(value)) return "plan_drift";
  if (/bridge|contribution/.test(value)) return "plan_bridge_status";
  if (/sit.?down|talk/.test(value)) return "plan_sitdown_status";
  if (/teach|learn|explain simply/.test(value)) return "plan_learning_context";
  return "plan_overview";
}

export function PlanStudio({ household, view, memberId, today, busy, onCommand, onSharedHerculesReply }: {
  household: Household;
  view: LedgerView;
  memberId: string;
  today: DateKey;
  busy: boolean;
  onCommand: (fn: (current: Household) => CommitResult) => Promise<unknown>;
  onSharedHerculesReply?: (sessionId: string, inReplyToTurnId: string) => Promise<void>;
}) {
  const scope = view === "household" ? "household" : "personal";
  const [month, setMonth] = useState<MonthKey>(monthKeyFromDateKey(today));
  const [section, setSection] = useState<Section>("overview");
  const [lineLabel, setLineLabel] = useState("");
  const [lineAmount, setLineAmount] = useState("");
  const [lineLens, setLineLens] = useState<PlanLens>("protect");
  const [reason, setReason] = useState("");
  const [sitdownStep, setSitdownStep] = useState(0);
  const [sitdownText, setSitdownText] = useState("");
  const [herculesOpen, setHerculesOpen] = useState(false);
  const [question, setQuestion] = useState("What is protected, and what is still exposed?");
  const [answer, setAnswer] = useState("I can read this month, explain the evidence, and help you try an alternative without changing the accepted Plan.");

  const version = currentPlanVersion(household, scope, month, memberId);
  const reflectionVersion = [...(household.planVersions ?? [])].filter((row) => row.scope === scope && row.monthKey === month
    && ["active", "superseded"].includes(row.state) && (scope === "household" || row.ownerMemberId === memberId))
    .sort((left, right) => right.sequence - left.sequence || right.createdAt.localeCompare(left.createdAt))[0] ?? null;
  const draft = [...(household.planDrafts ?? [])].filter((row) => row.ownerMemberId === memberId && row.scope === scope && row.targetMonth === month)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
  const working = draft?.lines ?? version?.lines ?? [];
  const totals = useMemo(() => planLensTotals(working), [working]);
  const acknowledgement = version?.scope === "household" ? planAcknowledgementState(household, version) : null;
  const myAcknowledged = Boolean(acknowledgement?.acknowledgedMemberIds.includes(memberId));
  const lesson = PLAN_CURRICULUM[(Math.max(1, Number(month.slice(5, 7))) - 1) % PLAN_CURRICULUM.length]!;
  const progress = (household.planLearningProgress ?? []).find((row) => row.memberId === memberId && row.monthKey === month && row.lessonId === lesson[0]);
  const session = [...(household.planHerculesSessions ?? [])].filter((row) => row.monthKey === month).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const legacyRows = household.budgetPlans.filter((row) => row.active && row.monthKey === month && row.amountCents > 0);
  const coaching = (household.planCoachingPreferences ?? []).find((row) => row.memberId === memberId);
  const topFinding = useMemo(() => {
    if (!version || coaching?.intensity === "off") return null;
    const rank = { critical: 0, attention: 1, gentle: 2 } as const;
    return evaluatePlanDrift(household, version, today)
      .filter((row) => !coaching?.dismissedIssueIds.includes(row.id) && (!coaching?.snoozedIssueIds[row.id] || coaching.snoozedIssueIds[row.id]! <= today))
      .sort((left, right) => rank[left.severity] - rank[right.severity])[0] ?? null;
  }, [coaching, household, today, version]);

  const saveLines = (lines: PlanLine[]) => onCommand((current) => savePlanDraft(current, {
    ...(draft?.id ? { id: draft.id } : {}), scope, memberId, targetMonth: month, ...(version?.id ? { baseVersionId: version.id } : {}),
    lines, assumptions: draft?.assumptions ?? version?.assumptions ?? [], note: draft?.note ?? "", createdBy: memberId,
  }));

  const addLine = () => {
    const cents = Math.round(Number(lineAmount) * 100);
    if (!lineLabel.trim() || !Number.isFinite(cents) || cents < 0) return;
    const line: PlanLine = { id: crypto.randomUUID(), lens: lineLens,
      kind: lineLens === "protect" ? "obligation" : lineLens === "prepare" ? "true-expense" : lineLens === "build" ? "goal-contribution" : "everyday-pool",
      labelSnapshot: lineLabel.trim(), amountCents: cents, cadence: "monthly", responsibility: { kind: scope === "household" ? "joint" : "member", ...(scope === "personal" ? { memberId } : {}) }, assumptionIds: [], createdBy: memberId };
    void saveLines([...working, line]);
    setLineLabel(""); setLineAmount("");
  };

  const askHercules = () => {
    const tool = toolForQuestion(question);
    const run = executeHerculesReadToolPlan(household, { calls: [{ id: "plan-studio", name: tool, args: { monthKey: month } }] }, today,
      { memberId, view, plan: { monthKey: month, scope, ...(version?.id ? { activePlanVersionId: version.id } : {}), ...(draft?.id ? { draftId: draft.id } : {}), ...(PLAN_LENSES.includes(section as PlanLens) ? { lens: section as PlanLens } : {}), ...(session?.sitDownSessionId ? { sitDownSessionId: session.sitDownSessionId } : {}) } });
    setAnswer(run.talk.spoken);
  };

  const submitSharedTalkingPoint = async () => {
    const text = sitdownText.trim();
    if (!text) return;
    const outcome = await onCommand((current) => appendPlanSitdownTurn(current, { sessionId: session?.id,
      sitDownSessionId: session?.sitDownSessionId ?? `SITDOWN-${month}`, monthKey: month,
      planDraftId: draft?.id ?? `PLAN-DRAFT-${month}`, memberId, text }));
    setSitdownText("");
    const accepted = (outcome as { household?: Household } | null)?.household;
    const acceptedSession = [...(accepted?.planHerculesSessions ?? [])].filter((row) => row.monthKey === month).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    const memberTurn = [...(acceptedSession?.turns ?? [])].reverse().find((row) => row.role === "member" && row.memberId === memberId && row.text === text);
    if (acceptedSession && memberTurn && onSharedHerculesReply) {
      try { await onSharedHerculesReply(acceptedSession.id, memberTurn.id); }
      catch { setAnswer("Your talking point is safely Shared. Hercules could not add his reply yet; retry after the household reconnects."); setHerculesOpen(true); }
    }
  };

  const status = draft ? "Private draft" : version ? version.state : "Not started";

  return <main className={`plan-studio plan-studio--${scope}`} aria-label={`${scope === "household" ? "Household" : "Personal"} Plan Studio`}>
    <header className="plan-studio__masthead">
      <div><p className="kicker">{scope === "household" ? "Our agreement" : "My private plan"}</p><h2>{scope === "household" ? "The month we are making together" : "A month that has somewhere to go"}</h2></div>
      <div className="plan-month-switcher" aria-label="Plan month"><button onClick={() => setMonth(shiftMonthKey(month, -1))} aria-label="Previous month">←</button><strong>{month}</strong><button onClick={() => setMonth(shiftMonthKey(month, 1))} aria-label="Next month">→</button><span>{status}</span></div>
    </header>

    <div className="plan-studio__layout">
      <nav className="plan-studio__rail" aria-label="Plan sections">
        {(["overview", ...PLAN_LENSES, "scenarios", "learn", "reflection", "history", "sitdown"] as Section[]).map((item) => <button key={item} className={section === item ? "active" : ""} onClick={() => setSection(item)}>{item === "sitdown" ? "Sitdown" : item[0]!.toUpperCase() + item.slice(1)}</button>)}
      </nav>

      <section className="plan-studio__canvas">
        {section === "overview" && <>
          <div className="plan-lens-grid">{PLAN_LENSES.map((lens) => <button key={lens} className={`plan-lens-card plan-lens-card--${lens}`} onClick={() => setSection(lens)}><span>{PLAN_LENS_COPY[lens].title}</span><strong>{formatCad(totals[lens])}</strong><small>{PLAN_LENS_COPY[lens].prompt}</small></button>)}</div>
          {!draft && !version && <article className="plan-empty"><p>This month is a blank page. Start privately; nothing is shared or treated as agreed.</p><button disabled={busy} onClick={() => void saveLines([])}>Start a private draft</button>{scope === "household" && legacyRows.length > 0 && <button disabled={busy} onClick={() => void onCommand((current) => adoptLegacyHouseholdPlan(current, { monthKey: month, memberId, createdBy: memberId }))}>Bring in the current household budget</button>}</article>}
          <section className="plan-working-list"><div><p className="kicker">Working plan</p><h3>{working.length ? `${working.length} decisions for ${month}` : "No decisions yet"}</h3></div>{working.map((line) => <article key={line.id}><span className={`plan-lens-dot plan-lens-dot--${line.lens}`} /> <div><strong>{line.labelSnapshot}</strong><small>{PLAN_LENS_COPY[line.lens].title} · {line.cadence}</small></div><b>{formatCad(line.amountCents)}</b>{draft && <button aria-label={`Remove ${line.labelSnapshot}`} onClick={() => void saveLines(working.filter((row) => row.id !== line.id))}>×</button>}</article>)}</section>
        </>}

        {PLAN_LENSES.includes(section as PlanLens) && (() => { const lens = section as PlanLens; return <>
          <header className={`plan-lens-hero plan-lens-hero--${lens}`}><p className="kicker">{PLAN_LENS_COPY[lens].title}</p><h3>{PLAN_LENS_COPY[lens].prompt}</h3><strong>{formatCad(totals[lens])}</strong></header>
          <div className="plan-decision-cards">{working.filter((line) => line.lens === lens).map((line) => <article key={line.id}><h4>{line.labelSnapshot}</h4><strong>{formatCad(line.amountCents)}</strong><p>{line.kind.replaceAll("-", " ")} · {line.cadence}</p></article>)}</div>
          <form className="plan-add-line" onSubmit={(event) => { event.preventDefault(); addLine(); }}><h4>{scope === "personal" ? "Try a change" : "Propose a change"}</h4><label>Lens<select value={lineLens} onChange={(event) => setLineLens(event.target.value as PlanLens)}>{PLAN_LENSES.map((value) => <option key={value} value={value}>{PLAN_LENS_COPY[value].title}</option>)}</select></label><label>What is this for?<input value={lineLabel} onChange={(event) => setLineLabel(event.target.value)} /></label><label>Monthly amount (CAD)<input inputMode="decimal" value={lineAmount} onChange={(event) => setLineAmount(event.target.value)} /></label><button disabled={busy || !lineLabel.trim()}>Save to private draft</button></form>
        </>; })()}

        {section === "scenarios" && <section className="plan-section"><p className="kicker">Scenario Lab</p><h3>Alternatives are experiments, not decisions</h3><p>Compare a different shape without touching the accepted Plan.</p>{(household.planScenarios ?? []).filter((row) => row.ownerMemberId === memberId && row.scope === scope).map((scenario) => <article key={scenario.id}><strong>{scenario.name}</strong><span>{formatCad(scenario.changedLines.reduce((sum, line) => sum + line.amountCents, 0))}</span></article>)}<button disabled={!draft || busy} onClick={() => draft && void onCommand((current) => createPlanScenario(current, { memberId, draftId: draft.id, scope, name: `Alternative ${((household.planScenarios ?? []).length + 1)}`, changedLines: draft.lines, createdBy: memberId }))}>Add an alternative</button></section>}

        {section === "learn" && <section className="plan-section plan-lesson"><p className="kicker">One idea for this chapter</p><h3>{lesson[1]}</h3><p>Hercules will connect this lesson to a real choice in the Plan. Learning is always skippable and never blocks agreement.</p><div><button disabled={busy || progress?.state === "completed"} onClick={() => void onCommand((current) => savePlanLearningProgress(current, { memberId, monthKey: month, lessonId: lesson[0], state: "completed", createdBy: memberId }))}>{progress?.state === "completed" ? "Completed" : "Mark understood"}</button><button disabled={busy} onClick={() => void onCommand((current) => savePlanLearningProgress(current, { memberId, monthKey: month, lessonId: lesson[0], state: "skipped", createdBy: memberId }))}>Skip for now</button></div></section>}

        {section === "reflection" && <PlanReflectionEditor key={`${scope}-${reflectionVersion?.id ?? month}`} household={household} version={reflectionVersion} memberId={memberId} busy={busy} onCommand={onCommand} />}

        {section === "history" && <section className="plan-section"><p className="kicker">Version history</p><h3>The past stays legible</h3>{(household.planVersions ?? []).filter((row) => row.scope === scope && row.monthKey === month && (scope === "household" || row.ownerMemberId === memberId)).sort((a, b) => b.sequence - a.sequence).map((row) => <article key={row.id}><div><strong>Version {row.sequence}</strong><small>{row.reason}</small></div><span>{row.state}</span><code>{row.digest.slice(0, 10)}</code></article>)}</section>}

        {section === "sitdown" && <section className="plan-section plan-sitdown"><p className="kicker">Monthly Sitdown</p><h3>{SITDOWN_STEPS[sitdownStep]![0]}</h3><p>{SITDOWN_STEPS[sitdownStep]![1]}</p><ol>{SITDOWN_STEPS.map(([title], index) => <li key={title} className={index === sitdownStep ? "active" : index < sitdownStep ? "done" : ""}><button onClick={() => setSitdownStep(index)}><span>{index < sitdownStep ? "✓" : index + 1}</span>{title}</button></li>)}</ol>{scope === "household" && <div className="plan-shared-chat"><strong>Shared with this household</strong><p>Every message below is visible to both partners. Private prework is not imported.</p>{session?.turns.map((turn) => <blockquote key={turn.id}><b>{turn.role === "hercules" ? "Hercules" : household.members.find((row) => row.id === turn.memberId)?.name ?? "Member"}</b>{turn.text}{turn.role === "hercules" && <small>Trusted Shared reply · {turn.provider ?? "Hercules"}</small>}</blockquote>)}<form onSubmit={(event) => { event.preventDefault(); void submitSharedTalkingPoint(); }}><label>Add a shared talking point<input value={sitdownText} onChange={(event) => setSitdownText(event.target.value)} /></label><button disabled={busy || !sitdownText.trim()}>Share and ask Hercules</button></form></div>}<div className="plan-sitdown-nav"><button disabled={sitdownStep === 0} onClick={() => setSitdownStep((value) => Math.max(0, value - 1))}>Back</button><span>{sitdownStep + 1} of {SITDOWN_STEPS.length}</span><button disabled={sitdownStep === SITDOWN_STEPS.length - 1} onClick={() => setSitdownStep((value) => Math.min(SITDOWN_STEPS.length - 1, value + 1))}>Continue</button></div></section>}

        {draft && <footer className="plan-publish"><div><strong>Draft saved privately</strong><span>{scope === "household" ? "Only the exact reviewed proposal crosses into Shared." : "Locking makes an immutable Personal version. It never moves money."}</span></div><label>Reason for this version<input value={reason} onChange={(event) => setReason(event.target.value)} placeholder={version ? "What changed?" : "Our plan for the month"} /></label><button disabled={busy} onClick={() => void onCommand((current) => scope === "household" ? proposeHouseholdPlan(current, { memberId, draftId: draft.id, reason, createdBy: memberId }) : lockPersonalPlan(current, { memberId, draftId: draft.id, reason, createdBy: memberId }))}>{scope === "household" ? "Review and propose to us" : "Lock my plan"}</button></footer>}
      </section>

      <aside className="plan-studio__dock">
        <section><p className="kicker">Consequence</p><strong>{formatCad(working.reduce((sum, line) => sum + line.amountCents, 0))} intended</strong><span>No money moves here.</span></section>
        {topFinding && <section className={`plan-finding plan-finding--${topFinding.severity}`}><p className="kicker">{topFinding.severity} guidance</p><strong>{topFinding.explanation}</strong><span>{topFinding.consequence}</span><button onClick={() => { setQuestion("Why am I seeing this?"); setAnswer(`${topFinding.explanation} ${topFinding.consequence} This rule used Plan version ${topFinding.planVersionId.slice(0, 10)} and visible evidence at revision ${topFinding.sourceRevision}, as of ${topFinding.asOf}.`); setHerculesOpen(true); }}>Why am I seeing this?</button><div><button disabled={busy} onClick={() => void onCommand((current) => updatePlanNudgeState(current, { memberId, issueId: topFinding.id, action: "snooze", snoozedUntil: addDays(today, 7), createdBy: memberId }))}>Snooze 7 days</button><button disabled={busy} onClick={() => void onCommand((current) => updatePlanNudgeState(current, { memberId, issueId: topFinding.id, action: "dismiss", createdBy: memberId }))}>Dismiss</button></div></section>}
        {scope === "household" && version && <section className="plan-ack"><p className="kicker">Exact agreement</p><strong>{version.state}</strong><code>{version.digest.slice(0, 12)}</code><p>{acknowledgement?.acknowledgedMemberIds.length ?? 0} of 2 acknowledged</p>{version.state === "proposed" && <button disabled={busy || myAcknowledged} onClick={() => void onCommand((current) => acknowledgeHouseholdPlan(current, { planVersionId: version.id, expectedDigest: version.digest, memberId, createdBy: memberId }))}>{myAcknowledged ? "You acknowledged" : "Acknowledge this exact version"}</button>}</section>}
        <PlanBridgeEditor key={`${memberId}-${month}`} household={household} memberId={memberId} month={month} householdDraft={scope === "household" ? draft : null} busy={busy} onCommand={onCommand} />
        <button className="plan-hercules-launch" onClick={() => setHerculesOpen(true)}><span aria-hidden="true">♜</span><strong>Ask Hercules</strong><small>He knows this page and this month.</small></button>
      </aside>
    </div>

    {herculesOpen && <div className="plan-hercules-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setHerculesOpen(false); }}><aside className="plan-hercules" role="dialog" aria-modal="true" aria-labelledby="plan-hercules-title"><header><div><p className="kicker">Plan guide</p><h3 id="plan-hercules-title">Hercules is with you</h3></div><button onClick={() => setHerculesOpen(false)} aria-label="Close Hercules">×</button></header><div className="plan-hercules__answer"><span aria-hidden="true">♜</span><p>{answer}</p></div><div className="plan-hercules__prompts">{["Why did our runway change?", "What are we likely forgetting?", "Teach me the underlying idea."].map((prompt) => <button key={prompt} onClick={() => { setQuestion(prompt); }}>{prompt}</button>)}</div><form onSubmit={(event) => { event.preventDefault(); askHercules(); }}><label>Ask about this Plan<textarea value={question} onChange={(event) => setQuestion(event.target.value)} /></label><button>Ask from visible evidence</button></form><small>Hercules distinguishes posted facts, Plan intentions, estimates, and inference. Suggestions never change this Plan automatically.</small></aside></div>}
  </main>;
}
