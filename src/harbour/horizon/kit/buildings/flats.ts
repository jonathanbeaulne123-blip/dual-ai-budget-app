/**
 * The Flats, the approved hybrid (protos/flats §2–§7): THE hangar as a tin Quonset (corrugated barrel, rust, a canvas
 * curtain tied back so the clear span stays open), the grain-elevator tower (red clapboard, a plain painted band —
 * no lettering — a stepped head-house and a green/white beacon housing on top), the timber prairie station with
 * canvas awnings, the small domed stargazing observatory, the rock arch at the Wash Run gate and the hoodoos.
 * Taylor: silver paper, gold-thread trims, star stencils. Newfoundland: the barn-red fish-store paint on the same
 * massing (STYLE §2.4), white trim, split granite and red sandstone strata.
 */
import {
  box,prism,num,flag,rectOf,facePt,facePanel,faceAxes,windowAt,doorAt,plinth,footShade,walls,band,roofGable,gableVols,roofShed,
  wallLantern,paintOf,pick,stencil,ICON,shade,mix,inkLift,groundUnder,
  type KindDef,type Plan,type DrawCtx,type Rect,type Vol,type V3,type RGB,
  rod,
} from './core.ts';
import {housePlan,houseShell,houseOpenings,type HousePlan} from './house.ts';
import {awningOn} from './harbour.ts';

