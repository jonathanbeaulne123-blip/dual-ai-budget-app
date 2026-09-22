import * as THREE from "three";
import { createBodyFigure, type BodyFigure, type FigureColours } from "./figure.ts";
import { createFootprints, type Footprints } from "./footprints.ts";
import {
  BODY_HEIGHT,
  BODY_RADIUS,
  NO_INPUT,
  createBodyState,
  eyeHeight,
  gaitOf,
  placeBody,
  stepBody,
  walkTo,
  type BodyInput,
  type BodyState,
  type BodyWorld,
} from "./bodyModel.ts";
import { courtObstacles, type Obstacle, type RoomBounds } from "./obstacles.ts";
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
  /** Where it stands when it arrives, and which way it faces. */
  start?: { x: number; z: number; yaw?: number };
  /** Prints in the grass. Off on the lite tier by default: a phone spends its frames on the walk itself. */
  trail?: boolean;
};

export type Walker = {
  group: THREE.Group;
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
  /** Walk to a point on the ground — a tap. Straight line, sliding off whatever it meets. */
  goTo(x: number, z: number): void;
  /** Stop walking there (a second tap that meant something else). */
  cancel(): void;
  /** Put it somewhere at once. */
  place(x: number, z: number, yaw?: number): void;
  /**
   * One frame. `theta` is where the camera stands, so a push of the stick is
   * read the way the screen looks. Returns true while anything of the body's
   * still moves — which is exactly what the frame policy asks about.
   */
  step(dt: number, t: number, theta: number): boolean;
  /** Is it walking right now? */
  walking(): boolean;
  setColours(next: Partial<FigureColours>): void;
  /** The body's bounds in world space, for a DOM twin. */
  bounds(target: THREE.Box3): THREE.Box3;
  dispose(): void;
};

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
  const figure: BodyFigure = createBodyFigure(options.colours);
  group.add(figure.group);
  const trail: Footprints | null = (options.trail ?? tier === "full") ? createFootprints("#6b5a44") : null;
  if (trail) group.add(trail.group);

  const start = options.start ?? COURT_ARRIVAL;
  let state = createBodyState(start.x, start.z, start.yaw ?? COURT_ARRIVAL.yaw, world);
  let input: BodyInput = NO_INPUT;
  const box = new THREE.Box3();

  function write(): void {
    figure.group.position.set(state.x, state.y, state.z);
    figure.group.rotation.y = state.yaw;
  }
  write();
  figure.pose(0, 0, 0);

  return {
    group,
    setWorld(next) {
      if (next.groundHeightAt) world.groundHeightAt = next.groundHeightAt;
      if (next.obstacles) world.obstacles = next.obstacles;
      if (next.room !== undefined) world.room = next.room;
      // Whatever it was doing was aimed at the place it was standing in.
      state = { ...state, goal: null, stalled: 0, y: world.groundHeightAt(state.x, state.z) };
      write();
    },
    state: () => state,
    shoulders: () => [state.x, eyeHeight(state), state.z],
    setInput(next) { input = next; },
    input: () => input,
    goTo(x, z) { state = walkTo(state, x, z, world); },
    cancel() { state = { ...state, goal: null, stalled: 0 }; },
    place(x, z, yaw) { state = placeBody(state, x, z, world, yaw ?? state.yaw); write(); trail?.clear(); },
    step(dt, t, theta) {
      const frame = stepBody(state, input, theta, dt, world);
      state = frame.state;
      write();
      figure.pose(state.phase, gaitOf(state), t);
      if (frame.footfall && trail) trail.drop(frame.footfall.x, frame.footfall.y, frame.footfall.z, frame.footfall.yaw, frame.footfall.left);
      const fading = trail ? trail.fade(dt) : false;
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
      figure.dispose();
      trail?.dispose();
      group.removeFromParent();
      box.makeEmpty();
    },
  };
}
