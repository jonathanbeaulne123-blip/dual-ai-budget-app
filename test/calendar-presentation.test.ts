import { describe, it, expect } from 'vitest';
import { calendarDisplayDays, calendarItemReading, calendarLanes } from '../src/calendar/presentation.ts';
import { catalogHousehold, buildMonthBoard, addRecurrence, postEntry } from '../src/core/index.ts';
import type { BoardDay, BoardItem } from '../src/core/board.ts';

const span = (id:string,date:string,index:number,length:number):BoardItem => ({id:`${id}:${date}`,date,title:id,source:'event',kind:'event',direction:'busy',due:false,amountCents:0,span:{index,length}});
const day = (date:string,items:BoardItem[]):BoardDay => ({date,items,inMonth:true,isToday:false,isWeekend:false,inCents:0,outCents:0,heat:0});
describe('calendar presentation preserves financial models',()=>{
 it('uses received for a completed income occurrence',()=>{
  expect(calendarItemReading({...span('income','2026-09-11',0,1),direction:'in',completed:true},catalogHousehold()).statusLabel).toBe('Received');
 });
 it('reserves a lower lane after a shorter run ends',()=>{
  const a=span('a','2026-09-11',0,2),b=span('b','2026-09-12',0,3);
  const lanes=calendarLanes([day(a.date,[a]),day(b.date,[span('a',b.date,1,2),b]),day('2026-09-13',[span('b','2026-09-13',1,3)])]);
  expect(lanes[2]![0]).toBeNull();expect(lanes[2]![1]?.title).toBe('b');
 });
 it('keeps overlapping spans in their lane and hides overflowing runs consistently',()=>{
  const days=[day('2026-09-11',[span('a','2026-09-11',0,3)]),day('2026-09-12',[span('a','2026-09-12',1,3),span('b','2026-09-12',0,2)]),day('2026-09-13',[span('a','2026-09-13',2,3),span('b','2026-09-13',1,2)])];
  expect(calendarLanes(days).map(r=>r[0]?.title)).toEqual(['a','a','a']);
  expect(calendarLanes(days,1).map(r=>r.map(i=>i?.title))).toEqual([['a'],['a'],['a']]);
 });
 it('restores early matched payments on the occurrence date without changing board totals',()=>{
  let h=addRecurrence(catalogHousehold(),{cadence:'monthly',nextDate:'2026-10-15',type:'expense',amount:'25',accountId:'ACC-CHEQUING',subcategoryId:'SUB-LIFE-FUN',note:'Bill',kind:'bill'}).household;
  h=postEntry(h,{date:'2026-09-10',type:'expense',amount:'25',accountId:'ACC-CHEQUING',subcategoryId:'SUB-LIFE-FUN',note:'Paid early',createdBy:'MEM-001',visibility:'household',confirmDuplicate:true}).household;
  const tx=h.transactions.at(-1)!;const recurrence=h.recurrences.at(-1)!;
  tx.source='recurring';tx.sourceId=recurrence.id;
  recurrence.active=false;recurrence.payments=[{occurrenceDate:'2026-09-15',paymentDate:tx.date,amountCents:2500,accountId:tx.accountId,transactionId:tx.id,recordedBy:'MEM-001'}];
  const board=buildMonthBoard(h,'2026-09','2026-09-12');const before=JSON.stringify(board);
  const displayed=calendarDisplayDays(board.days,h);
  const paid=displayed.find(d=>d.date==='2026-09-15')!.items.find(i=>i.recurrenceId===recurrence.id)!;
  expect(calendarItemReading(paid,h).status).toBe('done');expect(JSON.stringify(board)).toBe(before);
  expect(displayed.find(d=>d.date===tx.date)!.items.some(i=>i.recurrenceId===recurrence.id)).toBe(false);
  const missing={...h,transactions:[]};expect(calendarDisplayDays(board.days,missing).flatMap(d=>d.items).some(i=>i.recurrenceId===recurrence.id)).toBe(false);
  h.transactions.push({...tx,id:'REV-test',reversalOfId:tx.id});
  expect(calendarDisplayDays(board.days,h).flatMap(d=>d.items).some(i=>i.recurrenceId===recurrence.id)).toBe(false);
  h.transactions.pop();
  tx.isDuplicate=true;expect(calendarDisplayDays(board.days,h).flatMap(d=>d.items).some(i=>i.recurrenceId===recurrence.id)).toBe(false);
 });
 it('keeps Google runs distinct across calendars with the same event identifier',()=>{
  const google=(calendarId:string,date:string,index:number):BoardItem=>({...span('same',date,index,2),id:`google:MEM-001:${calendarId}:same:${date}`,source:'google',kind:'google',calendarId,memberId:'MEM-001'});
  const lanes=calendarLanes(['2026-09-11','2026-09-12'].map((date,index)=>day(date,[google('one',date,index),google('two',date,index)])));
  expect(lanes.map(row=>row.map(item=>item?.calendarId))).toEqual([['one','two'],['one','two']]);
 });
 it('does not treat a named owner of a shared account as personal',()=>{
  const h=addRecurrence(catalogHousehold(),{cadence:'monthly',nextDate:'2026-09-15',type:'expense',amount:'25',accountId:'ACC-CHEQUING',subcategoryId:'SUB-LIFE-FUN',note:'Bill',kind:'bill'}).household;
  h.accounts.find(a=>a.id==='ACC-CHEQUING')!.ownerMemberId='MEM-001';
  const item=buildMonthBoard(h,'2026-09','2026-09-12').days.flatMap(d=>d.items).find(i=>i.recurrenceId===h.recurrences.at(-1)!.id)!;
  expect(calendarItemReading(item,h).owner).toBe('Shared');
 });
});
