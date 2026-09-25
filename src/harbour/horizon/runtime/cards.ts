import * as THREE from 'three';
import {CardBuilder, rgb, type CardBuild, type RGB} from '../../art/cardScene.ts';
import type {District, WorldDefinition} from '../world/definition.ts';
import type {LandCuts, StructureSolid, TerrainField, WaterCut, XYZ} from '../land/interfaces.ts';
import {TERRAIN_SURFACE_PALETTE, terrainTriangleVisible} from '../land/terrain/index.ts';
import {districtAt} from '../world/districts.ts';

/** Preserve outward winding, especially the visible undersides. cardKit.tri is top-facing. */
export function solidTriangle(builder:CardBuilder,a:XYZ,b:XYZ,c:XYZ,color:RGB,bucket:'card'|'pad'='card'){
  const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
  const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,n=Math.hypot(nx,ny,nz);if(n<1e-8)return;
  const data=builder.at((a[0]+b[0]+c[0])/3,(a[2]+b[2]+c[2])/3).data[bucket];
  const shade=ny/n<-.2?.65:Math.abs(ny/n)<.45?.82:1;
  for(const p of [a,b,c]){data.positions.push(...p);data.normals.push(nx/n,ny/n,nz/n);data.colors.push(color[0]*shade,color[1]*shade,color[2]*shade);data.uvs.push(p[0]*.03,p[2]*.03);}
}
const surfaceColor=(surface:string,role:string):RGB=>rgb(role==='marker'?'#e6b95b':surface.includes('water')?'#527f83':surface.includes('metal')?'#777e7f':surface.includes('wood')||surface.includes('board')?'#b59c79':role==='roof'?'#aaa398':role==='rock'?'#a3998a':'#c9c2b4');
function addSolid(builder:CardBuilder,solid:StructureSolid){
  const color=surfaceColor(solid.surface,solid.role),p=solid.positions;
  for(let i=0;i<solid.indices.length;i+=3){const v=(n:number):XYZ=>{const j=solid.indices[i+n]!*3;return[p[j]!,p[j+1]!,p[j+2]!];};solidTriangle(builder,v(0),v(1),v(2),color);}
}
function addTerrain(builder:CardBuilder,field:TerrainField,cuts:Pick<LandCuts,'mouths'>,districtId:string){
  const colors=TERRAIN_SURFACE_PALETTE.map(p=>rgb(p.color));
  for(let row=0;row<field.rows-1;row++)for(let col=0;col<field.columns-1;col++){
    const x=col*field.step,z=row*field.step;
    if(districtAt(x+field.step/2,z+field.step/2)!==districtId)continue;
    const i=row*field.columns+col,j=i+field.columns,step=field.step;
    const nw:XYZ=[x,field.heights[i]!,z],ne:XYZ=[x+step,field.heights[i+1]!,z],sw:XYZ=[x,field.heights[j]!,z+step],se:XYZ=[x+step,field.heights[j+1]!,z+step];
    const color=colors[field.surfaces[i]!]??colors[1]!;
    if(terrainTriangleVisible(x+step/3,z+step/3,cuts))solidTriangle(builder,nw,sw,ne,color,'pad');
    if(terrainTriangleVisible(x+step*2/3,z+step*2/3,cuts))solidTriangle(builder,ne,sw,se,color,'pad');
  }
}
export function buildDistrictCards(world:WorldDefinition,field:TerrainField,cuts:LandCuts,district:District,tier:'full'|'lite',coarse=false):CardBuild{
  const builder=new CardBuilder(`horizon.${coarse?'journey':'district'}.${district.id}`,tier,{ink:'#5b5447',cell:coarse?4096:256,shadows:!coarse});
  addTerrain(builder,field,cuts,district.id);
  if(!coarse){const ids=new Set(district.solidIds??[]);for(const solid of world.geometry?.solids??[])if(ids.has(solid.id))addSolid(builder,solid);}
  return builder.finish();
}
function waterTriangle(b:CardBuilder,a:XYZ,c:XYZ,d:XYZ,color:RGB){b.water(a,c,d,[a[0]*.02,0],[c[0]*.02,1],[d[0]*.02,.5],color);}
function addWater(builder:CardBuilder,w:WaterCut){
  if(w.kind==='dry')return;const color=rgb(w.kind==='deep'?'#1d2f2e':w.kind==='sea'?'#4b777d':'#608b87');
  if(w.points.length>1){for(let i=1;i<w.points.length;i++){
    const a=w.points[i-1]!,b=w.points[i]!,dx=b[0]-a[0],dz=b[2]-a[2],n=Math.hypot(dx,dz)||1,ox=-dz/n*w.width/2,oz=dx/n*w.width/2;
    const p:XYZ=[a[0]+ox,a[1],a[2]+oz],q:XYZ=[a[0]-ox,a[1],a[2]-oz],r:XYZ=[b[0]-ox,b[1],b[2]-oz],s:XYZ=[b[0]+ox,b[1],b[2]+oz];
    waterTriangle(builder,p,q,r,color);waterTriangle(builder,p,r,s,color);
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

export function buildHorizonRing(cards:readonly import('../sky/horizonCards.ts').HorizonCard[],tier:'full'|'lite'){
  const b=new CardBuilder('horizon.sky-ring',tier,{ink:'#7e8578',cell:4096,shadows:false});
  for(const card of cards)addSolid(b,{...card,id:card.id,surface:'rock',role:'rock',kind:'horizon-card',districtId:'sky',bedIds:[],walkable:false});
  const result=b.finish();
  // Fog is applied to the ring's material colour with a fixed 50% mix, below its 70% cap.
  for(const material of Object.values(result.materials))if('fog'in material)(material as THREE.MeshStandardMaterial).fog=false;
  return result;
}
