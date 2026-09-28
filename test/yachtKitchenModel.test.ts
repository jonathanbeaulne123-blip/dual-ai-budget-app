import {describe,expect,it} from 'vitest';
import {createKitchenEngine,itemLabel,stationsFor} from '../src/harbour/horizon/kitchen/model.ts';
import {INGREDIENTS,RECIPES,SERVICES,STATIONS,TROLLEY_SECONDS} from '../src/harbour/horizon/kitchen/config.ts';
import type {ChefId,IngredientId,KitchenAction,KitchenEngine,KitchenItem,RecipeId,ServiceId} from '../src/harbour/horizon/kitchen/types.ts';

const id=(short:string)=>short.startsWith('yacht.')?short:'yacht.galley.'+short;
function at(e:KitchenEngine,station:string,chef:ChefId=0){const st=stationsFor(e.state()).find(s=>s.id===id(station))!;expect(st,station).toBeTruthy();e.setPose(chef,{...st.approach,yaw:st.facing});e.setTarget(chef,st.id);return st;}
function act(e:KitchenEngine,action:KitchenAction={type:'interact'},chef:ChefId=0){const r=e.action(chef,action);expect(r.ok,r.message).toBe(true);return r;}
function start(service:ServiceId='practice',players:1|2=1){const e=createKitchenEngine({seed:721});e.open();e.start(service,players,{forgiveness:3,hazards:true});for(const c of e.state().chefs)act(e,{type:'ready'},c.id);return e;}
function held(e:KitchenEngine,chef:ChefId=0):KitchenItem{return e.state().items[e.state().chefs.find(c=>c.id===chef)!.held!]!;}
function fetchIngredient(e:KitchenEngine,ingredient:IngredientId,chef:ChefId=0){const st=stationsFor(e.state()).find(s=>s.ingredients?.includes(ingredient))!;at(e,st.id,chef);act(e,{type:'interact',ingredient},chef);}
function component(e:KitchenEngine,ingredient:IngredientId,phase:string,chef:ChefId=0){
 fetchIngredient(e,ingredient,chef);const rule=INGREDIENTS[ingredient];
 if(phase==='prepared'||phase==='ready'&&rule.cook?.from==='prepared'){at(e,'prep-port',chef);act(e,undefined,chef);act(e,{type:'prepare'},chef);e.update(rule.prepSeconds);act(e,undefined,chef);}
 if(phase==='ready'){const stove=e.state().service==='sunset'&&rule.cook?.appliance==='grill'?'yacht.kitchen.deck-grill':'hob';at(e,stove,chef);act(e,undefined,chef);e.update(rule.cook!.seconds);act(e,undefined,chef);}
 expect(held(e,chef).phase).toBe(phase);at(e,'plate',chef);act(e,undefined,chef);
}
function dish(e:KitchenEngine,recipe:RecipeId,chef:ChefId=0){for(const c of RECIPES[recipe].components)component(e,c.ingredient,c.phase,chef);at(e,'plate',chef);act(e,undefined,chef);expect(itemLabel(held(e,chef),e.state())).toBe(RECIPES[recipe].label);}
function deliver(e:KitchenEngine,chef:ChefId=0){
 if(e.state().service==='banquet'){
  at(e,'yacht.kitchen.trolley',chef);
  if(e.state().trolley.dock===1){act(e,{type:'prepare'},chef);e.update(TROLLEY_SECONDS);at(e,'yacht.kitchen.trolley',chef);act(e,{type:'prepare'},chef);}
  act(e,undefined,chef);act(e,{type:'prepare'},chef);e.update(TROLLEY_SECONDS);at(e,'yacht.kitchen.trolley',chef);act(e,{type:'prepare'},chef);
 }else{at(e,e.state().service==='sunset'?'yacht.kitchen.deck-pass':'serve',chef);act(e,undefined,chef);}
}
function wash(e:KitchenEngine,chef:ChefId=0){e.update(6);at(e,'return',chef);act(e,undefined,chef);expect(held(e,chef).dirty).toBe(true);at(e,'wash',chef);act(e,undefined,chef);act(e,{type:'prepare'},chef);e.update(3);}
function ensureOwnership(e:KitchenEngine){const s=e.state(),heldIds=s.chefs.map(c=>c.held).filter(Boolean);expect(new Set(heldIds).size).toBe(heldIds.length);for(const item of Object.values(s.items)){if(item.location.kind==='hands')expect(s.chefs.find(c=>c.id===(item.location as {chef:ChefId}).chef)?.held).toBe(item.id);if(item.location.kind==='container')expect(s.items[item.location.container]?.contents).toContain(item.id);}}

