/**
 * Final mountain ground. The base landform (`terrainBase.ts`) receives exact benches:
 * every road, lane, path, stair, platform and apron is cut or filled into the ground with
 * a bounded batter (≤ 45°, eased at its toe) — never a vertical cut the render lattice
 * cannot draw. Where a batter needs holding, an explicit retaining wall is listed.
 * Bridges leave the ground beneath them untouched. Baked once to a 1-unit grid.
 */
import {BASE_GRID,makeGrid,sampleGrid,type HeightGrid} from './terrainBase.ts';
import {arcLengths,type Point3} from './math.ts';
import {nearestRiver,channelProfile,smin} from './natural.ts';
import {RIVER_BED_DEPTH} from './places.ts';

/** A line the ground must meet: at `halfWidth + shoulder` the ground equals the line minus `inset`. */
/** Higher priority benches are cut last and so hold exactly (roads over lanes over paths and pads). */
/** `fill:'footprint'` never builds an embankment beyond the line's own width (stairs and paths stand
 * on their own supports where the ground falls away); `'cone'` fills as well as cuts (roads). */
export type BenchLine={id:string;points:readonly Point3[];halfWidth:number;shoulder:number;slope:number;inset:number;skip?:readonly (readonly [number,number])[];priority?:number;fill?:'cone'|'footprint'};
export type BenchPad={id:string;at:Point3;half:readonly [number,number];yaw:number;inset:number;slope:number;priority?:number;fill?:'cone'|'footprint'};

const EASE=6;
/** Allowed ground deviation at horizontal distance `u` beyond the level shoulder. */
export const benchDeviation=(u:number,slope:number)=>u<=0?0:(u<EASE?slope*u*u/(2*EASE):slope*(u-EASE/2))+(u>12?(u-12)*(u-12)*3:0);

export function bakeFinal(lines:readonly BenchLine[],pads:readonly BenchPad[],recarveRiver=false):{grid:HeightGrid;conflicts:number;conflictCells:number[]}{
  const g=makeGrid(1),{cols,rows}=g;g.data.set(BASE_GRID.data);
  const lo=new Float32Array(cols*rows),hi=new Float32Array(cols*rows),loU=new Float32Array(cols*rows),hiU=new Float32Array(cols*rows);
  const R=16;
  // Capsule distance to a short stretch of centreline (ux,uz direction, ±half along it), or a rotated pad.
  const apply=(x:number,z:number,y:number,edge:number,slope:number,ux:number,uz:number,half:number,pad?:{c:number;s:number;hx:number;hz:number},endCap:-1|0|1=0,footprint=false)=>{
    const cx=Math.round(x-g.minX),cz=Math.round(z-g.minZ),reach=Math.ceil(edge+R+(pad?Math.max(pad.hx,pad.hz):half));
    for(let dz=-reach;dz<=reach;dz++){const row=cz+dz;if(row<0||row>=rows)continue;const pz=g.minZ+row-z;
      for(let dx=-reach;dx<=reach;dx++){const col=cx+dx;if(col<0||col>=cols)continue;const px=g.minX+col-x;
        let d:number;
        if(pad){const u=Math.abs(px*pad.c-pz*pad.s)-pad.hx,v=Math.abs(px*pad.s+pz*pad.c)-pad.hz;d=Math.hypot(Math.max(0,u),Math.max(0,v));}
        else{
          // A slab across the line: each sample holds only the ground beside its own short stretch,
          // never ground further along the line (which belongs to the next sample). Line ends are capped.
          // An end sample also holds the ground beyond the line's end (outward only, never along the line).
          const along=px*ux+pz*uz;if((along<-half&&endCap!==-1)||(along>half&&endCap!==1))continue;
          const c=along<-half?-half:along>half?half:along;d=Math.hypot(px-ux*c,pz-uz*c);
        }
        if(d>edge+R)continue;
        const u=d>edge?d-edge:0,dev=benchDeviation(u,slope),i=row*cols+col;
        if((!footprint||u<=0)&&y-dev>lo[i]!){lo[i]=y-dev;loU[i]=u;}if(y+dev<hi[i]!){hi[i]=y+dev;hiU[i]=u;}
      }
    }
  };
  let conflicts=0;const conflictCells:number[]=[];
  const priorities=[...new Set([...lines.map(l=>l.priority??0),...pads.map(p=>p.priority??0)])].sort((a,b)=>a-b);
  for(const priority of priorities){
    lo.fill(-Infinity);hi.fill(Infinity);
    for(const line of lines){
      if((line.priority??0)!==priority)continue;
      const s=arcLengths(line.points,true);
      for(let i=0;i<line.points.length;i++){
        if(line.skip?.some(([a,b])=>s[i]!>=a&&s[i]!<=b))continue;
        const p=line.points[i]!,a=line.points[Math.max(0,i-1)]!,b=line.points[Math.min(line.points.length-1,i+1)]!;
        const tx=b[0]-a[0],tz=b[2]-a[2],tl=Math.hypot(tx,tz)||1;
        // Each sample owns its own short stretch of centreline so the samples tile without gaps.
        apply(p[0],p[2],p[1]-line.inset,line.halfWidth+line.shoulder,line.slope,tx/tl,tz/tl,tl*.4,undefined,i===0?-1:i===line.points.length-1?1:0,line.fill==='footprint');
      }
    }
    for(const pad of pads)if((pad.priority??0)===priority)apply(pad.at[0],pad.at[2],pad.at[1]-pad.inset,0,pad.slope,1,0,0,{c:Math.cos(pad.yaw),s:Math.sin(pad.yaw),hx:pad.half[0],hz:pad.half[1]},0,pad.fill==='footprint');
    for(let i=0;i<g.data.length;i++){
      const l=lo[i]!,h=hi[i]!;if(l===-Infinity&&h===Infinity)continue;
      // Two benches too close for a 45° batter (stacked switchback legs): each holds the ground at its
      // own edge and the ground between ramps across the gap (a retaining wall stands there).
      if(l>h){if(l-h>.3&&priority===priorities[priorities.length-1]){conflicts++;conflictCells.push(i);}const a=hiU[i]!,b=loU[i]!;g.data[i]=h+(l-h)*(a/((a+b)||1));}
      else g.data[i]=Math.min(h,Math.max(l,g.data[i]!));
    }
  }
  // The river keeps its bed: nothing benched beside it may bury the water (bridges span it, roads keep clear).
  if(recarveRiver){
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const x=g.minX+c,z=g.minZ+r;if(z>-40)continue;const river=nearestRiver(x,z);if(river.d<14){const i=r*cols+c;g.data[i]=smin(g.data[i]!,river.y+channelProfile(river.d,river.wall),1.5);
      // The bed never sinks below its authored depth (a cascade pool must not leave the water hanging).
      if(river.d<3)g.data[i]=Math.max(g.data[i]!,river.y-RIVER_BED_DEPTH);}}
  }
  return {grid:g,conflicts,conflictCells};
}
export {sampleGrid};
