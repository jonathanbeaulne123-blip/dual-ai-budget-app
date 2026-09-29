/**
 * The board camera (T3). Near-orthographic: a 20° lens at distance r·tan25°/tan10° (≈ 2.64 r), so each tier keeps the
 * FRAMED GROUND EXTENT of the manifest's 50° orbit radii (`JOURNEY_CAMERA`). Pitch 58°, north up (heading 0), no free
 * rotation. Zoom is continuous on the radius (60 … 2900, widened only when the whole island needs more room to fit
 * the viewport at Sky); tiers switch at the geometric midpoints (≈ 820 / ≈ 141, `tierForRadius`). Below Stop nothing
 * happens: zoom never enters the world (P2).
 *
 * Concept (x, y) = engine (x, z); north is −z, so the camera stands SOUTH of its target and looks north and down.
 */
import * as THREE from "three";
import type { CameraTier } from "../contracts.ts";
import { JOURNEY_CAMERA, tierForRadius } from "../contracts.ts";

const DEG = Math.PI / 180;
export const LENS_DISTANCE_FACTOR = Math.tan((JOURNEY_CAMERA.referenceFovDeg / 2) * DEG) / Math.tan((JOURNEY_CAMERA.fovDeg / 2) * DEG);
/** Longest camera move / settle (PLAN §B T3 motion). */
export const CAMERA_MOVE_MS = 600;
/** Margin around the island when Sky fits it (PLAN §A table: 6 %). */
export const SKY_MARGIN = 1.06;

export type CameraView = { x: number; y: number; radius: number };
export type Extent = { w: number; h: number };
/**
 * Stage px covered by chrome on each side (the summary card, a side panel, a bottom sheet). Framing centres its target
 * in the UNCOVERED rect and the Sky fit uses the uncovered width / height; the rendered stage stays full-bleed.
 */
export type SafeArea = { top: number; right: number; bottom: number; left: number };
export const NO_SAFE_AREA: SafeArea = Object.freeze({ top: 0, right: 0, bottom: 0, left: 0 });
/** No side may take more than this share of its axis (the board must stay a board). */
export const SAFE_AREA_MAX_SHARE = 0.45;

/** The safe area clamped to this stage: finite, ≥ 0, each side ≤ 45 % of its axis. */
export function clampSafeArea(safe: Partial<SafeArea> | null | undefined, width: number, height: number): SafeArea {
  const side = (v: number | undefined, axis: number) => Math.min(Math.max(Number.isFinite(v) ? (v as number) : 0, 0), axis * SAFE_AREA_MAX_SHARE);
  return { top: side(safe?.top, height), right: side(safe?.right, width), bottom: side(safe?.bottom, height), left: side(safe?.left, width) };
}

/** The uncovered rect: its size and its centre, in stage px. */
export function uncoveredRect(width: number, height: number, safe: SafeArea = NO_SAFE_AREA): { w: number; h: number; cx: number; cy: number } {
  const s = clampSafeArea(safe, width, height);
  const w = Math.max(1, width - s.left - s.right), h = Math.max(1, height - s.top - s.bottom);
  return { w, h, cx: s.left + w / 2, cy: s.top + h / 2 };
}

export const distanceForRadius = (radius: number) => radius * LENS_DISTANCE_FACTOR;

/** Ground extent (eu) framed vertically at the target plane for a radius. */
export const frameHeight = (radius: number) => 2 * radius * Math.tan((JOURNEY_CAMERA.referenceFovDeg / 2) * DEG);

/** World units per CSS pixel at the target (the unit for screen-constant widths and marks). */
export function worldPerPixel(radius: number, viewportHeightPx: number): number {
  return frameHeight(radius) / Math.max(1, viewportHeightPx);
}

/**
 * The radius that frames the whole island (+6 %) in this viewport — inside the uncovered rect when a safe area is
 * given (the frame spans the full stage height, so the fit is scaled by stage height / uncovered height). Ground depth
 * is foreshortened by sin(pitch).
 */
export function skyFitRadius(extent: Extent, width: number, height: number, safe: SafeArea = NO_SAFE_AREA): number {
  const open = uncoveredRect(width, height, safe);
  const aspect = Math.max(0.1, open.w / Math.max(1, open.h));
  const pitch = JOURNEY_CAMERA.pitchDeg * DEG;
  const needed = Math.max(extent.h * Math.sin(pitch), extent.w / aspect) * SKY_MARGIN * (Math.max(1, height) / open.h);
  return needed / (2 * Math.tan((JOURNEY_CAMERA.referenceFovDeg / 2) * DEG));
}

export function radiusLimits(extent: Extent, width: number, height: number, safe: SafeArea = NO_SAFE_AREA): { min: number; max: number } {
  return { min: JOURNEY_CAMERA.minRadius, max: Math.max(JOURNEY_CAMERA.maxRadius, skyFitRadius(extent, width, height, safe)) };
}

