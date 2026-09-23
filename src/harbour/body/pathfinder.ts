import { BODY_RADIUS, doorWall, holdAshore, holdInRoom, pushOut, type Obstacle, type RoomBounds } from "./obstacles.ts";

/** A point the walker may visit on its way to a requested destination. */
export type PathPoint = Readonly<{ x: number; z: number }>;

export type PathWorld = Readonly<{
  obstacles: readonly Obstacle[];
  room?: RoomBounds | null;
  shore?: number;
}>;

/** Keep planning deliberately small: this is a village route, not a navigation service. */
export const PATH_MAX_NODES = 128;
export const PATH_MAX_EXPANSIONS = 512;
export const PATH_CLEARANCE = 0.035;
/** Candidate corners stand just beyond the collision envelope, never exactly on it. */
const CORNER_NUDGE = 0.03;
const EPSILON = 1e-7;

const finite = (...values: number[]): boolean => values.every(Number.isFinite);

function validObstacle(obstacle: Obstacle): boolean {
  if (obstacle.kind === "circle") return finite(obstacle.x, obstacle.z, obstacle.r) && obstacle.r >= 0;
  if (obstacle.kind === "box") return finite(obstacle.minX, obstacle.minZ, obstacle.maxX, obstacle.maxZ) && obstacle.maxX >= obstacle.minX && obstacle.maxZ >= obstacle.minZ;
  return finite(obstacle.x, obstacle.z, obstacle.halfX, obstacle.halfZ, obstacle.yaw) && obstacle.halfX >= 0 && obstacle.halfZ >= 0;
}

function validRoom(room: RoomBounds | null | undefined): boolean {
  return !room || finite(room.x, room.z, room.halfX, room.halfZ, room.yaw)
    && room.halfX > 0 && room.halfZ > 0
    && (!room.door || finite(room.door.x, room.door.z, room.door.half) && room.door.half >= 0);
}

function local(frame: { x: number; z: number; yaw: number }, point: PathPoint): PathPoint {
  const cos = Math.cos(frame.yaw), sin = Math.sin(frame.yaw), dx = point.x - frame.x, dz = point.z - frame.z;
  return { x: dx * cos - dz * sin, z: dz * cos + dx * sin };
}

function world(frame: { x: number; z: number; yaw: number }, x: number, z: number): PathPoint {
  const cos = Math.cos(frame.yaw), sin = Math.sin(frame.yaw);
  return { x: frame.x + x * cos + z * sin, z: frame.z + z * cos - x * sin };
}

function pointClear(point: PathPoint, obstacles: readonly Obstacle[]): boolean {
  for (const obstacle of obstacles) {
    if (obstacle.kind === "circle") {
      if (Math.hypot(point.x - obstacle.x, point.z - obstacle.z) <= obstacle.r + BODY_RADIUS + PATH_CLEARANCE) return false;
    } else if (obstacle.kind === "box") {
      const r = BODY_RADIUS + PATH_CLEARANCE;
      if (point.x >= obstacle.minX - r && point.x <= obstacle.maxX + r && point.z >= obstacle.minZ - r && point.z <= obstacle.maxZ + r) return false;
    } else {
      const p = local(obstacle, point), r = BODY_RADIUS + PATH_CLEARANCE;
      if (Math.abs(p.x) <= obstacle.halfX + r && Math.abs(p.z) <= obstacle.halfZ + r) return false;
    }
  }
  return true;
}

/** Liang-Barsky against an already-expanded axis-aligned box. */
function crossesBox(a: PathPoint, b: PathPoint, halfX: number, halfZ: number): boolean {
  const dx = b.x - a.x, dz = b.z - a.z;
  let enter = 0, leave = 1;
  for (const [p, q] of [[-dx, a.x + halfX], [dx, halfX - a.x], [-dz, a.z + halfZ], [dz, halfZ - a.z]] as const) {
    if (Math.abs(p) < EPSILON) { if (q < 0) return false; continue; }
    const at = q / p;
    if (p < 0) { if (at > leave) return false; if (at > enter) enter = at; }
    else { if (at < enter) return false; if (at < leave) leave = at; }
  }
  return enter <= leave;
}

function segmentHitsCircle(a: PathPoint, b: PathPoint, obstacle: Extract<Obstacle, { kind: "circle" }>): boolean {
  const dx = b.x - a.x, dz = b.z - a.z, length2 = dx * dx + dz * dz;
  const t = length2 <= EPSILON ? 0 : Math.max(0, Math.min(1, ((obstacle.x - a.x) * dx + (obstacle.z - a.z) * dz) / length2));
  return Math.hypot(a.x + dx * t - obstacle.x, a.z + dz * t - obstacle.z) <= obstacle.r + BODY_RADIUS + PATH_CLEARANCE;
}

