import * as THREE from 'three';
import {CardBuilder, paperGrain, rgb, type CardBuild, type RGB} from '../../art/cardScene.ts';
import type {District, WorldDefinition} from '../world/definition.ts';
import type {LandCuts, StructureSolid, TerrainField, WaterCut, XYZ} from '../land/interfaces.ts';
import {BIOME_GROUNDS, ROCK_SETS, rockWeight, TERRAIN_SURFACE_PALETTE, terrainPaintGround, terrainPaintRockSet, terrainTriangleVisible} from '../land/terrain/index.ts';
import {districtAt} from '../world/districts.ts';
/** Wave 6: the cable lines (their spans hang between anchors in other districts). */
export const CABLE_LINE=/^(G1|ZIP)\.cable$/;

/** Preserve outward winding, especially the visible undersides. cardKit.tri is top-facing. */
export function solidTriangle(builder:CardBuilder,a:XYZ,b:XYZ,c:XYZ,color:RGB,bucket:'card'|'pad'='card'){
  const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
  const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,n=Math.hypot(nx,ny,nz);if(n<1e-8)return;
  const data=builder.at((a[0]+b[0]+c[0])/3,(a[2]+b[2]+c[2])/3).data[bucket];
  const shade=ny/n<-.2?.65:Math.abs(ny/n)<.45?.82:1;
  for(const p of [a,b,c]){data.positions.push(...p);data.normals.push(nx/n,ny/n,nz/n);data.colors.push(color[0]*shade,color[1]*shade,color[2]*shade);data.uvs.push(p[0]*.03,p[2]*.03);}
}
const surfaceColor=(surface:string,role:string):RGB=>rgb(role==='marker'?'#e6b95b':surface.includes('water')?'#527f83':surface.includes('metal')?'#777e7f':surface.includes('wood')||surface.includes('board')?'#b59c79':role==='roof'?'#aaa398':role==='rock'?'#a3998a':'#c9c2b4');
export function addSolid(builder:CardBuilder,solid:StructureSolid,tier:'full'|'lite'='full'){
  const color=surfaceColor(solid.surface,solid.role),p=tier==='lite'?(solid.litePositions??solid.positions):solid.positions,indices=tier==='lite'?(solid.liteIndices??solid.indices):solid.indices;
  for(let i=0;i<indices.length;i+=3){const v=(n:number):XYZ=>{const j=indices[i+n]!*3;return[p[j]!,p[j+1]!,p[j+2]!];};solidTriangle(builder,v(0),v(1),v(2),color);}
}
/** Terrain cells per mesh tile: frustum culling still works across a district. */
const TERRAIN_TILE=32;
/**
 * The terrain as its own smooth-shaded, shadow-casting mesh (STYLE §1.2.2, §1.7, §3.3):
 * - ground colour per VERTEX, interpolated (biome grounds blend over ~2 cells; bed paint stays crisp);
 * - rock weight per vertex from the steepest incident triangle (soft 35–45°), so every face
 *   over the walkable limit carries its strata set and walkable ground is not painted rock;
 * - strata ledges drawn per pixel from world height (a continuous phase following contours);
 * - smooth normals on turf, the face normal only where the ground is rock; no value step.
 */
