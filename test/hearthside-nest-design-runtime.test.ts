import {capturedIntent} from '../src/ledgerSync/capture.ts';
import {commandFromCapture} from '../src/ledgerSync/protocol.ts';
import {MessageReader,encodeMessage} from '../src/ledgerSync/wire.ts';
import {expect,it} from 'vitest';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {catalogHousehold,financialAuditHash,addPotentialExpense,removePotentialExpense} from '../src/core/index.ts';
import {saveKittyNestDesign} from '../src/core/kittyNestDesigns.ts';
import {newKittyPiece} from '../src/core/kittyStudio.ts';
import {assembleHousehold} from '../src/core/sync.ts';
import {projectKittyDesign} from '../src/hearthside/design.ts';
import type {KittyDesignDocument,KittyDesignOperation} from '../src/hearthside/designContracts.ts';
it('migrates shared and personal Nest sources once in real LedgerRoom SQLite/R2, composes both authors and recovers the same source binding',async()=>{
 const bundle=await build({stdin:{resolveDir:process.cwd(),contents:`import {LedgerRoom} from './workers/ledgerRoom.ts';export {LedgerRoom};export class RecoveryLedgerRoom extends LedgerRoom{};import {handleLedgerSync} from './workers/ledgerSync.ts';export default {fetch(request,env){return handleLedgerSync(request,new URL(request.url).searchParams.has('recovery')?{...env,LEDGER_ROOMS:env.RECOVERY_ROOMS}:env)}};`},bundle:true,write:false,platform:'browser',external:['cloudflare:*','node:*'],format:'esm',target:'es2022'});
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0]!.text,compatibilityDate:'2026-08-27',compatibilityFlags:['nodejs_compat'],durableObjects:{LEDGER_ROOMS:{className:'LedgerRoom',useSQLite:true},RECOVERY_ROOMS:{className:'RecoveryLedgerRoom',useSQLite:true}},r2Buckets:['LEDGER_ARCHIVE'],bindings:{LEDGER_SYNC_LOCAL_AUTH:'true',HEARTHSIDE_DESIGN_WRITES:'true',SUPABASE_URL:'http://127.0.0.1:1',SUPABASE_PUBLISHABLE_KEY:'synthetic'}}));
 let socket:WebSocket|undefined;let h=catalogHousehold();h.householdId='HH-nest-runtime';h=addPotentialExpense(h,{date:'2026-09-29',title:'A possible shared outing',amount:'60',accountId:'ACC-CHEQUING',subcategoryId:'SUB-LIFE-FUN',createdBy:'MEM-001',visibility:'household'}).household;const potential=h.potentialExpenses[0]!;h=saveKittyNestDesign(h,{memberId:'MEM-001',view:'household',bankKey:'potential:'+potential.id,expectedRevision:0,name:'Outing pot',glaze:'cream',category:'build',studio:{version:1,draft:newKittyPiece('PIECE-outing','2026-09-12T12:00:00.000Z'),fired:[]}}).household;const legacy=newKittyPiece('PIECE-original','2026-09-12T12:00:00.000Z');legacy.sculpt.body='pear';legacy.paint.strokes=[{part:'body',tool:'brush',color:'#ff2233',size:12,opacity:1,mirror:false,pts:[.2,.2,.4,.4]}];
 for(const view of ['household','personal'] as const)h=saveKittyNestDesign(h,{memberId:'MEM-001',view,bankKey:'king',expectedRevision:0,name:view==='household'?'Our old King':'My private King',glaze:'cream',studio:{version:1,draft:{...legacy,id:view+'-piece'},fired:[]}}).household;
 const source={version:1,view:'household',designKey:'king',appearance:{version:1,tier:'king',category:null,theme:'taylor'}};
 const url='http://localhost/ledger-sync/v2/development/'+h.householdId,headers=(actor:string)=>({Authorization:'Bearer local:'+actor,'Content-Type':'application/json'});
 const post=(path:string,body:unknown,actor='MEM-001',recovery=false)=>mf.dispatchFetch(url+'/'+path+(recovery?'?recovery':''),{method:'POST',headers:headers(actor),body:JSON.stringify(body)});
 const design=async(body:object,actor='MEM-001',recovery=false)=>{const response=await post('design',{version:1,...body},actor,recovery);const text=await response.text();expect(response.status,text).toBe(200);return JSON.parse(text) as {document:KittyDesignDocument};};
 const snapshot=async(actor='MEM-001')=>await(await mf.dispatchFetch(url+'/snapshot',{headers:headers(actor)})).json() as {shared:Parameters<typeof assembleHousehold>[0];personal:Parameters<typeof assembleHousehold>[1]};
 try{
  for(const actor of ['MEM-001','MEM-002'])expect((await post('import',h,actor)).status).toBe(200);
  const before=await snapshot(),money=await financialAuditHash(assembleHousehold(before.shared,before.personal));
  await design({kind:'create',designId:'DESIGN-outing',bankId:null,nestSource:{...source,designKey:'potential:'+potential.id,appearance:{...source.appearance,tier:'bill',category:'build'}}});
  const original=(await design({kind:'create',designId:'DESIGN-king',bankId:null,nestSource:source})).document;
  expect(original.nest).toEqual(source);expect(original.legacy?.authorship).toBe('unknown');expect(original.legacy?.pieces[0]?.paint.strokes).toEqual(legacy.paint.strokes);
  // A second member and a changed presentation theme resolve the existing source, never a new document or rewritten recipe.
  expect((await design({kind:'create',designId:'DESIGN-second-device',bankId:null,nestSource:{...source,appearance:{...source.appearance,theme:'classic'}}},'MEM-002')).document).toEqual(original);
  await design({kind:'create',designId:'DESIGN-personal',bankId:null,nestSource:{...source,view:'personal'}});
  for(const kind of ['read','snapshot'])expect((await post('design',{version:1,kind,designId:'DESIGN-personal',...(kind==='snapshot'?{pieceId:'personal-piece',revision:0}:{})},'MEM-002')).status).toBe(409);
  expect((await post('design',{version:1,kind:'create',designId:'DESIGN-wrong-source',bankId:null,nestSource:{...source,designKey:'potential:hidden',appearance:{...source.appearance,tier:'bill',category:'protect'}}})).status).toBe(409);
  expect((await post('design',{version:1,kind:'create',designId:'DESIGN-fake-goal',bankId:'goal:king',nestSource:source})).status).toBe(409);
  const common={version:1 as const,designId:'DESIGN-king',pieceId:'household-piece'},stroke=(id:string,color:string):KittyDesignOperation=>({...common,id,gestureId:'gesture-'+id,kind:'append-stroke',expectedEditEpoch:0,surfaceRevision:0,stroke:{part:'body',tool:'brush',color,size:12,opacity:1,mirror:false,pts:[.2,.2,.4,.4]}});
  const a=stroke('OP-one','#112233'),b=stroke('OP-two','#667788');await Promise.all([design({kind:'operate',operation:a}),design({kind:'operate',operation:b},'MEM-002')]);
  const same=(await design({kind:'operate',operation:a})).document;expect(same.revision).toBe(2);
  const gesture=projectKittyDesign(same).gestures.find(g=>g.id==='gesture-OP-one')!;
  const kept=(await design({kind:'operate',operation:{...common,id:'OP-undo',gestureId:'gesture-undo',kind:'undo-gesture',targetGestureId:gesture.id,expectedGestureRevision:gesture.revision,expectedEditEpoch:0}})).document;
  expect(projectKittyDesign(kept).pieces[0]!.piece.paint.strokes.map(s=>s.color)).toEqual(['#ff2233','#667788']);
  const after=await snapshot(),joined=assembleHousehold(after.shared,after.personal);expect(await financialAuditHash(joined)).toBe(money);expect(joined.goals).toEqual(h.goals);
  const shared=after.shared.kittyNestDesigns!.find(row=>row.bankKey==='king')!;expect(shared.name).toBe('Our old King');expect(shared.studio).toBeUndefined();expect(shared.designRef).toMatchObject({designId:'DESIGN-king',revision:3});expect(JSON.stringify(after.shared)).not.toContain('DESIGN-personal');expect(JSON.stringify(after.shared)).not.toContain('OP-one');
  // Actual authenticated command route removes the original source; knowing the design ID cannot reopen it.
  const base=(await mf.ready).toString().replace(/\/$/,''),path='/ledger-sync/v2/development/'+h.householdId;
  const ticket=await(await post('ticket',{})).json() as {ticket:string};socket=new WebSocket(base.replace(/^http/,'ws')+path+'/socket');socket.binaryType='arraybuffer';const ws=socket,messages:Record<string,unknown>[]=[],wire=new MessageReader();let tail=Promise.resolve();
  ws.addEventListener('message',event=>{tail=tail.then(async()=>{if(typeof event.data==='string'){messages.push(JSON.parse(event.data));return;}const data=event.data as ArrayBuffer,value=await wire.accept(data);ws.send(JSON.stringify({type:'credit',bytes:data.byteLength}));if(value)messages.push(value as Record<string,unknown>);});});
  const next=async(type:string)=>{for(let i=0;i<300;i++){await tail;const at=messages.findIndex(m=>m.type===type);if(at>=0)return messages.splice(at,1)[0]!;if(messages.some(m=>m.type==='error'))throw Error(JSON.stringify(messages));await new Promise(r=>setTimeout(r,10));}throw Error('Missing '+type);};
  await new Promise<void>((resolve,reject)=>{ws.addEventListener('open',()=>resolve(),{once:true});ws.addEventListener('error',reject,{once:true});});ws.send(JSON.stringify({type:'auth',ticket:ticket.ticket}));await next('authenticated');for(const frame of await encodeMessage({type:'resume',sequence:0}))ws.send(frame);await next('snapshot');await next('ready');
  const removal=removePotentialExpense(joined,{id:potential.id,createdBy:'MEM-001'}),command=await commandFromCapture(capturedIntent(removal.household)!,{environment:h.environment,householdId:h.householdId},crypto.randomUUID());for(const frame of await encodeMessage({type:'command',command}))ws.send(frame);await next('ack');
  for(const kind of ['read','snapshot']){const denied=await post('design',{version:1,kind,designId:'DESIGN-outing',...(kind==='snapshot'?{pieceId:'PIECE-outing',revision:0}:{})});expect(await denied.json()).toEqual({error:'DESIGN_NEST_UNAVAILABLE'});}
  const recovered=await post('restore',{},'MEM-001',true);expect(recovered.status,await recovered.text()).toBe(200);
  expect((await design({kind:'read',designId:'DESIGN-king'},'MEM-002',true)).document).toEqual(kept);
  expect((await design({kind:'create',designId:'DESIGN-after-restart',bankId:null,nestSource:source},'MEM-002',true)).document).toEqual(kept);
  expect((await design({kind:'operate',operation:a},'MEM-001',true)).document).toEqual(kept);
  expect((await post('design',{version:1,kind:'read',designId:'DESIGN-personal'},'MEM-002',true)).status).toBe(409);
 }finally{socket?.close();await mf.dispose();}
},60_000);
