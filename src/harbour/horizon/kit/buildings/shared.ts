/**
 * Shared kinds used by several neighbourhoods: the octagonal open pavilion with a slate cone roof (the Green's
 * Meadow Pavilion), the bird hide with viewing slots (the Reach's Channel and Marsh Hides), decks and platforms
 * (timber or stone pads with open 1.05 rails; walkable, rails collide as walls), the windpump, a shed, a gate and a
 * terrain-following dry-stone wall.
 */
import {
  box,prism,num,str,flag,rectOf,facePt,facePanel,windowAt,doorAt,plinth,footShade,walls,roofShed,shedVols,openRail,wallLantern,postAt,
  paintOf,pick,groundUnder,stencil,ICON,shade,mix,inkLift,
  type KindDef,type Plan,type DrawCtx,type Rect,type Vol,type V3,type RGB,
  rod,
} from './core.ts';
import {housePlan,houseShell,houseOpenings,type HousePlan} from './house.ts';
import type {Face} from '../../neighbourhoods/types.ts';

const oct=(R:number,y:number,n=8,rot=Math.PI/8):[number,number,number][]=>Array.from({length:n},(_,i)=>{const a=i/n*Math.PI*2+rot;return [Math.cos(a)*R,Math.sin(a)*R,y] as [number,number,number];});
/** The face nearest a local direction angle (0 = +x, π/2 = +z front). */
const openAt=(rec:{door?:{face:Face}})=>{const f=rec.door?.face??'front';return f==='front'?Math.PI/2:f==='back'?-Math.PI/2:f==='right'?0:Math.PI;};

