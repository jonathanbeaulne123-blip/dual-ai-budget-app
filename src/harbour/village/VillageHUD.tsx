import {useEffect,useState,type ReactNode} from 'react';
import {HARBOUR_PLACE_NAMES,type HarbourPlaceId} from '../flag.ts';
import {ROOM_PORTALS} from './layout.ts';
import type {HarbourWanderId} from './world.ts';
import type {PlayableAvatar} from '../body/avatarDefinition.ts';
import type {ThemeId} from '../../theme/scenes.ts';
import {useIslandBar,type CompassFab} from '../nav/Compass.tsx';
import {GlassBar,GlassChrome} from '../bubbles/GlassChrome.tsx';
/**
 * The island's HUD (Tool Atlas brief §2.4, §4.1, §6). The seven-control bar
 * retired: the glass carries three bubbles instead —
 *
 *   Simple view (top-right) · All tools (bottom-left) · Record (bottom-right)
 *
 * — anchored to the viewport (`bubbles/GlassChrome.tsx`). Quick travel, the
 * Village map and its "Beyond the village" list, Look around, Journey and
 * Arrange room left the glass: Places in All tools carries every host and
 * neighbourhood (and Step in, Skate, Arrange room), the Atlas opens the
 * Journey map, and dragging the map is looking around.
 *
 * Kept as today: the address card (now glass), the rooms-in-our-home row, the
 * character trigger and the presence slot. The moves row, the skate card and
 * the phrase/status lines are HarbourWorld's own and are untouched.
 *
 * On the Desk (`flat`) the same three stand as the flat bar instead —
 * [Island] [Record] [All tools], Record centred — as `HarbourEntry`'s reading
 * edition does, so the header's space pill is never under a bubble.
 *
 * **Focus order (A5).** Simple view → (`glassBetween`: the map's one stop,
 * the strip, the card — the integrator renders the dock there) → All tools →
 * Record. The bubbles are fixed to the viewport, so DOM order never moves them.
 *
 * While the glass stands it tells the App's door edition (`nav/Compass.tsx`)
 * to step aside, so there is only ever one set.
 */
