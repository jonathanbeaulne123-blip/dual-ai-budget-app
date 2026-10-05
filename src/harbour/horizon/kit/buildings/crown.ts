/**
 * The Highlands (protos/highlands §2): crofts, Westwatch Chapel with its verdigris bell cote (the story's first
 * landmark, cote top ≥ 96 at [1036,318]), the High Shieling longhouse and barn, a shieling hut, and the drag lift's
 * stations and towers. Stone and slate in Classic; pastel card in Taylor; split granite with white fascias in
 * Newfoundland.
 */
import {
  box,prism,num,rectOf,facePt,facePanel,faceAxes,windowAt,doorAt,plinth,footShade,walls,band,roofGable,gableVols,
  wallLantern,paintOf,pick,turnedCtx,turnVols,stencil,ICON,shade,mix,inkLift,
  type KindDef,type Plan,type DrawCtx,type Rect,type Vol,type V3,type RGB,
} from './core.ts';
import {housePlan,houseShell,houseOpenings,type HousePlan} from './house.ts';
import {spandrel} from './harbour.ts';

const stoneWall=(c:DrawCtx)=>paintOf(c,c.pal.walls,0);

/* ------------------------------------------------------------------ croft */
export const croft:KindDef<HousePlan>={
  plan:rec=>housePlan(rec,{pitch:38,ov:.35,chimney:'gable'}),
  draw(c,p){
    const {pal}=c;houseShell(c,p,{wall:stoneWall(c),roof:pick(pal.roofs,0),chimney:stoneWall(c),ridge:shade(pick(pal.roofs,0),.8)});
    houseOpenings(c,p,{win:{w:.8,h:.9,sill:1},spacing:2.4,lit:.7});
  },
};
/* ------------------------------------------------------------------ longhouse */
export const longhouse:KindDef<HousePlan>={
  plan:rec=>housePlan(rec,{pitch:36,ov:.4,chimney:'gable'}),
  draw(c,p){
    const {pal,floor}=c,{r}=p;houseShell(c,p,{wall:stoneWall(c),roof:pick(pal.roofs,0),chimney:stoneWall(c)});
    houseOpenings(c,p,{win:{w:.8,h:.9,sill:1},spacing:3,faces:['front','back'],lit:.7});
    // The byre end: a boarded double door on the left gable.
    doorAt(c,r,'left',0,floor,1.9,Math.min(2.3,p.wallH-.25),pal.timber);
  },
};
/* ------------------------------------------------------------------ barn */
export const barn:KindDef<HousePlan>={
  plan:rec=>housePlan(rec,{pitch:38,ov:.35}),
  draw(c,p){
    const {b,pal,F,floor,full}=c,{r}=p,eave=floor+p.wallH;
    houseShell(c,p,{wall:stoneWall(c),roof:pal.timber,ridge:shade(pal.timber,.7)});
    // Boarded gable ends above the stone, the big doors and a hay door.
    for(const f of ['left','right'] as const){for(let u=-r.hz+.25;u<r.hz;u+=.3){const t=1-Math.abs(u)/r.hz;b.line(facePt(F,r,f,u,eave,.03),facePt(F,r,f,u,eave+p.rise*t-.05,.03),shade(pal.timber,.6));}
      facePanel(b,F,r,f,-.55,.55,eave+.1,eave+1.1,pal.timberDark,.04);}
    const df=c.rec.door?.face??'front',dw=Math.min(3.4,(f=>f==='front'||f==='back'?r.hx:r.hz)(df)*2-1.2);
    doorAt(c,r,df,0,floor,dw,Math.min(2.9,p.wallH-.3),pal.timberLight);
    if(full){const a=facePt(F,r,df,-dw/2,floor+.1,.07),e=facePt(F,r,df,dw/2,floor+Math.min(2.8,p.wallH-.4),.07),a2=facePt(F,r,df,dw/2,floor+.1,.07),e2=facePt(F,r,df,-dw/2,floor+Math.min(2.8,p.wallH-.4),.07);b.line(a,e,pal.trim);b.line(a2,e2,pal.trim);}
  },
};
/* ------------------------------------------------------------------ shieling */
export const shieling:KindDef<HousePlan>={
  plan:rec=>housePlan(rec,{pitch:40,ov:.3}),
  draw(c,p){
    const {pal}=c;houseShell(c,p,{wall:stoneWall(c),roof:pal.thatch,ridge:shade(pal.thatch,.75)});
    houseOpenings(c,p,{door:{w:.85,h:1.7,col:pal.timber},win:{w:.5,h:.5,sill:1},faces:['back'],spacing:5,lit:1});
  },
};
/* ------------------------------------------------------------------ lift station */
type StationPlan=HousePlan&{wheelY:number};
export const liftStation:KindDef<StationPlan>={
  plan(rec){const p=housePlan(rec,{pitch:30,ov:.5});const wheelY=Math.min(2.2,p.wallH-.3);p.vols.push(box(0,p.r.hz+1.1,1.5,1.1,wheelY-.15,wheelY+.25,'support','steel'));return {...p,wheelY};},
  draw(c,p){
    const {b,pal,F,floor,full}=c,{r}=p,steel=pal.special.steel??pal.iron;
    houseShell(c,p,{wall:stoneWall(c),roof:pal.slate,ridge:shade(pal.slate,.8)});
    doorAt(c,r,'back',0,floor,1.6,Math.min(2.2,p.wallH-.3),pal.timber);
    // The bull wheel: a horizontal sheave on a bracket out of the line-side wall.
    const q=F.W(0,r.hz+1.1,0),y=floor+p.wheelY;b.cone(q[0],q[2],y-.1,y+.1,1.05,1.05,shade(steel,1.25),full?14:8,'steel',true);b.cone(q[0],q[2],y+.12,y+.2,.35,.25,steel,6,'steel');
    b.beam(F.W(0,r.hz,y+.1),F.W(0,r.hz+1.1,y+.1),.25,.2,steel,null,'steel');
    facePanel(b,F,r,'front',-1.2,1.2,floor+.4,floor+Math.min(2,p.wallH-.5),shade(pal.timberDark,.8),.03);
  },
};
/* ------------------------------------------------------------------ lift tower */
type TowerPlan=Plan&{h:number;arm:number};
export const liftTower:KindDef<TowerPlan>={
  plan(rec){const h=Math.max(3,rec.size.h),arm=Math.max(2,rec.size.w);return {vols:[box(0,0,.4,.4,'ground',.3,'support','stone'),box(0,0,.3,.3,.3,h,'support','steel'),box(0,0,arm/2,.15,h-.15,h+.15,'support','steel')],eave:h,top:h+.6,h,arm};},
  draw(c,p){
    const {b,pal,F,floor,full,ground}=c,steel=pal.special.steel??pal.iron,q=F.W(0,0,0),g=ground(q[0],q[2]);
    b.box(q[0],q[2],F.yaw,.45,.45,Math.min(g,floor)-.3,floor+.3,pal.stone,pal.stoneDark);
    b.cone(q[0],q[2],floor+.3,floor+p.h,.32,.22,steel,7,'steel');
    b.beam(F.W(-p.arm/2,0,floor+p.h),F.W(p.arm/2,0,floor+p.h),.3,.25,steel,null,'steel');
    for(const s of [-1,1]){const w=F.W(s*(p.arm/2-.2),0,floor+p.h-.35);b.cone(w[0],w[2],w[1]-.06,w[1]+.06,.32,.32,shade(steel,.8),full?10:6,'steel');b.line(F.W(s*(p.arm/2-.2),0,floor+p.h),w,steel);}
    if(full)for(let y=floor+1;y<floor+p.h-.4;y+=.45){const a=F.W(-.12,.3,y),e=F.W(.12,.3,y);b.line(a,e,steel);}
    b.shadow(q[0],q[2],.9,.9,0,ground,.25);
  },
};

