/**
 * Board materials (T3). Two small shaders, each with a normal pass and an OCCLUDED pass (PLAN §A: `depthFunc:
 * GreaterDepth`, 35 % opacity, no depth write) so the land can never hide the route, the spaces, the piece or the
 * signposts — where a hill is in front, they show through as a soft ghost.
 *
 * - The mark material places a design-unit shape at a per-instance anchor and scales it by `uUnit` (world units per
 *   CSS pixel, clamped): screen-constant marks with no geometry rebuild on zoom. Lighting mirrors the scene's
 *   hemisphere + one directional light (no shadows).
 * - The ribbon material widens a centreline strip by `uWidth` (screen-constant, `clamp(14 px × wpp, 3, 40)` eu),
 *   shades it as a raised path (lit top, light lip, dark border, a darker side wall on the camera's side), draws a
 *   boardwalk where it crosses water, cuts a gap where it passes UNDER a later month, and draws upcoming months as
 *   "stakes and string": the two edge strings only, no fill.
 */
import * as THREE from "three";
import { hexToRgb } from "./shapes.ts";

export const OCCLUDED_OPACITY = 0.35;

export type LightRig = { sky: string; ground: string; sun: string; sunDir: [number, number, number] };
export const BOARD_LIGHT: LightRig = { sky: "#fbf6ee", ground: "#8f8a7c", sun: "#ffffff", sunDir: [-0.45, 0.8, 0.35] };

const colorUniform = (hex: string) => ({ value: new THREE.Color().setRGB(...hexToRgb(hex)) });

const LIGHT_GLSL = /* glsl */ `
uniform vec3 uSky; uniform vec3 uGround; uniform vec3 uSun; uniform vec3 uSunDir;
vec3 light(vec3 n) {
  float h = n.y * 0.5 + 0.5;
  vec3 amb = mix(uGround, uSky, h) * 0.62;
  float dif = max(dot(n, normalize(uSunDir)), 0.0) * 0.5;
  return amb + uSun * dif;
}`;

const MARK_VERTEX = /* glsl */ `
attribute vec3 aColor; attribute float aTint; attribute float aShade;
attribute vec3 iAnchor; attribute vec2 iDir; attribute vec3 iColor; attribute float iScale; attribute float iLift; attribute float iIndex;
uniform float uUnit; uniform float uSel; uniform float uSelLift; uniform float uAnimIndex; uniform float uAnimLift; uniform float uAnimScale;
varying vec3 vColor; varying vec3 vNormal;
void main() {
  vec2 d = length(iDir) > 0.0 ? normalize(iDir) : vec2(1.0, 0.0);
  float s = iScale * (abs(iIndex - uAnimIndex) < 0.5 ? uAnimScale : 1.0);
  vec3 p = position * s;
  vec3 r = vec3(p.x * d.x - p.z * d.y, p.y, p.x * d.y + p.z * d.x);
  vec3 nn = vec3(normal.x * d.x - normal.z * d.y, normal.y, normal.x * d.y + normal.z * d.x);
  float lift = iLift + (abs(iIndex - uSel) < 0.5 ? uSelLift : 0.0) + (abs(iIndex - uAnimIndex) < 0.5 ? uAnimLift : 0.0);
  vec3 world = iAnchor + (r + vec3(0.0, lift, 0.0)) * uUnit;
  vColor = mix(aColor, iColor, aTint) * aShade;
  vNormal = normalize(mat3(modelMatrix) * nn);
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(world, 1.0);
}`;

const MARK_FRAGMENT = /* glsl */ `
uniform float uAlpha;
varying vec3 vColor; varying vec3 vNormal;
${LIGHT_GLSL}
void main() {
  vec3 n = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  gl_FragColor = vec4(vColor * light(n), uAlpha);
}`;

function lightUniforms(rig: LightRig) {
  return { uSky: colorUniform(rig.sky), uGround: colorUniform(rig.ground), uSun: colorUniform(rig.sun), uSunDir: { value: new THREE.Vector3(...rig.sunDir) } };
}

/** Shared uniforms of one mark layer: the normal and occluded passes read the same objects. */
export type MarkUniforms = {
  uUnit: { value: number }; uSel: { value: number }; uSelLift: { value: number };
  uAnimIndex: { value: number }; uAnimLift: { value: number }; uAnimScale: { value: number };
};
export function markUniforms(): MarkUniforms {
  return { uUnit: { value: 1 }, uSel: { value: -1 }, uSelLift: { value: 0 }, uAnimIndex: { value: -1 }, uAnimLift: { value: 0 }, uAnimScale: { value: 1 } };
}

/**
 * The ghost pass is drawn in the OPAQUE list (custom alpha blending, no depth write) right after the land and BEFORE
 * the board, so its GreaterDepth test sees the land's depth only: a mark is ghosted where land is in front of it,
 * never where another part of the board (or the mark itself) is.
 */
function occlude(material: THREE.ShaderMaterial): THREE.ShaderMaterial {
  material.depthFunc = THREE.GreaterDepth;
  material.depthWrite = false;
  material.transparent = false;
  material.blending = THREE.CustomBlending;
  material.blendEquation = THREE.AddEquation;
  material.blendSrc = THREE.SrcAlphaFactor;
  material.blendDst = THREE.OneMinusSrcAlphaFactor;
  return material;
}

export function createMarkMaterials(shared: MarkUniforms, rig: LightRig = BOARD_LIGHT): { main: THREE.ShaderMaterial; occluded: THREE.ShaderMaterial } {
  const make = (alpha: number) => new THREE.ShaderMaterial({
    uniforms: { ...shared, ...lightUniforms(rig), uAlpha: { value: alpha } },
    vertexShader: MARK_VERTEX,
    fragmentShader: MARK_FRAGMENT,
    side: THREE.DoubleSide,
  });
  const main = make(1);
  main.name = "journey-board-mark";
  const occluded = occlude(make(OCCLUDED_OPACITY));
  occluded.name = "journey-board-mark-occluded";
  return { main, occluded };
}

