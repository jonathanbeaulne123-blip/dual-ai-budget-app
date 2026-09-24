/**
 * Hearth Mountain v2 · the authored camera moments (C1, C5, C7, C9, C12).
 *
 * Every pose here is *derived* from the world the camera adapter describes
 * (`worldAdapter.ts`): the signature arrival shot from the town square and the
 * dam crest, the overview from every district, the arrivals from their doors,
 * the overlooks from what they overlook. When geography moves the dam, the
 * shot moves with it. Phone (390 × 844) and desktop compositions are
 * separate, and each is checked by `test/mountain-camera.test.ts` against the
 * frustum it is drawn with.
 *
 * Pure: no three.js, no DOM, no time.
 */
import { COURT_FOV, poseEye, poseFrom, realizePose, type Composition, type CourtPose, type Vec3 } from "./poses.ts";
import { FOLLOW_DISTANCE, FOLLOW_LOOK_HEIGHT, FOLLOW_PHI } from "./followCamera.ts";
import {
  CAMERA_DISTRICTS, CAMERA_DOORS, CAMERA_MOMENTS, CAMERA_PLOTS, DAM_CREST, DAM_FACE, DISTRICT_DOOR, QUAY,
  SUMMIT_TELESCOPE, TOWN_SQUARE, cameraGround, visitPoint, type V3,
} from "./worldAdapter.ts";

export const PHONE_ASPECT = 390 / 844, DESKTOP_ASPECT = 1440 / 900;
/** The phone's portrait lens for the Court's rooms (unchanged). */
export const PHONE_ROOM_FOV = 52;
/** In portrait the open world is never narrower than this, in degrees across (C12). */
export const MIN_PORTRAIT_HFOV = 40;

const DEG = Math.PI / 180;
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const safeAspect = (aspect: number, composition: Composition) => (Number.isFinite(aspect) && aspect > 0 ? clamp(aspect, 0.3, 4) : composition === "phone" ? PHONE_ASPECT : DESKTOP_ASPECT);

/** The vertical field that gives at least `minH` degrees across at this aspect, and at least `base`. */
export function portraitFov(aspect: number, base: number, minH = MIN_PORTRAIT_HFOV, max = 80): number {
  const a = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const need = (2 * Math.atan(Math.tan((minH * DEG) / 2) / a)) / DEG;
  return clamp(Math.max(base, need), 1, max);
}
/** The open world's lens (Look, Walk and the ride camera) for a stage. Rooms keep their own. */
export function openWorldFov(composition: Composition, aspect: number): number {
  return portraitFov(safeAspect(aspect, composition), composition === "phone" ? PHONE_ROOM_FOV : COURT_FOV);
}

/* ── Seeing ─────────────────────────────────────────────────────────────── */
/** A world point in normalised device space for an eye looking at a point, with world +y up. */
export function projectView(eye: Vec3, look: Vec3, point: Vec3, aspect: number, fov: number): { x: number; y: number; depth: number } {
  let fx = look[0] - eye[0], fy = look[1] - eye[1], fz = look[2] - eye[2];
  const fl = Math.hypot(fx, fy, fz) || 1; fx /= fl; fy /= fl; fz /= fl;
  let rx = -fz, rz = fx;
  const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
  const ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;
  const vx = point[0] - eye[0], vy = point[1] - eye[1], vz = point[2] - eye[2];
  const depth = vx * fx + vy * fy + vz * fz;
  if (depth <= 1e-6) return { x: Infinity, y: Infinity, depth };
  const tanV = Math.tan((fov * DEG) / 2), tanH = tanV * Math.max(aspect, 1e-3);
  return { x: (vx * rx + vz * rz) / (depth * tanH), y: (vx * ux + vy * uy + vz * uz) / (depth * tanV), depth };
}
/** Is the point inside the frame of a pose as it is drawn over the land? */
export function poseSees(pose: CourtPose, point: Vec3, aspect: number, fov: number, margin = 0.04): boolean {
  const drawn = realizePose(pose, cameraGround, 0.6);
  const p = projectView(drawn.eye, drawn.look, point, aspect, fov);
  return p.depth > 0.1 && Math.abs(p.x) <= 1 - margin && Math.abs(p.y) <= 1 - margin;
}
/** A pose that stands at `eye`, looks at `at`, and pivots `pivot` units down that line. */
export function aimPose(eye: Vec3, at: Vec3, pivot: number): CourtPose {
  const dx = at[0] - eye[0], dy = at[1] - eye[1], dz = at[2] - eye[2], l = Math.hypot(dx, dy, dz) || 1;
  const k = Math.min(pivot, l) / l;
  return poseFrom(eye, [eye[0] + dx * k, eye[1] + dy * k, eye[2] + dz * k]);
}
const up = (p: V3, h: number): Vec3 => [p[0], p[1] + h, p[2]];
const flat = (from: V3, to: V3): [number, number] => {
  const dx = to[0] - from[0], dz = to[2] - from[2], l = Math.hypot(dx, dz) || 1;
  return [dx / l, dz / l];
};

