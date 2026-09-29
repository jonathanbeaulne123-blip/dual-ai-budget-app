/**
 * Road markings (ROAD.md §4.2): flat painted decals on the deck that follow the corridor's stations, never a stretched
 * texture. Warm white `#efe7d2`; a card builder bucket ('flat', polygon-offset) merged per card cell; the runtime gives
 * them their own material so they can take the night chalk (`runtime/corridorArt.ts setNight`).
 *
 *  - centreDash: 3 on / 6 off by default (`dash`), `width` 0.12, along [from, to] at `offset`.
 *  - centreSolid / edgeLine: continuous along [from, to] at `offset`.
 *  - giveWay: two rows of short dashes (0.6 on / 0.3 off) across `span` at `from` (rows `width` deep, 0.3 apart).
 *  - stopBar: one solid bar across `span`, `width` deep along the road, at `from`.
 *  - zebra: bars 0.5 across with 0.5 gaps over `span`, each running along the road from `from` to `to` (3 eu).
 * `span` holds SIGNED lateral offsets (o > 0 right of increasing s), any order. Every piece is kept inside the paved
 * carriageway of the station it lies on (clipped to ±paved − 0.05), so paint never runs onto a kerb or verge.
 */
import type {MarkingRun} from '../../land/corridor/types.ts';
import type {CardBuilder,RGB} from '../../../art/cardScene.ts';
import {corridorSampler,type CorridorSampler} from './frames.ts';

export const MARKING=Object.freeze({lift:.018,dash:[3,6] as const,giveWay:{on:.6,off:.3,rows:2,gap:.3},zebra:{bar:.5,gap:.5},step:1.5,inset:.05});
/** Deck height under a point (the finished surface); the station line's height when absent. */
export type DeckHeight=(x:number,z:number,fallback:number)=>number;

type Quad=[[number,number,number],[number,number,number],[number,number,number],[number,number,number]];
/** The quads (world corners) a marking run paints: pure, for tests and for the builder. */
export function markingQuads(run:MarkingRun,f:CorridorSampler,deckY:DeckHeight=(_x,_z,y)=>y):Quad[]{
  const out:Quad[]=[];
  const clampO=(s:number,o:number)=>{const st=f.station(s),lim=(o>=0?st.right.paved:st.left.paved)-MARKING.inset;return Math.max(-(st.left.paved-MARKING.inset),Math.min(st.right.paved-MARKING.inset,Math.sign(o)*Math.min(Math.abs(o),lim)));};
  const P=(s:number,o:number):[number,number,number]=>{const oc=clampO(s,o),q=f.point(s,oc);return [q[0],deckY(q[0],q[2],q[1])+MARKING.lift,q[2]];};
  /** A strip along s from a to b between lateral offsets o0 < o1, subdivided so it follows curves and grades. */
  const along=(a:number,b:number,o0:number,o1:number)=>{const L=b-a;if(L<=1e-3)return;const n=Math.max(1,Math.ceil(L/MARKING.step));
    for(let k=0;k<n;k++){const s0=a+L*k/n,s1=a+L*(k+1)/n;out.push([P(s0,o0),P(s1,o0),P(s1,o1),P(s0,o1)]);}};
  const lo=Math.min(run.from,run.to),hi=Math.max(run.from,run.to),w=run.width/2;
  const span=run.span?[Math.min(run.span[0],run.span[1]),Math.max(run.span[0],run.span[1])] as const:[run.offset-w,run.offset+w] as const;
  switch(run.kind){
    case 'centreDash':{const [on,off]=run.dash??MARKING.dash;for(let s=lo;s<hi-1e-3;s+=on+off)along(s,Math.min(hi,s+on),run.offset-w,run.offset+w);break;}
    case 'centreSolid':case 'edgeLine':along(lo,hi,run.offset-w,run.offset+w);break;
    case 'stopBar':along(lo,lo+Math.max(run.width,.3),span[0],span[1]);break;
    case 'giveWay':{const g=MARKING.giveWay,depth=Math.max(.2,Math.min(run.width,.4));
      for(let r=0;r<g.rows;r++){const s0=lo+r*(depth+g.gap);for(let o=span[0];o<span[1]-1e-3;o+=g.on+g.off)along(s0,s0+depth,o,Math.min(span[1],o+g.on));}break;}
    case 'zebra':{const z=MARKING.zebra,len=Math.max(hi-lo,1);for(let o=span[0];o<span[1]-1e-3;o+=z.bar+z.gap)along(lo,lo+len,o,Math.min(span[1],o+z.bar));break;}
  }
  return out;
}
/** Paint a corridor's marking runs into a builder's 'flat' bucket (one merged draw per cell). */
export function buildMarkings(b:CardBuilder,runs:readonly MarkingRun[],f:CorridorSampler,color:RGB,deckY?:DeckHeight,filter:(run:MarkingRun,q:Quad)=>boolean=()=>true){
  let quads=0;
  for(const run of runs)for(const q of markingQuads(run,f,deckY)){if(!filter(run,q))continue;b.quad(q[0],q[1],q[2],q[3],color,'flat');quads++;}
  return quads;
}
export {corridorSampler};