/* ------------------------------------------------------------------ pavilion */
type PavPlan=Plan&{R:number;h:number;open:number;roofR:number;rise:number};
export const pavilion:KindDef<PavPlan>={
  plan(rec){
    const R=Math.min(rec.size.w,rec.size.d)/2,h=Math.max(2.4,rec.size.h),roofR=R+1,rise=num(rec,'rise',2.6),open=openAt(rec),ring=h+.3,eave=h+.65;
    const vols:Vol[]=[prism(oct(R+.5,0),'ground','floor','stone',true)];
    const posts=oct(R,0);for(const [x,z] of posts)vols.push(box(x,z,.15,.15,0,h,'support','timber'));
    for(let i=0;i<8;i++){const a=posts[i]!,e=posts[(i+1)%8]!,mid=Math.atan2((a[1]+e[1])/2,(a[0]+e[0])/2);if(Math.abs(Math.atan2(Math.sin(mid-open),Math.cos(mid-open)))<.4)continue;
      const L=Math.hypot(e[0]-a[0],e[1]-a[1])/2-.15,yaw=Math.atan2(-(e[1]-a[1]),e[0]-a[0]);vols.push(box((a[0]+e[0])/2,(a[1]+e[1])/2,L,.06,0,.9,'rail','timber',false,yaw));}
    const er=oct(roofR,eave);for(let i=0;i<8;i++)vols.push(prism([er[i]!,er[(i+1)%8]!,[0,0,eave+rise]],ring,'roof','slate'));
    return {vols,eave:h,top:eave+rise+.8,R,h,open,roofR,rise};
  },
  draw(c,p){
    const {b,pal,F,floor,full,ground,theme}=c,{R,h}=p,q=F.W(0,0,0),post=theme==='newfoundland'?pal.trim:theme==='taylor'?pal.paperEdge:pal.timber,roof=theme==='taylor'?pick(pal.roofs,1):pal.slate;
    const L=(lx:number,lz:number,y:number)=>F.W(lx,lz,y);
    const g=groundUnder(ground,F,0,0,R+.5,R+.5);
    // Plinth (octagon), posts with stone bases, a ring beam, parapet panels, the cone roof, a finial, the lantern.
    const P8=oct(R+.5,0);for(let i=0;i<8;i++){const a=P8[i]!,e=P8[(i+1)%8]!;b.side(L(a[0],a[1],g.min-.3),L(e[0],e[1],g.min-.3),L(e[0],e[1],floor),L(a[0],a[1],floor),pal.stone);b.tri(L(0,0,floor),L(a[0],a[1],floor),L(e[0],e[1],floor),pal.stoneLit);b.line(inkLift(L(a[0],a[1],floor)),inkLift(L(e[0],e[1],floor)));}
    const posts=oct(R,0);
    for(const [x,z] of posts){const w=F.W(x,z,0);b.box(w[0],w[2],F.yaw,.15,.15,floor,floor+h,post,shade(post,.84));if(full)b.box(w[0],w[2],F.yaw,.22,.22,floor,floor+.3,pal.stoneLit,shade(pal.stoneLit,.8));}
    for(let i=0;i<8;i++){const a=posts[i]!,e=posts[(i+1)%8]!;b.beam(L(a[0],a[1],floor+h+.15),L(e[0],e[1],floor+h+.15),.25,.3,post);
      const mid=Math.atan2((a[1]+e[1])/2,(a[0]+e[0])/2);if(Math.abs(Math.atan2(Math.sin(mid-p.open),Math.cos(mid-p.open)))<.4)continue;
      const panel=theme==='newfoundland'?pick(pal.walls,2):theme==='taylor'?pal.walls[1]!:pal.stoneLit,inset=(t:number)=>[a[0]+(e[0]-a[0])*t,a[1]+(e[1]-a[1])*t] as const,s0=inset(.06),s1=inset(.94);
      b.quad(L(s0[0],s0[1],floor),L(s1[0],s1[1],floor),L(s1[0],s1[1],floor+.9),L(s0[0],s0[1],floor+.9),panel);b.beam(L(s0[0],s0[1],floor+.9),L(s1[0],s1[1],floor+.9),.12,.06,post);
      if(theme==='taylor'&&full)b.decal(L((s0[0]+s1[0])/2,(s0[1]+s1[1])/2,floor+.5),[(e[0]-a[0])/Math.hypot(e[0]-a[0],e[1]-a[1])*F.c+(e[1]-a[1])/Math.hypot(e[0]-a[0],e[1]-a[1])*F.s,0,(e[1]-a[1])/Math.hypot(e[0]-a[0],e[1]-a[1])*F.c-(e[0]-a[0])/Math.hypot(e[0]-a[0],e[1]-a[1])*F.s],[0,1,0],.2,ICON.hearth,pal.tape[0]!);}
    const eave=floor+h+.65,er=oct(p.roofR,eave),apex=L(0,0,eave+p.rise);
    for(let i=0;i<8;i++){const a=er[i]!,e=er[(i+1)%8]!,A=L(a[0],a[1],eave),E=L(e[0],e[1],eave);b.tri(A,E,apex,shade(roof,.84+.2*Math.max(0,-Math.cos(i/8*Math.PI*2+F.yaw-2.6))));b.tri(E,A,[apex[0],apex[1]-.15,apex[2]],shade(roof,.55));b.line(inkLift(A),inkLift(E));b.line(inkLift(A),inkLift(apex));
      if(theme==='newfoundland')b.quad(A,E,[E[0],E[1]-.22,E[2]],[A[0],A[1]-.22,A[2]],pal.trim);
      if(theme==='taylor'){const m=Math.max(2,Math.round(Math.hypot(E[0]-A[0],E[2]-A[2])/.6));for(let k=0;k<m;k++){const t0=k/m,t1=(k+1)/m,tm=(t0+t1)/2,X=(t:number):V3=>[A[0]+(E[0]-A[0])*t,A[1]-.02,A[2]+(E[2]-A[2])*t],M=X(tm);b.tri(X(t0),X(t1),[M[0],M[1]-.25,M[2]],k%2?pal.paperEdge:pal.tape[0]!);}}}
    b.box(q[0],q[2],F.yaw,.25,.25,eave+p.rise-.25,eave+p.rise+.1,pal.brass,shade(pal.brass,.8));b.cone(q[0],q[2],eave+p.rise+.1,eave+p.rise+.8,.2,0,pal.brass,6,'steel');
    b.line([q[0],floor+h+.3,q[2]],[q[0],floor+h-.25,q[2]],pal.iron);b.quad([q[0]-.16,floor+h-.75,q[2]],[q[0]+.16,floor+h-.75,q[2]],[q[0]+.16,floor+h-.25,q[2]],[q[0]-.16,floor+h-.25,q[2]],pal.lamp,'glow');
    b.shadow(q[0],q[2],R+.9,R+.9,0,ground,.3);
  },
};

