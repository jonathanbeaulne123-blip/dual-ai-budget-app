/**
 * Tideline Skate Club v2 — trick catalogs (flip tricks, grabs, grinds/slides).
 *
 * Board-motion sign conventions (FlipTrickDef, board space, regular rider,
 * mirrored by the look track for goofy exactly like the rider mesh):
 *  - roll  : full turns about the nose–tail axis. + = toeside edge rises and
 *            the board turns toward the heels (kickflip = +1, heelflip = −1).
 *  - yaw   : half turns about the board's up axis. + = BACKSIDE (the tail
 *            swings behind the rider, toward the heels); − = frontside.
 *            Pop shove-it = +1, frontside shove-it = −1, 360 shove-it = +2.
 *  - pitch : full turns about the width axis. + = the nose rises and wraps
 *            back over the tail around the back foot (impossible);
 *            − = the nose drops and the board somersaults forward (dolphin).
 * Nollie / switch / fakie are NOT separate defs: they are prefixes composed
 * by the scorer from sim state (see score.ts).
 *
 * Gestures are stance-normalised FlickDir paths starting at the load end
 * ('tail'); nollie mirrors them nose↔tail. The table, its grammar and the
 * ASCII diagrams live in input/NOTES-tricks.md; input/flick.ts recognises it.
 */
import type {FlickGesture,FlipTrickDef,GrabDef,GrindDef} from '../contract.ts';

const HALF_PI=Math.PI/2;

/* ----------------------------------------------------------- gesture pieces */
// Rim sweeps start on the tail and roll round one side of the stick.
const SWEEP_HEEL=['tail','tail-heel','heel','nose-heel'] as const;   // → varial kickflip ends here
const SWEEP_TOE=['tail','tail-toe','toe','nose-toe'] as const;       // → varial heelflip ends here
const CIRCLE_HEEL=['tail','tail-heel','heel','nose-heel','nose','nose-toe','toe','tail-toe','tail'] as const;
const CIRCLE_TOE=['tail','tail-toe','toe','nose-toe','nose','nose-heel','heel','tail-heel','tail'] as const;
const g=(...parts:readonly (readonly FlickGesture[number][])[]):FlickGesture=>Object.freeze(parts.flat());

type FlipSpec=Omit<FlipTrickDef,'id'>;
const flip=(id:string,spec:FlipSpec):[string,FlipTrickDef]=>[id,Object.freeze({id,...spec,gesture:Object.freeze([...spec.gesture])})];

/**
 * Flip tricks. Durations are seconds of board motion at a standard pop;
 * points are the base value before style modifiers; difficulty 0..1 scales
 * catch-window strictness in the sim.
 */
