/**
 * The road, the lane, their edges, the paths, the stairs and the overlooks, as painted card.
 *
 *  - The road is a swept slab from `MOUNTAIN_ROAD_LINE`: a worn surface with a paler centre
 *    line and grassy verges, a cut side with real thickness (down to the ground on
 *    embankments), ink on its cut edges.
 *  - `kerb` edges get a stone kerb; `parapet` edges a dressed stone wall about 1.0 high with
 *    a 0.15 coping, piers at its ends; `wall` edges the retaining walls of
 *    `RETAINING_WALLS_ROAD` as stacked-stone card with pencil joints and a coping.
 *  - Paths are worn gravel strips with edge stones; stairs are real risers with cheek walls
 *    and a handrail; overlooks get a flagged platform and a rail.
 * Bridges are drawn by `bridgeArt.ts`; the deck bands match so the road runs on continuously.
 */
import {groundHeightAt} from '../../scene/ground.ts';
import {MOUNTAIN_ROAD_LINE,ORCHARD_LANE_LINE,RETAINING_WALLS_ROAD,OVERLOOKS,DISTRICTS,type RoadLine,type RoadSample,type Point3} from '../definition.ts';
import {PATH_EDGES} from '../pathGraph.ts';
import {CardBuilder,shade,mix,inkLift,type RGB,type V3} from '../../art/cardScene.ts';
import {hash2} from '../../art/cardKit.ts';
import type {MountainArtPalette} from './palette.ts';

const UP:V3=[0,1,0];
type Frame={p:V3;side:V3;up:V3};
const SURFACE_LIFT=.05;
/** The painted road surface bands (across, left to right in the sample's normal frame). */
export const ROAD_BANDS=(hw:number)=>[[-hw,SURFACE_LIFT],[-hw+.55,SURFACE_LIFT],[-.45,SURFACE_LIFT],[.45,SURFACE_LIFT],[hw-.55,SURFACE_LIFT],[hw,SURFACE_LIFT]] as const;
export function roadBandColour(pal:MountainArtPalette,k:number,i:number):RGB{
  const g=.97+hash2(i>>2,k)*.06;
  return shade(k===0||k===4?mix(pal.road,pal.verge,.45):k===2?mix(pal.road,pal.chalk,.12):pal.road,g);
}
const edgePoint=(s:RoadSample,sign:number,extra=0):V3=>[s.at[0]+s.normal[0]*(s.halfWidth+extra)*sign,s.at[1],s.at[2]+s.normal[2]*(s.halfWidth+extra)*sign];

/** Contiguous runs of sample indices satisfying `keep`, stepping by `step`. */
function runs(n:number,keep:(i:number)=>boolean,step:number):number[][]{
  const out:number[][]=[];let cur:number[]=[];
  for(let i=0;i<n;i++){if(keep(i)){if(!cur.length||i-cur[cur.length-1]!>=step||i===n-1||!keep(i+1))cur.push(i);}else if(cur.length){out.push(cur);cur=[];}}
  if(cur.length)out.push(cur);return out.filter(r=>r.length>1);
}

