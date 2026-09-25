/** Assembles the final ground from the base landform and every bench line and pad. */
import {bakeFinal,sampleGrid,type BenchLine,type BenchPad} from './terrain.ts';
import {ROAD_CENTRE,ORCHARD_LANE_CENTRE,ORCHARD_LANE_HALF_WIDTH} from './roadLine.ts';
import {BRIDGE_SPANS,ROAD_HALF_WIDTH} from './bridges.ts';
import {EXTRA_BENCH_LINES,EXTRA_BENCH_PADS} from './benches.ts';

const skips=(line:'road'|'lane')=>BRIDGE_SPANS.filter(b=>b.line===line).map(b=>[b.s0+1.5,b.s1-1.5] as const);
export const BENCH_LINES:readonly BenchLine[]=[
  {id:'road',points:ROAD_CENTRE,halfWidth:ROAD_HALF_WIDTH,shoulder:1.2,slope:1,inset:.12,skip:skips('road'),priority:2},
  {id:'orchard-lane',points:ORCHARD_LANE_CENTRE,halfWidth:ORCHARD_LANE_HALF_WIDTH,shoulder:1,slope:1,inset:.12,skip:skips('lane'),priority:1},
  ...EXTRA_BENCH_LINES,
];
export const BENCH_PADS:readonly BenchPad[]=EXTRA_BENCH_PADS;
const baked=bakeFinal(BENCH_LINES,BENCH_PADS);
export const GROUND_GRID=baked.grid;
export const GROUND_CONFLICTS=baked.conflicts;
export const GROUND_CONFLICT_CELLS=baked.conflictCells;
/** Final mountain ground (terrain only; decks are surfaces). */
export const mountainGround=(x:number,z:number)=>sampleGrid(GROUND_GRID,x,z);
