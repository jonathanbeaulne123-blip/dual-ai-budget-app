/**
 * The Library re-dress (Scholars' Edge, protos/scholars SPEC "Library re-dress"): a stone plinth, dark
 * board-and-batten walls with corner posts, two parallel steep verdigris roofs (ridges at v = ±d/4, ≈ 50°) with
 * standing seams, copper ridge caps, eave gutters, a valley gutter and downspouts, arched reading-room windows down
 * both long faces, tall arched gable windows, a stone stack with a copper cap, and a verdigris porch canopy on two
 * posts with wall lanterns. Taylor: linen card, vellum windows, mint paper roofs. Newfoundland: silver-grey shingle,
 * galvanised flashing, the verdigris kept as the story's landmark roof.
 * Local frame: x = the long axis (u, NE at yaw π/4), +z = the door face (v, SE).
 */
import {
  box,num,rectOf,facePt,facePanel,windowAt,doorAt,plinth,footShade,walls,roofGable,gableVols,wallLantern,turnedCtx,turnVols,
  stencil,ICON,shade,mix,
  type KindDef,type Plan,type Rect,type Vol,type V3,
} from './core.ts';

type LibPlan=Plan&{r:Rect;wallH:number;rise:number;ov:number;halves:[Rect,Rect];canopy:{rt:Rect;eave:number;rise:number;posts:[number,number][]};stack:[number,number,number,number]};
export const library:KindDef<LibPlan>={
  plan(rec){
    const r=rectOf(rec.size.w/2,rec.size.d/2),wallH=Math.max(3,rec.size.h),hz2=r.hz/2,rise=num(rec,'rise',hz2*1.2),ov=rec.roof.overhang>0?rec.roof.overhang:.9;
    const halves:[Rect,Rect]=[rectOf(r.hx,hz2,0,hz2),rectOf(r.hx,hz2,0,-hz2)];
    // Porch canopy: a small gable whose ridge runs out from the door (planned in the turned frame).
    const cz=r.hz+1.9,rt=rectOf(1.8,1.9,-cz,0),ce=3.7,cr=1.5,posts:[number,number][]=[[-1.6,r.hz+3.4],[1.6,r.hz+3.4]];
    const stack:[number,number,number,number]=[r.hx*.43,-hz2,wallH+rise-2,wallH+rise+2.6];
    const vols:Vol[]=[box(0,0,r.hx+.7,r.hz+.7,'ground',0,'support','stone'),box(0,0,r.hx,r.hz,0,wallH,'wall','timber'),
      ...halves.flatMap(h=>gableVols(h,wallH,rise,ov,ov,'copper')),...turnVols(gableVols(rt,ce,cr,.15,.1,'copper')),
      ...posts.map(([x,z])=>box(x,z,.1,.1,0,ce,'support','timber')),box(stack[0],stack[1],.8,.8,stack[2],stack[3],'wall','stone')];
    return {vols,eave:wallH,top:stack[3]+.3,r,wallH,rise,ov,halves,canopy:{rt,eave:ce,rise:cr,posts},stack};
  },
  draw(c,p){
    const {b,pal,F,floor,full,theme}=c,{r}=p,eave=floor+p.wallH,wall=pal.walls[0]!,cop=pal.copper,V=pal.verdigris;
    plinth(c,r,floor,.7);
    walls(c,r,floor,eave,wall,{battenStep:1.2});
    for(const [sx,sz] of [[-1,-1],[1,-1],[1,1],[-1,1]] as const){const q=F.W(sx*(r.hx-.05),sz*(r.hz-.05),0);b.box(q[0],q[2],F.yaw,.25,.25,floor,eave+.1,pal.trim,shade(pal.trim,.85));}
    // The two roofs, seams and patina, copper ridge caps and gutters.
    for(const [i,h] of p.halves.entries()){
      roofGable(c,h,eave,p.rise,p.ov,{col:V,wall,seams:full?1.4:2.8,seamCol:pal.special.seam??shade(V,.82),finish:theme==='newfoundland'?'fascia':theme==='taylor'?'scallop':'plain',edge:theme==='newfoundland'?pal.galvanised:undefined},p.ov);
      const top=eave+p.rise,R0=F.W(-r.hx-p.ov-.15,h.cz,0);void R0;
      const q=F.W(0,h.cz,0);b.box(q[0],q[2],F.yaw,r.hx+p.ov+.15,.25,top-.12,top+.2,cop,shade(cop,.8),null,.85);
      if(full){const out=i===0?1:-1;for(let k=0;k<5;k++){const x=-r.hx+(k+.5)*(2*r.hx/5)+(c.h(k+i*9)-.5)*3,wd=.6+c.h(k+i*13)*1.1,len=.4+c.h(k+i*17)*.5,z0=h.cz+out*(h.hz+p.ov),y0=eave-p.ov*p.rise/h.hz,P=(xx:number,t:number):V3=>F.W(xx,z0+(h.cz-z0)*t,y0+(top-y0)*t+.03);
        b.quad(P(x-wd/2,0),P(x+wd/2,0),P(x+wd/2,len),P(x-wd/2,len),mix(pal.verdigrisLit,V,.55));}}}
    const gy=eave-p.ov*p.rise/(r.hz/2)-.1;
    for(const sz of [1,-1])b.tube([F.W(-r.hx-p.ov,sz*(r.hz+p.ov-.1),gy),F.W(r.hx+p.ov,sz*(r.hz+p.ov-.1),gy)],.2,cop,full?6:4);
    const vq=F.W(0,0,0);b.box(vq[0],vq[2],F.yaw,r.hx+p.ov,.3,eave-.25,eave+.05,cop,shade(cop,.8),null);
    for(const [sx,sz] of [[-1,-1],[1,-1],[1,1],[-1,1]] as const)b.tube([F.W(sx*(r.hx+.3),sz*(r.hz+p.ov-.1),gy),F.W(sx*(r.hx+.3),sz*(r.hz+p.ov-.1),floor+.1)],.1,cop,4);
    // Stone stack with a copper cap.
    const sq=F.W(p.stack[0],p.stack[1],0);b.box(sq[0],sq[2],F.yaw,.8,.8,floor+p.stack[2],floor+p.stack[3],pal.plinth,pal.plinthDark);b.box(sq[0],sq[2],F.yaw,1,1,floor+p.stack[3],floor+p.stack[3]+.3,cop,shade(cop,.8));
    // Reading-room windows: 8 on the door face (between the porch), 9 on the back; tall arched gable windows.
    for(const u of [-18,-13.5,-9,-4.5,4.5,9,13.5,18].map(u=>u*r.hx/21))windowAt(c,r,'front',u,floor+.9,1.5,Math.min(4.05,p.wallH-1.1),{arch:true,lit:true,surround:.12,sill:true});
    for(const u of [-18,-13.5,-9,-4.5,0,4.5,9,13.5,18].map(u=>u*r.hx/21))windowAt(c,r,'back',u,floor+1.1,1.3,Math.min(3.55,p.wallH-1.4),{arch:true,lit:c.h(Math.round(u*3))>.25,surround:.12});
    for(const f of ['left','right'] as const)for(const u of [-r.hz/2,r.hz/2])windowAt(c,r,f,u,eave-.2,2.2,5.7*Math.min(1,p.rise/9),{arch:true,lit:true,surround:.14,sill:false});
    if(theme==='taylor')for(const f of ['left','right'] as const)stencil(c,r,f,0,eave+p.rise*.55,.35,ICON.star,pal.tape[0]!);
    // Door, porch canopy on posts, lanterns.
    doorAt(c,r,'front',0,floor,2.4,3.5,pal.door,{lit:false});
    const t=turnedCtx(c),cp=p.canopy;
    roofGable(t,cp.rt,floor+cp.eave,cp.rise,.15,{col:V,wall:mix(V,pal.trim,.2),ridge:cop,seams:full?.6:0,seamCol:pal.special.seam},.1);
    const post=pal.special.post??pal.timberDark;for(const [x,z] of cp.posts){const q=F.W(x,z,0);b.post(q[0],q[2],floor,floor+cp.eave,.1,post,6);b.box(q[0],q[2],F.yaw,.2,.2,floor-.05,floor+.12,pal.plinth,pal.plinthDark);}
    b.beam(F.W(-1.6,r.hz+3.4,floor+cp.eave-.1),F.W(1.6,r.hz+3.4,floor+cp.eave-.1),.18,.22,post);
    for(const u of [-2.2,2.2])wallLantern(c,r,'front',u,floor+3,pal.special.lantern);
    footShade(c,rectOf(r.hx+.7,r.hz+.7),0,1.4,.28);
    void facePt;void facePanel;
  },
};