function roadLine(b:CardBuilder,pal:MountainArtPalette,line:RoadLine,step:number){
  const S=line.samples;
  for(const run of runs(S.length,i=>S[i]!.support!=='bridge',step)){
    const frames:Frame[]=run.map(i=>({p:S[i]!.at as V3,side:S[i]!.normal as V3,up:UP}));
    // Surface.
    b.sweep(frames,i=>ROAD_BANDS(S[run[i]!]!.halfWidth),(k,i)=>roadBandColour(pal,k,run[i]!),{bucket:'flat'});
    // Cut sides down to the ground (earth on open edges, dressed stone where guarded).
    for(const sign of [1,-1] as const){
      const side=sign>0?'left':'right';
      const col=(i:number)=>{const k=S[run[i]!]![side];return k==='parapet'||k==='wall'?pal.stoneDark:k==='kerb'?pal.stone:mix(pal.verge,pal.road,.3);};
      b.sweep(frames,i=>{const s=S[run[i]!]!,e=edgePoint(s,sign,.35),g=groundHeightAt(e[0],e[2])-s.at[1];return [[sign*s.halfWidth,Math.min(-.38,g-.3)],[sign*s.halfWidth,SURFACE_LIFT]];},(_k,i)=>col(i),{bucket:'card',foot:[0]});
      for(let i=1;i<run.length;i++){const a=edgePoint(S[run[i-1]!]!,sign),c=edgePoint(S[run[i]!]!,sign);b.line(inkLift([a[0],a[1]+SURFACE_LIFT,a[2]]),inkLift([c[0],c[1]+SURFACE_LIFT,c[2]]));}
    }
    // Pencil slab joints across the road every few units, a painted card road not a ribbon.
    for(let k=0;k<run.length;k+=Math.max(1,Math.round(6/step))){const s=S[run[k]!]!;b.line(inkLift(edgePoint(s,1,-.55).map((v,j)=>j===1?v+SURFACE_LIFT:v) as V3),inkLift(edgePoint(s,-1,-.55).map((v,j)=>j===1?v+SURFACE_LIFT:v) as V3),b.pencil);}
  }
  edges(b,pal,line,step);
}

/** Kerbs and parapets along a road line's guarded edges. */
function edges(b:CardBuilder,pal:MountainArtPalette,line:RoadLine,step:number){
  const S=line.samples;
  for(const side of ['left','right'] as const){
    const sign=side==='left'?1:-1;
    for(const kind of ['kerb','parapet'] as const){
      for(const run of runs(S.length,i=>S[i]![side]===kind,Math.min(step,2))){
        const frames:Frame[]=run.map(i=>{const s=S[i]!;return {p:edgePoint(s,sign),side:[s.normal[0]*sign,0,s.normal[2]*sign],up:UP};});
        if(kind==='kerb'){
          b.sweep(frames,[[-.02,-.2],[-.02,.22],[.32,.22],[.32,-.45]],k=>k===1?pal.coping:k===0?pal.stone:pal.stoneDark,{inkAt:[1,2]});
          for(let i=0;i<frames.length;i+=Math.max(1,Math.round(1.2/Math.min(step,2)))){const f=frames[i]!;b.line(inkLift([f.p[0],f.p[1]+.22,f.p[2]]),inkLift([f.p[0]+f.side[0]*.32,f.p[1]+.22,f.p[2]+f.side[2]*.32]),b.pencil);}
        }else{
          const drop=(i:number)=>{const s=S[run[i]!]!,e=edgePoint(s,sign,.9);return Math.min(-.35,groundHeightAt(e[0],e[2])-s.at[1]-.3);};
          b.sweep(frames,i=>[[0,-.05],[0,.95],[-.07,.95],[-.07,1.1],[.57,1.1],[.57,.95],[.5,.95],[.5,drop(i)]],
            k=>k===3?pal.coping:k===0?shade(pal.stone,.96):k===6?pal.stoneDark:shade(pal.coping,.82),{inkAt:[3,4],foot:[6]});
          // Coursed stone: a bed joint at mid height and staggered perpends on the road face.
          for(let i=1;i<frames.length;i++){const a=frames[i-1]!,c=frames[i]!;b.line(inkLift([a.p[0],a.p[1]+.48,a.p[2]]),inkLift([c.p[0],c.p[1]+.48,c.p[2]]),b.pencil);}
          for(let i=0;i<frames.length;i++){const f=frames[i]!,lo=i%2?0:.48;b.line([f.p[0]-f.side[0]*.01,f.p[1]+lo,f.p[2]-f.side[2]*.01],[f.p[0]-f.side[0]*.01,f.p[1]+lo+.47,f.p[2]-f.side[2]*.01],b.pencil);}
          // Piers at each end of a run.
          for(const f of [frames[0]!,frames[frames.length-1]!]){const x=f.p[0]+f.side[0]*.25,z=f.p[2]+f.side[2]*.25,yaw=Math.atan2(f.side[0],f.side[2]);
            b.box(x,z,yaw,.42,.42,Math.min(f.p[1]-.3,groundHeightAt(x,z)-.2),f.p[1]+1.25,pal.coping,pal.stone);b.box(x,z,yaw,.5,.5,f.p[1]+1.25,f.p[1]+1.38,pal.coping,shade(pal.coping,.85));}
        }
      }
    }
  }
}

