/**
 * Corridor plant materials: Mountain v2's card materials (`plantArt.ts` `windy` / `outlineMaterial`: flat-shaded card,
 * paper grain, vertex colours, the shared wind clock) plus the terms the corridor needs:
 *
 * - `aFar` (per instance): the instance's far radius (eu). It scales in from its root over the last `FADE_BAND` eu inside
 *   it, measured in xz from the `uEye` uniform (the viewer, set by `update`; NOT `cameraPosition`, which in the shadow
 *   pass is the light's), so thinning never pops (STYLE §1.1 "LOD never pops up; it fades"; ROAD §8).
 * - `aStretch` (palms only, per instance): the tall variant stretches the trunk; vertices flagged `aCrown` ride up with
 *   the trunk top instead of stretching, so a tall palm keeps its fronds.
 *
 * The colour pass and a matching depth material share every hook, so cast shadows follow the same stretch and fade.
 * Wind is v2's formula exactly (phase from the instance position, bend above 0.6 local, `CARD_CLOCK`).
 */
import * as THREE from 'three';
import { packedMatrixShader } from '../../runtime/packedInstances';
import { CARD_CLOCK, paperGrain } from '../../../art/cardScene.ts';

/** Instances scale in over this band inside their far radius. */
export const FADE_BAND = 25;
/** The CPU twin of the shader's fade (1 = full size, 0 = gone). */
export function fadeAt(distance: number, far: number): number {
  if (far <= 0) return 0;
  const t = Math.max(0, Math.min(1, (distance - (far - FADE_BAND)) / FADE_BAND));
  return 1 - t * t * (3 - 2 * t);
}

export type EyeUniform = { value: THREE.Vector3 };
/** Seconds (the runtime's clock) for `aBorn` scale-ins; shared by every corridor plant material of one planting. */
export type NowUniform = { value: number };
/** A residency join scales in over this long (s) (STYLE §1.1: streaming never pops up; it fades). */
export const BORN_SECONDS = 0.6;
/**
 * `twoTone`: a Mountain v2 tree in one draw — `aPart` 1 marks trunk vertices, painted with the per-instance `aTrunk`
 * colour and never swayed ("wind moves crowns; trunks never move", STYLE §2.3); the rest takes the instance colour.
 */
export type PlantHook = { /** Ordinary per-vertex matrix/wind attributes for compatible packed layers. */ packed?: boolean; wind: number; key: string; eye: EyeUniform; now?: NowUniform; stretchTop?: number; ink?: 'radial' | 'attr'; twoTone?: boolean; /** A constant cap on `aFar` (ink shells share the body's attributes but stop at 180 eu). */ farCap?: number;
  /** Back faces (a double-sided card seen from below): multiply by `mul`, then mix toward `tint` by `mix` (STYLE §1.1 underside 0.62; Taylor paper backing). */
  backFace?: { mul: number; tint?: readonly [number, number, number]; mix?: number } };
