import {courseSignature,replayPose,type GhostPose,type ReplayAction} from './replay.ts';
import {groundHeightAt} from '../scene/ground.ts';
import {holdAshore,type Obstacle} from '../body/obstacles.ts';
import {raceCorridorAt} from '../body/geography.ts';
import {type ScoreLine,type ScoreOutcome,type SkateIntent,type SkatePresent,type SkateSimEvent,type Stance} from './contract.ts';
import {createSkateSim,type SkateSim,type SkateSimOptions} from './sim/index.ts';
import {createSkateInput,gesturePath as flickPath,type SkateInput} from './input/index.ts';
import type {GetPads} from './input/gamepad.ts';
import {createSkateScore,type SkateScore} from './tricks/score.ts';
import {resolveGrind,SKATE_FLIPS,SKATE_GRABS,SKATE_GRINDS,skateCatalogs} from './tricks/catalog.ts';
import {SKATE_DECKS,SKATE_ROUTES,SKATE_SPOTS,skateFieldFor,type SkateDeckId,type SkateRouteId,type SkateSpotId} from './park.ts';
import type {SkateWorldField} from './world/field.ts';
import {skateDressingSolids} from './world/dressingSolids.ts';
import {
  chooseSkateDeck,cloneSkateProgress,createSkateSession,observeSkate,retrySkateRoute,setSkateSettings,setSkateTables,skateTables,startSkateRoute,
  type SkateProgress,type SkateSession,type SkateSettings,type SkateRun,
} from './session.ts';
import {buildHudModel,type ControlHint,type ControlHintSet,type Glyph,type SkateHudModel} from './hud/model.ts';
import type {TrickBook} from './hud/PauseBook.tsx';
import type {SkateAudio} from './audio.ts';

/**
 * Tideline Skate Club v2 · the driver.
 *
 * The one object that owns a ride: the sim (SIM), the flick-it input (TRICKS),
 * the scorer (TRICKS), and the session/progress (SHOW), all on the one shared
 * park field (PARK). No frames, no DOM listeners, no three.js and no storage:
 * the walker steps it inside the frame the renderer lease already owns, the
 * look draws what it says, and HarbourWorld routes keys/pointers into
 * `input()` and saves `progress()`.
 */

export type SkateCheckpoint={version:2;sim:unknown;session:SkateSession;simTime:number};
export type SkateStep={
  /** Keep the shared frame alive for motion or a connected controller waiting to resume. */
  moving:boolean;
  /** Points of a line banked this frame (0 if none): the look celebrates it. */
  banked:number;
};
export type SkateControls={
  active():boolean;
  /** Travel heading while riding (null on foot). */
  heading():number|null;
  enable(on:boolean,progress?:SkateProgress):boolean;
  pause(on:boolean):void;
  paused():boolean;
  /** The HUD model right now (build it at most a few times a second; `createHudThrottle` gates React). */
  hud():SkateHudModel|null;
  progress():SkateProgress|null;
  /** Revision of the saved progress (changes whenever it should be written again). */
  revision():number;
  route(id:SkateRouteId|null):void;
  spot(id:SkateSpotId):void;
  deck(id:SkateDeckId):void;
  settings(patch:Partial<SkateSettings>):void;
  current():SkateSettings|null;
  run():SkateRun|null;
  /** Ghost is decorative, never a player/presence body. Null while paused, inactive or reduced effects. */
  ghost():GhostPose|null;
  replay(action:ReplayAction):void;
  /**
   * `retry` during a race: back to the last gate passed, the run (and its
   * clock) kept; outside a race it is `respawn`. `respawn`: back to your marker
   * (a race in progress is retried, never cancelled).
   */
  command(command:'respawn'|'marker'|'retry'):void;
  checkpoint():SkateCheckpoint|null;
  restore(checkpoint:SkateCheckpoint):void;
  /** The input to route keys, pointers, touch zones into (present only while riding). */
  input():SkateInput|null;
  present():SkatePresent|null;
  /** Every sim event of the last stepped frame (concatenated). */
  events():readonly SkateSimEvent[];
  /** True once after a respawn/spot/route/restore: cameras cut instead of chase. */
  takeCut():boolean;
  setAudio(audio:SkateAudio|null):void;
};

/** What the driver needs from where it rides. Island obstacles are read when the board is put down. */
export type SkateDriverWorld={obstacles:readonly Obstacle[]};