/** Retaining walls: stacked stones in courses, a darker mortar behind, a coping on top. */
function retainingWalls(b:CardBuilder,pal:MountainArtPalette){
  for(const wall of RETAINING_WALLS_ROAD){
    const line=wall.of===ORCHARD_LANE_LINE.id?ORCHARD_LANE_LINE:MOUNTAIN_ROAD_LINE;
    const off=Math.max(0,Math.round((wall.foot.length-wall.top.length)/2));
    for(let k=1;k<wall.top.length;k++){
      const f0=wall.foot[k-1+off]??wall.foot[k-1]!,f1=wall.foot[k+off]??wall.foot[k]!,t0=wall.top[k-1]!,t1=wall.top[k]!;
      const y0=Math.min(f0[1],f1[1])-.3,h0=t0[1]-f0[1]+.3,h1=t1[1]-f1[1]+.3,courses=Math.max(2,Math.round(Math.max(h0,h1)/.5));
      // Mortar backing: the whole face, dark.
      const lean=(p:V3,t:V3,u:number):V3=>[p[0]+(t[0]-p[0])*u,p[1]-.3+(t[1]-p[1]+.3)*u,p[2]+(t[2]-p[2])*u];
      b.quad(lean(f0,t0,0),lean(f1,t1,0),lean(f1,t1,1),lean(f0,t0,1),pal.mortar);
      // Stones: each course split into two or three blocks along the segment, slightly proud.
      const nx=-(f1[2]-f0[2]),nz=f1[0]-f0[0],nl=Math.hypot(nx,nz)||1;
      const toward=((t0[0]-f0[0])*nx+(t0[2]-f0[2])*nz)>0?-1:1,ox=nx/nl*.05*toward,oz=nz/nl*.05*toward;
      for(let c=0;c<courses;c++){
        const u0=c/courses+.012,u1=(c+1)/courses-.012,split=(c%2?.45:.62)+hash2(k,c)*.1;
        for(const [s0,s1] of [[0.01,split-.02],[split+.02,.99]] as const){
          const P=(s:number,u:number):V3=>{const a=lean(f0,t0,u),e=lean(f1,t1,u);return [a[0]+(e[0]-a[0])*s+ox,a[1]+(e[1]-a[1])*s,a[2]+(e[2]-a[2])*s+oz];};
          const tone=shade(pal.stone,.84+hash2(k*3+c,Math.round(s0*10))*.22);
          b.quadV(P(s0,u0),P(s1,u0),P(s1,u1),P(s0,u1),shade(tone,.86),shade(tone,.86),tone,tone);
        }
      }
      // Coping along the top.
      const tt0:V3=[t0[0],t0[1],t0[2]],tt1:V3=[t1[0],t1[1],t1[2]];
      b.beam([tt0[0],tt0[1]+.1,tt0[2]],[tt1[0],tt1[1]+.1,tt1[2]],.8,.24,pal.coping);
      void line;
    }
  }
}