/* ------------------------------------------------------------------ Quonset (THE hangar) */
type QPlan=Plan&{hw:number;hd:number;knee:number;rise:number;N:number;open:boolean};
const arc=(p:{hw:number;knee:number;rise:number;N:number},i:number):[number,number]=>{const t=i/p.N*Math.PI;return [p.hw*Math.cos(t),p.knee+p.rise*Math.sin(t)];};
export const quonset:KindDef<QPlan>={
  plan(rec){
    const hw=rec.size.w/2,hd=rec.size.d/2,knee=Math.max(0,Math.min(2,rec.size.h)),rise=num(rec,'rise',hw*.62),N=10,open=flag(rec,'openFront',true);
    const q={hw,knee,rise,N},vols:Vol[]=[box(0,0,hw+.2,hd+.2,'ground',0,'floor','paved',true)];
    if(knee>0)for(const s of [-1,1])vols.push(box(s*(hw-.12),0,.12,hd,0,knee,'wall','tin'));
    for(let i=0;i<N;i++){const [x0,y0]=arc(q,i),[x1,y1]=arc(q,i+1);vols.push(prism([[x0,hd,y0],[x1,hd,y1],[x1,-hd,y1],[x0,-hd,y0]],Math.min(y0,y1),'roof','tin'));}
    // The closed back end: vertical strips under the arch, each topped at its lower arc point.
    for(let i=0;i<N;i++){const [x0,y0]=arc(q,i),[x1,y1]=arc(q,i+1);vols.push(box((x0+x1)/2,-hd+.08,Math.abs(x1-x0)/2,.08,0,Math.min(y0,y1),'wall','tin'));}
    if(!open)vols.push(box(0,hd-.08,hw,.08,0,knee+rise*.6,'wall','tin'));
    return {vols,eave:knee,top:knee+rise+.2,hw,hd,knee,rise,N,open};
  },
  draw(c,p){
    const {b,pal,F,floor,full,theme}=c,{hw,hd,knee,rise,N}=p,tin=pal.tin,alt=pal.tinAlt,W=(x:number,z:number,y:number)=>F.W(x,z,floor+y);
    plinth(c,rectOf(hw,hd),floor,.2,pal.plinth);
    if(knee>0)for(const s of [-1,1]){const r=rectOf(.12,hd,s*(hw-.12),0);walls(c,r,floor,floor+knee,alt,{skin:'tin',faces:[s>0?'right':'left']});}
    // The barrel: strips alternating tin tones, a darker underside, corrugation ink and ribs.
    for(let i=0;i<N;i++){const [x0,y0]=arc(p,i),[x1,y1]=arc(p,i+1),col=i%2?alt:tin;
      b.quad(W(x0,hd,y0),W(x1,hd,y1),W(x1,-hd,y1),W(x0,-hd,y0),shade(col,.9+.18*Math.sin((i+.5)/N*Math.PI)));
      b.quad(W(x1,hd,y1-.12),W(x0,hd,y0-.12),W(x0,-hd,y0-.12),W(x1,-hd,y1-.12),shade(col,.5));
      b.line(inkLift(W(x0,hd,y0)),inkLift(W(x0,-hd,y0)));
      if(full){const m=3;for(let k=1;k<m;k++){const t=(i+k/m)/N*Math.PI;b.line(W(hw*Math.cos(t),hd,p.knee+rise*Math.sin(t)+.01),W(hw*Math.cos(t),-hd,p.knee+rise*Math.sin(t)+.01),shade(col,.7));}}}
    for(let z=-hd;z<=hd+1e-6;z+=Math.max(1.5,hd/6))for(let i=0;i<N;i++){const [x0,y0]=arc(p,i),[x1,y1]=arc(p,i+1);b.line(W(x0,z,y0+.02),W(x1,z,y1+.02),shade(tin,.6));}
    // Rust streaks (Classic and Newfoundland weather; Taylor tapes its lid instead).
    if(full){for(let k=0;k<5;k++){const i=1+Math.floor(c.h(k)*(N-2)),z0=-hd+c.h(k+5)*hd*1.6,len=1+c.h(k+9)*2.5,[x0,y0]=arc(p,i),[x1,y1]=arc(p,i+1);
      if(theme==='taylor')b.quad(W(x0,z0,y0+.03),W(x1,z0,y1+.03),W(x1,z0+.5,y1+.03),W(x0,z0+.5,y0+.03),pick(pal.tape,k));
      else b.quad(W(x0,z0,y0+.02),W(x1,z0,y1+.02),W(x1,z0+len,y1+.02),W(x0,z0+len,y0+.02),mix(pal.rust,tin,.25));}}
    // End arches: the closed back wall with timber doors, the open front with a rib and the canvas tied back.
    for(const z of [-hd,hd]){for(let i=0;i<N;i++){const [x0,y0]=arc(p,i),[x1,y1]=arc(p,i+1);rod(b,W(x0,z,y0),W(x1,z,y1),.22,theme==='newfoundland'?pal.trim:shade(tin,.8));}}
    const back=W(0,-hd,0);
    for(let i=0;i<N;i++){const [x0,y0]=arc(p,i),[x1,y1]=arc(p,i+1);b.tri(back,W(x0,-hd,y0),W(x1,-hd,y1),shade(alt,.82));}
    const br=rectOf(hw,hd);doorAt(c,br,'back',0,floor,Math.min(4,hw),Math.min(3.2,knee+rise*.55),pal.timber);
    windowAt(c,br,'back',-hw*.55,floor+knee+rise*.35,1,.8,{lit:true});windowAt(c,br,'back',hw*.55,floor+knee+rise*.35,1,.8,{lit:true});
    if(p.open){const val=.9,canvas=pal.canvas;
      for(let i=2;i<N-2;i++){const [x0,y0]=arc(p,i),[x1,y1]=arc(p,i+1);b.quad(W(x0,hd+.05,y0-.05),W(x1,hd+.05,y1-.05),W(x1,hd+.05,y1-val),W(x0,hd+.05,y0-val),shade(canvas,.95));}
      for(const s of [-1,1]){const x=s*(hw-.6),q=W(x,hd+.1,0);b.cone(q[0],q[2],floor,floor+knee+rise*.38,.38,.22,canvas,6);b.line(W(x,hd+.15,knee+rise*.3),W(x-s*.3,hd+.1,knee+rise*.3),pal.iron);}}
    else facePanel(b,F,rectOf(hw,hd),'front',-hw,hw,floor,floor+knee+rise*.6,pal.canvas,.05);
    const lamp=rectOf(hw,hd);wallLantern(c,lamp,'back',Math.min(4,hw)/2+.6,floor+Math.min(3.2,knee+rise*.55));
    if(theme==='taylor')stencil(c,br,'back',0,floor+knee+rise*.75,.5,ICON.star,pal.special.star??pal.brass);
    footShade(c,rectOf(hw,hd),.2,1.3);
  },
};

