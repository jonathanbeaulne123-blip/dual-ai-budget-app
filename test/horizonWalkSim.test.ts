// The Horizon walker on foot (runtime/walkSim.ts) — Jonathan, 2026-10-04: "fix the walking movement".
// Deterministic: fixed steps, synthetic worlds built here, and a few scripted walks over the committed bake. No wall clock.
import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import type {HorizonSurface} from '../src/harbour/horizon/runtime/geography';
import {createWalkState,horizonWalkWorld,ROUTE_ARRIVE,WALK_FIXED_DT,walkMove,walkPose,walkTick,walkView,type WalkBody,type WalkWorld} from '../src/harbour/horizon/runtime/walkSim';

const SPEEDS={walk:2.4,run:5};
type Layer=(x:number,z:number)=>{y:number;slope?:number;nx?:number;nz?:number}|null;
type Wall={a:[number,number];b:[number,number];top:number};
/** A synthetic walk world: floors as height layers (highest at or under y+step wins, as geography.surface), vertical walls. */
function synth(layers:Layer[],walls:Wall[]=[],o:{gate?:(x:number,z:number)=>boolean;water?:(x:number,z:number)=>number|null}={}):WalkWorld{
  return {
    surface(x,z,y,step){let best:HorizonSurface|null=null;for(const [i,l] of layers.entries()){const h=l(x,z);if(!h||h.y>y+step||best&&h.y<best.y)continue;const slope=h.slope??0,n=Math.sin(slope*Math.PI/180);
      best={id:`layer${i}`,y:h.y,nx:h.nx??-n,nz:h.nz??0,ny:Math.cos(slope*Math.PI/180),material:'stone',slope};}return best;},
    contact(x,z,y,r,travel){for(const w of walls){if(w.top<=y+.48)continue;const dx=w.b[0]-w.a[0],dz=w.b[1]-w.a[1],L=dx*dx+dz*dz,t=Math.max(0,Math.min(1,((x-w.a[0])*dx+(z-w.a[1])*dz)/L));
      const px=w.a[0]+dx*t,pz=w.a[1]+dz*t,d=Math.hypot(x-px,z-pz);if(d>=r)continue;let nx=-dz,nz=dx;const n=Math.hypot(nx,nz);nx/=n;nz/=n;if(nx*(x-px)+nz*(z-pz)<0){nx=-nx;nz=-nz;}
      if(nx*travel[0]+nz*travel[1]>=-1e-8)continue;return{id:'wall',nx,nz};}return null;},
    water:o.water??(()=>null),gate:o.gate??(()=>true),extent:{w:1000,h:1000},walkable:40,
  };
}
const flat:Layer=()=>({y:0});
function walker(world:WalkWorld,at:[number,number,number],yaw=0){
  const body:WalkBody={x:at[0],y:at[1],z:at[2],yaw},state=createWalkState(body);
  const move=(dx:number,dz:number)=>walkMove(world,body,dx,dz,{swimming:false,grounded:true});
  return{body,state,tick:(wish:[number,number],dt=WALK_FIXED_DT,extra:{run?:boolean;route?:number[][];swim?:number}={})=>walkTick(state,body,{wishX:wish[0],wishZ:wish[1],run:extra.run??false,speeds:SPEEDS,swim:extra.swim,route:extra.route},dt,move)};
}
const speed=(w:ReturnType<typeof walker>)=>Math.hypot(w.state.vx,w.state.vz);

