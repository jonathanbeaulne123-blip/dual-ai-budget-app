import {MOUNTAIN_INTERACTIONS,initialMountainInteractionState,mountainInteractionLabel,type MountainInteractionState} from './life.ts';
import {useEffect,useId,useRef,useState} from 'react';
import {DISTRICTS,RESERVED_PLOTS,TRANSPORT_STOPS,districtAt,type Point3,type TransportKind} from './definition.ts';
import {mountainMap} from './mapData.ts';
import type {BasinReading} from './basin.ts';
import {basinMoney} from './basin.ts';
import './mountain.css';
import {MOUNTAIN_TOUR,type MountainTourId} from './tour.ts';
export type MountainAction={kind:'life';id:string}|{kind:'tour';id:MountainTourId}|{kind:'go';at:Point3}|{kind:'ride';transport:TransportKind;from:number;to:number}|{kind:'view';view:'dam'|'world'}|{kind:'race'}|{kind:'skip'}|{kind:'calm';on:boolean}|{kind:'sound';on:boolean};
export function MountainPanel({open:controlledOpen,onOpenChange,hideTrigger=false,life=initialMountainInteractionState(),recoveryWords,reading,statusLine,onAction,onOpen,flat=false,inspect,conditionWords,riding=false,soundOn=false,calmOn=false,here,nearestStation}:{here?:Point3;nearestStation?:(kind:TransportKind)=>number;open?:boolean;onOpenChange?:(open:boolean)=>void;hideTrigger?:boolean;life?:MountainInteractionState;recoveryWords?:string;soundOn?:boolean;calmOn?:boolean;riding?:boolean;conditionWords?:string;inspect?:{section:'map'|'water'|'travel';seq:number};reading?:BasinReading;statusLine:string|null;onAction:(action:MountainAction)=>void;onOpen:(target:string)=>void;flat?:boolean}){
  const [localOpen,setLocalOpen]=useState(false),[tab,setTab]=useState<'map'|'water'|'travel'|'tour'|'life'>('map'),[transport,setTransport]=useState<TransportKind>('funicular'),[from,setFrom]=useState(0),[to,setTo]=useState(1);
  const open=controlledOpen??localOpen;
  const panel=useRef<HTMLElement>(null),opener=useRef<HTMLElement|null>(null);
  function setOpen(next:boolean){setLocalOpen(next);onOpenChange?.(next);}
  function dismiss(){setOpen(false);if(opener.current?.isConnected)opener.current.focus({preventScroll:true});}
  function openTool(target:string){setOpen(false);onOpen(target);}
  useEffect(()=>{if(!open)return;opener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;panel.current?.focus();},[open]);
  useEffect(()=>{if(inspect){setTab(inspect.section);setOpen(true);}},[inspect]);
  // "From" is where you are: the nearest station on the chosen line, riding on to the next stop (uphill first).
  const nearest=(kind:TransportKind)=>{const count=TRANSPORT_STOPS[kind].length,at=Math.max(0,Math.min(count-1,nearestStation?.(kind)??0));setFrom(at);setTo(at<count-1?at+1:Math.max(0,at-1));};
  useEffect(()=>{if(open&&tab==='travel')nearest(transport);},[open,tab]);
  const [tourIndex,setTourIndex]=useState(0);
  const stops=TRANSPORT_STOPS[transport],shot=MOUNTAIN_TOUR[tourIndex]!;
  return <aside className="mountain-tools" onPointerDown={e=>e.stopPropagation()} onKeyDown={e=>{e.stopPropagation();if(e.key==="Escape"){e.preventDefault();dismiss();}}}>
    {!hideTrigger&&<button className="mountain-trigger" aria-expanded={open} onClick={()=>setOpen(!open)}>⌁ <span>Mountain & town</span></button>}
    {open&&<section ref={panel} tabIndex={-1} role="dialog" className="mountain-panel" aria-label="Mountain and town guide">
      <header><div><small>HEARTH MOUNTAIN</small><h2>A life above the harbour</h2></div><button aria-label="Close mountain guide" onClick={dismiss}>×</button></header>
      <nav aria-label="Mountain guide"><button aria-pressed={tab==='map'} onClick={()=>setTab('map')}>Places</button><button aria-pressed={tab==='water'} onClick={()=>setTab('water')}>The glass dam</button><button aria-pressed={tab==='travel'} onClick={()=>setTab('travel')}>Travel & race</button><button aria-pressed={tab==='tour'} onClick={()=>setTab('tour')}>A tour</button><button aria-pressed={tab==='life'} onClick={()=>setTab('life')}>Small moments</button></nav>
      {tab==='map'&&<>
        <MountainMap here={here}/>
        <div className="mountain-destinations">{DISTRICTS.map(d=><div key={d.id}><strong>{d.name}</strong><small>{d.words}</small><div><button onClick={()=>{onOpen(d.destination);setOpen(false);}}>Open {d.id==='hearth'?'home':d.id==='summit'?'Journey':d.id==='reservoir'?'goals':d.id==='orchard'?'cottage':d.id}</button>{!flat&&<button aria-label={`Visit ${d.name}`} onClick={()=>{onAction({kind:'go',at:d.at});setOpen(false);}}>Visit plateau</button>}</div></div>)}</div>
        <h3>Down in town</h3><div className="mountain-destinations">{[{id:'court',name:'Town square'},{id:'bank',name:'Fund bank'},{id:'kiln',name:'Pottery Studio'},{id:'boathouse',name:'Boathouse'},{id:'campfire',name:'Waterfront campfire'}].map(place=><button key={place.id} onClick={()=>{onOpen(place.id);setOpen(false);}}>{place.name}</button>)}</div><h3>Rooms at home</h3><div className="mountain-destinations">{[{id:'tower',name:'Loft & goals'},{id:'cellar',name:'Cellar'},{id:'atlas',name:'Atlas nook'}].map(place=><button key={place.id} onClick={()=>{onOpen(place.id);setOpen(false);}}>{place.name}</button>)}</div>
        <h3>Room for tomorrow</h3>{RESERVED_PLOTS.map(p=><p key={p.id}><strong>{p.name}</strong> — {p.words}{!flat&&<button onClick={()=>{onAction({kind:'go',at:p.at});setOpen(false);}}>Visit</button>}</p>)}
      </>}
      {tab==='water'&&<div className="mountain-water-reading"><small>HOUSEHOLD FUND · ACCEPTED BALANCE</small><strong className="mountain-balance">{basinMoney(reading?.balanceCents)}</strong><p>The main basin holds the Fund’s operating balance. The adjoining chamber holds Kitty reserves.</p><dl><dt>Kitty reserves</dt><dd>{basinMoney(reading?.kittyCents)}</dd><dt>Free to spend</dt><dd>{basinMoney(reading?.freeCents)}</dd><dt>Pending contributions</dt><dd>{reading?.known?basinMoney(reading.pendingCents):'Checking'}</dd></dl><p>{statusLine??(reading?.known?`Supported as of ${reading.asOf}`:'Waiting for a supported shared Fund reading.')}</p><p>Pending amounts do not fill the basin. Moving money into Kitty changes chambers; it does not leave the household. The natural river keeps flowing independently.</p>{!flat&&<button onClick={()=>{onAction({kind:'view',view:'dam'});setOpen(false);}}>View the glass dam</button>}<h3>Recorded movements</h3><ol>{reading?.flows.slice(-4).reverse().map(e=><li key={e.id}>{e.label} · {basinMoney(e.cents)}</li>)}</ol><button onClick={()=>openTool('fund')}>Open the Fund</button><button onClick={()=>openTool('books')}>See supporting records</button></div>}
      {tab==='travel'&&<><h3>Take the scenic way</h3><label>Transport<select value={transport} onChange={e=>{const kind=e.target.value as TransportKind;setTransport(kind);nearest(kind);}}><option value="funicular">Hillside funicular</option><option value="gondola">Summit gondola</option></select></label><label>From<select value={from} onChange={e=>setFrom(Number(e.target.value))}>{stops.map((s,i)=><option key={s.id} value={i}>{s.name}</option>)}</select></label><label>To<select value={to} onChange={e=>setTo(Number(e.target.value))}>{stops.map((s,i)=><option key={s.id} value={i}>{s.name}</option>)}</select></label>{!flat?<><button disabled={from===to} onClick={()=>{onAction({kind:'ride',transport,from,to});setOpen(false);}}>Board and ride</button></>:<p>Scenic rides require the 3D view. Every destination remains available in Places.</p>}<h3>Summit to sea</h3><p>One winding descent through the neighbourhood. Aim for 60–120 seconds. The road is the clear main line; balcony, awning and dam rails offer optional detours.</p>{!flat&&<button onClick={()=>{onAction({kind:'race'});setOpen(false);}}>Start downhill race</button>}<p>Race times and skating progress stay on this device.</p></>}
      {tab==='tour'&&<section aria-label="Neighbourhood tour"><p>Take the tour at your pace. Each view waits for you; reduced motion uses a direct cut.</p><p aria-live="polite">{tourIndex+1} of {MOUNTAIN_TOUR.length}</p><h3>{shot.title}</h3><p>{shot.words}</p>{!flat&&<button onClick={()=>onAction({kind:'tour',id:shot.id})}>Frame this view</button>}<div><button disabled={tourIndex===0} onClick={()=>setTourIndex(i=>i-1)}>Previous view</button><button disabled={tourIndex===MOUNTAIN_TOUR.length-1} onClick={()=>setTourIndex(i=>i+1)}>Next view</button></div><button onClick={()=>openTool(shot.id==='library'?'library':'fund')}>{shot.id==='library'?'Open the Library':'Open the Fund'}</button></section>}
      {tab==='life'&&<section aria-label="Small moments on the mountain"><p>Rest, open a garden gate, or watch the wildlife. These moments never change your books.</p>{MOUNTAIN_INTERACTIONS.map(item=><p key={item.id}><button onClick={()=>onAction({kind:'life',id:item.id})}>{mountainInteractionLabel(item,life)}</button></p>)}<p>{recoveryWords}</p></section>}
      {conditionWords&&<p className="mountain-condition">{conditionWords}</p>}<label className="mountain-calm"><input type="checkbox" checked={calmOn} onChange={e=>{onAction({kind:'calm',on:e.target.checked});}}/> Calm scenery</label>{!flat&&<label className="mountain-calm"><input type="checkbox" checked={soundOn} onChange={e=>{onAction({kind:'sound',on:e.target.checked});}}/> World sounds</label>}
    </section>}
    {riding&&<button className="mountain-skip" onClick={()=>{onAction({kind:'skip'});}}>Finish scenic ride</button>}
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
  const description=`The mountain road winds up from the town square through ${districts.map(d=>d.label).join(', ')}, crossing the gorge on bridges. Stations: ${stations.map(s=>s.label).join(', ')}.${whereWords}`;
  return <svg className="mountain-map" viewBox={map.viewBox} role="img" aria-label="Map of the mountain and the town" aria-describedby={descId}>
    <title>Map of the mountain and the town</title><desc id={descId}>{description}</desc>
    {map.lines.map(l=>{const s=MAP_STYLE[l.kind]??MAP_STYLE.path!;return <path key={l.id} d={l.d} fill={s.fill??'none'} stroke={s.stroke} strokeWidth={s.width} strokeDasharray={s.dash} strokeLinecap="round" strokeLinejoin="round" opacity={l.kind==='contour'?.35:1}/>;})}
    {map.points.filter(p=>p.kind==='plot').map(p=><rect key={p.id} x={p.x-8} y={p.z-6} width="16" height="12" fill="none" stroke="currentColor" strokeDasharray="3 2"/>)}
    {stations.map(p=><rect key={p.id} x={p.x-3} y={p.z-3} width="6" height="6" rx="1.2" fill={p.kind==='funicular'?'#7d4ea3':'#c2185b'}/>)}
    {map.points.filter(p=>p.kind==='gate').map(p=><circle key={p.id} cx={p.x} cy={p.z} r="2" fill="#f2c14e" stroke="#5a4300" strokeWidth=".6"/>)}
    {districts.map(d=><g key={d.id}><circle cx={d.x} cy={d.z} r="5" fill="currentColor"/><text x={d.x+8} y={d.z+4} fontSize="12" fontWeight="600" fill="currentColor" paintOrder="stroke" stroke="var(--mountain-land, #f4efe0)" strokeWidth="3">{d.label}</text></g>)}
    <text x="-30" y="30" fontSize="13" fontWeight="600" fill="currentColor" paintOrder="stroke" stroke="var(--mountain-land, #f4efe0)" strokeWidth="3">Town square</text>
    {here&&<g aria-hidden="true"><circle cx={here[0]} cy={here[2]} r="7" fill="none" stroke="#d64545" strokeWidth="2.4"/><circle cx={here[0]} cy={here[2]} r="2.6" fill="#d64545"/></g>}
  </svg>;
}
