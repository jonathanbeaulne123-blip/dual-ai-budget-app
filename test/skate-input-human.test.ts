/**
 * Flick-it at human speed: a seeded human (test/skate-input-human-model.ts) plays every trick
 * on the keyboard, a gamepad stick and a mouse drag — overlapping keys, curved and overshooting
 * thumbs, big off-axis drags, 60 Hz frames with jitter, both stances, tail and nose loads —
 * through the real input, and the right trick comes out.
 */
import {describe,expect,it} from 'vitest';
import {SKATE_FLIPS} from '../src/harbour/skate/tricks/catalog.ts';
import {createSkateInput} from '../src/harbour/skate/input/index.ts';
import {playHuman,scoreHuman,type HumanDevice} from './skate-input-human-model.ts';

const ALL:(string|null)[]=[null,...SKATE_FLIPS.keys()];
const pct=(a:number,n:number)=>Math.round(1000*a/n)/10;

describe('flick-it · a human model',()=>{
  for(const device of ['keyboard','gamepad','mouse'] as HumanDevice[]){
    it(`${device}: the intended trick lands ≥ 95 %, a wrong one ≤ 2 % (every trick, 80 tries each)`,()=>{
      const s=scoreHuman(device,ALL,80,101);
      const wrong=Object.entries(s.byTrick).filter(([,b])=>b.ok<b.n).map(([k,b])=>`${k} ${b.ok}/${b.n} ${JSON.stringify(b.wrong)}`);
      expect(pct(s.intended,s.n),wrong.join('\n')).toBeGreaterThanOrEqual(95);
      expect(pct(s.wrong,s.n),wrong.join('\n')).toBeLessThanOrEqual(2);
      // The everyday tricks are all but certain.
      for(const id of ['ollie','kickflip','heelflip','pop-shove-it','varial-kickflip','360-flip'])expect(s.byTrick[id]!.ok,`${device} ${id}`).toBeGreaterThanOrEqual(76);
    });
  }
  it('keys and sticks pop the moment the flick lands, however long the key or thumb stays there',()=>{
    for(const device of ['keyboard','gamepad'] as const)for(const id of [null,'kickflip']){
      const lag:number[]=[];
      for(let seed=1;seed<=60;seed++){const r=playHuman({device,flipId:id,origin:'tail',stance:'regular',seed});if(r.pops.length===1)lag.push(r.pops[0]!.at-r.lastMoveAt);}
      lag.sort((a,b)=>a-b);
      // Keys: the chord window (30 ms) plus a frame; before the feel pass this was 180 ms (the release).
      expect(lag[Math.floor(lag.length*.9)]!,`${device} ${id??'ollie'}`).toBeLessThan(device==='keyboard'?70:20);
    }
  });
  it('a double reads as one trick: the pop on the first flick, the upgrade in the air',()=>{
    const r=playHuman({device:'keyboard',flipId:'double-kickflip',origin:'tail',stance:'regular',seed:3});
    expect(r.pops.map(p=>p.flipId)).toEqual(['double-kickflip']);
  });
  it('easy keys stay one press: hold to crouch, let go to pop, and nothing else is needed',()=>{
    for(const [key,id] of [['j',null],['f','kickflip'],['h','heelflip'],['v','pop-shove-it'],['y','varial-kickflip'],['u','360-flip']] as const){
      for(const hold of [16,80,400]){
        const input=createSkateInput({mode:'easy',getGamepads:null});
        const got:(string|null)[]=[];let crouch=0;
        for(let t=1000;t<1000+hold+200;t+=1000/60){
          if(Math.abs(t-1016.67)<1)input.keyDown({key,code:`Key${key.toUpperCase()}`,timeStamp:t});
          if(Math.abs(t-(1016.67+hold))<9)input.keyUp({key,code:`Key${key.toUpperCase()}`,timeStamp:t});
          const i=input.sample(t,false,true);crouch=Math.max(crouch,i.crouch);if(i.pop)got.push(i.pop.flipId);
        }
        expect(got,`${key} held ${hold} ms`).toEqual([id]);
        if(hold>=80)expect(crouch).toBe(1);
      }
    }
  });
});
