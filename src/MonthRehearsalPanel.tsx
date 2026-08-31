import { useMemo, useState } from "react";
import { OpeningTruthCard } from "./OpeningTruthCard.tsx";
import {
  BIANCA_APPROVAL_STATEMENT,
  BIANCA_PLAYTEST_CARD,
  JONATHAN_COUNTERSIGNATURE,
  MONTH_REHEARSAL_TASKS,
  acknowledgeRehearsalWeek,
  approveMonthRehearsal,
  archiveMonthRehearsal,
  completeRehearsalCorrectionPractice,
  dismissNotice,
  evaluateRehearsalCheckpoint,
  formatCad,
  formatMonthLabel,
  linkRehearsalReceipt,
  monthKeyFromDateKey,
  monthRehearsalReport,
  parseDateKey,
  recordRehearsalOutcome,
  rehearsalReceiptSuggestions,
  rehearsalWeekAvailability,
  shiftMonthKey,
  startMonthRehearsal,
  startRehearsalTask,
  type DateKey,
  type Household,
  type MonthKey,
  type MonthRehearsal,
  type MonthRehearsalFrictionOutcome,
  type MonthRehearsalTaskId,
  type UndoToken,
} from "./core/index.ts";
import "./month-rehearsal.css";

const OUTCOME_LABELS: Array<{ id: MonthRehearsalFrictionOutcome; label: string }> = [
  { id: "clear", label: "Clear" },
  { id: "hesitated", label: "Hesitated" },
  { id: "needed-help", label: "Needed help" },
  { id: "distrusted-number", label: "Distrusted a number" },
  { id: "stopped", label: "Stopped" },
];

function suggestedMonth(today: DateKey): MonthKey {
  const month = monthKeyFromDateKey(today);
  return parseDateKey(today).day >= 22 ? shiftMonthKey(month, 1) : month;
}

function activeRehearsal(household: Household): MonthRehearsal | null {
  return [...(household.monthRehearsals ?? [])]
    .filter((row) => row.status === "active")
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt))[0] ?? null;
}

function downloadText(name: string, text: string, type: string) {
  const href = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = href;
  link.download = name;
  link.click();
  URL.revokeObjectURL(href);
}

function statusLabel(status: string) {
  if (status === "not-started") return "Not started";
  if (status === "in-progress") return "In progress";
  if (status === "linked") return "Confirm linked";
  if (status === "skipped") return "Did not happen";
  return "Done";
}

export type MonthRehearsalPanelProps = {
  household: Household;
  memberId: string;
  today: DateKey;
  onApply: (household: Household, undo?: UndoToken) => unknown | Promise<unknown>;
  onOpenTask?: (taskId: MonthRehearsalTaskId) => void;
  surface?: "home" | "manage";
};

