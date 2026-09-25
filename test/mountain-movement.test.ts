/**
 * Hearth Mountain v2 · movement (T3). Every case here drives the SHIPPED
 * paths: the walker the runtime raises, the body model it steps, the skate
 * sim with `skateSimOptions` from driver.ts, the driver the HUD commands, and
 * the ride the runtime attaches the body to.
 */
import {describe,expect,it} from 'vitest';
import {createWalker} from '../src/harbour/body/walker.ts';
import {courtObstacles} from '../src/harbour/body/obstacles.ts';
import {createBodyState,requestJump,stepBody,BODY_HEIGHT,KERB_PRESS,RETURN_FADE,SAFE_FALL,type BodyState,type BodyWorld,type Support} from '../src/harbour/body/bodyModel.ts';
import {districtArrival,raceCorridorAt} from '../src/harbour/body/geography.ts';
import {createRide,farOffer,nearestStation,platformOffer} from '../src/harbour/body/ride.ts';
import {groundHeightAt} from '../src/harbour/scene/ground.ts';
import {DISTRICTS,TRANSPORT_STOPS,TRANSPORT_LINES,RACE_FINISH} from '../src/harbour/mountain/definition.ts';
import {MOUNTAIN_COURSE_POINTS,MOUNTAIN_GATES,crossesRaceGate} from '../src/harbour/mountain/race.ts';
import {createSkateSim} from '../src/harbour/skate/sim/index.ts';
import {createSkateDriver,skateField,skateSimOptions,SKATE_CATALOGS} from '../src/harbour/skate/driver.ts';
import {kick,intent} from '../src/harbour/skate/sim/testKit.ts';
import {SKATE_NO_INTENT,type SkateSimEvent} from '../src/harbour/skate/contract.ts';
import {buildHudModel} from '../src/harbour/skate/hud/model.ts';

const TOWN_SQUARE={x:.95,z:5.1,yaw:Math.PI};
/** Camera heading whose "forward" is +x (cameraBasis: forward = (−sin θ, −cos θ)). */
const PLUS_X=-Math.PI/2;

/** A synthetic world: a piecewise ground with no mountain surfaces, for exact slope and edge cases. */
function worldOf(height:(x:number,z:number)=>number,extra:Partial<BodyWorld>={}):BodyWorld{
  const support=(x:number,z:number):Support=>{const e=.02,y=height(x,z),gx=(height(x+e,z)-height(x-e,z))/(2*e),gz=(height(x,z+e)-height(x,z-e))/(2*e),n=Math.hypot(gx,1,gz);return {y,id:'terrain',nx:-gx/n,ny:1/n,nz:-gz/n};};
  return {groundHeightAt:height,obstacles:[],support:(x,z)=>support(x,z),safeReturn:()=>({x:0,y:height(0,0),z:0,supportId:'terrain'}),...extra};
}
function walkFor(state:BodyState,world:BodyWorld,seconds:number,hz:number,input={forward:1,strafe:0},theta=PLUS_X){
  const path:BodyState[]=[];
  for(let i=0;i<Math.round(seconds*hz);i++){state=stepBody(state,input,theta,1/hz,world).state;path.push(state);}
  return {state,path};
}