export type VillageHUDProps={
 flat?:boolean;
 /** Retired from the glass (the Mountain & town guide goes, brief K6); accepted so HarbourWorld's call stays valid. */
 onGuide?:()=>void;guideOpen?:boolean;
 appearanceRequest?:number;
 place:HarbourPlaceId;travelling:HarbourPlaceId|null;
 onVisit:(id:HarbourPlaceId,instant?:boolean)=>void;
 /** Retired from the glass: Arrange room is in All tools › Places (`onWorld('arrange')`). */
 onArrange?:()=>void;
 /** Retired from the glass: dragging the map is looking around. */
 onView?:()=>void;
 /** Retired from the glass: the wanders are world experiences behind Step in. */
 onWander?:(id:HarbourWanderId)=>void;
 /** Retired from the glass: the Atlas (All tools › The Boathouse) opens the Journey map. */
 onJourney?:()=>void;
 avatar?:PlayableAvatar|null;avatarStatus?:'idle'|'loading'|'ready'|'error';onAvatar?:(avatar:PlayableAvatar)=>void;
 presence?:ReactNode;
 /** The App's Record dial wiring (`FabSpeedDial`); absent (the Charter takeover), no Record bubble. */
 fab?:CompassFab;
 /** Opens All tools. */
 onQuickSheet?:()=>void;
 /** All tools is open: its bubble reads as expanded. */
 toolsOpen?:boolean;
 /** The signed-in member, for the label rule's per-person count. */
 memberId?:string|null;
 theme?:ThemeId;
 /** The Quiet comfort setting / calm view. */
 calm?:boolean;
 /** The lite quality tier. */
 lite?:boolean;
 /** The frame budget was missed for a second: solid until the next place change. */
 frameOverBudget?:boolean;
 /** The camera is moving: blur off, back 120 ms after it stops. */
 cameraMoving?:boolean;
 night?:boolean;
 alwaysShowLabels?:boolean;
 /** Rendered between Simple view and All tools in the DOM: the map's focus stop, the strip, the card. */
 glassBetween?:ReactNode;
};
export function VillageHUD({flat=false,appearanceRequest,place,travelling,onVisit,avatar,avatarStatus,onAvatar,presence,fab,onQuickSheet,toolsOpen,memberId,theme,calm,lite,frameOverBudget,cameraMoving,night,alwaysShowLabels,glassBetween}:VillageHUDProps){
 useIslandBar(Boolean(fab));
 const [characterOpen,setCharacterOpen]=useState(avatar==null);
 useEffect(()=>{if(appearanceRequest)setCharacterOpen(true);},[appearanceRequest]);
 useEffect(()=>{if(avatar==null)setCharacterOpen(true);},[avatar]);
 useEffect(()=>{if(avatarStatus==='error')setCharacterOpen(true);},[avatarStatus]);
 return <div className="village-hud" onPointerDown={e=>e.stopPropagation()}>
  {!flat&&<div className="village-presence-outside">{presence}</div>}
  {!flat&&<header className="village-address" data-glass-card="" data-glass-theme={theme} data-glass-calm={calm||lite||frameOverBudget?'':undefined}><span className="village-address__seal" aria-hidden="true">h</span><div><small>LITTLE HARBOUR</small><h1>{HARBOUR_PLACE_NAMES[place]}</h1><p>{travelling?`On our way to ${HARBOUR_PLACE_NAMES[travelling]}`:place==='court'?'A little world to come home to.':'Settle in. There’s room to make it yours.'}</p></div></header>}
  {flat
   ? <GlassBar edition="desk" fab={fab} onOpenTools={onQuickSheet} toolsOpen={toolsOpen} member={memberId} theme={theme} calm={calm} lite={lite} alwaysShowLabels={alwaysShowLabels}/>
   : <GlassChrome edition="island" fab={fab} onOpenTools={onQuickSheet} toolsOpen={toolsOpen} member={memberId} theme={theme} calm={calm} lite={lite} frameOverBudget={frameOverBudget} cameraMoving={cameraMoving} night={night} alwaysShowLabels={alwaysShowLabels} between={glassBetween}/>}
  {!flat&&(ROOM_PORTALS[place]?.length??0)>0&&<nav className="village-floors" aria-label="Rooms in our home">{[{id:'kitchen',name:'Kitchen'},{id:'tower',name:'Loft'},{id:'cellar',name:'Cellar'},{id:'atlas',name:'Atlas'}].map(room=><button key={room.id} type="button" aria-current={place===room.id?'location':undefined} onClick={()=>onVisit(room.id as HarbourPlaceId,true)}>{room.name}</button>)}</nav>}
  {onAvatar&&<div className="village-character" data-selected={avatar??'none'}>
    <button type="button" className="village-character__trigger" aria-label={avatar?`Your character: ${avatar}. Change character`:'Choose your character'} aria-expanded={characterOpen} onClick={()=>setCharacterOpen(open=>!open)}>{avatar==='bianca'?'B':avatar==='jonathan'?'J':'?'} <span>{avatar??'Choose character'}</span></button>
    {characterOpen&&<section className="village-character__choices" aria-label="Choose your character"><div className="village-character__heading"><strong>Your character</strong><button type="button" aria-label="Close character choices" onClick={()=>setCharacterOpen(false)}>×</button></div><p>Choose the model you walk around as.</p><div className="village-character__options">{(['bianca','jonathan'] as const).map(id=><button type="button" key={id} aria-pressed={avatar===id} onClick={()=>{onAvatar(id);setCharacterOpen(false);}}>{id==='bianca'?'Bianca':'Jonathan'}</button>)}</div>{avatarStatus==='loading'&&<small role="status">Loading your character…</small>}{avatarStatus==='error'&&<small role="status">The model could not load. Choose it again to retry.</small>}</section>}
  </div>}
 </div>;
}
