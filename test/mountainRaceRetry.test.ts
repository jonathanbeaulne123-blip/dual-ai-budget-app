import {expect,it} from 'vitest';
import {MOUNTAIN_GATES} from '../src/harbour/mountain/race.ts';
import {createSkateDriver} from '../src/harbour/skate/driver.ts';
import {SKATE_NO_INTENT} from '../src/harbour/skate/contract.ts';

it('restarts at the first gate with a fresh countdown from every race state',()=>{
  let keyRetry=false;
  const driver=createSkateDriver({obstacles:[]},{intent:()=>({...SKATE_NO_INTENT,respawn:keyRetry})});
  driver.mount(0,0,0);driver.route('mountain-descent');
  const first=MOUNTAIN_GATES[0]!.at;
  const expectFresh=()=>{
    expect(driver.run()).toMatchObject({id:'mountain-descent',checkpoint:1,elapsed:0,finished:false});
    expect(driver.run()!.countdown).toBeGreaterThan(2.9);
    expect(driver.present()).toMatchObject({x:first[0],z:first[2]});
  };
  driver.step(.5);keyRetry=true;driver.step(1/60);keyRetry=false;expectFresh();
  for(const state of [{checkpoint:0,countdown:0,elapsed:4,finished:false},{checkpoint:6,countdown:0,elapsed:21,finished:false},{checkpoint:16,countdown:0,elapsed:75,finished:true}]){
    const cp=driver.checkpoint()!;cp.session.run={...cp.session.run!,...state};
    driver.restore(cp);driver.pause(false);driver.command('retry');expectFresh();
  }
  driver.unmount();
});
