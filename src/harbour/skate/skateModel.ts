import {BODY_RADIUS,holdAshore,pushOut,type Obstacle} from '../body/obstacles.ts';
import {SKATE_RAILS,railPoint,type SkateRail} from './park.ts';

export const SKATE_STEP=1/120;
export const SKATE_MAX_SPEED=13;
export const SKATE_GRAVITY=15;
export const SKATE_TRICKS=['ollie','kickflip','heelflip','shuvit','360-flip','grab'] as const;
export type SkateTrick=typeof SKATE_TRICKS[number];
export type SkateAction=SkateTrick|'manual'|'grind'|'brake'|'respawn'|'marker';
export type SkateInput={push:number;steer:number;brake:boolean;grind:boolean;manual:boolean;pump:boolean};
export const SKATE_IDLE:SkateInput={push:0,steer:0,brake:false,grind:false,manual:false,pump:false};
export type SkateWorld={surface:(x:number,z:number)=>{y:number;ramp:string|null};ground:(x:number,z:number)=>number;obstacles:readonly Obstacle[];rails?:readonly SkateRail[]};
export type SkateEvent={id:number;kind:'trick'|'land'|'bank'|'bail'|'grind'|'marker';text:string;points:number};
export type SkateState={
  x:number;y:number;z:number;yaw:number;speed:number;vy:number;pitch:number;bank:number;clock:number;remainder:number;
  mode:'ride'|'air'|'grind'|'bail';airTime:number;spin:number;spinAward:number;takeoffYaw:number;takeoffFacing:number;fakie:boolean;
  trick:SkateTrick|null;trickAt:number;trickDone:boolean;pending:SkateTrick|null;
  rail:string|null;railT:number;railDirection:number;railCooldown:number;balance:number;manualTime:number;
  combo:number;multiplier:number;comboAge:number;comboTricks:string[];lastTrick:string;repeat:number;
  score:number;best:number;landings:number;grinds:number;distance:number;airDistance:number;grindDistance:number;
  event:SkateEvent;marker:{x:number;z:number;yaw:number};bailTime:number;pushPhase:number;pushEffort:number;crouch:number;
};
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,Number.isFinite(n)?n:0));
export const skateAngle=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));
const TRICK:Record<SkateTrick,{name:string;points:number;time:number}>={
  ollie:{name:'Ollie',points:100,time:.1},kickflip:{name:'Kickflip',points:300,time:.48},heelflip:{name:'Heelflip',points:300,time:.48},
  shuvit:{name:'Pop shuvit',points:250,time:.4},'360-flip':{name:'360 flip',points:600,time:.66},grab:{name:'Melon grab',points:180,time:.3},
};
export function createSkateState(x:number,z:number,yaw:number,world:SkateWorld):SkateState {
  return {x,y:world.surface(x,z).y,z,yaw,speed:0,vy:0,pitch:0,bank:0,clock:0,remainder:0,mode:'ride',airTime:0,spin:0,spinAward:0,takeoffYaw:yaw,takeoffFacing:yaw,fakie:false,
    trick:null,trickAt:0,trickDone:false,pending:null,rail:null,railT:0,railDirection:1,railCooldown:0,balance:0,manualTime:0,
    combo:0,multiplier:1,comboAge:0,comboTricks:[],lastTrick:'',repeat:0,score:0,best:0,landings:0,grinds:0,distance:0,airDistance:0,grindDistance:0,
    event:{id:0,kind:'marker',text:'Find your line',points:0},marker:{x,z,yaw},bailTime:0,pushPhase:0,pushEffort:0,crouch:0};
}
function event(s:SkateState,kind:SkateEvent['kind'],text:string,points=0){s.event={id:s.event.id+1,kind,text,points};}
function addTrick(s:SkateState,name:string,points:number){
  s.repeat=s.lastTrick===name?s.repeat+1:0;s.lastTrick=name;
  const earned=Math.max(10,Math.round(points/Math.pow(1.65,s.repeat)));
  s.combo=Math.min(1e7,s.combo+earned);s.comboAge=0;
  if(!s.comboTricks.includes(name)){s.multiplier=Math.min(8,s.comboTricks.length+1);s.comboTricks=[...s.comboTricks,name].slice(-12);}
  event(s,'trick',name,earned);
}
export function bankSkateCombo(s:SkateState):void {
  if(!s.combo)return;
  const points=Math.round(s.combo*s.multiplier);s.score=Math.min(1e9,s.score+points);s.best=Math.max(s.best,points);
  event(s,'bank','Line landed',points);s.combo=0;s.multiplier=1;s.comboTricks=[];s.repeat=0;s.lastTrick='';s.comboAge=0;
}
function bail(s:SkateState,why:string){
  s.mode='bail';s.bailTime=.85;s.speed=0;s.vy=0;s.rail=null;s.pending=null;s.trick=null;s.combo=0;s.comboTricks=[];s.multiplier=1;s.balance=0;s.manualTime=0;
  event(s,'bail',why);
}
export function requestSkateTrick(s:SkateState,trick:SkateTrick):void {
  if(s.mode==='bail'||(s.trick&&!s.trickDone))return;
  if(s.mode==='ride'||s.mode==='grind'){s.pending=trick;s.crouch=1;}
  else if(s.mode==='air'&&(s.trick===null||s.trickDone)){s.trick=trick;s.trickAt=0;s.trickDone=false;}
}
export function resetSkate(s:SkateState,world:SkateWorld):SkateState {
  const fresh=createSkateState(s.marker.x,s.marker.z,s.marker.yaw,world);
  return {...fresh,marker:{...s.marker},score:s.score,best:s.best,landings:s.landings,grinds:s.grinds,distance:s.distance,grindDistance:s.grindDistance,
    event:{id:s.event.id+1,kind:'marker',text:'Back to your session marker',points:0}};
}
export function setSkateMarker(s:SkateState):boolean {
  if(s.mode!=='ride'||s.speed>1)return false;
  s.marker={x:s.x,z:s.z,yaw:s.yaw};event(s,'marker','Session marker saved');return true;
}
export function stopSkate(s:SkateState,world:SkateWorld):void {
  // Focus/tool suspension cannot land or cash an unfinished line.
  s.speed=0;s.vy=0;s.mode='ride';s.rail=null;s.pending=null;s.trick=null;s.manualTime=0;s.balance=0;s.combo=0;s.comboTricks=[];s.multiplier=1;
  s.y=world.surface(s.x,s.z).y;s.pitch=0;s.bank=0;s.remainder=0;
}
function launch(s:SkateState,speed:number,trick:SkateTrick|null){
  s.mode='air';s.vy=speed;s.airTime=0;s.airDistance=0;s.spin=0;s.spinAward=0;s.takeoffYaw=skateAngle(s.yaw+(s.fakie?Math.PI:0));s.takeoffFacing=s.yaw;s.rail=null;s.railCooldown=.12;
  s.trick=trick;s.trickAt=0;s.trickDone=false;s.pending=null;
}
function captureRail(s:SkateState,world:SkateWorld):boolean {
  if(s.railCooldown>0||s.speed<1.2||s.mode!=='air'||s.vy>2)return false;
  let best:{rail:SkateRail;t:number;distance:number}|null=null;
  for(const rail of world.rails??SKATE_RAILS){
    const dx=rail.b[0]-rail.a[0],dz=rail.b[1]-rail.a[1],square=dx*dx+dz*dz;
    const t=((s.x-rail.a[0])*dx+(s.z-rail.a[1])*dz)/square;
    if(t<0||t>1)continue;
    const at=railPoint(rail,t,world.ground),distance=Math.hypot(at.x-s.x,at.z-s.z);
    const aligned=Math.abs(Math.cos(skateAngle(s.yaw-Math.atan2(dx,dz))));
    if(distance>.62||Math.abs(s.y-at.y)>.34||aligned<.65)continue;
    if(!best||distance<best.distance)best={rail,t,distance};
  }
  if(!best)return false;
  const {rail,t}=best,angle=Math.atan2(rail.b[0]-rail.a[0],rail.b[1]-rail.a[1]);
  s.railDirection=Math.cos(s.takeoffYaw-angle)>=0?1:-1;s.yaw=angle+(s.railDirection===1?0:Math.PI);s.fakie=false;
  s.rail=rail.id;s.railT=t;s.mode='grind';s.vy=0;s.balance=0;s.grinds++;s.trick=null;s.grindDistance+=0;
  const at=railPoint(rail,t,world.ground);s.x=at.x;s.y=at.y;s.z=at.z;
  addTrick(s,'50-50 grind',200);event(s,'grind',rail.name,200);return true;
}
function tick(s:SkateState,i:SkateInput,world:SkateWorld){
  const dt=SKATE_STEP;s.pushEffort=i.push;s.clock+=dt;s.railCooldown=Math.max(0,s.railCooldown-dt);s.crouch=Math.max(0,s.crouch-dt*7);
  if(s.mode==='bail'){s.bailTime-=dt;s.y=world.surface(s.x,s.z).y;if(s.bailTime<=0){s.mode='ride';s.pitch=0;s.bank=0;}return;}
  if(s.pending){launch(s,5.5+Math.min(1.4,s.speed*.1),s.pending);}
  if(s.mode==='grind'){
    const rail=(world.rails??SKATE_RAILS).find(r=>r.id===s.rail);
    if(!rail){launch(s,1.2,null);return;}
    const len=Math.hypot(rail.b[0]-rail.a[0],rail.b[1]-rail.a[1]);
    s.balance+=((Math.sin(s.clock*2.4)*.5+s.balance*.8)-i.steer*1.8)*dt;
    s.speed=Math.max(0,s.speed-dt*(i.brake?8:.4));s.railT+=s.railDirection*s.speed*dt/len;
    if(Math.abs(s.balance)>1){bail(s,'Lost the balance · try the line again');return;}
    if(!i.grind||s.railT<0||s.railT>1||s.speed<.8){s.railT=clamp(s.railT,0,1);const end=railPoint(rail,s.railT,world.ground);s.x=end.x;s.z=end.z;s.y=end.y;launch(s,1.7,null);s.railCooldown=.45;return;}
    const at=railPoint(rail,s.railT,world.ground);s.x=at.x;s.z=at.z;s.y=at.y;
    s.distance+=s.speed*dt;s.grindDistance+=s.speed*dt;s.combo+=s.speed*dt*22;s.comboAge=0;s.bank=s.balance*.5;
    return;
  }
  const oldX=s.x,oldZ=s.z,oldY=s.y,oldSpeed=s.speed,under=world.surface(s.x,s.z);
  const steer=clamp(i.steer,-1,1);
  if(s.mode==='ride'){
    const heading=s.yaw+(s.fakie?Math.PI:0);
    const look=.2,front=world.surface(s.x+Math.sin(heading)*look,s.z+Math.cos(heading)*look),slope=(front.y-under.y)/look;
    // Reject vertical ramp backs as walls below. Do not turn a discontinuity into an impulse.
    const downhill=-clamp(slope,-1.4,1.4)*6;
    const acceleration=(i.brake?-11:clamp(i.push,0,1)*(i.pump?6.2:4.7))+downhill-(s.speed>.01?.48+s.speed*.045:0);
    const nextSpeed=s.speed+acceleration*dt;
    if(nextSpeed<0&&slope>.08&&!i.brake&&i.push<=0){s.fakie=!s.fakie;s.speed=Math.min(SKATE_MAX_SPEED,-nextSpeed);}
    else s.speed=clamp(nextSpeed,0,SKATE_MAX_SPEED);
    s.yaw=skateAngle(s.yaw-steer*(.9+2.1/(1+s.speed*.2))*dt*(s.speed>.1?1:.65));
    s.pitch+=(-Math.atan(clamp(slope,-1.4,1.4))*(s.fakie?-1:1)-s.pitch)*Math.min(1,dt*14);
    s.bank+=(-steer*Math.min(1,s.speed/6)-s.bank)*Math.min(1,dt*12);
    s.pushPhase+=i.push>0&&s.speed<11?dt*8:0;
    if(i.manual&&s.speed>1.3){
      s.manualTime+=dt;s.balance+=((Math.sin(s.clock*2)*.38+s.balance*.65)-steer*1.25)*dt;
      if(Math.abs(s.balance)>1){bail(s,'Manual tipped · your next line is waiting');return;}
      if(s.manualTime-dt<.2&&s.manualTime>=.2)addTrick(s,'Manual',120);
      s.combo+=s.speed*dt*8;s.comboAge=0;s.pitch=-.15;
    }else{s.manualTime=0;s.balance=0;}
  }else{
    s.airTime+=dt;s.spin-=steer*4.1*dt;s.yaw=skateAngle(s.takeoffFacing+s.spin);
    s.vy-=SKATE_GRAVITY*dt;s.y+=s.vy*dt;s.airDistance+=s.speed*dt;
    s.pitch+=(0-s.pitch)*dt*5;s.bank*=Math.exp(-dt*5);
  }
  // In the air the board turns under the rider; trajectory retains launch momentum.
  const travelYaw=s.mode==='air'?s.takeoffYaw:s.yaw+(s.fakie?Math.PI:0);
  const nx=s.x+Math.sin(travelYaw)*s.speed*dt,nz=s.z+Math.cos(travelYaw)*s.speed*dt;
  const shore=holdAshore(nx,nz),collision=pushOut(shore.x,shore.z,BODY_RADIUS,world.obstacles);
  s.x=collision.x;s.z=collision.z;
  const blocked=Math.hypot(s.x-nx,s.z-nz)>.004;
  if(blocked){if(oldSpeed>3.5){bail(s,shore.ashore?'Caught an edge · back on in a moment':'Easy at the shoreline');return;}s.speed=0;}
  const surface=world.surface(s.x,s.z),rise=surface.y-under.y;
  if(s.mode==='ride'){
    if(rise>.23){s.x=oldX;s.z=oldZ;s.y=oldY;bail(s,'Ride in from the low side of the ramp');return;}
    if(rise<-.13&&oldSpeed>1){launch(s,Math.max(1.2,-Math.sin(s.pitch)*(s.fakie?-1:1)*oldSpeed),null);s.y=oldY;}
    else s.y=surface.y;
  }
  if(s.mode==='air'){
    if(s.trick&&!s.trickDone){s.trickAt+=dt;if(s.trickAt>=TRICK[s.trick].time){s.trickDone=true;addTrick(s,TRICK[s.trick].name,TRICK[s.trick].points);}}
    if(i.grind&&captureRail(s,world))return;
    if(s.y<=surface.y&&s.vy<=0){
      s.y=surface.y;
      const rotations=Math.round(s.spin/Math.PI),travelRotations=Math.round(skateAngle(s.yaw-s.takeoffYaw)/Math.PI),alignment=Math.abs(skateAngle(s.spin-rotations*Math.PI));
      if((s.trick&&!s.trickDone)||alignment>.75||s.vy< -12){bail(s,'Bail · square up the board before landing');return;}
      if(Math.abs(rotations)>0)addTrick(s,`${Math.abs(rotations)*180} ${rotations<0?'frontside':'backside'}`,Math.abs(rotations)*180);
      if(s.airDistance>4)addTrick(s,'Gap',Math.round(s.airDistance*35));
      if(!s.trick&&!s.combo)addTrick(s,'Air',100);
      s.yaw=skateAngle(s.takeoffYaw+travelRotations*Math.PI);s.fakie=Math.abs(travelRotations)%2===1;s.mode='ride';s.vy=0;s.landings++;s.crouch=.7;s.trick=null;s.comboAge=0;
      event(s,'land',s.fakie?'Landed fakie':'Clean landing');
    }
  }
  s.distance+=Math.hypot(s.x-oldX,s.z-oldZ);
  if(s.mode==='ride'&&s.manualTime===0&&s.combo>0){s.comboAge+=dt;if(s.comboAge>=2.4)bankSkateCombo(s);}
}
/** Deterministic fixed substeps. A stalled/background tab never fast-forwards. */
export function stepSkate(state:SkateState,input:SkateInput,seconds:number,world:SkateWorld):SkateState {
  const s={...state,marker:{...state.marker}},dt=clamp(seconds,0,.1);s.remainder+=dt;
  while(s.remainder+1e-10>=SKATE_STEP){s.remainder-=SKATE_STEP;tick(s,input,world);}
  return s;
}
export function skateActionPose(s:SkateState):{act:string;p:number} {
  if(s.mode==='bail')return {act:'skate-bail',p:1-s.bailTime/.85};
  if(s.mode==='grind')return {act:'skate-grind',p:(s.balance+1)/2};
  if(s.mode==='air')return {act:`skate-${s.trick??'ollie'}`,p:s.trick?Math.min(1,s.trickAt/TRICK[s.trick].time):Math.min(1,s.airTime/.9)};
  if(s.manualTime>0)return {act:'skate-manual',p:(s.balance+1)/2};
  return {act:'skate',p:s.pushEffort>0?Math.max(0,Math.sin(s.pushPhase)):0};
}
