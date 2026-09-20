/**
 * Authored, bounded walking routes for the cutaway house.  This deliberately
 * contains no free-space navigation: a caller can only move along these
 * doorways, stairwells, furniture thresholds and the Journey trail.
 */
export type WalkRoom = "home" | "study" | "kitchen-table" | "together";
export type WalkLevel = "below" | "middle" | "above";
export type WalkPoint = Readonly<{ x: number; y: number; z: number }>;
export type WalkNodeKind = "arrival" | "door" | "threshold" | "stair" | "pottery" | "island";
export type WalkNode = Readonly<{ id: string; kind: WalkNodeKind; point: WalkPoint; room?: WalkRoom; level?: WalkLevel }>;
export type WalkEdge = Readonly<{ from: string; to: string; kind: "room" | "door" | "threshold" | "stairs" | "pottery" | "island" }>;
export type WalkGraph = Readonly<{ nodes: readonly WalkNode[]; edges: readonly WalkEdge[] }>;
export type WalkTravelPoint = Readonly<{ point: WalkPoint; nodeId?: string }>;

const ROOMS: readonly WalkRoom[] = ["home", "study", "kitchen-table", "together"];
const LEVELS: readonly WalkLevel[] = ["below", "middle", "above"];
const ROOM_X: Record<WalkRoom, number> = { home: -9.3, study: -3.1, "kitchen-table": 3.1, together: 9.3 };
const FLOOR_Y: Record<WalkLevel, number> = { below: 0, middle: 3.05, above: 6.1 };
const STAIR_ROOMS: readonly WalkRoom[] = ["home", "study", "together"];
/** Together's flight leaves the pottery wheel and the adjoining bench clear. */
export const houseStairOffset = (room: WalkRoom): number => room === "together" ? 0.35 : ROOMS.indexOf(room) % 2 ? 1.86 : -1.86;

const point = (x: number, y: number, z: number): WalkPoint => ({ x, y, z });
const roomNode = (room: WalkRoom, level: WalkLevel) => `room:${room}:${level}`;
const stairNode = (room: WalkRoom, level: WalkLevel) => `stairs:${room}:${level}`;
const thresholdNode = (left: WalkRoom, right: WalkRoom, level: WalkLevel) => `threshold:${left}:${right}:${level}`;
const distanceSquared = (a: WalkPoint, b: WalkPoint) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;

function addEdge(edges: WalkEdge[], from: string, to: string, kind: WalkEdge["kind"]) {
  edges.push({ from, to, kind }, { from: to, to: from, kind });
}

/** The same room centres, door positions and stair offsets used by houseSet.ts. */
export function createWalkGraph(): WalkGraph {
  const nodes: WalkNode[] = [];
  const edges: WalkEdge[] = [];
  for (const room of ROOMS) for (const level of LEVELS) {
    nodes.push({ id: roomNode(room, level), kind: "arrival", room, level, point: point(ROOM_X[room], FLOOR_Y[level], 1.12) });
  }

  // Four front thresholds make every wing reachable from the shared arrival walk.
  for (const room of ROOMS) {
    const id = `door:${room}`;
    nodes.push({ id, kind: "door", room, level: "middle", point: point(ROOM_X[room], FLOOR_Y.middle, 2.67) });
    addEdge(edges, roomNode(room, "middle"), id, "door");
  }
  for (let index = 0; index < ROOMS.length - 1; index += 1) addEdge(edges, `door:${ROOMS[index]!}`, `door:${ROOMS[index + 1]!}`, "door");

  // Internal threshold slabs are the only lateral route on the lower and upper floors.
  for (let index = 0; index < ROOMS.length - 1; index += 1) {
    const left = ROOMS[index]!, right = ROOMS[index + 1]!;
    const x = (ROOM_X[left] + 2.9 + ROOM_X[right] - 2.9) / 2;
    for (const level of LEVELS) {
      const id = thresholdNode(left, right, level);
      nodes.push({ id, kind: "threshold", level, point: point(x, FLOOR_Y[level], 0.45) });
      addEdge(edges, roomNode(left, level), id, "threshold");
      addEdge(edges, id, roomNode(right, level), "threshold");
    }
  }

  // Three authored stairwells: kitchen floors reach a stair through its real adjoining thresholds.
  for (const room of STAIR_ROOMS) {
    const x = ROOM_X[room] + houseStairOffset(room);
    for (const level of LEVELS) {
      const id = stairNode(room, level);
      nodes.push({ id, kind: "stair", room, level, point: point(x, FLOOR_Y[level], -1.78) });
      addEdge(edges, roomNode(room, level), id, "room");
    }
    addEdge(edges, stairNode(room, "below"), stairNode(room, "middle"), "stairs");
    addEdge(edges, stairNode(room, "middle"), stairNode(room, "above"), "stairs");
  }

  nodes.push({ id: "pottery:threshold", kind: "pottery", room: "together", level: "middle", point: point(10.78, FLOOR_Y.middle, -1.18) });
  addEdge(edges, roomNode("together", "middle"), "pottery:threshold", "pottery");

  // The atlas is a real room destination; its short extension represents the island trail beyond the table.
  nodes.push(
    { id: "island:atlas", kind: "island", room: "kitchen-table", level: "above", point: point(3.1, FLOOR_Y.above, -0.6) },
    { id: "island:trailhead", kind: "island", room: "kitchen-table", level: "above", point: point(4.35, FLOOR_Y.above, 0.18) },
    { id: "island:lookout", kind: "island", room: "kitchen-table", level: "above", point: point(5.48, FLOOR_Y.above, 0.9) },
  );
  addEdge(edges, roomNode("kitchen-table", "above"), "island:atlas", "island");
  addEdge(edges, "island:atlas", "island:trailhead", "island");
  addEdge(edges, "island:trailhead", "island:lookout", "island");
  return { nodes, edges };
}