describe('five configured dishes and complete services',()=>{
 it('makes and delivers every recipe through public interactions, including recycling its plate',()=>{
  const e=start(),seen=new Set<RecipeId>();let delivered=0;
  while(seen.size<5&&delivered<40){const order=e.state().orders.find(o=>o.status==='waiting')!;dish(e,order.recipe);deliver(e);seen.add(order.recipe);wash(e);ensureOwnership(e);delivered++;}
  expect([...seen].sort()).toEqual(Object.keys(RECIPES).sort());expect(e.state().served).toBe(delivered);expect(Object.values(e.state().items).filter(i=>i.kind==='plate')).toHaveLength(3);expect(e.state().orders.filter(o=>o.status==='missed')).toHaveLength(0);
 });
 for(const players of[1,2] as const)for(const service of Object.keys(SERVICES) as ServiceId[])it(`${service}: ${players} chefs complete actual dishes, wash and reach results`,()=>{
  const e=start(service,players);let count=0;
  while(e.state().phase==='playing'&&count<(service==='first'?1:3)){
   const order=e.state().orders.find(o=>o.status==='waiting')!;const chef=(players===2?count%2:0) as ChefId;dish(e,order.recipe,chef);deliver(e,chef);wash(e,chef);ensureOwnership(e);count++;
  }
  if(service==='practice')act(e,{type:'ready'});else if(e.state().phase==='playing')e.update(e.state().remaining+1);
  expect(e.state().phase).toBe('results');expect(e.state().result?.served).toBeGreaterThan(0);expect(e.state().result?.players).toBe(players);expect(e.state().result?.score).toBeGreaterThan(0);expect(e.state().result?.recipes.length).toBeGreaterThan(0);
  const result=structuredClone(e.state().result),snapshot=e.snapshot();e.update(600);expect(e.action(0,{type:'ready'}).ok).toBe(false);expect(e.state().result).toEqual(result);expect(e.restore(snapshot)).toBe(true);expect(e.state().phase).toBe('results');expect(e.state().result).toEqual(result);
 });
 it('First Service requires both delivery and a real wash before finishing',()=>{const e=start('first');dish(e,'bruschetta');expect(e.state().tutorial).toBe(4);deliver(e);expect(e.state().phase).toBe('playing');expect(e.state().tutorial).toBe(5);wash(e);expect(e.state().tutorial).toBe(6);expect(e.state().phase).toBe('results');});
 it('Sunset rejects indoor service, uses the real deck stations and keeps the dish',()=>{const e=start('sunset');dish(e,'fish');const plate=held(e).id;at(e,'serve');expect(e.action(0,{type:'interact'}).ok).toBe(false);expect(held(e).id).toBe(plate);deliver(e);expect(e.state().served).toBe(1);});
 it('Banquet trolley waits at marked docks, preserves contents and only serves when secured',()=>{const e=start('banquet');dish(e,e.state().orders[0]!.recipe);at(e,'yacht.kitchen.trolley');act(e);act(e,{type:'prepare'});e.update(5);expect(e.state().served).toBe(0);const moving=stationsFor(e.state()).find(s=>s.kind==='trolley')!;expect(moving.at.x).toBeCloseTo(0);at(e,moving.id);expect(e.action(0,{type:'interact'}).ok).toBe(false);e.update(20);expect(e.state().trolley.progress).toBe(1);expect(e.state().served).toBe(0);at(e,moving.id);act(e,{type:'prepare'});expect(e.state().trolley.dock).toBe(1);expect(e.state().served).toBe(1);});
});

