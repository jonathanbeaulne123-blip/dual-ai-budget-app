import {HEARTHSIDE_FLAGS} from './hearthside/flags.ts';
import {HEARTHSIDE_LABEL} from './hearthside/routes.ts';
import type {KittyAcceptedCommandReader} from './hearthside/bankReceipt.ts';
import {WinMemoryReview} from './hearthside/WinMemoryReview.tsx';
import {winMemoryId} from './hearthside/winMemory.ts';
import {commitHearthside} from './hearthside/commands.ts';
import { useState, type ReactNode } from "react";
import type { CommitResult, Household } from "./core/types.ts";
import type { DateKey } from "./core/calendar.ts";
import { monthKeyFromDateKey } from "./core/calendar.ts";
import { formatCad } from "./core/money.ts";
import { monthObligations } from "./core/monthObligations.ts";
import { duePotentialExpenses, potentialExpensesForView } from "./core/potentialExpenses.ts";
import { deriveFundPulseInput, fundPulse, presenceLines, type FundPulseFreshness } from "./core/fundPulse.ts";
import { dismissWin, openChapterFor, recentWin } from "./core/chapters.ts";
import { fundDisplayName } from "./core/spaceNames.ts";
import { ChapterMoment } from "./ChapterPanel.tsx";
import { KittyNest } from "./kitty/KittyNest.tsx";
import { KittyBankRoom, type KittyCommandOptions, type KittySubmissionReader } from "./kitty/KittyBankRoom.tsx";
import { queensNestEnabled } from "./core/planFeature.ts";
import { QueenHome, type QueenShell } from "./queen/QueenHome.tsx";
import type { HousePlace } from "./queen/queenHouse.ts";
import type { InterpretationGate } from "./house/supportedInterpretation.ts";
import "./household-home.css";

type Run = (fn: (current: Household) => CommitResult, options?: KittyCommandOptions) => Promise<unknown>;

/**
 * Our Home (Vision v2 §4.2): the opening composition of the household space.
 *
 * Identity · the Chapter moment · the Fund pulse · one next Move · coming up ·
 * what is growing · partner presence · a recent Win only when earned · quiet
 * doors deeper. No register, no seals, no duplicate balances, no scoreboard.
 * The shelf reads accepted books; the gallery retains the existing reviewed
 * command and Final Confirm boundary.
 *
 * Two compositions share one kernel. `panels` is the approved Home. `queen`
 * (the Queen's Nest, Stage 1, behind `VITE_QUEENS_NEST`) composes the same
 * projections as regions of one body; the gallery door and its Final Confirm
 * boundary are identical in both.
 */
export function HouseholdHome(props: HouseholdHomeProps) {
  return <HouseholdHomeSession key={`${props.household.environment}:${props.household.householdId}:${props.memberId}`} {...props} />;
}

type HouseholdHomeProps = {
  initialBankId?:string;
  /** K12: open the bank (or the first bank) on its studio page. */
  initialStudio?:boolean;
  household: Household;
  memberId: string;
  today: DateKey;
  freshness: FundPulseFreshness;
  interpretationGate?: InterpretationGate;
  busy: boolean;
  onCommand: Run;
  onGo: (tab: "ledger" | "plan" | "together" | "calendar" | "more") => void;
  onOpenSetup: (destination: "charter" | "fund") => void;
  onReadSubmission?: KittySubmissionReader;
  onReadAcceptedCommand?: KittyAcceptedCommandReader;
  creationIdentity?: string;
  onOpenMemory?: (memoryId:string)=>void;
  /** Chapter 1 is the Month-One rehearsal; its access stays inside the Chapter area. */
  rehearsal?: ReactNode;
  identityArt?: ReactNode;
  /** Defaults to the `VITE_QUEENS_NEST` flag inside the Plan V2 family. */
  composition?: "panels" | "queen";
  /** The Queen's world: `auto` (default) tries WebGL and degrades silently; `flat` keeps the drawn figure. */
  world?: "auto" | "flat" | "3d";
  /** The Queen's living light: the local clock as a fractional hour. Absent, the device clock. Evidence only. */
  clock?: number;
  /** The App's shell readings the Queen's world takes off the page and keeps behind her Status door. */
  shell?: QueenShell;
  housePlace?: HousePlace;
  onHousePlace?: (place: HousePlace) => void;
};

