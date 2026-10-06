/**
 * The Landing & Long Sands, Direction B "California boardwalk" (protos/long-sands §5–§10; the warm-coast family with
 * Little Harbour): the Boathouse re-dress (white walls, terracotta roof, a gable lantern for page L), boardwalk
 * storefronts (collidable facades with shallow porches, striped awnings, a blank sign band, no lettering), lifeguard
 * towers on stilts, a shack and the pier's Ferris wheel (hub, two rims, spokes, gondolas; it faces its yaw; a ring of
 * bulbs glows at night). Taylor: pastel beach-hut card, shell stencils. Newfoundland: jellybean clapboard stages.
 */
import {
  box,prism,num,str,rectOf,facePt,facePanel,faceAxes,windowAt,doorAt,plinth,footShade,walls,band,roofGable,gableVols,roofFlat,flatVols,
  wallLantern,openRail,paintOf,pick,stencil,ICON,shade,mix,inkLift,rod,
  type KindDef,type Plan,type Rect,type Vol,type V3,
} from './core.ts';
import {housePlan,houseShell,houseOpenings,type HousePlan} from './house.ts';
import {awningOn} from './harbour.ts';
export {rod};
import type {Face} from '../../neighbourhoods/types.ts';

/* ------------------------------------------------------------------ boathouse (host re-dress) */
export const boathouse:KindDef<HousePlan>={
  plan:rec=>housePlan({...rec,roof:{...rec.roof,form:rec.roof.form==='none'?'gable':rec.roof.form}},{pitch:22,ov:.45}),
  draw(c,p){
    const {b,pal,F,floor,full}=c,{r}=p,eave=floor+p.wallH,wall=pal.special.boathouse??pal.walls[5]!;
    houseShell(c,p,{wall,roof:pick(pal.roofs,0),ridge:pal.ridge,base:c.theme==='classic'?mix(wall,pal.plinth,.4):undefined});
    const boatFace=(c.rec.params?.boatFace as Face|undefined)??'right',hl=boatFace==='front'||boatFace==='back'?r.hx:r.hz;
    const dw=Math.min(5.2,hl*2-1.2),dh=Math.min(3.2,p.wallH-.5);
    facePanel(b,F,r,boatFace,-dw/2-.18,dw/2+.18,floor,floor+dh+.18,pal.trim,.015);facePanel(b,F,r,boatFace,-dw/2,dw/2,floor,floor+dh,pal.special.boatDoor??pal.door,.03);
    for(let u=-dw/2+.4;u<dw/2;u+=.4)b.line(facePt(F,r,boatFace,u,floor+.05,.04),facePt(F,r,boatFace,u,floor+dh-.05,.04),shade(pal.special.boatDoor??pal.door,.7));
    b.line(facePt(F,r,boatFace,0,floor,.05),facePt(F,r,boatFace,0,floor+dh,.05));
    // Long-face windows, lit; the gable lantern over the boat doors (page L's light) and two door lamps.
    for(const f of ['front','back'] as const)for(const u of [-r.hx*.6,0,r.hx*.6])windowAt(c,r,f,u,floor+1.5,1.4,1.1,{lit:true});
    wallLantern(c,r,boatFace,0,eave+Math.min(1.1,p.rise*.55),undefined,1.6);
    if(full)for(const s of [-1,1])wallLantern(c,r,boatFace,s*(dw/2+.55),floor+dh);
    houseOpenings(c,p,{faces:[],door:{col:pal.door}});
  },
};

