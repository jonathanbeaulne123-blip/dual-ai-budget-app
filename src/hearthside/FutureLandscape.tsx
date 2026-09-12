import {useMemo,useState} from 'react';
import type {Household} from '../core/types.ts';
import {addDays,todayKey} from '../core/calendar.ts';
import {projectPlan,planSelectionForVersion,type PlanProjection} from '../core/planProjection.ts';
import {planAcknowledgementState} from '../core/planSystem.ts';
import {playBankFacts} from '../core/herculesPlay.ts';
import {formatCad} from '../core/money.ts';
import type {SharedExperience,SharedReference} from './contracts.ts';
import './futureLandscape.css';
export type FutureHorizon=SharedExperience['horizon'];
export const FUTURE_HORIZONS=[{id:'tonight',label:'Tonight',invitation:'Something close enough to begin.'},{id:'season',label:'This season',invitation:'A little room to prepare.'},{id:'someday',label:'Someday',invitation:'A possibility can rest here.'}] as const;
export function FutureHorizonPicker({value,onChange}:{value:FutureHorizon;onChange:(value:FutureHorizon)=>void}){
 return <nav className="hearthside-horizons" aria-label="Our imagined horizons">{FUTURE_HORIZONS.map(h=><button key={h.id} type="button" aria-pressed={value===h.id} onClick={()=>onChange(h.id)}><span aria-hidden="true">{h.id==='tonight'?'☾':h.id==='season'?'❧':'✧'}</span><strong>{h.label}</strong><small>{h.invitation}</small></button>)}</nav>;
}
export function experiencePlanProjections(h:Household,memberId:string,experience:SharedExperience,asOf:string):Array<{id:string;projection:PlanProjection|null;reason:string;lineIds:string[]}>{
 const ids=[...new Set(experience.references.filter(r=>r.kind==='plan-line').map(r=>r.planVersionId!))];
 return ids.map(id=>{
  const version=h.planVersions?.find(v=>v.id===id&&v.scope==='household'),lineIds=experience.references.filter(r=>r.kind==='plan-line'&&r.planVersionId===id).map(r=>r.id);
  if(!version||version.state==='superseded'||!planAcknowledgementState(h,version).complete)return {id,projection:null,reason:'Open the current agreement before imagining its path.',lineIds};
  const projection=projectPlan(h,{memberId,scope:'household',acceptedRevision:h.revision,asOf,through:addDays(asOf,experience.horizon==='tonight'?0:experience.horizon==='season'?90:365),selection:planSelectionForVersion(version)});
  return {id,projection,reason:projection.kind==='unavailable'?'This part of the Plan is unavailable. Its figures have not been treated as zero.':'',lineIds};
 });
}
export function FuturePath({household,memberId,experience,onReference}:{household:Household;memberId:string;experience:SharedExperience;onReference:(reference:SharedReference)=>void}){
 const [open,setOpen]=useState(false),asOf=todayKey(),horizon=FUTURE_HORIZONS.find(h=>h.id===experience.horizon)!;
 const projections=useMemo(()=>open?experiencePlanProjections(household,memberId,experience,asOf):[],[open,household,memberId,experience,asOf]);
 const banks=experience.references.filter(r=>r.kind==='bank'),planLinks=experience.references.filter(r=>r.kind==='plan-line'),dates=experience.references.filter(r=>r.kind==='calendar-event').flatMap(ref=>{const event=household.nativeEvents?.find(e=>e.id===ref.id&&e.visibility==='household'&&!e.deleted);return event?[{ref,event}]:[]});
 return <section className="hearthside-future-path" aria-label="This imagined possibility"><p className="hearthside-eyebrow">Imagined · {horizon.label}</p><h3>{experience.state==='paused'?'A wish with room to wait':'What could help this happen?'}</h3><p>{experience.state==='paused'?'Resting here does not create a deadline or transfer a task to either of you.':horizon.invitation}</p>
  {dates.map(({ref,event})=><button className="hearthside-future-date" key={event.id} onClick={()=>onReference(ref)}>{event.title} · {event.start.slice(0,10)}<span>Our chosen date</span></button>)}
  {banks.length||planLinks.length?<><button type="button" aria-expanded={open} onClick={()=>setOpen(!open)}>{open?'Fold away the practical details':'Look at the practical details'}</button>{open&&<div className="hearthside-future-details">
   <p>Bank backing is what is there now. The Plan below describes a possible path using its accepted assumptions.</p>
   {banks.map(ref=>{const facts=playBankFacts(household,ref.id,memberId);return <article key={ref.id}><h4>{facts?.goal.name??'Linked bank'}</h4><p>{facts?`${formatCad(facts.backingCents)} backed now · ${formatCad(facts.goal.targetCents)} target`:'Backing is unavailable.'}</p><button onClick={()=>onReference(ref)}>Open the bank</button></article>;})}
   {projections.map(({id,projection,reason,lineIds})=><article key={id}><h4>A possible path through our Plan</h4>{reason?<p role="status">{reason}</p>:<><p>Imagined from {projection!.asOf} through {projection!.through}.{experience.horizon==='someday'?' This looks at one year; it does not give this wish a deadline.':''}</p>{projection!.lines.filter(row=>lineIds.includes(row.line.id)).map(row=><div key={row.line.id}><strong>{row.line.labelSnapshot}</strong><p>{row.status==='completed'?'The Plan has evidence for this step.':row.status==='outside-horizon'?'This step sits beyond the dates shown.':row.status==='depends-on-income'?'This depends on expected income.':row.status==='gap'?`${formatCad(row.gapCents)} remains uncovered in this projection.`:row.status==='intention'?'An intention whose funding is still to be chosen.':`${formatCad(row.coveredNowCents)} is covered by the current Plan.`}</p><button onClick={()=>onReference({kind:'plan-line',id:row.line.id,planVersionId:id})}>Read this agreement</button></div>)}{projection!.assumptions.length>0&&<details><summary>What this picture assumes</summary><ul>{projection!.assumptions.map((a,i)=><li key={i}>{a}</li>)}</ul></details>}</>}</article>)}
  </div>}</>:<p>There is no money attached to this intention. Time, words, and making something together can be enough.</p>}
 </section>;
}
