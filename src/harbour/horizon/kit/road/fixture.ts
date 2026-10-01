/**
 * A synthetic corridor for the road kit's tests and its render sheet (`scripts/horizon/kit-sheet-road.mjs`). Fictional
 * geometry, not a place on the island: a 132 eu curved main road through a developed stretch (kerbs, sidewalks both
 * sides, a zebra, road lanterns 24 eu staggered, a side road joining with a give-way), a coastal stretch (a post-and-rail
 * on the sea side with buried and flared ends, a gap for a scenic pull-off with its wall, bench and lamp) and a mountain
 * stretch (a cutting with a retaining wall on the hill side, a stone parapet with piers over the drop, a centre solid on
 * the blind curve), plus the baked corridor solids L2 emits (deck ribbon, kerbs, sidewalks, retaining, guard colliders)
 * in the shape the contract gives them. Pure data; the ground is a function of (s, o) the sheet paints as terrain.
 */
import {CORRIDOR,type Corridor,type CorridorSide,type CorridorStation,type GuardRun,type LampSpot,type MarkingRun,type ScenicStop} from '../../land/corridor/types.ts';
import type {StructureSolid} from '../../land/interfaces.ts';
import type {WorldDefinition} from '../../world/definition.ts';
import {LAMP_HEAD} from './lamps.ts';

export const FIXTURE={length:132,step:2,half:4,paved:5,deckThickness:.6,base:8,sea:1.2,developed:[0,44] as const,coastal:[44,88] as const,mountain:[88,132] as const,junction:30,zebra:14,stop:[60,72] as const,district:'fixture'};

const heading=(s:number)=>.42*Math.sin(Math.PI*s/66-.35);
/** Road height along s: flat, then 2 % over the coast, then 4 % into the hills. */
export const fixtureRoadY=(s:number)=>FIXTURE.base+.02*Math.max(0,Math.min(s,88)-44)+.04*Math.max(0,s-88);
const smooth=(e0:number,e1:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-e0)/(e1-e0)));return t*t*(3-2*t);};
/** How much each stretch applies at s (blended over 8 eu so the land never steps). */
const weights=(s:number)=>{const c=smooth(40,48,s)-smooth(84,92,s),m=smooth(84,92,s);return {d:1-c-m,c,m};};

/** Ground relative to the road surface at (s, o): o > 0 is the right (sea) side. */
export function fixtureGroundRel(s:number,o:number):number{
  const {d,c,m}=weights(s),a=Math.abs(o),edge=FIXTURE.paved,y=fixtureRoadY(Math.max(0,Math.min(FIXTURE.length,s)));
  // Toward the sea (o > 0) every stretch falls to a shore below sea level, the coast and the mountain steeply.
  const shore=(start:number,slope:number)=>-Math.max(0,a-start)*slope;
  // Developed: flat land a hand below the deck to 16 eu, then a long gentle fall (town side) or rise (inland side).
  const dev=o>=0?-.05+shore(16,.1):-.05+Math.max(0,a-16)*.06;
  let coast:number;
  if(o>=0){const inStop=smooth(56,60,s)-smooth(72,76,s),lip=edge+.6+inStop*6.2;
    coast=a<=lip?-.05:-.05-Math.min(3.2,(a-lip)*1.6)-Math.max(0,a-lip-2)*.3;}
  else coast=-.05+Math.max(0,a-edge-1.5)*.16;
  let mtn:number;
  if(o>=0)mtn=a<=edge+.6?-.05:-.05-Math.min(6,(a-edge-.6)*2.4)-Math.max(0,a-edge-3)*.5;
  // The cutting: ground at the road in front of the wall's foot (edge + 0.15), rising inside the wall to its top (2.7 above the
  // road) at its back (edge + 1.25), then the hillside behind.
  else mtn=a<=edge+.16?-.05:a<edge+1.25?-.05+2.75*(a-edge-.16)/1.09:2.7+Math.max(0,a-edge-1.25)*.36-Math.max(0,a-edge-14)*.2;
  // Beyond the fixture's far end the cutting eases out over 30 eu (the land is not a trench forever).
  const beyond=Math.max(0,Math.min(1,(s-FIXTURE.length)/30));mtn*=1-beyond;
  // Never below the sea floor (a beach shelf just under the water).
  return Math.max(FIXTURE.sea-1.2-y,d*dev+c*coast+m*mtn);
}