describe('walkSim · weight: quick but weighted start, a settle on release (was instant both ways)',()=>{
  it('gathers to a walk in about a quarter second and settles in under half a metre',()=>{
    const w=walker(synth([flat]),[10,0,10]);
    w.tick([0,1]);expect(speed(w)).toBeLessThan(.3*SPEEDS.walk);expect(speed(w)).toBeGreaterThan(0);   // was 2.4 on the first frame
    let t=WALK_FIXED_DT;while(speed(w)<.9*SPEEDS.walk){w.tick([0,1]);t+=WALK_FIXED_DT;}
    expect(t).toBeLessThan(.3);
    for(let i=0;i<60;i++)w.tick([0,1]);expect(speed(w)).toBeCloseTo(SPEEDS.walk,3);
    const z=w.body.z;w.tick([0,0]);expect(speed(w)).toBeGreaterThan(.8*SPEEDS.walk);   // was 0 on the first frame after release
    for(let i=0;i<60;i++)w.tick([0,0]);
    expect(speed(w)).toBe(0);expect(w.body.z-z).toBeGreaterThan(.2);expect(w.body.z-z).toBeLessThan(.5);
  });
  it('runs at MANIFEST run pace and a pad tilt still scales the pace',()=>{
    const w=walker(synth([flat]),[10,0,10]);for(let i=0;i<120;i++)w.tick([0,1],WALK_FIXED_DT,{run:true});expect(speed(w)).toBeCloseTo(SPEEDS.run,3);
    const p=walker(synth([flat]),[10,0,10]);for(let i=0;i<120;i++)p.tick([0,.5]);expect(speed(p)).toBeCloseTo(SPEEDS.walk*.5,3);
  });
  it('is a fixed step: any frame cadence covering the same time lands on the same point',()=>{
    const runs=[[1/60],[.05],[.02,.03,1/60,.05,.0333]].map(pattern=>{const w=walker(synth([flat]),[10,0,10]);let t=0,i=0;
      while(t<2-1e-9){const dt=Math.min(pattern[i++%pattern.length]!,2-t);w.tick([.6,.8],dt);t+=dt;}return [w.body.x,w.body.z,w.state.acc];});
    for(const r of runs.slice(1)){expect(r[0]).toBeCloseTo(runs[0]![0]!,6);expect(r[1]).toBeCloseTo(runs[0]![1]!,6);}
  });
  it('swims exactly as before: constant 2.4 from the first step, no weight',()=>{
    const w=walker(synth([flat]),[10,0,10]);w.tick([0,1],WALK_FIXED_DT,{swim:2.4});expect(speed(w)).toBeCloseTo(2.4,9);
    w.tick([0,0],WALK_FIXED_DT,{swim:2.4});expect(speed(w)).toBe(0);
  });
});

describe('walkSim · collide and slide (was a dead stop on the first blocked piece)',()=>{
  const wall:Wall={a:[0,20],b:[100,20],top:3};
  it('slides along a wall met at 45°, never through it',()=>{
    const w=walker(synth([flat],[wall]),[10,0,19]),d=Math.SQRT1_2;let minGap=Infinity;
    for(let i=0;i<240;i++){w.tick([d,d]);minGap=Math.min(minGap,20-w.body.z);}
    expect(w.body.x-10).toBeGreaterThan(SPEEDS.walk*d*4*.8);   // 4 s along the wall at the walk's along-wall share
    expect(minGap).toBeGreaterThanOrEqual(.3-1e-6);
  });
  it('stops cleanly in a corner, without jitter',()=>{
    const w=walker(synth([flat],[wall,{a:[20,0],b:[20,40],top:3}]),[19,0,19]),d=Math.SQRT1_2;const xs:number[]=[];
    for(let i=0;i<120;i++){w.tick([d,d]);xs.push(w.body.x+w.body.z);}
    expect(Math.max(...xs.slice(-40))-Math.min(...xs.slice(-40))).toBeLessThan(1e-3);
    expect(w.body.x).toBeLessThanOrEqual(19.7+1e-6);expect(w.body.z).toBeLessThanOrEqual(19.7+1e-6);expect(speed(w)).toBeLessThan(.05);
  });
  it('slides along a too-steep slope instead of stopping on it',()=>{
    const bank:Layer=(x,z)=>z>20?{y:(z-20)*2,slope:63.4,nx:0,nz:-.89}:null;
    const w=walker(synth([flat,bank]),[10,0,19.5]),d=Math.SQRT1_2;for(let i=0;i<120;i++)w.tick([d,d]);
    expect(w.body.x-10).toBeGreaterThan(2);expect(w.body.y).toBeLessThan(.5);
  });
});