/** Ground paths (worn gravel with edge stones) and stairs (real risers, cheek walls, a rail). */
function paths(b:CardBuilder,pal:MountainArtPalette,tier:'full'|'lite'){
  const woods=DISTRICTS.find(d=>d.id==='library')!;
  for(const e of PATH_EDGES){
    if(e.kind==='path'){
      const pts=resample(e.points,1);
      const frames:Frame[]=pts.map((p,i)=>{const a=pts[Math.max(0,i-1)]!,c=pts[Math.min(pts.length-1,i+1)]!,dx=c[0]-a[0],dz=c[2]-a[2],l=Math.hypot(dx,dz)||1;
        const g=groundHeightAt(p[0],p[2]),y=p[1]-g>.35?p[1]:g;return {p:[p[0],y+.04,p[2]],side:[dz/l,0,-dx/l],up:UP};});
      b.sweep(frames,[[-e.halfWidth,0],[-e.halfWidth+.35,.01],[e.halfWidth-.35,.01],[e.halfWidth,0]],(k,i)=>shade(k===1?pal.gravel:mix(pal.gravel,pal.verge,.5),.95+hash2(i,k)*.08),{bucket:'flat'});
      const every=tier==='full'?1.7:3.4;let next=0,acc=0;
      for(let i=1;i<frames.length;i++){acc+=1;if(acc<next)continue;next=acc+every;const f=frames[i]!,side=(i%2?1:-1)*(e.halfWidth+.12),x=f.p[0]+f.side[0]*side,z=f.p[2]+f.side[2]*side,g=groundHeightAt(x,z);
        b.box(x,z,Math.atan2(f.side[0],f.side[2])+hash2(i,3)*.6,.22+hash2(i,1)*.1,.16,g-.15,g+.14+hash2(i,2)*.08,shade(pal.coping,.92),pal.stone,b.pencil);}
    }else if(e.kind==='stair'){
      const inWoods=Math.hypot(e.points[0]![0]-woods.at[0],e.points[0]![2]-woods.at[2])<45;
      stair(b,pal,e.points,e.halfWidth,inWoods,tier);
    }
  }
}
function resample(points:readonly Point3[],step:number):Point3[]{
  const out:Point3[]=[points[0]!];let carry=0;
  for(let i=1;i<points.length;i++){const a=points[i-1]!,c=points[i]!,l=Math.hypot(c[0]-a[0],c[2]-a[2]);let t=step-carry;
    while(t<l){const u=t/l;out.push([a[0]+(c[0]-a[0])*u,a[1]+(c[1]-a[1])*u,a[2]+(c[2]-a[2])*u]);t+=step;}carry=l-(t-step);}
  out.push(points[points.length-1]!);return out;
}
function stair(b:CardBuilder,pal:MountainArtPalette,points:readonly Point3[],hw:number,timber:boolean,tier:'full'|'lite'){
  const pts=resample(points,.25),L=(pts.length-1)*.25,y0=points[0]![1],y1=points[points.length-1]![1],H=Math.abs(y1-y0),n=Math.max(2,Math.round(H/.3));
  const at=(s:number)=>{const i=Math.max(0,Math.min(pts.length-1,Math.round(s/.25)));return pts[i]!;};
  const up=y1>y0;
  for(let j=0;j<n;j++){
    const s0=j/n*L,s1=(j+1)/n*L,sm=(s0+s1)/2,p=at(sm),a=at(s0),c=at(s1),dx=c[0]-a[0],dz=c[2]-a[2],yaw=Math.atan2(dx,dz);
    // The walked ramp crosses each tread at its middle, so a foot is never more than half a riser off.
    const treadTop=y0+(j+.5)/n*(y1-y0);
    const g=Math.min(groundHeightAt(a[0],a[2]),groundHeightAt(c[0],c[2]),groundHeightAt(p[0],p[2]));
    const len=Math.hypot(dx,dz)/2+.02;
    // Solid steps where the ground is near; a stepped flight on stringers and legs where it falls away.
    const foot=Math.max(g-.3,treadTop-.7);
    if(timber){b.box(p[0],p[2],yaw,hw,len,foot,treadTop-.06,mix(pal.gravel,pal.verge,.3),pal.verge,null);b.box(a[0]+(c[0]-a[0])*(up?.9:.1),a[2]+(c[2]-a[2])*(up?.9:.1),yaw,hw,.12,foot,treadTop,pal.timberLight,pal.timber);}
    else b.box(p[0],p[2],yaw,hw,len,foot,treadTop,shade(pal.coping,.96+hash2(j,7)*.06),pal.stone,b.ink,.7);
    if(foot>g+.2&&j%3===0)for(const s of [-1,1]){const lx=p[0]+Math.cos(yaw)*(hw-.2)*s,lz=p[2]-Math.sin(yaw)*(hw-.2)*s,lg=groundHeightAt(lx,lz);if(foot-lg>.3)b.beam([lx,lg-.3,lz],[lx,foot+.05,lz],.22,.22,timber?pal.timber:pal.stoneDark,null);}
  }
  // Cheek walls and a handrail on one side.
  const frames:Frame[]=resample(points,1).map((p,i,all)=>{const a=all[Math.max(0,i-1)]!,c=all[Math.min(all.length-1,i+1)]!,dx=c[0]-a[0],dz=c[2]-a[2],l=Math.hypot(dx,dz)||1;return {p:[p[0],p[1],p[2]],side:[dz/l,0,-dx/l],up:UP};});
  for(const sign of [-1,1]){
    const f=(i:number)=>{const fr=frames[i]!;return {p:[fr.p[0]+fr.side[0]*(hw+.2)*sign,fr.p[1],fr.p[2]+fr.side[2]*(hw+.2)*sign] as V3,side:fr.side,up:UP};};
    const cheek=frames.map((_,i)=>f(i));
    b.sweep(cheek,i=>{const c=cheek[i]!,g=groundHeightAt(c.p[0],c.p[2])-c.p[1];return [[-.22,Math.max(-.9,Math.min(-.3,g-.25))],[-.22,.42],[.22,.42],[.22,Math.max(-.9,Math.min(-.3,g-.25))]];},k=>k===1?(timber?pal.timberLight:pal.coping):timber?pal.timber:pal.stone,{inkAt:[1,2],foot:[0,2]});
    if(sign>0&&tier==='full'){
      const rail:V3[]=cheek.map(c=>[c.p[0],c.p[1]+1.05,c.p[2]]);b.tube(rail,.045,timber?pal.timber:pal.iron,5);
      for(let i=0;i<cheek.length;i+=3){const c=cheek[i]!;b.post(c.p[0],c.p[2],c.p[1]+.4,c.p[1]+1.05,.05,timber?pal.timber:pal.iron,5,'steel');}
    }
  }
}

