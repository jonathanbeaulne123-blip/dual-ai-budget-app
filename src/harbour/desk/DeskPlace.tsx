import type {HarbourReading} from "../data/reading.ts";
import type {HarbourPlaceId} from '../flag.ts';
import {HARBOUR_PLACE_NAMES} from '../flag.ts';

type Door={label:string;target:string;object?:string};
export const DESK_PLACE_DOORS:Record<HarbourPlaceId,Door[]>={
 court:[{label:'Household Fund',target:'fund'},{label:'Supporting records',target:'books'}],
 bank:[{label:'Household Fund',target:'fund'},{label:'Books',target:'books'}],
 kitchen:[{label:'Our conversation',target:'conversation'},{label:'Plan together',target:'plan-studio'}],
 tower:[{label:'Our goals',target:'loft-banks'}],
 cellar:[{label:'Bill jars',target:'cellar-bills'},{label:'Calendar',target:'calendar'}],
 atlas:[{label:'Our Journey',target:'journey'}],
 library:[{label:'Open the standing book',target:'books'}],
 glasshouse:[{label:'Our plans',target:'planner'},{label:'Calendar',target:'calendar'}],
 cottage:[{label:'Visit Hercules',target:'hercules'},{label:'His wardrobe',target:'wardrobe'}],
 kiln:[{label:'Shape at the wheel',target:'pottery',object:'wheel'},{label:'Paint a piece',target:'pottery',object:'paint'},{label:'Fire in the kiln',target:'pottery',object:'kiln'}],
 boathouse:[{label:'Letters',target:'letters'},{label:'Kept memories',target:'memories'}],
 campfire:[{label:'Talk with Hercules',target:'hercules'},{label:'Plan together',target:'plan-studio'},{label:'Our Journey',target:'journey'}],
};
const LOCATIONS:Record<HarbourPlaceId,string>={court:'Town square · at the waterfront',bank:'Town square · the Fund bank',kitchen:'Hearth Terrace · our home',tower:'Hearth Terrace · our loft',cellar:'Hearth Terrace · our cellar',atlas:'Hearth Terrace · Atlas nook',library:'Library Woods · beside the gorge',glasshouse:'Glasshouse Meadows · among the gardens',cottage:'Orchard Hollow · Hercules’s cottage',kiln:'Town square · the Pottery Studio',boathouse:'Town square · the quay',campfire:'Waterfront · by the fire'};
export function DeskPlace({reading,place,onOpen,onGuide,onVisit}:{reading?:HarbourReading;place:HarbourPlaceId;onOpen:(target:string,object?:string)=>void;onGuide:()=>void;onVisit:(place:HarbourPlaceId)=>void}){
 const atHome=['kitchen','tower','cellar','atlas'].includes(place);
 return <section className="desk-place" aria-label="Your place in the neighbourhood">
  <div className="desk-place__scene" aria-hidden="true"><svg viewBox="0 0 240 82"><path className="desk-place__ridge" d="M0 73 39 38 58 46 100 4 121 27 149 15 203 66 240 73V82H0Z"/><path className="desk-place__water" d="m110 29 20 9-12 15 27 10-8 19h-12l8-17-26-10 13-15Z"/><path className="desk-place__dam" d="m102 31 37 7-1 9-34-6Z"/><path className="desk-place__houses" d="m24 69 8-8 8 8v11H24Zm44-17 8-8 8 8v12H68Zm105 10 8-8 8 8v13h-16Z"/></svg></div>
  <div className="desk-place__words"><small>{LOCATIONS[place]}</small><h2>{place==='court'?'A life above the harbour':HARBOUR_PLACE_NAMES[place]}</h2><nav aria-label="Nearby tools">{DESK_PLACE_DOORS[place].map(door=><button type="button" key={door.label} className="desk-door" onClick={()=>onOpen(door.target,door.object)}>{door.label} <span aria-hidden="true">↗</span></button>)}</nav>
  {place==='kiln'&&Boolean(reading?.kiln.pieces.length)&&<nav aria-label="Fired pieces">{reading!.kiln.pieces.map(piece=><button key={piece.key} onClick={()=>onOpen("pottery",piece.key)}>{piece.name}</button>)}</nav>}
  {atHome&&<nav aria-label="Rooms in our home">{(['kitchen','tower','cellar','atlas'] as const).map(id=><button type="button" key={id} aria-current={id===place?'location':undefined} onClick={()=>onVisit(id)}>{({kitchen:'Kitchen',tower:'Loft',cellar:'Cellar',atlas:'Atlas nook'})[id]}</button>)}</nav>}</div>
  <button className="desk-place__guide" type="button" onClick={onGuide}>Explore mountain &amp; town <span aria-hidden="true">⌁</span></button>
 </section>;
}