/* ------------------------------------------------------------------ the grain elevator */
type ElevPlan=Plan&{r:Rect;H:number;head:Rect;headH:number;headRise:number;beacon:number;annex:Rect|null;annexH:number};
export const elevator:KindDef<ElevPlan>={
  plan(rec){
    const r=rectOf(rec.size.w/2,rec.size.d/2),H=Math.max(8,rec.size.h),head=rectOf(r.hx*.62,r.hz*.7),headH=num(rec,'headH',3.6),headRise=head.hz*Math.tan(40*Math.PI/180),beacon=1.55;
    const annex=flag(rec,'annex',true)?rectOf(1.8,r.hz*.8,-r.hx-1.8,0):null,annexH=Math.max(3,H*.22);
    const vols:Vol[]=[box(0,0,r.hx+.2,r.hz+.2,'ground',0,'support','stone'),box(0,0,r.hx,r.hz,0,H,'wall','timber'),box(0,0,r.hx+.15,r.hz+.15,H,H+.3,'roof','timber',true),
      box(0,0,head.hx,head.hz,H+.3,H+.3+headH,'wall','timber'),...gableVols(head,H+.3+headH,headRise,.35,.35,'tin'),box(0,0,.85,.85,H+.3+headH+headRise-.3,H+.3+headH+headRise+beacon,'support','steel')];
    if(annex)vols.push(box(annex.cx,annex.cz,annex.hx,annex.hz,0,annexH,'wall','timber'));
    if(annex)vols.push(box(annex.cx,annex.cz,annex.hx+.3,annex.hz+.3,annexH,annexH+.25,'roof','tin'));
    return {vols,eave:H,top:H+.3+headH+headRise+beacon+.6,r,H,head,headH,headRise,beacon,annex,annexH};
  },
  draw(c,p){
    const {b,pal,F,floor,full,theme}=c,{r,H,head}=p,red=pal.special.elevator??pick(pal.walls,0),top=floor+H,ht=top+.3+p.headH;
    plinth(c,r,floor,.2);
    walls(c,r,floor,top,red,{skin:theme==='taylor'?'paper':'clapboard',corner:pal.trim});
    // The plain painted band (no lettering, ruling 4) and the cribbing lines of the bins.
    band(c,r,top-3.4,top-2,pal.special.band??pal.trim,.03);
    band(c,rectOf(r.hx+.15,r.hz+.15),top,top+.3,pal.trim,0);
    walls(c,head,top+.3,ht,red,{skin:theme==='taylor'?'paper':'clapboard',corner:pal.trim});
    roofGable(c,head,ht,p.headRise,.35,{col:pal.tin,wall:red,ridge:shade(pal.tin,.8)});
    for(const f of ['front','back'] as const)windowAt(c,head,f,0,top+1.2,.8,1.1,{lit:true,mullion:true});
    for(const f of ['front','left','right','back'] as const)for(const y of [top*.5+floor*.5,top-5])windowAt(c,r,f,0,y,.7,.9,{lit:false,sill:false,mullion:false});
    doorAt(c,r,'front',r.hx*.45,floor,1.1,2.2,pal.doorAccent);
    // Spout and legs: a diagonal grain spout down one side (it reads as an elevator, not a tower).
    if(full){rod(b,facePt(F,r,'right',-r.hz*.3,top-1,.3),facePt(F,r,'right',r.hz+2.5,floor+3,.6),.35,pal.tin);rod(b,facePt(F,r,'right',r.hz+2.5,floor+3,.6),facePt(F,r,'right',r.hz+2.5,floor,.6),.18,pal.iron);}
    // The beacon housing on the head-house ridge: a lantern room (green and white cards) under a cap.
    const bq=F.W(0,0,0),by=ht+p.headRise-.3;
    b.box(bq[0],bq[2],F.yaw,.85,.85,by,by+.3,pal.trim,shade(pal.trim,.8));
    for(const [f,col] of [['front',pal.special.beaconG],['back',pal.special.beaconW],['left',pal.special.beaconW],['right',pal.special.beaconG]] as const){const rr=rectOf(.65,.65);facePanel(b,F,rr,f,-.6,.6,by+.3,by+1.25,pal.glass,.0);facePanel(b,F,rr,f,-.55,.55,by+.34,by+1.2,col??pal.lamp,.01,'glow');}
    for(const [sx,sz] of [[-1,-1],[1,-1],[1,1],[-1,1]] as const){const cq=F.W(sx*.62,sz*.62,0);b.post(cq[0],cq[2],by+.3,by+1.25,.05,pal.iron,4,'steel');}
    const cy=by+p.beacon-.25;b.cone(bq[0],bq[2],cy,cy+.6,.95,.1,pal.special.cap??pal.slate,8,'card',true);b.post(bq[0],bq[2],cy+.6,cy+1,.04,pal.iron,4,'steel');
    // Floodlights under the band (emissive dots: the band reads at night without a light).
    if(full)for(const u of [-r.hx*.5,r.hx*.5]){const q=facePt(F,r,'front',u,top-3.9,.5);b.line(facePt(F,r,'front',u,top-3.9,0),q,pal.iron);b.quad([q[0]-.12,q[1]-.08,q[2]],[q[0]+.12,q[1]-.08,q[2]],[q[0]+.12,q[1]+.08,q[2]],[q[0]-.12,q[1]+.08,q[2]],pal.lamp,'glow');}
    if(p.annex){const a=p.annex;walls(c,a,floor,floor+p.annexH,shade(red,.95),{skin:theme==='taylor'?'paper':'clapboard',corner:pal.trim});const aq=F.W(a.cx,a.cz,0);b.box(aq[0],aq[2],F.yaw,a.hx+.3,a.hz+.3,floor+p.annexH,floor+p.annexH+.25,pal.tin,shade(pal.tin,.75));
      doorAt(c,a,'left',0,floor,Math.min(3,a.hz*1.4),Math.min(2.8,p.annexH-.4),pal.timber);}
    if(theme==='taylor')for(const f of ['front','back'] as const)stencil(c,r,f,0,top-2.7,.5,ICON.star,pal.special.star??pal.brass);
    footShade(c,r,.2,1.5);
  },
};

