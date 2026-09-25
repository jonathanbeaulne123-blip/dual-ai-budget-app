/**
 * Base ground: the natural landform shaped around its roads, with plateaus, the reservoir
 * hollow and the carved gorge — everything except the exact road/path benches and
 * foundations (those are `terrain.ts`). Baked once to a 1-unit grid.
 */
import {macroHeight,terraceWeight,channelProfile,nearestRiver,bowlHeight,smin} from './natural.ts';
import {TERRACES,RESERVOIR_BOWL,GORGE_POINTS} from './places.ts';
import {ROAD_CENTRE,ORCHARD_LANE_CENTRE,BRIDGE_TAGS,roadTagS,laneTagS} from './roadLine.ts';
import {mix,type Point3} from './math.ts';
import {islandHeight} from './islandShape.ts';

export type HeightGrid={minX:number;minZ:number;step:number;cols:number;rows:number;data:Float32Array};
export const TERRAIN_GRID_BOUNDS={minX:-200,maxX:200,minZ:-396,maxZ:-30} as const;
export function makeGrid(step:number):HeightGrid{
  const b=TERRAIN_GRID_BOUNDS,cols=Math.round((b.maxX-b.minX)/step)+1,rows=Math.round((b.maxZ-b.minZ)/step)+1;
  return {minX:b.minX,minZ:b.minZ,step,cols,rows,data:new Float32Array(cols*rows)};
}
/** Bilinear sample, clamped to the grid. */
export function sampleGrid(g:HeightGrid,x:number,z:number):number{
  const fx=Math.max(0,Math.min(g.cols-1.000001,(x-g.minX)/g.step)),fz=Math.max(0,Math.min(g.rows-1.000001,(z-g.minZ)/g.step));
  const ix=Math.floor(fx),iz=Math.floor(fz),u=fx-ix,v=fz-iz,i=iz*g.cols+ix,d=g.data;
  return (d[i]!*(1-u)+d[i+1]!*u)*(1-v)+(d[i+g.cols]!*(1-u)+d[i+g.cols+1]!*u)*v;
}
const bump=(u:number)=>u>=1?0:(1-u*u)*(1-u*u);

/** Road samples that shape the land: everything except the tagged gorge crossings. */
export function shapingSamples():{points:readonly Point3[];halfWidth:number}[]{
  const cut=(points:readonly Point3[],spans:readonly [number,number][])=>{
    const out:Point3[][]=[];let run:Point3[]=[];
    let s=0;for(let i=0;i<points.length;i++){
      if(i)s+=Math.hypot(points[i]![0]-points[i-1]![0],points[i]![2]-points[i-1]![2]);
      if(spans.some(([a,b])=>s>=a&&s<=b)){if(run.length)out.push(run);run=[];}else run.push(points[i]!);
    }
    if(run.length)out.push(run);return out;
  };
  const roadSpans=BRIDGE_TAGS.filter(b=>b.line==='road').map(b=>{const a=roadTagS(b.from),c=roadTagS(b.to);return [Math.min(a,c)-4,Math.max(a,c)+4] as [number,number];});
  const laneSpans=BRIDGE_TAGS.filter(b=>b.line==='lane').map(b=>{const a=laneTagS(b.from),c=laneTagS(b.to);return [Math.min(a,c)-4,Math.max(a,c)+4] as [number,number];});
  // The lane is benched exactly but does not reshape the hollow and gorge rims around it.
  void laneSpans;return cut(ROAD_CENTRE,roadSpans).map(points=>({points,halfWidth:4.8}));
}

