/**
 * Little Harbour, "cobblestone Italy" (STYLE §2.1 as amended; protos/harbour §2–§6): row houses, the villa (Our
 * home), the palazzo (the Fund bank), the campanile, a loggia and a kiosk. Taylor and Newfoundland skin the SAME
 * massing (one plan per kind → one collision): Taylor in pastel card with paper edges and scalloped eaves,
 * Newfoundland in jellybean clapboard with white corner boards and fascias.
 */
import {
  box,prism,num,flag,str,pick,paintOf,rectOf,facePt,facePanel,faceArch,faceAxes,windowAt,doorAt,plinth,footShade,walls,band,stencil,ICON,
  roofGable,gableVols,gableGeom,roofHip,hipVols,roofFlat,flatVols,wallLantern,postAt,openRail,doorFace,shade,mix,inkLift,rod,
  type KindDef,type Plan,type DrawCtx,type Rect,type Vol,type V3,type RGB,
} from './core.ts';
import type {Face} from '../../neighbourhoods/types.ts';

const rad=(deg:number)=>deg*Math.PI/180;
const persiane=(k:number):'open'|'closed'|'half'=>{const r8=k%8;return r8===0||r8===6?'closed':r8===3?'half':'open';};

/* ------------------------------------------------------------------ row house */

