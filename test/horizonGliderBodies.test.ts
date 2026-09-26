import {expect,it} from 'vitest';
import {GUST_RADIUS,passThroughBodies,stepWing,type GustEvent,type PassBody,type WingEnv,type WingState} from '../src/harbour/horizon/movers/glider/wing.ts';

// FLIGHT.md §2.2 / §10 row 9: no collisions with people — a body on the flight line is passed through, a gust event
// fires once per body within 3 m, and the wing's motion is never changed by it.
const env:WingEnv={wind:{dir:Math.PI,speed:4},lift:()=>0,ground:()=>0};
const start:WingState={x:0,y:30,z:0,heading:0,bank:0,airspeed:11,vs:0,phase:'flight',stallT:0,t:0};
// Into the 4 m/s south wind the wing makes 7 m/s over the ground at 1.2 m/s sink: y = 30 − 1.2 z / 7 on its line.
const onLine=(z:number)=>30-1.2*z/7;
const bodies:PassBody[]=[{id:'partner',x:0,y:onLine(40)+.5,z:40},{id:'hercules',x:2,y:onLine(60),z:60},{id:'walker',x:9,y:onLine(80),z:80}];

function fly(withBodies:boolean){
  let s=start;const events:GustEvent[]=[],path:WingState[]=[];
  for(let i=0;i<600;i++){
    s=stepWing(s,{bar:0,bank:0},env,1/60);
    if(withBodies){const r=passThroughBodies(s,bodies);events.push(...r.events);s=r.state;}
    path.push(s);
  }
  return{events,path};
}

it('passes through bodies and fires one gust per body within 3 m',()=>{
  expect(GUST_RADIUS).toBe(3);
  const {events}=fly(true);
  expect(events.map(e=>e.bodyId)).toEqual(['partner','hercules']);
  expect(events.every(e=>e.kind==='gust')).toBe(true);
});
it('never changes the wing\'s motion',()=>{
  const a=fly(true).path,b=fly(false).path;
  for(let i=0;i<a.length;i++){
    const {gusts:_g,...left}=a[i]!,{gusts:_h,...right}=b[i]!;
    expect(left).toEqual(right);
  }
  const s={...start,x:0,y:onLine(40),z:40},r=passThroughBodies(s,bodies);
  expect(r.state.airspeed).toBe(s.airspeed);expect(r.state.vs).toBe(s.vs);expect(r.state.heading).toBe(s.heading);expect(r.state.bank).toBe(s.bank);
  expect([r.state.x,r.state.y,r.state.z]).toEqual([s.x,s.y,s.z]);
});
it('re-arms a body only after the wing has left it',()=>{
  let s={...start,z:40,y:onLine(40)+.5};
  const first=passThroughBodies(s,bodies);s=first.state;
  expect(first.events).toHaveLength(1);
  expect(passThroughBodies(s,bodies).events).toHaveLength(0);
  const away=passThroughBodies({...s,z:60,y:40},bodies).state;
  expect(away.gusts).toEqual([]);
  expect(passThroughBodies({...away,z:40,y:onLine(40)},bodies).events).toHaveLength(1);
});
