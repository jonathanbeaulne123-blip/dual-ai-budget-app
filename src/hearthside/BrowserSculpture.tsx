import {useEffect,useRef,useState} from 'react';
import {KittyFlat} from '../kitty/studio/flat.tsx';
import type {KittyPieceV1} from '../core/types.ts';

/** Local immutable GLB. Quick Look generates USDZ locally; WebXR keeps the same
 * scene in the browser. Scene Viewer re-fetches a public URL, so it is excluded
 * from this recipient-private source. No model is uploaded for browser AR. */
export function BrowserSculpture({url,piece,revision}:{url:string;piece:KittyPieceV1;revision:number}){
 const host=useRef<HTMLDivElement>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{
  let live=true,element:HTMLElement|null=null;setLoading(true);setError('');
  const loaded=()=>{if(live)setLoading(false);};
  const failed=()=>{if(live){setLoading(false);setError('The 3D view could not open. Your illustrated sculpture and model download remain available.');}};
  void import('@hearth/browser-ar').then(({ModelViewerElement})=>{
   if(!live||!host.current)return;
   // A private selection must leave the model cache when its surface closes.
   ModelViewerElement.modelCacheSize=0;
   element=document.createElement('model-viewer');
   const attributes={src:url,alt:`Your selected sculpture at revision ${revision}`,'camera-controls':'','touch-action':'pan-y',ar:'','ar-modes':'webxr quick-look','ar-scale':'fixed','environment-image':'neutral','shadow-intensity':'0.4','interaction-prompt':'none',loading:'eager',reveal:'auto'};
   for(const [key,value]of Object.entries(attributes))element.setAttribute(key,value);
   element.style.cssText='width:100%;height:360px;max-width:100%;background:transparent';
   const place=document.createElement('button');place.slot='ar-button';place.textContent='Place this sculpture beside me';place.type='button';element.append(place);
   const exit=document.createElement('button');exit.slot='exit-webxr-ar-button';exit.textContent='Return to my sculpture';exit.type='button';element.append(exit);
   element.addEventListener('load',loaded);element.addEventListener('error',failed);element.addEventListener('ar-status',event=>{if(live&&(event as CustomEvent).detail?.status==='failed')setError('This phone could not start placement. You can turn the sculpture here or return to Studio.');});
   host.current.append(element);
  }).catch(failed);
  return()=>{live=false;element?.removeEventListener('load',loaded);element?.removeEventListener('error',failed);element?.removeAttribute('src');element?.remove();};
 },[url,revision]);
 return <div className="design-browser-sculpture"><div ref={host}/>{(loading||error)&&<KittyFlat piece={piece} step={0} title="The selected sculpture"/>}{loading&&<p role="status">Opening the selected sculpture…</p>}{error&&<p role="status">{error}</p>}<p>Turn your sculpture with a drag or the arrow keys. Placement is available on supported phones. Return to Studio to review a contribution.</p></div>;
}