describe('walkSim · steps, stairs and lips',()=>{
  const kerb=(h:number):Layer=>(x)=>x>12?{y:h}:null;
  for(const h of [.1,.2,.3,.45])it(`steps up a ${h} m lip and down it again, the seen height eased`,()=>{
    const w=walker(synth([flat,kerb(h)]),[10,0,10],Math.PI/2);let seenStep=0,last=walkView(w.state,w.body).y;
    for(let i=0;i<120;i++){w.tick([1,0]);const y=walkView(w.state,w.body).y;seenStep=Math.max(seenStep,Math.abs(y-last));last=y;}
    expect(w.body.x).toBeGreaterThan(14);expect(w.body.y).toBe(h);expect(seenStep).toBeLessThan(Math.max(.06,h*.3));
  });
  it('a 0.55 m ledge is a wall (and a diagonal slides along it)',()=>{
    const w=walker(synth([flat,kerb(.55)],[{a:[12,0],b:[12,100],top:.55}]),[10,0,10]),d=Math.SQRT1_2;
    for(let i=0;i<120;i++)w.tick([d,d]);expect(w.body.x).toBeLessThanOrEqual(11.7+1e-6);expect(w.body.z-10).toBeGreaterThan(2.5);expect(w.body.y).toBe(0);
  });
  // A stair: 0.17 risers on 0.3 treads, flat treads (as the baked stairs are).
  const stair:Layer=(x)=>x<10?{y:0}:x>16?{y:20*.17}:{y:Math.floor((x-10)/.3+1)*.17};
  it('climbs and descends a stair, monotonic, slower up than on the flat, risers shown eased',()=>{
    const up=walker(synth([stair]),[9,0,10],Math.PI/2),flatW=walker(synth([flat]),[9,0,10],Math.PI/2);let lastY=0,seenStep=0,last=0;
    for(let i=0;i<300;i++){up.tick([1,0]);flatW.tick([1,0]);expect(up.body.y).toBeGreaterThanOrEqual(lastY);lastY=up.body.y;const y=walkView(up.state,up.body).y;seenStep=Math.max(seenStep,Math.abs(y-last));last=y;}
    expect(up.body.y).toBeCloseTo(3.4,6);expect(seenStep).toBeLessThan(.1);
    const down=walker(synth([stair]),[17,20*.17,10],-Math.PI/2);lastY=down.body.y;   // 20 × 0.17 is 3.4000000000000004 in floating point
    for(let i=0;i<240;i++){down.tick([-1,0]);expect(down.body.y).toBeLessThanOrEqual(lastY);lastY=down.body.y;}
    expect(down.body.y).toBe(0);
    const climbT=(()=>{const w=walker(synth([stair]),[9.5,0,10],Math.PI/2);let n=0;while(w.body.x<16&&n<2000){w.tick([1,0]);n++;}return n;})();
    const flatT=(()=>{const w=walker(synth([flat]),[9.5,0,10],Math.PI/2);let n=0;while(w.body.x<16&&n<2000){w.tick([1,0]);n++;}return n;})();
    expect(climbT).toBeGreaterThan(flatT*1.1);
  });
  it('stands on a stair\'s treads where a too-steep sliver of ground is drawn a few centimetres over them (cove stair, measured)',()=>{
    const sliver:Layer=(x)=>x>11&&x<13?{y:Math.floor((x-10)/.3+1)*.17+.05,slope:60,nx:-.87,nz:0}:null;
    const w=walker(synth([stair,sliver]),[9,0,10],Math.PI/2);for(let i=0;i<300;i++)w.tick([1,0]);expect(w.body.x).toBeGreaterThan(16);
    // A real bank (rising past WALK_GRAZE) still stops the body.
    const bank:Layer=(x)=>x>12?{y:(x-12)*1.8,slope:61,nx:-.87,nz:0}:null;
    const b=walker(synth([flat,bank]),[10,0,10],Math.PI/2);for(let i=0;i<300;i++)b.tick([1,0]);expect(b.body.x).toBeLessThan(12.3);
  });
  it('paces a walkable slope: slower up, a little quicker down',()=>{
    const ramp:Layer=(x)=>({y:Math.max(0,x-10)*Math.tan(25*Math.PI/180),slope:x>10?25:0});
    const up=walker(synth([ramp]),[11,Math.tan(25*Math.PI/180),10],Math.PI/2);for(let i=0;i<180;i++)up.tick([1,0]);
    const down=walker(synth([ramp]),[60,50*Math.tan(25*Math.PI/180),10],-Math.PI/2);for(let i=0;i<180;i++)down.tick([-1,0]);
    expect(speed(up)).toBeLessThan(.85*SPEEDS.walk);expect(speed(up)).toBeGreaterThan(.7*SPEEDS.walk);
    expect(speed(down)).toBeGreaterThan(SPEEDS.walk);expect(speed(down)).toBeLessThan(1.1*SPEEDS.walk);
  });
  it('hands a body that walks off a 1 m ledge to the air at the edge',()=>{
    const ledge:Layer=(x)=>x<12?{y:1}:{y:0};
    const w=walker(synth([ledge]),[10,1,10],Math.PI/2);let left=false;for(let i=0;i<120&&!left;i++)left=w.tick([1,0]).leftSupport;
    expect(left).toBe(true);expect(w.body.x).toBeGreaterThan(12);expect(w.body.x).toBeLessThan(12.2);expect(speed(w)).toBeGreaterThan(1);
  });
  it('holds where collision has not arrived (gate) and keeps no momentum into it',()=>{
    const w=walker(synth([flat],[],{gate:x=>x<12}),[10,0,10],Math.PI/2);let held=false;for(let i=0;i<120;i++)held=w.tick([1,0]).held||held;
    expect(held).toBe(true);expect(w.body.x).toBeLessThan(12);expect(speed(w)).toBe(0);
  });
});