/** Overlooks away from the road: a flagged half-round platform with a stone rail. */
function overlooks(b:CardBuilder,pal:MountainArtPalette){
  for(const o of OVERLOOKS){
    if(o.id.startsWith('road:')||o.id.startsWith('dam:'))continue;
    const [x,,z]=o.at,f=o.facing,R=3.2,seg=10;
    const g=(px:number,pz:number)=>groundHeightAt(px,pz);
    const top=Math.max(g(x,z),g(x+Math.sin(f)*R*.8,z+Math.cos(f)*R*.8))+.08;
    const loop:[number,number][]=[];for(let k=0;k<=seg;k++){const a=f-Math.PI/2+k/seg*Math.PI;loop.push([x+Math.sin(a)*R,z+Math.cos(a)*R]);}
    loop.push([x-Math.sin(f)*.2+Math.cos(f)*R,z-Math.cos(f)*.2-Math.sin(f)*R]);loop.push([x-Math.sin(f)*.2-Math.cos(f)*R,z-Math.cos(f)*.2+Math.sin(f)*R]);
    b.prism(loop.reverse(),(px,pz)=>g(px,pz)-.4,top,shade(pal.coping,.97),pal.stone);
    for(let k=1;k<seg;k+=2){const a=f-Math.PI/2+k/seg*Math.PI;b.line(inkLift([x,top,z]),inkLift([x+Math.sin(a)*R,top,z+Math.cos(a)*R]),b.pencil);}
    const rail:Frame[]=[];for(let k=0;k<=seg;k++){const a=f-Math.PI/2+k/seg*Math.PI;rail.push({p:[x+Math.sin(a)*(R-.3),top,z+Math.cos(a)*(R-.3)],side:[Math.sin(a),0,Math.cos(a)],up:UP});}
    b.sweep(rail,[[-.22,-.02],[-.22,.72],[.22,.72],[.22,-.02]],k=>k===1?pal.coping:pal.stone,{inkAt:[1,2]});
  }
}

export function buildRouteArt(b:CardBuilder,pal:MountainArtPalette,tier:'full'|'lite'){
  const step=tier==='full'?1:2;
  roadLine(b,pal,MOUNTAIN_ROAD_LINE,step);
  roadLine(b,pal,ORCHARD_LANE_LINE,step);
  retainingWalls(b,pal);
  paths(b,pal,tier);
  overlooks(b,pal);
}
