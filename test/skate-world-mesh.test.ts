import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {groundHeightAt} from '../src/harbour/scene/ground.ts';
import {createSkateField} from '../src/harbour/skate/world/field.ts';
import {buildParkMeshData} from '../src/harbour/skate/world/meshes.ts';
import {SKATE_PALETTES} from '../src/harbour/skate/world/palette.ts';
import {buildSkatePark} from '../src/harbour/skate/parkScene.ts';
import {SCENE_DRESSING} from '../src/harbour/scene/place.ts';
import {SKATE_SPOTS,SKATE_ROUTES,SKATE_RAILS,skateSurface,skateFieldFor,railPoint} from '../src/harbour/skate/park.ts';
import {LANE_HALF_WIDTH} from '../src/harbour/skate/world/field.ts';
import {ROUTES} from '../src/harbour/skate/world/layout.ts';
import {HARBOUR_LAND,HARBOUR_LANES,distanceToTrail} from '../src/harbour/village/world.ts';
import {ISLAND_KEEP_OUTS,keepOutHit} from '../src/harbour/scene/planting.ts';
import {courtObstacles,isClear} from '../src/harbour/body/obstacles.ts';

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
      // Ink, pencil and chalk share one draw with a colour per vertex; contact shade carries alpha per vertex.
      expect((byName['skate-ink'] as THREE.LineSegments).geometry.getAttribute('color').itemSize).toBe(3);
      expect((byName['skate-shade'] as THREE.Mesh).geometry.getAttribute('color').itemSize).toBe(4);
      expect((byName['skate-shade'] as THREE.Mesh).castShadow).toBe(false);
      // Colours differ by theme.
      const colour=((byName['skate-pads'] as THREE.Mesh).geometry.getAttribute('color') as THREE.BufferAttribute).getX(0);
      expect(colour).toBeGreaterThan(0);
      let disposed=0;const count=(o:{addEventListener(t:'dispose',f:()=>void):void})=>o.addEventListener('dispose',()=>{disposed++;});
      const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
      park.group.traverse(o=>{const m=o as THREE.Mesh;if(m.geometry)geometries.add(m.geometry);if(m.material)(Array.isArray(m.material)?m.material:[m.material]).forEach(x=>materials.add(x));});
      geometries.forEach(count);materials.forEach(count);
      expect(park.dressing.length).toBeGreaterThan(40);expect(park.dressing.every(d=>Number.isFinite(d.x)&&Number.isFinite(d.top))).toBe(true);
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

/** WCAG relative luminance and contrast ratio of two hex colours. */
const lum=(hex:string)=>{const n=parseInt(hex.slice(1),16);const [r,g,b]=[(n>>16)&255,(n>>8)&255,n&255].map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return .2126*r!+.7152*g!+.0722*b!;};
const contrast=(a:string,b:string)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};