describe('town → mountain access by tap-to-walk',()=>{
  it('walks from the town square to every district and arrives, never giving up',()=>{
    const obstacles=courtObstacles('lite');
    for(const d of DISTRICTS){
      const to=districtArrival(d.id)!;expect(to).toBeTruthy();
      const walker=createWalker({groundHeightAt,obstacles,tier:'lite',trail:false,reduced:true,start:TOWN_SQUARE});
      expect(walker.goTo(to[0],to[2],to[1]),`${d.id} is reachable`).toBe(true);
      const plan=walker.plan()!;expect(plan.length).toBeGreaterThan(40);
      let frames=0;
      for(;frames<30*420&&walker.state().goal;frames++)walker.step(1/30,frames/30,0);
      const at=walker.state();
      expect(Math.hypot(at.x-to[0],at.z-to[2]),`${d.id}: arrived where it was sent`).toBeLessThan(2);
      expect(Math.abs(at.y-to[1]),`${d.id}: on the district's own level`).toBeLessThan(2);
      walker.dispose();
    }
  },240000);
  it('runs a long route by itself and passes the tapped height (a deck and the ground under it differ)',()=>{
    const walker=createWalker({groundHeightAt,obstacles:courtObstacles('lite'),tier:'lite',trail:false,reduced:true,start:TOWN_SQUARE});
    const to=districtArrival('hearth')!;walker.goTo(to[0],to[2],to[1]);
    for(let i=0;i<90;i++)walker.step(1/30,i/30,0);
    expect(walker.state().speed).toBeGreaterThan(3.2);
    walker.dispose();
  });
  it('offers a ride when a long walk starts beside a station',()=>{
    const town=TRANSPORT_STOPS.funicular[0]!.at,top=TRANSPORT_STOPS.funicular[3]!.at;
    const offer=farOffer({x:town[0]+2,z:town[2]},{x:top[0]+6,z:top[2]},520);
    expect(offer).toMatchObject({kind:'funicular',from:0,to:3});
    expect(farOffer({x:town[0],z:town[2]},{x:town[0]+20,z:town[2]},60)).toBeNull();
  });
});

describe('slope model',()=>{
  const ramp=(deg:number)=>(x:number)=>x<2?0:(x-2)*Math.tan(deg*Math.PI/180);
  it('walks up 35° and is held at the foot of 45°, identically at 30 and 60 fps',()=>{
    for(const deg of [35,45]){
      const world=worldOf(ramp(deg));
      const a=walkFor(createBodyState(0,0,Math.PI/2,world),world,6,30).state;
      const b=walkFor(createBodyState(0,0,Math.PI/2,world),world,6,60).state;
      expect(Math.abs(a.x-b.x),`${deg}° lands the same at any frame rate`).toBeLessThan(.2);
      expect(Math.abs(a.y-b.y)).toBeLessThan(.2);
      if(deg===35)expect(a.y).toBeGreaterThan(2.5);
      else {expect(a.y).toBeLessThan(.05);expect(a.x).toBeLessThan(2.05);}
    }
  });
  it('is slower uphill and a little faster downhill, and leans the figure into the grade',()=>{
    const up=worldOf(ramp(25)),down=worldOf(x=>x<2?40:40-(x-2)*Math.tan(25*Math.PI/180));
    const climbing=walkFor(createBodyState(3,0,Math.PI/2,up),up,2,60).state;
    const descending=walkFor({...createBodyState(3,0,Math.PI/2,down)},down,2,60).state;
    const flat=walkFor(createBodyState(-20,0,Math.PI/2,worldOf(()=>0)),worldOf(()=>0),2,60).state;
    expect(climbing.speed).toBeLessThan(flat.speed*.85);
    expect(descending.speed).toBeGreaterThan(flat.speed*1.02);
    expect(climbing.incline).toBeGreaterThan(.2);expect(descending.incline).toBeLessThan(-.2);
  });
  it('steps a low riser, and needs a jump for a kerb',()=>{
    const riser=(h:number)=>worldOf(x=>x<2?0:h);
    const step=walkFor(createBodyState(0,0,Math.PI/2,riser(.3)),riser(.3),3,60).state;
    expect(step.y).toBeCloseTo(.3,5);
    const kerb=walkFor(createBodyState(0,0,Math.PI/2,riser(.6)),riser(.6),3,60).state;
    expect(kerb.y).toBeLessThan(.01);
    // Run at it and jump: a standing jump clears ~0.67, so the kerb is climbed.
    let s=walkFor(createBodyState(0,0,Math.PI/2,riser(.6)),riser(.6),.5,60).state;
    s=requestJump(s);s=walkFor(s,riser(.6),2,60).state;
    expect(s.y).toBeCloseTo(.6,3);expect(s.x).toBeGreaterThan(2);
  });
});

