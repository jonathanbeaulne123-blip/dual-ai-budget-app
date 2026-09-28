import * as THREE from 'three';
import {describe,expect,it} from 'vitest';
import {createKitchenArt} from '../src/harbour/horizon/kitchen/art.ts';
import {createKitchenEngine} from '../src/harbour/horizon/kitchen/model.ts';
import {stationsFor} from '../src/harbour/horizon/kitchen/config.ts';
import type {ServiceId} from '../src/harbour/horizon/kitchen/types.ts';

function service(id:ServiceId='lunch',players:1|2=1){const engine=createKitchenEngine({canReach:()=>true});engine.open();engine.start(id,players);for(let i=0;i<players;i++)engine.action(i as 0|1,{type:'ready'});return engine;}
function stand(engine:ReturnType<typeof service>,id:string){const station=stationsFor(engine.state()).find(s=>s.id===id)!;engine.setPose(0,{...station.approach,yaw:station.facing});return station;}
describe('Yacht Kitchen art follows authoritative local state',()=>{
  it('keeps chef and held food in the yacht frame as its parent moves and turns',()=>{const engine=service(),art=createKitchenArt('classic'),yacht=new THREE.Group();yacht.add(art.root);stand(engine,'yacht.galley.pantry');engine.action(0,{type:'interact',target:'yacht.galley.pantry',ingredient:'bread'});art.update(engine.state(),stationsFor(engine.state()));const chef=engine.state().chefs[0]!,item=art.root.getObjectByName('kitchen.item.'+chef.held)!;expect(item).toBeTruthy();const local=item.position.clone();yacht.position.set(1620,.1,1340);yacht.rotation.y=.6;yacht.updateMatrixWorld(true);expect(item.getWorldPosition(new THREE.Vector3()).distanceTo(local.clone().applyMatrix4(yacht.matrixWorld))).toBeLessThan(1e-9);expect(art.root.getObjectByName('kitchen.chef.0')!.position.toArray()).toEqual([chef.pose.x,chef.pose.y,chef.pose.z]);art.dispose();});
  it('builds distinct chopped food after real preparation and clears transient contents on exit',()=>{const engine=service(),art=createKitchenArt('taylor');stand(engine,'yacht.galley.cold');engine.action(0,{type:'interact',target:'yacht.galley.cold',ingredient:'tomato'});const id=engine.state().chefs[0]!.held!;art.update(engine.state(),stationsFor(engine.state()));expect(art.root.getObjectByName('kitchen.item.'+id)!.getObjectByName('tomato')).toBeTruthy();stand(engine,'yacht.galley.prep-port');engine.action(0,{type:'interact',target:'yacht.galley.prep-port'});engine.action(0,{type:'prepare',target:'yacht.galley.prep-port'});engine.update(3.1);art.update(engine.state(),stationsFor(engine.state()));const food=art.root.getObjectByName('kitchen.item.'+id)!;expect(food.getObjectByName('chopped-tomato')).toBeTruthy();expect(food.getObjectByName('tomato')).toBeUndefined();engine.exit();art.update(engine.state(),stationsFor(engine.state()));expect(art.root.getObjectByName('kitchen.item.'+id)).toBeUndefined();expect(art.root.getObjectByName('yacht.kitchen.menu-board')!.visible).toBe(true);art.dispose();});
  it('shows the temporary grill only for Sunset and retains earned mementos in exploration',()=>{const engine=createKitchenEngine(),art=createKitchenArt('newfoundland');art.update(engine.state(),[],{}, {unlocks:['galley-sea-glass','sunset-table','captains-memento']});expect(art.root.getObjectByName('yacht.kitchen.deck-grill.kitchen-art')!.visible).toBe(false);for(const name of['galley-sea-glass','sunset-table','captains-memento'])expect(art.root.getObjectByName('reward.'+name)!.visible).toBe(true);engine.start('sunset',1);art.update(engine.state(),stationsFor(engine.state()));expect(art.root.getObjectByName('yacht.kitchen.deck-grill.kitchen-art')!.visible).toBe(true);engine.start('lunch',1);art.update(engine.state(),stationsFor(engine.state()));expect(art.root.getObjectByName('yacht.kitchen.deck-grill.kitchen-art')!.visible).toBe(false);art.dispose();});
  it('hides only the chosen first-person chef and retains the other actual player',()=>{const engine=service('lunch',2),art=createKitchenArt();art.update(engine.state(),stationsFor(engine.state()),{}, {firstPersonChef:0,reducedMotion:true});expect(art.root.getObjectByName('kitchen.chef.0')!.visible).toBe(false);expect(art.root.getObjectByName('kitchen.chef.1')!.visible).toBe(true);art.update(engine.state(),stationsFor(engine.state()));expect(art.root.getObjectByName('kitchen.chef.0')!.visible).toBe(true);art.dispose();expect(art.root.children).toHaveLength(0);});
});

it('reuses toss buffers without uploading unchanged aim and refreshes bounds when aim moves',()=>{
  const engine=service(),art=createKitchenArt(),state=engine.state(),stations=stationsFor(state);
  const target={x:3,y:4,z:-5};art.update(state,stations,{0:target});
  const line=art.root.getObjectByName('chef-toss-preview-0') as THREE.Line;
  const position=line.geometry.getAttribute('position') as THREE.BufferAttribute;
  const distance=line.geometry.getAttribute('lineDistance') as THREE.BufferAttribute;
  const version=position.version,bounds=line.geometry.boundingSphere!.clone();
  art.update(state,stations,{0:{...target}});
  expect(line.geometry.getAttribute('position')).toBe(position);expect(position.version).toBe(version);
  expect(line.geometry.getAttribute('lineDistance')).toBe(distance);
  expect([position.getX(20),position.getY(20),position.getZ(20)]).toEqual([3,4,-5]);
  expect(distance.getX(0)).toBe(0);expect(distance.getX(20)).toBeGreaterThan(0);
  art.update(state,stations,{0:{x:100,y:4,z:-5}});
  expect(position.version).toBe(version+1);expect(position.getX(20)).toBe(100);
  expect(line.geometry.boundingSphere!.radius).toBeGreaterThan(bounds.radius);
  art.dispose();
});
