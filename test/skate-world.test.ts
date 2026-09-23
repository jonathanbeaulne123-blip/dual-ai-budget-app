import {describe,it,expect} from 'vitest';
import {groundHeightAt} from '../src/harbour/scene/ground.ts';
import {createSkateField,LANE_HALF_WIDTH,copingRuns,type SkateWorldField} from '../src/harbour/skate/world/field.ts';
import {BowlShape,COPE_TOP,LIP_BAND,MiniShape,QuarterShape,KickerShape,RAIL_RADIUS,StairsShape,planeAt,newHit} from '../src/harbour/skate/world/features.ts';
import {SPOT_LAYOUTS,SPOTS,ROUTES,SKATE_KEEP_OUTS} from '../src/harbour/skate/world/layout.ts';
import {frameToWorld,worldToFrame,sdRoundRect,arcFor,DEG} from '../src/harbour/skate/world/profiles.ts';
import {HARBOUR_LAND,HARBOUR_LANES,distanceToTrail} from '../src/harbour/village/world.ts';
import {ISLAND_KEEP_OUTS,keepOutHit,plantPlan,trunkRadius} from '../src/harbour/scene/planting.ts';
import {courtObstacles,isClear} from '../src/harbour/body/obstacles.ts';
import {SEA_LEVEL} from '../src/harbour/scene/ground.ts';
import type {SurfaceSample} from '../src/harbour/skate/contract.ts';

const field=createSkateField(groundHeightAt);
const dirOf=(yaw:number):[number,number]=>[Math.sin(yaw),Math.cos(yaw)];
const unitLen=(s:SurfaceSample)=>Math.hypot(s.nx,s.ny,s.nz);
/** Point i of a polyline, pulled `d` toward its neighbour at the ends (so we test the line, not a corner). */
function inset(pts:readonly (readonly [number,number,number])[],i:number,d:number):[number,number,number]{
  const p=pts[i]!,q=i===0?pts[1]!:i===pts.length-1?pts[i-1]!:null;if(!q)return [p[0],p[1],p[2]];
  const l=Math.hypot(q[0]-p[0],q[2]-p[2])||1;return [p[0]+(q[0]-p[0])/l*d,p[1]+(q[1]-p[1])/l*d,p[2]+(q[2]-p[2])/l*d];
}
/** Surface points inside every shape, on a local grid, in world coordinates. */
function shapePoints(f:SkateWorldField,step=0.21){
  const out:{id:string;x:number;z:number}[]=[];
  for(const pad of f.pads)for(const s of pad.shapes){
    for(let lx=s.minX+step/2;lx<s.maxX;lx+=step)for(let lz=s.minZ+step/2;lz<s.maxZ;lz+=step){const [x,z]=frameToWorld(s.frame,lx,lz);out.push({id:s.id,x,z});}
  }
  return out;
}

