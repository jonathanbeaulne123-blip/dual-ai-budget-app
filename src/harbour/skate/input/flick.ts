/**
 * Flick-it gesture recogniser: time-stamped samples of the 2D "board stick"
 * (x right, y up, both −1..1, screen space) → crouch / pop / late-flip / manual.
 *
 * Pure and deterministic: no timers, no globals, no allocation on the hot
 * path beyond the (tiny) gesture path array. Time is whatever clock the
 * caller uses (ms); feed() and tick() must be called with non-decreasing t.
 *
 * Frames:
 *  - screen  : raw stick, x right, y up.
 *  - stance  : x multiplied by `facing` so +x is ALWAYS toward the rider's
 *              toes (facing +1 regular, −1 goofy; switch and fakie each mirror
 *              once more — the aggregator computes it). y is unchanged: down
 *              is the end nearest the camera (the trailing end = your normal
 *              pop foot), up is the end leading the way.
 *  - origin  : the stance frame flipped nose↔tail when the load was on the
 *              nose (nollie), so every gesture is matched as if it started on
 *              the tail. That flip is exactly what makes a nollie kickflip a
 *              flick toward tail-heel — the back foot does the kicking.
 * Grammar, table and diagrams: NOTES-tricks.md.
 */
import type {FlickDir,Stance} from '../contract.ts';
import {SKATE_FLIPS} from '../tricks/catalog.ts';

/** Index k sits at k·45° clockwise from the nose (toward the toes). */
export const FLICK_DIRS:readonly FlickDir[]=['nose','nose-toe','toe','tail-toe','tail','tail-heel','heel','nose-heel'];
const DIR_INDEX:Readonly<Record<FlickDir,number>>={nose:0,'nose-toe':1,toe:2,'tail-toe':3,tail:4,'tail-heel':5,heel:6,'nose-heel':7};
const TAIL=4,NOSE=0,EIGHTH=Math.PI/4;
const isTerminal=(k:number)=>k===NOSE||k===1||k===7;
const mirrorY=(k:number)=>(12-k)%8;
const wrapSteps=(d:number)=>((d%8)+12)%8-4; // −4..3

export type FlickTiming={
  /** Centre flick: leaving the load/rim to reaching the rim again. */
  flickMs:number;
  /** One 45° step round the rim. Slower = wandering, the gesture is dropped. */
  stepMs:number;
  /** A 45° correction right after a centre arrival retargets it (chords, sloppy diagonals). */
  settleMs:number;
  /** Holding still on a nose-side sector this long completes the gesture. */
  dwellMs:number;
  /** Stick seen back in the centre this long (across samples, or after an explicit release) = released: the gesture completes. */
  restMs:number;
  /** With no new samples arriving, wait this much longer before trusting a lone centre sample (a fast flick can cross the centre between two 60 Hz samples). */
  restGraceMs:number;
  /** After snapping back to the tail mid-gesture, the next flick must start within this. */
  rearmMs:number;
  maxGestureMs:number;
};

export const FLICK_TUNING={
  rimIn:.78,rimOut:.64,rest:.22,shortFlick:.6,
  loadIn:.7,loadOut:.56,loadCone:38*Math.PI/180,
  manualMin:.2,manualMax:.6,manualExitMin:.12,manualExitMax:.68,manualCone:42*Math.PI/180,manualMs:110,manualCarryMs:200,
  sectorHysteresis:6*Math.PI/180,
  analog:{flickMs:190,stepMs:140,settleMs:70,dwellMs:90,restMs:24,restGraceMs:40,rearmMs:240,maxGestureMs:1300} satisfies FlickTiming,
  /** Keyboard/d-pad: positions jump, so windows are looser (see keyboard.ts for chord + latch). */
  digital:{flickMs:260,stepMs:240,settleMs:90,dwellMs:140,restMs:12,restGraceMs:0,rearmMs:340,maxGestureMs:2200} satisfies FlickTiming,
} as const;