/* ── The signature view (C1) ────────────────────────────────────────────── */
/**
 * The town arrival shot: the first frame after sign-in, and Look in town.
 * The eye stands behind the town square on the line from the square to the
 * dam, a few units up; the pitch is solved so the dam crest sits in the upper
 * third (`DAM_ROW`) and the square is in the foreground below the middle — if
 * the square would fall off the bottom, the eye steps back until it fits.
 * Everything is read from the adapter: move the dam and the shot follows.
 */
export const TOWN_ARRIVAL = Object.freeze({
  desktop: { back: 21, height: 4.4, damRow: 0.6, squareFloor: -0.78 },
  phone: { back: 14, height: 3.4, damRow: 0.42, squareFloor: -0.72 },
});
export function townArrivalPose(composition: Composition, aspect = composition === "phone" ? PHONE_ASPECT : DESKTOP_ASPECT, fov = openWorldFov(composition, aspect)): CourtPose {
  const plan = TOWN_ARRIVAL[composition === "phone" ? "phone" : "desktop"];
  const square = TOWN_SQUARE, dam = DAM_CREST;
  const [ux, uz] = flat(square, dam);
  const tan = Math.tan((fov * DEG) / 2);
  let back = plan.back, eye: Vec3 = [0, 0, 0], pitch = 0;
  for (let i = 0; i < 60; i++) {
    const x = square[0] - ux * back, z = square[2] - uz * back;
    eye = [x, Math.max(square[1] + plan.height, cameraGround(x, z) + 2.2), z];
    const damUp = Math.atan2(dam[1] - eye[1], Math.hypot(dam[0] - eye[0], dam[2] - eye[2]));
    pitch = damUp - Math.atan(plan.damRow * tan);
    const squareUp = Math.atan2(square[1] - eye[1], Math.hypot(square[0] - eye[0], square[2] - eye[2]));
    if (Math.tan(squareUp - pitch) / tan >= plan.squareFloor) break;
    back += 1.5;
  }
  // The orbit pivot is above the square: a drag swings round the town.
  const reach = back / Math.cos(pitch);
  const look: Vec3 = [eye[0] + ux * back, eye[1] + Math.tan(pitch) * back, eye[2] + uz * back];
  return aimPose(eye, look, reach);
}

