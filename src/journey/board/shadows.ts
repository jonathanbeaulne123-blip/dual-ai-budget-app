/**
 * Soft contact shadows (T7): a dark, translucent disc under the piece, each standing post / pavilion and each month
 * pad, pushed a little down-sun (south-east of a low north-west light). No shadow maps, no lights: one instanced disc,
 * one draw call, drawn after the opaque board so it darkens whatever it falls on (land, ribbon) and never hides a
 * mark. Sizes are design units like every mark (screen-constant); month pads use the pads' own clamped unit.
 */
import * as THREE from "three";
import type { Point2, Point3 } from "../contracts.ts";
import { hexToRgb } from "./shapes.ts";

export type ShadowItem = { anchor: Point3; offset: Point2; radius: number; pad?: boolean; lift?: number };

/** The down-sun push (design units): south-east. */
export const SHADOW_PUSH: Point2 = [3.2, 2.6];
const SIDES = 14;
export const SHADOW_ALPHA = 0.34;

const VERTEX = /* glsl */ `
attribute float aRim;
attribute vec3 iAnchor; attribute vec2 iOffset; attribute float iRadius; attribute float iPad; attribute float iLift;
uniform float uUnit; uniform float uPadUnit;
varying float vRim;
void main() {
  float u = iPad > 0.5 ? uPadUnit : uUnit;
  vec3 world = iAnchor + vec3((position.x * iRadius + iOffset.x) * u, iLift * u, (position.z * iRadius + iOffset.y) * u);
  vRim = aRim;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(world, 1.0);
}`;
const FRAGMENT = /* glsl */ `
uniform vec3 uColor; uniform float uAlpha;
varying float vRim;
void main() { gl_FragColor = vec4(uColor, uAlpha * (1.0 - smoothstep(0.45, 1.0, vRim))); }`;

function discGeometry(items: readonly ShadowItem[]): THREE.InstancedBufferGeometry {
  const g = new THREE.InstancedBufferGeometry();
  const pos: number[] = [], rim: number[] = [];
  for (let i = 0; i < SIDES; i += 1) {
    const a0 = (i / SIDES) * Math.PI * 2, a1 = ((i + 1) / SIDES) * Math.PI * 2;
    pos.push(0, 0, 0, Math.cos(a1), 0, Math.sin(a1), Math.cos(a0), 0, Math.sin(a0));
    rim.push(0, 1, 1);
  }
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aRim", new THREE.Float32BufferAttribute(rim, 1));
  const anchor = new Float32Array(items.length * 3), offset = new Float32Array(items.length * 2);
  const radius = new Float32Array(items.length), pad = new Float32Array(items.length), lift = new Float32Array(items.length);
  items.forEach((it, i) => {
    anchor.set(it.anchor, i * 3);
    offset.set([it.offset[0] + SHADOW_PUSH[0], it.offset[1] + SHADOW_PUSH[1]], i * 2);
    radius[i] = it.radius; pad[i] = it.pad ? 1 : 0; lift[i] = it.lift ?? 0.35;
  });
  g.setAttribute("iAnchor", new THREE.InstancedBufferAttribute(anchor, 3));
  g.setAttribute("iOffset", new THREE.InstancedBufferAttribute(offset, 2));
  g.setAttribute("iRadius", new THREE.InstancedBufferAttribute(radius, 1));
  g.setAttribute("iPad", new THREE.InstancedBufferAttribute(pad, 1));
  g.setAttribute("iLift", new THREE.InstancedBufferAttribute(lift, 1));
  g.instanceCount = items.length;
  return g;
}

export type ShadowLayer = {
  group: THREE.Group;
  uniforms: { uUnit: { value: number }; uPadUnit: { value: number }; uColor: { value: THREE.Color }; uAlpha: { value: number } };
  set(items: readonly ShadowItem[], color: string): void;
  dispose(): void;
};

export function createShadowLayer(): ShadowLayer {
  const uniforms = { uUnit: { value: 1 }, uPadUnit: { value: 1 }, uColor: { value: new THREE.Color() }, uAlpha: { value: SHADOW_ALPHA } };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: VERTEX, fragmentShader: FRAGMENT, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  material.name = "journey-board-shadow";
  const group = new THREE.Group();
  group.name = "journey-board:shadows";
  let mesh: THREE.Mesh | null = null, geometry: THREE.InstancedBufferGeometry | null = null;
  return {
    group, uniforms,
    set(items, color) {
      uniforms.uColor.value.setRGB(...hexToRgb(color));
      if (mesh) group.remove(mesh);
      geometry?.dispose();
      geometry = null; mesh = null;
      if (!items.length) return;
      geometry = discGeometry(items);
      mesh = new THREE.Mesh(geometry, material);
      mesh.name = "journey-board:shadows:main";
      mesh.frustumCulled = false;
      mesh.renderOrder = 0;
      group.add(mesh);
    },
    dispose() { geometry?.dispose(); material.dispose(); group.removeFromParent(); group.clear(); },
  };
}
