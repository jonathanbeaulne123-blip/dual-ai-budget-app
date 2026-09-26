import {MOUNTAIN_INTERACTIONS,initialMountainInteractionState,mountainInteractionLabel,type MountainInteractionState} from './life.ts';
import {useEffect,useId,useRef,useState} from 'react';
import {MONORAIL_STOPS,districtAt,type Point3,type TransportKind} from './definition.ts';
import {mountainMap} from './mapData.ts';
import type {MonorailState,MonorailView} from './monorail.ts';

import type {BasinReading} from './basin.ts';
import './mountain.css';
import {MOUNTAIN_TOUR,type MountainTourId} from './tour.ts';
const MONORAIL_DOORS:Readonly<Record<string,string>>={quay:'campfire',studio:'kiln',boathouse:'boathouse',bank:'bank',hearth:'kitchen',orchard:'cottage',library:'library',glasshouse:'glasshouse',reservoir:'loft-banks',summit:'journey'};
export type MountainAction={kind:'life';id:string}|{kind:'tour';id:MountainTourId}|{kind:'go';at:Point3}|{kind:'ride';transport:TransportKind;from:number;to:number}|{kind:'monorail-board';from:number;stops:number[];companion:boolean}|{kind:'monorail-select';stop:number}|{kind:'monorail-control';control:'pause'|'brake'|'seat'|'companion'|'speed'|'view'|'exit'|'bell';value?:number|boolean|MonorailView}|{kind:'view';view:'dam'|'world'}|{kind:'race'}|{kind:'skip'}|{kind:'calm';on:boolean}|{kind:'sound';on:boolean};
/**
 * Step in's world panel (K6, Tool Atlas §7): the rides, the downhill race, the tour and the small moments —
 * the parts of the retired "Mountain & town" guide that stay in the world. Its Places moved to All tools ›
 * Places; its glass-dam Fund reading lives on the card and in the Fund bank panel. It has no trigger of its
 * own on the chrome: `runWorldAction("step-in")` and the card's Step in open it. `hideTrigger`, `reading`
 * and `statusLine` are still accepted so callers keep compiling.
 */
