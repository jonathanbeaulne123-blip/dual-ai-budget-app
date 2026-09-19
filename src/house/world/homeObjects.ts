import * as THREE from "three";
import type { NestBank } from "../../core/kittyNest.ts";
import type { CellarJar } from "../../core/queenCellar.ts";
import type { KittyGlaze, KittyPieceV1 } from "../../core/types.ts";
import { KITTY_GLAZES } from "../../core/goalEnvelopes.ts";
import { createKittySculpture } from "../../kitty/sculpture.ts";
import type { HouseTheme, HouseZoneKey } from "./houseSet.ts";

export type HomeBankProjection = {
  bank: Pick<NestBank, "id" | "state" | "tier">;
  piece: KittyPieceV1;
  glaze: KittyGlaze;
  /** Canonical backing step from the Nest/Queen projection, 0–10. */
  step: number;
  fired: boolean;
};

export type HomeJarProjection = {
  jar: Pick<CellarJar, "id" | "type" | "size" | "fill" | "paid" | "strike" | "hue" | "umbrellaHue" | "finish">;
};

export type HomeObjectsProjection = {
  banks: readonly HomeBankProjection[];
  jars: readonly HomeJarProjection[];
};

export type HomeObjectAnchor = {
  id: string;
  zone: HouseZoneKey;
  target: THREE.Object3D;
};

export type HomeObjects = {
  group: THREE.Group;
  /** Stable target groups for DOM projection and close camera focus. */
  anchors: Map<string, HomeObjectAnchor>;
  update(next: HomeObjectsProjection): void;
  dispose(): void;
};

type BankEntry = {
  holder: THREE.Group;
  sculpture: ReturnType<typeof createKittySculpture>;
  pieceId: string;
  glaze: THREE.MeshStandardMaterial;
};
type JarEntry = {
  holder: THREE.Group;
  body: THREE.Mesh;
  water: THREE.Mesh;
  rim: THREE.Mesh;
  crack: THREE.Group;
  shards: THREE.Group;
  signature: string;
};

const HOME_X = -9.3;
const LOFT_Y = 6.28;
const CELLAR_Y = 0.05;
const MAX_BANKS = 8;
const MAX_JARS = 10;

const THEMES: Record<HouseTheme, { wood: number; trim: number; clay: number; water: number; felt: number }> = {
  classic: { wood: 0x76553b, trim: 0xc5a96f, clay: 0xb87655, water: 0x79aebb, felt: 0x63715c },
  taylor: { wood: 0x8c7168, trim: 0xd4b07b, clay: 0xc1818d, water: 0x8caab3, felt: 0x957b91 },
  newfoundland: { wood: 0x6d4b36, trim: 0xd9b45b, clay: 0xb75747, water: 0x4f98aa, felt: 0x3f776d },
};

const HUES: Record<CellarJar["hue"], number> = {
  housing: 0x9b604f, food: 0xc5904c, transport: 0x647f8f, life: 0x8b6d91, health: 0x6d9279, debt: 0x765a55, clay: 0xa87559,
};

export const homeBankAnchorId = (id: string) => `home-bank:${id}`;
export const homeJarAnchorId = (id: string) => `home-jar:${id}`;

/** Authored fixed slots: updates never make an object jump because its amount changed. */
export function homeObjectPosition(kind: "bank" | "jar", index: number): [number, number, number] {
  if (kind === "bank") {
    const shelf = Math.floor(index / 4), column = index % 4;
    return [HOME_X - 2.05 + column * 1.34, LOFT_Y + 0.44 + shelf * 1.02, -1.2];
  }
  const row = Math.floor(index / 5), column = index % 5;
  return [HOME_X - 2.18 + column * 1.08, CELLAR_Y + 0.55 + row * 0.86, -1.08];
}

export function homeJarAppearance(jar: HomeJarProjection["jar"]) {
  const paid = jar.paid || jar.strike === "shard";
  return {
    paid,
    frosted: !paid && jar.type === "potential",
    cracked: !paid && jar.strike === "crack",
  };
}

const bankStep = (step: number) => Math.max(0, Math.min(10, Math.round(Number.isFinite(step) ? step : 0)));

