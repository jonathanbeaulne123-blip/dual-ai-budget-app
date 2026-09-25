/** Paths, stairs, platforms and foundations cut into the ground. */
import type {BenchLine,BenchPad} from './terrain.ts';
import {PATH_EDGES,DOOR_APRONS} from './pathGraph.ts';
import {FUNICULAR_LINE,GONDOLA_LINE} from './transport.ts';
import {BUILDING_SITES,BUILDING_FORMS,buildingYaw,DISTRICTS,RESERVED_PLOTS,GOAL_PAVILION_SITE,SUMMIT_OBSERVATORY_SITE,type MountainBuilding} from './places.ts';
import {baseHeight} from './terrainBase.ts';
import {KITTY_CHAMBERS} from './damParts.ts';
import type {Point3} from './math.ts';

const DISTRICT_OF:Record<MountainBuilding,string>={home:'hearth',cottage:'orchard',library:'library',glasshouse:'glasshouse'};
/** The funicular sits on a formation where it runs near the ground and on trestles elsewhere. */
function trackRuns():Point3[][]{
  const out:Point3[][]=[];let run:Point3[]=[];
  for(const p of FUNICULAR_LINE.path){if(Math.abs(p[1]-baseHeight(p[0],p[2]))<2.5)run.push(p);else{if(run.length>3)out.push(run);run=[];}}
  if(run.length>3)out.push(run);return out;
}
export const EXTRA_BENCH_LINES:readonly BenchLine[]=[
  ...PATH_EDGES.filter(e=>e.kind==='path'||e.kind==='stair').map(e=>({id:e.id,points:e.points,halfWidth:e.halfWidth,shoulder:.4,slope:1,inset:.04,fill:'footprint' as const})),
  ...trackRuns().map((points,i)=>({id:`funicular-formation:${i}`,points,halfWidth:1.8,shoulder:.3,slope:1,inset:.35,fill:'footprint' as const})),
];
export const EXTRA_BENCH_PADS:readonly BenchPad[]=[
  ...(Object.keys(BUILDING_SITES) as MountainBuilding[]).map(id=>{const spot=BUILDING_SITES[id],level=DISTRICTS.find(d=>d.id===DISTRICT_OF[id])!.at[1];
    return {id:`building:${id}`,at:[spot[0],level,spot[1]] as Point3,half:[BUILDING_FORMS[id].half[0]+1,BUILDING_FORMS[id].half[1]+1] as const,yaw:buildingYaw(spot),inset:.05,slope:1,priority:1};}),
  ...DOOR_APRONS.map(a=>({id:`apron:${a.site}`,at:a.apron.at,half:a.apron.half,yaw:a.apron.yaw,inset:.03,slope:1,priority:1})),
  ...[...FUNICULAR_LINE.stations,...GONDOLA_LINE.stations].map(s=>({id:`platform:${s.id}`,at:s.platform.at,half:[s.platform.half[0]+.4,s.platform.half[1]+.4] as const,yaw:s.platform.yaw,inset:.05,slope:1,priority:1,fill:'footprint' as const})),
  ...RESERVED_PLOTS.map(p=>({id:`plot:${p.id}`,at:p.at,half:p.half,yaw:0,inset:.02,slope:1})),
  ...KITTY_CHAMBERS.map(c=>({id:`kitty:${c.id}`,at:c.at,half:[c.radius+1.2,c.radius+1.2] as const,yaw:0,inset:.02,slope:1})),
  {id:'goal-pavilion',at:GOAL_PAVILION_SITE.at,half:[GOAL_PAVILION_SITE.half[0]+1,GOAL_PAVILION_SITE.half[1]+1] as const,yaw:0,inset:.03,slope:1},
  {id:'observatory',at:SUMMIT_OBSERVATORY_SITE.at,half:[SUMMIT_OBSERVATORY_SITE.radius+1.5,SUMMIT_OBSERVATORY_SITE.radius+1.5] as const,yaw:0,inset:.03,slope:1},
];
