import * as THREE from "three";
import { acquireGlb, type GlbHandle } from "../assets/loadGlb.ts";
import type { GlbAsset } from "../assets/manifest.ts";
import type { CellarJarReading } from "../data/reading.ts";
import { UMBRELLA_BANK_MODELS, type UmbrellaBankId } from "../../queen/world/bankModels.ts";
import type { CellarDressing } from "./dressing.ts";
import { dollarsToUnits } from "./water.ts";

/**
 * A jar per bill on the Cellar's rail (LITTLE_HARBOUR_v2 §2, BUILD_PLAN_SLICE2 §3).
 *
 * A jar with an umbrella is a glass jar with that umbrella's own bank standing
 * inside it — the twelve Mandevilla cats already shipped under
 * `public/models/banks/`. A bill filed nowhere yet gets a clean cut-paper
 * porcelain jar instead, so it reads as a jar and not as a fault.
 *
 * The four states are exactly the ones Jonathan set:
 * **frosted** = planned, **solid** = set aside, **cleanly shattered** = paid,
 * and **cracked** — a single hairline — only under a confirmed shortfall.
 *
 * Its **height is money** on the room's one scale (`dollarsToUnits`), so a
 * $1,000 jar is exactly as tall as $1,000 of Prepare's water behind it. Its
 * **width** is the reading's 1–5 size band, which is a band and never a figure.
 *
 * Nothing here posts, proposes or computes money.
 */

/** What a jar looks like. `setState` takes the reading's word and this is what it becomes. */
export type JarVisual = "frosted" | "solid" | "shattered" | "cracked";
export type JarState = CellarJarReading["state"];

/** The state machine, in one place. A crack is only ever a confirmed shortfall. */
export function jarVisualFor(state: JarState): JarVisual {
  switch (state) {
    case "planned": return "frosted";
    case "set-aside": return "solid";
    case "paid": return "shattered";
    case "short": return "cracked";
  }
}

/** The smallest a jar is ever drawn: a $2 bill is still a jar you can see and tap. */
export const JAR_MIN_HEIGHT = 0.18;
/** The five size bands → the jar's radius. Bands, never a readable figure. */
export const JAR_RADIUS: Readonly<Record<1 | 2 | 3 | 4 | 5, number>> = Object.freeze({ 1: 0.105, 2: 0.125, 3: 0.145, 4: 0.17, 5: 0.2 });

/**
 * A jar's body height on the room's one dollar scale — the same ruler the
 * water uses, floored so the smallest bill is still a jar.
 */
export function jarHeight(amountCents: number, scaleCents: number): number {
  return Math.max(JAR_MIN_HEIGHT, dollarsToUnits(amountCents, scaleCents));
}

/** How much floor a jar of this size needs on the shelf. */
export const jarFootprint = (size: CellarJarReading["size"]): number => JAR_RADIUS[size] * 2 + 0.09;

/** Is this one of the twelve umbrellas that has a bank of its own? */
export const isUmbrellaBankId = (value: unknown): value is UmbrellaBankId =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(UMBRELLA_BANK_MODELS, value);

/** The bank GLB for an umbrella, as an asset the harbour's own loader understands. */
export function umbrellaAsset(umbrella: UmbrellaBankId): GlbAsset {
  const model = UMBRELLA_BANK_MODELS[umbrella];
  return { url: model.url, gz: `${model.url}.gz`, sha256: model.sha256, bytes: model.bytes, tier: "any" };
}

export type CellarJar = {
  readonly key: string;
  readonly group: THREE.Group;
  /** Metres from the shelf to the top of the jar's lid, for anchors and poses. */
  readonly height: number;
  readonly radius: number;
  /** The reading's words for the twin; never a bare "$0" for an unknown. */
  label: string;
  setState(state: JarState): void;
  setFill(fill: number): void;
  /** Days ahead of the scrub line go pale — present on the rail, not yet their turn. */
  setPale(pale: boolean): void;
  visual(): JarVisual;
  pale(): boolean;
  /** True while a clean break's shards are still on the shelf. They are swept on the next mount. */
  shards(): boolean;
  /** Resolves when the umbrella's bank has landed inside the glass, or failed. */
  ready: Promise<void>;
  dispose(): void;
};

export type CellarJarOptions = {
  reading: CellarJarReading;
  dressing: CellarDressing;
  /** The room's ruler; the water uses the same one. */
  scaleCents: number;
  /** `lite` skips the bank GLB and stands the porcelain jar instead. */
  quality?: "full" | "lite";
  signal?: AbortSignal;
  /** Called when the bank lands, so the runtime paints a frame. */
  onLanded?: (key: string) => void;
  /** Test seam: stand in for `acquireGlb`. */
  load?: (asset: GlbAsset, signal?: AbortSignal) => Promise<GlbHandle>;
  loadModels?: boolean;
};

