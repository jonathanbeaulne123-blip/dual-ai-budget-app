/**
 * The gondola and the funicular on the Horizon (pass 5, D-M6): one `ModeController` per line, built on
 * Mountain v2's own pure ride (`body/ride.ts createRide`) and ride camera (`camera/rideCamera.ts`), both run in
 * v2's native space and placed on the Horizon by the one offset (`regions/mountainV2/placement.ts`).
 *
 * Lifecycle (CONTRACT §2.4: you always choose the switch):
 *  - `enter(offer)` at a platform: the offer's threshold names the trip (`route.ts routeForOffer`).
 *  - `update`: the ride steps (trapezoid speed, walking inside the cabin with W A S D, the gondola's bench on
 *    Space), the body rides the cabin, the cabin pose goes to the mounted region (`setTransit`), the camera is v2's
 *    ride camera (the gondola's gorge reveal) kept over the Horizon ground and out of its solids.
 *    E (the unspent Enter edge) or `skip()` cuts to the far platform.
 *  - Arrival: the frame carries a fade to the far platform facing away from it (`rideExitHeading`) with the
 *    announcement ("Arrived at Summit Commons."), and `finished()` hands the body back to feet there.
 *  - Reduced motion or calm view (CONTRACT §2.10): the ride is a cut. The runtime's comfort sheet lists the far
 *    platform (`reducedMotionCut`); if the controller is stepped anyway it arrives on the first frame. Calm view
 *    also parks the cabins (`setTransit(null)`).
 * Reads nothing financial. No clock of its own (the runtime's dt), no randomness.
 */
import type {ModeController, MoverBody, MoverFrame, MoverInput, ReducedMotionCut} from '../shared/mode.ts';
import type {MoverDeps} from '../shared/registry.ts';
import type {ThresholdOffer} from '../shared/threshold.ts';
import type {XYZ} from '../shared/ground/types.ts';
import type {Ride, RidePose} from '../../../body/ride.ts';
import {createRideCamera, rideExitHeading, type RideInput} from '../../../camera/rideCamera.ts';
import {curveLength, fallbackCableRegion, type CableRegion, type CableTransit} from './regionAdapter.ts';
import {routeForOffer, type CableKind, type CableRoute, type CableStation} from './route.ts';
import {arrivalLabel, cableHud} from './hud.ts';

/** Where the controller finds the region and its mounted scene (index.ts keeps the live one). */
export interface CableRideLink { region():CableRegion; transit():CableTransit|null; aspect?():number }
export const FALLBACK_LINK:CableRideLink = {region:fallbackCableRegion, transit:() => null};

export interface CableRideState {
  kind:CableKind; route:CableRoute|null; from:CableStation|null; to:CableStation|null;
  /** 0…1 by distance. */ progress:number;
  /** Metres left to the far platform. */ remaining:number;
  seated:boolean; moving:boolean; arrived:boolean;
  /** Reduced motion or calm view: the ride is a cut. */ cut:boolean;
}
export interface CableRideController extends ModeController {
  readonly kind:CableKind;
  state():CableRideState;
  /** Cut to the far platform (the skip control, E). */
  skip():void;
  /** The gondola's bench (Space). False on the funicular or off the cabin. */
  toggleSeat():boolean;
}

/** The ride lens (degrees) before the reveal's widening; the chest height the camera keeps in frame. */
export const CABLE_RIDE_FOV = 50, CABLE_RIDER_CHEST = 1.2;
/**
 * An offer farther than this (metres, horizontal) from the platform its trip starts at is a stale threshold
 * (e.g. `gondolaBase` still at the retired G1 station before T1's re-bake): the ride does not start and the rider
 * stays where they stood, rather than being carried across the island to v2's quay.
 */
export const CABLE_PLATFORM_GAP = 12;

