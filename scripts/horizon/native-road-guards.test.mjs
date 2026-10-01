import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nativeRoadGuardOwnership} from './native-road-guards.mjs';
const line={id:'mountain-road',samples:[0,1,2].map(z=>({at:[0,10,z],normal:[1,0,0],halfWidth:4}))};
const run={id:'mountain-road:left:parapet:0',line:'mountain-road',side:'left',kind:'parapet',points:[[4,10,0],[4,10,1],[4,10,2]]};
const solid={id:run.id+':0',a:[4,0],b:[4,2],bottom:9.8,top:11.1,thickness:.3};
const offset={x:1308,y:54,z:764},p={x:1308,y:64,z:765,tx:0,tz:1},id='mountainV2:'+solid.id;
const make=(s=solid,r=run)=>nativeRoadGuardOwnership({solids:[s],runs:[r],line,offset});
test('same road, station, elevation and edge guard is owned',()=>assert.equal(make()(id,p,4),true));
test('adjacent elevation remains reportable',()=>assert.equal(make()(id,{...p,y:p.y+1},4),false));
test('another station on same road remains reportable',()=>assert.equal(make()(id,{...p,z:p.z+8},4),false));
test('a physical guard inside a wider carriageway remains reportable',()=>assert.equal(make()(id,p,5),false));
test('moved collision cannot inherit old source ownership',()=>assert.equal(make({...solid,a:[3,0],b:[3,2]})(id,p,4),false));
test('widened guard intrusion remains reportable',()=>assert.equal(make({...solid,thickness:2})(id,p,4),false));
test('Orchard guards do not inherit Mountain Road ownership',()=>assert.equal(make(solid,{...run,line:'orchard-lane'})(id,p,4),false));
test('unknown dynamic objects remain reportable',()=>assert.equal(make()('mountainV2:tree',p,4),false));

const capLine={id:line.id,samples:[-1,0,1,2,3].map(z=>({at:[0,10,z],normal:[1,0,0],halfWidth:4}))};
const capOwn=(l=capLine,s=solid,r=run)=>nativeRoadGuardOwnership({solids:[s],runs:[r],line:l,offset});
test('verified endpoint caps use the caller physical contact radius',()=>{
  const before={...p,z:offset.z-.3};
  assert.equal(capOwn()(id,before,4),false);
  assert.equal(capOwn()(id,before,4,.1),false);
  assert.equal(capOwn()(id,before,4,.2),true);
  assert.equal(capOwn()(id,{...p,z:offset.z+2.3},4,.2),true);
});
test('endpoint ownership rejects another station, another level and a physical intrusion',()=>{
  const before={...p,z:offset.z-.3};
  assert.equal(capOwn()(id,{...before,y:before.y+.11},4,.5),false);
  assert.equal(capOwn()(id,{...before,z:offset.z-1.1},4,.5),false);
  assert.equal(capOwn()(id,before,4.75,.5),false);
  assert.equal(capOwn(capLine,{...solid,a:[3.25,0],b:[3.25,2]})(id,before,4,.5),false);
});
test('an authored 4.25m guard remains an intrusion in a 4.8m carriageway',()=>{
  const l={...capLine,samples:capLine.samples.map(s=>({...s,halfWidth:4.25}))};
  const r={...run,points:run.points.map(p=>[4.25,p[1],p[2]])},s={...solid,a:[4.25,0],b:[4.25,2]};
  assert.equal(capOwn(l,s,r)(id,{...p,z:offset.z-.3},4.8,.5),false);
});
