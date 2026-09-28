/**
 * Mountain v2 on the Horizon — the region's ground, decks, ceilings and solids (pass 5, T2).
 *
 * Every query converts Horizon → native on the way in and adds the offset back on the way out (placement.ts). The numbers
 * are v2's own: `scene/ground.ts groundHeightAt` (the island, the baked massif and the town channel), `mountain/surfaces.ts
 * queryWorldSurface` / `worldCeilingAt` over v2's deck list, and v2's solids — with the things this pass does not draw
 * (D-M8) taken out of the collision too, so nothing you cannot see stops you:
 *  - decks: every `WORLD_SURFACES` entry except the town race road's canal-bridge deck (the canal bridge is not drawn);
 *  - solids: `WORLD_SOLIDS` less the district fixtures (`district-art:*`: beds, logs, crates, rocks — not drawn);
 *  - edges: `EDGE_SOLIDS` (parapets, bridge rails, retaining walls), as v2 has them (north of native z −40 only).
 *
 * `contains` (the drawn footprint; the terrain tiles under it are hidden and the provider owns the ground there):
 *  - inside `insideMountainV2` (the grid rectangle, Horizon x 1108…1508, z 368…848), and
 *  - the massif (native −294 ≤ z < −48): v2's ground above −0.2 (land, not v2's sea) or `mountainContains` (a deck over low
 *    ground: the road, Orchard Lane, a skate branch);
 *  - north of the summit line (native z < −294, D-M2): v2's ground above −0.2 AND v2 at least as high as the Horizon's baked
 *    ground there (less `NORTH_TOLERANCE`) — where the Crown's own north face is higher it stays the Horizon's (the Throat,
 *    its collar, the skylight). Without a baked field (a test) this falls back to v2's walkable bound (native z ≥ −310);
 *  - the town island (native z ≥ −48): the Foot terrace, a disc of `FOOT_RADIUS` round v2's square (the terrace, the lawn
 *    and the channel; the shore that falls to v2's sea is the Horizon's lake shore);
 *  - never within `MOUTH_MARGIN` of a Horizon terrain mouth (`exclude`: the Ore Line's South Portal keeps its opening).
 */
import {groundHeightAt} from '../../../scene/ground.ts';
import {mountainContains,nearestOnRoute,EDGE_SOLIDS,WORLD_BOUNDS,type Point3} from '../../../mountain/definition.ts';
import {WORLD_SURFACES,WORLD_SOLIDS,queryWorldSurface,worldCeilingAt,type WorldSurface,type WorldSolid,type WorldSurfaceHit} from '../../../mountain/surfaces.ts';
import {MOUNTAIN_V2_OFFSET as O,MOUNTAIN_V2_MASSIF_Z,MOUNTAIN_V2_SUMMIT_Z,insideMountainV2} from './placement.ts';

/** The Foot terrace's radius (native, round v2's square): the terrace, the lawn and the channel; not the falling shore. */
export const FOOT_RADIUS=66;
/** North of the summit line v2 is drawn only where it is within this of (or above) the Horizon's baked ground. */
export const NORTH_TOLERANCE=1;
/** v2 land, not v2 sea (the rule `mountainContains` uses). */
const LAND=-.2;
/** The Horizon body (runtime/geography.ts): a solid above the step and below the head stops it. */
const STEP=.48,BODY=1.25;

/** v2's decks this pass draws (all but the canal bridge's town race road deck). */
export const REGION_SURFACES:readonly WorldSurface[]=WORLD_SURFACES.filter(s=>s.id!=='town-race-road');
/** v2's solids this pass draws (all but the district fixtures). */
export const REGION_SOLIDS:readonly WorldSolid[]=WORLD_SOLIDS.filter(s=>!s.id.startsWith('district-art:'));

export type RegionSurface={id:string;y:number;n:[number,number,number];material:string;slope:number};
export type RegionContact={id:string;nx:number;nz:number};
export type RegionGeographyOptions={
  /** The Horizon's baked ground (terrain only) at a Horizon point: decides the north face (D-M2). Omitted: native z ≥ −310. */
  horizonGround?:(hx:number,hz:number)=>number;
  /** Horizon points the region leaves to the Horizon (its terrain mouths: a portal's opening must stay open). */
  exclude?:(hx:number,hz:number)=>boolean;
};
/** The margin (m) round a Horizon terrain mouth the region leaves to the Horizon's own (masked) terrain. */
export const MOUTH_MARGIN=6;
/** `exclude` for a list of mouth outlines (LandCuts.mouths): inside an outline's box grown by MOUTH_MARGIN. */
export function mouthExclusion(mouths:readonly {outline:readonly (readonly [number,number])[]}[]){
  const boxes=mouths.map(m=>{const xs=m.outline.map(p=>p[0]),zs=m.outline.map(p=>p[1]);return [Math.min(...xs)-MOUTH_MARGIN,Math.min(...zs)-MOUTH_MARGIN,Math.max(...xs)+MOUTH_MARGIN,Math.max(...zs)+MOUTH_MARGIN] as const;});
  return (hx:number,hz:number)=>boxes.some(b=>hx>=b[0]&&hz>=b[1]&&hx<=b[2]&&hz<=b[3]);
}

