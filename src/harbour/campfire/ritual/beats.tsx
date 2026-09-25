import { useId, useState, type ReactNode } from "react";
import { acknowledgeHouseholdPlan, appendPlanSitdownTurn, closeBooksMonth, formatCad } from "../../../core/index.ts";
import { formatDayLabel, formatMonthLabel, monthEndKey, monthStartKey, type DateKey } from "../../../core/calendar.ts";
import {
  acknowledgeRitualChange,
  chapterClosureRevision,
  chapterMonth,
  closeChapter,
  dismissWin,
  editRitual,
  keepWinAsMemory,
  movesForChapter,
  offerMove,
  openChapter,
  openChapterFor,
  pendingChapterClosure,
  pendingRitualReview,
  reviewChapterClosure,
  reviewChapterClosureAtSitdown,
  ritualAgreementRevision,
  ritualsForChapter,
  type ChapterOutcome,
  type Ritual,
} from "../../../core/chapters.ts";
import { fundModelMode } from "../../../core/fundRules.ts";
import { chapterLesson } from "../../../core/planLearning.ts";
import type { CommitResult, Household } from "../../../core/types.ts";
import type { Dashboard } from "../../../core/insights.ts";
import { ChapterAdoption, ChapterMoveActions, RitualCard } from "../../../ChapterTaskControls.tsx";
import { RitualForm } from "../../../ChapterPanel.tsx";
import { SitDownLeftover, SitDownLookBack } from "../../../SitDownGuide.tsx";
import {
  booksCloseState,
  campfireAllocationSlices,
  campfireChairs,
  campfireMonth,
  campfireSession,
  campfireSitdownId,
  canGiveSeal,
  keptPlanVersion,
  lookAhead,
  lookBack,
  nextChapterChoice,
  sealStatus,
  sealWords,
  settleRitualTerms,
} from "./model.ts";

export type Write = (fn: (current: Household) => CommitResult, message: string) => Promise<boolean>;
export type Relay = (fn: (current: Household) => CommitResult) => Promise<unknown>;
export type BeatProps = {
  household: Household;
  memberId: string;
  today: DateKey;
  busy: boolean;
  write: Write;
  relay: Relay;
  sitDown?: { dashboard: Dashboard; displayHousehold?: Household } | null;
  /** The sheet's one status line. */
  announce: (message: string) => void;
};

const nameOf = (household: Household, id: string | null | undefined) => household.members.find((row) => row.id === id)?.name ?? "Your partner";

/** A button that stays focusable while it cannot act, and says why on activation (A23). */
function HeldButton({ held, reason, onPress, children, className }: { held: boolean; reason: string | null; onPress: () => void; children: ReactNode; className?: string }) {
  const reasonId = useId();
  const [told, setTold] = useState(false);
  return (
    <>
      <button type="button" className={className} aria-disabled={held || undefined} aria-describedby={held && reason ? reasonId : undefined}
        onClick={() => { if (held) { setTold(true); return; } onPress(); }}>
        {children}
      </button>
      {held && reason && <span id={reasonId} className={`campfire-reason${told ? " is-told" : ""}`}>{reason}</span>}
    </>
  );
}

// ── Arrive ──────────────────────────────────────────────────────────────────

