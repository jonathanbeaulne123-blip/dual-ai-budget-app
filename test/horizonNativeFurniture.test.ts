import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {nativeOccupied,nativeWaterLevel} from '../src/harbour/horizon/land/mountainV2/planning';
import {nativeScenicStops} from '../src/harbour/horizon/land/corridor/nativeStops';
import {createCorridorEnv} from '../src/harbour/horizon/land/corridor/stations';
import {createMountainV2Region,terraceBedExclusion} from '../src/harbour/horizon/regions/mountainV2';
import {sampleTerrain} from '../src/harbour/horizon/land/terrain';
import {decodeTerrainAsset} from '../src/harbour/horizon/land/terrain/asset';
import type {LandCuts} from '../src/harbour/horizon/land/interfaces';
import {buildMountainCorridor,mountainBendTargets,mountainPlanEnvironment} from '../src/harbour/horizon/land/corridor/mountain';
import {corridorDestinations} from '../src/harbour/horizon/world/build';
import {Frame} from '../src/harbour/horizon/land/corridor/plan/frame';
import {nearestOnPath} from '../src/harbour/horizon/land/structures/mesh';
import {planCorridor} from '../src/harbour/horizon/land/corridor/plan';
import type {CorridorStation} from '../src/harbour/horizon/land/corridor/types';
import V2 from '../src/harbour/horizon/land/mountainV2/v2-data.json';
import {pointInPolygon} from '../src/harbour/horizon/world/geometry';
import type {Point2} from '../src/harbour/horizon/world/definition';
const world=JSON.parse(readFileSync('public/horizon/world/horizon-geo-1.json','utf8'));
const bytes=readFileSync('public/horizon/terrain/horizon-geo-1.bin');
const field=decodeTerrainAsset(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer);
const terrain=(x:number,z:number)=>sampleTerrain(field,x,z);
const region=createMountainV2Region({walkingJoinSolids:world.geometry.solids,horizonGround:terrain,yield:terraceBedExclusion(world.collision.beds),terrainStep:field.step});
const ground=(x:number,z:number)=>region.provider.owns(x,z)?region.provider.ground(x,z):terrain(x,z);
const cuts:LandCuts={...world.collision,solids:world.geometry.solids,diagnostics:[]};
/** Actual native parapet bodies, not the collider run's extra end samples. routeArt.ts
 * draws this 0..0.5 m masonry strip from y-0.05 to y+0.95; full/lite use every 1/2 rows. */
function parapetCells(id:string,step:1|2){
  const guard=V2.road.guards.find(g=>`mountainV2:${g.id}`===id&&g.kind==='parapet');
  if(!guard)throw new Error(`No native masonry support ${id}`);
  const side=guard.side==='left'?1:-1;
  const samples=V2.road.samples.filter(s=>s.s>=guard.s0&&s.s<=guard.s1);
  const rows=samples.filter((_,i)=>i%step===0||i===samples.length-1).map(s=>{
    const point=(extra:number):Point2=>[s.at[0]!+s.normal[0]!*(s.hw+extra)*side,s.at[2]!+s.normal[2]!*(s.hw+extra)*side];
    return {inside:point(0),outside:point(.5),y:s.at[1]!};
  });
  return rows.slice(1).map((b,i)=>{const a=rows[i]!;return {
    outline:[a.inside,b.inside,b.outside,a.outside],
    // These conservative endpoint heights stay inside the entire sloping body.
    bottom:Math.max(a.y,b.y)-.05,top:Math.min(a.y,b.y)+.95,
  };});
}

