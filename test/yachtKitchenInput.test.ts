import {describe,expect,it} from 'vitest';
import {createKitchenInput,selectKitchenTarget,selectTossTarget} from '../src/harbour/horizon/kitchen/input.ts';
import {createKitchenEngine,stationsFor} from '../src/harbour/horizon/kitchen/model.ts';
import type {PadLike} from '../src/harbour/skate/input/gamepad.ts';
import type {ChefState,KitchenItem,KitchenStation} from '../src/harbour/horizon/kitchen/types.ts';

function pad(index:number,x=0,y=0):PadLike{return {index,connected:true,mapping:'standard',axes:[x,y],buttons:Array.from({length:16},()=>({pressed:false,value:0}))};}
function button(p:PadLike,id:number,pressed=true){Object.assign(p.buttons[id]!,{pressed,value:pressed?1:0});}
const chef=(id:0|1,x=0,z=0):ChefState=>({id,label:`Chef ${id+1}`,pose:{x,y:0,z,yaw:0},held:null,target:null,selection:0,task:null,connected:true,ready:false});
const station=(id:string,x=0,z=1):KitchenStation=>({id,label:id,kind:'counter',at:{x,y:0,z:z+.5},approach:{x,y:0,z},surface:{x,y:.9,z:z+.5},facing:0,capacity:1,area:'galley'});
const ingredient=(owner:0|1=0):KitchenItem=>({id:'tomato-1',kind:'ingredient',ingredient:'tomato',phase:'raw',progress:0,cookElapsed:0,contents:[],dirty:false,location:{kind:'hands',chef:owner}});