/* -------------------------------------------------------------- the table */
const key=(path:readonly (FlickDir|number)[])=>path.map(p=>typeof p==='number'?FLICK_DIRS[p]:p).join('>');
/** Ollie is not a flip def; its gesture lives here. */
export const OLLIE_GESTURE:readonly FlickDir[]=Object.freeze(['tail','nose']);

export type FlickTable=ReadonlyMap<string,string|null>;
/** Build (and validate) the gesture → flipId table from a flip catalog. Throws on collisions. */
export function buildFlickTable(flips=SKATE_FLIPS):FlickTable {
  const table=new Map<string,string|null>([[key(OLLIE_GESTURE),null]]);
  for(const def of flips.values()){
    const k=key(def.gesture);
    if(def.gesture[0]!=='tail'||def.gesture.length<2)throw new Error(`flick gesture for ${def.id} must start on the tail`);
    if(table.has(k))throw new Error(`flick gesture collision: ${def.id} vs ${table.get(k)??'ollie'}`);
    table.set(k,def.id);
  }
  return table;
}
const DEFAULT_TABLE=buildFlickTable();

/** Pure matcher: stance/origin-normalised path → flipId, null for ollie, undefined for no trick. */
export function recogniseGesture(path:readonly FlickDir[],table:FlickTable=DEFAULT_TABLE):string|null|undefined {
  const k=key(path);return table.has(k)?table.get(k)!:undefined;
}
export function gestureFor(flipId:string|null):readonly FlickDir[]|null {
  if(flipId===null)return OLLIE_GESTURE;
  return SKATE_FLIPS.get(flipId)?.gesture??null;
}

/* --------------------------------------------------- drawing & synthesis */
const unit=(k:number,facing:number,origin:'tail'|'nose')=>{const s=origin==='nose'?mirrorY(k):k;return {x:Math.sin(s*EIGHTH)*facing,y:Math.cos(s*EIGHTH)};};
const round4=(n:number)=>Math.round(n*1e4)/1e4||0;

export type GestureSegment={kind:'rim'|'flick';from:{x:number;y:number};to:{x:number;y:number};steps:number};
/** Segments of a trick's gesture in SCREEN space (goofy mirrored), for the trick book. */
export function gestureSegments(flipId:string|null,stance:Stance='regular',origin:'tail'|'nose'='tail'):GestureSegment[] {
  const gesture=gestureFor(flipId);if(!gesture)return [];
  const facing=stance==='goofy'?-1:1,out:GestureSegment[]=[];
  for(let i=1;i<gesture.length;i++){
    const a=DIR_INDEX[gesture[i-1]!],b=DIR_INDEX[gesture[i]!],d=wrapSteps(b-a);
    out.push({kind:Math.abs(d)===1?'rim':'flick',from:unit(a,facing,origin),to:unit(b,facing,origin),steps:d});
  }
  return out;
}
/** Polyline of a trick's gesture in SCREEN space (x right, y up, unit circle); rim moves are drawn as arcs. */
export function gesturePath(flipId:string|null,stance:Stance='regular',origin:'tail'|'nose'='tail'):{x:number;y:number}[] {
  const gesture=gestureFor(flipId);if(!gesture)return [];
  const facing=stance==='goofy'?-1:1,first=unit(DIR_INDEX[gesture[0]!],facing,origin),pts=[{x:round4(first.x),y:round4(first.y)}];
  for(let i=1;i<gesture.length;i++){
    const a=DIR_INDEX[gesture[i-1]!],b=DIR_INDEX[gesture[i]!],d=wrapSteps(b-a);
    if(Math.abs(d)===1)for(let j=1;j<=3;j++){const ang=(a+d*j/3)*EIGHTH,s=origin==='nose'?Math.PI-ang:ang;pts.push({x:round4(Math.sin(s)*facing),y:round4(Math.cos(s))});}
    else{const p=unit(b,facing,origin);pts.push({x:round4(p.x),y:round4(p.y)});}
  }
  return pts;
}