describe('native mountain furniture uses its real environment',()=>{
  it('recognizes the rendered reservoir and solid pavilion columns absent from ordinary Horizon cuts',()=>{
    expect(nativeWaterLevel(1282,497,ground)).toBe(140);
    expect(nativeWaterLevel(1282,497,()=>141)).toBeNull();
    expect(nativeOccupied(1354.785430,516.885828,ground)).toBe(true);
    expect(nativeOccupied(1358,583,ground)).toBe(true); // actual rotated library building
  });
  it('rejects mature crowns which would overlap an existing native tree although the new trunk is clear',()=>{
    const [x,z]=[1397.187,563.212];
    expect(nativeOccupied(x,z,ground,0,6)).toBe(false);
    expect(nativeOccupied(x,z,ground,2.0444,6)).toBe(true);
  });
  it('keeps one supported library garden stop with its whole walking attachment clear',()=>{
    const env=createCorridorEnv(cuts,ground),stops=nativeScenicStops(env);
    expect(stops).toHaveLength(1);
    expect(stops[0]).toMatchObject({label:'Library garden bench',at:[1364,89,592],existingFloor:true,connectsTo:['mountainV2:path:apron:library~door:library']});
    // This helper throws if any point of the 3.6×2.4 m footprint or 1.2 m walk-up loses support/clearance.
    expect(()=>nativeScenicStops({...env,occupied:(x,z)=>Math.hypot(x-1364,z-592)<2||env.occupied(x,z)})).toThrow(/Library garden/);
  });
  it('lights both Stillwater portal approaches without adding a main-road centre line',()=>{
    const side={edge:'shoulder' as const,guard:'none' as const,paved:4,drop:0,waterEu:null};
    const stations:CorridorStation[]=Array.from({length:51},(_,i)=>({s:i*2,at:[i*2,0,0],tangent:[1,0],grade:0,half:4,context:i>=15&&i<=35?'structure':'mountain',reachId:'S',left:{...side},right:{...side},...(i>=15&&i<=35?{structureId:'stillwaterTunnel'}:{})}));
    const plan=planCorridor({id:'spur stillwater',closed:false,step:2,stations,reaches:[{id:'S',label:'Stillwater',from:0,to:100,context:'mountain'}]},{ground:()=>0,water:()=>false,seed:'stillwater-portal'});
    expect(plan.lamps.some(l=>l.kind==='roadLantern'&&l.at[0]<30)).toBe(true);
    expect(plan.lamps.some(l=>l.kind==='roadLantern'&&l.at[0]>70)).toBe(true);
    expect(plan.markings.some(m=>m.kind==='centreDash')).toBe(false);
  });
  it('lights both running lanes through the real bend spans with supported posts outside every running lane and walking section',()=>{
    const env=createCorridorEnv(cuts,ground),destinations=corridorDestinations(cuts),E=mountainPlanEnvironment(env,destinations);
    const corridor=buildMountainCorridor(env,destinations)!,F=new Frame(corridor.stations,false),bends=mountainBendTargets();
    expect(bends).toHaveLength(6);
    for(const bend of bends){
      expect(bend.s).toBeGreaterThan(100);expect(bend.s).toBeLessThan(900);
      const count=Math.ceil((bend.to-bend.from)/.5),samples=[bend.s,...Array.from({length:count+1},(_,i)=>bend.from+(bend.to-bend.from)*i/count)];
      for(const s of samples){const st=F.st(F.nearestIndex(s));for(const side of [-1,1]){
        const p=F.point(s,side*st.half/2);
        expect(corridor.lamps.some(l=>Math.hypot(p[0]-l.pool[0],p[2]-l.pool[2])<=l.poolRadius+.01),`dark running lane at bend ${bend.id} s=${s}`).toBe(true);
      }}
    }
    const roadLamps=corridor.lamps.filter(l=>l.kind==='roadLantern'),measured:string[]=[];
    // A parapet mount may meet its own road edge. No other Horizon bed, solid or
    // native walk/building/tree gets that exception.
    const offRoad=createCorridorEnv({...cuts,beds:cuts.beds.filter(b=>b.id!==corridor.id)},ground);
    for(const l of corridor.lamps){
      const q=nearestOnPath([l.at[0],l.at[2]],corridor.stations.map(s=>s.at)),st=F.st(F.nearestIndex(q.along));
      expect(q.distance,`${l.id} inside running lane`).toBeGreaterThan(st.half/2+.6);
      if(l.kind!=='roadLantern')continue;
      const dx=l.head[0]-l.at[0],dz=l.head[2]-l.at[2],len=Math.hypot(dx,dz);
      expect(len).toBeGreaterThan(.3);
      // Same local +x arm direction and rotation as lampPlacement: test the real
      // rotated 0.4 x 0.4 m stone foot, not a new site at a projected station.
      const foot=(u:number,v:number):Point2=>[l.at[0]+dx/len*u-dz/len*v,l.at[2]+dz/len*u+dx/len*v];
      const mount=corridor.guards.find(g=>g.owner==='region'&&g.kind==='stoneParapet'&&g.side===l.side&&nearestOnPath([l.at[0],l.at[2]],g.line).distance<.2);
      for(const u of [-.2,0,.2])for(const v of [-.2,0,.2]){
        const [x,z]=foot(u,v);
        expect(E.water?.(x,z),`${l.id} wet post footprint`).toBe(false);
        if(mount){
          expect(offRoad.occupied(x,z),`${l.id} parapet mount overlaps another Horizon route/solid`).toBe(false);
          expect(nativeOccupied(x,z,()=>l.at[1],0,6,'mountain-road'),`${l.id} parapet mount overlaps native walk/keepout`).toBe(false);
        }else{
          expect(E.occupied?.(x,z),`${l.id} post footprint occupies route/native keepout`).toBe(false);
          expect(Math.abs(ground(x,z)-l.at[1]),`${l.id} unsupported stone foot at ${x},${z}`).toBeLessThanOrEqual(.141);
        }
      }
      if(mount){
        // The planner deliberately embeds a road-lantern post in a parapet on a
        // steep shoulder (lamps.ts make). Prove a 0.1 x 0.4 x 0.2 m portion of
        // its actual plinth is inside the visible masonry in BOTH tiers; being
        // near a guard label, collider or road is not sufficient support.
        for(const step of [1,2] as const){
          const cells=parapetCells(mount.id,step);
          for(const u of [-.2,-.15,-.1])for(const v of [-.2,0,.2]){
            const [x,z]=foot(u,v);
            expect(cells.some(c=>pointInPolygon(x,z,c.outline)&&l.at[1]+.1>=c.bottom&&l.at[1]+.3<=c.top),`${l.id} lacks native masonry anchorage at ${x},${z} (step ${step})`).toBe(true);
          }
        }
      }
      measured.push(l.id);
    }
    expect(measured).toEqual(roadLamps.map(l=>l.id)); // every actual road lantern, no environmental skip
    expect(measured.length).toBeGreaterThan(20);
  });

});
