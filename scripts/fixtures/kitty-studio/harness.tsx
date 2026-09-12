// Fictional Kitty Bank Studio fixture: the real room over planLifeFixture books. Local proof only.
import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { KittyBankRoom } from '/src/kitty/KittyBankRoom.tsx';
import { planLifeFixture } from '/test/fixtures/plan-life.ts';
import { saveGoalEnvelope, fundGoal, recordBillPayment, allocateHouseholdFundSurplus } from '/src/core/index.ts';
import { defaultGoalEnvelope } from '/src/core/goalEnvelopes.ts';
import { newKittyPiece } from '/src/core/kittyStudio.ts';
import { KittyNest } from '/src/kitty/KittyNest.tsx';
import { HouseholdHome } from '/src/HouseholdHome.tsx';
import { PlanStudio } from '/src/PlanStudio.tsx';
import { OnboardingJourney } from '/src/OnboardingJourney.tsx';
import { ThemeProvider, useSceneBinding } from '/src/theme/ThemeProvider.tsx';
import { AppearanceStore } from '/src/theme/appearanceStore.ts';
import '/src/theme/worlds.css';
import '/src/theme/theme-reference.css';
import '/src/theme/page-plan.css';
import '/src/styles.css';
import '/src/hearth-theme.css';
const q = new URLSearchParams(location.search);
const view = (q.get('view') === 'personal' ? 'personal' : 'household') as 'personal' | 'household';
const theme = q.get('theme') || 'classic';
document.documentElement.dataset.theme = theme;
const member = 'MEM-001';
let initial = planLifeFixture(view);
const goal = initial.goals[0]!;
const seed = q.get('seed');
if (seed) {
  // A painted draft on the wheel, or a fired piece on the shelf.
  const piece = newKittyPiece('seed-piece', '2026-09-11T10:00:00.000Z', '#3f6fa3');
  piece.sculpt = { ...piece.sculpt, body: 'pear', head: 'chubby', ears: 'round', eyes: 'sparkle', mouth: 'smile', whiskers: 'long', tail: 'up', nose: 'heart', profile: [1.08, 0.9, 0.85, 0.62], features: { eyes: 1.35, ears: 1.2, tail: 0.8 } };
  piece.paint = { base: '#3f6fa3', parts: { head: '#f6f1e7', earL: '#e8742d', earR: '#e8742d', tail: '#e3a534' }, strokes: [
    { part: 'body', tool: 'brush', color: '#f3e08a', size: 18, opacity: 0.9, mirror: true, pts: [0.42, 0.5, 0.45, 0.62, 0.5, 0.7] },
    { part: 'body', tool: 'sponge', color: '#ef8fb8', size: 30, opacity: 0.8, mirror: false, pts: [0.2, 0.4, 0.22, 0.45, 0.25, 0.5] },
    { part: 'head', tool: 'marker', color: '#a3283d', size: 10, opacity: 1, mirror: true, pts: [0.4, 0.6, 0.44, 0.66, 0.48, 0.7] },
  ], stamps: [
    { id: 'st1', anchor: 'forehead', part: 'head', u: 0.5, v: 0.8, kind: 'sun-hat', color: '#e3a534', trim: '#a3283d', size: 0.44, rotation: 0 },
    { id: 'st2', anchor: 'belly', part: 'body', u: 0.5, v: 0.64, kind: 'heart', color: '#a3283d', size: 0.26, rotation: 0 },
    { id: 'st3', anchor: 'leftFlank', part: 'body', u: 0.33, v: 0.52, kind: 'sunglasses', color: '#2b2926', trim: '#3f6fa3', size: 0.3, rotation: -10 },
    { id: 'st4', anchor: 'rightFlank', part: 'body', u: 0.68, v: 0.45, kind: 'palm', color: '#4a7a4a', trim: '#7a5a33', size: 0.34, rotation: 8 },
    { id: 'st5', anchor: 'chest', part: 'body', u: 0.5, v: 0.8, kind: 'initial', color: '#2b2926', size: 0.24, rotation: -10, text: 'JB' },
  ] };
  const studio = seed === 'fired' ? { version: 1 as const, draft: null, fired: [{ ...piece, firedAt: '2026-09-11T11:00:00.000Z', firedBy: member }] } : { version: 1 as const, draft: piece, fired: [] };
  initial = saveGoalEnvelope(initial, { goalId: goal.id, expectedUpdatedAt: goal.updatedAt, name: goal.name, target: goal.targetCents / 100, arrivalDate: goal.arrivalDate, envelope: { ...defaultGoalEnvelope(), studio }, createdBy: member }).household;
}
if(q.get('paid')){const r=initial.recurrences[0]!;initial=recordBillPayment(initial,{recurrenceId:r.id,occurrenceDate:r.nextDate,paymentDate:'2026-09-11',amount:r.amountCents/100,accountId:r.accountId,createdBy:member}).household;}
const route=q.get('route') || 'gallery';
const store=new AppearanceStore({read:async()=>null,write:async()=>{} } as any,null,()=>false);store.preview(theme as any);
function Harness() {
  useSceneBinding(route === 'home' ? 'home' : 'plan',view,true);
  const [request,setRequest]=useState<{goalId?:string;bankId?:string}|null>(route === 'gallery' ? q.get('bank') ? {bankId:q.get('bank')!} : {goalId:goal.id} : null);
  const [h, setH] = useState(initial);
  const ref = useRef(h); ref.current = h;
  (window as any).deposit = () => { const g = ref.current.goals[0]!; const next = view === 'personal' ? fundGoal(ref.current, { goalId: g.id, amount: 150, fromAccountId: 'ACC-CHEQUING', date: '2026-09-11', createdBy: member }).household : allocateHouseholdFundSurplus(ref.current, { memberId: member, date: '2026-09-11', allocations: [{ goalId: g.id, amount: '150' }] }).household; ref.current = next; setH(next); };
  (window as any).books = () => ref.current;
  const command=async (fn:any,options?:any) => {const result=fn(ref.current);ref.current=result.household;setH(result.household);return {ok:true,household:result.household,confirmationId:options?.confirmationId};};
  const select=(bank:any)=>setRequest(bank.goal ? {goalId:bank.goal.id} : {bankId:bank.id});
  return <div className="app" data-ledger-view={view} data-ledger-tab={route === 'home' ? 'home' : 'plan'} style={{maxWidth:1600,margin:'auto',padding:'16px 16px 100px'}}>
    <p className="kicker">Fictional local fixture · Development · no connected accounts</p>
    {route==='home' && (view==='household' ? <HouseholdHome household={h} memberId={member} today="2026-09-12" freshness="current" busy={false} onCommand={command} onGo={()=>{}} onOpenSetup={()=>{}} /> : <KittyNest household={h} memberId={member} view={view} today="2026-09-12" onSelect={select}/>)}
    {route==='plan' && <PlanStudio household={h} view={view} memberId={member} today="2026-09-12" busy={false} onCommand={command} goalsContent={context=><KittyBankRoom household={h} view={view} memberId={member} identity="fixture-plan" context={context} onCommand={command} onClose={context.onClose}/>} />}
    {route==='setup' && <OnboardingJourney household={h} memberId={member} onGo={destination=>{if(destination==='king')setRequest({bankId:'king'});}}/>}
    {request && <KittyBankRoom household={h} view={view} memberId={member} identity={`development:fixture:${member}:${view}`} initialGoalId={request.goalId} initialBankId={request.bankId} onClose={()=>setRequest(null)} onCommand={command}/>}
  </div>;
}
createRoot(document.getElementById('root')!).render(<ThemeProvider store={store}><Harness /></ThemeProvider>);
