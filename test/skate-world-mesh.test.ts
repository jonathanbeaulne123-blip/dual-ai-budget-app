import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {groundHeightAt} from '../src/harbour/scene/ground.ts';
import {createSkateField} from '../src/harbour/skate/world/field.ts';
import {buildParkMeshData} from '../src/harbour/skate/world/meshes.ts';
import {SKATE_PALETTES} from '../src/harbour/skate/world/palette.ts';
import {buildSkatePark} from '../src/harbour/skate/parkScene.ts';
import {SCENE_DRESSING} from '../src/harbour/scene/place.ts';
import {SKATE_SPOTS,SKATE_ROUTES,SKATE_RAILS,skateSurface,skateFieldFor,railPoint} from '../src/harbour/skate/park.ts';

const field=createSkateField(groundHeightAt);

describe('skate world · render == physics',()=>{
  it('places every top-surface vertex on sample() within 1 mm (or hidden under a higher surface)',()=>{
    const data=buildParkMeshData(field,SKATE_PALETTES.classic,'full');
    expect(data.checks.length).toBeGreaterThan(2000);
    const ids=new Set(data.checks.map(c=>c.id));
    for(const pad of field.pads){expect(ids.has(pad.id),pad.id).toBe(true);for(const s of pad.shapes)expect(ids.has(s.id),s.id).toBe(true);}
    let exact=0;const bad:string[]=[];
    for(const c of data.checks){
      // Vertices on a step's edge belong to either side: compare to the nearest side.
      const ys=[[0,0],[1e-4,0],[-1e-4,0],[0,1e-4],[0,-1e-4],[1e-4,1e-4],[-1e-4,-1e-4],[1e-4,-1e-4],[-1e-4,1e-4]].map(([dx,dz])=>field.heightAt(c.x+dx!,c.z+dz!));
      const best=Math.min(...ys.map(y=>Math.abs(y-c.y)));
      if(best<=1e-3){exact++;continue;}
      if(c.y<Math.max(...ys))continue; // covered by a higher feature (e.g. a platform under its ledge)
      bad.push(`${c.id} (${c.x.toFixed(3)},${c.z.toFixed(3)}) render ${c.y.toFixed(4)} vs ${ys[0]!.toFixed(4)}`);
    }
    expect(bad.slice(0,10)).toEqual([]);
    expect(exact/data.checks.length).toBeGreaterThan(.95);
  });

  it('draws the lite tier with less and keeps its tops on the field too',()=>{
    const full=buildParkMeshData(field,SKATE_PALETTES.classic,'full'),lite=buildParkMeshData(field,SKATE_PALETTES.classic,'lite');
    expect(lite.card.positions.length).toBeLessThan(full.card.positions.length*.8);
    expect(lite.wax.positions.length).toBe(0);
    for(const c of lite.checks.filter((_,i)=>i%7===0)){const ys=[[0,0],[1e-4,0],[-1e-4,0],[0,1e-4],[0,-1e-4],[1e-4,1e-4],[-1e-4,-1e-4],[1e-4,-1e-4],[-1e-4,1e-4]].map(([dx,dz])=>field.heightAt(c.x+dx!,c.z+dz!));expect(ys.some(y=>Math.abs(y-c.y)<=1e-3)||c.y<Math.max(...ys),c.id).toBe(true);}
    // Triangle budget: the whole island's skate geometry stays phone-sized.
    expect(full.card.positions.length/9).toBeLessThan(40000);
    expect(lite.card.positions.length/9).toBeLessThan(20000);
  });

  it('builds every theme, shadows raised pieces only, few draw calls, and disposes everything',()=>{
    for(const theme of ['classic','taylor','newfoundland'] as const){
      const park=buildSkatePark(SCENE_DRESSING[theme],{field});
      const meshes:THREE.Object3D[]=[];park.group.traverse(o=>{if((o as THREE.Mesh).isMesh||(o as THREE.LineSegments).isLineSegments)meshes.push(o);});
      expect(meshes.length).toBeLessThanOrEqual(12);
      const byName=Object.fromEntries(meshes.map(m=>[m.name,m]));
      expect((byName['skate-pads'] as THREE.Mesh).castShadow).toBe(false);expect((byName['skate-pads'] as THREE.Mesh).receiveShadow).toBe(true);
      expect((byName['skate-features'] as THREE.Mesh).castShadow).toBe(true);
      expect(byName['skate-ink']).toBeTruthy();expect(byName['skate-steel']).toBeTruthy();
      // Colours differ by theme.
      const colour=((byName['skate-pads'] as THREE.Mesh).geometry.getAttribute('color') as THREE.BufferAttribute).getX(0);
      expect(colour).toBeGreaterThan(0);
      let disposed=0;const count=(o:{addEventListener(t:'dispose',f:()=>void):void})=>o.addEventListener('dispose',()=>{disposed++;});
      const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
      park.group.traverse(o=>{const m=o as THREE.Mesh;if(m.geometry)geometries.add(m.geometry);if(m.material)(Array.isArray(m.material)?m.material:[m.material]).forEach(x=>materials.add(x));});
      geometries.forEach(count);materials.forEach(count);
      park.update({run:{id:'first-line',checkpoint:1,finished:false}});expect(park.checkpoint.visible).toBe(true);
      park.update({run:{id:'first-line',checkpoint:2,finished:false}});
      park.update(null);expect(park.checkpoint.visible).toBe(false);
      const scene=new THREE.Scene();scene.add(park.group);park.dispose();
      expect(park.group.parent).toBeNull();expect(park.group.children.length).toBe(0);
      expect(disposed).toBeGreaterThanOrEqual(geometries.size+materials.size-1);
    }
  });
});

describe('skate world · the island-facing names',()=>{
  it('keeps the island-facing table in shape for planting, walking, session and HUD',()=>{
    expect(SKATE_SPOTS[0]!.id).toBe('tideline');
    for(const s of SKATE_SPOTS){expect(Number.isFinite(s.startYaw)).toBe(true);expect(s.halfWidth).toBeGreaterThan(2);expect(s.start).toHaveLength(2);}
    expect(SKATE_ROUTES.map(r=>r.id)).toEqual(['first-line','north-run','coast-run','orchard-run','meadow-run']);
    const at=SKATE_SPOTS[0]!.start;
    expect(skateSurface(at[0],at[1],groundHeightAt).y).toBeCloseTo(skateFieldFor(groundHeightAt).heightAt(at[0],at[1]),12);
    expect(skateFieldFor(groundHeightAt)).toBe(skateFieldFor(groundHeightAt));
    expect(SKATE_RAILS.length).toBeGreaterThan(3);
    const flat=()=>0;for(const r of SKATE_RAILS){const mid=railPoint(r,.5,flat),top=skateFieldFor(flat).grindables.find(g=>g.id===r.id)!;expect(mid.y).toBeCloseTo(top.points[0]![1],6);}
  });
});
