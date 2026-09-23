/**
 * Skate look · craft (wave 3 rider polish). The things a filmstrip judges by
 * eye, pinned as numbers: a skater's stance (not a bench squat), the head
 * looking down the line, a board sized to its rider, flips that stay tight
 * under the tucked feet, a push that really puts the back foot on the ground,
 * grabs whose hand is on the edge, and a get-up that ends on the board even
 * when the sim respawns the rider somewhere else.
 */
import * as THREE from 'three';
import {describe,expect,it} from 'vitest';
import {createBodyFigure,type BodyFigure} from '../src/harbour/body/figure.ts';
import {PLAYABLE_AVATARS} from '../src/harbour/body/avatarDefinition.ts';
import {createSkaterLook,type SkaterLook} from '../src/harbour/skate/look/index.ts';
import {blankPresent} from '../src/harbour/skate/look/legacy.ts';
import {BOARD,DECK_TOP,deckHalfWidth,deckTopAt} from '../src/harbour/skate/look/boardGeometry.ts';
import {RIG,flipEase} from '../src/harbour/skate/look/boardRig.ts';
import {grabPose,resolveCatalogs} from '../src/harbour/skate/look/catalogs.ts';
import {stanceSides} from '../src/harbour/skate/look/riderPose.ts';
import {createHeadTwist} from '../src/harbour/skate/look/headTwist.ts';
import {createSkateSim} from '../src/harbour/skate/sim/index.ts';
import {SKATE_NO_INTENT,type SkateIntent,type SkatePresent,type SkateSimEvent} from '../src/harbour/skate/contract.ts';
import {SKATE_CATALOGS,skateField} from '../src/harbour/skate/driver.ts';
import {SKATE_SPOTS} from '../src/harbour/skate/park.ts';

type Who='default'|'jonathan'|'bianca';
const fig=(who:Who)=>createBodyFigure({},who==='default'?undefined:PLAYABLE_AVATARS[who].anatomy);
const wrap=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));
const at=(f:BodyFigure,name:string)=>new THREE.Vector3().setFromMatrixPosition(f.group.getObjectByName(name)!.matrixWorld);

/** The soles in world space (shoe centre less its half height along the shoe's up). */
function soles(f:BodyFigure){
  return (['left','right'] as const).map(side=>{
    const shoe=f.group.getObjectByName(`body-shoe-${side}`) as THREE.Mesh;
    shoe.geometry.computeBoundingBox();const b=shoe.geometry.boundingBox!;
    const s=new THREE.Vector3().setFromMatrixScale(shoe.matrixWorld);
    const up=new THREE.Vector3(0,1,0).transformDirection(shoe.matrixWorld);
    return at(f,`body-shoe-${side}`).addScaledVector(up,-(b.max.y-b.min.y)/2*s.y);
  });
}
/** Points on the board (deck outline top and bottom, wheels) in world space. */
const BOARD_PTS:THREE.Vector3[]=[];
for(let k=-10;k<=10;k++){const z=k/10*BOARD.halfLength*.96;for(const sx of [-1,-.5,0,.5,1]){const x=sx*deckHalfWidth(z);BOARD_PTS.push(new THREE.Vector3(x,deckTopAt(x,z),z),new THREE.Vector3(x,BOARD.deckBottom,z));}}
for(const z of [-BOARD.truckZ,BOARD.truckZ])for(const x of [-BOARD.wheelX,BOARD.wheelX])BOARD_PTS.push(new THREE.Vector3(x,0,z),new THREE.Vector3(x,2*BOARD.wheelRadius,z));
/**
 * How far the sole stands clear of the board, measured along the shoe's own up
 * (so a tail-snapped, tilted board is not mistaken for a gap or a clash): the
 * sole's height above the highest board point inside the shoe's footprint.
 */
