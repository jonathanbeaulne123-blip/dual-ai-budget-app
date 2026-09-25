/**
 * Where lines cross over one another: the funicular's viaducts over the road (the road's
 * underpasses) and the lane's bridge over the funicular. Stacked-surface proofs, as data.
 */
import {FUNICULAR_LINE} from './transport.ts';
import {MOUNTAIN_ROAD_LINE,ORCHARD_LANE_LINE,GORGE_BRIDGES,type Bridge} from './roads.ts';
import {mountainGround} from './mountainGround.ts';
import {CANAL_BRIDGE,TOWN_LANE_DECK} from './course.ts';
import type {Point3} from './math.ts';

export type Crossing={id:string;over:'funicular'|'road'|'lane';under:'funicular'|'road'|'lane';at:Point3;overY:number;underY:number;clearance:number};
const FUNICULAR_DECK=1,ROAD_DECK=1.2;
function crossings():Crossing[]{
  const out:Crossing[]=[];
  for(const [name,line] of [['road',MOUNTAIN_ROAD_LINE],['lane',ORCHARD_LANE_LINE]] as const){
    let run:{p:Point3;q:Point3;d:number}[]=[];
    const flush=()=>{if(!run.length)return;const best=run.reduce((m,r)=>r.d<m.d?r:m);const over=best.p[1]>best.q[1];
      out.push({id:`${over?'funicular-over':`${name}-over`}-${name}:${out.length}`,over:over?'funicular':name,under:over?name:'funicular',at:[best.p[0],Math.min(best.p[1],best.q[1]),best.p[2]],overY:Math.max(best.p[1],best.q[1]),underY:Math.min(best.p[1],best.q[1]),
        clearance:Math.abs(best.p[1]-best.q[1])-(over?FUNICULAR_DECK:ROAD_DECK)});run=[];};
    for(const p of FUNICULAR_LINE.path){
      let d=Infinity,q:Point3=p;for(const s of line.samples){const e=Math.hypot(s.at[0]-p[0],s.at[2]-p[2]);if(e<d){d=e;q=s.at;}}
      if(d<line.samples[0]!.halfWidth+1.5)run.push({p,q,d});else flush();
    }
    flush();
  }
  return out;
}
export const TRANSPORT_CROSSINGS:readonly Crossing[]=crossings();
/** Every bridge object: the gorge bridges, the funicular's viaducts over the road and the town canal bridge. */
export const BRIDGES:readonly Bridge[]=[
  ...GORGE_BRIDGES.map(b=>({...b,crosses:[...b.crosses,...TRANSPORT_CROSSINGS.filter(c=>c.under==='funicular'&&(b.carries==='road'||b.carries==='lane')&&b.deck.some(p=>Math.hypot(p[0]-c.at[0],p[2]-c.at[2])<4)).map(()=>'funicular')]})),
  ...TRANSPORT_CROSSINGS.filter(c=>c.over==='funicular').map((c,i):Bridge=>{
    const k=FUNICULAR_LINE.path.findIndex(p=>Math.hypot(p[0]-c.at[0],p[2]-c.at[2])<.6),deck=FUNICULAR_LINE.path.slice(Math.max(0,k-14),k+15);
    const a=deck[0]!,b=deck[deck.length-1]!,type=c.at[2]<-195?'metal-glass' as const:'timber' as const;
    return {id:`funicular-viaduct-${i}`,name:'Funicular viaduct',type,carries:'funicular',s0:0,s1:0,a,b,span:Math.hypot(b[0]-a[0],b[2]-a[2]),deckThickness:FUNICULAR_DECK,clearance:c.clearance,
      piers:[a,b].map(p=>[p[0],mountainGround(p[0],p[2]),p[2]] as Point3),crosses:[c.under],halfWidth:1.8,deck};
  }),
  {id:CANAL_BRIDGE.id,name:CANAL_BRIDGE.name,type:CANAL_BRIDGE.type,carries:'race-lane',s0:0,s1:0,a:CANAL_BRIDGE.a,b:CANAL_BRIDGE.b,
    span:CANAL_BRIDGE.span,deckThickness:.5,clearance:.6,piers:[],crosses:['town-channel'],halfWidth:CANAL_BRIDGE.halfWidth,deck:TOWN_LANE_DECK},
];
