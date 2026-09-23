/**
 * Skate v2 · a seeded "human" for the flick-it input.
 *
 * Plays a trick's gesture the way a person does — on the keyboard (arrow keys
 * pressed by fingers that overlap and roll), on a gamepad right stick (a
 * thumb that curves, overshoots and springs back) and with a mouse drag (big,
 * fast, off-axis) — through the REAL `createSkateInput`, sampled at a jittery
 * ~60 Hz frame clock, and reports which pop came out. Used by
 * test/skate-input-human.test.ts to hold the recogniser to ≥ 95 % intended /
 * ≤ 2 % wrong. Pure and deterministic for a seed; no DOM.
 */
import type {FlickDir,SkateIntent,Stance} from '../src/harbour/skate/contract.ts';
import {gestureFor,createSkateInput,skateFacing,type SkateInput} from '../src/harbour/skate/input/index.ts';
import type {PadLike} from '../src/harbour/skate/input/gamepad.ts';
import {SKATE_FLIPS} from '../src/harbour/skate/tricks/catalog.ts';

export type HumanDevice='keyboard'|'gamepad'|'mouse';
/** Matches the sim's FLIP_CORRECT_TIME / the scorer's upgradeS. */
export const HUMAN_UPGRADE_MS=150;
/**
 * The board of the popped trick, turning as the sim turns it (FLIP_RATE_BASE .85 +
 * FLIP_RATE_STRENGTH .3 × strength per duration; upgrades at strength .7 keep the turns made).
 * A late flip is the popped trick read further on (what the sim and the scorer do) within
 * HUMAN_UPGRADE_MS of the last reading while still turning, or whenever its gesture carries on
 * from the popped one; otherwise it is a late flip, a trick of its own.
 */
export function humanBoard(flipId:string|null,strength:number,at:number){
  let id=flipId,u=0,t=at;at=t;
  const rate=(fid:string|null,st:number)=>{const d=fid?SKATE_FLIPS.get(fid):null;return d?(.85+.3*st)/d.duration/1000:0;};
  let r=rate(id,strength);
  const advance=(now:number)=>{u+=r*(now-t);t=now;};
  return {
    id:()=>id,
    upgrade(to:string,now:number):boolean{
      advance(now);
      const caught=id!==null&&u>=1;
      const ok=(!caught&&now-at<=HUMAN_UPGRADE_MS)||(()=>{const a=gestureFor(id),b=gestureFor(to);return !!a&&!!b&&a.length<b.length&&a.every((d,i)=>b[i]===d);})();
      if(!ok)return false;
      const rf=Math.abs(id?SKATE_FLIPS.get(id)?.roll??0:0),rt=Math.abs(SKATE_FLIPS.get(to)?.roll??0);
      u=rf>0&&rt>0?Math.min(.95,Math.min(1,u)*rf/rt):now-at<=HUMAN_UPGRADE_MS?u:0;id=to;r=rate(to,.7);at=now;
      return true;
    },
  };
}
export type HumanTrial={device:HumanDevice;flipId:string|null;origin:'tail'|'nose';stance:Stance;seed:number;debug?:(now:number,input:SkateInput,stick:{x:number;y:number}|null)=>void};
export type HumanResult={
  pops:{flipId:string|null;from:'tail'|'nose';at:number;late?:boolean}[];crouchSeen:boolean;
  /** When the last move of the gesture was made (last key pressed / the stick reached its last sector) and when it was let go. */
  lastMoveAt:number;releaseAt:number;
};

export function rng(seed:number):()=>number {
  let s=(seed*2654435761)>>>0||1;
  return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};
}
const lerp=(a:number,b:number,u:number)=>a+(b-a)*u;

const INDEX:Record<FlickDir,number>={nose:0,'nose-toe':1,toe:2,'tail-toe':3,tail:4,'tail-heel':5,heel:6,'nose-heel':7};
/** Screen angle (rad, 0 = up, clockwise) of a stance-space direction for this facing/origin. */
function screenAngle(d:FlickDir,facing:1|-1,origin:'tail'|'nose'):number {
  let k=INDEX[d];if(origin==='nose')k=(12-k)%8;
  const a=k*Math.PI/4;return facing>0?a:-a;
}
type Ev={t:number;run:(input:SkateInput)=>void};

