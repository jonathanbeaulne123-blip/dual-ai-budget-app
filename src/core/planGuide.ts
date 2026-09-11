import type { ActionContext, ActionDefinition, ActionField, ActionValues } from './herculesActions.ts';
import { savePlanDraft } from './commands.ts';
import { isVisibleInView } from './visibility.ts';
import { ValidationError } from './types.ts';
import type { MonthKey } from './calendar.ts';
import { addDays, isValidDateKey } from './calendar.ts';
import { formatCad, parseWholeCents } from './money.ts';
import { currentPlanVersion, type PlanLine, type PlanLens, type PlanSourceReference } from './planSystem.ts';
import { completePlanDates, planSourceVisible, projectPlan, type PlanSelection } from './planProjection.ts';

export const PLAN_GUIDE_ID = 'plan-guided-draft';
export type GuideField = ActionField & { why: string; suggestions?: {value: string; label: string}[]; evidence?: string[] };
const choice = (value: string, label: string) => ({value, label});
const cents = (text: string) => parseWholeCents(text, 'Amount', {allowZero:true});
const dollars = (value: number) => String(value / 100);
const skipped = (value?: string) => !value || value === 'skip' || value === 'current-only';
export function guideMonth(c: ActionContext, v: ActionValues) { return v.monthKey || c.planMonth || c.today.slice(0,7); }
function monthEnd(month: string) { const [year, m] = month.split('-').map(Number); return new Date(Date.UTC(year!, m!, 0)).toISOString().slice(0,10); }
function startDate(c: ActionContext, v: ActionValues) { const month=guideMonth(c,v); return c.today.startsWith(month) ? c.today : `${month}-01`; }
function bills(c: ActionContext) { return c.household.recurrences.filter(r=>r.active && r.type==='expense' && planSourceVisible(c.household,{type:'recurrence',id:r.id},c.memberId,c.view)).map(r=>({...r,payments:r.payments?.filter(payment=>{const tx=c.household.transactions.find(t=>t.id===payment.transactionId);return tx&&isVisibleInView(tx,c.memberId,c.view);})})); }
function goals(c: ActionContext) { return c.household.goals.filter(g=>planSourceVisible(c.household,{type:'goal',id:g.id},c.memberId,c.view)); }
function prior(c: ActionContext, v: ActionValues) { const month=guideMonth(c,v); return [...(c.household.planDrafts??[])].filter(d=>d.ownerMemberId===c.memberId&&d.scope===c.view&&d.targetMonth===month).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0]; }
function base(c: ActionContext,v: ActionValues) { return prior(c,v) ?? currentPlanVersion(c.household,c.view,guideMonth(c,v) as MonthKey,c.memberId); }
function upcomingBills(c: ActionContext,v: ActionValues) { const month=guideMonth(c,v); if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))return[]; return bills(c).filter(b=>!(base(c,v)?.lines??[]).some(l=>l.sourceReference?.type==='recurrence'&&l.sourceReference.id===b.id)).flatMap(b=>[...new Set([...completePlanDates(b.nextDate,b.cadence,`${month}-01`,monthEnd(month)), ...(b.payments??[]).map(p=>p.occurrenceDate).filter(date=>date.startsWith(month))])].sort().map(date=>({bill:b,date}))); }
function incomeSources(c: ActionContext,v: ActionValues) {
 return c.view==='household' ? (c.household.planBridgeDecisions??[]).filter(r=>r.monthKey===guideMonth(c,v)&&r.kind==='contribution'&&['proposed','held','accepted'].includes(r.state)).map(r=>({id:r.id,label:r.label,date:r.expectedDate,amount:r.amountCents,type:'bridge' as const})) : c.household.recurrences.filter(r=>r.active&&r.type==='income'&&planSourceVisible(c.household,{type:'recurrence',id:r.id},c.memberId,c.view)).map(r=>({id:r.id,label:r.note||'Scheduled income',date:r.nextDate,amount:r.amountCents,type:'recurrence' as const}));
}
const WHY = {
 protect:'Dates and amounts tell us which promises need money first. A bill in the Plan is still separate from recording its payment.',
 prepare:'A known future cost is easier to handle when you can set money aside before it arrives.',
 build:'Giving an outcome a cost and a date lets us compare it with the other things that matter to you.',
 everyday:'Ordinary life needs room too. We will test this allowance against the promises you have chosen.',
};
export function planGuideFields(c: ActionContext,v: ActionValues): GuideField[] {
 const result:GuideField[]=[];
 const ask=(key:string,label:string,question:string,why:string,kind:ActionField['kind']='text',options?:ReturnType<typeof choice>[],suggestions?:ReturnType<typeof choice>[],evidence?:string[])=>result.push({key,label,question,why,kind,...(options?{choices:()=>options}:{}),...(suggestions?{suggestions}:{}),...(evidence?{evidence}: {})});
 ask('monthKey','Plan month','Which month are we planning?','A month keeps this draft separate from your other agreements. Use YYYY-MM.', 'text',undefined,[choice(c.today.slice(0,7),'This month')]);
 ask('purpose','What matters this month','What would make this month feel easier or more worthwhile?',`Your answer gives our choices a purpose. ${base(c,v)?.lines.length ? `I will keep your ${base(c,v)!.lines.length} existing decisions as our starting point. ` : ''}You can say “not sure yet”; this stays in your private draft.`, 'text',undefined,[choice('Not sure yet','Not sure yet')]);
 const sourceOptions=incomeSources(c,v);
 ask('incomeSource','Expected money','Is there future money you want this draft to count on?','Money you already have is included by the books. Future money needs a source and a date so it cannot cover an earlier bill. The review also shows forecasts already present in the books.', 'text',[choice('skip',base(c,v)?.assumptions.some(a=>a.kind==='income')?'Keep my existing money assumptions':'Continue without adding expected money'),...(base(c,v)?.assumptions.some(a=>a.kind==='income')?[choice('current-only','Remove this draft’s expected income')]:[]),...sourceOptions.map(r=>choice(r.id,r.label))],undefined,c.view==='household'&&!sourceOptions.length?['No contribution offer has been shared yet. You can keep planning with current money and revisit expected money through the Bridge.']:undefined);
 if(!skipped(v.incomeSource)) {
  const source=sourceOptions.find(r=>r.id===v.incomeSource);
  ask('incomeAmount','Expected contribution','How much of that future money can this Plan rely on?','This stays an estimate until the money is received. Use the amount you are comfortable committing.', 'money',undefined,source?.amount!==undefined?[choice(dollars(source.amount),`Use the recorded ${formatCad(source.amount)}`)]:undefined);
  ask('incomeDate','Expected arrival','When do you expect it to be available?','A positive month total cannot fill a gap before payday. Say a date or a day of the week.', 'date',undefined,source?.date&&source.date>c.today?[choice(source.date,`Use ${source.date}`)]:undefined);
 }
 const known=upcomingBills(c,v);
 ask('protectSource','Promises to protect','Which bills or promises should we make room for? ',WHY.protect,'text',[
  ...(known.length?[choice('known','Use these upcoming bills')]:[]),...bills(c).map(b=>choice(b.id,b.note||'Repeating bill')),choice('unlinked','Add a promise the books do not show'),choice('skip','Keep this open for now')],undefined,known.slice(0,20).map(({bill,date})=>`${bill.note||'Bill'} · ${formatCad(bill.amountCents)} · ${date}`).concat(known.length>20?[`${known.length-20} more occurrences will be included in the complete review.`]:[]));
 if(!skipped(v.protectSource)) {
  if(v.protectSource!=='known') {
   const bill=bills(c).find(b=>b.id===v.protectSource);
   if(v.protectSource==='unlinked')ask('protectLabel','Promise name','What is the promise?','A clear name helps us remember what this money is for. We will keep it marked as unlinked until there is evidence.');
   ask('protectAmount','Promise amount','How much needs to be ready for this payment?',WHY.protect,'money',undefined,bill?[choice(dollars(bill.amountCents),`Use ${formatCad(bill.amountCents)} from the bill`)]:undefined);
   ask('protectDate','Payment date','When does that payment need to happen?',WHY.protect,'date',undefined,bill?[choice(bill.nextDate,`Use ${bill.nextDate} from the bill`)]:undefined);
  }
  ask('protectOwner','Responsibility','Who will take care of these payments?','Responsibility means who handles the task. It does not decide who owns an account or give anyone permission to spend.','text',[...(c.view==='household'?[choice('joint','Together')]:[]),...c.household.members.filter(m=>m.active&&(c.view==='household'||m.id===c.memberId)).map(m=>choice(m.id,m.name))]);
  ask('protectFunding','Money for the promises','Which money are you identifying for these promises?','I will check the evidence and timing. Choosing a source does not by itself make a promise covered.','text',[choice('available',c.view==='household'?'Current Fund money':'Current personal cash'),...(!skipped(v.incomeSource)?[choice('expected','The expected money we discussed')]:[]),choice('unknown','I have not identified it yet')]);
 }
 for(const lens of ['prepare','build'] as const) {
  ask(`${lens}Source`,lens==='prepare'?'Cost to prepare for':'Outcome to build',lens==='prepare'?'Is there a future cost you would rather prepare for now?':'What is one thing you want this money to make possible?',WHY[lens],'text',[...goals(c).filter(g=>v[`${lens==='prepare'?'build':'prepare'}Source`]!==g.id&&!(base(c,v)?.lines??[]).some(l=>l.sourceReference?.type==='goal'&&l.sourceReference.id===g.id&&l.lens!==lens)).map(g=>choice(g.id,g.name)),choice('unlinked',lens==='prepare'?'A cost without a reserve goal yet':'An idea without a savings goal yet'),choice('skip','Keep this open for now')]);
  if(skipped(v[`${lens}Source`]))continue;
  const goal=goals(c).find(g=>g.id===v[`${lens}Source`]);
  if(!goal)ask(`${lens}Label`,lens==='prepare'?'Future cost':'Life outcome',lens==='prepare'?'What cost are you thinking of?':'What would you like to make possible?',WHY[lens]);
  ask(`${lens}Target`,`${lens==='prepare'?'Future cost':'Goal'} total`,'What is your best estimate of the total cost?', 'We use a total to see how far the current reserve goes. A guess remains a planning estimate, not verified savings.','money',undefined,goal?[choice(dollars(goal.targetCents),`Use the goal’s ${formatCad(goal.targetCents)}`)]:undefined);
  ask(`${lens}Deadline`,`${lens==='prepare'?'Cost':'Goal'} deadline`,'When would you like the money ready?', 'A deadline lets us see whether the contribution you choose can reach the target in time.','date',undefined,goal?.deadline?[choice(goal.deadline,`Use ${goal.deadline}`)]:undefined);
  ask(`${lens}Paydays`,`${lens==='prepare'?'Preparation':'Goal'} paydays`,'Which paydays can help you reach this target?', 'Give dates separated by commas, or choose “Decide later”. Real paydays let Prepare divide the remaining target without pretending a transfer has happened.','text',undefined,[choice('Decide later','Decide later'),...(goal && base(c,v)?.lines.find(l=>l.sourceReference?.type==='goal'&&l.sourceReference.id===goal.id)?.decision?.paydays?.length ? [choice(base(c,v)!.lines.find(l=>l.sourceReference?.type==='goal'&&l.sourceReference.id===goal.id)!.decision!.paydays!.join(', '),'Keep the paydays already in this Plan')]:[])]);
  ask(`${lens}Amount`,`${lens==='prepare'?'Preparation':'Goal'} contribution`,'How much would you like to put toward it this month?', 'This is a contribution promise, not a transfer. We will compare it with your bills and everyday room before you agree.','money');
  ask(`${lens}Date`,`${lens==='prepare'?'Preparation':'Goal'} contribution date`,'When should this month’s contribution be available?', 'The contribution needs money on this date, even if the final goal is months away.','date',undefined,[choice(startDate(c,v),`Use ${startDate(c,v)}`)]);
  ask(`${lens}Funding`,`${lens==='prepare'?'Preparation':'Goal'} money`,'Where will this contribution come from?', 'Current resources and future money stay separate; I will check whether the same money is already supporting another promise.','text',[choice('available',c.view==='household'?'Current Fund money':'Current personal cash'),...(!skipped(v.incomeSource)?[choice('expected','The expected money we discussed')]:[]),choice('unknown','I have not identified it yet')]);
  ask(`${lens}Step`,`${lens==='prepare'?'Preparation':'Goal'} next step`,'What is one small next step—or should we leave that open?', 'A quote, a date comparison or a conversation can make the estimate more useful. Say “not sure yet” if you need time.','text',undefined,[choice('Not sure yet','Not sure yet')]);
 }
 ask('everydaySource','Everyday category','Which kind of ordinary spending needs room this month?',WHY.everyday,'text',[...c.household.categories.filter(r=>r.active&&r.parentId&&r.transactionType==='expense'&&planSourceVisible(c.household,{type:'category',id:r.id},c.memberId,c.view)).map(r=>choice(r.id,r.name)),choice('unlinked','An allowance without a category yet'),choice('skip','Keep this open for now')]);
 if(!skipped(v.everydaySource)) {
  if(v.everydaySource==='unlinked')ask('everydayLabel','Allowance name','What should this allowance cover?',WHY.everyday);
  ask('everydayAmount','Everyday allowance','How much room would you like for it this month?',WHY.everyday,'money');
  ask('everydayDate','Allowance available from','From what date should this allowance be available?','A purchase before payday needs money already available. The date makes that difference visible.','date',undefined,[choice(startDate(c,v),`Use ${startDate(c,v)}`)]);
 }
 ask('constraints','Time and priorities','Is there anything this Plan should leave room for in your life?','Time, rest and responsibilities matter. This answer stays in your private note; sharing a Plan will not automatically share it.','text',undefined,[choice('Nothing to add for now','Nothing to add for now')]);
 result.push({key:'lookThrough',label:'Look ahead through',question:'How far ahead are we checking?',why:'This keeps the conversation and selected Plan on the same dated horizon.',kind:'date',optional:true});
 return result;
}
export function guideAnswer(c:ActionContext,v:ActionValues,key:string,value:string):ActionValues {
 const fields=planGuideFields(c,v), index=fields.findIndex(f=>f.key===key), next={...v,[key]:value};
 // A changed earlier answer reopens dependent questions. Never retain a hidden stale amount/source.
 if(v[key]!==undefined && v[key]!==value) for(const f of fields.slice(index+1).filter(f=>!f.optional)) delete next[f.key];
 return next;
}
export function guideBack(c:ActionContext,v:ActionValues,key?:string):ActionValues {
 const fields=planGuideFields(c,v), answered=fields.filter(f=>!f.optional&&v[f.key]);const target=key??answered.at(-1)?.key;
 if(!target)return v;const index=fields.findIndex(f=>f.key===target);return Object.fromEntries(Object.entries(v).filter(([k])=>!fields.slice(index).some(f=>!f.optional&&f.key===k)));
}
export function guideQuestion(c:ActionContext,v:ActionValues) { return planGuideFields(c,v).find(f=>!f.optional&&!v[f.key]?.trim()); }
export function guideReply(c:ActionContext,v:ActionValues) { const f=guideQuestion(c,v); return f ? `${f.question.trim()} ${f.why}` : 'We have a draft to review. I will show what is covered, what depends on future money and what still needs attention. Saving this private draft does not share an agreement or move money.'; }
export function parseGuidePaydays(text:string){const dates=text.split(',').map(s=>s.trim()).filter(Boolean);if(!dates.length||dates.length>36||dates.some(d=>!isValidDateKey(d)))throw new ValidationError('Use dates such as 2026-09-18, 2026-10-02, or choose Decide later.');return [...new Set(dates)].sort();}
export function buildGuidedPlan(c:ActionContext,v:ActionValues,id:string) {
 const month=guideMonth(c,v);if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new ValidationError('Choose a month using YYYY-MM.');
 const old=base(c,v), lines:PlanLine[]=(old?.lines??[]).map(row=>({...row,createdBy:c.memberId})), assumptions=[...(old?.assumptions??[])].filter(a=>v.incomeSource!=='current-only'||a.kind!=='income');const unresolved:string[]=[];
 const put=(line:PlanLine)=>{if(line.sourceReference&&lines.some(row=>row.lens!==line.lens&&row.sourceReference?.type===line.sourceReference!.type&&row.sourceReference.id===line.sourceReference!.id))throw new ValidationError('That evidence already supports another part of your Plan. Open its existing decision in Plan tools before changing its purpose.');const index=lines.findIndex(row=>row.lens===line.lens&&line.sourceReference&&row.sourceReference?.type===line.sourceReference.type&&row.sourceReference.id===line.sourceReference.id);if(index<0)lines.push(line);else lines[index]={...lines[index]!,...line,id:lines[index]!.id,assumptionIds:lines[index]!.assumptionIds,decision:{...(lines[index]!.decision?.timeConstraint?{timeConstraint:lines[index]!.decision!.timeConstraint}:{}),...(lines[index]!.decision?.reopenWhen?{reopenWhen:lines[index]!.decision!.reopenWhen}:{}),...line.decision}};};
 const line=(lens:PlanLens,label:string,amount:number,date:string,source?:PlanSourceReference,funding?:string):PlanLine=>({id:`GUIDE-${id}-${lens}-${source?.id??'idea'}-${date}`,lens,kind:lens==='protect'?'obligation':lens==='prepare'?'true-expense':lens==='build'?'goal-contribution':'everyday-pool',labelSnapshot:label,amountCents:amount,cadence:'one-time',dueDate:date,createdBy:c.memberId,assumptionIds:[],...(source?{sourceReference:source}:{}),responsibility:lens==='protect'&&v.protectOwner==='joint'?{kind:'joint'}:{kind:'member',memberId:lens==='protect'?v.protectOwner:c.memberId},decision:{...(['available','expected'].includes(funding??'')?{funding:funding as 'available'|'expected'}:{} )}});
 if(!skipped(v.incomeSource)) {const source=incomeSources(c,v).find(r=>r.id===v.incomeSource);if(!source)throw new ValidationError('That expected money is no longer visible. Choose its current source.');if(!isValidDateKey(v.incomeDate??'')||v.incomeDate!<=c.today)throw new ValidationError('Expected money needs a future arrival date. Received money is already in your books.');
  const ref={type:source.type,id:source.id};const item={id:`GUIDE-${id}-income`,kind:'income' as const,valueCents:cents(v.incomeAmount!),expectedDate:v.incomeDate!,sourceReferences:[ref],observedAt:`${c.today}T12:00:00.000Z`,confidence:'estimated' as const};const index=assumptions.findIndex(a=>a.kind==='income'&&(ref.type==='bridge'||a.expectedDate===item.expectedDate)&&a.sourceReferences.some(r=>r.type===ref.type&&r.id===ref.id));if(index<0)assumptions.push(item);else assumptions[index]=item;}
 if(v.protectSource==='known') {
  const occurrences=upcomingBills(c,v);
  for(const bill of bills(c)) {
   const schedule=occurrences.filter(item=>item.bill.id===bill.id).map(({date})=>({date,amountCents:bill.payments?.find(payment=>payment.occurrenceDate===date)?.amountCents??bill.amountCents}));
   if(!schedule.length)continue;
   const row=line('protect',bill.note||'Repeating bill',schedule.reduce((sum,item)=>sum+item.amountCents,0),schedule[0]!.date,{type:'recurrence',id:bill.id},v.protectFunding);
   row.cadence='monthly';row.decision={...row.decision,contributionSchedule:schedule};put(row);
  }
 }
 else if(!skipped(v.protectSource)) {const b=bills(c).find(r=>r.id===v.protectSource);if(!b&&v.protectSource!=='unlinked')throw new ValidationError('Choose a currently visible bill.');put(line('protect',b?.note||v.protectLabel!,cents(v.protectAmount!),v.protectDate!,b?{type:'recurrence',id:b.id}:undefined,v.protectFunding));}
 else unresolved.push('Protect: review any promises not already in the draft.');
 for(const lens of ['prepare','build'] as const) {if(skipped(v[`${lens}Source`])){unresolved.push(`${lens==='prepare'?'Prepare':'Build'}: ${old?.lines.some(l=>l.lens===lens)?'kept existing decisions; no new outcome chosen.':'left open for now.'}`);continue;}const g=goals(c).find(r=>r.id===v[`${lens}Source`]);if(!g&&v[`${lens}Source`]!=='unlinked')throw new ValidationError('Choose a currently visible goal.');const row=line(lens,g?.name||v[`${lens}Label`]!,cents(v[`${lens}Amount`]!),v[`${lens}Date`]!,g?{type:'goal',id:g.id}:undefined,v[`${lens}Funding`]);row.decision={...row.decision,targetCents:cents(v[`${lens}Target`]!),deadline:v[`${lens}Deadline`],nextStep:v[`${lens}Step`],...(v[`${lens}Paydays`] && !/^decide later$/i.test(v[`${lens}Paydays`]!)?{paydays:parseGuidePaydays(v[`${lens}Paydays`]!)}:{})};put(row);}
 if(!skipped(v.everydaySource)){const cat=c.household.categories.find(r=>r.id===v.everydaySource&&r.active&&r.parentId&&r.transactionType==='expense');if(!cat&&v.everydaySource!=='unlinked')throw new ValidationError('Choose a current spending category.');put(line('everyday',cat?.name||v.everydayLabel!,cents(v.everydayAmount!),v.everydayDate!,cat?{type:'category',id:cat.id}:undefined,'available'));}else unresolved.push(old?.lines.some(l=>l.lens==='everyday')?'Everyday: kept existing allowance; no new allowance chosen.':'Everyday: allowance left open for now.');
 return {monthKey:month as MonthKey,lines,assumptions,note:[prior(c,v)?.note,v.purpose&&`What matters: ${v.purpose}`,v.constraints&&`Private life context: ${v.constraints}`,...unresolved].filter(Boolean).join('\n')};
}
export function guideProjection(c:ActionContext,v:ActionValues) { const built=buildGuidedPlan(c,v,'preview');const selection:PlanSelection={kind:'draft',id:'guided-preview',ownerMemberId:c.memberId,scope:c.view,monthKey:built.monthKey,lines:built.lines,assumptions:built.assumptions};return projectPlan(c.household,{memberId:c.memberId,scope:c.view,acceptedRevision:c.household.revision,asOf:c.today,through:v.lookThrough||addDays(c.today,30),selection}); }
export function guideReviewRows(c:ActionContext,v:ActionValues) { const built=buildGuidedPlan(c,v,'preview'),p=guideProjection(c,v);return [
 {label:'Dates checked',value:`${p.asOf} through ${p.through}`},
 {label:'Existing decisions',value:`${base(c,v)?.lines.length??0} retained as the starting point. This review contains ${built.lines.length} decisions.`},
 ...built.lines.flatMap((l,i)=>[{label:`${i+1}. ${l.lens} · ${l.labelSnapshot}`,value:`${formatCad(l.amountCents)} · ${l.cadence} · ${l.dueDate??'No date'} · ${l.sourceReference?`linked ${l.sourceReference.type}`:'unlinked intention'}`},{label:`${i+1}. Responsibility and money`,value:`${l.responsibility?.kind==='joint'?'Together':c.household.members.find(m=>m.id===l.responsibility?.memberId)?.name??'Not chosen'} · ${l.decision?.funding==='available'?'current resources':l.decision?.funding==='expected'?'expected money':'money still to identify'}`},...(l.decision?.lowCents!==undefined||l.decision?.highCents!==undefined?[{label:`${i+1}. Estimate range`,value:`${l.decision.lowCents===undefined?'Open lower amount':formatCad(l.decision.lowCents)} to ${l.decision.highCents===undefined?'Open upper amount':formatCad(l.decision.highCents)}`}]:[]),...(l.decision?.scheduleActualCents!==undefined?[{label:`${i+1}. Progress already in schedule`,value:formatCad(l.decision.scheduleActualCents)}]:[]),...(l.decision?.targetCents!==undefined?[{label:`${i+1}. Target and deadline`,value:`${formatCad(l.decision.targetCents)} · ${l.decision.deadline??'No deadline'}`}]:[]),...(['nextStep','timeConstraint','reopenWhen'] as const).flatMap(key=>l.decision?.[key]?[{label:`${i+1}. ${key==='nextStep'?'Next step':key==='timeConstraint'?'Time constraint':'Reopen when'}`,value:l.decision[key]!}]:[]),...(l.decision?.paydays?.length?[{label:`${i+1}. Paydays`,value:l.decision.paydays.join(', ')}]:[]),...(l.decision?.contributionSchedule??[]).map(item=>({label:`${i+1}. Contribution ${item.date}`,value:formatCad(item.amountCents)}))]),
 ...built.assumptions.map((a,i)=>({label:`Expected assumption ${i+1}`,value:`${a.kind} · ${a.valueCents===undefined?'No exact amount':formatCad(a.valueCents)} · ${a.expectedDate??'No date'} · ${a.confidence} · reviewed ${a.observedAt.slice(0,10)}${a.lowCents!==undefined||a.highCents!==undefined?` · range ${a.lowCents===undefined?'open':formatCad(a.lowCents)} to ${a.highCents===undefined?'open':formatCad(a.highCents)}`:''} · ${a.sourceReferences.map(r=>`${r.type}: ${r.id}`).join(', ')}`})),
 {label:'What the books support',value:p.kind==='ready'?`Current money ${formatCad(p.cashNowCents!)}. Lowest balance ${formatCad(p.lowPoint!.balanceCents)} on ${p.lowPoint!.date}. Everyday from current money ${formatCad(p.everydayNowCents!)}.`:p.issues.join(' ')},
 ...p.lines.flatMap((l,i)=>[{label:`Coverage ${i+1}: ${l.line.labelSnapshot}`,value:`${l.status.replaceAll('-',' ')} · ${formatCad(l.coveredNowCents)} now · ${formatCad(l.expectedCoverageCents)} dependent on future money${l.issues.length?` · ${l.issues.join(' ')}`:''}`}]),
 {label:'Private note and open questions',value:built.note||'No extra note'},
 ]; }
