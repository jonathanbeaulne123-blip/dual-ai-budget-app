/**
 * Guard kits (ROAD.md §4.4; STYLE §3.1 Parapet; Mountain v2 `routeArt` parapet). The visible rail is built from the
 * GuardRun's `line` — the same line its collider (`corridorGuard`, L2) is built from — and never reaches beyond that line
 * ± `GUARD_KIT[kind].half` (its envelope), so the rail you see and the rail you hit are one object (CONTRACT §2.4).
 *
 *  - stoneParapet (0.95 + a 0.15 coping): coursed dressed stone with a chalked coping, bed joints and staggered
 *    perpends on the road face, the outer face carried down to the ground below the drop, piers every 12 eu and at the
 *    run's ends (rising above the coping with a cap) — Mountain v2's parapet, centred on the guard line.
 *  - postRail (0.85): timber posts every 2.5 eu (5 on lite), a top rail with a steel band on its road face and a mid rail;
 *    ends buried (the rails ramp down into the ground over the last bay) or flared (a turned-down terminal and a doubled
 *    post). Posts are returned as instances (`GuardPieces.posts`); rails, bands and ends go into the builder.
 * Dressings (STYLE §1.3.4): Classic dressed warm stone / honey timber with iron bands and brass caps; Taylor pastel card
 * blocks with white paper edges (no mortar lines) / rose card posts with washi tape; Newfoundland split granite with
 * irregular joints / weathered posts with white-painted rails and galvanised bands.
 * `bridgeRail` and `retaining` runs are drawn by their structure and by the retaining solid: nothing here.
 */
import type {GuardRun} from '../../land/corridor/types.ts';
import {CORRIDOR} from '../../land/corridor/types.ts';
import {CardBuilder,shade,mix,inkLift,type RGB,type V3} from '../../../art/cardScene.ts';
import {hash2} from '../../../art/cardKit.ts';
import type {RoadKitPalette} from './palette.ts';

/** Half-width of each kit's plan envelope about the guard line. A collider built inside it is inside the visible rail. */
export const GUARD_KIT=Object.freeze({
  stoneParapet:{half:.36,wallHalf:.25,copingHalf:.32,coping:.15,pierEvery:12,pierHalf:.33,pierRise:.18,pierCap:.12,sink:.3},
  postRail:{half:.13,postEvery:2.5,postEveryLite:5,postHalf:.08,railTop:.85,railMid:.45,railW:.09,railH:.16,sink:.35,buriedBay:2.5},
});
export type GuardPost={at:V3;yaw:number;height:number};
export type GuardPieces={posts:GuardPost[]};
type Frame={p:V3;side:V3;tan:V3;s:number};
const UP:V3=[0,1,0];

/** Frames along a guard line: `side` points away from the carriageway (outward), `s` is distance along the line. */
export function guardFrames(run:GuardRun):Frame[]{
  const L=run.line,n=L.length;if(n<2)return [];
  // The line runs from `from` to `to`; the carriageway is on the left of a right-side run walking increasing s.
  const forward=run.to>=run.from,out=(run.side==='right')===forward?1:-1;
  const frames:Frame[]=[];let s=0;
  for(let i=0;i<n;i++){
    const a=L[Math.max(0,i-1)]!,c=L[Math.min(n-1,i+1)]!,dx=c[0]-a[0],dz=c[2]-a[2],l=Math.hypot(dx,dz)||1,tx=dx/l,tz=dz/l;
    if(i>0)s+=Math.hypot(L[i]![0]-L[i-1]![0],L[i]![2]-L[i-1]![2]);
    frames.push({p:[L[i]![0],L[i]![1],L[i]![2]],side:[-tz*out,0,tx*out],tan:[tx,0,tz],s});
  }
  return frames;
}
/** A point at arc length s along the frames (linear), with its frame. */
function along(F:Frame[],s:number):Frame{
  if(s<=0)return F[0]!;const last=F[F.length-1]!;if(s>=last.s)return last;
  let lo=0,hi=F.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(F[m]!.s<=s)lo=m;else hi=m;}
  const a=F[lo]!,b=F[hi]!,u=(s-a.s)/Math.max(1e-9,b.s-a.s),P=(k:number)=>a.p[k]!+(b.p[k]!-a.p[k]!)*u;
  return {p:[P(0),P(1),P(2)],side:a.side,tan:a.tan,s};
}
const W=(f:Frame,across:number,up:number):V3=>[f.p[0]+f.side[0]*across,f.p[1]+up,f.p[2]+f.side[2]*across];
const yawOf=(f:Frame)=>Math.atan2(f.side[0],f.side[2]);

export type GuardOptions={tier:'full'|'lite';/** Ground under a point (for the outer face over a drop); the line's own height when absent. */ground?:(x:number,z:number)=>number};

