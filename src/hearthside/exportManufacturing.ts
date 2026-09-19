import Module, { type Manifold, type ManifoldToplevel } from 'manifold-3d';
import { capMesh, cleanManufacturingMeshes, isPlanar, sampleOpeningClearance } from './exportGeometry.ts';
import type { ExportCapture, ExportMesh, ExportSelection } from './exportTypes.ts';

let kernel: Promise<ManifoldToplevel> | undefined;
/** Supply a same-origin bundled WASM URL in browser integration. Never fetch user-supplied URLs. */
export function loadExportKernel(wasmUrl?: string): Promise<ManifoldToplevel> {
  if (!kernel) kernel = Module(wasmUrl ? { locateFile: () => wasmUrl } : undefined).then(m => { m.setup(); return m; }).catch(error => { kernel = undefined; throw error; });
  return kernel;
}
const positionKey = (p: number[]) => p.map(n => Math.round(n / 1e-5)).join(',');

/** Reconnect topology while preserving property vertices on the original UV seams. */
function propertyMesh(source: ExportMesh, repaired: ExportMesh, kernel: ManifoldToplevel, originalId: number) {
  const faces = new Map<string, Map<string, number[]>>();
  for (let i = 0; i < source.indices.length; i += 3) {
    const ids = source.indices.slice(i, i + 3), keys = ids.map(n => positionKey(source.positions.slice(n * 3, n * 3 + 3)));
    faces.set([...keys].sort().join('|'), new Map(keys.map((key, j) => [key, source.uv.slice(ids[j]! * 2, ids[j]! * 2 + 2)])));
  }
  const properties: number[] = [], indices: number[] = [], mergeFrom: number[] = [], mergeTo: number[] = [], byPosition = new Map<string, number>();
  for (let i = 0; i < repaired.indices.length; i += 3) {
    const ids = repaired.indices.slice(i, i + 3), keys = ids.map(n => positionKey(repaired.positions.slice(n * 3, n * 3 + 3)));
    const old = faces.get([...keys].sort().join('|'));
    for (let j = 0; j < 3; j++) {
      const id = properties.length / 5, p = repaired.positions.slice(ids[j]! * 3, ids[j]! * 3 + 3), key = keys[j]!;
      const uv = old?.get(key) ?? [0.5, 0.5]; properties.push(...p, ...uv); indices.push(id);
      const prior = byPosition.get(key);
      if (prior !== undefined) { mergeFrom.push(id); mergeTo.push(prior); } else byPosition.set(key, id);
    }
  }
  return new kernel.Mesh({ numProp: 5, vertProperties: new Float32Array(properties), triVerts: new Uint32Array(indices), mergeFromVert: new Uint32Array(mergeFrom), mergeToVert: new Uint32Array(mergeTo), runIndex: new Uint32Array([0, indices.length]), runOriginalID: new Uint32Array([originalId]) });
}
export type OpeningEvidence = {
  cavityVolumeMm3: number; sharedConnectedCavity: true; unusedCavityComponents: number;
  coinSlot: { widthMm: number; depthMm: number; measuredCutterMm: [number, number]; intersectsCavity: true; centerRayClear: boolean; sampledClearance: { samples: number; clear: boolean } };
  baseOpening: { diameterMm: number; measuredCutterDiameterMm: number; polygonSegments: number; minimumInscribedDiameterMm: number; intersectsCavity: true; centerRayClear: boolean; sampledClearance: { samples: number; clear: boolean } };
};
/** Only called after the exact repair proposal was explicitly accepted by the host UI. */
export async function manufactureKitty(selection: ExportSelection, capture: ExportCapture, wasmUrl?: string): Promise<{ meshes: ExportMesh[]; openings: OpeningEvidence | null }> {
  const m = await loadExportKernel(wasmUrl), owned = new Set<Manifold>(), materialIds = new Map<number, number>();
  const own = <T extends Manifold>(solid: T): T => { owned.add(solid); return solid; };
  const blankMaterial = capture.materials.length;
  try {
    const solids: Manifold[] = [];
    for (const mesh of capture.meshes) {
      if (isPlanar(mesh)) continue; // explicitly listed in the accepted proposal
      const original = m.Manifold.reserveIDs(1); materialIds.set(original, mesh.material);
      try { solids.push(own(new m.Manifold(propertyMesh(mesh, capMesh(mesh), m, original)))); }
      catch { throw Error(`EXPORT_REPAIR_FAILED:${mesh.name}: Source needs a different reviewed repair.`); }
    }
    if (!solids.length) throw Error('EXPORT_NO_SOLID_PARTS');
    let solid = own(m.Manifold.union(solids));
    if (solid.status() !== 'NoError' || solid.isEmpty()) throw Error('EXPORT_UNION_FAILED');
    let openings: OpeningEvidence | null = null;
    let openingSegments: { slotBottom: number; slotTop: number; baseBottom: number; baseTop: number } | null = null;
    if (selection.construction === 'hollow') {
      const h = selection.hollow!;
      // Erosion by a centered cube contains the requested-radius Euclidean ball.
      // This is a conservative axis-aligned cavity; it is not a claimed uniform offset.
      const inset = own(m.Manifold.cube([2 * h.wallMm, 2 * h.wallMm, 2 * h.wallMm], true));
      let cavity = own(own(solid.minkowskiDifference(inset)).asOriginal());
      materialIds.set(cavity.originalID(), blankMaterial);
      if (cavity.isEmpty() || cavity.status() !== 'NoError') throw Error('EXPORT_CAVITY_EMPTY: Reduce wall size or choose another reviewed design.');
      const inner = cavity.boundingBox(), outer = solid.boundingBox();
      const slotBottom = Math.min(capture.crownY - h.wallMm * 3, inner.max[1] - h.wallMm);
      const slotTop = outer.max[1] + h.wallMm;
      const [slotX, slotZ] = capture.crownCenter, [baseX, baseZ] = capture.baseCenter;
      const slot = own(own(m.Manifold.cube([h.coinSlotWidthMm, slotTop - slotBottom, h.coinSlotDepthMm], true)).translate([slotX, (slotTop + slotBottom) / 2, slotZ]));
      const baseTop = inner.min[1] + 2 * h.wallMm, baseBottom = outer.min[1] - h.wallMm;
      const base = own(own(own(m.Manifold.cylinder(baseTop - baseBottom, h.baseOpeningDiameterMm / 2, h.baseOpeningDiameterMm / 2, 96, false)).rotate([-90, 0, 0])).translate([baseX, baseBottom, baseZ]));
      materialIds.set(slot.originalID(), blankMaterial); materialIds.set(base.originalID(), blankMaterial);
      if (own(slot.intersect(cavity)).volume() <= 1e-6 || own(base.intersect(cavity)).volume() <= 1e-6) throw Error('EXPORT_OPENING_MISSES_CAVITY');
      const cavityParts = cavity.decompose().map(own);
      const connected = cavityParts.find(part => own(slot.intersect(part)).volume() > 1e-6 && own(base.intersect(part)).volume() > 1e-6);
      if (!connected) throw Error('EXPORT_OPENINGS_DO_NOT_SHARE_CAVITY');
      cavity = connected;
      const hollow = own(own(own(solid.subtract(cavity)).subtract(slot)).subtract(base));
      if (hollow.isEmpty() || hollow.status() !== 'NoError') throw Error('EXPORT_HOLLOW_FAILED');
      // Segment queries prove an access line is open across each selected cutter.
      const slotHits = hollow.rayCast([slotX, slotTop, slotZ], [slotX, slotBottom, slotZ]);
      const baseHits = hollow.rayCast([baseX, baseBottom, baseZ], [baseX, baseTop, baseZ]);
      const slotBounds = slot.boundingBox(), baseBounds = base.boundingBox();
      openings = { cavityVolumeMm3: cavity.volume(), sharedConnectedCavity: true, unusedCavityComponents: cavityParts.length - 1, coinSlot: { widthMm: h.coinSlotWidthMm, depthMm: h.coinSlotDepthMm, measuredCutterMm: [slotBounds.max[0] - slotBounds.min[0], slotBounds.max[2] - slotBounds.min[2]], intersectsCavity: true, centerRayClear: slotHits.length === 0, sampledClearance: { samples: 0, clear: false } }, baseOpening: { diameterMm: h.baseOpeningDiameterMm, measuredCutterDiameterMm: baseBounds.max[0] - baseBounds.min[0], polygonSegments: 96, minimumInscribedDiameterMm: h.baseOpeningDiameterMm * Math.cos(Math.PI / 96), intersectsCavity: true, centerRayClear: baseHits.length === 0, sampledClearance: { samples: 0, clear: false } } };
      if (!openings.coinSlot.centerRayClear || !openings.baseOpening.centerRayClear) throw Error('EXPORT_OPENING_OBSTRUCTED');
      solid = hollow;
      openingSegments = { slotBottom, slotTop, baseBottom, baseTop };
    }
    // Explicitly included in the repair review: remove numerical slivers before float32 serialization.
    solid = own(solid.simplify(0.001));
    const output = solid.getMesh(), meshes: ExportMesh[] = [];
    for (let run = 0; run < output.runOriginalID.length; run++) {
      const start = output.runIndex[run]!, end = output.runIndex[run + 1] ?? output.triVerts.length;
      if (end === start) continue;
      const positions: number[] = [], uv: number[] = [], indices: number[] = [], mapping = new Map<number, number>();
      for (let i = start; i < end; i++) {
        const vertex = output.triVerts[i]!; let local = mapping.get(vertex);
        if (local === undefined) {
          local = mapping.size; mapping.set(vertex, local); const offset = vertex * output.numProp;
          positions.push(...Array.from(output.vertProperties.slice(offset, offset + 3))); uv.push(output.vertProperties[offset + 3] ?? 0, output.vertProperties[offset + 4] ?? 0);
        }
        indices.push(local);
      }
      meshes.push({ name: `manufactured-${run}`, material: materialIds.get(output.runOriginalID[run]!) ?? blankMaterial, positions, uv, indices });
    }
    const clean = cleanManufacturingMeshes(meshes);
    if (openings && openingSegments) {
      const h = selection.hollow!, [sx, sz] = capture.crownCenter, [bx, bz] = capture.baseCenter;
      const slotPoints: Array<[number, number]> = [-0.49, 0, 0.49].flatMap(x => [-0.49, 0, 0.49].map(z => [sx + x * h.coinSlotWidthMm, sz + z * h.coinSlotDepthMm] as [number, number]));
      const basePoints: Array<[number, number]> = [[bx, bz], ...Array.from({ length: 16 }, (_, i) => [bx + Math.cos(i * Math.PI / 8) * h.baseOpeningDiameterMm * 0.48, bz + Math.sin(i * Math.PI / 8) * h.baseOpeningDiameterMm * 0.48] as [number, number])];
      openings.coinSlot.sampledClearance = sampleOpeningClearance(clean, slotPoints, openingSegments.slotTop, openingSegments.slotBottom);
      openings.baseOpening.sampledClearance = sampleOpeningClearance(clean, basePoints, openingSegments.baseBottom, openingSegments.baseTop);
      if (!openings.coinSlot.sampledClearance.clear || !openings.baseOpening.sampledClearance.clear) throw Error('EXPORT_SERIALIZED_OPENING_OBSTRUCTED');
    }
    return { meshes: clean, openings };
  } finally { for (const object of owned) object.delete(); }
}