/* ------------------------------------------------------------------ hide */
type HidePlan=Plan&{r:Rect;wallH:number;rise:number;slots:Face[];open:Face;piles:boolean;slot:[number,number]};
const HIDE_T=.12;
export const hide:KindDef<HidePlan>={
  plan(rec){
    const r=rectOf(rec.size.w/2,rec.size.d/2),wallH=Math.max(1.8,rec.size.h),rise=2*r.hz*Math.tan(.12),slots=str(rec,'slots','front,left').split(',').map(s=>s.trim()).filter(Boolean) as Face[];
    const open=(str(rec,'open','back') as Face),piles=flag(rec,'piles',true),slot:[number,number]=[.78,1.24];
    const vols:Vol[]=[box(0,0,r.hx,r.hz,-.35,0,'deck','boardwalk',true)];
    if(piles)for(const u of [-1,0,1])for(const v of [-1,1])vols.push(box(u*(r.hx-.3),v*(r.hz-.3),.13,.13,'ground',-.35,'support','timber'));else vols.push(box(0,0,r.hx,r.hz,'ground',-.35,'support','stone'));
    for(const f of ['front','back','left','right'] as const){if(f===open)continue;const [cx,cz,hx,hz]=f==='front'?[0,r.hz-HIDE_T/2,r.hx,HIDE_T/2]:f==='back'?[0,-r.hz+HIDE_T/2,r.hx,HIDE_T/2]:f==='right'?[r.hx-HIDE_T/2,0,HIDE_T/2,r.hz]:[-r.hx+HIDE_T/2,0,HIDE_T/2,r.hz];
      if(slots.includes(f)){vols.push(box(cx,cz,hx,hz,0,slot[0],'wall','timber'),box(cx,cz,hx,hz,slot[1],wallH,'wall','timber'));}else vols.push(box(cx,cz,hx,hz,0,wallH,'wall','timber'));}
    vols.push(...shedVols(r,wallH,rise,.25,'shingle'));
    return {vols,eave:wallH,top:wallH+rise+.1,r,wallH,rise,slots,open,piles,slot};
  },
  draw(c,p){
    const {b,pal,F,floor,full,ground,theme}=c,{r,wallH}=p,top=floor+wallH,wall=theme==='classic'?pal.timber:paintOf(c,pal.walls,2);
    const dq=F.W(0,0,0);b.box(dq[0],dq[2],F.yaw,r.hx,r.hz,floor-.35,floor,pal.plank,shade(pal.plank,.65));
    if(p.piles){for(const u of [-1,0,1])for(const v of [-1,1]){const q=F.W(u*(r.hx-.3),v*(r.hz-.3),0);b.post(q[0],q[2],ground(q[0],q[2])-.3,floor-.35,.13,pal.timberDark,6);}}
    else plinth(c,r,floor-.35,0,pal.stone);
    for(const f of ['front','back','left','right'] as const){if(f===p.open)continue;
      const wr=f==='front'?rectOf(r.hx,HIDE_T/2,0,r.hz-HIDE_T/2):f==='back'?rectOf(r.hx,HIDE_T/2,0,-r.hz+HIDE_T/2):f==='right'?rectOf(HIDE_T/2,r.hz,r.hx-HIDE_T/2,0):rectOf(HIDE_T/2,r.hz,-r.hx+HIDE_T/2,0);
      const skin=theme==='classic'?'board':pal.skin;
      if(p.slots.includes(f)){walls(c,wr,floor,floor+p.slot[0],wall,{faces:[f],skin,battenStep:.5});walls(c,wr,floor+p.slot[1],top,wall,{faces:[f],skin,battenStep:.5});
        const sq=F.W(wr.cx,wr.cz,0);const across=f==='front'||f==='back';b.box(sq[0],sq[2],F.yaw,across?wr.hx:.21,across?.21:wr.hz,floor+p.slot[0]-.06,floor+p.slot[0],pal.plank,shade(pal.plank,.8));}
      else walls(c,wr,floor,top,wall,{faces:[f],skin,battenStep:.5});}
    roofShed(c,r,top,p.rise,.25,{col:theme==='classic'?mix(pal.slate,pal.timberDark,.4):pick(pal.roofs,0),wall});
    if(full)for(let i=0;i<5;i++){const q=F.W(-r.hx+.4+i*.25,r.hz+.05,0);b.line([q[0],top-.1,q[2]],[q[0],top-.6-i%2*.2,q[2]],shade(wall,.6));}
    b.shadow(dq[0],dq[2],r.hx+.6,r.hz+.6,F.yaw,ground,.25);
  },
};

