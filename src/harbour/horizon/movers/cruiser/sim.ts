import type {HorizonGeography} from '../shared/registry.ts';
import type {MoverBody} from '../shared/mode.ts';
import {CRUISER as C} from './tuning.ts';

export type CruiserGround = Pick<HorizonGeography,'surface'|'ground'|'blocker'|'contact'|'ceiling'|'submerged'>;
export type CruiserInput = {forward:number;steer:number;jump:boolean};
export type CruiserState = MoverBody & {vx:number;vz:number;vy:number;grounded:boolean;reverse:boolean;brakeHeld:boolean;jumpHeld:boolean;pitch:number;lean:number;safe:MoverBody;contact:string|null};
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const approach=(a:number,b:number,d:number)=>a<b?Math.min(b,a+d):Math.max(b,a-d);
export const cruiserSpeed=(s:CruiserState)=>Math.hypot(s.vx,s.vz);
/** Both wheels must support a seam; a single wheel at a real ledge cannot
 * manufacture ground. Project sloping supports back to the vehicle centre. */
function wheelSupport(g:CruiserGround,x:number,z:number,y:number,yaw:number) {
  const centre=g.surface(x,z,y,C.stepHeight);
  if(centre&&y-centre.y<.15)return centre;
  for(const [angle,reach] of [[yaw,C.wheelbase/2],[yaw+Math.PI/2,C.radius*.65]]) {
    const dx=Math.sin(angle!)*reach!,dz=Math.cos(angle!)*reach!;
    const a=g.surface(x+dx,z+dz,y,C.stepHeight),b=g.surface(x-dx,z-dz,y,C.stepHeight);
    if(!a||!b||a.slope>C.maxSlope||b.slope>C.maxSlope)continue;
    const ay=a.y+(a.nx*dx+a.nz*dz)/a.ny,by=b.y-(b.nx*dx+b.nz*dz)/b.ny;
    const supported=(ay+by)/2;
    if(Math.abs(ay-by)<.15&&supported<=y+C.stepHeight&&supported>=(centre?.y??-Infinity)+.15)return {...a,y:supported};
  }
  return centre;
}
/** The generic walker is shorter: check the mounted envelope at its centre and footprint edges. */
function cruiserHeadroom(g:CruiserGround,x:number,z:number,y:number,radius:number=C.radius){
  return [[0,0],[radius,0],[-radius,0],[0,radius],[0,-radius]].every(([dx,dz])=>g.ceiling(x+dx!,z+dz!,y)>=y+C.height);
}
export function validCruiserPosition(g:CruiserGround,at:MoverBody,radius:number=C.radius):MoverBody|null {
  const p=g.surface(at.x,at.z,at.y,C.stepHeight);
  if(!p||!Number.isFinite(p.y)||Math.abs(p.y-at.y)>.7||p.slope>C.maxSlope||g.submerged(at.x,at.z,p.y)||g.blocker(at.x,at.z,p.y,radius)||!cruiserHeadroom(g,at.x,at.z,p.y,radius))return null;
  return {...at,y:p.y};
}
/** Search near the rider, at the same altitude, and validate the entire exit path. */
export function cruiserDismount(g:CruiserGround,s:CruiserState):MoverBody|null {
  if(!s.grounded)return null;
  for(const distance of [.9,1.3,1.8,2.4])for(const angle of [Math.PI/2,-Math.PI/2,Math.PI,0,Math.PI*.75,-Math.PI*.75]) {
    const dx=Math.sin(s.yaw+angle)*distance,dz=Math.cos(s.yaw+angle)*distance;
    const at=validCruiserPosition(g,{x:s.x+dx,y:s.y,z:s.z+dz,yaw:s.yaw},.28);
    if(!at)continue;
    let clear=true;for(let i=1;i<=Math.ceil(distance/.15);i++) {
      const f=i/Math.ceil(distance/.15),x=s.x+dx*f,z=s.z+dz*f,p=g.surface(x,z,s.y,C.stepHeight);
      if(!p||Math.abs(p.y-s.y)>.7||g.blocker(x,z,p.y,.28)||g.submerged(x,z,p.y)){clear=false;break;}
    }
    if(clear)return at;
  }
  return null;
}
export function createCruiserState(at:MoverBody):CruiserState {
  return {...at,vx:0,vz:0,vy:0,grounded:true,reverse:false,brakeHeld:false,jumpHeld:false,pitch:0,lean:0,safe:{...at},contact:null};
}
/** Recovery never invents a destination: validate nearby ground, then the last supported spot. */
export function recoverCruiser(g:CruiserGround,s:CruiserState):CruiserState|null {
  for(const radius of [0,1,2,3,5,8])for(let i=0;i<12;i++) {
    const a=i*Math.PI/6,p=validCruiserPosition(g,{x:s.x+Math.sin(a)*radius,y:s.y,z:s.z+Math.cos(a)*radius,yaw:s.yaw});
    if(p)return createCruiserState(p);
  }
  const safe=validCruiserPosition(g,s.safe);return safe?createCruiserState(safe):null;
}
/** Fixed-step travel with no balance, bail, road magnet, weather grip penalty or trick kernel. */
export function stepCruiser(s:CruiserState,input:CruiserInput,g:CruiserGround,dt=C.dt):CruiserState {
  let {x,y,z,yaw,vx,vz,vy,grounded,reverse,pitch,lean}=s;
  const forward=clamp(input.forward,-1,1),steer=clamp(input.steer,-1,1),braking=forward<-.15;
  let speed=cruiserSpeed(s),signed=reverse?-speed:speed;
  // S stops first. Only a new S press at rest engages reverse.
  if(braking&&!s.brakeHeld&&speed<.12)reverse=true;
  if(forward>.15&&speed<.12)reverse=false;
  signed=reverse?-speed:speed;
  if(grounded) {
    const cruise=C.speed-(C.speed-C.cornerSpeed)*Math.pow(Math.abs(steer),1.5);
    const target=forward>.15?cruise*forward:braking&&reverse?-C.reverseSpeed*Math.abs(forward):0;
    const slowing=(braking&&!reverse)||(forward>.15&&reverse);
    signed=approach(signed,target,(slowing?C.brake:Math.abs(forward)>.15?C.acceleration:C.coast)*dt);
    speed=Math.abs(signed);
    // D/right decreases yaw in the island's +z-forward camera frame. At rest, turn on the spot.
    const rate=C.steerLow+(C.steerHigh-C.steerLow)*clamp(speed/C.speed,0,1);
    yaw-=steer*rate*(reverse?-1:1)*dt;
    const lateral=(vx*Math.cos(yaw)-vz*Math.sin(yaw))*Math.exp(-C.grip*dt);
    vx=Math.sin(yaw)*signed+Math.cos(yaw)*lateral;vz=Math.cos(yaw)*signed-Math.sin(yaw)*lateral;
    // Grip redirects existing speed; retained lateral motion must not create
    // extra energy every tick through a long turn or repeated wall deflection.
    const combined=Math.hypot(vx,vz);
    if(combined>speed){vx*=speed/combined;vz*=speed/combined;}
    if(slowing&&speed<.12){vx=0;vz=0;}
  }
  const jump=input.jump&&!s.jumpHeld&&grounded;
  if(jump){vy=C.jumpSpeed;grounded=false;}
  let contact:string|null=null;
  const pieces=Math.max(1,Math.ceil(Math.hypot(vx,vz)*dt/.15));
  for(let i=0;i<pieces;i++) {
    let dx=vx*dt/pieces,dz=vz*dt/pieces;
    let nx=x+dx,nz=z+dz;
    const surface=grounded?wheelSupport(g,nx,nz,y,yaw):g.surface(nx,nz,y,C.stepHeight),feet=grounded&&surface?Math.max(y,surface.y):y;
    const hit=g.contact(nx,nz,feet,C.radius,[dx,dz]);
    if(hit) {
      contact=hit.id;const into=vx*hit.nx+vz*hit.nz;
      if(into<0){vx-=into*hit.nx;vz-=into*hit.nz;}
      dx=vx*dt/pieces;dz=vz*dt/pieces;nx=x+dx;nz=z+dz;
      if(g.blocker(nx,nz,feet,C.radius,[dx,dz])){vx=0;vz=0;continue;}
    }
    const under=grounded?wheelSupport(g,nx,nz,y,yaw):g.surface(nx,nz,y,C.stepHeight);
    // Heightfield cliff faces are not structural triangles. Block penetration
    // from above ground while preserving a cave/underpass already below it.
    if(!grounded&&!under&&y>=g.ground(x,z)-.5&&g.ground(nx,nz)>y+C.stepHeight){vx=0;vz=0;contact='terrain-face';continue;}
    if((grounded&&(!under||under.slope>C.maxSlope||g.submerged(nx,nz,under.y)))||(!grounded&&g.submerged(nx,nz,y))) {vx=0;vz=0;contact='terrain';continue;}
    if(grounded&&under&&!cruiserHeadroom(g,nx,nz,under.y)){vx=0;vz=0;contact='low-headroom';continue;}
    x=nx;z=nz;
    if(grounded&&under) {
      const drop=y-under.y;
      if(drop<=C.groundSnap){y=under.y;vy=0;}
      else {grounded=false;vy=0;}
      const goal=Math.atan2(-(under.nx*Math.sin(yaw)+under.nz*Math.cos(yaw)),under.ny);
      pitch+=(clamp(goal,-.55,.55)-pitch)*(1-Math.exp(-8*dt/pieces));
    }
  }
  if(!grounded) {
    vy-=C.gravity*dt;const next=y+vy*dt,floor=g.surface(x,z,Math.max(y,next),C.stepHeight);
    if(vy<=0&&floor&&next<=floor.y) {
      y=floor.y;vy=0;grounded=true;
      if(floor.slope>C.maxSlope){vx=0;vz=0;contact='steep-ground';}
      if(g.submerged(x,z,floor.y)){const back=validCruiserPosition(g,s.safe);if(back){x=back.x;y=back.y;z=back.z;}vx=0;vz=0;contact='water';}
    }
    else y=next;
    const ceiling=g.ceiling(x,z,y);
    if(ceiling<y+C.height){y=ceiling-C.height;vy=Math.min(0,vy);}
  }
  // Art uses -lean for local roll; match the island's rightward negative yaw.
  lean+=(-steer*Math.min(.22,cruiserSpeed(s)*.025)-lean)*(1-Math.exp(-8*dt));
  const safe=grounded&&!contact&&validCruiserPosition(g,{x,y,z,yaw})?{x,y,z,yaw}:s.safe;
  return {x,y,z,yaw,vx,vz,vy,grounded,reverse,brakeHeld:braking,jumpHeld:input.jump,pitch,lean,safe,contact};
}