function crossesDoor(room: RoomBounds, from: PathPoint, to: PathPoint): boolean {
  if (!room.door) return false;
  const a = local(room, from), b = local(room, to), dx = b.x - a.x, dz = b.z - a.z;
  const wall = doorWall(room);
  if (!wall) return false;
  const delta = wall.axis === "x" ? dx : dz;
  if (Math.abs(delta) <= EPSILON) return false;
  const edge = wall.axis === "x" ? wall.side * room.halfX : wall.side * room.halfZ;
  const start = wall.axis === "x" ? a.x : a.z;
  const t = (edge - start) / delta;
  if (t < -EPSILON || t > 1 + EPSILON) return false;
  const across = wall.axis === "x" ? a.z + dz * t : a.x + dx * t;
  const doorAcross = wall.axis === "x" ? room.door.z : room.door.x;
  return Math.abs(across - doorAcross) <= room.door.half + EPSILON;
}

function inRoom(point: PathPoint, room: RoomBounds): boolean {
  const p = local(room, point);
  return Math.abs(p.x) <= room.halfX + EPSILON && Math.abs(p.z) <= room.halfZ + EPSILON;
}

function segmentInRoom(a: PathPoint, b: PathPoint, room: RoomBounds | null | undefined): boolean {
  if (!room) return true;
  const aInside = inRoom(a, room), bInside = inRoom(b, room);
  if (aInside && bInside) return true;
  // A straight segment may leave a room only through its declared doorway.
  return aInside !== bInside && crossesDoor(room, a, b);
}

/** A segment is safe for the body's centre for its entire length, not only at its endpoints. */
export function pathSegmentClear(a: PathPoint, b: PathPoint, worldState: PathWorld): boolean {
  if (!finite(a.x, a.z, b.x, b.z) || !validRoom(worldState.room) || !worldState.obstacles.every(validObstacle)) return false;
  if (!segmentInRoom(a, b, worldState.room)) return false;
  for (const obstacle of worldState.obstacles) {
    if (obstacle.kind === "circle") { if (segmentHitsCircle(a, b, obstacle)) return false; }
    else if (obstacle.kind === "box") {
      const centre = { x: (obstacle.minX + obstacle.maxX) / 2, z: (obstacle.minZ + obstacle.maxZ) / 2 };
      const r = BODY_RADIUS + PATH_CLEARANCE;
      if (crossesBox({ x: a.x - centre.x, z: a.z - centre.z }, { x: b.x - centre.x, z: b.z - centre.z }, (obstacle.maxX - obstacle.minX) / 2 + r, (obstacle.maxZ - obstacle.minZ) / 2 + r)) return false;
    } else {
      const r = BODY_RADIUS + PATH_CLEARANCE;
      if (crossesBox(local(obstacle, a), local(obstacle, b), obstacle.halfX + r, obstacle.halfZ + r)) return false;
    }
  }
  return true;
}

function settled(point: PathPoint, worldState: PathWorld): PathPoint | null {
  if (!finite(point.x, point.z) || !validRoom(worldState.room) || !worldState.obstacles.every(validObstacle)) return null;
  const shore = holdAshore(point.x, point.z, worldState.shore);
  const room = worldState.room ? holdInRoom(shore.x, shore.z, BODY_RADIUS, worldState.room) : { x: shore.x, z: shore.z };
  const clear = pushOut(room.x, room.z, BODY_RADIUS + PATH_CLEARANCE, worldState.obstacles);
  return finite(clear.x, clear.z) ? { x: clear.x, z: clear.z } : null;
}

function addNode(nodes: PathPoint[], point: PathPoint, worldState: PathWorld, roomOnly: boolean): void {
  if (nodes.length >= PATH_MAX_NODES || !pointClear(point, worldState.obstacles) || roomOnly && worldState.room && !inRoom(point, worldState.room)) return;
  if (!nodes.some(node => Math.hypot(node.x - point.x, node.z - point.z) < 0.025)) nodes.push(point);
}