export type StickSample={t:number;x:number;y:number};
/**
 * Time-stamped screen-space samples that perform a trick's gesture: load on
 * the end, flick/sweep, release. Used by tests, the trick-book demo and
 * anything that wants to "play" a gesture into a recogniser.
 */
export function gestureSamples(flipId:string|null,o:{stance?:Stance;facing?:1|-1;origin?:'tail'|'nose';t0?:number;loadMs?:number;stepMs?:number;flickMs?:number;hz?:number}={}):StickSample[] {
  const gesture=gestureFor(flipId);if(!gesture)return [];
  const facing=o.facing??(o.stance==='goofy'?-1:1),origin=o.origin??'tail',hz=o.hz??120,dt=1000/hz;
  const stepMs=o.stepMs??36,flickMs=o.flickMs??56,out:StickSample[]=[];let t=o.t0??0;
  const at=(k:number,mag=1)=>{const u=unit(k,facing,origin);return {x:u.x*mag,y:u.y*mag};};
  const push=(p:{x:number;y:number})=>{out.push({t:round4(t),x:round4(p.x),y:round4(p.y)});};
  // Ease into the load from the centre, then hold.
  for(let i=1;i<=4;i++){push(at(DIR_INDEX[gesture[0]!],i/4));t+=dt;}
  for(let held=0;held<(o.loadMs??90);held+=dt){push(at(DIR_INDEX[gesture[0]!]));t+=dt;}
  for(let i=1;i<gesture.length;i++){
    const a=DIR_INDEX[gesture[i-1]!],b=DIR_INDEX[gesture[i]!],d=wrapSteps(b-a);
    if(Math.abs(d)===1){
      const n=Math.max(1,Math.round(stepMs/dt));
      for(let j=1;j<=n;j++){const ang=(a+d*j/n)*EIGHTH,s=origin==='nose'?Math.PI-ang:ang;push({x:Math.sin(s)*facing,y:Math.cos(s)});t+=dt;}
    }else{
      const n=Math.max(2,Math.round(flickMs/dt)),p0=at(a),p1=at(b);
      for(let j=1;j<=n;j++){const u=j/n;push({x:p0.x+(p1.x-p0.x)*u,y:p0.y+(p1.y-p0.y)*u});t+=dt;}
      // Pull back to the tail: sit a beat (a real thumb does) before the next flick.
      if(b===TAIL&&i<gesture.length-1){push(p1);t+=dt;}
    }
  }
  // Let go: the stick springs home.
  push({x:0,y:0});t+=dt;push({x:0,y:0});
  return out;
}

/* ------------------------------------------------------------ recogniser */
export type FlickCompletion={flipId:string|null;from:'tail'|'nose';strength:number;at:number;path:readonly FlickDir[]};
export type FlickHeld={crouch:number;crouchEnd:'tail'|'nose'|null;manual:'manual'|'nose-manual'|null};
export type FlickView={x:number;y:number;mode:'idle'|'loaded'|'gesture'|'spent';origin:'tail'|'nose'|null;path:readonly FlickDir[]};

export interface FlickRecogniser {
  /** One raw screen-space stick sample at time t (ms). `settled`: the stick will stay here (button/finger released, key let go). */
  feed(t:number,x:number,y:number,settled?:boolean):void;
  /** Advance time with the stick held where it is (dwell / release / timeouts). */
  tick(t:number):void;
  /** Oldest completed gesture, or null. */
  take():FlickCompletion|null;
  held(t:number):FlickHeld;
  /** +1 = toes toward +x (regular, forward). Latched when a load starts. */
  setFacing(facing:1|-1):void;
  reset():void;
  view():FlickView;
}

type Mode=FlickView['mode'];

