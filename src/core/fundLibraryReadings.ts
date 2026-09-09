import { addDays } from './calendar.ts';
import { activeHouseholdFundEvents, householdFundOperatingDelta, projectHouseholdFund, projectHouseholdFundOperatingBalanceBefore } from './householdFund.ts';
import type { Household } from './types.ts';

export function recentFundMovement(h:Household,today:string) {
  const start=addDays(today,-6);
  const events=activeHouseholdFundEvents(h,h.householdFund?.id).filter(e=>e.date>=start&&e.date<=today&&householdFundOperatingDelta(e)!==0);
  const days=Array.from({length:7},(_,i)=>{const date=addDays(start,i);return {date,cents:events.filter(e=>e.date===date).reduce((sum,e)=>sum+householdFundOperatingDelta(e),0)};});
  const openingCents=projectHouseholdFundOperatingBalanceBefore(h,start,h.householdFund?.id);
  return {start,end:today,days,openingCents,closingCents:openingCents+days.reduce((sum,d)=>sum+d.cents,0)};
}
export function fundRecordReading(h:Household,today:string) {
  const reading=projectHouseholdFund(h,today);
  const latest=activeHouseholdFundEvents(h,h.householdFund?.id).filter(e=>e.date<=today).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt))[0];
  return { latest:latest ? {date:latest.date,kind:latest.kind}:null, coveredDate:reading.lastReconciledAt,
    reconciliation:reading.reconciliationTied===true?'Tied':reading.reconciliationTied===false?'Needs review':'Not independently checked' };
}
export function fundMinuteBook(h:Household) {
  return [
    ...(h.weeklyDocumentStamps??[]).map(s=>({id:s.id,at:s.stampedAt,label:`Weekly acknowledgement · ${s.weekStart}`,memberId:s.memberId})),
    ...h.sitDownSessions.map(s=>({id:s.id,at:s.updatedAt,label:`Sit-down · ${s.monthKey} · ${s.status}`,memberId:s.createdBy})),
    ...(h.charter?.signatures??[]).flatMap(s=>s.signedAt?[{id:`signature:${s.memberId}`,at:s.signedAt,label:'Household agreement signature',memberId:s.memberId}]:[]),
    ...(h.charter?.amendments??[]).flatMap(a=>a.confirmedByMemberId?[{id:a.id,at:a.resolvedAt ?? a.raisedAt,label:'Agreement amendment confirmed',memberId:a.confirmedByMemberId}]:[]),
  ].sort((a,b)=>b.at.localeCompare(a.at)||a.id.localeCompare(b.id));
}