describe('edges',()=>{
  const ledge=(drop:number)=>(x:number)=>x<5?drop:0;
  it('an open edge over a drop deeper than a body is a soft lip while walking',()=>{
    const world=worldOf(ledge(3));
    const {path}=walkFor(createBodyState(0,0,Math.PI/2,world),world,6,60,{forward:1,strafe:0});
    expect(Math.max(...path.map(p=>p.x))).toBeLessThan(5);
    expect(Math.min(...path.map(p=>p.y))).toBeCloseTo(3,6);
    // The lip does not stop you walking along the edge.
    const along=walkFor(path.at(-1)!,world,2,60,{forward:0,strafe:1}).state;
    expect(Math.hypot(along.z-path.at(-1)!.z,0)).toBeGreaterThan(2);
  });
  it('a kerb is stepped off deliberately; an open drop never by walking; a jump clears the lip',()=>{
    const kerb=worldOf(ledge(2),{edge:()=>'kerb'});
    const walked=walkFor(createBodyState(3.5,0,Math.PI/2,kerb),kerb,KERB_PRESS+3,60).state;
    expect(walked.x).toBeGreaterThan(5);expect(walked.y).toBeCloseTo(0,4);
    const open=worldOf(ledge(2));
    let s=walkFor(createBodyState(3.5,0,Math.PI/2,open),open,1.2,60).state;
    expect(s.x).toBeLessThan(5);
    s=requestJump(s);s=walkFor(s,open,2.5,60).state;
    expect(s.x).toBeGreaterThan(5);expect(s.y).toBeCloseTo(0,4);expect(s.returning??null).toBeNull();
  });
  it('a fall of more than four units fades out, returns to the path and fades back — never a one-frame pop',()=>{
    const cliff=worldOf(ledge(12));
    let s=walkFor(createBodyState(3.5,0,Math.PI/2,cliff),cliff,1,60).state;
    s=requestJump(s);
    const frames:{s:BodyState;fade:number;moved:boolean}[]=[];
    // Holding forward over the edge; once it is back on its feet the keys are let go.
    for(let i=0;i<60*6;i++){const back=frames.some(f=>f.moved)&&!s.returning;const f=stepBody(s,back?{forward:0,strafe:0}:{forward:1,strafe:0},PLUS_X,1/60,cliff);frames.push({s:f.state,fade:f.fade,moved:Boolean(f.returned)});s=f.state;}
    const started=frames.findIndex(f=>f.s.returning);expect(started).toBeGreaterThan(0);
    expect(frames[started-1]!.s.y-12).toBeGreaterThan(-SAFE_FALL-1);
    const move=frames.findIndex(f=>f.moved);expect(move).toBeGreaterThan(started);
    expect(frames[move]!.fade).toBe(0);
    // Every visible frame is continuous with the one before it.
    for(let i=1;i<frames.length;i++){const a=frames[i-1]!,b=frames[i]!;if(b.fade>.02&&a.fade>.02)expect(Math.hypot(b.s.x-a.s.x,b.s.y-a.s.y,b.s.z-a.s.z)).toBeLessThan(1);}
    const end=frames.at(-1)!;
    expect(end.fade).toBe(1);expect(end.s.returning??null).toBeNull();
    expect(Math.hypot(end.s.x,end.s.z)).toBeLessThan(.5);expect(end.s.y).toBeCloseTo(12,5);
    expect((move-started)/60).toBeCloseTo(RETURN_FADE,1);
  });
  it('the world bound is a clamp at the edge, never a jump back onto the road',()=>{
    const world:BodyWorld={groundHeightAt,obstacles:[]};
    // Off the summit's back and out past the land: the body stays near where it walked.
    let s=createBodyState(5,-290,0,world);
    let worst=0;
    for(let i=0;i<60*20;i++){const prev=s;s=stepBody(s,{forward:1,strafe:0},Math.PI,1/60,world).state;worst=Math.max(worst,Math.hypot(s.x-prev.x,s.z-prev.z));}
    expect(worst).toBeLessThan(.2);
  });
});

