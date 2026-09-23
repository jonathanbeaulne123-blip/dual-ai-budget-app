import {describe,it,expect} from 'vitest';
import {createSkateState,stepSkate,SKATE_IDLE,SKATE_MAX_SPEED,requestSkateTrick,resetSkate,setSkateMarker,stopSkate,bankSkateCombo,type SkateState,type SkateWorld,type SkateInput} from '../src/harbour/skate/skateModel.ts';
import {SKATE_RAMPS,SKATE_ROUTES,SKATE_SPOTS,SKATE_RAILS,rampWorld,rampRise,skateSurface} from '../src/harbour/skate/park.ts';
import {createSkateSession,decodeSkateProgress,freshSkateProgress,skateProgressKey,saveSkateProgress,readSkateProgress,startSkateRoute,stepSkateSession} from '../src/harbour/skate/session.ts';
import {ISLAND_BUILDINGS,isClear,courtObstacles} from '../src/harbour/body/obstacles.ts';
import {plantPlan} from '../src/harbour/scene/planting.ts';
import {pathSegmentClear} from '../src/harbour/body/pathfinder.ts';
import {createSkateDriver} from '../src/harbour/skate/rider.ts';
const flat:SkateWorld={surface:()=>({y:0,ramp:null}),ground:()=>0,obstacles:[],rails:[]};
const input=(extra:Partial<SkateInput>={}):SkateInput=>({...SKATE_IDLE,...extra});
function ride(s:SkateState,seconds:number,drive=input(),world=flat,hz=60){for(let i=0;i<Math.round(seconds*hz);i++)s=stepSkate(s,drive,1/hz,world);return s;}

