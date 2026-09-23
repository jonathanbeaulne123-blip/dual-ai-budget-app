import * as THREE from 'three';

/**
 * Tideline Skate Club v2 · turning an authored head.
 *
 * The playable avatars' faces are baked into one coat-and-head mesh parked on
 * the figure's carriage (`body/playableSurface.ts`), so `body-head`'s rotation
 * — the whole "look down the line" of a skate stance — never reaches the
 * screen. While the look holds a figure it gives each such mesh its own copy
 * of the material with a tiny vertex twist: everything above the neck turns
 * about the neck by the figure's head yaw/pitch, blended over the collar so the
 * coat does not tear. Released, the original materials come back untouched,
 * so the walker and the partner never see it. Cost: one extra program, a few
 * ALU per vertex, no allocation per frame.
 */
export type HeadTwist = {
  /** Find (or re-find, when the surface arrives late) the authored meshes under the carriage. */
  sync(): void;
  /** Turn the head: yaw about carriage +y, pitch about carriage +x (the figure's `body-head` angles). */
  set(yaw: number, pitch: number): void;
  release(): void;
};

type Patched = { mesh: THREE.Mesh; original: THREE.Material | THREE.Material[]; copy: THREE.Material; twist: { value: THREE.Matrix4 }; rowY: { value: THREE.Vector4 }; local: THREE.Matrix4; localInv: THREE.Matrix4 };

const _m = new THREE.Matrix4(), _r = new THREE.Matrix4(), _t = new THREE.Matrix4(), _e = new THREE.Euler();

/** `neckY`: the pivot in carriage units; the twist ramps in over [neckY − band, neckY + band]. */
export function createHeadTwist(carriage: THREE.Object3D, neckY: number, band = .018): HeadTwist {
  const patched: Patched[] = [];
  let seen = -1;

  function patch(mesh: THREE.Mesh): void {
    if (Array.isArray(mesh.material) || !mesh.material) return;
    const original = mesh.material;
    const copy = original.clone();
    const twist = { value: new THREE.Matrix4() }, rowY = { value: new THREE.Vector4(0, 1, 0, 0) };
    const band2 = { value: new THREE.Vector2(neckY - band, neckY + band) };
    copy.onBeforeCompile = (shader) => {
      shader.uniforms.uHeadTwist = twist; shader.uniforms.uHeadRowY = rowY; shader.uniforms.uHeadBand = band2;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform mat4 uHeadTwist; uniform vec4 uHeadRowY; uniform vec2 uHeadBand;')
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nfloat headW = smoothstep(uHeadBand.x, uHeadBand.y, dot(uHeadRowY, vec4(position, 1.0)));\nobjectNormal = normalize(mix(objectNormal, mat3(uHeadTwist) * objectNormal, headW));')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = mix(transformed, (uHeadTwist * vec4(transformed, 1.0)).xyz, headW);');
    };
    copy.customProgramCacheKey = () => 'skate-head-twist';
    mesh.material = copy;
    patched.push({ mesh, original, copy, twist, rowY, local: new THREE.Matrix4(), localInv: new THREE.Matrix4() });
  }

  function measure(p: Patched): void {
    // Mesh-local → carriage space (the surface is static on the carriage).
    p.local.identity();
    const chain: THREE.Object3D[] = [];
    for (let o: THREE.Object3D | null = p.mesh; o && o !== carriage; o = o.parent) chain.push(o);
    for (let i = chain.length - 1; i >= 0; i -= 1) { chain[i]!.updateMatrix(); p.local.multiply(chain[i]!.matrix); }
    p.localInv.copy(p.local).invert();
    const e = p.local.elements;
    p.rowY.value.set(e[1]!, e[5]!, e[9]!, e[13]!);
  }

  return {
    sync() {
      if (carriage.children.length === seen) return;
      seen = carriage.children.length;
      for (const child of carriage.children) {
        if (child.name.startsWith('body-')) continue;
        child.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh || patched.some((p) => p.mesh === mesh)) return;
          patch(mesh);
        });
      }
      for (const p of patched) measure(p);
    },
    set(yaw, pitch) {
      if (!patched.length) return;
      _e.set(pitch, yaw, 0, 'YXZ');
      _r.makeRotationFromEuler(_e);
      _t.makeTranslation(0, neckY, 0).multiply(_r).multiply(_m.makeTranslation(0, -neckY, 0));
      for (const p of patched) p.twist.value.copy(p.localInv).multiply(_t).multiply(p.local);
    },
    release() {
      for (const p of patched) { p.mesh.material = p.original; p.copy.dispose(); }
      patched.length = 0; seen = -1;
    },
  };
}