function stoneParapet(b:CardBuilder,pal:RoadKitPalette,run:GuardRun,F:Frame[],o:GuardOptions){
  const K=GUARD_KIT.stoneParapet,h=run.height||CORRIDOR.stoneParapetHeight,top=h+K.coping,full=o.tier==='full';
  const ground=(p:V3)=>o.ground?o.ground(p[0],p[2]):p[1];
  const outerFoot=(f:Frame)=>{const e=W(f,K.wallHalf+.25,0);return Math.min(-K.sink,ground(e)-f.p[1]-.2);};
  const stone=pal.stone,dark=pal.stoneDark,coping=pal.theme==='taylor'?pal.paperEdge:pal.coping;
  const path=F.map(f=>({p:f.p,side:f.side,up:UP}));
  // Profile across (outward +), up: road face, coping (overhang both sides), outer face down to the ground.
  // A plinth course on the road side reaches back to the paved edge (the guard line sits CORRIDOR.guardSetback beyond it),
  // so no strip of verge or void shows between the deck and the wall.
  // The wall is set asymmetrically about the guard line: its road face stands at the paved edge (the line sits
  // CORRIDOR.guardSetback beyond it), so the deck meets the wall with no verge strip, ledge or void between them; its outer
  // face stays inside the envelope. The collider (a thin panel on the line) is inside the stone either way.
  const inner=Math.min(K.half,CORRIDOR.guardSetback)-.02,outer=K.wallHalf-.03,ci=inner+.03,co=outer+.06;
  b.sweep(path,i=>[[-inner,-K.sink],[-inner,h],[-ci,h],[-ci,top],[co,top],[co,h],[outer,h],[outer,outerFoot(F[i]!)]],
    k=>k===3?coping:k===0?shade(stone,.97):k===6?dark:k===1||k===5?shade(coping,.72):shade(coping,.84),{inkAt:full?[3,4]:[3],foot:[0,6]});
  // Coursing on the road face: a bed joint at mid height and staggered perpends (Classic, Newfoundland); Taylor card
  // blocks read by their white paper edges instead (no mortar lines).
  const joint:RGB=pal.theme==='taylor'?pal.paperEdge:pal.theme==='newfoundland'?pal.mortar:b.pencil,face=-inner-.012;
  if(full){
    const mid=h*.5;for(let i=1;i<F.length;i++)b.line(W(F[i-1]!,face,mid),W(F[i]!,face,mid),joint);
    const L=F[F.length-1]!.s;let s=.6,k=0;
    while(s<L-.3){const lo=k%2?0:mid,f=along(F,s);b.line(W(f,face,lo+.02),W(f,face,lo+mid-.02),joint);
      s+=pal.theme==='newfoundland'?.7+hash2(k,11)*.8:1.1;k++;}
  }
  // Piers: every 12 eu and at both ends (unless the run continues into another structure).
  const L=F[F.length-1]!.s,n=Math.max(1,Math.round(L/K.pierEvery)),ends=run.ends;
  const pier=(f:Frame,big:boolean)=>{const x=f.p[0],z=f.p[2],yaw=yawOf(f),ph=big?K.pierHalf:K.pierHalf-.02,foot=Math.min(f.p[1]-K.sink,ground([x,0,z] as V3)-.2);
    b.box(x,z,yaw,ph,ph,foot,f.p[1]+top+K.pierRise,shade(coping,.97),stone);b.box(x,z,yaw,ph,ph,f.p[1]+top+K.pierRise,f.p[1]+top+K.pierRise+K.pierCap,coping,shade(coping,.85));
    if(pal.theme==='taylor')b.box(x,z,yaw,ph*.55,.012+ph,f.p[1]+top*.55,f.p[1]+top*.55+.16,pal.tape[0]!,pal.tape[0]!,null);};
  for(let k=0;k<=n;k++){const s=L*k/n,end=k===0?ends[0]:k===n?ends[1]:null;
    if(end==='continues')continue;
    if(end==='abutment'){const f=along(F,Math.min(L-K.half,Math.max(K.half,s)));b.box(f.p[0],f.p[2],yawOf(f),K.half,K.half,f.p[1]-K.sink-.3,f.p[1]+top+.05,pal.coping,dark);continue;}
    pier(along(F,Math.min(L-K.pierHalf,Math.max(K.pierHalf,s))),end==='pier');}
  // A soft dark foot where the wall meets the verge (STYLE §1.2 rule 3: sun-independent, ≤ 0.6 eu).
}

/** Rail height factor along a post-and-rail run: 1, ramping down into the ground over the last bay of a buried end. */
function railFactor(run:GuardRun,L:number){
  const K=GUARD_KIT.postRail,[e0,e1]=run.ends;
  return (s:number)=>{let k=1;if(e0==='buried')k=Math.min(k,s/K.buriedBay);if(e1==='buried')k=Math.min(k,(L-s)/K.buriedBay);return Math.max(-.08,Math.min(1,k));};
}
/** The posts of a post-and-rail run (pure: the runtime instances them, tests measure them). */
export function railPosts(run:GuardRun,tier:'full'|'lite'):GuardPost[]{
  if(run.kind!=='postRail')return [];
  const F=guardFrames(run);if(F.length<2)return [];
  const K=GUARD_KIT.postRail,h=run.height||CORRIDOR.postRailHeight,L=F[F.length-1]!.s,railK=railFactor(run,L);
  const every=tier==='full'?K.postEvery:K.postEveryLite,n=Math.max(1,Math.round(L/every)),posts:GuardPost[]=[];
  for(let k=0;k<=n;k++){const s=L*k/n,f=along(F,s),rk=railK(s);if(rk<.2)continue;posts.push({at:[f.p[0],f.p[1],f.p[2]],yaw:yawOf(f),height:Math.max(.3,h*rk+.08)});}
  for(const [end,dir] of [[run.ends[0],1],[run.ends[1],-1]] as const)if(end==='flare'){const q=along(F,dir>0?.3:L-.3);posts.push({at:[q.p[0],q.p[1],q.p[2]],yaw:yawOf(q),height:h+.08});}
  return posts;
}