describe('real board physics',()=>{
  it('steers right with D and left with A, including an airborne spin',()=>{
    const right=createSkateState(0,0,0,flat);right.speed=4;
    const left=createSkateState(0,0,0,flat);left.speed=4;
    const turnedRight=ride(right,.4,input({steer:1}));
    const turnedLeft=ride(left,.4,input({steer:-1}));
    expect(turnedRight.yaw).toBeGreaterThan(0);
    expect(turnedRight.x).toBeGreaterThan(0);
    expect(turnedLeft.yaw).toBeLessThan(0);
    expect(turnedLeft.x).toBeLessThan(0);
    const airborne=createSkateState(0,0,0,flat);airborne.mode='air';airborne.y=1;airborne.vy=3;airborne.speed=4;
    expect(ride(airborne,.1,input({steer:1})).spin).toBeGreaterThan(0);
  });
  it('pushes, coasts with rolling resistance and brakes without reversing',()=>{
    const start=createSkateState(0,0,0,flat),moving=ride(start,2,input({push:1})),coasting=ride(moving,.5),braked=ride(moving,2,input({brake:true}));
    expect(moving.speed).toBeGreaterThan(6);expect(moving.z).toBeGreaterThan(5);expect(coasting.speed).toBeLessThan(moving.speed);expect(coasting.z).toBeGreaterThan(moving.z);expect(braked.speed).toBe(0);expect(start.speed).toBe(0);
  });
  it('runs the same fixed simulation at 30, 60 and 120 fps',()=>{
    const at=(hz:number)=>ride(createSkateState(0,0,Math.PI,flat),3,input({push:1,steer:.3}),flat,hz);
    const a=at(30),b=at(60),c=at(120);for(const k of ['x','y','z','speed','yaw'] as const){expect(a[k]).toBeCloseTo(b[k],7);expect(c[k]).toBeCloseTo(b[k],7);}
  });
  it('bounds speed and a stalled frame without teleporting',()=>{
    let s=createSkateState(0,0,0,flat);s.speed=SKATE_MAX_SPEED;s=stepSkate(s,input({push:1}),1000,flat);expect(s.z).toBeLessThanOrEqual(1.31);expect(s.speed).toBeLessThanOrEqual(SKATE_MAX_SPEED);
    const before=s;expect(stepSkate(s,input(),NaN,flat).z).toBe(before.z);
  });
  it('lands a kickflip, keeps provisional points and banks only a clean line',()=>{
    let s=createSkateState(0,0,0,flat);s.speed=5;requestSkateTrick(s,'kickflip');s=ride(s,1);expect(s.mode).toBe('ride');expect(s.landings).toBe(1);expect(s.combo).toBeGreaterThanOrEqual(300);expect(s.score).toBe(0);
    s=ride(s,2.5);expect(s.score).toBeGreaterThanOrEqual(300);expect(s.combo).toBe(0);expect(s.best).toBe(s.score);
  });
  it('rejects repeated pop presses while a flip is incomplete',()=>{
    let s=createSkateState(0,0,0,flat);requestSkateTrick(s,'kickflip');s=ride(s,.2);const vy=s.vy;requestSkateTrick(s,'ollie');s=ride(s,.1);expect(s.vy).toBeLessThan(vy);expect(s.trick).toBe('kickflip');
  });
  it('bails unfinished tricks without scoring and recovers without losing saved scores',()=>{
    let s=createSkateState(0,0,0,flat);s.score=900;requestSkateTrick(s,'ollie');s=ride(s,.6);requestSkateTrick(s,'360-flip');s=ride(s,.15);expect(s.mode).toBe('bail');expect(s.score).toBe(900);expect(s.combo).toBe(0);s=ride(s,1);expect(s.mode).toBe('ride');
  });
  it('keeps air trajectory while allowing rider spin; a sideways landing bails',()=>{
    let s=createSkateState(0,0,0,flat);s.speed=6;requestSkateTrick(s,'ollie');s=ride(s,.37,input({steer:1}));expect(Math.abs(s.x)).toBeLessThan(.01);expect(s.z).toBeGreaterThan(2);expect(Math.abs(s.yaw)).toBeGreaterThan(1);s=ride(s,.5);expect(s.mode).toBe('bail');
  });
  it('sweeps thin walls in substeps at top speed',()=>{
    const w:SkateWorld={...flat,obstacles:[{kind:'box',id:'wall',minX:-5,maxX:5,minZ:1,maxZ:1.06}]};let s=createSkateState(0,0,0,w);s.speed=SKATE_MAX_SPEED;s=ride(s,.2,input({push:1}),w);expect(s.z).toBeLessThan(1);expect(s.mode).toBe('bail');
  });
  it('keeps the original momentum after landing a 180 fakie',()=>{
    let s=createSkateState(0,0,0,flat);s.speed=6;requestSkateTrick(s,'ollie');
    s=ride(s,.72,input({steer:1}));s=ride(s,.2);expect(s.mode).toBe('ride');expect(s.fakie).toBe(true);
    const z=s.z;s=ride(s,.3);expect(s.z).toBeGreaterThan(z);expect(Math.abs(s.x)).toBeLessThan(.05);
  });
  it('rolls back down a transition when uphill momentum runs out',()=>{
    const hill:SkateWorld={...flat,surface:(_x,z)=>({y:z*.5,ramp:'slope'})};
    let s=createSkateState(0,2,0,hill);s.speed=.3;s=ride(s,.8,input(),hill);
    expect(s.fakie).toBe(true);expect(s.z).toBeLessThan(2);expect(s.speed).toBeGreaterThan(1);
  });
  it('respects the island edge and never enters the sea',()=>{
    let s=createSkateState(0,72,0,flat);s.speed=12;s=ride(s,.5,input({push:1}));expect(Math.hypot(s.x,s.z)).toBeLessThanOrEqual(73.2);expect(s.mode).toBe('bail');
  });
  it('rides the physical ramp profile and launches from its lip',()=>{
    const ramp=SKATE_RAMPS.find(r=>r.kind==='kicker')!,start=rampWorld(ramp,0,-ramp.length/2-.2);
    const w:SkateWorld={...flat,surface:(x,z)=>skateSurface(x,z,()=>0)};let s=createSkateState(...start,ramp.yaw,w);s.speed=8;let peak=0,launched=false;
    for(let n=0;n<90;n++){s=stepSkate(s,input({push:1}),1/120,w);peak=Math.max(peak,s.y);launched ||=s.mode==='air';}
    expect(peak).toBeGreaterThan(ramp.height);expect(launched).toBe(true);
  });
  it('captures an aligned airborne board only with held grind intent',()=>{
    const w:SkateWorld={...flat,rails:[{id:'rail',a:[0,-3],b:[0,3],height:.5,name:'Test rail'}]};
    const s=createSkateState(.1,0,0,w);s.mode='air';s.y=.7;s.vy=-1;s.speed=4;
    expect(ride(s,.12,input(),w).mode).not.toBe('grind');const grinding=ride(s,.12,input({grind:true}),w);expect(grinding.mode).toBe('grind');expect(grinding.x).toBe(0);expect(grinding.rail).toBe('rail');expect(grinding.grinds).toBe(1);
    const exit=ride(grinding,.05,input(),w);expect(exit.mode).toBe('air');expect(exit.rail).toBeNull();
  });
  it('will not vacuum a perpendicular or grounded board onto a rail',()=>{
    const w:SkateWorld={...flat,rails:[{id:'rail',a:[0,-3],b:[0,3],height:.5,name:'Test rail'}]};
    const s=createSkateState(.1,0,Math.PI/2,w);s.mode='air';s.y=.7;s.vy=-1;s.speed=4;s.takeoffYaw=s.yaw;
    expect(ride(s,.12,input({grind:true}),w).mode).not.toBe('grind');const grounded=createSkateState(0,0,0,w);grounded.speed=4;expect(ride(grounded,.2,input({grind:true}),w).mode).toBe('ride');
  });
  it('manuals extend a combo but eventually punish an uncorrected balance',()=>{
    let s=createSkateState(0,0,0,flat);s.speed=6;s=ride(s,.6,input({manual:true}));expect(s.comboTricks).toContain('Manual');expect(s.score).toBe(0);
    s.balance=.99;s=ride(s,.1,input({manual:true,steer:-1}));expect(s.mode).toBe('bail');expect(s.combo).toBe(0);
  });
  it('session markers require a grounded stop and reset provisional tricks',()=>{
    let s=createSkateState(0,0,0,flat);s.speed=2;expect(setSkateMarker(s)).toBe(false);s.speed=0;s.x=2;expect(setSkateMarker(s)).toBe(true);s.x=10;s.combo=800;s.score=400;s=resetSkate(s,flat);expect(s.x).toBe(2);expect(s.score).toBe(400);expect(s.combo).toBe(0);
  });
  it('focus suspension does not cash an unlanded trick or retain pending input',()=>{
    const s=createSkateState(0,0,0,flat);s.mode='air';s.y=2;s.combo=800;s.vy=-1;s.pending='kickflip';stopSkate(s,flat);expect(s.combo).toBe(0);expect(s.score).toBe(0);expect(s.y).toBe(0);expect(s.pending).toBeNull();expect(s.speed).toBe(0);
  });
});