/**
 * Sim options for the island (integration seam: island obstacles merged with
 * the park, shoreline held). Travel assist everywhere outside trick zones, but
 * the real slope on the race corridor: the mountain road is a descent.
 */
export function skateSimOptions(obstacles:readonly Obstacle[],field:SkateWorldField=skateField()):Pick<SkateSimOptions,'islandObstacles'|'shore'|'extraSolids'|'complexPhysicsAt'|'slopeGravityAt'> {
  return {islandObstacles:obstacles,shore:holdAshore,extraSolids:skateDressingSolids(field),complexPhysicsAt:field.trickZoneAt,slopeGravityAt:raceCorridorAt};
}
/** The run-out after the finish lasts until the board has stopped, or this long at most (seconds). */
export const RUNOUT_SECONDS=9;

/** The catalogs every part of the ride uses, with TRICKS' grind namer injected into the sim. */
export const SKATE_CATALOGS=Object.freeze({...skateCatalogs(),resolveGrind});

/** The one park field (render and physics share it: `buildSkatePark(dressing,{field:skateField()})`). */
export const skateField=():SkateWorldField=>skateFieldFor(groundHeightAt);

let tablesSet=false;
/** Hand the session the real park and catalogs (once). */
export function useRealSkateTables():void {
  if(tablesSet)return;tablesSet=true;
  const field=skateField();
  const features=field.pads.flatMap(p=>p.shapes).filter(s=>['quarter','mini','bowl','kicker'].includes(s.def.type)).map(s=>({id:s.def.id,name:s.def.name,x:s.frame.x,z:s.frame.z}));
  setSkateTables({spots:field.spots,routes:SKATE_ROUTES,decks:SKATE_DECKS,grindables:field.grindables,features,
    flips:[...SKATE_FLIPS.values()],grinds:[...SKATE_GRINDS.values()]});
}

/* ------------------------------------------------------------------ hints and the trick book */
const key=(label:string):Glyph=>({kind:'key',label});
const hint=(id:string,label:string,...glyphs:Glyph[]):ControlHint=>({id,glyphs,label});
/** The real bindings (TRICKS input/NOTES-tricks.md), by device and phase, for the HUD. */
export function skateHints(mode:SkateSettings['controls']):ControlHintSet {
  const easy=mode==='easy';
  const pop=easy?[hint('pop','Ollie',key('J')),hint('flip','Kickflip · heelflip',key('F'),key('H'))]:[hint('pop','Pull back, flick up: ollie',key('↓'),key('↑')),hint('flip','Flick to a corner: flip',key('↓'),key('←'),key('→'))];
  return {
    keyboard:{
      ride:[hint('push','Push',key('W')),hint('carve','Carve',key('A'),key('D')),hint('jump','Jump',key('Space')),...pop,hint('manual','Manual',key('M')),hint('slide','Powerslide',key('C'))],
      air:[hint('grab','Grab',key('Q'),key('E')),hint('spin','Spin',key('A'),key('D')),hint('grind-pick','Rail ahead: W A S D as you land on it picks the grind',key('W'),key('A'),key('S'),key('D')),hint('grind','Lock onto a rail',key('G')),hint('revert','Revert',key('X'))],
      grind:[hint('balance','Balance',key('A'),key('D')),hint('out','Pop out',key('↓'),key('↑'))],
      manual:[hint('balance','Balance',key('W'),key('S')),hint('out','Pop out',key('↓'),key('↑'))],
      bail:[hint('reset','Back to your marker',key('R'))],
    },
    pointer:{
      ride:[hint('push','Push',key('W')),hint('carve','Carve',key('A'),key('D')),hint('pop','Hold and drag down, flick up',{kind:'mouse',motion:'flick'}),hint('flip','Flick to a corner: flip',{kind:'mouse',motion:'drag'})],
      air:[hint('grab','Right button: grab',{kind:'mouse',motion:'click'}),hint('spin','Spin',key('A'),key('D')),hint('grind-pick','Rail ahead: W A S D as you land on it picks the grind',key('W'),key('A'),key('S'),key('D'))],
      grind:[hint('balance','Balance',key('A'),key('D')),hint('out','Pop out',{kind:'mouse',motion:'flick'})],
      manual:[hint('balance','Balance',key('W'),key('S'))],
      bail:[hint('reset','Back to your marker',key('R'))],
    },
    gamepad:{
      ride:[hint('push','Push',{kind:'pad',button:'south'}),hint('carve','Carve',{kind:'stick',side:'left',motion:'side'}),hint('pop','Pop',{kind:'stick',side:'right',motion:'down-up'}),hint('flip','Flip',{kind:'stick',side:'right',motion:'down-side'})],
      air:[hint('grab','Grab',{kind:'pad',button:'lb'},{kind:'pad',button:'rb'}),hint('spin','Spin',{kind:'stick',side:'left',motion:'side'}),hint('grind-pick','Rail ahead: the left stick as you land on it picks the grind',{kind:'stick',side:'left',motion:'any'}),hint('grind','Lock on',{kind:'pad',button:'rt'})],
      grind:[hint('balance','Balance',{kind:'stick',side:'left',motion:'side'}),hint('out','Pop out',{kind:'stick',side:'right',motion:'down-up'})],
      manual:[hint('balance','Balance',{kind:'stick',side:'left',motion:'any'})],
      bail:[hint('reset','Back to your marker',{kind:'pad',button:'north'})],
    },
  };
}
/** SVG path (viewBox "-1 -1 2 2", y down toward the tail) of a flip's flick-it gesture. */
export function skateGesturePath(flipId:string,stance:Stance):string|null {
  const pts=flickPath(flipId==='ollie'?null:flipId,stance);
  if(!pts.length)return null;
  return pts.map((p,i)=>`${i?'L':'M'}${(p.x*.8).toFixed(3)} ${(-p.y*.8).toFixed(3)}`).join(' ');
}
/**
 * How a person picks each grind (TRICKS input/NOTES-tricks.md "Grinds", the feel pass): the board's angle at
 * contact picks the family (along the line = a truck grind, swung across = a slide) and the left stick at contact
 * picks the grind in it. "Toward" = toward the rail or ledge, "forward/back" = the nose/tail end (W/S on keys).
 */
