import { useState } from "react";
import type { CommitResult, Household } from "./core/types.ts";
import type { DateKey } from "./core/calendar.ts";
import {
  FOUNDATION_CHAPTERS,
  addRitual,
  chapterReminder,
  closeChapter,
  chapterClosureRevision,
  pendingChapterClosure,
  reviewChapterClosure,
  closeChapterAtSitdown,
  completeMove,
  defaultNextChapter,
  movesForChapter,
  nextFoundationChapter,
  nextMove,
  offerMove,
  openChapter,
  openChapterFor,
  ourRhythm,
  ritualsForChapter,
  type ChapterOutcome,
  type RitualCue,
} from "./core/chapters.ts";
import { chapterLesson } from "./core/planLearning.ts";
import { ChapterAdoption, ChapterMoveActions, RitualCard, RitualTermsRead } from "./ChapterTaskControls.tsx";
import { sitdownBrief } from "./core/sitdownBrief.ts";
import { fundModelMode } from "./core/fundRules.ts";
import { monthKeyFromDateKey } from "./core/calendar.ts";

type Run = (fn: (current: Household) => CommitResult) => Promise<unknown>;

function commandAccepted(outcome: unknown): boolean {
  return Boolean(outcome && typeof outcome === "object" && "ok" in outcome && outcome.ok === true && "household" in outcome);
}

const CUE_LABEL: Record<RitualCue, string> = {
  payday: "After payday",
  "pre-rent": "Before rent",
  weekly: "Our weekly moment",
  sitdown: "At the Sitdown",
  "after-surprise": "After a surprise",
  custom: "A cue we choose",
};

function memberName(household: Household, id: string | null): string {
  return household.members.find((row) => row.id === id)?.name ?? "Either of us";
}

/** Visible mode label (Vision v2 §12): every Hercules or Sitdown surface says whose eyes it is for. */
export function ModeLabel({ mode }: { mode: "private" | "shared" }) {
  return (
    <p className={`mode-label mode-label--${mode}`} role="note">
      <span aria-hidden="true">{mode === "private" ? "◌" : "◉"}</span>
      {mode === "private" ? "Private preparation — only you see this." : "Shared with both of you."}
    </p>
  );
}

/**
 * The Chapter on Home: title expressed as meaning, the next Move, and a quiet
 * door deeper. Nothing here is a score.
 */
