import {readFileSync} from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildLandCuts } from '../src/harbour/horizon/land/beds/build';
import { baseHeight } from '../src/harbour/horizon/land/terrain';
import { BRIDGE_CAST } from '../src/harbour/horizon/land/bridges/catalog';
import { finalizeBridges } from '../src/harbour/horizon/land/bridges/build';
import { bridgeFrame, bridgeLength } from '../src/harbour/horizon/land/bridges/frames';
import { solidVerticalRangeAt } from '../src/harbour/horizon/world/geometry';
import { bounds } from '../src/harbour/horizon/land/structures/mesh';
import { BRIDGE_GLYPHS } from '../src/journey/land/bridgeGlyph';
import { bridgeDistrictSteps, createBridgeArt } from '../src/harbour/horizon/runtime/bridgeArt';
import { finishBuild } from '../src/house/world/buildTask';
import type { WorldDefinition } from '../src/harbour/horizon/world/definition';
const cuts=buildLandCuts(baseHeight),bridges=finalizeBridges(cuts);

describe('the authored bridge cast',()=>{
 it('bakes ten unique families, names and map silhouettes from their actual carried beds',()=>{
  expect(bridges).toHaveLength(10);expect(new Set(bridges.map(b=>b.family)).size).toBe(10);
  for(const b of bridges){expect(b.name).toBe(BRIDGE_CAST.find(c=>c.id===b.id)!.name);expect(BRIDGE_GLYPHS[b.map.glyph]).toBeTruthy();
   const carried=cuts.beds.find(c=>c.id===`structure.${b.id}`)!;expect(b.path).toEqual(carried.points);expect(b.width).toBe(carried.width);
   expect(b.members.every(m=>cuts.solids.some(s=>s.id===m.id))).toBe(true);expect(b.budget.fullTriangles).toBeGreaterThan(0);
  }
 });
 it('keeps Bight road, S2 flyover and under-deck opening at their authored levels',()=>{
  const deck=cuts.solids.find(s=>s.id==='bightBridge.deck')!,fly=cuts.solids.find(s=>s.id==='bightBridge.s2Flyover.deck')!;
  expect(bounds(deck).max[1]).toBe(12);expect(bounds(deck).min[1]).toBeCloseTo(11.4);expect(bounds(fly).min[1]-12).toBeCloseTo(5);
  const hangers=cuts.solids.find(s=>s.id==='bightBridge.arch')!;expect(bounds(hangers).max[1]).toBeCloseTo(33.5);
  const b=bridges.find(b=>b.id==='bightBridge')!;expect(b.lights.some(l=>l.at[1]>30)).toBe(true);
 });
 it('puts every meeting anchor on a real deck with a named, lit approach',()=>{
  for(const b of bridges){const [x,y,z]=b.meeting.at;
   const hits=cuts.solids.filter(s=>s.walkable).map(s=>solidVerticalRangeAt(s,x,z)).filter(Boolean);
   expect(hits.some(h=>Math.abs(h!.top-y)<.02),b.id).toBe(true);
   expect(b.meeting.status).toBe('built');expect(b.lights.length).toBeGreaterThan(0);
   if(b.id!=='bightBridge')expect(cuts.beds.some(c=>c.id===`structure.${b.id}.meeting`)).toBe(true);
  }
 });
 it('keeps Garden planters out of its original 3.2 metre walking strip',()=>{
  const b=bridges.find(b=>b.id==='gardenWalkBridge')!;expect(b.width).toBe(5.6);
  const planter=cuts.solids.find(s=>s.id==='gardenWalkBridge.planters')!;
  for(let s=8;s<bridgeLength(b.path)-2;s+=2)for(const o of [-1.55,0,1.55]){const p=bridgeFrame(b.path,s,o);expect(solidVerticalRangeAt(planter,p[0],p[2])).toBeNull();}
 });
 it.each(['classic','taylor','newfoundland'] as const)('draws the same collision members with the authored %s kit',theme=>{
  const sample=bridges.find(b=>b.id==='hollowBridge')!,solids=cuts.solids.filter(s=>s.id.startsWith(sample.id+'.'));
  const world={bridges:[sample],geometry:{solids}} as unknown as WorldDefinition;
  const art=finishBuild(bridgeDistrictSteps(world,solids[0]!.districtId,'lite',theme));
  let positions=0;art.group.traverse(o=>{const mesh=o as import('three').Mesh;if(mesh.isMesh)positions+=mesh.geometry.getAttribute('position')?.count??0;});
  expect(positions).toBeGreaterThan(100);art.dispose();
 });
});

// Cooperative rendering must keep scheduling beyond the first resident batch.
describe('bridge residency',()=>{
 it('finishes every resident, invalidates shadows on mount and eviction, and counts line draws',()=>{
  const source=cuts.solids.find(s=>s.id==='bightBridge.deck')!;
  const sample=bridges.find(b=>b.id==='bightBridge')!;
  const world={bridges:[sample],geometry:{solids:[{...source,districtId:'bight'},{...source,id:'bightBridge.copy',districtId:'harbour'}]}} as unknown as WorldDefinition;
  let changes=0;const art=createBridgeArt(world,{tier:'lite',theme:'taylor',changed:()=>changes++});
  const residents=new Set(['bight','harbour']);art.update(residents);
  for(let frame=0;art.building()&&frame<1000;frame++)art.update(residents);
  expect(art.building()).toBe(false);expect(art.stats().map(s=>s.id).sort()).toEqual(['bight','harbour']);expect(changes).toBe(2);
  let draws=0;art.group.traverse(o=>{const m=o as import('three').Mesh;const l=o as import('three').Line;if(m.isMesh||l.isLine)draws++;});
  expect(art.stats().reduce((n,s)=>n+s.calls,0)).toBe(draws);
  art.update(new Set());expect(art.stats()).toEqual([]);expect(art.group.children).toHaveLength(0);expect(changes).toBe(4);art.dispose();
 });
});

// The serialized world, not a second planner fixture, is the acceptance input.
describe('baked bridge envelopes',()=>{
 const baked=JSON.parse(readFileSync('public/horizon/world/horizon-geo-1.json','utf8')) as WorldDefinition;
 it('has supported, unobstructed walking strips and full flat meeting areas for all ten landmarks',()=>{
  expect(baked.bridges).toHaveLength(10);
  for(const b of baked.bridges!){expect(b.passages[0]!.status,b.id).toBe('measured');expect(b.meeting.status,b.id).toBe('built');}
 });
 it('keeps both entire structural flight apertures clear',()=>{
  for(const id of ['bightBridge','highSpan'])expect(baked.bridges!.find(b=>b.id===id)!.passages.find(p=>p.mode==='glider')!.status).toBe('measured');
 });
 it('uses cable and rib bulbs as emissive art without projecting pools onto open water',()=>{
  for(const b of baked.bridges!)for(const bulb of b.lights.filter(l=>l.kind==='necklace'||l.kind==='rib'))expect(baked.lights.some(l=>l.id===bulb.id)).toBe(false);
  // Existing corridor lamps share the kind; this contract covers bridge-definition anchors.
  for(const light of baked.lights.filter(l=>l.kind==='bridgeLantern'&&l.id.startsWith('bridge.'))){const [x,y,z]=light.pool!;
   expect(baked.geometry!.solids.filter(s=>s.walkable).some(s=>{const hit=solidVerticalRangeAt(s,x,z);return hit&&Math.abs(hit.top-y)<.01;}),light.id).toBe(true);
  }
 });
});
