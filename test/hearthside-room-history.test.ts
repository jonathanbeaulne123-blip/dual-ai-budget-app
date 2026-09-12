import {expect,it} from 'vitest';
import {catalogHousehold} from '../src/core/index.ts';
import {commitHearthside,type HearthsideOperation} from '../src/hearthside/commands.ts';
import {emptyHearthside,decodeHearthside} from '../src/hearthside/contracts.ts';
import {captureRoom,recordedRoomKept,roomHistoryItemAvailable,roomContent} from '../src/hearthside/roomHistory.ts';
import {financialAuditHash} from '../src/core/commandIdentity.ts';
import {appendRestorePoint,applyRestorePoint} from '../src/core/restorePoints.ts';
import {hearthsideAuthorityHarness} from './fixtures/hearthsideAuthorityHarness.ts';
const note={version:1 as const,id:'NOTE-evening',revision:1,authorId:'MEM-001',text:'The kettle is on.',room:'common' as const,experienceId:null,archived:false};
it('records exact source words and positions, requires both choices and keeps withdrawal effective after financial restoration',async()=>{
 const run=(h:ReturnType<typeof catalogHousehold>,operation:HearthsideOperation,memberId='MEM-001')=>commitHearthside(h,{version:1,id:crypto.randomUUID(),scope:{environment:h.environment,householdId:h.householdId,memberId},operation}).household;
 const h={...catalogHousehold(),hearthside:{...emptyHearthside(),notes:[note]}};
 const frame=captureRoom(h,{id:'ROOM-one',title:'The first evening',room:'common'},'MEM-001');
 expect(frame.items).toEqual(roomContent(h,'common'));expect(JSON.stringify(frame)).not.toMatch(/balance|backing|amountCents|targetCents/);
 expect(()=>run(h,{kind:'room.capture',expectedRevision:0,value:{...frame,items:[{...frame.items[0]!,label:'Invented words'}]}})).toThrow('ROOM_CHANGED');
 let next=run(h,{kind:'room.capture',expectedRevision:0,value:frame});
 expect(()=>run(next,{kind:'room.capture',expectedRevision:0,value:frame})).toThrow('ALREADY_EXISTS');
 next=run(next,{kind:'room.keep',expectedRevision:1,id:frame.id});
 expect(recordedRoomKept(next.hearthside!.roomHistory![0]!,['MEM-001','MEM-002'])).toBe(false);
 next=run(next,{kind:'room.keep',expectedRevision:1,id:frame.id},'MEM-002');
 expect(recordedRoomKept(next.hearthside!.roomHistory![0]!,['MEM-001','MEM-002'])).toBe(true);
 next=run(next,{kind:'note.save',expectedRevision:1,value:{...note,revision:2,text:'We had cocoa instead.'}});
 expect(next.hearthside!.roomHistory![0]!.items[0]!.label).toBe('The kettle is on.');
 expect(decodeHearthside(JSON.parse(JSON.stringify(next.hearthside)))).toEqual(next.hearthside);
 next=run(next,{kind:'note.save',expectedRevision:2,value:{...note,revision:3,archived:true}});
 expect(roomHistoryItemAvailable(next,frame.items[0]!)).toBe(false);
 next=await appendRestorePoint(next,'MEM-001');const point=next.restorePoints!.at(-1)!;
 next=run(next,{kind:'room.withdraw',expectedRevision:1,id:frame.id});
 const restored=applyRestorePoint(next,point,'MEM-001');
 expect(restored.hearthside?.roomHistory?.[0]?.withdrawn).toBe(true);
 expect(()=>run(restored,{kind:'room.keep',expectedRevision:2,id:frame.id})).toThrow('UNAVAILABLE');
});
it('records and mutually keeps the actual room through two authenticated local Worker sessions and recovers the same acceptance',async()=>{
 const app=await hearthsideAuthorityHarness('HH-room-history');
 try{
  const money=await financialAuditHash(await app.household());
  expect(await app.submit({kind:'note.save',expectedRevision:0,value:note})).toMatchObject({type:'ack'});
  const draft=captureRoom(await app.household(),{id:'ROOM-coupled',title:'The room we came back to',room:'common'},'MEM-001');
  const capture=await app.command({kind:'room.capture',expectedRevision:0,value:draft});
  // A source changed after this exact review was made; the immutable draft is retained, never silently recaptured.
  expect(await app.submit({kind:'note.save',expectedRevision:1,value:{...note,revision:2,text:'The cocoa is ready.'}})).toMatchObject({type:'ack'});
  expect(await app.send(capture)).toMatchObject({type:'error',definitive:true});
  const current=captureRoom(await app.household(),{id:'ROOM-coupled',title:draft.title,room:'common'},'MEM-001');
  const command=await app.command({kind:'room.capture',expectedRevision:0,value:current}),receipt=await app.send(command);
  expect(receipt).toMatchObject({type:'ack'});expect(await app.send(command)).toEqual(receipt);
  for(const actor of ['MEM-001','MEM-002'])expect(await app.submit({kind:'room.keep',expectedRevision:1,id:current.id},actor)).toMatchObject({type:'ack'});
  const other=await app.household('MEM-002');expect(recordedRoomKept(other.hearthside!.roomHistory![0]!,['MEM-001','MEM-002'])).toBe(true);
  expect(await financialAuditHash(other)).toBe(money);
  expect(await app.submit({kind:'room.withdraw',expectedRevision:1,id:current.id},'MEM-002')).toMatchObject({type:'ack'});
  expect((await app.household()).hearthside?.roomHistory?.[0]?.withdrawn).toBe(true);
 }finally{await app.dispose();}
},60_000);
