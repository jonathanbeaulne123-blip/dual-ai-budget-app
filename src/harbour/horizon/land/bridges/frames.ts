import type { XYZ } from '../interfaces';
import { mix } from '../structures/mesh';
export const bridgeLength=(path:readonly XYZ[])=>path.slice(1).reduce((n,p,i)=>n+Math.hypot(p[0]-path[i]![0],p[2]-path[i]![2]),0);
export function bridgeFrame(path:readonly XYZ[],station:number,offset=0,rise=0):XYZ {
  let s=Math.max(0,station);
  for(let i=1;i<path.length;i++){const a=path[i-1]!,b=path[i]!,dx=b[0]-a[0],dz=b[2]-a[2],l=Math.hypot(dx,dz);if(l<1e-8)continue;
    if(s<=l||i===path.length-1){const t=Math.min(1,s/l);return [mix(a[0],b[0],t)-dz/l*offset,mix(a[1],b[1],t)+rise,mix(a[2],b[2],t)+dx/l*offset];}s-=l;
  }return path[0]!;
}
