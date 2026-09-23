/**
 * Trick naming + line scoring over SkateSimEvent[] (the sim never names tricks).
 *
 *   const score=createSkateScore({stance:'regular'});
 *   // every sim step:  const outcomes=score.step(events,simTimeSeconds);  hud.show(score.line());
 *
 * Names compose the way a skater says them:
 *   [Switch] [Fakie] [Nollie] [Frontside|Backside 180|360|540…] <Flip> [<Grab> (1.2s)] [Late <Flip>] [Revert]
 *   "Nollie Backside 180 Heelflip", "Fakie Frontside 360", "Switch Varial Kickflip", "Indy (1.2s)",
 *   "Kickflip to Manual", "Backside Smith Grind", "Ollie to 50-50", "Kickflip to Frontside Boardslide",
 *   "50-50 to Nosegrind", "Rock to Fakie", "Gap".
 * Stance prefixes come straight from the sim's pop event: `from:'nose'` = Nollie
 * (the up-then-down flick), `fakie` / `switch` flags = Fakie / Switch.
 * Grind Frontside/Backside needs an optional `frontside:boolean` on the
 * grind-start event (sim-owned field); without it the side word is omitted.
 *
 * Points: base × style (catch quality, spin, stance, air, grab time, grind
 * time/distance, clean landing), repeat penalty inside a line, multiplier =
 * distinct tricks (capped). A line stays open while busy (air / grind /
 * manual) and for keepAliveS after the last trick while rolling, then banks.
 * A bail loses it. Deterministic: no clocks, no randomness.
 */
import type {ScoreLine,ScoreOutcome,ScoredTrick,SkateSimEvent,Stance} from '../contract.ts';
import {OLLIE_POINTS,skateCatalogs,type SkateCatalogs} from './catalog.ts';

const OLLIE_GESTURE=['tail','nose'] as const;

export const SCORE_TUNING={
  keepAliveS:1.5,maxMultiplier:10,repeatDecay:.5,repeatFloor:.1,
  /** Grabs held at least this long show their time: "Indy (1.2s)". */
  grabShowS:.75,
  gapMin:2.5,gapMinAir:.35,
  /** Land → manual within this = "X to Manual"; land → revert within revertLinkS = "X Revert"; grind transfer window. */
  linkS:.3,revertLinkS:.45,transferS:.8,
  airOnlyMinS:.55,powerslideMinS:.4,
  /** A late flip this soon after the pop is the pop's own flip, read a beat late (matches the sim's FLIP_CORRECT_TIME). */
  upgradeS:.15,
} as const;

type Ev<K extends SkateSimEvent['kind']>=Extract<SkateSimEvent,{kind:K}>;
type Air={from:'tail'|'nose'|null;switch:boolean;fakie:boolean;flipId:string|null;height:number;late:string[];caught:Map<string,number>;grabs:{id:string;seconds:number}[];open:string|null;popT:number};
type Raw={label:string;raw:number};
type Grind={chain:string[];raw:number};

export const stancePrefix=(p:{from?:'tail'|'nose'|null;switch?:boolean;fakie?:boolean}):string=>
  [p.switch?'Switch':'',p.fakie?'Fakie':'',p.from==='nose'?'Nollie':''].filter(Boolean).join(' ');

/** Signed body spin (frontside +) → "Frontside 180" / "Backside 360" / "" (under ~150°). */
export function spinLabel(spinDeg:number):string {
  const n=Math.floor((Math.abs(Number.isFinite(spinDeg)?spinDeg:0)+30)/180);
  return n<1?'':`${spinDeg>0?'Frontside':'Backside'} ${n*180}`;
}
const secs=(s:number)=>`(${(Math.round(s*10)/10).toFixed(1)}s)`;
const join=(...parts:string[])=>parts.filter(Boolean).join(' ');