describe('independent kitchen controls',()=>{
  it('supports keyboard plus controller without sharing movement or action edges',()=>{
    const p=pad(0,-1,0),input=createKitchenInput({getGamepads:()=>[p]});input.sample(2);
    input.keyDown({key:'W'});input.keyDown({key:'E'});button(p,2);
    const first=input.sample(2);
    expect(first.connections.map(c=>c.kind)).toEqual(['keyboard','gamepad']);
    expect(first.chefs[0]).toMatchObject({x:0,z:1,interact:true,prepare:false});
    expect(first.chefs[1]).toMatchObject({x:-1,z:0,interact:false,prepare:true,prepareHeld:true});
    expect(input.sample(2).chefs.map(c=>[c.interact,c.prepare,c.prepareHeld])).toEqual([[false,false,false],[false,false,true]]);
  });

  it('maps two pads independently and keeps identities when the first disconnects or the array compacts',()=>{
    const a=pad(0,1),b=pad(1,-1);let list:Array<PadLike|null>=[a,b];
    const input=createKitchenInput({getGamepads:()=>list});input.sample(2);button(a,0);button(b,1);
    expect(input.sample(2).chefs.map(c=>[c.x,c.interact,c.toss])).toEqual([[1,true,false],[-1,false,true]]);
    list=[b];
    const lost=input.sample(2);expect(lost.disconnected).toEqual([0]);expect(lost.connections[0]?.connected).toBe(false);expect(lost.chefs[0].x).toBe(0);expect(lost.chefs[1].x).toBe(-1);
    expect(input.sample(2).disconnected).toEqual([]);
    list=[a,b];expect(input.sample(2).chefs[0].interact).toBe(false);expect(input.sample(2).chefs[0].interact).toBe(false);
    button(a,0,false);input.sample(2);button(a,0);expect(input.sample(2).chefs[0].interact).toBe(true);
  });

  it('keeps an existing chef 2 pad assigned when a second pad joins later',()=>{
    const a=pad(0,1),b=pad(2,-1);let list=[a];const input=createKitchenInput({getGamepads:()=>list});
    expect(input.sample(2).chefs.map(c=>c.x)).toEqual([0,1]);
    list=[a,b];const joined=input.sample(2);expect(joined.chefs.map(c=>c.x)).toEqual([-1,1]);
    expect(joined.connections.map(c=>c.label)).toEqual(['Controller 3','Controller 1']);
  });

  it('ignores repeated keys, normalizes diagonal motion, and separates held preparation from its edge',()=>{
    const input=createKitchenInput({getGamepads:()=>[]});
    input.keyDown({key:'f'});input.keyDown({key:'f',repeat:true});input.keyDown({key:'w'});input.keyDown({key:'d'});
    const value=input.sample(1).chefs[0];expect(value.prepare).toBe(true);expect(value.prepareHeld).toBe(true);expect(Math.hypot(value.x,value.z)).toBeCloseTo(1);
    input.keyDown({key:'f',repeat:true});expect(input.sample(1).chefs[0].prepare).toBe(false);
    input.keyUp({key:'f'});expect(input.sample(1).chefs[0].prepareHeld).toBe(false);
    input.keyDown({key:'f'});expect(input.sample(1).chefs[0].prepare).toBe(true);
    expect(input.keyDown({key:'c'})).toBe(false);
  });

  it('exposes actual keyboard and controller actions including context-routed Start',()=>{
    const input=createKitchenInput({getGamepads:()=>[]});
    for(const [key,action] of [['e','interact'],['f','prepare'],['r','toss'],['q','cycle'],['Enter','ready'],['Escape','pause']] as const){
      input.keyDown({key});expect(input.sample(1).chefs[0][action]).toBe(true);input.keyUp({key});
    }
    const p=pad(0),controller=createKitchenInput({getGamepads:()=>[p]});controller.sample(1);button(p,9);
    expect(controller.sample(1).chefs[0]).toMatchObject({ready:true,pause:true});
  });

  it('clears touch and keyboard state on pause and resyncs held controller edges',()=>{
    const p=pad(0),input=createKitchenInput({getGamepads:()=>[p]});input.sample(2);
    input.keyDown({key:'e'});input.touch(1,{x:.5,prepareHeld:true});button(p,0);
    expect(input.sample(2).chefs[1]).toMatchObject({x:.5,prepare:true,prepareHeld:true,interact:true});
    input.resync();input.keyDown({key:'e',repeat:true});
    const clean=input.sample(2);expect(clean.chefs[0].interact).toBe(false);expect(clean.chefs[1]).toMatchObject({x:0,prepare:false,prepareHeld:false,interact:false});
    input.keyUp({key:'e'});input.keyDown({key:'e'});expect(input.sample(2).chefs[0].interact).toBe(true);
    input.clear();input.keyDown({key:'e'});expect(input.sample(2).chefs[0].interact).toBe(true); // keyup while blurred was not delivered
    input.touch(1,{toss:true});input.touch(1,{toss:false});expect(input.sample(2).chefs[1].toss).toBe(true);expect(input.sample(2).chefs[1].toss).toBe(false);
    input.dispose();expect(input.keyDown({key:'e'})).toBe(false);expect(input.sample(2).chefs.every(c=>Object.values(c).every(v=>v===0||v===false))).toBe(true);
  });

  it('treats denied pad reads as a released disconnect and filters invalid stick values',()=>{
    const p=pad(0,NaN,.1);let denied=false;const input=createKitchenInput({getGamepads:()=>{if(denied)throw new Error('denied');return [p];}});
    expect(input.sample(1).chefs[0]).toMatchObject({x:0,z:0});denied=true;
    expect(input.sample(1).disconnected).toEqual([0]);expect(input.sample(1).chefs[0].prepareHeld).toBe(false);
  });

  it('accepts repeated UI tap events and keeps touch preparation held until its own release',()=>{
    const input=createKitchenInput({getGamepads:()=>[]});
    for(const action of ['interact','prepare','toss','cycle'] as const){
      input.touch(0,{[action]:true});expect(input.sample(1).chefs[0][action]).toBe(true);
      expect(input.sample(1).chefs[0][action]).toBe(false);
      input.touch(0,{[action]:true});expect(input.sample(1).chefs[0][action]).toBe(true);
    }
    input.touch(0,{prepareHeld:true});expect(input.sample(1).chefs[0]).toMatchObject({prepare:true,prepareHeld:true});
    input.touch(0,{prepareHeld:true});expect(input.sample(1).chefs[0]).toMatchObject({prepare:false,prepareHeld:true});
    input.touch(0,{x:.5});expect(input.sample(1).chefs[0].prepareHeld).toBe(true);
    input.touch(0,{prepareHeld:false});expect(input.sample(1).chefs[0].prepareHeld).toBe(false);
  });
});

