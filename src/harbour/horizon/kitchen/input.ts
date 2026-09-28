import {padStick,PAD_DEADZONE,type GetPads,type PadLike} from '../../skate/input/gamepad.ts';
import type {Point} from '../movers/fleet/layout.ts';
import type {ChefId,ChefPose,ChefState,KitchenChefInput,KitchenControls,KitchenItem,KitchenStation} from './types.ts';

export type KitchenKeyEvent={key:string;repeat?:boolean};
export type KitchenTouch=Partial<Pick<KitchenChefInput,'x'|'z'|'interact'|'prepare'|'toss'|'cycle'|'ready'|'pause'>>;
export type KitchenLineBlocked=(from:Point,to:Point)=>boolean;
export type KitchenTossTarget={station?:string;chef?:ChefId;point:Point};
export const KITCHEN_BINDINGS={keyboard:'WASD / arrows: move · E: pick up / place · F: prepare · R: toss · Q: choose ingredient · Enter: ready · Esc: pause',gamepad:'Left stick: move · A: pick up / place · X: prepare · B: toss · Y: choose ingredient · Start: ready / pause'} as const;
const actions=['interact','prepare','toss','cycle','ready','pause'] as const;
type Action=typeof actions[number];
const keys:Record<string,Action>={e:'interact',f:'prepare',r:'toss',q:'cycle',enter:'ready',escape:'pause'};
const movement=new Set(['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright']);
const neutral=():KitchenChefInput=>({x:0,z:0,interact:false,prepare:false,prepareHeld:false,toss:false,cycle:false,ready:false,pause:false});
const clamp=(n:number)=>Number.isFinite(n)?Math.max(-1,Math.min(1,n)):0;
const defaultPads:GetPads=()=>typeof navigator==='undefined'?null:navigator.getGamepads?.();
type PadSlot={index:number|null;connected:boolean;previous:boolean[];blocked:boolean[];resync:boolean};
const slot=():PadSlot=>({index:null,connected:false,previous:[],blocked:[],resync:true});