export type AirParts={prefix:string;spinDeg:number;flipId:string|null;late?:readonly string[];grab?:{id:string;seconds:number}|null};
/** Compose an air trick's label (exported for the HUD trick book / tests). */
export function airLabel(a:AirParts,cat:SkateCatalogs=skateCatalogs()):string {
  const spin=spinLabel(a.spinDeg),flip=a.flipId?cat.flips.get(a.flipId)?.name??a.flipId:'';
  const grab=a.grab?join(cat.grabs.get(a.grab.id)?.name??a.grab.id,a.grab.seconds>=SCORE_TUNING.grabShowS?secs(a.grab.seconds):''):'';
  const late=(a.late??[]).map(id=>`Late ${cat.flips.get(id)?.name??id}`).join(' ');
  let core=join(a.prefix,spin,flip);
  if(!flip&&!spin){
    // Plain pop: "Ollie", "Nollie", "Fakie Ollie", "Switch Ollie" — unless a grab/late flip carries the name.
    if(grab||late)core=a.prefix==='Nollie'?'Nollie':a.prefix;
    else core=a.prefix===''?'Ollie':a.prefix.endsWith('Nollie')?a.prefix:`${a.prefix} Ollie`;
  }
  return join(core,grab,late);
}

export interface SkateScore {
  /** Feed this step's sim events; `now` is sim time (s, same clock as event.t). Returns lines banked/lost this step. */
  step(events:readonly SkateSimEvent[],now:number):ScoreOutcome[];
  line():ScoreLine;
  /** Cash the open line now (e.g. finishing a challenge). */
  bank():ScoreOutcome[];
  /** Throw the open line away (pause, respawn, leaving the board). */
  drop(reason:string):ScoreOutcome[];
  setStance(stance:Stance):void;
  stance():Stance;
  reset():void;
}

