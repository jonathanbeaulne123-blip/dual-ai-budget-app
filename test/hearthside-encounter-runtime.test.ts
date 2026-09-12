import {expect,it} from 'vitest';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {encounterPatchPlugin} from './hearthside-encounter-patch.ts';
import type {EncounterPrivateView} from '../workers/hearthsideVaultEncounters.ts';
it('uses actual authenticated Vault, SQLite/R2 and no-callback paired reveal evidence through interruption and restore',async()=>{
  const bundle=await build({stdin:{resolveDir:process.cwd(),contents:`
    import{DurableObject}from'cloudflare:workers';import{HearthsideVault,handleHearthsideVault}from'./workers/hearthsideVault.ts';
    import{applyEncounterCommand}from'./src/hearthside/encounterService.ts';
    const principals=[{memberId:'MEM-A',subject:'local:MEM-A'},{memberId:'MEM-B',subject:'local:MEM-B'}];
    export class ReferenceRoom extends DurableObject{
      constructor(ctx,env){super(ctx,env);this.tail=Promise.resolve();this.people=principals;this.current=null;}
      async init(){this.current=await applyEncounterCommand(null,{kind:'encounter.start',id:'encounter-one',packId:'classic-spring-window',participantMemberIds:['MEM-A','MEM-B'],experienceId:null},{actorId:'MEM-A',memberIds:['MEM-A','MEM-B'],experienceIds:[],wardrobeIds:[]});}
      check(s){if(s.householdId!=='HH-ENCOUNTER'||!this.people.some(p=>p.memberId===s.memberId&&p.subject===s.subject))throw Error('FORBIDDEN');}
      roster(s){if(this.replaceCountdown&&--this.replaceCountdown===0)this.people=[principals[0],{memberId:'MEM-B',subject:'local:replacement'}];this.check(s);return this.people;}async replaceOnFinalCheck(){this.replaceCountdown=3;}async resetRoster(){this.people=principals;this.replaceCountdown=0;}
      vaultEncounterContext(s,id){this.check(s);if(!this.current||this.current.id!==id)throw Error('ENCOUNTER_NOT_FOUND');return{id,packId:this.current.packId,participantMemberIds:this.current.participantMemberIds,wardrobeIds:[]};}
      compose(s,binding){const result=this.tail.then(async()=>{this.check(s);const evidence=await this.env.HEARTHSIDE_VAULTS.get(this.env.HEARTHSIDE_VAULTS.idFromName('development/HH-ENCOUNTER')).checkEncounterRevealFor(s,binding);
        this.current=await applyEncounterCommand(this.current,{kind:'encounter.reveal',id:this.current.id,expectedRevision:this.current.revision,binding},{actorId:s.memberId,memberIds:this.people.map(p=>p.memberId),experienceIds:[],wardrobeIds:[],revealEvidence:evidence});return this.current;});this.tail=result.catch(()=>{});return result;}
      async checkReveal(scope,binding){try{await this.env.HEARTHSIDE_VAULTS.get(this.env.HEARTHSIDE_VAULTS.idFromName('development/HH-ENCOUNTER')).checkEncounterRevealFor(scope,binding);return 'accepted';}catch(e){return e.message;}}
      shared(){return this.current;}async replace(){this.people=[principals[0],{memberId:'MEM-B',subject:'local:replacement'}];}
    }
    export class TestVault extends HearthsideVault{
      constructor(ctx,env){super(ctx,{...env,HEARTHSIDE_VAULT_AUTHORITY:{policy:async(scope,input)=>{const people=await env.LEDGER_ROOMS.get(env.LEDGER_ROOMS.idFromName('development/HH-ENCOUNTER')).roster(scope);return{recipients:people,approvers:people};},accept:async()=>{throw Error('Not used');},isReferenced:async()=>false}});}
    }export default{fetch:handleHearthsideVault};
  `},bundle:true,write:false,platform:'browser',format:'esm',target:'es2022',external:['cloudflare:*','node:*'],plugins:[encounterPatchPlugin()]});
  const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0]!.text,compatibilityDate:'2026-08-27',compatibilityFlags:['nodejs_compat'],
    durableObjects:{HEARTHSIDE_VAULTS:{className:'TestVault',useSQLite:true},LEDGER_ROOMS:{className:'ReferenceRoom',useSQLite:true}},r2Buckets:['HEARTHSIDE_VAULT_MEDIA'],bindings:{HEARTHSIDE_VAULT_ENABLED:'true',HEARTHSIDE_VAULT_PUBLICATION:'true',LEDGER_SYNC_LOCAL_AUTH:'true',SUPABASE_URL:'http://127.0.0.1:1',SUPABASE_PUBLISHABLE_KEY:'synthetic'}}));
  const scope=(memberId:string)=>({environment:'development',householdId:'HH-ENCOUNTER',memberId,subject:`local:${memberId}`,expires:Date.now()+3600000});
  const headers=(member:string)=>({Authorization:`Bearer local:${member}`,'X-Vault-Actor':member,'X-Vault-Identity':`local:${member}`,'Content-Type':'application/json'});
  const request=(member:string,input:unknown,path='HH-ENCOUNTER')=>mf.dispatchFetch(`http://localhost/api/hearthside-vault/development/${path}`,{method:'POST',headers:headers(member),body:JSON.stringify({operation:'encounter-private',input:{encounterId:'encounter-one',...input as object}})});
  const command=async(member:string,input:unknown)=>{const response=await request(member,input);const json=await response.json();expect(response.status,JSON.stringify(json)).toBe(200);return json as EncounterPrivateView;};
  let reviews=0;const review=async(member:string)=>{const current=await command(member,{action:'read'});return command(member,{action:'review',id:'review-'+(++reviews),expectedRevision:current.own!.revision});};
  const answer=(text:string,revision=1)=>({revision,text,objectId:'window',wardrobeId:null});
  try{
    const rooms=await mf.getDurableObjectNamespace('LEDGER_ROOMS'),room=rooms.get(rooms.idFromName('development/HH-ENCOUNTER')) as any;await room.init();
    const a=await command('MEM-A',{action:'save',id:'save-A',expectedRevision:0,answer:answer('A private answer')});expect(a.own?.text).toBe('A private answer');expect(a.reveal).toBeNull();
    const b=await command('MEM-B',{action:'read'});expect(b.own).toBeNull();expect(JSON.stringify(b)).not.toContain('A private answer');expect(b).not.toHaveProperty('partnerAnswered');expect(b).not.toHaveProperty('updatedAt');
    expect((await request('MEM-C',{action:'read'})).status).toBe(403);expect((await request('MEM-A',{action:'read'},'HH-OTHER')).status).toBe(403);
    const ar0=await review('MEM-A');const early=await command('MEM-A',{action:'reveal',id:'early-A',expectedRevision:1,challenge:ar0.challenge});expect(early.choiceSubmitted).toBe(true);expect(early).not.toHaveProperty('choiceCurrent');expect(early.reveal).toBeNull();
    await command('MEM-B',{action:'save',id:'save-A',expectedRevision:0,answer:answer('B private answer')});
    expect(await command('MEM-A',{action:'read'})).toEqual(early);
    await command('MEM-B',{action:'pause',id:'private-pause-B'});expect(await command('MEM-A',{action:'read'})).toEqual(early);
    await command('MEM-B',{action:'resume',id:'private-resume-B'});expect(await command('MEM-A',{action:'read'})).toEqual(early);
    await command('MEM-B',{action:'delete',id:'private-delete-B',expectedRevision:1});expect(await command('MEM-A',{action:'read'})).toEqual(early);
    await command('MEM-B',{action:'save',id:'private-replace-B',expectedRevision:0,answer:answer('B private answer')});expect(await command('MEM-A',{action:'read'})).toEqual(early);
    expect((await request('MEM-A',{action:'reveal',id:'stale-A',expectedRevision:1,challenge:ar0.challenge})).status).toBe(409);
    const br0=await review('MEM-B');expect((await command('MEM-A',{action:'read'})).challenge).toBe(ar0.challenge);const br=await command('MEM-B',{action:'reveal',id:'reveal-B',expectedRevision:1,challenge:br0.challenge});expect(br.reveal).toBeNull();
    const ar=await review('MEM-A'),input={action:'reveal',id:'reveal-A',expectedRevision:1,challenge:ar.challenge};
    const accepted=await command('MEM-A',input);expect(accepted.reveal?.answers.map(a=>a.text)).toEqual(['A private answer','B private answer']);
    // Simulated lost response: the exact accepted identity returns the same reveal.
    expect((await command('MEM-A',input)).reveal).toEqual(accepted.reveal);expect(JSON.stringify(accepted)).not.toContain('local:MEM-B');
    await room.replaceOnFinalCheck();const withheld=await request('MEM-B',{action:'read'});expect(withheld.status).toBe(403);expect(await withheld.text()).not.toContain('A private answer');await room.resetRoster();
    const canonical=await room.compose(scope('MEM-A'),accepted.reveal!.binding);expect(canonical.reveal).toEqual(accepted.reveal!.binding);expect(JSON.stringify(canonical)).not.toContain('private answer');
    const edited=await command('MEM-B',{action:'save',id:'edit-B',expectedRevision:1,answer:answer('B changed answer',2)});expect(edited.reveal).toBeNull();
    const vaults=await mf.getDurableObjectNamespace('HEARTHSIDE_VAULTS');
    expect(await room.checkReveal(scope('MEM-A'),accepted.reveal!.binding)).toBe('REVEAL_REQUIRED');
    const paused=await command('MEM-A',{action:'pause',id:'pause-A'});expect(paused.paused).toBe(true);expect((await command('MEM-B',{action:'read'}))).not.toHaveProperty('partnerPaused');
    expect((await request('MEM-A',{action:'save',id:'save-paused',expectedRevision:1,answer:answer('cannot save',2)})).status).toBe(400);
    await command('MEM-A',{action:'resume',id:'resume-A'});const anew=await review('MEM-A');await command('MEM-A',{action:'reveal',id:'reveal-A-2',expectedRevision:1,challenge:anew.challenge});
    const bnew=await review('MEM-B');const again=await command('MEM-B',{action:'reveal',id:'reveal-B-2',expectedRevision:2,challenge:bnew.challenge});expect(again.reveal?.answers[1]?.text).toBe('B changed answer');
    await command('MEM-B',{action:'withdraw',id:'withdraw-B'});expect((await command('MEM-A',{action:'read'})).reveal).toBeNull();
    expect(await room.checkReveal(scope('MEM-A'),again.reveal!.binding)).toBe('REVEAL_REQUIRED');
    // Explicit empty-DO recovery uses the actual private archive, not shared books.
    const restored=vaults.get(vaults.idFromName('trusted-empty-restore')) as any;let progress=await restored.restoreFromArchive(scope('MEM-A'));while(!progress.complete)progress=await restored.restoreFromArchive(scope('MEM-A'));
    const recovered=await restored.commandFor(scope('MEM-A'),{operation:'encounter-private',input:{encounterId:'encounter-one',action:'read'}},true,'local:MEM-A');expect(recovered.withdrawn).toBe(true);expect(recovered.own).toBeNull();expect(recovered.reveal).toBeNull();
    await room.replace();expect((await request('MEM-B',{action:'read'})).status).toBe(403);
  }finally{await mf.dispose();}
},60000);
