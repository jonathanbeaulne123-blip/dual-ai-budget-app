/**
 * Threshold offers (RIDE §10.2): the only doors between modes. A body in mode M is offered every
 * world threshold whose `modes` hold a pair `M→X` within OFFER_REACH horizontally and |dy| ≤ OFFER_DY
 * of the threshold's height — Mountain v2's platformOffer rule (body/ride.ts).
 */
import type {WorldDefinition, Threshold} from '../../world/definition.ts';
import type {XYZ} from './ground/types.ts';
import {isModeId, type ModeId, type MoverBody} from './mode.ts';

export interface ThresholdOffer { id:string; thresholdId:string; at:XYZ; from:ModeId; to:ModeId; action:string; label:string; padId?:string }
/** A moving threshold snapshot supplied by its carrying vehicle (for example the plane door). */
export type CarriedThreshold = Threshold & {at:readonly [number,number];height:number};
export type CarriedPosition = {at:readonly [number,number];height:number};
export type CarriedProvider = () => CarriedPosition|null;
export const OFFER_REACH = 3.6;   // Mountain v2's platform reach (body/ride.ts)
export const OFFER_DY = 1.2;      // Mountain v2's |dy| for a platform offer

/**
 * Manifest shorthands on a side of a threshold pair. `from` aliases widen (a 'wheels→feet' park is
 * offered to every wheeled mode); `to` aliases name the mode a factory is registered under.
 */
const FROM_ALIASES:Record<string, readonly ModeId[]> = {wheels:['board','bicycle'], boat:['row','canoe','dinghy'], cable:['gondola']};
const TO_ALIASES:Record<string, ModeId> = {cable:'gondola', boat:'row'};

/** Every `a→b` step in a threshold's modes ('canoe→feet→canoe' yields canoe→feet and feet→canoe). */
export function thresholdPairs(t:Pick<Threshold,'modes'>):{from:string;to:string}[] {
  const out:{from:string;to:string}[] = [];
  for (const chain of t.modes) {
    const parts = chain.split('→').map(s => s.trim()).filter(Boolean);
    for (let i = 1; i < parts.length; i++) out.push({from:parts[i - 1]!, to:parts[i]!});
  }
  return out;
}

/**
 * Legacy flight wording for the M6 controller seam. The ride registry uses
 * `thresholdPairs` plus `offerLabel`; flight evidence still checks the exact
 * capitalised action for each authored mode sequence.
 */
const FLIGHT_WORDS:Record<string,readonly ModeId[]> = {
  feet:['feet'], board:['board'], wheels:['bicycle'], bicycle:['bicycle'], cable:['gondola'], gondola:['gondola'],
  cart:['cart'], zip:['zip'], glider:['glider'], parachute:['parachute'], plane:['plane'], balloon:['balloon'],
  boat:['row','canoe','dinghy'], row:['row'], canoe:['canoe'], dinghy:['dinghy'], ferry:['ferry'],
};
const modeIdsForFlightWord = (word:string):readonly ModeId[] => FLIGHT_WORDS[word.trim()] ?? [];
const capitalise = (text:string) => text.charAt(0).toUpperCase() + text.slice(1);
export function thresholdTransitions(threshold:Pick<Threshold,'modes'|'action'>):{from:ModeId;to:ModeId;action:string}[] {
  const parts = threshold.action.split(' / '), byPosition = parts.length === threshold.modes.length;
  const out:{from:ModeId;to:ModeId;action:string}[] = [];
  threshold.modes.forEach((sequence,index) => {
    const steps = sequence.split('→'), label = capitalise((byPosition ? parts[index]! : threshold.action).trim());
    for (let i = 0; i + 1 < steps.length; i++) {
      const froms = modeIdsForFlightWord(steps[i]!); const tos = modeIdsForFlightWord(steps[i + 1]!);
      for (const from of froms) for (const to of tos) {
        if (from === to || out.some(row => row.from === from && row.to === to)) continue;
        out.push({from,to,action:tos.length > 1 ? `${label} (${to})` : label});
      }
    }
  });
  return out;
}
const fromMatches = (side:string, mode:ModeId) => side === mode || (FROM_ALIASES[side]?.includes(mode) ?? false);
const toMode = (side:string):ModeId|null => isModeId(side) ? side : TO_ALIASES[side] ?? null;

export function offerLabel(to:ModeId, action:string):string {
  return to === 'feet' ? 'Park' : to === 'board' ? 'Pick up the board' : to === 'bicycle' ? 'Pick up the bicycle' : action;
}