export function ChapterMoment({ household, memberId, today, onOpenPath, onOpenSetup, onCommand, busy }: {
  household: Household; memberId: string; today: DateKey; onOpenPath: () => void; onOpenSetup?: (destination: "charter" | "fund") => void; onCommand: Run; busy: boolean;
}) {
  const chapter = openChapterFor(household);
  const move = nextMove(household, memberId);
  const next = nextFoundationChapter(household);
  if (!chapter) {
    return (
      <section className="chapter-moment chapter-moment--empty" aria-label="This Chapter">
        <p className="kicker">This month</p>
        <h3>{next ? `Ready to begin: ${next.title}` : "Choose the next Chapter together"}</h3>
        <p>{next?.purpose ?? "The foundation is complete. Open a Chapter of your own, or deepen one you have already made your rhythm."}</p>
        <div className="chapter-actions">
          {next && <button type="button" className="primary" disabled={busy} onClick={() => void onCommand((current) => openChapter(current, { memberId, foundationId: next.id }))}>Open this Chapter</button>}
          <button type="button" onClick={onOpenPath}>See Our Path</button>
        </div>
      </section>
    );
  }
  const weeks = Math.max(1, Math.floor((Date.parse(`${today}T12:00:00Z`) - Date.parse(chapter.openedAt)) / (7 * 24 * 60 * 60 * 1000)) + 1);
  // D-273: a Chapter never closes by itself; once its month has ended we say so until the Sitdown closes it.
  const reminder = fundModelMode(household) === 2 ? chapterReminder(household, { today }) : null;
  return (
    <section className="chapter-moment" aria-label="This Chapter">
      <p className="kicker">{reminder ? `Still open · ${reminder.intendedMonth}` : `This month · week ${weeks}`}</p>
      <h3>{chapter.title}</h3>
      {reminder && <p className="chapter-reminder" role="status">{reminder.message}</p>}
      <p className="chapter-meaning">{chapter.meaning}</p>
      {move ? (
        <div className="next-move" aria-label="Our next Move">
          <p className="kicker">Our next Move</p>
          <p className="next-move__text">{move.text}</p>
          <p className="next-move__meta">
            {move.ownerMemberId ? `${memberName(household, move.ownerMemberId)} owns this` : "Either of us can take this"}
            {move.needsAcknowledgment ? " · needs both of us" : ""}
          </p>
          {chapter.foundationId === "see-our-shared-life" && move.text === FOUNDATION_CHAPTERS.find(row => row.id === "see-our-shared-life")?.firstMove && onOpenSetup && (
            <div className="chapter-setup" aria-label="Set up our shared life">
              <button type="button" onClick={() => onOpenSetup("charter")}><strong>{household.charter ? "Open the Charter" : "Create our Charter"}</strong><small>Read and sign your shared agreement</small><span aria-hidden="true">→</span></button>
              <button type="button" onClick={() => onOpenSetup("fund")}><strong>{household.householdFund ? "Open the Fund" : "Set up the Fund"}</strong><small>Choose who holds it and review setup</small><span aria-hidden="true">→</span></button>
            </div>
          )}
          <ChapterMoveActions household={household} memberId={memberId} move={move} onCommand={onCommand} busy={busy} />
        </div>
      ) : (
        <p className="next-move__meta">No Move is waiting. The Chapter is holding.</p>
      )}
      <button type="button" className="chapter-door" onClick={onOpenPath}>Open Our Path</button>
    </section>
  );
}

/**
 * The Chapter room inside Our Path: Lesson, Rituals with their cues and
 * holding evidence, Moves, Our Rhythm, and the foundation ahead.
 */