/* ------------------------------------------------------------------ storefront */
type StorePlan=Plan&{r:Rect;H:number;two:boolean;porch:number};
export const storefront:KindDef<StorePlan>={
  plan(rec){
    const r=rectOf(rec.size.w/2,rec.size.d/2),H=Math.max(3.5,rec.size.h),two=H>6,porch=num(rec,'porch',1.4);
    const vols:Vol[]=[box(0,0,r.hx+.12,r.hz+.12,'ground',0,'support','stone'),box(0,0,r.hx-.2,r.hz,0,H,'wall','stucco'),...flatVols(rectOf(r.hx-.15,r.hz+.15),H,.42),
      box(0,r.hz+porch/2,r.hx-.5,porch/2,-.3,0,'deck','boardwalk',true),box(-r.hx+.7,r.hz+porch-.1,.08,.08,0,2.75,'support','timber'),box(r.hx-.7,r.hz+porch-.1,.08,.08,0,2.75,'support','timber')];
    if(two)vols.push(box(0,r.hz+.8,r.hx-1,.8,3.72,3.9,'deck','plaza',true));
    return {vols,eave:H,top:H+.5,r,H,two,porch};
  },
  draw(c,p){
    const {b,pal,F,floor,full,theme,rec}=c,{r,H}=p,wr=rectOf(r.hx-.2,r.hz),wall=paintOf(c,pal.walls,0),top=floor+H;
    plinth(c,r,floor,.12);walls(c,wr,floor,top,wall,{faces:['front','left','right']});
    // The false front: a parapet cap, a sign band (blank: no lettering anywhere), a cornice line.
    roofFlat(c,rectOf(r.hx-.15,r.hz+.15),top,.42,wall,wall,pal.trim);band(c,wr,top-.3,top,pal.trim,.08);
    const sw=Math.min(6,r.hx*2-4),signCol=pick([pal.trim,pal.special.band??pal.trim,pick(pal.walls,1)],Math.floor(c.h(3)*3));
    facePanel(b,F,wr,'front',-sw/2,sw/2,top-1.75,top-.85,signCol,.07);b.line(facePt(F,wr,'front',-sw/2,top-.85,.08),facePt(F,wr,'front',sw/2,top-.85,.08));b.line(facePt(F,wr,'front',-sw/2,top-1.75,.08),facePt(F,wr,'front',sw/2,top-1.75,.08));
    if(theme==='taylor')stencil(c,wr,'front',sw/2+.5,top-1.3,.28,ICON.shell,pal.tape[1]??pal.tape[0]!);
    // Shop window and door; the upper window and balcony slab on two-storey fronts.
    const ww=Math.max(2,r.hx*2-2.4-1.6);
    windowAt(c,wr,'front',-.8,floor+.5,ww,2.1,{lit:true,sill:false,surround:.12});
    doorAt(c,wr,'front',r.hx-1.3,floor,1,2.3,pal.door,{lit:false});
    if(p.two){windowAt(c,wr,'front',0,floor+4.6,Math.max(1.5,r.hx*2-3),1.5,{lit:true,surround:.12});
      const q=F.W(0,r.hz+.8,0);b.box(q[0],q[2],F.yaw,r.hx-1,.8,floor+3.72,floor+3.9,pal.trim,shade(pal.trim,.8));
      if(full){const rail=theme==='newfoundland'?pal.trim:theme==='taylor'?pal.frame:pal.trim;b.beam(F.W(-r.hx+1,r.hz+1.55,floor+4.85),F.W(r.hx-1,r.hz+1.55,floor+4.85),.06,.06,rail,null,'steel');for(let u=-r.hx+1;u<=r.hx-1+1e-6;u+=.5)b.line(F.W(u,r.hz+1.55,floor+3.9),F.W(u,r.hz+1.55,floor+4.85),rail);}}
    // Striped awning (params.awningStripe picks the stripe), porch deck and its posts, a porch lamp.
    const stripe=pick(pal.stripes,num(rec,'awningStripe',Math.floor(c.h(1)*4))),white=theme==='newfoundland'?pal.trim:pal.paperEdge;
    awningOn(c,wr,'front',-r.hx+.5,r.hx-.5,floor+2.95,stripe,{depth:p.porch-.15,drop:.35,stripes:[white,stripe]});
    const dq=F.W(0,r.hz+p.porch/2,0);b.box(dq[0],dq[2],F.yaw,r.hx-.5,p.porch/2,floor-.3,floor,pal.timber,shade(pal.timber,.7));
    for(let u=-r.hx+.6;u<r.hx-.5;u+=.3)b.line(F.W(u,r.hz,floor+.01),F.W(u,r.hz+p.porch,floor+.01),shade(pal.timber,.7));
    for(const s of [-1,1]){const q=F.W(s*(r.hx-.7),r.hz+p.porch-.1,0);b.box(q[0],q[2],F.yaw,.08,.08,floor,floor+2.75,pal.trim,shade(pal.trim,.85));}
    wallLantern(c,wr,'front',r.hx-.4,floor+2.6);
    // Surfboards leaning by the door (some fronts).
    if(full&&c.h(7)<.35){const cols=[pick(pal.stripes,1),pick(pal.walls,2),pal.trim,pick(pal.stripes,0)];for(let i=0;i<4;i++){const u=-r.hx+.9+i*.62,a=facePt(F,wr,'front',u,floor,.25),e=facePt(F,wr,'front',u+.18,floor+2.2,.06),{right}=faceAxes(F,'front');
      b.quad([a[0]-right[0]*.26,a[1],a[2]-right[2]*.26],[a[0]+right[0]*.26,a[1],a[2]+right[2]*.26],[e[0]+right[0]*.2,e[1],e[2]+right[2]*.2],[e[0]-right[0]*.2,e[1],e[2]-right[2]*.2],cols[i]!);}}
    footShade(c,r);
  },
};

