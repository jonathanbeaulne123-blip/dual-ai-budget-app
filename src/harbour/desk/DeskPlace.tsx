import {DISTRICTS,type WorldPoint3} from "../worldDistricts.ts";
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
export function deskOutdoorDistrict(at?:WorldPoint3){return at?DISTRICTS.find(d=>Math.abs(at[1]-d.at[1])<=12&&Math.hypot(at[0]-d.at[0],at[2]-d.at[2])<=d.radius*1.5):undefined;}
export function DeskPlace({outdoorAt,reading,place,onOpen,onGuide,onVisit}:{outdoorAt?:WorldPoint3;reading?:HarbourReading;place:HarbourPlaceId;onOpen:(target:string,object?:string)=>void;onGuide:()=>void;onVisit:(place:HarbourPlaceId)=>void}){
 const district=place==='court'?deskOutdoorDistrict(outdoorAt):undefined;
 const mountainPath=place==='court'&&outdoorAt&&outdoorAt[1]>6;
 const location=district?`${district.name} · on the mountain`:mountainPath?'Mountain path · above town':LOCATIONS[place];
 const heading=district?.name??(mountainPath?'Between the plateaus':place==='court'?'A life above the harbour':HARBOUR_PLACE_NAMES[place]);
 const atHome=['kitchen','tower','cellar','atlas'].includes(place);
 return <section className="desk-place" aria-label="Your place in the neighbourhood">
  <div className="desk-place__scene" aria-hidden="true"><svg viewBox="0 0 240 82"><path className="desk-place__ridge" d="M0 73 39 38 58 46 100 4 121 27 149 15 203 66 240 73V82H0Z"/><path className="desk-place__water" d="m110 29 20 9-12 15 27 10-8 19h-12l8-17-26-10 13-15Z"/><path className="desk-place__dam" d="m102 31 37 7-1 9-34-6Z"/><path className="desk-place__houses" d="m24 69 8-8 8 8v11H24Zm44-17 8-8 8 8v12H68Zm105 10 8-8 8 8v13h-16Z"/></svg></div>
  <div className="desk-place__words"><small>{location}</small><h2>{heading}</h2><nav aria-label="Nearby tools">{district&&<button type="button" className="desk-door" onClick={()=>["kitchen","cottage","library","glasshouse"].includes(district.destination)?onVisit(district.destination as HarbourPlaceId):onOpen(district.destination)}>Open {({hearth:"home",orchard:"the cottage",library:"the Library",glasshouse:"the Glasshouse",reservoir:"goals",summit:"Journey"} as Record<string,string>)[district.id]}</button>}{DESK_PLACE_DOORS[place].map(door=><button type="button" key={door.label} className="desk-door" onClick={()=>onOpen(door.target,door.object)}>{door.label} <span aria-hidden="true">↗</span></button>)}</nav>
  {place==='kiln'&&Boolean(reading?.kiln.pieces.length)&&<nav aria-label="Fired pieces">{reading!.kiln.pieces.map(piece=><button key={piece.key} onClick={()=>onOpen("pottery",piece.key)}>{piece.name}</button>)}</nav>}
  {atHome&&<nav aria-label="Rooms in our home">{(['kitchen','tower','cellar','atlas'] as const).map(id=><button type="button" key={id} aria-current={id===place?'location':undefined} onClick={()=>onVisit(id)}>{({kitchen:'Kitchen',tower:'Loft',cellar:'Cellar',atlas:'Atlas nook'})[id]}</button>)}</nav>}</div>
  <button className="desk-place__guide" type="button" onClick={onGuide}>Explore mountain &amp; town <span aria-hidden="true">⌁</span></button>
 </section>;
}