export function createFlickRecogniser(o:{digital?:boolean;table?:FlickTable;timing?:Partial<FlickTiming>}={}):FlickRecogniser {
  const T=FLICK_TUNING,W:FlickTiming={...(o.digital?T.digital:T.analog),...o.timing},table=o.table??DEFAULT_TABLE,digital=Boolean(o.digital);
  let facing:1|-1=1,latched:1|-1=1,mode:Mode='idle',origin:'tail'|'nose'='tail';
  let x=0,y=0,mag=0,lastT=-Infinity,path:number[]=[],rim=-1,rimRun=0;
  let inCentre=false,leftAt=0,restSince=NaN,restSettled=false,peakMag=0,peakSector=-1,arrivedAt=0,arrival:'centre'|'rim'='rim',lastStepAt=0,gestureAt=0,loadAt=0,depth=0,segMs=0,segKind:'centre'|'rim'='centre';
  let manualEnd:'tail'|'nose'|null=null,manualSince=NaN,manualOn=false,manualCarry:'tail'|'nose'|null=null;
  const done:FlickCompletion[]=[];

  const angleTo=(end:number)=>{const a=Math.atan2(x,y),c=end*EIGHTH;return Math.abs(Math.atan2(Math.sin(a-c),Math.cos(a-c)));};
  const sectorFrom=(prev:number)=>{
    const a=Math.atan2(x,y);let k=((Math.round(a/EIGHTH)%8)+8)%8;
    if(prev>=0&&k!==prev){const c=prev*EIGHTH,d=Math.abs(Math.atan2(Math.sin(a-c),Math.cos(a-c)));if(d<EIGHTH/2+T.sectorHysteresis)k=prev;}
    return k;
  };
  const toOrigin=(k:number)=>origin==='nose'?mirrorY(k):k;
  const loadEnd=():'tail'|'nose'|null=>mag>=T.loadIn?(angleTo(TAIL)<=T.loadCone?'tail':angleTo(NOSE)<=T.loadCone?'nose':null):null;

  function enterLoaded(t:number,end:'tail'|'nose'){
    mode='loaded';origin=end;latched=facing;path=[TAIL];rim=end==='tail'?TAIL:NOSE;rimRun=0;
    inCentre=false;restSince=NaN;loadAt=t;depth=mag;arrivedAt=t;lastStepAt=t;arrival='rim';
    // Loading out of an established manual keeps it (you pop out of manuals); a slow pull through the zone does not.
    if(manualOn&&t-manualSince>=T.manualMs+T.manualCarryMs)manualCarry=manualEnd;manualOn=false;manualSince=NaN;
  }
  function settleIdle(t:number){
    mode='idle';path=[];inCentre=false;restSince=NaN;
    const end=loadEnd();if(end){enterLoaded(t,end);return;}
    updateManual(t);
  }
  function spend(t:number){manualCarry=null;if(mag<T.loadOut)settleIdle(t);else{mode='spent';path=[];inCentre=false;}}
  function strength(){
    if(digital)return Math.min(1,.6+.4*Math.min(1,Math.max(0,(gestureAt-loadAt)/300)));
    const s=segKind==='centre'?1-(segMs-45)/(W.flickMs-45)*.65:1-(segMs-25)/(W.stepMs-25)*.6;
    return Math.round(Math.max(.35,Math.min(1,s))*1000)/1000;
  }
  function complete(t:number,upto=path.length){
    // Longest prefix that is a trick and ends on a nose-side sector (a thumb that overshoots keeps what it made).
    for(let n=upto;n>=2;n--){
      if(n<upto&&!isTerminal(path[n-1]!))continue;
      const dirs=path.slice(0,n).map(k=>FLICK_DIRS[k]!),id=table.get(key(dirs));
      if(id!==undefined){done.push({flipId:id,from:origin,strength:strength(),at:t,path:Object.freeze(dirs)});break;}
    }
    spend(t);
  }
  function abort(t:number){
    // Dropped gesture: if the thumb is back on a load end, that is a fresh load.
    manualCarry=null;
    if(loadEnd()){mode='idle';enterLoaded(t,loadEnd()!);}else spend(t);
  }
  function updateManual(t:number){
    if(mode!=='idle'){manualOn=false;manualSince=NaN;return;}
    const end=angleTo(TAIL)<=T.manualCone?'tail':angleTo(NOSE)<=T.manualCone?'nose':null;
    const inZone=end!==null&&(manualOn&&end===manualEnd?mag>=T.manualExitMin&&mag<T.manualExitMax:mag>=T.manualMin&&mag<=T.manualMax);
    if(!inZone){manualOn=false;manualSince=NaN;if(mag<T.manualExitMin)manualCarry=null;return;}
    if(end!==manualEnd||Number.isNaN(manualSince)){manualEnd=end;manualSince=t;manualOn=false;}
    if(t-manualSince>=T.manualMs)manualOn=true;
  }

  function tick(t:number){
    if(t<lastT)t=lastT;
    if(mode==='idle'){updateManual(t);return;}
    if(mode!=='gesture')return;
    if(t-gestureAt>W.maxGestureMs){abort(t);return;}
    if(inCentre){
      if(!Number.isNaN(restSince)){
        const seen=restSettled||lastT-restSince>=W.restMs;
        if((seen&&t-restSince>=W.restMs)||t-restSince>=W.restMs+W.restGraceMs){shortFlick();complete(Math.max(restSince+W.restMs,leftAt));return;}
      }
      if(t-leftAt>W.flickMs){shortFlick();complete(leftAt+W.flickMs);return;}
      return;
    }
    const last=path[path.length-1]!;
    if(last===TAIL){if(t-arrivedAt>W.rearmMs)complete(arrivedAt+W.rearmMs,path.length-1);return;}
    if(isTerminal(last)){if(t-Math.max(arrivedAt,lastStepAt)>=W.dwellMs)complete(Math.max(arrivedAt,lastStepAt)+W.dwellMs);return;}
    // Stalled on a side/tail-diagonal sector: the sweep went nowhere; keep whatever trick it had already made.
    if(t-lastStepAt>W.stepMs*1.5)complete(lastStepAt+W.stepMs*1.5);
  }

  function feed(t:number,rx:number,ry:number,settled=false){
    if(!Number.isFinite(t))return;
    if(t<lastT)t=lastT;
    tick(t);
    const f=mode==='idle'?facing:latched;
    x=Math.max(-1,Math.min(1,Number.isFinite(rx)?rx:0))*f;y=Math.max(-1,Math.min(1,Number.isFinite(ry)?ry:0));
    mag=Math.min(1,Math.hypot(x,y));restSettled=settled&&mag<T.rest;
    const prevT=lastT;lastT=t;
    switch(mode){
      case 'spent':if(mag<T.loadOut)settleIdle(t);return;
      case 'idle':{const end=loadEnd();if(end)enterLoaded(t,end);else updateManual(t);return;}
      case 'loaded':{
        depth=Math.max(depth,mag);
        const home=origin==='tail'?TAIL:NOSE;
        if(mag>=T.rimOut&&angleTo(home)>T.loadCone){
          // Off the load but still on the rim: a sweep (≤ 90°) or, with no sample in between, a jump flick.
          const s=sectorFrom(-1),o=toOrigin(s),d=wrapSteps(o-TAIL);
          mode='gesture';gestureAt=t;path=[TAIL];rim=s;inCentre=false;rimRun=0;
          if(Math.abs(d)<=2)appendRim(d,t,Math.max(1,t-prevT)/Math.abs(d));
          else arriveCentre(o,t,Math.max(0,t-prevT));
          return;
        }
        if(mag<T.loadOut||angleTo(home)>T.loadCone+.25){mode='gesture';gestureAt=t;inCentre=true;leftAt=t;restSince=mag<T.rest?t:NaN;peakMag=0;peakSector=-1;}
        return;
      }
      case 'gesture':{
        if(inCentre){
          if(mag>=T.rimIn){
            const s=sectorFrom(-1),o=toOrigin(s),travel=t-leftAt;
            inCentre=false;rim=s;restSince=NaN;
            if(travel>W.flickMs){abort(t);return;}
            if(o===TAIL&&path.length===1){enterLoaded(t,origin);return;} // released and re-loaded: still just a load
            arriveCentre(o,t,travel);
            return;
          }
          if(mag<T.rest){if(Number.isNaN(restSince))restSince=t;}else restSince=NaN;
          if(mag>peakMag&&t-leftAt<=W.flickMs){const o=toOrigin(sectorFrom(-1));if(isTerminal(o)){peakMag=mag;peakSector=o;}}
          return;
        }
        if(mag<T.rimOut){
          // A lone 45° nick on the way into a flick (a curved thumb) is not a sweep.
          if(rimRun===1&&path.length>=2)path.pop();
          rimRun=0;inCentre=true;leftAt=t;restSince=mag<T.rest?t:NaN;peakMag=0;peakSector=-1;return;
        }
        const s=sectorFrom(rim);if(s===rim)return;
        const o=toOrigin(s),last=path[path.length-1]!,d=wrapSteps(o-last);rim=s;
        if(arrival==='centre'&&Math.abs(d)===1&&t-arrivedAt<=W.settleMs&&path.length>=2&&last!==TAIL&&isTerminal(o)){
          // Correcting a flick that landed a sector off (or a key chord landing in two frames).
          path[path.length-1]=o;return;
        }
        if(Math.abs(d)<=2){
          if(t-lastStepAt>W.stepMs*Math.abs(d)){abort(t);return;}
          appendRim(d,t,(t-lastStepAt)/Math.abs(d));return;
        }
        // A big jump with no sample in between: treat as a flick through the centre.
        arriveCentre(o,t,Math.max(0,t-prevT));
        return;
      }
    }
  }
  /** A flick that springs back before a poll ever saw it on the rim still counts if it got most of the way there. */
  function shortFlick(){
    if(peakMag>=T.shortFlick&&peakSector>=0&&path[path.length-1]!==peakSector)arriveCentre(peakSector,leftAt,W.flickMs*.6);
    peakMag=0;peakSector=-1;
  }
  function arriveCentre(o:number,t:number,travel:number){
    if(o!==path[path.length-1])path.push(o);
    rimRun=0;arrival='centre';arrivedAt=t;lastStepAt=t;segMs=travel;segKind='centre';
  }
  function appendRim(d:number,t:number,perStep:number){
    const dir=Math.sign(d);let k=path[path.length-1]!;
    for(let i=0;i<Math.abs(d);i++){k=(k+dir+8)%8;path.push(k);}
    rimRun+=Math.abs(d);arrival='rim';arrivedAt=t;lastStepAt=t;segMs=perStep;segKind='rim';
  }

  return {
    feed,tick,
    take:()=>done.shift()??null,
    held(t){
      tick(t);
      const loaded=mode==='loaded'||mode==='gesture';
      const along=loaded&&mode==='loaded'?mag*Math.cos(angleTo(origin==='tail'?TAIL:NOSE)):depth;
      const crouch=loaded?Math.round(Math.max(0,Math.min(1,(along-.5)/.42))*1000)/1000:0;
      const end=manualOn?manualEnd:manualCarry;
      return {crouch,crouchEnd:loaded&&crouch>0?origin:null,manual:end===null?null:end==='tail'?'manual':'nose-manual'};
    },
    setFacing(f){facing=f===-1?-1:1;},
    reset(){mode='idle';path=[];x=y=mag=0;rim=-1;rimRun=0;inCentre=false;restSince=NaN;manualOn=false;manualSince=NaN;manualCarry=null;manualEnd=null;done.length=0;lastT=-Infinity;depth=0;},
    view:()=>({x:x*(mode==='idle'?facing:latched),y,mode,origin:mode==='loaded'||mode==='gesture'?origin:null,path:path.map(k=>FLICK_DIRS[k]!)}),
  };
}
