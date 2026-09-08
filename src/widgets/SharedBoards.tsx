import { useEffect, useId, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Ask } from "../Ask.tsx";
import { ChalkboardBody } from "./ChalkboardDesk.tsx";
import { BoardPhotos } from "./BoardPhotos.tsx";
import {
  askBelongsOnDesk, formatCad, moveAskGoalClaimToNextMonth,
  removeBoardMilestone, removeBoardTask, saveBoardMilestone, saveBoardTask, shapeSharedBoards,
  type CommitResult, type Household, type LedgerView,
} from "../core/index.ts";
import type { BoardTask, BoardMilestone } from "../core/sharedBoards.ts";
import type { ScenarioSourceContext } from "../scenarioSourceContext.ts";
import "./SharedBoards.css";
import { sharedBoardScopeKey, readSharedBoardSelection, rememberSharedBoard, SHARED_BOARD_REQUEST_EVENT, type SharedBoard, type SharedBoardScope } from "../core/sharedBoardIntent.ts";
export { requestSharedBoard, sharedBoardScopeKey, SHARED_BOARD_EVENT, SHARED_BOARD_REQUEST_EVENT, type SharedBoard, type SharedBoardScope } from "../core/sharedBoardIntent.ts";
const pages: { id: SharedBoard; label: string; subtitle: string }[] = [
  { id: "notes", label: "Notes", subtitle: "A little room for what’s on your mind." },
  { id: "photos", label: "Photos", subtitle: "Three small windows into your life together." },
  { id: "tasks", label: "To-do", subtitle: "The little things, shared." },
  { id: "goals", label: "Goals", subtitle: "Things you’re looking forward to." },
  { id: "ask", label: "Shift Ask", subtitle: "A look at the shifts ahead." },
];
export type SharedBoardsProps = {
  household: Household; memberId: string; today: string; busy: boolean; view?: LedgerView;
  scenarioSource?: ScenarioSourceContext | null;
  onCommand: (fn: (current: Household) => CommitResult) => void; onOpenGoals: () => void;
};

// A scope change retires drafts; a page/theme change deliberately does not.
export function SharedBoards(props: SharedBoardsProps) {
  const scope = { environment: props.household.environment, householdId: props.household.householdId, memberId: props.memberId };
  const active = props.household.members.some(member => member.id === props.memberId && member.active);
  if (!active) return <p className="shared-boards-unavailable">These boards are available to active household members.</p>;
  return <SharedBoardsSession key={sharedBoardScopeKey(scope)} {...props} scope={scope} />;
}