/** A v2 surface hit's material in the Horizon's vocabulary (MANIFEST `surfaces`): pace, grip and footsteps. */
export function regionMaterial(hit:Pick<WorldSurfaceHit,'id'|'material'>):string{
  if(hit.id==='terrain')return 'grass';
  if(hit.material==='wood')return 'boardwalk';
  return 'paved';
}

/** A coarse grid over the deck polylines so a contact touches only the decks near it. */
function deckIndex(surfaces:readonly WorldSurface[]){
  const CELL=12,cells=new Map<string,number[]>();
  surfaces.forEach((s,i)=>{for(let k=0;k<s.points.length;k++){const a=s.points[Math.max(0,k-1)]!,b=s.points[k]!,r=s.halfWidth+1;
    for(let x=Math.floor((Math.min(a[0],b[0])-r)/CELL);x<=Math.floor((Math.max(a[0],b[0])+r)/CELL);x++)for(let z=Math.floor((Math.min(a[2],b[2])-r)/CELL);z<=Math.floor((Math.max(a[2],b[2])+r)/CELL);z++){
      const key=`${x}:${z}`,list=cells.get(key);if(!list)cells.set(key,[i]);else if(list.at(-1)!==i)list.push(i);}}});
  return (x:number,z:number)=>cells.get(`${Math.floor(x/CELL)}:${Math.floor(z/CELL)}`)??[];
}
/** Nearest point of a deck's polyline, null past its square ends (as v2's `onDeck`). */
function onDeck(x:number,z:number,points:readonly Point3[]){
  const p=nearestOnRoute(x,z,points),n=points.length;
  if(p.index===0&&p.t===0){const a=points[0]!,b=points[1]!,dx=b[0]-a[0],dz=b[2]-a[2],l=Math.hypot(dx,dz)||1;if(((x-a[0])*dx+(z-a[2])*dz)/l<-.35)return null;}
  if(p.index===n-2&&p.t===1){const a=points[n-2]!,b=points[n-1]!,dx=b[0]-a[0],dz=b[2]-a[2],l=Math.hypot(dx,dz)||1;if(((x-b[0])*dx+(z-b[2])*dz)/l>.35)return null;}
  return p;
}

