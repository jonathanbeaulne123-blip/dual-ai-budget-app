import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { KitchenCommand } from "../kitchenCommand.ts";
import { addDays, formatCad, formatDayLabel, formatMonthLabel, type Household, type LedgerView } from "../core/index.ts";
import { agenda, affordability, suggestedEvidence, type AgendaItem, type AgendaOwnership, type AgendaView, type Affordability } from "../core/agenda.ts";
import { parseTaskCapture } from "../core/taskCapture.ts";
import { saveTask, completeTask, reopenTask, acknowledgeTask, saveTaskList, adoptBoardTasks, taskIsFinancial, type Task, type TaskEvidence, type TaskInput, type TaskRepeat } from "../core/tasks.ts";
import { shapeSharedBoards } from "../core/sharedBoards.ts";
import "./planner.css";

/**
 * The planner (feedback row 9, D-245): a planner where tasks carry money and
 * the week tells you whether you can afford it.
 *
 * Trust rules kept here: the UI previews and calls named commands; a money
 * task has no checkbox — Record opens the ordinary Add flow (Final Confirm),
 * and evidence is attached from receipts already in the books; nothing here
 * posts, moves, or claims money that PGlite has not accepted.
 */
export type PlannerProps = {
  household: Household;
  memberId: string;
  view: LedgerView;
  today: string;
  busy: boolean;
  onCommand: KitchenCommand;
  /** Open Add (expense) prefilled from a money task. Ends at Final Confirm like every money verb. */
  onRecord: (task: Task) => void;
};
type Editor = TaskInput & { expectedAmount: string };
const VIEWS: { id: AgendaView | "lists"; label: string }[] = [
  { id: "today", label: "Today" }, { id: "week", label: "This week" }, { id: "anytime", label: "Anytime" }, { id: "logbook", label: "Logbook" }, { id: "lists", label: "Lists" },
];
const OWNERSHIP: { id: AgendaOwnership; label: string }[] = [{ id: "all", label: "All" }, { id: "mine", label: "Mine" }, { id: "theirs", label: "Theirs" }, { id: "ours", label: "Ours" }];
const REPEAT_LABEL: Record<TaskRepeat, string> = { none: "Once", daily: "Every day", weekly: "Every week", biweekly: "Every two weeks", monthly: "Every month", yearly: "Every year" };
const KIND_LABEL: Record<AgendaItem["kind"], string> = { task: "", bill: "Bill", "planned-cost": "Planned cost", appointment: "Appointment", shift: "Shift", event: "Event", goal: "Goal" };

function cents(value: string): number | null {
  const clean = value.replace(/[$,\s]/g, "");
  if (!clean) return null;
  if (!/^\d+(\.\d{0,2})?$/.test(clean)) return NaN;
  return Math.round(Number(clean) * 100);
}
function blankTask(view: LedgerView, memberId: string, today: string, listId: string | null): Editor {
  return { memberId, id: `TASK-${crypto.randomUUID()}`, expectedRevision: 0, expectedAmount: "", task: { visibility: view === "personal" ? "personal" : "household", title: "", notes: "", listId, parentId: null, doDate: today, dueDate: null, repeat: "none", cue: "none", assigneeId: null, backupId: null, chapterId: null, planReference: null, moneyLink: null, expectedAmountCents: null, deleted: false } };
}
function editorFor(task: Task, memberId: string): Editor {
  const { version, id, revision, createdBy, createdAt, updatedAt, acknowledgedBy, completedAt, completedBy, completionEvidence, ...rest } = task;
  void version; void createdBy; void createdAt; void updatedAt; void acknowledgedBy; void completedAt; void completedBy; void completionEvidence;
  return { memberId, id, expectedRevision: revision, expectedAmount: task.expectedAmountCents === null ? "" : (task.expectedAmountCents / 100).toFixed(2), task: rest };
}
const WEEKDAY = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", weekday: "long" });
function dayName(date: string, today: string): string {
  if (date === today) return "Today";
  if (date === addDays(today, 1)) return "Tomorrow";
  if (date > today && date <= addDays(today, 6)) return WEEKDAY.format(new Date(`${date}T00:00:00Z`));
  return formatDayLabel(date);
}
function moneyLine(item: AgendaItem, money: Affordability | null, today: string): { text: string; tone: "good" | "warn" | "quiet" } | null {
  if (!item.money || item.amountCents === null) return null;
  if (item.done) return { text: `${item.evidence ? "Paid" : "Done"} · ${formatCad(item.evidence?.amountCents ?? item.amountCents)}`, tone: "quiet" };
  if (item.amountCents < 0) return { text: `${formatCad(-item.amountCents)} expected`, tone: "quiet" };
  const line = money?.lines.get(item.key);
  if (!line || line.status === "none") return { text: formatCad(item.amountCents), tone: "quiet" };
  if (line.status === "covered") return { text: `${formatCad(item.amountCents)} · covered`, tone: "good" };
  if (line.status === "short-until-payday" && line.payday) return { text: `${formatCad(item.amountCents)} · ${formatCad(line.shortCents)} short until ${dayName(line.payday, today)}`, tone: "warn" };
  return { text: `${formatCad(item.amountCents)} · ${formatCad(line.shortCents)} short`, tone: "warn" };
}