/* ------------------------------------------------------------------ lifeguard tower */
const GUARD_RAILS=(hx:number,hz:number):[[number,number],[number,number]][]=>[[[-hx+.05,hz-.05],[hx-.05,hz-.05]],[[-hx+.05,-hz+.05],[-hx+.05,hz-.05]],[[hx-.05,-hz+.05],[hx-.05,hz-.05]]];
type GuardPlan=Plan&{hx:number;hz:number;h:number;hut:Rect;hutH:number;ramp:number};
export const lifeguardTower:KindDef<GuardPlan>={
  plan(rec){
    const hx=rec.size.w/2,hz=rec.size.d/2,h=Math.max(1.2,rec.size.h),hut=rectOf(Math.min(hx-.2,1.5),Math.min(hz-.45,1.15),0,-.2),hutH=2.5,ramp=Math.sqrt(Math.max(1,5.7*5.7-h*h));
    const vols:Vol[]=[box(0,0,hx,hz,h-.2,h,'deck','boardwalk',true),box(hut.cx,hut.cz,hut.hx,hut.hz,h,h+hutH,'wall','timber'),box(0,-.2,hx+.1,hz+.1,h+hutH,h+hutH+.25,'roof','timber'),
      prism([[-.65,-hz,h],[.65,-hz,h],[.65,-hz-ramp,0],[-.65,-hz-ramp,0]],'ground','deck','boardwalk',true)];
    for(const [sx,sz] of [[-1,-1],[1,-1],[1,1],[-1,1]] as const)vols.push(box(sx*(hx-.15),sz*(hz-.15),.11,.11,'ground',h-.2,'support','timber'));
    for(const [a,e] of GUARD_RAILS(hx,hz))vols.push(box((a[0]+e[0])/2,(a[1]+e[1])/2,Math.hypot(e[0]-a[0],e[1]-a[1])/2,.05,h,h+1.05,'rail','timber',false,Math.atan2(e[0]-a[0],e[1]-a[1])-Math.PI/2));
    return {vols,eave:h+hutH,top:h+hutH+2.4,hx,hz,h,hut,hutH,ramp};
  },
  draw(c,p){
    const {b,pal,F,floor,full,ground}=c,{hx,hz,h,hut}=p,deck=floor+h,stilt=pal.special.stilt??pal.trim,wall=paintOf(c,pal.walls,0);
    for(const [sx,sz] of [[-1,-1],[1,-1],[1,1],[-1,1]] as const){const q=F.W(sx*(hx-.15),sz*(hz-.15),0);b.box(q[0],q[2],F.yaw,.11,.11,ground(q[0],q[2])-.3,deck-.2,stilt,shade(stilt,.85));}
    if(full){for(const sz of [-1,1])rod(b,F.W(-(hx-.15),sz*(hz-.15),floor+.3),F.W(hx-.15,sz*(hz-.15),deck-.4),.08,stilt,'card');}
    const dq=F.W(0,0,0);b.box(dq[0],dq[2],F.yaw,hx,hz,deck-.2,deck,pal.timber,shade(pal.timber,.65));
    walls(c,hut,deck,deck+p.hutH,wall);
    const rq=F.W(0,-.2,0);b.box(rq[0],rq[2],F.yaw,hx+.1,hz+.1,deck+p.hutH,deck+p.hutH+.25,pal.trim,shade(pal.trim,.8));
    windowAt(c,hut,'front',0,deck+1.1,Math.min(2.4,hut.hx*2-.5),.8,{lit:true,mullion:true,sill:false,surround:.1});
    doorAt(c,hut,'back',0,deck,.8,1.9,pal.door);
    if(c.theme==='taylor')stencil(c,hut,'left',0,deck+1.5,.3,ICON.shell,pal.tape[1]??pal.tape[0]!);
    for(const line of GUARD_RAILS(hx,hz))openRail(c,line,deck);
    // The ramp down the land side, with cleats.
    const a0=F.W(-.65,-hz,deck),a1=F.W(.65,-hz,deck),e1=F.W(.65,-hz-p.ramp,floor),e0=F.W(-.65,-hz-p.ramp,floor);b.quad(a0,a1,e1,e0,pal.timber);b.quad(e1,a1,[a1[0],a1[1]-.12,a1[2]],[e1[0],e1[1]-.12,e1[2]],shade(pal.timber,.6));
    if(full)for(let t=.1;t<1;t+=.12){const p0:V3=[a0[0]+(e0[0]-a0[0])*t,a0[1]+(e0[1]-a0[1])*t+.03,a0[2]+(e0[2]-a0[2])*t],p1:V3=[a1[0]+(e1[0]-a1[0])*t,a1[1]+(e1[1]-a1[1])*t+.03,a1[2]+(e1[2]-a1[2])*t];b.line(p0,p1,shade(pal.timber,.6));}
    // Flagpole and a red flag (a flag, not a sign).
    const fp=F.W(hx-.1,-hz+.1,0),ft=deck+p.hutH+.25+2.4;b.post(fp[0],fp[2],deck+p.hutH+.25,ft,.04,pal.iron,4,'steel');
    const fl=F.W(hx-.1+.9,-hz+.1,0);b.quad([fp[0],ft-.05,fp[2]],[fl[0],ft-.15,fl[2]],[fl[0],ft-.65,fl[2]],[fp[0],ft-.6,fp[2]],pal.special.flag??pal.doorAccent);
    b.shadow(dq[0],dq[2],hx+.6,hz+.6,F.yaw,ground,.28);
  },
};

