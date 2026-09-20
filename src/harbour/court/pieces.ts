import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { COURT_ASSETS, type GlbAsset } from "../assets/manifest.ts";
import { acquireGlb, type GlbHandle } from "../assets/loadGlb.ts";
import type { Anchor, Region } from "../scene/place.ts";
import type { CourtDressing } from "./dressing.ts";
import { EngravedPlate, engravedWords, type PlateFinish } from "./engraved.ts";

export type PieceId = "rook" | "knight" | "bishop";
export type PieceFund = "build" | "protect" | "prepare";

export type PieceDef = {
  id: PieceId;
  label: string;
  fund: PieceFund;
  position: [number, number, number];
  /** `suggestedScaleBesideQueen` from the Form Core kit: height as a fraction of the Queen. */
  scale: number;
  /** Door for `onOpen(target, object)` — the money paths stay where they are. */
  door: { target: string; object?: string };
  /** Slight turn toward the court's centre so the pieces attend the Queen. */
  turn: number;
};

/** The Queen's normalised height; every piece is sized against it. */
export const QUEEN_HEIGHT = 2.05;
export const PLINTH = { width: 1.0, height: 0.5, depth: 1.0 } as const;

export const COURT_PIECES: Record<PieceId, PieceDef> = {
  rook: { id: "rook", label: "The Rook — Build", fund: "build", position: [4.2, 0, -3.0], scale: 0.82, door: { target: "loft-banks" }, turn: -0.32 },
  knight: { id: "knight", label: "The Knight — Protect", fund: "protect", position: [-4.2, 0, -3.0], scale: 0.79, door: { target: "loft-banks", object: "bank/plan:protect" }, turn: 0.32 },
  bishop: { id: "bishop", label: "The Bishop — Prepare", fund: "prepare", position: [0, 0, 4.6], scale: 0.91, door: { target: "cellar-bills" }, turn: 0 },
};
export const PIECE_IDS: readonly PieceId[] = ["rook", "bishop", "knight"];

/** Unit height × the kit's scale × the Queen's height, standing on y = 0 and centred in x/z. */
export function normalisePiece(root: THREE.Object3D, scale: number): THREE.Object3D {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const height = size.y > 1e-6 ? size.y : 1;
  const factor = (QUEEN_HEIGHT * scale) / height;
  root.scale.multiplyScalar(factor);
  root.updateMatrixWorld(true);
  const after = new THREE.Box3().setFromObject(root);
  const centre = after.getCenter(new THREE.Vector3());
  root.position.x -= centre.x;
  root.position.z -= centre.z;
  root.position.y -= after.min.y;
  root.updateMatrixWorld(true);
  return root;
}

/**
 * Draw-call thrift: meshes that share a material are merged into one mesh (the
 * Form Core pieces carry ~34 meshes over ~17 materials each). Materials are
 * never recoloured. Any group that cannot merge keeps its original meshes.
 */
export function mergeByMaterial(root: THREE.Object3D): THREE.Group {
  root.updateMatrixWorld(true);
  const buckets = new Map<string, { material: THREE.Material; meshes: THREE.Mesh[] }>();
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh) || Array.isArray(node.material)) return;
    const material = node.material as THREE.Material;
    const bucket = buckets.get(material.uuid) ?? { material, meshes: [] };
    bucket.meshes.push(node);
    buckets.set(material.uuid, bucket);
  });
  const merged = new THREE.Group();
  merged.name = root.name || "piece";
  for (const { material, meshes } of buckets.values()) {
    if (meshes.length === 1) {
      const only = meshes[0]!;
      const geometry = only.geometry.clone().applyMatrix4(only.matrixWorld);
      merged.add(new THREE.Mesh(geometry, material));
      continue;
    }
    const parts = meshes.map((mesh) => {
      const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
      // Drop attributes the others lack so mergeGeometries accepts the set.
      return geometry;
    });
    const names = parts.map((geometry) => Object.keys(geometry.attributes).sort().join(","));
    const indexed = parts.map((geometry) => geometry.index !== null);
    const uniform = names.every((name) => name === names[0]) && indexed.every((flag) => flag === indexed[0]);
    let joined: THREE.BufferGeometry | null = null;
    if (uniform) {
      try { joined = mergeGeometries(parts, false); } catch { joined = null; }
    }
    if (joined) {
      for (const part of parts) part.dispose();
      merged.add(new THREE.Mesh(joined, material));
    } else {
      for (const part of parts) merged.add(new THREE.Mesh(part, material));
    }
  }
  return merged;
}

export type PieceSlot = {
  def: PieceDef;
  holder: THREE.Group;
  plinth: THREE.Mesh;
  plate: EngravedPlate;
  model: THREE.Object3D | null;
};

export type CourtPieces = {
  group: THREE.Group;
  slots: Record<PieceId, PieceSlot>;
  /** Engraves the fund's number on the plinth (`null` → "—"). Returns true when the plate changed. */
  setPlate(id: PieceId, cents: number | null, finish?: PlateFinish): boolean;
  anchors(): Anchor[];
  regions(): Region[];
  /** Resolves when every piece has landed or failed; a failed piece leaves its plinth standing. */
  ready: Promise<void>;
  landed(): PieceId[];
  /** Pieces whose model did not arrive, with the reason; their plinths still stand. */
  failed(): Partial<Record<PieceId, unknown>>;
  dispose(): void;
};