function inject(shader: { uniforms: Record<string, THREE.IUniform>; vertexShader: string; fragmentShader: string }, o: PlantHook) {
  if (o.backFace) { const b = o.backFace, t = b.tint ?? [0, 0, 0];
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
    if(!gl_FrontFacing){diffuseColor.rgb=mix(diffuseColor.rgb*${b.mul.toFixed(3)},vec3(${t.map(v => v.toFixed(3)).join(',')}),${(b.mix ?? 0).toFixed(3)});}`); }
  shader.uniforms.uWind = CARD_CLOCK; shader.uniforms.uEye = o.eye; shader.uniforms.uNow = o.now ?? { value: 0 };
  const head = ['uniform float uWind;', 'uniform vec3 uEye;', 'uniform float uNow;', 'attribute float aFar;', 'attribute float aBorn;', o.packed ? 'attribute vec2 aWind;' : '', o.stretchTop !== undefined ? 'attribute float aCrown;\nattribute float aStretch;' : '', o.ink === 'attr' ? 'attribute vec3 aInk;' : '', o.twoTone ? 'attribute float aPart;\nattribute vec3 aTrunk;' : ''].join('\n');
  const ink = o.ink === 'radial' ? 'transformed+=normalize(position-vec3(0.0,position.y,0.0)+vec3(0.0,0.35,0.0))*0.09;'
    : o.ink === 'attr' ? 'transformed+=aInk*0.07;' : '';
  const stretch = o.stretchTop !== undefined
    ? `float lift=(aStretch-1.0)*(aCrown>0.5?${o.stretchTop.toFixed(3)}:position.y);transformed.y+=lift;float yy=position.y+lift;` : 'float yy=position.y;';
  shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\n${head}`).replace('#include <begin_vertex>', `#include <begin_vertex>
    ${ink}
    ${stretch}
    ${o.packed ? '#if 1' : '#ifdef USE_INSTANCING'}
    float ph=${o.packed ? 'aInstanceMatrix' : 'instanceMatrix'}[3].x*.21+${o.packed ? 'aInstanceMatrix' : 'instanceMatrix'}[3].z*.17;
    vec3 iw=(modelMatrix*vec4(${o.packed ? 'aInstanceMatrix' : 'instanceMatrix'}[3].xyz,1.0)).xyz;
    float F=${o.farCap !== undefined ? `min(aFar,${o.farCap.toFixed(1)})` : 'aFar'};
    float fd=(1.0-smoothstep(F-${FADE_BAND.toFixed(1)},F,distance(iw.xz,uEye.xz)))*smoothstep(0.0,1.0,clamp((uNow-aBorn)/${BORN_SECONDS.toFixed(2)},0.0,1.0));
    #else
    float ph=0.0;float fd=1.0;
    #endif
    float bend=max(0.0,yy-0.6)${o.twoTone ? '*(1.0-aPart)' : ''};
    transformed.x+=(sin(uWind*1.25+ph)*.7+sin(uWind*2.7+ph*1.9)*.3)*${o.packed ? 'aWind.x' : o.wind.toFixed(4)}*bend;
    transformed.z+=cos(uWind*1.05+ph*1.3)*${o.packed ? 'aWind.y' : (o.wind * 0.6).toFixed(4)}*bend;
    transformed*=fd;`);
  if (o.twoTone) shader.vertexShader = shader.vertexShader.replace('#include <color_vertex>', `#include <color_vertex>
    ${o.packed ? '#ifdef USE_COLOR' : '#if defined( USE_INSTANCING_COLOR ) && defined( USE_COLOR )'}
    vColor.rgb=color*mix(${o.packed ? 'aInstanceColor' : 'instanceColor'}.rgb,aTrunk,aPart);
    #endif`);
  if (o.packed) packedMatrixShader(shader, !!o.twoTone);
}
function hooked<M extends THREE.Material>(m: M, o: PlantHook, prefix: string): M {
  m.onBeforeCompile = shader => inject(shader, o);
  m.customProgramCacheKey = () => `hearth-corridor-${prefix}-${o.packed ? 'packed-' : ''}${o.wind}-${o.stretchTop ?? ''}-${o.ink ?? ''}-${o.twoTone ? 2 : 1}-${o.farCap ?? ''}-${o.backFace ? JSON.stringify(o.backFace) : ''}`;
  return m;
}
/** v2's card material (`plantArt` `mat`): vertex colours, flat shading, paper grain, wind. */
export function cardMaterial(o: PlantHook, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return hooked(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true, map: paperGrain(), ...extra }), o, 'card');
}
/** v2's back-face ink shell (full tier only). */
export function shellMaterial(ink: string, o: PlantHook): THREE.MeshBasicMaterial {
  return hooked(new THREE.MeshBasicMaterial({ color: ink, side: THREE.BackSide }), { ...o, ink: o.ink ?? 'radial' }, 'shell');
}
/** Ink rims on cards (palm fronds): double-sided ribbons pushed out along `aInk` (full tier only). */
export function rimMaterial(ink: string, o: PlantHook): THREE.MeshBasicMaterial {
  return hooked(new THREE.MeshBasicMaterial({ color: ink, side: THREE.DoubleSide }), { ...o, ink: 'attr' }, 'rim');
}
/** The soft contact shadow (vertex alpha), faded with its plant. */
export function contactMaterial(eye: EyeUniform, now?: NowUniform): THREE.MeshBasicMaterial {
  return hooked(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -3 }), { wind: 0, key: 'contact', eye, now }, 'contact');
}
/** A depth material for the shadow pass with the same shape terms (no ink). */
export function depthMaterial(o: PlantHook): THREE.MeshDepthMaterial {
  return hooked(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), { ...o, ink: undefined }, 'depth');
}
