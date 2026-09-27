import { describe, expect, it } from 'vitest';
import { buildLandCuts } from '../src/harbour/horizon/land/beds/build';
import { baseHeight } from '../src/harbour/horizon/land/terrain';
import { bounds, box, distance, nearestOnPath, slab, solid } from '../src/harbour/horizon/land/structures/mesh';
import { floorAt } from '../src/harbour/horizon/world/views';
import { solidVerticalRangeAt } from '../src/harbour/horizon/world/geometry';
import { bightFrame, bightReport, bightSpec, buildStair, GALLERY_MARGIN, ROPE_END, SPANS } from '../src/harbour/horizon/land/structures/build';
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
  it('follows each road tunnel floor on its road and measures the Prow Tunnel rock cover',()=>{
    const cuts=cutsOnce();
    for(const [id,route] of [['prowTunnel','V01'],['shoulderTunnel','V02']] as const){
      const tube=cuts.beds.find(b=>b.id===id)!,road=cuts.beds.find(b=>b.id===route)!;
      expect(Math.max(...tube.points.map(p=>p[1]))-Math.min(...tube.points.map(p=>p[1]))).toBeGreaterThan(5);
      for(const p of tube.points)expect(Math.abs(nearestOnPath([p[0],p[2]],road.points).at[1]-p[1])).toBeLessThan(.05);
      expect(cuts.mouths.filter(m=>m.id.startsWith(`${id}.portal.`))).toHaveLength(2);
    }
    // v2.0 (D-A4): the Prow is a gallery at [1592,890]; its cover is reported as information (a gallery needs none, no fill).
    expect(cuts.diagnostics.find(d=>d.id==='structures.prowTunnel.cover')?.severity).toBe('info');
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
      const before=[...deck.positions];
      // W5-A (A1.1): a located residual deeper than RESIDUAL_LIMIT on no allowance list fails the bake; the deck is never filled.
      if(constraint==='lowerRoute'||constraint==='water'||constraint==='mouth'){expect(()=>groundTerrainBeds(cuts,()=>0)).toThrow(/A1\.1.*upper 9\.50 eu/);expect(deck.positions).toEqual(before);expect(cuts.diagnostics.filter(d=>d.id.startsWith('structures.terrainBedFill.residual'))).toHaveLength(1);continue;}
      const result=groundTerrainBeds(cuts,()=>0);
      if(constraint==='dry'){expect(result.filled).toHaveLength(1);expect(bounds(deck).min[1]).toBe(-.1);expect(deck.positions.slice(12)).toEqual(before.slice(12));}
      else {expect(result.filled).toHaveLength(0);expect(deck.positions).toEqual(before);expect(result.residual.length+result.protectedSpans.length).toBe(1);}
    }
  });
});

// v1.9 (Stage A, W3-A) named structures.
describe('Horizon v1.9 structures (W3-A)',()=>{
  it('builds the named footbridges with every bent outside the lower corridors and the ramps and stairs they replace',()=>{
    const cuts=buildLandCuts(baseHeight);
    for(const id of ['gardenWalkBridge','crownWalkBridge','seaStairWestLaneBridge','seaStairEastLaneBridge']){
      expect(cuts.solids.find(s=>s.id===`${id}.deck`),id).toBeDefined();expect(cuts.solids.find(s=>s.id===`${id}.supports`)?.indices.length,id).toBeGreaterThan(0);
      expect(cuts.diagnostics.filter(d=>d.id===`structures.${id}.bentInLane`||d.id===`structures.${id}.bay`),id).toEqual([]);
    }
    // The zip landing ramp is a trestle (no earth dune over the beach); the Bight pier stair reaches a jetty at the ferry stop.
    const ramp=cuts.beds.find(b=>b.id==='zipLanding.ramp')!;expect(ramp.terrainCut).toBe(false);expect(cuts.solids.find(s=>s.id==='zipLanding.ramp.supports')!.indices.length).toBeGreaterThan(0);
    const pier=cuts.beds.find(b=>b.id==='bightPierStair')!;expect(pier.points.at(-1)![1]).toBeLessThanOrEqual(1.21);expect(cuts.beds.some(b=>b.id==='jetty.bightPier')).toBe(true);
    // The dam gallery is a stairwell south of the wall: every flight between z 909 and 926 (never in Stillwater).
    for(let f=0;f<3;f++){const b=cuts.beds.find(b=>b.id===`damGallery.flight.${f}`)!;for(const p of b.points)expect(p[2]).toBeGreaterThanOrEqual(909);for(const p of b.points)expect(p[2]).toBeLessThanOrEqual(926);}
    expect(cuts.diagnostics.filter(d=>/^structures\.damGallery\.flight\.\d\.clearSpan$/.test(d.id))).toEqual([]);
    // The Reach footbridge clears the river by the 4 m canoe clearance.
    expect(cuts.solids.some(s=>s.id==='reachFootbridge.deck')).toBe(true);
  },120000);
});

