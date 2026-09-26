/**
 * Threshold offers (CONTRACT §2.4: "the offer appears by proximity; the action is still yours").
 * Pure: reads `WorldDefinition.thresholds` and a body, returns what may be offered this frame.
 */
import type {Point2,Threshold} from '../../world/definition.ts';
import type {ModeId,MoverBody} from './mode.ts';

/** One deliberate switch the player may take now. `at` is engine x/z. */
export interface ThresholdOffer{thresholdId:string;from:ModeId;to:ModeId;action:string;at:readonly [number,number];height?:number}

/**
 * A threshold that moves with a vehicle (the plane's door for `bailOut`, the Ferry's gangway):
 * the definition row from `WorldDefinition.thresholds` (marked `carried`) with this frame's
 * `at` and `height` supplied by the carrying vehicle.
 */
export interface CarriedThreshold extends Threshold{carried:string;at:Point2;height:number}
/** What a carrying vehicle reports each frame; `null` = no offer now (e.g. "Too low to jump"). */
export type CarriedPosition={at:readonly [number,number];height:number};
export type CarriedProvider=()=>CarriedPosition|null;

/** The manifest's mode words → the movers' ids (`cable` is the gondola, `wheels` the bicycle, `boat` any small boat). */
const WORDS:Record<string,readonly ModeId[]>={feet:['feet'],board:['board'],wheels:['bicycle'],bicycle:['bicycle'],cable:['gondola'],gondola:['gondola'],cart:['cart'],zip:['zip'],glider:['glider'],parachute:['parachute'],plane:['plane'],balloon:['balloon'],boat:['row','canoe','dinghy'],row:['row'],canoe:['canoe'],dinghy:['dinghy'],ferry:['ferry']};
export function modeIdsForWord(word:string):readonly ModeId[]{return WORDS[word.trim()]??[];}

const capital=(text:string)=>text.charAt(0).toUpperCase()+text.slice(1);
/**
 * Every from → to pair a threshold allows, with its action label. A chained sequence
 * (`canoe→feet→canoe`) yields each consecutive step; a pair of the same mode yields nothing.
 * `clip in / run off` over two sequences labels each by position.
 */
export function thresholdTransitions(threshold:Pick<Threshold,'modes'|'action'>):{from:ModeId;to:ModeId;action:string}[]{
  const parts=threshold.action.split(' / '),byPosition=parts.length===threshold.modes.length,out:{from:ModeId;to:ModeId;action:string}[]=[];
  threshold.modes.forEach((sequence,i)=>{
    const steps=sequence.split('→'),label=capital((byPosition?parts[i]!:threshold.action).trim());
    for(let k=0;k+1<steps.length;k++){
      const froms=modeIdsForWord(steps[k]!),tos=modeIdsForWord(steps[k+1]!);
      for(const from of froms)for(const to of tos){
        if(from===to||out.some(o=>o.from===from&&o.to===to))continue;
        out.push({from,to,action:tos.length>1?`${label} (${to})`:label});
      }
    }
  });
  return out;
}

/** Vertical tolerance between the body and a threshold's pad or door. */
export const THRESHOLD_HEIGHT_REACH=3;
function within(body:MoverBody,at:readonly [number,number],height:number|undefined,reach:number){
  const d=Math.hypot(body.x-at[0],body.z-at[1]);
  return d<=reach&&(height===undefined||!Number.isFinite(height)||Math.abs(body.y-height)<=THRESHOLD_HEIGHT_REACH)?d:null;
}

/**
 * Offers within `reach` engine units of the body, nearest first. Static thresholds with a
 * `carried` mark are skipped here (they have no place of their own); pass their per-frame
 * `CarriedThreshold` snapshots in `carried`. The caller filters by the active mode.
 */
export function offersAt(thresholds:readonly Threshold[],body:MoverBody,reach=3.6,carried:readonly CarriedThreshold[]=[]):ThresholdOffer[]{
  const found:{offer:ThresholdOffer;d:number}[]=[];
  const consider=(t:Threshold,at:readonly [number,number],height:number|undefined)=>{
    const d=within(body,at,height,reach);if(d===null)return;
    for(const step of thresholdTransitions(t))if(!found.some(f=>f.offer.thresholdId===t.id&&f.offer.to===step.to&&f.offer.from===step.from))found.push({d,offer:{thresholdId:t.id,from:step.from,to:step.to,action:step.action,at:[at[0],at[1]],...(height===undefined?{}:{height})}});
  };
  for(const t of thresholds){if(t.carried)continue;consider(t,t.at,t.height);}
  for(const t of carried)consider(t,t.at,t.height);
  return found.sort((a,b)=>a.d-b.d).map(f=>f.offer);
}
