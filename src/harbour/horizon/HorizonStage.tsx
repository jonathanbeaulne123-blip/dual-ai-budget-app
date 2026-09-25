import {HARBOUR_DEV} from '../flag.ts';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import type {HorizonRuntime,HorizonOptions,HorizonMode} from './runtime/index.ts';
import type {Host} from './world/definition.ts';
import type {HouseBodyReturn} from '../../house/navigation.ts';
import type {PlaceWalkSource} from '../scene/place.ts';
import './horizon.css';
export type HorizonStageProps={onDoor?:(host:Host,body:HouseBodyReturn)=>void;onReady?:()=>void;onRuntime?:(runtime:HorizonRuntime|null)=>void;onQuickSheet?:()=>void;onJourney?:()=>void;initialBody?:HouseBodyReturn;partner?:PlaceWalkSource|null;paused?:boolean;children?:ReactNode;review?:boolean};
export default function HorizonStage(props:HorizonStageProps){
  const stage=useRef<HTMLDivElement>(null),runtime=useRef<HorizonRuntime|null>(null),latest=useRef(props);latest.current=props;
  const [status,setStatus]=useState('Loading the Horizon…'),[ready,setReady]=useState(false),[mode,setMode]=useState<HorizonMode>('look'),[page,setPage]=useState('A');
  const [tier]=useState<'full'|'lite'>(()=>new URLSearchParams(location.search).get('tier')==='lite'||matchMedia('(max-width: 600px)').matches?'lite':'full');
  useEffect(()=>{const controller=new AbortController();let current:HorizonRuntime|null=null;
    const options:HorizonOptions={tier,hideBuildings:HARBOUR_DEV&&new URLSearchParams(location.search).get('hideBuildings')==='1',signal:controller.signal,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,onDoor:(h,b)=>latest.current.onDoor?.(h,b),onStatus:setStatus,initialBody:latest.current.initialBody,partner:()=>latest.current.partner??null};
    import('../scene/worldMount.ts').then(m=>m.mountHorizonWorld(stage.current!,options)).then(world=>{
      if(controller.signal.aborted){world.dispose();return;}current=world;runtime.current=world;setMode(world.mode());setPage(world.shotId());setReady(true);setStatus('Drag to look. Walk with W A S D, or use the pads. Space jumps; E opens a nearby door.');latest.current.onRuntime?.(world);latest.current.onReady?.();
      if(HARBOUR_DEV)(window as unknown as {__harbour:unknown}).__harbour=world;
    }).catch(error=>{if(!controller.signal.aborted)setStatus(error instanceof Error?error.message:'The Horizon could not open.');});
    return()=>{controller.abort();current?.dispose();runtime.current=null;latest.current.onRuntime?.(null);};
  },[tier]);
  useEffect(()=>{runtime.current?.pause(props.paused===true);},[props.paused,ready]);
  function changeMode(next:HorizonMode){setMode(next);runtime.current?.setMode(next);stage.current?.focus();}
  function pad(event:React.PointerEvent<HTMLDivElement>,kind:'move'|'look'){
    if(event.type==='pointerup'||event.type==='pointercancel'){runtime.current?.input({forward:0,strafe:0});return;}
    if(event.type==='pointerdown')event.currentTarget.setPointerCapture(event.pointerId);
    else if(!event.currentTarget.hasPointerCapture(event.pointerId))return;
    const box=event.currentTarget.getBoundingClientRect(),x=Math.max(-1,Math.min(1,(event.clientX-box.left-box.width/2)/(box.width*.36))),y=Math.max(-1,Math.min(1,(event.clientY-box.top-box.height/2)/(box.height*.36)));
    if(kind==='move')runtime.current?.input({forward:-y,strafe:x});else runtime.current?.look(-x*.08,-y*.06);
  }
  return <section className={`horizon-shell ${props.review?'horizon-shell--review':''}`} aria-label="Horizon land review">
    <div ref={stage} className="horizon-stage" tabIndex={props.paused?-1:0} aria-label="Horizon. Drag to look. W A S D walks, Space jumps, E opens a nearby door." />
    {!props.paused&&<>
      <div className="horizon-toolbar" aria-label="World controls">
        {(['walk','look','journey']as const).map(m=><button key={m} disabled={!ready} aria-pressed={mode===m} onClick={()=>changeMode(m)}>{m==='journey'?'Island':m==='walk'?'Walk':'Look'}</button>)}
        <label>Page <select aria-label="Sketchbook page" value={page} disabled={!ready} onChange={e=>{setPage(e.target.value);setMode('look');runtime.current?.shot(e.target.value);}}>{'ABCDEFGHIJKL'.split('').map(p=><option key={p}>{p}</option>)}</select></label>
        {props.onQuickSheet&&<button onClick={props.onQuickSheet}>Tools</button>}
        {props.onJourney&&<button onClick={props.onJourney}>Journey</button>}
      </div>
      {ready&&mode==='walk'&&<div className="horizon-touch-controls">
        <div className="horizon-pad" role="group" aria-label="Move pad" onPointerDown={e=>pad(e,'move')} onPointerMove={e=>pad(e,'move')} onPointerUp={e=>pad(e,'move')} onPointerCancel={e=>pad(e,'move')}>Move</div>
        <button className="horizon-jump" onClick={()=>runtime.current?.jump()}>Jump</button>
        <button onClick={()=>runtime.current?.enterDoor()}>Enter</button>
        <div className="horizon-pad" role="group" aria-label="Look pad" onPointerDown={e=>pad(e,'look')} onPointerMove={e=>pad(e,'look')} onPointerUp={e=>pad(e,'look')} onPointerCancel={e=>pad(e,'look')}>Look</div>
      </div>}
      <p className="horizon-status" role="status">{status}</p>
    </>}
    {props.children}
  </section>;
}