describe('recoverable preparation, cooking, mistakes and ownership',()=>{
 it('continues cooking unattended and recovers from burn and contained fire',()=>{
  const e=start();fetchIngredient(e,'bread');at(e,'hob');act(e);const food=Object.values(e.state().items).find(i=>i.ingredient==='bread')!;at(e,'pantry');e.update(7);expect(food.phase).toBe('ready');e.update(17*3+8);expect(food.phase).toBe('burnt');expect(e.state().fires[id('hob')]).toBe(1);
  at(e,'hob');expect(e.action(0,{type:'interact'}).ok).toBe(false);at(e,'yacht.kitchen.extinguisher');act(e);at(e,'hob');act(e,{type:'prepare'});e.update(2);expect(e.state().fires[id('hob')]).toBeUndefined();at(e,'yacht.kitchen.extinguisher');act(e);at(e,'hob');act(e);at(e,'waste');act(e);expect(food.location.kind).toBe('discarded');fetchIngredient(e,'bread');at(e,'hob');act(e);e.update(7);act(e);expect(held(e).phase).toBe('ready');
 });
 it('preserves partial chopping with hold controls and while walking away',()=>{
  const e=createKitchenEngine();e.start('practice',1,{prep:'hold'});act(e,{type:'ready'});fetchIngredient(e,'tomato');at(e,'prep-port');act(e);act(e,{type:'prepare'});e.update(1);const tomato=Object.values(e.state().items).find(i=>i.ingredient==='tomato')!;expect(tomato.progress).toBe(1);e.setPreparing(0,false);e.update(5);expect(tomato.progress).toBe(1);act(e,{type:'prepare'});at(e,'pantry');e.update(1);expect(tomato.progress).toBe(1);at(e,'prep-port');act(e,{type:'prepare'});e.update(2);expect(tomato.phase).toBe('prepared');
 });
 it('keeps a station selection locally so cycling storage never selects an unrelated empty plate',()=>{
  const e=start();at(e,'cold');act(e,{type:'cycle'});act(e);expect(held(e).ingredient).toBe('lettuce');
  at(e,'prep-port');act(e);act(e,{type:'prepare'});e.update(3);act(e);at(e,'plate');act(e);
  component(e,'tomato','prepared');at(e,'plate');act(e);expect(itemLabel(held(e),e.state())).toBe('Garden salad');
 });
 it('requires each banquet delivery to ride the trolley from loading dock to service dock',()=>{
  const e=start('banquet');dish(e,e.state().orders[0]!.recipe);deliver(e);wash(e);expect(e.state().trolley.dock).toBe(1);
  const order=e.state().orders.find(o=>o.status==='waiting')!;dish(e,order.recipe);at(e,'yacht.kitchen.trolley');const plate=held(e).id,served=e.state().served;
  expect(e.action(0,{type:'interact'}).ok).toBe(false);expect(held(e).id).toBe(plate);expect(e.state().served).toBe(served);
  deliver(e);expect(e.state().served).toBe(served+1);expect(e.state().trolley.dock).toBe(1);ensureOwnership(e);
 });
 it('does not consume incorrect ingredients or incomplete deliveries and recycles discarded plates',()=>{
  const e=start();fetchIngredient(e,'bread');at(e,'plate');expect(e.action(0,{type:'interact'}).ok).toBe(false);expect(held(e).ingredient).toBe('bread');at(e,'waste');act(e);at(e,'plate');act(e);const plate=held(e);at(e,'serve');expect(e.action(0,{type:'interact'}).ok).toBe(false);expect(held(e).id).toBe(plate.id);at(e,'waste');act(e);e.update(3);at(e,'return');act(e);at(e,'wash');act(e);act(e,{type:'prepare'});e.update(3);expect(plate.dirty).toBe(false);expect(Object.values(e.state().items).filter(i=>i.kind==='plate')).toHaveLength(3);
 });
 it('two chefs cannot pick up or prepare the same item twice',()=>{
  const e=start('practice',2);fetchIngredient(e,'tomato');at(e,'prep-port');act(e);at(e,'prep-port',1);act(e,{type:'prepare'},0);expect(e.action(1,{type:'prepare'}).ok).toBe(false);e.update(3);act(e,undefined,0);expect(e.action(1,{type:'interact'}).ok).toBe(false);ensureOwnership(e);expect(e.state().chefs[1]!.held).toBeNull();
 });
 it('hands off once and rejects remote, blocked, hot and occupied toss targets',()=>{
  const e=start('practice',2);fetchIngredient(e,'tomato');e.setPose(0,{x:0,y:3.85,z:-10,yaw:0});e.setPose(1,{x:0,y:3.85,z:-8,yaw:Math.PI});const to={chef:1 as const,point:{x:0,y:4.75,z:-8}};act(e,{type:'toss',to});expect(e.action(0,{type:'toss',to}).ok).toBe(false);e.update(.5);expect(held(e,1).ingredient).toBe('tomato');ensureOwnership(e);
  fetchIngredient(e,'lettuce');expect(e.action(0,{type:'toss',to}).ok).toBe(false);expect(e.action(0,{type:'toss',to:{station:id('prep-port'),point:{x:999,y:3.85,z:999}}}).ok).toBe(false);
 });
 it('validates station reach, facing and collision callback for all meaningful actions',()=>{
  const e=createKitchenEngine({canReach:()=>false});e.start('practice',1);act(e,{type:'ready'});at(e,'pantry');expect(e.action(0,{type:'interact',ingredient:'bread'}).ok).toBe(false);expect(Object.values(e.state().items).filter(i=>i.kind==='ingredient')).toHaveLength(0);
  const local=start();at(local,'pantry');local.setPose(0,{...local.state().chefs[0]!.pose,yaw:Math.PI/2});expect(local.action(0,{type:'interact'}).ok).toBe(false);local.setPose(0,{x:0,y:3.85,z:8,yaw:0});expect(local.action(0,{type:'prepare',target:id('prep-port')}).ok).toBe(false);
 });
 it('rescues held items on disconnect and supports finishing alone without advancing paused clocks',()=>{
  const e=start('practice',2);fetchIngredient(e,'tomato',1);const item=held(e,1).id;e.disconnect(1);expect(e.state().phase).toBe('paused');expect(e.state().items[item]!.location.kind).toBe('return');const paused=e.snapshot();e.update(100);expect(e.snapshot()).toEqual(paused);e.leaveChef(1);expect(e.state().players).toBe(1);e.resume();e.update(.05);at(e,'return');act(e);expect(held(e).id).toBe(item);ensureOwnership(e);
 });
});

