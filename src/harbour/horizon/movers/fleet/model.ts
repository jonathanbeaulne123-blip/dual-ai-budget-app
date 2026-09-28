import type {MoverBody,MoverInput} from '../shared/mode.ts';
import {constantWind,type WindSource} from '../shared/wind.ts';
import {BOARDING,FIXTURES,FLOORS,HELM,LADDER,SEATS,GALLEY,floorHeight,inside,type Point} from './layout.ts';
export type CraftId='kayak'|'dinghy'|'motorboat'|'yacht';
export const CRAFT_IDS:CraftId[]=['kayak','dinghy','motorboat','yacht'];
export const isCraft=(s:string):s is CraftId=>CRAFT_IDS.includes(s as CraftId);
export const HANDLING={
 kayak:{label:'Tandem kayak',max:3.6,reverse:1.5,accel:1.6,brake:3,drag:.65,turn:1.5,width:1.2,length:4.6,draft:.18,seats:[{x:0,y:.18,z:-.9},{x:0,y:.18,z:.85}],camera:6},
 dinghy:{label:'Dinghy',max:6.8,reverse:2,accel:3,brake:4,drag:.85,turn:1.5,width:1.9,length:3.8,draft:.28,seats:[{x:0,y:.4,z:-.7}],camera:8},
 motorboat:{label:'Motorboat',max:15,reverse:2.8,accel:4.5,brake:4.5,drag:.36,turn:1.05,width:2.4,length:5.8,draft:.42,seats:[{x:-.45,y:.6,z:0}],camera:11},
 yacht:{label:'Offshore yacht',max:5,reverse:1.4,accel:.65,brake:1.15,drag:.19,turn:.21,width:14,length:44,draft:1.3,seats:[HELM],camera:30},
} as const;
export type Vessel={id:CraftId;x:number;y:number;z:number;yaw:number;speed:number;turn:number;anchor:boolean;moored:boolean;moor?:Point;seat:number;passenger?:boolean};
export type WaterEnv={water(x:number,z:number):number|null;ground(x:number,z:number):number;blocked(x:number,z:number,y:number,radius:number):boolean;ceiling?(x:number,z:number,y:number):number;surface?(x:number,z:number,y:number):{y:number;slope:number}|null;width:number;depth:number;wind?:WindSource};
export type FleetAction={id:string;label:string;at:Point;kind:'board'|'leave'|'ladder'|'helm'|'anchor'|'moor'|'seat'|'door'|'sit'|'stand'|'station'|'companion';craft?:CraftId;index?:number};
export type FleetSnapshot={version:1;vessels:Vessel[];doors:string[];body?:MoverBody;aboard?:CraftId;local?:MoverBody;pilot?:CraftId;seat?:string};
export const launchBody={x:1523,y:1.2,z:1276,yaw:Math.PI/2};
export function createVessels():Vessel[]{return CRAFT_IDS.map((id,i)=>({id,x:id==='yacht'?1620:id==='motorboat'?1528:1527,y:0,z:[1269,1276,1283,1340][i]!,yaw:0,speed:0,turn:0,anchor:true,moored:false,seat:0,passenger:false}));}
export function toWorld(v:Pick<Vessel,'x'|'y'|'z'|'yaw'>,p:Point):Point{const s=Math.sin(v.yaw),c=Math.cos(v.yaw);return{x:v.x+p.x*c+p.z*s,y:v.y+p.y,z:v.z-p.x*s+p.z*c};}
export function toLocal(v:Pick<Vessel,'x'|'y'|'z'|'yaw'>,p:Point):Point{const s=Math.sin(v.yaw),c=Math.cos(v.yaw),x=p.x-v.x,z=p.z-v.z;return{x:x*c-z*s,y:p.y-v.y,z:x*s+z*c};}
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const approach=(n:number,to:number,stepSize:number)=>n<to?Math.min(to,n+stepSize):Math.max(to,n-stepSize);
export function createFleet(env:WaterEnv){
 const vessels=createVessels(),doors=new Set<string>(),wind=env.wind??constantWind();let time=0,remainder=0;
 const yacht=vessels[3]!,get=(id:CraftId)=>vessels.find(v=>v.id===id)!;
 let pilot:CraftId|null=null,input:Pick<MoverInput,'forward'|'steer'|'jump'>={forward:0,steer:0,jump:false};
 let sitting:string|null=null;
 const localFixtureBlocked=(x:number,z:number,y:number,r=.3)=>FIXTURES.find(f=>!(f.kind==='door'&&doors.has(f.id))&&f.y+f.height>y+.48&&f.y<y+1.25&&inside(f,x,z,r));
 function surface(x:number,z:number,y=Infinity,step=.48){
  const p=toLocal(yacht,{x,y,z});let best:{id:string;y:number;nx:number;ny:number;nz:number;material:string;slope:number}|null=null;
  for(const f of FLOORS){if(!inside(f,p.x,p.z))continue;const h=floorHeight(f,p.z)+yacht.y;if(h>y+step||best&&h<best.y)continue;
   const slope=f.rise?Math.atan2(f.rise,f.z1-f.z0):0;
   best={id:'yacht.'+f.id,y:h,nx:-Math.sin(yacht.yaw)*Math.sin(slope),ny:Math.cos(slope),nz:-Math.cos(yacht.yaw)*Math.sin(slope),material:'teak',slope:slope*180/Math.PI};
  }return best;
 }
 function ceiling(x:number,z:number,y:number){const p=toLocal(yacht,{x,y,z});let h=Infinity;for(const f of FLOORS)if(inside(f,p.x,p.z)){const top=floorHeight(f,p.z)+yacht.y-.16;if(top>y+.1)h=Math.min(h,top);}return h;}
 function contact(x:number,z:number,y:number,r=.3){
  const under=ceiling(x,z,y);if(under<y+1.25)return{id:'yacht.low-ceiling',nx:0,nz:0};
  const p=toLocal(yacht,{x,y,z}),f=localFixtureBlocked(p.x,p.z,p.y,r);if(!f)return null;
  const sides=[{d:Math.abs(p.x-f.x0),nx:-1,nz:0},{d:Math.abs(p.x-f.x1),nx:1,nz:0},{d:Math.abs(p.z-f.z0),nx:0,nz:-1},{d:Math.abs(p.z-f.z1),nx:0,nz:1}].sort((a,b)=>a.d-b.d),n=sides[0]!,c=Math.cos(yacht.yaw),s=Math.sin(yacht.yaw);
  return{id:'yacht.'+f.id,nx:n.nx*c+n.nz*s,nz:-n.nx*s+n.nz*c};
 }
 function support(body:Point){const s=surface(body.x,body.z,body.y,.08);return s&&Math.abs(body.y-s.y)<.16?s:null;}
 function hullClear(v:Vessel,x:number,z:number,yaw=v.yaw){
  const h=HANDLING[v.id],r=h.width/2;
  const airDraft={kayak:1.45,dinghy:1.7,motorboat:1.9,yacht:10.1}[v.id];
  for(const a of [-1,0,1])for(const b of [-1,0,1]){const p=toWorld({...v,x,z,yaw},{x:a*r,y:0,z:b*h.length/2}),water=env.water(p.x,p.z);if(p.x<2||p.z<2||p.x>env.width-2||p.z>env.depth-2||water===null||env.ground(p.x,p.z)>water-h.draft||env.blocked(p.x,p.z,water+.15,.12)||(env.ceiling?.(p.x,p.z,water)??Infinity)<water+airDraft)return false;}
  return true;
 }
 function navigable(v:Vessel,x:number,z:number,yaw=v.yaw){
  if(!hullClear(v,x,z,yaw))return false;
  const h=HANDLING[v.id],r=h.width/2;
  if(v.id==='yacht')for(const tender of vessels)if(tender.moored&&tender.moor){const p=toWorld({...v,x,z,yaw},tender.moor);if(!hullClear(tender,p.x,p.z,yaw))return false;}
  // Broad hull against small vessels. Moored tenders travel kinematically and never push the yacht.
  if(v.id!=='yacht'){const p=toLocal(yacht,{x,y:yacht.y,z});if(Math.abs(p.x)<7+r&&Math.abs(p.z)<23+h.length/2)return false;}
  else for(const other of vessels)if(other!==v&&!other.moored){const p=toLocal({...v,x,z,yaw},other);if(Math.abs(p.x)<7+HANDLING[other.id].width/2&&Math.abs(p.z)<23+HANDLING[other.id].length/2)return false;}
  for(const other of vessels)if(other!==v&&other.id!=='yacht'&&!other.moored&&Math.hypot(other.x-x,other.z-z)<r+HANDLING[other.id].width/2+.3)return false;
  return true;
 }
 function step(dt:number){
  remainder+=Math.max(0,Math.min(.25,dt));
  while(remainder>=1/120-1e-9){const h=1/120;remainder-=h;time+=h;
   for(const v of vessels){if(v.moored&&v.moor){const p=toWorld(yacht,v.moor);Object.assign(v,p,{yaw:yacht.yaw,speed:0,turn:0});continue;}
    const c=HANDLING[v.id],driving=pilot===v.id,f=driving?clamp(input.forward,-1,1):0,steer=driving?clamp(input.steer,-1,1):0;
    if(v.anchor){v.speed=approach(v.speed,0,c.brake*h);v.turn=approach(v.turn,0,2*h);}
    else {const braking=driving&&input.jump||f*v.speed<0,target=driving&&input.jump?0:f>=0?f*c.max:f*c.reverse;
     v.speed=f!==0?approach(v.speed,target,(braking?c.brake:c.accel)*h):v.speed*Math.exp(-(braking?c.brake:c.drag)*h);
     if(f===0&&Math.abs(v.speed)<.015)v.speed=0;
     const gain=(v.id==='kayak'||v.id==='dinghy'?.85:.35)+.3*Math.min(1,Math.abs(v.speed));
     const turn=steer*c.turn*gain/(1+Math.abs(v.speed)/(v.id==='motorboat'?5:9));v.turn=approach(v.turn,turn,(v.id==='yacht'?.25:3)*h);
    }
    const heading=v.yaw+v.turn*h,x=v.x+Math.sin(heading)*v.speed*h,z=v.z+Math.cos(heading)*v.speed*h;
    if(x===v.x&&z===v.z&&heading===v.yaw||navigable(v,x,z,heading)){v.x=x;v.z=z;v.yaw=heading;}else{v.speed*=Math.exp(-10*h);v.turn*=Math.exp(-10*h);}
    const w=wind.sample(v.x,v.y,v.z,time),level=env.water(v.x,v.z)??0,amplitude=v.id==='yacht'?.025:v.id==='kayak'?.07:.045;
    const bob=v.anchor&&v.id==='yacht'?0:Math.sin(time*1.3+v.x*.017+v.z*.012)*amplitude*Math.min(1.5,w.speed/4);
    v.y+=(level+bob-v.y)*(1-Math.exp(-5*h));
   }
   for(const v of vessels)if(v.moored&&v.moor)Object.assign(v,toWorld(yacht,v.moor),{yaw:yacht.yaw});
  }
 }
 function seatBody(v:Vessel):MoverBody {const p=toWorld(v,HANDLING[v.id].seats[v.seat]??HANDLING[v.id].seats[0]);return{...p,yaw:v.yaw};}
 function actions(body:MoverBody):FleetAction[]{
  const list:FleetAction[]=[],near=(p:Point,reach=2.8,dy=1.9)=>Math.hypot(p.x-body.x,p.z-body.z)<=reach&&Math.abs(p.y-body.y)<=dy;
  const add=(a:FleetAction,reach=2.8,dy=1.9)=>{if(near(a.at,reach,dy))list.push(a);};
  if(pilot){const v=get(pilot);
   if(pilot==='yacht'){list.push({id:'leave-helm',kind:'leave',label:'Leave helm',craft:pilot,at:seatBody(v)});list.push({id:'anchor',kind:'anchor',craft:'yacht',label:yacht.anchor?'Raise anchor':'Drop anchor',at:seatBody(v)});}
   else {list.push({id:'leave-'+pilot,kind:'leave',label:'Get out into water',craft:pilot,at:seatBody(v)});if(pilot==='kayak'){list.push({id:'swap-seat',kind:'seat',label:v.seat?'Use rear seat':'Use front seat',craft:pilot,at:seatBody(v)});list.push({id:'kayak-companion',kind:'companion',label:v.passenger?'Let local companion off':'Bring local companion',craft:pilot,at:seatBody(v)});}
    const board=toWorld(yacht,BOARDING),local=toLocal(v,board),h=HANDLING[v.id];
    const gap=Math.hypot(Math.max(0,Math.abs(local.x)-h.width/2),Math.max(0,Math.abs(local.z)-h.length/2));
    if(Math.abs(v.speed)<1.3&&gap<2.25){list.unshift({id:'moor-'+pilot,kind:'moor',label:'Secure boat & climb aboard',craft:pilot,at:board});}
    // A dry, clear dock/shore beside the boat is an ordinary short dismount.
    for(const [dx,dz] of [2,2.6,3.2,3.8,4.4,4.8].flatMap(r=>[[-r,0],[r,0],[0,-r],[0,r]])){const p={x:v.x+dx!,y:body.y,z:v.z+dz!},surface=env.surface?.(p.x,p.z,body.y+1.8);const y=surface?.y??env.ground(p.x,p.z);if(Math.abs(v.speed)<1&&y>(env.water(p.x,p.z)??0)-.25&&Math.abs(y-body.y)<2.4&&!env.blocked(p.x,p.z,y,.3)){p.y=y;list.unshift({id:'shore-'+pilot,kind:'leave',label:'Step ashore',craft:pilot,at:p});break;}}
   }
   return list;
  }
  if(sitting)return[{id:'stand',label:'Stand up',kind:'stand',at:body}];
  for(const v of vessels){if(v.id==='yacht')continue;
   if(Math.abs(v.speed)<1.3)for(let i=0;i<HANDLING[v.id].seats.length;i++)add({id:`board-${v.id}-${i}`,kind:'board',craft:v.id,index:i,label:`Board ${HANDLING[v.id].label}${v.id==='kayak'?i?' · front seat':' · rear seat':''}`,at:toWorld(v,{...HANDLING[v.id].seats[i]!,x:-HANDLING[v.id].width/2})},3.7,2.3);
  }
  if(body.y<yacht.y+BOARDING.y-.25)add({id:'ladder',kind:'ladder',label:'Climb swim ladder',at:toWorld(yacht,LADDER)},2,1.8);
  add({id:'helm',kind:'helm',craft:'yacht',label:'Take helm',at:toWorld(yacht,HELM)},1.8,.65);
  add({id:'anchor',kind:'anchor',craft:'yacht',label:yacht.anchor?'Raise anchor':'Drop anchor',at:toWorld(yacht,{...HELM,x:1.6})},2.5,1);
  for(const v of vessels.filter(v=>v.moored))add({id:'return-'+v.id,kind:'board',craft:v.id,index:0,label:`Return to ${HANDLING[v.id].label}`,at:toWorld(yacht,BOARDING)},2.2,1);
  for(const f of FIXTURES.filter(f=>f.kind==='door'))add({id:f.id,kind:'door',label:(doors.has(f.id)?'Close ':'Open ')+(f.label??'door'),at:toWorld(yacht,{x:(f.x0+f.x1)/2,y:f.y,z:(f.z0+f.z1)/2})},2,1);
  for(const s of SEATS)add({id:s.id,kind:'sit',label:'Sit · '+s.label,at:toWorld(yacht,s.stand)},1.6,.8);
  for(const s of GALLEY)add({id:s.id,kind:'station',label:s.label+' · inspect station',at:toWorld(yacht,s.approach)},1,.7);
  return list;
 }
 function act(id:string,body:MoverBody):{body?:MoverBody;board?:CraftId;leave?:boolean;message?:string}|null{
  const a=actions(body).find(a=>a.id===id);if(!a)return null;
  if(a.kind==='board'||a.kind==='helm'){const v=get(a.craft!);v.seat=a.index??0;if(v.id!=='yacht')v.anchor=false;v.moored=false;delete v.moor;pilot=v.id;return{board:v.id,body:seatBody(v)};}
  if(a.kind==='leave'){const v=get(a.craft!);pilot=null;input={forward:0,steer:0,jump:false};const p=v.id==='yacht'?toWorld(v,{...HELM,z:HELM.z-1}):a.id.startsWith('shore')?a.at:toWorld(v,{x:HANDLING[v.id].width/2+.6,y:-.5,z:0});return{leave:true,body:{...p,yaw:body.yaw}};}
  if(a.kind==='moor'){const v=get(a.craft!);v.moored=true;v.anchor=true;v.moor={x:(CRAFT_IDS.indexOf(v.id)-1)*3.1,y:0,z:-23.4-HANDLING[v.id].length/2};Object.assign(v,toWorld(yacht,v.moor),{yaw:yacht.yaw});v.speed=0;v.turn=0;pilot=null;return{leave:true,body:{...toWorld(yacht,BOARDING),yaw:yacht.yaw},message:'Tender secured. It travels with the yacht; return from the swim platform.'};}
  if(a.kind==='ladder')return{body:{...toWorld(yacht,BOARDING),yaw:yacht.yaw},message:'Aboard the swim platform.'};
  if(a.kind==='anchor'){yacht.anchor=!yacht.anchor;return{message:yacht.anchor?'Anchor down; the yacht settles to a stop.':'Anchor raised. Use the helm to cruise.'};}
  if(a.kind==='companion'){get('kayak').passenger=!get('kayak').passenger;return{message:'This companion is local scenery, not another connected player.'};}
  if(a.kind==='seat'){const v=get('kayak');v.seat=1-v.seat;return{body:seatBody(v)};}
  if(a.kind==='door'){const f=FIXTURES.find(f=>f.id===a.id)!,p=toLocal(yacht,body);if(doors.has(a.id)&&inside(f,p.x,p.z,.35))return{message:'Step clear of the doorway to close it.'};doors.has(a.id)?doors.delete(a.id):doors.add(a.id);return{};}
  if(a.kind==='sit'){sitting=a.id;return{body:{...toWorld(yacht,SEATS.find(s=>s.id===a.id)!.at),yaw:yacht.yaw}};}
  if(a.kind==='stand'){const s=SEATS.find(s=>s.id===sitting)!;sitting=null;return{body:{...toWorld(yacht,s.stand),yaw:yacht.yaw}};}
  return{message:`${a.label.replace(' · inspect station','')} · a place for future cooking activities.`};
 }
 return{vessels,get,yacht,doors,time:()=>time,surface,ceiling,contact,support,navigable,step,actions,act,seatBody,
  pilot:()=>pilot,sitting:()=>sitting,stand(){sitting=null;},resetInput(){input={forward:0,steer:0,jump:false};},
  drive(id:CraftId,i:Pick<MoverInput,'forward'|'steer'|'jump'>){pilot=id;input=i;if(i.forward!==0){const v=get(id);if(id!=='yacht')v.anchor=false;}},
  stopDriving(){pilot=null;input={forward:0,steer:0,jump:false};},
  snapshot(body?:MoverBody):FleetSnapshot{const aboard=pilot??(body&&(support(body)||sitting)?'yacht':undefined),v=aboard?get(aboard):null;return{version:1,vessels:vessels.map(v=>({...v,moor:v.moor?{...v.moor}:undefined})),doors:[...doors],...(body?{body:{...body}}:{}),...(v&&body?{aboard:v.id,local:{...toLocal(v,body),yaw:body.yaw-v.yaw}}:{}),...(pilot?{pilot}:{}),...(sitting?{seat:sitting}:{})};},
  restore(data:unknown):{body:MoverBody;pilot?:CraftId}|null{
   const s=data as FleetSnapshot;if(!s||s.version!==1||!Array.isArray(s.vessels)||s.vessels.length!==4||new Set(s.vessels.map(v=>v?.id)).size!==4||!Array.isArray(s.doors)||s.doors.some(d=>typeof d!=='string'))return null;
   if(s.vessels.some(v=>!v||!isCraft(v.id)||![v.x,v.y,v.z,v.yaw,v.speed,v.turn,v.seat].every(Number.isFinite)||v.x<2||v.x>env.width-2||v.z<2||v.z>env.depth-2||Math.abs(v.yaw)>1e5||Math.abs(v.speed)>HANDLING[v.id].max+1||Math.abs(v.turn)>3||v.seat<0||v.seat>=HANDLING[v.id].seats.length||!Number.isInteger(v.seat)||env.water(v.x,v.z)===null||Math.abs(v.y-(env.water(v.x,v.z)??0))>.3||env.ground(v.x,v.z)>(env.water(v.x,v.z)??0)-HANDLING[v.id].draft||v.moored&&(!v.moor||![v.moor.x,v.moor.y,v.moor.z].every(Number.isFinite)||Math.abs(v.moor.x)>7||Math.abs(v.moor.y)>.3||Math.abs(v.moor.z-(-23.4-HANDLING[v.id].length/2))>.1)))return null;
   if(!s.body||![s.body.x,s.body.y,s.body.z,s.body.yaw].every(Number.isFinite)||s.body.x<0||s.body.x>env.width||s.body.z<0||s.body.z>env.depth||Math.abs(s.body.y)>400)return null;
   if(s.aboard&&(!isCraft(s.aboard)||!s.local||![s.local.x,s.local.y,s.local.z,s.local.yaw].every(Number.isFinite)||Math.abs(s.local.x)>8||Math.abs(s.local.z)>30||s.local.y<-.8||s.local.y>10))return null;
   if(s.pilot&&(!isCraft(s.pilot)||s.aboard!==s.pilot))return null;
   // Validate the complete candidate before touching the live fleet: wet centres alone
   // do not prove hull clearance, and a saved local position may be inside furniture.
   const candidate=createFleet(env);
   for(const v of s.vessels)Object.assign(candidate.get(v.id),v,{speed:0,turn:0,anchor:true,moored:v.id!=='yacht'&&v.moored===true});
   for(const d of s.doors)if(FIXTURES.some(f=>f.kind==='door'&&f.id===d))candidate.doors.add(d);
   for(const v of candidate.vessels){if(v.moored&&v.moor)Object.assign(v,toWorld(candidate.yacht,v.moor),{yaw:candidate.yacht.yaw});if(!candidate.navigable(v,v.x,v.z,v.yaw))return null;}
   let b={...s.body};
   if(s.aboard&&s.local){const v=candidate.get(s.aboard);b={...toWorld(v,s.local),yaw:v.yaw+s.local.yaw};}
   if(b.x<0||b.x>env.width||b.z<0||b.z>env.depth||Math.abs(b.y)>400)return null;
   const savedSeat=s.seat?SEATS.find(seat=>seat.id===s.seat):null;
   if(s.seat&&(!savedSeat||s.aboard!=='yacht'||!s.local||Math.hypot(s.local.x-savedSeat.at.x,s.local.y-savedSeat.at.y,s.local.z-savedSeat.at.z)>.15))return null;
   if(s.aboard==='yacht'&&!savedSeat&&(!candidate.support(b)||candidate.contact(b.x,b.z,b.y)))return null;
   if(s.aboard&&s.aboard!=='yacht'&&s.pilot!==s.aboard)return null;
   for(const v of candidate.vessels){delete get(v.id).moor;Object.assign(get(v.id),v);}
   doors.clear();for(const d of candidate.doors)doors.add(d);
   pilot=null;sitting=savedSeat?.id??null;input={forward:0,steer:0,jump:false};remainder=0;
   if(s.pilot&&s.pilot!=='yacht'){pilot=s.pilot;return{body:seatBody(get(pilot)),pilot};}
   return{body:b};
  },
 };
}
export type Fleet=ReturnType<typeof createFleet>;
