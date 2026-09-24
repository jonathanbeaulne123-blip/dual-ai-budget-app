/**
 * Every input source → one SkateIntent per sim step.
 *
 *   const input=createSkateInput({stance:'regular',mode:'flick',getGamepads:()=>navigator.getGamepads?.()});
 *   // wire DOM events: input.keyDown(e) / keyUp / pointerDown/Move/Up/Cancel / touchStart(zone,e)/touchMove/touchEnd
 *   // each sim step:   input.setStance(present.stance,{switch:present.switch,fakie:present.fakie});
 *   //                  const intent=input.sample(performance.now(),airborne,rolling,{landingSoon});
 *   // on pause / blur: input.reset();  if(input.pausePressed()) togglePause();
 *
 * Each board-stick device has its own flick recogniser (keyboard digital,
 * mouse drag, touch flick pad, gamepad right stick); the first completed
 * gesture wins the step. One-shots (pop, lateFlip, revert, respawn, marker)
 * are true for exactly one sample() call.
 */
import {SKATE_NO_INTENT,type GrabDef,type SkateIntent,type Stance} from '../contract.ts';
import {createFlickRecogniser,FLICK_DIRS,type FlickCompletion,type FlickRecogniser,type FlickView} from './flick.ts';
import {createDigitalStick,keyName,skateKeyAction,type ArrowDir} from './keyboard.ts';
import {createGamepadSource,type GetPads} from './gamepad.ts';

export type SkateDevice='keyboard'|'pointer'|'touch'|'gamepad';
export type SkateInputMode='flick'|'easy';
export type KeyLike={key:string;code?:string;repeat?:boolean;timeStamp?:number};
export type PointerLike={pointerId:number;clientX:number;clientY:number;button?:number;timeStamp?:number;pointerType?:string};
export type TouchZone='left'|'right'|'push'|'grab-front'|'grab-back'|'brake';
export type SampleOptions={
  /** Airborne but about to touch down (e.g. clearance < ~0.15 and falling): a flick now becomes a buffered pop, not a late flip. */
  landingSoon?:boolean;
};

export const INPUT_TUNING={
  /** A tap of push still gives one full stroke. */
  pushStrokeMs:220,
  /** A pop completed while airborne/landing is held this long for the first grounded step. */
  popBufferMs:140,
  /** Completions older than this when sampled are dropped (e.g. tab stalls). */
  staleMs:300,
  pointerRadiusPx:90,touchStickRadiusPx:56,touchFlickRadiusPx:64,
  /** A mouse gesture ends when the button comes up; holding still on the rim only completes it after this (drags overshoot the rim and linger there on the way back for a double). */
  pointerDwellMs:260,
  /** Left-stick magnitude below which a grab takes the hand's default. */
  grabNeutral:.35,
} as const;

/* ------------------------------------------------------------------ grabs */
/** [hand][left-stick direction index, FLICK_DIRS order] — stance-normalised (toe/heel/nose/tail). */
const GRAB_BY_DIR:Readonly<Record<GrabDef['hand'],readonly GrabDef['id'][]>>={
  back:['crail','indy','indy','tail-grab','tail-grab','roastbeef','stalefish','stalefish'],
  front:['nose-grab','japan','mute','mute','method','method','melon','nose-grab'],
};
const GRAB_NEUTRAL:Readonly<Record<GrabDef['hand'],GrabDef['id']>>={back:'indy',front:'melon'};
/** Which grab a hand makes for a left-stick direction. steer +1 = screen right, lean +1 = nose; facing +1 = toes to the right. */
export function pickGrab(hand:GrabDef['hand'],steer:number,lean:number,facing:1|-1=1):GrabDef['id'] {
  const toe=(Number.isFinite(steer)?steer:0)*facing,nose=Number.isFinite(lean)?lean:0;
  if(Math.hypot(toe,nose)<INPUT_TUNING.grabNeutral)return GRAB_NEUTRAL[hand];
  const k=((Math.round(Math.atan2(toe,nose)/(Math.PI/4))%8)+8)%8;
  return GRAB_BY_DIR[hand][k]!;
}
export const grabTable=()=>({neutral:GRAB_NEUTRAL,byDir:Object.fromEntries((['back','front'] as const).map(h=>[h,Object.fromEntries(FLICK_DIRS.map((d,i)=>[d,GRAB_BY_DIR[h][i]!]))]))});

