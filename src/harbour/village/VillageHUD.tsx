import {useState} from 'react';
import {HARBOUR_PLACE_NAMES,type HarbourPlaceId} from '../flag.ts';
import {ROOM_PORTALS} from './layout.ts';
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
export function VillageHUD({place,travelling,onVisit,onArrange,onView}:{place:HarbourPlaceId;travelling:HarbourPlaceId|null;onVisit:(id:HarbourPlaceId,instant?:boolean)=>void;onArrange?:()=>void;onView:()=>void}){
 const [map,setMap]=useState(false);
 return <div className="village-hud" onPointerDown={e=>e.stopPropagation()}>
  <header className="village-address"><span className="village-address__seal">h</span><div><small>LITTLE HARBOUR</small><h1>{HARBOUR_PLACE_NAMES[place]}</h1><p>{travelling?`On our way to ${HARBOUR_PLACE_NAMES[travelling]}`:place==='court'?'A little world to come home to.':'Settle in. There’s room to make it yours.'}</p></div></header>
  <nav className="village-tools" aria-label="Village navigation"><button type="button" aria-expanded={map} onClick={()=>setMap(!map)}>⌖ <span>Village map</span></button><label className="village-quick"><span>Go straight to</span><select aria-label="Quick travel" value="" onChange={e=>{if(e.target.value)onVisit(e.target.value as HarbourPlaceId,true);setMap(false);}}><option value="">Quick travel…</option><option value="court">Village square</option>{STOPS.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}<option value="tower">Home · Loft</option><option value="cellar">Home · Cellar</option><option value="atlas">Home · Atlas nook</option></select></label><button type="button" onClick={onView} aria-label="Look around this place">↗ <span>Look around</span></button>{onArrange&&<button type="button" onClick={onArrange}>✿ <span>Arrange room</span></button>}</nav>
  {(ROOM_PORTALS[place]?.length??0)>0&&<nav className="village-floors" aria-label="Rooms in our home">{[{id:'kitchen',name:'Kitchen'},{id:'tower',name:'Loft'},{id:'cellar',name:'Cellar'},{id:'atlas',name:'Atlas nook'}].map(room=><button key={room.id} type="button" aria-current={place===room.id?'location':undefined} onClick={()=>onVisit(room.id as HarbourPlaceId,true)}>{room.name}</button>)}</nav>}
  {map&&<section className="village-map" aria-label="Village destinations"><header><div><small>TAKE THE SCENIC WAY</small><h2>Where shall we wander?</h2></div><button type="button" aria-label="Close village map" onClick={()=>setMap(false)}>×</button></header><div className="village-map__places">{STOPS.map(s=><button key={s.id} type="button" onClick={()=>{onVisit(s.id);setMap(false);}}><b aria-hidden="true">{s.icon}</b><span><strong>{s.title}</strong><small>{s.detail}</small></span><i aria-hidden="true">↗</i></button>)}</div><p>Tap a building to walk there. Quick travel is always nearby.</p></section>}
 </div>;
}
