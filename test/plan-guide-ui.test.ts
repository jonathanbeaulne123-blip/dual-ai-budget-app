// @vitest-environment jsdom
import {act,createElement,createRef} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,describe,it,expect} from 'vitest';
import {HerculesActionPanel,type HerculesActionHandle} from '../src/HerculesActionPanel.tsx';
import {planLifeFixture} from './fixtures/plan-life.ts';
import {companionFor} from '../src/core/herculesCompanion.ts';
import {capturedIntent} from '../src/ledgerSync/capture.ts';
import type {HerculesCommandService} from '../src/herculesCommandService.ts';
(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
let root:Root,host:HTMLDivElement;
beforeEach(()=>{localStorage.clear();host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
const ready={monthKey:'2026-09',purpose:'Make room for rest',incomeSource:'skip',protectSource:'skip',prepareSource:'skip',buildSource:'skip',everydaySource:'skip',constraints:'Friday evenings stay free'};
function setup(composerAvailable=true){let h=planLifeFixture('household');h.companionProfile=companionFor(h,'MEM-001');let domainWrites=0,failSave=false;const replies:string[]=[];const ref=createRef<HerculesActionHandle>();const receipts=new Set<string>();const service:HerculesCommandService={execute:async(fn,options)=>{if(failSave)return null;const result=fn(structuredClone(h));if(capturedIntent(result.household)?.steps.some(s=>s.kind==='executeHerculesAction'))domainWrites++;h=result.household;receipts.add(options?.confirmationId??'');render();return{kind:'synchronized',ok:true,household:h,postedExactlyOnce:true,postedNothing:false,confirmationId:options?.confirmationId} as any;},readSubmission:async id=>receipts.has(id)?'accepted':'missing'};function render(){root.render(createElement(HerculesActionPanel,{ref,composerAvailable,context:{household:h,memberId:'MEM-001',view:'household',today:'2026-09-11',planMonth:'2026-09'},identity:'guide-test:owner',service,onReply:(_q,r)=>replies.push(r)}));}return{ref,render,replies,get household(){return h;},get writes(){return domainWrites;},fail(value:boolean){failSave=value;},async reload(){await act(async()=>root.unmount());root=createRoot(host);await act(async()=>render());}};}
async function click(label:string){await act(async()=>{const b=[...host.querySelectorAll('button')].find(b=>b.textContent===label);expect(b,`Missing ${label}`).toBeDefined();b!.click();});}
async function say(s:ReturnType<typeof setup>,message:string){await act(async()=>{expect(s.ref.current!.send(message)).toBe(true);});}
describe('one-question Plan conversation',()=>{
 it('recognizes the request and exposes one question, with explanations that do not change answers',async()=>{const s=setup();await act(async()=>s.render());await say(s,'Help me create a plan');expect(host.querySelectorAll('.hercules-plan-question h4')).toHaveLength(1);expect(host.querySelectorAll('input,textarea')).toHaveLength(0);expect(host.textContent).not.toContain('Expected contribution');const values=structuredClone(s.household.companionProfile!.workflows![0]!.value!.values);await say(s,'why?');expect(s.replies.at(-1)).toContain('purpose');expect(s.household.companionProfile!.workflows![0]!.value!.values).toEqual(values);expect(s.writes).toBe(0);});
 it('retains answers across pause and reload and resumes at the missing question',async()=>{const s=setup();await act(async()=>s.render());await say(s,'Help me create a plan');await say(s,'Make room for rest');await click('Pause planning');await s.reload();expect(host.textContent).toContain('planning conversation is paused');expect(s.household.companionProfile!.workflows![0]!.value!.values.purpose).toBe('Make room for rest');await click('Continue planning');expect(host.textContent).toContain('future money');expect(host.textContent).toContain('Make room for rest');expect(s.writes).toBe(0);});
 it('keeps a locally collected answer when private save fails and permits retry',async()=>{const s=setup();await act(async()=>s.render());s.fail(true);await say(s,'Help me create a plan');expect(host.textContent).toContain('private save has not been confirmed');await say(s,'Less scrambling');await s.reload();expect(host.textContent).toContain('Less scrambling');s.fail(false);await say(s,'skip');expect(s.household.companionProfile!.workflows![0]!.value!.values.purpose).toBe('Less scrambling');expect(s.writes).toBe(0);});
 it('builds an exact private review, retains correction controls, and confirms no financial entry or shared proposal',async()=>{const s=setup();await act(async()=>s.render());const before=structuredClone(s.household);await act(async()=>s.ref.current!.propose({actionId:'plan-guided-draft',values:ready}));await click('Review changes');expect(host.textContent).toContain('Dates checked');expect(host.textContent).toContain('Friday evenings stay free');await act(async()=>{s.ref.current!.send('yes');});expect(s.writes).toBe(0);await click('Edit details');await act(async()=>{await new Promise(resolve=>requestAnimationFrame(resolve));});expect(document.activeElement).toBe(host.querySelector('.hercules-plan-recap summary'));await click('Edit what matters this month');expect(host.textContent).toContain('What would make this month');await act(async()=>s.ref.current!.propose({actionId:'plan-guided-draft',values:ready}));await click('Review changes');await click('Final Confirm');expect(s.writes).toBe(1);expect(s.household.transactions).toEqual(before.transactions);expect(s.household.planVersions).toEqual(before.planVersions);expect(s.household.planDrafts![0]!.note).toContain('Make room for rest');});
 it('does not replace another unfinished action with the Plan launcher',async()=>{const s=setup();await act(async()=>s.render());await say(s,'I spent $20');await act(async()=>s.ref.current!.propose({actionId:'plan-guided-draft',values:{monthKey:'2026-09'}}));expect(s.ref.current!.state()?.actionId).toBe('expense');expect(host.textContent).toContain('Finish or cancel it before starting another');});
});

describe('guided adapter replacement and review bounds',()=>{
 it('reopens goal details when a proposed source changes',async()=>{const s=setup();await act(async()=>s.render());const a=s.household.goals[0]!,b={...s.household.goals[1]!,id:'new-visible-goal',name:'Another visible goal'};s.household.goals.push(b);await act(async()=>s.ref.current!.propose({actionId:'plan-guided-draft',values:{...ready,prepareSource:a!.id,prepareTarget:'1200',prepareDeadline:'2026-12-01',preparePaydays:'Decide later',prepareAmount:'300',prepareDate:'2026-09-18',prepareFunding:'available',prepareStep:'Get a quote'}}));await act(async()=>s.ref.current!.propose({actionId:'plan-guided-draft',values:{prepareSource:b!.id}}));const values=s.household.companionProfile!.workflows![0]!.value!.values;expect(values.prepareSource).toBe(b!.id);expect(values.prepareTarget).toBeUndefined();expect(values.prepareAmount).toBeUndefined();expect(host.textContent).toContain('best estimate of the total');expect(s.writes).toBe(0);});
 it('rejects an oversized review before creating a pending claim, preserving editable answers',async()=>{const s=setup();const original=s.household.planDrafts![0]!.lines[0]!;s.household.planDrafts![0]!.lines=Array.from({length:100},(_,i)=>({...original,id:`long-${i}`,labelSnapshot:`A long retained intention ${i}`,sourceReference:undefined}));await act(async()=>s.render());await act(async()=>s.ref.current!.propose({actionId:'plan-guided-draft',values:ready}));await click('Review changes');expect(host.textContent).toContain('too large to save safely');expect(host.textContent).toContain('Answers so far');expect(s.household.companionProfile!.workflows![0]!.value!.submission).toBeNull();expect(s.writes).toBe(0);await s.reload();expect(host.textContent).not.toContain('awaiting its receipt');expect(host.textContent).toContain('Make room for rest');});
});

it('collects a free-text answer and completes a private review when conversation is disabled',async()=>{
 const s=setup(false);await act(async()=>s.render());await say(s,'Help me create a plan');
 const input=host.querySelector('.hercules-plan-question input')!;
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'Make room for rest');input.dispatchEvent(new Event('input',{bubbles:true}));});
 await act(async()=>host.querySelector('.hercules-plan-question form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 expect(host.textContent).toContain('future money');
 for(let i=0;i<5;i++)await click('Leave this part open for now');
 await click('Nothing to add for now');await click('Review changes');await click('Final Confirm');
 expect(s.writes).toBe(1);expect(s.household.planDrafts![0]!.note).toContain('Make room for rest');
});

it('builds one small savings goal in conversation, retains the monthly Plan and creates an unfunded Kitty only on confirm',async()=>{
 const s=setup();await act(async()=>s.render());const before=structuredClone(s.household);
 await say(s,'I want to save money for a date with Bianca');expect(host.textContent).toContain('One goal');expect(host.textContent).not.toContain('Is there future money');
 for(const answer of ['new-kitty','120','2026-09-25','Decide later','60','2026-09-18','unknown','Choose a restaurant','Keep Friday evening free'])await say(s,answer);
 await click('Review changes');expect(s.writes).toBe(0);expect(s.household.goals).toEqual(before.goals);expect(host.textContent).toContain('$0.00 reserved');expect(host.textContent).toContain('a date with Bianca');
 await click('Final Confirm');expect(s.writes).toBe(1);expect(s.household.goals).toHaveLength(before.goals.length+1);expect(s.household.transactions).toEqual(before.transactions);
 const goal=s.household.goals.at(-1)!;expect(goal).toMatchObject({name:'a date with Bianca',savedCents:0,funded:false});
 const draft=s.household.planDrafts!.find(d=>d.ownerMemberId==='MEM-001')!;expect(draft.lines.slice(0,before.planDrafts![0]!.lines.length)).toEqual(before.planDrafts![0]!.lines);expect(draft.lines.at(-1)).toMatchObject({sourceReference:{type:'goal',id:goal.id},amountCents:6000});
 await say(s,'final confirm');expect(s.writes).toBe(1);
});

it('pivots into a focused savings request while keeping the earlier conversation resumable',async()=>{
 const s=setup();await act(async()=>s.render());await say(s,'Help me create a plan');await say(s,'Less rushing');
 await say(s,'I want to save $1,000 for a trip');const task=s.household.companionProfile!.workflows![0]!.value!;expect(task.values).toMatchObject({guideMode:'goal',buildLabel:'a trip',buildTarget:'1000'});expect(task.queue?.[0]?.values.purpose).toBe('Less rushing');expect(s.writes).toBe(0);
 const before=structuredClone(task.values);await act(async()=>expect(s.ref.current!.send('Actually make it $150')).toBe(false));expect(s.household.companionProfile!.workflows![0]!.value!.values).toEqual(before);
});