type RowPlan=Plan&{r:Rect;storeys:number;wallH:number;rise:number;ov:number;altana:boolean;chimney:boolean;shop:boolean;k:number};
const PARAPET=.9,PERGOLA=2.4;
export const rowHouse:KindDef<RowPlan>={
  plan(rec){
    const r=rectOf(rec.size.w/2,rec.size.d/2),storeys=Math.max(1,Math.min(5,rec.storeys??3)),wallH=Math.max(3,rec.size.h);
    const altana=flag(rec,'altana',rec.roof.form==='flat'),rise=r.hz*Math.tan(rad(rec.roof.pitch||22)),ov=rec.roof.overhang>0?rec.roof.overhang:.75;
    let k=0;for(let i=0;i<rec.id.length;i++)k=(k*31+rec.id.charCodeAt(i))>>>0;
    const shop=flag(rec,'shop',k%7>0),chimney=!altana&&flag(rec,'chimney',k%2===0);
    const vols:Vol[]=[box(0,0,r.hx+.18,r.hz+.18,'ground',0,'support','stone'),box(0,0,r.hx,r.hz,0,wallH,'wall','stucco'),box(0,0,r.hx+.3,r.hz+.3,wallH-.42,wallH,'wall','stone')];
    if(altana){vols.push(...flatVols(r,wallH,PARAPET));for(const [sx,sz] of [[-1,-1],[1,-1],[1,1],[-1,1]] as const)vols.push(box(sx*(r.hx-.6),sz*(r.hz-.6),.07,.07,wallH,wallH+PERGOLA,'support','timber'));vols.push(box(0,0,r.hx-.5,r.hz-.5,wallH+PERGOLA,wallH+PERGOLA+.12,'roof','timber'));}
    else vols.push(...gableVols(r,wallH,rise,ov,.35,'tile'));
    if(chimney)vols.push(box(r.hx*.6,-r.hz*.35,.4,.4,wallH,wallH+rise+1.1,'wall','stucco'));
    return {vols,eave:wallH,top:altana?wallH+PERGOLA+.12:wallH+rise+(chimney?1.3:0),r,storeys,wallH,rise,ov,altana,chimney,shop,k};
  },
  draw(c,p){
    const {b,pal,F,full,theme,floor}=c,{r,wallH,k}=p,eave=floor+wallH,wall=paintOf(c,pal.walls,0),front:Face='front';
    plinth(c,r);
    walls(c,r,floor,eave,wall,{faces:['front','back']});
    if(theme!=='newfoundland')for(const f of ['front','back'] as const)facePanel(b,F,r,f,-r.hx,r.hx,floor,floor+.9,pal.base,.03);
    if(full)band(c,r,floor+3.55,floor+3.73,pal.trim,theme==='newfoundland'?.03:.06);
    band(c,r,eave-.42,eave,pal.trim,theme==='newfoundland'?.08:.3);
    const roof=pick(pal.roofs,k);
    if(p.altana){
      roofFlat(c,r,eave,PARAPET,wall,wall,pal.trim);
      for(const [sx,sz] of [[-1,-1],[1,-1],[1,1],[-1,1]] as const)rod(b,F.W(sx*(r.hx-.6),sz*(r.hz-.6),eave),F.W(sx*(r.hx-.6),sz*(r.hz-.6),eave+PERGOLA),.14,pal.timber,'card');
      for(const sz of [-1,1])rod(b,F.W(-r.hx+.5,sz*(r.hz-.6),eave+PERGOLA),F.W(r.hx-.5,sz*(r.hz-.6),eave+PERGOLA),.14,pal.timber,'card');
      for(let u=-r.hx+.7;u<=r.hx-.6;u+=full?1.2:2.4)rod(b,F.W(u,r.hz-.5,eave+PERGOLA+.1),F.W(u,-r.hz+.5,eave+PERGOLA+.1),.1,pal.timber,'card');
      if(full)for(const [u,col] of [[0,pick(pal.flowers,1)]] as const){const q=F.W(u,0,0);b.cone(q[0],q[2],eave+.04,eave+.5,.28,.34,pal.terra,5);b.cone(q[0],q[2],eave+.5,eave+1.1,.42,0,col,5);}
    }else roofGable(c,r,eave,p.rise,p.ov,{col:roof,wall,ridge:pal.ridge},.35);
    if(p.chimney){const q=F.W(r.hx*.6,-r.hz*.35,0),top=eave+p.rise+1.1;b.box(q[0],q[2],F.yaw,.4,.4,eave+p.rise*.3,top,wall,shade(wall,.85));if(full)b.box(q[0],q[2],F.yaw,.5,.5,top,top+.16,roof,shade(roof,.8));}
    // Ground floor: a shop of round-headed arches, or the house door and a small window.
    const w=r.hx*2;
    if(p.shop){const n=w>=7?2:1,ow=Math.min(2.5,(w-1.4)/n-.5);
      for(let i=0;i<n;i++){const u=-r.hx+w*(i+.5)/n,door=i===0&&n===2;
        if(door)doorAt(c,r,front,u,floor,ow,2.3,pal.door,{arch:true,lit:true});
        else windowAt(c,r,front,u,floor+.1,ow,2.2,{arch:true,lit:true,sill:false,mullion:true});}
      if(k%3!==1&&full)awningOn(c,r,front,-r.hx+.4,r.hx-.4,floor+3.1,pick(pal.awnings,k));
    }else{doorAt(c,r,front,-r.hx+1.4,floor,1.15,2.15,pal.door,{arch:true,lit:k%2===1});windowAt(c,r,front,r.hx-1.6,floor+1,.8,1.3,{lit:k%2===1,shutters:full?'open':false,shutter:pick(pal.shutters,k*3+1)});}
    // Upper floors: persiane per window, balconies and geranium boxes (full only).
    const nW=Math.max(1,Math.floor((w-.6)/2.3));
    for(let f=1;f<p.storeys;f++){const y=floor+3.7+(f-1)*3+.55;if(y+1.7>eave-.45)break;
      for(let i=0;i<nW;i++){const u=-r.hx+w*(i+.5)/nW,r8=(k*5+i*3+f*7)%8,lit=r8<5,balcony=f===1&&(k+i)%3===0;
        windowAt(c,r,front,u,y,.78,1.7,{lit,shutters:full?persiane(r8):false,shutter:pick(pal.shutters,k*3+1),head:'cornice',box:!balcony&&(k+i+f)%2===0?pal.terra:false});
        if(balcony&&full)balconyAt(c,r,front,u,y-.05,1.5,.62);
        // The back: plainer, shutters closed on half.
        if(i===0&&full)windowAt(c,r,'back',u,y,.78,1.6,{lit:lit&&i===0,shutters:full&&r8%2===0?'closed':false,shutter:pick(pal.shutters,k),mullion:false});}}
    if(k%2===1)wallLantern(c,r,front,-r.hx+.55,floor+3.9);
    if(theme==='taylor')stencil(c,r,front,0,eave-.9,.22,ICON.hearth,pal.tape[0]!);
    footShade(c,r);
  },
};
/** A striped cloth awning on a face from u0 to u1 at height y (STYLE §1.1: an awning with an underside). */
export function awningOn(c:DrawCtx,r:Rect,face:Face,u0:number,u1:number,y:number,col:RGB,o:{depth?:number;drop?:number;stripes?:readonly RGB[]}={}){
  const {b,pal,F,theme,full}=c,depth=o.depth??1.25,drop=o.drop??.5,n=Math.max(3,Math.round((u1-u0)/.5)),stripes=o.stripes??[col,theme==='newfoundland'?pal.trim:mix(col,[1,1,1],.6)];
  const P=(u:number,yy:number,oo:number)=>facePt(F,r,face,u,yy,oo);
  for(let i=0;i<n;i++){const a=u0+(u1-u0)*i/n,e=u0+(u1-u0)*(i+1)/n,s=stripes[i%stripes.length]!;
    b.quad(P(a,y,.02),P(e,y,.02),P(e,y-drop,depth),P(a,y-drop,depth),s);
    if(theme==='taylor'&&full){const m=(a+e)/2,rr=(e-a)/2;b.tri(P(a,y-drop,depth),P(e,y-drop,depth),P(m,y-drop-rr,depth),s);}
    else if(full)b.quad(P(a,y-drop,depth),P(e,y-drop,depth),P(e,y-drop-.22,depth),P(a,y-drop-.22,depth),shade(s,.9));}
  b.line(inkLift(P(u0,y-drop,depth)),inkLift(P(u1,y-drop,depth)));b.line(P(u0,y,.03),P(u1,y,.03));
  for(const u of [u0+.1,u1-.1])b.line(P(u,y-.8,.02),P(u,y-drop,depth-.05),pal.iron);
}
/** A stone balcony slab with an iron rail. */
export function balconyAt(c:DrawCtx,r:Rect,face:Face,u:number,y:number,w:number,d:number){
  const {b,pal,F}=c,{n}=faceAxes(F,face),A=(uu:number,yy:number,o:number)=>facePt(F,r,face,uu,yy,o),q=A(u,0,d/2);
  b.box(q[0],q[2],F.yaw+(face==='right'||face==='left'?Math.PI/2:0),w/2,d/2,y-.16,y,pal.plinth,shade(pal.plinth,.8));
  const rail=c.theme==='newfoundland'?pal.trim:c.theme==='taylor'?pal.frame:pal.iron;
  for(const [p0,p1] of [[A(u-w/2,y+.85,d),A(u+w/2,y+.85,d)],[A(u-w/2,y+.85,0),A(u-w/2,y+.85,d)],[A(u+w/2,y+.85,0),A(u+w/2,y+.85,d)]] as const)b.beam(p0,p1,.05,.05,rail,null,'steel');
  for(let t=0;t<=6;t++){const p=A(u-w/2+w*t/6,y,d);b.line(p,[p[0],y+.85,p[2]],rail);}
  void n;
}