export function createSkateScore(o:{stance?:Stance;catalogs?:SkateCatalogs}={}):SkateScore {
  const cat=o.catalogs??skateCatalogs(),T=SCORE_TUNING;
  let stance:Stance=o.stance??'regular';
  let tricks:ScoredTrick[]=[],raws:Raw[]=[],air:Air|null=null,grind:Grind|null=null,pendingChain:{chain:Grind;at:number}|null=null;
  let manual:{linked:boolean}|null=null,lastActive=0,lastLand=-Infinity,lastAirIndex=-1,clock=0,latest:string|null=null;

  const penalty=(label:string,exclude=-1)=>{let n=0;raws.forEach((r,i)=>{if(i!==exclude&&r.label===label)n++;});return Math.max(T.repeatFloor,Math.pow(T.repeatDecay,n));};
  function add(label:string,raw:number,t:number){
    raw=Math.max(0,Math.round(raw));
    const points=Math.round(raw*penalty(label));
    raws.push({label,raw});tricks.push({label,points});latest=label;lastActive=Math.max(lastActive,t);
    return tricks.length-1;
  }
  function replace(i:number,label:string,raw:number,t:number){
    raw=Math.max(0,Math.round(raw));
    raws[i]={label,raw};tricks[i]={label,points:Math.round(raw*penalty(label,i))};latest=label;lastActive=Math.max(lastActive,t);
  }
  const base=()=>tricks.reduce((s,k)=>s+k.points,0);
  const multiplier=()=>Math.max(1,Math.min(T.maxMultiplier,new Set(raws.map(r=>r.label)).size));
  const total=()=>Math.round(base()*multiplier());
  const busy=()=>air!==null||grind!==null||manual!==null;
  function clear(){tricks=[];raws=[];air=null;grind=null;pendingChain=null;manual=null;lastAirIndex=-1;latest=null;}
  function bankOut():ScoreOutcome[] {
    if(!tricks.length){clear();return [];}
    const out:ScoreOutcome={kind:'banked',points:total(),tricks:tricks.map(k=>k.label)};clear();return [out];
  }
  function lose(reason:string):ScoreOutcome[] {
    const points=total(),had=tricks.length>0;clear();
    return had?[{kind:'lost',points,reason}]:[];
  }

  function airPoints(a:Air,land:{spinDeg:number;boardClean:number;airTime:number}|null){
    const flip=a.flipId?cat.flips.get(a.flipId):undefined,n180=land?Math.floor((Math.abs(land.spinDeg)+30)/180):0;
    let pts=flip?flip.points*(.6+.4*(a.caught.get(flip.id)??.5)):OLLIE_POINTS;
    pts+=n180*120;if(flip&&n180)pts*=1+.25*n180;
    for(const id of a.late){const d=cat.flips.get(id);if(d)pts+=d.points*.8*(.6+.4*(a.caught.get(id)??.5));}
    for(const g of a.grabs){const d=cat.grabs.get(g.id);if(d)pts+=d.points*(1+Math.min(3,g.seconds)*.8);}
    pts*=(a.switch?1.3:1)*(a.fakie?1.1:1)*(a.from==='nose'?1.2:1);
    if(land)pts+=land.airTime*80+Math.max(0,a.height)*40;
    if(land)pts*=.75+.25*Math.max(0,Math.min(1,land.boardClean));
    return pts;
  }
  const mainGrab=(a:Air)=>a.grabs.reduce<{id:string;seconds:number}|null>((b,g)=>!b||g.seconds>b.seconds?g:b,null);
  const labelOf=(a:Air,spinDeg:number)=>airLabel({prefix:stancePrefix(a),spinDeg,flipId:a.flipId,late:a.late,grab:mainGrab(a)},cat);
  const notable=(a:Air,spinDeg:number,airTime:number)=>a.from!==null||a.flipId!==null||a.late.length>0||a.grabs.length>0||Math.abs(spinDeg)>=150||airTime>=T.airOnlyMinS;
  const openAir=(e:{switch?:boolean;fakie?:boolean}={}):Air=>({from:null,switch:Boolean(e.switch),fakie:Boolean(e.fakie),flipId:null,height:0,late:[],caught:new Map(),grabs:[],open:null,popT:NaN});
  /**
   * Keyboard flick-it pops when the flick lands; if the gesture goes on, the sim sends the longer
   * reading as a late flip. It is the POPPED trick (not "Late …") when it lands within upgradeS of
   * the last reading while still turning, or when its gesture carries on from it (kickflip → double).
   */
  const isUpgrade=(a:Air,e:Ev<'late-flip'>)=>{
    if(a.from===null||a.late.length||a.grabs.length||a.open)return false;
    if(e.t-a.popT<=T.upgradeS&&!(a.flipId&&a.caught.has(a.flipId)))return true;
    const g0=a.flipId?cat.flips.get(a.flipId)?.gesture:OLLIE_GESTURE,g1=cat.flips.get(e.flipId)?.gesture;
    return !!g0&&!!g1&&g0.length<g1.length&&g0.every((d,i)=>g1[i]===d);
  };

  function onLand(e:Ev<'land'>){
    const a=air??openAir(e);air=null;
    if(a.open){a.grabs.push({id:a.open,seconds:0});a.open=null;}
    lastAirIndex=-1;
    if(notable(a,e.spinDeg,e.airTime)){
      let label=labelOf(a,e.spinDeg);if(!a.from&&!a.flipId&&!a.late.length&&!a.grabs.length&&!spinLabel(e.spinDeg))label='Air';
      let raw=airPoints(a,e);if(label==='Air')raw=40*e.airTime;
      if(e.revert){label+=' Revert';raw+=100;}
      lastAirIndex=add(label,raw,e.t);
    }
    if(e.gap>=T.gapMin&&e.airTime>=T.gapMinAir)add('Gap',40+e.gap*25,e.t);
    lastLand=e.t;lastActive=Math.max(lastActive,e.t);
  }

  function onEvent(e:SkateSimEvent){
    clock=Math.max(clock,e.t);
    switch(e.kind){
      case 'pop':{
        air=openAir(e);air.from=e.from;air.flipId=e.flipId;air.height=e.height;air.popT=e.t;
        break;
      }
      case 'late-flip':{const a=air??=openAir();if(isUpgrade(a,e)){a.flipId=e.flipId;a.popT=e.t;}else a.late.push(e.flipId);break;}
      case 'flip-caught':(air??=openAir()).caught.set(e.flipId,Math.max(0,Math.min(1,e.quality)));break;
      case 'grab-start':(air??=openAir()).open=e.grabId;break;
      case 'grab-end':{const a=air??=openAir();a.grabs.push({id:e.grabId,seconds:e.seconds});if(a.open===e.grabId)a.open=null;break;}
      case 'land':onLand(e);break;
      case 'grind-start':{
        // Popped onto it: the air is the way in, one trick — "Ollie to 50-50", "Kickflip to Boardslide".
        const into=air&&(air.from!==null||air.flipId||air.late.length||air.grabs.length)?air:null;
        air=null;
        const def=cat.grinds.get(e.grindId),name=def?.name??e.grindId,side=(e as {frontside?:boolean}).frontside;
        const chained=pendingChain&&e.t-pendingChain.at<=T.transferS?pendingChain.chain:null;pendingChain=null;
        let label=chained?name:join(stancePrefix({switch:e.switch,fakie:e.fakie}),side===undefined?'':side?'Frontside':'Backside',name);
        if(into&&!chained)label=`${labelOf(into,0)} to ${label}`;
        grind=chained??{chain:[],raw:into?airPoints(into,null):0};grind.chain.push(label);
        break;
      }
      case 'grind-end':{
        const g=grind??{chain:[cat.grinds.get(e.grindId)?.name??e.grindId],raw:0};grind=null;
        const def=cat.grinds.get(e.grindId);
        g.raw+=(def?.points??100)*(.5+.6*Math.min(4,e.seconds))*(1+(def?.difficulty??0)*.5)+e.distance*12;
        if(e.exit==='transfer')pendingChain={chain:g,at:e.t};
        else if(e.exit!=='bail')add(g.chain.join(' to '),g.raw,e.t);
        lastActive=Math.max(lastActive,e.t);
        break;
      }
      // Landed into it: "Kickflip to Manual" (a Gap scored on that landing does not break the link).
      case 'manual-start':manual={linked:lastAirIndex>=0&&raws.slice(lastAirIndex+1).every(r=>r.label==='Gap')&&e.t-lastLand<=T.linkS};break;
      case 'manual-end':{
        const name=e.manual==='nose-manual'?'Nose Manual':'Manual',pts=50+e.seconds*70+e.distance*8,m=manual;manual=null;
        if(e.seconds<.2&&!m?.linked){lastActive=Math.max(lastActive,e.t);break;}
        if(m?.linked&&lastAirIndex>=0&&raws[lastAirIndex]){const prev=raws[lastAirIndex]!;replace(lastAirIndex,`${prev.label} to ${name}`,prev.raw+pts,e.t);}
        else add(name,pts,e.t);
        lastAirIndex=-1;
        break;
      }
      case 'powerslide':if(e.seconds>=T.powerslideMinS)add('Powerslide',30+e.seconds*40,e.t);break;
      case 'wallride':add('Wallride',150+e.seconds*100,e.t);break;
      case 'lip-trick':add(e.id==='rock-to-fakie'?'Rock to Fakie':e.id==='axle-stall'?'Axle Stall':'Disaster',e.id==='rock-to-fakie'?250:e.id==='axle-stall'?200:300,e.t);lastLand=e.t;lastAirIndex=tricks.length-1;break;
      case 'revert':{
        const i=tricks.length-1,r=raws[i];
        if(r&&e.t-lastLand<=T.revertLinkS&&!r.label.endsWith(' Revert'))replace(i,`${r.label} Revert`,r.raw+100,e.t);
        else if(!r||!r.label.endsWith(' Revert'))add('Revert',80,e.t);
        break;
      }
      case 'push':case 'recovered':break;
      case 'bail':break; // handled in step() so the outcome is returned
    }
  }

  return {
    step(events,now){
      const out:ScoreOutcome[]=[];
      for(const e of events){
        if(e.kind==='bail'){clock=Math.max(clock,e.t);out.push(...lose(e.reason));continue;}
        onEvent(e);
      }
      if(Number.isFinite(now))clock=Math.max(clock,now);
      if(pendingChain&&clock-pendingChain.at>T.transferS){const g=pendingChain.chain;pendingChain=null;add(g.chain.join(' to '),g.raw,clock);}
      if(tricks.length&&!busy()&&!pendingChain&&clock-lastActive>=T.keepAliveS)out.push(...bankOut());
      return out;
    },
    line(){
      const keepAlive=busy()||pendingChain?1:tricks.length?Math.max(0,Math.min(1,1-(clock-lastActive)/T.keepAliveS)):0;
      return {active:tricks.length>0||busy(),tricks:tricks.slice(),base:base(),multiplier:multiplier(),keepAlive,latest};
    },
    bank:()=>bankOut(),
    drop:(reason)=>lose(reason),
    setStance(s){stance=s==='goofy'?'goofy':'regular';},
    stance:()=>stance,
    reset(){clear();lastActive=0;lastLand=-Infinity;clock=0;},
  };
}
