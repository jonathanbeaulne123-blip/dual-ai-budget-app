import { Box3, DoubleSide, BufferGeometry, Float32BufferAttribute, Mesh, MeshBasicMaterial, Ray, Raycaster, Triangle, Vector3 } from 'three';
import type { ExportMesh, GeometryReport } from './exportTypes.ts';

const EPS = 1e-5; // mm; used for seam topology only, never source-coordinate output
const point = (m: ExportMesh, i: number) => new Vector3(...m.positions.slice(i * 3, i * 3 + 3) as [number, number, number]);
export function weldMesh(mesh: ExportMesh): ExportMesh {
  const byPosition = new Map<string, number>(), positions: number[] = [], uv: number[] = [], mapping: number[] = [];
  for (let i = 0; i < mesh.positions.length / 3; i++) {
    const xyz = mesh.positions.slice(i * 3, i * 3 + 3), key = xyz.map(n => Math.round(n / EPS)).join(',');
    let id = byPosition.get(key);
    if (id === undefined) { id = positions.length / 3; byPosition.set(key, id); positions.push(...xyz); uv.push(...mesh.uv.slice(i * 2, i * 2 + 2)); }
    mapping.push(id);
  }
  const indices: number[] = [];
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const tri = mesh.indices.slice(i, i + 3).map(n => mapping[n]!);
    const t = new Triangle(...tri.map(n => new Vector3(...positions.slice(n * 3, n * 3 + 3) as [number, number, number])) as [Vector3, Vector3, Vector3]);
    if (new Set(tri).size === 3 && t.getArea() > 1e-10) indices.push(...tri);
  }
  return { ...mesh, positions, uv, indices };
}
function edges(mesh: ExportMesh) {
  const found = new Map<string, Array<[number, number]>>();
  for (let i = 0; i < mesh.indices.length; i += 3) for (let j = 0; j < 3; j++) {
    const a = mesh.indices[i + j]!, b = mesh.indices[i + (j + 1) % 3]!, key = a < b ? `${a}:${b}` : `${b}:${a}`;
    found.set(key, [...found.get(key) ?? [], [a, b]]);
  }
  return found;
}
export function isPlanar(mesh: ExportMesh): boolean {
  const m = weldMesh(mesh);
  if (!m.indices.length) return true;
  const t = new Triangle(...m.indices.slice(0, 3).map(i => point(m, i)) as [Vector3, Vector3, Vector3]);
  const normal = t.getNormal(new Vector3());
  return m.positions.every((_, i) => i % 3 !== 0 || Math.abs(point(m, i / 3).sub(t.a).dot(normal)) < EPS);
}
/** Reviewed derivative only: cap planar boundary loops, preserving winding. */
export function capMesh(mesh: ExportMesh): ExportMesh {
  const m = weldMesh(mesh), boundary = [...edges(m).values()].filter(e => e.length === 1).map(e => e[0]!);
  const next = new Map<number, number>();
  for (const [a, b] of boundary) { if (next.has(a)) throw Error(`EXPORT_BRANCHING_BOUNDARY:${mesh.name}`); next.set(a, b); }
  while (next.size) {
    const first = next.keys().next().value!, loop = [first]; let current = first;
    do { const n = next.get(current); if (n === undefined) throw Error(`EXPORT_OPEN_BOUNDARY:${mesh.name}`); next.delete(current); current = n; if (current !== first) loop.push(current); } while (current !== first && loop.length <= boundary.length);
    if (current !== first || loop.length < 3) throw Error(`EXPORT_INVALID_BOUNDARY:${mesh.name}`);
    const center = loop.reduce((sum, i) => sum.add(point(m, i)), new Vector3()).divideScalar(loop.length);
    const normal = new Triangle(point(m, loop[0]!), point(m, loop[1]!), center).getNormal(new Vector3());
    if (loop.some(i => Math.abs(point(m, i).sub(center).dot(normal)) > 0.02)) throw Error(`EXPORT_NONPLANAR_CAP_REQUIRES_REVIEW:${mesh.name}`);
    const ci = m.positions.length / 3; m.positions.push(...center.toArray()); m.uv.push(0.5, 0.5);
    for (let i = 0; i < loop.length; i++) m.indices.push(loop[(i + 1) % loop.length]!, loop[i]!, ci);
  }
  return m;
}
export function combineMeshes(meshes: ExportMesh[]): ExportMesh {
  const out: ExportMesh = { name: 'combined', material: 0, positions: [], indices: [], uv: [] };
  for (const mesh of meshes) { const offset = out.positions.length / 3; for (const n of mesh.positions) out.positions.push(n); for (const n of mesh.uv) out.uv.push(n); for (const i of mesh.indices) out.indices.push(i + offset); }
  return out;
}
/** Reviewed derivative only. Preserve UV seams while canonicalizing float32 geometry across material runs. */
export function cleanManufacturingMeshes(meshes: ExportMesh[]): ExportMesh[] {
  const canonical = new Map<string, number[]>();
  return meshes.map(mesh => {
    const positions: number[] = [], indices: number[] = [];
    for (let i = 0; i < mesh.positions.length; i += 3) {
      const p = mesh.positions.slice(i, i + 3), key = p.map(n => Math.round(n / EPS)).join(',');
      const prior = canonical.get(key); if (!prior) canonical.set(key, p);
      positions.push(...prior ?? p);
    }
    const candidate = { ...mesh, positions };
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const ids = mesh.indices.slice(i, i + 3), triangle = new Triangle(...ids.map(n => point(candidate, n)) as [Vector3, Vector3, Vector3]);
      if (triangle.getArea() > 1e-10) indices.push(...ids);
    }
    return { ...candidate, indices };
  }).filter(m => m.indices.length > 0);
}
function intersects(a: Triangle, b: Triangle): boolean {
  const na = a.getNormal(new Vector3()), nb = b.getNormal(new Vector3());
  const ap = [a.a, a.b, a.c], bp = [b.a, b.b, b.c];
  if (Math.abs(na.dot(nb)) > 1 - 1e-8 && Math.abs(na.dot(b.a.clone().sub(a.a))) < EPS) {
    const axis = Math.abs(na.x) > Math.abs(na.y) ? Math.abs(na.x) > Math.abs(na.z) ? 0 : 2 : Math.abs(na.y) > Math.abs(na.z) ? 1 : 2;
    const pa = ap.map(p => p.toArray().filter((_, i) => i !== axis)), pb = bp.map(p => p.toArray().filter((_, i) => i !== axis));
    for (const polygon of [pa, pb]) for (let i = 0; i < 3; i++) {
      const p = polygon[i]!, q = polygon[(i + 1) % 3]!, nx = -(q[1]! - p[1]!), ny = q[0]! - p[0]!;
      const x = pa.map(v => v[0]! * nx + v[1]! * ny), y = pb.map(v => v[0]! * nx + v[1]! * ny);
      if (Math.max(...x) <= Math.min(...y) + EPS || Math.max(...y) <= Math.min(...x) + EPS) return false;
    }
    return true;
  }
  for (const [from, against] of [[ap, b], [bp, a]] as const) for (let i = 0; i < 3; i++) {
    const start = from[i]!, end = from[(i + 1) % 3]!, direction = end.clone().sub(start), length = direction.length();
    const hit = new Ray(start, direction.normalize()).intersectTriangle(against.a, against.b, against.c, false, new Vector3());
    if (hit && hit.distanceTo(start) > EPS && hit.distanceTo(start) < length - EPS) return true;
  }
  return false;
}
export function inspectGeometry(meshes: ExportMesh[], pairBudget = 200_000): GeometryReport {
  if (!meshes.length) throw Error('EXPORT_EMPTY_GEOMETRY');
  for (const m of meshes) if (!m.positions.length || m.positions.length % 3 || m.indices.length % 3 || m.positions.some(n => !Number.isFinite(n)) || m.indices.some(n => !Number.isSafeInteger(n) || n < 0 || n >= m.positions.length / 3)) throw Error('EXPORT_INVALID_GEOMETRY');
  const raw = combineMeshes(meshes), m = weldMesh(raw), edgeRows = [...edges(m).values()];
  const bounds = new Box3().setFromArray(m.positions), dimensions = bounds.getSize(new Vector3()).toArray() as [number, number, number];
  const parent = Array.from({ length: m.positions.length / 3 }, (_, i) => i), used = new Set(m.indices);
  const root = (i: number): number => { let n = i; while (parent[n] !== n) { parent[n] = parent[parent[n]!]!; n = parent[n]!; } return n; };
  for (const e of edgeRows) parent[root(e[0]![0])] = root(e[0]![1]);
  const triangles = Array.from({ length: m.indices.length / 3 }, (_, i) => {
    const ids = m.indices.slice(i * 3, i * 3 + 3), triangle = new Triangle(...ids.map(n => point(m, n)) as [Vector3, Vector3, Vector3]);
    return { i, ids, triangle, box: new Box3().setFromPoints([triangle.a, triangle.b, triangle.c]) };
  }).sort((a, b) => a.box.min.x - b.box.min.x);
  let testedPairs = 0, complete = true; const examples: [number, number][] = [];
  outer: for (let i = 0; i < triangles.length; i++) for (let j = i + 1; j < triangles.length; j++) {
    const a = triangles[i]!, b = triangles[j]!;
    if (b.box.min.x > a.box.max.x + EPS) break;
    if (!a.box.intersectsBox(b.box) || a.ids.some(id => b.ids.includes(id))) continue;
    if (testedPairs++ >= pairBudget || examples.length >= 20) { complete = false; break outer; }
    if (intersects(a.triangle, b.triangle)) examples.push([a.i, b.i]);
  }
  const boundaryEdges = edgeRows.filter(e => e.length === 1).length, nonManifoldEdges = edgeRows.filter(e => e.length > 2).length;
  const reversedEdges = edgeRows.filter(e => e.length === 2 && e[0]![0] === e[1]![0]).length;
  const watertight = !boundaryEdges && !nonManifoldEdges && !reversedEdges;
  const signedVolume = triangles.reduce((v, { triangle: t }) => v + t.a.dot(t.b.clone().cross(t.c)) / 6, 0);
  const warnings = ['Maker tolerances, material shrinkage, supports, strength and printer settings have not been verified.', 'STL contains no units or paint; import using millimeters.', 'Topology uses 0.00001 mm seam cells and oriented edge incidence. Vertex-link manifoldness is unverified.', 'Self-intersection testing uses a 0.00001 mm epsilon and omits pairs sharing a vertex; this is not a formal intersection certificate.'];
  if (!watertight) warnings.push('Mesh is not an oriented closed surface. Review the proposed repairs before manufacturing.');
  if (!complete) warnings.push('Self-intersection checking reached its bounded pair/example budget; absence of further intersections is unverified.');
  if (examples.length) warnings.push('Intersecting triangles were found.');
  return { vertices: used.size, triangles: m.indices.length / 3, dimensionsMm: dimensions, boundaryEdges, nonManifoldEdges, reversedEdges, degenerateTriangles: (raw.indices.length - m.indices.length) / 3, watertight, connectedComponents: new Set([...used].map(root)).size,
    selfIntersections: { status: examples.length ? 'found' : complete ? 'clear' : 'not-fully-checked', testedPairs, examples }, signedVolumeMm3: watertight && complete && !examples.length ? signedVolume : null,
    wallThickness: { status: 'not-applicable', requestedMm: null, minimumSampleMm: null, samples: 0, method: 'Solid source; no hollow wall specified.' }, makerTolerances: 'unverified', printerReady: false, warnings };
}
/** Sparse inward-normal rays measure local material crossings, never a minimum-wall certificate. */
export function sampleWallThickness(meshes: ExportMesh[], requestedMm: number, maximum = 128): GeometryReport['wallThickness'] {
  const m = combineMeshes(meshes), geo = new BufferGeometry(); geo.setAttribute('position', new Float32BufferAttribute(m.positions, 3)); geo.setIndex(m.indices);
  const material = new MeshBasicMaterial({ side: DoubleSide }), mesh = new Mesh(geo, material); mesh.updateMatrixWorld();
  const ray = new Raycaster(); let min = Infinity, samples = 0;
  try {
    const step = Math.max(1, Math.ceil(m.indices.length / 3 / maximum));
    for (let i = 0; i < m.indices.length / 3; i += step) {
      const t = new Triangle(...m.indices.slice(i * 3, i * 3 + 3).map(n => point(m, n)) as [Vector3, Vector3, Vector3]);
      const normal = t.getNormal(new Vector3()), origin = t.getMidpoint(new Vector3()).addScaledVector(normal, -0.001);
      ray.set(origin, normal.negate()); ray.near = 0.001;
      const hit = ray.intersectObject(mesh, false)[0];
      if (hit) { min = Math.min(min, hit.distance + 0.001); samples++; }
    }
  } finally { geo.dispose(); material.dispose(); }
  return { status: samples ? 'sampled' : 'unverified', requestedMm, minimumSampleMm: Number.isFinite(min) ? min : null, samples, method: 'At most 128 inward-normal triangle-centroid rays. Sparse local chords, not a global wall-thickness or strength certificate; opening rims may be thinner.' };
}
/** Check selected open line segments against the final serialized geometry, not just CSG cutters. */
export function sampleOpeningClearance(meshes: ExportMesh[], points: Array<[number, number]>, startY: number, endY: number): { samples: number; clear: boolean } {
  const m = combineMeshes(meshes), geo = new BufferGeometry(); geo.setAttribute('position', new Float32BufferAttribute(m.positions, 3)); geo.setIndex(m.indices);
  const material = new MeshBasicMaterial({ side: DoubleSide }), mesh = new Mesh(geo, material); mesh.updateMatrixWorld();
  const ray = new Raycaster(); ray.near = 0.0001; ray.far = Math.abs(endY - startY) - 0.0001;
  try {
    const clear = points.every(([x, z]) => { ray.set(new Vector3(x, startY, z), new Vector3(0, Math.sign(endY - startY), 0)); return ray.intersectObject(mesh, false).length === 0; });
    return { samples: points.length, clear };
  } finally { geo.dispose(); material.dispose(); }
}
