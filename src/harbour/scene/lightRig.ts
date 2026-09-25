import * as THREE from "three";
import type { PlaceLight } from "./place.ts";
import { effectiveDpr, type RenderTier } from "./quality.ts";

/**
 * One rig for every place on the island (BUILD_PLAN §2 #7, §6): a hemisphere,
 * one sun with a soft shadow, and a cool fill. No ACES — the renderer runs
 * `NoToneMapping` with sRGB output like `pathWorld3d.ts`, so the GLBs'
 * authored colours arrive as authored and are never recoloured.
 *
 * Hearth Mountain v2 (art): the sun is a low cross-light (about 31° up) from the
 * west, a little from the town side, so it rakes across the town→mountain axis
 * and every slope, wall and crown reads in relief; the fill comes from the
 * opposite side, cool, for the warm/cool split. The shadow frustum follows the
 * focus: sized to the walking view (about 36 units each way) when a body is
 * followed, widening to a coarse one for overviews, and the land itself casts.
 */
export type LightRig = {
  hemi: THREE.HemisphereLight;
  sun: THREE.DirectionalLight;
  fill: THREE.DirectionalLight;
  setLight(light: PlaceLight): void;
  focus(x:number,y:number,z:number,radius?:number):void;
  dispose(): void;
};

/** Unit vector toward the sun: low and from the west, a little from the town side. */
export const SUN_TOWARD: readonly [number, number, number] = (() => { const v = [-0.8, 0.52, 0.3], l = Math.hypot(v[0]!, v[1]!, v[2]!); return [v[0]! / l, v[1]! / l, v[2]! / l] as const; })();
export const SUN_SHADOW_SIZE = 2048;
export const SUN_SHADOW_BIAS = -0.0004;
/** The smallest shadow half-extent (rooms, close holds). */
export const SUN_SHADOW_EXTENT = 14;
/** The walking view's shadow half-extent: the ground a following camera actually sees in detail. */
export const WALK_SHADOW_EXTENT = 36;
/** The widest (overview) shadow half-extent: low resolution, but the ridges still cast. */
export const WIDE_SHADOW_EXTENT = 240;

/** The shadow half-extent for a focus radius: a walker's 14 becomes the walking view. */
export function shadowExtent(radius: number): number {
  if (radius <= 16) return radius < 13.9 ? SUN_SHADOW_EXTENT : WALK_SHADOW_EXTENT;
  return Math.max(WALK_SHADOW_EXTENT, Math.min(WIDE_SHADOW_EXTENT, radius));
}

export function createLightRig(scene: THREE.Scene, light: PlaceLight, tier: RenderTier): LightRig {
  const hemi = new THREE.HemisphereLight(new THREE.Color(light.hemiSky), new THREE.Color(light.hemiGround), light.intensity * 1.05);
  hemi.name = "Harbour hemisphere";
  const sun = new THREE.DirectionalLight(new THREE.Color(light.sun), light.intensity * 1.45);
  sun.name = "Harbour sun";
  const [sx, sy, sz] = SUN_TOWARD;
  sun.position.set(sx * 40, sy * 40, sz * 40);
  sun.target.position.set(0, 0, 0);
  // Both tiers cast: the shadow is what sets a model on its table. Lite keeps the smaller map.
  const size = tier === "full" ? SUN_SHADOW_SIZE : 1024;
  sun.castShadow = true;
  sun.shadow.mapSize.set(size, size);
  sun.shadow.bias = SUN_SHADOW_BIAS;
  sun.shadow.normalBias = 0.03;
  sun.shadow.camera.left = -SUN_SHADOW_EXTENT; sun.shadow.camera.right = SUN_SHADOW_EXTENT;
  sun.shadow.camera.top = SUN_SHADOW_EXTENT; sun.shadow.camera.bottom = -SUN_SHADOW_EXTENT;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 200;
  const fill = new THREE.DirectionalLight(0xb9d5ed, 0.5);
  fill.name = "Harbour fill";
  fill.position.set(-sx * 30, 14, -sz * 30);
  scene.add(hemi, sun, sun.target, fill);
  let extentNow = SUN_SHADOW_EXTENT;
  return {
    hemi, sun, fill,
    focus(x,y,z,radius=SUN_SHADOW_EXTENT){
      const extent=shadowExtent(radius);
      // Snap the frustum to its texel grid so shadows do not crawl as the focus moves.
      const texel=extent*2/size,cx=Math.round(x/texel)*texel,cz=Math.round(z/texel)*texel;
      // Stand far enough up-sun that the whole mountain between the sun and the focus is inside.
      const reach=extent+140;
      sun.target.position.set(cx,y,cz);sun.position.set(cx+sx*reach,y+sy*reach,cz+sz*reach);
      const camera=sun.shadow.camera;
      if(extent!==extentNow){extentNow=extent;camera.left=-extent;camera.right=extent;camera.top=extent;camera.bottom=-extent;camera.near=1;camera.far=reach+extent*1.6+60;
        sun.shadow.normalBias=.03+extent*.0012;camera.updateProjectionMatrix();}
    },
    setLight(next) {
      hemi.color.set(next.hemiSky); hemi.groundColor.set(next.hemiGround); hemi.intensity = next.intensity * 1.05;
      sun.color.set(next.sun); sun.intensity = next.intensity * 1.45;
    },
    dispose() {
      scene.remove(hemi, sun, sun.target, fill);
      sun.shadow.map?.dispose();
      hemi.dispose(); sun.dispose(); fill.dispose();
    },
  };
}

/** Applied through the lease's `configure` every time the harbour returns to the foreground. */
export function configureHarbourRenderer(renderer: THREE.WebGLRenderer, tier: RenderTier, dpr: number): void {
  renderer.domElement.className = "";
  renderer.domElement.style.cssText = "";
  renderer.domElement.setAttribute("aria-hidden", "true");
  renderer.domElement.style.touchAction = "none";
  renderer.setPixelRatio(effectiveDpr(tier, dpr));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = false;
  renderer.setScissorTest(false);
  renderer.setClearAlpha(1);
}
