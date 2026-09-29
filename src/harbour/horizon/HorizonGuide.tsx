import {useEffect,useRef,useState} from 'react';
import type {HarbourPlaceId} from '../flag.ts';
import {HARBOUR_PLACE_NAMES} from '../flag.ts';
import type {SketchbookPose} from './world/definition.ts';
import {MONORAIL_STOPS} from '../mountain/definition.ts';
import './horizon-guide.css';

type GuideProps={
  open:boolean;onClose:()=>void;views:readonly SketchbookPose[];
  onView:(id:string)=>void;onWalk:()=>void;onPlace:(place:HarbourPlaceId)=>void;
  skateAvailable:boolean;skateHere:boolean;onSkate:()=>void;onRace:()=>void;onJourney?:()=>void;
  monorailAvailable:boolean;onMonorail:(from:number,stops:number[])=>void;
  soundOn:boolean;onSound:()=>void;
};

/** The old world's Step in entry, using the Horizon's actual views and routes. */
export function HorizonGuide({open,onClose,views,onView,onWalk,onPlace,skateAvailable,skateHere,onSkate,onRace,onJourney,monorailAvailable,onMonorail,soundOn,onSound}:GuideProps){
  const [tab,setTab]=useState<'explore'|'travel'>('explore');
  const [station,setStation]=useState(0),[stops,setStops]=useState<number[]>([MONORAIL_STOPS.length-1]);
  const panel=useRef<HTMLElement>(null),opener=useRef<HTMLElement|null>(null);
  useEffect(()=>{if(!open)return;opener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;panel.current?.focus();return()=>{if(opener.current?.isConnected)opener.current.focus({preventScroll:true});};},[open]);
  if(!open)return null;
  return <div className="horizon-guide" onPointerDown={e=>e.stopPropagation()} onKeyDown={e=>{
    e.stopPropagation();
    if(e.key==='Escape'){e.preventDefault();onClose();return;}
    if(e.key!=='Tab'||!panel.current)return;
    const focusable=[...panel.current.querySelectorAll<HTMLElement>('button:not(:disabled),select:not(:disabled),input:not(:disabled),a[href]')].filter(el=>el.getClientRects().length>0);
    if(!focusable.length){e.preventDefault();panel.current.focus();return;}
    const first=focusable[0]!,last=focusable[focusable.length-1]!;
    if(e.shiftKey&&(document.activeElement===first||document.activeElement===panel.current)){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===panel.current)){e.preventDefault();first.focus();}
  }}>
    <section className="horizon-guide__panel" ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Step into the Horizon">
      <header><div><small>THE HORIZON</small><h2>Step in</h2></div><button type="button" aria-label="Close Horizon guide" onClick={onClose}>×</button></header>
      <nav aria-label="Horizon guide"><button type="button" aria-pressed={tab==='explore'} onClick={()=>setTab('explore')}>Explore</button><button type="button" aria-pressed={tab==='travel'} onClick={()=>setTab('travel')}>Travel & play</button></nav>
      {tab==='explore'&&<>
        <p>Walk the island, visit a place, or frame a view. Your books and tools stay in the same app.</p>
        <div className="horizon-guide__actions"><button type="button" onClick={onWalk}>Walk from here</button>{onJourney&&<button type="button" onClick={()=>{onClose();onJourney();}}>Journey map</button>}</div>
        <h3>Sketchbook views</h3><div className="horizon-guide__grid">{views.map(view=><button type="button" key={view.id} onClick={()=>onView(view.id)}>{view.label||`View ${view.id}`}</button>)}</div>
        <h3>Go to a place</h3><div className="horizon-guide__grid">{(Object.keys(HARBOUR_PLACE_NAMES) as HarbourPlaceId[]).filter(place=>place!=='court').map(place=><button type="button" key={place} onClick={()=>onPlace(place)}>{HARBOUR_PLACE_NAMES[place]}</button>)}</div>
      </>}
      {tab==='travel'&&<>
        <p>The old Tideline board rides Mountain v2’s town island. The cruiser, bicycle, cable rides, boats, yacht, glider and parachute use their own marked boarding places across the Horizon.</p>
        <div className="horizon-guide__actions">{skateAvailable&&<><button type="button" onClick={onSkate}>{skateHere?'Skate here':'Go skate Tideline'}</button><button type="button" onClick={onRace}>Start downhill race</button></>}<button type="button" onClick={()=>onPlace('boathouse')}>Walk to the boats</button></div>
        {monorailAvailable&&<section aria-label="Island monorail"><h3>Island monorail</h3><label>Board at <select value={station} onChange={e=>{const next=Number(e.target.value);setStation(next);setStops([next===MONORAIL_STOPS.length-1?0:MONORAIL_STOPS.length-1]);}}>{MONORAIL_STOPS.map((stop,i)=><option key={stop.id} value={i}>{stop.name}</option>)}</select></label><fieldset><legend>Choose your stops</legend>{MONORAIL_STOPS.map((stop,i)=><label key={stop.id}><input type="checkbox" disabled={i===station} checked={stops.includes(i)} onChange={()=>setStops(current=>current.includes(i)?current.filter(n=>n!==i):[...current,i])}/>{stop.name}</label>)}</fieldset><button type="button" disabled={!stops.length} onClick={()=>onMonorail(station,stops)}>Board the monorail</button></section>}
        <p>At a boarding place, use its Interact button or E. The yacht’s galley opens from its menu board.</p>
      </>}
      <label className="horizon-guide__sound"><input type="checkbox" checked={soundOn} onChange={onSound}/> World sounds</label>
    </section>
  </div>;
}
