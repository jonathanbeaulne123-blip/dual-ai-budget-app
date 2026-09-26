import { describe, expect, it } from 'vitest';
import { buildLandCuts } from '../src/harbour/horizon/land/beds/build';
import { baseHeight } from '../src/harbour/horizon/land/terrain';
import { bounds, box, slab, solid } from '../src/harbour/horizon/land/structures/mesh';
import { SPANS } from '../src/harbour/horizon/land/structures/build';
import { settleFoundations } from '../src/harbour/horizon/land/structures/foundations';
import { groundTerrainBeds } from '../src/harbour/horizon/land/structures/groundBeds';
import { bed } from '../src/harbour/horizon/land/beds/profiles';
import type { LandCuts } from '../src/harbour/horizon/land/interfaces';
import { BufferGeometry, Float32BufferAttribute, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';

describe('Horizon structural solids',()=>{
  it('winds slab undersides toward a camera beneath them',()=>{
    for(const shape of ['box','slab']){const s=solid('test','bridge','stone','deck');if(shape==='box')box(s,[0,0],10,[10,10],9.4);else slab(s,[-5,10,0],[5,10,0],10,.6);
      const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(s.positions,3));g.setIndex(s.indices);const mesh=new Mesh(g,new MeshBasicMaterial());mesh.updateMatrixWorld();
      expect(new Raycaster(new Vector3(0,0,0),new Vector3(0,1,0)).intersectObject(mesh).length).toBeGreaterThan(0);
    }
  });
  it('provides every named span with thick decks, load paths and enclosed tunnels',()=>{
    const cuts=buildLandCuts(baseHeight);
    for(const spec of SPANS){const deck=cuts.solids.find(s=>s.id===`${spec.id}.deck`)!;expect(deck).toBeDefined();const b=bounds(deck);expect(b.max[1]-b.min[1]).toBeGreaterThanOrEqual(.599999);expect(cuts.solids.find(s=>s.id===`${spec.id}.supports`)!.indices.length).toBeGreaterThan(0);}
    for(const id of ['prowTunnel','shoulderTunnel','duneCulvert','oreTunnel','seaPassage'])expect(cuts.solids.find(s=>s.id===`${id}.roof`)!.indices.length).toBeGreaterThan(0);
    const deck=bounds(cuts.solids.find(s=>s.id==='highSpan.deck')!);expect(deck.max[1]).toBe(24);expect(deck.min[1]).toBeGreaterThan(23);
    expect(bounds(cuts.solids.find(s=>s.id==='highSpan.shelf.deck')!).max[1]).toBe(12);expect(bounds(cuts.solids.find(s=>s.id==='highSpan.walk.deck')!).max[1]).toBe(9);
  },60000);
  it('extends lowest footings after a lower terrain cut without moving fixed decks',()=>{
    const cuts=buildLandCuts(baseHeight),deck=cuts.solids.find(s=>s.id==='highSpan.deck')!,before=[...deck.positions],settled=settleFoundations(cuts,()=>-20);
    expect(settled.some(p=>p.id==='highSpan.supports')).toBe(true);expect(settled.every(p=>p.settledFoot<=-20.25&&p.extension>0)).toBe(true);expect(deck.positions).toEqual(before);expect(bounds(cuts.solids.find(s=>s.id==='highSpan.supports')!).min[1]).toBe(-20.25);
  });
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
