import {useRef,useState} from 'react';
import type {HarbourRuntime} from '../../src/harbour/scene/runtime.ts';
import type {FrameStudy} from '../../src/harbour/mountain/performance.ts';
import type {MountainDemoStory} from '../fixtures/mountainDemo.ts';
import './mountain-rehearsal.css';
type Capture={device:string;theme:string;viewport:string;capturedAt:string;world:string;report:FrameStudy};
const request=(id:string)=>window.dispatchEvent(new CustomEvent('hearth:mountain-tour',{detail:id}));
const runtime=()=>document.querySelector<HTMLElement&{__harbour?:HarbourRuntime}>('.house-world__canvas[data-harbour-tier]')?.__harbour;
const number=(n:number|null)=>n===null?'—':n.toFixed(1);
export function MountainRehearsal({story,run}:{story:MountainDemoStory;run:string}){
  const [open,setOpen]=useState(false),[device,setDevice]=useState(''),[label,setLabel]=useState('Walk · lap 1'),[active,setActive]=useState(false),[reports,setReports]=useState<Capture[]>([]),[message,setMessage]=useState('');
  const measuring=useRef<HarbourRuntime|null>(null);
  const link=(next:MountainDemoStory,fresh=false)=>`/__review?seed=mountain&story=${next}&run=${fresh?Date.now().toString(36):run}&member=MEM-001`;
  const capture=()=>{
    if(active&&measuring.current){const report=measuring.current.measure('stop');setReports(old=>[...old,{device:device||'Unspecified — not physical-device evidence',theme:document.documentElement.dataset.theme??'See screenshot',viewport:`${innerWidth} × ${innerHeight}`,capturedAt:new Date().toISOString(),world:'hearth-mountain-review',report}].slice(-8));setActive(false);measuring.current=null;return;}
    const world=runtime();if(!world){setMessage('Open the illustrated world before measuring.');return;}
    measuring.current=world;world.measure('start',label);setActive(true);setMessage('Recording painted-frame intervals. Close this guide, traverse the route, then stop the capture.');
  };
  const download=()=>{const blob=new Blob([JSON.stringify({kind:'hearth-mountain-manual-evidence',version:1,synthetic:true,reports},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='hearth-mountain-device-evidence.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  return <aside className="mountain-rehearsal" aria-label="Fictional mountain rehearsal">
    <button className="mountain-rehearsal-trigger" aria-expanded={open} onClick={()=>setOpen(!open)}>{active?'● Recording · rehearsal':'Fictional rehearsal guide'}</button>
    {open&&<section><header><h2>Hearth Mountain rehearsal</h2><button aria-label="Close rehearsal guide" onClick={()=>setOpen(false)}>×</button></header>
      <p><strong>Fictional data · local review only.</strong> No bank connection or real money. This is {story==='weathered'?'the dated strain and recovery chapter':'the shared-life chapter'}.</p>
      <ol className="mountain-rehearsal-story">
        <li><strong>See the connected world.</strong> <button onClick={()=>{request('arrival');setOpen(false);}}>Arrival view</button></li>
        <li><strong>Explain the water.</strong> <button onClick={()=>{request('water');setOpen(false);}}>Dam view</button><p>The fixture contains a pending fictional {story==='weathered'?'$2,000':'$250'} contribution. Open the Fund, review its receipt, then use the ordinary <em>Confirm received</em> control. Returning to the dam shows accepted water; cancelling leaves it unchanged.</p><button onClick={()=>{request('fund');setOpen(false);}}>Open ordinary Fund review</button></li>
        <li><strong>Ride uphill and use a working destination.</strong><p>Use Mountain & town → Travel & race to board. Open the Library, use Standing Book and return.</p><button onClick={()=>{request('enter-library');setOpen(false);}}>Enter the Library</button></li>
        <li><strong>Observe the same garden.</strong><button onClick={()=>{request('garden');setOpen(false);}}>Fixed garden view</button><p>{story==='weathered'?'The fixture has 35 days of dated, uncovered recorded purchases and a current tied bank check. Confirming its recovery contribution covers the recorded deficit. Observe this garden before and after; recovery marks represent the transition actually observed on this device.':'Growth uses qualifying shared activity. The next chapter is a separately labelled synthetic household with dated strain; no animation invents a financial event.'}</p><a href={link('weathered')}>Open dated strain chapter</a></li>
        <li><strong>Take the descent.</strong><p>Start Summit to sea from Travel & race. Finish at the waterfront, then open the Fund immediately.</p><button onClick={()=>{request('summit');setOpen(false);}}>Summit view</button><button onClick={()=>{request('finish');setOpen(false);}}>Waterfront view</button></li>
      </ol>
      <p><a href={link('growing',true)}>Start a new fictional rehearsal</a> creates another isolated local fixture. It does not erase an earlier rehearsal.</p>
      <details><summary>Device and repeated-lap evidence</summary><p>Use a real iPhone/Safari and this Mac. Emulation is not phone evidence. Record separate walking, riding and race laps; stop in the same place after each lap. Close this guide during movement.</p>
        <label>Physical device and browser<input value={device} onChange={e=>setDevice(e.target.value)} placeholder="e.g. iPhone model · iOS · Safari" maxLength={100}/></label>
        <label>Capture label<input value={label} onChange={e=>setLabel(e.target.value)} maxLength={80}/></label>
        <button onClick={capture}>{active?'Stop and retain capture':'Start capture'}</button><p role="status">{message}</p>
        {reports.map((capture,i)=><article key={i}><strong>{capture.report.label}</strong><p>{capture.device}</p><dl><dt>Painted fps</dt><dd>{number(capture.report.paintedFps)}</dd><dt>Frame p50 / p95 / p99 (ms)</dt><dd>{number(capture.report.p50Ms)} / {number(capture.report.p95Ms)} / {number(capture.report.p99Ms)}</dd><dt>Frames over 33.8 ms</dt><dd>{number(capture.report.over33msPercent)}%</dd><dt>Geometry count, start → end</dt><dd>{capture.report.first?.geometries??'—'} → {capture.report.last?.geometries??'—'}</dd><dt>Texture count, start → end</dt><dd>{capture.report.first?.textures??'—'} → {capture.report.last?.textures??'—'}</dd></dl><p>{capture.report.interruptions||capture.report.capped?'Interrupted or capped — not continuous traversal proof.':'Check duration, route and device before judging acceptance.'}</p></article>)}
        <button disabled={!reports.length} onClick={download}>Download these measurements</button><p>Counts are not GPU memory bytes. The report contains device notes and performance numbers only, never household books or partner identity.</p>
      </details>
      <p>Final art, audio listening, real controls and two-device presence must be judged in the actual experience. These controls never mark an acceptance gate passed automatically.</p>
    </section>}
  </aside>;
}