/**
 * All offers the body could accept right now for its current mode, nearest first.
 * `ground(x,z)` supplies the height of a threshold that has none; without it the body's own
 * height is used (i.e. only the horizontal reach decides).
 */
export function offersAt(world:WorldDefinition, body:MoverBody, mode:ModeId, ground?:(x:number, z:number) => number, carried:readonly CarriedThreshold[] = []):ThresholdOffer[] {
  const found:{offer:ThresholdOffer;d:number}[] = [];
  const consider = (t:Threshold, x:number, z:number, yOverride?:number) => {
    const d = Math.hypot(x - body.x, z - body.z);
    if (d > OFFER_REACH) return;
    const y = yOverride ?? t.height ?? (ground ? ground(x, z) : body.y);
    if (Math.abs(body.y - y) > OFFER_DY) return;
    const seen = new Set<ModeId>();
    for (const pair of thresholdPairs(t)) {
      if (!fromMatches(pair.from, mode)) continue;
      const to = toMode(pair.to);
      if (!to || to === mode || seen.has(to)) continue;
      seen.add(to);
      const offer:ThresholdOffer = {id:`${t.id}:${mode}→${to}`, thresholdId:t.id, at:[x, y, z], from:mode, to, action:t.action, label:offerLabel(to, t.action)};
      if (t.padId) offer.padId = t.padId;
      found.push({offer, d});
    }
  };
  for (const t of world.thresholds) if (!t.carried) consider(t, t.at[0], t.at[1]);
  for (const t of carried) consider(t, t.at[0], t.at[1], t.height);
  return found.sort((a, b) => a.d - b.d || a.offer.id.localeCompare(b.offer.id)).map(f => f.offer);
}

/** The nearest threshold a rider in `mode` parks at anywhere in the world (RIDE §6.5): a `mode→feet` one, else any that names the mode. */
function nearestParkThreshold(world:WorldDefinition, body:MoverBody, mode:ModeId):Threshold|null {
  let park:{t:Threshold;d:number}|null = null, any:{t:Threshold;d:number}|null = null;
  for (const t of world.thresholds) {
    if (t.carried) continue;
    const pairs = thresholdPairs(t), d = Math.hypot(t.at[0] - body.x, t.at[1] - body.z);
    if (pairs.some(p => fromMatches(p.from, mode) && p.to === 'feet') && (!park || d < park.d)) park = {t, d};
    if (pairs.some(p => fromMatches(p.from, mode) || toMode(p.to) === mode) && (!any || d < any.d)) any = {t, d};
  }
  return (park ?? any)?.t ?? null;
}

/**
 * The threshold a reload restores a rider to (RIDE §6.5): the nearest `mode→feet` threshold of
 * the rider's mode anywhere in the world, else the nearest threshold that names the mode at all.
 * Returns the on-foot body there (yaw kept), or null when the world has none for this mode.
 */
export function nearestParkFor(world:WorldDefinition, body:MoverBody, mode:ModeId, ground?:(x:number, z:number) => number):MoverBody|null {
  const t = nearestParkThreshold(world, body, mode);
  if (!t) return null;
  const [x, z] = t.at;
  return {x, y:t.height ?? (ground ? ground(x, z) : body.y), z, yaw:body.yaw};
}

/**
 * The park a mode ends at when the rider did not choose one in reach (R2-01: a reload, `arrive`):
 * the nearest `mode→feet` offer in reach, else a `mode→feet` offer at `nearestParkFor`'s threshold.
 * Accepted through `registry.accept`, so the mode still ends only at a threshold. Null on foot, or
 * when the world names no threshold for the mode (unreachable: a mode is entered at one).
 */
export function parkOfferFor(world:WorldDefinition, body:MoverBody, mode:ModeId, ground?:(x:number, z:number) => number):ThresholdOffer|null {
  if (mode === 'feet') return null;
  const near = offersAt(world, body, mode, ground).find(o => o.to === 'feet');
  if (near) return near;
  const t = nearestParkThreshold(world, body, mode);
  if (!t) return null;
  const [x, z] = t.at, y = t.height ?? (ground ? ground(x, z) : body.y);
  const offer:ThresholdOffer = {id:`${t.id}:${mode}→feet`, thresholdId:t.id, at:[x, y, z], from:mode, to:'feet', action:t.action, label:offerLabel('feet', t.action)};
  if (t.padId) offer.padId = t.padId;
  return offer;
}
