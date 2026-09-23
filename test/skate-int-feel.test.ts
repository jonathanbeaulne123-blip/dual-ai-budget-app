/**
 * Skate v2 · feel pass (wave 3): the ride on the REAL Tideline park, measured.
 *  1. Pumping the Breadbin: indefinitely, centred, no bail.
 *  2. The Hatch kicker: airs ≈ 0.8–1.4 above the lip at good speed, a 360 flip lands, the gap clears.
 *  4. Transitions: no board-heading jumps at any angle or speed; angled vert airs come back in.
 *  8. Names on a full line.
 */
import {describe,expect,it} from 'vitest';
import {SKATE_NO_INTENT,type SkateIntent,type SkatePresent,type SkateSimEvent} from '../src/harbour/skate/contract.ts';
import {createSkateSim} from '../src/harbour/skate/sim/index.ts';
import {SKATE_CATALOGS,skateField,skateSimOptions} from '../src/harbour/skate/driver.ts';
import {courtObstacles} from '../src/harbour/body/obstacles.ts';
import {parkPoint} from '../src/harbour/skate/world/layout.ts';
import {createSkateScore} from '../src/harbour/skate/tricks/score.ts';
import {createLabCore,tidelinePose} from './browser/skateLabCore.ts';

const field=skateField(),obs=skateSimOptions(courtObstacles('lite'));
const o=parkPoint('tideline',0,0),ex=parkPoint('tideline',1,0),ez=parkPoint('tideline',0,1);
/** World → Tideline local. */
const local=(x:number,z:number)=>{const dx=x-o[0],dz=z-o[1];return [dx*(ex[0]-o[0])+dz*(ex[1]-o[1]),dx*(ez[0]-o[0])+dz*(ez[1]-o[1])] as const;};
function rider(lx:number,lz:number,deg:number,speed:number){
  const pose=tidelinePose(lx,lz,deg);
  const sim=createSkateSim(field,SKATE_CATALOGS,{...pose,stance:'regular',...obs});
  const s=sim.save() as Record<string,number>;s.vx=Math.sin(pose.yaw)*speed;s.vz=Math.cos(pose.yaw)*speed;sim.load(s);
  return sim;
}
const I=(o:Partial<SkateIntent>={}):SkateIntent=>({...SKATE_NO_INTENT,...o});

describe('feel · the Breadbin mini (issue 1)',()=>{
  it('pumps for a minute: gets above the coping, levels off, stays centred, never bails',()=>{
    const sim=rider(-9,6.4,0,3.5),COPING=1.648;
    const peaks:number[]=[],lzs:number[]=[];let lastVy=0;const events:SkateSimEvent[]=[];
    for(let i=0;i<60*60;i++){
      const p=sim.present();
      // A pumper: crouch in the air and on the flat bottom, stand tall through the curve.
      const crouch=p.phase==='air'||Math.abs(p.boardPitch)<.12?1:0;
      const r=sim.step(I({crouch}),1/60);events.push(...r.events);
      const q=r.present;
      if(lastVy>0&&q.vy<=0&&q.y>1.2){peaks.push(q.y-COPING);lzs.push(local(q.x,q.z)[1]);}
      lastVy=q.vy;
    }
    expect(events.some(e=>e.kind==='bail')).toBe(false);
    expect(peaks.length).toBeGreaterThan(30);
    expect(peaks.findIndex(h=>h>0)).toBeLessThanOrEqual(4);          // above the coping within a few walls
    const late=peaks.slice(-12);
    expect(Math.min(...late)).toBeGreaterThan(.7);                    // …and it levels off up there
    expect(Math.max(...late)).toBeLessThan(1.6);
    // Centred: the mini is 4 wide (z 4.4…8.4); a minute of walls walks less than 0.25 (was 0.35 a wall).
    expect(Math.max(...lzs.map(z=>Math.abs(z-6.4)))).toBeLessThan(.25);
  });
});

