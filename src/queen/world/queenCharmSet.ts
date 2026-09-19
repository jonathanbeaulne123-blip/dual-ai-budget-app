import * as THREE from "three";
import { QUEEN_CHARM_LIMITS, type QueenCharmKind, type QueenCharmV1 } from "../../core/queenCharms.ts";
import { QUEEN_GLAZE_AXIS, type QueenGlazeAxis } from "./queenAuthoring.ts";
import { QUEEN_CHARM_UNIT, QUEEN_FORM_BASE, queenSurfaceSeat, type QueenForm } from "./queenCharmSurface.ts";
import { buildCharmGeometry, type CharmGeometry } from "./queenCharmLibrary.ts";

/**
 * The charms on her, as instanced meshes on the body group: one instanced
 * body mesh and one instanced ink mesh per kind in use, so sixteen charms of
 * a dozen kinds are at most twenty-four draw calls and never more than two
 * geometries per kind, built once and kept until disposal. Each instance is
 * a matrix (seat, spin, tilt, scale) and a colour. They share her
 * environment lighting and follow her glaze axis, so they read as ceramic
 * stuck to ceramic rather than stickers — and, because the axis is applied
 * to them and never read from them, a charm cannot carry the freshness
 * reading. Nothing here animates.
 */
const PRESS = 0.02;
const UP = new THREE.Vector3(0, 1, 0), OUT = new THREE.Vector3(0, 0, 1);

