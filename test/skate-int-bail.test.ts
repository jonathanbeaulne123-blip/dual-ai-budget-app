/**
 * Skate v2 · integration seam: a bail reads as tumble → lie briefly → get up
 * WHERE YOU FELL (SIM × LOOK × CAMERA). The sim only relocates when the heap
 * is not safe to stand on (a rail, a step, a ramp face, water), says so with
 * `recovered.moved`, and only then does the camera cut and the look lay the
 * board at the new spot.
 */
import * as THREE from 'three';
import {describe,expect,it} from 'vitest';
import {createBodyFigure} from '../src/harbour/body/figure.ts';
import {createSkaterLook} from '../src/harbour/skate/look/index.ts';
import {RIG} from '../src/harbour/skate/look/boardRig.ts';
import {createSkateCamera} from '../src/harbour/skate/camera/skateCamera.ts';
import {createSkateSim,type SkateSim} from '../src/harbour/skate/sim/index.ts';
import {SKATE_TUNING} from '../src/harbour/skate/sim/tuning.ts';
import {block,makeField} from '../src/harbour/skate/sim/fields.ts';
import {kick} from '../src/harbour/skate/sim/testKit.ts';
import {SKATE_NO_INTENT,type SkateField,type SkatePresent,type SkateSimEvent} from '../src/harbour/skate/contract.ts';
import {SKATE_CATALOGS} from '../src/harbour/skate/driver.ts';

type Rec={p:SkatePresent;events:SkateSimEvent[];cam:[number,number,number];board:THREE.Vector3;boardUp:number;feetOnBoard:number};

function rig(field:SkateField){
  const sim=createSkateSim(field,SKATE_CATALOGS,{x:0,z:0,yaw:0,stance:'regular'});
  const figure=createBodyFigure(),world=new THREE.Group();
  const look=createSkaterLook({figure,tier:'lite',catalogs:SKATE_CATALOGS,canvas:()=>null});world.add(look.root);
  const cam=createSkateCamera({ground:(x,z)=>field.sample(x,z)?.y??0});
  const out:Rec[]=[];
  const step=(pop=false)=>{
    const r=sim.step({...SKATE_NO_INTENT,pop:pop?{from:'tail',flipId:'triple-kickflip',strength:0}:null},1/60);
    look.update(r.present,r.events,1/60,false);world.updateMatrixWorld(true);
    const f=cam.update(r.present,r.events,1/60,{aspect:1.6,reducedMotion:false});
    const board=new THREE.Vector3().setFromMatrixPosition(look.board.group.matrixWorld);
    const up=new THREE.Vector3(0,1,0).transformDirection(look.board.group.matrixWorld).y;
    const shoe=new THREE.Vector3().setFromMatrixPosition(figure.group.getObjectByName('body-shoe-left')!.matrixWorld);
    out.push({p:{...r.present,bail:r.present.bail&&{...r.present.bail}},events:[...r.events],cam:[f.position[0],f.position[1],f.position[2]],board,boardUp:up,feetOnBoard:Math.hypot(shoe.x-board.x,shoe.z-board.z)});
  };
  return {sim,look,out,step};
}
const idx=(out:Rec[],kind:SkateSimEvent['kind'])=>out.findIndex(r=>r.events.some(e=>e.kind===kind));
const camJump=(out:Rec[],i:number)=>Math.hypot(out[i]!.cam[0]-out[i-1]!.cam[0],out[i]!.cam[2]-out[i-1]!.cam[2]);

/** Roll along +z, pop a triple kickflip with no strength (never caught): a bail on flat ground. */
function bailOnFlat(field:SkateField,until:'bail'|'end'){
  const r=rig(field);
  kick(r.sim,{vz:4});
  for(let i=0;i<6;i++)r.step();
  r.step(true);
  for(let i=0;i<400&&(until==='end'||idx(r.out,'bail')<0);i++)r.step();
  return r;
}
/** Where the flat-ground bail ends up lying (the tumble slides on after the bail event; the sim is deterministic). */
function flatHeap(){
  const r=bailOnFlat(makeField({}),'end');
  const p=r.out[idx(r.out,'recovered')-1]!.p;r.look.dispose();
  return {x:p.x,z:p.z};
}
/** Move a sim that is mid-bail onto another field (same state), as if it had fallen there. */
function continueOn(sim:SkateSim,field:SkateField){
  const saved=sim.save();
  const r=rig(field);r.sim.load(saved);
  return r;
}

