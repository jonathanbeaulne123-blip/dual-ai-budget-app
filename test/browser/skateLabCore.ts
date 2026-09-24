/**
 * Skate Lab · the deterministic core (no DOM, no WebGL).
 *
 * The REAL driver (sim + flick-it input + scorer + session) on the REAL park
 * field, stepped by frame count instead of the wall clock. A script is a
 * timeline of raw `SkateIntent`s, keyboard events and virtual-gamepad stick
 * samples (through the real `createSkateInput`, so flick-it is exercised), plus
 * a sim-state shortcut (`place`) for setting up a trick mid-air.
 *
 * Used by the browser lab (`skateLab.ts`, which adds the park, the rider, the
 * cameras and the HUD) and headless by `test/skate-lab.test.ts`, which runs
 * every scenario and checks what it is meant to show. Dev/test only: nothing
 * under `src/` imports this (fenced by that test).
 */
import {SKATE_NO_INTENT,type SkateIntent,type SkatePresent,type SkateSimEvent,type Stance} from '../../src/harbour/skate/contract.ts';
import {createSkateDriver,skateField,type SkateDriver} from '../../src/harbour/skate/driver.ts';
import {ensureSkateDressing} from '../../src/harbour/skate/world/dressingBuild.ts';
import {SKATE_SPOTS,type SkateSpotId} from '../../src/harbour/skate/park.ts';
import {parkPoint} from '../../src/harbour/skate/world/layout.ts';
import {courtObstacles} from '../../src/harbour/body/obstacles.ts';
import {freshSkateProgress} from '../../src/harbour/skate/session.ts';
import {gestureSamples,skateFacing} from '../../src/harbour/skate/input/index.ts';
import type {PadLike} from '../../src/harbour/skate/input/gamepad.ts';

export type LabTheme='classic'|'taylor'|'newfoundland';
export type LabAvatar='jonathan'|'bianca'|'default';
export type LabLoad={
  /** A spot's start, or an explicit pose, or a pose in Tideline's local frame ([lx, lz, headingDeg] with 0° = local +x). */
  spot?:SkateSpotId; x?:number; z?:number; yaw?:number; local?:readonly [number,number,number];
  /** Rolling speed along the board at frame 0 (u/s). */
  speed?:number;
  theme?:LabTheme; tier?:'full'|'lite'; avatar?:LabAvatar; stance?:Stance; controls?:'flick'|'easy';
  hud?:boolean; width?:number; height?:number;
};
export type LabPad={lx:number;ly:number;rx:number;ry:number;buttons:readonly number[]};
/** One timeline entry, `at` frames after `script()` was called. */
export type LabEntry=
  | {at:number;intent:Partial<SkateIntent>;for?:number}
  | {at:number;key:string;down:boolean}
  | {at:number;tap:string;hold?:number}
  /** Virtual gamepad from this frame on. Sticks are screen-space, y UP. `buttons`: standard-mapping indices held. */
  | {at:number;pad:Partial<LabPad>}
  /** Play a flick-it gesture on the right stick (real recogniser): `flick: null` = ollie. */
  | {at:number;flick:string|null;origin?:'tail'|'nose'}
  /** Test shortcut: overwrite sim state fields (boardYaw, vx, y, mode…). `speed` rolls along the board. */
  | {at:number;place:Record<string,unknown>}
  | {at:number;command:'respawn'|'marker'}
  /**
   * A scripted "thumb" for `for` frames: `grind` steers against the grind balance,
   * `manual` holds a manual (`nose` for a nose manual) and leans against its balance.
   * Merged into the raw intent (so it replaces the input's sample while active).
   */
  | {at:number;auto:'grind'|'manual'|'nose';for:number;extra?:Partial<SkateIntent>};
export type LabFrame={frame:number;present:SkatePresent;events:SkateSimEvent[]};

const ONE_SHOTS=['pop','lateFlip','revert','respawn','marker'] as const;
const o=parkPoint('tideline',0,0);
/** World pose of a point/heading in Tideline's local frame (0° = local +x, 90° = local +z). */
export function tidelinePose(lx:number,lz:number,deg=0):{x:number;z:number;yaw:number}{
  const [x,z]=parkPoint('tideline',lx,lz);
  const a=deg*Math.PI/180,[ex,ez]=parkPoint('tideline',Math.cos(a),Math.sin(a));
  return {x,z,yaw:Math.atan2(ex-o[0],ez-o[1])};
}

