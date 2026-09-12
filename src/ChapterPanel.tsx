import { useState } from "react";
import type { CommitResult, Household } from "./core/types.ts";
import type { DateKey } from "./core/calendar.ts";
import {
  FOUNDATION_CHAPTERS,
  addRitual,
  closeChapter,
  completeMove,
  movesForChapter,
  nextFoundationChapter,
  nextMove,
  offerMove,
  openChapter,
  openChapterFor,
  ourRhythm,
  recordRitualHeld,
  respondToMove,
  ritualReadyToGraduate,
  ritualsForChapter,
  setRitualState,
  type ChapterOutcome,
  type RitualCue,
} from "./core/chapters.ts";
import { chapterLesson } from "./core/planLearning.ts";
import { sitdownBrief } from "./core/sitdownBrief.ts";

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
export function ChapterMoment({ household, memberId, today, onOpenPath, onCommand, busy }: {
  household: Household; memberId: string; today: DateKey; onOpenPath: () => void; onCommand: Run; busy: boolean;
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
  return (
    <section className="chapter-moment" aria-label="This Chapter">
      <p className="kicker">This month · week {weeks}</p>
      <h3>{chapter.title}</h3>
      <p className="chapter-meaning">{chapter.meaning}</p>
      {move ? (
        <div className="next-move" aria-label="Our next Move">
          <p className="kicker">Our next Move</p>
          <p className="next-move__text">{move.text}</p>
          <p className="next-move__meta">
            {move.ownerMemberId ? `${memberName(household, move.ownerMemberId)} owns this` : "Either of us can take this"}
            {move.needsAcknowledgment ? " · needs both of us" : ""}
          </p>
          <div className="chapter-actions">
            {move.needsAcknowledgment && !move.acknowledgedByMemberIds.includes(memberId) && (
              <button type="button" disabled={busy} onClick={() => void onCommand((current) => respondToMove(current, { memberId, moveId: move.id, response: "acknowledge" }))}>I acknowledge this</button>
            )}
            <button type="button" className="primary" disabled={busy} onClick={() => void onCommand((current) => completeMove(current, { memberId, moveId: move.id }))}>Done</button>
            <button type="button" disabled={busy} onClick={() => void onCommand((current) => respondToMove(current, { memberId, moveId: move.id, response: "pause" }))}>Not now</button>
          </div>
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
export function ChapterRoom({ household, memberId, today, onCommand, busy }: {
  household: Household; memberId: string; today: DateKey; onCommand: Run; busy: boolean;
}) {
  const chapter = openChapterFor(household);
  const rituals = chapter ? ritualsForChapter(household, chapter.id) : [];
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
          <ul className="ritual-list">
            {rituals.map((ritual) => (
              <li key={ritual.id} className={`ritual ritual--${ritual.state}`}>
                <div>
                  <strong>{ritual.title}</strong>
                  <p className="muted">{CUE_LABEL[ritual.cue]}{ritual.cueNote ? ` · ${ritual.cueNote}` : ""} · {memberName(household, ritual.ownerMemberId)} owns it{ritual.backupMemberId ? `, ${memberName(household, ritual.backupMemberId)} knows where the record lives` : ""}</p>
                  <p><strong>Done means:</strong> {ritual.doneDefinition}</p>
                  {ritual.recoveryMove && <p><strong>If we miss it:</strong> {ritual.recoveryMove}</p>}
                  <p className="muted">Held {ritual.heldOn.length} {ritual.heldOn.length === 1 ? "time" : "times"}{ritual.heldOn.length ? ` · last ${ritual.heldOn[ritual.heldOn.length - 1]}` : ""}. A gap costs nothing.</p>
                </div>
                <div className="chapter-actions">
                  {ritual.state === "active" && <button type="button" disabled={busy} onClick={() => void onCommand((current) => recordRitualHeld(current, { memberId, ritualId: ritual.id, onDate: today }))}>It held today</button>}
                  {ritualReadyToGraduate(ritual) && <button type="button" disabled={busy} onClick={() => void onCommand((current) => setRitualState(current, { memberId, ritualId: ritual.id, state: "graduated" }))}>Move into Our Rhythm</button>}
                  {ritual.state === "active" && <button type="button" disabled={busy} onClick={() => void onCommand((current) => setRitualState(current, { memberId, ritualId: ritual.id, state: "paused" }))}>Pause</button>}
                  {ritual.state === "paused" && <button type="button" disabled={busy} onClick={() => void onCommand((current) => setRitualState(current, { memberId, ritualId: ritual.id, state: "active" }))}>Resume</button>}
                </div>
              </li>
            ))}
          </ul>
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
                <span className="muted"> · {move.state === "done" ? `done by ${memberName(household, move.completedByMemberId)}` : move.ownerMemberId ? memberName(household, move.ownerMemberId) : "either of us"}{move.needsAcknowledgment ? ` · acknowledged by ${move.acknowledgedByMemberIds.length} of ${household.members.filter((m) => m.active).length}` : ""}</span>
                {(move.state === "offered" || move.state === "accepted") && (
                  <span className="chapter-actions">
                    {move.needsAcknowledgment && !move.acknowledgedByMemberIds.includes(memberId) && <button type="button" disabled={busy} onClick={() => void onCommand((current) => respondToMove(current, { memberId, moveId: move.id, response: "acknowledge" }))}>Acknowledge</button>}
                    <button type="button" disabled={busy} onClick={() => void onCommand((current) => completeMove(current, { memberId, moveId: move.id }))}>Done</button>
                  </span>
                )}
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
          {rhythm.map((ritual) => <li key={ritual.id}><strong>{ritual.title}</strong> <span className="muted">· {CUE_LABEL[ritual.cue]} · held {ritual.heldOn.length} times</span> <button type="button" disabled={busy} onClick={() => void onCommand((current) => recordRitualHeld(current, { memberId, ritualId: ritual.id, onDate: today }))}>Held today</button></li>)}
        </ul>
      </section>
    </div>
  );
}

/**
 * Closing a Chapter at the Sitdown: a month ends; it does not pass or fail.
 */
export function ChapterClose({ household, memberId, today, sitdownId, onCommand, busy }: {
  household: Household; memberId: string; today: DateKey; sitdownId?: string | null; onCommand: Run; busy: boolean;
}) {
  const chapter = openChapterFor(household);
  const [carry, setCarry] = useState("");
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
      {brief.chapter && <p className="muted">Rituals held {brief.chapter.ritualsHeld} times · {brief.chapter.movesDone} Moves done · {brief.chapter.movesOpen} still open.</p>}
      <label>What carries forward<input value={carry} onChange={(e) => setCarry(e.target.value)} placeholder="One sentence we will remember next month" /></label>
      <div className="chapter-outcomes">
        {outcomes.map((row) => (
          <button key={row.outcome} type="button" disabled={busy} onClick={() => void onCommand((current) => closeChapter(current, { memberId, chapterId: chapter.id, outcome: row.outcome, carryForward: carry, sitdownId: sitdownId ?? undefined }))}>
            <strong>{row.label}</strong><small>{row.hint}</small>
          </button>
        ))}
      </div>
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
export function RitualForm({ household, memberId, onCommand, busy }: { household: Household; memberId: string; onCommand: Run; busy: boolean }) {
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
      {saved && <p className="muted">"{saved}" is on Our Path. The backup is {memberName(household, active.find((m) => m.id !== draft.ownerMemberId)?.id ?? null)}.</p>}
    </form>
  );
}
