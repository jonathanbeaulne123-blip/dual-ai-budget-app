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
import {block,makeField} from '../src/harbour/skate/sim/fields.ts';
import {kick} from '../src/harbour/skate/sim/testKit.ts';

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

describe('skate v2 integration · a flip read on mid-air (wave 3 upgrade)',()=>{
  // FEEL: present.trick.flipId can change in the air (kickflip → double kickflip) with u rescaled so the
  // board keeps the turns it has made. LOOK must draw one continuous flip: no pop at the switch.
  const run=(lateAt:number,lateId:string|null)=>{
    const field=makeField({pieces:[block({id:'ledge',x:0,z:-4,yaw:0,halfX:2,halfZ:4,h:2.4})]});
    const sim=createSkateSim(field,SKATE_CATALOGS,{x:0,z:-1,yaw:0,stance:'regular'});
    kick(sim,{vz:5,y:2.4});
    const figure=createBodyFigure(),world=new THREE.Group();
    const look=createSkaterLook({figure,tier:'lite',catalogs:SKATE_CATALOGS,canvas:()=>null});world.add(look.root);
    const qs:THREE.Quaternion[]=[],ids:(string|null)[]=[],events:SkateSimEvent[]=[];
    for(let i=0;i<100;i++){
      const t=i/60;
      const r=sim.step({...SKATE_NO_INTENT,pop:i===0?{from:'tail',flipId:'kickflip',strength:.8}:null,lateFlip:lateId&&Math.abs(t-lateAt)<1e-9?lateId:null,crouch:t>.5?1:0},1/60);
      look.update(r.present,r.events,1/60,false);
      events.push(...r.events);ids.push(r.present.trick?.flipId??null);
      // The board in the ride frame: the flip overlay (and yawFlip), nothing the ride frame does.
      qs.push(look.board.group.quaternion.clone());
    }
    const steps=qs.slice(1).map((q,i)=>q.angleTo(qs[i]!));
    return {steps,ids,events,qs,look};
  };
  it('kickflip → double kickflip: the board keeps turning at its own pace through the switch and is caught square',()=>{
    const up=run(.25,'double-kickflip');
    expect(up.events.some(e=>e.kind==='late-flip'&&e.flipId==='double-kickflip')).toBe(true);
    expect(up.events.filter(e=>e.kind==='flip-caught').map(e=>(e as {flipId:string}).flipId)).toEqual(['double-kickflip']);
    expect(up.events.some(e=>e.kind==='bail')).toBe(false);
    const sw=up.ids.findIndex((id,i)=>i>0&&id==='double-kickflip'&&up.ids[i-1]==='kickflip');
    expect(sw).toBeGreaterThan(0);
    // The frame of the switch turns the board no more than the flip's own frames around it.
    const at=up.steps[sw-1]!,around=Math.max(...up.steps.slice(sw-6,sw-1),...up.steps.slice(sw,sw+5));
    expect(at,`switch ${at.toFixed(3)} vs around ${around.toFixed(3)}`).toBeLessThan(around*1.25+.02);
    // Without the carry the switch would redraw the board ~0.38 turns back (≈ 2.4 rad): nowhere near.
    expect(at).toBeLessThan(.6);
    // Never rolls backwards: the deck's local x axis keeps going the same way round (sign of the roll rate).
    const xs=up.qs.map(q=>new THREE.Vector3(1,0,0).applyQuaternion(q));
    let back=0;for(let i=sw-3;i<sw+20&&i+1<xs.length;i++){const a=Math.atan2(xs[i]!.y,xs[i]!.x),b=Math.atan2(xs[i+1]!.y,xs[i+1]!.x);if(Math.sign(wrap(b-a))!==Math.sign(wrap(xs[sw+1]!.y-xs[sw]!.y||1))&&Math.abs(wrap(b-a))>.02)back++;}
    expect(back).toBeLessThanOrEqual(1);
    // Caught square: grip up again once it lands.
    const up1=new THREE.Vector3(0,1,0).applyQuaternion(up.qs.at(-1)!);
    expect(up1.y).toBeGreaterThan(.97);
    up.look.dispose();
  });
  it('a caught kickflip read on as a double picks up from square (no jump either)',()=>{
    // Just after the catch the sim still takes the continuation (gesture prefix), from u ≈ 0.5.
    const up=run(.45,'double-kickflip');
    const caught=up.events.filter(e=>e.kind==='flip-caught').map(e=>(e as {flipId:string}).flipId);
    expect(caught).toEqual(['kickflip','double-kickflip']);
    const sw=up.ids.findIndex((id,i)=>i>0&&id==='double-kickflip'&&up.ids[i-1]!=='double-kickflip');
    expect(sw).toBeGreaterThan(0);
    // The sim restarts it at u ≈ 0.5 (a double's first turn is already made): the board starts from square.
    expect(up.steps[sw-1]!).toBeLessThan(.6);
    const up1=new THREE.Vector3(0,1,0).applyQuaternion(up.qs.at(-1)!);
    expect(up1.y).toBeGreaterThan(.97);
    up.look.dispose();
  });
});