/* ------------------------------------------------------------------ deck and platform */
type PadPlan=Plan&{r:Rect;stone:boolean;rails:Face[];railVols:Vol[]};
const railLine=(r:Rect,f:Face):[[number,number],[number,number]]=>{const i=.05;return f==='front'?[[-r.hx+i,r.hz-i],[r.hx-i,r.hz-i]]:f==='back'?[[r.hx-i,-r.hz+i],[-r.hx+i,-r.hz+i]]:f==='right'?[[r.hx-i,r.hz-i],[r.hx-i,-r.hz+i]]:[[-r.hx+i,-r.hz+i],[-r.hx+i,r.hz-i]];};
function padPlan(rec:Parameters<KindDef['plan']>[0],stone:boolean):PadPlan{
  const r=rectOf(rec.size.w/2,rec.size.d/2),rails=str(rec,'rails','front,left,right').split(',').map(s=>s.trim()).filter(s=>s&&s!=='none') as Face[];
  const vols:Vol[]=[box(0,0,r.hx,r.hz,-.35,0,'deck',stone?'paved':'boardwalk',true)];
  if(stone)vols.push(box(0,0,r.hx,r.hz,'ground',-.35,'support','stone'));
  else{const nx=Math.max(1,Math.ceil(r.hx*2/3)),nz=Math.max(1,Math.ceil(r.hz*2/3));for(let i=0;i<=nx;i++)for(let j=0;j<=nz;j++){if(i>0&&i<nx&&j>0&&j<nz)continue;vols.push(box(-r.hx+.2+(r.hx*2-.4)*i/nx,-r.hz+.2+(r.hz*2-.4)*j/nz,.12,.12,'ground',-.35,'support','timber'));}}
  const railVols:Vol[]=rails.flatMap(f=>{const [a,e]=railLine(r,f),L=Math.hypot(e[0]-a[0],e[1]-a[1]),yaw=Math.atan2(e[0]-a[0],e[1]-a[1])-Math.PI/2;return [box((a[0]+e[0])/2,(a[1]+e[1])/2,L/2,.05,0,1.05,'rail','timber',false,yaw)];});
  vols.push(...railVols);
  return {vols,eave:1.05,top:1.1,r,stone,rails,railVols};
}
function padDraw(c:DrawCtx,p:PadPlan){
  const {b,pal,F,floor,full,ground}=c,{r}=p,q=F.W(0,0,0);
  if(p.stone){const g=groundUnder(ground,F,0,0,r.hx,r.hz);b.box(q[0],q[2],F.yaw,r.hx,r.hz,g.min-.35,floor-.12,pal.stone,pal.stoneDark);b.box(q[0],q[2],F.yaw,r.hx+.08,r.hz+.08,floor-.12,floor,pal.stoneLit,shade(pal.stoneLit,.8));
    if(full)for(const f of ['front','back','left','right'] as const){const hl=f==='front'||f==='back'?r.hx:r.hz;for(let y=floor-.55;y>g.min;y-=.42)b.line(facePt(F,r,f,-hl,y,.012),facePt(F,r,f,hl,y,.012),shade(pal.stone,.7));}}
  else{b.box(q[0],q[2],F.yaw,r.hx,r.hz,floor-.35,floor,pal.plank,shade(pal.plank,.62));
    for(let u=-r.hx+.14;u<r.hx;u+=.14*(full?1:2))b.line(F.W(u,r.hz,floor+.01),F.W(u,-r.hz,floor+.01),shade(pal.plank,.72));
    const nx=Math.max(1,Math.ceil(r.hx*2/3)),nz=Math.max(1,Math.ceil(r.hz*2/3));
    for(let i=0;i<=nx;i++)for(let j=0;j<=nz;j++){if(i>0&&i<nx&&j>0&&j<nz)continue;const w=F.W(-r.hx+.2+(r.hx*2-.4)*i/nx,-r.hz+.2+(r.hz*2-.4)*j/nz,0);b.box(w[0],w[2],F.yaw,.12,.12,ground(w[0],w[2])-.3,floor-.35,pal.timberDark,shade(pal.timberDark,.8));}
    if(full)for(const sz of [-1,1])b.beam(F.W(-r.hx,sz*(r.hz-.2),floor-.45),F.W(r.hx,sz*(r.hz-.2),floor-.45),.18,.2,pal.timberDark);}
  for(const f of p.rails){const [a,e]=railLine(r,f);openRail(c,[a,e],floor,{col:p.stone?(c.theme==='classic'?pal.iron:undefined):undefined});}
  b.shadow(q[0],q[2],r.hx+.5,r.hz+.5,F.yaw,ground,.22);
}
export const deck:KindDef<PadPlan>={plan:rec=>padPlan(rec,false),draw:padDraw};
export const platform:KindDef<PadPlan>={plan:rec=>padPlan(rec,true),draw:padDraw};

