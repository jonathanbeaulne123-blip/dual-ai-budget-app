import {DISTRICTS,MOUNTAIN_ROAD,RIVER} from '../mountain/definition.ts';
import {useEffect,useState,type ReactNode} from 'react';
import {HARBOUR_PLACE_NAMES,type HarbourPlaceId} from '../flag.ts';
import {ROOM_PORTALS} from './layout.ts';
import {VILLAGE_SITES} from './layout.ts';
import {HARBOUR_LANES,HARBOUR_WANDERS,type HarbourWanderId} from './world.ts';
import type {PlayableAvatar} from '../body/avatarDefinition.ts';
import {BarFab,EditionFlip,useIslandBar,useToolsPawprint,type CompassFab} from '../nav/Compass.tsx';
const STOPS:{id:HarbourPlaceId;icon:string;title:string;detail:string}[]=[
{id:'kitchen',icon:'⌂',title:'Our home',detail:'Kitchen · Loft · Cellar'},
{id:'bank',icon:'♜',title:'Fund bank',detail:'Queen · books · shared plans'},
{id:'library',icon:'▤',title:'Library',detail:'The standing book'},
{id:'glasshouse',icon:'❧',title:'Glasshouse',detail:'Plans & days ahead'},
{id:'kiln',icon:'◒',title:'Pottery studio',detail:'Shape · paint · fire'},
{id:'cottage',icon:'♧',title:'Hercules’s cottage',detail:'Play · dress · rest'},
{id:'boathouse',icon:'⚓',title:'Boathouse',detail:'Letters & kept memories'},
{id:'campfire',icon:'☼',title:'Waterfront',detail:'A moment by the fire'},
];
/**
 * The island's HUD and **the one bar** (Simple View Desk S1): the Compass's
 * district row retired and this quick-travel bar carries everything, left to
 * right — [Simple view] [⌖ Village map] [Quick travel…] [↗ Look around]
 * [◇ Journey] [+ money verbs] [All tools]. It stands over the 3D island and
 * over the reading (flat) edition alike. `fab` is the App's own FabSpeedDial
 * wiring, so adding money stays two presses; `onQuickSheet` opens All tools.
 * While this bar stands it tells the App's door edition of the bar
 * (`nav/Compass.tsx`) to step aside, so there is only ever one bar: before the
 * scene arrives, with a tool open in front, or on the Journey, the door
 * edition carries [Simple view] [+] [All tools] instead.
 */