// Only the frame and ordinary text start a swipe. Native input/drawing/scroll gestures own their events.
const interactive = 'button,a,input,textarea,select,canvas,summary,video,audio,[contenteditable]:not([contenteditable="false"]),[role=button],[role=slider],[role=textbox],[role=checkbox],[role=combobox],[role=radio],[role=switch],[role=link],[role=spinbutton],[role=scrollbar],[role=menuitem],[tabindex],[data-board-no-swipe]';
function canSwipe(target: EventTarget | null) {
  return target instanceof Element && !target.closest(interactive);
}
function SharedBoardsSession({ scope, household, memberId, today, busy, view = "household", scenarioSource, onCommand, onOpenGoals }: SharedBoardsProps & { scope: SharedBoardScope }) {
  const allowedAsk = askBelongsOnDesk(memberId, household.householdFund?.custodianMemberId);
  const available = pages;
  const [phone, setPhone] = useState(() => typeof window !== "undefined" && window.innerWidth < 720);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const width = window.matchMedia("(min-width: 720px)");
    const update = () => setPhone(!width.matches);
    update(); width.addEventListener("change", update);
    return () => width.removeEventListener("change", update);
  }, []);
  const storageKey = `hearth:shared-board:${sharedBoardScopeKey(scope)}`;
  const [selected, setSelected] = useState<SharedBoard>(() => {
    const saved = readSharedBoardSelection(scope); return available.find(page => page.id === saved)?.id ?? "notes";
  });
  const current = available.find(page => page.id === selected) ?? available[0]!;
  const uid = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const gesture = useRef<{ id: number; x: number; y: number } | null>(null);
  const touchGesture = useRef<{ id: number; x: number; y: number } | null>(null);
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  useEffect(() => { rememberSharedBoard(scope,current.id); }, [storageKey, current.id]);
  useEffect(() => {
    function receive(event: Event) {
      const detail = (event as CustomEvent<{ scope?: SharedBoardScope; board?: SharedBoard }>).detail;
      if (detail?.scope && sharedBoardScopeKey(detail.scope) === sharedBoardScopeKey(scope)
        && available.some(page => page.id === detail.board)) { setSelected(detail.board!); heading.current?.focus(); }
    }
    window.addEventListener(SHARED_BOARD_REQUEST_EVENT, receive);
    return () => window.removeEventListener(SHARED_BOARD_REQUEST_EVENT, receive);
  }, [storageKey, allowedAsk]);
  function change(step: number) {
    const index = available.findIndex(page => page.id === current.id);
    setSelected(available[(index + step + available.length) % available.length]!.id);
  }
  const command: SharedBoardsProps["onCommand"] = fn => onCommand(latest => {
    if (!live.current || latest.environment !== scope.environment || latest.householdId !== scope.householdId
      || !latest.members.some(member => member.id === memberId && member.active)) throw new Error("This household board is no longer open. Reopen it to make changes.");
    return fn(latest);
  });
  function pointerDown(event: PointerEvent<HTMLElement>) {
    if (!event.isPrimary || event.pointerType === "pen" || event.button !== 0 || !canSwipe(event.target)) { gesture.current = null; return; }
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }
  function pointerUp(event: PointerEvent<HTMLElement>) {
    const start = gesture.current; gesture.current = null;
    if (touchGesture.current || !start || start.id !== event.pointerId || !canSwipe(event.target)) return;
    const dx = event.clientX - start.x; const dy = event.clientY - start.y;
    if (Math.abs(dx) >= 60 && Math.abs(dx) > Math.abs(dy) * 1.8) change(dx < 0 ? 1 : -1);
  }
  const boards = shapeSharedBoards(household.kitchen.boards);
  const content: Record<SharedBoard, ReactNode> = {
    notes: <ChalkboardBody liveSurface typingAlternative household={household} memberId={memberId} busy={busy} onCommand={command} />,
    photos: <BoardPhotos household={household} memberId={memberId} busy={busy} onCommand={command} />,
    tasks: <BoardList kind="task" rows={boards.tasks} household={household} memberId={memberId} busy={busy} onCommand={command} />,
    goals: <><BoardList kind="milestone" rows={boards.milestones} household={household} memberId={memberId} busy={busy} onCommand={command} />
      <section className="shared-board-savings" aria-label="Shared savings goals"><h3>Saving together</h3>
        {household.goals.filter(goal => goal.shared && goal.status !== "retired").map(goal => <article key={goal.id} className="shared-board-goal">
          <h4>{goal.name}</h4><p>{formatCad(goal.savedCents)} saved <span>of {formatCad(goal.targetCents)}</span></p>
          <progress aria-label={`${goal.name} savings`} max={Math.max(1, goal.targetCents)} value={Math.min(goal.savedCents, Math.max(1, goal.targetCents))} />
          {(goal.arrivalDate || goal.deadline) && <p>Looking toward <time>{goal.arrivalDate || goal.deadline}</time></p>}
        </article>)}
        {!household.goals.some(goal => goal.shared && goal.status !== "retired") && <p>Your shared savings goals will find a home here.</p>}
        <button type="button" onClick={onOpenGoals}>Manage shared goals</button>
      </section></>,
    ask: allowedAsk ? <Ask presentation={phone ? "phone" : "desk"} viewerRoom={view} scenarioSource={scenarioSource} household={household} memberId={memberId} today={today} busy={busy}
      onMove={alternative => command(latest => {
        if (!askBelongsOnDesk(memberId, latest.householdFund?.custodianMemberId)) throw new Error("This reading is no longer available to this viewer.");
        return moveAskGoalClaimToNextMonth(latest, { today, memberId, goalId: alternative.goalId, recurrenceId: alternative.recurrenceId, claimDate: alternative.claimDate });
      })} /> : <p className="shared-board-empty">There isn’t a Shift Ask for your household role. This space only shows your own reading.</p>,
  };
  return <section className="shared-boards" aria-label="Shared household boards" aria-roledescription="carousel"
    onPointerDown={pointerDown} onPointerUp={pointerUp} onPointerCancel={() => { gesture.current = null; }}
    onTouchStart={event => {
      const touch = event.touches[0];
      touchGesture.current = event.touches.length === 1 && touch && canSwipe(event.target) ? { id: touch.identifier, x: touch.clientX, y: touch.clientY } : null;
    }} onTouchMove={event => { if (event.touches.length !== 1) touchGesture.current = null; }}
    onTouchCancel={() => { touchGesture.current = null; gesture.current = null; }}
    onTouchEnd={event => {
      const start = touchGesture.current; touchGesture.current = null; gesture.current = null;
      if (!start || event.touches.length || !canSwipe(event.target)) return;
      const touch = Array.from(event.changedTouches).find(touch => touch.identifier === start.id);
      if (!touch) return;
      const dx = touch.clientX - start.x; const dy = touch.clientY - start.y;
      if (Math.abs(dx) >= 60 && Math.abs(dx) > Math.abs(dy) * 1.8) change(dx < 0 ? 1 : -1);
    }}>
    <header className="shared-boards-heading"><span className="shared-boards-eyebrow">Our household</span>
      <h2 ref={heading} tabIndex={-1}>{current.label}</h2><p>{current.subtitle}</p>
      <span className="shared-boards-page" aria-live="polite" aria-atomic="true">{current.label} · {available.findIndex(page => page.id === current.id) + 1} / {available.length}</span>
    </header>
    <nav className="shared-boards-nav" aria-label="Choose a board">
      <button type="button" className="shared-boards-arrow" aria-label="Previous board" onClick={() => change(-1)}>←</button>
      <div className="shared-boards-selectors" role="tablist" aria-label="Household boards">{available.map((page, index) => <button key={page.id} id={`${uid}-tab-${page.id}`} type="button" role="tab" aria-selected={current.id === page.id} tabIndex={current.id === page.id ? 0 : -1} aria-controls={`${uid}-${page.id}`} onClick={() => setSelected(page.id)} onKeyDown={event => {
        const next = event.key === "ArrowRight" ? (index + 1) % available.length : event.key === "ArrowLeft" ? (index - 1 + available.length) % available.length : event.key === "Home" ? 0 : event.key === "End" ? available.length - 1 : null;
        if (next === null) return;
        event.preventDefault(); event.stopPropagation();
        const page = available[next]!; setSelected(page.id); document.getElementById(`${uid}-tab-${page.id}`)?.focus();
      }}>{page.label}</button>)}</div>
      <button type="button" className="shared-boards-arrow" aria-label="Next board" onClick={() => change(1)}>→</button>
    </nav>
    <div className="shared-boards-pages">{available.map(page => <div key={page.id} id={`${uid}-${page.id}`} className={`shared-board-page shared-board-page--${page.id}`} hidden={current.id !== page.id} role="tabpanel" aria-labelledby={`${uid}-tab-${page.id}`}>{content[page.id]}</div>)}</div>
    <footer className="shared-boards-footer">A place for the life around the books.</footer>
  </section>;
}

