import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {assembleHousehold} from '../../src/core/sync.ts';

type Replica={shared:Parameters<typeof assembleHousehold>[0];personal:Parameters<typeof assembleHousehold>[1];sequence:number};

/**
 * Real local LedgerRoom + Vault service used by the actual-App browser proof.
 * Only authentication and the Vault audience lookup are synthetic loopback
 * adapters; publication acceptance remains inside the real LedgerRoom.
 */
export async function startHearthsideActualAppAuthority(householdId:string,resourcePersistencePath?:string){
 const bundle=await build({stdin:{resolveDir:process.cwd(),contents:`
  import {LedgerRoom} from './workers/ledgerRoom.ts'; export {LedgerRoom};
  import {HearthsideVault} from './workers/hearthsideVault.ts';
  import {handleHearthsideVault} from './workers/hearthsideVault.ts';
  import {handleLedgerSync} from './workers/ledgerSync.ts';
  export class TestVault extends HearthsideVault {
   constructor(ctx,env){
    const room=()=>env.LEDGER_ROOMS.get(env.LEDGER_ROOMS.idFromName('development/${householdId}'));
    super(ctx,{...env,HEARTHSIDE_VAULT_AUTHORITY:{
     policy:async(scope,input)=>{
      const current=await room().hearthsideContent(scope);
      const principals=current.memberIds.map(memberId=>({memberId,subject:'local:'+memberId}));
      const author=principals.find(row=>row.memberId===scope.memberId&&row.subject===scope.subject);
      if(!author)throw Error('FORBIDDEN');
      const recipients=input.recipientMemberIds.map(id=>principals.find(row=>row.memberId===id));
      if(recipients.some(row=>!row))throw Error('FORBIDDEN');
      return {recipients,approvers:input.kind==='shared-memory'?principals:[author]};
     },
     accept:(scope,reference)=>room().acceptVaultPublication(scope,reference),
     isReferenced:(scope,id)=>room().vaultMediaReferenced(scope,id),
    }});
   }
  }
  export default {async fetch(request,env){
   return await handleHearthsideVault(request,env) ?? await handleLedgerSync(request,env) ?? new Response('Not found',{status:404});
  }};
 `},bundle:true,write:false,platform:'browser',external:['cloudflare:*','node:*'],format:'esm',target:'es2022'});
 const mf=new Miniflare({...convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0]!.text,compatibilityDate:'2026-08-27',compatibilityFlags:['nodejs_compat'],
  durableObjects:{LEDGER_ROOMS:{className:'LedgerRoom',useSQLite:true},HEARTHSIDE_VAULTS:{className:'TestVault',useSQLite:true}},
  r2Buckets:['LEDGER_ARCHIVE','HEARTHSIDE_VAULT_MEDIA','HEARTHSIDE_VAULT_ARCHIVE'],bindings:{LEDGER_SYNC_LOCAL_AUTH:'true',HEARTHSIDE_DESIGN_WRITES:'true',HEARTHSIDE_VAULT_ENABLED:'true',HEARTHSIDE_VAULT_PUBLICATION:'true',SUPABASE_URL:'http://127.0.0.1:1',SUPABASE_PUBLISHABLE_KEY:'synthetic'}}),...(resourcePersistencePath?{resourcePersistencePath}:{})});
 const base=(await mf.ready).toString().replace(/\/$/,''),ledgerPath=`/ledger-sync/v2/development/${householdId}`;
 const headers=(actor:string)=>({Authorization:`Bearer local:${actor}`,'Content-Type':'application/json'});
 async function snapshot(actor='MEM-001'){
  const response=await fetch(base+ledgerPath+'/snapshot',{headers:headers(actor)});
  if(!response.ok)throw Error(await response.text());return await response.json() as Replica;
 }
 async function vaultSnapshot(actor:string){
  const response=await fetch(base+`/api/hearthside-vault/development/${householdId}`,{headers:{...headers(actor),'X-Vault-Actor':actor,'X-Vault-Identity':`local:${actor}`}});
  return {status:response.status,body:await response.json() as unknown};
 }
 async function vaultCommand(actor:string,input:unknown){
  const response=await fetch(base+`/api/hearthside-vault/development/${householdId}`,{method:'POST',headers:{...headers(actor),'X-Vault-Actor':actor,'X-Vault-Identity':`local:${actor}`},body:JSON.stringify(input)});
  return {status:response.status,body:await response.json() as unknown};
 }
 async function design(actor:string,input:unknown){
  const response=await fetch(base+ledgerPath+'/design',{method:'POST',headers:headers(actor),body:JSON.stringify({version:1,...input as object})});
  return {status:response.status,body:await response.json() as unknown};
 }
 return {base,ledgerPath,snapshot,vaultSnapshot,vaultCommand,design,
  household:async(actor='MEM-001')=>{const replica=await snapshot(actor);return assembleHousehold(replica.shared,replica.personal,{linked:true});},
  dispose:()=>mf.dispose()};
}