type ChapterRoomProps = {
  household: Household; memberId: string; today: DateKey; onCommand: Run; busy: boolean;
};
export function ChapterRoom(props: ChapterRoomProps) { return <ChapterRoomState key={JSON.stringify([props.household.environment, props.household.householdId, props.memberId, openChapterFor(props.household)?.id ?? "none"])} {...props} />; }
function ChapterRoomState({ household, memberId, today, onCommand, busy }: {
  household: Household; memberId: string; today: DateKey; onCommand: Run; busy: boolean;
}) {
  const chapter = openChapterFor(household);
  const rituals = chapter ? ritualsForChapter(household, chapter.id).filter(row => row.state !== "graduated") : [];
  const moves = chapter ? movesForChapter(household, chapter.id) : [];
  const rhythm = ourRhythm(household);
  const lesson = chapter ? chapterLesson(chapter.lessonId) : null;
  const [moveText, setMoveText] = useState("");
  const [ritualDraft, setRitualDraft] = useState<{ title: string; cue: RitualCue; doneDefinition: string; recoveryMove: string } | null>(null);
  const done = new Set((household.chapters ?? []).filter((row) => row.state !== "open").map((row) => row.foundationId));

  return (
    <div className="chapter-room">
      {chapter ? (
        <section className="card chapter-card" aria-label="The current Chapter">
          <p className="kicker">The current Chapter</p>
          <h3>{chapter.title}</h3>
          <p>{chapter.meaning}</p>
          {chapter.betterFeelsLike && <p className="chapter-better"><strong>Better will feel like:</strong> {chapter.betterFeelsLike}</p>}
          {lesson && (
            <details className="chapter-lesson">
              <summary>This month's Lesson · {lesson.title}</summary>
              <p>{lesson.explain}</p>
              <p><strong>Try it:</strong> {lesson.experiment}</p>
              <p><strong>Couple skill:</strong> {lesson.coupleSkill}</p>
              <p><a href={lesson.source} target="_blank" rel="noreferrer">Source</a> · reviewed {lesson.reviewedOn} · {lesson.jurisdiction}. Learning never blocks agreement.</p>
            </details>
          )}

          <h4>Rituals</h4>
          {rituals.length === 0 && <p className="muted">No Ritual yet. A Ritual is one small repeated action tied to a real moment.</p>}
          <ChapterAdoption household={household} memberId={memberId} onCommand={onCommand} busy={busy} chapterId={chapter.id} />
          <ul className="ritual-list">{rituals.map(ritual => <li key={ritual.id}><RitualCard household={household} memberId={memberId} ritual={ritual} today={today} onCommand={onCommand} busy={busy} /></li>)}</ul>
          {ritualDraft ? (
            <form className="ritual-form" onSubmit={(event) => { event.preventDefault(); void onCommand((current) => addRitual(current, { memberId, chapterId: chapter.id, ...ritualDraft })).then((outcome) => { if (commandAccepted(outcome)) setRitualDraft(null); }); }}>
              <label>The Ritual<input value={ritualDraft.title} onChange={(e) => setRitualDraft({ ...ritualDraft, title: e.target.value })} placeholder="Pre-rent readiness check" /></label>
              <label>Its cue<select value={ritualDraft.cue} onChange={(e) => setRitualDraft({ ...ritualDraft, cue: e.target.value as RitualCue })}>{(Object.keys(CUE_LABEL) as RitualCue[]).map((cue) => <option key={cue} value={cue}>{CUE_LABEL[cue]}</option>)}</select></label>
              <label>What done looks like<input value={ritualDraft.doneDefinition} onChange={(e) => setRitualDraft({ ...ritualDraft, doneDefinition: e.target.value })} /></label>
              <label>If we miss it<input value={ritualDraft.recoveryMove} onChange={(e) => setRitualDraft({ ...ritualDraft, recoveryMove: e.target.value })} placeholder="We do the two-minute version today." /></label>
              <div className="chapter-actions"><button type="submit" className="primary" disabled={busy || !ritualDraft.title.trim() || !ritualDraft.doneDefinition.trim()}>Add the Ritual</button><button type="button" onClick={() => setRitualDraft(null)}>Cancel</button></div>
            </form>
          ) : (
            <button type="button" onClick={() => setRitualDraft({ title: "", cue: "weekly", doneDefinition: "", recoveryMove: "" })}>Add a Ritual</button>
          )}

          <h4>Moves</h4>
          <ul className="move-list">
            {moves.filter((row) => row.state !== "declined").map((move) => (
              <li key={move.id} className={`move move--${move.state}`}>
                <span>{move.text}</span>
                <span className="muted"> · {move.state === "done" ? move.completedByMemberId ? `done by ${memberName(household, move.completedByMemberId)}` : "done earlier · author not recorded" : move.ownerMemberId ? memberName(household, move.ownerMemberId) : "either of us"}{move.needsAcknowledgment ? ` · acknowledged by ${move.acknowledgedByMemberIds.length} of ${household.members.filter((m) => m.active).length}` : ""}</span>
                <ChapterMoveActions household={household} memberId={memberId} move={move} onCommand={onCommand} busy={busy} />
              </li>
            ))}
          </ul>
          <form className="move-form" onSubmit={(event) => { event.preventDefault(); if (!moveText.trim()) return; void onCommand((current) => offerMove(current, { memberId, chapterId: chapter.id, text: moveText })).then((outcome) => { if (commandAccepted(outcome)) setMoveText(""); }); }}>
            <label>Offer a small Move<input value={moveText} onChange={(e) => setMoveText(e.target.value)} placeholder="Write what done means for the hydro bill" /></label>
            <button type="submit" disabled={busy || !moveText.trim()}>Offer</button>
          </form>
        </section>
      ) : (
        <section className="card chapter-card chapter-card--empty" aria-label="Begin a Chapter">
          <p className="kicker">No Chapter is open</p>
          <h3>A Chapter runs from one Sitdown to the next</h3>
          <p>Each teaches one useful layer and builds one primary habit. Open the next foundation Chapter, or one of your own.</p>
          <ul className="foundation-list">
            {FOUNDATION_CHAPTERS.map((row) => (
              <li key={row.id} className={done.has(row.id) ? "is-done" : ""}>
                <strong>{row.order}. {row.title}</strong> <span className="muted">{row.purpose}</span>
                {!done.has(row.id) && <button type="button" disabled={busy} onClick={() => void onCommand((current) => openChapter(current, { memberId, foundationId: row.id }))}>Open</button>}
                {done.has(row.id) && <span className="muted"> · part of our story</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card our-rhythm" aria-label="Our Rhythm">
        <p className="kicker">Our Rhythm</p>
        <h3>{rhythm.length ? "Habits holding quietly" : "Nothing has graduated yet"}</h3>
        {rhythm.length === 0 && <p className="muted">When a Ritual has held three times and you both choose it, it leaves the monthly foreground and lives here.</p>}
        <ul>
          {rhythm.map(ritual => <li key={ritual.id}><ChapterAdoption household={household} memberId={memberId} onCommand={onCommand} busy={busy} chapterId={ritual.chapterId} /><RitualCard household={household} memberId={memberId} ritual={ritual} today={today} onCommand={onCommand} busy={busy} /></li>)}
        </ul>
      </section>
    </div>
  );
}

/**
 * Closing a Chapter at the Sitdown: a month ends; it does not pass or fail.
 */
type ChapterCloseProps = {
  household: Household; memberId: string; today: DateKey; sitdownId?: string | null; onCommand: Run; busy: boolean;
};
export function ChapterClose(props: ChapterCloseProps) { return <ChapterCloseState key={JSON.stringify([props.household.environment, props.household.householdId, props.memberId, openChapterFor(props.household)?.id ?? "none"])} {...props} />; }
function ChapterCloseState({ household, memberId, today, sitdownId, onCommand, busy }: {
  household: Household; memberId: string; today: DateKey; sitdownId?: string | null; onCommand: Run; busy: boolean;
}) {
  const chapter = openChapterFor(household);
  const [carry, setCarry] = useState("");
  const [localReview, setLocalReview] = useState<ReturnType<typeof reviewChapterClosure> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const runClose = async (fn: (h: Household) => CommitResult) => { setError(null); try { await onCommand(fn); } catch (cause) { setError(cause instanceof Error ? cause.message : "This closure was not saved. Read its current review and try again."); } };
  const brief = sitdownBrief(household, { memberId, today });
  if (!chapter) {
    const next = nextFoundationChapter(household);
    return (
      <div className="chapter-close">
        <p>No Chapter is open to close.</p>
        {next && <button type="button" disabled={busy} onClick={() => void onCommand((current) => openChapter(current, { memberId, foundationId: next.id, sitdownId: sitdownId ?? undefined }))}>Open the next Chapter: {next.title}</button>}
      </div>
    );
  }
  const pending = pendingChapterClosure(chapter);
  // D-273 (with the money model release): the Sitdown closes this Chapter and opens the next for this month in one step.
  const sortedMonths = fundModelMode(household) === 2;
  const nextChoice = defaultNextChapter({ chapters: (household.chapters ?? []).map((row) => row.id === chapter.id ? { ...row, state: "closed" as const } : row) }, monthKeyFromDateKey(today));
  const outcomes: { outcome: ChapterOutcome; label: string; hint: string }[] = [
    { outcome: "established", label: "Established", hint: "The habit holds. It moves into Our Rhythm." },
    { outcome: "still-forming", label: "Still forming", hint: "Carry it forward only if we choose; change its size, cue, or owner." },
    { outcome: "life-changed", label: "Life changed", hint: "Close it honestly and begin a more relevant one." },
    { outcome: "closed", label: "Little changed", hint: "Reflect without theatre. The month still produced understanding." },
  ];
  return (
    <div className="chapter-close">
      <p className="kicker">Close the previous Chapter</p>
      <h4>{chapter.title}</h4>
      {sortedMonths && <p className="muted">Closing it opens {nextChoice.foundationId ? FOUNDATION_CHAPTERS.find((row) => row.id === nextChoice.foundationId)?.title : nextChoice.custom?.title} for {monthKeyFromDateKey(today)}.</p>}
      {brief.chapter && <p className="muted">Rituals held {brief.chapter.ritualsHeld} times · {brief.chapter.movesDone} Moves done · {brief.chapter.movesOpen} still open.</p>}
      <ChapterAdoption household={household} memberId={memberId} onCommand={onCommand} busy={busy} chapterId={chapter.id} />
      {pending && <section className="chapter-review" aria-label="Review Chapter closure"><h5>Choose this exact ending together</h5><p><strong>{pending.terms.outcome}</strong> · {pending.terms.carryForward || "No carry-forward note."}</p>{pending.terms.rituals.map(row => <details key={row.ritualId}><summary>{row.before.title} → {row.afterState}</summary><RitualTermsRead household={household} terms={row.before} /></details>)}{pending.terms.moves.length > 0 && <><p>These open Tasks will pause for both of you. Responsibility stays with their current owner.</p><ul>{pending.terms.moves.map(row => <li key={row.taskId}>{row.title} · {memberName(household, row.ownerMemberId)}</li>)}</ul></>}<p>Agreed by {pending.approvals.map(row => memberName(household, row.memberId)).join(" and ")}.</p>{pending.approvals.some(row => row.memberId === memberId) ? <p>Waiting for the other participant’s exact review.</p> : <button type="button" disabled={busy} onClick={() => void runClose(current => closeChapter(current, { memberId, chapterId: chapter.id, expectedRevision: chapterClosureRevision(chapter), outcome: pending.terms.outcome, carryForward: pending.terms.carryForward, sitdownId: pending.terms.sitdownId ?? undefined, proposalId: pending.id, digest: pending.digest }))}>I agree to close this Chapter</button>}</section>}
      <p>{pending ? "A new proposal replaces the pending review and asks both people again." : "Choose an ending to propose. The Chapter stays open until both people agree."}</p>
      {localReview && <section className="chapter-review" aria-label="Your closure review"><h5>Review before giving your agreement</h5><p><strong>{localReview.terms.outcome}</strong> · {localReview.terms.carryForward || "No carry-forward note."}</p>{localReview.terms.rituals.map(row => <details key={row.ritualId} open><summary>{row.before.title} → {row.afterState}</summary><RitualTermsRead household={household} terms={row.before} /></details>)}<p>{localReview.terms.moves.length ? "These open Tasks will pause for both of you, with responsibility unchanged." : "There are no open Move Tasks to pause."}</p><ul>{localReview.terms.moves.map(row => <li key={row.taskId}>{row.title} · {memberName(household, row.ownerMemberId)}</li>)}</ul><button type="button" disabled={busy} onClick={() => void runClose(current => closeChapter(current, { memberId, chapterId: chapter.id, expectedRevision: localReview.expectedRevision, outcome: localReview.terms.outcome, carryForward: localReview.terms.carryForward, sitdownId: localReview.terms.sitdownId ?? undefined, reviewDigest: localReview.reviewDigest })).then(() => setLocalReview(null))}>Propose and give my closure agreement</button><button type="button" onClick={() => setLocalReview(null)}>Keep choosing</button></section>}
      <label>What carries forward<input value={carry} onChange={(e) => setCarry(e.target.value)} placeholder="One sentence we will remember next month" /></label>
      <div className="chapter-outcomes">
        {outcomes.map((row) => (
          <button key={row.outcome} type="button" disabled={busy} onClick={() => { setError(null); try { setLocalReview(reviewChapterClosure(household, { chapterId: chapter.id, outcome: row.outcome, carryForward: carry, sitdownId: sitdownId ?? undefined })); } catch (cause) { setError(cause instanceof Error ? cause.message : "Review is unavailable."); } }}>
            <strong>Review: {row.label}</strong><small>{row.hint}</small>
          </button>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

/** The brief at the top of the Sitdown: what changed, what is settled, what needs both. */
export function SitdownBriefCard({ household, memberId, today }: { household: Household; memberId: string; today: DateKey }) {
  const brief = sitdownBrief(household, { memberId, today });
  return (
    <section className="sitdown-brief" aria-label="Sitdown brief">
      <ModeLabel mode="shared" />
      {brief.underPressure && <p className="sitdown-brief__pressure">This month is tighter. Protect one thing first; teaching can wait.</p>}
      <div className="sitdown-brief__cols">
        <div><h4>What changed</h4>{brief.changed.length ? <ul>{brief.changed.map((row) => <li key={row.id}>{row.text}</li>)}</ul> : <p className="muted">Nothing material changed.</p>}</div>
        <div><h4>Already settled</h4>{brief.settled.length ? <ul>{brief.settled.map((row) => <li key={row.id}>{row.text}</li>)}</ul> : <p className="muted">Nothing to report yet.</p>}</div>
        <div><h4>Needs both of us</h4>{brief.needsBoth.length ? <ul>{brief.needsBoth.map((row) => <li key={row.id}>{row.text}</li>)}</ul> : <p className="muted">Nothing is waiting on both of you.</p>}</div>
      </div>
    </section>
  );
}

/** Turn the decision into a Ritual (Sitdown step 6): the smallest repeatable action, its cue, an owner, done, and recovery. */
type RitualFormProps = { household: Household; memberId: string; onCommand: Run; busy: boolean };
export function RitualForm(props: RitualFormProps) { return <RitualFormState key={JSON.stringify([props.household.environment, props.household.householdId, props.memberId, openChapterFor(props.household)?.id ?? "none"])} {...props} />; }
function RitualFormState({ household, memberId, onCommand, busy }: { household: Household; memberId: string; onCommand: Run; busy: boolean }) {
  const chapter = openChapterFor(household);
  const [draft, setDraft] = useState<{ title: string; cue: RitualCue; cueNote: string; ownerMemberId: string; doneDefinition: string; recoveryMove: string }>({ title: "", cue: "weekly", cueNote: "", ownerMemberId: memberId, doneDefinition: "", recoveryMove: "" });
  const [saved, setSaved] = useState<string | null>(null);
  if (!chapter) return <p className="muted">Open a Chapter first; a Ritual belongs to the Chapter it advances.</p>;
  const active = household.members.filter((row) => row.active);
  return (
    <form className="ritual-form" onSubmit={(event) => { event.preventDefault(); void onCommand((current) => addRitual(current, { memberId, chapterId: chapter.id, ...draft })).then((outcome) => { if (!commandAccepted(outcome)) return; setSaved(draft.title); setDraft({ ...draft, title: "", doneDefinition: "", recoveryMove: "" }); }); }}>
      <label>The smallest repeatable action<input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Check the Fund the payday before rent" /></label>
      <label>Its real cue<select value={draft.cue} onChange={(e) => setDraft({ ...draft, cue: e.target.value as RitualCue })}>{(Object.keys(CUE_LABEL) as RitualCue[]).map((cue) => <option key={cue} value={cue}>{CUE_LABEL[cue]}</option>)}</select></label>
      <label>A detail about the cue<input value={draft.cueNote} onChange={(e) => setDraft({ ...draft, cueNote: e.target.value })} placeholder="The Friday before the first" /></label>
      <label>One owner<select value={draft.ownerMemberId} onChange={(e) => setDraft({ ...draft, ownerMemberId: e.target.value })}>{active.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      <label>What done looks like<input value={draft.doneDefinition} onChange={(e) => setDraft({ ...draft, doneDefinition: e.target.value })} /></label>
      <label>The recovery move if we miss it<input value={draft.recoveryMove} onChange={(e) => setDraft({ ...draft, recoveryMove: e.target.value })} /></label>
      <div className="chapter-actions"><button type="submit" className="primary" disabled={busy || !draft.title.trim() || !draft.doneDefinition.trim()}>Add this Ritual to the Chapter</button></div>
      {saved && <p className="muted">"{saved}" is proposed on Our Path for the other person’s review. The backup is {memberName(household, active.find((m) => m.id !== draft.ownerMemberId)?.id ?? null)}.</p>}
    </form>
  );
}
