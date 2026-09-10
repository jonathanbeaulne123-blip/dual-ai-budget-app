import {describe,it,expect} from 'vitest';
import {catalogHousehold} from '../src/core/index.ts';
import {prepareAction,executeReviewedAction,type ActionContext} from '../src/core/herculesActions.ts';
import {addAppointment} from '../src/core/commands.ts';
const context=():ActionContext=>({household:catalogHousehold(),memberId:'MEM-001',view:'household',today:'2026-09-10'});
const appointment={title:'Synthetic dentist',kind:'dentist' as const,memberId:'MEM-001',nextDate:'2026-09-14',cadence:{kind:'monthly' as const,interval:6},sensitivity:'quiet' as const,coverage:'private' as const,accountId:'ACC-VISA',subcategoryId:'SUB-FOOD-GROCERIES',typicalCost:'120',typicalRecovery:'80',place:'Synthetic practice',practitioner:'Synthetic practitioner'};
function visitContext(){const c=context();c.household=addAppointment(c.household,{...appointment,sensitivity:"household"}).household;return c;}
const run=(c:ActionContext,id:string,values:Record<string,string>)=>executeReviewedAction(c,prepareAction(c,id,values),crypto.randomUUID()).household;
describe('appointment and claim conversations',()=>{
 it('never silently clamps a reviewed repeat interval or weekday ordinal',()=>{
  const c=context(),base={...appointment,cadence:'monthly',interval:'37'};
  expect(()=>prepareAction(c,'add-appointment',base)).toThrow(/36/);
  expect(()=>prepareAction(c,'add-appointment',{...base,cadence:'nthWeekday',weekday:'1',nth:'5',intervalMonths:'1'})).toThrow();
  const saved=run(c,'add-appointment',{...base,cadence:'nthWeekday',weekday:'1',nth:'-1',intervalMonths:'18'});
  expect(saved.appointments.at(-1)!.cadence).toEqual({kind:'nthWeekday',weekday:1,nth:-1,intervalMonths:18});
 });
 it('matches the screen appointment command and moves dates without changing expectations',()=>{
  const c=context(),values={...appointment,cadence:'monthly',interval:'6'};
  const result=run(c,'add-appointment',values);
  const actual=result.appointments.at(-1)!;
  const {typicalCost,typicalRecovery,...expected}=appointment;expect(actual).toMatchObject({...expected,typicalCostCents:12000,typicalRecoveryCents:8000});
  const moved=run({...c,household:result},'move-appointment',{appointmentId:actual.id,nextDate:'2026-09-18'});
  expect(moved.appointments.at(-1)).toMatchObject({nextDate:'2026-09-18',cadence:actual.cadence,typicalCostCents:12000});
  expect(moved.transactions).toEqual(c.household.transactions);
 });
 it('records one visit and one linked claim, then receives the exact remainder as transfers',()=>{
  const c=visitContext(),id=c.household.appointments.at(-1)!.id;
  const beforeClaims=c.household.claims.length;
  const visited=run(c,'record-visit',{appointmentId:id,date:'2026-09-14',amount:'120',accountId:'ACC-VISA',subcategoryId:'SUB-FOOD-GROCERIES',split:'MEM-001',expectedRecovery:'80',claimKind:'insurance',claimLabel:'Synthetic reimbursement',craEligible:'false'});
  expect(visited.claims).toHaveLength(beforeClaims+1);
  const claim=visited.claims.at(-1)!;
  expect(claim.expectedCents).toBe(8000);expect(claim.receivedCents).toBe(0);
  const account=visited.accounts.find(a=>a.active&&a.scope!=='personal'&&a.kind==='chequing')!;
  const settled=run({...c,household:visited},'receive-claim',{claimId:claim.id,date:'2026-09-15',amount:'80',toAccountId:account.id});
  expect(settled.claims.at(-1)!.receivedCents).toBe(8000);
  const newTx=settled.transactions.filter(t=>!visited.transactions.some(p=>p.id===t.id));
  expect(newTx).toHaveLength(2);expect(newTx.every(t=>t.type==='transfer')).toBe(true);
  expect(()=>prepareAction({...c,household:visited},'open-claim',{expenseTransactionId:claim.expenseTransactionId,expectedRecovery:'80',claimKind:'insurance',craEligible:'false'})).toThrow();
 });
 it('invalidates a claim review if its accepted history changes',()=>{
  const c=visitContext(),id=c.household.appointments.at(-1)!.id;
  c.household=run(c,'record-visit',{appointmentId:id,date:'2026-09-14',amount:'120',accountId:'ACC-VISA',subcategoryId:'SUB-FOOD-GROCERIES',split:'MEM-001',expectedRecovery:'80',claimKind:'insurance',craEligible:'false'});
  const claim=c.household.claims.at(-1)!;
  const review=prepareAction(c,'writeoff-claim',{claimId:claim.id,date:'2026-09-15',amount:'20',denied:'true'});
  const changed=structuredClone(c);changed.household.claims.at(-1)!.receivedCents=1000;
  expect(()=>executeReviewedAction(changed,review,crypto.randomUUID())).toThrow(/changed/);
  expect(()=>prepareAction({...c,view:'personal'},'record-visit',{})).toThrow();
 });
});