export function MountainPanel({open:controlledOpen,onOpenChange,life=initialMountainInteractionState(),recoveryWords,onAction,onOpen,flat=false,inspect,conditionWords,monorail=null,partnerName=null,soundOn=false,calmOn=false}:{here?:Point3;nearestStation?:(kind:TransportKind)=>number;open?:boolean;onOpenChange?:(open:boolean)=>void;hideTrigger?:boolean;life?:MountainInteractionState;recoveryWords?:string;soundOn?:boolean;calmOn?:boolean;riding?:boolean;monorail?:MonorailState|null;partnerName?:string|null;conditionWords?:string;inspect?:{section:'map'|'water'|'travel';seq:number;station?:number};reading?:BasinReading;statusLine:string|null;onAction:(action:MountainAction)=>void;onOpen:(target:string)=>void;flat?:boolean}){
  const [localOpen,setLocalOpen]=useState(false),[tab,setTab]=useState<'travel'|'tour'|'life'>('travel');
  const [monorailFrom,setMonorailFrom]=useState(0),[monorailStops,setMonorailStops]=useState<number[]>([MONORAIL_STOPS.length-1]),[companion,setCompanion]=useState(true);
  const open=controlledOpen??localOpen;
  const panel=useRef<HTMLElement>(null),opener=useRef<HTMLElement|null>(null);
  function setOpen(next:boolean){setLocalOpen(next);onOpenChange?.(next);}
  function dismiss(){setOpen(false);if(opener.current?.isConnected)opener.current.focus({preventScroll:true});}
  function openTool(target:string){setOpen(false);onOpen(target);}
  useEffect(()=>{if(!open)return;opener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;panel.current?.focus();},[open]);
  // The retired guide's map and glass-dam sections open on the rides: Places live in All tools, the Fund in its bank.
  useEffect(()=>{if(inspect){setTab('travel');if(inspect.station!==undefined){setMonorailFrom(inspect.station);setMonorailStops([inspect.station===MONORAIL_STOPS.length-1?0:MONORAIL_STOPS.length-1]);}setOpen(true);}},[inspect]);
  const [tourIndex,setTourIndex]=useState(0);
  const shot=MOUNTAIN_TOUR[tourIndex]!;
  return <aside className="mountain-tools" onPointerDown={e=>e.stopPropagation()} onKeyDown={e=>{e.stopPropagation();if(e.key==="Escape"){e.preventDefault();dismiss();}}}>
    {open&&<section ref={panel} tabIndex={-1} role="dialog" className="mountain-panel" aria-label="Step in: rides, a tour and small moments">
      <header><div><small>HEARTH MOUNTAIN</small><h2>A life above the harbour</h2></div><button aria-label="Close mountain guide" onClick={dismiss}>×</button></header>
      <nav aria-label="Step in"><button aria-pressed={tab==='travel'} onClick={()=>setTab('travel')}>Travel & race</button><button aria-pressed={tab==='tour'} onClick={()=>setTab('tour')}>A tour</button><button aria-pressed={tab==='life'} onClick={()=>setTab('life')}>Small moments</button></nav>
      {tab==='travel'&&<>
        <h3>Island monorail</h3><p>A panoramic train from the waterfront through every mountain neighbourhood. Pick any number of stops like elevator floors. Selecting only Summit Commons rides straight to the top.</p>
        <label>Board at<select aria-label="Monorail boarding station" value={monorailFrom} onChange={e=>{const next=Number(e.target.value);setMonorailFrom(next);setMonorailStops([next===MONORAIL_STOPS.length-1?0:MONORAIL_STOPS.length-1]);}}>{MONORAIL_STOPS.map((s,i)=><option key={s.id} value={i}>{s.name}</option>)}</select></label>
        <fieldset className="monorail-stops"><legend>Choose your stops</legend>{MONORAIL_STOPS.map((stop,i)=><label key={stop.id}><input type="checkbox" disabled={i===monorailFrom} checked={monorailStops.includes(i)} onChange={()=>setMonorailStops(current=>current.includes(i)?current.filter(n=>n!==i):[...current,i])}/><span>{String(i+1).padStart(2,'0')} · {stop.name}</span></label>)}</fieldset>
        <div className="monorail-presets"><button onClick={()=>setMonorailStops(MONORAIL_STOPS.map((_,i)=>i).filter(i=>i!==monorailFrom))}>Tour every stop</button><button onClick={()=>setMonorailStops([monorailFrom===MONORAIL_STOPS.length-1?0:MONORAIL_STOPS.length-1])}>Straight to the end</button></div>
        {partnerName&&<label className="monorail-companion"><input type="checkbox" checked={companion} onChange={e=>setCompanion(e.target.checked)}/>{partnerName} beside me <small>Scene companion</small></label>}
        {!flat?<button className="monorail-board" disabled={monorailStops.length===0} onClick={()=>{onAction({kind:'monorail-board',from:monorailFrom,stops:monorailStops,companion:companion&&Boolean(partnerName)});setOpen(false);}}>Board the monorail</button>:<p>Ride in the 3D view. All stops remain reachable from Places.</p>}
        <h3>Funicular & gondola</h3><p>Walk to a platform and press its raised arrow to board. Move inside the cabin with the walking controls; press the carriage's raised arrow to finish the ride. The gondola has a seat button beside it.</p>
        <h3>Summit to sea</h3><p>One winding descent through the neighbourhood. The road is the clear main line; balcony, awning and dam rails offer optional detours.</p>{!flat&&<button onClick={()=>{onAction({kind:'race'});setOpen(false);}}>Start downhill race</button>}<p>Race times and skating progress stay on this device.</p>
      </>}

      {tab==='tour'&&<section aria-label="Neighbourhood tour"><p>Take the tour at your pace. Each view waits for you; reduced motion uses a direct cut.</p><p aria-live="polite">{tourIndex+1} of {MOUNTAIN_TOUR.length}</p><h3>{shot.title}</h3><p>{shot.words}</p>{!flat&&<button onClick={()=>onAction({kind:'tour',id:shot.id})}>Frame this view</button>}<div><button disabled={tourIndex===0} onClick={()=>setTourIndex(i=>i-1)}>Previous view</button><button disabled={tourIndex===MOUNTAIN_TOUR.length-1} onClick={()=>setTourIndex(i=>i+1)}>Next view</button></div><button onClick={()=>openTool(shot.id==='library'?'library':'fund')}>{shot.id==='library'?'Open the Library':'Open the Fund'}</button></section>}
      {tab==='life'&&<section aria-label="Small moments on the mountain"><p>Rest, open a garden gate, or watch the wildlife. These moments never change your books.</p>{MOUNTAIN_INTERACTIONS.map(item=><p key={item.id}><button onClick={()=>onAction({kind:'life',id:item.id})}>{mountainInteractionLabel(item,life)}</button></p>)}<p>{recoveryWords}</p></section>}
      {conditionWords&&<p className="mountain-condition">{conditionWords}</p>}<label className="mountain-calm"><input type="checkbox" checked={calmOn} onChange={e=>{onAction({kind:'calm',on:e.target.checked});}}/> Calm scenery</label>{!flat&&<label className="mountain-calm"><input type="checkbox" checked={soundOn} onChange={e=>{onAction({kind:'sound',on:e.target.checked});}}/> World sounds</label>}
    </section>}
    {monorail&&!open&&<section className="monorail-console" aria-label="Monorail train controls" onPointerDown={e=>e.stopPropagation()} onKeyDown={e=>e.stopPropagation()}>
      <div className="monorail-console-head"><div><small>ISLAND MONORAIL · {monorail.phase==='moving'?'IN MOTION':monorail.phase==='doors-open'?'DOORS OPEN':'DEPARTING'}</small><strong>{MONORAIL_STOPS[monorail.station]!.name}{monorail.phase==='moving'?` → ${MONORAIL_STOPS[monorail.next]!.name}`:''}</strong></div><span aria-live="polite">{monorail.phase==='moving'?`${Math.round(monorail.speed*3.6)} km/h`:monorail.phase==='doors-open'?'At platform':'Doors closing'}</span></div>
      <div className="monorail-track" role="progressbar" aria-label="Progress to next station" aria-valuenow={Math.round(monorail.progress*100)} aria-valuemin={0} aria-valuemax={100}><i style={{width:`${monorail.progress*100}%`}}/></div>
      <p aria-live="polite">{monorail.queue.length?`Selected: ${monorail.queue.map(i=>MONORAIL_STOPS[i]!.name).join(' → ')}`:'No more stops selected. Choose another floor or leave at this platform.'}</p>
      {monorail.companion&&partnerName&&<p>{partnerName} is beside you at the window. Scene companion.</p>}
      <details><summary>Stops · choose more at any time</summary><div className="monorail-floor-buttons">{MONORAIL_STOPS.map((stop,i)=><button key={stop.id} aria-pressed={monorail.queue.includes(i)} disabled={i===monorail.station&&monorail.phase==='doors-open'} onClick={()=>onAction({kind:'monorail-select',stop:i})}><b>{i+1}</b><span>{stop.name}</span></button>)}</div></details>
      <div className="monorail-controls"><button aria-pressed={monorail.seated} onClick={()=>onAction({kind:'monorail-control',control:'seat',value:!monorail.seated})}>{monorail.seated?'Stand up':'Sit by the window'}</button>{partnerName&&<button aria-pressed={monorail.companion} onClick={()=>onAction({kind:'monorail-control',control:'companion',value:!monorail.companion})}>{partnerName}’s seat</button>}<button aria-pressed={monorail.brake} onClick={()=>onAction({kind:'monorail-control',control:'brake',value:!monorail.brake})}>{monorail.brake?'Release brake':'Apply brake'}</button><button aria-pressed={monorail.paused} onClick={()=>onAction({kind:'monorail-control',control:'pause',value:!monorail.paused})}>{monorail.paused?'Resume train':'Pause train'}</button><button onClick={()=>onAction({kind:'monorail-control',control:'bell'})}>Ring bell</button></div>
      <div className="monorail-controls" aria-label="Train speed">{([[.5,'Slow'],[1,'Cruise'],[1.5,'Express']] as const).map(([speed,label])=><button key={speed} aria-pressed={monorail.throttle===speed} onClick={()=>onAction({kind:'monorail-control',control:'speed',value:speed})}>{label}</button>)}</div>
      <div className="monorail-controls" aria-label="Camera view">{([['window','Window'],['front','Driver’s view'],['outside','Outside']] as const).map(([view,label])=><button key={view} aria-pressed={monorail.view===view} onClick={()=>onAction({kind:'monorail-control',control:'view',value:view})}>{label}</button>)}</div>
      <button className="monorail-exit" disabled={monorail.phase!=='doors-open'} onClick={()=>onAction({kind:'monorail-control',control:'exit'})}>Step off at {MONORAIL_STOPS[monorail.station]!.name}</button>
      {monorail.phase==='doors-open'&&MONORAIL_DOORS[MONORAIL_STOPS[monorail.station]!.id]&&<button className="monorail-exit" onClick={()=>{onAction({kind:'monorail-control',control:'exit'});onOpen(MONORAIL_DOORS[MONORAIL_STOPS[monorail.station]!.id]!);}}>Step off and enter {MONORAIL_STOPS[monorail.station]!.name}</button>}
    </section>}
  </aside>;
}

