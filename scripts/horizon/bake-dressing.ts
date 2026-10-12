import type {LandCuts} from '../../src/harbour/horizon/land/interfaces.ts';
import type {District} from '../../src/harbour/horizon/world/definition.ts';
import type {NeighbourhoodModule} from '../../src/harbour/horizon/neighbourhoods/types.ts';
import {bakeDressings,createDressingContext,hashSeed,type DressingBake} from '../../src/harbour/horizon/neighbourhoods/bake.ts';
import {propIsEssential} from '../../src/harbour/horizon/kit/props/index.ts';
import type {DistrictDressing} from '../../src/harbour/horizon/neighbourhoods/types.ts';
import {buildHosts} from '../../src/harbour/horizon/world/build.ts';
import {districtAt} from '../../src/harbour/horizon/world/districts.ts';
import {protectedGreenOutline} from '../../src/harbour/horizon/world/views.ts';
// Static, not `await import(...)`: inside the esbuild bake bundle a lazy import of the runtime layer deadlocks on the async
// module inits under it (mountain/terrainBase.ts reads its terrain with a top-level await; node exits 13, "unsettled top-level
// await") — first hit by the first registered module (PR 4 Flats, D-WW169).
import {measureDistrictDressing} from '../../src/harbour/horizon/runtime/dressingLayer.ts';

/**
 * The Water's Way bake step (neighbourhoods/bake.ts) against the bake's own world: the final ground, beds, pads, water,
 * baked solids, hosts and the protected Green. Returns null when no module dresses anything (the bake is then unchanged,
 * byte for byte). Each dressed district's art budget is measured with the runtime layer's own builder.
 */
type Budget=NonNullable<District['dressing']>;
/**
 * Integration fitter (2026-10-12): the places were each budgeted against the land alone, and where two meet in one district
 * (the Bight, the landing, Lakeside lite) their sum passes CONTRACT §6. The fitter keeps every building, keep-plant, prop,
 * pool, ground paint and creature, and thins the district's other plants by a deterministic hash order (the same plants go
 * first on every machine) to the largest share that fits both tiers; if even no plant fits, it also drops the props that
 * neither collide, carry a pastime fixture nor are an essential kind (decoration). When even that cannot fit, the district is left exactly as authored (thinning it would lose the place and still not fit) and the bake's budget diagnostic names it. It runs after the lite pass (world/lite.ts simplifies the land's lite meshes), against the final land.
 */
export function fitDistrictDressing(d:DistrictDressing,ground:(x:number,z:number)=>number,room:{full:number;lite:number}):Budget{
  const measure=():Budget=>({full:measureDistrictDressing(d,ground,'full'),lite:measureDistrictDressing(d,ground,'lite')});
  const fits=(b:Budget)=>b.full.triangles<=room.full&&b.lite.triangles<=room.lite;
  const rank=(p:{species:string;at:readonly number[]})=>hashSeed(`${p.species}:${p.at[0]!.toFixed(2)}:${p.at[2]!.toFixed(2)}`)/4294967296;
  const all=d.plants,keep=all.filter(p=>p.keep),loose=all.filter(p=>!p.keep).map(p=>({p,r:rank(p)})).sort((a,b)=>a.r-b.r);
  const withShare=(share:number)=>{const cut=Math.round(loose.length*share);d.plants=[...keep,...loose.slice(0,cut).map(x=>x.p)];return measure();};
  const plants=d.plants,props=d.props;
  let b=withShare(0);
  if(!fits(b)){d.props=d.props.filter(p=>p.collide||p.fixture||propIsEssential(p.kind));b=measure();
    // Nothing the fitter may drop makes it fit (the land leaves no room): keep the place as authored, the diagnostic names it.
    if(!fits(b)){d.plants=plants;d.props=props;return measure();}}
  let lo=0,hi=1;if(fits(withShare(1)))return measure();
  for(let i=0;i<14;i++){const mid=(lo+hi)/2;if(fits(withShare(mid)))lo=mid;else hi=mid;}
  return withShare(lo);
}
export async function bakeNeighbourhoodDressing(modules:readonly NeighbourhoodModule[],cuts:LandCuts,ground:(x:number,z:number)=>number):Promise<(DressingBake&{budget:Record<string,Budget>;fit:(id:string,room:{full:number;lite:number})=>Budget})|null>{
  if(!modules.length)return null;
  const ctx=createDressingContext({ground,beds:cuts.beds,pads:cuts.pads,waters:cuts.waters,solids:cuts.solids,
    hosts:buildHosts(cuts).map(h=>({id:h.id,footprint:h.footprint,door:'xy'in h.door?{xy:h.door.xy}:{},height:h.height})),
    protectedAreas:[{id:'green',outline:protectedGreenOutline()}],districtAt:(x,z)=>districtAt(x,z)});
  const baked=bakeDressings(modules,ctx);
  if(!baked.dressing)return null;
  const budget:Record<string,NonNullable<District['dressing']>>={};
  for(const d of baked.dressing.districts)budget[d.districtId]={full:measureDistrictDressing(d,ground,'full'),lite:measureDistrictDressing(d,ground,'lite')};
  const dressing=baked.dressing;
  const fit=(id:string,room:{full:number;lite:number})=>{const d=dressing.districts.find(q=>q.districtId===id)!;return budget[id]=fitDistrictDressing(d,ground,room);};
  return {...baked,budget,fit};
}
