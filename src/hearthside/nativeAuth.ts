import type {Environment} from '../core/types.ts';
import {assertPublishableKey,buildSupabaseGoogleAuthorizeUrl,loadSupabaseSession,saveSupabaseSession,sessionFromTokenPayload,type HearthAuthConfig,type HearthSupabaseSession,type NativeSignInAdapter} from '../auth/supabaseSession.ts';
import {nativeIssuer,validateNativeSession,type NativeSecureStorage} from './nativeSessionStore.ts';
export interface NativeAuthPlugin extends NativeSecureStorage {
  authStorageVersion():Promise<{version:2}>;
  authenticate(input:{url:string;state:string}):Promise<{callbackUrl:string}>;
  peekAuthCallback():Promise<{callbackUrl:string|null}>;
  acknowledgeAuthCallback(input:{callbackUrl:string}):Promise<void>;
  cancelAuthentication():Promise<void>;
}
export const NATIVE_AUTH_EVENT='hearth:native-auth';
export const NATIVE_AUTH_PENDING_KEY='hearth-native-auth-v2';
export type NativeAuthStatus={phase:'idle'|'opening'|'waiting'|'finishing'|'complete'|'error';environment:Environment|null;message:string};
type Pending={version:2;returnPath:string;environment:Environment;issuer:string;state:string;verifier:string;expiresAt:number;expectedUserId:string|null;callback:string|null;session:HearthSupabaseSession|null;phase:'waiting'|'exchanging'|'received'|'complete'|'cancelled'};
const base64url=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
const random=()=>base64url(crypto.getRandomValues(new Uint8Array(32)));
const object=(raw:unknown):Record<string,unknown>=>{if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Invalid secure sign-in recovery.');return raw as Record<string,unknown>;};
function pending(raw:string|null):Pending|null {
  if(raw===null)return null;const p=object(JSON.parse(raw));
  if(Object.keys(p).sort().join(',')!=='callback,environment,expectedUserId,expiresAt,issuer,phase,returnPath,session,state,verifier,version'||p.version!==2||!['development','production'].includes(String(p.environment))||typeof p.issuer!=='string'||!['waiting','exchanging','received','complete','cancelled'].includes(String(p.phase))||typeof p.state!=='string'||!/^[-_A-Za-z0-9]{43}$/.test(p.state)||typeof p.verifier!=='string'||!/^[-_A-Za-z0-9]{43}$/.test(p.verifier)||typeof p.expiresAt!=='number'||!Number.isSafeInteger(p.expiresAt)||(p.expectedUserId!==null&&typeof p.expectedUserId!=='string')||(p.callback!==null&&(typeof p.callback!=='string'||p.callback.length>8192)))throw new Error('Invalid secure sign-in recovery.');
  nativeAuthReturnPath(p.returnPath);nativeIssuer(p.issuer);if(p.session!==null)p.session=validateNativeSession(p.session,p.issuer);return p as Pending;
}
export function nativeAuthReturnPath(raw:unknown):string {
  if(typeof raw!=='string'||raw.length>4096||!raw.startsWith('/')||raw.startsWith('//')||raw.includes('\\'))throw new Error('Invalid native return path.');
  const url=new URL(raw,'https://native.invalid');
  if(url.origin!=='https://native.invalid'||url.hash||!(/^\/(?:join|hearthside(?:\/[A-Za-z0-9%_/-]+)?)?$/.test(url.pathname))||[...url.searchParams.keys()].some(k=>['access_token','refresh_token','provider_token'].includes(k)))throw new Error('Invalid native return path.');
  return url.pathname+url.search;
}
export function nativeCallbackCode(callback:string,request:Pick<Pending,'state'|'environment'>):string {
  if(callback.length>8192)throw new Error('Invalid native sign-in return.');const u=new URL(callback);
  if(u.protocol!=='hearthside:'||u.hostname!=='auth'||u.pathname!=='/callback'||u.port||u.username||u.password||u.hash||[...u.searchParams.keys()].some(k=>!['state','hearthAuthEnv','code'].includes(k))||u.searchParams.getAll('state').length!==1||u.searchParams.get('state')!==request.state||u.searchParams.getAll('hearthAuthEnv').length!==1||u.searchParams.get('hearthAuthEnv')!==request.environment||u.searchParams.getAll('code').length!==1)throw new Error('Sign-in returned to another environment or session.');
  const code=u.searchParams.get('code')!;if(!code||code.length>4096)throw new Error('The sign-in code is missing.');return code;
}
/** Owns one durable PKCE flow on this device. Native callbacks never grant household access themselves. */
export class NativeAuthController implements NativeSignInAdapter {
  private cancelFlight:Promise<void>|null=null;private generation=0;private running=false;private recovery:Promise<void>|null=null;private writeTail:Promise<void>=Promise.resolve();private completed:Environment|null=null;private returnPath:string|null=null;
  private status:NativeAuthStatus={phase:'idle',environment:null,message:''};
  constructor(private readonly plugin:NativeAuthPlugin,private readonly config:()=>HearthAuthConfig|null,private readonly fetcher:typeof fetch=fetch,private readonly now:()=>number=Date.now,private readonly publish:(status:NativeAuthStatus)=>void=()=>{}){}
  getStatus():NativeAuthStatus{return {...this.status};}
  takeReturnPath():string|null{const path=this.returnPath;this.returnPath=null;return path;}
  takeCompletion():Environment|null{const environment=this.completed;this.completed=null;return environment;}
  private report(phase:NativeAuthStatus['phase'],environment:Environment|null,message=''){this.status={phase,environment,message};this.publish(this.getStatus());}
  private persist(value:Pending):Promise<void>{const text=JSON.stringify(value);const result=this.writeTail.catch(()=>{}).then(async()=>{try{await this.plugin.secureSet({key:NATIVE_AUTH_PENDING_KEY,value:text});}catch(error){if((await this.plugin.secureGet({key:NATIVE_AUTH_PENDING_KEY})).value!==text)throw error;}});this.writeTail=result;return result;}
  private assertActive(generation:number){if(generation!==this.generation)throw new Error('This sign-in was cancelled or replaced.');}
  start(environment:Environment,config:HearthAuthConfig,options:{selectAccount?:boolean;returnPath?:string}):boolean {
    if(this.running||this.recovery||this.cancelFlight)return false;assertPublishableKey(config.publishableKey);nativeIssuer(config.supabaseUrl);this.running=true;const generation=++this.generation;
    void this.begin(environment,config,options,generation).catch(error=>{if(generation===this.generation)this.report('error',environment,error instanceof Error?error.message:'Native sign-in could not finish.');}).finally(()=>{if(generation===this.generation)this.running=false;});return true;
  }
  private async begin(environment:Environment,config:HearthAuthConfig,options:{selectAccount?:boolean;returnPath?:string},generation:number){
    this.report('opening',environment);await this.plugin.cancelAuthentication();this.assertActive(generation);
    const request:Pending={version:2,returnPath:nativeAuthReturnPath(options.returnPath??'/'),environment,issuer:nativeIssuer(config.supabaseUrl),state:random(),verifier:random(),expiresAt:this.now()+600000,expectedUserId:options.selectAccount?null:loadSupabaseSession(environment)?.userId??null,callback:null,session:null,phase:'waiting'};
    const challenge=base64url(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(request.verifier))));this.assertActive(generation);
    await this.persist(request);this.assertActive(generation);
    const redirect=new URL('hearthside://auth/callback');redirect.searchParams.set('state',request.state);
    const url=new URL(buildSupabaseGoogleAuthorizeUrl(config,environment,redirect.toString(),options));url.searchParams.set('code_challenge',challenge);url.searchParams.set('code_challenge_method','s256');
    this.report('waiting',environment,'Finish Google sign-in in the system browser.');const result=await this.plugin.authenticate({url:url.toString(),state:request.state});this.assertActive(generation);
    await this.finish(request,result.callbackUrl,config,generation);
  }
  async recover():Promise<void>{
    if(this.running||this.cancelFlight)return;if(this.recovery)return this.recovery;const generation=this.generation;
    const work=this.restore(generation);this.recovery=work;
    try{await work;}catch(error){if(generation===this.generation)this.report('error',this.status.environment,error instanceof Error?error.message:'Secure sign-in recovery failed.');throw error;}finally{if(this.recovery===work)this.recovery=null;}
  }
  private async restore(generation:number){
    await this.writeTail;const request=pending((await this.plugin.secureGet({key:NATIVE_AUTH_PENDING_KEY})).value);this.assertActive(generation);
    if(!request||request.phase==='cancelled'){await this.plugin.cancelAuthentication();return;}
    const config=this.config();if(!config||nativeIssuer(config.supabaseUrl)!==request.issuer)throw new Error('The Auth environment changed. Start sign-in again.');
    if(request.phase==='complete'){
      // Session write preceded completion; only recover the exact still-current session.
      const current=request.session&&loadSupabaseSession(request.environment)?.accessToken===request.session.accessToken;
      if(request.callback)await this.plugin.acknowledgeAuthCallback({callbackUrl:request.callback});await this.plugin.secureRemove({key:NATIVE_AUTH_PENDING_KEY});this.assertActive(generation);
      if(current){this.completed=request.environment;this.returnPath=request.returnPath;this.report('complete',request.environment);}return;
    }
    if(request.expiresAt<this.now()&&request.phase!=='received')throw new Error('This sign-in expired. Start Google sign-in again.');
    const callback=request.callback??(await this.plugin.peekAuthCallback()).callbackUrl;this.assertActive(generation);
    if(!callback){this.report('waiting',request.environment,'Return from Google sign-in, or cancel and start again.');return;}
    await this.finish(request,callback,config,generation);
  }
  private async finish(request:Pending,callback:string,config:HearthAuthConfig,generation:number){
    this.assertActive(generation);const code=nativeCallbackCode(callback,request);if(request.expiresAt<this.now()&&request.phase!=='received')throw new Error('This sign-in expired. Start again.');
    this.report('finishing',request.environment,'Saving your secure sign-in.');
    if(!request.session){
      request={...request,callback,phase:'exchanging'};await this.persist(request);this.assertActive(generation);
      const fetcher=this.fetcher;
      const response=await fetcher(`${request.issuer}/auth/v1/token?grant_type=pkce`,{method:'POST',headers:{apikey:config.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({auth_code:code,code_verifier:request.verifier})});
      this.assertActive(generation);if(!response.ok)throw new Error(response.status===400||response.status===401?'Google sign-in could not be recovered. Start sign-in again.':'Google sign-in could not finish. Return here to retry.');
      const body=object(await response.json());this.assertActive(generation);const user=object(body.user);
      if(typeof body.access_token!=='string'||typeof body.refresh_token!=='string'||typeof user.id!=='string'||typeof user.email!=='string')throw new Error('Auth returned an incomplete session.');
      const metadata=object(user.user_metadata);
      const session=validateNativeSession(sessionFromTokenPayload({accessToken:body.access_token,refreshToken:body.refresh_token,providerToken:typeof body.provider_token==='string'?body.provider_token:undefined,user:{id:user.id,email:user.email,user_metadata:metadata}}),request.issuer);
      if(request.expectedUserId&&request.expectedUserId!==session.userId)throw new Error('Google returned another account. Choose Switch account deliberately.');
      request={...request,session,phase:'received'};await this.persist(request);this.assertActive(generation);
    }
    await saveSupabaseSession(request.environment,request.session!);this.assertActive(generation);
    request={...request,phase:'complete'};await this.persist(request);this.assertActive(generation);
    await this.plugin.acknowledgeAuthCallback({callbackUrl:callback});this.assertActive(generation);
    await this.plugin.secureRemove({key:NATIVE_AUTH_PENDING_KEY});this.assertActive(generation);
    this.completed=request.environment;this.returnPath=request.returnPath;this.report('complete',request.environment);
  }
  cancel(environment:Environment):Promise<void>{
    if(this.cancelFlight)return this.cancelFlight;
    // Invalidate in-flight network completion before any asynchronous work.
    ++this.generation;this.running=false;
    const work=(async()=>{
      await this.writeTail.catch(()=>{});
      const raw=(await this.plugin.secureGet({key:NATIVE_AUTH_PENDING_KEY})).value;
      let request:Pending|null=null;
      try{request=pending(raw);}catch{await this.plugin.secureRemove({key:NATIVE_AUTH_PENDING_KEY});}
      // One native browser flow exists, so even another environment's sign-out cancels it.
      if(request)await this.persist({...request,phase:'cancelled',session:null,callback:null});
      await this.plugin.cancelAuthentication();this.completed=null;this.returnPath=null;this.report('idle',null);
    })();
    this.cancelFlight=work;void environment;
    return work.finally(()=>{if(this.cancelFlight===work)this.cancelFlight=null;});
  }
}