function soleGaps(look:SkaterLook,f:BodyFigure){
  const pts=BOARD_PTS.map(v=>v.clone().applyMatrix4(look.board.group.matrixWorld));
  return (['left','right'] as const).map(side=>{
    const shoe=f.group.getObjectByName(`body-shoe-${side}`) as THREE.Mesh;
    shoe.geometry.computeBoundingBox();const bb=shoe.geometry.boundingBox!;
    const inv=new THREE.Matrix4().copy(shoe.matrixWorld).invert(),sc=new THREE.Vector3().setFromMatrixScale(shoe.matrixWorld).y;
    let top=-Infinity;
    for(const b of pts){const l=b.clone().applyMatrix4(inv);if(Math.abs(l.x)<bb.max.x+.004&&Math.abs(l.z)<bb.max.z+.004)top=Math.max(top,l.y);}
    return top===-Infinity?Infinity:(bb.min.y-top)*sc;
  });
}

function simRide(stance:'regular'|'goofy'='regular',who:Who='default',speed=4){
  const spot=SKATE_SPOTS.find(s=>s.id==='tideline')!;
  const sim=createSkateSim(skateField(),SKATE_CATALOGS,{x:spot.start[0],z:spot.start[1],yaw:spot.startYaw,stance});
  const st=sim.save() as Record<string,unknown>;st.vx=Math.sin(spot.startYaw)*speed;st.vz=Math.cos(spot.startYaw)*speed;sim.load(st);
  const figure=fig(who),world=new THREE.Group();
  const look=createSkaterLook({figure,tier:'lite',catalogs:SKATE_CATALOGS,canvas:()=>null});world.add(look.root);
  let last:{present:SkatePresent;events:readonly SkateSimEvent[]}|null=null;
  const step=(intent:Partial<SkateIntent>={})=>{last=sim.step({...SKATE_NO_INTENT,...intent},1/60);look.update(last.present,last.events,1/60,false);world.updateMatrixWorld(true);return last;};
  return {sim,figure,look,world,step,dispose(){figure.dispose();look.dispose();}};
}

function lookRider(who:Who='default',stance:'regular'|'goofy'='regular'){
  const figure=fig(who),world=new THREE.Group();
  const look=createSkaterLook({figure,tier:'lite',catalogs:SKATE_CATALOGS,canvas:()=>null});world.add(look.root);
  const p=blankPresent();p.stance=stance;
  const run=(seconds:number,set:(p:SkatePresent,t:number)=>void,events?:(i:number)=>SkateSimEvent[]|null)=>{
    const n=Math.round(seconds*60);for(let i=0;i<n;i++){set(p,i/60);look.update(p,events?events(i):[],1/60,false);}world.updateMatrixWorld(true);
  };
  return {figure,look,world,p,run,dispose(){figure.dispose();look.dispose();}};
}

describe('skate look craft · the board is sized to its rider',()=>{
  it('is a stylised 0.62–0.68 deck with wide trucks, and the soles still stand DECK_TOP above the ride frame',()=>{
    expect(BOARD.halfLength*2).toBeGreaterThanOrEqual(.62);expect(BOARD.halfLength*2).toBeLessThanOrEqual(.68);
    expect(BOARD.wheelX+BOARD.wheelWidth/2).toBeGreaterThan(BOARD.halfWidth-.01);
    expect(DECK_TOP).toBeCloseTo(.11,6);
    // About half the rider's height (1.25), not a quarter.
    expect(BOARD.halfLength*2/1.25).toBeGreaterThan(.48);
  });
});