/* ------------------------------------------------------------------ the prairie station */
type StationP=HousePlan&{awning:number};
export const station:KindDef<StationP>={
  plan(rec){const p=housePlan(rec,{pitch:26,ov:.9,chimney:'gable'}),aw=num(rec,'awning',2.6);
    for(const s of [-1,1])p.vols.push(box(s*(p.r.hx-.6),p.r.hz+aw-.1,.08,.08,0,2.6,'support','timber'));p.vols.push(box(0,p.r.hz+.35,1.2,.35,0,p.wallH-.2,'wall','timber'));return {...p,awning:aw};},
  draw(c,p){
    const {b,pal,F,floor,full,theme}=c,{r}=p,wall=paintOf(c,pal.walls,0);
    houseShell(c,p,{wall,roof:pick(pal.roofs,0),chimney:pal.brick,ridge:shade(pick(pal.roofs,0),.8)});
    // Brackets under the deep eaves.
    if(full)for(const f of ['front','back'] as const)for(let u=-r.hx+.6;u<r.hx;u+=2.2){b.line(facePt(F,r,f,u,floor+p.wallH-.9,.02),facePt(F,r,f,u,floor+p.wallH-.05,.9),pal.timberDark);}
    // The telegrapher's bay on the front, the doors in bush-plane yellow, windows.
    const bay=rectOf(1.2,.35,0,r.hz+.35);walls(c,bay,floor,floor+p.wallH-.2,wall);for(const f of ['front','left','right'] as const)windowAt(c,bay,f,0,floor+.9,f==='front'?1.2:.45,1.3,{lit:true,mullion:false,sill:false,surround:.08});
    houseOpenings(c,p,{door:{col:pal.doorAccent,w:1.2},win:{w:1,h:1.4,sill:.85},spacing:3,faces:['front','back'],lit:.6});
    doorAt(c,r,'left',0,floor,1.2,Math.min(2.2,p.wallH-.3),pal.doorAccent);
    // Canvas awnings on posts over the platform side.
    awningOn(c,r,'front',-r.hx+.3,-1.6,floor+Math.min(2.9,p.wallH-.15),pal.canvas,{depth:p.awning,drop:.5,stripes:[pal.canvas,shade(pal.canvas,.92)]});
    awningOn(c,r,'front',1.6,r.hx-.3,floor+Math.min(2.9,p.wallH-.15),pal.canvas,{depth:p.awning,drop:.5,stripes:[pal.canvas,shade(pal.canvas,.92)]});
    for(const s of [-1,1]){const q=F.W(s*(r.hx-.6),r.hz+p.awning-.1,0);b.box(q[0],q[2],F.yaw,.08,.08,floor,floor+2.6,pal.timberDark,shade(pal.timberDark,.8));}
    if(theme==='taylor')stencil(c,r,'back',0,floor+p.wallH-.7,.3,ICON.star,pal.special.star??pal.brass);
  },
};

