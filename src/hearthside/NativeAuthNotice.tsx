import {useEffect,useState} from 'react';
import {nativeAuthController} from './nativeBootstrap.ts';
import {NATIVE_AUTH_EVENT,type NativeAuthStatus} from './nativeAuth.ts';
export function NativeAuthNotice(){
 const [status,setStatus]=useState<NativeAuthStatus|null>(()=>nativeAuthController()?.getStatus()??null),[busy,setBusy]=useState(false);
 useEffect(()=>{const update=()=>setStatus(nativeAuthController()?.getStatus()??null);window.addEventListener(NATIVE_AUTH_EVENT,update);update();return()=>window.removeEventListener(NATIVE_AUTH_EVENT,update);},[]);
 if(!status||['idle','complete'].includes(status.phase))return null;
 return <aside aria-label="Native sign-in" role={status.phase==='error'?'alert':'status'} style={{padding:'1rem',background:'var(--surface, #fff8e7)',color:'var(--text, #29231d)',border:'1px solid currentColor',borderRadius:'1rem'}}><p>{status.message||'Opening secure Google sign-in…'}</p><button type="button" disabled={busy} onClick={()=>{setBusy(true);const c=nativeAuthController();void (status.environment&&c?c.cancel(status.environment):Promise.resolve()).catch(()=>setStatus({...status,phase:'error',message:'Secure cancellation could not finish. Unlock this device and try again.'})).finally(()=>setBusy(false));}}>Cancel sign-in</button>{status.phase==='error'&&<button type="button" disabled={busy} onClick={()=>{setBusy(true);void nativeAuthController()?.recover().catch(()=>{}).finally(()=>setBusy(false));}}>Retry secure recovery</button>}</aside>;
}
