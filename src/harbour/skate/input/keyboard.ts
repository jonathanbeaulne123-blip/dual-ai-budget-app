/**
 * Keyboard → skate controls. The arrow keys (or I/J/K/L) are a DIGITAL board
 * stick fed into the same flick recogniser as the analogue sources, so a key
 * sequence performs exactly the gesture a thumb would:
 *  - chord window: keys pressed within CHORD_MS publish together (↑+← lands
 *    on nose-heel in one frame instead of passing through nose or heel);
 *  - latch: letting go of every board key holds the last direction for
 *    LATCH_MS before the stick springs home, so "↓, then ↑" with a small gap
 *    is still a flick and not load → release → nothing;
 *  - release chord: letting go of ↑+← within KEY_RELEASE_CHORD_MS is one
 *    release (the stick does not slide through ← on the way home);
 *  - opposite keys: the most recently pressed wins (hold ↓, tap ↑ = ↑).
 * Rolls across neighbouring keys (↓ → ↓+← → ← → ←+↑ → ↑) are rim sweeps.
 */

export type ArrowDir='up'|'down'|'left'|'right';
export const KEY_CHORD_MS=30;
export const KEY_LATCH_MS=55;
/** Keys of a chord released within this of each other count as released together. */
export const KEY_RELEASE_CHORD_MS=25;

export interface DigitalStick {
  press(dir:ArrowDir,t:number):void;
  release(dir:ArrowDir,t:number):void;
  /** Emit every scheduled stick change up to t (chord publish, latch release), in order. */
  advance(t:number,emit:(t:number,x:number,y:number)=>void):void;
  value():{x:number;y:number};
  active():boolean;
  reset():void;
}

export function createDigitalStick(o:{chordMs?:number;latchMs?:number;releaseMs?:number}={}):DigitalStick {
  const chordMs=o.chordMs??KEY_CHORD_MS,latchMs=o.latchMs??KEY_LATCH_MS,releaseMs=o.releaseMs??KEY_RELEASE_CHORD_MS;
  const held=new Map<ArrowDir,number>(),chord=new Set<ArrowDir>();
  let x=0,y=0,pending:null|{at:number;kind:'press'|'release'}=null,latchUntil=NaN;
  const vec=(dirs:Iterable<ArrowDir>)=>{
    let up=-1,down=-1,left=-1,right=-1;
    for(const d of dirs){const at=held.get(d)??Infinity;if(d==='up')up=at;else if(d==='down')down=at;else if(d==='left')left=at;else right=at;}
    const vy=up<0&&down<0?0:up>=down?1:-1,vx=left<0&&right<0?0:right>=left?1:-1;
    const n=vx&&vy?Math.SQRT1_2:1;return {x:vx*n,y:vy*n};
  };
  function advance(t:number,emit:(t:number,x:number,y:number)=>void){
    if(pending&&pending.at<=t){
      const {at,kind}=pending;pending=null;
      const v=kind==='press'?vec(new Set([...chord,...held.keys()])):vec(held.keys());chord.clear();
      if(v.x!==x||v.y!==y){x=v.x;y=v.y;emit(at,x,y);}
      if(held.size===0)latchUntil=at+latchMs;
    }
    if(latchUntil<=t){const at=latchUntil;latchUntil=NaN;x=0;y=0;emit(at,0,0);}
  }
  return {
    press(dir,t){
      if(held.has(dir))return;
      held.set(dir,t);chord.add(dir);latchUntil=NaN;
      if(!pending||pending.kind==='release')pending={at:t+chordMs,kind:'press'};
    },
    release(dir,t){
      if(!held.delete(dir))return;
      if(pending?.kind==='press')return; // the pending chord publishes what was pressed (taps included)
      if(held.size===0){pending=null;latchUntil=t+latchMs;return;} // letting go of a whole chord keeps its direction for the latch
      // Rolling off one key of a chord: move shortly (this is how rim sweeps are played) unless the rest follow at once.
      if(!pending)pending={at:t+releaseMs,kind:'release'};
    },
    advance,
    value:()=>({x,y}),
    active:()=>held.size>0||pending!==null||!Number.isNaN(latchUntil)||x!==0||y!==0,
    reset(){held.clear();chord.clear();x=0;y=0;pending=null;latchUntil=NaN;},
  };
}

/* ------------------------------------------------------------- key map */
export type SkateKeyAction=
  | {kind:'stick';dir:ArrowDir}                       // arrows / I J K L (IJKL off in easy mode)
  | {kind:'ride';dir:'push'|'brake'|'left'|'right'}   // W S A D
  | {kind:'hold';what:'sprint'|'powerslide'|'grind'|'manual'|'nose-manual'}
  | {kind:'grab';hand:'front'|'back'}
  | {kind:'once';what:'revert'|'respawn'|'marker'}
  | {kind:'easy';flipId:string|null;from:'tail'|'nose'};

/** Easy-keys accessibility mode: one key = one common trick (hold = crouch, release = pop; in the air, press = late flip). */
export const EASY_KEYS:Readonly<Record<string,{flipId:string|null;from:'tail'|'nose'}>>={
  j:{flipId:null,from:'tail'},o:{flipId:null,from:'nose'},
  f:{flipId:'kickflip',from:'tail'},h:{flipId:'heelflip',from:'tail'},v:{flipId:'pop-shove-it',from:'tail'},
  y:{flipId:'varial-kickflip',from:'tail'},u:{flipId:'360-flip',from:'tail'},
};

/** Normalise a KeyboardEvent-like to a lowercase name that ignores layout for letters when `code` is present. */
export function keyName(e:{key:string;code?:string}):string {
  const c=e.code??'';
  if(/^Key[A-Z]$/.test(c))return c.slice(3).toLowerCase();
  if(c.startsWith('Arrow'))return c.toLowerCase();
  if(c==='ShiftLeft'||c==='ShiftRight')return 'shift';
  return (e.key||'').toLowerCase();
}

export function skateKeyAction(name:string,mode:'flick'|'easy'):SkateKeyAction|null {
  switch(name){
    case 'arrowup':return {kind:'stick',dir:'up'};
    case 'arrowdown':return {kind:'stick',dir:'down'};
    case 'arrowleft':return {kind:'stick',dir:'left'};
    case 'arrowright':return {kind:'stick',dir:'right'};
    case 'w':return {kind:'ride',dir:'push'};
    case 's':return {kind:'ride',dir:'brake'};
    case 'a':return {kind:'ride',dir:'left'};
    case 'd':return {kind:'ride',dir:'right'};
    case 'shift':return {kind:'hold',what:'sprint'};
    case 'c':return {kind:'hold',what:'powerslide'};
    case 'g':return {kind:'hold',what:'grind'};
    case 'm':return {kind:'hold',what:'manual'};
    case 'n':return {kind:'hold',what:'nose-manual'};
    case 'q':return {kind:'grab',hand:'front'};
    case 'e':return {kind:'grab',hand:'back'};
    case 'x':return {kind:'once',what:'revert'};
    case 'r':return {kind:'once',what:'respawn'};
    case 't':return {kind:'once',what:'marker'};
  }
  if(mode==='easy'){const easy=EASY_KEYS[name];if(easy)return {kind:'easy',...easy};return null;}
  switch(name){
    case 'i':return {kind:'stick',dir:'up'};
    case 'k':return {kind:'stick',dir:'down'};
    case 'j':return {kind:'stick',dir:'left'};
    case 'l':return {kind:'stick',dir:'right'};
  }
  return null;
}
