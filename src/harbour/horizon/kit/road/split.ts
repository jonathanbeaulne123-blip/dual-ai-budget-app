/**
 * Split a triangle by isolines of per-vertex scalar fields (lateral offset `o`, arc length `s`, height `y`…), so a
 * painted-card surface can carry crisp bands, slab joints, flags and stone courses as real geometry and vertex colour
 * (ROAD.md §4: "never a stretched texture"). Positions are interpolated linearly with the fields, so every piece lies
 * exactly on the source triangle: what is drawn is the collision surface.
 */
export type SV={p:[number,number,number];f:number[]};

/** Clip a convex polygon to f[k] ≥ c (keep 'above') or f[k] ≤ c ('below'). */
function clip(poly:SV[],k:number,c:number,keep:'above'|'below'):SV[]{
  const out:SV[]=[],inside=(v:SV)=>keep==='above'?v.f[k]!>=c:v.f[k]!<=c;
  for(let i=0;i<poly.length;i++){
    const a=poly[i]!,b=poly[(i+1)%poly.length]!,ia=inside(a),ib=inside(b);
    if(ia)out.push(a);
    if(ia!==ib){const t=(c-a.f[k]!)/(b.f[k]!-a.f[k]!);out.push({p:[a.p[0]+(b.p[0]-a.p[0])*t,a.p[1]+(b.p[1]-a.p[1])*t,a.p[2]+(b.p[2]-a.p[2])*t],f:a.f.map((v,j)=>v+(b.f[j]!-v)*t)});}
  }
  return out;
}
/**
 * Split `poly` into pieces between consecutive `cuts` of field k. Each piece carries the index of the interval it
 * falls in (0 below cuts[0], cuts.length above the last). `cuts` must be ascending.
 */
export function splitBy(poly:SV[],k:number,cuts:readonly number[]):{poly:SV[];band:number}[]{
  if(poly.length<3)return [];
  let lo=Infinity,hi=-Infinity;for(const v of poly){lo=Math.min(lo,v.f[k]!);hi=Math.max(hi,v.f[k]!);}
  const out:{poly:SV[];band:number}[]=[];let rest=poly,band=0;
  for(const c of cuts){
    if(c<=lo){band++;continue;}
    if(c>=hi)break;
    const below=clip(rest,k,c,'below');if(below.length>=3)out.push({poly:below,band});
    rest=clip(rest,k,c,'above');band++;if(rest.length<3)return out;
  }
  // Skip cuts beyond hi so `band` counts every cut at or below lo.
  if(rest.length>=3)out.push({poly:rest,band});
  return out;
}
/** Regular isolines of field k with period `step` (and phase) inside the polygon's range. */
export function periodicCuts(poly:SV[],k:number,step:number,phase=0,eps=0):number[]{
  let lo=Infinity,hi=-Infinity;for(const v of poly){lo=Math.min(lo,v.f[k]!);hi=Math.max(hi,v.f[k]!);}
  const out:number[]=[];for(let c=Math.ceil((lo-phase)/step)*step+phase;c<hi-eps;c+=step)if(c>lo+eps)out.push(c);return out;
}
/** Where field k equals c across the polygon: the segment (two points) or null. */
export function isoSegment(poly:SV[],k:number,c:number):[[number,number,number],[number,number,number]]|null{
  const pts:[number,number,number][]=[];
  for(let i=0;i<poly.length;i++){const a=poly[i]!,b=poly[(i+1)%poly.length]!,da=a.f[k]!-c,db=b.f[k]!-c;
    if((da<0&&db>=0)||(da>=0&&db<0)){const t=da/(da-db);pts.push([a.p[0]+(b.p[0]-a.p[0])*t,a.p[1]+(b.p[1]-a.p[1])*t,a.p[2]+(b.p[2]-a.p[2])*t]);}}
  return pts.length>=2?[pts[0]!,pts[1]!]:null;
}
export const centroidField=(poly:SV[],k:number)=>poly.reduce((a,v)=>a+v.f[k]!,0)/poly.length;
/** Fan-triangulate a convex polygon. */
export function fan(poly:SV[]):[SV,SV,SV][]{const t:[SV,SV,SV][]=[];for(let i=1;i<poly.length-1;i++)t.push([poly[0]!,poly[i]!,poly[i+1]!]);return t;}