export type CourtPiecesOptions = {
  quality: "full" | "lite";
  signal?: AbortSignal;
  /** Called when a piece's model lands so the runtime can schedule a frame. */
  onLanded?: (id: PieceId) => void;
  /** Injectable loader (tests): a hold on the shared parsed scene; callers clone the root. */
  load?: (asset: GlbAsset, signal?: AbortSignal) => Promise<Pick<GlbHandle, "root" | "release">>;
  /** Skip the network entirely: plinths and plates only. */
  loadModels?: boolean;
};

/**
 * Three plinths with engraved plate caps at the court's three points; the Form
 * Core pieces are loaded after and stood on top. Anchors carry the door targets.
 */
export function createCourtPieces(dressing: CourtDressing, options: CourtPiecesOptions): CourtPieces {
  const group = new THREE.Group();
  group.name = "court-pieces";
  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(item: T): T => { disposables.push(item); return item; };
  const plinthMaterial = track(new THREE.MeshStandardMaterial({ color: dressing.plinth, roughness: 0.85 }));
  const plinthGeometry = track(new THREE.BoxGeometry(PLINTH.width, PLINTH.height, PLINTH.depth));
  const capGeometry = track(new THREE.BoxGeometry(PLINTH.width + 0.08, 0.06, PLINTH.depth + 0.08));

  const slots = {} as Record<PieceId, PieceSlot>;
  for (const id of PIECE_IDS) {
    const def = COURT_PIECES[id];
    const holder = new THREE.Group();
    holder.name = `piece:${id}`;
    holder.position.set(...def.position);
    const plinth = new THREE.Mesh(plinthGeometry, plinthMaterial);
    plinth.position.y = PLINTH.height / 2; plinth.castShadow = true; plinth.receiveShadow = true;
    plinth.userData.anchor = id;
    holder.add(plinth);
    const cap = new THREE.Mesh(capGeometry, plinthMaterial);
    cap.position.y = PLINTH.height + 0.03; cap.receiveShadow = true; cap.castShadow = true; holder.add(cap);
    const plate = new EngravedPlate({ stone: dressing.plate, highlight: dressing.plateHighlight, ink: dressing.ink, size: "medium" }, 0.82, 0.3);
    plate.mesh.position.set(0, PLINTH.height / 2, PLINTH.depth / 2 + 0.006);
    plate.mesh.userData.anchor = id;
    holder.add(plate.mesh);
    disposables.push(plate);
    plate.set(engravedWords(null));
    group.add(holder);
    slots[id] = { def, holder, plinth, plate, model: null };
  }

  const landedIds: PieceId[] = [];
  const failures: Partial<Record<PieceId, unknown>> = {};
  const load = options.load ?? acquireGlb;
  const shouldLoad = options.loadModels ?? true;
  const holds: Pick<GlbHandle, "release">[] = [];
  const ready = shouldLoad
    ? Promise.allSettled(PIECE_IDS.map(async (id) => {
        const slot = slots[id];
        try {
          const hold = await load(COURT_ASSETS[id], options.signal);
          holds.push(hold);
          if (options.signal?.aborted) return;
          // The shared root belongs to the loader's cache; the court stands its own copy on the plinth.
          const merged = mergeByMaterial(hold.root.clone(true));
          normalisePiece(merged, slot.def.scale);
          merged.rotation.y = slot.def.turn;
          merged.position.y = PLINTH.height + 0.06;
          merged.traverse((node) => {
            if (node instanceof THREE.Mesh) { node.castShadow = options.quality === "full"; node.receiveShadow = false; node.userData.anchor = id; }
          });
          slot.model = merged;
          slot.holder.add(merged);
          landedIds.push(id);
          options.onLanded?.(id);
        } catch (error) {
          failures[id] = error;
        }
      })).then(() => undefined)
    : Promise.resolve();

  const anchors = (): Anchor[] => PIECE_IDS.map((id) => {
    const def = COURT_PIECES[id];
    return { id, position: [def.position[0], PLINTH.height + QUEEN_HEIGHT * def.scale * 0.5, def.position[2]], zone: "piece", label: def.label, door: def.door };
  });
  const regions = (): Region[] => PIECE_IDS.map((id) => {
    const def = COURT_PIECES[id];
    const [x, , z] = def.position;
    const half = Math.max(PLINTH.width, PLINTH.depth) / 2 + 0.1;
    const top = PLINTH.height + 0.06 + QUEEN_HEIGHT * def.scale + 0.1;
    return { id, group: "court", label: def.label, box: new THREE.Box3(new THREE.Vector3(x - half, 0, z - half), new THREE.Vector3(x + half, top, z + half)) };
  });

  return {
    group,
    slots,
    setPlate(id, cents, finish = "glazed") { return slots[id].plate.set(engravedWords(cents), finish); },
    anchors,
    regions,
    ready,
    landed: () => [...landedIds],
    failed: () => ({ ...failures }),
    dispose() {
      for (const id of PIECE_IDS) {
        const model = slots[id].model;
        if (model) model.traverse((node) => { if (node instanceof THREE.Mesh) { node.geometry.dispose(); const m = node.material as THREE.Material | THREE.Material[]; (Array.isArray(m) ? m : [m]).forEach((material) => material.dispose()); } });
      }
      for (const item of disposables) item.dispose();
      for (const hold of holds.splice(0)) hold.release();
    },
  };
}
