import * as THREE from "three";

/**
 * The Mandevilla Queen: Jonathan's sculpted model of her (2026-09-15) — a
 * glazed porcelain cat meditating in a hand-thrown terracotta planter, with
 * the mandevilla growing as her hair, white and crimson, and a coin slot at
 * her back. She is a kitty bank, and this is the look she keeps.
 *
 * This module only loads, measures and fits the asset. It never recolours,
 * re-materials, re-shapes or hides any part of it: every reading the Queen
 * carries is drawn around her by `queenSculpture.ts`, never on her surface.
 * The file in `public/` is the exact file Jonathan supplied (the SHA-256
 * below is asserted by test); the `.gz` next to it is a transfer copy only.
 * No money is read here.
 */
export const QUEEN_MODEL_URL = "/models/queen/mandevilla-queen.v1.glb";
export const QUEEN_MODEL_SHA256 = "4954397c6a8d152d2770a8f91426e0d867aec18454ac2ff73e967e8b6861d301";

/**
 * Her two sworn companions, Jonathan's models for Home's two kitty banks
 * (D-267): the Mandevilla Guardian — a tiny kitten in oversized glazed-clay
 * armour — is Protect; the Mandevilla Mastermind, Lord Laurel, is Build.
 * Shipped byte for byte like her, never altered, and fitted to the bank's
 * own control. How the couple customises them is still to be decided.
 */
export type HomeBankModelId = "protect" | "build";
export const HOME_BANK_MODELS: Record<HomeBankModelId, { name: string; url: string; sha256: string }> = {
  protect: { name: "Mandevilla Guardian", url: "/models/queen/mandevilla-guardian.v1.glb", sha256: "a1f4d3fa1e81d1069bb7e3f9a684cfabdef1c0ab1969ed899614bbf49ab9271f" },
  build: { name: "Mandevilla Mastermind", url: "/models/queen/mandevilla-mastermind.v1.glb", sha256: "202b00793e1211c895291718ca6ab313b17c929330191c266fe344cda478a935" },
};

export async function loadHomeBankModel(id: HomeBankModelId, signal?: AbortSignal): Promise<THREE.Group> {
  return parseQueenModel(await readQueenModel(signal, HOME_BANK_MODELS[id].url));
}

/** Fetches the model, preferring the gzip transfer copy where the browser can inflate it. */
export async function readQueenModel(signal?: AbortSignal, url = QUEEN_MODEL_URL): Promise<ArrayBuffer> {
  const inflate = typeof DecompressionStream !== "undefined";
  let response = await fetch(url + (inflate ? ".gz" : ""), { signal });
  if (!response.ok && inflate) response = await fetch(url, { signal });
  if (!response.ok) throw new Error("Queen model unavailable");
  let bytes = await response.arrayBuffer();
  const head = new Uint8Array(bytes, 0, Math.min(2, bytes.byteLength));
  // A host that already inflated the transfer copy hands back the glb itself; only real gzip is inflated here.
  if (inflate && head[0] === 31 && head[1] === 139) bytes = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
  if (signal?.aborted) throw new DOMException("Closed", "AbortError");
  return bytes;
}

export async function parseQueenModel(bytes: ArrayBuffer): Promise<THREE.Group> {
  const { parseGlbScene } = await import("../../assets/gltf.ts");
  return parseGlbScene(bytes);
}

export async function loadQueenModel(signal?: AbortSignal): Promise<THREE.Group> {
  return parseQueenModel(await readQueenModel(signal));
}

/** Node names survive the loader with spaces turned to underscores; compare on letters and digits only. */
const key = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");
export function queenModelPart(root: THREE.Object3D, name: string): THREE.Object3D | null {
  const wanted = key(name);
  let found: THREE.Object3D | null = null;
  root.traverse((node) => { if (!found && key(node.name) === wanted) found = node; });
  return found;
}

/**
 * Where the readings go, measured off the model itself in its own units
 * (base at y = 0, height 1, front +Z) so nothing is guessed:
 * - `crown` — the middle of the vine crown on her head;
 * - `saucer` — the saucer's radius, where the stones and the coin stack stand clear of her;
 * - `pot` — the planter's outer profile, radius by height, for the gold seams;
 * - `hair` — points along her left (white) and right (crimson) vines for new growth.
 */
export type QueenModelAnchors = {
  height: number;
  crown: THREE.Vector3;
  saucer: { radius: number; top: number };
  pot: { bottom: number; top: number; radiusAt: (y: number) => number };
  hair: { left: THREE.Vector3[]; right: THREE.Vector3[] };
};

const boxOf = (node: THREE.Object3D | null) => (node ? new THREE.Box3().setFromObject(node) : null);

function meshPoints(node: THREE.Object3D | null): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  node?.updateWorldMatrix(true, true);
  node?.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const position = child.geometry.getAttribute("position");
    if (!position) return;
    const v = new THREE.Vector3();
    for (let i = 0; i < position.count; i += 1) points.push(v.fromBufferAttribute(position, i).clone().applyMatrix4(child.matrixWorld));
  });
  return points;
}