describe('rides',()=>{
  it('carries the body attached to the cabin every frame, at the line\'s own cruise, and skips mid-ride',()=>{
    for(const [kind,from,to] of [['funicular',0,3],['gondola',0,1],['funicular',2,0]] as const){
      const ride=createRide(kind,from,to);
      const walker=createWalker({groundHeightAt,obstacles:courtObstacles('lite'),tier:'lite',trail:false,reduced:true,start:{x:TRANSPORT_STOPS[kind][from]!.at[0],z:TRANSPORT_STOPS[kind][from]!.at[2]}});
      let prev=ride.pose(),fastest=0,frames=0;
      const start=TRANSPORT_STOPS[kind][from]!.at;expect(Math.hypot(prev.x-start[0],prev.y-start[1],prev.z-start[2]),`${kind}: boards from the platform`).toBeLessThan(.05);
      walker.attach(prev);
      while(!ride.done()&&frames<60*300){
        const pose=ride.step(1/60);walker.attach(pose);walker.step(1/60,frames/60,0);frames++;
        const at=walker.state();
        expect(Math.hypot(at.x-pose.x,at.y-pose.y,at.z-pose.z),`${kind}: in the cabin`).toBeLessThan(.3);
        fastest=Math.max(fastest,Math.hypot(pose.x-prev.x,pose.y-prev.y,pose.z-prev.z)*60);prev=pose;
      }
      expect(ride.done()).toBe(true);
      expect(fastest,`${kind}: constant cruise, no 65 u/s spans`).toBeLessThanOrEqual(TRANSPORT_LINES[kind].cruise*1.08);
      const end=TRANSPORT_STOPS[kind][to]!.at;expect(Math.hypot(prev.x-end[0],prev.y-end[1],prev.z-end[2])).toBeLessThan(.05);
      walker.dispose();
    }
    const skipped=createRide('gondola',0,1);skipped.step(3);skipped.skip();
    expect(skipped.done()).toBe(true);expect(skipped.pose().y).toBeCloseTo(TRANSPORT_STOPS.gondola[1]!.at[1],3);
    expect(createRide('funicular',0,2,{reduced:true}).duration).toBe(0);
  });
  it('boards by walking onto a platform; From defaults to the nearest station',()=>{
    const [town,hearth]=TRANSPORT_STOPS.funicular;
    expect(platformOffer(town!.at[0]+1,town!.at[1],town!.at[2])).toMatchObject({kind:'funicular',from:0,to:1,label:'Ride the funicular ↑'});
    expect(platformOffer(town!.at[0]+12,town!.at[1],town!.at[2])).toBeNull();
    expect(nearestStation('funicular',hearth!.at[0]+4,hearth!.at[2]-3)).toBe(1);
    expect(nearestStation('gondola',0,60)).toBe(0);
  });
});

