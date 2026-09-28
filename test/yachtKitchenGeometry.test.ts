import {describe,it,expect} from 'vitest';
import {createFleet,toWorld} from '../src/harbour/horizon/movers/fleet/model.ts';
import {atKitchenBoard,KITCHEN_BOARD,kitchenWalkable,kitchenSightBlocked,moveKitchenChef} from '../src/harbour/horizon/kitchen/geometry.ts';
const make=()=>createFleet({water:()=>0,ground:()=>-30,blocked:()=>false,ceiling:()=>Infinity,surface:()=>null,width:3000,depth:2200});
describe('kitchen uses the physical yacht',()=>{
 it('requires physical galley presence and follows yacht translation and rotation',()=>{const f=make();const b={...toWorld(f.yacht,KITCHEN_BOARD),yaw:0};expect(atKitchenBoard(f,b)).toBe(true);f.yacht.x+=80;f.yacht.yaw=1;expect(atKitchenBoard(f,b)).toBe(false);expect(atKitchenBoard(f,{...toWorld(f.yacht,KITCHEN_BOARD),yaw:1})).toBe(true);});
 it('does not walk into cupboards, stair openings or off railings',()=>{const f=make();expect(kitchenWalkable(f,{x:0,y:3.85,z:-10},false)).toBe(true);expect(kitchenWalkable(f,{x:-4.7,y:3.85,z:-8.8},false)).toBe(false);expect(kitchenWalkable(f,{x:7,y:3.85,z:-10},true)).toBe(false);expect(kitchenWalkable(f,{x:2.5,y:3.85,z:-1.8},false)).toBe(false);});
 it('blocks targets through cabin walls while permitting handoffs over worktops',()=>{const f=make();expect(kitchenSightBlocked(f,{x:-6,y:3.85,z:-8},{x:-3.4,y:3.85,z:-8})).toBe(true);expect(kitchenSightBlocked(f,{x:0,y:3.85,z:-9.6},{x:0,y:3.85,z:-6.8})).toBe(false);});
 it('moves in local coordinates on a rotated yacht without falling through the floor',()=>{const f=make();f.yacht.yaw=1.2;let p={x:0,y:3.85,z:-10.5,yaw:0};for(let i=0;i<60;i++)p=moveKitchenChef(f,p,1,0,1/60,false,[]);expect(p.x).toBeCloseTo(3.2);expect(p.y).toBe(3.85);expect(p.yaw).toBeCloseTo(Math.PI/2);});
});
