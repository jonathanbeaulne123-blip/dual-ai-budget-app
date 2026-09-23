/**
 * Skate v2 · integration seam: the park's DRESSING (hedges, fence flats,
 * bleachers, lamps, masts, pots, crate, rope posts) collides. PARK lists the
 * pieces (`SkatePark.dressing`, none in `field.solids`); the ride merges them
 * into the sim as height-aware solids (`world/dressingSolids.ts`) so a rider
 * on the grass bumps into a hedge instead of passing through it — without
 * blocking a spot start, a route checkpoint or a route segment.
 */
import {describe,expect,it} from 'vitest';
import {SKATE_NO_INTENT,type SkateSimEvent,type SkateSolid} from '../src/harbour/skate/contract.ts';
import {createSkateSim} from '../src/harbour/skate/sim/index.ts';
import {SKATE_TUNING} from '../src/harbour/skate/sim/tuning.ts';
import {SKATE_CATALOGS,skateField,skateSimOptions} from '../src/harbour/skate/driver.ts';
import {SKATE_ROUTES,SKATE_SPOTS} from '../src/harbour/skate/park.ts';
import {buildParkMeshData} from '../src/harbour/skate/world/meshes.ts';
import {skatePalette} from '../src/harbour/skate/world/palette.ts';
import {dressingSolids,rememberDressing,skateDressingSolids} from '../src/harbour/skate/world/dressingSolids.ts';
import {ensureSkateDressing} from '../src/harbour/skate/world/dressingBuild.ts';
import {courtObstacles} from '../src/harbour/body/obstacles.ts';

const field=skateField();
const solids=ensureSkateDressing(field);

/** Signed clearance from (x,z) to a solid's footprint (negative = inside). */
function clearance(s:SkateSolid,x:number,z:number):number {
  if(s.kind==='circle')return Math.hypot(x-s.x,z-s.z)-s.r;
  const dx=x-s.x,dz=z-s.z,c=Math.cos(s.yaw),n=Math.sin(s.yaw);
  // frameToWorld: x = ox + lx·cos + lz·sin, z = oz + lz·cos − lx·sin
  const lx=dx*c-dz*n,lz=dx*n+dz*c;
  const qx=Math.abs(lx)-s.halfX,qz=Math.abs(lz)-s.halfZ;
  return Math.hypot(Math.max(qx,0),Math.max(qz,0))+Math.min(Math.max(qx,qz),0);
}
const nearest=(x:number,z:number)=>solids.reduce((m,s)=>{const c=clearance(s,x,z);return c<m.c?{c,id:s.id}:m;},{c:Infinity,id:''});

describe('skate v2 integration · dressing colliders',()=>{
  it('turns every dressing piece into a height-aware sim solid, the same in every theme and tier',()=>{
    const lite=buildParkMeshData(field,skatePalette('classic'),'lite').dressing;
    const full=buildParkMeshData(field,skatePalette('newfoundland'),'full').dressing;
    expect(lite.length).toBeGreaterThan(100);
    expect(full.map(d=>[d.id,d.x,d.z,d.top])).toEqual(lite.map(d=>[d.id,d.x,d.z,d.top]));
    expect(solids).toHaveLength(lite.length);
    expect(solids.filter(s=>s.kind==='obox').length).toBe(lite.filter(d=>d.box).length);
    for(const s of solids){expect(s.id.startsWith('dressing:')).toBe(true);expect(Number.isFinite(s.top)).toBe(true);expect(s.top).toBeGreaterThan(field.ground(s.x,s.z));}
    // The park scene's registration replaces, never doubles.
    rememberDressing(field,full);expect(skateDressingSolids(field)).toHaveLength(full.length);
    expect(dressingSolids(full)).toEqual(skateDressingSolids(field));
    // The ride's sim options carry them next to the island obstacles.
    expect(skateSimOptions(courtObstacles('lite'),field).extraSolids).toHaveLength(full.length);
  });

  it('leaves every spot start, route checkpoint and route segment clear for the rider',()=>{
    const R=SKATE_TUNING.RADIUS,blocked:string[]=[];
    for(const s of SKATE_SPOTS){const n=nearest(s.start[0],s.start[1]);if(n.c<R+.1)blocked.push(`start ${s.id}: ${n.id} ${n.c.toFixed(2)}`);}
    for(const r of SKATE_ROUTES){
      r.points.forEach((p,i)=>{const n=nearest(p[0],p[1]);if(n.c<R+.3)blocked.push(`${r.id}#${i}: ${n.id} ${n.c.toFixed(2)}`);});
      for(let i=1;i<r.points.length;i++){
        const a=r.points[i-1]!,b=r.points[i]!,steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.1);
        for(let k=0;k<=steps;k++){const t=k/steps,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t,n=nearest(x,z);if(n.c<R){blocked.push(`${r.id} seg ${i} @${t.toFixed(2)}: ${n.id}`);break;}}
      }
    }
    expect(blocked).toEqual([]);
  });

  it('a rider rolling across the grass into a hedge bumps and stops at it instead of passing through',()=>{
    const hedge=solids.find(s=>s.kind==='obox'&&s.id.includes('-hedge-'))! as Extract<SkateSolid,{kind:'obox'}>;
    // Approach along the hedge's thin local axis (lz), from 2.5 u out on the side facing away from the pad.
    const c=Math.cos(hedge.yaw),n=Math.sin(hedge.yaw),thin=hedge.halfZ<hedge.halfX;
    const [ax,az]=thin?[n,c]:[c,-n]; // world direction of local +lz (or +lx)
    const run=(extra:readonly SkateSolid[]|null)=>{
      const out:number[]=[];
      for(const side of [1,-1]){
        const x0=hedge.x+ax*2.5*side,z0=hedge.z+az*2.5*side,yaw=Math.atan2(-ax*side,-az*side);
        const opts=extra?{...skateSimOptions([],field),extraSolids:extra}:{...skateSimOptions([],field),extraSolids:[]};
        const sim=createSkateSim(field,SKATE_CATALOGS,{x:x0,z:z0,yaw,stance:'regular',...opts});
        const s=sim.save() as Record<string,unknown>;s.vx=Math.sin(yaw)*4;s.vz=Math.cos(yaw)*4;sim.load(s);
        const ev:SkateSimEvent[]=[];let minC=Infinity,crossed=false;
        for(let i=0;i<90;i++){
          const r=sim.step({...SKATE_NO_INTENT,push:i%20===0},1/60);ev.push(...r.events);
          const p=r.present,d=(p.x-hedge.x)*ax+(p.z-hedge.z)*az;
          minC=Math.min(minC,clearance(hedge,p.x,p.z));if(d*side<-(thin?hedge.halfZ:hedge.halfX)-.05)crossed=true;
        }
        out.push(crossed?1:0,minC);
      }
      return out;
    };
    const without=run(null),withIt=run(solids);
    expect(without[0]!+without[2]!).toBeGreaterThan(0); // proves the ride would otherwise pass through
    expect(withIt[0]).toBe(0);expect(withIt[2]).toBe(0);
    expect(Math.min(withIt[1]!,withIt[3]!)).toBeGreaterThan(-.02); // never inside the box
  });

  it('an air clears a low piece: the collider has a top',()=>{
    const crate=solids.find(s=>s.id.includes('orchard-crate'))!;
    expect(crate.top-field.ground(crate.x,crate.z)).toBeLessThan(.5);
  });
});