export function ArriveBeat({ household, memberId, today, busy, write, presentMemberIds }: BeatProps & { presentMemberIds?: readonly string[] }) {
  const chapter = openChapterFor(household);
  const month = campfireMonth(household, today);
  const session = campfireSession(household, month);
  const chairs = campfireChairs(household, memberId, today, session);
  const mine = chairs.find((chair) => chair.you);
  const live = new Set(presentMemberIds ?? []);
  return (
    <div className="campfire-beat__body">
      <ul className="campfire-chairs" aria-label="The two chairs">
        {chairs.map((chair) => (
          <li key={chair.memberId} className={`campfire-chair${chair.here ? " is-here" : ""}`}>
            <span className="campfire-chair__log" aria-hidden="true" />
            <strong>{chair.you ? "You" : chair.name}</strong>
            <span>{chair.here ? "sat down" : chair.you ? "not sat down yet" : `${chair.name} has not sat down yet`}{!chair.you && live.has(chair.memberId) ? " · on the island now" : ""}</span>
          </li>
        ))}
      </ul>
      {chapter ? (
        <dl className="campfire-facts">
          <dt>The Chapter</dt><dd>{chapter.title}</dd>
          <dt>Its month</dt><dd>{formatMonthLabel(chapterMonth(chapter))} · {formatDayLabel(monthStartKey(chapterMonth(chapter)))} to {formatDayLabel(monthEndKey(chapterMonth(chapter)))}</dd>
          <dt>Opened</dt><dd>{formatDayLabel(chapter.openedAt.slice(0, 10))} by {chapter.openedByMemberId === memberId ? "you" : nameOf(household, chapter.openedByMemberId)}</dd>
        </dl>
      ) : <p>No Chapter is open. The Seal opens the next one.</p>}
      {chapter && (() => {
        const lesson = chapterLesson(chapter.lessonId);
        return lesson ? (
          <details className="campfire-more">
            <summary>This month's Lesson · {lesson.title}</summary>
            <p>{lesson.explain}</p>
            <p><strong>Try it:</strong> {lesson.experiment}</p>
          </details>
        ) : null;
      })()}
      <p className="campfire-hercules">Hercules asks: what is one thing from this month you want to keep?</p>
      {mine && !mine.here && (
        <button type="button" className="campfire-primary" aria-disabled={busy || undefined} onClick={() => {
          if (busy) return;
          void write((current) => appendPlanSitdownTurn(current, {
            ...(session?.state === "active" ? { sessionId: session.id } : {}),
            sitDownSessionId: campfireSitdownId(month), monthKey: month, planDraftId: `PLAN-${month}`, memberId,
            text: `${nameOf(household, memberId)} sat down at the Campfire.`,
          }), "You sat down at the Campfire");
        }}>Take my chair</button>
      )}
    </div>
  );
}

// ── Look back ───────────────────────────────────────────────────────────────