/* ------------------------------------------------------------ keyboard */
type Arrow='arrowup'|'arrowdown'|'arrowleft'|'arrowright';
function keysFor(angle:number):Set<Arrow> {
  const x=Math.round(Math.sin(angle)),y=Math.round(Math.cos(angle)),out=new Set<Arrow>();
  if(y>0)out.add('arrowup');if(y<0)out.add('arrowdown');if(x>0)out.add('arrowright');if(x<0)out.add('arrowleft');
  return out;
}
/**
 * Fingers on the arrows: load (hold 90–350 ms), then each step of the gesture.
 * A flick presses the new keys (a diagonal's two keys up to 45 ms apart, either
 * first) and lets go of the old ones −30…+60 ms later (negative = a gap); a
 * rim step rolls one key on or off 40–110 ms after the last change. The last
 * keys are held 30–160 ms and let go up to 40 ms apart.
 */
function keyboardEvents(dirs:readonly FlickDir[],facing:1|-1,origin:'tail'|'nose',r:()=>number,t0:number):{events:Ev[];lastMoveAt:number;releaseAt:number} {
  const ev:Ev[]=[];let t=t0,lastMoveAt=t0;
  const down=(k:Arrow,at:number)=>ev.push({t:at,run:i=>{i.keyDown({key:k,code:k==='arrowup'?'ArrowUp':k==='arrowdown'?'ArrowDown':k==='arrowleft'?'ArrowLeft':'ArrowRight',timeStamp:at});}});
  const up=(k:Arrow,at:number)=>ev.push({t:at,run:i=>{i.keyUp({key:k,code:k==='arrowup'?'ArrowUp':k==='arrowdown'?'ArrowDown':k==='arrowleft'?'ArrowLeft':'ArrowRight',timeStamp:at});}});
  let held=keysFor(screenAngle(dirs[0]!,facing,origin));
  for(const k of held)down(k,t);
  t+=lerp(90,350,r());
  for(let i=1;i<dirs.length;i++){
    const next=keysFor(screenAngle(dirs[i]!,facing,origin));
    const add=[...next].filter(k=>!held.has(k)),drop=[...held].filter(k=>!next.has(k));
    const steps=Math.abs(((INDEX[dirs[i]!]-INDEX[dirs[i-1]!]+12)%8)-4);
    if(steps<=1){
      // Rim step: one key rolls on or off.
      for(const k of add)down(k,t);for(const k of drop)up(k,t);
      lastMoveAt=t;t+=lerp(40,110,r());
    }else{
      if(r()<.5)add.reverse();
      let a=t;for(const k of add){down(k,a);lastMoveAt=a;a+=lerp(0,45,r());}
      const lag=lerp(-30,60,r());let d=t+lag;for(const k of drop){up(k,Math.max(t0,d));d+=lerp(0,25,r());}
      t=Math.max(a,d)+lerp(50,140,r());
    }
    held=next;
  }
  // Hold the last keys a moment, then let go (a chord up to 40 ms apart).
  t+=lerp(-20,90,r());
  let u=t;for(const k of held){up(k,u);u+=lerp(0,40,r());}
  return {events:ev,lastMoveAt,releaseAt:t};
}

/* ------------------------------------------------------------- analog */
type Pt={t:number;x:number;y:number};
/**
 * A thumb (gamepad) or a mouse drag as a continuous path, returned as a
 * function of time. Load: reach the end in 40–90 ms (±12° off), hold 80–300 ms
 * with a little tremor. Flick: 60–200 ms through (not exactly) the centre on
 * a curve bowed up to 0.25 sideways, arriving up to ±12° off (±20° with a mouse;
 * aiming error is triangular, most flicks are close) and overshooting
 * to the stick's gate; rim steps roll round at 25–75 ms per 45° with the
 * magnitude sagging to 0.82. Release: springs home in 25–60 ms.
 * Mouse: magnitudes run past the rim (the drag is clamped), bigger angle error.
 */