/** Input only: no listeners or simulation clocks. The activity owns focus and event cleanup. */
export function createKitchenInput(options:{getGamepads?:GetPads|null}={}){
  const getPads=options.getGamepads===undefined?defaultPads:options.getGamepads;
  const down=new Set<string>(),pending=new Set<Action>();
  const touches:[KitchenTouch,KitchenTouch]=[{},{}],touchEdges:[Set<Action>,Set<Action>]=[new Set(),new Set()];
  let slots:[PadSlot,PadSlot]=[slot(),slot()],playersWas:1|2|null=null,disposed=false;
  function resetEdges(){
    down.clear();pending.clear();
    for(const id of [0,1] as const){touches[id]={};touchEdges[id].clear();slots[id].resync=true;slots[id].previous=[];}
  }
  function keyDown(event:KitchenKeyEvent){
    if(disposed)return false;
    const key=event.key.toLowerCase(),action=keys[key];
    if(!action&&!movement.has(key))return false;
    if(event.repeat||down.has(key))return true;
    // A non-repeating keydown is a fresh physical press even if its previous
    // keyup happened while the browser was blurred and never reached us.
    down.add(key);if(action)pending.add(action);return true;
  }
  function keyUp(event:KitchenKeyEvent){const key=event.key.toLowerCase();down.delete(key);return Boolean(keys[key]||movement.has(key));}
  function touch(chef:ChefId,value:KitchenTouch){
    if(disposed)return;
    const old=touches[chef];
    for(const action of actions)if(value[action]===true&&!old[action])touchEdges[chef].add(action);
    touches[chef]={...old,...value};
  }
  function pads(){
    const found=new Map<number,PadLike>();
    try{const list=getPads?.();if(list)for(let i=0;i<list.length;i++){const p=list[i];if(p?.connected&&(p.mapping===undefined||p.mapping===''||p.mapping==='standard'))found.set(p.index??i,p);}}catch{/* Denied Gamepad API behaves like a disconnect. */}
    return found;
  }
  function padInput(s:PadSlot,p:PadLike|undefined):KitchenChefInput{
    if(!p){s.connected=false;s.previous=[];s.blocked=[];s.resync=true;return neutral();}
    const buttonIds=[0,2,1,3,9],now=buttonIds.map(i=>Boolean(p.buttons[i]?.pressed||(p.buttons[i]?.value??0)>.5));
    if(s.resync||!s.connected){s.blocked=now.slice();s.resync=false;}
    s.connected=true;
    for(let i=0;i<now.length;i++)s.blocked[i]=Boolean(s.blocked[i]&&now[i]);
    const held=(i:number)=>Boolean(now[i]&&!s.blocked[i]),edge=(i:number)=>held(i)&&!s.previous[i];
    const stick=padStick(p.axes[0]??0,p.axes[1]??0,PAD_DEADZONE.left);
    const value:KitchenChefInput={x:stick.x,z:stick.y,interact:edge(0),prepare:edge(1),prepareHeld:held(1),toss:edge(2),cycle:edge(3),ready:edge(4),pause:edge(4)};
    s.previous=now;return value;
  }
  function sample(players:1|2):KitchenControls{
    if(disposed)return {chefs:[neutral(),neutral()],connections:[{chef:0,kind:'none',label:'Input closed',connected:false},{chef:1,kind:'none',label:'Input closed',connected:false}],disconnected:[]};
    const available=pads();
    if(playersWas!==players){slots=[slot(),slot()];playersWas=players;}
    const assigned=new Set(slots.map(s=>s.index).filter((id):id is number=>id!==null));
    const free=[...available.keys()].filter(id=>!assigned.has(id)).sort((a,b)=>a-b);
    if(players===1){if(slots[0].index===null&&free.length)slots[0].index=free.shift()!;}
    else if(slots.every(s=>s.index===null)&&free.length>=2){slots[0].index=free.shift()!;slots[1].index=free.shift()!;}
    else {
      // A controller already owned by chef 2 never becomes chef 1 after a disconnect.
      if(slots[1].index===null&&free.length)slots[1].index=free.shift()!;
      if(slots[0].index===null&&free.length)slots[0].index=free.shift()!;
    }
    const disconnected:ChefId[]=[],chefs:[KitchenChefInput,KitchenChefInput]=[neutral(),neutral()];
    for(const chef of [0,1] as const){
      const s=slots[chef],p=s.index===null?undefined:available.get(s.index);
      if(s.connected&&!p)disconnected.push(chef);
      chefs[chef]=padInput(s,p);
    }
    // In solo either keyboard or its assigned pad works. In co-op keyboard is chef 1
    // only when that chef has no pad reservation (never a second input for chef 2).
    if(players===1||slots[0].index===null){
      const input=chefs[0];
      const keyX=Number(down.has('d')||down.has('arrowright'))-Number(down.has('a')||down.has('arrowleft'));
      const keyZ=Number(down.has('w')||down.has('arrowup'))-Number(down.has('s')||down.has('arrowdown'));
      input.x=clamp(input.x+keyX);input.z=clamp(input.z+keyZ);
      for(const action of actions)input[action] ||= pending.has(action);
      input.prepareHeld ||= down.has('f');
    }
    pending.clear();
    for(const chef of [0,1] as const){
      const input=chefs[chef],t=touches[chef];
      input.x=clamp(input.x+(t.x??0));input.z=clamp(input.z+(t.z??0));
      const length=Math.hypot(input.x,input.z);if(length>1){input.x/=length;input.z/=length;}
      for(const action of actions)input[action] ||= touchEdges[chef].has(action);
      input.prepareHeld ||= t.prepare===true;touchEdges[chef].clear();
    }
    if(players===1)chefs[1]=neutral();
    const connections=([0,1] as const).map(chef=>{
      const s=slots[chef];
      if(chef===1&&players===1)return {chef,kind:'none' as const,label:'Solo service',connected:false};
      if(s.index!==null)return {chef,kind:'gamepad' as const,label:`Controller ${s.index+1}${s.connected?'':' disconnected'}`,connected:s.connected};
      return chef===0?{chef,kind:'keyboard' as const,label:'Keyboard / touch',connected:true}:{chef,kind:'none' as const,label:'Connect a second controller or use keyboard + controller',connected:false};
    });
    return {chefs,connections,disconnected};
  }
  return {keyDown,keyUp,touch,sample,clear:resetEdges,resync:resetEdges,dispose(){resetEdges();disposed=true;}};
}