export function createCableRide(kind:CableKind, deps:MoverDeps, link:CableRideLink = FALLBACK_LINK):CableRideController {
  let region:CableRegion = link.region(), transit:CableTransit|null = null;
  let ride:Ride|null = null, route:CableRoute|null = null, length = 0, entry:MoverBody = {x:0, y:0, z:0, yaw:0};
  let reduced = deps.reducedMotion, calm = deps.calm, jumpWas = false, started = false, arrived = false, pushed = false;
  let lastCabin:readonly [number,number,number]|null = null;
  const quiet = () => reduced || calm;
  const o = () => region.offset;
  // v2's ride camera works in native space; the Horizon geography answers in Horizon space.
  const camera = createRideCamera({
    ground:(x, z) => deps.geography.ground(x + o().x, z + o().z) - o().y,
    blocked:(x, y, z) => typeof deps.geography.blocked === 'function' && deps.geography.blocked(x + o().x, z + o().z, y + o().y, .2),
  });
  const station = (i:number|undefined) => i === undefined ? null : region.rides.lines[kind].stations[i] ?? null;
  const toHorizon = (p:readonly [number,number,number]):XYZ => [p[0] + o().x, p[1] + o().y, p[2] + o().z];
  const bodyOf = (p:RidePose):MoverBody => ({x:p.x + o().x, y:p.y + o().y, z:p.z + o().z, yaw:p.yaw});
  const exitYaw = () => route ? rideExitHeading(kind, route.to) : entry.yaw;
  function arrivalBody():MoverBody {
    if (!ride) return {...entry};
    const r = ride; r.skip();
    return {...bodyOf(r.pose()), yaw:exitYaw()};
  }
  function setTransit(cabin:{at:[number,number,number]; yaw:number; pitch:number}|null) {
    if (!transit) return;
    if (!cabin && !pushed) return;
    transit.setTransit(cabin, kind); pushed = cabin !== null;
  }
  function state():CableRideState {
    const p = ride?.progress() ?? (arrived ? 1 : 0), pose = ride?.pose();
    return {kind, route, from:station(route?.from), to:station(route?.to), progress:p, remaining:Math.max(0, (1 - p) * length),
      seated:pose?.seated ?? false, moving:pose?.moving ?? false, arrived, cut:quiet()};
  }
  const still = (body:MoverBody):MoverFrame => ({body, camera:null, pose:{lean:0, roll:0, pitch:0, crouch:0, slide:0, speed:0, slip:0}, hud:{pace:null, arc:0, glyph:null, label:null}, sound:{slide:0, roll:0, bite:false, boost:false}, fade:null, events:[]});

  const controller:CableRideController = {
    id:kind, kind,
    enter(offer:ThresholdOffer, body:MoverBody) {
      region = link.region(); transit = link.transit();
      entry = {...body}; route = routeForOffer(region.rides.lines, kind, offer);
      arrived = false; started = false; jumpWas = false; lastCabin = null; pushed = false;
      const start = station(route?.from);
      if (!start || Math.hypot(start.at[0] - offer.at[0], start.at[2] - offer.at[2]) > CABLE_PLATFORM_GAP) route = null;
      if (!route) { ride = null; length = 0; return; }
      ride = region.rides.createRide(kind, route.from, route.to, {reduced:quiet()});
      length = curveLength(region.rides.curve(kind, route.from, route.to));
    },
    update(dt:number, input:MoverInput):MoverFrame {
      if (!ride || !route) { arrived = true; return still({...entry}); }
      const step = Math.max(0, Math.min(.1, Number.isFinite(dt) ? dt : 0));
      // A cut: reduced motion, calm view, E (the Enter edge the runtime did not spend on an offer).
      if (!ride.done() && (quiet() || input.accept)) ride.skip();
      const jump = input.jump === true;
      if (jump && !jumpWas && !quiet()) ride.toggleSeat();
      jumpWas = jump;
      if (!quiet()) ride.move(input.forward, input.steer, step);
      const pose = ride.step(step), done = ride.done();
      const cabin = pose.cabin, speed = lastCabin && step > 0 ? Math.hypot(cabin[0] - lastCabin[0], cabin[1] - lastCabin[1], cabin[2] - lastCabin[2]) / step : 0;
      lastCabin = cabin;
      // The cabin to the region: the rider's own, until the far platform (then its loop takes it back); parked under calm.
      setTransit(done || calm ? null : {at:toHorizon(cabin) as [number,number,number], yaw:pose.cabinYaw, pitch:pose.pitch});
      // Camera: v2's ride camera in native space, then placed.
      const c = Math.cos(pose.pitch), dir:[number,number,number] = [Math.sin(pose.cabinYaw) * c, Math.sin(pose.pitch), Math.cos(pose.cabinYaw) * c];
      const shotInput:RideInput = {kind, u:ride.progress(), cabin, dir, rider:[pose.x, pose.y + CABLE_RIDER_CHEST, pose.z], aspect:link.aspect?.() ?? 16 / 9, fov:CABLE_RIDE_FOV};
      const shot = started ? camera.update(shotInput, step, quiet()) : camera.start(shotInput);
      started = true;
      const body = done ? {...bodyOf(pose), yaw:exitYaw()} : bodyOf(pose);
      const to = station(route.to)!;
      const frame:MoverFrame = {
        body,
        camera:{eye:toHorizon(shot.eye), target:toHorizon(shot.look), fov:shot.fov},
        pose:{lean:0, roll:0, pitch:0, crouch:pose.seated ? 1 : 0, slide:0, speed:done ? 0 : speed, slip:0},
        hud:cableHud(kind, route, region.rides.lines, state()),
        sound:{slide:0, roll:0, bite:false, boost:false},
        fade:null, events:[],
      };
      if (done && !arrived) { arrived = true; frame.fade = {to:{...body}, label:arrivalLabel(kind, to)}; frame.events.push('arrived'); }
      return frame;
    },
    exit(offer:ThresholdOffer|null):MoverBody {
      setTransit(null);
      // Stepping off at a threshold (before the doors close) stands there; any other end is the far platform.
      if (offer && offer.to === 'feet') return {x:offer.at[0], y:offer.at[1], z:offer.at[2], yaw:ride ? ride.pose().yaw : entry.yaw};
      return arrivalBody();
    },
    finished:() => arrived,
    reducedMotionCut():ReducedMotionCut {
      const to = station(route?.to);
      return {landings:to ? [{id:`${kind}.${to.id}`, label:`${to.name}, by ${kind}`, xy:[to.at[0], to.at[2]] as const, height:to.at[1]}] : []};
    },
    state,
    skip() { if (ride && !ride.done()) ride.skip(); },
    toggleSeat() {
      if (kind !== 'gondola' || !ride || ride.done()) return false;
      const was = ride.pose().seated; ride.toggleSeat(); return ride.pose().seated !== was;
    },
    reducedMotion(on) { reduced = on; if (on && ride && !ride.done()) ride.skip(); },
    calm(on) { calm = on; if (on) { setTransit(null); if (ride && !ride.done()) ride.skip(); } },
    tier() {},
    dispose() { setTransit(null); },
  };
  return controller;
}