function analogPath(dirs:readonly FlickDir[],facing:1|-1,origin:'tail'|'nose',r:()=>number,t0:number,mouse:boolean):{at:(t:number)=>{x:number;y:number};end:number;arrive:number;release:number} {
  const keys:Pt[]=[];let t=t0;
  const err=mouse?.35:.21;
  const rim=(a:number,m=1)=>({x:Math.sin(a)*m,y:Math.cos(a)*m});
  keys.push({t,x:0,y:0});
  let a=screenAngle(dirs[0]!,facing,origin)+lerp(-.2,.2,r());
  t+=lerp(40,90,r());const load=rim(a,mouse?lerp(1,1.6,r()):lerp(.93,1,r()));keys.push({t,...load});
  const hold=lerp(80,300,r());
  for(let h=20;h<hold;h+=20)keys.push({t:t+h,x:load.x+lerp(-.04,.04,r()),y:load.y+lerp(-.04,.04,r())});
  t+=hold;
  for(let i=1;i<dirs.length;i++){
    const steps=Math.abs(((INDEX[dirs[i]!]-INDEX[dirs[i-1]!]+12)%8)-4);
    const target=screenAngle(dirs[i]!,facing,origin);
    if(steps<=1){
      // Roll round the rim (the short way) to the next sector.
      let d=target-a;d=Math.atan2(Math.sin(d),Math.cos(d));
      const dur=lerp(25,75,r()),n=Math.max(2,Math.round(dur/8));
      for(let j=1;j<=n;j++){const u=j/n,ang=a+d*u;keys.push({t:t+dur*u,...rim(ang,lerp(.82,1,r())*(mouse?lerp(1,1.4,r()):1))});}
      t+=dur;a=a+d;
    }else{
      const dur=lerp(60,200,r()),bow=lerp(-.25,.25,r()),end=target+err*(r()+r()-1);
      const p0=rim(a),p1=rim(end,mouse?lerp(1.1,1.8,r()):1);
      const nx=-(p1.y-p0.y),ny=p1.x-p0.x,nl=Math.hypot(nx,ny)||1;
      const n=Math.max(3,Math.round(dur/8));
      for(let j=1;j<=n;j++){
        const u=j/n,e=u*u*(3-2*u),b=Math.sin(Math.PI*u)*bow;
        let x=lerp(p0.x,p1.x,e)+nx/nl*b,y=lerp(p0.y,p1.y,e)+ny/nl*b;
        if(!mouse){const m=Math.hypot(x,y);if(m>1){x/=m;y/=m;}}
        keys.push({t:t+dur*u,x,y});
      }
      t+=dur;a=end;
      // Settle on the new sector (thumbs overshoot, then come back a little).
      const settle=lerp(10,60,r());keys.push({t:t+settle,...rim(a+lerp(-.12,.12,r()),mouse?lerp(1.1,1.6,r()):lerp(.9,1,r()))});t+=settle;
      // Snap back to the tail for a double: a real thumb sits there a beat.
      if(dirs[i]==='tail'&&i<dirs.length-1)t+=lerp(20,70,r());
    }
  }
  // Let go (the stick springs home; the mouse button comes up).
  const arrive=t,rel=lerp(25,60,r());keys.push({t:t+rel,x:0,y:0});
  const end=t+rel;
  const at=(q:number)=>{
    if(q<=keys[0]!.t)return {x:0,y:0};
    for(let i=1;i<keys.length;i++){const k=keys[i]!;if(q<=k.t){const p=keys[i-1]!,u=(q-p.t)/Math.max(1e-6,k.t-p.t);return {x:lerp(p.x,k.x,u),y:lerp(p.y,k.y,u)};}}
    return {x:0,y:0};
  };
  return {at,end,arrive,release:arrive};
}

