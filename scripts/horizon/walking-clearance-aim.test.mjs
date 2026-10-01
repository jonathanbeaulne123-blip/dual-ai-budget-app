import {test}from'node:test';import assert from'node:assert/strict';import{walkingClearanceAim}from'./walking-clearance-aim.mjs';
const pointAt=d=>({x:0,y:0,z:d,heading:0});
const geography={surface:()=>({y:0,slope:0}),waterLevel:()=>null,blocker:()=>null};
const args={position:[0,0,0],progress:0,pointAt,halfWidth:1.25,geography,maxSlope:40};
test('clear original line remains centered',()=>assert.equal(walkingClearanceAim(args).offset,0));
test('ordinary side step clears a narrow post inside the whole body width',()=>{const g={...geography,blocker:(x,z,y,r)=>Math.abs(x+.2)<.16+r&&Math.abs(z-2)<.16+r};const a=walkingClearanceAim({...args,geography:g});assert.ok(a);assert.ok(Math.abs(a.offset)+.3<1.25);assert.ok(a.target.x>.4);});
test('full-width closure, air and steep floor retain no-plan result',()=>{for(const patch of[{blocker:()=>true},{surface:()=>null},{surface:()=>({y:0,slope:41})},{surface:()=>({y:-1,slope:0})}])assert.equal(walkingClearanceAim({...args,geography:{...geography,...patch}}),null);});
test('does not snap an already off-path body back into the corridor',()=>assert.equal(walkingClearanceAim({...args,position:[3,0,0]}),null));