/* ------------------------------------------------------------------ shack */
export const shack:KindDef<HousePlan>={
  plan:rec=>housePlan(rec,{pitch:12,ov:.35,parapet:.2}),
  draw(c,p){
    const {pal}=c,wall=c.rec.paint!==undefined?paintOf(c,pal.walls,0):pal.walls[6]??pal.walls[0]!;
    houseShell(c,p,{wall,roof:pal.trim,ridge:pal.trim});
    houseOpenings(c,p,{door:{col:pal.door},win:{w:Math.min(3,p.r.hx*2-2),h:1.2,sill:1},spacing:4,lit:1});
    if(c.theme==='taylor')stencil(c,p.r,'front',p.r.hx*.6,c.floor+p.wallH-.6,.25,ICON.shell,pal.tape[1]??pal.tape[0]!);
  },
};

/* ------------------------------------------------------------------ Ferris wheel */
type WheelPlan=Plan&{R:number;hub:number;n:number;rimZ:number;feet:[number,number][];gond:number};
export const ferrisWheel:KindDef<WheelPlan>={
  plan(rec){
    const R=num(rec,'radius',13),hub=num(rec,'hubH',R+3),n=Math.max(8,Math.round(num(rec,'gondolas',16))),rimZ=.7,gond=.75;
    const feet:[number,number][]=[[-R*.62,-2.2],[R*.62,-2.2],[-R*.62,2.2],[R*.62,2.2]];
    const vols:Vol[]=[box(0,0,1.1,1.6,hub-1.1,hub+1.1,'support','steel')];
    for(const [fx,fz] of feet){vols.push(box(fx,fz,.8,.8,'ground',.3,'support','stone'));
      for(let k=0;k<3;k++){const t=(k+.5)/3,x=fx*(1-t),z=fz+(Math.sign(fz)*1.2-fz)*t,y0=hub*t-hub/6,y1=hub*t+hub/6;vols.push(box(x,z,.35,.35,Math.max(.3,y0),y1,'support','steel'));}}
    for(let i=0;i<n;i++){const a=i/n*Math.PI*2,x=Math.cos(a)*R,y=hub+Math.sin(a)*R-.3-gond*2;vols.push(box(x,0,gond,gond,y-gond*.9,y+gond*.9,'support','steel'));}
    return {vols,eave:hub,top:hub+R+.6,R,hub,n,rimZ,feet,gond};
  },
  draw(c,p){
    const {b,pal,F,floor,full,ground}=c,{R,n,rimZ}=p,hy=floor+p.hub,white=pal.special.wheel??pal.trim,spoke=pal.special.spoke??pal.trim,seg=32;
    const P=(a:number,rr:number,z:number):V3=>F.W(Math.cos(a)*rr,z,hy+Math.sin(a)*rr);
    // Two rims and their ties.
    for(const z of [rimZ,-rimZ])for(let k=0;k<seg;k++)rod(b,P(k/seg*Math.PI*2,R,z),P((k+1)/seg*Math.PI*2,R,z),.28,white);
    for(let k=0;k<n;k++){const a=k/n*Math.PI*2;for(const z of full?[rimZ,-rimZ]:[rimZ])rod(b,P(a,1,z*1.4),P(a,R,z),.12,spoke);if(full)rod(b,P(a,R,rimZ),P(a,R,-rimZ),.12,spoke);}
    // Hub (a drum along the axle), and the A-frame legs to footings.
    const hubCol=pal.special.hub??pal.doorAccent;b.tube([F.W(0,-1.6,hy),F.W(0,1.6,hy)],1.1,hubCol,8);
    for(const z of [1.6,-1.6]){const cen=F.W(0,z,hy);for(let k=0;k<8;k++){const a0=k/8*Math.PI*2,a1=(k+1)/8*Math.PI*2;b.tri(cen,F.W(Math.cos(a0)*1.1,z,hy+Math.sin(a0)*1.1),F.W(Math.cos(a1)*1.1,z,hy+Math.sin(a1)*1.1),shade(hubCol,1.05));}}
    for(const [fx,fz] of p.feet){const foot=F.W(fx,fz,floor+.3),top=F.W(0,Math.sign(fz)*1.2,hy);rod(b,foot,top,.55,white);const q=F.W(fx,fz,0);b.box(q[0],q[2],F.yaw,.8,.8,Math.min(ground(q[0],q[2]),floor)-.3,floor+.3,pal.plinth,pal.plinthDark);}
    for(const s of [-1,1])rod(b,F.W(-p.feet[1]![0]*.55,s*1.9,floor+p.hub*.42),F.W(p.feet[1]![0]*.55,s*1.9,floor+p.hub*.42),.3,white);
    // Gondolas hanging plumb under the rim, pastels in turn, with little roofs.
    for(let k=0;k<n;k++){const a=k/n*Math.PI*2,rp=P(a,R,0),cy=rp[1]-.3-p.gond*2,q=F.W(Math.cos(a)*R,0,0),col=pick(pal.walls,k);
      b.line([rp[0],rp[1],rp[2]],[q[0],cy+p.gond,q[2]],pal.iron);
      b.box(q[0],q[2],F.yaw,p.gond,p.gond*.95,cy-p.gond*.9,cy+p.gond*.5,col,shade(col,.84));
      if(full){const ap:V3=[q[0],cy+p.gond*1.15,q[2]],cs=[F.W(Math.cos(a)*R-p.gond-.1,p.gond+.1,cy+p.gond*.5),F.W(Math.cos(a)*R+p.gond+.1,p.gond+.1,cy+p.gond*.5),F.W(Math.cos(a)*R+p.gond+.1,-p.gond-.1,cy+p.gond*.5),F.W(Math.cos(a)*R-p.gond-.1,-p.gond-.1,cy+p.gond*.5)];for(let i=0;i<4;i++)b.tri(cs[i]!,cs[(i+1)%4]!,ap,shade(white,[1,.85,.75,.9][i]!));}
      else{b.box(q[0],q[2],F.yaw,p.gond+.1,p.gond+.05,cy+p.gond*.5,cy+p.gond*.62,white,shade(white,.8),null);}}
    // Bulbs: a ring round the rim (alternating warm and cool), spoke bulbs on full.
    const bA=pal.special.bulbA??pal.lamp,bB=pal.special.bulbB??pal.lamp;
    for(let k=0;k<seg;k++){const a=(k+.5)/seg*Math.PI*2;for(const z of [rimZ+.16,-rimZ-.16]){const q=P(a,R+.05,z),s=.24,cx=s*Math.cos(F.yaw),cz=s*Math.sin(F.yaw);b.quad([q[0]-cx,q[1]-s,q[2]+cz],[q[0]+cx,q[1]-s,q[2]-cz],[q[0]+cx,q[1]+s,q[2]-cz],[q[0]-cx,q[1]+s,q[2]+cz],k%2?bB:bA,'glow');}}
    if(full)for(let k=0;k<n;k++){const q=P(k/n*Math.PI*2,R*.55,rimZ+.12),s=.15,cx=s*Math.cos(F.yaw),cz=s*Math.sin(F.yaw);b.quad([q[0]-cx,q[1]-s,q[2]+cz],[q[0]+cx,q[1]-s,q[2]-cz],[q[0]+cx,q[1]+s,q[2]-cz],[q[0]-cx,q[1]+s,q[2]+cz],pal.lamp,'glow');}
    b.line(inkLift(F.W(0,0,hy-R)),inkLift(F.W(0,0,hy-R)));
    void prism;void plinth;void footShade;void roofGable;void gableVols;void flatVols;void str;void mix;void houseOpenings;
  },
};