const SHARD_COUNT = 5;

/** Fit a cloned bank inside the jar: centred on the shelf, a shade under the glass. */
function fitInside(root: THREE.Object3D, radius: number, height: number): void {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const span = Math.max(size.x, size.z, 1e-6);
  const factor = Math.min((height * 0.78) / Math.max(size.y, 1e-6), (radius * 1.5) / span);
  root.scale.multiplyScalar(factor);
  root.updateMatrixWorld(true);
  const after = new THREE.Box3().setFromObject(root);
  const centre = after.getCenter(new THREE.Vector3());
  root.position.x -= centre.x;
  root.position.z -= centre.z;
  root.position.y -= after.min.y;
}

/**
 * One jar, ready to stand on the rail. The caller places `group` on the shelf;
 * the jar's own origin is the shelf under it.
 */
export function createJar(options: CellarJarOptions): CellarJar {
  const { reading, dressing } = options;
  const radius = JAR_RADIUS[reading.size];
  const body = jarHeight(reading.amountCents, options.scaleCents);
  const glazed = reading.umbrella !== null;

  const group = new THREE.Group();
  group.name = `jar:${reading.key}`;
  group.userData.anchor = `jar:${reading.key}`;

  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(item: T): T => { disposables.push(item); return item; };

  const glassMaterial = track(new THREE.MeshStandardMaterial({ color: dressing.glass, roughness: 0.1, metalness: 0.05, transparent: true, opacity: 0.4 }));
  const porcelainMaterial = track(new THREE.MeshStandardMaterial({ color: dressing.porcelain, roughness: 0.42, metalness: 0 }));
  const shellMaterial = glazed ? glassMaterial : porcelainMaterial;

  // The whole jar, and the clean-broken base that is left when it is paid.
  const whole = new THREE.Mesh(track(new THREE.CylinderGeometry(radius, radius * 0.96, body, 16, 1, true)), shellMaterial);
  whole.position.y = body / 2;
  whole.name = "jar-body";
  whole.castShadow = true;
  group.add(whole);

  const broken = new THREE.Mesh(track(new THREE.CylinderGeometry(radius * 0.99, radius * 0.96, body * 0.28, 16, 1, true)), shellMaterial);
  broken.position.y = body * 0.14;
  broken.name = "jar-broken";
  broken.visible = false;
  group.add(broken);

  const lid = new THREE.Mesh(track(new THREE.CylinderGeometry(radius * 1.06, radius * 1.06, 0.03, 16)), track(new THREE.MeshStandardMaterial({ color: dressing.brass, roughness: 0.34, metalness: 0.62 })));
  lid.position.y = body + 0.015;
  lid.name = "jar-lid";
  lid.castShadow = true;
  group.add(lid);

  // What the jar holds, on its own 0–1 fill. Never a figure, only a height.
  const contentsGeometry = track(new THREE.CylinderGeometry(radius * 0.92, radius * 0.9, 1, 14));
  contentsGeometry.translate(0, 0.5, 0);
  const contents = new THREE.Mesh(contentsGeometry, track(new THREE.MeshStandardMaterial({ color: dressing.water, roughness: 0.2, metalness: 0.08, transparent: true, opacity: 0.8 })));
  contents.name = "jar-contents";
  contents.scale.y = 0.001;
  group.add(contents);

  // One hairline, only ever shown under a confirmed shortfall.
  const crack = new THREE.Mesh(track(new THREE.BoxGeometry(0.006, body * 0.72, 0.006)), track(new THREE.MeshStandardMaterial({ color: dressing.crack, roughness: 1 })));
  crack.position.set(radius * 0.94, body * 0.46, radius * 0.18);
  crack.rotation.z = 0.16;
  crack.name = "jar-crack";
  crack.visible = false;
  group.add(crack);

  // The smaller subscription: its label keeps a missing-mark for one cycle. A torn
  // paper tag on the glass, and nothing at all on a jar that has not shrunk.
  const mark = new THREE.Mesh(track(new THREE.PlaneGeometry(radius * 1.2, radius * 0.6)), track(new THREE.MeshStandardMaterial({ color: dressing.plate, roughness: 0.85, transparent: true, opacity: 0.92 })));
  mark.position.set(0, body * 0.58, radius + 0.004);
  mark.rotation.z = 0.08;
  mark.name = "jar-mark";
  mark.visible = reading.missingMark === true;
  group.add(mark);

  // The shards of a clean break, swept on the next mount.
  const shardGeometry = track(new THREE.TetrahedronGeometry(radius * 0.3, 0));
  const shards = new THREE.InstancedMesh(shardGeometry, shellMaterial, SHARD_COUNT);
  shards.name = "jar-shards";
  shards.visible = false;
  const matrix = new THREE.Matrix4(), place = new THREE.Vector3(), turn = new THREE.Quaternion(), flat = new THREE.Vector3(1, 0.45, 1);
  for (let i = 0; i < SHARD_COUNT; i++) {
    const angle = (i / SHARD_COUNT) * Math.PI * 2 + 0.4;
    place.set(Math.cos(angle) * radius * 1.5, radius * 0.16, Math.sin(angle) * radius * 1.2);
    turn.setFromEuler(new THREE.Euler(0, angle * 1.7, 0.2));
    matrix.compose(place, turn, flat);
    shards.setMatrixAt(i, matrix);
  }
  shards.instanceMatrix.needsUpdate = true;
  group.add(shards);

  // The umbrella's own bank, inside the glass.
  const inside = new THREE.Group();
  inside.name = "jar-bank";
  group.add(inside);

  let handle: GlbHandle | null = null;
  let disposed = false;
  const loader = options.load ?? acquireGlb;
  const wantsModel = glazed && options.loadModels !== false && options.quality !== "lite";
  const ready: Promise<void> = wantsModel && reading.umbrella
    ? loader(umbrellaAsset(reading.umbrella), options.signal).then((held) => {
      if (disposed) { held.release(); return; }
      handle = held;
      const clone = held.root.clone(true);
      fitInside(clone, radius, body);
      clone.traverse((node) => { if (node instanceof THREE.Mesh) node.castShadow = true; });
      inside.add(clone);
      inside.visible = visual !== "frosted";
      options.onLanded?.(reading.key);
    }).catch(() => undefined)
    : Promise.resolve();

  let visual: JarVisual = jarVisualFor(reading.state);
  let paleNow = false;
  // A jar that arrives already paid has had its shards swept: the rail is tidy on entry.
  let sweptOnMount = visual === "shattered";
  let shardsUp = false;

  const applyPale = (): void => {
    const dim = paleNow ? 0.45 : 1;
    glassMaterial.opacity = (visual === "frosted" ? 0.9 : 0.4) * (paleNow ? 0.6 : 1);
    porcelainMaterial.opacity = dim;
    porcelainMaterial.transparent = paleNow;
    lid.material.opacity = dim;
    lid.material.transparent = paleNow;
    contents.material.opacity = 0.8 * dim;
    inside.traverse((node) => { if (node instanceof THREE.Mesh) node.visible = !paleNow || visual !== "frosted"; });
  };

  const applyVisual = (): void => {
    const shattered = visual === "shattered";
    whole.visible = !shattered;
    broken.visible = shattered;
    lid.visible = !shattered;
    crack.visible = visual === "cracked";
    shardsUp = shattered && !sweptOnMount;
    shards.visible = shardsUp;
    // Etched glass: the cat is inside, but you cannot see it through a frosted jar.
    inside.visible = visual !== "frosted";
    glassMaterial.color.set(visual === "frosted" ? dressing.glassFrost : dressing.glass);
    glassMaterial.roughness = visual === "frosted" ? 0.78 : 0.1;
    contents.visible = !shattered;
    mark.visible = reading.missingMark === true && !shattered;
    applyPale();
  };
  applyVisual();
  contents.scale.y = Math.max(0.001, Math.min(1, Number.isFinite(reading.fill) ? reading.fill : 0) * body * 0.94);

  return {
    key: reading.key,
    group,
    height: body + 0.03,
    radius,
    label: reading.label,
    setState(state) {
      const next = jarVisualFor(state);
      if (next === visual) return;
      // A break that happens while you are standing here leaves its shards; one that
      // was already a break when you arrived has been swept.
      if (next === "shattered") sweptOnMount = false;
      visual = next;
      applyVisual();
    },
    setFill(fill) {
      const safe = Math.max(0, Math.min(1, Number.isFinite(fill) ? fill : 0));
      contents.scale.y = Math.max(0.001, safe * body * 0.94);
    },
    setPale(pale) {
      if (pale === paleNow) return;
      paleNow = pale;
      applyPale();
    },
    visual: () => visual,
    pale: () => paleNow,
    shards: () => shardsUp,
    ready,
    dispose() {
      disposed = true;
      handle?.release();
      handle = null;
      group.removeFromParent();
      for (const item of disposables) item.dispose();
    },
  };
}
