/**
 * The runtime's mover seams as pure helpers (track I): how keys and pads become a `MoverInput`,
 * how long a mover's fade and camera blends last, where a reload puts a rider, which offer the
 * stage shows, which movers the runtime registers, and the slip the figure shows over the deck.
 * No three, no DOM: `test/horizonMoverHook.test.ts` and `test/horizonModeRegistry.test.ts` drive these headless.
 */
import type {WorldDefinition} from '../world/definition.ts';
import type {ModeController, ModeId, MoverBody, MoverHud, MoverInput, MoverPose} from '../movers/shared/mode.ts';
import type {MoverDeps, MoverRegistry, MoverRegistryControl} from '../movers/shared/registry.ts';
import type {GroundState} from '../movers/shared/ground/types.ts';
import {slipAngle} from '../movers/shared/ground/kernel.ts';
import {parkOfferFor, type ThresholdOffer} from '../movers/shared/threshold.ts';
import {createBoardController} from '../movers/board/controller.ts';
import {createBicycleController} from '../movers/bicycle/controller.ts';

export type MoverControls = {forward:number;strafe:number;run:boolean};
export interface MoverInputSources {
  keys:ReadonlySet<string>;          // lower-cased KeyboardEvent.key values currently held (' ' = Space)
  controls:MoverControls;            // the Move pad (forward = up, strafe = right) and the run toggle
  jumpHeld:boolean;                  // the Jump bubble held (pointerdown → pointerup)
  jumpEdge:boolean;                  // a Space / Jump press this frame that has not been consumed
  accept:boolean;                    // the E / Enter-bubble edge, when the runtime did not spend it on an offer
  look:{dx:number;dy:number};        // pointer drag / Look pad deltas accumulated this frame (radians)
}
const clamp1 = (v:number) => Math.max(-1, Math.min(1, v));
const held = (keys:ReadonlySet<string>, ...names:string[]) => names.some(n => keys.has(n)) ? 1 : 0;

/** RIDE §10.5: W/S (and the pad's y) = forward, A/D (and the pad's x) = steer, Space/Jump = jump (held), Shift = sprint. */
export function moverInputFrom(s:MoverInputSources):MoverInput {
  return {
    steer: clamp1(held(s.keys, 'd', 'arrowright') - held(s.keys, 'a', 'arrowleft') + s.controls.strafe),
    forward: clamp1(held(s.keys, 'w', 'arrowup') - held(s.keys, 's', 'arrowdown') + s.controls.forward),
    jump: s.keys.has(' ') || s.jumpHeld || s.jumpEdge,
    sprint: s.keys.has('shift') || s.controls.run,
    crouch: 0,
    accept: s.accept,
    look: {dx:s.look.dx, dy:s.look.dy},
  };
}

/** The mover fade (MoverFrame.fade): 300 ms to black and back; a cut under reduced motion or calm view. */
export const MOVER_FADE_MS = 300;
export function moverFadeMs(reducedMotion:boolean, calm = false):number { return reducedMotion || calm ? 0 : MOVER_FADE_MS; }

/** The walk ↔ ride camera blends (RIDE §10.2): 0.8 s from the walk camera to the mover's at pick-up, 0.6 s back at park; cuts under reduced motion or calm. */
export const MOVER_PICKUP_BLEND_MS = 800, MOVER_PARK_BLEND_MS = 600;
export function moverBlendMs(kind:'pickup'|'park', reducedMotion:boolean, calm = false):number {
  return reducedMotion || calm ? 0 : kind === 'pickup' ? MOVER_PICKUP_BLEND_MS : MOVER_PARK_BLEND_MS;
}
/** The blend's ease (the same smoothstep as the runtime's Look/Walk `transition`), t = elapsed / duration clamped to 0..1. */
export function moverBlendEase(elapsedMs:number, durationMs:number):number {
  const t = durationMs > 0 ? Math.min(1, Math.max(0, elapsedMs / durationMs)) : 1;
  return t * t * (3 - 2 * t);
}

type MoverFactory = (deps:MoverDeps) => ModeController;
/** The movers the Horizon runtime registers at mount (RIDE §11 ask 2): the board and the bicycle. */
export const HORIZON_MOVERS:Readonly<Partial<Record<ModeId, MoverFactory>>> = Object.freeze({
  board: (deps:MoverDeps) => createBoardController(deps),
  bicycle: (deps:MoverDeps) => createBicycleController(deps),
});
/** Registers `HORIZON_MOVERS` and then `overrides` (`HorizonOptions.movers`): an override for a mode replaces the default. */
export function registerHorizonMovers(registry:Pick<MoverRegistry, 'register'>, overrides:Partial<Record<ModeId, MoverFactory>> = {}):void {
  for (const [id, factory] of Object.entries(HORIZON_MOVERS)) if (factory && !overrides[id as ModeId]) registry.register(id as ModeId, factory);
  for (const [id, factory] of Object.entries(overrides)) if (factory) registry.register(id as ModeId, factory);
}

const wrapPi = (a:number) => Math.atan2(Math.sin(a), Math.cos(a));
/**
 * The slip the figure shows over the deck (`MoverPose.slip`): the travel direction minus the nose
 * heading, ±π. The pose's own value wins; else the controller's kernel state (the board's `state()`):
 * the kernel's slip angle β (measured from the lead end) plus π when riding fakie. 0 when neither says.
 */