export function createRegionGeography(options:RegionGeographyOptions={}){
  const near=deckIndex(REGION_SURFACES);
  /** Inside the drawn footprint (see the module note). Horizon coordinates. */
  function contains(hx:number,hz:number):boolean{
    if(!insideMountainV2(hx,hz)||options.exclude?.(hx,hz))return false;
    const nx=hx-O.x,nz=hz-O.z;
    if(nz>=MOUNTAIN_V2_MASSIF_Z)return Math.hypot(nx,nz)<=FOOT_RADIUS;
    const g=groundHeightAt(nx,nz);
    if(nz<MOUNTAIN_V2_SUMMIT_Z){
      if(!(g>LAND))return false;
      return options.horizonGround?g+O.y>=options.horizonGround(hx,hz)-NORTH_TOLERANCE:nz>=WORLD_BOUNDS.minZ;
    }
    return g>LAND||mountainContains(nx,nz);
  }
  /** v2's ground (terrain only), Horizon height; null outside the footprint. */
  function groundAt(hx:number,hz:number):number|null{return contains(hx,hz)?groundHeightAt(hx-O.x,hz-O.z)+O.y:null;}
  /** The highest v2 floor (ground or deck) at or under hy + step; null outside the footprint or when it is above that. */
  function surface(hx:number,hy:number|undefined,hz:number,step=STEP):RegionSurface|null{
    if(!contains(hx,hz))return null;
    const hit=queryWorldSurface({x:hx-O.x,z:hz-O.z,y:hy===undefined?undefined:hy-O.y,stepHeight:step},groundHeightAt,REGION_SURFACES),y=hit.y+O.y;
    if(hy!==undefined&&y>hy+step)return null;
    return {id:hit.id==='terrain'?'terrain':`mountainV2:${hit.id}`,y,n:[hit.nx,hit.ny,hit.nz],material:regionMaterial(hit),slope:Math.atan(hit.slope)*180/Math.PI};
  }
  /** The lowest v2 deck underside above the feet; null when none (or outside). */
  function ceiling(hx:number,hy:number,hz:number):number|null{
    if(!contains(hx,hz))return null;
    const c=worldCeilingAt(hx-O.x,hz-O.z,hy-O.y,.2,REGION_SURFACES);
    return Number.isFinite(c)?c+O.y:null;
  }
  /**
   * The first solid overlapping a body standing at `feet` (the span above its step and below its head): deck slabs
   * (0.28 under a deck to 0.08 over it), v2's boxes (dam plinths, station posts, the observatory and the pavilion's columns,
   * branch supports) and its edge slabs (parapets, bridge rails, retaining walls). The normal points from the solid to
   * the body (for sliding). Null outside the footprint.
   */
  function contact(hx:number,hz:number,feet:number,radius=.3):RegionContact|null{
    if(!contains(hx,hz))return null;
    const x=hx-O.x,z=hz-O.z,lo=feet-O.y+STEP,hi=feet-O.y+BODY;
    for(const si of near(x,z)){const s=REGION_SURFACES[si]!,p=onDeck(x,z,s.points);if(!p||p.distance>=s.halfWidth+radius)continue;
      const top=p.point[1]+.08,bottom=p.point[1]-.28;if(top<=lo||bottom>=hi)continue;
      const dx=x-p.point[0],dz=z-p.point[2],d=Math.hypot(dx,dz)||1;return {id:`mountainV2:${s.id}`,nx:dx/d,nz:dz/d};}
    for(const s of REGION_SOLIDS){
      if(s.max[1]<=lo||s.min[1]>=hi||x<=s.min[0]-radius||x>=s.max[0]+radius||z<=s.min[2]-radius||z>=s.max[2]+radius)continue;
      const px=Math.max(s.min[0],Math.min(s.max[0],x)),pz=Math.max(s.min[2],Math.min(s.max[2],z)),dx=x-px,dz=z-pz,d=Math.hypot(dx,dz);
      if(d>0)return {id:`mountainV2:${s.id}`,nx:dx/d,nz:dz/d};
      // Inside the box: out through its nearest face.
      const faces=[[x-s.min[0],-1,0],[s.max[0]-x,1,0],[z-s.min[2],0,-1],[s.max[2]-z,0,1]] as const,f=faces.reduce((a,b)=>b[0]<a[0]?b:a);
      return {id:`mountainV2:${s.id}`,nx:f[1],nz:f[2]};
    }
    if(z<-40)for(const s of EDGE_SOLIDS){
      if(s.top<=lo||s.bottom>=hi)continue;
      const ax=s.a[0],az=s.a[1],dx=s.b[0]-ax,dz=s.b[1]-az,l=dx*dx+dz*dz,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(l||1))),qx=x-ax-dx*t,qz=z-az-dz*t,d=Math.hypot(qx,qz);
      if(d<s.thickness/2+radius){if(d>1e-6)return {id:`mountainV2:${s.id}`,nx:qx/d,nz:qz/d};const n=Math.sqrt(l)||1;return {id:`mountainV2:${s.id}`,nx:-dz/n,nz:dx/n};}
    }
    return null;
  }
  /** v2's point test (`worldCollisionAt`'s shape) over the drawn solids: is (hx, hy, hz) inside a solid, within r? */
  function blocked(hx:number,hy:number,hz:number,r=.2):boolean{
    if(!contains(hx,hz))return false;
    const x=hx-O.x,y=hy-O.y,z=hz-O.z;
    for(const si of near(x,z)){const s=REGION_SURFACES[si]!,p=onDeck(x,z,s.points);if(p&&p.distance<s.halfWidth+r&&y>p.point[1]-.28&&y<p.point[1]+.08)return true;}
    if(REGION_SOLIDS.some(s=>x>s.min[0]-r&&x<s.max[0]+r&&z>s.min[2]-r&&z<s.max[2]+r&&y>s.min[1]&&y<s.max[1]))return true;
    if(z<-40)for(const s of EDGE_SOLIDS){
      if(y<s.bottom||y>s.top)continue;
      const ax=s.a[0],az=s.a[1],dx=s.b[0]-ax,dz=s.b[1]-az,l=dx*dx+dz*dz,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(l||1)));
      if(Math.hypot(x-ax-dx*t,z-az-dz*t)<s.thickness/2+r)return true;
    }
    return false;
  }
  /**
   * The provider `runtime/geography.ts addDynamic` takes. It OWNS the ground inside the footprint: there the baked 5 m
   * terrain is not a candidate at all (the walker and the board stand on v2's exact ground, not on the higher of the two),
   * `ground()` answers v2's ground and the camera tests v2's ground. Outside the footprint it answers nothing.
   */
  const provider={
    owns:contains,
    ground:(x:number,z:number)=>groundHeightAt(x-O.x,z-O.z)+O.y,
    surface(x:number,z:number,y?:number,step?:number){const s=surface(x,y,z,step);return s?{id:s.id,y:s.y,nx:s.n[0],ny:s.n[1],nz:s.n[2],material:s.material,slope:s.slope}:null;},
    ceiling(x:number,z:number,y:number){return ceiling(x,y,z)??Infinity;},
    contact(x:number,z:number,y:number,radius?:number){return contact(x,z,y,radius);},
  };
  return {contains,groundAt,surface,ceiling,contact,blocked,provider};
}
export type RegionGeography=ReturnType<typeof createRegionGeography>;