/* ------------------------------------------------------------------ villa (Our home) */

type VillaPlan=Plan&{r:Rect;wallH:number;rise:number;ov:number;storeys:number};
export const villa:KindDef<VillaPlan>={
  plan(rec){
    const r=rectOf(rec.size.w/2,rec.size.d/2),wallH=Math.max(3,rec.size.h),rise=Math.min(r.hx,r.hz)*Math.tan(rad(rec.roof.pitch||22)),ov=rec.roof.overhang>0?rec.roof.overhang:.6;
    const vols:Vol[]=[box(0,0,r.hx+.18,r.hz+.18,'ground',0,'support','stone'),box(0,0,r.hx,r.hz,0,wallH,'wall','stucco'),...hipVols(r,wallH,rise,ov),box(r.hx*.5,0,.4,.4,wallH,wallH+rise+1,'wall','stucco'),box(-r.hx*.5,0,.4,.4,wallH,wallH+rise+1,'wall','stucco')];
    return {vols,eave:wallH,top:wallH+rise+1.15,r,wallH,rise,ov,storeys:rec.storeys??(wallH>5.6?2:1)};
  },
  draw(c,p){
    const {b,pal,F,full,theme,floor,rec}=c,{r}=p,eave=floor+p.wallH,wall=pal.special.villa??pick(pal.walls,0),df=doorFace(rec);
    plinth(c,r);walls(c,r,floor,eave,wall);
    if(theme!=='newfoundland'){band(c,r,floor,floor+.7,pal.base,.03);quoins(c,r,floor,eave);}
    band(c,r,eave-.4,eave,pal.trim,theme==='newfoundland'?.08:.32);
    roofHip(c,r,eave,p.rise,p.ov,{col:pick(pal.roofs,1),wall,ridge:pal.ridge});
    for(const sx of [-1,1]){const q=F.W(sx*r.hx*.5,0,0),top=eave+p.rise+1;b.box(q[0],q[2],F.yaw,.4,.4,eave+p.rise*.5,top,wall,shade(wall,.85));if(full)b.box(q[0],q[2],F.yaw,.5,.5,top,top+.15,pick(pal.roofs,1),shade(pick(pal.roofs,1),.8));}
    const kitchen=str(rec,'kitchenFace','back') as Face;
    for(const f of ['front','right','back','left'] as const){const hl=f==='front'||f==='back'?r.hx:r.hz,n=Math.max(1,Math.floor((hl*2-1)/2.8));
      for(let s=0;s<p.storeys;s++){const y=floor+(s===0?1:3.4+(s-1)*3);if(y+1.6>eave-.5)break;
        for(let i=0;i<n;i++){const u=-hl+hl*2*(i+.5)/n;
          if(f===df&&s===0&&i===Math.floor(n/2)){doorAt(c,r,f,u,floor,1.3,2.5,pal.door,{arch:true,lit:true});if(full)for(const sd of [-1,1])wallLantern(c,r,f,u+sd*1.25,floor+2.4);continue;}
          if(f===kitchen&&s===0&&i===0){windowAt(c,r,f,u,y,1.6,1.5,{lit:true,shutters:full?'open':false,shutter:pick(pal.shutters,0),box:full?pal.terra:false,head:'cornice'});continue;}
          windowAt(c,r,f,u,y,.85,1.55,{lit:(i+s+f.length)%3!==0,shutters:full?((i+s)%4===3?'closed':'open'):false,shutter:pick(pal.shutters,0),head:s>0?'cornice':false});}}}
    if(theme==='taylor')for(const f of ['front','back'] as const)stencil(c,r,f,0,eave-1,.26,ICON.hearth,pal.tape[0]!);
    footShade(c,r);
  },
};
/** Corner quoins: alternating long and short blocks up both faces of every corner. */
export function quoins(c:DrawCtx,r:Rect,y0:number,y1:number,step=.55,col=c.pal.quoin){
  if(!c.full)return;
  for(const f of ['front','right','back','left'] as const){const hl=f==='front'||f==='back'?r.hx:r.hz;let k=0;
    for(let y=y0+.05;y<y1-.1;y+=step,k++){const w=k%2?.5:.32,top=Math.min(y1,y+step-.06);facePanel(c.b,c.F,r,f,-hl,-hl+w,y,top,col,.014);facePanel(c.b,c.F,r,f,hl-w,hl,y,top,col,.014);}}
}