/* ── Fitting ───────────────────────────────────────────────────────────── */
/** The nearest pose on heading `theta` and tilt `phi` that holds every point inside the frame, centred on them. */
export function fitPose(points: readonly Vec3[], theta: number, phi: number, aspect: number, fov: number, margin = 0.08): CourtPose {
  const n = points.length || 1;
  let target: Vec3 = [points.reduce((a, p) => a + p[0], 0) / n, points.reduce((a, p) => a + p[1], 0) / n, points.reduce((a, p) => a + p[2], 0) / n];
  const fits = (pose: CourtPose) => points.every((p) => {
    const q = projectView(poseEye(pose), pose.target, p, aspect, fov);
    return q.depth > 1 && Math.abs(q.x) <= 1 - margin && Math.abs(q.y) <= 1 - margin;
  });
  let r = 40;
  for (let pass = 0; pass < 4; pass++) {
    let lo = 5, hi = 3000;
    for (let i = 0; i < 48; i++) { const mid = (lo + hi) / 2; if (fits({ target, r: mid, theta, phi })) hi = mid; else lo = mid; }
    r = hi;
    // Centre the points' extent in the frame.
    const pose: CourtPose = { target, r, theta, phi }, eye = poseEye(pose);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of points) { const q = projectView(eye, target, p, aspect, fov); minX = Math.min(minX, q.x); maxX = Math.max(maxX, q.x); minY = Math.min(minY, q.y); maxY = Math.max(maxY, q.y); }
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    if (Math.abs(cx) < 0.01 && Math.abs(cy) < 0.01) break;
    const tanV = Math.tan((fov * DEG) / 2), tanH = tanV * aspect;
    // Camera right and up at the target's depth.
    const fx = target[0] - eye[0], fy = target[1] - eye[1], fz = target[2] - eye[2], fl = Math.hypot(fx, fy, fz);
    const f = [fx / fl, fy / fl, fz / fl];
    let rx = -f[2]!, rz = f[0]!; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
    const ux = -rz * f[1]!, uy = rz * f[0]! - rx * f[2]!, uz = rx * f[1]!;
    const sx = cx * r * tanH, sy = cy * r * tanV;
    target = [target[0] + rx * sx + ux * sy, target[1] + uy * sy, target[2] + rz * sx + uz * sy];
  }
  return { target, r, theta, phi };
}

/* ── The overview (C5, C12) ─────────────────────────────────────────────── */
/** What the overview must hold: every district, the town square, the quay, the dam and the summit. */
export const OVERVIEW_POINTS: readonly Vec3[] = Object.freeze([
  ...CAMERA_DISTRICTS.map((d) => up(d.at, 4)), up(TOWN_SQUARE, 0), QUAY as Vec3, DAM_CREST as Vec3, up(SUMMIT_TELESCOPE, 4),
]);
export const OVERVIEW = Object.freeze({ desktop: { theta: 0.14, phi: 0.98 }, phone: { theta: 0.1, phi: 0.72 } });
export function overviewPose(composition: Composition, aspect = composition === "phone" ? PHONE_ASPECT : DESKTOP_ASPECT, fov = openWorldFov(composition, aspect)): CourtPose {
  const o = OVERVIEW[composition === "phone" ? "phone" : "desktop"];
  return fitPose(OVERVIEW_POINTS, o.theta, o.phi, safeAspect(aspect, composition), fov, composition === "phone" ? 0.07 : 0.06);
}

/* ── The dam and the summit (C12) ───────────────────────────────────────── */
/** Standing in front of the glass dam on the town side, the crest in the upper frame, the basin behind. */
export function damViewPose(composition: Composition, aspect = composition === "phone" ? PHONE_ASPECT : DESKTOP_ASPECT, fov = openWorldFov(composition, aspect)): CourtPose {
  const face = Math.atan2(DAM_FACE[0], DAM_FACE[1]);
  const target: Vec3 = [DAM_CREST[0], DAM_CREST[1] - 5, DAM_CREST[2]];
  // Hold the dam's whole width (its chord, about 30) with room either side.
  const tanH = Math.tan((fov * DEG) / 2) * safeAspect(aspect, composition);
  const r = Math.max(composition === "phone" ? 52 : 44, 22 / tanH);
  return { target, r, theta: face, phi: 1.33 };
}
/** From the summit telescope, looking down the mountain to the town and the sea. */
export function summitViewPose(composition: Composition): CourtPose {
  const [ax, az] = flat(TOWN_SQUARE, SUMMIT_TELESCOPE);
  const eye: Vec3 = [SUMMIT_TELESCOPE[0] + ax * 7, SUMMIT_TELESCOPE[1] + (composition === "phone" ? 3.6 : 3), SUMMIT_TELESCOPE[2] + az * 7];
  // Aim between the lower terraces and the square, so the whole descent is in the frame.
  const low = CAMERA_DISTRICTS[0]!.at;
  const aim: Vec3 = [TOWN_SQUARE[0] * 0.65 + low[0] * 0.35, TOWN_SQUARE[1] * 0.65 + low[1] * 0.35, TOWN_SQUARE[2] * 0.65 + low[2] * 0.35];
  return aimPose(eye, aim, 60);
}

