import {describe,it,expect} from 'vitest';
import {createPerspective} from '../src/harbour/horizon/runtime/perspective.ts';
const body={x:12,y:50,z:7,yaw:.3},eye=[0,60,-15],target=[12,51,7];
describe('perspective is independent of movement',()=>{
  it('cycles activity / first person / floating and never changes body or heading',()=>{
    const p=createPerspective(),before={...body};expect(p.pose(body,()=>false)).toBeNull();
    expect(p.cycle(body,eye,target)).toBe('first-person');expect(p.pose(body,()=>false)?.eye).toEqual([12,51.15,7]);
    p.look(.8,.2);expect(body).toEqual(before);
    expect(p.cycle(body,eye,target)).toBe('floating');expect(p.pose(body,()=>false)!.eye[1]).toBeGreaterThan(body.y);
    expect(p.cycle(body,eye,target)).toBe('activity');expect(p.pose(body,()=>false)).toBeNull();
  });
  it('retains the chosen perspective through body handoffs and clears the first-person ceiling',()=>{
    const p=createPerspective();p.cycle(body,eye,target);p.look(.4,0);
    const a=p.pose(body,()=>false)!,b=p.pose({...body,y:40,yaw:body.yaw+Math.PI},()=>false)!;expect(p.mode()).toBe('first-person');
    expect(a.target[0]-a.eye[0]).toBeCloseTo(b.target[0]-b.eye[0]);expect(p.pose(body,()=>false,51)!.eye[1]).toBeLessThan(51);
  });
  it('pulls the floating view in front of obstacles and bounds zoom',()=>{
    const p=createPerspective();p.cycle(body,eye,target);p.cycle(body,eye,target);p.zoom(100000);
    const clear=p.pose(body,()=>false)!,blocked=p.pose(body,(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]!))>4)!;
    expect(Math.hypot(...clear.eye.map((v,i)=>v-clear.target[i]!))).toBeCloseTo(80);
    expect(Math.hypot(...blocked.eye.map((v,i)=>v-blocked.target[i]!))).toBeLessThanOrEqual(4);
  });
});