/* ------------------------------------------------------------------ palazzo (the Fund bank) */

type PalazzoPlan=Plan&{r:Rect;wallH:number;rise:number;ov:number;arcades:number};
export const palazzo:KindDef<PalazzoPlan>={
  plan(rec){
    const r=rectOf(rec.size.w/2,rec.size.d/2),wallH=Math.max(4,rec.size.h),rise=Math.min(r.hx,r.hz)*Math.tan(rad(rec.roof.pitch||18)),ov=rec.roof.overhang>0?rec.roof.overhang:.7;
    const vols:Vol[]=[box(0,0,r.hx+.25,r.hz+.25,'ground',0,'support','stone'),box(0,0,r.hx,r.hz,0,wallH,'wall','stone'),box(0,0,r.hx+.55,r.hz+.55,wallH-.55,wallH,'wall','stone'),...hipVols(r,wallH,rise,ov)];
    return {vols,eave:wallH,top:wallH+rise,r,wallH,rise,ov,arcades:Math.max(1,Math.round(num(rec,'arcades',3)))};
  },
  draw(c,p){
    const {b,pal,F,full,theme,floor,rec}=c,{r}=p,eave=floor+p.wallH,wall=pal.special.bank??pick(pal.walls,0),df=doorFace(rec),gf=Math.min(3.6,p.wallH*.55);
    plinth(c,r,floor,.25,pal.stone);walls(c,r,floor,eave,wall);
    // Rusticated ground floor: deep horizontal joints and a heavier base course.
    for(const f of ['front','right','back','left'] as const){const hl=f==='front'||f==='back'?r.hx:r.hz;for(let y=floor+.5;y<floor+gf;y+=.5)b.line(facePt(F,r,f,-hl,y,.015),facePt(F,r,f,hl,y,.015),pal.special.bankJoint??shade(wall,.75));}
    band(c,r,floor,floor+.6,pal.base,.05);band(c,r,floor+gf,floor+gf+.22,pal.trim,.08);quoins(c,r,floor+gf+.22,eave-.55,.6);
    band(c,r,eave-.55,eave,pal.trim,theme==='newfoundland'?.1:.55);
    roofHip(c,r,eave,p.rise,p.ov,{col:pick(pal.roofs,2),wall,ridge:pal.ridge});
    // The loggia: round arches on the door face; the middle one is the door, the others glazed and lit.
    const n=p.arcades,span=Math.min(4,(r.hx*2-2)/n);
    for(let i=0;i<n;i++){const u=(i-(n-1)/2)*span,mid=i===Math.floor(n/2);
      facePanel(b,F,r,df,u-1.3-.18,u+1.3+.18,floor,floor+2.4-1.3,pal.trim,.015);faceArch(b,F,r,df,u,floor+2.4-1.3+0,1.48,pal.trim,.015,full?7:4);
      if(mid)doorAt(c,r,df,u,floor,2.2,2.4,pal.door,{arch:true,lit:true});else windowAt(c,r,df,u,floor,2.2,2.4,{arch:true,lit:true,sill:false,surround:.08});
      if(i<n-1&&full)facePanel(b,F,r,df,u+span/2-.25,u+span/2+.25,floor+.6,floor+gf,shade(wall,1.06),.04);}
    if(full){const q=facePt(F,r,df,0,floor+2.85,.5);b.line(facePt(F,r,df,0,floor+3.4,.02),q,pal.iron);const {right}=faceAxes(F,df);b.quad([q[0]-right[0]*.16,q[1]-.45,q[2]-right[2]*.16],[q[0]+right[0]*.16,q[1]-.45,q[2]+right[2]*.16],[q[0]+right[0]*.16,q[1],q[2]+right[2]*.16],[q[0]-right[0]*.16,q[1],q[2]-right[2]*.16],pal.lamp,'glow');}
    // Piano nobile: pedimented windows on every face.
    for(const f of ['front','right','back','left'] as const){const hl=f==='front'||f==='back'?r.hx:r.hz,m=Math.max(2,Math.floor(hl*2/4.2));
      for(let i=0;i<m;i++){const u=-hl+hl*2*(i+.5)/m;windowAt(c,r,f,u,floor+gf+.75,1.0,Math.min(1.9,p.wallH-gf-1.6),{lit:(i+f.length)%2===0,head:'pediment',shutters:false});
        if(f!==df)windowAt(c,r,f,u,floor+1.1,.7,1.2,{lit:false,sill:false,mullion:false});}}
    if(theme==='taylor')stencil(c,r,df,0,eave-.9,.3,ICON.star,pal.tape[2]??pal.tape[0]!);
    footShade(c,r,.3);
  },
};