/** Sky never frames tighter than this (it must still read as Sky: above the ≈ 820 switch). */
const SKY_MIN_RADIUS = 900;

/** The radius a tier frames at. Sky fits the whole island (+6 %) to the uncovered viewport; Region / Stop are the manifest's. */
export function radiusForTier(tier: CameraTier, extent: Extent, width: number, height: number, safe: SafeArea = NO_SAFE_AREA): number {
  if (tier === "sky") return Math.max(skyFitRadius(extent, width, height, safe), SKY_MIN_RADIUS);
  return JOURNEY_CAMERA.radius[tier];
}

/** Tier of a radius. A wide Sky fit still reads as Sky. */
export function tierOf(radius: number): CameraTier {
  return tierForRadius(radius);
}

export function clampView(view: CameraView, extent: Extent, width: number, height: number, safe: SafeArea = NO_SAFE_AREA): CameraView {
  const { min, max } = radiusLimits(extent, width, height, safe);
  const radius = Math.min(Math.max(view.radius, min), max);
  // The target may wander a little past the coast, never off into open sea.
  const slack = 0.08;
  const x = Math.min(Math.max(view.x, -extent.w * slack), extent.w * (1 + slack));
  const y = Math.min(Math.max(view.y, -extent.h * slack), extent.h * (1 + slack));
  return { x, y, radius };
}

/**
 * Place a perspective camera for a view. `groundY` is the (compressed) ground height at the target. With a safe area
 * the projection is shifted (a view offset) so the target lands at the centre of the uncovered rect, not the stage's.
 */
export function applyView(camera: THREE.PerspectiveCamera, view: CameraView, groundY: number, width: number, height: number, safe: SafeArea = NO_SAFE_AREA): void {
  const pitch = JOURNEY_CAMERA.pitchDeg * DEG, d = distanceForRadius(view.radius);
  camera.fov = JOURNEY_CAMERA.fovDeg;
  camera.aspect = Math.max(0.1, width / Math.max(1, height));
  camera.near = Math.max(1, d * 0.25);
  camera.far = d * 2 + 6000;
  camera.position.set(view.x, groundY + d * Math.sin(pitch), view.y + d * Math.cos(pitch));
  camera.up.set(0, 1, 0);
  camera.lookAt(view.x, groundY, view.y);
  const open = uncoveredRect(width, height, safe);
  const ox = width / 2 - open.cx, oy = height / 2 - open.cy;
  if (Math.abs(ox) < 0.01 && Math.abs(oy) < 0.01) camera.clearViewOffset();
  else camera.setViewOffset(Math.max(1, width), Math.max(1, height), ox, oy, Math.max(1, width), Math.max(1, height));
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
}

export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
/** A small overshoot for the piece's settle. */
export const easeOutBack = (t: number) => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

/** Interpolate views: position linearly, radius geometrically (zoom feels even). */
export function lerpView(a: CameraView, b: CameraView, t: number): CameraView {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, radius: Math.exp(Math.log(a.radius) + (Math.log(b.radius) - Math.log(a.radius)) * t) };
}

/**
 * Screen point → ray (origin, direction) in board space for a camera. Pure three math; used by picking and
 * "Enter Horizon here".
 */
export function screenRay(camera: THREE.PerspectiveCamera, sx: number, sy: number, width: number, height: number): THREE.Ray {
  const ndc = new THREE.Vector2((sx / Math.max(1, width)) * 2 - 1, -(sy / Math.max(1, height)) * 2 + 1);
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(ndc, camera);
  return raycaster.ray.clone();
}

/**
 * Where a ray meets a height field (board space). Marches between the planes y = top and y = bottom, then bisects.
 * Returns engine (x, z) or null when the ray never reaches the ground inside the range.
 */
export function rayGround(ray: THREE.Ray, heightAt: (x: number, z: number) => number, top = 60, bottom = -8): { x: number; z: number } | null {
  const o = ray.origin, d = ray.direction;
  if (d.y >= -1e-6) return null;
  const t0 = (top - o.y) / d.y, t1 = (bottom - o.y) / d.y;
  const f = (t: number) => o.y + d.y * t - heightAt(o.x + d.x * t, o.z + d.z * t);
  const steps = 96;
  let prevT = Math.max(0, t0), prev = f(prevT);
  for (let i = 1; i <= steps; i += 1) {
    const t = Math.max(0, t0) + ((t1 - Math.max(0, t0)) * i) / steps, v = f(t);
    if (prev >= 0 && v < 0) {
      let lo = prevT, hi = t;
      for (let k = 0; k < 24; k += 1) { const mid = (lo + hi) / 2; if (f(mid) >= 0) lo = mid; else hi = mid; }
      const tt = (lo + hi) / 2;
      return { x: o.x + d.x * tt, z: o.z + d.z * tt };
    }
    prevT = t; prev = v;
  }
  return null;
}
