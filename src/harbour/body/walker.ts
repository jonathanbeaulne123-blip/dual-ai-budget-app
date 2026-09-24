import * as THREE from "three";
import {followRoute,planWalk,steer,type RouteFollow,type WalkPlan} from './route.ts';
import {createSkateDriver,skateAct,SKATE_CATALOGS,type SkateControls} from '../skate/driver.ts';
import {createSkaterLook,type LookTheme,type SkaterLook} from '../skate/look/index.ts';
import type {SkateDeckId} from '../skate/park.ts';
import { createBodyFigure, type BodyFigure, type BodyMotion, type FigureColours } from "./figure.ts";
import { createFootprints, FOOTPRINT_POOL, FOOTPRINT_POOL_LITE, type Footprints } from "./footprints.ts";
import { createDust, DUST_POOL, DUST_POOL_LITE, type Dust } from "./dust.ts";
import {
  BODY_HEIGHT,
  BODY_RADIUS,
  EMOTE_LOOPS,
  EMOTE_MAX_SECONDS,
  EMOTE_SECONDS,
  JUMP_SPEED,
  NO_INPUT,
  SLIDE_SECONDS,
  WALK_SPEED,
  actionOf,
  createBodyState,
  eyeHeight,
  gaitOf,
  placeBody,
  requestEmote,
  requestJump,
  requestSlide,
  runFraction,
  stepBody,
  walkTo,
  type BodyInput,
  type BodyState,
  type BodyWorld,
  type EmoteId,
} from "./bodyModel.ts";
import { courtObstacles, type Obstacle, type RoomBounds } from "./obstacles.ts";
import {createPlayableFigure,type PlayableAvatar} from './playableFigure.ts';
// The partner's body is this body: importing the character module registers it
// with `presence/walker.ts` (see `body/characterWalker.ts`). The runtime imports
// this file, so the real character is standing before any place is built.
import "./characterWalker.ts";

/**
 * Little Harbour · a body standing on the island.
 *
 * The joint between `bodyModel.ts` (pure movement) and `figure.ts` (meshes):
 * one object that owns a state, a figure, a trail of prints and the ground it
 * walks on. **A factory, never a singleton** — the partner lane calls it a
 * second time with its own colours and its own starting spot, and nothing
 * here has to change.
 *
 * It asks for no frames of its own. `scene/runtime.ts` calls `step` inside the
 * frame the renderer lease already owns; there is no `requestAnimationFrame`
 * in this lane at all.
 */

export type WalkerOptions = {
  /** The island's height under a point (`scene/ground.ts` `groundHeightAt`). */
  groundHeightAt: (x: number, z: number) => number;
  /** What it cannot walk through. Defaults to the Court's own table. */
  obstacles?: readonly Obstacle[];
  /** The walls, where there are walls (`body/places.ts` `placeRoom`). The Court has none. */
  room?: RoomBounds | null;
  tier?: "full" | "lite";
  colours?: Partial<FigureColours>;
  avatar?: PlayableAvatar|null;
  invalidate?:()=>void;
  onAvatarStatus?:(avatar:PlayableAvatar,status:"ready"|"error")=>void;
  /** Where it stands when it arrives, and which way it faces. */
  start?: { x: number; z: number; yaw?: number };
  /**
   * Prints in the grass. On everywhere now — a phone's pool is half the size
   * (`FOOTPRINT_POOL_LITE`), which is one geometry and twelve matrix writes a
   * walk, and a trail behind you is most of what tells you you moved.
   */
  trail?: boolean;
  /**
   * Reduced motion. **The body still walks** — walking is the app — but the
   * ground stops performing: no dust, no lean, no bank, no squash, no scuff.
   * The plain gait and nothing else.
   */
  reduced?: boolean;
  /** Runtime motion policy for the decorative local replay (calm/tool state included). */
  skateReducedMotion?:()=>boolean;
  /** The theme the skate look's FX are painted in. */
  theme?: LookTheme;
};