export const SKATE_FLIPS:ReadonlyMap<string,FlipTrickDef>=new Map([
  // Single flicks through the centre: pull back, flick to a nose diagonal.
  flip('kickflip',{name:'Kickflip',gesture:g(['tail','nose-heel']),roll:1,yaw:0,pitch:0,duration:.42,points:300,difficulty:.25}),
  flip('heelflip',{name:'Heelflip',gesture:g(['tail','nose-toe']),roll:-1,yaw:0,pitch:0,duration:.42,points:300,difficulty:.28}),
  // Doubles = do the flick twice (snap back to the tail, flick again); triples three times.
  flip('double-kickflip',{name:'Double Kickflip',gesture:g(['tail','nose-heel','tail','nose-heel']),roll:2,yaw:0,pitch:0,duration:.62,points:700,difficulty:.6}),
  flip('double-heelflip',{name:'Double Heelflip',gesture:g(['tail','nose-toe','tail','nose-toe']),roll:-2,yaw:0,pitch:0,duration:.62,points:700,difficulty:.62}),
  flip('triple-kickflip',{name:'Triple Kickflip',gesture:g(['tail','nose-heel','tail','nose-heel','tail','nose-heel']),roll:3,yaw:0,pitch:0,duration:.82,points:1300,difficulty:.88}),
  flip('triple-heelflip',{name:'Triple Heelflip',gesture:g(['tail','nose-toe','tail','nose-toe','tail','nose-toe']),roll:-3,yaw:0,pitch:0,duration:.82,points:1300,difficulty:.9}),
  // Half-circle rim sweeps: the side you roll round is the shove direction; where you stop is the flip.
  flip('pop-shove-it',{name:'Pop Shove-it',gesture:g(SWEEP_HEEL,['nose']),roll:0,yaw:1,pitch:0,duration:.36,points:200,difficulty:.15}),
  flip('fs-shove-it',{name:'Frontside Shove-it',gesture:g(SWEEP_TOE,['nose']),roll:0,yaw:-1,pitch:0,duration:.36,points:220,difficulty:.18}),
  flip('varial-kickflip',{name:'Varial Kickflip',gesture:g(SWEEP_HEEL),roll:1,yaw:1,pitch:0,duration:.5,points:450,difficulty:.38}),
  flip('varial-heelflip',{name:'Varial Heelflip',gesture:g(SWEEP_TOE),roll:-1,yaw:-1,pitch:0,duration:.5,points:480,difficulty:.42}),
  flip('inward-heelflip',{name:'Inward Heelflip',gesture:g(SWEEP_HEEL,['nose','nose-toe']),roll:-1,yaw:1,pitch:0,duration:.52,points:560,difficulty:.55}),
  flip('hardflip',{name:'Hardflip',gesture:g(SWEEP_TOE,['nose','nose-heel']),roll:1,yaw:-1,pitch:.12,duration:.52,points:560,difficulty:.56}),
  // Full circles back to the tail, then a flick: the circle is the 360 shove, the flick picks the flip.
  flip('360-shove-it',{name:'360 Shove-it',gesture:g(CIRCLE_HEEL,['nose']),roll:0,yaw:2,pitch:0,duration:.55,points:500,difficulty:.4}),
  flip('fs-360-shove-it',{name:'Frontside 360 Shove-it',gesture:g(CIRCLE_TOE,['nose']),roll:0,yaw:-2,pitch:0,duration:.55,points:520,difficulty:.45}),
  flip('360-flip',{name:'360 Flip',gesture:g(CIRCLE_HEEL,['nose-heel']),roll:1,yaw:2,pitch:0,duration:.62,points:800,difficulty:.6}),
  flip('360-inward-heelflip',{name:'360 Inward Heelflip',gesture:g(CIRCLE_HEEL,['nose-toe']),roll:-1,yaw:2,pitch:0,duration:.7,points:1000,difficulty:.78}),
  flip('laser-flip',{name:'Laser Flip',gesture:g(CIRCLE_TOE,['nose-toe']),roll:-1,yaw:-2,pitch:0,duration:.64,points:850,difficulty:.68}),
  flip('360-hardflip',{name:'360 Hardflip',gesture:g(CIRCLE_TOE,['nose-heel']),roll:1,yaw:-2,pitch:.12,duration:.7,points:1000,difficulty:.78}),
  // Up–down–up family: the board wraps end over end.
  flip('impossible',{name:'Impossible',gesture:g(['tail','nose','tail','nose']),roll:0,yaw:0,pitch:1,duration:.5,points:600,difficulty:.55}),
  flip('dolphin-flip',{name:'Dolphin Flip',gesture:g(['tail','nose','tail','nose-heel']),roll:0,yaw:.5,pitch:-1,duration:.55,points:650,difficulty:.6}),
  // Varial sweep, then a second kick = the varial double.
  flip('nightmare-flip',{name:'Nightmare Flip',gesture:g(SWEEP_HEEL,['tail','nose-heel']),roll:2,yaw:1,pitch:0,duration:.7,points:1100,difficulty:.75}),
  flip('daydream-flip',{name:'Daydream Flip',gesture:g(SWEEP_TOE,['tail','nose-toe']),roll:-2,yaw:-1,pitch:0,duration:.7,points:1100,difficulty:.78}),
]);

/* --------------------------------------------------------------------- grabs */
const grab=(id:string,name:string,hand:GrabDef['hand'],edge:GrabDef['edge'],points:number):[string,GrabDef]=>[id,Object.freeze({id,name,hand,edge,points})];

/** Grabs. The input picks one from the grab hand + left-stick direction (table: input/NOTES-tricks.md). */
export const SKATE_GRABS:ReadonlyMap<string,GrabDef>=new Map([
  grab('indy','Indy','back','toe',150),
  grab('stalefish','Stalefish','back','heel',200),
  grab('tail-grab','Tail Grab','back','tail',160),
  grab('crail','Crail','back','nose',220),
  grab('roastbeef','Roastbeef','back','heel',240),
  grab('melon','Melon','front','heel',150),
  grab('mute','Mute','front','toe',170),
  grab('nose-grab','Nose Grab','front','nose',160),
  grab('method','Method','front','heel',260),
  grab('japan','Japan','front','toe',240),
]);

/* -------------------------------------------------------------------- grinds */
/**
 * Grinds and slides.
 * deckYaw is SIGNED: the angle from the grindable's travel direction to the
 * board's leading end, + = the leading end points to the FAR side (over the
 * line, away from where you came from), − = back toward the NEAR/approach
 * side. A sim that only measures |deckYaw| still separates the truck
 * families from the slides; use resolveGrind() to split the mirrored pairs.
 * deckPitch: + = leading end down (nose-down), − = tail down.
 */
const grind=(id:string,name:string,contact:GrindDef['contact'],deckYaw:number,deckPitch:number,points:number,difficulty:number):[string,GrindDef]=>
  [id,Object.freeze({id,name,contact,deckYaw,deckPitch,points,difficulty})];

