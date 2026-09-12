import { useState } from "react";
import { todayKey, type Environment, type CommitResult, type Household, type LedgerView } from "./core/index.ts";
import { KittyNest } from "./kitty/KittyNest.tsx";
import { KittyBankRoom, type KittyPlanContext, type KittyCommandOptions, type KittySubmissionReader } from "./kitty/KittyBankRoom.tsx";

/** One gallery door for the four-tier nest in Home and Plan. */
export function KittyBanks(props: KittyBanksProps) {
  const [request,setRequest]=useState<{goalId?:string;bankId?:string}|null>(null);
  const room = props.planContext || request ? <KittyBankRoom household={props.booksHousehold} view={props.view} memberId={props.createdBy} busy={props.busy} identity={`${props.environment ?? props.booksHousehold.environment}:${props.household.householdId}:${props.createdBy}:${props.view}`} context={props.planContext} initialGoalId={request?.goalId} initialBankId={request?.bankId} onReadSubmission={props.onReadSubmission} onCommand={props.onCommand} returnTo={props.surface === "home" ? "Home" : "Plan"} onOpenCalendar={props.onOpenCalendar} onClose={props.planContext?.onClose ?? (()=>setRequest(null))}/> : null;
  if (props.planContext) return room;
  return <><KittyNest household={props.booksHousehold} memberId={props.createdBy} view={props.view} today={todayKey()} compact={props.surface !== "home"} onSelect={bank=>setRequest(bank.goal ? {goalId:bank.goal.id} : {bankId:bank.id})}/>{room}</>;

}
type KittyBanksProps = {
  planContext?: KittyPlanContext;
  onReadSubmission?:KittySubmissionReader;
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