const MAP_STYLE:Record<string,{stroke:string;width:number;dash?:string;fill?:string}>={
  coast:{stroke:'var(--mountain-plateau, #6f8f5a)',width:1.6,fill:'var(--mountain-land, #cfd9b8)'},contour:{stroke:'currentColor',width:.5},
  river:{stroke:'#4b9fba',width:3.2},reservoir:{stroke:'#3d8fa6',width:1.2,fill:'#86c6d4'},road:{stroke:'#fff0cc',width:4.2},lane:{stroke:'#f3dfb2',width:2.6},
  bridge:{stroke:'#8a6a3e',width:5.2},path:{stroke:'#fffaf0',width:1.2},stair:{stroke:'#e89a4a',width:1.6,dash:'2 1.4'},promenade:{stroke:'#bfe8ef',width:1.8},
  dam:{stroke:'#a9e3ec',width:4},funicular:{stroke:'#7d4ea3',width:1.6},gondola:{stroke:'#c2185b',width:1.1,dash:'4 2'},
};
/** The guide map, drawn from the shipped geography, with a text alternative for every place on it. */
export function MountainMap({here}:{here?:Point3}){
  const map=mountainMap(),districts=map.points.filter(p=>p.kind==='district'),stations=map.points.filter(p=>p.kind==='funicular'||p.kind==='gondola');
  const descId=useId();
  const whereWords=here?(here[2]>-48?' You are here: in town.':` You are here: near ${districtAt(here[0],here[2])?.name??'the mountain road'}.`):'';
  const description=`The mountain road winds up from the square through ${districts.map(d=>d.label).join(', ')}, crossing the gorge on bridges. Stations: ${stations.map(s=>s.label).join(', ')}.${whereWords}`;
  return <svg className="mountain-map" viewBox={map.viewBox} role="img" aria-label="Map of the mountain and the town" aria-describedby={descId}>
    <title>Map of the mountain and the town</title><desc id={descId}>{description}</desc>
    {map.lines.map(l=>{const s=MAP_STYLE[l.kind]??MAP_STYLE.path!;return <path key={l.id} d={l.d} fill={s.fill??'none'} stroke={s.stroke} strokeWidth={s.width} strokeDasharray={s.dash} strokeLinecap="round" strokeLinejoin="round" opacity={l.kind==='contour'?.35:1}/>;})}
    {map.points.filter(p=>p.kind==='plot').map(p=><rect key={p.id} x={p.x-8} y={p.z-6} width="16" height="12" fill="none" stroke="currentColor" strokeDasharray="3 2"/>)}
    {stations.map(p=><rect key={p.id} x={p.x-3} y={p.z-3} width="6" height="6" rx="1.2" fill={p.kind==='funicular'?'#7d4ea3':'#c2185b'}/>)}
    {map.points.filter(p=>p.kind==='gate').map(p=><circle key={p.id} cx={p.x} cy={p.z} r="2" fill="#f2c14e" stroke="#5a4300" strokeWidth=".6"/>)}
    {districts.map(d=><g key={d.id}><circle cx={d.x} cy={d.z} r="5" fill="currentColor"/><text x={d.x+8} y={d.z+4} fontSize="12" fontWeight="600" fill="currentColor" paintOrder="stroke" stroke="var(--mountain-land, #f4efe0)" strokeWidth="3">{d.label}</text></g>)}
    <text x="-30" y="30" fontSize="13" fontWeight="600" fill="currentColor" paintOrder="stroke" stroke="var(--mountain-land, #f4efe0)" strokeWidth="3">The square</text>
    {here&&<g aria-hidden="true"><circle cx={here[0]} cy={here[2]} r="7" fill="none" stroke="#d64545" strokeWidth="2.4"/><circle cx={here[0]} cy={here[2]} r="2.6" fill="#d64545"/></g>}
  </svg>;
}