export function buildTerrainMeshes(field:TerrainField,cuts:Pick<LandCuts,'mouths'>,districtId:string,casts:boolean,paper:THREE.Texture|null){
  const C=field.columns,R=field.rows,st=field.step,H=field.heights,palette=TERRAIN_SURFACE_PALETTE.map(p=>rgb(p.color));
  const cells=new Uint8Array((C-1)*(R-1));let any=false;
  for(let r=0;r<R-1;r++)for(let c=0;c<C-1;c++)if(districtAt((c+.5)*st,(r+.5)*st)===districtId){cells[r*(C-1)+c]=1;any=true;}
  if(!any)return null;
  const deg=(dx:number,dz:number)=>Math.atan(Math.hypot(dx,dz))*180/Math.PI;
  // Per-vertex rock weight: the steepest triangle touching the vertex (both triangles of each of its four quads).
  const rock=new Float32Array(C*R);
  for(let r=0;r<R-1;r++)for(let c=0;c<C-1;c++){
    const i=r*C+c,nw=H[i]!,ne=H[i+1]!,sw=H[i+C]!,se=H[i+C+1]!;
    const a=rockWeight(deg((ne-nw)/st,(sw-nw)/st)),b=rockWeight(deg((se-sw)/st,(se-ne)/st));
    rock[i]=Math.max(rock[i]!,a);rock[i+1]=Math.max(rock[i+1]!,a,b);rock[i+C]=Math.max(rock[i+C]!,a,b);rock[i+C+1]=Math.max(rock[i+C+1]!,b);
  }
  const biome=new Set(BIOME_GROUNDS),ground=(n:number)=>terrainPaintGround(field.surfaces[n]!);
  const colourAt=(c:number,r:number):RGB=>{
    const n=r*C+c,g=ground(n);if(!biome.has(g))return palette[g]??palette[1]!;
    // Soft biome edges from the landform polygons: a small tent filter over biome neighbours only.
    let wsum=0,acc:[number,number,number]=[0,0,0];
    for(let dr=-2;dr<=2;dr++)for(let dc=-2;dc<=2;dc++){const cc=c+dc,rr=r+dr;if(cc<0||rr<0||cc>=C||rr>=R)continue;const k=ground(rr*C+cc);if(!biome.has(k))continue;
      const w=(3-Math.abs(dc))*(3-Math.abs(dr)),col=palette[k]!;acc[0]+=col[0]*w;acc[1]+=col[1]*w;acc[2]+=col[2]*w;wsum+=w;}
    return [acc[0]/wsum,acc[1]/wsum,acc[2]/wsum];
  };
  const normalAt=(c:number,r:number):XYZ=>{const l=H[r*C+Math.max(0,c-1)]!,rt=H[r*C+Math.min(C-1,c+1)]!,u=H[Math.max(0,r-1)*C+c]!,d=H[Math.min(R-1,r+1)*C+c]!;
    const dx=(rt-l)/(st*(Math.min(C-1,c+1)-Math.max(0,c-1))),dz=(d-u)/(st*(Math.min(R-1,r+1)-Math.max(0,r-1))),n=Math.hypot(dx,1,dz);return[-dx/n,1/n,-dz/n];};
  const sets=ROCK_SETS.map(set=>({base:palette[TERRAIN_SURFACE_PALETTE.findIndex(p=>p.id===set.base)]!,ledge:palette[TERRAIN_SURFACE_PALETTE.findIndex(p=>p.id===set.ledge)]!,spacing:set.spacing}));
  const material=terrainMaterial(paper),meshes:THREE.Mesh[]=[],geometries:THREE.BufferGeometry[]=[];
  for(let tr=0;tr<R-1;tr+=TERRAIN_TILE)for(let tc=0;tc<C-1;tc+=TERRAIN_TILE){
    const pos:number[]=[],nor:number[]=[],col:number[]=[],uv:number[]=[],rb:number[]=[],rl:number[]=[],ri:number[]=[];
    const vertex=(c:number,r:number,face:XYZ)=>{
      const n=r*C+c,w=rock[n]!,sm=normalAt(c,r),set=sets[terrainPaintRockSet(field.surfaces[n]!)]!,g=colourAt(c,r);
      const nx=sm[0]+(face[0]-sm[0])*w,ny=sm[1]+(face[1]-sm[1])*w,nz=sm[2]+(face[2]-sm[2])*w,nl=Math.hypot(nx,ny,nz)||1;
      pos.push(c*st,H[n]!,r*st);nor.push(nx/nl,ny/nl,nz/nl);col.push(g[0],g[1],g[2]);uv.push(c*st*.03,r*st*.03);
      rb.push(set.base[0],set.base[1],set.base[2]);rl.push(set.ledge[0],set.ledge[1],set.ledge[2]);ri.push(w,set.spacing);
    };
    const tri=(a:[number,number],b:[number,number],d:[number,number])=>{
      const pa:XYZ=[a[0]*st,H[a[1]*C+a[0]]!,a[1]*st],pb:XYZ=[b[0]*st,H[b[1]*C+b[0]]!,b[1]*st],pd:XYZ=[d[0]*st,H[d[1]*C+d[0]]!,d[1]*st];
      const ux=pb[0]-pa[0],uy=pb[1]-pa[1],uz=pb[2]-pa[2],vx=pd[0]-pa[0],vy=pd[1]-pa[1],vz=pd[2]-pa[2];
      let fx=uy*vz-uz*vy,fy=uz*vx-ux*vz,fz=ux*vy-uy*vx;const fl=Math.hypot(fx,fy,fz)||1;if(fy<0){fx=-fx;fy=-fy;fz=-fz;}
      const face:XYZ=[fx/fl,fy/fl,fz/fl];vertex(a[0],a[1],face);vertex(b[0],b[1],face);vertex(d[0],d[1],face);
    };
    for(let r=tr;r<Math.min(R-1,tr+TERRAIN_TILE);r++)for(let c=tc;c<Math.min(C-1,tc+TERRAIN_TILE);c++){
      if(!cells[r*(C-1)+c])continue;const x=c*st,z=r*st;
      // Same split and mouth masks as sampleTerrain() and the collision (render = collision).
      if(terrainTriangleVisible(x+st/3,z+st/3,cuts))tri([c,r],[c,r+1],[c+1,r]);
      if(terrainTriangleVisible(x+st*2/3,z+st*2/3,cuts))tri([c+1,r],[c,r+1],[c+1,r+1]);
    }
    if(!pos.length)continue;
    const g=new THREE.BufferGeometry();geometries.push(g);
    g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    g.setAttribute('rockBase',new THREE.Float32BufferAttribute(rb,3));g.setAttribute('rockLedge',new THREE.Float32BufferAttribute(rl,3));g.setAttribute('rockInfo',new THREE.Float32BufferAttribute(ri,2));
    g.computeBoundingSphere();
    const mesh=new THREE.Mesh(g,material);mesh.name=`horizon.terrain.${districtId}.${tr}.${tc}`;mesh.castShadow=casts;mesh.receiveShadow=true;meshes.push(mesh);
  }
  return {meshes,material,dispose(){for(const g of geometries)g.dispose();material.dispose();}};
}
/** Standard lit card material plus per-pixel strata: ledges every `spacing` eu of world height. */
export function terrainMaterial(paper:THREE.Texture|null){
  const m=new THREE.MeshStandardMaterial({vertexColors:true,map:paper,roughness:.92,side:THREE.DoubleSide});
  m.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 rockBase;attribute vec3 rockLedge;attribute vec2 rockInfo;varying vec3 vRockBase;varying vec3 vRockLedge;varying vec2 vRockInfo;varying float vWorldY;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvRockBase=rockBase;vRockLedge=rockLedge;vRockInfo=rockInfo;vWorldY=(modelMatrix*vec4(position,1.0)).y;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vRockBase;varying vec3 vRockLedge;varying vec2 vRockInfo;varying float vWorldY;')
      .replace('#include <color_fragment>',`#include <color_fragment>
      float strataPhase=fract(vWorldY/max(vRockInfo.y,.5));
      vec3 strata=mix(vRockBase,vRockLedge,step(strataPhase,.34))*mix(.8,1.,smoothstep(0.,.06,strataPhase));
      diffuseColor.rgb=mix(diffuseColor.rgb,strata,clamp(vRockInfo.x,0.,1.));`);
  };
  m.customProgramCacheKey=()=>'horizon-terrain-strata-1';
  return m;
}
export function buildDistrictCards(world:WorldDefinition,field:TerrainField,cuts:LandCuts,district:District,tier:'full'|'lite',coarse=false,hideBuildings=false):CardBuild{
  const builder=new CardBuilder(`horizon.${coarse?'journey':'district'}.${district.id}`,tier,{ink:'#5b5447',cell:coarse?4096:256,shadows:!coarse});
  // Wave 6: cable lines are drawn by the cable layer (runtime/cableLayer.ts), span by span with their anchors, never by a district.
  if(!coarse){const ids=new Set(district.solidIds??[]);for(const solid of world.geometry?.solids??[])if(ids.has(solid.id)&&!CABLE_LINE.test(solid.sourceId??solid.id)&&!(hideBuildings&&(solid.sourceId??solid.id).startsWith('host.')))addSolid(builder,solid,tier);}
  const result=builder.finish();
  // The terrain casts into the one shadow map (Journey's coarse lattice only receives).
  const terrain=district.childOf?null:buildTerrainMeshes(field,cuts,district.id,!coarse,paperGrain());
  if(!terrain)return result;
  for(const mesh of terrain.meshes)result.group.add(mesh);
  const dispose=result.dispose;
  return {...result,materials:{...result.materials,terrain:terrain.material},dispose(){dispose();terrain.dispose();}};
}
function waterTriangle(b:CardBuilder,a:XYZ,c:XYZ,d:XYZ,color:RGB){b.water(a,c,d,[a[0]*.02,0],[c[0]*.02,1],[d[0]*.02,.5],color);}
function addWater(builder:CardBuilder,w:WaterCut){
  if(w.kind==='dry')return;const color=rgb(w.kind==='deep'?'#1d2f2e':w.kind==='sea'?'#4b777d':'#608b87');
  if(w.points.length>1){for(let i=1;i<w.points.length;i++){
    const a=w.points[i-1]!,b=w.points[i]!,dx=b[0]-a[0],dz=b[2]-a[2],n=Math.hypot(dx,dz)||1,ox=-dz/n*w.width/2,oz=dx/n*w.width/2;
    const p:XYZ=[a[0]+ox,a[1],a[2]+oz],q:XYZ=[a[0]-ox,a[1],a[2]-oz],r:XYZ=[b[0]-ox,b[1],b[2]-oz],s:XYZ=[b[0]+ox,b[1],b[2]+oz];
    waterTriangle(builder,p,q,r,color);waterTriangle(builder,p,r,s,color);
  }
  // Round joins on the outside of each bend: the ribbon covers exactly the wet region
  // that waterInfluence (and so walking) treats as water.
  for(let i=1;i<w.points.length-1;i++){
    const o=w.points[i]!,a=w.points[i-1]!,b=w.points[i+1]!,h=w.width/2;
    const a0=Math.atan2(o[2]-a[2],o[0]-a[0]),a1=Math.atan2(b[2]-o[2],b[0]-o[0]);let turn=a1-a0;
    while(turn>Math.PI)turn-=2*Math.PI;while(turn<-Math.PI)turn+=2*Math.PI;
    if(Math.abs(turn)<.02)continue;
    // The outer side is opposite the turn; sweep its offset from the incoming to the outgoing normal.
    const side=turn>0?-1:1,start=a0+side*Math.PI/2,steps=Math.max(1,Math.ceil(Math.abs(turn)/(Math.PI/12)));
    for(let k=0;k<steps;k++){
      const t0=start+turn*k/steps,t1=start+turn*(k+1)/steps;
      waterTriangle(builder,o,[o[0]+Math.cos(t0)*h,o[1],o[2]+Math.sin(t0)*h],[o[0]+Math.cos(t1)*h,o[1],o[2]+Math.sin(t1)*h],color);
    }
  }}else if(w.outline.length>=3){
    const contour=w.outline.map(p=>new THREE.Vector2(p[0],p[1]));
    for(const tri of THREE.ShapeUtils.triangulateShape(contour,[])){const p=(i:number):XYZ=>[w.outline[i]![0],w.level,w.outline[i]![1]];waterTriangle(builder,p(tri[0]!),p(tri[1]!),p(tri[2]!),color);}
  }
}
export function buildWaterCards(cuts:LandCuts,tier:'full'|'lite'){
  const b=new CardBuilder('horizon.water',tier,{ink:'#52777b',cell:4096});
  // A sea slab sits underneath the island; inland holes come only from named mouth masks.
  const color=rgb('#527b80');waterTriangle(b,[-800,-.025,-800],[-800,-.025,2600],[2800,-.025,-800],color);waterTriangle(b,[2800,-.025,-800],[-800,-.025,2600],[2800,-.025,2600],color);
  for(const w of cuts.waters)if(w.kind!=='sea')addWater(b,w);
  return b.finish();
}