/* ------------------------------------------------------------------ chapel (Westwatch) */
type ChapelPlan=Plan&{rt:Rect;wallH:number;rise:number;ov:number;coteTop:number;cote:{z:number;hw:number;hd:number;base:number;spring:number;open:number}};
export const chapel:KindDef<ChapelPlan>={
  plan(rec){
    // Planned in the quarter-turned frame so the ridge runs along the nave (the record's depth).
    const rt=rectOf(rec.size.d/2,rec.size.w/2),wallH=Math.max(2.5,rec.size.h),rise=rt.hz*Math.tan((rec.roof.pitch||47)*Math.PI/180),ov=rec.roof.overhang>0?rec.roof.overhang:.35;
    const coteTop=num(rec,'coteTop',wallH+rise+2.6),hw=.7,hd=.5,z=-rec.size.d/2+hd,base=wallH+rise-.9,cap=.9,spring=coteTop-cap-.35-.4,open=.4;
    const local:Vol[]=[box(0,0,rt.hx+.18,rt.hz+.18,'ground',0,'support','stone'),box(0,0,rt.hx,rt.hz,0,wallH,'wall','stone'),...gableVols(rt,wallH,rise,ov,.3,'slate')];
    const vols:Vol[]=[...turnVols(local),
      box(-hw+.15,z,.15,hd,base,coteTop-cap,'wall','stone'),box(hw-.15,z,.15,hd,base,coteTop-cap,'wall','stone'),box(0,z,hw,hd,base,spring-open-.2,'wall','stone'),box(0,z,hw,hd,spring,coteTop-cap,'wall','stone'),
      prism([[-hw-.15,z+hd+.15,coteTop-cap],[hw+.15,z+hd+.15,coteTop-cap],[hw+.15,z,coteTop],[-hw-.15,z,coteTop]],coteTop-cap,'roof','copper'),
      prism([[-hw-.15,z,coteTop],[hw+.15,z,coteTop],[hw+.15,z-hd-.15,coteTop-cap],[-hw-.15,z-hd-.15,coteTop-cap]],coteTop-cap,'roof','copper')];
    return {vols,eave:wallH,top:coteTop+.5,rt,wallH,rise,ov,coteTop,cote:{z,hw,hd,base,spring,open}};
  },
  draw(c,p){
    const t=turnedCtx(c),{b,pal,F,floor,full,theme}=c,{rt}=p,eave=floor+p.wallH,wall=pal.chapel;
    plinth(t,rt);walls(t,rt,floor,eave,wall,{skin:theme==='classic'?'stucco':pal.skin,corner:theme==='newfoundland'?shade(pal.stoneLit,.95):undefined});
    roofGable(t,rt,eave,p.rise,p.ov,{col:pal.slate,wall,ridge:shade(pal.slate,.8)},.3);
    // Openings: lancet slits down both long walls, the arched door and an oculus in the front gable (turned 'left').
    for(const f of ['front','back'] as const)for(const u of [-2.4,0,2.4])windowAt(t,rt,f,u,floor+1.6,.5,1.6,{arch:true,lit:true,surround:.1,mullion:false,sill:false});
    doorAt(t,rt,'left',0,floor,1.2,2.5,pal.door,{arch:true,lit:true});
    if(full){const o=facePt(t.F,rt,'left',0,eave+p.rise*.45,.04),{right}=faceAxes(t.F,'left');for(let k=0;k<10;k++){const a0=k/10*Math.PI*2,a1=(k+1)/10*Math.PI*2,P=(a:number,rr:number):V3=>[o[0]+right[0]*Math.cos(a)*rr,o[1]+Math.sin(a)*rr,o[2]+right[2]*Math.cos(a)*rr];b.tri(o,P(a0,.55),P(a1,.55),pal.trim);b.tri(o,P(a0,.4),P(a1,.4),pal.glow,'glow');}}
    wallLantern(t,rt,'left',1.2,floor+2.6);
    if(theme==='taylor')stencil(t,rt,'left',0,eave+.4,.24,ICON.star,pal.tape[2]??pal.tape[0]!);
    // The bell cote on the back gable, in verdigris (the Library's copper, STORY through-line).
    const {z,hw,hd,base,spring,open}=p.cote,cr=rectOf(hw,hd,0,z),top=floor+p.coteTop,capY=top-.9,stone=mix(wall,pal.stone,.35);
    for(const s of [-1,1]){const q=F.W(s*(hw-.15),z,0);b.box(q[0],q[2],F.yaw,.15,hd,floor+base,capY,stone,shade(stone,.86));}
    const qb=F.W(0,z,0);b.box(qb[0],qb[2],F.yaw,hw,hd,floor+base,floor+spring-open-.2,stone,shade(stone,.86));
    for(const f of ['front','back'] as const)spandrel(c,cr,f,0,floor+spring,open,capY,stone,0);
    b.box(qb[0],qb[2],F.yaw,hw+.08,hd+.08,capY-.12,capY,pal.trim,shade(pal.trim,.85));
    const V=pal.verdigris,ex=hw+.15,ez=hd+.15,P=(x:number,zz:number,y:number)=>F.W(x,z+zz,y);
    const f0=P(-ex,ez,capY),f1=P(ex,ez,capY),r0=P(-ex,0,top),r1=P(ex,0,top),k0=P(-ex,-ez,capY),k1=P(ex,-ez,capY);
    b.quad(f0,f1,r1,r0,shade(V,1.05));b.quad(k1,k0,r0,r1,shade(V,.85));b.tri(f0,k0,r0,shade(V,.75));b.tri(k1,f1,r1,shade(V,.8));
    b.quad(r0,r1,[r1[0],r1[1]+.08,r1[2]],[r0[0],r0[1]+.08,r0[2]],pal.verdigrisLit);
    for(const [a,e] of [[f0,f1],[k0,k1],[r0,r1],[f0,r0],[f1,r1],[k0,r0],[k1,r1]] as const)b.line(inkLift(a),inkLift(e));
    if(full)for(let x=-ex+.25;x<ex;x+=.3)for(const zz of [ez,-ez])b.line(P(x,zz,capY+.01),P(x,0,top+.01),pal.special.seam??shade(V,.8));
    const bell=F.W(0,z,0);b.cone(bell[0],bell[2],floor+spring-.55,floor+spring+.15,.32,.14,pal.special.bell??pal.brass,full?8:6,'steel');
    b.post(bell[0],bell[2],top,top+.6,.04,pal.iron,4,'steel');
    footShade(t,rt);
    void box;void prism;void band;void facePanel;void pick;
  },
};
export type {RGB};