describe('skate look craft · a skater, not a bench squat',()=>{
  it('opens the chest toward the nose, turns the head down the line, and turns the knees in',()=>{
    for(const stance of ['regular','goofy'] as const)for(const who of ['default','bianca','jonathan'] as const){
      const r=lookRider(who,stance);
      r.run(1,p=>{p.phase='roll';p.speed=4;});
      const {toeSign}=stanceSides(stance,false);
      // Board space = world here (boardYaw 0, nose +z); the toe side is toeSign·x.
      const chest=new THREE.Vector3(0,0,1).transformDirection(r.figure.group.getObjectByName('body-carriage')!.matrixWorld);
      const open=Math.atan2(chest.z,chest.x*toeSign); // 0 = square to the toe side, π/2 = facing the nose
      expect(open,`${who} ${stance} chest`).toBeGreaterThan(.35);expect(open).toBeLessThan(.9);
      // The plain figure has a head that turns: it looks within ~35° of the travel direction.
      if(who==='default'){
        const face=new THREE.Vector3(0,0,1).transformDirection(r.figure.group.getObjectByName('body-head')!.matrixWorld);
        expect(Math.abs(wrap(Math.atan2(face.x,face.z)-r.p.heading)),`${stance} head`).toBeLessThan(.62);
      }
      // Knees point out over the toes and the back knee turns in toward the nose past its own foot.
      const s=soles(r.figure),{front}=stanceSides(stance,false);
      const kneeB=at(r.figure,`body-knee-${front===1?'left':'right'}`),footB=s[front===1?0:1]!;
      expect(kneeB.z,`${who} ${stance} back knee turned in`).toBeGreaterThan(footB.z+.02);
      expect((kneeB.x-footB.x)*toeSign).toBeGreaterThan(0);
      // Feet across the bolts: the front one over the front truck, the back one over the back truck.
      expect(Math.abs(s[front]!.z-BOARD.truckZ)).toBeLessThan(.06);expect(Math.abs(s[1-front]!.z+BOARD.truckZ)).toBeLessThan(.06);
      r.dispose();
    }
  });
  it('looks the other way riding fakie',()=>{
    const r=lookRider('default');r.p.heading=Math.PI;
    r.run(1,p=>{p.phase='roll';p.speed=3;p.fakie=true;p.boardYaw=0;});
    const face=new THREE.Vector3(0,0,1).transformDirection(r.figure.group.getObjectByName('body-head')!.matrixWorld);
    expect(face.z).toBeLessThan(-.3);
    r.dispose();
  });
});

describe('skate look craft · flips stay tight under the feet',()=>{
  it('turns fastest mid-trick and is square again before the catch',()=>{
    expect(flipEase(RIG.flipFrom)).toBe(0);expect(flipEase(RIG.flipTo)).toBe(1);
    expect(flipEase(.5)).toBeGreaterThan(.4);expect(flipEase(.5)).toBeLessThan(.6);
  });
  // (A 360 flip swings the board out from under the feet mid-spin: only its last corner is under a shoe for a frame or two.)
  for(const [flipId,tight] of [['kickflip',.12],['heelflip',.12],['pop-shove-it',.12],['360-flip',.18]] as const){
    it(`${flipId}: the board rises to meet the tuck and spins within ${tight} of the soles, never through them`,()=>{
      const r=simRide('regular','jonathan');
      for(let i=0;i<20;i++)r.step({crouch:1,crouchEnd:'tail'});
      r.step({pop:{from:'tail',flipId,strength:1}});
      let maxGap=-Infinity,minGap=Infinity,seen=0,caught=false,lifted=0;
      for(let i=0;i<60;i++){
        const {present:p,events}=r.step();
        if(events.some(e=>e.kind==='flip-caught'))caught=true;
        const u=p.trick?.u??-1;
        if(p.phase==='air')lifted=Math.max(lifted,new THREE.Vector3().setFromMatrixPosition(r.look.board.group.matrixWorld).y-p.y);
        if(u>=.2&&u<=.8){
          seen++;
          const g=soleGaps(r.look,r.figure).filter(Number.isFinite);
          for(const v of g){maxGap=Math.max(maxGap,v);minGap=Math.min(minGap,v);}
        }
        if(p.phase==='land'||p.phase==='roll')break;
      }
      expect(caught).toBe(true);expect(seen).toBeGreaterThan(5);
      expect(maxGap,`${flipId} max gap`).toBeLessThan(tight);
      expect(minGap,`${flipId} min gap`).toBeGreaterThan(-.015);
      expect(lifted,'the board comes up with the pop').toBeGreaterThan(.08);
      r.dispose();
    });
  }
});