/** Largest fog share a horizon card takes (STYLE §1.8: fogged, capped at 70 %). */
export const HORIZON_RING_FOG_CAP=.7;
/** Keep the scene fog on a material but cap its share at `cap`. */
export function capFog(material:THREE.Material,cap:number){
  if(!('fog'in material))return;(material as THREE.MeshStandardMaterial).fog=true;
  const previous=material.onBeforeCompile.bind(material);
  material.onBeforeCompile=(shader,renderer)=>{previous(shader,renderer);shader.fragmentShader=shader.fragmentShader.replace('#include <fog_fragment>',`#ifdef USE_FOG
    #ifdef FOG_EXP2
      float fogFactor=1.0-exp(-fogDensity*fogDensity*vFogDepth*vFogDepth);
    #else
      float fogFactor=smoothstep(fogNear,fogFar,vFogDepth);
    #endif
    gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,min(fogFactor,${cap.toFixed(3)}));
  #endif`);};
  const key=material.customProgramCacheKey.bind(material);material.customProgramCacheKey=()=>`${key()}|fogcap${cap}`;
}
export function buildHorizonRing(cards:readonly import('../sky/horizonCards.ts').HorizonCard[],tier:'full'|'lite'){
  const group=new THREE.Group(),materials:Record<string,THREE.Material>={},proxies=cards.map(card=>{
    const b=new CardBuilder(`horizon.sky-ring.${card.id}`,tier,{ink:'#7e8578',cell:4096,shadows:false});
    addSolid(b,{...card,surface:'rock',role:'rock',kind:'horizon-card',districtId:'sky',bedIds:[],walkable:false});
    const result=b.finish();group.add(result.group);
    // The ring takes the same scene fog as the land (sky/fog.ts owns the numbers), capped
    // at 70 % so the far silhouettes stay drawn instead of dissolving (STYLE §1.8).
    for(const [key,material] of Object.entries(result.materials)){materials[`${card.id}.${key}`]=material;capFog(material,HORIZON_RING_FOG_CAP);}
    return{card,result};
  });
  return {group,materials,water:[] as THREE.Mesh[],
    updateResidency(resident:ReadonlySet<string>,journey:boolean){for(const {card,result}of proxies)result.group.visible=!journey&&!card.ownerDistrictIds?.some(id=>resident.has(id));},
    dispose(){for(const {result}of proxies)result.dispose();group.removeFromParent();group.clear();}};
}