function HouseholdHomeSession({ initialBankId, initialStudio, household, memberId, today, freshness, interpretationGate, busy, onCommand, onGo, onOpenSetup, onReadSubmission, onReadAcceptedCommand, creationIdentity, onOpenMemory, rehearsal, identityArt, composition, world, clock, shell, housePlace, onHousePlace }: HouseholdHomeProps) {
  const [bankRequest, setBankRequest] = useState<{ goalId?: string; bankId?: string } | null>(initialBankId||initialStudio?{bankId:initialBankId}:null);
  const queen = (composition ?? (queensNestEnabled() ? "queen" : "panels")) === "queen";
  const gallery = bankRequest && <KittyBankRoom household={household} view="household" memberId={memberId} busy={busy}
    identity={`${household.environment}:${household.householdId}:${memberId}:household`}
    initialGoalId={bankRequest.goalId} initialBankId={bankRequest.bankId} initialStudio={initialStudio} onOpenCalendar={() => { setBankRequest(null); onGo("calendar"); }} returnTo="Home" onCommand={onCommand} onReadSubmission={onReadSubmission} onReadAcceptedCommand={onReadAcceptedCommand} creationIdentity={creationIdentity}
    onClose={() => setBankRequest(null)} />;
  if (queen) {
    return (
      <>
        <QueenHome household={household} memberId={memberId} today={today} freshness={freshness} interpretationGate={interpretationGate} busy={busy} onCommand={onCommand} onGo={onGo} onOpenSetup={onOpenSetup} onOpenBank={setBankRequest} identityArt={identityArt} world={world} clock={clock} shell={shell} housePlace={housePlace} onHousePlace={onHousePlace} />
        {gallery}
      </>
    );
  }
  const monthKey = monthKeyFromDateKey(today);
  const chapter = openChapterFor(household);
  const pulse = fundPulse(deriveFundPulseInput(household, { memberId, today, freshness, activeChapter: Boolean(chapter) }));
  const presence = presenceLines(household, { memberId, today });
  const obligations = monthObligations(household, monthKey, today).rows.filter((row) => row.date >= today).slice(0, 3);
  const planned = duePotentialExpenses(potentialExpensesForView(household.potentialExpenses, memberId, "household"), today).slice(0, 2);
  const win = recentWin(household);
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
        <p className="fund-pulse__source">{fundName}'s plan.</p>
      </section>

      <ChapterMoment household={household} memberId={memberId} today={today} onOpenPath={() => onGo("plan")} onOpenSetup={onOpenSetup} onCommand={onCommand} busy={busy} />
      {rehearsal}

      {(obligations.length > 0 || planned.length > 0) && (
        <section className="home-coming-up" aria-label="Coming up">
          <p className="kicker">Coming up</p>
          <ul>
            {obligations.map((row) => <li key={row.id}><span>{row.label}</span><span className="muted">{row.date}</span><span className="home-amount">{formatCad(row.amountCents)}</span></li>)}
            {planned.map((row) => <li key={row.id} className="is-planned"><span>{row.title}</span><span className="muted">{row.date} · planned, not posted</span><span className="home-amount">{formatCad(row.expectedAmountCents)}</span></li>)}
          </ul>

        </section>
      )}

      <KittyNest household={household} memberId={memberId} view="household" today={today} onSelect={bank => setBankRequest(bank.goal ? { goalId: bank.goal.id } : { bankId: bank.id })} />
      {gallery}

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
          <WinMemoryReview key={win.id} household={household} win={win} memory={household.hearthside?.memories.find(m=>m.id===winMemoryId(household,win.id))} busy={busy}
            onAdopt={(operation,id,recover)=>onCommand(current=>commitHearthside(current,{version:1,id,scope:{environment:current.environment,householdId:current.householdId,memberId},operation}),{confirmationId:id,recoverConfirmation:recover,suppressUndo:true})}
            onOpen={id=>{if(onOpenMemory)onOpenMemory(id);else onGo('together');}}/>
          {win.keptByMemberIds.length===0&&!household.hearthside?.memories.some(m=>m.id===winMemoryId(household,win.id))&&<button type="button" disabled={busy} onClick={()=>void onCommand(current=>dismissWin(current,{memberId,winId:win.id}))}>Let it fade</button>}
        </section>
      )}

      <nav className="home-doors" aria-label="Ways deeper">
        <button type="button" onClick={() => onGo("calendar")}><strong>Calendar</strong><small>Dates and bills</small></button>
        <button type="button" onClick={() => onGo("ledger")}><strong>{fundName}</strong><small>What is true</small></button>
        <button type="button" onClick={() => onGo("plan")}><strong>The Journey map</strong><small>Where we are going</small></button>
        <button type="button" onClick={() => onGo("together")}><strong>{HEARTHSIDE_FLAGS.presentation?HEARTHSIDE_LABEL:"Together"}</strong><small>{HEARTHSIDE_FLAGS.presentation?"Our shared life":"What needs us"}</small></button>
      </nav>
    </div>
  );
}