describe('race physics on the shipped options',()=>{
  const field=skateField(),obstacles=courtObstacles('lite'),options=skateSimOptions(obstacles,field);
  const simAt=(i:number,side=0,dir=1)=>{
    const a=MOUNTAIN_COURSE_POINTS[i]!,b=MOUNTAIN_COURSE_POINTS[i+dir]!,dx=b[0]-a[0],dz=b[2]-a[2],l=Math.hypot(dx,dz)||1;
    return createSkateSim(field,SKATE_CATALOGS,{x:a[0]+dz/l*side,z:a[2]-dx/l*side,y:a[1],yaw:Math.atan2(dx,dz),stance:'regular',...options});
  };
  it('the corridor has real slope gravity; the island park keeps travel assist',()=>{
    expect(options.slopeGravityAt).toBe(raceCorridorAt);
    expect(raceCorridorAt(MOUNTAIN_COURSE_POINTS[0]![0],MOUNTAIN_COURSE_POINTS[0]![2])).toBe(true);
    const pad=field.pads[0]!;expect(raceCorridorAt(pad.frame.x,pad.frame.z)).toBe(false);
    // From the summit start: one push off the line, then nothing held. The descent carries the board on.
    const run=(opts:typeof options)=>{
      const a=MOUNTAIN_COURSE_POINTS[1]!,b=MOUNTAIN_COURSE_POINTS[2]!;
      const sim=createSkateSim(field,SKATE_CATALOGS,{x:a[0],z:a[2],y:a[1],yaw:Math.atan2(b[0]-a[0],b[2]-a[2]),stance:'regular',...opts});
      for(let i=0;i<60;i++)sim.step(intent({push:true}),1/60);
      const pushed=sim.present().speed;let peak=pushed;
      for(let i=0;i<5*60;i++){sim.step(intent(),1/60);peak=Math.max(peak,sim.present().speed);}
      return {pushed,peak};
    };
    const real=run(options),flat=run({...options,slopeGravityAt:undefined});
    expect(real.peak).toBeGreaterThan(real.pushed+2);
    expect(real.peak).toBeGreaterThan(flat.peak+2);
  });
  it('uphill is slower than downhill with the same push',()=>{
    // The steepest stretches of the main line (ahead four samples, ~12 units). The v2 road is graded
    // 8–15%, so "steep" is a drop of more than 1.2 over those 12 units (10% and up).
    const steep=MOUNTAIN_COURSE_POINTS.slice(8,-8).map((a,j)=>({i:j+8,drop:a[1]-MOUNTAIN_COURSE_POINTS[j+12]![1]})).filter(p=>p.drop>1.2).sort((a,b)=>b.drop-a.drop).slice(0,4);
    expect(steep.length).toBeGreaterThan(0);
    for(const {i} of steep){
      const down=simAt(i,0,1),up=simAt(i,0,-1);
      for(let k=0;k<90;k++){down.step(intent({push:true}),1/60);up.step(intent({push:true}),1/60);}
      expect(down.present().speed,`at course point ${i}`).toBeGreaterThan(up.present().speed+1);
    }
  });
  it('the whole descent on the shipped options: gravity carries a rider who only pushes when slow',()=>{
    const route=MOUNTAIN_COURSE_POINTS,start=route[0]!,next=route[1]!;
    for(const always of [true,false]){
      const sim=createSkateSim(field,SKATE_CATALOGS,{x:start[0],z:start[2],y:start[1],yaw:Math.atan2(next[0]-start[0],next[2]-start[2]),stance:'regular',...options});
      let index=0,seconds=0,bails=0,gate=1;
      for(let tick=0;tick<150*60;tick++){
        const p=sim.present();let nearest=index,dist=Infinity;
        for(let i=index;i<Math.min(route.length,index+12);i++){const q=route[i]!,d=Math.hypot(p.x-q[0],p.z-q[2]);if(d<dist){nearest=i;dist=d;}}
        index=nearest;if(gate===MOUNTAIN_GATES.length){seconds=tick/60;break;}
        let aim=index,ahead=0;while(aim<route.length-1&&ahead<Math.max(3,p.speed*.65)){const a=route[aim]!,b=route[++aim]!;ahead+=Math.hypot(b[0]-a[0],b[2]-a[2]);}
        const target=route[aim]!,error=Math.atan2(Math.sin(Math.atan2(target[0]-p.x,target[2]-p.z)-p.boardYaw),Math.cos(Math.atan2(target[0]-p.x,target[2]-p.z)-p.boardYaw));
        const before=[p.x,p.y,p.z] as const,r=sim.step(intent({push:always||p.speed<3,brake:p.speed>12&&Math.abs(error)>.5,steer:Math.max(-1,Math.min(1,-error*2.2))}),1/60);
        if(MOUNTAIN_GATES[gate]&&crossesRaceGate(before,[r.present.x,r.present.y,r.present.z],MOUNTAIN_GATES[gate]!))gate++;
        bails+=r.events.filter(e=>e.kind==='bail').length;
      }
      expect({always,gate,bails}).toEqual({always,gate:MOUNTAIN_GATES.length,bails:0});
      expect(seconds).toBeGreaterThanOrEqual(60);expect(seconds).toBeLessThanOrEqual(120);
    }
  },60000);
  it('no invisible dead stop anywhere on the main line, two units either side',()=>{
    const frozen:unknown[]=[];
    for(let i=0;i<MOUNTAIN_COURSE_POINTS.length-2;i+=2)for(const side of [-2,0,2]){
      const sim=simAt(i,side),a=MOUNTAIN_COURSE_POINTS[i]!,b=MOUNTAIN_COURSE_POINTS[i+1]!,dx=b[0]-a[0],dz=b[2]-a[2],l=Math.hypot(dx,dz)||1;
      kick(sim,{vx:dx/l*6,vz:dz/l*6});
      let bailed=false;
      for(let k=0;k<15;k++){const r=sim.step(intent({push:true}),1/60);if(r.events.some(e=>e.kind==='bail'))bailed=true;}
      const p=sim.present();
      if(!bailed&&p.phase!=='bail'&&p.phase!=='recover'&&Math.hypot(p.vx,p.vz)<.5)frozen.push({i,side,x:p.x,z:p.z,speed:p.speed});
    }
    expect(frozen).toEqual([]);
  },60000);
});

