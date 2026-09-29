/**
 * Mark layers (T3): the three.js plumbing shared by spaces, signposts, the piece, the selection ring and the preview.
 * A layer is one geometry drawn twice — a normal pass and the occluded ghost pass — with ONE set of shared uniforms,
 * so it costs at most two draw calls whatever it holds. Two geometry forms feed the same shader:
 *
 * - `instancedGeometry(shape, items)`: one shape, many copies (spaces, stakes) — true GPU instancing.
 * - `mergedGeometry(entries)`: different shapes flattened into one buffer with per-vertex anchors (signposts, preview).
 */
import * as THREE from "three";
import type { Point2, Point3 } from "../contracts.ts";
import { createMarkMaterials, markUniforms, type MarkUniforms } from "./materials.ts";
import { hexToRgb, type Shape } from "./shapes.ts";

export type MarkItem = {
  /** Board-space anchor (engine x, compressed height, engine z). */
  anchor: Point3;
  /** Local +x points along this planar direction (x, z). Default east. */
  dir?: Point2;
  color: string;
  scale?: number;
  /** Extra height in design units. */
  lift?: number;
};

function baseAttributes(geometry: THREE.BufferGeometry, shape: Shape) {
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(shape.positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(shape.normals, 3));
  geometry.setAttribute("aColor", new THREE.Float32BufferAttribute(shape.colors, 3));
  geometry.setAttribute("aTint", new THREE.Float32BufferAttribute(shape.tints, 1));
  geometry.setAttribute("aShade", new THREE.Float32BufferAttribute(shape.shades, 1));
}

export function instancedGeometry(shape: Shape, items: readonly MarkItem[]): THREE.InstancedBufferGeometry {
  const g = new THREE.InstancedBufferGeometry();
  baseAttributes(g, shape);
  const anchor = new Float32Array(items.length * 3), dir = new Float32Array(items.length * 2), color = new Float32Array(items.length * 3);
  const scale = new Float32Array(items.length), lift = new Float32Array(items.length), index = new Float32Array(items.length);
  items.forEach((item, i) => {
    anchor.set(item.anchor, i * 3);
    dir.set(item.dir ?? [1, 0], i * 2);
    color.set(hexToRgb(item.color), i * 3);
    scale[i] = item.scale ?? 1;
    lift[i] = item.lift ?? 0;
    index[i] = i;
  });
  g.setAttribute("iAnchor", new THREE.InstancedBufferAttribute(anchor, 3));
  g.setAttribute("iDir", new THREE.InstancedBufferAttribute(dir, 2));
  g.setAttribute("iColor", new THREE.InstancedBufferAttribute(color, 3));
  g.setAttribute("iScale", new THREE.InstancedBufferAttribute(scale, 1));
  g.setAttribute("iLift", new THREE.InstancedBufferAttribute(lift, 1));
  g.setAttribute("iIndex", new THREE.InstancedBufferAttribute(index, 1));
  g.instanceCount = items.length;
  return g;
}