export const SKATE_GRIND_HOW:Readonly<Record<string,string>>=Object.freeze({
  '50-50':'Along the rail, stick centred.',
  '5-0':'Along the rail, stick back (S).',
  'nosegrind':'Along the rail, stick forward (W).',
  'feeble':'Along the rail, stick toward it.',
  'smith':'Along the rail, stick away from it.',
  'overcrook':'Along the rail, stick toward it and forward.',
  'salad':'Along the rail, stick toward it and back.',
  'crooked':'Along the rail, stick away and forward.',
  'suski':'Along the rail, stick away and back.',
  'boardslide':'Across: hold toward it through contact (front end over).',
  'lipslide':'Across: hold away through contact (tail over).',
  'noseslide':'Across, stick forward at contact.',
  'tailslide':'Across, stick back at contact.',
  'noseblunt':'Across, stick toward it and forward: push it over.',
  'bluntslide':'Across, stick toward it and back: push it over.',
});
export const SKATE_TRICK_BOOK:TrickBook={
  flips:[{id:'ollie',name:'Ollie',points:60},...[...SKATE_FLIPS.values()].map(f=>({id:f.id,name:f.name,points:f.points}))],
  grinds:[...SKATE_GRINDS.values()].map(g=>({id:g.id,name:g.name,points:g.points,...(SKATE_GRIND_HOW[g.id]?{detail:SKATE_GRIND_HOW[g.id]}:{})})),
  grindsNote:'Pick a grind with the left stick (W A S D on keys) as you touch the rail. Board along the rail: a grind. Swing it across in the air (hold the side key about a quarter second): a slide.',
  grabs:[...SKATE_GRABS.values()].map(g=>({id:g.id,name:g.name,points:g.points})),
};

/* ------------------------------------------------------------------ the driver */
const EMPTY_LINE:ScoreLine={active:false,tricks:[],base:0,multiplier:1,keepAlive:0,latest:null};

