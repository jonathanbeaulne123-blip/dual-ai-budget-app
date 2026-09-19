// Synthetic local authentication only. Every source, publication, media and visit operation
// below executes the production LedgerRoom, Vault and guest objects, with real SQLite/R2.
import {DurableObject} from 'cloudflare:workers';
import {LedgerRoom} from '../../workers/ledgerRoom.ts';
import {HearthsideVault} from '../../workers/hearthsideVault.ts';
import {HearthsideGuestRoom,HearthsideGuestCard,HearthsideGuestIndex,handleHearthsideGuests} from '../../workers/hearthsideGuests.ts';
import {guestAuthorityAttestation,resolveGuestAuthority} from '../../workers/hearthsideGuestAuthority.ts';
export {LedgerRoom,HearthsideGuestRoom,HearthsideGuestCard,HearthsideGuestIndex};
const householdId='HH-guest-assembly';
const people={alice:'11111111-1111-4111-a111-111111111111',bob:'22222222-2222-4222-a222-222222222222',cara:'33333333-3333-4333-a333-333333333333',dan:'44444444-4444-4444-a444-444444444444'};
const roster=[{memberId:'MEM-001',subject:people.alice},{memberId:'MEM-002',subject:people.bob}];
export class SyntheticGuestControl extends DurableObject {
 async change(key,value){await this.ctx.storage.put(key,value);}
 async authority(token,input){
  const expected=await guestAuthorityAttestation(this.env,token,input.p_household_id,input.p_issued_at);
  if(JSON.stringify(expected)!==JSON.stringify(input)||Math.abs(Date.now()/1000-input.p_issued_at)>31)throw Error('Synthetic proof rejected');
  const name=token.replace('.synthetic.jwt',''),subject=people[name];
  if(!subject||await this.ctx.storage.get('revoked-'+name))throw Error('No synthetic session');
  if(input.p_household_id!==null&&input.p_household_id!==householdId)throw Error('Unknown synthetic household');
  const principals=input.p_household_id===null?[]:(await this.ctx.storage.get('roster')??roster);
  return {version:1,environment:'development',householdId:input.p_household_id,subject,checkedAt:Date.now(),principals,actorMemberId:principals.find(p=>p.subject===subject)?.memberId??null};
 }
}
export class AssemblyVault extends HearthsideVault {
 constructor(ctx,env){
  const room=()=>env.LEDGER_ROOMS.get(env.LEDGER_ROOMS.idFromName('development/'+householdId));
  // Only identity resolution is synthetic. Policy uses fresh signed server roster and
  // actual canonical active members. Acceptance and media admission are never replaced.
  super(ctx,{...env,HEARTHSIDE_VAULT_AUTHORITY:{
   policy:async(scope,input,token)=>{
    const fresh=await resolveGuestAuthority(env,token,householdId);
    if(!fresh.hostScope||fresh.hostScope.subject!==scope.subject||fresh.hostScope.memberId!==scope.memberId)throw Error('FORBIDDEN');
    const current=await room().hearthsideContent(fresh.hostScope);
    const principals=fresh.principals.filter(p=>current.memberIds.includes(p.memberId));
    if(principals.length!==current.memberIds.length)throw Error('FORBIDDEN');
    const author=principals.find(p=>p.memberId===scope.memberId&&p.subject===scope.subject);
    const recipients=input.recipientMemberIds.map(id=>principals.find(p=>p.memberId===id));
    if(!author||recipients.some(p=>!p))throw Error('FORBIDDEN');
    return {recipients,approvers:input.kind==='shared-memory'?principals:[author]};
   },
   accept:(scope,ref)=>room().acceptVaultPublication(scope,ref),
   isReferenced:(scope,id)=>room().vaultMediaReferenced(scope,id)
  }});
 }
}
export default {async fetch(request,env){
 const url=new URL(request.url);
 if(!url.pathname.startsWith('/__assembly/'))return await handleHearthsideGuests(request,env)||new Response('',{status:404});
 try{
  // This fixture-only router is bundled solely by the test; no production endpoint exists.
  const token=request.headers.get('Authorization')?.slice(7),fresh=await resolveGuestAuthority(env,token,householdId);
  if(!fresh.hostScope)throw Error('FORBIDDEN');
  const scope=fresh.hostScope,room=env.LEDGER_ROOMS.get(env.LEDGER_ROOMS.idFromName('development/'+householdId)),vault=env.HEARTHSIDE_VAULTS.get(env.HEARTHSIDE_VAULTS.idFromName('development/'+householdId));
  const action=url.pathname.slice('/__assembly/'.length);
  if(action==='socket')return room.fetch(request);
  if(action==='import'){await room.ensureImported(scope,token,await request.json());return Response.json({ok:true});}
  if(action==='ticket')return Response.json({ticket:await room.ticket(scope)});
  if(action==='snapshot')return Response.json(await room.snapshot(scope));
  if(action==='content')return Response.json(await room.hearthsideContent(scope));
  if(action==='design')return Response.json(await room.design(scope,await request.json()));
  if(action==='vault'){return Response.json(await vault.commandFor(scope,await request.json(),true,token));}
  if(action==='upload')return Response.json(await vault.uploadFor(scope,'voice',new Uint8Array(await request.arrayBuffer()),'audio/ogg'));
  if(action==='media'){const input=await request.json();return vault.mediaFor(scope,input.id,input.publicationId,input.mode??'active');}
  if(action==='control'){const {key,value}=await request.json();await env.CONTROL.get(env.CONTROL.idFromName('control')).change(key,value);return Response.json({ok:true});}
  return new Response('',{status:404});
 }catch(error){return Response.json({code:error.message},{status:409});}
}};