describe('skate world · the field',()=>{
  it('returns unit normals that agree with finite differences of y away from edges',()=>{
    const h=1e-4;let compared=0,worst=0;
    const pts=[...shapePoints(field),...field.pads.flatMap(p=>Array.from({length:60},(_,i)=>{const [x,z]=frameToWorld(p.frame,(i%10-4.5)/5*p.half[0],(Math.floor(i/10)-2.5)/3*p.half[1]);return {id:p.id,x,z};})),
      ...Array.from({length:400},(_,i)=>({id:'open',x:-70+140*((i*.618034)%1),z:-70+140*((i*.414214)%1)}))];
    for(const p of pts){
      const s=field.sample(p.x,p.z);
      expect(Math.abs(unitLen(s)-1)).toBeLessThan(1e-9);
      expect(s.ny).toBeGreaterThanOrEqual(Math.cos(84*DEG)-1e-9);
      const e=field.sample(p.x+h,p.z),w=field.sample(p.x-h,p.z),n=field.sample(p.x,p.z+h),so=field.sample(p.x,p.z-h);
      if([e,w,n,so].some(q=>q.feature!==s.feature||q.kind!==s.kind||Boolean(q.lip)!==Boolean(s.lip)))continue;
      // Creases (a lip, a hip, a bank's toe on the pad) turn the analytic normal between neighbours: not a place to compare.
      if([e,w,n,so].some(q=>q.nx*s.nx+q.ny*s.ny+q.nz*s.nz<Math.cos(.2*DEG)))continue;
      const gx=(e.y-w.y)/(2*h),gz=(n.y-so.y)/(2*h);
      const inv=1/Math.hypot(gx,gz,1),dot=(-gx*s.nx+s.ny-gz*s.nz)*inv;
      worst=Math.max(worst,Math.acos(Math.min(1,dot)));compared++;
    }
    expect(compared).toBeGreaterThan(3000);
    expect(worst*180/Math.PI).toBeLessThan(0.25);
  });

  it('flags lips along every coping, facing uphill, and vert on every coping (kickers are not)',()=>{
    const copings=field.grindables.filter(g=>g.kind==='coping');
    expect(copings.length).toBeGreaterThanOrEqual(9);
    for(const g of copings){
      const shape=field.pads.flatMap(p=>p.shapes).find(s=>s.id===g.featureId)!;
      const vert=true,angle=(shape as QuarterShape|MiniShape|BowlShape).def.angle; // every coping lip is vert (integration decision: airs off transitions come back in)
      for(let i=0;i<g.points.length;i++){
        const face=g.faceYaws?.[i]??g.faceYaw!,[fx,fz]=dirOf(face),a=g.faceYaws?g.points[i]!:inset(g.points,i,.02);
        const at=field.sample(a[0]+fx*.05,a[2]+fz*.05);
        expect(at.lip,`${g.id}#${i}`).not.toBeNull();
        expect(at.lip!.vert,`${g.id}#${i}`).toBe(vert);
        // lipYaw is the uphill direction: opposite the way the wall faces.
        const [ux,uz]=dirOf(at.lip!.lipYaw);expect(ux*fx+uz*fz,`${g.id}#${i}`).toBeLessThan(-.97);
        // …and it agrees with the normal: the normal leans back toward the rider.
        expect(-(at.nx*ux+at.nz*uz),`${g.id}#${i}`).toBeGreaterThan(0);
        // At the lip itself the wall stands at the authored angle.
        const top=field.sample(a[0]+fx*1e-4,a[2]+fz*1e-4),pl=(shape as QuarterShape).plane,pn=1/Math.hypot(pl.gx,pl.gz,1);
        // Features ride their pad plane (heights add), so the real lip angle is the authored one ± the pad's tilt.
        const tilt=Math.atan(Math.hypot(pl.gx,pl.gz))*180/Math.PI,real=Math.acos(top.nx*-pl.gx*pn+top.ny*pn+top.nz*-pl.gz*pn)*180/Math.PI;
        expect(Math.abs(real-angle),`${g.id}#${i} angle`).toBeLessThan(tilt+.5);
        // Down the wall, past the lip strip, there is no lip.
        expect(field.sample(a[0]+fx*(LIP_BAND+.05),a[2]+fz*(LIP_BAND+.05)).lip,`${g.id}#${i}`).toBeNull();
      }
    }
    // Kickers carry non-vert lips at their end; nothing else on the island has a lip.
    const kickers=field.pads.flatMap(p=>p.shapes).filter((s):s is KickerShape=>s instanceof KickerShape);
    for(const k of kickers){const [x,z]=frameToWorld(k.frame,0,k.arc.T-.05),s=field.sample(x,z);expect(s.lip).not.toBeNull();expect(s.lip!.vert).toBe(false);expect(s.kind).toBe('metal');}
    const lipOwners=new Set([...copings.map(g=>g.featureId),...kickers.map(k=>k.id)]);
    for(const pad of field.pads)for(let lx=-pad.half[0];lx<=pad.half[0];lx+=.09)for(let lz=-pad.half[1];lz<=pad.half[1];lz+=.09){
      const [x,z]=frameToWorld(pad.frame,lx,lz),s=field.sample(x,z);if(s.lip)expect(lipOwners.has(s.feature!),`${s.feature} at ${lx},${lz}`).toBe(true);
    }
  });

  it('keeps bowl normals continuous round the corners',()=>{
    const bowl=field.pads.flatMap(p=>p.shapes).find((s):s is BowlShape=>s instanceof BowlShape)!;
    const d=bowl.def,a=bowl.arc,sd=new Float64Array(3);
    for(const dist of [.2,.6,a.T*.5,a.T-.2]){
      // Walk the offset loop at this distance and watch the normal turn smoothly.
      let prev:SurfaceSample|null=null,worst=0,n=0;
      for(let t=0;t<=1;t+=1/720){
        const ang=t*Math.PI*2,rx=Math.cos(ang),rz=Math.sin(ang);
        // Find the point on this ray at signed distance `dist` from the floor (bisection).
        let lo=0,hi=10;for(let k=0;k<50;k++){const m=(lo+hi)/2;sdRoundRect(rx*m,rz*m,d.floor[0],d.floor[1],d.corner,sd);if(sd[0]!<dist)lo=m;else hi=m;}
        const [x,z]=frameToWorld(bowl.frame,rx*lo,rz*lo),s=field.sample(x,z);
        expect(s.feature).toBe(bowl.id);
        if(prev){worst=Math.max(worst,Math.acos(Math.min(1,s.nx*prev.nx+s.ny*prev.ny+s.nz*prev.nz)));n++;}
        prev=s;
      }
      expect(n).toBeGreaterThan(700);
      expect(worst*180/Math.PI,`d=${dist}`).toBeLessThan(2.5);
    }
  });

  it('builds stairs with correct rise, run and landings',()=>{
    for(const stairs of field.pads.flatMap(p=>p.shapes).filter((s):s is StairsShape=>s instanceof StairsShape)){
      const {steps,rise,run}=stairs.def,rel=(lz:number)=>{const [x,z]=frameToWorld(stairs.frame,0,lz);return field.heightAt(x,z)-planeAt(stairs.plane,x,z);};
      expect(rel(-.3),`${stairs.id} top landing`).toBeCloseTo(steps*rise,6);
      expect(rel(-1e-6),`${stairs.id} top nosing`).toBeCloseTo(steps*rise,6);
      for(let k=1;k<steps;k++)expect(rel((k-.5)*run),`${stairs.id} tread ${k}`).toBeCloseTo((steps-k)*rise,6);
      for(let k=1;k<steps;k++){expect(rel(k*run-1e-4)-rel(k*run+1e-4)).toBeCloseTo(rise,6);}
      expect(rel((steps-1)*run+.4),`${stairs.id} bottom landing`).toBeCloseTo(0,6);
      // Rise/run read as a real stair at the island's scale (person 1.25 tall).
      expect(rise).toBeGreaterThanOrEqual(.1);expect(rise).toBeLessThanOrEqual(.14);expect(run).toBeGreaterThanOrEqual(.3);
      const [bx,bz]=frameToWorld(stairs.frame,0,(steps-1)*run+.4);expect(field.sample(bx,bz).feature).toBeNull();
    }
  });

  it('puts every grindable top line on the geometry, faces pointing away from the ledge',()=>{
    const planterIds=new Set(field.pads.flatMap(p=>p.planters.map(q=>q.def.id)));
    for(const g of field.grindables){
      expect(g.points.length).toBeGreaterThanOrEqual(2);
      for(const p of g.points)for(const v of p)expect(Number.isFinite(v)).toBe(true);
      if(g.kind==='round-rail'||g.kind==='kinked-rail'){
        expect(g.faceYaw).toBeNull();
        for(let i=1;i<g.points.length;i++){const a=g.points[i-1]!,b=g.points[i]!;for(let t=0;t<=1;t+=.05){
          const x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t,z=a[2]+(b[2]-a[2])*t;
          expect(y-2*RAIL_RADIUS-field.heightAt(x,z),`${g.id} clearance`).toBeGreaterThan(.12);
        }}
        continue;
      }
      expect(g.faceYaw).not.toBeNull();
      for(let i=0;i<g.points.length;i++){
        const p=g.points[i]!,face=g.faceYaws?.[i]??g.faceYaw!,[fx,fz]=dirOf(face);
        if(g.kind==='coping'){
          const p=g.faceYaws?g.points[i]!:inset(g.points,i,.02);
          // Top of the pipe sits COPE_TOP over the lip; the wall falls away on the face side.
          expect(p[1]-field.heightAt(p[0]-fx*1e-5,p[2]-fz*1e-5),g.id).toBeCloseTo(COPE_TOP,4);
          expect(field.heightAt(p[0]+fx*.3,p[2]+fz*.3)).toBeLessThan(p[1]-.1);
          continue;
        }
        // Walk a little along the edge so we are not on a corner.
        const q=g.points[Math.min(g.points.length-1,i+1)]!,r=g.points[Math.max(0,i-1)]!,dx=q[0]-r[0],dz=q[2]-r[2],l=Math.hypot(dx,dz)||1,ins=i===0?.06:i===g.points.length-1?-.06:0;
        const x=p[0]+dx/l*ins,z=p[2]+dz/l*ins,y=p[1]+(q[1]-r[1])/l*ins;
        const outside=field.heightAt(x+fx*.08,z+fz*.08);
        expect(outside,`${g.id} drops on its face side`).toBeLessThan(y-.05);
        if(planterIds.has(g.featureId)){const solid=field.solids.find(s=>s.id===g.featureId)!;expect(y).toBeLessThanOrEqual(solid.top+1e-9);expect(y).toBeGreaterThan(solid.top-.3);}
        else expect(field.heightAt(x-fx*1e-3,z-fz*1e-3),`${g.id} top`).toBeCloseTo(y,3);
      }
    }
  });

  it('has only never-rideable things in solids, each with a top',()=>{
    for(const s of field.solids){
      expect(/lantern|bollard|post|planter|bookends-(left|right)$/.test(s.id),s.id).toBe(true);
      expect(s.top).toBeGreaterThan(field.heightAt(s.x,s.z));
    }
    // Rideable blocks are in the heightfield at their top (manual pad, bench, platform).
    const at=(spot:string,lx:number,lz:number)=>{const l=SPOT_LAYOUTS.find(s=>s.id===spot)!,[x,z]=frameToWorld(l.frame,lx,lz),p=field.pads.find(q=>q.id===spot)!;return field.sample(x,z).y-planeAt(p.plane,x,z);};
    expect(at('tideline',4.3,-7.6)).toBeCloseTo(.18,6);expect(at('tideline',1.5,9.1)).toBeCloseTo(.38,6);expect(at('tideline',12,7.5)).toBeCloseTo(.6,6);
  });

  it('keeps the parks off buildings, doors, lanes, landmarks and the sea',()=>{
    const keep=ISLAND_KEEP_OUTS.filter(k=>!k.id.startsWith('skate-'));
    const obstacles=courtObstacles('full').filter(o=>!o.id.startsWith('tree-'));
    for(const pad of field.pads)for(let lx=-pad.half[0]-pad.reach;lx<=pad.half[0]+pad.reach;lx+=.25)for(let lz=-pad.half[1]-pad.reach;lz<=pad.half[1]+pad.reach;lz+=.25){
      const [x,z]=frameToWorld(pad.frame,lx,lz),s=field.sample(x,z);
      if(s.kind!=='concrete'&&s.feature===null&&s.kind!=='metal')continue; // open island here
      if(s.y<=groundHeightAt(x,z)+1e-6)continue;
      expect(keepOutHit(x,z,0,keep),`${pad.id} ${lx},${lz}`).toBeNull();
      expect(isClear(x,z,.05,obstacles),`${pad.id} ${lx},${lz}`).toBe(true);
      expect(Math.hypot(x,z)).toBeLessThan(HARBOUR_LAND.shore-.5);
      expect(s.y).toBeGreaterThan(SEA_LEVEL+.1);
      for(const lane of HARBOUR_LANES){if(lane.points.every(p=>Math.hypot(p[0],p[1])<3.8))continue;expect(distanceToTrail(x,z,lane.points),`${pad.id} covers ${lane.id} at ${lx},${lz}`).toBeGreaterThan(LANE_HALF_WIDTH);}
    }
    for(const s of field.solids)expect(isClear(s.x,s.z,.05,obstacles),s.id).toBe(true);
  });

  it('keeps every spot rectangle round its pad and apron, and trees out of both tiers',()=>{
    for(const pad of field.pads){
      const spot=SPOTS.find(s=>s.id===pad.id)!;
      for(const [lx,lz] of [[-1,-1],[1,-1],[1,1],[-1,1]] as const){
        const [x,z]=frameToWorld(pad.frame,lx*(pad.half[0]+pad.reach),lz*(pad.half[1]+pad.reach));
        expect(Math.abs(x-spot.x),pad.id).toBeLessThanOrEqual(spot.halfWidth+1.5);expect(Math.abs(z-spot.z),pad.id).toBeLessThanOrEqual(spot.halfDepth+1.5);
      }
      expect(pad.reach,pad.id).toBeLessThan(2.2+1e-9);
    }
    // The tighter oriented keep-outs (offered to planting) also hold the whole apron.
    for(const k of SKATE_KEEP_OUTS){const pad=field.pads.find(p=>`skate-${p.id}`===k.id)!;expect(k.halfWidth).toBeGreaterThanOrEqual(pad.half[0]+pad.reach);expect(k.halfDepth).toBeGreaterThanOrEqual(pad.half[1]+pad.reach);expect(keepOutHit(k.x,k.z,0,[k])).toBe(k.id);}
    for(const tier of ['full','lite'] as const)for(const t of plantPlan(tier,[...ISLAND_KEEP_OUTS.filter(k=>!k.id.startsWith('skate-')),...SKATE_KEEP_OUTS]).trees)for(const pad of field.pads){const [lx,lz]=worldToFrame(pad.frame,t.x,t.z),sd=new Float64Array(3);sdRoundRect(lx,lz,pad.half[0],pad.half[1],pad.corner,sd);expect(sd[0]!,`${tier} tree near ${pad.id} (oriented)`).toBeGreaterThan(pad.reach+trunkRadius(t.size));}
    for(const tier of ['full','lite'] as const)for(const t of plantPlan(tier).trees)for(const pad of field.pads){
      const [lx,lz]=worldToFrame(pad.frame,t.x,t.z),sd=new Float64Array(3);sdRoundRect(lx,lz,pad.half[0],pad.half[1],pad.corner,sd);
      expect(sd[0]!,`${tier} tree near ${pad.id}`).toBeGreaterThan(pad.reach+trunkRadius(t.size));
    }
  });

  it('starts every spot on open, flat, dry concrete',()=>{
    const obstacles=courtObstacles('full');
    expect(SPOTS.map(s=>s.id)).toEqual(['tideline','bookends','fundsteps','drydock','orchard','northlight','tidepools']);
    for(const spot of SPOTS){
      const s=field.sample(...spot.start);
      expect(s.feature,spot.id).toBeNull();expect(s.kind,spot.id).toBe('concrete');expect(s.ny,spot.id).toBeGreaterThan(.995);
      expect(Math.hypot(...spot.start)).toBeLessThan(HARBOUR_LAND.shore-2);
      expect(isClear(...spot.start,.5,obstacles),spot.id).toBe(true);
      for(const so of field.solids)expect(Math.hypot(so.x-spot.start[0],so.z-spot.start[1])-(so.kind==='circle'?so.r:Math.hypot(so.halfX,so.halfZ)),`${spot.id} near ${so.id}`).toBeGreaterThan(.8);
      // A clear metre all round, and the first two metres ahead are open too.
      for(let k=0;k<16;k++){const a=k/16*Math.PI*2,q=field.sample(spot.start[0]+Math.cos(a),spot.start[1]+Math.sin(a));expect(q.feature,`${spot.id} ring`).toBeNull();expect(Math.abs(q.y-s.y)).toBeLessThan(.1);}
      const [fx,fz]=dirOf(spot.startYaw);for(const d of [1.5,2]){expect(field.sample(spot.start[0]+fx*d,spot.start[1]+fz*d).feature,`${spot.id} ahead`).toBeNull();}
      expect(spot.words.length).toBeGreaterThan(10);
    }
  });

  it('puts route checkpoints on open ground and keeps segments clear in both tiers',async()=>{
    const {pathSegmentClear}=await import('../src/harbour/body/pathfinder.ts');
    const blocked:string[]=[];
    for(const route of ROUTES){
      expect(route.seconds[0]).toBeLessThan(route.seconds[1]);
      for(const p of route.points){const s=field.sample(p[0],p[1]);expect(s.feature,`${route.id} ${p}`).toBeNull();expect(Math.hypot(...p)).toBeLessThan(HARBOUR_LAND.shore);}
      for(const tier of ['full','lite'] as const)for(let n=1;n<route.points.length;n++){const a=route.points[n-1]!,b=route.points[n]!;if(!pathSegmentClear({x:a[0],z:a[1]},{x:b[0],z:b[1]},{obstacles:courtObstacles(tier)}))blocked.push(`${tier}:${route.id}:${n}`);}
    }
    expect(blocked).toEqual([]);
    // The Tideline lap visits the park.
    const lap=ROUTES.find(r=>r.id==='first-line')!,tide=SPOTS[0]!;
    for(const p of lap.points){expect(Math.abs(p[0]-tide.x)).toBeLessThan(tide.halfWidth);expect(Math.abs(p[1]-tide.z)).toBeLessThan(tide.halfDepth);}
  });

  it('samples 100k random points quickly, finitely and without surprises',()=>{
    let seed=7;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    const xs=new Float64Array(100000),zs=new Float64Array(100000);for(let i=0;i<xs.length;i++){xs[i]=-90+180*rand();zs[i]=-90+180*rand();}
    // Bias half the points onto the spots, where the work is.
    for(let i=0;i<50000;i++){const s=SPOTS[i%SPOTS.length]!;xs[i]=s.x+(rand()*2-1)*s.halfWidth;zs[i]=s.z+(rand()*2-1)*s.halfDepth;}
    const out:SurfaceSample={y:0,nx:0,ny:1,nz:0,kind:'grass',feature:null,lip:null};
    const t0=performance.now();let acc=0;
    for(let i=0;i<xs.length;i++){const s=field.sample(xs[i]!,zs[i]!);acc+=s.y+s.ny;if(!Number.isFinite(s.y)||!Number.isFinite(s.nx)||!(s.ny>=.1))throw new Error(`bad sample at ${xs[i]},${zs[i]}`);}
    const ms=performance.now()-t0;
    const t1=performance.now();for(let i=0;i<xs.length;i++)field.sampleInto(xs[i]!,zs[i]!,out);const msInto=performance.now()-t1;
    console.log(`[skate-world] 100k sample(): ${ms.toFixed(1)} ms · sampleInto(): ${msInto.toFixed(1)} ms`);
    expect(Number.isFinite(acc)).toBe(true);
    expect(ms).toBeLessThan(2000);
  });

  it('agrees across sample, sampleInto and heightAt',()=>{
    const out:SurfaceSample={y:0,nx:0,ny:1,nz:0,kind:'grass',feature:null,lip:null};
    for(const p of shapePoints(field,.53)){const a=field.sample(p.x,p.z),b=field.sampleInto(p.x,p.z,out);expect(b).toBe(out);expect(b.y).toBe(a.y);expect(b.nx).toBe(a.nx);expect(b.feature).toBe(a.feature);expect(field.heightAt(p.x,p.z)).toBe(a.y);expect(a.feature,`${p.id}`).not.toBeNull();}
  });

  it('fits pads to whatever ground it is given',()=>{
    const flat=createSkateField(()=>0);
    for(const p of flat.pads){expect(p.plane.gx).toBeCloseTo(0,9);expect(p.plane.gz).toBeCloseTo(0,9);expect(p.maxFill).toBeCloseTo(p.plane.y0,9);}
    const sloped=createSkateField((x,z)=>.2*x-.1*z),t=sloped.pads[0]!;
    expect(Math.hypot(t.plane.gx,t.plane.gz)).toBeCloseTo(SPOT_LAYOUTS[0]!.pad.maxSlope,9);
    // The pad clears the ground everywhere on itself, even on a steep hill.
    const sd=new Float64Array(3);for(let lx=-t.half[0];lx<=t.half[0];lx+=.5)for(let lz=-t.half[1];lz<=t.half[1];lz+=.5){sdRoundRect(lx,lz,t.half[0],t.half[1],t.corner,sd);if(sd[0]!>0)continue;const [x,z]=frameToWorld(t.frame,lx,lz);expect(sloped.heightAt(x,z)).toBeGreaterThanOrEqual(.2*x-.1*z+.039);}
    // Features ride the plane: a quarterpipe lip is the same height above it on any ground.
    const q=(f:SkateWorldField)=>{const s=f.pads[0]!.shapes.find(x=>x.id==='tideline-chimney') as QuarterShape,[x,z]=frameToWorld(s.frame,0,s.arc.T+.5);return f.heightAt(x,z)-planeAt(s.plane,x,z);};
    expect(q(flat)).toBeCloseTo(1.9,9);expect(q(sloped)).toBeCloseTo(1.9,9);expect(q(field)).toBeCloseTo(1.9,9);
  });

  it('reports surface kinds that let the sim slow riders off the concrete',()=>{
    const kinds=new Set<string>();
    for(let i=0;i<20000;i++){const a=i*2.39996,r=Math.sqrt(i/20000)*72;kinds.add(field.sample(Math.cos(a)*r,Math.sin(a)*r).kind);}
    for(const k of ['grass','path','sand','cobble','concrete','wood'])expect(kinds.has(k),k).toBe(true);
    const lane=HARBOUR_LANES.find(l=>l.id==='north-road')!,mid=lane.points[12]!;
    expect(field.sample(mid[0],mid[1]).kind).toBe('path');
    expect(field.sample(0,0).kind).toBe('cobble');
    const mini=field.pads[0]!.shapes.find(s=>s instanceof MiniShape)!,[mx,mz]=frameToWorld(mini.frame,0,0);
    expect(field.sample(mx,mz).kind).toBe('wood');
    const bowl=field.pads[0]!.shapes.find(s=>s instanceof BowlShape)!,[bx,bz]=frameToWorld(bowl.frame,0,0);
    expect(field.sample(bx,bz).kind).toBe('concrete');
  });

  it('builds transitions to the authored angles and never past 84°',()=>{
    const hit=newHit();
    for(const s of field.pads.flatMap(p=>p.shapes)){
      if(!(s instanceof QuarterShape||s instanceof MiniShape||s instanceof BowlShape||s instanceof KickerShape))continue;
      expect(s.arc.angle*180/Math.PI).toBeLessThanOrEqual(84+1e-9);
      if(s instanceof QuarterShape){s.evalLocal(0,s.arc.T-1e-9,hit);expect(Math.atan(hit.gz)*180/Math.PI).toBeCloseTo(s.def.angle,3);expect(hit.h).toBeCloseTo(s.def.height,6);}
    }
    expect(arcFor(2,90).angle*180/Math.PI).toBe(84);
    // The coping runs close into one loop.
    const runs=copingRuns(3,2,1.2);expect(runs.every(r=>r.length>=2)).toBe(true);
    for(let i=0;i<4;i++){const a=runs[i]!.at(-1)!,b=runs[(i+1)%4]![0]!;expect(Math.hypot(a[0]-b[0],a[1]-b[1])).toBeLessThan(1e-9);}
  });
});
