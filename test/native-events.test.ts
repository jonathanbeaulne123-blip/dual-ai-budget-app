import {prepareAction, executeReviewedAction} from '../src/core/herculesActions.ts';
import {describe,it,expect} from 'vitest';
import {catalogHousehold} from '../src/core/index.ts';
import {nativeEventInstant, nativeEventOccurrences, saveNativeEvent, validateNativeEvent, type NativeEvent} from '../src/core/nativeEvents.ts';
import {splitForSync,assembleHousehold} from '../src/core/sync.ts';
import {householdForView} from '../src/core/visibility.ts';
import {buildHouseholdIcs} from '../src/core/ics.ts';
import {shapePotentialExpenseCalendarLink} from '../src/core/potentialExpenses.ts';
const event=(patch:Partial<NativeEvent>={}):NativeEvent=>({version:1,id:'EVENT-test',revision:1,createdBy:'MEM-001',visibility:'household',title:'Dinner',start:'2026-09-10T18:00',end:'2026-09-10T20:00',allDay:false,timezone:'America/Toronto',fold:'earlier',repeat:'none',until:null,location:'Home',notes:'Bring dessert',exceptions:{},deleted:false,createdAt:'2026-09-10T12:00:00.000Z',updatedAt:'2026-09-10T12:00:00.000Z',...patch});
describe('native calendar events',()=>{
 it('requires an explicit reviewed choice before resetting exceptions during a series move',()=>{
  const h={...catalogHousehold(),nativeEvents:[event({start:'2026-09-14T18:00',end:'2026-09-14T20:00',repeat:'weekly',exceptions:{'2026-09-21':{cancelled:true}}})]};
  const c={household:h,memberId:'MEM-001',view:'household' as const,today:'2026-09-10'};
  const values={id:'EVENT-test',applyTo:'series',start:'2026-09-15T18:00',end:'2026-09-15T20:00'};
  expect(()=>prepareAction(c,'move-event',values)).toThrow();
  expect(()=>prepareAction(c,'move-event',{...values,exceptions:'keep'})).toThrow(/occurrence/);
  const review=prepareAction(c,'move-event',{...values,exceptions:'reset'});
  expect(JSON.stringify(review)).toContain('Reset every changed');
  const moved=executeReviewedAction(c,review,crypto.randomUUID()).household.nativeEvents![0]!;
  expect(moved.start).toBe(values.start);expect(moved.exceptions).toEqual({});
  expect(h.nativeEvents[0]!.exceptions['2026-09-21']?.cancelled).toBe(true);
 });
 it('rejects spring clock gaps and explicitly resolves autumn repeated hours',()=>{
  expect(()=>nativeEventInstant('2026-03-08T02:30','America/Toronto')).toThrow(/clocks change/);
  expect(nativeEventInstant('2026-11-01T01:30','America/Toronto','earlier')).toBe('2026-11-01T05:30:00.000Z');
  expect(nativeEventInstant('2026-11-01T01:30','America/Toronto','later')).toBe('2026-11-01T06:30:00.000Z');
  expect(nativeEventInstant('2026-09-10T18:00','Asia/Kolkata')).toBe('2026-09-10T12:30:00.000Z');
 });
 it('projects overlapping all-day events and preserves weekly instance moves and cancellations',()=>{
  const trip=event({allDay:true,start:'2026-09-08',end:'2026-09-12'});
  expect(nativeEventOccurrences(trip,'2026-09-10','2026-09-11')).toHaveLength(1);
  const repeat=event({repeat:'weekly',exceptions:{'2026-09-10':{cancelled:false,start:'2026-09-25T18:00',end:'2026-09-25T20:00'},'2026-09-17':{cancelled:true}}});
  expect(nativeEventOccurrences(repeat,'2026-09-17','2026-09-25').map(o=>o.date)).toEqual(['2026-09-24','2026-09-25']);
  expect(()=>validateNativeEvent({...repeat,exceptions:{'2026-09-11':{cancelled:true}}})).toThrow(/occurrence/);
  expect(()=>validateNativeEvent({...repeat,until:'2026-09-17',exceptions:{'2026-09-24':{cancelled:true}}})).toThrow(/occurrence/);
 });
 it('keeps spring recurrence warnings visible and skips nonexistent monthly dates',()=>{
  const spring=event({start:'2026-03-01T02:30',end:'2026-03-01T03:30',repeat:'weekly'});
  expect(nativeEventOccurrences(spring,'2026-03-08','2026-03-08')[0]?.warning).toMatch(/clocks change/);
  const monthly=event({allDay:true,start:'2026-01-31',end:'2026-01-31',repeat:'monthly'});
  expect(nativeEventOccurrences(monthly,'2026-02-01','2026-03-31').map(o=>o.date)).toEqual(['2026-03-31']);
 });
 it('round-trips private events without leaking them to shared or peer views',()=>{
  const h={...catalogHousehold(),nativeEvents:[event(),event({id:'EVENT-private',visibility:'personal',title:'Private date'})]};
  const split=splitForSync(h,'MEM-001');expect(split.shared.nativeEvents).toHaveLength(1);expect(split.personal.nativeEvents).toHaveLength(1);
  const restored=assembleHousehold(split.shared,split.personal);expect(restored.nativeEvents).toHaveLength(2);
  expect(householdForView(restored,'MEM-002','household').nativeEvents?.some(e=>e.id==='EVENT-private')).toBe(false);
 });
 it('requires current revisions, preserves deletion markers, and protects private ownership',()=>{
  const h={...catalogHousehold(),nativeEvents:[event({visibility:'personal'})]};const {version,id,revision,createdBy,createdAt,updatedAt,...input}=h.nativeEvents[0]!;
  expect(()=>saveNativeEvent(h,{memberId:'MEM-002',id,expectedRevision:1,event:input})).toThrow(/private/);
  expect(()=>saveNativeEvent(h,{memberId:'MEM-001',id,expectedRevision:0,event:input})).toThrow(/changed/);
  const removed=saveNativeEvent(h,{memberId:'MEM-001',id,expectedRevision:1,event:{...input,deleted:true}}).household;
  expect(removed.nativeEvents?.[0]).toMatchObject({deleted:true,revision:2});expect(nativeEventOccurrences(removed.nativeEvents![0]!,'2026-09-01','2026-10-01')).toEqual([]);
 });
 it('retains potential-expense links and exports all-day and detached recurring instances',()=>{
  expect(shapePotentialExpenseCalendarLink({source:'event',id:'EVENT-test',title:'Dinner'})).toEqual({source:'event',id:'EVENT-test',title:'Dinner'});
  const h={...catalogHousehold(),nativeEvents:[event({allDay:true,start:'2026-09-10',end:'2026-09-12'}),event({id:'EVENT-repeat',repeat:'weekly',exceptions:{'2026-09-17':{cancelled:true},'2026-09-24':{cancelled:false,start:'2026-09-25T18:00',end:'2026-09-25T20:00'}}})]};
  const ics=buildHouseholdIcs(h,'2026-09-10');expect(ics).toContain('DTEND;VALUE=DATE:20260913');expect(ics).toContain('RRULE:FREQ=WEEKLY');expect(ics).toContain('EXDATE;TZID=America/Toronto:20260917T180000');expect(ics).toContain('RECURRENCE-ID;TZID=America/Toronto:20260924T180000');
 });
});