function postRail(b:CardBuilder,pal:RoadKitPalette,run:GuardRun,F:Frame[],o:GuardOptions,pieces:GuardPieces){
  const K=GUARD_KIT.postRail,h=run.height||CORRIDOR.postRailHeight,full=o.tier==='full',L=F[F.length-1]!.s,railK=railFactor(run,L);
  pieces.posts.push(...railPosts(run,o.tier));
  const step=Math.max(.5,Math.min(2.5,L/Math.max(1,Math.ceil(L/2.5))));
  // A flared end: the straight rails stop at the terminal (0.9 in) and the top rail turns down to the end.
  const s0=run.ends[0]==='flare'?Math.min(L/2,.9):0,s1=run.ends[1]==='flare'?Math.max(L/2,L-.9):L;
  const S:number[]=[];for(let s=s0;s<s1-1e-6;s+=step)S.push(s);S.push(s1);
  const railAt=(y:number)=>S.map(s=>{const f=along(F,s),rk=railK(s);return {f,y:f.p[1]+Math.max(-.05,y*rk)};});
  const beamRun=(pts:{f:Frame;y:number}[],w:number,hh:number,col:RGB,across=0)=>{for(let i=1;i<pts.length;i++){const a=pts[i-1]!,c=pts[i]!;b.beam([a.f.p[0]+a.f.side[0]*across,a.y,a.f.p[2]+a.f.side[2]*across],[c.f.p[0]+c.f.side[0]*across,c.y,c.f.p[2]+c.f.side[2]*across],w,hh,col,full?b.ink:null);}};
  const top=railAt(h-K.railH/2);beamRun(top,K.railW*2,K.railH,pal.rail);
  beamRun(railAt(K.railMid),K.railW*1.6,K.railH*.8,shade(pal.rail,.94));
  // The steel band on the top rail's road face (Classic iron, Taylor washi tape, Newfoundland galvanised).
  if(full){const band=top.map(q=>({f:q.f,y:q.y+.01}));beamRun(band,.02,K.railH*.55,pal.railBand,-(K.railW+.012));}
  // Flared ends: the top rail turns down into the verge over the end bay (inside the run's line), beside a doubled post.
  for(const [end,dir] of [[run.ends[0],1],[run.ends[1],-1]] as const){if(end!=='flare')continue;
    const e=dir>0?F[0]!:F[F.length-1]!,q=along(F,dir>0?s0:s1);
    b.beam([q.p[0],q.p[1]+h-K.railH/2,q.p[2]],[e.p[0],e.p[1]-.02,e.p[2]],K.railW*2,K.railH,pal.rail,null);}
}

/** Build one guard run's visible kit. Returns the repeated posts (instanced by the caller). */
export function buildGuardRun(b:CardBuilder,pal:RoadKitPalette,run:GuardRun,o:GuardOptions):GuardPieces{
  const pieces:GuardPieces={posts:[]},F=guardFrames(run);if(F.length<2)return pieces;
  if(run.kind==='stoneParapet')stoneParapet(b,pal,run,F,o);
  else if(run.kind==='postRail')postRail(b,pal,run,F,o,pieces);
  return pieces;
}

/** One post-and-rail post as card geometry at the origin (y up, `side` = +z outward), for instancing; height 1. */
export function buildRailPost(b:CardBuilder,pal:RoadKitPalette,tier:'full'|'lite'){
  const K=GUARD_KIT.postRail,ph=K.postHalf,post=pal.railPost;
  // Height 1 from ground (scaled per instance in y); the sink below ground is a fixed 0.35 (scaled with it: harmless).
  b.box(0,0,0,ph,ph,-K.sink,1,shade(post,1.06),post,tier==='full'?b.ink:null,.7);
  if(pal.theme==='classic')b.box(0,0,0,ph+.015,ph+.015,.97,1.02,pal.railCap,shade(pal.railCap,.8),null);
  else if(pal.theme==='taylor'){b.box(0,0,0,ph+.012,ph+.012,.62,.72,pal.tape[0]!,pal.tape[0]!,null);b.box(0,0,0,ph+.02,ph+.02,.98,1.02,pal.paperEdge,pal.paperEdge,null);}
  else b.box(0,0,0,ph+.012,ph+.012,.96,1.02,pal.railCap,shade(pal.railCap,.85),null);
}
export {mix,inkLift};
