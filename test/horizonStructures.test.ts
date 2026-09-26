import { describe, expect, it } from 'vitest';
import { buildLandCuts } from '../src/harbour/horizon/land/beds/build';
import { baseHeight } from '../src/harbour/horizon/land/terrain';
import { bounds, box, distance, nearestOnPath, slab, solid } from '../src/harbour/horizon/land/structures/mesh';
import { floorAt } from '../src/harbour/horizon/world/views';
import { solidVerticalRangeAt } from '../src/harbour/horizon/world/geometry';
import { buildStair, SPANS } from '../src/harbour/horizon/land/structures/build';
import { FOOTING_SINK, settleFoundations } from '../src/harbour/horizon/land/structures/foundations';
import { groundTerrainBeds } from '../src/harbour/horizon/land/structures/groundBeds';
import { bed } from '../src/harbour/horizon/land/beds/profiles';
import { sampleSpline } from '../src/harbour/horizon/land/beds/solver';
import { buildOffshoreSolids } from '../src/harbour/horizon/land/offshore';
import { HORIZON_MANIFEST as M } from '../src/harbour/horizon/world/manifest';
import type { LandCuts, StructureSolid, XY, XYZ } from '../src/harbour/horizon/land/interfaces';
import { BufferGeometry, Float32BufferAttribute, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';

/** Closed 8-vertex prisms of a solid: plan centre, bottom and top. */
function prisms(s:StructureSolid):{x:number;z:number;bottom:number;top:number;corners:XYZ[]}[] {
  const out=[];for(let o=0;o+23<s.positions.length;o+=24){const v=Array.from({length:8},(_,i):XYZ=>[s.positions[o+i*3]!,s.positions[o+i*3+1]!,s.positions[o+i*3+2]!]);out.push({x:v.reduce((n,p)=>n+p[0],0)/8,z:v.reduce((n,p)=>n+p[2],0)/8,bottom:Math.min(...v.map(p=>p[1])),top:Math.max(...v.map(p=>p[1])),corners:v.slice(0,4)});}return out;
}
/** The lowest prism of each support column: the footing that must reach the ground. */
const lowest=(s:StructureSolid)=>{const all=prisms(s);return all.filter(p=>!all.some(q=>q.bottom<p.bottom-.001&&Math.hypot(q.x-p.x,q.z-p.z)<1.5));};
const cutsOnce=(()=>{let c:LandCuts|undefined;return ()=>c??=buildLandCuts(baseHeight);})();
const find=(cuts:LandCuts,id:string)=>cuts.solids.find(s=>s.id===id);

describe('Horizon structural solids',()=>{
  it('winds slab undersides toward a camera beneath them',()=>{
    for(const shape of ['box','slab']){const s=solid('test','bridge','stone','deck');if(shape==='box')box(s,[0,0],10,[10,10],9.4);else slab(s,[-5,10,0],[5,10,0],10,.6);
      const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(s.positions,3));g.setIndex(s.indices);const mesh=new Mesh(g,new MeshBasicMaterial());mesh.updateMatrixWorld();
      expect(new Raycaster(new Vector3(0,0,0),new Vector3(0,1,0)).intersectObject(mesh).length).toBeGreaterThan(0);
    }
  });
  it('provides every named span with a thick deck and a load path to the ground',()=>{
    const cuts=cutsOnce();
    for(const spec of SPANS){
      const deck=find(cuts,`${spec.id}.deck`)!;expect(deck).toBeDefined();const b=bounds(deck);expect(b.max[1]-b.min[1]).toBeGreaterThanOrEqual(.599999);
      const supports=find(cuts,`${spec.id}.supports`)!;expect(supports.indices.length).toBeGreaterThan(0);
      // Deck → bearing → pier → footing: every footing sinks below the ground it stands on.
      for(const p of lowest(supports))expect(p.bottom,spec.id).toBeLessThanOrEqual(baseHeight(p.x,p.z)-FOOTING_SINK+1e-6);
      // Bespoke spans are linked to their structural bed so junctions do not re-bridge them.
      expect(supports.bedIds).toContain(`structure.${spec.id}`);
    }
    for(const id of ['prowTunnel','shoulderTunnel','duneCulvert','oreTunnel','seaPassage'])expect(find(cuts,`${id}.roof`)!.indices.length).toBeGreaterThan(0);
    const deck=bounds(find(cuts,'highSpan.deck')!);expect(deck.max[1]).toBe(24);expect(deck.min[1]).toBeGreaterThan(23);
    expect(bounds(find(cuts,'highSpan.shelf.deck')!).max[1]).toBe(12);
  },120000);
  it('carries the High Span gate opening on a through truss with no pier inside the 44 eu aperture',()=>{
    const cuts=cutsOnce(),route=cuts.beds.find(b=>b.id==='structure.highSpan')!,mid=nearestOnPath([1240,1105],route.points).along;
    const piers=prisms(find(cuts,'highSpan.supports')!).map(p=>Math.abs(nearestOnPath([p.x,p.z],route.points).along-mid));
    expect(Math.min(...piers)).toBeGreaterThanOrEqual(21.99);
    const truss=find(cuts,'highSpan.truss')!;expect(truss.role).toBe('support');const t=bounds(truss);expect(t.max[1]).toBeCloseTo(28.5,5);
    // The bottom chords bear directly under the deck edges (deck underside 23.4).
    expect(prisms(truss).some(p=>Math.abs(p.top-23.4)<1e-6)).toBe(true);
  },120000);
  it('lays the Reach gallery on the west bank beside the river and the overlook at camera C',()=>{
    const cuts=cutsOnce(),river=sampleSpline(M.water_routes.RIVER_RUN.pts as unknown as XY[],2).map(p=>[p[0],0,p[1]] as XYZ);
    const gallery=cuts.beds.find(b=>b.id==='highSpan.walk')!;
    for(const p of gallery.points.slice(0,-1))expect(nearestOnPath([p[0],p[2]],river).distance).toBeGreaterThanOrEqual(7.5);
    expect(gallery.points.at(-1)).toEqual([1240,9,1130]);
    expect(bounds(find(cuts,'highSpan.walk.deck')!).max[1]).toBeCloseTo(10.8,5);
    const c=M.views.find(v=>v.id==='C')!.xy as unknown as XY;
    const field={revision:'horizon-geo-1' as const,width:2000,depth:1800,step:100,columns:21,rows:19,heights:new Float32Array(399).fill(6),surfaces:new Uint8Array(399)};
    expect(floorAt(field,cuts,c)).toBe(10);
    expect(prisms(find(cuts,'highSpan.overlook.supports')!).length).toBe(8);
    expect(solidVerticalRangeAt(find(cuts,'highSpan.overlook.rails')!,c[0]+.3,c[1]-3.1)?.top).toBeCloseTo(11.05,5);
  },120000);
  it('follows each road tunnel floor on its road and measures the Prow Tunnel's rock cover',()=>{
    const cuts=cutsOnce();
    for(const [id,route] of [['prowTunnel','V01'],['shoulderTunnel','V02']] as const){
      const tube=cuts.beds.find(b=>b.id===id)!,road=cuts.beds.find(b=>b.id===route)!;
      expect(Math.max(...tube.points.map(p=>p[1]))-Math.min(...tube.points.map(p=>p[1]))).toBeGreaterThan(5);
      for(const p of tube.points)expect(Math.abs(nearestOnPath([p[0],p[2]],road.points).at[1]-p[1])).toBeLessThan(.05);
      expect(cuts.mouths.filter(m=>m.id.startsWith(`${id}.portal.`))).toHaveLength(2);
    }
    // Stage A integration: V01 now rides its typical grade (T2) and runs 9–13 eu lower through the Prow, so the
    // RESERVED tunnel (built as authored) has rock over its lined roof: min cover 8.4 eu on the offline ground, no conflict.
    const prowTube=cuts.beds.find(b=>b.id==='prowTunnel')!,cover=Math.min(...prowTube.points.map(p=>baseHeight(p[0],p[2])-(p[1]+5.6)));
    expect(cover).toBeGreaterThan(2);expect(cuts.diagnostics.some(d=>d.id==='structures.prowTunnel.cover')).toBe(false);
  },120000);
  it('carries every stair on stringers and bents no further apart than 6 eu, with posted rails',()=>{
    const cuts=cutsOnce();
    for(const id of ['damPortage','seaStair','lampGallery.stair','zipLanding.stair','damGallery.flight.0','crownLaunch.stair']){
      const stair=cuts.beds.find(b=>b.id===id)!,run=distance([stair.points[0]![0],stair.points[0]![2]],[stair.points[1]![0],stair.points[1]![2]]);
      expect(find(cuts,`${id}.stringers`)!.indices.length,id).toBeGreaterThan(0);
      const bents=[...new Set(prisms(find(cuts,`${id}.supports`)!).map(p=>nearestOnPath([p.x,p.z],stair.points).along.toFixed(1)))].map(Number).sort((a,b)=>a-b);
      const gaps=[bents[0]!,...bents.slice(1).map((v,i)=>v-bents[i]!),run-bents.at(-1)!],reported=cuts.diagnostics.some(d=>d.id.startsWith(`structures.${id}.`)&&/girderSpan|clearSpan/.test(d.id));
      if(!reported)expect(Math.max(...gaps),id).toBeLessThanOrEqual(6.01);
      const posts=prisms(find(cuts,`${id}.rails`)!).filter(p=>p.top-p.bottom>1);expect(posts.length,id).toBeGreaterThanOrEqual(2*Math.ceil(run/2));
    }
  },120000);
  it('refuses and reports a stair whose footings cannot leave a protected lane',()=>{
    const cuts:LandCuts={beds:[bed('lane','road',[[0,0,-40],[0,0,40]])],pads:[],mouths:[],waters:[],solids:[],diagnostics:[]};cuts.beds[0]!.width=60;
    buildStair('test.stair',[-10,20,0],[10,34,0],3,cuts,()=>0);
    expect(cuts.diagnostics.find(d=>d.id==='structures.test.stair.clearSpan')?.severity).toBe('conflict');
  });
  it('supports the dam apron clear of the tailrace and links the dam crest to its abutments',()=>{
    const cuts=cutsOnce(),piers=prisms(find(cuts,'dam.apron.supports')!);
    expect(piers.length).toBeGreaterThanOrEqual(12);for(const p of piers)expect(p.bottom).toBeLessThanOrEqual(baseHeight(p.x,p.z)-FOOTING_SINK+1e-6);
    const river=sampleSpline(M.water_routes.RIVER_RUN.pts as unknown as XY[],2).map(p=>[p[0],0,p[1]] as XYZ);
    for(const p of prisms(find(cuts,'dam.apron.abutments')!))expect(nearestOnPath([p.x,p.z],river).distance).toBeGreaterThan(3.5);
    expect(find(cuts,'dam.abutments')!.bedIds).toEqual(['walk damCrest']);
  },120000);
  it('builds raised cable platforms and the Crown launch as decks on columns, not terrain pads',()=>{
    const cuts=cutsOnce();
    expect(cuts.pads.some(p=>p.id==='platform.prowPlatform')).toBe(false);
    expect(bounds(find(cuts,'platform.prowPlatform.slab')!).max[1]).toBe(100);expect(prisms(find(cuts,'platform.prowPlatform.supports')!).length).toBe(8);expect(prisms(find(cuts,'crownLaunch.columns')!).length).toBe(8);
    const crown=find(cuts,'crownLaunch.slab')!;expect(bounds(crown).max[1]).toBe(170);expect(crown.walkable).toBe(true);expect(cuts.pads.some(p=>p.id==='crownLaunch')).toBe(false);
  },120000);
  it('extends lowest footings, wall feet and rock bases to the final ground without moving fixed decks',()=>{
    const cuts=buildLandCuts(baseHeight),deck=find(cuts,'highSpan.deck')!,before=[...deck.positions];cuts.solids.push(...buildOffshoreSolids());
    const beam=solid('test.beam','beam','stone','support');box(beam,[0,0],10,[20,1],9.4);cuts.solids.push(beam);const beamBefore=[...beam.positions],truss=[...find(cuts,'highSpan.truss')!.positions],settled=settleFoundations(cuts,()=>-20);expect(beam.positions).toEqual(beamBefore);
    expect(find(cuts,'highSpan.truss')!.positions).toEqual(truss);
    expect(settled.some(p=>p.id==='highSpan.supports')).toBe(true);expect(settled.every(p=>p.settledFoot<=-20.25&&p.extension>0)).toBe(true);expect(deck.positions).toEqual(before);expect(bounds(find(cuts,'highSpan.supports')!).min[1]).toBe(-20.25);
    for(const id of ['offshore.needle','offshore.stacks.1','offshore.wreck.reef'])expect(bounds(find(cuts,id)!).min[1]).toBe(-20.25);
    expect(bounds(find(cuts,'bightBridge.abutments')!).min[1]).toBe(-20.25);
  },120000);
  it('grounds closed bed undersides and preserves lower routes, water, and tunnel exclusions',()=>{
    for(const constraint of ['dry','lowerRoute','water','mouth','span'] as const){
      const upper=bed('upper','road',[[-5,10,0],[5,10,0]]),deck=solid('upper.bed','bed','stone','deck',['upper']);slab(deck,upper.points[0]!,upper.points[1]!,8,.6);
      const cuts:LandCuts={beds:[upper],pads:[],mouths:[],waters:[],solids:[deck],diagnostics:[]};
      if(constraint==='lowerRoute')cuts.beds.push(bed('lower','walk',[[0,5,-10],[0,5,10]]));
      if(constraint==='water')cuts.waters.push({id:'river',kind:'river',points:[[0,4,-10],[0,4,10]],outline:[],level:4,width:3,depth:2,bank:2});
      if(constraint==='mouth')cuts.mouths.push({id:'adit',kind:'portal',floor:3,ceiling:8,outline:[[-2,-2],[-2,2],[2,2],[2,-2]]});
      if(constraint==='span')upper.terrainExclusions=[{at:[0,0],radius:3}];
      const before=[...deck.positions],result=groundTerrainBeds(cuts,()=>0);
      if(constraint==='dry'){expect(result.filled).toHaveLength(1);expect(bounds(deck).min[1]).toBe(-.1);expect(deck.positions.slice(12)).toEqual(before.slice(12));}
      else {expect(result.filled).toHaveLength(0);expect(deck.positions).toEqual(before);expect(result.residual.length+result.protectedSpans.length).toBe(1);}
    }
  });
});
