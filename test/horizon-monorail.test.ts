import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {createHorizonMonorail} from '../src/harbour/horizon/monorail/HorizonMonorail.ts';
import {MOUNTAIN_V2_OFFSET as O} from '../src/harbour/horizon/regions/mountainV2/placement.ts';
import {MONORAIL_STOPS} from '../src/harbour/mountain/definition.ts';
import {sceneDressingFrom} from '../src/harbour/scene/place.ts';
import {COURT_DRESSING} from '../src/harbour/court/dressing.ts';

describe('the original monorail on the Horizon',()=>{
  it('places the train and track in the same translated Mountain region',()=>{
    const scene=new THREE.Scene();
    const ride=createHorizonMonorail(scene,'lite',sceneDressingFrom(COURT_DRESSING.classic));
    expect(scene.children).toContain(ride.group);
    expect(ride.group.position.toArray()).toEqual([O.x,O.y,O.z]);
    const pose=ride.board(0,true);
    expect(pose?.at).toEqual([MONORAIL_STOPS[0]!.at[0]+O.x,MONORAIL_STOPS[0]!.at[1]+O.y,MONORAIL_STOPS[0]!.at[2]+O.z]);
    expect(ride.group.getObjectByName('Monorail track')).toBeTruthy();
    expect(ride.group.getObjectByName('Scene companion')?.visible).toBe(true);
    expect(ride.group.getObjectByName('Monorail door left')?.position.z).toBeCloseTo(-1.08);
    expect(ride.group.getObjectByName('Monorail door right')?.position.z).toBeCloseTo(1.08);
    expect(ride.camera()).toBeTruthy();
    ride.dispose();expect(scene.children).not.toContain(ride.group);
  });

  it('keeps the old station order and permits exit only while doors are open',()=>{
    const ride=createHorizonMonorail(new THREE.Scene(),'lite',sceneDressingFrom(COURT_DRESSING.classic));
    ride.board(0);ride.select(2);ride.select(1);
    expect(ride.state()?.queue).toEqual([1,2]);
    let moving=false,arrived=false;
    for(let i=0;i<3000;i++){
      ride.update(.05);
      const state=ride.state()!;
      if(state.phase==='moving'){moving=true;expect(ride.control('exit')).toBeNull();}
      if(state.station===2&&state.phase==='doors-open'){arrived=true;break;}
    }
    expect(moving).toBe(true);expect(arrived).toBe(true);
    expect(ride.control('exit')).toBeTruthy();expect(ride.state()).toBeNull();
    ride.dispose();
  });
});
