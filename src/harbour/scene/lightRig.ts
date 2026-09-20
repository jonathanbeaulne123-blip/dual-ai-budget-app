import * as THREE from "three";
import type { PlaceLight } from "./place.ts";
import { effectiveDpr, type RenderTier } from "./quality.ts";

/**
 * One rig for every place on the island (BUILD_PLAN §2 #7, §6): a hemisphere,
 * one sun with a soft shadow on the full tier, and a cool fill. No ACES — the
 * renderer runs `NoToneMapping` with sRGB output like `pathWorld3d.ts`, so the
 * GLBs' authored colours arrive as authored and are never recoloured.
 */
export type LightRig = {
  hemi: THREE.HemisphereLight;
  sun: THREE.DirectionalLight;
  fill: THREE.DirectionalLight;
  setLight(light: PlaceLight): void;
  dispose(): void;
};

export const SUN_SHADOW_SIZE = 1024;
export const SUN_SHADOW_BIAS = -0.0006;
export const SUN_SHADOW_EXTENT = 14;

export function createLightRig(scene: THREE.Scene, light: PlaceLight, tier: RenderTier): LightRig {
  const hemi = new THREE.HemisphereLight(new THREE.Color(light.hemiSky), new THREE.Color(light.hemiGround), light.intensity);
  hemi.name = "Harbour hemisphere";
  const sun = new THREE.DirectionalLight(new THREE.Color(light.sun), light.intensity * 1.3);
  sun.name = "Harbour sun";
  sun.position.set(-11, 17, 13);
  sun.target.position.set(0, 0, 0);
  if (tier === "full") {
    sun.castShadow = true;
    sun.shadow.mapSize.set(SUN_SHADOW_SIZE, SUN_SHADOW_SIZE);
    sun.shadow.bias = SUN_SHADOW_BIAS;
    sun.shadow.camera.left = -SUN_SHADOW_EXTENT; sun.shadow.camera.right = SUN_SHADOW_EXTENT;
    sun.shadow.camera.top = SUN_SHADOW_EXTENT; sun.shadow.camera.bottom = -SUN_SHADOW_EXTENT;
    sun.shadow.camera.near = 4; sun.shadow.camera.far = 60;
  }
  const fill = new THREE.DirectionalLight(0xb9d5ed, 0.55);
  fill.name = "Harbour fill";
  fill.position.set(14, 6, -9);
  scene.add(hemi, sun, sun.target, fill);
  return {
    hemi, sun, fill,
    setLight(next) {
      hemi.color.set(next.hemiSky); hemi.groundColor.set(next.hemiGround); hemi.intensity = next.intensity;
      sun.color.set(next.sun); sun.intensity = next.intensity * 1.3;
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
  renderer.shadowMap.enabled = tier === "full";
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = false;
  renderer.setScissorTest(false);
  renderer.setClearAlpha(1);
}
