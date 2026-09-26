/**
 * The live world as the glider and the parachute see it (FLIGHT.md §2.2, §2.4, §9). Builds, from the
 * runtime's geography, water cuts and WorldDefinition, the pure simulation's `WingEnv` / `ChuteEnv` and the
 * `LandingContext` that `resolveTouchdown` reads. No scene, no DOM: headless tests build it from the baked
 * world exactly as the runtime does.
 *
 * `groundAt(x, z, y)` is "whatever is under the rider at height y": the highest walkable surface at or below y
 * (terrain where it is not cut away by a mouth mask, decks, jetties), or a water surface, whichever is higher;
 * a visible terrain face above y, or a structure wall at y, is ground *at y* (the wing meets it: a touchdown,
 * resolved as a landing, never damage). The Throat's mouth mask is open: the wing flies into it.
 */
import type {FlightEnvelope,Point3,Polygon,WorldDefinition} from '../../world/definition.ts';
import type {LandCuts,WaterCut} from '../../land/interfaces.ts';
import {waterHeightAt} from '../../land/water/index.ts';
import {terrainTriangleVisible} from '../../land/terrain/index.ts';
import {districtAt} from '../../world/districts.ts';
import type {HorizonPathGraph} from '../../world/pathGraph.ts';
import {HORIZON_MANIFEST} from '../../world/manifest.ts';
import {constantWind,type WindSample,type WindSource} from '../shared/wind.ts';
import {liftAt,liftField} from './lift.ts';
import {DEEP_JETTY} from './corridor.ts';
import type {LandingContext,LandingDistrict,LandingNode,LandingSurface} from './landing.ts';
import type {WingEnv} from './wing.ts';
import type {ChuteEnv} from './chute.ts';

/** The slice of `runtime/geography.ts` the movers read. */
export interface GliderGeography{
  ground(x:number,z:number):number;
  surface(x:number,z:number,y?:number,step?:number):{y:number;slope:number;material:string}|null;
  blocked?(x:number,z:number,y:number,radius?:number):boolean;
}
export interface GliderWorldSource{
  world:Pick<WorldDefinition,'sky'|'hosts'>&{pathGraph?:HorizonPathGraph};
  geography:GliderGeography;
  cuts:Pick<LandCuts,'waters'|'mouths'>;
}
export interface GliderEnvOptions{
  /** Local hour for the thermals (`solar.localMinutes / 60` of the runtime's review date). Default 15.5, the frozen afternoon. */
  hour?:()=>number;
  wind?:WindSource;
  /** Seconds, for the wind source. */
  clock?:()=>number;
}
export interface GliderEnv{
  envelope:FlightEnvelope;
  wind(x:number,y:number,z:number):WindSample;
  hour():number;
  /** Net vertical air motion at the rider (lift.ts), m/s up +. */
  lift(x:number,y:number,z:number,heading:number):number;
  groundAt(x:number,z:number,y:number):number;
  water(x:number,z:number,y?:number):{id:string;y:number}|null;
  /**
   * The pure wing's env. `ground(x, z, y)` takes the rider's height (decks under the wing, not over it); `y()` is only
   * the fallback for a caller that passes none (and without it, the top surface).
   */
  wingEnv(y?:()=>number,options?:{walls?:()=>boolean}):WingEnv;
  chuteEnv(y?:()=>number):ChuteEnv;
  landingContext(contactY:number):LandingContext;
  shoreNode(x:number,z:number):LandingNode|null;
  pathNode(x:number,z:number,y?:number):LandingNode|null;
  inHostFootprint(x:number,z:number):boolean;
  /** Inside a host's building volume (footprint, floor − 2 … roof + 1): the camera never stands there. */
  inHost(x:number,y:number,z:number):boolean;
  /** The camera's cheap point test for `clearFraction`: terrain and hosts (every sample). */
  cameraBlocked(x:number,y:number,z:number):boolean;
  /** Structures (bridges, towers, walls) at a point: a costlier query, sampled sparsely by the camera and skipped 60 m above the terrain. */
  solidAt(x:number,y:number,z:number):boolean;
  placeLabel(x:number,z:number):string;
}

