import {expect,it} from 'vitest';
import {catalogHousehold} from '../src/core/index.ts';
import {commitHearthside} from '../src/hearthside/commands.ts';
import {emptyHearthside,decodeHearthside} from '../src/hearthside/contracts.ts';
import {financialAuditHash} from '../src/core/commandIdentity.ts';
import {decodeStudioHandoff,type StudioHandoff} from '../src/hearthside/studioHandoff.ts';
import {hearthsideAuthorityHarness} from './fixtures/hearthsideAuthorityHarness.ts';
const invitation:StudioHandoff={version:1,id:'HANDOFF-one',revision:1,authorId:'MEM-001',recipientId:'MEM-002',design:{version:1,documentId:'DESIGN-free',pieceId:'PIECE-free',revision:1},text:'I left a little space for your stars.',withdrawn:false};
it('keeps a shared invitation exact, attributable and optional, with independent author revisions',()=>{
 const initial={...catalogHousehold(),hearthside:{...emptyHearthside(),designs:[{version:1 as const,designId:'DESIGN-free',revision:3,displayPieceId:null,bankId:null,pieceIds:['PIECE-free']}]}};
 const run=(h:typeof initial,value:StudioHandoff,actor='MEM-001',expectedRevision=value.revision-1)=>commitHearthside(h,{version:1,id:crypto.randomUUID(),scope:{environment:h.environment,householdId:h.householdId,memberId:actor},operation:{kind:'studio.handoff',expectedRevision,value}}).household as typeof initial;
 const one=run(initial,invitation),two=run(one,{...invitation,id:'HANDOFF-two',authorId:'MEM-002',recipientId:'MEM-001',text:'A moon beside them.'},'MEM-002');
 expect(decodeHearthside(JSON.parse(JSON.stringify(two.hearthside))).handoffs).toHaveLength(2);
 expect(()=>run(two,{...invitation,revision:2},'MEM-002')).toThrow('AUTHOR_REQUIRED');
 expect(()=>run(two,{...invitation,id:'HANDOFF-duplicate'})).toThrow('ALREADY_EXISTS');
 expect(()=>run(two,{...invitation,revision:2,design:{...invitation.design,pieceId:'another'}})).toThrow('IDENTITY_CHANGED');
 expect(()=>run(two,{...invitation,revision:2},'MEM-001',0)).toThrow('HEARTHSIDE_CHANGED');
 expect(()=>decodeStudioHandoff({...invitation,readAt:'invented'})).toThrow();
 expect(run(two,{...invitation,revision:2,withdrawn:true}).hearthside.handoffs?.[0]?.authorId).toBe('MEM-002');
 expect(one.hearthside.handoffs?.[0]).toEqual(invitation);
});
it('admits handoffs through real LedgerRoom, retains original sculpture revision and prevents inviting into an archived piece',async()=>{
 const app=await hearthsideAuthorityHarness('HH-handoff');
 try{
  const money=await financialAuditHash(await app.household());
  const design=async(input:object)=>{const r=await app.post('design',{version:1,...input});expect(r.status,await r.clone().text()).toBe(200);return r.json();};
  await design({kind:'create',designId:'DESIGN-free',bankId:null});
  const common={version:1,designId:'DESIGN-free',pieceId:'PIECE-free'};
  await design({kind:'operate',operation:{...common,id:'OP-create',gestureId:'GESTURE-create',kind:'create-piece',base:'cream'}});
  const command=await app.command({kind:'studio.handoff',expectedRevision:0,value:invitation});
  const accepted=await app.send(command);expect(accepted).toMatchObject({type:'ack'});expect(await app.send(command)).toEqual(accepted);
  await design({kind:'operate',operation:{...common,id:'OP-paint',gestureId:'GESTURE-paint',kind:'append-stroke',expectedEditEpoch:0,surfaceRevision:0,stroke:{part:'body',tool:'brush',color:'#abcdef',size:12,opacity:1,mirror:false,pts:[.2,.2,.3,.3]}}});
  expect((await app.household('MEM-002')).hearthside?.handoffs).toEqual([invitation]);
  await design({kind:'operate',operation:{...common,id:'OP-archive',gestureId:'GESTURE-archive',kind:'archive-piece',expectedRevision:2}});
  expect(await app.submit({kind:'studio.handoff',expectedRevision:1,value:{...invitation,revision:2,text:'Come back'}})).toMatchObject({type:'error',definitive:true});
  expect(await app.submit({kind:'studio.handoff',expectedRevision:1,value:{...invitation,revision:2,withdrawn:true}})).toMatchObject({type:'ack'});
  expect(await financialAuditHash(await app.household())).toBe(money);
 }finally{await app.dispose();}
},60_000);