/* ------------------------------------------------------------------ campanile */

type CampPlan=Plan&{s:number;shaftH:number;belfryH:number;cornice:number;capRise:number;oa:number;bs:number;cone:boolean;open:boolean};
export const campanile:KindDef<CampPlan>={
  plan(rec){
    const s=Math.min(rec.size.w,rec.size.d)/2,shaftH=Math.max(6,rec.size.h),belfryH=num(rec,'belfryH',4.4),cornice=.4,capRise=num(rec,'capRise',4.2),bs=s-.2,oa=Math.min(bs-.45,num(rec,'archHalf',1.1));
    const open=flag(rec,'belfryOpen',true),cone=rec.roof.form==='cone',e=shaftH+belfryH,cb=e+cornice,ex=s+.25;
    const vols:Vol[]=[box(0,0,s+.3,s+.3,'ground',0,'support','stone'),box(0,0,s,s,0,shaftH-.3,'wall','stone'),box(0,0,bs,bs,shaftH-.3,shaftH,'floor','stone',true)];
    const ph=(bs-oa)/2,pc=(bs+oa)/2;
    for(const [sx,sz] of [[-1,-1],[1,-1],[1,1],[-1,1]] as const)vols.push(box(sx*pc,sz*pc,ph,ph,shaftH,e,'wall','stone'));
    const spring=e-.25-oa;
    for(const [x,z,hx,hz] of [[0,bs-.2,oa,.2],[0,-bs+.2,oa,.2],[bs-.2,0,.2,oa],[-bs+.2,0,.2,oa]] as const){
      vols.push(box(x,z,hx,hz,spring,e,'wall','stone'));
      if(open)vols.push(box(x,z,hx,hz,shaftH,shaftH+1.05,'rail','stone'));else vols.push(box(x,z,hx,hz,shaftH,spring,'wall','stone'));}
    vols.push(box(0,0,ex,ex,e,cb,'roof','stone'));
    vols.push(...[0,1,2,3].map(i=>{const A=[[-ex,ex],[ex,ex],[ex,-ex],[-ex,-ex]] as const,a=A[i]!,b2=A[(i+1)%4]!;return prism([[a[0],a[1],cb],[b2[0],b2[1],cb],[0,0,cb+capRise]],cb,'roof','tile');}));
    return {vols,eave:cb,top:cb+capRise,s,shaftH,belfryH,cornice,capRise,oa,bs,cone,open};
  },
  draw(c,p){
    const {b,pal,F,full,theme,floor}=c,{s,bs,oa}=p,r=rectOf(s,s),rb=rectOf(bs,bs),sh=floor+p.shaftH,e=sh+p.belfryH,cb=e+p.cornice;
    const brick=pal.special.campanile??pal.brick;
    plinth(c,r,floor,.3,pal.stone);
    walls(c,r,floor,sh,brick,{skin:theme==='classic'?'stucco':pal.skin});
    if(theme==='classic'){for(const f of ['front','right','back','left'] as const)for(let y=floor+.3;y<sh;y+=.3)b.line(facePt(F,r,f,-s,y,.012),facePt(F,r,f,s,y,.012),shade(brick,.78));quoins(c,r,floor,sh,1.1);}
    else if(theme==='taylor')quoins(c,r,floor,sh,1.1,pal.paperEdge);
    for(const t of [1/3,2/3])band(c,r,floor+p.shaftH*t,floor+p.shaftH*t+.3,pal.trim,.2);
    band(c,r,sh-.3,sh,pal.trim,.2);
    // A blank clock (no numerals: no world text) and the arched door.
    const ck=facePt(F,r,'front',0,sh-3,.06),{right,n}=faceAxes(F,'front');
    for(let k=0;k<(full?12:8);k++){const m=full?12:8,a0=k/m*Math.PI*2,a1=(k+1)/m*Math.PI*2,P=(a:number,rr:number):V3=>[ck[0]+right[0]*Math.cos(a)*rr,ck[1]+Math.sin(a)*rr,ck[2]+right[2]*Math.cos(a)*rr];
      b.tri(ck,P(a0,1),P(a1,1),pal.trim);b.line(P(a0,1.02),P(a1,1.02));if(full)b.line(P(a0,.85),P(a0,.98),shade(pal.trim,.6));}
    b.line([ck[0]+n[0]*.02,ck[1],ck[2]+n[2]*.02],[ck[0]+n[0]*.02,ck[1]+.6,ck[2]+n[2]*.02],pal.iron);
    doorAt(c,r,'front',0,floor,1.3,2.3,pal.door,{arch:true});
    // Belfry: corner piers, spandrels over round arches, a balustrade in each arch, the bell and its lamp.
    const ph=(bs-oa)/2,pc=(bs+oa)/2,spring=e-.25-oa;
    for(const [sx,sz] of [[-1,-1],[1,-1],[1,1],[-1,1]] as const){const q=F.W(sx*pc,sz*pc,0);b.box(q[0],q[2],F.yaw,ph,ph,sh,e,brick,shade(brick,.86));}
    for(const f of ['front','right','back','left'] as const){
      spandrel(c,rb,f,0,spring,oa,e,brick,.0);spandrel(c,rectOf(bs-.4,bs-.4),f,0,spring,oa,e,shade(brick,.8),0);
      if(p.open){const a=facePt(F,rb,f,-oa,sh+1.05,-.2),z2=facePt(F,rb,f,oa,sh+1.05,-.2);b.beam(a,z2,.25,.12,pal.trim);if(full)for(let t=1;t<6;t++){const q=facePt(F,rb,f,-oa+2*oa*t/6,sh,-.2);b.post(q[0],q[2],sh,sh+1,.07,pal.trim,5);}}
      else facePanel(b,F,rb,f,-oa,oa,sh,spring,shade(brick,.6),-.15);}
    const bell=F.W(0,0,0);b.box(bell[0],bell[2],F.yaw,bs,bs,sh-.05,sh+.02,pal.stone,shade(pal.stone,.8),null);
    b.cone(bell[0],bell[2],sh+1.4,sh+2.4,.75,.35,pal.special.bell??pal.brass,full?10:6,'steel');b.post(bell[0],bell[2],sh+2.4,e-.2,.06,pal.iron,4,'steel');
    if(full)b.quad([bell[0]-.12,sh+1.3,bell[2]],[bell[0]+.12,sh+1.3,bell[2]],[bell[0]+.12,sh+1.55,bell[2]],[bell[0]-.12,sh+1.55,bell[2]],pal.lamp,'glow');
    // Cornice and the cap.
    band(c,rectOf(s+.25,s+.25),e,cb,pal.trim,0);
    const roof=pick(pal.roofs,0),ex=s+.25,apex=F.W(0,0,cb+p.capRise);
    if(p.cone){const q=F.W(0,0,0);b.cone(q[0],q[2],cb,cb+p.capRise,ex,0,roof,full?12:8,'card',true);}
    else{const C=[F.W(-ex,ex,cb),F.W(ex,ex,cb),F.W(ex,-ex,cb),F.W(-ex,-ex,cb)];for(let i=0;i<4;i++){b.tri(C[i]!,C[(i+1)%4]!,apex,shade(roof,[1.03,.9,.8,.88][i]!));b.line(inkLift(C[i]!),inkLift(apex));}}
    b.post(apex[0],apex[2],cb+p.capRise,cb+p.capRise+.9,.05,pal.iron,4,'steel');
    if(theme==='taylor')stencil(c,r,'front',0,sh-6,.4,ICON.star,pal.tape[2]??pal.tape[0]!);
    footShade(c,r,.35,1.4);
  },
};
/** The spandrel round a round arch on a face: the wall between the arch head and a lintel line (both faces drawn). */
export function spandrel(c:DrawCtx,r:Rect,face:Face,u:number,spring:number,rr:number,top:number,col:RGB,o=.0,n=c.full?7:4){
  const {b,F}=c,P=(uu:number,y:number)=>facePt(F,r,face,uu,y,o),L=P(u-rr,top),R=P(u+rr,top);
  for(let k=0;k<n;k++){const a0=Math.PI-k/n*Math.PI,a1=Math.PI-(k+1)/n*Math.PI,p0=P(u+Math.cos(a0)*rr,spring+Math.sin(a0)*rr),p1=P(u+Math.cos(a1)*rr,spring+Math.sin(a1)*rr);
    b.tri(p0,p1,(a0+a1)/2>Math.PI/2?L:R,col);b.line(p0,p1);}
  b.tri(L,P(u,spring+rr),R,col);
}