function side(edge:CorridorSide['edge'],guard:CorridorSide['guard'],drop:number,extra:Partial<CorridorSide>={}):CorridorSide{return {edge,guard,drop,waterEu:null,paved:FIXTURE.paved,...extra};}

export type Fixture={world:WorldDefinition;corridor:Corridor;spur:Corridor;solids:StructureSolid[];
  /** World ground at (x, z) (the sheet's terrain). */ground:(x:number,z:number)=>number;
  /** (s, o) of the main road nearest a plan point. */locate:(x:number,z:number)=>{s:number;o:number};
  /** World point of the main road at (s, o) on the road surface. */point:(s:number,o:number)=>[number,number,number]};

export function roadFixture():Fixture{
  const F=FIXTURE,N=Math.round(F.length/F.step);
  // Stations by integrating the heading.
  const pts:{x:number;z:number;s:number;t:[number,number]}[]=[];let x=0,z=0;
  for(let i=0;i<=N;i++){const s=i*F.step,th=heading(s);pts.push({x,z,s,t:[Math.cos(th),Math.sin(th)]});const th2=heading(s+F.step/2);x+=Math.cos(th2)*F.step;z+=Math.sin(th2)*F.step;}
  const inR=(s:number,r:readonly [number,number])=>s>=r[0]&&s<r[1];
  const stations:CorridorStation[]=pts.map(p=>{
    const s=p.s,y=fixtureRoadY(s),dev=inR(s,F.developed),coast=inR(s,F.coastal),stop=inR(s,[F.stop[0],F.stop[1]+.01]),junction=Math.abs(s-F.junction)<=4;
    const walk=(sign:number)=>({inner:F.paved,outer:F.paved+CORRIDOR.kerbWidth+CORRIDOR.sidewalkWidth,height:CORRIDOR.kerbRise,bedId:`fixture.walk.${sign>0?'right':'left'}.1`});
    const left:CorridorSide=dev?side(junction?'shoulder':'sidewalk','none',0,junction?{gap:'junction'}:{footway:walk(-1),planting:{inner:F.paved+2.6,outer:F.paved+6}})
      :coast?side('shoulder','none',-.4,{planting:{inner:F.paved+1.2,outer:F.paved+9}}):side('shoulder','retaining',-2.7);
    const right:CorridorSide=dev?side('sidewalk','none',0,{footway:walk(1)})
      :coast?side('shoulder',stop?'none':'postRail',stop?0:3.2,{waterEu:18,...(stop?{gap:'viewpoint' as const}:{})}):side('shoulder','stoneParapet',6);
    return {s,at:[p.x,y,p.z],tangent:p.t,grade:dev?0:coast?.02:.04,context:dev?'developed':coast?'coastal':'mountain',reachId:dev?'fixture.R-dev':coast?'fixture.R-coast':'fixture.R-mtn',half:F.half,left,right};
  });
  const reaches=[{id:'fixture.R-dev',label:'Developed (fixture)',from:0,to:44,context:'developed' as const},{id:'fixture.R-coast',label:'Coastal (fixture)',from:44,to:88,context:'coastal' as const},{id:'fixture.R-mtn',label:'Mountain (fixture)',from:88,to:132,context:'mountain' as const}];
  const at=(s:number)=>{const i=Math.max(0,Math.min(N-1,Math.floor(s/F.step))),a=stations[i]!,b=stations[i+1]!,u=(s-a.s)/(b.s-a.s),tx=a.tangent[0]+(b.tangent[0]-a.tangent[0])*u,tz=a.tangent[1]+(b.tangent[1]-a.tangent[1])*u,l=Math.hypot(tx,tz);
    return {x:a.at[0]+(b.at[0]-a.at[0])*u,z:a.at[2]+(b.at[2]-a.at[2])*u,y:fixtureRoadY(s),tx:tx/l,tz:tz/l};};
  const point=(s:number,o:number):[number,number,number]=>{const f=at(s);return [f.x-f.tz*o,f.y,f.z+f.tx*o];};
  // Nearest point on the centreline: a coarse search, then a bounded refinement (never more than half a sample away, so a
  // point equidistant from two branches never jumps its offset); past either end, the road's end tangent extends it.
  const locate=(px:number,pz:number)=>{let best=0,bd=Infinity;for(let k=0;k<=N*4;k++){const s=k*F.step/4,f=at(s),d=(f.x-px)**2+(f.z-pz)**2;if(d<bd){bd=d;best=s;}}
    let s=best;for(let it=0;it<4;it++){const f=at(Math.max(0,Math.min(F.length,s))),ds=(px-f.x)*f.tx+(pz-f.z)*f.tz;s=best<=0||best>=F.length?s+ds:Math.max(best-F.step/4,Math.min(best+F.step/4,s+ds));}
    s=Math.max(-60,Math.min(F.length+60,s));const g=at(Math.max(0,Math.min(F.length,s))),ex=s-Math.max(0,Math.min(F.length,s));return {s,o:(px-g.x-g.tx*ex)*-g.tz+(pz-g.z-g.tz*ex)*g.tx};};
  // Near the road the ground is the section (s, o); far from it the nearest station can switch branch, so the land there is
  // a smooth field of the chord frame (u along the chord in s units, v across it, + seaward), blended in over 14–30 eu.
  const c0=point(0,0),c1=point(F.length,0),cl=Math.hypot(c1[0]-c0[0],c1[2]-c0[2]),cx=(c1[0]-c0[0])/cl,cz=(c1[2]-c0[2])/cl;
  const far=(px:number,pz:number)=>{const u=((px-c0[0])*cx+(pz-c0[2])*cz)*F.length/cl,v=(px-c0[0])*-cz+(pz-c0[2])*cx,uc=Math.max(-40,Math.min(F.length+40,u)),y=fixtureRoadY(Math.max(0,Math.min(F.length,u)));
    // Broad, smooth rates (the land rises toward the mountain end, the shore steepens toward it).
    const k=smooth(20,120,uc)*(1-smooth(F.length+10,F.length+60,u));
    if(v>0)return Math.max(F.sea-1.2,y-.05-Math.max(0,v-12)*(.12+.42*k));
    return y+Math.min(26,Math.max(0,-v-10)*(.05+.22*k));};
  const ground=(px:number,pz:number)=>{const {s,o}=locate(px,pz),w=Math.max(0,Math.min(1,(Math.abs(o)-14)/16)),wf=w*w*(3-2*w);
    const near=wf<1?fixtureRoadY(Math.max(0,Math.min(F.length,s)))+fixtureGroundRel(s,o):0;return wf>0?near*(1-wf)+far(px,pz)*wf:near;};

  // ---- Markings (ROAD.md §4.2) ----
  const markings:MarkingRun[]=[
    {id:'fixture.m.zebra',kind:'zebra',from:F.zebra,to:F.zebra+3,offset:0,width:.5,span:[-F.paved+.3,F.paved-.3]},
    {id:'fixture.m.dash.1',kind:'centreDash',from:0,to:F.zebra-2,offset:0,width:.12,dash:[3,6]},
    {id:'fixture.m.dash.2',kind:'centreDash',from:F.zebra+5,to:F.junction-6,offset:0,width:.12,dash:[3,6]},
    {id:'fixture.m.dash.3',kind:'centreDash',from:F.junction+6,to:100,offset:0,width:.12,dash:[3,6]},
    {id:'fixture.m.solid',kind:'centreSolid',from:100,to:F.length,offset:0,width:.12},
    {id:'fixture.m.edge.l',kind:'edgeLine',from:44,to:F.length,offset:-(F.paved-.2),width:.12},
    {id:'fixture.m.edge.r.1',kind:'edgeLine',from:44,to:F.stop[0]-1,offset:F.paved-.2,width:.12},
    {id:'fixture.m.edge.r.2',kind:'edgeLine',from:F.stop[1]+1,to:F.length,offset:F.paved-.2,width:.12},
  ];
  // ---- Guards ----
  const lineOf=(from:number,to:number,o:number)=>{const L:[number,number,number][]=[];const n=Math.max(1,Math.round((to-from)/F.step));for(let k=0;k<=n;k++){const s=from+(to-from)*k/n,p=point(s,o);L.push([p[0],p[1],p[2]]);}return L;};
  const off=F.paved+CORRIDOR.guardSetback;
  const guards:GuardRun[]=[
    {id:'fixture.g.rail.1',side:'right',kind:'postRail',from:47,to:F.stop[0]-1,offset:off,height:CORRIDOR.postRailHeight,line:lineOf(47,F.stop[0]-1,off),ends:['buried','flare'],colliderId:'fixture.g.rail.1.collider'},
    {id:'fixture.g.rail.2',side:'right',kind:'postRail',from:F.stop[1]+1,to:87,offset:off,height:CORRIDOR.postRailHeight,line:lineOf(F.stop[1]+1,87,off),ends:['flare','continues'],colliderId:'fixture.g.rail.2.collider'},
    {id:'fixture.g.parapet',side:'right',kind:'stoneParapet',from:87,to:F.length,offset:off,height:CORRIDOR.stoneParapetHeight,line:lineOf(87,F.length,off),ends:['pier','pier'],colliderId:'fixture.g.parapet.collider'},
  ];
  // ---- Lamps: road lanterns 24 eu staggered on the developed stretch (0.9 eu behind the kerb face), a junction lamp. ----
  const lamp=(id:string,s:number,sign:1|-1):LampSpot=>{const o=sign*(F.paved+CORRIDOR.kerbWidth+CORRIDOR.lampSetback),base=point(s,o),toward=point(s,o-sign*1),dx=toward[0]-base[0],dz=toward[2]-base[2],l=Math.hypot(dx,dz),loc=LAMP_HEAD.roadLantern.classic;
    const at:[number,number,number]=[base[0],base[1]+CORRIDOR.kerbRise,base[2]],head:[number,number,number]=[at[0]+dx/l*loc[0],at[1]+loc[1],at[2]+dz/l*loc[0]];
    return {id,kind:'roadLantern',at,head,pool:[head[0],fixtureRoadY(s),head[2]],poolRadius:CORRIDOR.lampPoolRadius,yaw:Math.atan2(dx/l,dz/l),side:sign>0?'right':'left',reachId:'fixture.R-dev'};};
  const lamps:LampSpot[]=[lamp('fixture.l.1',4,1),lamp('fixture.l.2',16,-1),lamp('fixture.l.3',26.5,-1),lamp('fixture.l.4',28,1),lamp('fixture.l.5',40,-1)];
  // Bollards at the zebra's kerbs (the Quay piece, shown here for the sheet).
  for(const [k,o] of [[0,1],[1,-1]] as const){const p=point(F.zebra-.8,o*(F.paved+.7));lamps.push({id:`fixture.b.${k}`,kind:'bollard',at:[p[0],p[1]+CORRIDOR.kerbRise,p[2]],head:[p[0],p[1]+CORRIDOR.kerbRise+.74,p[2]],pool:[p[0],p[1],p[2]],poolRadius:2,yaw:0,side:o>0?'right':'left',reachId:'fixture.R-dev'});}
  // ---- Scenic stop on the sea side of the coast ----
  const q=(s:number,o:number):[number,number]=>{const p=point(s,o);return [p[0],p[2]];};
  const mid=at((F.stop[0]+F.stop[1])/2),c=point((F.stop[0]+F.stop[1])/2,8.4);
  const stops:ScenicStop[]=[{id:'fixture.stop.lookout',label:'Lookout (fixture)',at:[c[0],c[1],c[2]],outline:[q(F.stop[0],F.paved+.05),q(F.stop[1],F.paved+.05),q(F.stop[1]-1.5,11.4),q(F.stop[0]+1.5,11.4)],facing:Math.atan2(-mid.tz,mid.tx),connectsTo:['fixture.walk.right.1']}];
  const corridor:Corridor={id:'fixture.V',closed:false,step:F.step,stations,reaches,markings,guards,lamps,planting:[],stops};

  // ---- The side road joining from the left at the junction ----
  const J=at(F.junction),jx=-(-J.tz),jz=-J.tx,start=point(F.junction,-F.paved+.02),spurStations:CorridorStation[]=[];
  for(let k=0;k<=11;k++){const s=k*2;spurStations.push({s,at:[start[0]+jx*s,fixtureRoadY(F.junction)+Math.max(0,s-6)*.03,start[2]+jz*s],tangent:[jx,jz],grade:k>3?.03:0,context:'developed',reachId:'fixture.spur',half:2.6,left:{...side('shoulder','none',0),paved:3},right:{...side('shoulder','none',0),paved:3}});}
  const spur:Corridor={id:'fixture.spur',closed:false,step:2,stations:spurStations,reaches:[{id:'fixture.spur',label:'Spur (fixture)',from:0,to:22,context:'developed'}],
    markings:[{id:'fixture.spur.giveWay',kind:'giveWay',from:1.2,to:1.5,offset:-1.45,width:.3,span:[-2.8,-.1]},{id:'fixture.spur.dash',kind:'centreDash',from:4,to:22,offset:0,width:.12,dash:[3,6]}],guards:[],lamps:[],planting:[],stops:[]};

  const solids=fixtureSolids(corridor,spur,point,ground);
  const world={corridors:[corridor,spur],geometry:{solids},lights:[],districts:[{id:F.district,neighbourhood:null,outline:[[-100,-100],[300,-100],[300,300],[-100,300]],solidIds:solids.map(s=>s.id)}]} as unknown as WorldDefinition;
  return {world,corridor,spur,solids,ground,locate,point};
}

