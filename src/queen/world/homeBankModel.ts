import * as THREE from "three";

/**
 * A Home kitty bank stood as one of Jonathan's models (D-267). The model is a
 * shared template: each bank shows a clone of its scene graph, and nothing
 * here changes a mesh, a material or a transform inside it. The bank grows
 * with its fill the way a studio bank does — the same ten steps of uniform
 * scale — which moves its size, never its look. No money is read here.
 */
const GROW = 0.055;

export function createHomeBankModel(template: THREE.Object3D, name: string) {
  const group = new THREE.Group();
  group.name = `home-bank-model:${name}`;
  const grow = new THREE.Group();
  const holder = new THREE.Group();
  const model = template.clone(true);
  template.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(template);
  // Stand it on the floor on its own axis; the sculptor centred it, so only the base is lifted.
  holder.position.set(0, -box.min.y, 0);
  holder.add(model);
  grow.add(holder);
  group.add(grow);
  let step = 0, disposed = false;
  return {
    group,
    model,
    get step() { return step; },
    get disposed() { return disposed; },
    setFill(next: number, _animate?: boolean) {
      step = Math.max(0, Math.min(10, Math.round(next)));
      grow.scale.setScalar(1 + step * GROW);
    },
    /** The template's geometry and materials are shared; they are released with the world, not with a bank. */
    dispose() {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      group.clear();
    },
  };
}
export type HomeBankModel = ReturnType<typeof createHomeBankModel>;