export type SkateDriverOptions={
  /** The clock (ms) `sample()` reads; event timeStamps must share it. Default `performance.now()`. */
  now?:()=>number;
  reducedMotion?:()=>boolean;
  /** Gamepad source for the input (default `navigator.getGamepads`). The Skate Lab injects a virtual pad. */
  getGamepads?:GetPads|null;
  /** Dev/test hook (Skate Lab): an intent that replaces the input's sample for this step when non-null. */
  intent?:()=>SkateIntent|null;
};
export function createSkateDriver(world:SkateDriverWorld,options:SkateDriverOptions={}){
  const now=options.now??(()=>typeof performance!=='undefined'?performance.now():Date.now());
  const field=skateField();
  useRealSkateTables();
  let sim:SkateSim|null=null,input:SkateInput|null=null,score:SkateScore|null=null;
  let session:SkateSession=createSkateSession(),paused=false,cut=false,simTime=0,audio:SkateAudio|null=null;
  let outcome:{outcome:ScoreOutcome;seq:number}|null=null,outcomeSeq=0;
  const frame:SkateSimEvent[]=[];
  let ghostEnabled=false,replayTime:number|null=null;
  /** Seconds of finish run-out left (0: none). */
  let runoutLeft=0,runoutFor:object|null=null;
  const savedReplay=()=>{const r=session.progress.raceReplay,course=r&&skateTables().routes.find(c=>c.id===r.course);return r&&course&&r.signature===courseSignature(course)?r:null;};
  const quiet=()=>Boolean(settings().reducedEffects||(options.reducedMotion?.()??(typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches)));
  const settings=()=>session.progress.settings;

  function applySettings(){
    const s=settings();
    sim?.setStance(s.stance);score?.setStance(s.stance);input?.setMode(s.controls);
  }
  function syncInput(p:SkatePresent){input?.setStance(p.stance,{switch:p.switch,fakie:p.fakie});}
  function mount(x:number,z:number,yaw:number,progress?:SkateProgress,position?:{y:number;vy?:number;supportId?:string}){
    replayTime=null;ghostEnabled=false;
    session=createSkateSession(progress?cloneSkateProgress(progress):undefined);
    const s=settings();
    sim=createSkateSim(field,SKATE_CATALOGS,{x,z,yaw,...position,stance:s.stance,...skateSimOptions(world.obstacles,field)});
    input=createSkateInput({stance:s.stance,mode:s.controls,...(options.getGamepads!==undefined?{getGamepads:options.getGamepads}:{})});
    score=createSkateScore({stance:s.stance,catalogs:SKATE_CATALOGS});
    paused=false;cut=true;simTime=0;outcome=null;frame.length=0;runoutLeft=0;runoutFor=null;
    syncInput(sim.present());
  }
  function restart(x:number,z:number,yaw:number){
    if(!sim)return;
    replayTime=null;
    sim.reset(x,z,yaw);score?.reset();input?.reset();frame.length=0;cut=true;paused=false;runoutLeft=0;sim.setRunout(false);
  }
  /** Back to the last gate passed, facing through it; the run and its clock carry on. */
  function retryRace():boolean{
    const run=session.run;if(!sim||!run||run.finished)return false;
    if(run.countdown>0)return true; // Consume Retry without abandoning the countdown.
    const route=skateTables().routes.find(r=>r.id===run.id),gate=route?.gates?.[Math.max(0,run.checkpoint-1)];
    if(!route||!gate)return false;
    const [nx,nz]=gate.normal;
    const offset=run.checkpoint===0?-1.2:1.2;
    sim.placeAt(gate.at[0]+nx*offset,gate.at[2]+nz*offset,Math.atan2(nx,nz),gate.at[1]);
    retrySkateRoute(session);score?.reset();input?.reset();frame.length=0;cut=true;replayTime=null;
    return true;
  }
  function note(outs:readonly ScoreOutcome[]):number{
    let banked=0;
    for(const o of outs){outcome={outcome:o,seq:++outcomeSeq};if(o.kind==='banked')banked=Math.max(banked,o.points);}
    return banked;
  }

  const api={
    active:()=>sim!==null,
    heading:()=>sim?sim.present().heading:null,
    paused:()=>paused,
    present:()=>sim?sim.present():null,
    events:()=>frame,
    input:()=>input,
    progress:()=>sim?session.progress:null,
    revision:()=>session.revision,
    current:()=>sim?settings():null,
    takeCut(){const c=cut;cut=false;return c;},
    /** The owner (HarbourWorld, which creates it inside the sound-on click) disposes it. */
    setAudio(next:SkateAudio|null){audio=next;},
    /** Put the board down where the body stands (returns false if already riding). */
    mount,
    /** Pick the board up. Returns where it was. */
    unmount(){
      const p=sim?.present()??null;
      if(score&&sim){const outs=score.drop('walk');if(outs.length)observeSkate(session,sim.present(),[],outs[0]!,0);}
      replayTime=null;ghostEnabled=false;
      sim=null;input?.reset();input=null;score=null;paused=false;frame.length=0;outcome=null;
      audio?.update(null,[],0,{paused:true});
      return p?{x:p.x,y:p.y,z:p.z,yaw:p.boardYaw,heading:p.heading,vy:p.vy,clearance:p.clearance}:null;
    },
    pause(on:boolean){
      if(!sim)return;
      paused=on;input?.reset();frame.length=0;
      audio?.update(sim.present(),[],0,{paused:on});
    },
    /** One rendered frame: sample the input, step the sim, score, observe. */
    step(dt:number):SkateStep{
      frame.length=0;
      if(!sim||!input||!score)return {moving:false,banked:0};
      const step=Math.min(.1,Math.max(0,Number.isFinite(dt)?dt:0));
      const controls=paused||replayTime!==null?input.pollControls():null;
      if(controls?.pause??input.pausePressed()){api.pause(!paused);}
      if(paused){audio?.update(sim.present(),[],step,{paused:true});return {moving:(controls??input.pollControls()).connected,banked:0};}
      if(replayTime!==null){
        const replay=savedReplay();
        if(!replay||quiet()){replayTime=null;return {moving:false,banked:0};}
        replayTime=Math.min(replay.seconds,replayTime+step);
        audio?.update(null,[],0,{paused:true});
        return {moving:replayTime<replay.seconds||Boolean(controls?.connected),banked:0};
      }
      const before=sim.present();
      syncInput(before);
      const airborne=before.phase==='air';
      const rolling=before.speed>.15&&before.phase!=='bail'&&before.phase!=='recover';
      const intent:SkateIntent=options.intent?.()??input.sample(now(),airborne,rolling,{landingSoon:airborne&&before.clearance<.15&&before.vy<0});
      const waiting=(session.run?.countdown??0)>0;
      let banked=0;
      if(!waiting){
        // R in a race is Retry: the last gate, the run kept (it used to cancel the race).
        const retried=intent.respawn&&retryRace();
        if(intent.respawn&&!retried){const outs=score.drop('respawn');banked=note(outs);session.run=null;cut=true;}
        const r=sim.step(retried?{...intent,respawn:false}:intent,step);
        simTime+=step;
        for(const e of r.events)frame.push(e);
        if(frame.length)simTime=Math.max(simTime,frame[frame.length-1]!.t);
        const outs=score.step(frame,simTime);
        banked=Math.max(banked,note(outs));
        const p=r.present;
        observeSkate(session,p,frame,outs[0]??null,step);
        for(let i=1;i<outs.length;i++)observeSkate(session,p,[],outs[i]!,0);
        syncInput(p);
        // The finish run-out: from the line until the board has stopped, braked, and the shore is a bumper.
        const run=session.run;
        if(run?.finished&&runoutFor!==run){runoutFor=run;runoutLeft=RUNOUT_SECONDS;}
        if(runoutLeft>0){runoutLeft=Math.max(0,runoutLeft-step);if(p.speed<.3&&p.phase!=='air')runoutLeft=0;}
        if(!run?.finished)runoutLeft=0;
        sim.setRunout(runoutLeft>0);
      }else{
        observeSkate(session,sim.present(),[],null,step);
        if(intent.respawn)cut=true;
      }
      const p=sim.present();
      audio?.update(p,frame,step,{paused:false});
      const line=score.line();
      return {moving:waiting||Boolean(session.run&&!session.run.finished)||p.speed>.01||p.phase!=='idle'||line.active||frame.length>0,banked};
    },
    hud():SkateHudModel|null{
      if(!sim)return null;
      const model=buildHudModel({
        present:sim.present(),line:score?.line()??EMPTY_LINE,outcome,session,paused,
        inputDevice:input?.activeDevice()??'keyboard',grindName:id=>SKATE_GRINDS.get(id)?.name??id,
        hints:skateHints(settings().controls),tables:skateTables(),
      });
      const replay=savedReplay(),pose=api.ghost();
      model.replay={available:Boolean(replay),seconds:replay?.seconds??0,playing:replayTime!==null,time:replayTime??0,ghostEnabled,reduced:quiet(),pose,path:replay?.samples.filter((_,i)=>i%5===0).map(s=>[s[1],s[3]] as const)??[]};
      model.sig+=`|replay:${replay?.seconds??0}:${replayTime===null?'off':replayTime.toFixed(1)}:${ghostEnabled}:${quiet()}:${pose?.x.toFixed(1)}:${pose?.z.toFixed(1)}`;
      return model;
    },
    route(id:SkateRouteId|null){
      if(!sim)return;
      runoutLeft=0;sim.setRunout(false);
      if(!id){replayTime=null;session.run=null;session.revision++;return;}
      const route=SKATE_ROUTES.find(r=>r.id===id);if(!route)return;
      const a=route.points[0]!,b=route.points[1]!;
      restart(a[0],a[1],Math.atan2(b[0]-a[0],b[1]-a[1]));startSkateRoute(session,id);
    },
    spot(id:SkateSpotId){
      if(!sim)return;
      const spot=SKATE_SPOTS.find(s=>s.id===id);
      if(!spot||(id!=='tideline'&&!session.progress.discovered.includes(id)))return;
      restart(spot.start[0],spot.start[1],spot.startYaw);session.run=null;
    },
    deck(id:SkateDeckId){chooseSkateDeck(session,id);},
    settings(patch:Partial<SkateSettings>){setSkateSettings(session,patch);applySettings();},
    command(c:'respawn'|'marker'|'retry'){
      if(!sim)return;
      if((c==='retry'||c==='respawn')&&retryRace())return;
      if(c==='respawn'||c==='retry'){replayTime=null;sim.toMarker();const outs=score?.drop('respawn')??[];note(outs);session.run=null;input?.reset();cut=true;}
      else if(!sim.setMarker())session.message='Stop on flat ground to set your marker';
      else session.message='Marker set · R brings you back';
    },
    checkpoint():SkateCheckpoint|null{return sim?{version:2,sim:sim.save(),session:structuredClone(session),simTime}:null;},
    restore(cp:SkateCheckpoint){
      if(!cp||cp.version!==2)return;
      replayTime=null;ghostEnabled=false;
      const saved=structuredClone(cp.session);
      if(!sim)mount(0,0,0,saved.progress);
      session=saved;sim!.load(structuredClone(cp.sim));simTime=cp.simTime||0;
      score?.reset();input?.reset();applySettings();paused=true;cut=true;frame.length=0;outcome=null;
    },
    ghost():GhostPose|null {
      if(!sim||paused||quiet())return null;const replay=savedReplay();if(!replay)return null;
      if(replayTime!==null)return replayPose(replay,replayTime,'replay');
      const run=session.run;if(!ghostEnabled||!run||run.id!==replay.course||run.countdown>0||run.finished)return null;
      return replayPose(replay,run.elapsed,'race');
    },
    replay(action:ReplayAction){
      if(!sim)return;
      if(action==='stop'){replayTime=null;input?.reset();return;}
      if(action==='toggle-ghost'){ghostEnabled=!ghostEnabled;return;}
      if(!savedReplay()||quiet()||(session.run&&!session.run.finished))return;
      replayTime=0;paused=false;input?.reset();frame.length=0;audio?.update(null,[],0,{paused:true});
    },
    /** The finish run-out is braking the board right now. */
    runout:()=>runoutLeft>0,
    deckId:():SkateDeckId=>session.progress.deck,
    stance:():Stance=>settings().stance,
    run:()=>session.run,
  };
  return api;
}
export type SkateDriver=ReturnType<typeof createSkateDriver>;