function obstacleCorners(obstacle: Obstacle): PathPoint[] {
  const r = BODY_RADIUS + PATH_CLEARANCE + CORNER_NUDGE;
  if (obstacle.kind === "circle") return Array.from({ length: 8 }, (_, index) => {
    const angle = index * Math.PI / 4;
    const orbit=(obstacle.r+BODY_RADIUS+PATH_CLEARANCE)/Math.cos(Math.PI/8)+CORNER_NUDGE;
    return { x: obstacle.x + Math.cos(angle) * orbit, z: obstacle.z + Math.sin(angle) * orbit };
  });
  const halfX = (obstacle.kind === "box" ? (obstacle.maxX - obstacle.minX) / 2 : obstacle.halfX) + r;
  const halfZ = (obstacle.kind === "box" ? (obstacle.maxZ - obstacle.minZ) / 2 : obstacle.halfZ) + r;
  const centre = obstacle.kind === "box" ? { x: (obstacle.minX + obstacle.maxX) / 2, z: (obstacle.minZ + obstacle.maxZ) / 2, yaw: 0 } : obstacle;
  return ([[-halfX, -halfZ], [-halfX, halfZ], [halfX, -halfZ], [halfX, halfZ]] as const).map(([x, z]) => world(centre, x, z));
}

/**
 * Finds a bounded, deterministic sequence of visible waypoints. `null` means
 * the destination cannot be reached without crossing a solid or a room wall.
 */
export function findPath(from: PathPoint, destination: PathPoint, worldState: PathWorld): PathPoint[] | null {
  // Keep the established tap-to-walk behaviour byte-for-byte on open ground.
  // The walker still owns its usual final clamp/push-out for a near-wall tap.
  if (pathSegmentClear(from, destination, worldState)) return [{ x: destination.x, z: destination.z }];
  const start = settled(from, worldState), target = settled(destination, worldState);
  if (!start || !target || !pointClear(start, worldState.obstacles) || !pointClear(target, worldState.obstacles)) return null;
  if (pathSegmentClear(start, target, worldState)) return [target];

  const roomOnly = Boolean(worldState.room && inRoom(start, worldState.room) && inRoom(target, worldState.room));
  const nodes: PathPoint[] = [start, target];
  // Spend the bounded graph on this journey's corridor, not on whichever
  // distant building happened to appear first in the island registry.
  const dx=target.x-start.x,dz=target.z-start.z,length2=dx*dx+dz*dz;
  const priority=(obstacle:Obstacle)=>{
    const x=obstacle.kind==='box'?(obstacle.minX+obstacle.maxX)/2:obstacle.x;
    const z=obstacle.kind==='box'?(obstacle.minZ+obstacle.maxZ)/2:obstacle.z;
    const radius=obstacle.kind==='circle'?obstacle.r:obstacle.kind==='box'?Math.hypot(obstacle.maxX-obstacle.minX,obstacle.maxZ-obstacle.minZ)/2:Math.hypot(obstacle.halfX,obstacle.halfZ);
    const t=length2?Math.max(0,Math.min(1,((x-start.x)*dx+(z-start.z)*dz)/length2)):0;
    return Math.max(0,Math.hypot(x-start.x-dx*t,z-start.z-dz*t)-radius)+Math.hypot(x-start.x,z-start.z)*.002;
  };
  for (const obstacle of [...worldState.obstacles].sort((a,b)=>priority(a)-priority(b))) {
    for (const corner of obstacleCorners(obstacle)) addNode(nodes, corner, worldState, roomOnly);
    if (nodes.length >= PATH_MAX_NODES) break;
  }
  const count = nodes.length, costs = new Array<number>(count).fill(Infinity), previous = new Array<number>(count).fill(-1), done = new Array<boolean>(count).fill(false);
  costs[0] = 0;
  let expansions = 0;
  for (; expansions < PATH_MAX_EXPANSIONS; expansions += 1) {
    let current = -1, best = Infinity;
    for (let index = 0; index < count; index += 1) if (!done[index] && costs[index]! < best) { best = costs[index]!; current = index; }
    if (current < 0 || current === 1) break;
    done[current] = true;
    const source = nodes[current]!;
    for (let next = 1; next < count; next += 1) {
      if (done[next] || !pathSegmentClear(source, nodes[next]!, worldState)) continue;
      const cost = best + Math.hypot(source.x - nodes[next]!.x, source.z - nodes[next]!.z);
      if (cost + EPSILON < costs[next]!) { costs[next] = cost; previous[next] = current; }
    }
  }
  if (!Number.isFinite(costs[1])) return null;
  const result: PathPoint[] = [];
  for (let index = 1; index > 0; index = previous[index]!) {
    if (index < 0 || result.length >= PATH_MAX_NODES) return null;
    result.push(nodes[index]!);
  }
  result.reverse();
  return result;
}
