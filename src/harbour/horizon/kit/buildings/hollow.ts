/**
 * The Hollow (STYLE §2.2): the kiln (its chimney the only tall built element), the cottage and the studio under low
 * hipped roofs with deep eaves, and the covered bridge with sides, a roof and an underside over the brook.
 * Ochre render, kiln brick and mine timber in Classic; gingham and plaid paper in Taylor; red-ochre clapboard with
 * white trim in Newfoundland.
 */
import {
  box,num,rectOf,facePt,facePanel,windowAt,doorAt,plinth,footShade,walls,roofGable,gableVols,wallLantern,openRail,
  paintOf,pick,faceHalf,shade,mix,
  type KindDef,type Plan,type DrawCtx,type Rect,type Vol,
} from './core.ts';
import {housePlan,houseShell,houseOpenings,type HousePlan} from './house.ts';
import {spandrel} from './harbour.ts';
import type {Face} from '../../neighbourhoods/types.ts';

/** Taylor's gingham: a few crossing lines of plaid tape over each face of a card wall. */
function gingham(c:DrawCtx,r:Rect,y0:number,y1:number){
  if(c.theme!=='taylor'||!c.full)return;
  const {b,F,pal}=c,a=pal.special.plaid??pal.tape[0]!,e=pal.special.plaid2??pal.tape[1]??a;
  for(const f of ['front','back','left','right'] as const){const h=faceHalf(r,f);
    for(let y=y0+.6;y<y1-.2;y+=.9)b.line(facePt(F,r,f,-h,y,.02),facePt(F,r,f,h,y,.02),a);
    for(let u=-h+.45;u<h;u+=.9)b.line(facePt(F,r,f,u,y0+.15,.02),facePt(F,r,f,u,y1-.15,.02),e);}
}

