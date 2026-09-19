import { expect, it } from 'vitest';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { addGoal, catalogHousehold } from '../src/core/index.ts';
import { newKittyPiece } from '../src/core/kittyStudio.ts';
import { defaultGoalEnvelope } from '../src/core/goalEnvelopes.ts';
import { assembleHousehold } from '../src/core/sync.ts';
import { financialAuditHash } from '../src/core/commandIdentity.ts';
import { assertPersonalDesignArchiveReferences } from '../src/ledgerSync/backup.ts';
import { projectKittyDesign } from '../src/hearthside/design.ts';
import type { KittyDesignDocument, KittyDesignOperation } from '../src/hearthside/designContracts.ts';
import type { LedgerRoom } from '../workers/ledgerRoom.ts';

type DesignResult=Awaited<ReturnType<LedgerRoom['design']>>;
it('accepts simultaneous creative operations in SQLite, migrates legacy artwork once, isolates private designs and recovers exact history from R2',async()=>{
  const bundle=await build({stdin:{resolveDir:process.cwd(),contents:`
    import {LedgerRoom} from './workers/ledgerRoom.ts'; export {LedgerRoom}; export class RecoveryLedgerRoom extends LedgerRoom {}
    import {handleLedgerSync} from './workers/ledgerSync.ts';
    import {authorizeRequest} from './workers/ledgerSyncAuth.ts';
    export default {async fetch(request,env){
      const selected=new URL(request.url).searchParams.has('recovery')?{...env,LEDGER_ROOMS:env.RECOVERY_ROOMS}:env;
      if(new URL(request.url).pathname.endsWith('/vault-accept')){
        const {scope}=await authorizeRequest(request,env,'development','HH-design-runtime');
        const room=selected.LEDGER_ROOMS.get(selected.LEDGER_ROOMS.idFromName('development/HH-design-runtime'));
        try{return Response.json(await room.acceptVaultPublication(scope,await request.json()));}catch(error){return Response.json({error:error.message},{status:409});}
      }
      return handleLedgerSync(request,selected);
    }};
  `},bundle:true,write:false,platform:'browser',external:['cloudflare:*','node:*'],format:'esm',target:'es2022'});
  const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0]!.text,compatibilityDate:'2026-08-27',compatibilityFlags:['nodejs_compat'],durableObjects:{LEDGER_ROOMS:{className:'LedgerRoom',useSQLite:true},RECOVERY_ROOMS:{className:'RecoveryLedgerRoom',useSQLite:true}},r2Buckets:['LEDGER_ARCHIVE'],bindings:{LEDGER_SYNC_LOCAL_AUTH:'true',HEARTHSIDE_DESIGN_WRITES:'true',HEARTHSIDE_VAULT_PUBLICATION:'true',SUPABASE_URL:'http://127.0.0.1:1',SUPABASE_PUBLISHABLE_KEY:'synthetic'}}));
  let h=catalogHousehold();h.householdId='HH-design-runtime';
  const legacy=newKittyPiece('PIECE-legacy','2026-09-12T12:00:00.000Z');
  legacy.paint.strokes=[{part:'body',tool:'brush',color:'#ab2233',size:12,opacity:1,mirror:false,pts:[.2,.2,.3,.3]}];
  h=addGoal(h,{name:'Our bank',target:'100',shared:true,envelope:{...defaultGoalEnvelope(),studio:{version:1,draft:legacy,fired:[],displayId:null}}}).household;
  const bankId=h.goals.at(-1)!.id;
  h=addGoal(h,{name:'My bank',target:'100',shared:false,ownerMemberId:'MEM-001'}).household;
  const privateBank=h.goals.at(-1)!.id;
  const url='http://localhost/ledger-sync/v2/development/'+h.householdId;
  const headers=(actor:string)=>({Authorization:'Bearer local:'+actor,'Content-Type':'application/json'});
  const post=(path:string,body:unknown,actor='MEM-001',recovery=false)=>mf.dispatchFetch(url+'/'+path+(recovery?'?recovery':''),{method:'POST',headers:headers(actor),body:JSON.stringify(body)});
  const design=async(body:unknown,actor='MEM-001',recovery=false)=>{const response=await post('design',{version:1,...body as object},actor,recovery);const text=await response.text();expect(response.status,text).toBe(200);return JSON.parse(text) as DesignResult;};
  const document=(result:DesignResult)=>{expect(result).toHaveProperty('document');return (result as {document:KittyDesignDocument}).document;};
  try {
    for(const memberId of ['MEM-001','MEM-002'])expect((await post('import',h,memberId)).status).toBe(200);
    const before=await mf.dispatchFetch(url+'/snapshot',{headers:headers('MEM-001')});const replica=await before.json() as {shared:Parameters<typeof assembleHousehold>[0];personal:Parameters<typeof assembleHousehold>[1]};
    const money=await financialAuditHash(assembleHousehold(replica.shared,replica.personal));
    const migrated=document(await design({kind:'create',designId:'DESIGN-bank',bankId}));
    expect(migrated.legacy?.authorship).toBe('unknown');expect(migrated.legacy?.pieces[0]?.paint.strokes).toEqual(legacy.paint.strokes);
    expect(document(await design({kind:'create',designId:'DESIGN-retry',bankId})).id).toBe('DESIGN-bank');
    await design({kind:'create',designId:'DESIGN-private',bankId:privateBank});
    expect((await post('design',{version:1,kind:'read',designId:'DESIGN-private'},'MEM-002')).status).toBe(409);
    expect((await post('design',{version:1,kind:'read',designId:'DESIGN-bank'},'MEM-outsider')).status).toBe(403);
    await design({kind:'create',designId:'DESIGN-free',bankId:null});
    const privateFree=document(await design({kind:'create',designId:'DESIGN-personal-free',bankId:null,audience:'personal'}));
    expect(privateFree.scope.ownerMemberId).toBe('MEM-001');
    expect((await post('design',{version:1,kind:'read',designId:'DESIGN-personal-free'},'MEM-002')).status).toBe(409);
    await design({kind:'operate',operation:{version:1,designId:'DESIGN-personal-free',pieceId:'PIECE-personal-free',id:'OP-personal-create',gestureId:'GESTURE-personal-create',kind:'create-piece',base:'cream'}});
    const common={version:1 as const,designId:'DESIGN-free',pieceId:'PIECE-free'};
    await design({kind:'operate',operation:{...common,id:'OP-create',gestureId:'GESTURE-create',kind:'create-piece',base:'cream'}});
    const stroke=(id:string,color:string):KittyDesignOperation=>({...common,id,gestureId:'GESTURE-'+id,kind:'append-stroke',expectedEditEpoch:0,surfaceRevision:0,stroke:{part:'body',tool:'brush',color,size:12,opacity:1,mirror:false,pts:[.2,.2,.3,.3]}});
    const ahead=await post('design',{version:1,kind:'operate',knownRevision:99,operation:stroke('OP-ahead','#ab2233')});expect(await ahead.json()).toEqual({error:'DESIGN_REVISION_AHEAD'});
    expect(document(await design({kind:'read',designId:'DESIGN-free'})).revision).toBe(1);
    const one=stroke('OP-one','#ab2233'),two=stroke('OP-two','#123abc');
    const stale=await post('design',{version:1,kind:'operate',operation:{...one,id:'OP-stale',expectedEditEpoch:99}});
    expect(await stale.json()).toEqual({error:'STALE_EDIT_EPOCH'});
    await Promise.all([design({kind:'operate',operation:one}),design({kind:'operate',operation:two},'MEM-002')]);
    const retry=document(await design({kind:'operate',operation:one}));expect(retry.operations).toHaveLength(3);
    expect((await post('design',{version:1,kind:'operate',operation:one},'MEM-002')).status).toBe(409);
    await design({kind:'operate',operation:{...common,id:'OP-undo',gestureId:'GESTURE-undo',kind:'undo-gesture',targetGestureId:'GESTURE-OP-one',expectedGestureRevision:projectKittyDesign(retry).gestures.find(g=>g.id==='GESTURE-OP-one')!.revision,expectedEditEpoch:0}});
    const accepted=document(await design({kind:'read',designId:'DESIGN-free'}));
    expect(projectKittyDesign(accepted).pieces[0]!.piece.paint.strokes.map(s=>s.color)).toEqual(['#123abc']);
    const delta=await design({kind:'read',designId:'DESIGN-free',knownRevision:3});expect(delta).not.toHaveProperty('document');expect(delta).toMatchObject({delta:{baseRevision:3,revision:4,entries:[{operation:{id:'OP-undo'}}]}});
    const publication={version:1,publicationId:'LETTER-private',digest:'a'.repeat(64),kind:'letter',environment:'development',householdId:h.householdId};
    const acceptance=await (await post('vault-accept',publication)).json();expect(acceptance).toMatchObject({publicationId:'LETTER-private'});
    expect(await (await post('vault-accept',publication)).json()).toEqual(acceptance);
    expect((await post('vault-accept',publication,'MEM-002')).status).toBe(409);
    const after=await mf.dispatchFetch(url+'/snapshot',{headers:headers('MEM-001')});const next=await after.json() as typeof replica;
    expect(await financialAuditHash(assembleHousehold(next.shared,next.personal))).toBe(money);
    expect(next.shared.goals.find(g=>g.id===bankId)?.envelope?.studio).toBeUndefined();
    expect(next.shared.goals.find(g=>g.id===bankId)?.envelope?.designRef?.designId).toBe('DESIGN-bank');
    expect(JSON.stringify(next.shared)).not.toContain('DESIGN-private');expect(JSON.stringify(next.shared)).not.toContain('OP-one');expect(JSON.stringify(next)).not.toContain('LETTER-private');
    expect(JSON.stringify(next.shared)).not.toContain('DESIGN-personal-free');
    expect(next.personal?.personalLife?.designs.find(row=>row.designId==='DESIGN-personal-free')).toEqual({version:1,designId:'DESIGN-personal-free',revision:1,pieceIds:['PIECE-personal-free']});
    const personalIndex=next.personal!.personalLife!.designs.find(row=>row.designId==='DESIGN-personal-free')!;
    const foreignGoal={...next.personal!.goals![0]!,id:'GOAL-foreign-bank',ownerMemberId:'MEM-002',envelope:{...defaultGoalEnvelope(),designRef:{version:1 as const,designId:personalIndex.designId,revision:personalIndex.revision,displayPieceId:null}}};
    expect(()=>assertPersonalDesignArchiveReferences([['MEM-001',{...next.personal!,goals:[foreignGoal],personalLife:{...next.personal!.personalLife!,designs:[personalIndex]}}]],[{version:1,designId:personalIndex.designId,revision:personalIndex.revision,sha256:'a'.repeat(64),bankId:foreignGoal.id}])).toThrow('DESIGN_ARCHIVE_REFERENCE_MISSING');
    const restored=await post('restore',{},'MEM-001',true);expect(restored.status,await restored.text()).toBe(200);
    expect(document(await design({kind:'read',designId:'DESIGN-free'},'MEM-002',true))).toEqual(accepted);
    expect(document(await design({kind:'read',designId:'DESIGN-bank'},'MEM-002',true))).toEqual(migrated);
    expect((await post('design',{version:1,kind:'read',designId:'DESIGN-private'},'MEM-002',true)).status).toBe(409);
    expect((await post('design',{version:1,kind:'read',designId:'DESIGN-personal-free'},'MEM-002',true)).status).toBe(409);
    expect(document(await design({kind:'read',designId:'DESIGN-personal-free'},'MEM-001',true)).scope.ownerMemberId).toBe('MEM-001');
    expect(await (await post('vault-accept',publication,'MEM-001',true)).json()).toEqual(acceptance);
    const replay=document(await design({kind:'operate',operation:one},'MEM-001',true));expect(replay.operations).toEqual(accepted.operations);
  } finally {await mf.dispose();}
},60_000);
