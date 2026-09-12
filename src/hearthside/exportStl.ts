import { Triangle, Vector3 } from 'three';
import type { ExportMesh } from './exportTypes.ts';

/** Binary STL: physical mm coordinates, Z-up; STL itself encodes neither units nor paint. */
export function writeStl(meshes: ExportMesh[]): Uint8Array {
  const count = meshes.reduce((n, m) => n + m.indices.length / 3, 0), out = new Uint8Array(84 + count * 50), view = new DataView(out.buffer);
  out.set(new TextEncoder().encode('Hearthside | millimeters | Z-up | read geometry-report.json').slice(0, 80));
  view.setUint32(80, count, true);
  let offset = 84;
  for (const m of meshes) for (let i = 0; i < m.indices.length; i += 3) {
    const vertices = m.indices.slice(i, i + 3).map(n => new Vector3(m.positions[n * 3]!, -m.positions[n * 3 + 2]!, m.positions[n * 3 + 1]!));
    const normal = new Triangle(...vertices as [Vector3, Vector3, Vector3]).getNormal(new Vector3());
    for (const v of [normal, ...vertices]) for (const n of v.toArray()) { view.setFloat32(offset, n, true); offset += 4; }
    view.setUint16(offset, 0, true); offset += 2;
  }
  return out;
}