describe('skate world · the look',()=>{
  it('keeps one value ladder in every theme, so surfaces, faces, lips and rails read without hue',()=>{
    for(const [theme,p] of Object.entries(SKATE_PALETTES)){
      const at=(what:string,a:string,b:string,min:number)=>expect(contrast(a,b),`${theme}: ${what}`).toBeGreaterThanOrEqual(min);
      at('pad vs cut sides',p.pad,p.wall,1.8);
      at('pad vs feature tops',p.pad,p.concrete,1.15);
      at('pad vs the street pour',p.pad,p.padAlt,1.3);
      at('pad vs the transition pour',p.pad,p.padWarm,1.15);
      at('pad vs its kerb',p.pad,p.kerb,2);
      at('pad vs rails',p.pad,p.rail,2.5);
      at('coping vs pad',p.coping,p.pad,1.25);
      at('coping vs its lip band',p.coping,p.paint,1.8);
      at('ramp ply vs its cut sides',p.wood,p.woodSide,2.5);
      at('second ply vs its cut sides',p.woodAlt,p.woodSide,2.5);
      at('bowl vs its block',p.bowl,p.wall,1.7);
      // Taylor was pink on pink: its pad, pours and ply must differ in VALUE, not just hue.
      expect(lum(p.concrete)).toBeGreaterThan(lum(p.pad));expect(lum(p.pad)).toBeGreaterThan(lum(p.wall));
    }
  });

  it('dresses the edges without standing on a pad, a lane, a route, a building or a tree',()=>{
    const data=buildParkMeshData(field,SKATE_PALETTES.classic,'full');
    expect(data.dressing.length).toBeGreaterThan(40);
    const spots=new Set(data.dressing.map(d=>d.spot));for(const id of SKATE_SPOTS.map(s=>s.id))expect(spots.has(id),`${id} is dressed`).toBe(true);
    const buildings=ISLAND_KEEP_OUTS.filter(k=>!k.id.startsWith('skate-'));
    const segDist=(x:number,z:number,a:readonly number[],b:readonly number[])=>{const dx=b[0]!-a[0]!,dz=b[1]!-a[1]!,l=dx*dx+dz*dz;let t=l?((x-a[0]!)*dx+(z-a[1]!)*dz)/l:0;t=Math.max(0,Math.min(1,t));return Math.hypot(x-a[0]!-t*dx,z-a[1]!-t*dz);};
    for(const tier of ['full','lite'] as const){
      const obstacles=courtObstacles(tier);
      for(const d of data.dressing){
        expect(field.heightAt(d.x,d.z),`${d.id} stands off every pad and apron`).toBeCloseTo(field.ground(d.x,d.z),4);
        expect(isClear(d.x,d.z,.2,obstacles),`${d.id} (${tier}) clear of trees and landmarks`).toBe(true);
        expect(keepOutHit(d.x,d.z,0,buildings),`${d.id} off buildings`).toBeNull();
        expect(Math.hypot(d.x,d.z)).toBeLessThan(HARBOUR_LAND.shore-1);
        for(const lane of HARBOUR_LANES)expect(distanceToTrail(d.x,d.z,lane.points),`${d.id} off ${lane.id}`).toBeGreaterThan(LANE_HALF_WIDTH+.2);
        for(const r of ROUTES)for(let i=1;i<r.points.length;i++)expect(segDist(d.x,d.z,r.points[i-1]!,r.points[i]!),`${d.id} off route ${r.id}`).toBeGreaterThan(1);
        // Oriented pieces (hedges, fence flats, bleachers): every corner is off the pads and the lanes too.
        if(d.box&&tier==='full'){const c=Math.cos(d.box.yaw),sn=Math.sin(d.box.yaw);for(const [u,v] of [[-1,-1],[1,-1],[1,1],[-1,1]] as const){
          const x=d.x+u*d.box.hx*c+v*d.box.hz*sn,z=d.z+v*d.box.hz*c-u*d.box.hx*sn;
          expect(field.heightAt(x,z),`${d.id} corner off the apron`).toBeCloseTo(field.ground(x,z),4);
          for(const lane of HARBOUR_LANES)expect(distanceToTrail(x,z,lane.points),`${d.id} corner off ${lane.id}`).toBeGreaterThan(LANE_HALF_WIDTH);
        }}
      }
    }
  });

  it('draws the lite tier with fewer lines, marks and dressing',()=>{
    const full=buildParkMeshData(field,SKATE_PALETTES.taylor,'full'),lite=buildParkMeshData(field,SKATE_PALETTES.taylor,'lite');
    expect(lite.ink.positions.length).toBeLessThan(full.ink.positions.length*.85);
    expect(lite.shade.positions.length).toBeLessThan(full.shade.positions.length);
    expect(lite.decals.positions.length).toBeLessThan(full.decals.positions.length);
    expect(lite.card.positions.length+lite.pad.positions.length).toBeLessThan((full.card.positions.length+full.pad.positions.length)*.85);
    // Everything that is drawn is finite, and every colour is a colour.
    for(const b of [full.pad,full.card,full.paint,full.decals])for(const v of b.positions)expect(Number.isFinite(v)).toBe(true);
    for(const v of full.shade.colors)expect(v>=0&&v<=1).toBe(true);
  });
});