describe('race: run-out, retry, HUD and finish',()=>{
  const course=MOUNTAIN_GATES,last=course.at(-1)!;
  const coast={...SKATE_NO_INTENT};
  function racing(){
    const driver=createSkateDriver({obstacles:courtObstacles('lite')},{intent:()=>coast,reducedMotion:()=>true});
    driver.mount(0,0,0);driver.route('mountain-descent');
    for(let i=0;i<40;i++)driver.step(.1);
    expect(driver.run()?.countdown).toBe(0);
    return driver;
  }
  it('crossing the finish enters a braked run-out that never bails into the water',()=>{
    const driver=racing();
    const cp=driver.checkpoint()!,sim=cp.sim as Record<string,unknown>,[nx,nz]=last.normal;
    // On the lane ten units before the gate (the quay falls toward the finish: stand on the ground there).
    const sx=last.at[0]-nx*10,sz=last.at[2]-nz*10;
    Object.assign(sim,{x:sx,z:sz,y:groundHeightAt(sx,sz),vx:nx*13,vy:0,vz:nz*13,boardYaw:Math.atan2(nx,nz),mode:'ground'});
    cp.session.run={...cp.session.run!,checkpoint:course.length-1};
    driver.restore(cp);driver.pause(false);
    const events:SkateSimEvent[]=[];let runout=false;
    for(let i=0;i<60*10;i++){driver.step(1/60);events.push(...driver.events());runout||=driver.runout();}
    expect(driver.run()?.finished).toBe(true);expect(runout).toBe(true);
    expect(events.filter(e=>e.kind==='bail')).toEqual([]);
    expect(driver.present()!.speed).toBeLessThan(.5);
    // It stopped on the quay, inside the run-out the finish owns (at least 25 units of it).
    const stop=driver.present()!,past=(stop.x-last.at[0])*nx+(stop.z-last.at[2])*nz;
    expect(RACE_FINISH.runout).toBeGreaterThanOrEqual(25);
    expect(past).toBeGreaterThan(0);expect(past).toBeLessThanOrEqual(RACE_FINISH.runout);
    expect(Math.hypot(stop.x,stop.z)).toBeLessThan(73.2);
    // The finish card offers the Fund, and the HUD counts the gates there are.
    const hud=driver.hud()!;expect(hud.run).toMatchObject({finished:true,gate:course.length-1,gates:course.length-1,raced:true});
  });
  it('Retry during a race returns to the last gate and keeps the run and its clock',()=>{
    for(const how of ['command','key'] as const){
      let pressed=false;
      const driver=createSkateDriver({obstacles:courtObstacles('lite')},{intent:()=>({...coast,respawn:how==='key'&&pressed})});
      driver.mount(0,0,0);driver.route('mountain-descent');for(let i=0;i<35;i++)driver.step(.1);
      const cp=driver.checkpoint()!;cp.session.run={...cp.session.run!,checkpoint:6,elapsed:21};driver.restore(cp);driver.pause(false);
      if(how==='command')driver.command('retry');else {pressed=true;driver.step(1/60);pressed=false;}
      const run=driver.run()!;expect(run).toMatchObject({id:'mountain-descent',checkpoint:6,finished:false});
      expect(run.elapsed).toBeGreaterThanOrEqual(21);
      const gate=course[5]!,p=driver.present()!;
      expect(Math.hypot(p.x-gate.at[0],p.z-gate.at[2])).toBeLessThan(2);expect(Math.abs(p.y-gate.at[1])).toBeLessThan(1);
      driver.step(1/60);expect(driver.run()?.checkpoint).toBe(6);
    }
  });
  it('the HUD counts gates correctly and hides the park counters during a race',()=>{
    const driver=racing();const hud=driver.hud()!;
    expect(hud.run).toMatchObject({gate:0,gates:course.length-1,raced:true});
    expect(hud.run!.label).toMatch(new RegExp(`Gates 0/${course.length-1}`));
    expect(hud.spot).toBeNull();expect(hud.spotCard).toBeNull();
    // Outside a race the park's own counters are back.
    driver.route(null);expect(buildHudModel({present:driver.present(),line:null,outcome:null,session:{...driver.checkpoint()!.session,run:null},paused:false,inputDevice:'keyboard'} as Parameters<typeof buildHudModel>[0]).run).toBeNull();
  });
});