// v2.0 (Wave 5, Jonathan's rulings 2026-09-27): the structures follow MANIFEST v2.0.
describe('Horizon v2.0 structures (W5-S)',()=>{
  const F=bightFrame(),B=bightSpec(),so=(x:number,z:number)=>F.so([x,z]);
  it('builds the Bight Bridge per D-A1: 245 eu deck at 12, 8 + 9 timber bents, two arch piers, a 36 eu steel through-arch',()=>{
    const cuts=cutsOnce(),deck=find(cuts,'bightBridge.deck')!,ss=prisms(deck).flatMap(p=>p.corners.map(c=>so(c[0],c[2])));
    expect(B.span).toBe(245);expect(Math.max(...ss.map(q=>q.s))-Math.min(...ss.map(q=>q.s))).toBeCloseTo(245,1);
    expect(Math.min(...ss.map(q=>q.o))).toBeCloseTo(-9,2);expect(Math.max(...ss.map(q=>q.o))).toBeCloseTo(12.6,2);
    expect(bounds(deck).max[1]).toBe(12);expect(bounds(deck).min[1]).toBeCloseTo(11.4,5);
    const r=bightReport!;expect(r.bents.filter(b=>b.side==='west'&&b.built)).toHaveLength(8);expect(r.bents.filter(b=>b.side==='east'&&b.built)).toHaveLength(9);expect(r.bents.filter(b=>b.side==='arch')).toHaveLength(2);
    // No bent in the opening: every timber column and every arch-pier face stays outside s 99–133 (34 eu clear).
    for(const p of prisms(find(cuts,'bightBridge.supports')!)){const q=so(p.x,p.z);expect(q.s<98||q.s>134,`bent at s ${q.s.toFixed(1)}`).toBe(true);}
    const pierS=prisms(find(cuts,'bightBridge.archPiers')!).filter(p=>p.top>11).flatMap(p=>p.corners.map(c=>so(c[0],c[2]).s));expect(Math.min(...pierS.filter(v=>v>116))-Math.max(...pierS.filter(v=>v<116))).toBeGreaterThanOrEqual(34-1e-6);
    // Every timber bay ≤ 12 eu (timber limit): 10.9 west, 11.0 east.
    const all=r.bents.map(b=>b.s).sort((a,b)=>a-b),bays=all.slice(1).map((v,i)=>v-all[i]!).filter(v=>v<30);expect(Math.max(...bays)).toBeLessThanOrEqual(12);
    // The arch: rise 15 over the deck (crown 27 ≥ 22), its ribs bear on the arch piers; hangers every 4.5 eu.
    const arch=bounds(find(cuts,'bightBridge.arch')!);expect(arch.max[1]).toBeCloseTo(27,1);expect(r.arch).toHaveLength(14);
    // Footings: every lowest bent and arch-pier prism sinks below the ground it stands on.
    for(const id of ['bightBridge.supports','bightBridge.archPiers'])for(const p of lowest(find(cuts,id)!))expect(p.bottom,id).toBeLessThanOrEqual(baseHeight(p.x,p.z)-FOOTING_SINK+1e-6);
  },120000);
  it('carries the crown lookout as a deck bay and S2 over the road on the flyover at 17.6 with 5.0 clear',()=>{
    const cuts=cutsOnce(),look=find(cuts,'bightBridge.lookout')!,q=prisms(look).flatMap(p=>p.corners.map(c=>so(c[0],c[2])));
    expect(Math.min(...q.map(v=>v.s))).toBeCloseTo(104,1);expect(Math.max(...q.map(v=>v.s))).toBeCloseTo(128,1);expect(Math.max(...q.map(v=>v.o))).toBeCloseTo(B.lookout.outer,5);expect(B.lookout.outer-B.lookout.inner).toBeCloseTo(7.2,5);expect(look.walkable).toBe(true);
    expect(cuts.pads.some(p=>{const v=so(p.centre[0],p.centre[2]);return v.s>0&&v.s<244&&v.o>-9&&v.o<16&&Math.abs(p.centre[1]-12)<3;})).toBe(false);
    const fly=bounds(find(cuts,'bightBridge.s2Flyover.deck')!);expect(fly.max[1]).toBeCloseTo(17.6,5);expect(fly.min[1]-12).toBeCloseTo(5,5);
    expect(cuts.diagnostics.find(d=>d.id==='structures.bightBridge.s2Flyover.clear')?.severity).toBe('info');
    expect(find(cuts,'bightBridge.s2Flyover.deck')!.bedIds).toEqual(['S2']);
    // Ramps: 12 → 17.6 at 8 % on the lagoon lane (s 30 → 100), back down on the sea lane (s 132 → 202).
    const prof=bightReport!.deckProfile.find(p=>p.lane==='S2 lagoon ramp')!;expect(prof.points[0]![0]).toBeCloseTo(30,0);expect(prof.points.at(-1)![1]).toBeCloseTo(17.6,5);
  },120000);
  it('rails every Bight Bridge deck edge on posts ≤ 2 eu apart and proves the ferry hull honestly',()=>{
    const cuts=cutsOnce(),posts=prisms(find(cuts,'bightBridge.rails')!).filter(p=>p.top-p.bottom>1).map(p=>so(p.x,p.z));
    for(const [o,from,to] of [[-8.95,0,244],[12.55,0,103],[12.55,129,244],[15.95,104,128]] as const){const line=posts.filter(p=>Math.abs(p.o-o)<.2&&p.s>=from-1&&p.s<=to+1).map(p=>p.s).sort((a,b)=>a-b);
      expect(line.length,`rail at o ${o}`).toBeGreaterThan((to-from)/2);expect(Math.max(...line.slice(1).map((v,i)=>v-line[i]!)),`rail at o ${o}`).toBeLessThanOrEqual(2.01);}
    for(const id of ['bightBridge.s2Flyover.rails','bightBridge.s2Ramp.lagoon.rails','bightBridge.s2Ramp.sea.rails'])expect(prisms(find(cuts,id)!).filter(p=>p.top-p.bottom>1).length,id).toBeGreaterThan(30);
    // The opening is s 98–134 per MANIFEST; the FERRY line crosses the deck edges at s ≈ 113–131 and its 8 m hull passes
    // the east arch pier's sea-side corner short: red stays red until the opening is re-centred (W5S request to the design lead).
    const ferry=cuts.diagnostics.find(d=>d.id==='structures.bightBridge.ferryHull')!;expect(ferry.measured).toBeCloseTo(bightReport!.ferryClearance,5);expect(ferry.severity).toBe(ferry.measured!<0?'conflict':'info');
  },120000);
  it('builds the Prow as a gallery (D-A4): hill wall east, colonnade west on footings, headroom ≥ 5 over every route under it',()=>{
    const cuts=cutsOnce(),walls=prisms(find(cuts,'prowTunnel.walls')!),tube=cuts.beds.find(b=>b.id==='prowTunnel')!;
    const side=(p:{x:number;z:number})=>{const h=nearestOnPath([p.x,p.z],tube.points),a=tube.points[h.segment]!,b=tube.points[Math.min(h.segment+1,tube.points.length-1)]!;return Math.sign((b[0]-a[0])*(p.z-a[2])-(b[2]-a[2])*(p.x-a[0]));};
    expect(new Set(walls.map(side)).size).toBe(1);
    const cols=lowest(find(cuts,'prowTunnel.colonnade')!);expect(cols.length).toBeGreaterThanOrEqual(15);for(const c of cols)expect(c.bottom).toBeLessThanOrEqual(baseHeight(c.x,c.z)-FOOTING_SINK+1e-6);
    expect(cols.every(c=>side(c)!==side(walls[0]!))).toBe(true);expect(cols.every(c=>c.x<Math.max(...walls.map(w=>w.x)))).toBe(true);
    const head=cuts.diagnostics.find(d=>d.id==='structures.prowTunnel.headroom')!;expect(head.severity).toBe('info');expect(head.measured!).toBeGreaterThanOrEqual(5);
    expect(distance([tube.points[0]![0],tube.points[0]![2]],[tube.points.at(-1)![0],tube.points.at(-1)![2]])).toBeGreaterThan(80);
    expect(GALLERY_MARGIN).toBeGreaterThan(0);
  },120000);
  it('builds the v2.0 named kinds: the S1 flyover, the VBS trestle, the cove cliff stair, the open gallery parapet (D-C2)',()=>{
    const cuts=cutsOnce();
    for(const id of ['s1Flyover','bightSpurTrestle']){expect(find(cuts,`${id}.deck`),id).toBeDefined();expect(find(cuts,`${id}.supports`)?.indices.length,id).toBeGreaterThan(0);
      expect(cuts.diagnostics.filter(d=>d.id===`structures.${id}.bay`),id).toEqual([]);
      for(const p of lowest(find(cuts,`${id}.supports`)!))expect(p.bottom,id).toBeLessThanOrEqual(baseHeight(p.x,p.z)-FOOTING_SINK+1e-6);}
    const s1=cuts.diagnostics.find(d=>d.id==='structures.s1Flyover.clear')!;expect(s1.measured!).toBeCloseTo(11.5,1);expect(s1.message).toMatch(/9 bents, 0 refused/);
    // The one VBS bent over the Year Walk's lane is refused (reported); steel girders carry that bay (≤ 24 eu).
    const girder=cuts.diagnostics.find(d=>d.id==='structures.bightSpurTrestle.girderSpan');expect(girder?.measured??0).toBeLessThanOrEqual(24);
    expect(cuts.diagnostics.filter(d=>/^structures\.coveStair\./.test(d.id)&&d.severity==='conflict')).toEqual([]);
    // The VBS trestle's bents stay out of S4's corridor (S4 runs beside it on the east).
    const s4=cuts.beds.find(b=>b.id==='S4')!;for(const p of lowest(find(cuts,'bightSpurTrestle.supports')!))expect(nearestOnPath([p.x,p.z],s4.points).distance).toBeGreaterThan(s4.width/2+1);
    const f0=cuts.beds.find(b=>b.id==='coveStair.flight.0')!,f1=cuts.beds.find(b=>b.id==='coveStair.flight.1')!;
    const dock=cuts.beds.find(b=>b.id==='ferry.scholarsCove')!.points[0]![1];expect(f0.points[0]![1]).toBeCloseTo(34.1,5);expect(f1.points.at(-1)![1]).toBeCloseTo(dock,5);expect(f0.points.at(-1)![1]).toBeCloseTo((34.1+dock)/2,5);expect(bounds(find(cuts,'coveStair.landing.slab')!).max[1]).toBeCloseTo((34.1+dock)/2,5);
    // D-C2: no solid stairwell wall stands along the gallery's south side (z 925.6) any more.
    expect(prisms(find(cuts,'damGallery.walls')!).some(p=>Math.abs(p.z-925.6)<.5)).toBe(false);
    expect(prisms(find(cuts,'damGallery.landing.1.rails')!).some(p=>p.top-p.bottom>1&&p.z>925)).toBe(true);
  },120000);
  it('leaves a gap in a landing rail where a stair leaves it (the crown launch closed its own stair, Wave 4)',()=>{
    const cuts=cutsOnce(),stair=cuts.beds.find(b=>b.id==='crownLaunch.stair')!,head=stair.points[0]!;
    expect(prisms(find(cuts,'crownLaunch.rails')!).some(p=>Math.hypot(p.x-head[0],p.z-head[2])<1.2)).toBe(false);
    expect(prisms(find(cuts,'crownLaunch.rails')!).length).toBeGreaterThan(20);
  },120000);
});
describe('Horizon Wave 7 structures (W7-S)',()=>{
  it('ends every cable rope inside its station head frame, standing on the station deck (no rope ends in mid-air)',()=>{
    const cuts=cutsOnce(),g=M.cable.G1,z=M.cable.ZIP;
    const ends:[string,readonly number[],number,string][]=[['gondolaBase',g.from,g.fromH,'G1'],['gondolaTop',g.to,g.toH,'G1'],['prowPlatform',z.from,z.fromH,'ZIP'],['zipLanding',z.to,z.toH,'ZIP']];
    for(const [id,xy,h,cable] of ends){
      const frame=find(cuts,`platform.${id}.headFrame`)!;expect(frame,id).toBeDefined();expect(frame.role).toBe('support');
      // The rope's own solid ends at the station point, ROPE_END over the deck: that end lies inside the frame's bullwheel.
      const rope=prisms(find(cuts,`${cable}.cable`)!),end=rope.reduce((a,b)=>Math.hypot(a.x-xy[0]!,a.z-xy[1]!)<Math.hypot(b.x-xy[0]!,b.z-xy[1]!)?a:b);
      expect(end.top,id).toBeCloseTo(h+ROPE_END,5);
      const r=solidVerticalRangeAt(frame,xy[0]!,xy[1]!)!;expect(r,id).not.toBeNull();expect(r.bottom,id).toBeLessThanOrEqual(h+ROPE_END-.09);expect(r.top,id).toBeGreaterThanOrEqual(h+ROPE_END);
      // Its legs stand on the station deck (h): nothing of the frame is below the deck, and the station point is clear below h + 2.3.
      const parts=prisms(frame);expect(Math.min(...parts.map(p=>p.bottom)),id).toBeCloseTo(h,5);
      expect(parts.filter(p=>Math.hypot(p.x-xy[0]!,p.z-xy[1]!)<1.9&&p.bottom<h+2.29),id).toEqual([]);
    }
  },120000);
});