export const HOUSE_WALK_GRAPH = createWalkGraph();

function nodeMap(graph: WalkGraph): Map<string, WalkNode> { return new Map(graph.nodes.map(node => [node.id, node])); }
function neighbours(graph: WalkGraph, id: string): readonly WalkEdge[] { return graph.edges.filter(edge => edge.from === id); }

/** Deterministic shortest authored route. Unknown or disconnected targets return no path. */
export function findPath(from: string, to: string, graph: WalkGraph = HOUSE_WALK_GRAPH): readonly WalkNode[] | null {
  const nodes = nodeMap(graph);
  if (!nodes.has(from) || !nodes.has(to)) return null;
  if (from === to) return [nodes.get(from)!];
  const pending = new Set([from]);
  const distance = new Map([[from, 0]]);
  const previous = new Map<string, string>();
  while (pending.size) {
    const current = [...pending].sort((a, b) => (distance.get(a)! - distance.get(b)!) || a.localeCompare(b))[0]!;
    pending.delete(current);
    if (current === to) break;
    for (const edge of [...neighbours(graph, current)].sort((a, b) => a.to.localeCompare(b.to))) {
      const next = nodes.get(edge.to);
      const here = nodes.get(current)!;
      if (!next) continue;
      const candidate = distance.get(current)! + Math.sqrt(distanceSquared(here.point, next.point));
      if (candidate < (distance.get(edge.to) ?? Infinity)) { distance.set(edge.to, candidate); previous.set(edge.to, current); pending.add(edge.to); }
    }
  }
  if (!previous.has(to)) return null;
  const ids: string[] = [to];
  while (ids[0] !== from) ids.unshift(previous.get(ids[0]!)!);
  return ids.map(id => nodes.get(id)!);
}

/** Nearest graph node in the caller's reachable component, suitable for tap targets. */
export function nearestNode(position: WalkPoint, from?: string, graph: WalkGraph = HOUSE_WALK_GRAPH): WalkNode | null {
  const reachable = from ? new Set(findReachable(from, graph).map(node => node.id)) : null;
  return graph.nodes.filter(node => !reachable || reachable.has(node.id)).sort((a, b) => distanceSquared(a.point, position) - distanceSquared(b.point, position) || a.id.localeCompare(b.id))[0] ?? null;
}

export function findReachable(from: string, graph: WalkGraph = HOUSE_WALK_GRAPH): readonly WalkNode[] {
  const nodes = nodeMap(graph);
  if (!nodes.has(from)) return [];
  const seen = new Set([from]);
  const queue = [from];
  while (queue.length) for (const edge of neighbours(graph, queue.shift()!)) if (nodes.has(edge.to) && !seen.has(edge.to)) { seen.add(edge.to); queue.push(edge.to); }
  return [...seen].sort().map(id => nodes.get(id)!);
}

/** Subdivides each approved edge; no free-line shortcut is ever introduced. */
export function interpolateTravel(path: readonly WalkNode[], maximumStep = 0.34, graph: WalkGraph = HOUSE_WALK_GRAPH): readonly WalkTravelPoint[] {
  if (!Number.isFinite(maximumStep) || maximumStep <= 0) throw new Error("WALK_STEP_REQUIRED");
  if (!path.length) return [];
  const travel: WalkTravelPoint[] = [{ point: path[0]!.point, nodeId: path[0]!.id }];
  for (let index = 1; index < path.length; index += 1) {
    const from = path[index - 1]!, to = path[index]!;
    if (!graph.edges.some(edge => edge.from === from.id && edge.to === to.id)) throw new Error("WALK_EDGE_REQUIRED");
    const steps = Math.max(1, Math.ceil(Math.sqrt(distanceSquared(from.point, to.point)) / maximumStep));
    for (let step = 1; step <= steps; step += 1) {
      const amount = step / steps;
      travel.push({ point: point(from.point.x + (to.point.x - from.point.x) * amount, from.point.y + (to.point.y - from.point.y) * amount, from.point.z + (to.point.z - from.point.z) * amount), ...(step === steps ? { nodeId: to.id } : {}) });
    }
  }
  return travel;
}