/** The act and progress a partner sees on the wire (bounded, coarse; `skate-*` only). */
export function skateAct(p:SkatePresent|null,moving=true):{act:string;p:number}|null {
  if(!p)return null;
  const clamp=(v:number)=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
  if(p.phase==='bail'||p.phase==='recover')return {act:'skate-bail',p:clamp((p.bail?.t??.85)/1.1)};
  if(p.phase==='grind')return {act:'skate-grind',p:clamp((p.balance+1)/2)};
  if(p.phase==='manual'||p.manual)return {act:'skate-manual',p:clamp((p.balance+1)/2)};
  if(p.phase==='air'){
    if(p.trick){
      const def=SKATE_FLIPS.get(p.trick.flipId),u=clamp(p.trick.u);
      if(!def)return {act:'skate-ollie',p:u};
      if(def.roll!==0&&Math.abs(def.yaw)>=2)return {act:'skate-360-flip',p:u};
      if(def.roll>0)return {act:'skate-kickflip',p:u};
      if(def.roll<0)return {act:'skate-heelflip',p:u};
      if(def.yaw!==0)return {act:'skate-shuvit',p:u};
      return {act:'skate-ollie',p:u};
    }
    const arc=clamp(p.airTime/.9);
    return p.grab?{act:'skate-grab',p:arc}:{act:'skate-ollie',p:arc};
  }
  return {act:'skate',p:moving&&p.phase==='push'?clamp(p.pushPhase):0};
}