/** Area names for labels (the manifest's district notes, short). */
export const AREA_LABELS:Record<string,string>={harbour:'Little Harbour',landing:'the Landing',reach:'the Reach',green:'the Green',hollow:'the Hollow',scholars:"Scholars' Edge",flats:'the Flats',bight:'Bight Shore',lakeside:'Stillwater',notch:'the Notch',prow:'the Prow',crown:'the Crown',offshore:'the Lamp'};
const scale=HORIZON_MANIFEST.scale.factor;
/** The manifest's neighbourhoods as circles: a touchdown inside one is the apron fade (FLIGHT.md §2.4). */
export const NEIGHBOURHOODS:readonly {id:string;label:string;centre:readonly [number,number];r:number}[]=Object.freeze(
  (HORIZON_MANIFEST.neighbourhoods as {id:string;label:string;centre:number[];r:number}[]).map(n=>({id:n.id,label:n.label,centre:[n.centre[0]!*scale,n.centre[1]!*scale] as const,r:n.r*scale})));
export function neighbourhoodAt(x:number,z:number){return NEIGHBOURHOODS.find(n=>Math.hypot(x-n.centre[0],z-n.centre[1])<=n.r)??null;}

export function pointInPolygon(x:number,z:number,polygon:Polygon):boolean{
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const [xi,zi]=polygon[i]!,[xj,zj]=polygon[j]!;
    if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi||1e-12)+xi)inside=!inside;
  }
  return inside;
}

const FLOOR_FALLBACK=0;
/** No structure stands this far above the terrain under it: the costly solid queries are skipped above it. */
export const SOLID_CEILING=60;
/** Walls count only after the wing has left the pad's railings behind (seconds after the lip). */
export const WALL_GRACE=1;

