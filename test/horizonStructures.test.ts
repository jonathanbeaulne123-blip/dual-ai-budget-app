import { describe, expect, it } from 'vitest';
import { buildLandCuts } from '../src/harbour/horizon/land/beds/build';
import { baseHeight } from '../src/harbour/horizon/land/terrain';
import { bounds, box, slab, solid } from '../src/harbour/horizon/land/structures/mesh';
import { SPANS } from '../src/harbour/horizon/land/structures/build';
import { settleFoundations } from '../src/harbour/horizon/land/structures/foundations';
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
});
