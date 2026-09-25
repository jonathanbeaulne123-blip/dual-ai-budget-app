import type { StructureSolid, XY, XYZ } from '../interfaces';

export const distance = (a: XY, b: XY): number => Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!);
export const plan = (p: XYZ): XY => [p[0]!, p[2]!];
export const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
export function districtAt(x: number, z: number): string {
  if (x < 600 && z > 1050) return 'offshore';
  if (z > 1380) return 'landing';
  if (x > 1380 && z > 1020) return 'harbour';
  if (x > 1530) return 'prow';
  if (x > 1120 && z < 710) return 'crown';
  if (x < 580 && z < 1000) return 'flats';
  if (x < 910 && z > 840) return 'bight';
  if (x < 950 && z < 520) return 'scholars';
  if (z < 700) return 'hollow';
  if (z < 920) return 'lakeside';
  if (x > 1120 && z < 1190) return 'notch';
  if (x > 1160 && z >= 1190) return 'reach';
  return 'green';
}
export function solid(id: string, kind: string, surface: string, role: StructureSolid['role'], bedIds: string[] = [], districtId = 'harbour'): StructureSolid {
  return { id, kind, positions: [], indices: [], surface, role, bedIds, districtId, walkable: role === 'deck' || role === 'floor' };
}
/** Every face is wound outwards; the bottom is a real downward-facing face. */
export function prism(out: StructureSolid, corners: readonly XYZ[], bottom: number | readonly number[]): void {
  if (corners.length !== 4) throw new Error('A structural prism needs four corners');
  const n = out.positions.length / 3;
  for (let i = 0; i < 4; i++) out.positions.push(corners[i]![0]!, typeof bottom === 'number' ? bottom : bottom[i]!, corners[i]![2]!);
  corners.forEach(p => out.positions.push(...p));
  const faces = [0,2,1,0,3,2, 4,5,6,4,6,7, 0,1,5,0,5,4, 1,2,6,1,6,5, 2,3,7,2,7,6, 3,0,4,3,4,7];
  out.indices.push(...faces.map(i => n + i));
}
export function box(out: StructureSolid, centre: XY, top: number, size: XY, bottom: number, rotation = 0): void {
  const a = rotation * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const corners: XYZ[] = [[-1,-1],[-1,1],[1,1],[1,-1]].map(([x,z]) => {
    const dx=x!*size[0]!/2, dz=z!*size[1]!/2;
    return [centre[0]!+dx*c-dz*s,top,centre[1]!+dx*s+dz*c];
  });
  prism(out,corners,bottom);
}
/** A closed segment slab, with independent end heights and a constant vertical thickness. */
export function slab(out: StructureSolid, a: XYZ, b: XYZ, width: number, thickness: number, offset = 0, rise = 0): void {
  const d=Math.hypot(b[0]!-a[0]!,b[2]!-a[2]!); if(d<1e-7)return;
  const nx=-(b[2]!-a[2]!)/d,nz=(b[0]!-a[0]!)/d;
  const pt=(p:XYZ,side:number):XYZ=>[p[0]!+nx*(offset+side*width/2),p[1]!+rise,p[2]!+nz*(offset+side*width/2)];
  const corners=[pt(a,-1),pt(a,1),pt(b,1),pt(b,-1)];
  prism(out,corners,corners.map(p=>p[1]!-thickness));
}
export function mergeSolids(id: string, chunks: StructureSolid[]): StructureSolid {
  if (!chunks.length) throw new Error('Cannot merge an empty solid list');
  const result={...chunks[0]!,id,positions:[] as number[],indices:[] as number[]};
  for(const chunk of chunks){const n=result.positions.length/3;result.positions.push(...chunk.positions);result.indices.push(...chunk.indices.map(i=>i+n));}
  return result;
}
export function nearestOnPath(point: XY, points: readonly XYZ[]): { at: XYZ; distance: number; segment: number; t: number; along: number } {
  let best={at:points[0]! ?? [point[0]!,0,point[1]!] as unknown as XYZ,distance:Infinity,segment:0,t:0,along:0}, along=0;
  for(let i=1;i<points.length;i++){
    const a=points[i-1]!,b=points[i]!,dx=b[0]!-a[0]!,dz=b[2]!-a[2]!,len=Math.hypot(dx,dz);
    const t=clamp(((point[0]!-a[0]!)*dx+(point[1]!-a[2]!)*dz)/(len*len||1),0,1);
    const at:XYZ=[mix(a[0]!,b[0]!,t),mix(a[1]!,b[1]!,t),mix(a[2]!,b[2]!,t)];
    const d=distance(point,plan(at)); if(d<best.distance)best={at,distance:d,segment:i-1,t,along:along+len*t}; along+=len;
  }
  return best;
}
export function pathLength(points: readonly XYZ[], spatial=false): number {
  return points.slice(1).reduce((s,p,i)=>s+Math.hypot(p[0]!-points[i]![0]!,p[2]!-points[i]![2]!,spatial?p[1]!-points[i]![1]!:0),0);
}
export function maxGrade(points: readonly XYZ[]): number {
  return points.slice(1).reduce((m,p,i)=>Math.max(m,Math.abs(p[1]!-points[i]![1]!)/(distance(plan(p),plan(points[i]!))||1)),0);
}
export function bounds(out: StructureSolid): { min: XYZ; max: XYZ } {
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  out.positions.forEach((v,i)=>{min[i%3]! =Math.min(min[i%3]!,v);max[i%3]! =Math.max(max[i%3]!,v);});
  return {min:min as unknown as unknown as XYZ,max:max as unknown as unknown as XYZ};
}
