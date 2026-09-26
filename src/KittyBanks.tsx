import type {KittyAcceptedCommandReader} from './hearthside/bankReceipt.ts';
import { useState } from "react";
import { formatCad, fundRolloverByGoal, todayKey, type Environment, type CommitResult, type Household, type LedgerView } from "./core/index.ts";
import { KittyNest } from "./kitty/KittyNest.tsx";
import { KittyBankRoom, type KittyPlanContext, type KittyCommandOptions, type KittySubmissionReader } from "./kitty/KittyBankRoom.tsx";

/** One gallery door for the four-tier nest in Home and Plan. */
export function KittyBanks(props: KittyBanksProps) {
  const [request,setRequest]=useState<{goalId?:string;bankId?:string}|null>(props.initialBankId||props.initialStudio?{bankId:props.initialBankId}:null);
  const room = props.planContext || request ? <KittyBankRoom household={props.booksHousehold} view={props.view} memberId={props.createdBy} busy={props.busy} identity={`${props.environment ?? props.booksHousehold.environment}:${props.household.householdId}:${props.createdBy}:${props.view}`} context={props.planContext} initialGoalId={request?.goalId} initialBankId={request?.bankId} initialStudio={props.initialStudio} onReadSubmission={props.onReadSubmission} onReadAcceptedCommand={props.onReadAcceptedCommand} creationIdentity={props.creationIdentity} onCommand={props.onCommand} returnTo={props.surface === "home" ? "Home" : "Plan"} onOpenCalendar={props.onOpenCalendar} onClose={props.planContext?.onClose ?? (()=>setRequest(null))}/> : null;
  if (props.planContext) return room;
  return <><KittyNest household={props.booksHousehold} memberId={props.createdBy} view={props.view} today={todayKey()} compact={props.surface !== "home"} onSelect={bank=>setRequest(bank.goal ? {goalId:bank.goal.id} : {bankId:bank.id})}/>{props.view === "household" && <FundRolloverNote booksHousehold={props.booksHousehold}/>}{room}</>;

}
/**
 * D-161: what the Household Fund rolled into each named shared bank. A rollover
 * is a claim against the bank, not a deposit, so the note says the cash stays in
 * the shared pool. A release is a lump against the whole Kitty and is never
 * attributed to one bank. Shared view only; Personal never shows Fund surplus.
 */
function FundRolloverNote({ booksHousehold }: { booksHousehold: Household }) {
  const rollover = fundRolloverByGoal(booksHousehold);
  if (rollover.allocatedCents <= 0) return null;
  const rolled = booksHousehold.goals.filter(goal => goal.shared && rollover.byGoalId[goal.id]);
  return <aside className="kitty-rollover" aria-label="Fund rollovers">
    <p className="muted">
      Fund surplus rolled here: {formatCad(rollover.allocatedCents)}
      {rollover.releasedCents > 0
        ? `, of which ${formatCad(rollover.releasedCents)} has since been released back to the pool and is not held against one bank.`
        : "."}
    </p>
    {rolled.length > 0 && <ul className="kitty-rollover__banks">{rolled.map(goal => <li key={goal.id} className="kitty-bank-rolled">
      {goal.name}: Fund has rolled {formatCad(rollover.byGoalId[goal.id]!)} into this bank. The cash stays in the shared pool.
    </li>)}</ul>}
  </aside>;
}

type KittyBanksProps = {
  initialBankId?:string;
  /** K12: open the bank (or the first bank) on its studio page. */
  initialStudio?:boolean;
  planContext?: KittyPlanContext;
  onReadSubmission?:KittySubmissionReader;
  onReadAcceptedCommand?:KittyAcceptedCommandReader;
  creationIdentity?:string;
  environment?: Environment;
  household: Household;
  booksHousehold: Household;
  view: LedgerView;
  createdBy: string;
  busy?: boolean;
  surface?: "home" | "plan";
  onCommand: (fn: (current: Household) => CommitResult, options?:KittyCommandOptions) => unknown;
  onAskStartJar?: (appointmentId: string, summary: string) => void;
  onShowHome?: () => void;
  onOpenPlan?: () => void;
  onOpenCalendar?: () => void;
};
