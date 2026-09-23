import * as THREE from "three";
import { createCatFigure, type CatColours, type CatFigure, type CatMotion } from "./catFigure.ts";
import { createFootprints, FOOTPRINT_POOL_LITE, PAW_SIZE, type Footprints } from "./footprints.ts";
import {
  CAT_HEIGHT, CAT_RADIUS,
  catGaitOf, createCatState, heelPoint, heelStand, placeCat, stepCat,
  type CatErrand, type CatState, type CatSubject,
} from "./catModel.ts";
import type { Obstacle, RoomBounds } from "./obstacles.ts";
import type { BodyWorld } from "./bodyModel.ts";
import { findPath } from "./pathfinder.ts";

/**
 * Little Harbour · Hercules standing on the island.
 *
 * The joint between `catModel.ts` (pure) and `catFigure.ts` (meshes), and the
 * exact shape of `body/walker.ts` on purpose: one object that owns a state, a
 * figure, a trail of paw prints and the ground he walks on, and asks for no
 * frames of its own. `scene/runtime.ts` calls `step` inside the frame the
 * renderer lease already owns; there is no `requestAnimationFrame` in this
 * lane either.
 *
 * He owns no dust. Dust is the weight of a person's heel and a cat has none;
 * it would also be a second pool to fade, and a second thing to finish fading
 * before the island may sleep.
 */

export type CatOptions = {
  groundHeightAt: (x: number, z: number) => number;
  obstacles?: readonly Obstacle[];
  room?: RoomBounds | null;
  shore?: number;
  tier?: "full" | "lite";
  colours?: Partial<CatColours>;
  start?: { x: number; z: number; yaw?: number };
  /** What he is looking at when he is stood down — the body, everywhere the runtime raises him. */
  look?: { x: number; z: number } | null;
  /** Paw prints beside your footprints. Half the pool a person gets: a lighter animal leaves less. */
  trail?: boolean;
  reduced?: boolean;
};

export type Cat = {
  group: THREE.Group;
  setWorld(next: { groundHeightAt?: (x: number, z: number) => number; obstacles?: readonly Obstacle[]; room?: RoomBounds | null; shore?: number }): void;
  state(): CatState;
  /** Where something wants a person, or null. He walks there and waits by the door. */
  setErrand(errand: CatErrand | null): void;
  /** This place's warm stone, or null. He takes it when you stop beside it. */
  setPerch(perch: { x: number; z: number } | null): void;
  /** Put him somewhere at once (a stair, a journey), looking at `look` if he is given one. */
  place(x: number, z: number, yaw?: number, look?: { x: number; z: number } | null): void;
  /**
   * Rejoin a person after a quick journey. This is deliberately an instant,
   * safe placement, but only when the bounded island pathfinder can prove the
   * two clear positions are connected. It owns no frame.
   */
  catchUp(subject: CatSubject): boolean;
  /**
   * One frame. Returns true while anything of his is still moving — which is
   * exactly what the frame policy asks about, and which reaches false.
   */
  step(dt: number, t: number, subject: CatSubject): boolean;
  /** He is standing at the door he led you to. */
  waiting(): boolean;
  setReduced(reduced: boolean): void;
  bounds(target: THREE.Box3): THREE.Box3;
  dispose(): void;
};

/**
 * Where he is when the island first stands: **already at your heel**, which is
 * `heelPoint(COURT_ARRIVAL)` written out — a stride behind the spot a body
 * arrives on in the Court and a little to its left. He is not raised at the
 * Court's old prop spot and left to trot over: the first screen of a place has
 * a cat in it, and a world that has only just been mounted is allowed to be at
 * rest on the very first frame.
 */
export const CAT_ARRIVAL = Object.freeze({ x: 1.25, z: 5.84, yaw: Math.atan2(-0.3, -0.74) });

/** His prints are the same pool and the same fade as a person's, at `PAW_SIZE` of the size. */
export const PAW_POOL = 16, PAW_POOL_LITE = FOOTPRINT_POOL_LITE;
/** A small route is enough for a companion; planning stays below the frame budget. */
const NAV_REPLAN_SECONDS = 0.35, NAV_GOAL_SHIFT = 1.25, NAV_REACH = 0.34;