/* ------------------------------------------------------------------ windpump */
type PumpPlan=Plan&{H:number;b0:number;b1:number;tank:[number,number,number];trough:[number,number]};
export const windpump:KindDef<PumpPlan>={
  plan(rec){
    const H=Math.max(5,rec.size.h),b0=num(rec,'base',1.7),b1=.35,tank:[number,number,number]=[b0+2.5,1.5,1.6],trough:[number,number]=[b0+2.5,4.4];
    const vols:Vol[]=[];
    for(const [sx,sz] of [[-1,-1],[1,-1],[1,1],[-1,1]] as const){vols.push(box(sx*b0,sz*b0,.3,.3,'ground',.2,'support','stone'));for(let k=0;k<3;k++){const t=(k+.5)/3,x=sx*(b0+(b1-b0)*t),z=sz*(b0+(b1-b0)*t);vols.push(box(x,z,.15,.15,Math.max(.2,H*t-H/6),H*t+H/6,'support','steel'));}}
    vols.push(box(tank[0],tank[1],tank[2],tank[2],'ground',1.6,'wall','steel'),box(trough[0],trough[1],1.6,.25,'ground',.8,'wall','stone'));
    return {vols,eave:H,top:H+.6+1.4,H,b0,b1,tank,trough};
  },
  draw(c,p){
    const {b,pal,F,floor,full,ground}=c,{H,b0,b1}=p,steel=c.theme==='newfoundland'?pal.galvanised:c.theme==='taylor'?pal.timber:mix(pal.iron,pal.stone,.45);
    const leg=(sx:number,sz:number,t:number)=>F.W(sx*(b0+(b1-b0)*t),sz*(b0+(b1-b0)*t),floor+H*t);
    const C=[[-1,-1],[1,-1],[1,1],[-1,1]] as const;
    for(const [sx,sz] of C){const q=F.W(sx*b0,sz*b0,0);b.box(q[0],q[2],F.yaw,.3,.3,Math.min(ground(q[0],q[2]),floor)-.3,floor+.2,pal.stone,pal.stoneDark);rod(b,leg(sx,sz,0),leg(sx,sz,1),.14,steel);}
    for(let k=1;k<=4;k++){const t=k/4,t0=(k-1)/4;for(let i=0;i<4;i++){const [ax,az]=C[i]!,[ex,ez]=C[(i+1)%4]!;rod(b,leg(ax,az,t),leg(ex,ez,t),.08,steel);if(full){rod(b,leg(ax,az,t0),leg(ex,ez,t),.05,steel);rod(b,leg(ex,ez,t0),leg(ax,az,t),.05,steel);}}}
    // Head: hub, 18 blades facing the front, a tail vane behind, the pump rod.
    const hy=floor+H+.6,hub=F.W(0,.45,hy);b.box(hub[0],hub[2],F.yaw,.25,.5,hy-.25,hy+.25,steel,shade(steel,.8));
    const blade=pal.special.sail??pal.canvas,n=18;
    for(let k=0;k<n;k++){const a0=(k+.1)/n*Math.PI*2,a1=(k+.9)/n*Math.PI*2,P=(a:number,rr:number):V3=>F.W(Math.cos(a)*rr,.6,hy+Math.sin(a)*rr);b.quad(P(a0,.35),P(a1,.35),P(a1,1.85),P(a0,1.85),shade(blade,k%2?.92:1.04));}
    if(full)for(let k=0;k<n;k+=3){const a=k/n*Math.PI*2;b.line(F.W(Math.cos(a)*.3,.62,hy+Math.sin(a)*.3),F.W(Math.cos(a)*1.85,.62,hy+Math.sin(a)*1.85),steel);}
    rod(b,F.W(0,0,hy),F.W(0,-2,hy),.08,steel);const vane=pal.special.vane??pal.doorAccent;b.quad(F.W(0,-1.3,hy-.5),F.W(0,-2.6,hy-.4),F.W(0,-2.6,hy+.7),F.W(0,-1.3,hy+.55),vane);
    b.line(F.W(0,0,hy),F.W(0,0,floor+.3),steel);
    // Tank and trough.
    const tq=F.W(p.tank[0],p.tank[1],0),tg=ground(tq[0],tq[2]);b.cone(tq[0],tq[2],Math.min(tg,floor)-.2,floor+1.6,p.tank[2],p.tank[2],pal.special.tank??pal.galvanised,full?14:8,'steel',true);
    if(full)for(let y=floor+.4;y<floor+1.6;y+=.4){b.line([tq[0]-p.tank[2],y,tq[2]],[tq[0]+p.tank[2],y,tq[2]],shade(pal.special.tank??pal.galvanised,.7));}
    const rq=F.W(p.trough[0],p.trough[1],0);b.box(rq[0],rq[2],F.yaw,1.6,.25,Math.min(ground(rq[0],rq[2]),floor)-.2,floor+.8,pal.stone,pal.stoneDark);
    b.shadow(F.x,F.z,b0+.8,b0+.8,F.yaw,ground,.22);
  },
};

