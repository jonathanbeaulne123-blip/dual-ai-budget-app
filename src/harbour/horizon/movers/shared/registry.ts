/**
 * The mode registry (RIDE §10.2): exactly one active mode, changed only through a threshold offer.
 * `feet` has no controller; every other mode is a factory registered by its mover (M1 board, …).
 */
import type {WorldDefinition} from '../../world/definition.ts';
import type {HORIZON_MANIFEST} from '../../world/manifest.ts';
import type {createHorizonGeography} from '../../runtime/geography.ts';
import type {ModeController, ModeId, MoverBody} from './mode.ts';
import {offersAt, type ThresholdOffer} from './threshold.ts';

export type HorizonGeography = ReturnType<typeof createHorizonGeography>;
export interface MoverRegistry {
  mode():ModeId; active():ModeController|null;
  register(id:ModeId, factory:(deps:MoverDeps)=>ModeController):void;
  offers(body:MoverBody):ThresholdOffer[];
  accept(offer:ThresholdOffer, body:MoverBody, now:number):boolean;   // the only way a mode changes; to:'feet' calls exit()
}
export interface MoverDeps { world:WorldDefinition; geography:HorizonGeography; manifest:typeof HORIZON_MANIFEST; reducedMotion:boolean; calm:boolean; tier:'full'|'lite' }

/** The registry plus the seams the runtime needs; the extra members are optional reading for movers. */
export interface MoverRegistryControl extends MoverRegistry {
  /** Whether `accept(offer)` would succeed now (from = current mode; to = feet or a registered factory). */
  canAccept(offer:ThresholdOffer):boolean;
  /** Where the rider stood on foot after the last exit (null before any). */
  lastExit():MoverBody|null;
  /** Live settings; forwarded to the active controller and to controllers made later. */
  setReducedMotion(on:boolean):void; setCalm(on:boolean):void; setTier(t:'full'|'lite'):void;
  /** Tests / headless: make `controller` the active mode as if `offer` were accepted (no factory needed). Refused (false) while a mode is active: park first (R2-22). */
  attach(controller:ModeController, offer:ThresholdOffer, body:MoverBody, now:number):boolean;
  /** Teardown: disposes the active controller without an exit (the runtime's own dispose). A mode never ends here in play. */
  dispose():void;
}

export function createMoverRegistry(deps:MoverDeps):MoverRegistryControl {
  const factories = new Map<ModeId, (deps:MoverDeps) => ModeController>();
  let current:ModeId = 'feet', active:ModeController|null = null, lastExit:MoverBody|null = null;
  const live = {...deps};
  const ground = (x:number, z:number) => deps.geography.ground(x, z);
  function start(controller:ModeController, offer:ThresholdOffer, body:MoverBody, now:number) {
    controller.reducedMotion(live.reducedMotion); controller.calm(live.calm); controller.tier(live.tier);
    controller.enter(offer, body, now);
    active = controller; current = offer.to;
  }
  function stop(offer:ThresholdOffer):MoverBody|null {
    if (!active) return null;
    const out = active.exit(offer);
    active.dispose();
    active = null; current = 'feet'; lastExit = out;
    return out;
  }
  return {
    mode: () => current,
    active: () => active,
    register(id, factory) { if (id !== 'feet') factories.set(id, factory); },
    offers: body => offersAt(deps.world, body, current, ground),
    accept(offer, body, now) {
      if (offer.from !== current || offer.to === current) return false;
      if (offer.to === 'feet') return stop(offer) !== null;
      const factory = factories.get(offer.to);
      if (!factory) return false;
      // Mode-to-mode (e.g. canoe→feet→canoe is two offers): a rider in a mode must park first.
      if (active) return false;
      start(factory({...live}), offer, body, now);
      return true;
    },
    canAccept: offer => offer.from === current && offer.to !== current && (offer.to === 'feet' ? active !== null : !active && factories.has(offer.to)),
    lastExit: () => lastExit,
    setReducedMotion(on) { live.reducedMotion = on; active?.reducedMotion(on); },
    setCalm(on) { live.calm = on; active?.calm(on); },
    setTier(t) { live.tier = t; active?.tier(t); },
    attach(controller, offer, body, now) { if (active) return false; start(controller, offer, body, now); return true; },
    dispose() { if (active) { active.dispose(); active = null; current = 'feet'; } },
  };
}