export const KITCHEN_TARGETING={reach:1.8,vertical:.6,facing:Math.cos(70*Math.PI/180),hysteresis:.22,tossReach:4.2,tossFacing:Math.cos(65*Math.PI/180)} as const;
function facing(pose:ChefPose,point:Point){const dx=point.x-pose.x,dz=point.z-pose.z,d=Math.hypot(dx,dz);return d<.001?1:(Math.sin(pose.yaw)*dx+Math.cos(pose.yaw)*dz)/d;}
function visible(from:Point,to:Point,blocked:KitchenLineBlocked){try{return !blocked(from,to);}catch{return false;}}
/** Aim at the visible work surface, but reach its accessible approach, never through a wall. */
export function selectKitchenTarget(pose:ChefPose,stations:readonly KitchenStation[],blocked:KitchenLineBlocked,previous?:string|null):KitchenStation|null{
  let best:KitchenStation|null=null,score=Infinity;
  for(const station of stations){
    const p=station.approach,distance=Math.hypot(p.x-pose.x,p.z-pose.z),aim=facing(pose,station.surface);
    if(distance>KITCHEN_TARGETING.reach||Math.abs(p.y-pose.y)>KITCHEN_TARGETING.vertical||aim<KITCHEN_TARGETING.facing||!visible(pose,p,blocked))continue;
    const next=distance+(1-aim)*.7-(station.id===previous?KITCHEN_TARGETING.hysteresis:0);
    if(next<score||next===score&&station.id<(best?.id??'')){score=next;best=station;}
  }
  return best;
}
/** Only loose, cool ingredients can leave the hands; targets are real surfaces or an empty-handed chef. */
export function selectTossTarget(chef:ChefState,item:KitchenItem|null,stations:readonly KitchenStation[],chefs:readonly ChefState[],blocked:KitchenLineBlocked,previous?:KitchenTossTarget|null):KitchenTossTarget|null{
  if(!item||item.kind!=='ingredient'||!['raw','prepared'].includes(item.phase)||item.contents.length||item.location.kind!=='hands'||item.location.chef!==chef.id)return null;
  const from={...chef.pose,y:chef.pose.y+.9};let best:KitchenTossTarget|null=null,score=Infinity;
  const consider=(target:KitchenTossTarget)=>{
    const p=target.point,distance=Math.hypot(p.x-from.x,p.z-from.z),aim=facing(chef.pose,p);
    if(distance<.25||distance>KITCHEN_TARGETING.tossReach||Math.abs(p.y-from.y)>1.2||aim<KITCHEN_TARGETING.tossFacing||!visible(from,p,blocked))return;
    const same=previous&&(target.station!==undefined?target.station===previous.station:target.chef===previous.chef);
    const next=distance+(1-aim)*1.5-(same ? .22 : 0);
    if(next<score){score=next;best=target;}
  };
  for(const station of stations)if(station.kind==='counter')consider({station:station.id,point:{...station.surface}});
  for(const other of chefs)if(other.id!==chef.id&&other.connected&&other.held===null)consider({chef:other.id,point:{...other.pose,y:other.pose.y+.9}});
  return best;
}