export function LookBackBeat({ household, memberId, today, busy, write, sitDown }: BeatProps) {
  const back = lookBack(household, memberId, today);
  return (
    <div className="campfire-beat__body">
      <section aria-labelledby="campfire-cards-title">
        <h4 id="campfire-cards-title">{formatMonthLabel(back.month)}'s recipe cards</h4>
        {back.cards.length ? (
          <ul className="campfire-cards">
            {back.cards.map((card) => (
              <li key={card.id} className="campfire-card">
                <strong>{card.label}</strong>
                <span>{formatCad(card.intendedCents)} planned · {formatCad(card.actualCents)} so far · {card.status}</span>
                {card.gapCents > 0 && <span>{formatCad(card.gapCents)} short</span>}
              </li>
            ))}
          </ul>
        ) : <p>No household card was kept for {formatMonthLabel(back.month)}.</p>}
        {back.drift.length > 0 && (
          <ul className="campfire-drift" aria-label="What drifted">
            {back.drift.map((row) => <li key={row.id}>{row.explanation}</li>)}
          </ul>
        )}
      </section>
      <section aria-labelledby="campfire-rituals-back">
        <h4 id="campfire-rituals-back">Rituals this Chapter</h4>
        {back.rituals.length ? (
          <ul className="campfire-list">
            {back.rituals.map((ritual) => (
              <li key={ritual.id}><strong>{ritual.title}</strong> · {ritual.held ? `held ${ritual.held} ${ritual.held === 1 ? "time" : "times"}` : "not held yet · a gap costs nothing"}{ritual.readyToGraduate ? " · ready to graduate" : ""}</li>
            ))}
          </ul>
        ) : <p>No Ritual in this Chapter.</p>}
        <p>{back.moves.done} Moves done · {back.moves.open} still open.</p>
      </section>
      {back.wins.length > 0 && (
        <section aria-labelledby="campfire-wins">
          <h4 id="campfire-wins">Wins to keep or let fade</h4>
          <ul className="campfire-list">
            {back.wins.map((win) => (
              <li key={win.id}>
                <span>{win.title}</span>
                <span className="campfire-actions">
                  <button type="button" aria-disabled={busy || undefined} onClick={() => { if (!busy) void write((current) => keepWinAsMemory(current, { memberId, winId: win.id }), `Kept “${win.title}” as a memory`); }}>Keep it</button>
                  {win.keptByMemberIds.length === 0 && <button type="button" aria-disabled={busy || undefined} onClick={() => { if (!busy) void write((current) => dismissWin(current, { memberId, winId: win.id }), `Let “${win.title}” fade`); }}>Let it fade</button>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {sitDown && <SitDownLookBack household={household} displayHousehold={sitDown.displayHousehold} dashboard={sitDown.dashboard} memberId={memberId} today={today} />}
    </div>
  );
}

// ── Settle ──────────────────────────────────────────────────────────────────

function SettleRitual({ household, memberId, today, busy, write, relay, ritual }: BeatProps & { ritual: Ritual }) {
  const pending = pendingRitualReview(ritual);
  const proposedState = pending?.terms.state;
  const agreed = pending?.approvals.some((row) => row.memberId === memberId);
  const partner = pending?.audience.find((id) => !pending.approvals.some((row) => row.memberId === id) && id !== memberId);
  const act = (choice: "graduate" | "retire") => {
    if (busy) return;
    void write((current) => editRitual(current, { memberId, ritualId: ritual.id, expectedRevision: ritualAgreementRevision(ritual), terms: settleRitualTerms(ritual, choice) }),
      choice === "graduate" ? `Proposed graduating “${ritual.title}”` : `Proposed retiring “${ritual.title}”`);
  };
  return (
    <li className="campfire-settle-ritual">
      <strong>{ritual.title}</strong>
      <span>{ritual.heldOn.length ? `held ${ritual.heldOn.length} ${ritual.heldOn.length === 1 ? "time" : "times"}` : "not held yet"}</span>
      {pending && (proposedState === "graduated" || proposedState === "retired") ? (
        agreed ? <span>Proposed: {proposedState === "graduated" ? "graduate" : "retire"} · waiting for {nameOf(household, partner)}</span>
          : <button type="button" aria-disabled={busy || undefined} onClick={() => {
            if (busy) return;
            void write((current) => acknowledgeRitualChange(current, { memberId, ritualId: ritual.id, expectedRevision: ritualAgreementRevision(ritual), proposalId: pending.id, digest: pending.digest }),
              proposedState === "graduated" ? `Both agreed: “${ritual.title}” graduates` : `Both agreed: “${ritual.title}” retires`);
          }}>Agree to {proposedState === "graduated" ? "graduate" : "retire"} it</button>
      ) : ritual.state === "active" && !pending ? (
        <span className="campfire-actions">
          <button type="button" aria-disabled={busy || undefined} onClick={() => act("graduate")}>Propose graduating it</button>
          <button type="button" aria-disabled={busy || undefined} onClick={() => act("retire")}>Propose retiring it</button>
        </span>
      ) : null}
      <details className="campfire-more">
        <summary>This Ritual's terms and its days</summary>
        <RitualCard household={household} memberId={memberId} ritual={ritual} today={today} onCommand={relay} busy={busy} />
      </details>
    </li>
  );
}

export function SettleBeat(props: BeatProps) {
  const { household, memberId, today, busy, write, relay, sitDown } = props;
  const chapter = openChapterFor(household);
  const rituals = chapter ? ritualsForChapter(household, chapter.id).filter((row) => row.state === "active" || row.state === "paused") : [];
  const moves = chapter ? movesForChapter(household, chapter.id).filter((row) => row.state === "offered" || row.state === "accepted" || row.state === "paused") : [];
  const books = booksCloseState(household, memberId, today);
  return (
    <div className="campfire-beat__body">
      {chapter && <ChapterAdoption household={household} memberId={memberId} onCommand={relay} busy={busy} chapterId={chapter.id} />}
      <section aria-labelledby="campfire-settle-rituals">
        <h4 id="campfire-settle-rituals">Rituals: graduate or retire</h4>
        {rituals.length ? <ul className="campfire-list">{rituals.map((ritual) => <SettleRitual key={ritual.id} {...props} ritual={ritual} />)}</ul> : <p>No Ritual to settle.</p>}
      </section>
      <section aria-labelledby="campfire-settle-moves">
        <h4 id="campfire-settle-moves">Open Moves</h4>
        {moves.length ? (
          <ul className="campfire-list">
            {moves.map((move) => <li key={move.id}><strong>{move.text}</strong><ChapterMoveActions household={household} memberId={memberId} move={move} onCommand={relay} busy={busy} /></li>)}
          </ul>
        ) : <p>No open Move. Anything still open pauses at the Seal.</p>}
      </section>
      <section aria-labelledby="campfire-settle-books" className="campfire-books">
        <h4 id="campfire-settle-books">The books for {books.monthLabel}</h4>
        {books.closed ? <p>Books closed for {books.monthLabel}.</p> : (
          <>
            <p>Closing stops new posts dated in {books.monthLabel} until someone reopens it.</p>
            <HeldButton className="campfire-primary" held={busy || !books.closable} reason={books.reason ?? (busy ? "Saving…" : null)}
              onPress={() => void write((current) => closeBooksMonth(current, { monthKey: books.monthKey, createdBy: memberId }), `Books closed for ${books.monthLabel}`)}>
              Close the books for {books.monthLabel}
            </HeldButton>
          </>
        )}
      </section>
      {sitDown && (
        <SitDownLeftover household={household} displayHousehold={sitDown.displayHousehold} dashboard={sitDown.dashboard} memberId={memberId} today={today}
          busy={busy} onCommand={props.relay} onStatus={props.announce} initialSlices={campfireAllocationSlices(household, today)} />
      )}
    </div>
  );
}

// ── Look ahead ──────────────────────────────────────────────────────────────

export function LookAheadBeat({ household, memberId, today, busy, write, relay, onOpenTable }: BeatProps & { onOpenTable?: () => void }) {
  const ahead = lookAhead(household, memberId, today);
  const chapter = openChapterFor(household);
  const [moveText, setMoveText] = useState("");
  return (
    <div className="campfire-beat__body">
      <section aria-labelledby="campfire-wall">
        <h4 id="campfire-wall">{ahead.monthLabel}'s wall</h4>
        {ahead.waiting.map((card) => (
          <article key={card.version.id} className="campfire-card campfire-card--waiting">
            <strong>{formatMonthLabel(card.month)} · version {card.version.sequence}</strong>
            {card.rolls.length > 0 && <p>What rolls: {card.rolls.map((line) => `${line.labelSnapshot} ${formatCad(line.amountCents)}`).join(" · ")}</p>}
            {card.fresh.length > 0 && <p>What is new: {card.fresh.map((line) => `${line.labelSnapshot} ${formatCad(line.amountCents)}`).join(" · ")}</p>}
            {card.acknowledgedByYou
              ? <p>You acknowledged this card{card.waitingFor ? ` · it needs ${card.waitingFor}'s chair` : ""}.</p>
              : <button type="button" className="campfire-primary" aria-disabled={busy || undefined} onClick={() => {
                if (busy) return;
                void write((current) => acknowledgeHouseholdPlan(current, { planVersionId: card.version.id, expectedDigest: card.version.digest, memberId, createdBy: memberId }),
                  `You acknowledged ${formatMonthLabel(card.month)}'s card`);
              }}>Acknowledge {formatMonthLabel(card.month)}'s card</button>}
          </article>
        ))}
        {!ahead.waiting.length && (ahead.next
          ? <p>{ahead.monthLabel}'s card is agreed{ahead.next.state === "scheduled" ? " and starts on the 1st" : ""}.</p>
          : <p>No card for {ahead.monthLabel} yet.{onOpenTable ? "" : " Lay one at the table in the Kitchen."}</p>)}
        {!ahead.next && !ahead.waiting.length && onOpenTable && <button type="button" onClick={onOpenTable}>Lay a card at the table</button>}
      </section>
      <section aria-labelledby="campfire-agenda">
        <h4 id="campfire-agenda">Next steps we agreed</h4>
        {ahead.agenda.length ? (
          <ul className="campfire-list">
            {ahead.agenda.map((row) => <li key={row.id}><strong>{row.label}</strong> · {row.nextStep} · {row.who}{row.inPlanner ? " · in the Glasshouse" : ""}</li>)}
          </ul>
        ) : <p>No next step is written on a card yet.</p>}
      </section>
      {chapter && (
        <details className="campfire-more">
          <summary>Something new for this Chapter</summary>
          <RitualForm household={household} memberId={memberId} onCommand={relay} busy={busy} />
          <form className="move-form" onSubmit={(event) => {
            event.preventDefault();
            if (busy || !moveText.trim()) return;
            void write((current) => offerMove(current, { memberId, chapterId: chapter.id, text: moveText }), "Move offered").then((ok) => { if (ok) setMoveText(""); });
          }}>
            <label>Offer a small Move<input value={moveText} onChange={(event) => setMoveText(event.target.value)} /></label>
            <button type="submit" aria-disabled={busy || !moveText.trim() || undefined}>Offer</button>
          </form>
        </details>
      )}
    </div>
  );
}

// ── Seal ────────────────────────────────────────────────────────────────────

const OUTCOMES: { outcome: ChapterOutcome; label: string; hint: string }[] = [
  { outcome: "established", label: "Established", hint: "The habit holds; its Rituals graduate." },
  { outcome: "still-forming", label: "Still forming", hint: "Carry it forward as it is." },
  { outcome: "life-changed", label: "Life changed", hint: "Close it honestly; its Rituals retire." },
  { outcome: "closed", label: "Little changed", hint: "The month still taught us something." },
];

export function SealBeat({ household, memberId, today, busy, write, relay }: BeatProps) {
  const chapter = openChapterFor(household);
  const status = sealStatus(household, memberId);
  const month = campfireMonth(household, today);
  const session = campfireSession(household, month);
  const [outcome, setOutcome] = useState<ChapterOutcome>("still-forming");
  const [carry, setCarry] = useState("");
  const [review, setReview] = useState<ReturnType<typeof reviewChapterClosure> | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const legendId = useId();
  const pending = chapter ? pendingChapterClosure(chapter) : null;
  const sortedMonths = fundModelMode(household) === 2;
  const closingVersion = session?.state === "active" ? keptPlanVersion(household, session.monthKey) : null;

  const reviewSeal = () => {
    if (!chapter) return;
    setReviewError(null);
    try {
      const input = { memberId, today, chapterId: chapter.id, outcome, carryForward: carry, ...(session ? { sitdownId: session.id } : {}) };
      setReview(sortedMonths ? reviewChapterClosureAtSitdown(household, input) : reviewChapterClosure(household, input));
    } catch (cause) { setReviewError(cause instanceof Error ? cause.message : "The seal cannot be reviewed yet."); }
  };

  return (
    <div className="campfire-beat__body">
      <p className="campfire-seal-line">{sealWords(status)}</p>
      {status.kind === "alone" && <p>Both of you sit down to seal. One person alone never seals a Chapter.</p>}
      {chapter && <ChapterAdoption household={household} memberId={memberId} onCommand={relay} busy={busy} chapterId={chapter.id} />}

      {chapter && status.kind === "open" && (
        <>
          <fieldset className="campfire-outcomes">
            <legend id={legendId}>How did “{chapter.title}” end?</legend>
            {OUTCOMES.map((row) => (
              <label key={row.outcome} className="campfire-outcome">
                <input type="radio" name="campfire-outcome" checked={outcome === row.outcome} onChange={() => { setOutcome(row.outcome); setReview(null); }} />
                <span><strong>{row.label}</strong> · {row.hint}</span>
              </label>
            ))}
          </fieldset>
          <label>What carries forward<input value={carry} onChange={(event) => { setCarry(event.target.value); setReview(null); }} /></label>
          {!review && <button type="button" onClick={reviewSeal}>Read the seal together</button>}
          {reviewError && <p role="alert">{reviewError}</p>}
        </>
      )}

      {(review || pending) && chapter && (() => {
        const terms = (status.kind === "open" ? review?.terms : pending?.terms) ?? review?.terms;
        if (!terms) return null;
        return (
          <section className="campfire-digest" aria-label="The seal's exact terms">
            <p><strong>{OUTCOMES.find((row) => row.outcome === terms.outcome)?.label ?? terms.outcome}</strong> · {terms.carryForward || "No carry-forward note."}</p>
            {terms.rituals.length > 0 && <ul className="campfire-list">{terms.rituals.map((row) => <li key={row.ritualId}>{row.before.title} → {row.afterState}</li>)}</ul>}
            {terms.moves.length > 0 && <p>{terms.moves.length} open {terms.moves.length === 1 ? "Move pauses" : "Moves pause"} for both of you; responsibility stays.</p>}
            {terms.nextChapter && <p>Then the next Chapter opens for {formatMonthLabel(terms.nextChapter.month)}.</p>}
          </section>
        );
      })()}

      {chapter && canGiveSeal(status) && (status.kind === "needs-your-seal" || review) && (
        <button type="button" className="campfire-primary" aria-disabled={busy || undefined} onClick={() => {
          if (busy) return;
          if (status.kind === "needs-your-seal" && pending) {
            void write((current) => closeChapter(current, {
              memberId, chapterId: chapter.id, expectedRevision: chapterClosureRevision(chapter), outcome: pending.terms.outcome,
              carryForward: pending.terms.carryForward, ...(pending.terms.sitdownId ? { sitdownId: pending.terms.sitdownId } : {}),
              proposalId: pending.id, digest: pending.digest, ...(pending.terms.nextChapter ? { nextChapter: pending.terms.nextChapter } : {}),
            }), `Sealed by both of you · “${chapter.title}” is closed`);
          } else if (review) {
            const reviewed = review;
            void write((current) => closeChapter(current, {
              memberId, chapterId: chapter.id, expectedRevision: reviewed.expectedRevision, outcome: reviewed.terms.outcome,
              carryForward: reviewed.terms.carryForward, ...(reviewed.terms.sitdownId ? { sitdownId: reviewed.terms.sitdownId } : {}),
              reviewDigest: reviewed.reviewDigest, ...(reviewed.terms.nextChapter ? { nextChapter: reviewed.terms.nextChapter } : {}),
            }), "Your seal is given").then((ok) => { if (ok) setReview(null); });
          }
        }}>Give my seal</button>
      )}

      {status.kind === "no-chapter" && (() => {
        const next = nextChapterChoice(household, today);
        const title = next.foundationId ? status.next : next.custom?.title;
        return (
          <>
            <p>The bed is edged. The camp walks on.</p>
            <button type="button" className="campfire-primary" aria-disabled={busy || undefined} onClick={() => {
              if (busy) return;
              void write((current) => openChapter(current, { memberId, ...next, ...(session ? { sitdownId: session.id } : {}) }), `Opened the Chapter “${title ?? "for this month"}”`);
            }}>Open the next Chapter{title ? `: ${title}` : ""}</button>
          </>
        );
      })()}

      {session?.state === "active" && closingVersion && (closingVersion.state === "active" || closingVersion.state === "scheduled") && status.kind === "no-chapter" && (
        <button type="button" aria-disabled={busy || undefined} onClick={() => {
          if (busy) return;
          void write((current) => appendPlanSitdownTurn(current, {
            sessionId: session.id, expectedUpdatedAt: session.updatedAt, sitDownSessionId: session.sitDownSessionId, monthKey: session.monthKey,
            planDraftId: session.planDraftId, memberId, text: "We sealed this Chapter at the Campfire.",
            checkpoint: { stage: 4, close: true, planVersionId: closingVersion.id },
          }), "Our Sitdown notes are put away with the agreed Plan");
        }}>Put our Sitdown notes away</button>
      )}
    </div>
  );
}