/* ------------------------------------------------------------------ observatory (stargazing hut, ≤ 5 m) */
type ObsPlan=Plan&{R:number;h:number;sides:number};
const ring=(R:number,n:number,y:number):[number,number,number][]=>Array.from({length:n},(_,i)=>{const a=i/n*Math.PI*2;return [Math.cos(a)*R,Math.sin(a)*R,y] as [number,number,number];});
export const observatory:KindDef<ObsPlan>={
  plan(rec){const R=Math.min(rec.size.w,rec.size.d)/2,h=Math.max(1.8,rec.size.h),sides=12;
    return {vols:[prism(ring(R+.3,sides,0),'ground','floor','timber',true),prism(ring(R,sides,h),0,'wall','timber'),prism(ring(R*.92,sides,h+R*.5),h,'roof','steel'),prism(ring(R*.6,sides,h+R*.88),h+R*.5,'roof','steel')],eave:h,top:h+R*.95,R,h,sides};},
  draw(c,p){
    const {b,pal,F,floor,full,ground,theme}=c,{R,h}=p,q=F.W(0,0,0),drum=theme==='newfoundland'?pick(pal.walls,0):theme==='taylor'?pal.walls[0]!:pal.timberLight,dome=pal.special.dome??pal.trim;
    const g=groundUnder(ground,F,0,0,R,R);b.cone(q[0],q[2],g.min-.3,floor,R+.3,R+.3,pal.plinth,p.sides);
    b.cone(q[0],q[2],floor,floor+h,R,R,drum,p.sides,'card',true);
    if(theme==='newfoundland'||theme==='classic')for(let y=floor+.3;y<floor+h;y+=theme==='newfoundland'?.26:.4)for(let k=0;k<p.sides;k++){const a0=k/p.sides*Math.PI*2,a1=(k+1)/p.sides*Math.PI*2;b.line([q[0]+Math.cos(a0)*(R+.01),y,q[2]+Math.sin(a0)*(R+.01)],[q[0]+Math.cos(a1)*(R+.01),y,q[2]+Math.sin(a1)*(R+.01)],shade(drum,.68));}
    b.cone(q[0],q[2],floor+h,floor+h+.15,R+.15,R+.15,pal.trim,p.sides);
    b.dome(q[0],floor+h+.15,q[2],R,dome,full?16:10,full?5:3);
    // The shutter slit, a dark strip up the dome toward the sky, and a door; tiny red path lamps by the door.
    const yaw=F.yaw,sx=Math.sin(yaw),sz=Math.cos(yaw);
    for(let j=0;j<4;j++){const t0=j/4*Math.PI/2*.92,t1=(j+1)/4*Math.PI/2*.92,P=(t:number,s:number):V3=>{const rr=R*Math.cos(t)+.03,cx=Math.cos(yaw),cz=-Math.sin(yaw);return [q[0]+sx*rr+cx*s,floor+h+.15+R*Math.sin(t)+.03,q[2]+sz*rr+cz*s];};b.quad(P(t0,-.35),P(t0,.35),P(t1,.35),P(t1,-.35),shade(pal.iron,.8));}
    const dr=rectOf(R*.7,R*.7);doorAt(c,dr,'back',0,floor,.9,Math.min(1.9,h-.2),pal.doorAccent);
    if(full)for(const s of [-1,1]){const lp=F.W(s*.9,-R-.9,0),gy=ground(lp[0],lp[2]);b.post(lp[0],lp[2],gy,gy+.45,.04,pal.iron,4,'steel');b.quad([lp[0]-.06,gy+.42,lp[2]],[lp[0]+.06,gy+.42,lp[2]],[lp[0]+.06,gy+.54,lp[2]],[lp[0]-.06,gy+.54,lp[2]],pal.special.pathLamp??pal.lamp,'glow');}
    if(theme==='taylor')for(let k=0;k<5;k++){const a=k/5*Math.PI*2+.3,t=.5,dn:V3=[Math.cos(a)*Math.cos(t),Math.sin(t),Math.sin(a)*Math.cos(t)];b.decal([q[0]+dn[0]*(R+.05),floor+h+.15+dn[1]*(R+.05),q[2]+dn[2]*(R+.05)],[-Math.sin(a),0,Math.cos(a)],[-dn[1]*Math.cos(a),Math.cos(t),-dn[1]*Math.sin(a)],.22,ICON.star,pal.special.star??pal.brass,dn);}
    b.shadow(q[0],q[2],R+.5,R+.5,0,ground,.3);
  },
};