describe('feel · the Hatch kicker (issue 2)',()=>{
  function hatch(speed:number,flipId:string|null,popAtLx:number|null){
    const sim=rider(11,2.5,180,speed);let popped=false,apex=-9;const ev:SkateSimEvent[]=[];let landLx=NaN;
    for(let i=0;i<150;i++){
      const p=sim.present(),[lx]=local(p.x,p.z);let it=I();
      if(popAtLx!==null&&!popped){if(lx<=popAtLx+1.2)it=I({crouch:1,crouchEnd:'tail'});if(lx<=popAtLx){it=I({pop:{from:'tail',flipId,strength:.8}});popped=true;}}
      else if(p.phase==='air'&&p.vy<0)it=I({crouch:1});
      const r=sim.step(it,1/60);ev.push(...r.events);
      if(r.present.phase==='air')apex=Math.max(apex,r.present.y);
      if(Number.isNaN(landLx)&&r.events.some(e=>e.kind==='land'))landLx=local(r.present.x,r.present.z)[0];
    }
    return {apex:apex-1.39,ev,landLx};
  }
  it('an ollie at the lip rises 0.8–1.4 above it at 7–9 u/s (was 1.6–2.5) and clears the gap',()=>{
    for(const v of [7,8,9]){
      const r=hatch(v,null,5.75);
      expect(r.apex,`${v} u/s`).toBeGreaterThan(.8);expect(r.apex,`${v} u/s`).toBeLessThan(1.45);
      expect(r.ev.some(e=>e.kind==='bail'),`${v} u/s`).toBe(false);
      // The landing block starts at lx 3.2: the gap (and the planter) is cleared.
      expect(r.landLx,`${v} u/s`).toBeLessThan(3.2);
    }
  });
  it('a 360 flip popped at the lip is caught and lands clean at 8–9 u/s',()=>{
    for(const v of [8,8.5,9]){
      const r=hatch(v,'360-flip',5.75),kinds=r.ev.map(e=>e.kind);
      expect(kinds,`${v} u/s`).toContain('flip-caught');
      expect(kinds,`${v} u/s`).not.toContain('bail');
      expect(r.apex,`${v} u/s`).toBeLessThan(1.45);
    }
  });
});

describe('feel · transitions and stalls (issue 4)',()=>{
  function hob(deg:number,speed:number){
    const sim=rider(-9.7-Math.tan(deg*Math.PI/180)*2.4,1.4,-90+deg,speed);
    let prev=NaN,jump=0;const ev:SkateSimEvent[]=[];let last:SkatePresent=sim.present();
    for(let i=0;i<150;i++){
      const r=sim.step(I(),1/60);ev.push(...r.events);const p=r.present;
      if(p.phase!=='air'&&p.phase!=='bail'&&Number.isFinite(prev)&&p.speed>.3)jump=Math.max(jump,Math.abs(Math.atan2(Math.sin(p.boardYaw-prev),Math.cos(p.boardYaw-prev))));
      prev=p.boardYaw;last={...p};
    }
    return {jump,ev,last};
  }
  it('the board never jumps heading through the Hob at any angle and speed; slow straight climbs roll back fakie',()=>{
    for(const deg of [0,15,30,45,60])for(const v of [3.5,5,6.5,8]){
      const r=hob(deg,v);
      expect(r.jump*180/Math.PI,`${deg}° ${v} u/s`).toBeLessThan(5);
      expect(r.ev.filter(e=>e.kind==='bail').map(e=>e.kind==='bail'?e.reason:''),`${deg}° ${v} u/s`).not.toContain('bad-angle');
    }
    expect(hob(0,5).last.fakie).toBe(true);
    expect(hob(15,5).last.fakie).toBe(true);
  });
});

describe('feel · names on a full line (issue 8)',()=>{
  it('the lab line names Ollie to Backside 50-50, then Kickflip to Manual (a gap on the way does not break the link)',()=>{
    const lab=createLabCore(),score=createSkateScore({catalogs:SKATE_CATALOGS});
    lab.load({local:[-2.4,-3.0,-4],speed:5.4});
    lab.script([{at:10,flick:null},{at:40,auto:'grind',for:60},{at:112,flick:'kickflip'},{at:150,auto:'manual',for:50}]);
    const labels=new Set<string>();let t=0;
    for(const f of lab.step(220)){t+=1/60;score.step(f.events,t);for(const k of score.line().tricks)labels.add(k.label);}
    expect([...labels]).toEqual(expect.arrayContaining(['Ollie to Backside 50-50','Kickflip to Manual']));
  });
});