export function createLabCore(){
  let clock=1000,frame=0,dt=1/60;
  let driver:SkateDriver|null=null,stance:Stance='regular';
  let entries:(LabEntry&{abs:number})[]=[];
  let pad:LabPad|null=null;
  let last:SkateSimEvent[]=[];
  const trace:LabFrame[]=[];
  const buttons=(held:readonly number[])=>Array.from({length:17},(_,i)=>({pressed:held.includes(i),value:held.includes(i)?1:0}));
  const padObj=():PadLike|null=>pad?{connected:true,mapping:'standard',index:0,axes:[pad.lx,-pad.ly,pad.rx,-pad.ry],buttons:buttons(pad.buttons)}:null;

  function rawIntent():SkateIntent|null{
    let out:SkateIntent|null=null;
    const p=driver?.present()??null;
    for(const e of entries){
      if('auto' in e){
        if(frame<e.abs||frame>=e.abs+e.for||!p)continue;
        const b=p.balance||0;
        const part:Partial<SkateIntent>=e.auto==='grind'?{steer:Math.max(-1,Math.min(1,-2.2*b))}:
          {manual:e.auto==='nose'?'nose-manual':'manual',lean:Math.max(-1,Math.min(1,(e.auto==='nose'?-1:1)*1.6*b))};
        out={...(out??SKATE_NO_INTENT),...part,...(e.extra??{})} as SkateIntent;
        continue;
      }
      if(!('intent' in e))continue;
      const n=Math.max(1,e.for??1);
      if(frame<e.abs||frame>=e.abs+n)continue;
      const part:Record<string,unknown>={...e.intent};
      if(frame!==e.abs)for(const k of ONE_SHOTS)delete part[k];
      out={...(out??SKATE_NO_INTENT),...part} as SkateIntent;
    }
    return out;
  }
  function place(fields:Record<string,unknown>){
    if(!driver)return;
    const cp=driver.checkpoint();if(!cp)return;
    const s=cp.sim as Record<string,unknown>;
    const {speed,...rest}=fields;
    // '@+90' / '@-25': degrees relative to the current board yaw.
    if(typeof rest.boardYaw==='string'&&/^@[+-]?\d/.test(rest.boardYaw))rest.boardYaw=(s.boardYaw as number)+Number(rest.boardYaw.slice(1))*Math.PI/180;
    Object.assign(s,rest);
    if(typeof speed==='number'){const y=s.boardYaw as number;s.vx=Math.sin(y)*speed;s.vz=Math.cos(y)*speed;}
    driver.restore(cp);driver.pause(false);driver.takeCut();
  }
  function applyEntries(){
    for(const e of entries){
      if(e.abs!==frame)continue;
      const input=driver?.input();
      if('key' in e)e.down?input?.keyDown({key:e.key,timeStamp:clock}):input?.keyUp({key:e.key,timeStamp:clock});
      else if('pad' in e)pad={...(pad??{lx:0,ly:0,rx:0,ry:0,buttons:[]}),...e.pad};
      else if('place' in e)place(e.place);
      else if('command' in e)driver?.command(e.command);
    }
  }
  /** Expand macros (taps, flicks) into primitive entries at absolute frames. */
  function expand(list:readonly LabEntry[],base:number):(LabEntry&{abs:number})[]{
    const out:(LabEntry&{abs:number})[]=[];
    for(const e of list){
      if('tap' in e){out.push({at:e.at,key:e.tap,down:true,abs:base+e.at},{at:e.at+(e.hold??6),key:e.tap,down:false,abs:base+e.at+(e.hold??6)});continue;}
      if('flick' in e){
        const samples=gestureSamples(e.flick,{stance,facing:skateFacing(stance,{}),origin:e.origin??'tail',hz:1/dt});
        for(const s of samples){const f=Math.round(s.t/(dt*1000));out.push({at:e.at+f,pad:{rx:s.x,ry:s.y},abs:base+e.at+f});}
        continue;
      }
      out.push({...e,abs:base+e.at});
    }
    return out;
  }

  const api={
    /** Put the board down (frame 0, clock reset). */
    load(l:LabLoad={}){
      stance=l.stance??'regular';
      const pose=l.local?tidelinePose(l.local[0],l.local[1],l.local[2]):
        l.x!==undefined&&l.z!==undefined?{x:l.x,z:l.z,yaw:l.yaw??0}:
        (()=>{const s=SKATE_SPOTS.find(s=>s.id===(l.spot??'tideline'))!;return {x:s.start[0],z:s.start[1],yaw:s.startYaw};})();
      clock=1000;frame=0;entries=[];pad=null;last=[];trace.length=0;
      ensureSkateDressing(skateField()); // the dressing colliders the app registers from its park scene
      driver=createSkateDriver({obstacles:courtObstacles(l.tier??'lite')},{now:()=>clock,getGamepads:()=>{const p=padObj();return p?[p]:[];},intent:rawIntent});
      const progress=freshSkateProgress();progress.settings={...progress.settings,stance,controls:l.controls??'flick'};
      driver.mount(pose.x,pose.z,pose.yaw,progress);driver.takeCut();
      if(l.speed)place({speed:l.speed});
      return pose;
    },
    script(list:readonly LabEntry[]){entries=[...entries,...expand(list,frame)];},
    setDt(next:number){if(next>0&&next<=.1)dt=next;},
    /** Advance `n` frames of `dt` (default the lab's 1/60). Returns the frames stepped. */
    step(n=1,stepDt?:number):LabFrame[]{
      const d=stepDt&&stepDt>0&&stepDt<=.1?stepDt:dt,out:LabFrame[]=[];
      for(let i=0;i<n&&driver;i++){
        applyEntries();
        clock+=d*1000;
        const r=driver.step(d);void r;
        last=[...driver.events()].map(e=>({...e}));
        frame++;
        const f={frame,present:{...driver.present()!,trick:driver.present()!.trick&&{...driver.present()!.trick!},grab:driver.present()!.grab&&{...driver.present()!.grab!},grind:driver.present()!.grind&&{...driver.present()!.grind!},bail:driver.present()!.bail&&{...driver.present()!.bail!}},events:last};
        trace.push(f);out.push(f);
      }
      return out;
    },
    frame:()=>frame,
    clock:()=>clock,
    present:()=>driver?.present()??null,
    events:()=>last,
    trace:()=>trace,
    driver:()=>driver,
    place,
    /** Every event kind so far (pops as `pop:<flip|ollie>`, grinds as `grind:<id>`). */
    kinds:()=>trace.flatMap(f=>f.events.map(e=>e.kind==='pop'?`pop:${e.flipId??'ollie'}`:e.kind==='grind-start'?`grind:${e.grindId}`:e.kind==='lip-trick'?`lip:${e.id}`:e.kind)),
  };
  return api;
}
export type LabCore=ReturnType<typeof createLabCore>;