export function Planner({ household, memberId, view, today, busy, onCommand, onRecord }: PlannerProps) {
  const active = household.members.some((member) => member.id === memberId && member.active);
  const [tab, setTab] = useState<AgendaView | "lists">("today");
  const [ownership, setOwnership] = useState<AgendaOwnership>("all");
  const [listFilter, setListFilter] = useState<string | null>(null);
  const [capture, setCapture] = useState("");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [attaching, setAttaching] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const members = household.members.filter((member) => member.active);
  const partner = members.find((member) => member.id !== memberId) ?? null;
  const lists = (household.taskLists ?? []).filter((list) => !list.deleted && (list.visibility === "household" ? view === "household" : list.createdBy === memberId && view === "personal"));
  const boardRows = shapeSharedBoards(household.kitchen.boards).tasks.filter((row) => !household.tombstones.some((t) => t.id === row.id));
  const agendaView: AgendaView = tab === "lists" ? "anytime" : tab;
  const plan = useMemo(() => agenda(household, agendaView, { memberId, view, today, ownership: view === "household" ? ownership : "all" }), [household, agendaView, memberId, view, today, ownership]);
  const money = useMemo(() => tab === "today" || tab === "week" ? affordability(household, plan.items, { memberId, view, today, from: plan.from, to: plan.to }) : null, [household, plan, tab, memberId, view, today]);
  const filtered = listFilter ? plan.items.filter((item) => item.task?.listId === listFilter) : plan.items;
  const parsed = useMemo(() => capture.trim() ? parseTaskCapture(capture, { today, household, memberId }) : null, [capture, household, today, memberId]);
  const openTasks = (household.tasks ?? []).filter((task) => !task.deleted && !task.completedAt && (view === "household" ? task.visibility === "household" : task.visibility === "personal" && task.createdBy === memberId));
  const coverage = view === "household" ? members.map((member) => ({ member, count: openTasks.filter((task) => task.assigneeId === member.id).length, alone: openTasks.filter((task) => task.assigneeId === member.id && !task.backupId).length })) : [];
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(""), 4000); return () => clearTimeout(t); }, [notice]);
  if (!active) return <main className="planner"><p className="planner__unavailable">The planner is available to active household members.</p></main>;

  // Copy follows the data outcome, never the intent: the notice appears only once the boundary accepted the write.
  function run(fn: (current: Household) => ReturnType<typeof saveTask>, done: string) {
    const result = onCommand(fn);
    void Promise.resolve(result).then((outcome) => {
      if (!outcome) return;
      if (outcome.ok) setNotice(done);
      else if (outcome.userMessage) setNotice(outcome.userMessage);
    }).catch(() => undefined);
    return result;
  }
  function submitCapture(event: FormEvent) {
    event.preventDefault();
    if (!parsed || !parsed.title.trim() || busy) return;
    const listId = parsed.listName ? lists.find((list) => list.name.toLowerCase() === parsed.listName!.toLowerCase())?.id ?? listFilter : listFilter;
    const visibility = view === "personal" ? "personal" : parsed.visibility;
    const input: TaskInput = { memberId, id: `TASK-${crypto.randomUUID()}`, expectedRevision: 0, task: { visibility, title: parsed.title, notes: "", listId, parentId: null, doDate: parsed.doDate, dueDate: parsed.dueDate, repeat: parsed.repeat, cue: parsed.cue, assigneeId: visibility === "personal" ? null : parsed.assigneeId, backupId: null, chapterId: null, planReference: null, moneyLink: null, expectedAmountCents: parsed.expectedAmountCents, deleted: false } };
    run((current) => saveTask(current, input), `Added “${parsed.title}”`);
    setCapture("");
  }
  function saveEditor(event: FormEvent) {
    event.preventDefault();
    if (!editor || busy) return;
    const amount = cents(editor.expectedAmount);
    if (Number.isNaN(amount)) { setNotice("Use a whole-cent amount like 140 or 140.50."); return; }
    const input: TaskInput = { memberId: editor.memberId, id: editor.id, expectedRevision: editor.expectedRevision, task: { ...editor.task, title: editor.task.title.trim(), expectedAmountCents: amount, assigneeId: editor.task.visibility === "personal" ? null : editor.task.assigneeId, backupId: editor.task.visibility === "personal" ? null : editor.task.backupId } };
    run((current) => saveTask(current, input), editor.expectedRevision ? "Saved" : "Added");
    setEditor(null);
  }
  function tick(item: AgendaItem) {
    const task = item.task!;
    if (task.completedAt) run((current) => reopenTask(current, { memberId, id: task.id, expectedRevision: task.revision }), "Reopened");
    else run((current) => completeTask(current, { memberId, id: task.id, expectedRevision: task.revision }), `Done: ${task.title}`);
  }
  function attach(task: Task, evidence: TaskEvidence) {
    run((current) => completeTask(current, { memberId, id: task.id, expectedRevision: task.revision, evidence }), `${task.title} · done with its receipt`);
    setAttaching(null);
  }

  function renderTask(item: AgendaItem) {
    const task = item.task!;
    const financial = taskIsFinancial(task);
    const line = moneyLine(item, money, today);
    const assignee = task.assigneeId ? members.find((member) => member.id === task.assigneeId) : null;
    const backup = task.backupId ? members.find((member) => member.id === task.backupId) : null;
    const waitingOnMe = !task.completedAt && (task.assigneeId === memberId || task.backupId === memberId) && !task.acknowledgedBy.includes(memberId);
    const unseenByThem = view === "household" && !task.completedAt && task.assigneeId && task.assigneeId !== memberId && !task.acknowledgedBy.includes(task.assigneeId);
    const derived = !task.completedAt && item.done && item.evidence;
    const suggestions = attaching === task.id ? suggestedEvidence(household, memberId, task, today) : [];
    return <li key={item.key} className={`planner-row planner-row--task${item.done ? " is-done" : ""}${item.overdue ? " is-overdue" : ""}${financial ? " is-money" : ""}`}>
      {financial
        ? <span className="planner-row__mark planner-row__mark--money" aria-hidden="true">{item.done ? "✓" : "$"}</span>
        : <button type="button" className="planner-row__check" aria-label={`${task.completedAt ? "Reopen" : "Complete"} ${task.title}`} aria-pressed={Boolean(task.completedAt)} disabled={busy} onClick={() => tick(item)}>{task.completedAt ? "✓" : ""}</button>}
      <div className="planner-row__copy">
        <strong>{task.title}</strong>
        <p className="planner-row__meta">
          {line && <span className={`planner-money planner-money--${line.tone}`}>{line.text}</span>}
          {item.dueDate && item.dueDate !== item.date && !item.done && <span>{item.dueDate < today ? "was due" : "due"} {dayName(item.dueDate, today)}</span>}
          {item.overdue && <span className="planner-overdue">from {dayName(item.date!, today)}</span>}
          {task.repeat !== "none" && <span>{REPEAT_LABEL[task.repeat].toLowerCase()}</span>}
          {task.cue === "after-payday" && <span>after payday</span>}
          {assignee && <span>{assignee.id === memberId ? "you" : assignee.name}{backup ? ` · ${backup.id === memberId ? "you know how too" : `${backup.name} knows how`}` : ""}</span>}
          {unseenByThem && assignee && <span className="planner-quiet">{assignee.name} hasn’t seen this yet</span>}
        </p>
        {task.notes && <p className="planner-row__notes">{task.notes}</p>}
        {attaching === task.id && <div className="planner-attach" role="group" aria-label={`Receipts for ${task.title}`}>
          <p>Pick the receipt that paid for this. The books already hold it; nothing is posted here.</p>
          {suggestions.length ? <ul>{suggestions.map((evidence) => <li key={evidence.kind === "transaction" ? evidence.transactionId : evidence.contributionId}><button type="button" disabled={busy} onClick={() => attach(task, evidence)}>{formatCad(evidence.amountCents)} · {formatDayLabel(evidence.date)} · {household.transactions.find((row) => evidence.kind === "transaction" && row.id === evidence.transactionId)?.note || "receipt"}</button></li>)}</ul> : <p className="planner-empty">No matching receipt yet. Record the payment first, then attach it here.</p>}
          <button type="button" className="planner-link" onClick={() => setAttaching(null)}>Not now</button>
        </div>}
      </div>
      <div className="planner-row__actions">
        {financial && !task.completedAt && !derived && <button type="button" disabled={busy} onClick={() => onRecord(task)}>Record</button>}
        {financial && !task.completedAt && !derived && <button type="button" disabled={busy} aria-expanded={attaching === task.id} onClick={() => setAttaching(attaching === task.id ? null : task.id)}>Attach receipt</button>}
        {derived && <button type="button" disabled={busy} onClick={() => attach(task, item.evidence!)}>Paid · keep it</button>}
        {waitingOnMe && <button type="button" className="planner-take" disabled={busy} onClick={() => run((current) => acknowledgeTask(current, { memberId, id: task.id, expectedRevision: task.revision }), "Taken")}>Taking it</button>}
        {task.completedAt && financial && <button type="button" disabled={busy} onClick={() => tick(item)}>Reopen</button>}
        <button type="button" disabled={busy} aria-label={`Edit ${task.title}`} onClick={() => { setAttaching(null); setEditor(editorFor(task, memberId)); }}>Edit</button>
      </div>
    </li>;
  }
  function renderBooksRow(item: AgendaItem) {
    const line = moneyLine(item, money, today);
    return <li key={item.key} className={`planner-row planner-row--${item.kind}${item.done ? " is-done" : ""}${item.overdue ? " is-overdue" : ""}`}>
      <span className="planner-row__mark" aria-hidden="true">{item.done ? "✓" : "·"}</span>
      <div className="planner-row__copy">
        <strong>{item.title}</strong>
        <p className="planner-row__meta"><span className="planner-kind">{item.kind === "bill" && (item.amountCents ?? 0) < 0 ? "Income" : KIND_LABEL[item.kind]}</span>{line && <span className={`planner-money planner-money--${line.tone}`}>{line.text}</span>}{item.kind === "appointment" && item.amountCents ? <span>usually {formatCad(item.amountCents)}</span> : null}{item.overdue && <span className="planner-overdue">from {dayName(item.date!, today)}</span>}</p>
      </div>
    </li>;
  }
  const renderItem = (item: AgendaItem) => item.kind === "task" ? renderTask(item) : renderBooksRow(item);

  return <main className="planner" data-planner-view={tab} aria-labelledby="planner-title">
    <header className="planner__head">
      <p className="kicker">{view === "household" ? "Our week" : "My week"}</p>
      <h1 id="planner-title">Planner</h1>
      <p className="planner__lede">Things to do, with what they cost. A tick is for the vet; money completes by its receipt.</p>
    </header>
    <form className="planner-capture" onSubmit={submitCapture}>
      <label htmlFor="planner-capture">Add something</label>
      <div className="planner-capture__row">
        <input id="planner-capture" value={capture} autoComplete="off" placeholder="pay hydro friday $140 · book the hotel by next friday $600 · bins out every week" onChange={(event) => setCapture(event.target.value)} />
        <button type="submit" disabled={busy || !parsed?.title.trim()}>Add</button>
      </div>
      {parsed && parsed.understood.length > 0 && <p className="planner-capture__understood" aria-live="polite">{parsed.title} · {parsed.understood.join(" · ")}</p>}
    </form>
    {boardRows.length > 0 && view === "household" && <div className="planner-adopt" role="status"><span>{boardRows.length} to-do{boardRows.length === 1 ? "" : "s"} on the Together board can live here.</span><button type="button" disabled={busy} onClick={() => run((current) => adoptBoardTasks(current, { memberId }), "The board to-dos are in the planner")}>Bring them in</button></div>}
    <nav className="planner-tabs" aria-label="Planner views">
      {VIEWS.map((entry) => <button key={entry.id} type="button" className={tab === entry.id ? "is-active" : ""} aria-current={tab === entry.id ? "page" : undefined} onClick={() => { setTab(entry.id); setAttaching(null); }}>{entry.label}</button>)}
    </nav>
    {view === "household" && tab !== "lists" && tab !== "logbook" && <div className="planner-ownership" role="group" aria-label="Whose">
      {OWNERSHIP.map((entry) => <button key={entry.id} type="button" className={ownership === entry.id ? "is-active" : ""} aria-pressed={ownership === entry.id} onClick={() => setOwnership(entry.id)}>{entry.label}</button>)}
    </div>}
    {listFilter && <p className="planner-filter">Showing <strong>{lists.find((list) => list.id === listFilter)?.name ?? "a list"}</strong> <button type="button" className="planner-link" onClick={() => setListFilter(null)}>Show everything</button></p>}
    {notice && <p className="planner-notice" role="status">{notice}</p>}

    {money && (tab === "week" || tab === "today") && <section className="planner-afford" aria-label="What this period can afford">
      <p><strong>{tab === "week" ? "This week" : "Today"}:</strong> {formatCad(money.plannedCents)} planned, {formatCad(money.availableCents)} available{money.nextPayday ? ` before ${dayName(money.nextPayday, today)}` : ""}{money.incomeCents > 0 ? `, ${formatCad(money.incomeCents)} expected in` : ""}.</p>
      <small>{money.source === "fund" ? "Available is the Fund’s free-to-spend." : "Available is cash in the accounts you can see."} Expected costs are plans, not postings.</small>
    </section>}

    {tab === "today" && <section className="planner-day" aria-label="Today">
      {filtered.length === 0 && <p className="planner-empty">Nothing on today. That is allowed.</p>}
      <ul className="planner-list">{filtered.map(renderItem)}</ul>
    </section>}
    {tab === "week" && <section className="planner-week" aria-label="This week">
      {plan.days.map((day) => <article key={day.date} className={`planner-day${day.date === today ? " is-today" : ""}`}>
        <h2>{dayName(day.date, today)} <small>{formatDayLabel(day.date)}</small></h2>
        {day.items.filter((item) => !listFilter || item.task?.listId === listFilter).length === 0 ? <p className="planner-empty">—</p> : <ul className="planner-list">{day.items.filter((item) => !listFilter || item.task?.listId === listFilter).map(renderItem)}</ul>}
      </article>)}
    </section>}
    {tab === "anytime" && <section aria-label="Anytime">
      <p className="planner__lede">Things with no date don’t nag. They wait where you put them.</p>
      {filtered.length === 0 && <p className="planner-empty">Nothing waiting.</p>}
      <ul className="planner-list">{filtered.map(renderItem)}</ul>
    </section>}
    {tab === "logbook" && <section aria-label="Logbook">
      {plan.months.length === 0 && <p className="planner-empty">Nothing handled yet. It will read well here when it is.</p>}
      {plan.months.map((month) => <article key={month.monthKey} className="planner-month">
        <h2>{month.monthKey === "undated" ? "Undated" : formatMonthLabel(month.monthKey)} <small>· {month.handled} thing{month.handled === 1 ? "" : "s"} handled{month.bills ? ` · ${month.bills} of them money, ${formatCad(month.billCents)}` : ""}</small></h2>
        <ul className="planner-list">{month.items.filter((item) => !listFilter || item.task?.listId === listFilter).map(renderItem)}</ul>
      </article>)}
    </section>}
    {tab === "lists" && <section aria-label="Lists" className="planner-lists">
      <ul>{lists.map((list) => <li key={list.id}><button type="button" className={listFilter === list.id ? "is-active" : ""} onClick={() => { setListFilter(list.id); setTab("anytime"); }}>{list.name} <small>{openTasks.filter((task) => task.listId === list.id).length} open</small></button><button type="button" className="planner-link" disabled={busy} aria-label={`Remove list ${list.name}`} onClick={() => run((current) => saveTaskList(current, { memberId, id: list.id, expectedRevision: list.revision, list: { name: list.name, visibility: list.visibility, deleted: true } }), "List removed; its tasks stay")}>Remove</button></li>)}</ul>
      <form className="planner-newlist" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const name = (form.elements.namedItem("name") as HTMLInputElement).value.trim(); if (!name || busy) return; run((current) => saveTaskList(current, { memberId, id: `LIST-${crypto.randomUUID()}`, expectedRevision: 0, list: { name, visibility: view === "personal" ? "personal" : "household", deleted: false } }), `List “${name}” added`); form.reset(); }}>
        <label>New list<input name="name" maxLength={80} placeholder="Wedding, Japan, House" /></label><button type="submit" disabled={busy}>Add list</button>
      </form>
      {coverage.length > 0 && <div className="planner-coverage"><h2>Who’s carrying what</h2><ul>{coverage.map((row) => <li key={row.member.id}><strong>{row.member.id === memberId ? "You" : row.member.name}</strong> · {row.count} open{row.alone ? ` · ${row.alone} only in ${row.member.id === memberId ? "your" : "their"} head` : " · every one has a backup"}</li>)}</ul><small>Is anything only in one person’s head? A backup owner is who else knows how.</small></div>}
    </section>}

    <div className="planner-add"><button type="button" disabled={busy} onClick={() => setEditor(blankTask(view, memberId, today, listFilter))}>New task with details</button></div>

    {editor && <form className="planner-editor" onSubmit={saveEditor} aria-label={editor.expectedRevision ? "Edit task" : "New task"}>
      <h2>{editor.expectedRevision ? "Edit task" : "New task"}</h2>
      <label>Title<input value={editor.task.title} maxLength={240} required autoFocus onChange={(event) => setEditor({ ...editor, task: { ...editor.task, title: event.target.value } })} /></label>
      <div className="planner-editor__pair">
        <label>Do on<input type="date" value={editor.task.doDate ?? ""} onChange={(event) => setEditor({ ...editor, task: { ...editor.task, doDate: event.target.value || null } })} /></label>
        <label>Deadline<input type="date" value={editor.task.dueDate ?? ""} onChange={(event) => setEditor({ ...editor, task: { ...editor.task, dueDate: event.target.value || null } })} /></label>
      </div>
      <div className="planner-editor__pair">
        <label>Expected cost<input inputMode="decimal" value={editor.expectedAmount} placeholder="0.00" onChange={(event) => setEditor({ ...editor, expectedAmount: event.target.value })} /></label>
        <label>Repeats<select value={editor.task.repeat} onChange={(event) => setEditor({ ...editor, task: { ...editor.task, repeat: event.target.value as TaskRepeat } })}>{(Object.keys(REPEAT_LABEL) as TaskRepeat[]).map((key) => <option key={key} value={key}>{REPEAT_LABEL[key]}</option>)}</select></label>
      </div>
      <label className="planner-editor__check"><input type="checkbox" checked={editor.task.cue === "after-payday"} onChange={(event) => setEditor({ ...editor, task: { ...editor.task, cue: event.target.checked ? "after-payday" : "none" } })} /> After payday</label>
      {editor.task.visibility === "household" && <div className="planner-editor__pair">
        <label>Who’s taking it<select value={editor.task.assigneeId ?? ""} onChange={(event) => setEditor({ ...editor, task: { ...editor.task, assigneeId: event.target.value || null } })}><option value="">Anyone</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
        <label>Who else knows how<select value={editor.task.backupId ?? ""} onChange={(event) => setEditor({ ...editor, task: { ...editor.task, backupId: event.target.value || null } })}><option value="">Nobody yet</option>{members.filter((member) => member.id !== editor.task.assigneeId).map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
      </div>}
      {lists.length > 0 && <label>List<select value={editor.task.listId ?? ""} onChange={(event) => setEditor({ ...editor, task: { ...editor.task, listId: event.target.value || null } })}><option value="">No list</option>{lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}</select></label>}
      <label>Notes<textarea value={editor.task.notes} maxLength={2000} rows={2} onChange={(event) => setEditor({ ...editor, task: { ...editor.task, notes: event.target.value } })} /></label>
      {editor.expectedRevision === 0 && view === "household" && <label className="planner-editor__check"><input type="checkbox" checked={editor.task.visibility === "personal"} onChange={(event) => setEditor({ ...editor, task: { ...editor.task, visibility: event.target.checked ? "personal" : "household", assigneeId: null, backupId: null } })} /> Just for me{partner ? ` (${partner.name} won’t see it)` : ""}</label>}
      {editor.task.visibility === "personal" && editor.expectedRevision > 0 && <p className="planner-quiet">Private to you.</p>}
      <div className="planner-editor__actions">
        <button type="submit" disabled={busy || !editor.task.title.trim()}>{editor.expectedRevision ? "Save" : "Add task"}</button>
        <button type="button" onClick={() => setEditor(null)}>Cancel</button>
        {editor.expectedRevision > 0 && <button type="button" className="planner-danger" disabled={busy} onClick={() => { const input: TaskInput = { ...editor, task: { ...editor.task, deleted: true, expectedAmountCents: cents(editor.expectedAmount) || null } }; run((current) => saveTask(current, input), "Removed"); setEditor(null); }}>Remove</button>}
      </div>
    </form>}
  </main>;
}