describe('skate look craft · the push',()=>{
  it('plants the back foot on the ground beside the board, sweeps it back behind the tail truck, and keeps the front foot on the bolts',()=>{
    for(const stance of ['regular','goofy'] as const)for(const who of ['default','bianca','jonathan'] as const){
      const r=simRide(stance,who,1);
      for(let i=0;i<30;i++)r.step({push:true});
      const {front,toeSign}=stanceSides(stance,false);
      let grounded=0,minZ=Infinity,frontOff=0,frames=0;
      for(let i=0;i<56;i++){ // two strokes
        const {present:p}=r.step({push:true});
        if(p.phase!=='push')continue;
        frames++;
        const inv=new THREE.Matrix4().copy(r.look.ride.matrixWorld).invert();
        const s=soles(r.figure).map(v=>v.applyMatrix4(inv));
        const back=s[1-front]!,fr=s[front]!;
        if(back.y<.03){grounded++;expect((back.x)*toeSign,`${who} ${stance} push foot toe side`).toBeGreaterThan(BOARD.halfWidth-.02);}
        minZ=Math.min(minZ,back.z);
        if(Math.abs(fr.y-deckTopAt(fr.x,fr.z))>.03)frontOff++;
      }
      expect(frames).toBeGreaterThan(50);
      expect(grounded/frames,`${who} ${stance} share of the stroke on the ground`).toBeGreaterThan(.3);
      expect(minZ,`${who} ${stance} sweep reaches back behind the back truck`).toBeLessThan(-BOARD.truckZ-.04);
      expect(frontOff).toBe(0);
      r.dispose();
    }
  });
});

describe('skate look craft · grabs',()=>{
  it('puts the grabbing hand on its edge (within 0.06) for every catalog grab, both avatars, both stances',()=>{
    const defs=resolveCatalogs(SKATE_CATALOGS);
    for(const who of ['default','bianca','jonathan'] as const)for(const stance of ['regular','goofy'] as const)for(const id of ['indy','melon','stalefish','mute','method','nose-grab','tail-grab','crail','roastbeef','japan']){
      const r=lookRider(who,stance);
      r.run(.4,p=>{p.phase='roll';p.speed=4;});
      r.run(.8,(p,t)=>{p.phase='air';p.clearance=.8;p.vy=.5;p.airTime=t;p.grab={grabId:id,weight:Math.min(1,t/.15)};},i=>i===0?[{t:0,kind:'pop',from:'tail',switch:false,fakie:false,height:.8,flipId:null,fromFeature:null}]:[]);
      const g=defs.grab(id)!,{toeSign,front}=stanceSides(stance,false);
      const gp=grabPose(g,toeSign,BOARD.halfWidth,BOARD.halfLength);
      const tip=g.edge==='nose'||g.edge==='tail';
      const edge=new THREE.Vector3(tip?0:gp.x,RIG.centreY,gp.z).applyMatrix4(r.look.board.group.matrixWorld);
      const idx=g.hand==='front'?front:1-front;
      const hand=at(r.figure,`body-hand-${idx===1?'right':'left'}`),other=at(r.figure,`body-hand-${idx===1?'left':'right'}`);
      expect(hand.distanceTo(edge),`${who} ${stance} ${id}`).toBeLessThan(.06);
      expect(other.distanceTo(edge)).toBeGreaterThan(.25);
      // The board comes up toward the rider (knees tucked), not the chest folded down onto it.
      const chest=new THREE.Vector3(0,1,0).transformDirection(r.figure.group.getObjectByName('body-carriage')!.matrixWorld);
      expect(chest.y,`${who} ${stance} ${id} chest stays up`).toBeGreaterThan(.72);
      r.dispose();
    }
  });
});