describe('kitchen target selection',()=>{
  it('uses approach range, facing, deck height and wall line of sight',()=>{
    const pose=chef(0).pose,front=station('front'),behind=station('behind',0,-1),upper=station('upper');upper.approach.y=3;
    expect(selectKitchenTarget(pose,[behind,upper,front],()=>false)?.id).toBe('front');
    const wall=(from:{z:number},to:{z:number})=>from.z<.5&&to.z>.5;
    expect(selectKitchenTarget(pose,[front],wall)).toBeNull();
    expect(selectKitchenTarget(pose,[station('far',0,2)],()=>false)).toBeNull();
    expect(selectKitchenTarget({...pose,yaw:Math.PI},[front],()=>false,'front')).toBeNull();
  });

  it('keeps a close previous target steady but releases it immediately behind a wall',()=>{
    const left=station('left',-.15,1),right=station('right',.15,1),pose={...chef(0).pose,x:.03};
    expect(selectKitchenTarget(pose,[left,right],()=>false)?.id).toBe('right');
    expect(selectKitchenTarget(pose,[left,right],()=>false,'left')?.id).toBe('left');
    expect(selectKitchenTarget(pose,[left,right],(_from,to)=>to.x<0,'left')?.id).toBe('right');
  });

  it('tosses a loose ingredient to a counter or empty-handed teammate through a clear path',()=>{
    const player=chef(0),other=chef(1,0,2),item=ingredient();player.held=item.id;
    expect(selectTossTarget(player,item,[station('counter',0,2.5)],[player,other],()=>false)).toMatchObject({chef:1,point:{x:0,y:.9,z:2}});
    other.held='plate';expect(selectTossTarget(player,item,[station('counter',0,2.5)],[player,other],()=>false)?.station).toBe('counter');
    expect(selectTossTarget(player,item,[station('counter',0,2.5)],[player,other],()=>true)).toBeNull();
    expect(selectTossTarget({...player,pose:{...player.pose,yaw:Math.PI}},item,[station('counter',0,2.5)],[player,other],()=>false)).toBeNull();
  });

  it('never tosses hot food, cookware, assembled dishes or another chef’s held item',()=>{
    const player=chef(0),dest=[station('counter')];
    for(const item of [{...ingredient(),phase:'ready' as const},{...ingredient(),kind:'plate' as const},{...ingredient(),contents:['filling']},ingredient(1)])expect(selectTossTarget(player,item,dest,[],()=>false)).toBeNull();
  });

  it('offers empty prep counters and only compatible appliances, excluding occupied or reserved destinations',()=>{
    const player=chef(0),item=ingredient(),prep={...station('prep'),kind:'prep' as const},hob={...station('hob'),kind:'appliance' as const,appliances:['sauce']};
    expect(selectTossTarget(player,item,[prep],[],()=>false)?.station).toBe('prep');
    expect(selectTossTarget(player,item,[hob],[],()=>false)).toBeNull();
    expect(selectTossTarget(player,{...item,phase:'prepared'},[hob],[],()=>false)?.station).toBe('hob');
    const occupied:KitchenItem={...ingredient(),id:'already-there',location:{kind:'station',station:'prep',slot:0}};
    expect(selectTossTarget(player,item,[prep],[],()=>false,null,{occupied})).toBeNull();
    occupied.location={kind:'transit',from:player.pose,to:prep.surface,remaining:.2,station:'prep'};
    expect(selectTossTarget(player,item,[prep],[],()=>false,null,{occupied})).toBeNull();
    occupied.location={kind:'transit',from:player.pose,to:{x:0,y:.9,z:2},remaining:.2,chef:1};
    expect(selectTossTarget(player,item,[],[chef(1,0,2)],()=>false,null,{occupied})).toBeNull();
  });

  it('passes actual configured prep-counter and teammate targets through the engine without changing their height',()=>{
    const engine=createKitchenEngine({seed:42});engine.start('practice',2);engine.action(0,{type:'ready'});engine.action(1,{type:'ready'});
    const state=engine.state(),stations=stationsFor(state),store=stations.find(s=>s.ingredients?.includes('tomato'))!,prep=stations.find(s=>s.kind==='prep')!;
    const fetch=()=>{engine.setPose(0,{...store.approach,yaw:store.facing});engine.setTarget(0,store.id);expect(engine.action(0,{type:'interact',ingredient:'tomato'}).ok).toBe(true);return state.items[state.chefs[0]!.held!]!;};
    const first=fetch();engine.setPose(0,{...prep.approach,yaw:prep.facing});engine.setPose(1,{x:6,y:3.85,z:-18,yaw:0});
    const surface=selectTossTarget(state.chefs[0]!,first,stations,state.chefs,()=>false,null,state.items);
    expect(surface?.station).toBe(prep.id);expect(engine.action(0,{type:'toss',to:surface!}).ok).toBe(true);engine.update(.5);
    expect(first.location).toMatchObject({kind:'station',station:prep.id});
    const second=fetch();engine.setPose(0,{x:0,y:3.85,z:-10,yaw:Math.PI/2});engine.setPose(1,{x:1.5,y:3.85,z:-10,yaw:-Math.PI/2});
    const handoff=selectTossTarget(state.chefs[0]!,second,stations,state.chefs,()=>false,null,state.items);
    expect(handoff?.chef).toBe(1);expect(engine.action(0,{type:'toss',to:handoff!}).ok).toBe(true);engine.update(.5);
    expect(state.chefs[1]!.held).toBe(second.id);expect(second.location).toEqual({kind:'hands',chef:1});
  });
});