describe('island topology and recreational progress',()=>{
  it('uses one surface profile for every ramp and stays clear of buildings',()=>{
    for(const r of SKATE_RAMPS){for(const t of [0,.25,.5,.75,1]){const at=rampWorld(r,0,(t-.5)*r.length);expect(skateSurface(...at,()=>0).y).toBeCloseTo(rampRise(r,(t-.5)*r.length)+.035,5);expect(isClear(...at,.5,ISLAND_BUILDINGS)).toBe(true);}}
  });
  it('keeps all spot starts, rails and checkpoints on the island and out of walls',()=>{
    for(const p of [...SKATE_SPOTS.map(s=>s.start),...SKATE_ROUTES.flatMap(r=>[...r.points]),...SKATE_RAILS.flatMap(r=>[r.a,r.b])]){expect(Math.hypot(...p)).toBeLessThan(73.2);expect(isClear(...p,.26,ISLAND_BUILDINGS),JSON.stringify(p)).toBe(true);}
  });
  it('plants no trees inside the skate pads in either render tier',()=>{
    for(const tier of ['full','lite'] as const)for(const tree of plantPlan(tier).trees)for(const s of SKATE_SPOTS)expect(Math.abs(tree.x-s.x)>s.halfWidth||Math.abs(tree.z-s.z)>s.halfDepth).toBe(true);
  });
  it('preserves collision-free practice starts',()=>{for(const s of SKATE_SPOTS)expect(isClear(...s.start,.24,courtObstacles('full')),s.id).toBe(true);});
  it('keeps every timed route segment clear in full and lite planting',()=>{
    const blocked:string[]=[];
    for(const tier of ['full','lite'] as const)for(const route of SKATE_ROUTES)for(let n=1;n<route.points.length;n++){
      const a=route.points[n-1]!,b=route.points[n]!;if(!pathSegmentClear({x:a[0],z:a[1]},{x:b[0],z:b[1]},{obstacles:courtObstacles(tier)}))blocked.push(`${tier}:${route.id}:${n} ${a} -> ${b}`);
    }
    expect(blocked).toEqual([]);
  });
  it('freezes an airborne line while paused and clears held inputs on resume',()=>{
    const driver=createSkateDriver({groundHeightAt:()=>0,obstacles:[]});driver.mount(0,0,0);driver.hold({push:1});driver.action('kickflip');
    driver.step({forward:0,strafe:0},.1);const at={...driver.state()!};driver.pause(true);driver.step({forward:1,strafe:0},1);
    expect(driver.state()).toMatchObject({x:at.x,y:at.y,z:at.z,mode:at.mode,speed:at.speed});expect(driver.paused()).toBe(true);
    driver.pause(false);for(let n=0;n<300;n++)driver.step({forward:0,strafe:0},1/60);
    expect(driver.snapshot()!.score).toBeGreaterThan(0);expect(driver.snapshot()!.speed).toBe(0);
  });
  it('restores a route and its board after a rendering rebuild, safely paused',()=>{
    const world={groundHeightAt:()=>0,obstacles:[]};const driver=createSkateDriver(world);driver.mount(0,0,0);driver.route('coast-run');
    for(let n=0;n<210;n++)driver.step({forward:1,strafe:0},1/60);
    const checkpoint=driver.checkpoint()!,restored=createSkateDriver(world);restored.restore(checkpoint);
    expect(restored.snapshot()!.run).toEqual(driver.snapshot()!.run);expect(restored.state()!.x).toBe(driver.state()!.x);expect(restored.paused()).toBe(true);
    restored.step({forward:1,strafe:0},1);expect(restored.snapshot()!.run!.elapsed).toBe(checkpoint.session.run!.elapsed);
    restored.pause(false);restored.step({forward:0,strafe:0},.1);expect(restored.snapshot()!.run!.elapsed).toBeGreaterThan(checkpoint.session.run!.elapsed);
  });
  it('discovers only spots visited and earns cosmetic milestones',()=>{
    const session=createSkateSession(),s=createSkateState(0,0,0,flat);stepSkateSession(session,s,.016);expect(session.progress.discovered).toEqual([]);
    for(const spot of SKATE_SPOTS){s.x=spot.x;s.z=spot.z;stepSkateSession(session,s,.016);}expect(session.progress.discovered).toHaveLength(6);expect(session.progress.stamps).toContain('explorer');
  });
  it('requires sequential physical checkpoints, respects countdown and records a finish',()=>{
    const session=createSkateSession(),r=SKATE_ROUTES[1],s=createSkateState(0,0,0,flat);startSkateRoute(session,r.id);
    const last=r.points.at(-1)!;s.x=last[0];s.z=last[1];for(let i=0;i<50;i++)stepSkateSession(session,s,.1);expect(session.run!.checkpoint).toBe(1);expect(session.progress.routeBest[r.id]).toBeUndefined();
    for(const at of r.points.slice(1)){s.x=at[0];s.z=at[1];stepSkateSession(session,s,.1);}expect(session.run!.finished).toBe(true);expect(session.progress.routeBest[r.id]).toBeGreaterThan(0);
  });
  it('banks trick milestones only after a landed combo',()=>{
    const session=createSkateSession(),s=createSkateState(0,0,0,flat);s.comboTricks=['Kickflip','Manual'];s.combo=900;s.multiplier=3;s.landings=1;stepSkateSession(session,s,.01);expect(session.progress.stamps).toEqual([]);bankSkateCombo(s);stepSkateSession(session,s,.01);expect(session.progress.stamps).toEqual(expect.arrayContaining(['flip','manual','line','first-landing']));
  });
  it('bounds corrupt saves and keys each person, household and environment separately',()=>{
    expect(decodeSkateProgress('{broken')).toEqual(freshSkateProgress());const p=decodeSkateProgress(JSON.stringify({version:1,deck:'islander',bestLine:Infinity,discovered:['alien','tideline','tideline'],routeBest:{'first-line':-3},stamps:['secret']}));expect(p.deck).toBe('tideline');expect(p.discovered).toEqual(['tideline']);expect(p.routeBest).toEqual({});expect(p.stamps).toEqual([]);
    const a=skateProgressKey('development','hh:a','member');expect(a).not.toBe(skateProgressKey('production','hh:a','member'));expect(a).not.toBe(skateProgressKey('development','hh','a:member'));
  });
  it('continues with unavailable device storage',()=>{const store={getItem(){throw Error('blocked');},setItem(){throw Error('quota');}};expect(readSkateProgress(store,'key')).toEqual(freshSkateProgress());expect(saveSkateProgress(store,'key',freshSkateProgress())).toBe(false);});
});
