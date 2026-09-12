import {useEffect,useState} from 'react';
import {loadSupabaseSession} from '../auth/supabaseSession.ts';
import {nativeWidgetController,nativeWidgetPlugin} from './nativeBootstrap.ts';
import {captureNativeWidget} from './nativeWidgetCapture.ts';
import {NativeWidgetSurface} from './NativeWidgetSurface.tsx';
import type {NativeWidgetSelection} from './nativeWidget.ts';
import type {DesignSurfaceSelection} from './designSurfaceContracts.ts';
/** Deliberate capture from the same immutable revision used by exports and AR. */
export function NativeWidgetEntry({selection,onClose}:{selection:DesignSurfaceSelection;onClose:()=>void}){
 const [image,setImage]=useState<NativeWidgetSelection|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 const controller=nativeWidgetController(),plugin=nativeWidgetPlugin(),{environment,householdId,memberId}=selection.identity;
 const subject=loadSupabaseSession(environment)?.userId,scope=subject?{environment,householdId,memberId,subject}:null;
 const key=JSON.stringify([selection.identity,subject]);
 useEffect(()=>{const abort=new AbortController();setImage(null);setError('');
  if(controller&&plugin&&scope)void captureNativeWidget({designId:selection.identity.designId,revision:selection.identity.revision,piece:selection.piece},abort.signal).then(image=>{if(!abort.signal.aborted)setImage(image);}).catch(()=>{if(!abort.signal.aborted)setError('This device could not capture the sculpture. Your piece is safe; you can retry.');});
  return()=>abort.abort();
 },[key,attempt,controller,plugin]);
 if(!controller||!plugin||!scope)return <section aria-label="Home-screen sculpture"><h2>Your sculpture, close by</h2><p>Open the native companion and sign in to choose a home-screen sculpture.</p><button onClick={onClose}>Return to Studio</button></section>;
 if(!image)return <section aria-label="Home-screen sculpture"><h2>Your sculpture, close by</h2><p role={error?'alert':'status'}>{error||'Capturing this accepted sculpture…'}</p>{error&&<button onClick={()=>setAttempt(n=>n+1)}>Retry image</button>}<button onClick={onClose}>Return to Studio</button></section>;
 return <NativeWidgetSurface key={key} controller={controller} plugin={plugin} scope={scope} selection={image} onClose={onClose}/>;
}