describe('deterministic time, paused restoration and capacity-aware orders',()=>{
 it('warns once when an order reaches its final quarter, without counting paused time',()=>{
  const e=createKitchenEngine({seed:1500});e.start('lunch',1,{patience:.5});act(e,{type:'ready'});const order=e.state().orders[0]!;
  expect(order.recipe).toBe('pasta');const message=`${RECIPES[order.recipe].label}: the order has a quarter of its patience left.`;
  const warnings=()=>e.state().events.filter(event=>event.kind==='warning'&&event.message===message);
  e.update(order.total*.75-.05);expect(warnings()).toHaveLength(0);e.pause();const remaining=order.remaining;e.update(60);expect(order.remaining).toBe(remaining);expect(warnings()).toHaveLength(0);
  e.resume();e.update(.05);expect(warnings()).toHaveLength(1);e.pause();e.update(60);e.resume();e.update(5);expect(warnings()).toHaveLength(1);
 });
 it('warns once at thirty service seconds and does not replay the cue after paused restoration',()=>{
  const e=start('lunch'),message='30 seconds left in this service. Finish the plates already underway.';
  const warnings=(engine:KitchenEngine)=>engine.state().events.filter(event=>event.kind==='warning'&&event.message===message);
  e.update(SERVICES.lunch.seconds-30-.05);expect(warnings(e)).toHaveLength(0);e.pause();e.update(600);expect(warnings(e)).toHaveLength(0);e.resume();e.update(.05);expect(warnings(e)).toHaveLength(1);
  const restored=createKitchenEngine();expect(restored.restore(e.snapshot())).toBe(true);restored.update(600);expect(warnings(restored)).toHaveLength(1);restored.resume();restored.update(1);expect(warnings(restored)).toHaveLength(1);
 });
 it('uses the same sequence and progress at 20, 30, 60 and 120 updates per second',()=>{
  const run=(fps:number)=>{const e=start('lunch');fetchIngredient(e,'bread');at(e,'hob');act(e);for(let i=0;i<60*fps;i++)e.update(1/fps);return e.snapshot();};const expected=run(20);for(const fps of[30,60,120])expect(run(fps)).toEqual(expected);
 });
 it('does not oversubscribe appliance demand, and practice orders never expire',()=>{
  for(const service of Object.keys(SERVICES) as ServiceId[]){const e=start(service,2);for(let i=0;i<30&&e.state().phase==='playing';i++){e.update(10);const capacity=stationsFor(e.state()).filter(s=>s.kind==='appliance').reduce((n,s)=>n+s.capacity,0),demand=e.state().orders.filter(o=>o.status==='waiting').reduce((n,o)=>n+RECIPES[o.recipe].components.filter(c=>c.phase==='ready').length,0);expect(demand).toBeLessThanOrEqual(capacity);}}
  const e=start();e.update(600);expect(e.state().orders.every(o=>o.status==='waiting'&&o.remaining===0)).toBe(true);expect(e.state().missed).toBe(0);
 });
 it('reserves the specific outdoor grill capacity rather than counting unavailable indoor hob slots',()=>{
  for(let seed=1;seed<=25;seed++){const e=createKitchenEngine({seed});e.start('sunset',2);act(e,{type:'ready'},0);act(e,{type:'ready'},1);e.update(96);const grill=e.state().orders.filter(o=>o.status==='waiting').flatMap(o=>RECIPES[o.recipe].components).filter(c=>c.phase==='ready'&&INGREDIENTS[c.ingredient].cook?.appliance==='grill');expect(grill.length,`seed ${seed}`).toBeLessThanOrEqual(2);}
 });
 it('restores unfinished work paused and never applies time spent away',()=>{
  const e=start();fetchIngredient(e,'bread');at(e,'hob');act(e);e.update(3);const saved=e.snapshot(),other=createKitchenEngine();expect(other.restore(saved)).toBe(true);expect(other.state().phase).toBe('paused');other.update(600);expect(other.state().elapsed).toBe(saved.elapsed);other.resume();other.update(4);expect(Object.values(other.state().items).find(i=>i.ingredient==='bread')?.phase).toBe('ready');
 });
 it('rejects corrupt ownership, inventory, timers, recipes and results atomically',()=>{
  const e=start();fetchIngredient(e,'tomato');const saved=e.snapshot(),before=e.snapshot();
  const mutations:((s:ReturnType<KitchenEngine['snapshot']>)=>void)[]=[s=>{s.elapsed=NaN;},s=>{s.chefs[0]!.held='missing';},s=>{s.items[s.chefs[0]!.held!]!.location={kind:'container',container:'missing'};},s=>{s.stationIds.push('invented');},s=>{s.orders[0]!.recipe='invented' as RecipeId;},s=>{s.items['item-999']={...Object.values(s.items)[0]!,id:'item-999'};},s=>{delete s.items[Object.values(s.items).find(i=>i.kind==='plate')!.id];},s=>{Object.values(s.items).find(i=>i.kind==='plate')!.location={kind:'discarded'};},s=>{s.served=99;},s=>{s.phase='results';s.result=null;}];
  for(const mutate of mutations){const invalid=structuredClone(saved);mutate(invalid);expect(e.restore(invalid)).toBe(false);expect(e.snapshot()).toEqual(before);}
 });
 it('restart and exit remove temporary kitchen objects without carrying old tasks',()=>{const e=start();fetchIngredient(e,'tomato');at(e,'prep-port');act(e);act(e,{type:'prepare'});e.update(1);e.exit();expect(e.state().phase).toBe('idle');expect(Object.values(e.state().items)).toHaveLength(0);e.start('lunch',1);expect(e.state().phase).toBe('ready');expect(e.state().chefs[0]!.task).toBeNull();expect(Object.values(e.state().items).filter(i=>i.kind==='plate')).toHaveLength(3);});
 it('station identities reuse every existing galley fitting',()=>{for(const station of STATIONS.filter(s=>s.id.startsWith('yacht.galley.')))expect(station.at.y).toBe(3.85);expect(STATIONS.filter(s=>s.id.startsWith('yacht.galley.'))).toHaveLength(10);});
});