export type Walker = {
  group: THREE.Group;
  skate: SkateControls;
  /**
   * Stand this body in another place (walk-everywhere): its floor, what it
   * cannot walk through, and its walls. The Court and the buildings standing
   * on it are one island, so walking from the terrace into the Library
   * re-points the world the same body is walking in rather than putting one
   * body away and raising another.
   */
  setWorld(next: { groundHeightAt?: (x: number, z: number) => number; obstacles?: readonly Obstacle[]; room?: RoomBounds | null }): void;
  /** Where the body is and what it is doing. Plain data — safe to read every frame. */
  state(): BodyState;
  /** The point a follow camera looks at: the body's shoulders. */
  shoulders(): [number, number, number];
  /** What the keys or the stick are asking for, in camera space. */
  setInput(input: BodyInput): void;
  input(): BodyInput;
  /**
   * Walk to a point — a tap. `y` is the tapped height, so a deck and the
   * ground under it are different destinations. Near at hand a clear line is
   * direct and a blocked one follows bounded waypoints; further, the walk
   * follows the pedestrian network as one smooth line, at a run when long.
   */
  goTo(x: number, z: number, y?: number): boolean;
  /** The walk the last `goTo` planned (its length decides a run and a "Ride there?"), or null. */
  plan(): WalkPlan | null;
  /**
   * Ride: the body is carried by a cabin, attached to its transform — no
   * ground, shore or obstacle resolution while it rides. `null` lets go (the
   * caller then stands it on the platform with `place`).
   */
  attach(pose: { x: number; y: number; z: number; yaw: number; seated: boolean } | null): void;
  /** Is the body riding a cabin? */
  riding(): boolean;
  /** Walk at a run without holding Shift (the run toggle). */
  runLock(on?: boolean): boolean;
  setAvatar(avatar:PlayableAvatar|null):void;
  /** Stop walking there (a second tap that meant something else). */
  cancel(): void;
  /** Put it somewhere at once. */
  place(x: number, z: number, yaw?: number, y?:number): void;
  /**
   * One frame. `theta` is where the camera stands, so a push of the stick is
   * read the way the screen looks. Returns true while anything of the body's
   * still moves — which is exactly what the frame policy asks about.
   */
  step(dt: number, t: number, theta: number): boolean;
  /** Is it walking right now? */
  walking(): boolean;
  /**
   * Ask for a jump. One-shot and edge-safe: a press between two frames is
   * taken on the next one, exactly once. In the air it is the second jump.
   */
  jump(): void;
  /** Ask for a slide. Taken only from a run, on the ground. */
  slideNow(): void;
  /** Play an emote, or stop it (`null`). Asking for the one playing stops it. */
  emote(id: EmoteId | null): void;
  /** What the body is doing beyond walking, for the wire: `{act, p}` or null. */
  action(): { act: string; p: number } | null;
  setColours(next: Partial<FigureColours>): void;
  /** Turn the flourishes off (or back on) without raising a second body. */
  setReduced(reduced: boolean): void;
  /** The body's bounds in world space, for a DOM twin. */
  bounds(target: THREE.Box3): THREE.Box3;
  dispose(): void;
};

/** How often a slide lays a mark and throws a puff, in seconds. */
const SLIDE_MARK_SECONDS = 0.085;

/** Where a body arrives in the Court: on the paving just inside the gate, facing the Queen. */
export const COURT_ARRIVAL = Object.freeze({ x: 0.95, z: 5.1, yaw: Math.PI });