describe('body height is the one surface everywhere',()=>{
  it('stands on the same ground the renderer draws, in town and on the mountain',()=>{
    const world:BodyWorld={groundHeightAt,obstacles:[]};
    for(const [x,z] of [[3,4],[-30,20],[40,-20],[-120,-230],[60,-150]] as const){
      const s=createBodyState(x,z,0,world);
      expect(s.y).toBeGreaterThanOrEqual(groundHeightAt(x,z)-1e-9);
      expect(s.y-groundHeightAt(x,z)).toBeLessThan(BODY_HEIGHT);
    }
  });
});

import {restoredBodyAt} from '../src/harbour/body/geography.ts';
import {GEOGRAPHY_REVISION,MOUNTAIN_PATH_GRAPH,MOUNTAIN_ROAD_LINE,SKILL_BRANCHES,TOWN_RACE_ROAD} from '../src/harbour/mountain/definition.ts';
import {STOREFRONT_SOLIDS} from '../src/harbour/mountain/townSquare.ts';
import {queryWorldSurface} from '../src/harbour/mountain/surfaces.ts';
import {TOWN_LANE_DECK} from '../src/harbour/mountain/course.ts';
import {cameraBlocked} from '../src/harbour/camera/worldAdapter.ts';
describe('integration wiring (tuning track)',()=>{
  it('the storefronts stop a walking body and the camera eye where the geography puts them',()=>{
    const ids=new Set(courtObstacles('lite').map(o=>o.id));
    for(const s of STOREFRONT_SOLIDS){
      expect(ids.has(s.id),s.id).toBe(true);
      const ground=groundHeightAt(s.x,s.z);
      expect(cameraBlocked(s.x,ground+2,s.z),`${s.id}: the eye`).toBe(true);
      // Walk straight at its middle from 8 units out along its facing: the body stops at the wall.
      const world:BodyWorld={groundHeightAt,obstacles:courtObstacles('lite')};
      const fx=Math.sin(s.yaw),fz=Math.cos(s.yaw);
      let b=createBodyState(s.x+fx*8,s.z+fz*8,s.yaw+Math.PI,world);b={...b,goal:{x:s.x,z:s.z}};
      for(let i=0;i<60*5;i++)b=stepBody(b,{forward:0,strafe:0},0,1/60,world).state;
      const lx=(b.x-s.x)*Math.cos(s.yaw)-(b.z-s.z)*Math.sin(s.yaw),lz=(b.z-s.z)*Math.cos(s.yaw)+(b.x-s.x)*Math.sin(s.yaw);
      expect(Math.abs(lx)>s.halfX||Math.abs(lz)>s.halfZ,`${s.id}: the body is outside its walls`).toBe(true);
    }
  });
  it('only the skill branches grind; the town race lane is paving to a board',()=>{
    const field=skateField();
    // Of the mountain's walkable surfaces, only the branches grind (the park's own rails, ledges and copings stay).
    expect(field.grindables.filter(g=>/^(orchard-lane|mountain-road|town-race-road|path:|station:)/.test(g.id)).map(g=>g.id)).toEqual([]);
    for(const b of SKILL_BRANCHES)expect(field.grindables.some(g=>g.id===b.id),b.id).toBe(true);
    for(let i=4;i<TOWN_RACE_ROAD.length;i+=6){const p=TOWN_RACE_ROAD[i]!;expect(field.sample(p[0],p[2],p[1]+.3).kind,`town lane ${i}`).not.toBe('grass');}
  });
  it('rolls onto and off the canal bridge flush, at any line across the lane (approach slabs)',()=>{
    for(const [end,next] of [[0,1],[TOWN_LANE_DECK.length-1,TOWN_LANE_DECK.length-2]] as const){
      const a=TOWN_LANE_DECK[end]!,b=TOWN_LANE_DECK[next]!,dx=b[0]-a[0],dz=b[2]-a[2],l=Math.hypot(dx,dz);
      for(const side of [-2.4,-1.2,0,1.2,2.4]){
        let prev:number|null=null;
        for(let t=-1.5;t<=l;t+=.05){const x=a[0]+dx/l*t+dz/l*side,z=a[2]+dz/l*t-dx/l*side;const y:number=queryWorldSurface({x,z,...(prev===null?{}:{y:prev})},groundHeightAt).y;
          if(prev!==null)expect(y-prev,`deck end ${end}, line ${side}, at ${t.toFixed(2)}`).toBeLessThan(.06);prev=y;}
      }
    }
  });
  it('a body saved on the old mountain is re-validated: kept on walkable ground, else moved to the nearest path node',()=>{
    // Mid-air over the gorge (the old road ran here; the v2 gorge is 25+ deep).
    const lost=restoredBodyAt({x:-8,z:-130,y:40,yaw:0});
    expect(lost.migrated).toBe(true);
    expect(MOUNTAIN_PATH_GRAPH.nodes.some(n=>n.at[0]===lost.x&&n.at[2]===lost.z)).toBe(true);
    // Standing on the new road: kept (height re-read from the surface).
    const road=MOUNTAIN_ROAD_LINE.samples[300]!.at,kept=restoredBodyAt({x:road[0],z:road[2],y:road[1]+.4,yaw:1});
    expect(kept).toMatchObject({x:road[0],z:road[2],yaw:1,migrated:false});expect(Math.abs(kept.y!-road[1])).toBeLessThan(.2);
    // Saved on this revision: restored exactly as saved.
    expect(restoredBodyAt({x:-8,z:-130,y:40,yaw:0,geo:GEOGRAPHY_REVISION})).toMatchObject({x:-8,z:-130,y:40,migrated:false});
  });
});