/* ── Walking poses: arrivals and exits (C3, C7) ─────────────────────────── */
/** A walking camera pose behind a body standing at `at` and facing `yaw`. */
export function walkPoseBehind(at: V3, yaw: number, composition: Composition): CourtPose {
  return { target: [at[0], at[1] + FOLLOW_LOOK_HEIGHT, at[2]], r: FOLLOW_DISTANCE[composition], theta: Math.atan2(-Math.sin(yaw), -Math.cos(yaw)), phi: FOLLOW_PHI };
}
export type Arrival = { id: string; at: V3; yaw: number; faces: V3; pose: CourtPose };
/** What an arrival at a district or reserved plot faces: its building's door, the dam, the telescope, or the view. */
function arrivalFaces(id: string): V3 {
  const door = DISTRICT_DOOR[id];
  if (door && CAMERA_DOORS[door]) return CAMERA_DOORS[door]!.at;
  if (id === "reservoir") return DAM_CREST;
  if (id === "summit") return SUMMIT_TELESCOPE;
  return TOWN_SQUARE;
}
/**
 * `arrivalPose(id)`: where a "Visit" puts you, which way you face, and the
 * walking camera behind you — every building arrival faces its door. `id` is
 * a district, a reserved plot, or a place with an island door (standing on
 * its apron, facing in).
 */
export function arrivalPose(id: string, composition: Composition = "desktop"): Arrival | null {
  const point = visitPoint(id);
  if (point) {
    const faces = arrivalFaces(id), [fx, fz] = flat(point, faces);
    const yaw = Math.atan2(fx, fz);
    return { id, at: point, yaw, faces, pose: walkPoseBehind(point, yaw, composition) };
  }
  const door = CAMERA_DOORS[id];
  if (!door) return null;
  const at: V3 = [door.at[0] + door.out[0] * 4, door.at[1], door.at[2] + door.out[1] * 4];
  const yaw = Math.atan2(-door.out[0], -door.out[1]);
  return { id, at, yaw, faces: door.at, pose: walkPoseBehind(at, yaw, composition) };
}
/** The arrival a "Visit" at this exact point belongs to, if any (the guide passes points, not ids). */
export function arrivalAt(point: readonly number[], composition: Composition = "desktop"): Arrival | null {
  const x = point[0] ?? NaN, y = point[1] ?? NaN, z = point[2] ?? NaN;
  if (![x, y, z].every(Number.isFinite)) return null;
  for (const id of [...CAMERA_DISTRICTS.map((d) => d.id), ...CAMERA_PLOTS.map((p) => p.id)]) {
    const v = visitPoint(id);
    if (v && Math.hypot(v[0] - x, v[2] - z) < 1.5) return arrivalPose(id, composition);
  }
  // A "Visit" point the guide moved (geography re-authors them): still face the nearest district's door from where you stand.
  const near = CAMERA_DISTRICTS.find((d) => Math.hypot(d.at[0] - x, d.at[2] - z) <= d.radius + 15);
  if (!near) return null;
  const at: V3 = [x, y, z], faces = arrivalFaces(near.id), [fx, fz] = flat(at, faces), yaw = Math.atan2(fx, fz);
  return { id: near.id, at, yaw, faces, pose: walkPoseBehind(at, yaw, composition) };
}
/**
 * Coming out of a building: the body stands on its apron facing *away* from
 * the door, and the walking camera stands behind it — between the body and
 * the door — so the first key press walks out into the world, not back in.
 */
export function doorExitPose(place: string, landing: { x: number; y: number; z: number; yaw: number }, composition: Composition): CourtPose {
  const door = CAMERA_DOORS[place];
  const yaw = door ? Math.atan2(door.out[0], door.out[1]) : landing.yaw;
  return walkPoseBehind([landing.x, landing.y, landing.z], yaw, composition);
}

