/**
 * Object geography is derived from durable object identity, never from an
 * array index. Bump this only for a deliberate whole-world geography change.
 */
export const PATH_OBJECT_GEOMETRY_VERSION = "v1";

export type PathObjectGeometry = {
  version: typeof PATH_OBJECT_GEOMETRY_VERSION;
  /** Stable value from -1 through 1, used to fan neighbours around an anchor. */
  angle: number;
  /** Stable value from 0 through 1, used for radial distance. */
  radius: number;
  /** Stable animation/material phase in radians. */
  phase: number;
  /** Stable integer for finite authored palettes. */
  palette: number;
  /** Stable position along a path segment, kept away from both endpoints. */
  progress: number;
};

export type PathObjectAnchor = { x: number; z: number; a: number };
export type PathObjectPlacement = PathObjectAnchor & {
  distance: number;
  geometry: PathObjectGeometry;
};

export type PathObjectPlacementOptions = {
  /** Authored direction relative to the semantic anchor. */
  turn: number;
  /** Maximum ID-keyed fan on either side of `turn`. */
  angleSpread: number;
  /** Nearest distance from the semantic anchor. */
  distance: number;
  /** Additional ID-keyed distance from the semantic anchor. */
  distanceSpread: number;
};

export type PathObjectRingOptions = {
  /** Authored rotation of the object ring. */
  turn: number;
  /** Nearest authored distance from the era centre. */
  radius: number;
  /** Additional ID-keyed distance within the authored ring. */
  radiusSpread: number;
};

/** Authored world ranges: deliberately independent of the generated coast. */
export const PATH_GOAL_RING = { turn: 2.1, radius: 16, radiusSpread: 4 } as const;
export const PATH_KILN_RING = { turn: 2.42, radius: 14, radiusSpread: 3 } as const;
export const PATH_ERA_GATE_RADIUS = 23.5;

/** Small synchronous identity hash; geometry is presentation, not authority. */
export function pathObjectGeometryHash(kind: string, id: string, channel = 0): number {
  const value = `${PATH_OBJECT_GEOMETRY_VERSION}:${kind}:${id}:${channel}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193);
  }
  // Final avalanche prevents short, similarly prefixed IDs clustering.
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

function unit(kind: string, id: string, channel: number): number {
  return (pathObjectGeometryHash(kind, id, channel) + 0.5) / 0x100000000;
}

export function pathObjectGeometry(kind: string, id: string): PathObjectGeometry {
  const angle = unit(kind, id, 0) * 2 - 1;
  const radius = unit(kind, id, 1);
  const phase = unit(kind, id, 2) * Math.PI * 2;
  return {
    version: PATH_OBJECT_GEOMETRY_VERSION,
    angle,
    radius,
    phase,
    palette: pathObjectGeometryHash(kind, id, 3),
    progress: 0.12 + unit(kind, id, 4) * 0.68,
  };
}

/**
 * Places one durable object around a semantic month/object anchor. The result
 * depends on the object identity and anchor only, so sibling array changes do
 * not move it.
 */
export function pathObjectNearAnchor(
  kind: string,
  id: string,
  anchor: PathObjectAnchor,
  options: PathObjectPlacementOptions,
): PathObjectPlacement {
  const geometry = pathObjectGeometry(kind, id);
  const a = anchor.a + options.turn + geometry.angle * options.angleSpread;
  const distance = options.distance + geometry.radius * options.distanceSpread;
  return {
    x: anchor.x + Math.cos(a) * distance,
    z: anchor.z + Math.sin(a) * distance,
    a,
    distance,
    geometry,
  };
}

/** Places a durable object on a fixed era-centre ring, without reading terrain. */
export function pathObjectOnAuthoredRing(kind: string, id: string, options: PathObjectRingOptions): PathObjectPlacement {
  const geometry = pathObjectGeometry(kind, id);
  const a = geometry.phase + options.turn;
  const distance = options.radius + geometry.radius * options.radiusSpread;
  return { x: Math.cos(a) * distance, z: Math.sin(a) * distance, a, distance, geometry };
}

/** Places a semantic singleton at an authored radius in a supplied direction. */
export function pathPointOnAuthoredRing(a: number, radius: number): PathObjectAnchor & { distance: number } {
  return { x: Math.cos(a) * radius, z: Math.sin(a) * radius, a, distance: radius };
}