/* --------------------------------------------------------------- runner */
/** Play one trial through the real input at a jittery ~60 Hz (with the odd 33 ms frame). */
export function playHuman(trial:HumanTrial):HumanResult {
  const r=rng(trial.seed*977+(trial.device==='keyboard'?1:trial.device==='gamepad'?2:3));
  const facing=skateFacing(trial.stance,{});
  const gesture=gestureFor(trial.flipId)!;
  const t0=1000+lerp(0,30,r());
  let axes=[0,0,0,0];
  const pads=trial.device==='gamepad'?()=>[{connected:true,mapping:'standard',index:0,axes,buttons:Array.from({length:17},()=>({pressed:false,value:0}))} as PadLike]:()=>[];
  const input=createSkateInput({stance:trial.stance,getGamepads:pads});
  input.setStance(trial.stance,{});
  const events:Ev[]=[];let end=t0;
  let path:{at:(t:number)=>{x:number;y:number};end:number;arrive:number;release:number}|null=null;
  let lastMoveAt=t0,releaseAt=t0;
  if(trial.device==='keyboard'){
    const kb=keyboardEvents(gesture,facing,trial.origin,r,t0);events.push(...kb.events);end=Math.max(...events.map(e=>e.t));
    lastMoveAt=kb.lastMoveAt;releaseAt=kb.releaseAt;
  }
  else{
    path=analogPath(gesture,facing,trial.origin,r,t0,trial.device==='mouse');end=path.end;lastMoveAt=path.arrive;releaseAt=path.release;
    if(trial.device==='mouse'){
      // Pointer events at 60–125 Hz; the drag starts at the press point.
      const R=90,ox=640,oy=400,hz=lerp(60,125,r()),p=path;
      events.push({t:t0,run:i=>{i.pointerDown({pointerId:1,clientX:ox,clientY:oy,button:0,timeStamp:t0,pointerType:'mouse'});}});
      for(let q=t0+1000/hz;q<end;q+=1000/hz*lerp(.8,1.2,r())){const v=p.at(q),at=q;events.push({t:at,run:i=>{i.pointerMove({pointerId:1,clientX:ox+v.x*R,clientY:oy-v.y*R,timeStamp:at,pointerType:'mouse'});}});}
      events.push({t:end,run:i=>{i.pointerUp({pointerId:1,clientX:ox,clientY:oy,button:0,timeStamp:end,pointerType:'mouse'});}});
    }
  }
  events.sort((a,b)=>a.t-b.t);
  // A flat ollie is about half a second of air; nobody tries a double or an impossible off flat
  // ground, so multi-flick tricks get a kicker's air.
  const flicks=gesture.filter((d,i)=>i>0&&Math.abs(((INDEX[d]-INDEX[gesture[i-1]!]+12)%8)-4)>=3&&d!=='tail').length;
  const airMs=flicks>=2?900:500;
  const pops:HumanResult['pops']=[];let crouchSeen=false,k=0,airUntil=-Infinity,board:ReturnType<typeof humanBoard>|null=null;
  for(let now=t0-50;now<end+700;){
    while(k<events.length&&events[k]!.t<=now){events[k]!.run(input);k++;}
    if(path&&trial.device==='gamepad'){const v=path.at(now);axes=[0,0,v.x,-v.y];}
    // After a pop the rider is in the air for about half a second (a flat ollie).
    const airborne=now<airUntil;
    const intent:SkateIntent=input.sample(now,airborne,true);
    trial.debug?.(now,input,path?path.at(now):null);
    if(intent.crouch>.5)crouchSeen=true;
    if(intent.pop){pops.push({flipId:intent.pop.flipId,from:intent.pop.from,at:now});airUntil=now+airMs;board=humanBoard(intent.pop.flipId,intent.pop.strength,now);}
    // A flip that lands soon after the pop, or carries its gesture on before the catch, is the
    // same trick read further on (the sim and the scorer upgrade it); otherwise it is a late flip.
    if(intent.lateFlip){
      const p=pops[pops.length-1];
      if(p&&!p.late&&board?.upgrade(intent.lateFlip,now))p.flipId=intent.lateFlip;
      else pops.push({flipId:intent.lateFlip,from:p?.from??'tail',at:now,late:true});
    }
    now+=r()<.03?33.4:lerp(14.5,19,r());
  }
  return {pops,crouchSeen,lastMoveAt,releaseAt};
}

export type HumanScore={n:number;intended:number;wrong:number;none:number;byTrick:Record<string,{n:number;ok:number;wrong:Record<string,number>}>};
/** Run `perTrick` seeded trials of every trick in `ids` on a device (stances and nollies mixed in). */
export function scoreHuman(device:HumanDevice,ids:readonly (string|null)[],perTrick:number,seed0=1):HumanScore {
  const out:HumanScore={n:0,intended:0,wrong:0,none:0,byTrick:{}};
  for(const id of ids){
    const b:HumanScore['byTrick'][string]=out.byTrick[id??'ollie']={n:0,ok:0,wrong:{}};
    for(let s=0;s<perTrick;s++){
      const seed=seed0+s*31+(id?id.length*7:3);
      const origin:'tail'|'nose'=s%5===4?'nose':'tail',stance:Stance=s%3===2?'goofy':'regular';
      const res=playHuman({device,flipId:id,origin,stance,seed});
      out.n++;b.n++;
      const hit=res.pops.length===1&&res.pops[0]!.flipId===id&&res.pops[0]!.from===origin;
      if(hit){out.intended++;b.ok++;}
      else if(res.pops.length===0)out.none++;
      else{out.wrong++;const w=res.pops.map(p=>`${p.late?'late:':''}${p.from==='nose'?'n:':''}${p.flipId??'ollie'}`).join('+');b.wrong[w]=(b.wrong[w]??0)+1;}
    }
  }
  return out;
}
