/**
 * Road lighting on the world clock (ROAD.md §6, D-R3; LIGHT §3, §6; STYLE §1.11) — and the one light-card system for every
 * `WorldDefinition.lights` anchor (door, threshold and corridor lamps share its caps).
 *
 * - The ramp: `k = roadLampRamp(sunElevation)` (smoothstep +2° → −6°, same curve at dawn and dusk; sky/night.ts). A run of
 *   lamps (`anchor.line`) switches on when k rises through `SWITCH.on` and off when it falls through `SWITCH.off`; each lamp
 *   follows `roadLampDelay(order)` after the switch (1 s apart, the whole run settled within 5 s) and warms over 300 ms.
 *   Lamp brightness = k × warm. State is per run, not per drawn card: a lamp entering the drawn set mid-evening is already
 *   on (no blink); a reload mid-evening plays the run's sequence once (≤ 5 s; LIGHT §7), nothing else.
 *   Tunnel lamps are always on (STYLE tunnel portal row).
 * - Cards: per road lamp a pool decal conformed to the ground under it (a polar grid whose vertices are set on the surface
 *   `ground()` reports; vertices off the surface fade to nothing, so no disc ever floats over a slope or a drop), additive;
 *   and a glow card with its halo (one camera-facing quad, analytic core + halo, additive). Door and threshold lamps keep
 *   their pool + bead; a threshold lamp on a road drops its bead to a flush stud on the pad (LOOK.md 27–28: it floated
 *   ~1.5 m over the lane and read as an obstacle).
 * - D-R3 point-light pool: a FIXED number of shadowless PointLights (full 6 / lite 2), added once and never removed;
 *   intensity 0 when unused, so dusk never changes the light count or recompiles a shader. Each slot serves one of the
 *   nearest lit lamps ahead of / around the camera; a slot changing lamp fades out, swaps at zero and fades in (0.4 s).
 * - Caps: NIGHT_LIGHT_CARDS full 160 / lite 48 in total, split road / anchor by LIGHT_CARD_SHARES; unused share is lent.
 * Hot path: `update` allocates nothing; the nearest set is re-picked every 500 ms or 20 eu of travel, or on a run switch.
 */
import * as THREE from 'three';
import type { LightAnchor, WorldDefinition } from '../world/definition.ts';
import { corridorLightAnchors, lampsForTier } from '../land/corridor/lights.ts';
import { LIGHT_CARD_SHARES, NIGHT_LIGHT_CARDS, ROAD_LIGHTS, roadLampDelay, roadLampRamp, type RoadLampKind } from '../sky/night.ts';

export type RoadLightsWorld = Pick<WorldDefinition, 'lights'> & Partial<Pick<WorldDefinition, 'beds' | 'corridors'>>;
export interface RoadLightsOptions {
  tier: 'full' | 'lite';
  /** Exact retained/themed fixtures from corridorArt, including scenic-stop fallback lamps. */
  corridorAnchors?:readonly LightAnchor[];
  /** The walkable surface height at (x, z) nearest `near` (at most ~1 eu above it), or null. Wire to
   * `(x,z,near)=>geography.surface(x,z,near+1,0)?.y??null`. Absent: pools lie flat at the pool point (tests). */
  ground?: (x: number, z: number, near: number) => number | null;
  /** Changes when collision arrives (e.g. `()=>geography.indexStats.chunks`); pools that missed ground are re-conformed. */
  revision?: () => number;
}
export interface RoadLightsUpdate {
  /** Where the nearest set is measured from (the body while walking/riding); default: the camera. */
  at?: readonly [number, number, number];
  /** Hide every card and zero the point lights (the Journey map). */
  hidden?: boolean;
}
export interface RoadLightsStats {
  k: number; linesOn: number; lines: number; roadLamps: number; anchors: number;
  cap: number; roadCards: number; anchorCards: number; cards: number;
  pointLights: number; pointLightsLit: number; pointAssigned: (string | null)[];
  poolTriangles: number; conformedPools: number;
}
export interface RoadLights {
  update(camera: THREE.Camera, sunElevationDeg: number, nowMs: number, options?: RoadLightsUpdate): void;
  /** Force a re-pick on the next update (the sun stepped, the mode changed). */
  refresh(): void;
  /** True while something is still moving on its own (a run's sequence, the ramp following the clock, a point-light
   * cross-fade): the frame loop keeps painting until it settles. */
  busy(nowMs: number): boolean;
  stats(): RoadLightsStats;
  /** Current brightness 0…1 of a road lamp by id (tests, the inspector). */
  intensity(id: string): number;
  /** Current intensities of the fixed point lights, in slot order (tests). */
  pointIntensities(): number[];
  readonly lights: readonly THREE.PointLight[];
  dispose(): void;
}

