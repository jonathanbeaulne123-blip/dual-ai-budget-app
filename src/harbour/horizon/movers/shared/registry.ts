/**
 * The mode registry (RIDE §10.2): exactly one active mode, changed only through a threshold offer.
 * `feet` has no controller; every other mode is a factory registered by its mover (M1 board, …).
 */
import type {WorldDefinition} from '../../world/definition.ts';
import type {HORIZON_MANIFEST} from '../../world/manifest.ts';
import type {createHorizonGeography} from '../../runtime/geography.ts';
import type {ModeController, ModeId, MoverBody} from './mode.ts';
import {offersAt, type CarriedProvider, type ThresholdOffer} from './threshold.ts';

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
  /** Register a moving threshold provider such as the plane's door. */
  carried(id:string, provider:CarriedProvider):()=>void;
  /** End a mover at its own physical landing (glider touchdown); unlike park this has no user offer. */
  finish():MoverBody|null;
  /** Teardown: disposes the active controller without an exit (the runtime's own dispose). A mode never ends here in play. */
  dispose():void;
}

export function createMoverRegistry(deps:MoverDeps):MoverRegistryControl {
  const factories = new Map<ModeId, (deps:MoverDeps) => ModeController>();
  const carriedProviders = new Map<string, CarriedProvider>();
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
  function finish():MoverBody|null {
    if (!active) return null;
    const out = active.exit(null);
    active.dispose();
    active = null; current = 'feet'; lastExit = out;
    return out;
  }
  function carriedRows() {
    return deps.world.thresholds.flatMap(t => {
      const provider = t.carried ? carriedProviders.get(t.carried) : undefined;
      const position = provider?.();
      return position ? [{...t, at:position.at, height:position.height}] : [];
    });
  }
  return {
    mode: () => current,
    active: () => active,
    register(id, factory) { if (id !== 'feet') factories.set(id, factory); },
    offers: body => offersAt(deps.world, body, current, ground, carriedRows()),
    accept(offer, body, now) {
      if (offer.from !== current || offer.to === current) return false;
      if (offer.to === 'feet') return stop(offer) !== null;
      const factory = factories.get(offer.to);
      if (!factory) return false;
      // Mode-to-mode (e.g. canoe→feet→canoe is two offers): a rider in a mode must park first.
      if (active) return false;
      // Keep the factory's settings view live: reduced-motion, calm and tier can change while a mode is attached.
      start(factory(live), offer, body, now);
      return true;
    },
    canAccept: offer => offer.from === current && offer.to !== current && (offer.to === 'feet' ? active !== null : !active && factories.has(offer.to)),
    lastExit: () => lastExit,
    setReducedMotion(on) { live.reducedMotion = on; active?.reducedMotion(on); },
    setCalm(on) { live.calm = on; active?.calm(on); },
    setTier(t) { live.tier = t; active?.tier(t); },
    attach(controller, offer, body, now) { if (active) return false; start(controller, offer, body, now); return true; },
    carried(id, provider) { carriedProviders.set(id, provider); return () => { if (carriedProviders.get(id) === provider) carriedProviders.delete(id); }; },
    finish,
    dispose() { if (active) { active.dispose(); active = null; current = 'feet'; } carriedProviders.clear(); },
  };
}