function bakeBase():HeightGrid{
  const t0=performance.now();
  const coarse=makeGrid(4);
  for(let r=0;r<coarse.rows;r++)for(let c=0;c<coarse.cols;c++)coarse.data[r*coarse.cols+c]=macroHeight(coarse.minX+c*4,coarse.minZ+r*4);
  const t1=performance.now();
  const g=makeGrid(1),{cols,rows,data}=g;
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)data[r*cols+c]=sampleGrid(coarse,g.minX+c,g.minZ+r);
  // The land is shaped around its road: a soft, wide blend toward the road's elevation,
  // weighted over many nearby samples so ground between stacked legs ramps smoothly.
  const R=24,W0=R*16/15,sumW=new Float32Array(cols*rows),sumY=new Float32Array(cols*rows);
  for(const run of shapingSamples())for(const p of run.points){
    const cx=Math.round(p[0]-g.minX),cz=Math.round(p[2]-g.minZ);
    for(let dz=-R;dz<=R;dz++){const row=cz+dz;if(row<0||row>=rows)continue;
      for(let dx=-R;dx<=R;dx++){const col=cx+dx;if(col<0||col>=cols)continue;
        const x=g.minX+col,z=g.minZ+row,w=bump(Math.hypot(x-p[0],z-p[2])/R);if(w<=0)continue;
        const i=row*cols+col;sumW[i]+=w;sumY[i]+=w*p[1];
      }
    }
  }
  const t2=performance.now();
  for(let i=0;i<data.length;i++)if(sumW[i]!>0){const a=Math.min(1,sumW[i]!/W0*1.35);data[i]=mix(data[i]!,sumY[i]!/sumW[i]!,.92*a*a*(3-2*a));}
  // Plateaus, the reservoir hollow and the gorge, each only over its own footprint.
  const each=(minX:number,maxX:number,minZ:number,maxZ:number,fn:(x:number,z:number,i:number)=>void)=>{
    const c0=Math.max(0,Math.floor(minX-g.minX)),c1=Math.min(cols-1,Math.ceil(maxX-g.minX)),r0=Math.max(0,Math.floor(minZ-g.minZ)),r1=Math.min(rows-1,Math.ceil(maxZ-g.minZ));
    for(let r=r0;r<=r1;r++)for(let c=c0;c<=c1;c++)fn(g.minX+c,g.minZ+r,r*cols+c);
  };
  for(const t of TERRACES){const reach=Math.max(t.radii[0],t.radii[1])*(1+t.bank/Math.min(t.radii[0],t.radii[1]))+1;
    each(t.at[0]-reach,t.at[0]+reach,t.at[2]-reach,t.at[2]+reach,(x,z,i)=>{const w=terraceWeight(t,x,z);if(w>0)data[i]=mix(data[i]!,t.level,w);});}
  {const b=RESERVOIR_BOWL,rx=b.radii[0]*2.4,rz=b.radii[1]*2.4;each(b.at[0]-rx,b.at[0]+rx,b.at[1]-rz,b.at[1]+rz,(x,z,i)=>{const bowl=bowlHeight(x,z);if(bowl<Infinity)data[i]=smin(data[i]!,bowl,6);});}
  {let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity;for(const p of GORGE_POINTS){x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);z0=Math.min(z0,p[2]);z1=Math.max(z1,p[2]);}
    each(x0-70,x1+70,z0-70,z1+70,(x,z,i)=>{const river=nearestRiver(x,z);if(river.d<70)data[i]=smin(data[i]!,river.y+channelProfile(river.d,river.wall),3);});}
  // South of z −48 the harbour island owns the ground: the base sits just under it, so a bench
  // there (the road foot's embankment, a platform) can only ever raise the island, never cut it.
  for(let r=0;r<rows;r++){const z=g.minZ+r;if(z<=-48)continue;for(let c=0;c<cols;c++){const x=g.minX+c,i=r*cols+c;data[i]=Math.min(data[i]!,islandHeight(x,z)-.03);}}
  if(typeof process!=='undefined'&&process.env?.HEARTH_TERRAIN_TIMING)console.info('base bake',{macro:t1-t0,shape:t2-t1,detail:performance.now()-t2});
  return g;
}
export const BASE_GRID:HeightGrid=bakeBase();
/** Ground before the exact road, path and foundation benches. */
export const baseHeight=(x:number,z:number)=>sampleGrid(BASE_GRID,x,z);