export const SKATE_GRINDS:ReadonlyMap<string,GrindDef>=new Map([
  grind('50-50','50-50','both-trucks',0,0,100,.15),
  grind('5-0','5-0 Grind','back-truck',0,-.32,150,.3),
  grind('nosegrind','Nosegrind','front-truck',0,.32,180,.4),
  grind('crooked','Crooked Grind','front-truck',-.38,.26,250,.5),
  grind('overcrook','Overcrook','front-truck',.38,.26,300,.58),
  grind('smith','Smith Grind','back-truck',-.38,.22,280,.5),
  grind('feeble','Feeble Grind','back-truck',.38,.22,260,.45),
  grind('suski','Suski Grind','back-truck',-.3,-.4,300,.55),
  grind('salad','Salad Grind','back-truck',.3,-.4,320,.58),
  grind('boardslide','Boardslide','deck',HALF_PI,0,150,.3),
  grind('lipslide','Lipslide','deck',-HALF_PI,0,200,.38),
  grind('noseslide','Noseslide','nose',HALF_PI,.3,200,.42),
  grind('tailslide','Tailslide','tail',HALF_PI,-.3,220,.45),
  grind('bluntslide','Bluntslide','tail',HALF_PI,-.66,400,.7),
  grind('noseblunt','Noseblunt Slide','nose',HALF_PI,.66,450,.75),
]);

export type SkateCatalogs={flips:ReadonlyMap<string,FlipTrickDef>;grinds:ReadonlyMap<string,GrindDef>;grabs:ReadonlyMap<string,GrabDef>};
/** Exactly what the sim is injected with. */
export function skateCatalogs():SkateCatalogs {return {flips:SKATE_FLIPS,grinds:SKATE_GRINDS,grabs:SKATE_GRABS};}

/* ------------------------------------------------------------ grind resolver */
export type GrindApproach={
  /** Signed board-to-line angle at lock (rad), same convention as GrindDef.deckYaw: + = leading end over the FAR side. The nose angle is fine too: beyond ±90° it is folded onto the (leading) tail. */
  deckYawToLine:number;
  /** Rider fore/aft weight at lock, −1 tail … +1 nose (SkateIntent.lean / present.lean). */
  lean:number;
  /** A truck (or the board's middle) has crossed to the far side of the line: splits noseslide→noseblunt, tailslide→bluntslide. */
  overLine:boolean;
  /**
   * Which side of a ledge/coping face the leading end points at: +1 = toward
   * the face (Grindable.faceYaw side — the side you normally approach from, so
   * the board "dips down the face": smith, crooked, suski, lipslide), −1 = away
   * from it (over the top: feeble, overcrook, salad, boardslide), 0 = round
   * rail/unknown → the sign of deckYawToLine decides instead.
   */
  faceSide:-1|0|1;
  /** Rider's chest faces the obstacle. Naming only (score.ts); does not change the id. */
  frontside:boolean;
};

/** Angle thresholds (rad) of the resolver. */
export const GRIND_RESOLVE={aligned:.2,slide:1,noseLean:.3,tailLean:-.3,deepTail:-.7,slideLean:.45} as const;

/**
 * Pick the grind/slide from how the board met the line. The sim may call this
 * instead of nearest-def matching. Fed each def's own deckYaw (and a lean that
 * matches its contact: nose/front +, tail/back −, deep tail for suski/salad),
 * it returns that def — see test/skate-tricks.test.ts.
 */
export function resolveGrind(a:GrindApproach):GrindDef['id'] {
  let yaw=Number.isFinite(a.deckYawToLine)?Math.atan2(Math.sin(a.deckYawToLine),Math.cos(a.deckYawToLine)):0;
  // Given the NOSE angle while riding the board backwards (> 90°), the tail leads: measure from it.
  if(Math.abs(yaw)>HALF_PI)yaw=yaw>0?yaw-Math.PI:yaw+Math.PI;
  const across=Math.abs(yaw),lean=Number.isFinite(a.lean)?Math.max(-1,Math.min(1,a.lean)):0;
  const far=a.faceSide!==0?a.faceSide<0:yaw>=0;
  if(across>=GRIND_RESOLVE.slide){
    if(lean>=GRIND_RESOLVE.slideLean)return a.overLine?'noseblunt':'noseslide';
    if(lean<=-GRIND_RESOLVE.slideLean)return a.overLine?'bluntslide':'tailslide';
    return far?'boardslide':'lipslide';
  }
  if(across<GRIND_RESOLVE.aligned){
    if(lean>=GRIND_RESOLVE.noseLean)return 'nosegrind';
    if(lean<=GRIND_RESOLVE.tailLean)return '5-0';
    return '50-50';
  }
  if(lean>=GRIND_RESOLVE.noseLean)return far?'overcrook':'crooked';
  if(lean<=GRIND_RESOLVE.deepTail)return far?'salad':'suski';
  return far?'feeble':'smith';
}

/** Ollie label pieces used by the scorer and HUD. */
export const OLLIE_POINTS=60;
export const flipName=(id:string|null):string=>id===null?'Ollie':SKATE_FLIPS.get(id)?.name??id;