/** Evenly spread seats along a vine, highest to lowest, facing the room. */
function hairSeats(points: THREE.Vector3[], count: number): THREE.Vector3[] {
  if (!points.length) return [];
  const front = points.filter((p) => p.z > 0);
  const pool = front.length > count * 4 ? front : points;
  let low = Infinity, high = -Infinity;
  for (const p of pool) { low = Math.min(low, p.y); high = Math.max(high, p.y); }
  const seats: THREE.Vector3[] = [];
  for (let i = 0; i < count; i += 1) {
    const y = high - ((i + 0.5) / count) * (high - low) * 0.8;
    let best: THREE.Vector3 | null = null, gap = Infinity;
    // Nearest to the band's height, and the most forward of those, so a seat is never hidden behind her.
    for (const p of pool) {
      const d = Math.abs(p.y - y) - p.z * 0.05;
      if (d < gap) { gap = d; best = p; }
    }
    if (best) seats.push(best.clone());
  }
  return seats;
}

export function queenModelAnchors(root: THREE.Object3D): QueenModelAnchors {
  root.updateWorldMatrix(true, true);
  const whole = new THREE.Box3().setFromObject(root);
  const crownBox = boxOf(queenModelPart(root, "Living hair | crown vines"));
  const headBox = boxOf(queenModelPart(root, "Ceramic | cat head and ears"));
  const crown = crownBox && !crownBox.isEmpty()
    ? crownBox.getCenter(new THREE.Vector3())
    : headBox && !headBox.isEmpty() ? new THREE.Vector3(0, headBox.max.y - 0.06, 0) : new THREE.Vector3(0, whole.max.y * 0.92, 0);

  const saucerBox = boxOf(queenModelPart(root, "Pot | saucer"));
  const saucer = saucerBox && !saucerBox.isEmpty()
    ? { radius: Math.max(saucerBox.max.x, -saucerBox.min.x, saucerBox.max.z, -saucerBox.min.z), top: saucerBox.max.y }
    : { radius: 0.25, top: 0.04 };

  // The planter's outer profile: the widest radius in each height band.
  const potPoints = meshPoints(queenModelPart(root, "Pot | hand-thrown terracotta"));
  const bands = 24;
  let bottom = Infinity, top = -Infinity;
  for (const p of potPoints) { bottom = Math.min(bottom, p.y); top = Math.max(top, p.y); }
  if (!potPoints.length) { bottom = saucer.top; top = saucer.top + 0.3; }
  const radii = new Array<number>(bands).fill(0);
  for (const p of potPoints) {
    const band = Math.min(bands - 1, Math.max(0, Math.floor(((p.y - bottom) / Math.max(1e-6, top - bottom)) * bands)));
    radii[band] = Math.max(radii[band]!, Math.hypot(p.x, p.z));
  }
  for (let i = 0; i < bands; i += 1) if (!radii[i]) radii[i] = i ? radii[i - 1]! : saucer.radius;
  const radiusAt = (y: number) => {
    const t = Math.min(bands - 1, Math.max(0, ((y - bottom) / Math.max(1e-6, top - bottom)) * bands - 0.5));
    const i = Math.floor(t), f = t - i;
    return radii[i]! * (1 - f) + radii[Math.min(bands - 1, i + 1)]! * f;
  };

  const left = hairSeats(meshPoints(queenModelPart(root, "Living hair | left vines")), 5);
  const right = hairSeats(meshPoints(queenModelPart(root, "Living hair | right vines")), 5);
  return { height: Math.max(1e-6, whole.max.y - whole.min.y), crown, saucer, pot: { bottom, top, radiusAt }, hair: { left, right } };
}

/** Every geometry and material in the model, so the sculpture can release them with its own. */
export function queenModelResources(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    geometries.add(node.geometry);
    for (const m of Array.isArray(node.material) ? node.material : [node.material]) {
      materials.add(m);
      for (const value of Object.values(m)) if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  return { geometries, materials, textures };
}

/**
 * A fingerprint of how the model looks: every mesh's transform, vertex count
 * and every material's visible parameters. Tests take one before and after
 * each reading changes and require them to be identical.
 */
export function queenModelLook(root: THREE.Object3D): string {
  const rows: string[] = [];
  root.traverse((node) => {
    const m = node.matrix.elements.map((v) => v.toFixed(5)).join(",");
    let row = `${node.name}|${node.visible}|${m}`;
    if (node instanceof THREE.Mesh) {
      row += `|${node.geometry.getAttribute("position")?.count ?? 0}`;
      for (const mat of Array.isArray(node.material) ? node.material : [node.material]) {
        const x = mat as THREE.MeshPhysicalMaterial;
        row += `|${mat.name}:${x.color?.getHexString() ?? ""}:${x.emissive?.getHexString() ?? ""}:${x.emissiveIntensity ?? ""}:${x.roughness ?? ""}:${x.metalness ?? ""}:${x.clearcoat ?? ""}:${x.envMapIntensity ?? ""}:${mat.opacity}:${mat.transparent}:${mat.visible}:${Boolean(x.map)}`;
      }
    }
    rows.push(row);
  });
  return rows.join("\n");
}