/* ── Small moments and overlooks (C7) ───────────────────────────────────── */
/**
 * `overlookPose(id)` / `momentPose(id)`: each small moment's own θ and φ.
 * An overlook or a bench is a view: the eye stands a few steps behind the
 * spot and looks where it looks (town, or the dam), with the pivot out over
 * the view. A gate, a bell or an animal is a thing: framed from its uphill
 * side, so the town opens up behind it.
 */
export function momentPose(id: string, composition: Composition = "desktop"): CourtPose | null {
  const moment = CAMERA_MOMENTS.find((m) => m.id === id || m.id === `mountain:life:${id}`);
  if (!moment) return null;
  if (moment.kind === "overlook" || moment.kind === "bench") {
    const [dx, dz] = flat(moment.at, moment.look);
    const back = moment.kind === "overlook" ? 5 : 4;
    const eye: Vec3 = [moment.at[0] - dx * back, moment.at[1] + (composition === "phone" ? 3.1 : 2.6), moment.at[2] - dz * back];
    return aimPose(eye, moment.look, 40);
  }
  const [ax, az] = flat(TOWN_SQUARE, moment.at);
  return { target: up(moment.at, 0.9), r: composition === "phone" ? 9.5 : 8, theta: Math.atan2(ax, az) + 0.35, phi: 1.2 };
}
export const overlookPose = momentPose;

/* ── Close (C10, point 9) ──────────────────────────────────────────────── */
export type CloseLandmark = { id: string; at: V3; pose: (composition: Composition) => CourtPose };
const doorHold = (place: string): CloseLandmark | null => {
  const door = CAMERA_DOORS[place];
  if (!door) return null;
  return { id: `door:${place}`, at: door.at, pose: (c) => ({ target: up(door.at, 1.7), r: c === "phone" ? 7.5 : 6.5, theta: Math.atan2(door.out[0], door.out[1]) + 0.3, phi: 1.3 }) };
};
/**
 * The open world's close holds: the nearest one to the body is what Close
 * frames. The fountain in the square, the quay, every island door (the
 * Fund bank's first), the glass dam's crest and the summit telescope.
 */
export const CLOSE_LANDMARKS: readonly CloseLandmark[] = Object.freeze([
  { id: "fountain", at: TOWN_SQUARE, pose: (c: Composition) => ({ target: up(TOWN_SQUARE, 0.35), r: c === "phone" ? 4.4 : 4.8, theta: 0.42, phi: 1.12 }) },
  { id: "quay", at: QUAY, pose: (c: Composition) => ({ target: up(QUAY, 0.8), r: c === "phone" ? 9 : 8, theta: Math.PI + 0.35, phi: 1.2 }) },
  ...(["bank", "kitchen", "library", "glasshouse", "cottage", "kiln", "boathouse"].map(doorHold).filter(Boolean) as CloseLandmark[]),
  { id: "dam-crest", at: DAM_CREST, pose: (c: Composition) => ({ target: up(DAM_CREST, -1.5), r: c === "phone" ? 18 : 15, theta: Math.atan2(DAM_FACE[0], DAM_FACE[1]) + 0.45, phi: 1.28 }) },
  { id: "summit-telescope", at: SUMMIT_TELESCOPE, pose: (c: Composition) => { const [ax, az] = flat(TOWN_SQUARE, SUMMIT_TELESCOPE); return { target: SUMMIT_TELESCOPE as Vec3, r: c === "phone" ? 5.2 : 4.6, theta: Math.atan2(ax, az) + 0.5, phi: 1.22 }; } },
]);
/** How far away a landmark may be and still be "the one here". */
export const CLOSE_REACH = 60;
/** The close hold for a body standing at `at` in the open world, or null when nothing is near enough. */
export function closeLandmark(at: readonly number[], composition: Composition): { id: string; pose: CourtPose } | null {
  let best: CloseLandmark | null = null, gap = Infinity;
  for (const l of CLOSE_LANDMARKS) {
    const d = Math.hypot(l.at[0] - (at[0] ?? 0), (l.at[1] - (at[1] ?? l.at[1])) * 0.5, l.at[2] - (at[2] ?? 0));
    if (d < gap) { gap = d; best = l; }
  }
  return best && gap <= CLOSE_REACH ? { id: best.id, pose: best.pose(composition) } : null;
}