export function createCat(options: CatOptions): Cat {
  const tier = options.tier ?? "full";
  const world: BodyWorld = {
    groundHeightAt: options.groundHeightAt,
    obstacles: options.obstacles ?? [],
    room: options.room ?? null,
    shore: options.shore,
  };
  const group = new THREE.Group();
  group.name = "Hercules";
  const figure: CatFigure = createCatFigure(options.colours);
  group.add(figure.group);
  const trail: Footprints | null = (options.trail ?? true)
    ? createFootprints("#6b5a44", tier === "full" ? PAW_POOL : PAW_POOL_LITE, PAW_SIZE)
    : null;
  if (trail) group.add(trail.group);
  let reduced = options.reduced ?? false;
  let errand: CatErrand | null = null;
  let perch: { x: number; z: number } | null = null;
  let waiting = false;
  let route: { x: number; z: number }[] = [];
  let routeGoal: { x: number; z: number } | null = null;
  let nextRouteAt = 0;
  const motion: CatMotion = { mood: "sit", moodAt: 0, seated: 1, life: 0, bound: 0, ears: 0.5 };

  const start = options.start ?? CAT_ARRIVAL;
  let state = createCatState(start.x, start.z, start.yaw ?? CAT_ARRIVAL.yaw, world, options.look ?? undefined);

  function write(): void {
    figure.group.position.set(state.x, state.y, state.z);
    figure.group.rotation.y = state.yaw;
  }
  const clearRoute = () => { route = []; routeGoal = null; nextRouteAt = 0; };
  const routeTarget = (subject: CatSubject): { x: number; z: number } => errand ?? heelPoint(subject);
  function planRoute(subject: CatSubject, t: number): void {
    const goal = routeTarget(subject);
    const planned = findPath(
      { x: state.x, z: state.z }, goal,
      { obstacles: world.obstacles, room: world.room, shore: world.shore },
    );
    route = planned ?? [];
    routeGoal = goal;
    nextRouteAt = t + NAV_REPLAN_SECONDS;
  }
  write();
  figure.pose(0, 0, 0, motion);

  return {
    group,
    setWorld(next) {
      if (next.groundHeightAt) world.groundHeightAt = next.groundHeightAt;
      if (next.obstacles) world.obstacles = next.obstacles;
      if (next.room !== undefined) world.room = next.room;
      if (next.shore !== undefined) world.shore = next.shore;
      clearRoute();
      state = { ...state, y: world.groundHeightAt(state.x, state.z) };
      write();
    },
    state: () => state,
    setErrand(next) { if (next?.key !== errand?.key) clearRoute(); errand = next; },
    setPerch(next) { perch = next; clearRoute(); },
    place(x, z, yaw, look) { state = placeCat(state, x, z, world, yaw ?? state.yaw, look ?? undefined); clearRoute(); write(); trail?.clear(); },
    catchUp(subject) {
      // `placeCat` is also the one owner of shore, wall and collision holds.
      // Read the held destination back before asking the bounded pathfinder;
      // a quick journey must never stand him in water, inside a wall, or on
      // the far side of a closed room.
      const heel = heelStand(subject);
      const destination = placeCat(state, heel.x, heel.z, world, heel.yaw, subject);
      const route = findPath(
        { x: state.x, z: state.z },
        { x: destination.x, z: destination.z },
        { obstacles: world.obstacles, room: world.room, shore: world.shore },
      );
      if (!route) return false;
      state = destination;
      waiting = false;
      clearRoute();
      trail?.clear();
      write();
      return true;
    },
    step(dt, t, subject) {
      const goal = routeTarget(subject);
      const goalShifted = routeGoal === null || Math.hypot(goal.x - routeGoal.x, goal.z - routeGoal.z) > NAV_GOAL_SHIFT;
      const far = Math.hypot(goal.x - state.x, goal.z - state.z) > NAV_REACH;
      if (far && (route.length === 0 || goalShifted || t >= nextRouteAt || state.gaveUp !== null)) planRoute(subject, t);
      const frame = stepCat(state, subject, dt, world, { reduced, errand, perch, steer: route[0] ?? null });
      state = frame.state;
      while (route.length && Math.hypot(route[0]!.x - state.x, route[0]!.z - state.z) <= NAV_REACH) route.shift();
      waiting = frame.waiting;
      write();
      motion.mood = state.mood;
      motion.moodAt = state.moodAt;
      motion.seated = state.seated;
      // Reduced motion never lets the performance up off the floor, whatever
      // the model says: he walks, he leads, he sits, and none of it wobbles.
      motion.life = reduced ? 0 : state.life;
      motion.bound = reduced ? 0 : state.bound;
      motion.ears = state.ears;
      figure.pose(state.phase, catGaitOf(state), t, motion);
      const paw = frame.pawfall;
      if (paw) trail?.drop(paw.x, paw.y, paw.z, paw.yaw, paw.left, paw.force);
      // The same bargain a person's prints make: full life while he is walking
      // — which is when you can see the trail stretching to the door — and
      // cleared out inside a second and a half once he stops, so the island
      // can sleep. Both, every frame, so the answer is the whole truth.
      const settling = state.speed <= 0.01;
      const printsLeft = trail ? trail.fade(dt, settling) : false;
      return frame.moving || printsLeft;
    },
    waiting: () => waiting,
    setReduced(next) {
      if (next === reduced) return;
      reduced = next;
      if (next) { motion.life = 0; motion.bound = 0; }
    },
    bounds(target) {
      target.set(
        new THREE.Vector3(state.x - CAT_RADIUS, state.y, state.z - CAT_RADIUS),
        new THREE.Vector3(state.x + CAT_RADIUS, state.y + CAT_HEIGHT, state.z + CAT_RADIUS),
      );
      return target;
    },
    dispose() {
      figure.dispose();
      trail?.dispose();
      group.removeFromParent();
    },
  };
}