const RIBBON_VERTEX = /* glsl */ `
attribute vec3 aSide; attribute float aEdge; attribute float aState; attribute float aGap; attribute float aOver;
attribute float aWater; attribute float aArc;
uniform float uWidth; uniform float uUnit;
varying float vEdge; varying float vState; varying float vGap; varying float vSouth; varying float vWater; varying float vArc;
void main() {
  vec3 p = position + aSide * (aEdge * uWidth * 0.5) + vec3(0.0, aOver * uUnit * 1.5, 0.0);
  vEdge = aEdge; vState = aState; vGap = aGap; vWater = aWater; vArc = aArc;
  // > 0 on the edge nearer the camera (south): that edge shows its side wall.
  vSouth = aEdge * aSide.z;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(p, 1.0);
}`;

/*
 * The ribbon reads as a raised board path without extra geometry: a lit top face with a faint crown, a light lip just
 * inside the far (north) edge, the dark printed border, and on the near (south) edge a darker band — the path's side
 * wall seen from the board's 58° view. Where the route crosses water it is a BOARDWALK: planks across the path
 * (weathered for past months, honey for the open one) between dark rails. Upcoming months stay stakes and string.
 */
const RIBBON_FRAGMENT = /* glsl */ `
uniform vec3 uPast; uniform vec3 uOpen; uniform vec3 uEdge; uniform vec3 uPlank; uniform float uWidth; uniform float uAlpha;
varying float vEdge; varying float vState; varying float vGap; varying float vSouth; varying float vWater; varying float vArc;
${LIGHT_GLSL}
void main() {
  if (vGap < uWidth * 0.75) discard;
  float e = abs(vEdge);
  bool water = vWater > 0.5;
  // Upcoming: stakes and string — the two edge strings only, no fill (the future never looks like history).
  if (vState > 1.5) {
    if (e < 0.74) discard;
    gl_FragColor = vec4(uEdge * light(vec3(0.0, 1.0, 0.0)), uAlpha);
    return;
  }
  vec3 base = vState < 0.5 ? uPast : uOpen;
  if (water) {
    // Planks laid across the path, a hairline gap between each (proportional to the path's width).
    base = mix(uPlank, base, vState < 0.5 ? 0.25 : 0.55);
    float plank = fract(vArc / max(uWidth * 0.34, 0.01));
    base *= plank > 0.86 ? 0.72 : 1.0 - 0.05 * step(0.5, fract(vArc / max(uWidth * 1.02, 0.01)));
  }
  bool near = vSouth > 0.0;
  // The near border is wider: it is the path's printed edge plus its side wall.
  float border = near ? smoothstep(0.72, 0.78, e) : smoothstep(0.83, 0.88, e);
  float lip = smoothstep(0.58, 0.66, e) * (1.0 - border);
  vec3 col = base * (1.0 + 0.04 * (1.0 - smoothstep(0.0, 0.45, e)));
  col *= near ? 1.0 - 0.08 * lip : 1.0 + 0.2 * lip;
  vec3 edge = near ? mix(uEdge, uEdge * 0.62, smoothstep(0.8, 0.95, e)) : uEdge;
  if (water) edge = uEdge * 0.85;
  col = mix(col, edge, border * 0.95);
  gl_FragColor = vec4(col * light(vec3(0.0, 1.0, 0.0)), uAlpha);
}`;

export type RibbonUniforms = { uWidth: { value: number }; uUnit: { value: number }; uPast: { value: THREE.Color }; uOpen: { value: THREE.Color }; uEdge: { value: THREE.Color }; uPlank: { value: THREE.Color } };
export function ribbonUniforms(): RibbonUniforms {
  return { uWidth: { value: 10 }, uUnit: { value: 1 }, uPast: colorUniform("#cbb595"), uOpen: colorUniform("#f2c46b"), uEdge: colorUniform("#6b4a33"), uPlank: colorUniform("#b08a62") };
}
export function setRibbonColors(u: RibbonUniforms, colors: { past: string; open: string; edge: string; plank?: string }) {
  u.uPast.value.setRGB(...hexToRgb(colors.past));
  u.uOpen.value.setRGB(...hexToRgb(colors.open));
  u.uEdge.value.setRGB(...hexToRgb(colors.edge));
  if (colors.plank) u.uPlank.value.setRGB(...hexToRgb(colors.plank));
}

export function createRibbonMaterials(shared: RibbonUniforms, rig: LightRig = BOARD_LIGHT): { main: THREE.ShaderMaterial; occluded: THREE.ShaderMaterial } {
  const make = (alpha: number) => new THREE.ShaderMaterial({
    uniforms: { ...shared, ...lightUniforms(rig), uAlpha: { value: alpha } },
    vertexShader: RIBBON_VERTEX,
    fragmentShader: RIBBON_FRAGMENT,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
  });
  const main = make(1);
  main.name = "journey-board-ribbon";
  const occluded = occlude(make(OCCLUDED_OPACITY));
  occluded.name = "journey-board-ribbon-occluded";
  return { main, occluded };
}

/** Set a theme's light rig on a material family. */
export function setLightRig(material: THREE.ShaderMaterial, rig: LightRig) {
  const u = material.uniforms;
  (u.uSky!.value as THREE.Color).setRGB(...hexToRgb(rig.sky));
  (u.uGround!.value as THREE.Color).setRGB(...hexToRgb(rig.ground));
  (u.uSun!.value as THREE.Color).setRGB(...hexToRgb(rig.sun));
}