/** The baked corridor solids as L2 emits them (kinds and roles per the contract), for the fixture. */
function fixtureSolids(main:Corridor,spur:Corridor,point:(s:number,o:number)=>[number,number,number],ground:(x:number,z:number)=>number):StructureSolid[]{
  const F=FIXTURE,out:StructureSolid[]=[];
  const make=(id:string,kind:string,surface:string,role:StructureSolid['role'],bedId:string,walkable:boolean)=>{const s:StructureSolid={id,kind,surface,role,walkable,bedIds:[bedId],districtId:F.district,positions:[],indices:[]};out.push(s);return s;};
  /** Sweep a closed cross-section (outward-wound) along stations; `section(i)` returns [x,y,z] points. */
  const sweep=(solid:StructureSolid,count:number,section:(i:number)=>[number,number,number][])=>{
    const first=section(0),n=first.length;let base=solid.positions.length/3;
    for(let i=0;i<count;i++)for(const p of (i===0?first:section(i)))solid.positions.push(p[0],p[1],p[2]);
    for(let i=1;i<count;i++)for(let k=0;k<n;k++){const a=base+(i-1)*n+k,b=base+(i-1)*n+(k+1)%n,c=base+i*n+(k+1)%n,d=base+i*n+k;solid.indices.push(a,b,c,a,c,d);}
    // End caps (fan).
    for(const i of [0,count-1]){const o=base+i*n;for(let k=1;k<n-1;k++)i===0?solid.indices.push(o,o+k+1,o+k):solid.indices.push(o,o+k,o+k+1);}
    base+=count*n;
  };
  // Deck ribbon: top vertices across the paved width (continuous, shared), cut sides and underside, 0.6 thick.
  const deckOf=(c:Corridor,pt:(s:number,o:number)=>[number,number,number])=>{const d=make(`${c.id}.deck`,'corridorDeck','paved','deck',c.id,true);const S=c.stations;
    sweep(d,S.length,i=>{const st=S[i]!,L=st.left.paved,R=st.right.paved,P=(o:number,dy:number):[number,number,number]=>{const p:[number,number,number]=pt===point?pt(st.s,o):[st.at[0]-st.tangent[1]*o,st.at[1],st.at[2]+st.tangent[0]*o];return [p[0],st.at[1]+dy,p[2]];};
      return [P(-L,0),P(-st.half,0),P(0,0),P(st.half,0),P(R,0),P(R,-F.deckThickness),P(-L,-F.deckThickness)];});};
  deckOf(main,point);deckOf(spur,(_s,_o)=>[0,0,0]);
  // Kerbs and sidewalks on the developed stretch (runs split at the junction gap).
  const runsWhere=(pred:(st:CorridorStation)=>boolean)=>{const r:CorridorStation[][]=[];let cur:CorridorStation[]=[];for(const st of main.stations){if(pred(st))cur.push(st);else if(cur.length){r.push(cur);cur=[];}}if(cur.length)r.push(cur);return r.filter(x=>x.length>1);};
  for(const sgn of [1,-1] as const)for(const [k,run] of runsWhere(st=>(sgn>0?st.right:st.left).edge==='sidewalk').entries()){
    const P=(st:CorridorStation,o:number,y:number):[number,number,number]=>{const p=point(st.s,sgn*o);return [p[0],y,p[2]];};
    const kerb=make(`fixture.kerb.${sgn>0?'r':'l'}.${k}`,'corridorKerb','paved','wall',main.id,false),walk=make(`fixture.walk.${sgn>0?'r':'l'}.${k}`,'corridorWalk','plaza','floor',`fixture.walk.${sgn>0?'right':'left'}.1`,true);
    const a=F.paved,b=F.paved+CORRIDOR.kerbWidth,c=b+CORRIDOR.sidewalkWidth,top=(st:CorridorStation)=>st.at[1]+CORRIDOR.kerbRise,bot=(st:CorridorStation)=>st.at[1]-.35;
    const ring=(o0:number,o1:number)=>(i:number)=>{const st=run[i]!,pts=[P(st,o0,bot(st)),P(st,o0,top(st)),P(st,o1,top(st)),P(st,o1,bot(st))];return sgn>0?pts:pts.reverse();};
    sweep(kerb,run.length,ring(a,b));sweep(walk,run.length,ring(b,c));
  }
  // Retaining wall in the mountain cutting (left): a battered stone face from the road edge up to the cut.
  const cut=runsWhere(st=>st.left.guard==='retaining')[0];
  if(cut){const ret=make('fixture.retaining.l','corridorRetaining','stone','wall',main.id,false);
    sweep(ret,cut.length,i=>{const st=cut[i]!,y=st.at[1],h=2.7+.25,o0=F.paved+.15,P=(o:number,yy:number):[number,number,number]=>{const p=point(st.s,-o);return [p[0],yy,p[2]];};
      return [P(o0,y-.3),P(o0+h/6,y+h),P(o0+h/6+.55,y+h),P(o0+.65,y-.3)].reverse();});}
  // Guard colliders (never drawn): a thin panel inside each visible rail.
  for(const g of main.guards){const col=make(g.colliderId,'corridorGuard','stone','rail',main.id,false),L=g.line,t=.12;
    sweep(col,L.length,i=>{const a=L[Math.max(0,i-1)]!,c=L[Math.min(L.length-1,i+1)]!,dx=c[0]-a[0],dz=c[2]-a[2],l=Math.hypot(dx,dz)||1,nx=-dz/l*t/2,nz=dx/l*t/2,p=L[i]!;
      return [[p[0]-nx,p[1],p[2]-nz],[p[0]-nx,p[1]+g.height,p[2]-nz],[p[0]+nx,p[1]+g.height,p[2]+nz],[p[0]+nx,p[1],p[2]+nz]];});}
  void ground;return out;
}
