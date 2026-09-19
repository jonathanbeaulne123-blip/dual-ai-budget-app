import type { Environment } from '../core/types.ts';
import { decodeSupabaseJwt, type HearthSupabaseSession, type NativeSessionPersistence } from '../auth/supabaseSession.ts';
export interface NativeSecureStorage {
  secureGet(input:{key:string}):Promise<{value:string|null}>;
  secureSet(input:{key:string;value:string}):Promise<void>;
  secureRemove(input:{key:string}):Promise<void>;
}
export const nativeSessionKey=(environment:Environment)=>`hearth-native-session-v1:${environment}`;
export function nativeIssuer(raw:string):string { const url=new URL(raw); if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/') throw new Error('Native sign-in requires an exact HTTPS Auth origin.'); return url.origin; }
/** JWT decoding checks consistency with a TLS-authenticated token response; it is not signature verification. */
export function validateNativeSession(raw:unknown,issuer:string):HearthSupabaseSession {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Invalid secure session.');
  const row=raw as Record<string,unknown>,keys=['accessToken','refreshToken','providerToken','userId','sessionId','email','googleSubject','displayName','expiresAt'];
  if(Object.keys(row).some(k=>!keys.includes(k)))throw new Error('Invalid secure session fields.');
  for(const key of keys.filter(k=>k!=='expiresAt'&&k!=='providerToken'))if(typeof row[key]!=='string'||String(row[key]).length>(key==='refreshToken'?4096:8192))throw new Error('Invalid secure session field.');
  if(row.providerToken!==undefined&&(typeof row.providerToken!=='string'||row.providerToken.length>8192))throw new Error('Invalid provider credential.');
  if(!row.accessToken||!row.refreshToken||!row.userId||!row.sessionId||!row.email||!row.googleSubject||typeof row.expiresAt!=='number'||!Number.isSafeInteger(row.expiresAt)||row.expiresAt<=0)throw new Error('Incomplete secure session identity.');
  const session=row as HearthSupabaseSession,jwt=decodeSupabaseJwt(session.accessToken);
  if(jwt.iss!==`${nativeIssuer(issuer)}/auth/v1`||jwt.sub!==session.userId||jwt.session_id!==session.sessionId||typeof jwt.exp!=='number'||jwt.exp * 1000!==session.expiresAt||jwt.email?.toLowerCase()!==session.email.toLowerCase())throw new Error('Secure session belongs to another issuer or identity.');
  const googleSubject=jwt.user_metadata?.provider_id??jwt.user_metadata?.sub;
  if(typeof googleSubject!=='string'||googleSubject!==session.googleSubject)throw new Error('Secure Google subject changed.');
  return Object.freeze({...session});
}
/** One atomic, versioned Keychain/Keystore record per environment; never reads browser credential storage. */
export class NativeSessionStore implements NativeSessionPersistence {
  private ready=false; private sessions=new Map<Environment,HearthSupabaseSession>(); private tail:Promise<void>=Promise.resolve();
  constructor(private readonly storage:NativeSecureStorage,private readonly issuer:string,private readonly beforeIdentityChange:()=>Promise<void>=async()=>{}) { nativeIssuer(issuer); }
  async hydrate():Promise<void>{
    const loaded=new Map<Environment,HearthSupabaseSession>();
    for(const environment of ['development','production'] as const){
      const {value}=await this.storage.secureGet({key:nativeSessionKey(environment)});if(value===null)continue;
      const record:unknown=JSON.parse(value);if(!record||typeof record!=='object')throw new Error('Invalid secure session record.');
      const r=record as Record<string,unknown>;
      if(Object.keys(r).sort().join(',')!=='environment,issuer,session,version'||r.version!==1||r.environment!==environment||r.issuer!==nativeIssuer(this.issuer))throw new Error('Secure session scope changed.');
      if(r.session!==null)loaded.set(environment,validateNativeSession(r.session,this.issuer));
    }
    this.sessions=loaded;this.ready=true;
  }
  load(environment:Environment):HearthSupabaseSession|null {if(!this.ready)throw new Error('Secure session storage has not loaded.'); return this.sessions.get(environment)??null;}
  save(environment:Environment,session:HearthSupabaseSession):Promise<void>{return this.write(environment,validateNativeSession(session,this.issuer));}
  clear(environment:Environment):Promise<void>{return this.write(environment,null);}
  private write(environment:Environment,session:HearthSupabaseSession|null):Promise<void>{
    const operation=this.tail.catch(()=>{}).then(async()=>{
      if(!this.ready)throw new Error('Secure session storage has not loaded.');
      if(!session||this.sessions.get(environment)?.userId!==session.userId)await this.beforeIdentityChange();
      const key=nativeSessionKey(environment),value=JSON.stringify({version:1,environment,issuer:nativeIssuer(this.issuer),session});
      try{await this.storage.secureSet({key,value});}catch(error){if((await this.storage.secureGet({key})).value!==value)throw error;}
      if(session)this.sessions.set(environment,session);else this.sessions.delete(environment);
    });this.tail=operation;return operation;
  }
}
