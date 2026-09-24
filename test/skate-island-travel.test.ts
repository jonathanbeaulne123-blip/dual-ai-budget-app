import {describe,expect,it} from 'vitest';
import type {SkateField} from '../src/harbour/skate/contract.ts';
import {makeSim,ride,intent,kick} from '../src/harbour/skate/sim/testKit.ts';
import {makeField} from '../src/harbour/skate/sim/fields.ts';
import {skateField} from '../src/harbour/skate/driver.ts';
import {groundHeightAt} from '../src/harbour/scene/ground.ts';
import {MOUNTAIN_ROAD,nearestOnRoute} from '../src/harbour/mountain/definition.ts';
import {queryWorldSurface,worldCeilingAt,worldCollisionAt} from '../src/harbour/mountain/surfaces.ts';
import {createSkateCamera} from '../src/harbour/skate/camera/skateCamera.ts';

const grade=.25,ny=1/Math.hypot(1,grade);
const hill:SkateField={
  sample:(_x,z)=>({y:z*grade,nx:0,ny,nz:-grade*ny,kind:'path',feature:'road',lip:null}),
  grindables:[],solids:[],spots:[],
};

describe('island skateboard travel',()=>{
  it('can push up a long hill outside trick zones while a physics-zone hill keeps its gravity',()=>{
    const easy=makeSim(hill,{complexPhysicsAt:()=>false});
    const physics=makeSim(hill,{complexPhysicsAt:()=>true});
    const a=ride(easy,12,intent({push:true})).present;
    const b=ride(physics,12,intent({push:true})).present;
    expect(a.z).toBeGreaterThan(35);
    expect(a.y).toBeGreaterThan(8);
    expect(a.z).toBeGreaterThan(b.z+15);
  });

  it('keeps the invisible trick areas around park pads and mountain skill branches',()=>{
    const field=skateField();
    const pad=field.pads[0]!;
    expect(field.trickZoneAt(pad.frame.x,pad.frame.z)).toBe(true);
    const road=MOUNTAIN_ROAD[Math.floor(MOUNTAIN_ROAD.length*.65)]!;
    expect(field.trickZoneAt(road[0],road[2])).toBe(false);
  });

  it('makes a travel jump forgiving while a trick-zone sideways landing still bails',()=>{
    const flat=makeField({});
    const travel=makeSim(flat,{y:3,yaw:Math.PI/2,complexPhysicsAt:()=>false});
    const trick=makeSim(flat,{y:3,yaw:Math.PI/2,complexPhysicsAt:()=>true});
    kick(travel,{vz:4,vy:-1});kick(trick,{vz:4,vy:-1});
    const easy=ride(travel,1.5,intent()).present;
    const hard=ride(trick,1.5,intent()).present;
    expect(easy.phase).not.toBe('bail');
    expect(easy.vz).toBeGreaterThan(0);
    expect(hard.phase==='bail'||hard.phase==='recover').toBe(true);
  });

  it('keeps a below-road rider and chase eye under the deck',()=>{
    const bridge=MOUNTAIN_ROAD.find(p=>p[1]-groundHeightAt(p[0],p[2])>3);
    expect(bridge).toBeDefined();
    const [x,roadY,z]=bridge!;
    const floor=groundHeightAt(x,z);
    const under=queryWorldSurface({x,z,y:floor},groundHeightAt);
    expect(under.y).toBeLessThan(roadY-1);
    const sim=makeSim(skateField(),{x,z,y:floor,yaw:0,complexPhysicsAt:skateField().trickZoneAt});
    expect(ride(sim,.5,intent()).present.y).toBeLessThan(roadY-1);
    const roof=worldCeilingAt(x,z,floor);
    expect(roof).toBeGreaterThan(floor+1);
    const cam=createSkateCamera({ground:groundHeightAt});
    const present={...makeSim(hill).present(),x,y:floor,z,vx:0,vz:0,heading:0,boardYaw:0};
    cam.snap(present);
    for(let i=0;i<100;i++){
      const frame=cam.update(present,[],1/60,{aspect:390/844,ceilingAt:worldCeilingAt,blocked:(px,py,pz)=>py<groundHeightAt(px,pz)+.05||worldCollisionAt(px,py,pz,.12)});
      expect(frame.position[1]).toBeLessThan(roof-.15);
      expect(Number.isFinite(frame.fov)).toBe(true);
    }
    const topCam=createSkateCamera({ground:groundHeightAt});
    const onTop={...present,y:roadY};
    topCam.snap(onTop);
    for(let i=0;i<100;i++){
      const frame=topCam.update(onTop,[],1/60,{aspect:390/844,ceilingAt:worldCeilingAt,blocked:(px,py,pz)=>py<groundHeightAt(px,pz)+.05||worldCollisionAt(px,py,pz,.12)});
      expect(frame.position[1]).toBeGreaterThan(roadY-.2);
      expect(Number.isFinite(frame.fov)).toBe(true);
    }
    const crossing=createSkateCamera({ground:groundHeightAt});
    let previous:null|{y:number;fov:number}=null;
    for(let i=0;i<=120;i++){
      const px=x-5+i/12,py=groundHeightAt(px,z);
      const rider={...present,x:px,y:py,vx:5,heading:Math.PI/2,boardYaw:Math.PI/2};
      const frame=crossing.update(rider,[],1/60,{aspect:390/844,ceilingAt:worldCeilingAt,blocked:(rx,ry,rz)=>ry<groundHeightAt(rx,rz)+.05||worldCollisionAt(rx,ry,rz,.12)});
      if(previous){expect(Math.abs(frame.position[1]-previous.y)).toBeLessThan(1);expect(Math.abs(frame.fov-previous.fov)).toBeLessThan(8);}
      previous={y:frame.position[1],fov:frame.fov};
    }
    expect(nearestOnRoute(x,z).distance).toBeLessThan(.01);
  });
});