describe('walkSim · tap-to-walk routes',()=>{
  const route=()=>{const pts:number[][]=[[10,0,10]];for(let i=1;i<=6;i++)pts.push([10+i*3,0,10]);for(let i=1;i<=6;i++)pts.push([28,0,10+i*3]);return pts;};
  it('walks a route through its corner without a standing frame, and eases into the end',()=>{
    const w=walker(synth([flat]),[10,0,10]),p=route();let dead=0,n=0;
    while(p.length&&n<2000){const r=w.tick([0,0],WALK_FIXED_DT,{route:p});if(n>2&&p.length&&r.moved<1e-4)dead++;n++;}
    expect(p.length).toBe(0);expect(dead).toBe(0);   // was one standing frame per route point
    expect(n*WALK_FIXED_DT).toBeLessThan(36/SPEEDS.walk+1.2);
    expect(Math.hypot(w.body.x-28,w.body.z-28)).toBeLessThan(ROUTE_ARRIVE+1e-6);expect(speed(w)).toBeLessThan(.5);
    for(let i=0;i<30;i++)w.tick([0,0]);expect(speed(w)).toBe(0);
  });
  it('slides round a wall that clips the corner instead of dropping the route',()=>{
    // The corner point sits 0.2 m inside a wall's end: the straight leg clips it.
    const w=walker(synth([flat],[{a:[27.6,-5],b:[27.6,9.9],top:3}]),[10,0,10]),p=[[10,0,10],[27.5,0,10.1],[27.5,0,20]];let blocked=false,n=0;
    while(p.length&&n<3000){blocked=w.tick([0,0],WALK_FIXED_DT,{route:p}).routeBlocked||blocked;n++;}
    expect(blocked).toBe(false);expect(Math.hypot(w.body.x-27.5,w.body.z-20)).toBeLessThan(.1);
  });
  it('gives up a truly blocked route after a second of no headway (not on one blocked frame)',()=>{
    const w=walker(synth([flat],[{a:[15,0],b:[15,30],top:3}]),[10,0,10]),p=[[10,0,10],[20,0,10]];let t=0,blocked=false;
    while(!blocked&&t<5){blocked=w.tick([0,0],WALK_FIXED_DT,{route:p}).routeBlocked;t+=WALK_FIXED_DT;}
    expect(blocked).toBe(true);expect(t).toBeGreaterThan(2);expect(t).toBeLessThan(3.5);expect(p.length).toBe(0);
  });
});