/** facing for the flick maths: +1 when the rider's toes point to screen-right. */
export const skateFacing=(stance:Stance,riding:{switch?:boolean;fakie?:boolean}={}):1|-1=>
  ((stance==='goofy'?-1:1)*(riding.switch?-1:1)*(riding.fakie?-1:1)) as 1|-1;

/* ------------------------------------------------------------------ input */
export interface SkateInput {
  sample(nowMs:number,airborne:boolean,rolling:boolean,opts?:SampleOptions):SkateIntent;
  setStance(stance:Stance,riding?:{switch?:boolean;fakie?:boolean}):void;
  setMode(mode:SkateInputMode):void;
  mode():SkateInputMode;
  /** Clear everything (pause, blur, tool opened, leaving the board). Held keys/buttons must be pressed again. */
  reset():void;
  activeDevice():SkateDevice;
  /** Start pressed on a gamepad since the last call. */
  pausePressed():boolean;
  /** Returns true when the key belongs to skating (caller may preventDefault). */
  keyDown(e:KeyLike):boolean;
  keyUp(e:KeyLike):boolean;
  pointerDown(e:PointerLike):boolean;
  pointerMove(e:PointerLike):boolean;
  pointerUp(e:PointerLike):boolean;
  pointerCancel(e:PointerLike):boolean;
  touchStart(zone:TouchZone,e:PointerLike):boolean;
  touchMove(e:PointerLike):boolean;
  touchEnd(e:PointerLike):boolean;
  touchCancel(e:PointerLike):boolean;
  /** Easy trick buttons (HUD) / easy keys: 'down' crouches, 'up' pops; in the air 'down' is a late flip. */
  easyTrick(flipId:string|null,phase:'down'|'up',timeStamp:number,from?:'tail'|'nose'):void;
  /** The board stick of the active device for the HUD (screen space) + recogniser state. */
  boardView():FlickView&{device:SkateDevice};
  /** Floating origins of live touches, for drawing the thumb sticks. */
  touches():readonly {pointerId:number;zone:TouchZone;ox:number;oy:number;x:number;y:number}[];
  /** Last gesture that fired (pop or late flip), for the trick book's "you did" echo. */
  lastGesture():FlickCompletion|null;
}

type Easy={flipId:string|null;from:'tail'|'nose';since:number;fired:boolean;key:string|null};
type Touch={zone:TouchZone;ox:number;oy:number;x:number;y:number;since:number};
type Queued=FlickCompletion&{device:SkateDevice};