/* ------------------------------------------------------------------ kiln */
type KilnPlan=HousePlan&{stackH:number;stack:[number,number]};
export const kiln:KindDef<KilnPlan>={
  plan(rec){
    const p=housePlan(rec,{pitch:24,ov:.6}),stackH=Math.max(p.wallH+p.rise+3,num(rec,'chimneyH',11)),stack:[number,number]=[0,-p.r.hz+.65];
    p.vols.push(box(stack[0],stack[1],.65,.65,0,stackH,'wall','brick'));
    return {...p,stackH,stack,top:Math.max(p.top,stackH+.3)};
  },
  draw(c,p){
    const {b,pal,F,floor,full,rec}=c,{r}=p,brick=pal.brick,df:Face=rec.door?.face??'front';
    houseShell(c,p,{wall:brick,skin:c.theme==='newfoundland'?'clapboard':c.theme==='taylor'?'paper':'stucco',roof:pick(pal.roofs,0),ridge:shade(pick(pal.roofs,0),.8)});
    if(c.theme==='classic'&&full)for(const f of ['front','back','left','right'] as const){const h=faceHalf(r,f);for(let y=floor+.28;y<floor+p.wallH;y+=.28)b.line(facePt(F,r,f,-h,y,.012),facePt(F,r,f,h,y,.012),shade(brick,.75));}
    // The firing mouth: a low brick arch that glows orange from dusk.
    const hl=faceHalf(r,df);
    facePanel(b,F,r,df,-.75,.75,floor,floor+.9,shade(brick,.4),.03);spandrel(c,r,df,0,floor+.9,.75,floor+1.75,brick,.025);
    facePanel(b,F,r,df,-.62,.62,floor+.05,floor+.9,[1,.6,.29],.04,'glow');
    doorAt(c,r,df,Math.min(hl-.9,1.9),floor,.9,Math.min(2,p.wallH-.2),pal.doorAccent);
    // The stack: square brick, a corbelled band, a dark crown.
    const q=F.W(p.stack[0],p.stack[1],0),top=floor+p.stackH;
    b.box(q[0],q[2],F.yaw,.65,.65,floor+p.wallH-.3,top,brick,shade(brick,.86));
    b.box(q[0],q[2],F.yaw,.78,.78,top-.9,top-.6,shade(brick,1.08),shade(brick,.8));b.box(q[0],q[2],F.yaw,.72,.72,top-.05,top+.3,shade(brick,.5),shade(brick,.4));
    if(full)for(let y=floor+p.wallH;y<top-1;y+=.35)for(const f of ['front','left','right','back'] as const){const sr=rectOf(.65,.65,p.stack[0],p.stack[1]);b.line(facePt(F,sr,f,-.65,y,.01),facePt(F,sr,f,.65,y,.01),shade(brick,.72));}
  },
};
/* ------------------------------------------------------------------ cottage */
export const cottage:KindDef<HousePlan>={
  plan:rec=>housePlan(rec,{pitch:28,ov:.85,chimney:true}),
  draw(c,p){
    const {pal,floor}=c;const wall=paintOf(c,pal.walls,0);
    houseShell(c,p,{wall,roof:pick(pal.roofs,0),base:c.theme==='classic'?pal.base:undefined,chimney:pal.brick,ridge:shade(pick(pal.roofs,0),.8)});
    gingham(c,p.r,floor,floor+p.wallH);
    houseOpenings(c,p,{door:{col:pal.doorAccent},win:{w:.9,h:1.1,sill:.9,shutters:c.theme!=='newfoundland'},spacing:2.5,lit:.75});
  },
};
/* ------------------------------------------------------------------ studio */
export const studio:KindDef<HousePlan>={
  plan:rec=>housePlan(rec,{pitch:22,ov:.7,chimney:'side'}),
  draw(c,p){
    const {b,pal,F,floor,full}=c,{r}=p,wall=paintOf(c,pal.walls,1),eave=floor+p.wallH;
    houseShell(c,p,{wall,roof:pick(pal.roofs,1),base:c.theme==='classic'?pal.base:undefined,chimney:pal.brick});
    gingham(c,r,floor,eave);
    // The studio window: a wide glazed wall on the front with a mullion grid, lit warm at night.
    const w=Math.min(r.hx*2-1.6,6),y0=floor+.5,y1=eave-.35;
    facePanel(b,F,r,'front',-w/2-.12,w/2+.12,y0-.12,y1+.12,pal.frame,.015);facePanel(b,F,r,'front',-w/2,w/2,y0,y1,pal.glass,.03);facePanel(b,F,r,'front',-w/2+.05,w/2-.05,y0+.05,y1-.05,pal.glow,.04,'glow');
    for(let u=-w/2;u<=w/2+1e-6;u+=w/Math.max(2,Math.round(w/1.1)))b.line(facePt(F,r,'front',u,y0,.05),facePt(F,r,'front',u,y1,.05),pal.frame);
    if(full)for(let y=y0+.9;y<y1;y+=.9)b.line(facePt(F,r,'front',-w/2,y,.05),facePt(F,r,'front',w/2,y,.05),pal.frame);
    houseOpenings(c,p,{door:false,win:{w:.8,h:1.1,sill:1},faces:['back','left'],spacing:2.6,lit:.6});
    doorAt(c,r,'right',0,floor,1,Math.min(2.1,p.wallH-.3),pal.doorAccent,{arch:false});
  },
};
/* ------------------------------------------------------------------ covered bridge */
type BridgePlan=Plan&{r:Rect;wallH:number;rise:number;ov:number;abut:number};
export const coveredBridge:KindDef<BridgePlan>={
  plan(rec){
    const r=rectOf(rec.size.w/2,rec.size.d/2),wallH=Math.max(2.5,rec.size.h),rise=r.hz*Math.tan((rec.roof.pitch||35)*Math.PI/180),ov=rec.roof.overhang>0?rec.roof.overhang:.45,abut=Math.min(2,r.hx*.15);
    const vols:Vol[]=[box(0,0,r.hx,r.hz,-.5,0,'deck','boardwalk',true),box(0,r.hz-.08,r.hx,.08,0,wallH,'wall','timber'),box(0,-r.hz+.08,r.hx,.08,0,wallH,'wall','timber'),...gableVols(r,wallH,rise,ov,.3,'shingle')];
    for(const s of [-1,1])vols.push(box(s*(r.hx-abut),0,abut,r.hz+.3,'ground',-.5,'support','stone'));
    return {vols,eave:wallH,top:wallH+rise,r,wallH,rise,ov,abut};
  },
  draw(c,p){
    const {b,pal,F,floor,full,ground,theme}=c,{r}=p,eave=floor+p.wallH,wall=theme==='classic'?mix(pal.timberDark,pal.brick,.25):paintOf(c,pal.walls,0);
    // Deck with its underside and two stone abutments; nothing under the span (the brook runs free).
    const q=F.W(0,0,0);b.box(q[0],q[2],F.yaw,r.hx+.05,r.hz+.15,floor-.5,floor,pal.plank,shade(pal.plank,.7));
    for(let u=-r.hx+.3;u<r.hx;u+=.3)b.line(F.W(u,r.hz,floor+.01),F.W(u,-r.hz,floor+.01),shade(pal.plank,.7));
    for(const s of [-1,1]){const a=F.W(s*(r.hx-p.abut),0,0),g=Math.min(ground(a[0],a[2]),floor-.6);b.box(a[0],a[2],F.yaw,p.abut,r.hz+.3,g-.4,floor-.5,pal.stone,pal.stoneDark);}
    for(const sz of [1,-1]){const z=sz*(r.hz-.08);b.beam(F.W(-r.hx,z,floor-.55),F.W(r.hx,z,floor-.55),.25,.5,pal.timberDark);}
    // Sides: boards to a daylight slot under the eave, a truss on the inside face.
    for(const f of ['front','back'] as const){const wr=rectOf(r.hx,.08,0,f==='front'?r.hz-.08:-r.hz+.08);walls(c,wr,floor,eave-.65,wall,{faces:[f],skin:theme==='taylor'?'paper':theme==='newfoundland'?'clapboard':'board',battenStep:.6});
      facePanel(b,F,wr,f,-r.hx,r.hx,eave-.2,eave,wall,.01);
      if(full){const n=Math.max(2,Math.round(r.hx/1.5));for(let i=0;i<n;i++){const u0=-r.hx+2*r.hx*i/n,u1=u0+2*r.hx/n;b.line(facePt(F,wr,f,u0,floor+.1,-.2),facePt(F,wr,f,u1,eave-.7,-.2),pal.timberDark);}}}
    for(const [u,y0,y1] of [[-r.hx,eave-.65,eave-.2],[r.hx,eave-.65,eave-.2]] as const)for(const z of [r.hz-.08,-r.hz+.08]){const a=F.W(u,z,0);b.box(a[0],a[2],F.yaw,.12,.1,y0,y1,pal.timberDark,shade(pal.timberDark,.8),null);}
    roofGable(c,r,eave,p.rise,p.ov,{col:pick(pal.roofs,0),wall,ridge:shade(pick(pal.roofs,0),.8)},.3);
    // Portal boards and a lantern at each portal.
    for(const f of ['left','right'] as const){wallLantern(c,r,f,-r.hz+.4,eave-.4);}
    if(theme==='taylor'&&full)for(const f of ['left','right'] as const){const a=facePt(F,r,f,-r.hz,eave,.05),e=facePt(F,r,f,r.hz,eave,.05);b.quad(a,e,[e[0],e[1]-.18,e[2]],[a[0],a[1]-.18,a[2]],pal.tape[0]!);}
    void openRail;void footShade;void plinth;void windowAt;void doorAt;
  },
};