/** Run switching on the ramp (hysteresis so a stepped sun never flickers a run). */
export const ROAD_LIGHT_SWITCH = { on: 0.35, off: 0.25 } as const;
const PICK_MS = 500, PICK_MOVE = 20, POINT_PICK_MS = 250, CONFORM_BUDGET = { full: 8, lite: 4 } as const;
const POOL_RINGS = { full: [0, 0.25, 0.5, 0.75, 1], lite: [0, 0.34, 0.67, 1] } as const, POOL_SEGMENTS = { full: 16, lite: 12 } as const;
/** A pool vertex whose ground differs from the pool point by more than this is off the surface (a drop, a wall). */
const POOL_MAX_DELTA = 1.2;
const ROAD_KINDS = new Set<string>(Object.keys(ROAD_LIGHTS.kinds));
const isRoadKind = (kind: string): kind is RoadLampKind => ROAD_KINDS.has(kind);
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

interface Lamp { id: string; kind: RoadLampKind; head: THREE.Vector3; pool: THREE.Vector3; radius: number; line: number; order: number; always: boolean }
interface Line { id: string; count: number; on: boolean; since: number }

export function createRoadLights(scene: THREE.Scene, world: RoadLightsWorld, options: RoadLightsOptions): RoadLights {
  const tier = options.tier, cap = NIGHT_LIGHT_CARDS[tier], share = LIGHT_CARD_SHARES[tier];
  // ---- anchors: the definition's, plus corridor lamps the bake has not merged yet ----
  const corridors=world.corridors??[],owned=new Set(corridors.flatMap(c=>c.lamps.map(l=>l.id)));
  const selected=options.corridorAnchors??corridorLightAnchors(corridors.map(c=>({...c,lamps:[...lampsForTier(c,tier)]})));
  const chosen=new Map(selected.map(a=>[a.id,a]));
  // Resolve legacy missing anchors and tier selection together: fallback expansion
  // must never resurrect a lamp whose physical fixture was intentionally omitted.
  const all:LightAnchor[]=world.lights.filter(a=>!owned.has(a.id)||chosen.has(a.id)).map(a=>options.corridorAnchors?(chosen.get(a.id)??a):a);
  const have=new Set(all.map(a=>a.id));for(const a of selected)if(!have.has(a.id)){all.push(a);have.add(a.id);}
  const lamps: Lamp[] = [], anchors: { a: LightAnchor; stud: boolean }[] = [], lines: Line[] = [], lineIndex = new Map<string, number>();
  for (const a of all) {
    if (!isRoadKind(a.kind)) { anchors.push({ a, stud: a.kind === 'threshold' && onRoad(a, world.beds ?? []) }); continue; }
    const key = a.line ?? `${a.corridorId ?? 'road'}:${a.kind}`;
    let li = lineIndex.get(key); if (li === undefined) { li = lines.length; lineIndex.set(key, li); lines.push({ id: key, count: 0, on: false, since: -Infinity }); }
    const head = a.head ?? [a.at[0], a.at[1] + 5.2, a.at[2]], pool = a.pool ?? [a.at[0], a.at[1], a.at[2]];
    lamps.push({ id: a.id, kind: a.kind, head: new THREE.Vector3(head[0], head[1], head[2]), pool: new THREE.Vector3(pool[0], pool[1], pool[2]), radius: a.poolRadius ?? 4, line: li, order: a.order ?? -1, always: a.kind === 'tunnelLamp' });
  }
  // Lamps without an order are ranked by their place in the definition within their run.
  { const seen = new Map<number, number>(); for (const l of lamps) { const n = seen.get(l.line) ?? 0; if (l.order < 0) l.order = n; seen.set(l.line, n + 1); lines[l.line]!.count = Math.max(lines[l.line]!.count, l.order + 1); } }
  const lampById = new Map(lamps.map((l, i) => [l.id, i]));

  // ---- door / threshold cards (the pre-existing pool + bead, unchanged look) ----
  const anchorMax = Math.max(1, Math.min(cap, anchors.length)), roadMax = Math.max(1, Math.min(cap, lamps.length));
  const anchorPoolGeometry = new THREE.CircleGeometry(NIGHT_LIGHT_CARDS.poolRadius, 20).rotateX(-Math.PI / 2), beadGeometry = new THREE.SphereGeometry(NIGHT_LIGHT_CARDS.beadRadius, 8, 6);
  const anchorPoolMaterial = new THREE.MeshBasicMaterial({ color: NIGHT_LIGHT_CARDS.pool, transparent: true, opacity: NIGHT_LIGHT_CARDS.poolOpacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 }), beadMaterial = new THREE.MeshBasicMaterial({ color: NIGHT_LIGHT_CARDS.bead });
  const anchorPools = new THREE.InstancedMesh(anchorPoolGeometry, anchorPoolMaterial, anchorMax), beads = new THREE.InstancedMesh(beadGeometry, beadMaterial, anchorMax);
  anchorPools.name = 'lightCards.anchorPools'; beads.name = 'lightCards.beads'; anchorPools.renderOrder = 3; anchorPools.frustumCulled = beads.frustumCulled = false; anchorPools.count = beads.count = 0;

  // ---- road glow + halo: one camera-facing quad per lamp, additive ----
  const glowMaterial = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.clone(THREE.UniformsLib.fog), fog: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 vUv;varying vec3 vGlow;\n#include <fog_pars_vertex>\nvoid main(){vUv=uv;\n#ifdef USE_INSTANCING_COLOR\nvGlow=instanceColor;\n#else\nvGlow=vec3(1.0);\n#endif\nvec4 mv=modelViewMatrix*instanceMatrix*vec4(0.0,0.0,0.0,1.0);float s=length(instanceMatrix[0].xyz);mv.xy+=position.xy*s;gl_Position=projectionMatrix*mv;\n#ifdef USE_FOG\nvFogDepth=-mv.z;\n#endif\n}`,
    fragmentShader: `varying vec2 vUv;varying vec3 vGlow;\n#include <fog_pars_fragment>\nvoid main(){float r=length(vUv*2.0-1.0);float core=1.0-smoothstep(${(0.29 * 0.8).toFixed(3)},0.29,r);float halo=pow(max(0.0,1.0-r),2.2)*0.55;vec3 c=vGlow*(core*1.6+halo);\n#if defined(USE_FOG)&&!defined(FOG_EXP2)\nc*=1.0-smoothstep(fogNear,fogFar,vFogDepth);\n#endif\ngl_FragColor=vec4(c,1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}`,
  });
  const glows = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 2), glowMaterial, roadMax);
  glows.name = 'lightCards.roadGlows'; glows.renderOrder = 5; glows.frustumCulled = false; glows.count = 0;
  glows.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(roadMax * 3), 3);

  // ---- road pool decals: conformed polar grids merged into one additive draw ----
  const rings = POOL_RINGS[tier], segments = POOL_SEGMENTS[tier], perPool = 1 + (rings.length - 1) * segments;
  const poolIndexPattern: number[] = [];
  for (let s = 0; s < segments; s++) poolIndexPattern.push(0, 1 + (s + 1) % segments, 1 + s);
  for (let r = 1; r < rings.length - 1; r++) for (let s = 0; s < segments; s++) {
    const a = 1 + (r - 1) * segments + s, b = 1 + (r - 1) * segments + (s + 1) % segments, c = a + segments, d = b + segments;
    poolIndexPattern.push(a, b, d, a, d, c);
  }
  const perPoolIndices = poolIndexPattern.length, poolMax = roadMax;
  const poolIndex = new (poolMax * perPool > 65535 ? Uint32Array : Uint16Array)(poolMax * perPoolIndices);
  for (let p = 0; p < poolMax; p++) for (let i = 0; i < perPoolIndices; i++) poolIndex[p * perPoolIndices + i] = p * perPool + poolIndexPattern[i]!;
  const poolPositions = new Float32Array(poolMax * perPool * 3), poolColors = new Float32Array(poolMax * perPool * 3);
  const poolGeometry = new THREE.BufferGeometry();
  poolGeometry.setAttribute('position', new THREE.BufferAttribute(poolPositions, 3).setUsage(THREE.DynamicDrawUsage));
  poolGeometry.setAttribute('color', new THREE.BufferAttribute(poolColors, 3).setUsage(THREE.DynamicDrawUsage));
  poolGeometry.setIndex(new THREE.BufferAttribute(poolIndex, 1)); poolGeometry.setDrawRange(0, 0);
  poolGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);
  const poolMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });
  const pools = new THREE.Mesh(poolGeometry, poolMaterial); pools.name = 'lightCards.roadPools'; pools.renderOrder = 3; pools.frustumCulled = false;
  /** Per-lamp conformed pool: xyz per vertex and the vertex's falloff (0 where it missed the ground). Cached. */
  const conformed = new Map<number, { xyz: Float32Array; fall: Float32Array; complete: boolean }>();
  let conformRevision = options.revision?.() ?? 0;
  function conform(i: number) {
    let c = conformed.get(i); if (c) return c;
    const l = lamps[i]!, xyz = new Float32Array(perPool * 3), fall = new Float32Array(perPool);
    let complete = true, v = 0;
    const put = (x: number, z: number, r: number) => {
      const g = options.ground ? options.ground(x, z, l.pool.y) : l.pool.y, ok = g !== null && Math.abs(g - l.pool.y) <= POOL_MAX_DELTA + r * l.radius * 0.12;
      if (g === null) complete = false;
      xyz[v * 3] = x; xyz[v * 3 + 1] = (ok ? g! : l.pool.y) + ROAD_LIGHTS.poolLift; xyz[v * 3 + 2] = z;
      fall[v] = ok ? (1 - r * r) ** 2 : 0; v++;
    };
    put(l.pool.x, l.pool.z, 0);
    for (let r = 1; r < rings.length; r++) for (let s = 0; s < segments; s++) { const a = s / segments * Math.PI * 2, rr = rings[r]! * l.radius; put(l.pool.x + Math.cos(a) * rr, l.pool.z + Math.sin(a) * rr, rings[r]!); }
    c = { xyz, fall, complete }; conformed.set(i, c); return c;
  }

  // ---- D-R3 point lights: fixed, shadowless, never removed ----
  // A world without road lamps (a bake before the corridor lands) gets none: idle lights still cost every lit fragment.
  const pointCount = lamps.length ? ROAD_LIGHTS.pointLights[tier] : 0, lights: THREE.PointLight[] = [];
  for (let i = 0; i < pointCount; i++) {
    const p = new THREE.PointLight(ROAD_LIGHTS.colour, 0, ROAD_LIGHTS.pointDistance, ROAD_LIGHTS.pointDecay);
    p.castShadow = false; p.name = `roadLights.point.${i}`; p.position.set(0, -1000, 0); lights.push(p);
  }
  // The group is never hidden: an invisible PointLight drops out of the light count and recompiles every lit material.
  const group = new THREE.Group(); group.name = 'roadLights'; group.add(anchorPools, beads, pools, glows, ...lights); scene.add(group);
  const cards: THREE.Object3D[] = [anchorPools, beads, pools, glows];

  // ---- state (preallocated; nothing allocates in update) ----
  const lampLevel = new Float32Array(lamps.length), lampDist = new Float64Array(lamps.length), lampOrder = new Uint32Array(lamps.length);
  const anchorDist = new Float64Array(anchors.length), anchorOrder = new Uint32Array(anchors.length);
  const picked = new Int32Array(roadMax), pickedAnchor = new Int32Array(anchorMax);
  let pickedCount = 0, pickRadius = Infinity, poolCount = 0;
  const slotLamp = new Int32Array(pointCount).fill(-1), slotWeight = new Float32Array(pointCount), wanted = new Int32Array(pointCount).fill(-1), candidateScore = new Float64Array(lamps.length), candidateOrder = new Uint32Array(lamps.length);
  let first = true, displayK = 0, lastNow = 0, lastPick = -Infinity, lastPointPick = -Infinity, forcePick = true, wasNight = false, wasHidden = false;
  const lastAt = new THREE.Vector3(Infinity, 0, 0), at = new THREE.Vector3(), forward = new THREE.Vector3(), matrix = new THREE.Matrix4(), colour = new THREE.Color(ROAD_LIGHTS.colour), tmp = new THREE.Color();

  const byLampDist = (a: number, b: number) => lampDist[a]! - lampDist[b]!, byAnchorDist = (a: number, b: number) => anchorDist[a]! - anchorDist[b]!, byScore = (a: number, b: number) => candidateScore[a]! - candidateScore[b]!;
  /** A point light follows the clock for every kind: tunnel lamps' cards burn all day, their point lights join at dusk. */
  const pointLevel = (i: number) => lamps[i]!.always ? displayK : lampLevel[i]!;
  function lampWarm(l: Lamp, now: number): number {
    if (l.always) return 1;
    const line = lines[l.line]!, t = (now - line.since - roadLampDelay(l.order, line.count)) / ROAD_LIGHTS.warmMs, w = Math.min(1, Math.max(0, t));
    const s = w * w * (3 - 2 * w); return line.on ? s : 1 - s;
  }
  function pick(camAt: THREE.Vector3, night: boolean) {
    // Road lamps: every lamp whose run is on (or still warming off) or that is always on.
    let n = 0;
    for (let i = 0; i < lamps.length; i++) { const l = lamps[i]!; if (!l.always && lampLevel[i]! <= 0 && !lines[l.line]!.on) continue; lampDist[i] = Math.hypot(l.pool.x - camAt.x, l.pool.z - camAt.z); lampOrder[n++] = i; }
    const roadNear = lampOrder.subarray(0, n).sort(byLampDist);
    let m = 0;
    if (night) for (let i = 0; i < anchors.length; i++) { const a = anchors[i]!.a; anchorDist[i] = Math.hypot(a.at[0] - camAt.x, a.at[2] - camAt.z); anchorOrder[m++] = i; }
    const anchorNear = anchorOrder.subarray(0, m).sort(byAnchorDist);
    let r = Math.min(roadNear.length, share.road, roadMax), a = Math.min(anchorNear.length, share.anchor, anchorMax);
    const spare = cap - r - a; r += Math.min(spare, Math.min(roadNear.length, roadMax) - r); a += Math.min(cap - r - a, Math.min(anchorNear.length, anchorMax) - a);
    pickedCount = r; for (let i = 0; i < r; i++) picked[i] = roadNear[i]!;
    pickRadius = r < roadNear.length && r > 0 ? lampDist[roadNear[r - 1]!]! : Infinity;
    for (let i = 0; i < a; i++) pickedAnchor[i] = anchorNear[i]!;
    // Door / threshold cards (a threshold on a road drops its bead to a flush stud on the pad).
    for (let i = 0; i < a; i++) {
      const { a: anchor, stud } = anchors[pickedAnchor[i]!]!, lift = anchor.kind === 'door' ? 2.2 : .8, ground = anchor.at[1] - lift;
      matrix.makeTranslation(anchor.at[0], ground + .06, anchor.at[2]); anchorPools.setMatrixAt(i, matrix);
      if (stud) matrix.makeScale(1, .22, 1).setPosition(anchor.at[0], ground + .03, anchor.at[2]); else matrix.makeTranslation(anchor.at[0], anchor.at[1], anchor.at[2]);
      beads.setMatrixAt(i, matrix);
    }
    anchorPools.count = beads.count = a; anchorPools.instanceMatrix.needsUpdate = beads.instanceMatrix.needsUpdate = true;
    // Glow matrices and pool positions for the picked road lamps.
    poolCount = 0; conformPending = false; let budget = CONFORM_BUDGET[tier];
    const poolFar = ROAD_LIGHTS.poolFade[tier][1];
    for (let i = 0; i < r; i++) {
      const l = lamps[picked[i]!]!;
      matrix.makeScale(ROAD_LIGHTS.kinds[l.kind].halo, ROAD_LIGHTS.kinds[l.kind].halo, 1).setPosition(l.head.x, l.head.y, l.head.z); glows.setMatrixAt(i, matrix);
      if (lampDist[picked[i]!]! < poolFar + l.radius) {
        // Conforming samples the ground ~65 times: at most CONFORM_BUDGET new pools per pick (nearest first); the rest next frame.
        if (!conformed.has(picked[i]!)) { if (budget <= 0) { conformPending = true; continue; } budget--; }
        const c = conform(picked[i]!); poolPositions.set(c.xyz, poolCount * perPool * 3); poolSlot[poolCount++] = picked[i]!;
      }
    }
    glows.count = r; glows.instanceMatrix.needsUpdate = true;
    (poolGeometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    poolGeometry.setDrawRange(0, poolCount * perPoolIndices);
  }
  const poolSlot = new Int32Array(poolMax);
  function paint(camAt: THREE.Vector3) {
    const glowColor = glows.instanceColor!.array as Float32Array, [near, far] = ROAD_LIGHTS.poolFade[tier];
    for (let i = 0; i < pickedCount; i++) {
      const li = picked[i]!, l = lamps[li]!, d = Math.hypot(l.pool.x - camAt.x, l.pool.z - camAt.z);
      const edge = Number.isFinite(pickRadius) ? 1 - smooth(pickRadius * (1 - ROAD_LIGHTS.glowFadeFraction), pickRadius, d) : 1, v = lampLevel[li]! * edge;
      glowColor[i * 3] = colour.r * v; glowColor[i * 3 + 1] = colour.g * v; glowColor[i * 3 + 2] = colour.b * v;
    }
    glows.instanceColor!.needsUpdate = true;
    for (let p = 0; p < poolCount; p++) {
      const li = poolSlot[p]!, l = lamps[li]!, c = conformed.get(li)!, d = Math.hypot(l.pool.x - camAt.x, l.pool.z - camAt.z);
      const v = lampLevel[li]! * ROAD_LIGHTS.kinds[l.kind].pool * (1 - smooth(near, far, d)), base = p * perPool * 3;
      tmp.copy(colour).multiplyScalar(v);
      for (let k = 0; k < perPool; k++) { const f = c.fall[k]!; poolColors[base + k * 3] = tmp.r * f; poolColors[base + k * 3 + 1] = tmp.g * f; poolColors[base + k * 3 + 2] = tmp.b * f; }
    }
    (poolGeometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
  }
  function pointPick(camAt: THREE.Vector3) {
    // Candidates: lit road lamps (no bollards) within the fade-out distance; lamps behind the camera count as farther.
    let n = 0; const far = ROAD_LIGHTS.pointFade[1];
    for (let i = 0; i < lamps.length; i++) {
      const l = lamps[i]!; if (l.kind === 'bollard' || pointLevel(i) <= 0.01) continue;
      const dx = l.head.x - camAt.x, dz = l.head.z - camAt.z, d = Math.hypot(dx, dz); if (d > far) continue;
      const ahead = d < 1e-6 ? 1 : (dx * forward.x + dz * forward.z) / d;
      candidateScore[i] = d * (ahead > -0.2 ? 1 : 1.6); candidateOrder[n++] = i;
    }
    const best = candidateOrder.subarray(0, n).sort(byScore), want = Math.min(pointCount, best.length);
    wanted.fill(-1); for (let i = 0; i < want; i++) wanted[i] = best[i]!;
  }
  function stepPoints(dt: number, camAt: THREE.Vector3): void {
     const rate = dt / ROAD_LIGHTS.pointFadeS;
    // Slots whose lamp is still wanted keep it; the rest fade out and, at zero, take a wanted lamp nobody serves.
    for (let s = 0; s < pointCount; s++) {
      const lamp = slotLamp[s]!, keep = lamp >= 0 && wanted.includes(lamp);
      if (keep) { if (slotWeight[s]! < 1) { slotWeight[s] = Math.min(1, slotWeight[s]! + rate); } continue; }
      if (lamp >= 0 && slotWeight[s]! > 0) { slotWeight[s] = Math.max(0, slotWeight[s]! - rate); if (slotWeight[s]! > 0) continue; }
      slotLamp[s] = -1;
      for (let w = 0; w < pointCount; w++) { const cand = wanted[w]!; if (cand < 0) continue; let served = false; for (let q = 0; q < pointCount; q++) if (slotLamp[q] === cand) { served = true; break; } if (!served) { slotLamp[s] = cand; slotWeight[s] = 0; break; } }
    }
    const [near, far] = ROAD_LIGHTS.pointFade;
    for (let s = 0; s < pointCount; s++) {
      const p = lights[s]!, lamp = slotLamp[s]!;
      if (lamp < 0) { p.intensity = 0; continue; }
      const l = lamps[lamp]!; p.position.copy(l.head);
      p.intensity = ROAD_LIGHTS.pointIntensity * pointLevel(lamp) * (1 - smooth(near, far, Math.hypot(l.head.x - camAt.x, l.head.z - camAt.z))) * slotWeight[s]!;
    }
  }

  let targetK = 0, conformPending = false, hiddenNow = false, paintedK = -1, picked_ = false; const paintedAt = new THREE.Vector3(Infinity, 0, 0);
  return {
    lights,
    update(camera, sunElevationDeg, nowMs, opts = {}) {
      const dt = first ? 0 : Math.min(0.1, Math.max(0, (nowMs - lastNow) / 1000)); lastNow = nowMs;
      const hidden = opts.hidden === true;
      if (hidden) {
        if (!wasHidden) { for (const m of cards) m.visible = false; for (const p of lights) p.intensity = 0; slotLamp.fill(-1); slotWeight.fill(0); wasHidden = true; }
        forcePick = true; hiddenNow = true; return;
      }
      if (wasHidden) { for (const m of cards) m.visible = true; wasHidden = false; }
      // The ramp: the clock's k, followed at a bounded rate (a dev date jump fades over a second); the first reading as-is.
      const target = roadLampRamp(sunElevationDeg); targetK = target; const step = ROAD_LIGHTS.rampRate * dt;
      displayK = first ? target : displayK + Math.max(-step, Math.min(step, target - displayK));
      for (const line of lines) {
        const on = line.on ? displayK > ROAD_LIGHT_SWITCH.off : displayK >= ROAD_LIGHT_SWITCH.on;
        // The first reading settles every run where the clock puts it (a reload mid-evening is already lit; nothing blinks).
        if (on !== line.on) { line.on = on; line.since = first ? -Infinity : nowMs; forcePick = true; }
      }
      for (let i = 0; i < lamps.length; i++) { const l = lamps[i]!; lampLevel[i] = l.always ? 1 : displayK * lampWarm(l, nowMs); }
      // The nearest set.
      if (opts.at) at.set(opts.at[0], opts.at[1], opts.at[2]); else camera.getWorldPosition(at);
      camera.getWorldDirection(forward); forward.y = 0; if (forward.lengthSq() < 1e-8) forward.set(0, 0, 1); forward.normalize();
      const night = sunElevationDeg < 0;
      // New collision (a chunk landed): pools conformed before it may have missed a deck; conform again on the next pick.
      if (options.revision && (forcePick || nowMs - lastPick >= PICK_MS)) { const rev = options.revision(); if (rev !== conformRevision) { conformRevision = rev; conformed.clear(); forcePick = true; } }
      if (night !== wasNight) { wasNight = night; forcePick = true; }
      if (forcePick || conformPending || nowMs - lastPick >= PICK_MS && at.distanceTo(lastAt) >= PICK_MOVE || nowMs - lastPick >= PICK_MS * 8) {
        pick(at, night); lastPick = nowMs; lastAt.copy(at); forcePick = false; picked_ = true;
      }
      // Repaint when a level is moving, after a pick, or after 0.5 eu of travel (distance fades); otherwise the buffers stand.
      let moving = displayK !== paintedK; for (const line of lines) if (nowMs - line.since < ROAD_LIGHTS.settleMs + ROAD_LIGHTS.warmMs * 2) { moving = true; break; }
      if (moving || picked_ || at.distanceTo(paintedAt) >= 0.5) { paint(at); paintedK = displayK; paintedAt.copy(at); }
      picked_ = false;
      if (first || nowMs - lastPointPick >= POINT_PICK_MS) { pointPick(at); lastPointPick = nowMs; }
      stepPoints(dt, at);
      first = false; hiddenNow = hidden;
    },
    refresh() { forcePick = true; lastPointPick = -Infinity; },
    busy(nowMs) {
      if (hiddenNow || first) return false;
      if (Math.abs(displayK - targetK) > 1e-4 || conformPending) return true;
      for (const line of lines) if (nowMs - line.since < roadLampDelay(line.count - 1, line.count) + ROAD_LIGHTS.warmMs) return true;
      for (let s = 0; s < pointCount; s++) {
        const lamp = slotLamp[s]!, want = wanted[s]!;
        if (lamp >= 0 && (slotWeight[s]! < 1 || !wanted.includes(lamp))) return true;
        if (want >= 0 && !slotLamp.includes(want)) return true;
      }
      return false;
    },
    intensity(id) { const i = lampById.get(id); return i === undefined ? 0 : lampLevel[i]!; },
    pointIntensities() { return lights.map(p => p.intensity); },
    stats() {
      let linesOn = 0; for (const l of lines) if (l.on) linesOn++;
      let lit = 0; for (const p of lights) if (p.intensity > 1e-3) lit++;
      return { k: displayK, linesOn, lines: lines.length, roadLamps: lamps.length, anchors: anchors.length, cap, roadCards: hiddenNow ? 0 : glows.count, anchorCards: hiddenNow ? 0 : anchorPools.count, cards: hiddenNow ? 0 : glows.count + anchorPools.count,
        pointLights: lights.length, pointLightsLit: lit, pointAssigned: Array.from(slotLamp, i => i >= 0 ? lamps[i]!.id : null), poolTriangles: poolCount * perPoolIndices / 3, conformedPools: conformed.size };
    },
    dispose() {
      scene.remove(group);
      for (const g of [anchorPoolGeometry, beadGeometry, poolGeometry, glows.geometry]) g.dispose();
      for (const m of [anchorPoolMaterial, beadMaterial, poolMaterial, glowMaterial]) m.dispose();
      anchors.length = 0; for (const p of lights) p.dispose();
    },
  };
}

/** A threshold lamp whose point lies on a road bed's carriageway (within half its width + 0.5 eu). */
function onRoad(a: LightAnchor, beds: NonNullable<RoadLightsWorld['beds']>): boolean {
  const x = a.at[0], z = a.at[2];
  for (const b of beds) {
    if (b.kind !== 'road') continue; const half = (b.width ?? 8) / 2 + .5, p = b.points;
    for (let i = 0; i + 1 < p.length; i++) {
      const ax = p[i]![0], az = p[i]![2], dx = p[i + 1]![0] - ax, dz = p[i + 1]![2] - az;
      if (Math.min(ax, ax + dx) - half > x || Math.max(ax, ax + dx) + half < x || Math.min(az, az + dz) - half > z || Math.max(az, az + dz) + half < z) continue;
      const l = dx * dx + dz * dz, t = l > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l)) : 0;
      if (Math.hypot(x - ax - dx * t, z - az - dz * t) <= half) return true;
    }
  }
  return false;
}
