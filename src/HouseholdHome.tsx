import type { ReactNode } from "react";
import type { CommitResult, Household } from "./core/types.ts";
import type { DateKey } from "./core/calendar.ts";
import { monthKeyFromDateKey } from "./core/calendar.ts";
import { formatCad } from "./core/money.ts";
import { monthObligations } from "./core/monthObligations.ts";
import { duePotentialExpenses, potentialExpensesForView } from "./core/potentialExpenses.ts";
import { kittyBankBackingStep, kittyBanksInView } from "./core/kittyBanks.ts";
import { deriveFundPulseInput, fundPulse, presenceLines, type FundPulseFreshness } from "./core/fundPulse.ts";
import { dismissWin, keepWinAsMemory, openChapterFor, recentWin } from "./core/chapters.ts";
import { fundDisplayName } from "./core/spaceNames.ts";
import { ChapterMoment } from "./ChapterPanel.tsx";
import "./household-home.css";

type Run = (fn: (current: Household) => CommitResult) => Promise<unknown>;

/**
 * Our Home (Vision v2 §4.2): the opening composition of the household space.
 *
 * Identity · the Chapter moment · the Fund pulse · one next Move · coming up ·
 * what is growing · partner presence · a recent Win only when earned · quiet
 * doors deeper. No register, no seals, no duplicate balances, no scoreboard.
 * Everything here reads accepted books and posts nothing.
 */
export function HouseholdHome({ household, memberId, today, freshness, busy, onCommand, onGo, rehearsal, identityArt }: {
  household: Household;
  memberId: string;
  today: DateKey;
  freshness: FundPulseFreshness;
  busy: boolean;
  onCommand: Run;
  onGo: (tab: "ledger" | "plan" | "together" | "calendar" | "more") => void;
  /** Chapter 1 is the Month-One rehearsal; its access stays inside the Chapter area. */
  rehearsal?: ReactNode;
  identityArt?: ReactNode;
}) {
  const monthKey = monthKeyFromDateKey(today);
  const chapter = openChapterFor(household);
  const pulse = fundPulse(deriveFundPulseInput(household, { memberId, today, freshness, activeChapter: Boolean(chapter) }));
  const presence = presenceLines(household, { memberId, today });
  const obligations = monthObligations(household, monthKey, today).rows.filter((row) => row.date >= today).slice(0, 3);
  const planned = duePotentialExpenses(potentialExpensesForView(household.potentialExpenses, memberId, "household"), today).slice(0, 2);
  const banks = kittyBanksInView(household, "household", memberId).slice(0, 2);
  const win = recentWin(household);
  const activeMemberIds = household.members.filter((row) => row.active).map((row) => row.id);
  const memoryComplete = Boolean(win && activeMemberIds.every((id) => win.keptByMemberIds.includes(id)));
  const memberKeptMemory = Boolean(win?.keptByMemberIds.includes(memberId));
  const fundName = fundDisplayName(household);
  const destinationTab = pulse.destination === "fund" ? "ledger" : pulse.destination === "path" ? "plan" : pulse.destination === "together" ? "together" : "more";

  return (
    <div className="household-home" data-pulse={pulse.state}>
      <header className="home-identity">
        {identityArt}
        <p className="kicker">Our Home</p>
        <h1>{household.name}</h1>
      </header>

      <section className={`fund-pulse fund-pulse--${pulse.state}`} aria-label="The Fund pulse">
        <button type="button" className="fund-pulse__button" onClick={() => onGo(destinationTab)}>
          <span className="fund-pulse__glyph" aria-hidden="true">{pulse.glyph}</span>
          <span className="fund-pulse__text">
            <strong>{pulse.headline}</strong>
            <span>{pulse.detail}</span>
            {pulse.amountCents !== null && <span className="fund-pulse__amount">{formatCad(pulse.amountCents)} is the amount this is about.</span>}
          </span>
        </button>
        <p className="fund-pulse__source">About {fundName}'s plan — never about the two of you.</p>
      </section>

      <ChapterMoment household={household} memberId={memberId} today={today} onOpenPath={() => onGo("plan")} onCommand={onCommand} busy={busy} />
      {rehearsal}

      {(obligations.length > 0 || planned.length > 0) && (
        <section className="home-coming-up" aria-label="Coming up">
          <p className="kicker">Coming up</p>
          <ul>
            {obligations.map((row) => <li key={row.id}><span>{row.label}</span><span className="muted">{row.date}</span><span className="home-amount">{formatCad(row.amountCents)}</span></li>)}
            {planned.map((row) => <li key={row.id} className="is-planned"><span>{row.title}</span><span className="muted">{row.date} · planned, not posted</span><span className="home-amount">{formatCad(row.expectedAmountCents)}</span></li>)}
          </ul>
          <button type="button" className="home-door" onClick={() => onGo("calendar")}>All dates and bills</button>
        </section>
      )}

      {banks.length > 0 && (
        <section className="home-growing" aria-label="What is growing">
          <p className="kicker">What we are building</p>
          <ul>
            {banks.map((goal) => {
              const step = kittyBankBackingStep(household, goal, today);
              return (
                <li key={goal.id}>
                  <span>{goal.name}</span>
                  <span className="growing-steps" role="img" aria-label={`${step} of 10 steps backed`}>{Array.from({ length: 10 }, (_, index) => <i key={index} className={index < step ? "is-on" : ""} />)}</span>
                  <span className="muted">{step}/10 backed</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {presence.length > 0 && (
        <section className="home-presence" aria-label="Partner presence">
          <ul>
            {presence.map((line) => <li key={line.id} className={line.waitingOn ? `is-waiting-${line.waitingOn}` : ""}>{line.text}</li>)}
          </ul>
        </section>
      )}

      {win && win.level !== "acknowledgment" && (
        <section className={`home-win home-win--${win.level}`} aria-label="A recent Win">
          <p className="kicker">{win.level === "first" ? "A First" : win.level === "graduation" ? "Graduated" : "A shared Win"}</p>
          <h3>{win.title}</h3>
          {memoryComplete ? <p className="muted">Kept as a Memory{win.authoredNote ? ` — “${win.authoredNote}”` : ""}.</p> : (
            <div className="chapter-actions">
              {memberKeptMemory ? <p className="muted">You chose to keep this. It becomes a shared Memory when your partner chooses too.</p> : <>
                <button type="button" disabled={busy} onClick={() => void onCommand((current) => keepWinAsMemory(current, { memberId, winId: win.id }))}>Keep as a Memory</button>
                {win.keptByMemberIds.length === 0 ? <button type="button" disabled={busy} onClick={() => void onCommand((current) => dismissWin(current, { memberId, winId: win.id }))}>Let it fade</button> : null}
              </>}
            </div>
          )}
        </section>
      )}

      <nav className="home-doors" aria-label="Ways deeper">
        <button type="button" onClick={() => onGo("ledger")}><strong>{fundName}</strong><small>What is true</small></button>
        <button type="button" onClick={() => onGo("plan")}><strong>Our Path</strong><small>Where we are going</small></button>
        <button type="button" onClick={() => onGo("together")}><strong>Together</strong><small>What needs us</small></button>
      </nav>
    </div>
  );
}
