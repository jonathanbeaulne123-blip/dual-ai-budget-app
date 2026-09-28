/**
 * Mountain v2's walk graph (`mountain/pathGraph.ts MOUNTAIN_PATH_GRAPH`) in Horizon space, as the extra graph
 * `world/pathGraph.ts withExtraGraph` / `buildPathGraph(cuts, intersections, extraGraph)` joins to the Horizon's.
 *
 * Ids are prefixed `v2:` (unique against the Horizon's `path:x:y:z` junctions). Kinds map onto the Horizon's bed kinds so
 * `walkPlan`'s filters apply unchanged: road → road, path → trail, stair → stair (dropped by a step-free plan), bridge →
 * boardwalk, promenade → walk. Nodes: stations stay stations; the observatory and pavilion doors stay doors (both drawn);
 * the four tool buildings' doors are plain junctions (D-M9: not drawn, their terraces are open shelves).
 *
 * Seams (D-M4, brief §3 T2.4): the road foot joins the nearest Horizon node within 6 m (V03's end; before T1's re-bake
 * lands it falls back to the nearest node within 120 m, recorded as a `fallback` join); the summit (the summit overlook and
 * the observatory's door) joins the launch deck / the Crown walk remnant, the nearest node within 60 m; the Foot terrace's
 * quay and north lane join the lake-shore walk within 40 m.
 */
import {MOUNTAIN_PATH_GRAPH} from '../../../mountain/definition.ts';
import type {ExtraPathGraph} from '../../world/pathGraph.ts';
import type {BedCut} from '../../land/interfaces.ts';
import {toHorizonXYZ} from './placement.ts';

const KIND:Record<string,BedCut['kind']>={road:'road',path:'trail',stair:'stair',bridge:'boardwalk',promenade:'walk'};
const SURFACE:Record<string,string>={road:'paved',path:'gravel',stair:'paved',bridge:'boardwalk',promenade:'paved'};
const DRAWN_DOORS=new Set(['door:pavilion','door:observatory']);
export const REGION_GRAPH_ID='v2';
export const regionNodeId=(id:string)=>`v2:${id}`;
/** The named joins to the Horizon graph (native node ids). */
export const REGION_SEAMS:readonly {node:string;reach:number;fallback?:number}[]=[
  {node:'road:foot',reach:6,fallback:120},
  {node:'overlook:summit',reach:60},
  {node:'door:observatory',reach:60},
  {node:'town:quay',reach:40},
  {node:'town:north',reach:40},
];
let cached:ExtraPathGraph|undefined;
export function regionPathGraph():ExtraPathGraph{
  return cached??={
    id:REGION_GRAPH_ID,
    nodes:MOUNTAIN_PATH_GRAPH.nodes.map(n=>({id:regionNodeId(n.id),at:toHorizonXYZ(n.at),kind:n.kind==='station'?'station' as const:n.kind==='door'&&DRAWN_DOORS.has(n.id)?'door' as const:'junction' as const})),
    edges:MOUNTAIN_PATH_GRAPH.edges.map(e=>({id:regionNodeId(e.id),from:regionNodeId(e.from),to:regionNodeId(e.to),points:e.points.map(p=>toHorizonXYZ(p)),kind:KIND[e.kind]??'trail',surface:SURFACE[e.kind]??'gravel',halfWidth:e.halfWidth})),
    seams:REGION_SEAMS.map(s=>({...s,node:regionNodeId(s.node)})),
  };
}
