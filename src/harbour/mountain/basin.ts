import {activeHouseholdFundEvents,projectHouseholdFund,householdFundOperatingDelta,shapeHouseholdFundConfig} from '../../core/householdFund.ts';
import type {Household} from '../../core/types.ts';
import type {DateKey} from '../../core/calendar.ts';
import type {FundPulseFreshness} from '../../core/fundPulse.ts';
export type BasinFlow={id:string;cents:number;kind:'inlet'|'outlet'|'reserve-in'|'reserve-out';label:string;date?:DateKey};
export type BasinReading={identity:string;revision:number;asOf:string;known:boolean;motion?:boolean;balanceCents:number|null;kittyCents:number|null;freeCents:number|null;pendingCents:number;targetCents:number;flows:readonly BasinFlow[]};
/** Read only. Never infer a bank movement from a purchase, claim, or planned contribution. */
export function buildBasinReading(h:Household,today:DateKey,freshness:FundPulseFreshness):BasinReading{
  const config=shapeHouseholdFundConfig(h.householdFund),p=projectHouseholdFund(h,today),known=p.configured&&freshness==='current';
  const flows:BasinFlow[]=known?activeHouseholdFundEvents(h,config?.id).filter(e=>householdFundOperatingDelta(e)!==0).slice(-48).map(e=>({id:e.id,cents:e.amountCents,date:e.date,
    kind:e.kind==='kitty-allocated'?'reserve-out':e.kind==='kitty-released'?'reserve-in':e.kind==='contribution-confirmed'?'inlet':'outlet',
    label:e.kind==='kitty-allocated'?'Moved into Kitty reserves':e.kind==='kitty-released'?'Released from Kitty reserves':e.kind==='contribution-confirmed'?'Confirmed Fund contribution':'Confirmed Fund settlement'})):[];
  return {identity:`${h.environment}:${h.householdId}:${config?.id??'unconfigured'}`,revision:h.revision,asOf:today,known,balanceCents:known?p.operatingBalanceCents:null,kittyCents:known?p.kittyCents:null,freeCents:known?p.freeToSpendCents:null,pendingCents:known?p.pendingContributionsCents:0,targetCents:p.monthlyTargetCents,flows};
}
export type BasinVisual={level:number|null;reserveLevel:number|null;scaleCents:number;scaleChanged:boolean;newFlows:readonly BasinFlow[]};
const sessionScales=new Map<string,number>();
/** A view-local scale and event cursor. Mount/replay primes without celebrating history. */
export function createBasinView(){
  let identity='',revision=-1,scale=100_000,seen=new Set<string>(),paused=false;
  return (reading:BasinReading|null|undefined):BasinVisual=>{
    if(!reading?.known||reading.balanceCents===null){paused=true;return {level:null,reserveLevel:null,scaleCents:scale,scaleChanged:false,newFlows:[]};}
    const reset=identity!==reading.identity,previous=scale;
    if(reset){identity=reading.identity;revision=reading.revision;seen=new Set(reading.flows.map(e=>e.id));scale=sessionScales.get(identity)??Math.max(100,reading.targetCents||100_000);}
    const largest=Math.max(reading.balanceCents,reading.kittyCents??0);while(largest>scale)scale*=2;sessionScales.set(identity,scale);if(sessionScales.size>16)sessionScales.delete(sessionScales.keys().next().value!);
    const next=!reset&&!paused&&reading.motion!==false&&reading.revision>revision?reading.flows.filter(e=>!seen.has(e.id)):[];
    for(const e of reading.flows)seen.add(e.id);revision=Math.max(revision,reading.revision);paused=reading.motion===false;
    return {level:Math.max(0,Math.min(1,reading.balanceCents/scale)),reserveLevel:Math.max(0,Math.min(1,(reading.kittyCents??0)/scale)),scaleCents:scale,scaleChanged:!reset&&previous!==scale,newFlows:next};
  };
}
export const basinMoney=(cents:number|null|undefined)=>cents==null?'Checking':new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD',maximumFractionDigits:2}).format(cents/100);