/* ------------------------------------------------------------------ rock: arch and hoodoo */
const strataAt=(c:DrawCtx,y:number):RGB=>{const s=c.pal.strata,band=Math.floor((y+1000)/3.6);return s[((band%s.length)+s.length)%s.length]!;};
type ArchPlan=Plan&{legW:number;legs:{x:number;r:number;y0:number;y1:number}[];lintel:{y0:number;y1:number;hx:number;hz:number}};
export const arch:KindDef<ArchPlan>={
  plan(rec){
    const w=rec.size.w,h=Math.max(3,rec.size.h),legW=Math.max(1.2,w*.2),n=Math.max(2,Math.round((h-1.6)/1.4)),legs:ArchPlan['legs']=[];
    for(const s of [-1,1])for(let i=0;i<n;i++){const y0=-.2+i*(h-1.6)/n,y1=-.2+(i+1)*(h-1.6)/n,lean=s*(i/n)*legW*.25;legs.push({x:s*(w/2-legW/2)-lean,r:legW/2*(1-.12*Math.sin(i*1.7+s)),y0:i===0?-1:y0,y1});}
    const lintel={y0:h-1.8,y1:h,hx:w/2-.1,hz:Math.max(.8,rec.size.d/2)};
    const vols:Vol[]=legs.map(l=>box(l.x,0,l.r*.86,Math.min(l.r,rec.size.d/2)*.86,l.y0<0?'ground':l.y0,l.y1,'wall','rock'));
    vols.push(box(0,0,lintel.hx,lintel.hz*.9,lintel.y0,lintel.y1,'wall','rock'));
    return {vols,eave:h,top:h,legW,legs,lintel};
  },
  draw(c,p){
    const {b,pal,F,floor,full,ground,theme,rec}=c,dz=Math.max(.8,rec.size.d/2);
    for(const [i,l] of p.legs.entries()){const q=F.W(l.x,0,0),y0=l.y0<0?Math.min(ground(q[0],q[2]),floor)-.4:floor+l.y0;
      drum(c,q,y0,floor+l.y1,l.r,Math.min(l.r,dz),strataAt(c,floor+l.y0+.5),full?9:6,i);}
    // The lintel: three overlapping rounded blocks, the middle one sagging a little, a darker cap.
    const L=p.lintel;for(const [k,x] of [-L.hx*.6,0,L.hx*.6].entries()){const q=F.W(x,0,0),sag=k===1?.25:0;drum(c,q,floor+L.y0-sag,floor+L.y1-sag*.3,L.hx*.45,L.hz,strataAt(c,floor+L.y0+k),full?9:6,10+k);}
    if(theme==='taylor'&&full){const a=F.W(-L.hx,L.hz+.05,floor+L.y1-.2),e=F.W(L.hx,L.hz+.05,floor+L.y1-.2);b.line(a,e,pal.paperEdge);}
    b.shadow(F.x,F.z,rec.size.w/2+.6,dz+.8,F.yaw,ground,.3);
    void pal;
  },
};
/** A wind-carved rock drum: an elliptical frustum with a bulge, banded by strata, a lit lip at its top. */
function drum(c:DrawCtx,q:V3,y0:number,y1:number,rx:number,rz:number,col:RGB,n:number,seed:number){
  const {b,F,pal,theme}=c,P=(a:number,y:number,k:number):V3=>{const lx=Math.cos(a)*rx*k,lz=Math.sin(a)*rz*k;return [q[0]+lx*F.c+lz*F.s,y,q[2]+lz*F.c-lx*F.s];};
  const mid=(y0+y1)/2;for(let i=0;i<n;i++){const a0=i/n*Math.PI*2+seed,a1=(i+1)/n*Math.PI*2+seed,lit=.82+.22*Math.max(0,-Math.cos((a0+a1)/2+F.yaw-2.6));
    b.quadV(P(a0,y0,.92),P(a1,y0,.92),P(a1,mid,1),P(a0,mid,1),shade(col,lit*.78),shade(col,lit*.78),shade(col,lit),shade(col,lit));
    b.quadV(P(a0,mid,1),P(a1,mid,1),P(a1,y1,.86),P(a0,y1,.86),shade(col,lit),shade(col,lit),shade(col,lit*1.04),shade(col,lit*1.04));
    b.tri([q[0],y1+.15,q[2]],P(a0,y1,.86),P(a1,y1,.86),shade(col,1.06));
    b.line(inkLift(P(a0,y1,.86)),inkLift(P(a1,y1,.86)));}
  if(theme==='taylor')for(let i=0;i<n;i+=2){const a0=i/n*Math.PI*2+seed,a1=(i+1)/n*Math.PI*2+seed;b.line(P(a0,mid,1.01),P(a1,mid,1.01),pal.paperEdge);}
}
type HoodooPlan=Plan&{drums:{r:number;y0:number;y1:number}[];cap:{r:number;y0:number;y1:number}};
export const hoodoo:KindDef<HoodooPlan>={
  plan(rec){
    const h=Math.max(2,rec.size.h),R=Math.max(.6,rec.size.w/2),n=Math.max(2,Math.round(h/1.7)),drums:HoodooPlan['drums']=[],capH=Math.min(1.2,h*.15);
    let k=0;for(let i=0;i<rec.id.length;i++)k=(k*31+rec.id.charCodeAt(i))>>>0;
    for(let i=0;i<n;i++){const t=i/n,waist=1-.38*Math.sin(t*Math.PI)*(.7+((k>>i)&3)*.1);drums.push({r:R*waist*(1-.25*t),y0:i===0?-1:(h-capH)*t,y1:(h-capH)*(i+1)/n});}
    const cap={r:R*.95,y0:h-capH,y1:h};
    const vols:Vol[]=rec.collide?[...drums.map(d=>box(0,0,d.r*.8,d.r*.8,d.y0<0?'ground':d.y0,d.y1,'wall','rock')),box(0,0,cap.r*.8,cap.r*.8,cap.y0,cap.y1,'wall','rock')]:[];
    return {vols,eave:h,top:h,drums,cap};
  },
  draw(c,p){
    const {pal,F,floor,full,ground}=c,q=F.W(0,0,0);
    for(const [i,d] of p.drums.entries())drum(c,q,d.y0<0?Math.min(ground(q[0],q[2]),floor)-.4:floor+d.y0,floor+d.y1,d.r,d.r*.92,strataAt(c,floor+Math.max(0,d.y0)+.4),full?9:6,i*1.3);
    drum(c,q,floor+p.cap.y0,floor+p.cap.y1,p.cap.r,p.cap.r*.85,shade(pal.strata[pal.strata.length-1]!,.85),full?9:6,7);
    c.b.shadow(q[0],q[2],p.drums[0]!.r+.6,p.drums[0]!.r+.6,0,ground,.3);
  },
};
export {roofShed,faceAxes,houseOpenings,footShade,band};
