import type {LandingRows} from '../../../mountain/branchLandings.ts';
/** The upward-facing triangles of the existing drawn road. Swept bands can overlap at a
 * tight hairpin; the highest reachable face is the floor, not the first face in array order.
 * No geometry is created here. The height ceiling keeps lower underpass levels reachable. */
export function drawnRoadFloor(rows:LandingRows){
 const cellSize=12,cells=new Map<string,number[]>();
 const triangles:{x:number;z:number;y:number;ux:number;uz:number;vx:number;vz:number;det:number;dy:number;ey:number;gx:number;gz:number}[]=[];
 for(let i=1;i<rows.length;i++)for(let k=1;k<rows[i]!.length;k++)for(const [a,b,c]of [[rows[i-1]![k-1]!,rows[i]![k-1]!,rows[i]![k]!],[rows[i-1]![k-1]!,rows[i]![k]!,rows[i-1]![k]!]]){
  const ux=b![0]-a![0],uz=b![2]-a![2],vx=c![0]-a![0],vz=c![2]-a![2],det=ux*vz-uz*vx;
  if(Math.abs(det)<1e-10)continue;
  const dy=b![1]-a![1],ey=c![1]-a![1],id=triangles.length;
  // CardKit.tri reverses downward-facing tops when normalized ny < -0.2.
  // Keep exactly those drawn tops; near-vertical downward sides are not floors.
  const ny=-det/Math.hypot(dy*vz-uz*ey,det,ux*ey-dy*vx);
  if(ny<=0&&ny>=-.2)continue;
  triangles.push({x:a![0],z:a![2],y:a![1],ux,uz,vx,vz,det,dy,ey,gx:(dy*vz-ey*uz)/det,gz:(ux*ey-vx*dy)/det});
  for(let x=Math.floor(Math.min(a![0],b![0],c![0])/cellSize);x<=Math.floor(Math.max(a![0],b![0],c![0])/cellSize);x++)for(let z=Math.floor(Math.min(a![2],b![2],c![2])/cellSize);z<=Math.floor(Math.max(a![2],b![2],c![2])/cellSize);z++){
   const key=`${x}:${z}`,list=cells.get(key)??[];list.push(id);cells.set(key,list);
  }
 }
 return (x:number,z:number,ceiling=Infinity):{y:number;gx:number;gz:number}|null=>{
  let best:{y:number;gx:number;gz:number}|null=null;
  for(const id of cells.get(`${Math.floor(x/cellSize)}:${Math.floor(z/cellSize)}`)??[]){
   const t=triangles[id]!,px=x-t.x,pz=z-t.z,u=(px*t.vz-pz*t.vx)/t.det,v=(t.ux*pz-t.uz*px)/t.det;
   if(u< -1e-7||v< -1e-7||u+v>1+1e-7)continue;
   const y=t.y+t.dy*u+t.ey*v;if(y>ceiling+1e-8||(best&&y<=best.y))continue;
   best={y,gx:t.gx,gz:t.gz};
  }return best;
 };
}
