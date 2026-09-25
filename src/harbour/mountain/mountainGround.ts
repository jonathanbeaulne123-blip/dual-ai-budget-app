/** Assembles the final ground from the base landform and every bench line and pad. */
import {bakeFinal,sampleGrid,type BenchLine,type BenchPad} from './terrain.ts';
import {ROAD_CENTRE,ORCHARD_LANE_CENTRE,ORCHARD_LANE_HALF_WIDTH} from './roadLine.ts';
import {BRIDGE_SPANS,ROAD_HALF_WIDTH} from './bridges.ts';
import {baseHeight} from './terrainBase.ts';
import {arcLengths,type Point3} from './math.ts';
import {EXTRA_BENCH_LINES,EXTRA_BENCH_PADS} from './benches.ts';

/** A bridge leaves the ground under it untouched only where the ground is well below the deck;
 * toward the abutments the road is benched like any other road (a cut or a fill onto the abutment). */
function skips(line:'road'|'lane',points:readonly Point3[]){
  const s=arcLengths(points,true),out:[number,number][]=[];
  for(const b of BRIDGE_SPANS.filter(b=>b.line===line)){let run:number[]|null=null;
    for(let i=b.i0;i<=b.i1;i++){const p=points[i]!,a=points[Math.max(0,i-1)]!,c=points[Math.min(points.length-1,i+1)]!,dx=c[0]-a[0],dz=c[2]-a[2],l=Math.hypot(dx,dz)||1,hw=line==='road'?ROAD_HALF_WIDTH:3.2;
      let open=true;for(const side of [-1.2,-.6,0,.6,1.2]){if(baseHeight(p[0]+dz/l*hw*side,p[2]-dx/l*hw*side)>p[1]-2.5){open=false;break;}}
      if(open){if(!run)run=[s[i]!,s[i]!];else run[1]=s[i]!;}else if(run){out.push([run[0]!,run[1]!]);run=null;}}
    if(run)out.push([run[0]!,run[1]!]);}
  return out;
}
export const BENCH_LINES:readonly BenchLine[]=[
  {id:'road',points:ROAD_CENTRE,halfWidth:ROAD_HALF_WIDTH,shoulder:1.2,slope:1,inset:.02,skip:skips('road',ROAD_CENTRE),priority:3},
  {id:'orchard-lane',points:ORCHARD_LANE_CENTRE,halfWidth:ORCHARD_LANE_HALF_WIDTH,shoulder:1,slope:1,inset:.02,skip:skips('lane',ORCHARD_LANE_CENTRE),priority:2},
  ...EXTRA_BENCH_LINES,
];
export const BENCH_PADS:readonly BenchPad[]=EXTRA_BENCH_PADS;
const baked=bakeFinal(BENCH_LINES,BENCH_PADS,true);
export const GROUND_GRID=baked.grid;
export const GROUND_CONFLICTS=baked.conflicts;
export const GROUND_CONFLICT_CELLS=baked.conflictCells;
/** Final mountain ground (terrain only; decks are surfaces). */
export const mountainGround=(x:number,z:number)=>sampleGrid(GROUND_GRID,x,z);