export function riderSlip(pose:MoverPose, controller?:unknown):number {
  if (typeof pose.slip === 'number' && Number.isFinite(pose.slip)) return wrapPi(pose.slip);
  const read = (controller as {state?:unknown} | null | undefined)?.state;
  if (typeof read !== 'function') return 0;
  const state = (read as () => GroundState | null | undefined).call(controller);
  if (!state || !Array.isArray(state.v)) return 0;
  const beta = slipAngle(state);
  return Number.isFinite(beta) ? wrapPi(beta + (state.lead < 0 ? Math.PI : 0)) : 0;
}

/**
 * Where a reload restores a rider (RIDE §6.5; 02-movers "Saved positions"): on foot, at the nearest
 * `mode→feet` threshold in reach, else the nearest `mode→feet` threshold anywhere, else the nearest
 * threshold that names the mode. On foot (mode 'feet') the body is returned unchanged.
 */
export function savedRideBody(world:WorldDefinition, body:MoverBody, mode:ModeId, ground?:(x:number, z:number) => number):MoverBody {
  const park = parkOfferFor(world, body, mode, ground);
  return park ? {x:park.at[0], y:park.at[1], z:park.at[2], yaw:body.yaw} : {...body};
}

/** The runtime's view modes (runtime/index.ts `HorizonMode`), repeated here so this file stays free of the runtime. */
export type HorizonViewMode = 'walk'|'look'|'journey';
/**
 * The ride across the runtime's view modes (R2-01; CONTRACT §2.4, 02-movers rule 1): a mode ends only
 * at a threshold. Look, Island or a page while riding **pause** the mover where it is: the registry
 * keeps the mode and the controller, `update` is not called, and the rider's body is kept. Walk
 * **resumes** it (the runtime blends the mover camera back over `moverBlendMs('pickup')`). A reload or
 * `arrive` while riding **parks** through `registry.accept` at the saved-body rule's threshold
 * (`parkOfferFor`), and the controller is disposed by the registry's exit path.
 */
export interface RideHold {
  /** The paused rider's body, or null when not paused. */
  readonly body:MoverBody|null;
  paused():boolean;
  /** Look / Island / a page: pause while riding. True when it paused now (not already paused, a mover active). */
  pause(body:MoverBody):boolean;
  /** Walk again: the paused rider's body to publish (null when nothing was paused). */
  resume():MoverBody|null;
  /** Whether this frame calls the active mover's `update`: riding, in Walk, not paused. */
  steps(mode:HorizonViewMode):boolean;
  /** A reload / `arrive` while riding: end the mode at the saved-body rule's `mode→feet` threshold. Returns the on-foot body there and the offer, or null on foot. */
  park(body:MoverBody, now:number):{body:MoverBody;offer:ThresholdOffer}|null;
}
export function createRideHold(registry:Pick<MoverRegistryControl, 'active'|'mode'|'accept'|'dispose'>, world:WorldDefinition, ground?:(x:number, z:number) => number):RideHold {
  let held:MoverBody|null = null;
  return {
    get body() { return held ? {...held} : null; },
    paused: () => held !== null,
    pause(body) { if (held || !registry.active()) return false; held = {...body}; return true; },
    resume() { const out = held; held = null; return out && registry.active() ? {...out} : null; },
    steps: mode => mode === 'walk' && held === null && registry.active() !== null,
    park(body, now) {
      if (!registry.active()) { held = null; return null; }
      const rider = held ?? body, mode = registry.mode();
      held = null;
      const offer = parkOfferFor(world, rider, mode, ground);
      if (offer && registry.accept(offer, {...rider}, now)) return {body:{x:offer.at[0], y:offer.at[1], z:offer.at[2], yaw:rider.yaw}, offer};
      registry.dispose();   // unreachable in play (a mode is entered at a threshold that names it); never leave a mover running under a restored body
      return null;
    },
  };
}

/** The offer the Enter bubble names: the nearest one the registry can accept right now, or null. */
export function offerToShow(offers:readonly ThresholdOffer[], canAccept:(o:ThresholdOffer) => boolean):ThresholdOffer|null {
  return offers.find(canAccept) ?? null;
}

/** HUD / offer change detection for the throttled stage callbacks. */
export function sameHud(a:MoverHud|null, b:MoverHud|null):boolean {
  if (!a || !b) return a === b;
  return a.pace === b.pace && a.glyph === b.glyph && a.label === b.label && Math.abs(a.arc - b.arc) < 0.01;
}
export const sameOffer = (a:ThresholdOffer|null, b:ThresholdOffer|null) => (a?.id ?? null) === (b?.id ?? null);

/** The desktop offer bubble's text (R2-03): the key, then the offer ("E · Pick up the board", "E · Park"); empty with no offer. */
export const offerBubbleText = (offer:Pick<ThresholdOffer, 'label'>|null):string => offer ? `E · ${offer.label}` : '';

/** The stage's status line while riding (the Enter bubble reads the offer label). */
export const RIDING_STATUS = 'Riding. W pushes, S slides, A D steer, Space pops, E parks.';

export type PaceWord = 'fast'|'flow'|'slow'|'threshold'|'offline';
/** The pace bubble's word from the HUD (RIDE §10.4): "fast · paved" → fast; off the line → offline. */
export function paceWord(hud:MoverHud):PaceWord {
  if (hud.glyph === 'offline') return 'offline';
  const word = (hud.pace ?? '').trim().split(/[\s·]+/)[0]?.toLowerCase() ?? '';
  return word === 'fast' || word === 'flow' || word === 'slow' || word === 'threshold' ? word : word.startsWith('off') ? 'offline' : 'flow';
}