export function createWalker(options: WalkerOptions): Walker {
  const tier = options.tier ?? "full";
  const world: BodyWorld = {
    groundHeightAt: options.groundHeightAt,
    obstacles: options.obstacles ?? courtObstacles(tier),
    room: options.room ?? null,
  };
  const group = new THREE.Group();
  group.name = "Your body";
  let figure: BodyFigure = options.avatar?createPlayableFigure(options.avatar,tier,{invalidate:options.invalidate,onStatus:options.onAvatarStatus}):createBodyFigure(options.colours);
  group.add(figure.group);
  const trail: Footprints | null = (options.trail ?? true)
    ? createFootprints("#6b5a44", tier === "full" ? FOOTPRINT_POOL : FOOTPRINT_POOL_LITE)
    : null;
  if (trail) group.add(trail.group);
  // The dust lives beside the prints and under the same rule: a fixed pool,
  // nothing allocated while walking, nothing drawn once it has settled.
  const dust: Dust = createDust("#cfc0a4", tier === "full" ? DUST_POOL : DUST_POOL_LITE);
  group.add(dust.group);
  let reduced = options.reduced ?? false;
  dust.group.visible = !reduced;
  /** The weight handed to the figure each frame. One object, written in place. */
  const motion: BodyMotion = { lean: 0, bank: 0, run: 0, air: 0, rise: 0, crouch: 0, slide: 0, emote: null, emoteAt: 0, flourish: 1 };
  /**
   * A slide lays a mark and a plume, and it does it on a *clock* rather than
   * every frame: at sixty frames a second a mark a frame would wipe the whole
   * pool in a fifth of a second and cost nothing but flicker.
   */
  let plume = 0;
  /**
   * A brake lasts a good handful of frames, and a burst on every one of them
   * would empty the pool before the body had stopped. The skid fires on the
   * *edge*: one scuff, one burst, and then the footfalls carry it.
   */
  let skidding = false;

  const start = options.start ?? COURT_ARRIVAL;
  let state = createBodyState(start.x, start.z, start.yaw ?? COURT_ARRIVAL.yaw, world);
  let input: BodyInput = NO_INPUT;
  let route: RouteFollow | null = null, lastPlan: WalkPlan | null = null;
  let ride: { x: number; y: number; z: number; yaw: number; seated: boolean } | null = null;
  let runLocked = false, fade = 1;
  /** A safe return fades the figure; every material on it is its own (`createBodyFigure`). */
  function setFade(alpha: number): void {
    if (Math.abs(alpha - fade) < 1e-3) return;
    fade = alpha;
    figure.group.visible = alpha > 0.02;
    figure.group.traverse(node => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        const m = material as THREE.Material & { opacity: number; transparent: boolean; userData: Record<string, unknown> };
        if (m.userData.bodyOpaque === undefined) m.userData.bodyOpaque = { opacity: m.opacity, transparent: m.transparent };
        const base = m.userData.bodyOpaque as { opacity: number; transparent: boolean };
        m.transparent = alpha < 1 ? true : base.transparent; m.opacity = base.opacity * alpha; m.needsUpdate = true;
      }
    });
  }
  const box = new THREE.Box3();
  // ── Tideline Skate Club v2 ── the driver (sim, input, score, session) and the
  // look (board, rider pose, FX). While the board is down the look owns the
  // figure's transform and pose; the walker only mirrors the ride into `state`
  // so the camera, the doors and the partner lane read one position.
  const skater=createSkateDriver(world,{reducedMotion:()=>reduced||Boolean(options.skateReducedMotion?.())});
  let look:SkaterLook|null=null,lookDeck:SkateDeckId|null=null;
  let boardEmote:EmoteId|null=null,boardEmoteAt=0;
  const skateReduced=()=>reduced||skater.current()?.reducedEffects===true;
  function ensureLook():SkaterLook{
    if(!look){look=createSkaterLook({figure,deckId:skater.deckId(),tier,catalogs:SKATE_CATALOGS,theme:options.theme});group.add(look.root);lookDeck=skater.deckId();}
    look.root.visible=true;
    return look;
  }
  function drawSkate(dt:number):void{
    const p=skater.present();if(!p)return;
    const l=ensureLook();
    if(lookDeck!==skater.deckId()){lookDeck=skater.deckId();l.setDeck(lookDeck);}
    l.setStance(null);
    l.setEmote(boardEmote,boardEmoteAt);
    l.update(p,skater.paused()?null:skater.events(),skater.paused()?0:dt,skateReduced());
  }
  function syncSkate(){
    const p=skater.present();if(!p)return;
    // The board's origin is the ground (or the rail's top line) under it: that
    // is the body's y now. The look stands the soles DECK_TOP above it.
    state={...state,x:p.x,y:p.y,z:p.z,yaw:p.boardYaw,speed:p.speed,air:p.phase==='air'?Math.max(.01,p.clearance):0,vy:p.vy,goal:null,emote:null};
  }
  const skate:SkateControls={
    active:skater.active,heading:skater.heading,paused:skater.paused,hud:skater.hud,progress:skater.progress,revision:skater.revision,
    ghost:skater.ghost,replay:skater.replay,
    run:skater.run,route:skater.route,spot:skater.spot,deck:skater.deck,settings:skater.settings,current:skater.current,command:skater.command,
    checkpoint:skater.checkpoint,input:skater.input,present:skater.present,events:skater.events,takeCut:skater.takeCut,setAudio:skater.setAudio,
    pause(on){skater.pause(on);},
    restore(checkpoint){if(world.room)return;clearRoute();skater.restore(checkpoint);syncSkate();trail?.clear();dust.clear();drawSkate(0);},
    enable(on,progress){
      if(on){
        if(world.room)return false;
        if(skater.active())return true;
        clearRoute();skater.mount(state.x,state.z,state.yaw,progress,{y:state.y,vy:state.vy,supportId:state.supportId});syncSkate();trail?.clear();dust.clear();drawSkate(0);
      }else{
        boardEmote=null;boardEmoteAt=0;
        const s=skater.unmount();
        if(look){look.release();look.root.visible=false;}
        if(s)state={...placeBody(state,s.x,s.z,world,s.yaw),y:s.y,vy:s.vy,air:Math.max(0,s.clearance),supportId:undefined};
        motion.skatePose=undefined;figure.pose(0,0,0,motion);write();
      }
      return true;
    },
  };

  function clearRoute(): void { route = null; }

  /**
   * Steer along the planned route: one smooth line through its corners, never
   * an arrival-and-stop at each waypoint. The body's own give-up (walking and
   * getting nowhere) ends the route too.
   */
  function steerRoute(): void {
    if (!route) return;
    if (!state.goal) { clearRoute(); return; }
    const aim = steer(route, state.x, state.z);
    state = { ...state, goal: aim.final ? { x: aim.target.x, z: aim.target.z, run: route.run } : { x: aim.target.x, z: aim.target.z, pass: true, run: route.run } };
  }

  function write(): void {
    // On the board the look owns the figure's transform.
    if (skater.active()) return;
    figure.group.position.set(state.x, state.y, state.z);
    figure.group.rotation.y = state.yaw;
  }
  write();
  figure.pose(0, 0, 0);

  return {
    group,skate,
    setWorld(next) {
      if(next.room)skate.enable(false);
      if (next.groundHeightAt) world.groundHeightAt = next.groundHeightAt;
      if (next.obstacles) world.obstacles = next.obstacles;
      if (next.room !== undefined) world.room = next.room;
      clearRoute();
      // Whatever it was doing was aimed at the place it was standing in.
      // Geometry refreshes must preserve the current deck/underpass and airborne height.
      state = { ...state, goal: null, stalled: 0 };
      write();
    },
    state: () => state,
    shoulders: () => [state.x, eyeHeight(state), state.z],
    setInput(next) { input = next; if (next.forward !== 0 || next.strafe !== 0) clearRoute(); },
    input: () => input,
    goTo(x, z, y) {
      if(skater.active())skate.enable(false);
      if(ride)return false;
      clearRoute();
      const planned = planWalk({ x: state.x, z: state.z, y: state.y - state.air }, { x, z, ...(y === undefined || !Number.isFinite(y) ? {} : { y }) }, world);
      lastPlan = planned;
      if (!planned || planned.points.length < 2) { state = { ...state, goal: null, stalled: 0 }; return false; }
      route = followRoute(planned);
      const end = planned.points[planned.points.length - 1]!;
      // The destination is held out of anything solid first, so a tap on a wall walks to its foot.
      state = walkTo(state, end.x, end.z, world);
      state = { ...state, goal: { ...state.goal!, pass: true, run: route.run } };
      steerRoute();
      return true;
    },
    plan: () => lastPlan,
    attach(pose) {
      if (pose) {
        if (skater.active()) skate.enable(false);
        clearRoute();
        ride = pose;
        state = { ...state, x: pose.x, y: pose.y, z: pose.z, yaw: pose.yaw, speed: 0, air: 0, vy: 0, goal: null, stalled: 0, slide: 0, charge: 0, emote: null, returning: null, peak: pose.y };
        setFade(1);
        write();
        trail?.clear(); dust.clear();
      } else ride = null;
    },
    riding: () => ride !== null,
    runLock(on) { if (on !== undefined) runLocked = on; return runLocked; },
    setAvatar(avatar){
      look?.release();
      figure.group.removeFromParent();figure.dispose();
      figure=avatar?createPlayableFigure(avatar,tier,{invalidate:options.invalidate,onStatus:options.onAvatarStatus}):createBodyFigure(options.colours);
      group.add(figure.group);write();figure.pose(state.phase,gaitOf(state),0,motion);
      look?.setFigure(figure);
      if(skater.active())drawSkate(0);
    },
    // On the board the keys go to the skate input (HarbourWorld routes them);
    // the walking moves do nothing there. Emotes animate the rider on the board.
    jump() { if(!skater.active())state = requestJump(state); },
    slideNow() { if(!skater.active())state = requestSlide(state); },
    emote(id) {
      if(skater.active()) {boardEmote=boardEmote===id?null:id;boardEmoteAt=0;drawSkate(0);return;}
      state = requestEmote(state, id);
    },
    action: () => skater.active()?skateAct(skater.present(),true):actionOf(state),
    setReduced(next) {
      if (next === reduced) return;
      reduced = next;
      dust.group.visible = !next;
      if (next) { dust.clear(); motion.lean = 0; motion.bank = 0; motion.run = 0; motion.flourish = 0; }
      else motion.flourish = 1;
    },
    cancel() { skater.input()?.reset(); clearRoute(); lastPlan = null; state = { ...state, goal: null, stalled: 0 }; },
    place(x, z, yaw, y) { if(skater.active())skate.enable(false);clearRoute();ride=null; state = placeBody(state, x, z, world, yaw ?? state.yaw, y!==undefined&&Number.isFinite(y)?y:undefined); if(y!==undefined&&Number.isFinite(y))state={...state,y};setFade(1);write(); trail?.clear(); dust.clear(); },
    step(dt, t, theta) {
      if(skater.active()){
        if(boardEmote&&!skater.paused()){
          boardEmoteAt+=Math.max(0,dt);
          if(boardEmoteAt>=EMOTE_MAX_SECONDS||(!EMOTE_LOOPS[boardEmote]&&boardEmoteAt>=EMOTE_SECONDS[boardEmote])){boardEmote=null;boardEmoteAt=0;}
        }
        const ride=skater.step(dt);syncSkate();drawSkate(dt);
        if(ride.banked>0&&!skateReduced())look?.celebrate(Math.min(1,.25+ride.banked/6000));
        return ride.moving;
      }
      if (ride) {
        // Carried: the cabin's transform is the body's. It holds a ride pose — seated in a gondola, standing in a funicular.
        write();
        motion.run = 0; motion.lean = 0; motion.bank = 0; motion.air = 0; motion.rise = 0; motion.crouch = 0; motion.slide = 0; motion.incline = 0;
        motion.emote = ride.seated ? "sit" : null; motion.emoteAt = ride.seated ? 1 : 0; motion.flourish = reduced ? 0 : 1;
        figure.pose(state.phase, 0, t, motion);
        return true;
      }
      if (input.forward !== 0 || input.strafe !== 0) clearRoute();
      steerRoute();
      const frame = stepBody(state, runLocked && !input.run ? { ...input, run: true } : input, theta, dt, world);
      state = frame.state;
      if (route && !state.goal) clearRoute();
      setFade(frame.fade);
      if (frame.returned) { trail?.clear(); dust.clear(); }
      write();
      // Reduced motion keeps the gait and drops the weight: the body walks,
      // it just stops acting.
      motion.run = reduced ? 0 : runFraction(state.speed);
      motion.lean = reduced ? 0 : state.lean;
      motion.bank = reduced ? 0 : state.bank;
      motion.incline = reduced ? 0 : state.incline ?? 0;
      // The moves themselves are never withheld — a jump is how you get over
      // a thing, and an emote is something you said. Reduced motion turns the
      // *performance* off (`flourish`), not the move.
      motion.air = state.air;
      motion.rise = Math.max(-1, Math.min(1, state.vy / JUMP_SPEED));
      motion.crouch = state.crouch;
      motion.slide = state.slide > 0 ? Math.min(1, state.slide / SLIDE_SECONDS) : 0;
      motion.emote = state.emote;
      motion.emoteAt = state.emoteAt;
      motion.flourish = reduced ? 0 : 1;
      figure.pose(state.phase, gaitOf(state), t, motion);
      const foot = frame.footfall;
      if (foot) {
        trail?.drop(foot.x, foot.y, foot.z, foot.yaw, foot.left, foot.force);
        // Every footfall of a run throws dust; a walk only scuffs, and only
        // on the foot that is really carrying — one puff a stride, not two.
        if (!reduced && (foot.force > 0.05 || foot.left)) {
          dust.puff(foot.x, foot.y, foot.z, 0.18 + foot.force * 0.82);
        }
      }
      // ── The moves on the ground ──────────────────────────────────────────
      // A take-off scuffs under the feet; a landing throws a ring outward,
      // which is what tells you the ground was hit rather than touched.
      if (frame.jumped && !reduced) {
        dust.puff(frame.jumped.x, frame.jumped.y, frame.jumped.z, 0.3 + frame.jumped.force * 0.5);
        if (frame.jumped.second) dust.ring(frame.jumped.x, frame.jumped.y, frame.jumped.z, 0.42);
      }
      if (frame.landing) {
        if (!reduced) dust.ring(frame.landing.x, frame.landing.y, frame.landing.z, 0.35 + frame.landing.force * 0.65);
        trail?.drop(frame.landing.x, frame.landing.y, frame.landing.z, state.yaw, true, frame.landing.force);
      }
      // A slide lays a continuous mark and trails a plume behind it.
      if (frame.sliding) {
        plume -= dt;
        if (plume <= 0) {
          plume = SLIDE_MARK_SECONDS;
          trail?.drop(state.x, state.y - state.air, state.z, state.yaw, state.slide > SLIDE_SECONDS * 0.5, 1);
          if (!reduced) dust.puff(state.x - Math.sin(state.yaw) * 0.09, state.y - state.air, state.z - Math.cos(state.yaw) * 0.09, 0.85);
        }
      } else plume = 0;
      // Pulling up hard out of a run: a burst under both feet, which is the
      // whole read of a skid from behind.
      if (frame.skid && !skidding && !reduced) {
        dust.puff(state.x + Math.cos(state.yaw) * 0.05, state.y, state.z - Math.sin(state.yaw) * 0.05, 0.8);
        dust.puff(state.x - Math.cos(state.yaw) * 0.05, state.y, state.z + Math.sin(state.yaw) * 0.05, 0.62);
        trail?.drop(state.x, state.y, state.z, state.yaw, state.speed > WALK_SPEED, 1);
      }
      skidding = frame.skid;
      // Both, every frame: `||` would leave the dust hanging in the air for as
      // long as a print was still fading.
      const still = state.speed <= 0.01;
      const printsLeft = trail ? trail.fade(dt, still) : false;
      const dustLeft = dust.fade(dt);
      const fading = printsLeft || dustLeft;
      // A standing body still breathes, so a frame is worth painting while
      // the idle is running — but only while something is actually asking for
      // frames; a settled world is never woken by this.
      return frame.moving || fading;
    },
    walking: () => state.speed > 0.01,
    setColours(next) { figure.setColours(next); },
    bounds(target) {
      target.set(
        new THREE.Vector3(state.x - BODY_RADIUS, state.y, state.z - BODY_RADIUS),
        new THREE.Vector3(state.x + BODY_RADIUS, state.y + BODY_HEIGHT, state.z + BODY_RADIUS),
      );
      return target;
    },
    dispose() {
      skater.unmount();look?.dispose();look=null;
      figure.dispose();
      trail?.dispose();
      dust.dispose();
      group.removeFromParent();
      box.makeEmpty();
    },
  };
}