export function VillageHUD({appearanceRequest,place,travelling,onVisit,onArrange,onView,onWander,onJourney,avatar,avatarStatus,onAvatar,presence,fab,onQuickSheet}:{appearanceRequest?:number;place:HarbourPlaceId;travelling:HarbourPlaceId|null;onVisit:(id:HarbourPlaceId,instant?:boolean)=>void;onArrange?:()=>void;onView:()=>void;onWander?:(id:HarbourWanderId)=>void;onJourney?:()=>void;avatar?:PlayableAvatar|null;avatarStatus?:'idle'|'loading'|'ready'|'error';onAvatar?:(avatar:PlayableAvatar)=>void;presence?:ReactNode;fab?:CompassFab;onQuickSheet?:()=>void}){
 useIslandBar(Boolean(fab));
 const [pawprint,paw]=useToolsPawprint();
 const [map,setMap]=useState(false);
 const [characterOpen,setCharacterOpen]=useState(avatar==null);
 useEffect(()=>{if(appearanceRequest)setCharacterOpen(true);},[appearanceRequest]);
 useEffect(()=>{if(avatar==null)setCharacterOpen(true);},[avatar]);
 useEffect(()=>{if(avatarStatus==='error')setCharacterOpen(true);},[avatarStatus]);
 return <div className="village-hud" onPointerDown={e=>e.stopPropagation()}>
  {!map&&<div className="village-presence-outside">{presence}</div>}
  <header className="village-address"><span className="village-address__seal">h</span><div><small>LITTLE HARBOUR</small><h1>{HARBOUR_PLACE_NAMES[place]}</h1><p>{travelling?`On our way to ${HARBOUR_PLACE_NAMES[travelling]}`:place==='court'?'A little world to come home to.':'Settle in. There’s room to make it yours.'}</p></div></header>
  <nav className="village-tools harbour-bar" data-harbour-bar="island" aria-label="Harbour bar"><EditionFlip className="village-tools__flip"/><button type="button" aria-label="Village map" aria-expanded={map} onClick={()=>setMap(!map)}>⌖ <span>Village map</span></button><label className="village-quick" title="Quick travel"><span>Go straight to</span><select aria-label="Quick travel" value="" onChange={e=>{if(e.target.value)onVisit(e.target.value as HarbourPlaceId,true);setMap(false);}}><option value="">Quick travel…</option><option value="court">Village square</option>{STOPS.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}<option value="tower">Home · Loft</option><option value="cellar">Home · Cellar</option><option value="atlas">Home · Atlas nook</option></select></label><button type="button" onClick={onView} aria-label="Look around this place">↗ <span>Look around</span></button>{onJourney&&<button type="button" onClick={onJourney} aria-label="Journey map">◇ <span>Journey</span></button>}{onArrange&&<button type="button" aria-label="Arrange room" onClick={onArrange}>✿ <span>Arrange room</span></button>}{fab&&<BarFab fab={fab}/>}{onQuickSheet&&<button type="button" className="village-tools__all" aria-label="All tools" aria-describedby={pawprint} title="All tools (Space)" onClick={onQuickSheet}>☰ <span>All tools</span>{paw}</button>}</nav>
  {(ROOM_PORTALS[place]?.length??0)>0&&<nav className="village-floors" aria-label="Rooms in our home">{[{id:'kitchen',name:'Kitchen'},{id:'tower',name:'Loft'},{id:'cellar',name:'Cellar'},{id:'atlas',name:'Atlas nook'}].map(room=><button key={room.id} type="button" aria-current={place===room.id?'location':undefined} onClick={()=>onVisit(room.id as HarbourPlaceId,true)}>{room.name}</button>)}</nav>}
  {map&&<section className="village-map" aria-label="Village destinations"><header><div><small>TAKE THE SCENIC WAY</small><h2>Where shall we wander?</h2></div><button type="button" aria-label="Close village map" onClick={()=>setMap(false)}>×</button></header>
    <svg className="village-map__island" viewBox="-180 -312 360 402" aria-hidden="true"><path d="M-75-50L-155-190L-75-300L60-306L151-193L70-45Z" fill="#9cb48b"/>{DISTRICTS.map(d=><ellipse key={d.id} cx={d.at[0]} cy={d.at[2]} rx={d.radius} ry={d.radius*.6} fill="#c4cca1"/>)}<polyline points={MOUNTAIN_ROAD.map(p=>`${p[0]},${p[2]}`).join(" ")} fill="none" stroke="#fff2d2" strokeWidth="4"/><polyline points={RIVER.map(p=>`${p[0]},${p[2]}`).join(" ")} fill="none" stroke="#699fab" strokeWidth="3"/><circle r="77" fill="#c0d8ce"/><circle r="72" fill="#e6d6ae"/><circle r="62" fill="#c2cc9c"/>{HARBOUR_LANES.map(lane=><polyline key={lane.id} points={lane.points.map(p=>p.join(',')).join(' ')} fill="none" stroke="#f9f0d7" strokeWidth="2"/>)}{Object.entries(VILLAGE_SITES).map(([id,site])=><g key={id} transform={`translate(${site.spot.join(' ')})`}><rect x="-4" y="-3" width="8" height="6" rx="1" fill={place===site.entry?'#b15d3f':'#567766'}/><path d="M-5 -3L0 -7L5 -3" fill="#ab7955"/></g>)}<circle cy="4" r="2.4" fill="#cc9a4d"/>{HARBOUR_WANDERS.map(w=><circle key={w.id} cx={w.at[0]} cy={w.at[1]} r="2" fill="#7d9466"/>)}</svg>
    <div className="village-map__presence">{presence}</div>
    <div className="village-map__places">{STOPS.map(s=><button key={s.id} type="button" onClick={()=>{onVisit(s.id);setMap(false);}}><b aria-hidden="true">{s.icon}</b><span><strong>{s.title}</strong><small>{s.detail}</small></span><i aria-hidden="true">↗</i></button>)}</div>
    {onWander&&place==='court'&&<><h3>Beyond the village</h3><div className="village-map__places">{HARBOUR_WANDERS.map(w=><button type="button" key={w.id} onClick={()=>{onWander(w.id);setMap(false);}}><span><strong>{w.name}</strong><small>A path with room to breathe</small></span><i aria-hidden="true">↗</i></button>)}</div></>}
    <p>Choose a building to walk there. Quick travel and your budgeting tools are always nearby. Pull all the way back to return to Journey.</p></section>}
  {onAvatar&&<div className="village-character" data-selected={avatar??'none'}>
    <button type="button" className="village-character__trigger" aria-label={avatar?`Your character: ${avatar}. Change character`:'Choose your character'} aria-expanded={characterOpen} onClick={()=>setCharacterOpen(open=>!open)}>{avatar==='bianca'?'B':avatar==='jonathan'?'J':'?'} <span>{avatar??'Choose character'}</span></button>
    {characterOpen&&<section className="village-character__choices" aria-label="Choose your character"><div className="village-character__heading"><strong>Your character</strong><button type="button" aria-label="Close character choices" onClick={()=>setCharacterOpen(false)}>×</button></div><p>Choose the model you walk around as.</p><div className="village-character__options">{(['bianca','jonathan'] as const).map(id=><button type="button" key={id} aria-pressed={avatar===id} onClick={()=>{onAvatar(id);setCharacterOpen(false);}}>{id==='bianca'?'Bianca':'Jonathan'}</button>)}</div>{avatarStatus==='loading'&&<small role="status">Loading your character…</small>}{avatarStatus==='error'&&<small role="status">The model could not load. Choose it again to retry.</small>}</section>}
  </div>}
 </div>;
}