describe('skate v2 integration · bails get up where you fell',()=>{
  it('on flat ground: tumble, lie, get up at the heap; no relocation, no camera cut, the board comes back under the feet there',()=>{
    const r=bailOnFlat(makeField({}),'end'),out=r.out;
    const b=idx(out,'bail'),rec=idx(out,'recovered');
    expect(b).toBeGreaterThan(0);expect(rec).toBeGreaterThan(b);
    // Lies there for the sim's bail time, then the get-up.
    expect((rec-b)/60).toBeCloseTo(SKATE_TUNING.BAIL_TIME,1);
    const ev=out[rec]!.events.find(e=>e.kind==='recovered') as {moved?:boolean};
    expect(ev.moved).toBe(false);
    // Where they fell: the recover pose is the heap.
    const heap=out[rec-1]!.p,up=out[rec]!.p;
    expect(Math.hypot(up.x-heap.x,up.z-heap.z)).toBeLessThan(.01);
    // Control comes back after RECOVER_TIME, as the look's get-up stamps the board.
    const ground=out.findIndex((o,i)=>i>rec&&o.p.phase!=='recover');
    expect((ground-rec)/60).toBeCloseTo(SKATE_TUNING.RECOVER_TIME,1);
    expect(SKATE_TUNING.RECOVER_TIME/RIG.recoverSeconds).toBeGreaterThan(.7);
    expect(SKATE_TUNING.RECOVER_TIME/RIG.recoverSeconds).toBeLessThan(.9);
    // No cut: the camera moves at most a little a frame through the bail and the get-up.
    for(let i=b;i<Math.min(out.length,ground+30);i++)expect(camJump(out,i),`camera frame ${i}`).toBeLessThan(.25);
    // The loose board stays near the heap (it was thrown along the fall), never teleports.
    for(let i=b+1;i<ground+30;i++)expect(out[i]!.board.distanceTo(out[i-1]!.board),`board frame ${i}`).toBeLessThan(.35);
    // Standing on it, upright, at the heap.
    const last=out.at(-1)!;
    expect(last.boardUp).toBeGreaterThan(.99);
    expect(Math.hypot(last.board.x-heap.x,last.board.z-heap.z)).toBeLessThan(.05);
    expect(last.feetOnBoard).toBeLessThan(.4);
    r.look.dispose();
  });

  it('under a rail: relocate to a safe pose, `moved`, the camera cuts once and the board is laid at the new spot',()=>{
    const heap=flatHeap(),a=bailOnFlat(makeField({}),'bail');
    // The same fall, but a round rail 0.4 up runs across right where the rider lies.
    const railField=makeField({grindables:[{id:'rail',name:'Rail',kind:'round-rail',faceYaw:null,points:[[heap.x-3,.4,heap.z+.1],[heap.x+3,.4,heap.z+.1]]}]});
    const r=continueOn(a.sim,railField);
    for(let i=0;i<150;i++)r.step();
    const out=r.out,rec=idx(out,'recovered');
    expect(rec).toBeGreaterThan(0);
    const ev=out[rec]!.events.find(e=>e.kind==='recovered') as {moved?:boolean};
    expect(ev.moved).toBe(true);
    const was=out[rec-1]!.p,now=out[rec]!.p;
    expect(Math.hypot(now.x-was.x,now.z-was.z)).toBeGreaterThan(.79);
    // One cut on the relocation frame (and only there).
    expect(camJump(out,rec)).toBeGreaterThan(.5);
    for(let i=rec+1;i<out.length;i++)expect(camJump(out,i),`camera frame ${i}`).toBeLessThan(.25);
    // The board lies beside the rider at the new spot, not back at the heap.
    expect(Math.hypot(out[rec]!.board.x-now.x,out[rec]!.board.z-now.z)).toBeLessThan(.6);
    const last=out.at(-1)!;
    expect(last.boardUp).toBeGreaterThan(.99);
    expect(Math.hypot(last.board.x-now.x,last.board.z-now.z)).toBeLessThan(.05);
    r.look.dispose();a.look.dispose();
  });

  it('on a step edge or a ramp face: relocate; on open flat: stay',()=>{
    const heap=flatHeap(),a=bailOnFlat(makeField({}),'bail');
    const recoveredOn=(field:SkateField,shore?:(x:number,z:number)=>{x:number;z:number;ashore:boolean})=>{
      const saved=a.sim.save();
      const sim=createSkateSim(field,SKATE_CATALOGS,{x:0,z:0,yaw:0,stance:'regular',shore});sim.load(saved);
      for(let i=0;i<120;i++){const r=sim.step(SKATE_NO_INTENT,1/60);const e=r.events.find(x=>x.kind==='recovered') as {moved?:boolean}|undefined;if(e)return e.moved;}
      return undefined;
    };
    // A 0.3 ledge whose edge runs 0.1 from the heap: the footprint straddles a step.
    expect(recoveredOn(makeField({pieces:[block({id:'ledge',x:heap.x+.1+1,z:heap.z,yaw:0,halfX:1,halfZ:3,h:.3})]}))).toBe(true);
    // The heap is on a ramp face (a 31° bank starting just before it).
    expect(recoveredOn(makeField({groundY:(_x,z)=>Math.max(0,(z-(heap.z-.4))*.6)}))).toBe(true);
    // (A heap past the shoreline cannot happen: the tumble is held ashore, and a water bail never stays.)
    // Open flat: stays.
    expect(recoveredOn(makeField({}))).toBe(false);
    a.look.dispose();
  });
});