export function MonthRehearsalPanel({ household, memberId, today, onApply, onOpenTask, surface = "home" }: MonthRehearsalPanelProps) {
  const activeRows = (household.monthRehearsals ?? []).filter((row) => row.status === "active");
  const rehearsal = activeRehearsal(household);
  const archived = [...(household.monthRehearsals ?? [])]
    .filter((row) => row.status === "archived")
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;
  const monthKey = rehearsal?.monthKey ?? suggestedMonth(today);
  const inviteKey = `month-rehearsal-invite:${monthKey}`;
  const dismissed = household.calendar.dismissedNoticeKeys?.includes(inviteKey);
  const empty = household.transactions.every((transaction) => transaction.isDuplicate);
  const [expanded, setExpanded] = useState(surface === "manage");
  const [biancaParticipantId, setBiancaParticipantId] = useState("");
  const [jonathanPartnerId, setJonathanPartnerId] = useState("");
  const [selectedWeek, setSelectedWeek] = useState<1 | 2 | 3 | 4>(() => {
    if (!rehearsal || today < `${rehearsal.monthKey}-01`) return 1;
    const day = parseDateKey(today).day;
    return day <= 7 ? 1 : day <= 14 ? 2 : day <= 21 ? 3 : 4;
  });
  const [openingTaskId, setOpeningTaskId] = useState<string | null>(null);
  const [noteByAttempt, setNoteByAttempt] = useState<Record<string, string>>({});
  const [receiptChoiceByTask, setReceiptChoiceByTask] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const reportTarget = rehearsal ?? archived;
  const isParticipant = Boolean(reportTarget && (memberId === reportTarget.biancaParticipantId || memberId === reportTarget.jonathanPartnerId));
  const report = useMemo(() => reportTarget && isParticipant && activeRows.length <= 1 ? monthRehearsalReport(household, reportTarget.id, memberId) : null, [household, reportTarget, isParticipant, memberId, activeRows.length]);

  const apply = async (key: string, action: () => unknown | Promise<unknown>) => {
    setBusy(key);
    setError("");
    try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); } finally { setBusy(""); }
  };

  if (household.environment !== "development") return null;
  if (activeRows.length > 1) {
    const participantRows = activeRows.filter((row) => memberId === row.biancaParticipantId || memberId === row.jonathanPartnerId);
    if (!participantRows.length) return null;
    return <section className="month-card" role="alert"><p className="eyebrow">Our month needs attention</p><h2>Two phones started different versions</h2><p>No rehearsal action or approval can continue until one version is archived. Your books have not changed.</p><div className="month-conflict-list">{participantRows.map((row) => <div key={row.id}><span>{formatMonthLabel(row.monthKey)} · started {row.startedAt.slice(0, 10)}</span><button type="button" className="secondary" disabled={Boolean(busy)} onClick={() => void apply(`resolve-${row.id}`, async () => { const result = archiveMonthRehearsal(household, { rehearsalId: row.id, memberId }); await onApply(result.household, result.undo); })}>Archive this version</button></div>)}</div></section>;
  }
  if (reportTarget && !isParticipant) return null;

  if (!rehearsal) {
    if (surface === "manage" && archived && report) return <section className="month-card" aria-label="Archived month rehearsal">
      <header className="month-card-header"><div><p className="eyebrow">Our month · archived</p><h2>{formatMonthLabel(archived.monthKey)}</h2></div><span className="month-proof-pill good">Read only</span></header>
      <p>The rehearsal is archived. Your Development household and its books remain usable.</p>
      <p>This export contains the clarity and friction notes shared between the two participants.</p><div className="month-actions"><button type="button" className="secondary" onClick={() => downloadText(`our-month-${archived.monthKey}.txt`, report.human, "text/plain")}>Download readable report</button><button type="button" className="secondary" onClick={() => downloadText(`our-month-${archived.monthKey}.json`, report.json, "application/json")}>Download JSON</button><button type="button" className="primary" onClick={() => void apply("replay-archived", async () => {
        const result = startMonthRehearsal(household, { monthKey: archived.monthKey, biancaParticipantId: archived.biancaParticipantId, jonathanPartnerId: archived.jonathanPartnerId, startedByMemberId: memberId });
        await onApply(result.household, result.undo);
      })}>Replay this month</button></div>
      {error ? <p className="month-error" role="alert">{error}</p> : null}
    </section>;
    if (!empty || dismissed) return null;
    const canStart = Boolean(biancaParticipantId && jonathanPartnerId && biancaParticipantId !== jonathanPartnerId && (memberId === biancaParticipantId || memberId === jonathanPartnerId));
    return <aside className="month-invite" aria-label="Start our month">
      <button className="month-dismiss" type="button" aria-label="Dismiss Start our month" onClick={() => void apply("dismiss", async () => {
        const result = dismissNotice(household, inviteKey);
        await onApply(result.household, result.undo);
      })}>×</button>
      <div className="month-hercules-line"><span aria-hidden="true">🐈</span><p>One short sit-down each week. We’ll begin with the balances you already have, then prove the books together.</p></div>
      <p className="eyebrow">{formatMonthLabel(monthKey)} · Development</p>
      <h2>Start our month</h2>
      <p>About ten minutes a week on your own phones. Nothing here enables Production or moves money without the ordinary Confirm.</p>
      <div className="month-participant-selectors">
        <label>Bianca’s phone<select value={biancaParticipantId} onChange={(event) => setBiancaParticipantId(event.target.value)}><option value="">Choose Bianca</option>{household.members.filter((row) => row.active).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
        <label>Jonathan’s phone<select value={jonathanPartnerId} onChange={(event) => setJonathanPartnerId(event.target.value)}><option value="">Choose Jonathan</option>{household.members.filter((row) => row.active && row.id !== biancaParticipantId).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
      </div>
      <p>Each person reviews and acknowledges only from their own signed-in phone.</p>
      {!canStart ? <p className="month-error">Choose two different participants, including the person using this phone.</p> : null}
      <button type="button" className="primary" disabled={!canStart || Boolean(busy)} onClick={() => void apply("start", async () => {
        const result = startMonthRehearsal(household, {
          monthKey,
          biancaParticipantId,
          jonathanPartnerId,
          startedByMemberId: memberId,
        });
        await onApply(result.household, result.undo);
      })}>{busy === "start" ? "Starting…" : "Start our month"}</button>
    </aside>;
  }

  const week = rehearsal.weeks.find((row) => row.week === selectedWeek) ?? rehearsal.weeks[0]!;
  const availability = rehearsalWeekAvailability(rehearsal.monthKey, week.week, today);
  const actorName = household.members.find((member) => member.id === memberId)?.name ?? "You";
  const acknowledgements = new Set(week.acknowledgements.map((row) => row.memberId));
  const allWeeksTied = rehearsal.weeks.every((row) => row.checkpoint?.status === "tied");

  const startTask = async (taskId: MonthRehearsalTaskId) => {
    const result = startRehearsalTask(household, { rehearsalId: rehearsal.id, taskId, memberId, today });
    await onApply(result.household, result.undo);
    if (taskId === "opening-truth") setOpeningTaskId(taskId);
    else if (taskId !== "correction-practice" && taskId !== "month-review") onOpenTask?.(taskId);
  };

  const linkSuggested = async (taskId: MonthRehearsalTaskId, suggestionIndex: number) => {
    const suggestion = rehearsalReceiptSuggestions(household, { rehearsalId: rehearsal.id, taskId })[suggestionIndex];
    if (!suggestion) throw new Error("No matching real Confirm is ready yet. Finish the ordinary action, then return here.");
    const result = linkRehearsalReceipt(household, {
      rehearsalId: rehearsal.id, taskId, memberId, today,
      kind: suggestion.kind, receiptId: suggestion.receiptId, postedIds: suggestion.postedIds,
    });
    await onApply(result.household, result.undo);
  };

  const recordOutcome = async (taskId: MonthRehearsalTaskId, attemptId: string, outcome: MonthRehearsalFrictionOutcome, didNotHappen = false) => {
    const result = recordRehearsalOutcome(household, {
      rehearsalId: rehearsal.id, taskId, attemptId, memberId, outcome,
      note: noteByAttempt[attemptId] ?? "", didNotHappen,
    });
    await onApply(result.household, result.undo);
  };

  return <section className={`month-card ${expanded ? "is-expanded" : ""}`} aria-label="Our month">
    <header className="month-card-header">
      <div><p className="eyebrow">Our month · {formatMonthLabel(rehearsal.monthKey)}</p><h2>Week {week.week}: {week.week === 1 ? "Begin truthfully" : week.week === 2 ? "Bills and clearing" : week.week === 3 ? "Corrections and trust" : "Close together"}</h2></div>
      <span className={`month-proof-pill ${week.checkpoint?.status === "tied" ? "good" : "attention"}`}>{week.checkpoint?.status === "tied" ? "Tied" : "Needs attention"}</span>
    </header>
    <p>{availability === "future" ? `Preview only until ${week.startsOn}.` : `Resume the ${week.startsOn} to ${week.endsOn} sit-down.`}</p>
    {!expanded ? <div className="month-actions"><button type="button" className="primary" aria-expanded={false} onClick={() => setExpanded(true)}>Resume our month</button><button type="button" className="secondary" aria-expanded={false} onClick={() => setExpanded(true)}>See the four weeks</button></div> : null}
    {expanded ? <>
      <nav className="month-week-tabs" aria-label="Month weeks">
        {rehearsal.weeks.map((row) => <button key={row.id} type="button" aria-current={row.week === week.week ? "step" : undefined} onClick={() => setSelectedWeek(row.week)}>
          <span>Week {row.week}</span><small>{row.checkpoint?.status === "tied" ? "Tied" : row.week > week.week && availability !== "past" ? "Preview" : "Open"}</small>
        </button>)}
      </nav>
      <div className="month-shared-disclosure">Bianca’s clarity notes are visible only to the two selected participants inside this Development household. Hercules never interprets them.</div>
      <aside className="month-playtest-card" aria-label="Bianca playtest card"><h3>Bianca’s ordinary playtest</h3><ol>{BIANCA_PLAYTEST_CARD.map((line) => <li key={line}>{line}</li>)}</ol></aside>
      <ol className="month-task-list">
        {week.tasks.map((task, index) => {
          const definition = MONTH_REHEARSAL_TASKS.find((row) => row.id === task.taskId)!;
          const unfinished = task.attempts.find((attempt) => !attempt.finishedAt);
          const suggestions = rehearsalReceiptSuggestions(household, { rehearsalId: rehearsal.id, taskId: task.taskId });
          const suggestionIndex = Math.min(receiptChoiceByTask[task.taskId] ?? 0, Math.max(0, suggestions.length - 1));
          const suggestion = suggestions[suggestionIndex] ?? null;
          const resolved = task.status === "complete" || task.status === "skipped";
          return <li key={task.id} className={resolved ? "done" : ""}>
            <div className="month-task-heading"><span className="month-step-number">{index + 1}</span><div><h3>{definition.title}</h3><span>{statusLabel(task.status)}</span></div></div>
            <div className="month-hercules-line compact"><span aria-hidden="true">🐈</span><p>{definition.hercules}</p></div>
            {openingTaskId === task.taskId && unfinished ? <OpeningTruthCard household={household} memberId={memberId} date={week.startsOn} onApply={onApply} onDone={() => setOpeningTaskId(null)} /> : null}
            {!resolved && availability !== "future" ? <div className="month-actions">
              {!unfinished && task.status !== "linked" ? <button type="button" className="primary" disabled={Boolean(busy)} onClick={() => void apply(`start-${task.id}`, () => startTask(task.taskId))}>{busy === `start-${task.id}` ? "Opening…" : "Start"}</button> : null}
              {unfinished && task.taskId !== "opening-truth" && !task.receipt ? <div className="month-return-card"><strong>Still working on this?</strong><button type="button" className="secondary" onClick={() => onOpenTask?.(task.taskId)}>Continue</button><button type="button" className="text-button" onClick={() => void apply(`stopped-${task.id}`, () => recordOutcome(task.taskId, unfinished.id, "stopped"))}>I stopped here</button></div> : null}
              {suggestion && !task.receipt ? <div className="month-receipt-proposal"><strong>Does this look like the right evidence?</strong><span>{suggestion.date ?? "No money date"} · {suggestion.summary} · {suggestion.amountCents === null ? "No amount" : formatCad(suggestion.amountCents)} · {suggestion.accountName}</span><small>Receipt {suggestion.receiptId}</small><div className="month-actions"><button type="button" className="secondary" disabled={Boolean(busy)} onClick={() => void apply(`link-${task.id}`, () => linkSuggested(task.taskId, suggestionIndex))}>Link this evidence</button>{suggestions.length > 1 ? <button type="button" className="text-button" onClick={() => setReceiptChoiceByTask((current) => ({ ...current, [task.taskId]: (suggestionIndex + 1) % suggestions.length }))}>Choose another</button> : null}</div></div> : null}
              {task.taskId === "correction-practice" && unfinished && !task.receipt ? <button type="button" className="secondary" disabled={Boolean(busy)} onClick={() => void apply(`practice-${task.id}`, async () => {
                const result = await completeRehearsalCorrectionPractice(household, { rehearsalId: rehearsal.id, memberId, today });
                await onApply(result.household, result.undo);
              })}>Run safe practice</button> : null}
              {task.taskId === "month-review" && unfinished && !task.receipt ? <button type="button" className="secondary" disabled={Boolean(busy)} onClick={() => void apply(`review-${task.id}`, async () => {
                const result = linkRehearsalReceipt(household, { rehearsalId: rehearsal.id, taskId: task.taskId, memberId, today, kind: "review", receiptId: `REVIEW-${rehearsal.monthKey}-TOGETHER` });
                await onApply(result.household, result.undo);
              })}>We reviewed the month</button> : null}
              {unfinished && task.allowDidNotHappen ? <button type="button" className="text-button" onClick={() => void apply(`skip-${task.id}`, () => recordOutcome(task.taskId, unfinished.id, "clear", true))}>Did not happen</button> : null}
            </div> : null}
            {unfinished && (task.receipt || task.taskId === "correction-practice" || task.taskId === "month-review") ? <div className="month-friction-card">
              <label>How did that feel? <input value={noteByAttempt[unfinished.id] ?? ""} maxLength={240} placeholder="Optional short note" onChange={(event) => setNoteByAttempt((current) => ({ ...current, [unfinished.id]: event.target.value }))} /></label>
              <div className="month-outcomes">{OUTCOME_LABELS.map((outcome) => <button key={outcome.id} type="button" onClick={() => void apply(`outcome-${unfinished.id}`, () => recordOutcome(task.taskId, unfinished.id, outcome.id))}>{outcome.label}</button>)}</div>
            </div> : null}
          </li>;
        })}
      </ol>
      <section className="month-checkpoint" aria-label={`Week ${week.week} accounting checkpoint`}>
        <div><span className={`month-proof-pill ${week.checkpoint?.status === "tied" ? "good" : "attention"}`}>{week.checkpoint?.status === "tied" ? "Tied" : "Needs attention"}</span><h3>Week {week.week} proof</h3></div>
        <button type="button" className="secondary" disabled={availability === "future" || Boolean(busy)} onClick={() => void apply(`checkpoint-${week.week}`, async () => {
          const result = await evaluateRehearsalCheckpoint(household, { rehearsalId: rehearsal.id, week: week.week, memberId, today });
          await onApply(result.household, result.undo);
        })}>Run checkpoint</button>
        {week.checkpoint ? <details><summary>See why</summary>
          {week.checkpoint.reasons.map((reason) => <p key={reason} className="month-error">{reason}</p>)}
          <dl className="month-proof-grid">
            <div><dt>Assets</dt><dd>{formatCad(week.checkpoint.assetCents)}</dd></div><div><dt>Liabilities</dt><dd>{formatCad(week.checkpoint.liabilityCents)}</dd></div>
            <div><dt>Opening equity</dt><dd>{formatCad(week.checkpoint.openingEquityCents)}</dd></div><div><dt>Net income</dt><dd>{formatCad(week.checkpoint.netIncomeCents)}</dd></div>
            <div><dt>Debits</dt><dd>{formatCad(week.checkpoint.totalDebitCents)}</dd></div><div><dt>Credits</dt><dd>{formatCad(week.checkpoint.totalCreditCents)}</dd></div>
            <div><dt>Fund free</dt><dd>{formatCad(week.checkpoint.fundFreeCents)}</dd></div><div><dt>Fund due</dt><dd>{formatCad(week.checkpoint.fundDueCents)}</dd></div>
          </dl><p className="month-proof-code">Proof code {week.checkpoint.financialAuditHash}</p>
        </details> : null}
      </section>
      {week.checkpoint?.status === "tied" ? <section className="month-acknowledgements"><h3>Acknowledge on your own phone</h3><p>{actorName}, this records only your acknowledgement.</p>
        <button type="button" className="primary" disabled={acknowledgements.has(memberId) || Boolean(busy)} onClick={() => void apply(`ack-${week.week}`, async () => {
          const result = await acknowledgeRehearsalWeek(household, { rehearsalId: rehearsal.id, week: week.week, actorMemberId: memberId, memberId });
          await onApply(result.household, result.undo);
        })}>{acknowledgements.has(memberId) ? "You acknowledged" : "I reviewed this week"}</button>
        <p>{rehearsal.weeks[week.week - 1]!.acknowledgements.length}/2 acknowledged</p>
      </section> : null}
      {week.week === 4 && allWeeksTied ? <section className="month-approval"><h3>Use it next month?</h3>
        {memberId === rehearsal.biancaParticipantId ? <><blockquote>“{BIANCA_APPROVAL_STATEMENT}”</blockquote><button type="button" className="primary" disabled={Boolean(rehearsal.biancaApproval) || Boolean(busy)} onClick={() => void apply("bianca-approval", async () => {
          const result = await approveMonthRehearsal(household, { rehearsalId: rehearsal.id, actorMemberId: memberId, memberId, statement: BIANCA_APPROVAL_STATEMENT });
          await onApply(result.household, result.undo);
        })}>{rehearsal.biancaApproval ? "Bianca approved" : "Bianca: I agree"}</button></> : null}
        {memberId === rehearsal.jonathanPartnerId ? <><p>{JONATHAN_COUNTERSIGNATURE}</p><button type="button" className="primary" disabled={!rehearsal.biancaApproval || Boolean(rehearsal.jonathanCountersignature) || Boolean(busy)} onClick={() => void apply("jonathan-approval", async () => {
          const result = await approveMonthRehearsal(household, { rehearsalId: rehearsal.id, actorMemberId: memberId, memberId, statement: JONATHAN_COUNTERSIGNATURE });
          await onApply(result.household, result.undo);
        })}>{rehearsal.jonathanCountersignature ? "Jonathan countersigned" : "Jonathan: We reviewed it"}</button></> : null}
        <p>Approval archives this rehearsal only. It does not enable Production, providers, scaling, or launch.</p>
      </section> : null}
      <footer className="month-manage"><p>This export contains the clarity and friction notes shared between the two participants.</p><button type="button" className="secondary" onClick={() => report && downloadText(`our-month-${rehearsal.monthKey}.txt`, report.human, "text/plain")}>Download readable report</button><button type="button" className="secondary" onClick={() => report && downloadText(`our-month-${rehearsal.monthKey}.json`, report.json, "application/json")}>Download JSON</button><button type="button" className="secondary" onClick={() => void apply("replay", async () => {
        if (!globalThis.confirm("Replay this rehearsal from the beginning? Your money and books will not change.")) return;
        const archivedResult = archiveMonthRehearsal(household, { rehearsalId: rehearsal.id, memberId });
        const replay = startMonthRehearsal(archivedResult.household, { monthKey: rehearsal.monthKey, biancaParticipantId: rehearsal.biancaParticipantId, jonathanPartnerId: rehearsal.jonathanPartnerId, startedByMemberId: memberId });
        await onApply(replay.household, replay.undo);
      })}>Replay rehearsal</button><button type="button" className="text-button" onClick={() => void apply("archive", async () => {
        if (!globalThis.confirm("Archive this rehearsal? Your money and books will not change.")) return;
        const result = archiveMonthRehearsal(household, { rehearsalId: rehearsal.id, memberId });
        await onApply(result.household, result.undo);
      })}>Archive rehearsal</button><button type="button" className="text-button" aria-expanded={true} onClick={() => setExpanded(false)}>Collapse</button></footer>
    </> : null}
    {error ? <p className="month-error" role="alert">{error}</p> : null}
  </section>;
}