type ListRow = BoardTask | BoardMilestone;
type Editor = { id: string; title: string; assigneeId: string | null; dueDate: string | null; completed: boolean; expectedVersion: number };
function BoardList({ kind, rows, household, memberId, busy, onCommand }: {
  kind: "task" | "milestone"; rows: ListRow[]; household: Household; memberId: string; busy: boolean; onCommand: SharedBoardsProps["onCommand"];
}) {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [submitted, setSubmitted] = useState<Editor | null>(null);
  const [completedOpen, setCompletedOpen] = useState(false);
  const noun = kind === "task" ? "to-do" : "milestone";
  const original = editor ? rows.find(row => row.id === editor.id) : null;
  const stale = !!editor && editor.expectedVersion > 0 && (!original || original.version !== editor.expectedVersion);
  useEffect(() => {
    if (!submitted) return;
    const accepted = rows.find(row => row.id === submitted.id && row.version > submitted.expectedVersion && row.title === submitted.title.trim() && row.dueDate === submitted.dueDate && row.completed === submitted.completed && (kind !== "task" || (row as BoardTask).assigneeId === submitted.assigneeId));
    if (accepted) { setEditor(current => current === submitted ? null : current); setSubmitted(null); }
  }, [rows, submitted, kind]);
  function save(input: Editor) {
    setSubmitted(input);
    onCommand(current => kind === "task" ? saveBoardTask(current, { ...input, memberId }) : saveBoardMilestone(current, { ...input, memberId }));
  }
  function edit(row: ListRow) {
    setSubmitted(null);
    setEditor({ id: row.id, title: row.title, assigneeId: "assigneeId" in row ? row.assigneeId : null, dueDate: row.dueDate, completed: row.completed, expectedVersion: row.version });
  }
  function renderRow(row: ListRow) {
    return <li key={row.id} className={`shared-board-list-row${row.completed ? " is-complete" : ""}`}>
      <button type="button" className="shared-board-check" aria-label={`${row.completed ? "Reopen" : "Complete"} ${row.title}`} aria-pressed={row.completed} disabled={busy} onClick={() => {
        const input = { memberId, id: row.id, title: row.title, dueDate: row.dueDate, completed: !row.completed, expectedVersion: row.version };
        onCommand(current => kind === "task" ? saveBoardTask(current, { ...input, assigneeId: (row as BoardTask).assigneeId }) : saveBoardMilestone(current, input));
      }}>{row.completed ? "✓" : "○"}</button>
      <div className="shared-board-row-copy"><strong>{row.title}</strong><p>{"assigneeId" in row && row.assigneeId ? `${household.members.find(member => member.id === row.assigneeId)?.name ?? "Former member"} · ` : ""}{row.dueDate ? <time dateTime={row.dueDate}>{row.dueDate}</time> : "Whenever you’re ready"}</p></div>
      <div className="shared-board-row-actions"><button type="button" aria-label={`Edit ${row.title}`} disabled={busy} onClick={() => edit(row)}>Edit</button>
        <button type="button" aria-label={`Remove ${row.title}`} disabled={busy} onClick={() => {
          const input = { memberId, id: row.id, expectedVersion: row.version };
          onCommand(current => kind === "task" ? removeBoardTask(current, input) : removeBoardMilestone(current, input));
        }}>Remove</button></div>
    </li>;
  }
  return <section className="shared-board-list" aria-label={kind === "task" ? "Household to-do list" : "Household milestones"}>
    {kind === "milestone" && <h3>Little milestones</h3>}
    {!rows.some(row => !row.completed) && <p className="shared-board-empty">{kind === "task" ? "A clear little list. What shall we do next?" : "A birthday, a trip, a small victory. Give it a date to look forward to."}</p>}
    <ul>{rows.filter(row => !row.completed).map(renderRow)}</ul>
    <button type="button" className="shared-board-add" disabled={busy} onClick={() => { if (!editor) { setSubmitted(null); setEditor({ id: `${kind === "task" ? "BOARD-TASK-" : "BOARD-MILESTONE-"}${crypto.randomUUID()}`, title: "", assigneeId: null, dueDate: null, completed: false, expectedVersion: 0 }); } }}>Add {noun}</button>
    {editor && <form className="shared-board-editor" data-board-no-swipe onSubmit={event => { event.preventDefault(); if (!busy && !stale && editor.title.trim()) save(editor); }}>
      <h4>{editor.expectedVersion ? `Edit ${noun}` : `A new ${noun}`}</h4>
      <label>Title<input aria-label={`${noun} title`} value={editor.title} maxLength={160} required onChange={event => setEditor({ ...editor, title: event.target.value })} /></label>
      {kind === "task" && <label>Who’s taking it?<select value={editor.assigneeId ?? ""} onChange={event => setEditor({ ...editor, assigneeId: event.target.value || null })}><option value="">Anyone</option>{household.members.filter(member => member.active).map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>}
      <label>{kind === "task" ? "Due date (optional)" : "Date (optional)"}<input type="date" value={editor.dueDate ?? ""} onChange={event => setEditor({ ...editor, dueDate: event.target.value || null })} /></label>
      {stale && <p role="status">This {noun} changed elsewhere. Your draft is still here. Close it and choose Edit again to use the latest version.</p>}
      <div className="shared-board-actions"><button type="submit" disabled={busy || stale || !editor.title.trim()}>Save {noun}</button><button type="button" onClick={() => { setEditor(null); setSubmitted(null); }}>Cancel</button></div>
    </form>}
    {rows.some(row => row.completed) && <div className="shared-board-completed"><button type="button" aria-expanded={completedOpen} onClick={() => setCompletedOpen(!completedOpen)}>Completed ({rows.filter(row => row.completed).length}) {completedOpen ? "−" : "+"}</button><ul hidden={!completedOpen}>{rows.filter(row => row.completed).map(renderRow)}</ul></div>}
  </section>;
}