/* ------------------------------------------------------------------ loggia */

type LoggiaPlan=Plan&{r:Rect;h:number;n:number;pier:number;rise:number;ov:number;back:boolean;spring:number;arch:number};
export const loggia:KindDef<LoggiaPlan>={
  plan(rec){
    const r=rectOf(rec.size.w/2,rec.size.d/2),h=Math.max(3,rec.size.h),n=Math.max(1,Math.round(num(rec,'arcades',3))),pier=.32,span=(r.hx*2)/n,arch=Math.max(.6,span/2-pier),spring=h-.6-arch;
    const rise=Math.min(r.hx,r.hz)*Math.tan(rad(rec.roof.pitch||20)),ov=rec.roof.overhang>0?rec.roof.overhang:.4,back=flag(rec,'backWall',true);
    const vols:Vol[]=[box(0,0,r.hx+.3,r.hz+.3,'ground',0,'floor','stone',true)];
    for(let i=0;i<=n;i++){const x=-r.hx+span*i;vols.push(box(x,r.hz-pier,pier,pier,0,h,'support','stone'));if(!back)vols.push(box(x,-r.hz+pier,pier,pier,0,h,'support','stone'));}
    vols.push(box(0,r.hz-pier,r.hx,pier,spring,h,'wall','stone'));
    if(back)vols.push(box(0,-r.hz+.2,r.hx,.2,0,h,'wall','stone'));else vols.push(box(0,-r.hz+pier,r.hx,pier,spring,h,'wall','stone'));
    vols.push(box(0,0,r.hx+.15,r.hz+.15,h,h+.5,'wall','stone'),...hipVols(r,h+.5,rise,ov));
    return {vols,eave:h+.5,top:h+.5+rise,r,h,n,pier,rise,ov,back,spring,arch};
  },
  draw(c,p){
    const {b,pal,F,full,floor}=c,{r,n,pier}=p,top=floor+p.h,span=(r.hx*2)/n,wall=paintOf(c,pal.walls,3),col=c.theme==='taylor'?pal.paperEdge:pal.trim;
    plinth(c,r,floor,.3,pal.stone);
    for(let i=0;i<=n;i++){const x=-r.hx+span*i;for(const z of p.back?[r.hz-pier]:[r.hz-pier,-r.hz+pier]){const q=F.W(x,z,0);b.box(q[0],q[2],F.yaw,pier,pier,floor,top,col,shade(col,.86));if(full)b.box(q[0],q[2],F.yaw,pier+.1,pier+.1,floor,floor+.35,pal.stone,shade(pal.stone,.8));}}
    // Arcade spandrels front (and back when open), the end walls' arches, the back wall.
    const fr=rectOf(r.hx,pier),fz=r.hz-pier;
    for(let i=0;i<n;i++){const u=-r.hx+span*(i+.5);for(const [face,cz] of p.back?[['front',fz]] as const:[['front',fz],['back',-fz]] as const){const rr={...fr,cz};spandrel(c,rr,face,face==='front'?u:-u,floor+p.spring,p.arch,top,wall,0);}}
    for(const [face,cz] of p.back?[['front',fz]] as const:[['front',fz],['back',-fz]] as const)facePanel(b,F,{...fr,cz},face,-r.hx,r.hx,floor+p.spring+p.arch,top,wall,.001);
    if(p.back){walls(c,rectOf(r.hx,.2,0,-r.hz+.2),floor,top,wall,{faces:['front']});}
    band(c,rectOf(r.hx+.15,r.hz+.15),top,top+.5,pal.trim,0);
    roofHip(c,r,top+.5,p.rise,p.ov,{col:pick(pal.roofs,1),wall,ridge:pal.ridge});
    if(full){const q=F.W(0,0,0);b.line([q[0],top,q[2]],[q[0],top-.7,q[2]],pal.iron);b.quad([q[0]-.15,top-1.15,q[2]],[q[0]+.15,top-1.15,q[2]],[q[0]+.15,top-.7,q[2]],[q[0]-.15,top-.7,q[2]],pal.lamp,'glow');}
    footShade(c,r,.4);
  },
};

