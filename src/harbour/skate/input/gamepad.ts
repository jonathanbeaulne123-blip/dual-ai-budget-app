/**
 * Gamepad API (standard mapping) → skate controls. Polled once per sim step
 * from createSkateInput().sample(); the pad source is injected so tests can
 * pass a fake navigator.getGamepads.
 *
 *  left stick  ride (steer / lean)        right stick  board (flick-it)
 *  A (0)       push (hold)                 B (1)        brake (hold; powerslide when carving at speed)
 *  X (2)       revert                      Y (3)        respawn at marker
 *  LB (4)      front-hand grab (hold)      RB (5)       back-hand grab (hold)
 *  LT (6)      powerslide (hold)           RT (7)       grind assist (hold)
 *  Back (8)    set session marker          Start (9)    pause (pausePressed)
 *  R3 (11)     sprint / fast push          D-pad ↓/↑    manual / nose manual (hold)
 */

export type PadButtonLike={pressed:boolean;value:number};
export type PadLike={connected:boolean;mapping?:string;index?:number;axes:readonly number[];buttons:readonly PadButtonLike[]};
export type GetPads=()=>ArrayLike<PadLike|null>|null|undefined;

export const PAD_DEADZONE={left:.18,right:.14,trigger:.35} as const;

export type PadState={
  connected:boolean;
  left:{x:number;y:number};right:{x:number;y:number};
  push:boolean;brake:boolean;powerslide:boolean;grind:boolean;sprint:boolean;
  grabFront:boolean;grabBack:boolean;manual:boolean;noseManual:boolean;
  revert:boolean;respawn:boolean;marker:boolean;pause:boolean;
  /** Any stick past its deadzone or any button down this poll. */
  touched:boolean;
};

const NONE:PadState=Object.freeze({connected:false,left:{x:0,y:0},right:{x:0,y:0},push:false,brake:false,powerslide:false,grind:false,sprint:false,
  grabFront:false,grabBack:false,manual:false,noseManual:false,revert:false,respawn:false,marker:false,pause:false,touched:false});

/** Radial deadzone with rescale so the live range still reaches 1. Returns y UP-positive. */
export function padStick(ax:number,ay:number,dead:number):{x:number;y:number} {
  const x=Number.isFinite(ax)?ax:0,y=Number.isFinite(ay)?-ay:0,m=Math.hypot(x,y);
  if(m<=dead)return {x:0,y:0};
  const k=Math.min(1,(m-dead)/(1-dead))/m;return {x:x*k,y:y*k};
}

export interface GamepadSource {
  poll():PadState;
  /** Forget edges; buttons held now must be released before they fire again. */
  resync():void;
}

export function createGamepadSource(getPads:GetPads|null):GamepadSource {
  let prev:boolean[]=[],blocked:boolean[]=[],resyncing=true,index=-1;
  const pick=():PadLike|null=>{
    let pads:ArrayLike<PadLike|null>|null|undefined=null;
    try{pads=getPads?.();}catch{pads=null;}
    if(!pads)return null;
    const kept=index>=0?pads[index]:null;
    if(kept?.connected)return kept;
    let fallback:PadLike|null=null;index=-1;
    for(let i=0;i<pads.length;i++){const p=pads[i];if(!p?.connected)continue;if(p.mapping==='standard'){index=i;return p;}if(!fallback){fallback=p;index=i;}}
    return fallback;
  };
  return {
    poll(){
      const pad=pick();
      if(!pad){prev=[];return NONE;}
      const down=(i:number)=>{const b=pad.buttons[i];return Boolean(b&&(b.pressed||b.value>.5));};
      const trig=(i:number)=>{const b=pad.buttons[i];return Boolean(b&&(b.value>PAD_DEADZONE.trigger||b.pressed));};
      const now:boolean[]=[];for(let i=0;i<Math.max(16,pad.buttons.length);i++)now.push(i===6||i===7?trig(i):down(i));
      if(resyncing){blocked=now.slice();resyncing=false;}
      for(let i=0;i<now.length;i++)blocked[i]=Boolean(blocked[i]&&now[i]);
      const held=(i:number)=>Boolean(now[i]&&!blocked[i]);
      const edge=(i:number)=>held(i)&&!prev[i];
      const left=padStick(pad.axes[0]??0,pad.axes[1]??0,PAD_DEADZONE.left),right=padStick(pad.axes[2]??0,pad.axes[3]??0,PAD_DEADZONE.right);
      const state:PadState={connected:true,left,right,
        push:held(0),brake:held(1),powerslide:held(6),grind:held(7),sprint:held(11),grabFront:held(4),grabBack:held(5),manual:held(13),noseManual:held(12),
        revert:edge(2),respawn:edge(3),marker:edge(8),pause:edge(9),
        touched:now.some(Boolean)||left.x!==0||left.y!==0||right.x!==0||right.y!==0};
      prev=now;return state;
    },
    resync(){resyncing=true;},
  };
}