export function createQueenCharmSet(parent: THREE.Object3D, options: { ink?: string } = {}) {
  const geometries = new Map<QueenCharmKind, CharmGeometry>();
  const meshes = new Map<QueenCharmKind, { body: THREE.InstancedMesh; accent: THREE.InstancedMesh | null }>();
  const bodyMaterial = new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: QUEEN_GLAZE_AXIS.glazed.roughness, clearcoat: QUEEN_GLAZE_AXIS.glazed.clearcoat, clearcoatRoughness: 0.1, metalness: 0.02, envMapIntensity: QUEEN_GLAZE_AXIS.glazed.envMapIntensity });
  const inkMaterial = new THREE.MeshStandardMaterial({ color: options.ink ?? "#1b1712", roughness: 0.75 });
  let charms: QueenCharmV1[] = [];
  let bellyWidth = 1;
  let form: QueenForm = QUEEN_FORM_BASE;
  let disposed = false;
  const matrix = new THREE.Matrix4(), basis = new THREE.Matrix4(), quaternion = new THREE.Quaternion(), local = new THREE.Quaternion(), color = new THREE.Color();
  const position = new THREE.Vector3(), normal = new THREE.Vector3(), x = new THREE.Vector3(), y = new THREE.Vector3(), scale = new THREE.Vector3();

  const ensure = (kind: QueenCharmKind) => {
    let entry = meshes.get(kind);
    if (entry) return entry;
    let geometry = geometries.get(kind);
    if (!geometry) { geometry = buildCharmGeometry(kind); geometries.set(kind, geometry); }
    const make = (g: THREE.BufferGeometry, material: THREE.Material, name: string) => {
      const mesh = new THREE.InstancedMesh(g, material, QUEEN_CHARM_LIMITS.count);
      mesh.name = name;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.frustumCulled = false;
      mesh.count = 0;
      parent.add(mesh);
      return mesh;
    };
    entry = { body: make(geometry.body, bodyMaterial, `queen-charm:${kind}`), accent: geometry.accent ? make(geometry.accent, inkMaterial, `queen-charm-ink:${kind}`) : null };
    meshes.set(kind, entry);
    return entry;
  };

  const seatMatrix = (charm: QueenCharmV1) => {
    const seat = queenSurfaceSeat(charm.part, charm.u, charm.v, bellyWidth, form);
    position.set(...seat.position);
    normal.set(...seat.normal);
    // A brooch, not a hat: the charm's back is against her, its up is the world's up along her surface.
    const up = Math.abs(normal.dot(UP)) > 0.97 ? OUT : UP;
    y.copy(up).addScaledVector(normal, -up.dot(normal)).normalize();
    x.crossVectors(y, normal).normalize();
    basis.makeBasis(x, y, normal);
    quaternion.setFromRotationMatrix(basis);
    local.setFromEuler(new THREE.Euler((charm.tilt * Math.PI) / 180, 0, (charm.spin * Math.PI) / 180, "ZYX"));
    quaternion.multiply(local);
    const size = QUEEN_CHARM_UNIT * charm.scale;
    position.addScaledVector(normal, -PRESS * size);
    scale.setScalar(size);
    return matrix.compose(position, quaternion, scale);
  };

  const lay = () => {
    if (disposed) return;
    const byKind = new Map<QueenCharmKind, QueenCharmV1[]>();
    for (const charm of charms.slice(0, QUEEN_CHARM_LIMITS.count)) byKind.set(charm.kind, [...(byKind.get(charm.kind) ?? []), charm]);
    for (const [kind, entry] of meshes) if (!byKind.has(kind)) { entry.body.count = 0; entry.body.visible = false; if (entry.accent) { entry.accent.count = 0; entry.accent.visible = false; } }
    for (const [kind, rows] of byKind) {
      const entry = ensure(kind);
      for (const [index, charm] of rows.entries()) {
        const m = seatMatrix(charm);
        entry.body.setMatrixAt(index, m);
        entry.body.setColorAt(index, color.set(charm.color));
        entry.accent?.setMatrixAt(index, m);
      }
      entry.body.count = rows.length;
      entry.body.visible = true;
      entry.body.instanceMatrix.needsUpdate = true;
      if (entry.body.instanceColor) entry.body.instanceColor.needsUpdate = true;
      if (entry.accent) { entry.accent.count = rows.length; entry.accent.visible = true; entry.accent.instanceMatrix.needsUpdate = true; }
    }
  };

  return {
    get disposed() { return disposed; },
    materials: { body: bodyMaterial, ink: inkMaterial },
    /** For tests and the stats line: what is allocated and what is drawn. */
    counts() {
      let instances = 0, drawCalls = 0;
      for (const entry of meshes.values()) { instances += entry.body.count; if (entry.body.count) drawCalls += entry.accent ? 2 : 1; }
      return { kinds: geometries.size, geometries: [...geometries.values()].reduce((sum, g) => sum + 1 + (g.accent ? 1 : 0), 0), materials: 2, meshes: [...meshes.values()].reduce((sum, e) => sum + 1 + (e.accent ? 1 : 0), 0), instances, drawCalls };
    },
    setCharms(next: QueenCharmV1[]) {
      charms = next;
      lay();
    },
    /** The thrown form moves the surface; charms on it ride along. */
    setForm(next: QueenForm) {
      form = next;
      lay();
    },
    /** The fill widens the belly; charms on it ride along. */
    setBellyWidth(width: number) {
      if (width === bellyWidth) return;
      bellyWidth = width;
      lay();
    },
    /** Her axis, applied to the charms so they are the same ceramic; never read from them. */
    setGlaze(axis: QueenGlazeAxis) {
      bodyMaterial.roughness = axis.roughness;
      bodyMaterial.clearcoat = axis.clearcoat;
      bodyMaterial.envMapIntensity = axis.envMapIntensity;
      bodyMaterial.needsUpdate = true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const entry of meshes.values()) { entry.body.removeFromParent(); entry.body.dispose(); if (entry.accent) { entry.accent.removeFromParent(); entry.accent.dispose(); } }
      meshes.clear();
      for (const geometry of geometries.values()) { geometry.body.dispose(); geometry.accent?.dispose(); }
      geometries.clear();
      bodyMaterial.dispose();
      inkMaterial.dispose();
      charms = [];
    },
  };
}
export type QueenCharmSet = ReturnType<typeof createQueenCharmSet>;