/* ------------------------------------------------------------------ kiosk */

type KioskPlan=Plan&{r:Rect;h:number;rise:number;ov:number};
export const kiosk:KindDef<KioskPlan>={
  plan(rec){
    const r=rectOf(rec.size.w/2,rec.size.d/2),h=Math.max(2.2,rec.size.h),rise=Math.min(r.hx,r.hz)*Math.tan(rad(rec.roof.pitch||30)),ov=rec.roof.overhang>0?rec.roof.overhang:.5;
    return {vols:[box(0,0,r.hx+.12,r.hz+.12,'ground',0,'support','stone'),box(0,0,r.hx,r.hz,0,h,'wall','timber'),...hipVols(r,h,rise,ov)],eave:h,top:h+rise+.5,r,h,rise,ov};
  },
  draw(c,p){
    const {b,pal,F,full,floor,rec}=c,{r}=p,eave=floor+p.h,wall=paintOf(c,pal.walls,5),df=doorFace(rec);
    plinth(c,r,floor,.12);walls(c,r,floor,eave,wall);band(c,r,eave-.3,eave,pal.trim,.12);
    roofHip(c,r,eave,p.rise,p.ov,{col:pick(pal.roofs,0),wall});
    const apex=F.W(0,0,eave+p.rise);b.post(apex[0],apex[2],apex[1]-.1,apex[1]+.5,.05,pal.brass,4,'steel');
    const hl=df==='front'||df==='back'?r.hx:r.hz;
    windowAt(c,r,df,0,floor+1,hl*2-.8,1.1,{lit:true,sill:true,mullion:false});
    if(full)awningOn(c,r,df,-hl+.1,hl-.1,eave-.15,pick(pal.awnings,1),{depth:.8,drop:.35});
    const side:Face=df==='front'?'right':'front';doorAt(c,r,side,0,floor,.8,1.95,pal.door);
    footShade(c,r,.15,.8);
    void openRail;void gableGeom;void roofGable;void postAt;
  },
};