/* ------------------------------------------------------------------ shed */
export const shed:KindDef<HousePlan>={
  plan:rec=>housePlan({...rec,roof:{...rec.roof,form:rec.roof.form==='none'?'shed':rec.roof.form}},{pitch:14,ov:.3}),
  draw(c,p){
    const {pal}=c,wall=c.theme==='classic'?pal.timber:paintOf(c,pal.walls,4);
    houseShell(c,p,{wall,skin:c.theme==='classic'?'board':undefined,roof:c.theme==='classic'?mix(pal.slate,pal.timberDark,.4):pick(pal.roofs,0)});
    houseOpenings(c,p,{door:{col:c.theme==='classic'?pal.timberLight:pal.door,w:1},win:{w:.6,h:.6,sill:1.2},faces:['left','right'],spacing:4,lit:.2});
  },
};

/* ------------------------------------------------------------------ gate */
type GatePlan=Plan&{span:number;h:number;post:number;stone:boolean};
export const gate:KindDef<GatePlan>={
  plan(rec){
    const span=rec.size.w,h=Math.max(2.4,rec.size.h),post=Math.max(.3,Math.min(.9,rec.size.d/2)),stone=str(rec,'gateStyle',rec.style.startsWith('crown')||rec.style.startsWith('harbour')?'stone':'timber')==='stone';
    return {vols:[box(-span/2,0,post,post,'ground',h,'support',stone?'stone':'timber'),box(span/2,0,post,post,'ground',h,'support',stone?'stone':'timber'),box(0,0,span/2+post,.2,h-.4,h,'support','timber')],eave:h,top:h+.3,span,h,post,stone};
  },
  draw(c,p){
    const {b,pal,F,floor,full,ground,theme}=c,{span,h,post}=p,col=p.stone?pal.stoneLit:theme==='newfoundland'?pal.trim:theme==='taylor'?pal.paperEdge:pal.timber;
    for(const s of [-1,1]){const q=F.W(s*span/2,0,0),g=ground(q[0],q[2]);b.box(q[0],q[2],F.yaw,post,post,g-.3,floor+h,col,shade(col,.84));
      b.box(q[0],q[2],F.yaw,post+.08,post+.08,floor+h,floor+h+.15,p.stone?pal.stone:pal.brass,shade(p.stone?pal.stone:pal.brass,.8));
      if(theme==='taylor'&&full)for(const y of [floor+.8,floor+1.8]){const r=rectOf(post,post,s*span/2,0);facePanel(b,F,r,'front',-post,post,y,y+.12,pal.tape[(s+1)/2]??pal.tape[0]!,.02);}
      if(p.stone&&full){const r=rectOf(post,post,s*span/2,0);for(const f of ['front','back'] as const)for(let y=g+.42;y<floor+h;y+=.42)b.line(facePt(F,r,f,-post,y,.012),facePt(F,r,f,post,y,.012),shade(col,.7));}}
    b.beam(F.W(-span/2-post,0,floor+h-.2),F.W(span/2+post,0,floor+h-.2),.3,.4,p.stone?pal.timberDark:col);
    if(full)b.beam(F.W(-span/2+post,0,floor+h-.8),F.W(span/2-post,0,floor+h-.8),.12,.14,shade(col,.9));
    b.shadow(F.x,F.z,span/2+post+.4,post+.6,F.yaw,ground,.2);
  },
};

