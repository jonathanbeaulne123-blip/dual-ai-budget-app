import type { Scope } from '../src/ledgerSync/protocol.ts';
import {guestAssert,guestDigest,guestDigestValue,guestId,guestInteger,guestPrincipals,guestRecord,guestSubject,type GuestIdentity,type GuestPrincipal} from '../src/hearthside/guestContracts.ts';

export type GuestAuthorityEnv={SUPABASE_URL?:string;SUPABASE_PUBLISHABLE_KEY?:string;HEARTHSIDE_GUEST_AUTHORITY_KEY?:string;HEARTHSIDE_GUEST_AUTHORITY_KEY_ID?:string;HEARTHSIDE_GUEST_CONTROL_PLANE?:{fetch(request:Request):Promise<Response>}};
export type GuestAuthorityResult={identity:GuestIdentity;principals:GuestPrincipal[];hostScope:Scope|null};
export function guestBearer(request:Request):string {const token=request.headers.get('Authorization')?.match(/^Bearer ([A-Za-z0-9._~-]{1,8192})$/)?.[1];guestAssert(token,'GUEST_UNAUTHENTICATED');return token;}
export async function guestAuthorityAttestation(env:GuestAuthorityEnv,token:string,householdId:string|null,issuedAt=Math.floor(Date.now()/1000)) {
  guestAssert(typeof env.HEARTHSIDE_GUEST_AUTHORITY_KEY==='string'&&/^[0-9a-f]{64}$/.test(env.HEARTHSIDE_GUEST_AUTHORITY_KEY)&&env.HEARTHSIDE_GUEST_AUTHORITY_KEY_ID,'GUEST_DISABLED');
  guestAssert(/^[A-Za-z0-9._~-]{1,8192}$/.test(token),'GUEST_UNAUTHENTICATED');
  guestAssert(householdId===null||/^HH-[A-Za-z0-9_-]{1,96}$/.test(householdId));
  const keyId=guestId(env.HEARTHSIDE_GUEST_AUTHORITY_KEY_ID),tokenHash=await guestDigest(new TextEncoder().encode(token).buffer),material=['hearthside-guest-authority-v1',keyId,'development',householdId??'',String(issuedAt),tokenHash].join('\n');
  const raw=Uint8Array.from(env.HEARTHSIDE_GUEST_AUTHORITY_KEY.match(/.{2}/g)!,v=>parseInt(v,16)),key=await crypto.subtle.importKey('raw',raw,{name:'HMAC',hash:'SHA-256'},false,['sign']);raw.fill(0);
  const signature=[...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(material)))].map(b=>b.toString(16).padStart(2,'0')).join('');
  return {p_environment:'development',p_household_id:householdId,p_key_id:keyId,p_issued_at:issuedAt,p_token_sha256:tokenHash,p_signature:signature};
}
export async function guestBoundedJson(response:Response,limit=32*1024):Promise<unknown> {
  guestAssert(response.body,'GUEST_UNAVAILABLE');const reader=response.body.getReader(),chunks:Uint8Array[]=[];let length=0;
  try{while(true){const item=await reader.read();if(item.done)break;length+=item.value.length;if(length>limit){await reader.cancel();throw Error('GUEST_INPUT_TOO_LARGE');}chunks.push(item.value);}const all=new Uint8Array(length);let at=0;for(const chunk of chunks){all.set(chunk,at);at+=chunk.length;}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(all));}finally{reader.releaseLock();}
}
/** The caller owns its subject. Host roster checks are server-attested, not host-replica reads. No cache. */
export async function resolveGuestAuthority(env:GuestAuthorityEnv,token:string,householdId:string|null):Promise<GuestAuthorityResult> {
  guestAssert(env.SUPABASE_URL&&env.SUPABASE_PUBLISHABLE_KEY,'GUEST_DISABLED');const url=new URL(env.SUPABASE_URL);
  guestAssert(url.protocol==='https:'&&!url.username&&!url.password&&!url.search&&!url.hash&&url.pathname==='/','GUEST_DISABLED');url.pathname='/rest/v1/rpc/hearthside_guest_authority';
  const input=await guestAuthorityAttestation(env,token,householdId),abort=new AbortController(),timer=setTimeout(()=>abort.abort(),8000);let raw:unknown;
  try {const request=new Request(url,{method:'POST',redirect:'manual',signal:abort.signal,headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${token}`,'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify(input)});const result=await (env.HEARTHSIDE_GUEST_CONTROL_PLANE?env.HEARTHSIDE_GUEST_CONTROL_PLANE.fetch(request):fetch(request));if(!result.ok){await result.body?.cancel();throw Error(result.status===401||result.status===403?'GUEST_UNAUTHENTICATED':'GUEST_UNAVAILABLE');}raw=await guestBoundedJson(result,16*1024);}catch(error){throw Error(error instanceof Error&&error.message==='GUEST_UNAUTHENTICATED'?'GUEST_UNAUTHENTICATED':'GUEST_UNAVAILABLE');}finally{clearTimeout(timer);}
  const r=guestRecord(raw,['version','environment','householdId','subject','checkedAt','principals','actorMemberId']);guestAssert(r.version===1&&r.environment==='development'&&r.householdId===householdId,'GUEST_UNAUTHENTICATED');
  const checkedAt=guestInteger(r.checkedAt);guestAssert(checkedAt>=Date.now()-30000&&checkedAt<=Date.now()+5000,'GUEST_UNAUTHENTICATED');const subject=guestSubject(r.subject),identity:GuestIdentity={environment:'development',subject,checkedAt,expires:Date.now()+15000};
  if(householdId===null){guestAssert(r.actorMemberId===null&&Array.isArray(r.principals)&&r.principals.length===0);return {identity,principals:[],hostScope:null};}
  const principals=guestPrincipals(r.principals);let hostScope:Scope|null=null;
  if(r.actorMemberId!==null){const memberId=guestId(r.actorMemberId);guestAssert(principals.some(p=>p.memberId===memberId&&p.subject===subject),'GUEST_UNAUTHENTICATED');hostScope={environment:'development',householdId,memberId,subject,role:'member',expires:identity.expires,aclEpoch:checkedAt};}
  return {identity,principals,hostScope};
}
export function sameGuestRoster(a:GuestPrincipal[],b:GuestPrincipal[]):boolean{return JSON.stringify(guestPrincipals(a))===JSON.stringify(guestPrincipals(b));}
export function checkedGuestIdentity(raw:GuestIdentity):GuestIdentity {const r=guestRecord(raw,['environment','subject','expires','checkedAt']);guestAssert(r.environment==='development'&&guestInteger(r.expires)>Date.now(),'GUEST_UNAUTHENTICATED');guestSubject(r.subject);guestInteger(r.checkedAt);return raw;}
export const guestReceiptDigest=guestDigestValue;
