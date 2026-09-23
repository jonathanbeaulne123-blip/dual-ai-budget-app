import * as THREE from "three";
import type { Anchor, PlaceDressing, Region } from "../scene/place.ts";
import type { RenderTier } from "../scene/quality.ts";

export type VillageLife = {
  group: THREE.Group;
  anchors: () => Anchor[];
  regions: () => Region[];
  animate: (t: number, dt: number) => boolean;
  /** Spoken cosmetic acknowledgements only; interaction never changes books. */
  interact: (id: string) => string | null;
  dispose: () => void;
};

/** Small, local-only life around the new Court. No remote assets, state, or external data. */
export function buildVillageLife(dressing: PlaceDressing, tier: RenderTier): VillageLife {
  const group = new THREE.Group(); group.name = "village-life";
  const owned = new Set<{ dispose(): void }>();
  const material = (color: string, opt: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
    const next = new THREE.MeshStandardMaterial({ color, roughness: .8, ...opt }); owned.add(next); return next;
  };
  const add = (geometry: THREE.BufferGeometry, mat: THREE.Material, name: string, at: readonly [number, number, number], rotation?: readonly [number, number, number]) => {
    owned.add(geometry); const mesh = new THREE.Mesh(geometry, mat); mesh.name = name; mesh.position.set(...at); if (rotation) mesh.rotation.set(...rotation); mesh.castShadow = tier === "full"; group.add(mesh); return mesh;
  };
  const wood = material(dressing.timber), brass = material(dressing.metal, { metalness: .62, roughness: .34 }), sail = material("#ece0bc");
  // One low-poly gull mesh is cloned, retaining a single material and no network texture.
  const gulls = new THREE.Group(); gulls.name = "village-seagull-flock"; group.add(gulls);
  for (let i = 0; i < (tier === "full" ? 6 : 4); i++) {
    const gull = add(new THREE.ConeGeometry(.16, .48, 4), sail, `seagull-${i}`, [0, 0, 0]); gull.scale.set(1, .22, 1); gull.rotation.z = Math.PI / 2; gull.position.set(-8 + i * .68, 4.8 + (i % 3) * .28, -9 + (i % 2) * .6); gulls.add(gull);
  }
  // A nearshore sloop is physical hull, mast and sail, not an icon plane.
  const boat = new THREE.Group(); boat.name = "village-nearshore-sailboat"; group.add(boat);
  const hull = add(new THREE.CylinderGeometry(.55, .72, 2.3, 8), wood, "sailboat-hull", [0, .24, 0]); hull.rotation.z = Math.PI / 2; boat.add(hull);
  const mast = add(new THREE.CylinderGeometry(.035, .045, 1.85, 8), wood, "sailboat-mast", [0, 1.08, 0]); boat.add(mast);
  const sailMesh = add(new THREE.ConeGeometry(.72, 1.45, 3), sail, "sailboat-sail", [.4, 1.2, 0]); sailMesh.rotation.z = -Math.PI / 2; boat.add(sailMesh); boat.position.set(68, -.45, -49); boat.scale.setScalar(2.6);
  // The bell gives the square a readable centre; bench and chalk-ring offer two gentle invitations.
  const bell = new THREE.Group(); bell.name = "village-bell-chimes"; group.add(bell);
  const post = add(new THREE.CylinderGeometry(.13, .13, 2.0, 8), wood, "bell-post", [0, 1.0, 0]); bell.add(post);
  const bellBody = add(new THREE.SphereGeometry(.34, 10, 7, 0, Math.PI * 2, 0, Math.PI / 2), brass, "village-bell", [0, 1.78, 0]); bell.add(bellBody); bell.position.set(-1, 0, 4.6);
  const bench = new THREE.Group(); bench.name = "village-bench"; group.add(bench);
  for (const x of [-.72, .72]) { const leg = add(new THREE.BoxGeometry(.14, .55, .14), wood, "bench-leg", [x, .28, 0]); bench.add(leg); }
  const seat = add(new THREE.BoxGeometry(1.8, .15, .5), wood, "bench-seat", [0, .63, 0]); bench.add(seat); bench.position.set(4.8, 0, 4.2);
  const dance = add(new THREE.TorusGeometry(.72, .035, 6, 20), brass, "village-dance-ring", [-4.4, .04, 4.1]); dance.rotation.x = Math.PI / 2;
  const anchors = (): Anchor[] => [
    { id: "village-bell", position: [-1, 1.78, 4.6], zone: "village", label: "The harbour bell — see it rock" },
    { id: "village-bench", position: [4.8, .7, 4.2], zone: "village", label: "The harbour bench — take a quiet pause" },
    { id: "village-dance", position: [-4.4, .16, 4.1], zone: "village", label: "The chalk dance spot — take a turn around the square" },
  ];
  let dead = false, bellUntil=0, now=0;
  bell.traverse(n=>{n.userData.anchor="village-bell";});bench.traverse(n=>{n.userData.anchor="village-bench";});dance.userData.anchor="village-dance";
  return {
    group, anchors,
    regions: () => anchors().map(anchor => ({ id: anchor.id, group: "village-life", label: anchor.label, box: new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(...anchor.position), new THREE.Vector3(1.2, 1.3, 1.2)) })),
    animate: (t) => { now=t;bellBody.rotation.z=t<bellUntil?Math.sin(t*15)*.24:0; gulls.position.x = Math.sin(t * .22) * 2.2; gulls.rotation.z = Math.sin(t * .8) * .04; boat.rotation.z = Math.sin(t * .65) * .045;  return true; },
    interact: id => id === "village-bell" ? (bellUntil=now+2.5,"The little brass bell rocks in the sea breeze.") : id === "village-bench" ? "A quiet place to sit together." : id === "village-dance" ? "A small turn around the square." : null,
    dispose: () => { if (dead) return; dead = true; group.removeFromParent(); for (const item of owned) item.dispose(); owned.clear(); group.clear(); },
  };
}