describe('walkSim · the figure and the view',()=>{
  it('walks by distance (cadence follows pace), fades the gait at rest and reports the run',()=>{
    const w=walker(synth([flat]),[10,0,10]);for(let i=0;i<120;i++)w.tick([0,1]);const a=walkPose(w.state,SPEEDS),z0=w.body.z;
    for(let i=0;i<60;i++)w.tick([0,1]);const b=walkPose(w.state,SPEEDS);
    expect(a.gait).toBeCloseTo(1,3);expect(a.motion.run).toBe(0);expect((b.phase-a.phase)/Math.PI).toBeCloseTo((w.body.z-z0)/.75,6);
    for(let i=0;i<120;i++)w.tick([0,1],WALK_FIXED_DT,{run:true});expect(walkPose(w.state,SPEEDS).motion.run).toBeCloseTo(1,3);
    for(let i=0;i<120;i++)w.tick([0,0]);const rest=walkPose(w.state,SPEEDS);expect(rest.gait).toBe(0);expect(rest.motion.lean).toBe(0);
  });
  it('interpolates across the unsimulated remainder, and a body moved elsewhere loses its momentum',()=>{
    const w=walker(synth([flat]),[10,0,10]);for(let i=0;i<60;i++)w.tick([0,1]);w.tick([0,1],WALK_FIXED_DT/2);
    const v=walkView(w.state,w.body);expect(v.z).toBeLessThan(w.body.z);expect(w.body.z-v.z).toBeLessThan(SPEEDS.walk*WALK_FIXED_DT);
    w.body.x+=40;expect(walkView(w.state,w.body).x).toBe(w.body.x);w.tick([0,0]);expect(speed(w)).toBe(0);
  });
});

