import {HARBOUR_DEV} from '../flag.ts';
import {createRoot} from 'react-dom/client';
import {Profiler} from 'react';
import HorizonInspector from '../../diagnostics/HorizonInspector.tsx';
import {recordOverlayRender} from '../../diagnostics/inspectorCore.ts';
/** Local greybox harness: no household, accounts, authentication or financial reads. */
if(HARBOUR_DEV&&new URLSearchParams(location.search).get('world')==='horizon'){
  void import('./HorizonStage.tsx').then(({default:HorizonStage})=>createRoot(document.getElementById('root')!).render(<><HorizonStage review theme={new URLSearchParams(location.search).get('theme')==='taylor'?'taylor':new URLSearchParams(location.search).get('theme')==='newfoundland'?'newfoundland':'classic'} onDoor={(host,body)=>{(window as unknown as {__horizonDoor:unknown}).__horizonDoor={host:host.id,body};window.dispatchEvent(new CustomEvent('horizon:review-door',{detail:{host:host.id,body}}));}}/><Profiler id="Horizon Inspector" onRender={(_id,_phase,ms)=>recordOverlayRender(ms)}><HorizonInspector/></Profiler></>));
}else document.getElementById('root')!.textContent='The Horizon review is available only in development with world=horizon.';