export function createSkateInput(o:{stance?:Stance;mode?:SkateInputMode;getGamepads?:GetPads|null}={}):SkateInput {
  let stance:Stance=o.stance??'regular',riding={switch:false,fakie:false},mode:SkateInputMode=o.mode??'flick',device:SkateDevice='keyboard';
  const defaultPads:GetPads|null=typeof navigator!=='undefined'&&typeof navigator.getGamepads==='function'?()=>navigator.getGamepads():null;
  const pad=createGamepadSource(o.getGamepads===undefined?defaultPads:o.getGamepads);
  const rec:Record<SkateDevice,FlickRecogniser>={keyboard:createFlickRecogniser({digital:true}),pointer:createFlickRecogniser({timing:{dwellMs:INPUT_TUNING.pointerDwellMs}}),touch:createFlickRecogniser(),gamepad:createFlickRecogniser({timing:{popOnFlick:true}})};
  const kbStick=createDigitalStick();
  const keys=new Set<string>(),grabs=new Map<string,GrabDef['hand']>(),touches=new Map<number,Touch>(),queue:Queued[]=[];
  let grab:null|{id:GrabDef['id'];source:string}=null,revert=0,respawn=0,marker=0,jumps=0,pause=false,pushUntil=-Infinity,lastNow=0;
  let drag:null|{id:number;ox:number;oy:number}=null,easy:Easy|null=null,buffered:null|{pop:NonNullable<SkateIntent['pop']>;until:number}=null,last:FlickCompletion|null=null;
  let padLeft={x:0,y:0},padHeld={push:false,brake:false,powerslide:false,grind:false,sprint:false,manual:false,noseManual:false};

  const facing=()=>skateFacing(stance,riding);
  const ts=(e:{timeStamp?:number})=>Number.isFinite(e.timeStamp)&&(e.timeStamp??0)>0?e.timeStamp!:lastNow;
  const feedKb=(t:number,x:number,y:number)=>rec.keyboard.feed(t,x,y,x===0&&y===0);
  const kbLeft=()=>({x:(keys.has('d')?1:0)-(keys.has('a')?1:0),y:(keys.has('w')?1:0)-(keys.has('s')?1:0)});
  const touchLeft=()=>{for(const t of touches.values())if(t.zone==='left')return {x:t.x,y:t.y};return {x:0,y:0};};
  const leftStick=()=>{let best={x:0,y:0},m=0;for(const v of [kbLeft(),padLeft,touchLeft()]){const n=Math.hypot(v.x,v.y);if(n>m){m=n;best=v;}}return best;};
  function grabDown(source:string,hand:GrabDef['hand']){
    grabs.set(source,hand);
    if(!grab){const l=leftStick();grab={id:pickGrab(hand,l.x,l.y,facing()),source};}
  }
  function grabUp(source:string){
    grabs.delete(source);
    if(grab?.source===source){grab=null;const next=grabs.entries().next();if(!next.done)grabDown(next.value[0],next.value[1]);}
  }
  const stickOf=(t:Touch|{ox:number;oy:number},cx:number,cy:number,r:number)=>{
    let x=(cx-t.ox)/r,y=-(cy-t.oy)/r;const m=Math.hypot(x,y);if(m>1){x/=m;y/=m;}return {x,y};
  };
  function reset(){
    for(const r of Object.values(rec))r.reset();
    kbStick.reset();keys.clear();grabs.clear();touches.clear();queue.length=0;
    grab=null;revert=respawn=marker=jumps=0;pause=false;pushUntil=-Infinity;drag=null;easy=null;buffered=null;
    padLeft={x:0,y:0};padHeld={push:false,brake:false,powerslide:false,grind:false,sprint:false,manual:false,noseManual:false};
    pad.resync();
  }

  function easyDown(flipId:string|null,from:'tail'|'nose',t:number,key:string|null){
    // Easy nollie: hold O (nollie crouch), then a flip key = nollie version of that flip.
    if(easy&&!(easy.key==='o'&&!easy.fired&&key!=='o'))return;
    easy={flipId,from:keys.has('o')&&key!=='o'?'nose':from,since:easy?.since??t,fired:false,key};
  }
  function easyUp(t:number,key:string|null){
    if(!easy||easy.key!==key)return;
    if(!easy.fired)queue.push({flipId:easy.flipId,from:easy.from,strength:Math.round((.55+.45*Math.min(1,Math.max(0,(t-easy.since)/300)))*1000)/1000,at:t,path:Object.freeze([]),device});
    easy=null;
  }

  function touchEnd(e:PointerLike):boolean {
    const touch=touches.get(e.pointerId);if(!touch)return false;
    touches.delete(e.pointerId);
    if(touch.zone==='right')rec.touch.feed(ts(e),0,0,true);
    else if(touch.zone==='grab-front'||touch.zone==='grab-back')grabUp(`touch:${e.pointerId}`);
    return true;
  }

  return {
    sample(now,airborne,rolling,opts={}){
      if(!Number.isFinite(now))now=lastNow;
      // A long frame (a slow device, a hitch) must not make a gesture that finished inside it stale.
      const gap=lastNow>0?Math.max(0,now-lastNow):0;
      lastNow=Math.max(lastNow,now);now=lastNow;
      const f=facing();for(const r of Object.values(rec))r.setFacing(f);
      // Gamepad (polled here, once per step).
      const p=pad.poll();
      if(p.connected){
        if(p.touched)device='gamepad';
        rec.gamepad.feed(now,p.right.x,p.right.y);
        padLeft=p.left;
        padHeld={push:p.push,brake:p.brake,powerslide:p.powerslide,grind:p.grind,sprint:p.sprint,manual:p.manual,noseManual:p.noseManual};
        if(p.push&&!keys.has('pad:push')){keys.add('pad:push');pushUntil=Math.max(pushUntil,now+INPUT_TUNING.pushStrokeMs);}else if(!p.push)keys.delete('pad:push');
        if(p.grabFront&&!grabs.has('pad:front'))grabDown('pad:front','front');else if(!p.grabFront&&grabs.has('pad:front'))grabUp('pad:front');
        if(p.grabBack&&!grabs.has('pad:back'))grabDown('pad:back','back');else if(!p.grabBack&&grabs.has('pad:back'))grabUp('pad:back');
        if(p.revert)revert++;if(p.respawn)respawn++;if(p.marker)marker++;if(p.pause)pause=true;
      }else{padLeft={x:0,y:0};padHeld={push:false,brake:false,powerslide:false,grind:false,sprint:false,manual:false,noseManual:false};}
      kbStick.advance(now,feedKb);
      for(const d of Object.keys(rec) as SkateDevice[]){const r=rec[d];r.tick(now);for(let c=r.take();c;c=r.take())queue.push({...c,device:d});}
      // Pops / late flips.
      let pop:SkateIntent['pop']=null,lateFlip:string|null=null;
      if(easy&&airborne&&!easy.fired&&easy.flipId!==null&&!opts.landingSoon){lateFlip=easy.flipId;easy.fired=true;last={flipId:easy.flipId,from:easy.from,strength:1,at:now,path:[]};}
      queue.sort((a,b)=>a.at-b.at);
      const staleMs=Math.max(INPUT_TUNING.staleMs,gap*1.5);
      while(queue.length&&now-queue[0]!.at>staleMs)queue.shift();
      let c=lateFlip?null:queue.shift()??null;
      // An upgrade belongs to the pop it follows: a flip in the air, and nothing once back down.
      if(c?.upgrade){if(airborne&&c.flipId!==null){lateFlip=c.flipId;last=c;}c=null;}
      if(c){
        const flick={from:c.from,flipId:c.flipId,strength:c.strength};
        if(!airborne){pop=flick;buffered=null;}
        else if(c.flipId!==null&&!opts.landingSoon)lateFlip=c.flipId;
        else buffered={pop:flick,until:c.at+INPUT_TUNING.popBufferMs};
        last=c;
      }
      if(!pop&&!airborne&&buffered&&now<=buffered.until){pop=buffered.pop;buffered=null;}
      if(jumps>0){
        const jump={from:'tail' as const,flipId:null,strength:0.7};
        if(!airborne)pop=jump;
        else buffered={pop:jump,until:now+INPUT_TUNING.popBufferMs};
        jumps=0;
      }
      if(buffered&&now>buffered.until)buffered=null;
      // Held state.
      let crouch=0,crouchEnd:SkateIntent['crouchEnd']=null,manual:SkateIntent['manual']=null;
      for(const r of Object.values(rec)){const h=r.held(now);if(h.crouch>crouch){crouch=h.crouch;crouchEnd=h.crouchEnd;}if(h.manual&&!manual)manual=h.manual;}
      if(easy&&!easy.fired){crouch=1;crouchEnd=easy.from;}
      if(keys.has('m')||padHeld.manual)manual='manual';else if(keys.has('n')||padHeld.noseManual)manual='nose-manual';
      if(!rolling&&!airborne)manual=null;
      const l=leftStick(),touchZone=(z:TouchZone)=>{for(const t of touches.values())if(t.zone===z)return true;return false;};
      let touchGrab:GrabDef['id']|null=null;
      if(airborne)for(const t of touches.values())if(t.zone==='right'&&now-t.since>180&&Math.abs(t.x)>.65&&Math.abs(t.y)<.45){
        touchGrab=pickGrab(t.x<0?'front':'back',l.x,l.y,f);break;
      }
      const intent:SkateIntent={
        steer:Math.max(-1,Math.min(1,l.x)),lean:Math.max(-1,Math.min(1,l.y)),
        push:keys.has('w')||padHeld.push||touchZone('push')||touchLeft().y>0.32||now<pushUntil,
        brake:keys.has('s')||padHeld.brake||touchZone('brake')||touchLeft().y<-.38,
        powerslide:keys.has('c')||padHeld.powerslide,
        crouch,crouchEnd,pop,lateFlip,grab:grab?.id??touchGrab,manual,
        revert:revert>0,grindAssist:keys.has('g')||padHeld.grind,
        respawn:respawn>0,marker:marker>0,sprint:keys.has('shift')||padHeld.sprint,
      };
      revert=respawn=marker=0;
      return intent;
    },
    setStance(s,r={}){stance=s==='goofy'?'goofy':'regular';riding={switch:Boolean(r.switch),fakie:Boolean(r.fakie)};},
    setMode(m){if(m!==mode){mode=m==='easy'?'easy':'flick';reset();}},
    mode:()=>mode,
    reset,
    activeDevice:()=>device,
    pausePressed(){const p=pause;pause=false;return p;},
    keyDown(e){
      const name=keyName(e),action=skateKeyAction(name,mode);if(!action)return false;
      const t=ts(e);device='keyboard';
      if(e.repeat)return true;
      kbStick.advance(t,feedKb);
      switch(action.kind){
        case 'jump':jumps++;break;
        case 'stick':kbStick.press(action.dir,t);break;
        case 'ride':keys.add(name);if(action.dir==='push')pushUntil=Math.max(pushUntil,t+INPUT_TUNING.pushStrokeMs);break;
        case 'hold':keys.add(action.what==='sprint'?'shift':name);break;
        case 'grab':grabDown(`key:${name}`,action.hand);break;
        case 'once':if(action.what==='revert')revert++;else if(action.what==='respawn')respawn++;else marker++;break;
        case 'easy':keys.add(name);easyDown(action.flipId,action.from,t,name);break;
      }
      return true;
    },
    keyUp(e){
      const name=keyName(e),action=skateKeyAction(name,mode);if(!action)return false;
      const t=ts(e);kbStick.advance(t,feedKb);
      switch(action.kind){
        case 'jump':break;
        case 'stick':kbStick.release(action.dir as ArrowDir,t);break;
        case 'ride':keys.delete(name);break;
        case 'hold':keys.delete(action.what==='sprint'?'shift':name);break;
        case 'grab':grabUp(`key:${name}`);break;
        case 'easy':keys.delete(name);easyUp(t,name);break;
        case 'once':break;
      }
      return true;
    },
    pointerDown(e){
      if(e.pointerType==='touch')return false;
      const t=ts(e);device='pointer';
      if((e.button??0)===2){grabDown('pointer','back');return true;}
      if((e.button??0)!==0)return false;
      drag={id:e.pointerId,ox:e.clientX,oy:e.clientY};rec.pointer.feed(t,0,0);return true;
    },
    pointerMove(e){
      if(!drag||drag.id!==e.pointerId)return false;
      const v=stickOf(drag,e.clientX,e.clientY,INPUT_TUNING.pointerRadiusPx);rec.pointer.feed(ts(e),v.x,v.y);return true;
    },
    pointerUp(e){
      const t=ts(e);
      if((e.button??0)===2){grabUp('pointer');return true;}
      if(!drag||drag.id!==e.pointerId)return false;
      rec.pointer.feed(t,0,0,true);drag=null;return true;
    },
    pointerCancel(e){
      grabUp('pointer');
      if(!drag||drag.id!==e.pointerId)return false;
      rec.pointer.feed(ts(e),0,0,true);drag=null;return true;
    },
    touchStart(zone,e){
      const t=ts(e);device='touch';
      if(touches.has(e.pointerId))return true;
      touches.set(e.pointerId,{zone,ox:e.clientX,oy:e.clientY,x:0,y:0,since:t});
      if(zone==='right')rec.touch.feed(t,0,0);
      else if(zone==='push')pushUntil=Math.max(pushUntil,t+INPUT_TUNING.pushStrokeMs);
      else if(zone==='grab-front'||zone==='grab-back')grabDown(`touch:${e.pointerId}`,zone==='grab-front'?'front':'back');
      return true;
    },
    touchMove(e){
      const touch=touches.get(e.pointerId);if(!touch)return false;
      if(touch.zone==='left'){const v=stickOf(touch,e.clientX,e.clientY,INPUT_TUNING.touchStickRadiusPx);touch.x=v.x;touch.y=v.y;}
      else if(touch.zone==='right'){const v=stickOf(touch,e.clientX,e.clientY,INPUT_TUNING.touchFlickRadiusPx);touch.x=v.x;touch.y=v.y;rec.touch.feed(ts(e),v.x,v.y);}
      return true;
    },
    touchEnd,
    touchCancel:touchEnd,
    easyTrick(flipId,phase,timeStamp,from='tail'){
      const t=Number.isFinite(timeStamp)&&timeStamp>0?timeStamp:lastNow;
      if(phase==='down')easyDown(flipId,from,t,null);else easyUp(t,null);
    },
    boardView(){const v=rec[device].view();return {...v,device};},
    touches:()=>[...touches.entries()].map(([pointerId,t])=>({pointerId,...t})),
    lastGesture:()=>last,
  };
}

export {SKATE_NO_INTENT};
export {gesturePath,gestureSegments,gestureSamples,gestureFor,recogniseGesture,createFlickRecogniser,FLICK_TUNING,FLICK_DIRS} from './flick.ts';