/** Different shapes, each at its own anchor, flattened. `index` groups the vertices of one selectable item. */
export function mergedGeometry(entries: readonly { shape: Shape; item: MarkItem; index: number }[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const all: Shape = { positions: [], normals: [], colors: [], tints: [], shades: [] };
  const anchor: number[] = [], dir: number[] = [], color: number[] = [], scale: number[] = [], lift: number[] = [], index: number[] = [];
  for (const { shape, item, index: idx } of entries) {
    const n = shape.positions.length / 3, c = hexToRgb(item.color), d = item.dir ?? [1, 0];
    for (let i = 0; i < shape.positions.length; i += 1) {
      all.positions.push(shape.positions[i]!); all.normals.push(shape.normals[i]!); all.colors.push(shape.colors[i]!);
    }
    all.tints.push(...shape.tints); all.shades.push(...shape.shades);
    for (let v = 0; v < n; v += 1) {
      anchor.push(item.anchor[0], item.anchor[1], item.anchor[2]);
      dir.push(d[0], d[1]);
      color.push(c[0], c[1], c[2]);
      scale.push(item.scale ?? 1);
      lift.push(item.lift ?? 0);
      index.push(idx);
    }
  }
  baseAttributes(g, all);
  g.setAttribute("iAnchor", new THREE.Float32BufferAttribute(anchor, 3));
  g.setAttribute("iDir", new THREE.Float32BufferAttribute(dir, 2));
  g.setAttribute("iColor", new THREE.Float32BufferAttribute(color, 3));
  g.setAttribute("iScale", new THREE.Float32BufferAttribute(scale, 1));
  g.setAttribute("iLift", new THREE.Float32BufferAttribute(lift, 1));
  g.setAttribute("iIndex", new THREE.Float32BufferAttribute(index, 1));
  return g;
}

/** Render order (all opaque list): land (0) → ghosts (1, tested against the land's depth only) → board (2). */
export const RENDER_ORDER = { ghost: 1, board: 2, overlay: 3 } as const;

export type MarkLayer = {
  name: string;
  group: THREE.Group;
  uniforms: MarkUniforms;
  /** Ids → item index (for selection lift / settle animation). */
  indexOf: Map<string, number>;
  setGeometry(geometry: THREE.BufferGeometry | null, indexOf?: Map<string, number>): void;
  setVisible(visible: boolean): void;
  dispose(): void;
};

export function createMarkLayer(name: string, opts: { occluded?: boolean; uniforms?: MarkUniforms } = {}): MarkLayer {
  const uniforms = opts.uniforms ?? markUniforms();
  const materials = createMarkMaterials(uniforms);
  const group = new THREE.Group();
  group.name = `journey-board:${name}`;
  let main: THREE.Mesh | null = null, ghost: THREE.Mesh | null = null, geometry: THREE.BufferGeometry | null = null;
  const layer: MarkLayer = {
    name, group, uniforms, indexOf: new Map(),
    setGeometry(next, indexOf) {
      if (main) group.remove(main);
      if (ghost) group.remove(ghost);
      geometry?.dispose();
      geometry = next;
      main = ghost = null;
      layer.indexOf = indexOf ?? new Map();
      if (!next || !next.getAttribute("position")?.count || (next as THREE.InstancedBufferGeometry).instanceCount === 0) return;
      main = new THREE.Mesh(next, materials.main);
      main.name = `${group.name}:main`;
      main.frustumCulled = false;
      main.renderOrder = RENDER_ORDER.board;
      group.add(main);
      if (opts.occluded !== false) {
        ghost = new THREE.Mesh(next, materials.occluded);
        ghost.name = `${group.name}:ghost`;
        ghost.frustumCulled = false;
        ghost.renderOrder = RENDER_ORDER.ghost;
        group.add(ghost);
      }
    },
    setVisible(visible) { group.visible = visible; },
    dispose() {
      geometry?.dispose();
      materials.main.dispose();
      materials.occluded.dispose();
      group.removeFromParent();
      group.clear();
    },
  };
  return layer;
}

/** Triangles and draw calls actually drawn under `root` (visible only; instanced geometry counts every copy). */
export function countBoardDraws(root: THREE.Object3D): { triangles: number; drawCalls: number } {
  let triangles = 0, drawCalls = 0;
  const visit = (node: THREE.Object3D) => {
    if (!node.visible) return;
    const mesh = node as THREE.Mesh;
    if (mesh.isMesh) {
      const g = mesh.geometry, count = g.index ? g.index.count : g.getAttribute("position")?.count ?? 0;
      const copies = (g as THREE.InstancedBufferGeometry).isInstancedBufferGeometry ? (g as THREE.InstancedBufferGeometry).instanceCount : (mesh as THREE.InstancedMesh).isInstancedMesh ? (mesh as THREE.InstancedMesh).count : 1;
      if (count > 0 && copies > 0) { triangles += (count / 3) * copies; drawCalls += 1; }
    } else if ((node as THREE.Line).isLine || (node as THREE.Points).isPoints) {
      if (((node as THREE.Line).geometry.getAttribute("position")?.count ?? 0) > 0) drawCalls += 1;
    }
    for (const child of node.children) visit(child);
  };
  visit(root);
  return { triangles: Math.round(triangles), drawCalls };
}
