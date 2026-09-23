/**
 * Skate v2 · integration seam: SIM × LOOK. The rendered board and rider
 * across real sim tricks: no double shove-it turn, no π snap when the sim
 * relabels nose/tail (catch, landing), heights (feet DECK_TOP above
 * present.y), and the pitch/roll sign conventions both tracks assume.
 */
import * as THREE from 'three';
import {describe,expect,it} from 'vitest';
import {createBodyFigure} from '../src/harbour/body/figure.ts';
import {createSkaterLook} from '../src/harbour/skate/look/index.ts';
import {blankPresent} from '../src/harbour/skate/look/legacy.ts';
import {DECK_TOP} from '../src/harbour/skate/look/boardGeometry.ts';
import {createSkateSim} from '../src/harbour/skate/sim/index.ts';
import {SKATE_NO_INTENT,type SkateIntent,type SkatePresent,type SkateSimEvent} from '../src/harbour/skate/contract.ts';
import {SKATE_CATALOGS,skateField} from '../src/harbour/skate/driver.ts';
import {SKATE_SPOTS} from '../src/harbour/skate/park.ts';

const wrap=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));
/** World yaw of a local +z axis. */
const yawOf=(o:THREE.Object3D)=>{const d=new THREE.Vector3(0,0,1).transformDirection(o.matrixWorld);return Math.atan2(d.x,d.z);};

function ride(flipId:string,stance:'regular'|'goofy'='regular'){
  const spot=SKATE_SPOTS.find(s=>s.id==='tideline')!;
  const sim=createSkateSim(skateField(),SKATE_CATALOGS,{x:spot.start[0],z:spot.start[1],yaw:spot.startYaw,stance});
  const s=sim.save() as Record<string,unknown>;s.vx=Math.sin(spot.startYaw)*3;s.vz=Math.cos(spot.startYaw)*3;sim.load(s);
  const figure=createBodyFigure(),world=new THREE.Group();
  const look=createSkaterLook({figure,tier:'lite',catalogs:SKATE_CATALOGS,canvas:()=>null});world.add(look.root);
  const frames:{p:SkatePresent;events:SkateSimEvent[];board:number;body:number;boardY:number}[]=[];
  const step=(intent:Partial<SkateIntent>)=>{
    const r=sim.step({...SKATE_NO_INTENT,...intent},1/60);
    look.update(r.present,r.events,1/60,false);world.updateMatrixWorld(true);
    frames.push({p:{...r.present},events:[...r.events],board:yawOf(look.board.group),body:yawOf(figure.group),boardY:new THREE.Vector3().setFromMatrixPosition(look.board.group.matrixWorld).y});
  };
  for(let i=0;i<20;i++)step({crouch:1,crouchEnd:'tail'});
  step({pop:{from:'tail',flipId,strength:1}});
  for(let i=0;i<90;i++)step({});
  return {frames,sim,look,figure};
}
const maxJump=(a:number[])=>{let m=0;for(let i=1;i<a.length;i++)m=Math.max(m,Math.abs(wrap(a[i]!-a[i-1]!)));return m;};

describe('skate v2 integration · the look draws the sim',()=>{
  for(const [flipId,halfTurns] of [['pop-shove-it',1],['fs-shove-it',1],['360-flip',2],['varial-kickflip',1],['kickflip',0]] as const){
    it(`${flipId}: the board turns continuously and ends ${halfTurns*180}° round; the rider never snaps`,()=>{
      for(const stance of ['regular','goofy'] as const){
        const {frames}=ride(flipId,stance);
        const caught=frames.flatMap(f=>f.events).find(e=>e.kind==='flip-caught');
        expect(caught,`${stance} caught`).toBeDefined();
        const land=frames.findIndex(f=>f.events.some(e=>e.kind==='land'));
        expect(land).toBeGreaterThan(0);
        expect(frames.flatMap(f=>f.events).some(e=>e.kind==='bail')).toBe(false);
        const boards=frames.map(f=>f.board),bodies=frames.map(f=>f.body);
        // A 180° shove-it takes ~0.36 s: ~0.15 rad a frame. A snap would be ~π.
        expect(maxJump(boards),`${stance} board`).toBeLessThan(.6);
        expect(maxJump(bodies),`${stance} rider`).toBeLessThan(.35);
        // Settled after landing: the board sits halfTurns·π from where it started (relative to the rider).
        const first=frames[0]!,last=frames.at(-1)!;
        const turned=wrap((last.board-last.body)-(first.board-first.body));
        expect(Math.abs(wrap(turned-halfTurns*Math.PI)),`${stance} final`).toBeLessThan(.25);
      }
    });
  }
  it('stands the soles DECK_TOP above present.y (no v1 +0.13 walker offset)',()=>{
    const {frames,figure}=ride('kickflip');
    const last=frames.at(-1)!;
    expect(last.p.phase).not.toBe('air');
    // Board group origin at the ride origin (ground), within the look's small lift/compression.
    expect(Math.abs(last.boardY-last.p.y)).toBeLessThan(.03);
    const shoe=figure.group.getObjectByName('body-shoe-left')!;
    const y=new THREE.Vector3().setFromMatrixPosition(shoe.matrixWorld).y;
    expect(y-last.p.y).toBeGreaterThan(DECK_TOP-.02);
    expect(y-last.p.y).toBeLessThan(DECK_TOP+.12);
  });
  it('agrees on pitch/roll signs: pitch > 0 puts the nose down, roll > 0 lifts the local +x rail',()=>{
    const figure=createBodyFigure(),world=new THREE.Group();
    const look=createSkaterLook({figure,tier:'lite',canvas:()=>null});world.add(look.root);
    const p=blankPresent();p.phase='roll';
    const pose=(pitch:number,roll:number)=>{p.boardPitch=pitch;p.boardRoll=roll;for(let i=0;i<60;i++)look.update(p,[],1/60,false);world.updateMatrixWorld(true);
      const m=look.ride.matrixWorld;return {nose:new THREE.Vector3(0,0,.3).applyMatrix4(m).y,rail:new THREE.Vector3(.1,0,0).applyMatrix4(m).y};};
    expect(pose(.3,0).nose).toBeLessThan(-.05);  // sim: pitch > 0 = nose DOWN
    expect(pose(-.3,0).nose).toBeGreaterThan(.05);
    expect(pose(0,.3).rail).toBeGreaterThan(.02); // sim: roll > 0 = the deck's +x edge up
  });
});