export const planGuideAction:ActionDefinition={id:PLAN_GUIDE_ID,title:'Create a Plan with Hercules',example:'Help me create a plan',match:/\b(?:(?:help (?:me|us) |let.s )?(?:create|make|build|start|set up|plan) (?:a |an |my |our |the )?(?:household |personal |monthly )?(?:plan|budget)|help (?:me|us) (?:with (?:my |our |the )?plan|plan (?:my|our|the) month))\b/i,views:['household','personal'],fields:[],dynamicFields:planGuideFields,
 consequence:'Save the reviewed decisions to your private Plan draft. Your conversation and private life note are not shared. Sharing a proposal, partner acknowledgement and recording money remain separate reviewed actions.',
 dependencies:(c,v)=>({month:guideMonth(c,v),today:c.today,baseline:base(c,v),bills:bills(c),goals:goals(c),income:incomeSources(c,v),projection:(()=>{const {sourceRevision:_revision,...result}=guideProjection(c,v);return result;})()}),
 execute:(c,v,id)=>{const built=buildGuidedPlan(c,v,id),draft=prior(c,v);return savePlanDraft(c.household,{...(draft?{id:draft.id,expectedUpdatedAt:draft.updatedAt}: {id:`GUIDED-PLAN-${id}`}),memberId:c.memberId,createdBy:c.memberId,scope:c.view,targetMonth:built.monthKey,...(draft?.baseVersionId?{baseVersionId:draft.baseVersionId}:!draft&&base(c,v)&&'digest'in base(c,v)!?{baseVersionId:base(c,v)!.id}:{}),lines:built.lines,assumptions:built.assumptions,note:built.note});},
};