export function createGliderEnv(source:GliderWorldSource,options:GliderEnvOptions={}):GliderEnv{
  const {world,geography,cuts}=source,envelope=world.sky,windSource=options.wind??constantWind(),hour=options.hour??(()=>15.5),clock=options.clock??(()=>0);
  const waters=cuts.waters.filter(w=>w.kind!=='dry');
  const nodes=world.pathGraph?.nodes??[];
  const hosts=world.hosts.filter(h=>h.footprint&&h.footprint.length>=3);
  const wind=(x:number,y:number,z:number)=>windSource.sample(x,y,z,clock());
  function water(x:number,z:number,y=Infinity):{id:string;y:number}|null{
    let best:{id:string;y:number}|null=null;
    for(const w of waters){
      // Underground water (the Deep) is under the mountain: it counts only for a rider already below the terrain.
      if((w as WaterCut).underground&&!(y<geography.ground(x,z)))continue;
      const level=waterHeightAt(w,x,z);
      if(level!==null&&level<=y+1e-6&&(!best||level>best.y))best={id:w.id,y:level};
    }
    return best;
  }
  const visible=(x:number,z:number)=>terrainTriangleVisible(x,z,cuts);
  function groundAt(x:number,z:number,y:number):number{
    const raw=geography.ground(x,z),open=visible(x,z);
    if(open&&raw>y)return raw;
    const s=geography.surface(x,z,y+.5),w=water(x,z,y+.5);
    const top=Math.max(s?.y??-Infinity,w?.y??-Infinity);
    if(Number.isFinite(top))return top;
    return open?raw:Math.min(y,FLOOR_FALLBACK);
  }
  function inHostFootprint(x:number,z:number){return hosts.some(h=>pointInPolygon(x,z,h.footprint!));}
  function inHost(x:number,y:number,z:number){
    return hosts.some(h=>{const floor=h.height??geography.ground(x,z),roof=floor+(h.roofHeight??8);return y>=floor-2&&y<=roof+1&&pointInPolygon(x,z,h.footprint!);});
  }
  function placeLabel(x:number,z:number){const n=neighbourhoodAt(x,z);return n?n.label.replace(/^The /,'the '):AREA_LABELS[districtAt(x,z)]??'the path';}
  const toNode=(n:{id:string;at:Point3},label:string):LandingNode=>({id:n.id,at:[n.at[0],n.at[1],n.at[2]],label});
  function nearestNodes(x:number,z:number,y?:number){
    return nodes.map(n=>({n,d:Math.hypot(n.at[0]-x,n.at[2]-z)+(y===undefined?0:Math.abs(n.at[1]-y)*.25)})).sort((a,b)=>a.d-b.d);
  }
  function pathNode(x:number,z:number,y?:number):LandingNode|null{
    for(const {n} of nearestNodes(x,z,y)){if(inHostFootprint(n.at[0],n.at[2]))continue;return toNode(n,placeLabel(n.at[0],n.at[2]));}
    return null;
  }
  const shore=new Map<string,boolean>();
  function isShore(n:{id:string;at:Point3}){
    let known=shore.get(n.id);if(known!==undefined)return known;
    known=false;
    if(!inHostFootprint(n.at[0],n.at[2])&&!water(n.at[0],n.at[2],n.at[1]+.3))
      for(const r of [8,16])for(let i=0;i<8&&!known;i++){const a=i*Math.PI/4,w=water(n.at[0]+Math.cos(a)*r,n.at[2]+Math.sin(a)*r,n.at[1]+.5);if(w&&n.at[1]-w.y<=6)known=true;}
    shore.set(n.id,known);return known;
  }
  function shoreNode(x:number,z:number):LandingNode|null{
    const sorted=nearestNodes(x,z);
    for(let i=0;i<sorted.length&&i<600;i++){const n=sorted[i]!.n;if(isShore(n))return toNode(n,AREA_LABELS[districtAt(n.at[0],n.at[2])]??'the shore');}
    return sorted[0]?toNode(sorted[0].n,placeLabel(sorted[0].n.at[0],sorted[0].n.at[2])):null;
  }
  // `liftField(envelope, wind, hour)`, rebuilt only when the hour or the wind sample changes.
  let field:{h:number;w:WindSample;f:ReturnType<typeof liftField>}|null=null;
  function lift(x:number,y:number,z:number,heading:number){
    const h=hour(),w=wind(x,y,z);
    if(!field||field.h!==h||field.w!==w)field={h,w,f:liftField(envelope,w,h)};
    return field.f(x,y,z,heading);
  }
  const sinks={volumes:(envelope.volumes??[]).filter(v=>v.kind==='sink'),ceiling:envelope.ceiling};
  function landingContext(contactY:number):LandingContext{
    return{
      surface(x,z):LandingSurface|null{const s=geography.surface(x,z,contactY+1.5);return s?{y:s.y,slope:s.slope,material:s.material,walkable:true}:null;},
      water:(x,z)=>water(x,z,contactY+1.5),
      district(x,z):LandingDistrict{const n=neighbourhoodAt(x,z);if(n)return{id:n.id,kind:'neighbourhood',label:n.label};const id=districtAt(x,z);return{id,kind:'wild',label:AREA_LABELS[id]??id};},
      nearestShoreNode:shoreNode,
      nearestApron:(x,z)=>pathNode(x,z,contactY),
      nearestPathNode:(x,z)=>pathNode(x,z,contactY),
      inHostFootprint,
      envelope,
      deepJetty:DEEP_JETTY,
    };
  }
  return{
    envelope,wind,hour,lift,groundAt,water,landingContext,shoreNode,pathNode,inHostFootprint,inHost,placeLabel,
    wingEnv(y,opts={}){
      return{
        get wind(){return wind(0,y?.()??0,0);},
        lift,
        ground(x,z,at){
          const h=at??y?.()??Infinity,g=groundAt(x,z,h);
          // A structure wall at the rider's height is met as ground here (a touchdown, resolved as a landing).
          if(opts.walls?.()&&h-geography.ground(x,z)<=SOLID_CEILING&&geography.blocked?.(x,z,h,.5))return Math.max(g,h);
          return g;
        },
      };
    },
    chuteEnv(y){
      const dz=envelope.dropZone;
      return{
        get wind(){return wind(0,y?.()??0,0);},
        ground:(x,z,at)=>groundAt(x,z,at??y?.()??Infinity),
        // Sink fields only (the Bight, the Notch): no thermal or ridge lift for the canopy.
        sink:(x,yy,z)=>Math.min(0,liftAt(sinks,wind(x,yy,z),{x,y:yy,z},0,hour()).lift),
        ...(dz?{dropZone:{xy:dz.xy,rings:dz.rings}}:{}),
      };
    },
    cameraBlocked(x,y,z){return visible(x,z)&&y<geography.ground(x,z)+.3||inHost(x,y,z);},
    solidAt(x,y,z){return y-geography.ground(x,z)<=SOLID_CEILING&&(geography.blocked?.(x,z,y-.3,.18)??false);},
  };
}
