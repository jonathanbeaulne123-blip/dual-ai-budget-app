import {useEffect,useMemo,useState,type ReactNode} from 'react';
import {clearSupabaseSession,consumeSupabaseAuthRedirect,ensureSupabaseSession,loadSupabaseSession,startSupabaseGoogleSignIn,SUPABASE_SESSION_CHANGED_EVENT,supabaseSessionKey} from '../auth/supabaseSession.ts';
import {useAppearance} from '../theme/ThemeProvider.tsx';
import {GuestVisits} from './GuestVisits.tsx';
import {HEARTHSIDE_FLAGS} from './flags.ts';

export const isOwnStreetPath=(pathname:string)=>pathname==='/hearthside/street'||pathname==='/hearthside/street/';
/** Own sign-in entry before App mounts: a visitor never loads a host or creates a household. */
export function HearthsideEntry({children}:{children:ReactNode}){
 const [street,setStreet]=useState(()=>isOwnStreetPath(window.location.pathname));
 useEffect(()=>{const locate=()=>setStreet(isOwnStreetPath(window.location.pathname));window.addEventListener('popstate',locate);return()=>window.removeEventListener('popstate',locate);},[]);
 return street?<StreetEntry/>:children;
}
export function StreetEntry(){
 const appearance=useAppearance(),[session,setSession]=useState(()=>loadSupabaseSession('development')),[error,setError]=useState(''),[starting,setStarting]=useState(false);
 useEffect(()=>{
  const refresh=()=>{setSession(loadSupabaseSession('development'));setStarting(false);};
  const storage=(event:StorageEvent)=>{if(event.key===null||event.key===supabaseSessionKey('development'))refresh();};
  window.addEventListener(SUPABASE_SESSION_CHANGED_EVENT,refresh);window.addEventListener('storage',storage);window.addEventListener('pageshow',refresh);
  try{consumeSupabaseAuthRedirect();refresh();}catch{setError('Sign-in could not finish. Your existing invitations are safe. Try signing in again.');}
  return()=>{window.removeEventListener(SUPABASE_SESSION_CHANGED_EVENT,refresh);window.removeEventListener('storage',storage);window.removeEventListener('pageshow',refresh);};
 },[]);
 const subject=session?.userId,sessionId=session?.sessionId;
 const auth=useMemo(()=>subject&&sessionId?{scopeKey:JSON.stringify(['guest-street','development',subject,sessionId]),token:async()=>{
  const current=loadSupabaseSession('development');if(current?.userId!==subject||current.sessionId!==sessionId)throw Error('GUEST_UNAUTHENTICATED');
  const fresh=await ensureSupabaseSession('development');if(fresh?.userId!==subject||fresh.sessionId!==sessionId)throw Error('GUEST_UNAUTHENTICATED');return fresh.accessToken;
 }}:null,[subject,sessionId]);
 const close=()=>window.location.assign('/');
 if(!HEARTHSIDE_FLAGS.guestPublication)return <main className="guest-visits" data-guest-theme={appearance.scene.theme}><h1>Your private street</h1><p>Guest visits are not enabled in this build.</p><button onClick={close}>Open Hearth</button></main>;
 async function signIn(){setError('');try{setStarting(startSupabaseGoogleSignIn('development',new URL('/hearthside/street',window.location.origin).toString()));}catch{setStarting(false);setError('Google sign-in is unavailable. Please try again.');}}
 return <><div className="guest-own-account">{session&&<><span>Signed in as {session.displayName||session.email}</span><button onClick={()=>{void Promise.resolve(clearSupabaseSession('development')).then(()=>setSession(null)).catch(()=>setError('Sign-out did not finish. Try again.'));}}>Sign out</button></>}</div>
  {error&&<p role="alert">{error}</p>}
  {auth?<GuestVisits auth={auth} theme={appearance.scene.theme} onClose={close}/>:<main className="guest-visits" data-guest-theme={appearance.scene.theme}><p className="guest-eyebrow">The Boathouse · private street</p><h1>A door someone opened for you.</h1><p>Sign in to see your invitations or make a calling card. Your account is all you need to visit.</p><button disabled={starting} onClick={()=>void signIn()}>{starting?'Opening Google…':'Continue with Google'}</button><button onClick={close}>Open Hearth</button></main>}
 </>;
}