export function createHomeObjects(theme: HouseTheme, initial: HomeObjectsProjection = { banks: [], jars: [] }): HomeObjects {
  const kit = THEMES[theme];
  const group = new THREE.Group();
  group.name = "Canonical Home objects";
  const loft = new THREE.Group(), cellar = new THREE.Group();
  loft.name = "The real pottery shelf";
  cellar.name = "The real bill jars";
  group.add(loft, cellar);

  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  const geo = <T extends THREE.BufferGeometry>(value: T) => (geometries.add(value), value);
  const mat = <T extends THREE.Material>(value: T) => (materials.add(value), value);
  const wood = mat(new THREE.MeshStandardMaterial({ color: kit.wood, roughness: 0.82 }));
  const trim = mat(new THREE.MeshStandardMaterial({ color: kit.trim, roughness: 0.4, metalness: 0.42 }));
  const felt = mat(new THREE.MeshStandardMaterial({ color: kit.felt, roughness: 1 }));
  const waterMaterial = mat(new THREE.MeshPhysicalMaterial({ color: kit.water, roughness: 0.22, transparent: true, opacity: 0.68, clearcoat: 0.8 }));
  const shelfGeometry = geo(new THREE.BoxGeometry(5.75, 0.13, 0.72));
  const railGeometry = geo(new THREE.BoxGeometry(5.75, 0.1, 0.5));
  for (const y of [LOFT_Y + 0.18, LOFT_Y + 1.2]) {
    const board = new THREE.Mesh(shelfGeometry, wood); board.position.set(HOME_X, y, -1.25); loft.add(board);
    for (const x of [HOME_X - 2.35, HOME_X + 2.35]) { const bracket = new THREE.Mesh(geo(new THREE.BoxGeometry(0.1, 0.42, 0.45)), trim); bracket.position.set(x, y - 0.22, -1.18); loft.add(bracket); }
  }
  for (const y of [CELLAR_Y + 0.25, CELLAR_Y + 1.11]) { const rail = new THREE.Mesh(railGeometry, wood); rail.position.set(HOME_X, y, -1.16); cellar.add(rail); }
  const trough = new THREE.Mesh(geo(new THREE.BoxGeometry(5.9, 0.08, 0.7)), waterMaterial); trough.position.set(HOME_X, CELLAR_Y + 0.18, -1.18); cellar.add(trough);

  const banks = new Map<string, BankEntry>(), jars = new Map<string, JarEntry>();
  const anchors = new Map<string, HomeObjectAnchor>();

  function dropBank(id: string) {
    const entry = banks.get(id); if (!entry) return;
    entry.holder.removeFromParent(); entry.sculpture.dispose(); entry.glaze.dispose(); banks.delete(id); anchors.delete(homeBankAnchorId(id));
  }
  function makeBank(row: HomeBankProjection, holder = new THREE.Group()): BankEntry {
    holder.name = `Bank ${row.bank.id}`; holder.userData.anchorId = homeBankAnchorId(row.bank.id);
    const sculpture = createKittySculpture(row.piece, { brass: `#${kit.trim.toString(16).padStart(6, "0")}`, wood: `#${kit.wood.toString(16).padStart(6, "0")}`, fired: row.fired, reducedMotion: true });
    const model = new THREE.Group(); model.scale.setScalar(0.34); sculpture.group.rotation.y = -0.18; model.add(sculpture.group); holder.add(model);
    const glaze = new THREE.MeshStandardMaterial({ color: KITTY_GLAZES[row.glaze], roughness: row.fired ? 0.2 : 0.85 });
    const seal = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.25, 0.27, 0.055, 20)), glaze); seal.position.y = 0.03; holder.add(seal);
    if (!holder.parent) loft.add(holder);
    return { holder, sculpture, pieceId: row.piece.id, glaze };
  }

  function dropJar(id: string) {
    const entry = jars.get(id); if (!entry) return;
    entry.holder.removeFromParent(); disposeJarParts(entry);
    jars.delete(id); anchors.delete(homeJarAnchorId(id));
  }
  function disposeJarParts(entry: JarEntry) {
    for (const child of [entry.body, entry.water, entry.rim]) { child.geometry.dispose(); (child.material as THREE.Material).dispose(); }
    entry.crack.traverse((node) => { if (node instanceof THREE.Mesh) { node.geometry.dispose(); (node.material as THREE.Material).dispose(); } });
    entry.shards.traverse((node) => { if (node instanceof THREE.Mesh) { node.geometry.dispose(); (node.material as THREE.Material).dispose(); } });
    entry.holder.clear();
  }
  function makeJar(row: HomeJarProjection, holder = new THREE.Group()): JarEntry {
    const { jar } = row, appearance = homeJarAppearance(jar), scale = 0.72 + jar.size * 0.08;
    holder.name = `Jar ${jar.id}`; holder.userData.anchorId = homeJarAnchorId(jar.id);
    const tint = jar.umbrellaHue && /^#[0-9a-f]{6}$/i.test(jar.umbrellaHue) ? jar.umbrellaHue : HUES[jar.hue];
    const bodyMaterial = new THREE.MeshPhysicalMaterial({ color: tint, roughness: appearance.frosted ? 0.66 : jar.finish === "plain" ? 0.35 : 0.55, transparent: appearance.frosted, opacity: appearance.frosted ? 0.48 : 0.94, clearcoat: appearance.frosted ? 0.12 : 0.55 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.31 * scale, 0.38 * scale, 0.72 * scale, 18, 1, true), bodyMaterial); body.position.y = 0.38 * scale;
    const rimMaterial = new THREE.MeshStandardMaterial({ color: kit.clay, roughness: 0.5 });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.31 * scale, 0.045, 7, 18), rimMaterial); rim.rotation.x = Math.PI / 2; rim.position.y = 0.75 * scale;
    const waterMat = new THREE.MeshPhysicalMaterial({ color: kit.water, roughness: 0.18, transparent: true, opacity: 0.72 });
    const fill = Math.max(0, Math.min(1, jar.fill));
    const water = new THREE.Mesh(new THREE.CylinderGeometry(0.29 * scale, 0.34 * scale, Math.max(0.015, fill * 0.63 * scale), 18), waterMat); water.position.y = 0.08 * scale + Math.max(0.015, fill * 0.63 * scale) / 2;
    const crack = new THREE.Group(), shards = new THREE.Group();
    const crackMat = new THREE.MeshStandardMaterial({ color: 0x3b2923, roughness: 0.9 });
    for (let i = 0; i < 3; i++) { const line = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.27, 0.018), crackMat.clone()); line.position.set((i - 1) * 0.06, 0.3 + i * 0.12, 0.34 * scale); line.rotation.z = (i % 2 ? -1 : 1) * 0.45; crack.add(line); }
    const shardMat = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.5 });
    for (let i = 0; i < 4; i++) { const shard = new THREE.Mesh(new THREE.ConeGeometry(0.17 * scale, 0.3 * scale, 3), shardMat.clone()); shard.position.set((i - 1.5) * 0.18, 0.12, (i % 2 - 0.5) * 0.2); shard.rotation.set(Math.PI / 2, i * 0.8, i * 0.2); shards.add(shard); }
    crackMat.dispose(); shardMat.dispose();
    body.visible = rim.visible = water.visible = !appearance.paid; crack.visible = appearance.cracked; shards.visible = appearance.paid;
    holder.add(body, water, rim, crack, shards); if (!holder.parent) cellar.add(holder);
    return { holder, body, water, rim, crack, shards, signature: JSON.stringify(jar) };
  }

  function apply(next: HomeObjectsProjection) {
    const bankRows = next.banks.slice(0, MAX_BANKS), bankIds = new Set(bankRows.map((row) => row.bank.id));
    for (const id of banks.keys()) if (!bankIds.has(id)) dropBank(id);
    bankRows.forEach((row, index) => {
      let entry = banks.get(row.bank.id);
      if (entry && entry.pieceId !== row.piece.id) { const holder = entry.holder; entry.sculpture.dispose(); entry.glaze.dispose(); holder.clear(); entry = makeBank(row, holder); banks.set(row.bank.id, entry); }
      if (!entry) { entry = makeBank(row); banks.set(row.bank.id, entry); anchors.set(homeBankAnchorId(row.bank.id), { id: homeBankAnchorId(row.bank.id), zone: "home:above", target: entry.holder }); }
      entry.sculpture.setSculpt(row.piece.sculpt); entry.sculpture.setPaint(row.piece.paint); entry.sculpture.setFired(row.fired); entry.sculpture.setFill(bankStep(row.step), false);
      entry.glaze.color.set(KITTY_GLAZES[row.glaze]); entry.glaze.roughness = row.fired ? 0.2 : 0.85;
      entry.holder.position.fromArray(homeObjectPosition("bank", index)); entry.holder.visible = row.bank.state !== "archived";
    });

    const jarRows = next.jars.slice(0, MAX_JARS), jarIds = new Set(jarRows.map((row) => row.jar.id));
    for (const id of jars.keys()) if (!jarIds.has(id)) dropJar(id);
    jarRows.forEach((row, index) => {
      let entry = jars.get(row.jar.id), signature = JSON.stringify(row.jar);
      if (entry && entry.signature !== signature) { const holder = entry.holder; disposeJarParts(entry); entry = makeJar(row, holder); jars.set(row.jar.id, entry); }
      if (!entry) { entry = makeJar(row); jars.set(row.jar.id, entry); anchors.set(homeJarAnchorId(row.jar.id), { id: homeJarAnchorId(row.jar.id), zone: "home:below", target: entry.holder }); }
      entry.holder.position.fromArray(homeObjectPosition("jar", index));
    });
  }

  let disposed = false;
  apply(initial);
  return {
    group,
    anchors,
    update(next) { if (!disposed) apply(next); },
    dispose() {
      if (disposed) return; disposed = true;
      for (const id of [...banks.keys()]) dropBank(id);
      for (const id of [...jars.keys()]) dropJar(id);
      group.clear(); for (const geometry of geometries) geometry.dispose(); for (const material of materials) material.dispose(); anchors.clear();
    },
  };
}
