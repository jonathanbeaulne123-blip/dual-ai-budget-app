import {shapeAcceptedStarterPlans} from '../core/onboarding/planAcceptance.ts';
import type {Household} from '../core/types.ts';
import type {DateKey} from '../core/calendar.ts';
import {matchPlanEvidence} from '../core/planProjection.ts';
import type {Family} from './catalogue.ts';
import {clone,type HomeState} from './model.ts';
export type Milestone={id:Family;name:string;requirement:string;reviews:number;signal:'budget'|'reviews'|'followthrough'|'pottery'|'goal';target:string};
/** Editable product defaults. Alternatives never depend on income, spending or a streak. */
export const HOME_MILESTONES:readonly Milestone[]=[
 {id:'established',name:'A place to begin',requirement:'Accept a usable budget, or review one distinct period.',reviews:1,signal:'budget',target:'plan-studio'},
 {id:'reading',name:'Understand the numbers',requirement:'Review one distinct budget period.',reviews:1,signal:'reviews',target:'plan-studio'},
 {id:'garden',name:'A useful rhythm',requirement:'Review three distinct periods; gaps are welcome.',reviews:3,signal:'reviews',target:'plan-studio'},
 {id:'hosting',name:'Make room for company',requirement:'Review two distinct budget periods, at your own pace.',reviews:2,signal:'reviews',target:'plan-studio'},
 {id:'workshop',name:'Space for useful work',requirement:'Review three distinct budget periods, with or without shift income.',reviews:3,signal:'reviews',target:'plan-studio'},
 {id:'architecture',name:'Room to change',requirement:'Review a real plan with accepted follow-through, or review four distinct periods.',reviews:4,signal:'followthrough',target:'plan-studio'},
 {id:'sanctuary',name:'Something to grow toward',requirement:'Reach 25% of a selected goal with verified backing, or review six distinct periods.',reviews:6,signal:'goal',target:'loft-banks'},
 {id:'gallery',name:'Made by you',requirement:'Save a fired Pottery Studio creation, or review two distinct periods.',reviews:2,signal:'pottery',target:'pottery'},
];
export const GOAL_STAGE_FRACTION=.25;
export type HomeProgress={milestone:Milestone;current:number;required:number;eligible:boolean;earned:boolean;sourceAvailable:boolean};
export function homeProgress(h:Household,memberId:string,home:HomeState,today:DateKey,selectedGoalId?:string):HomeProgress[]{
 // A member can use Shared or their own Personal evidence. No partner-private source is visible.
 const accepted=(h.planVersions??[]).filter(p=>(p.scope==='household'||p.scope==='personal'&&p.ownerMemberId===memberId)&&['active','superseded'].includes(p.state)&&p.activatedAt&&Number.isFinite(Date.parse(p.activatedAt))&&p.lines.length>0);
 const reflections=(h.planReflections??[]).filter(r=>(r.scope==='household'||r.scope==='personal'&&r.ownerMemberId===memberId)&&r.reviewedByMemberIds.includes(memberId)&&accepted.some(p=>p.id===r.planVersionId&&p.monthKey===r.monthKey));
 const periods=new Set(reflections.map(r=>r.monthKey));
 const safeEvidence=(...args:Parameters<typeof matchPlanEvidence>)=>{try{return matchPlanEvidence(...args);}catch{return[];}};
 const followed=reflections.some(r=>{const p=accepted.find(p=>p.id===r.planVersionId)!;return p.lines.some(line=>{const outcome=r.outcomes.find(o=>o.planLineId===line.id&&['paid','moved'].includes(o.status));if(!outcome)return false;const references=new Set([...outcome.transactionIds,...(outcome.evidenceIds??[])]);return safeEvidence(h,line,p.monthKey,today,memberId,p.scope).some(e=>e.kind!=='goal-record'&&e.amountCents>0&&references.has(e.id));});});
 const own=h.personalLife?.ownerMemberId===memberId?h.personalLife:undefined;
 const fired=[...(h.hearthside?.designs??[]),...(own?.designs??[])].some(d=>d.firedByMemberIds?.includes(memberId))||(h.kittyNestDesigns??[]).some(d=>(d.visibility==='household'||d.createdBy===memberId)&&d.createdBy===memberId&&d.designHasFired===true&&d.designRef&&[...(h.hearthside?.designs??[]),...(own?.designs??[])].some(i=>i.designId===d.designRef!.designId&&i.revision>=d.designRef!.revision));
 const goal=selectedGoalId?h.goals.find(g=>g.id===selectedGoalId&&(g.shared||g.ownerMemberId===memberId)&&g.targetCents>0&&g.status!=='retired'&&!g.purchaseId):undefined;
 const backing=goal?safeEvidence(h,{sourceReference:{type:'goal',id:goal.id}},today.slice(0,7) as import('../core/calendar.ts').MonthKey,today,memberId,goal.shared?'household':'personal').filter(e=>e.kind==='goal-funding'):[];
 const isFund=(id:string)=>h.fundKittyAllocations?.some(a=>a.id===id);
 const backed=goal?Math.max(0,Math.min(goal.savedCents,backing.filter(e=>!isFund(e.id)).reduce((s,e)=>s+(e.reserveCents??0),0))+backing.filter(e=>isFund(e.id)).reduce((s,e)=>s+(e.reserveCents??e.amountCents),0)):0;
 const adopted=shapeAcceptedStarterPlans(h.acceptedStarterPlans).some(p=>p.memberIds.includes(memberId)&&p.plans.some(p=>p.amountCents>0));
 return HOME_MILESTONES.map(m=>{const signal=m.signal==='budget'?(adopted||accepted.length>0):m.signal==='followthrough'?followed:m.signal==='pottery'?fired:m.signal==='goal'?!!goal&&backed>=goal.targetCents*GOAL_STAGE_FRACTION:false;return{milestone:m,current:signal?m.reviews:Math.min(periods.size,m.reviews),required:m.reviews,eligible:signal||periods.size>=m.reviews,earned:home.awards.some(a=>a.id===m.id),sourceAvailable:m.signal!=='goal'||!!goal};});
}
export function grantHomeMilestones(h:Household,memberId:string,home:HomeState,today:DateKey,selectedGoalId?:string):HomeState{const next=clone(home);for(const p of homeProgress(h,memberId,home,today,selectedGoalId))if(p.eligible&&!p.earned)next.awards.push({id:p.milestone.id,grantedAt:today});return next;}