/* ------------------------------------------------------------------ wall (terrain-following dry stone) */
type WallPlan=Plan&{xs:number[];hz:number;h:number};
const COPE=.16;
export const wall:KindDef<WallPlan>={
  plan(rec){
    const L=rec.size.w,hz=Math.max(.2,rec.size.d/2),h=Math.max(.4,rec.size.h),n=Math.max(1,Math.ceil(L/1.5)),xs=Array.from({length:n+1},(_,i)=>-L/2+L*i/n);
    const vols:Vol[]=[];for(let i=0;i<n;i++)vols.push(prism([[xs[i]!,hz+.05,h],[xs[i+1]!,hz+.05,h],[xs[i+1]!,-hz-.05,h],[xs[i]!,-hz-.05,h]],'ground','wall','stone',false,true));
    return {vols,eave:h,top:h,xs,hz,h};
  },
  draw(c,p){
    const {b,pal,F,full,ground,theme}=c,{xs,hz,h}=p,stone=theme==='taylor'?pal.stone:theme==='newfoundland'?pal.stone:mix(pal.stone,pal.stoneLit,.4),lit=theme==='taylor'?pal.paperEdge:pal.stoneLit;
    // One continuous wall whose top follows the ground (the collision prisms are these same corners).
    const at=(x:number,z:number,dy:number,top:boolean):V3=>{const [wx,wz]=F.P(x,z),g=ground(wx,wz);return [wx,top?g+h+dy:dy,wz];};
    let low=Infinity;for(const x of xs)for(const z of [hz,-hz]){const [wx,wz]=F.P(x,z);low=Math.min(low,ground(wx,wz));}
    const base=low-.35;
    for(let i=0;i<xs.length-1;i++){const x0=xs[i]!,x1=xs[i+1]!,o=.05;
      for(const sz of [1,-1]){const z=sz*hz,zc=sz*(hz+o),A=at(x0,z,0,false),Bq=at(x1,z,0,false);
        const f0:V3=[A[0],base,A[2]],f1:V3=[Bq[0],base,Bq[2]],t0=at(x0,z,-COPE,true),t1=at(x1,z,-COPE,true);
        if(sz>0)b.side(f0,f1,t1,t0,shade(stone,.98));else b.side(f1,f0,t0,t1,shade(stone,.86));
        const c0=at(x0,zc,-COPE,true),c1=at(x1,zc,-COPE,true),u0=at(x0,zc,0,true),u1=at(x1,zc,0,true);b.quad(c0,c1,u1,u0,shade(lit,sz>0?.95:.82));b.line(inkLift(u0),inkLift(u1));
        if(full){for(let u=x0+.06;u<x1;u+=.16)b.line(at(u,zc+sz*.01,-.02,true),at(u,zc+sz*.01,-COPE+.01,true),shade(lit,.7));
          let k=0;for(let d=COPE+.28;d<h+.3;d+=.26+(k%3)*.05,k++){const y0=at(x0,z+sz*.012,-d,true),y1=at(x1,z+sz*.012,-d,true);b.line(y0,y1,shade(stone,.62));
            for(let u=x0+((i*5+k*3)%4)*.13;u<x1;u+=.36+((i+k)%3)*.12)b.line(at(u,z+sz*.012,-d,true),at(u,z+sz*.012,-d+.26,true),shade(stone,.66));}}}
      b.quad(at(x0,hz+.05,0,true),at(x1,hz+.05,0,true),at(x1,-hz-.05,0,true),at(x0,-hz-.05,0,true),lit);}
    for(const [x,s] of [[xs[0]!,-1],[xs[xs.length-1]!,1]] as const){const a0=at(x,hz,0,false),a1=at(x,-hz,0,false),t0=at(x,hz,0,true),t1=at(x,-hz,0,true);b.side([a0[0],base,a0[2]],[a1[0],base,a1[2]],t1,t0,shade(stone,s>0?.9:.8));b.line(inkLift(t0),inkLift(t1));}
    if(theme==='taylor'&&full)for(let i=0;i<xs.length-1;i+=3)b.decal(at((xs[i]!+xs[i+1]!)/2,hz+.06,-.45,true),[F.c,0,-F.s],[0,1,0],.12,ICON.hearth,pal.tape[0]!,[F.s,0,F.c]);
    void windowAt;void doorAt;void plinth;void footShade;void walls;void wallLantern;void postAt;void houseOpenings;void houseShell;void num;void flag;void facePt;void rectOf;void stencil;void groundUnder;
  },
};
export type {RGB,Rect};