// ---- Scripted walks over the committed bake (the measured defects) ----
import {parseHorizonDefinition} from '../src/house/world/horizonAssets';
import {decodeTerrainAsset} from '../src/harbour/horizon/land/terrain/asset';
import {sampleTerrain} from '../src/harbour/horizon/land/terrain';
import {createHorizonGeography,HORIZON_WALKABLE_DEGREES} from '../src/harbour/horizon/runtime/geography';
import {createMountainV2Region,mouthExclusion,terraceBedExclusion} from '../src/harbour/horizon/regions/mountainV2';
import {bedPath,pointAt,progressOf} from '../src/harbour/horizon/movers/board/situations';
describe('walkSim · scripted walks on the committed bake',()=>{
  const ab=(b:Buffer)=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength) as ArrayBuffer;
  // Built once, on the first walk (so the synthetic cases above run without loading the bake).
  let baked:{world:ReturnType<typeof parseHorizonDefinition>;geo:ReturnType<typeof createHorizonGeography>;ww:WalkWorld}|null=null;
  const bake=()=>{if(baked)return baked;const world=parseHorizonDefinition(ab(readFileSync('public/horizon/world/horizon-geo-1.json.gz')));
    const field=decodeTerrainAsset(ab(readFileSync('public/horizon/terrain/horizon-geo-1.bin')),'full');
    const geo=createHorizonGeography(field,{...world.collision,solids:world.geometry.solids,diagnostics:[]} as never);
    geo.addDynamic(createMountainV2Region({walkingJoinSolids:world.geometry.solids,horizonGround:(x,z)=>sampleTerrain(field,x,z),yield:terraceBedExclusion(world.collision.beds),exclude:mouthExclusion(world.collision.mouths),terrainStep:field.step}).provider);
    return baked={world,geo,ww:horizonWalkWorld(geo,world.extent,()=>true,HORIZON_WALKABLE_DEGREES)};};
  const stand=(x:number,z:number,y:number)=>{const {geo,ww}=bake(),s=geo.surface(x,z,y,.48)!;return walker(ww,[x,s.y,z]);};
  /** Follow a bed's centre line with the stick (look-ahead 0.8 m), as a player would. */
  function followBed(id:string,reverse:boolean){
    const {world,geo}=bake(),b=world.collision.beds.find(b=>b.id===id)!,path=bedPath({...b,points:reverse?[...b.points].reverse():b.points} as never),p=pointAt(path,.3),w=stand(p.x,p.z,p.y+.5);
    let d=.3,last=.3,stall=0,maxDy=0,drops=0;
    for(let t=0;t<240;t+=WALK_FIXED_DT){const pr=progressOf(path,w.body.x,w.body.z,d,20);d=Math.max(d,pr.d);if(d>=path.length-.3)return{end:true,maxDy,drops};
      if(d>last+.05){last=d;stall=0;}else if((stall+=WALK_FIXED_DT)>3)return{end:false,at:[w.body.x,w.body.y,w.body.z],maxDy};
      const tg=pointAt(path,d+.8),dx=tg.x-w.body.x,dz=tg.z-w.body.z,l=Math.hypot(dx,dz),y0=w.body.y;
      const r=w.tick([dx/l,dz/l]);maxDy=Math.max(maxDy,Math.abs(w.body.y-y0));
      // Walking off a lip hands the body to the air in the runtime, which lands it on the floor below; model that landing for
      // short drops (≤ 1.2 m: a terrain lip left over a stair's top treads) and fail on anything longer.
      const floor=geo.surface(w.body.x,w.body.z,w.body.y,.02);if(r.leftSupport||!floor||w.body.y-floor.y>.05){
        const below=geo.surface(w.body.x,w.body.z,w.body.y,0);if(!below||w.body.y-below.y>1.2)return{end:false,air:true,at:[w.body.x,w.body.y,w.body.z],maxDy};
        w.body.y=below.y;drops++;}}
    return{end:false,maxDy};
  }
  // Each stalled on the old walker on a steep terrain sliver over its treads (45.6°, 72.2°, 49.8°, 80–83°).
  for(const id of ['coveStair.flight.0','coveStair.flight.1','bightPierStair','lampGallery.stair'])for(const reverse of [false,true]){
    // Land defect, not the walker: the cove stair's top tread ends ~0.6–0.7 m under the cove walk's bed (more than any step), so
    // climbing it stops at the top. Recorded for the next land touch-up; it passes once the bake joins them (then drop .fails).
    const landGap=id==='coveStair.flight.0'&&reverse;
    (landGap?it.fails:it)(`walks ${id}${reverse?' (reversed)':''} end to end`,()=>{expect(followBed(id,reverse)).toMatchObject({end:true});},60_000);
  }
  for(const id of ['marketStair.flight.0','crownLaunch.stair','structure.bightBridge.towerStair','structure.apronBridge','structure.prowLoopFootbridge','structure.inflowFootbridge'])
    it(`still walks ${id} both ways`,()=>{for(const reverse of [false,true])expect(followBed(id,reverse)).toMatchObject({end:true});},60_000);
  it('slides along the Reach footbridge rail when pushed into it at 45° (old: 1.3 m, then stopped dead for 4 s)',()=>{
    const b=bake().world.collision.beds.find(b=>b.id==='structure.reachFootbridge')!,a=b.points[0]!,c=b.points.at(-1)!,l=Math.hypot(c[0]-a[0],c[2]-a[2]),ux=(c[0]-a[0])/l,uz=(c[2]-a[2])/l;
    const w=stand((a[0]+c[0])/2,(a[2]+c[2])/2,a[1]+1),dir:[number,number]=[(ux+uz)/Math.SQRT2,(uz-ux)/Math.SQRT2];let dist=0;
    for(let i=0;i<240;i++){const x=w.body.x,z=w.body.z;w.tick(dir);dist+=Math.hypot(w.body.x-x,w.body.z-z);}
    expect(dist).toBeGreaterThan(5);
  },60_000);
  it('walks the market stair\'s three flights down and up, every riser shown eased',()=>{
    for(const [from,to] of [[1113.5,1140],[1140,1113.5]] as const){const w=stand(1472,from,from<1120?18.5:12.5),dz=Math.sign(to-from);let seen=walkView(w.state,w.body).y,seenStep=0,n=0;
      while(Math.abs(w.body.z-to)>.3&&n<1200){w.tick([0,dz]);const y=walkView(w.state,w.body).y;seenStep=Math.max(seenStep,Math.abs(y-seen));seen=y;n++;}
      expect(Math.abs(w.body.z-to)).toBeLessThanOrEqual(.3);expect(w.body.y).toBeCloseTo(to>1120?12:18,1);expect(seenStep).toBeLessThan(.12);
    }
  },60_000);
});