describe('skate look craft · bail and get-up',()=>{
  it('tumbles at once, and after a respawn ends standing on the board at the new spot',()=>{
    const r=simRide('regular','default');
    for(let i=0;i<4;i++)r.step();
    r.step({pop:{from:'tail',flipId:'triple-kickflip',strength:0}});
    let bailAt=-1,tiltEarly=0,recAt=-1,jump=0,prev:SkatePresent|null=null;
    for(let i=0;i<260;i++){
      const {present:p,events}=r.step();
      if(events.some(e=>e.kind==='bail'))bailAt=i;
      if(bailAt>=0&&i===bailAt+9){const up=new THREE.Vector3(0,1,0).transformDirection(r.figure.group.matrixWorld);tiltEarly=Math.acos(Math.min(1,up.y));}
      if(events.some(e=>e.kind==='recovered')){recAt=i;if(prev)jump=Math.hypot(p.x-prev.x,p.z-prev.z);}
      prev={...p};
    }
    expect(bailAt).toBeGreaterThan(0);expect(recAt).toBeGreaterThan(bailAt);
    // 0.15 s into the bail the body is already going over (no upright T-pose frame).
    expect(tiltEarly).toBeGreaterThan(.35);
    // Whatever the sim did (respawn: `jump`), the board is back under the feet, upright, and the rider stands on it.
    void jump;
    const up=new THREE.Vector3(0,1,0).transformDirection(r.look.board.group.matrixWorld);
    expect(up.y).toBeGreaterThan(.99);
    const inv=new THREE.Matrix4().copy(r.look.ride.matrixWorld).invert();
    const b=new THREE.Vector3().setFromMatrixPosition(r.look.board.group.matrixWorld).applyMatrix4(inv);
    expect(Math.hypot(b.x,b.z)).toBeLessThan(.02);
    for(const s of soles(r.figure).map(v=>v.applyMatrix4(inv)))expect(Math.abs(s.y-deckTopAt(s.x,s.z))).toBeLessThan(.02);
    r.dispose();
  });
});

describe('skate look craft · the authored head turns',()=>{
  it('twists only above the neck, rebuilds the shader with the chunk, and hands the original material back',()=>{
    const carriage=new THREE.Group();carriage.name='body-carriage';
    const surface=new THREE.Group();surface.name='playable-x';surface.scale.setScalar(.5);surface.position.y=.01;carriage.add(surface);
    const mat=new THREE.MeshStandardMaterial();const mesh=new THREE.Mesh(new THREE.BoxGeometry(.1,1,.1),mat);surface.add(mesh);
    const hidden=new THREE.Mesh(new THREE.BoxGeometry(),mat);hidden.name='body-head';carriage.add(hidden);
    const tw=createHeadTwist(carriage,.47);
    tw.sync();
    expect(mesh.material).not.toBe(mat);expect(hidden.material).toBe(mat);
    const shader={uniforms:{} as Record<string,{value:unknown}>,vertexShader:'#include <common>\n#include <beginnormal_vertex>\n#include <begin_vertex>',fragmentShader:''};
    (mesh.material as THREE.Material).onBeforeCompile(shader as never,{} as never);
    expect(shader.vertexShader).toContain('uHeadTwist');expect(shader.vertexShader).toContain('smoothstep(uHeadBand.x');
    tw.set(1,0);
    // A point at head height in the mesh's own space turns by the yaw about the neck; the carriage-space height row is right.
    const M=shader.uniforms.uHeadTwist!.value as THREE.Matrix4,row=shader.uniforms.uHeadRowY!.value as THREE.Vector4;
    const local=new THREE.Vector3(.1,.1,0); // → carriage (0.05, 0.06, 0): below the neck
    expect(row.x*local.x+row.y*local.y+row.z*local.z+row.w).toBeCloseTo(.06,6);
    const head=new THREE.Vector3(.2,1.1,0),turned=head.clone().applyMatrix4(M);
    const toCar=(v:THREE.Vector3)=>v.clone().multiplyScalar(.5).add(new THREE.Vector3(0,.01,0));
    const a=toCar(head),b=toCar(turned);
    expect(b.y).toBeCloseTo(a.y,6);expect(Math.atan2(b.x,b.z)-Math.atan2(a.x,a.z)).toBeCloseTo(1,5);
    tw.release();
    expect(mesh.material).toBe(mat);
  });
});
