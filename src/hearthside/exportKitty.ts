import {decodeNestAppearance} from './nestDesignBinding.ts';
import { shapeKittyPiece } from '../core/kittyStudio.ts';
import { captureAuthoredKitty } from './exportCapture.ts';
import { capMesh, inspectGeometry, isPlanar, sampleWallThickness, weldMesh } from './exportGeometry.ts';
import { manufactureKitty } from './exportManufacturing.ts';
import { writeStl } from './exportStl.ts';
import { writeGlb } from './exportGlb.ts';
import { writeThreeMf, zipExportFiles } from './exportThreeMf.ts';
import { writeExportPdf } from './exportPdf.ts';
import { digestValue, jsonBytes, sha256, type ExportCapture, type ExportManifest, type ExportPackage, type ExportSelection, type RepairProposal } from './exportTypes.ts';
export type { ExportSelection, ExportPackage, ExportManifest, RepairProposal } from './exportTypes.ts';
export { zipExportFiles };

function plain(value: unknown, depth = 0, allowBytes = false): void {
  if (depth > 18) throw Error('EXPORT_INPUT_TOO_DEEP');
  if (value === null || ['string', 'boolean', 'undefined'].includes(typeof value)) return;
  if (typeof value === 'number') { if (!Number.isFinite(value)) throw Error('EXPORT_INVALID_NUMBER'); return; }
  if (typeof value !== 'object') throw Error('EXPORT_INVALID_INPUT');
  const proto = Object.getPrototypeOf(value);
  if (allowBytes && proto === Uint8Array.prototype) return;
  if (Array.isArray(value) ? proto !== Array.prototype : proto !== Object.prototype && proto !== null) throw Error('EXPORT_INVALID_INPUT');
  for (const key of Reflect.ownKeys(value)) {
    if (Array.isArray(value) && key === 'length') continue;
    const desc = Object.getOwnPropertyDescriptor(value, key)!;
    if (typeof key !== 'string' || ['__proto__', 'prototype', 'constructor'].includes(key) || !desc.enumerable || !('value' in desc) || Array.isArray(value) && !/^(0|[1-9]\d*)$/.test(key)) throw Error('EXPORT_INVALID_INPUT');
    plain(desc.value, depth + 1, allowBytes);
  }
  if (Array.isArray(value) && Object.keys(value).length !== value.length) throw Error('EXPORT_SPARSE_INPUT');
}
export function normalizeExportSelection(value: ExportSelection): ExportSelection {
  plain(value);
  if (!value || value.version !== 1 || Object.keys(value).some(k => !['version', 'documentId', 'revision', 'piece', 'heightMm', 'construction', 'hollow', 'appearance', 'manufacturingProfile'].includes(k)) || typeof value.documentId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/.test(value.documentId) || !Number.isSafeInteger(value.revision) || value.revision < 0 || !['solid', 'hollow'].includes(value.construction)) throw Error('EXPORT_INVALID_SELECTION');
  if (!Number.isFinite(value.heightMm) || value.heightMm < 30 || value.heightMm > 1000) throw Error('EXPORT_HEIGHT_RANGE_30_1000_MM');
  if (value.manufacturingProfile !== undefined && (typeof value.manufacturingProfile !== 'string' || !value.manufacturingProfile.trim() || value.manufacturingProfile.length > 300 || /[^\x20-\x7e]/.test(value.manufacturingProfile))) throw Error('EXPORT_INVALID_MANUFACTURING_PROFILE');
  if (jsonBytes(value).length > 256 * 1024) throw Error('EXPORT_DESIGN_TOO_LARGE');
  const result: ExportSelection = { version: 1, documentId: value.documentId, revision: value.revision, piece: shapeKittyPiece(value.piece), heightMm: value.heightMm, construction: value.construction };
  if(value.appearance!==undefined)result.appearance=decodeNestAppearance(value.appearance);
  if(value.manufacturingProfile!==undefined)result.manufacturingProfile=value.manufacturingProfile;
  delete result.piece.firedBy; // An internal household actor identifier is not needed for geometry or paint.
  if (value.construction === 'hollow') {
    const h = value.hollow;
    if (!h || Object.keys(h).length !== 4 || Object.keys(h).some(k => !['wallMm', 'coinSlotWidthMm', 'coinSlotDepthMm', 'baseOpeningDiameterMm'].includes(k)) || Object.values(h).some(n => typeof n !== 'number' || !Number.isFinite(n) || n <= 0) || h.wallMm < 0.5 || h.wallMm > 20 || h.coinSlotWidthMm > value.heightMm / 2 || h.coinSlotDepthMm > value.heightMm / 4 || h.baseOpeningDiameterMm > value.heightMm / 2) throw Error('EXPORT_INVALID_HOLLOW_DIMENSIONS');
    result.hollow = { ...h };
  } else if (value.hollow !== undefined) throw Error('EXPORT_HOLLOW_OPTIONS_ON_SOLID');
  return structuredClone(result);
}
async function captureDigest(capture: ExportCapture): Promise<string> {
  return digestValue({ source: capture.source, crownY: capture.crownY, baseY: capture.baseY, crownCenter: capture.crownCenter, baseCenter: capture.baseCenter, meshes: capture.meshes, materials: await Promise.all(capture.materials.map(async m => ({ name: m.name, color: m.color, ...(m.png ? { pngSha256: await sha256(m.png) } : {}) }))) });
}
export type PreparedKittyExport = {
  selection: ExportSelection; capture: ExportCapture; selectionDigest: string; sourceGeometryDigest: string;
  report: ReturnType<typeof inspectGeometry>; proposal: RepairProposal;
};
async function repairProposal(selection: ExportSelection, capture: ExportCapture, selectionDigest: string, sourceGeometryDigest: string): Promise<RepairProposal> {
  const omittedMeshes = capture.meshes.filter(isPlanar).map(m => m.name), cappedMeshes: string[] = [], blockers: string[] = [];
  for (const mesh of capture.meshes.filter(m => !isPlanar(m))) {
    try { if (capMesh(mesh).indices.length > weldMesh(mesh).indices.length) cappedMeshes.push(mesh.name); }
    catch (error) { blockers.push(error instanceof Error ? error.message : `EXPORT_REPAIR_UNSUPPORTED:${mesh.name}`); }
  }
  const details = { version: 1 as const, selectionDigest, sourceGeometryDigest, actions: ['Weld seam vertices sharing a 0.00001 mm quantization cell and remove triangles below 0.0000000001 square mm; repeat after float32 conversion while preserving UV seams.', 'Omit the listed zero-thickness decorative surfaces from the manufacturing derivative.', 'Cap the listed planar tube boundary loops with flat triangles.', 'Boolean-union intersecting solid parts; retain disconnected solids and report them.', ...(selection.construction === 'hollow' ? [`Erode a cavity with an axis-aligned cube of half-size ${selection.hollow!.wallMm} mm; use only the connected cavity reached by both the selected coin slot and base opening; subtract it and those openings. Other cavity components stay solid. New cut surfaces use neutral clay color.`] : []), 'Simplify numerical slivers with a maximum 0.001 mm surface tolerance before float32 serialization.'], omittedMeshes, cappedMeshes };
  const proposal = { ...details, blockers };
  return { ...proposal, digest: await digestValue(proposal) };
}
/** Optional capture is the transferable result of captureAuthoredKitty, for a dedicated export worker. */
export async function prepareKittyExport(input: ExportSelection, captured?: ExportCapture): Promise<PreparedKittyExport> {
  if (captured) plain(captured, 0, true);
  const selection = normalizeExportSelection(input), capture = structuredClone(captured ?? captureAuthoredKitty(selection));
  if (capture.source !== (selection.appearance?'authored-kitty-nest-v1':'authored-kitty-sculpture-v1') || !Number.isFinite(capture.crownY) || !Number.isFinite(capture.baseY) || [capture.crownCenter, capture.baseCenter].some(p => !Array.isArray(p) || p.length !== 2 || p.some(n => !Number.isFinite(n))) || !capture.materials.length || capture.materials.length > 300 || capture.meshes.length > 300 || capture.meshes.reduce((n, m) => n + m.indices.length, 0) > 1_500_000 || capture.meshes.reduce((n, m) => n + m.positions.length, 0) > 4_500_000) throw Error('EXPORT_INVALID_CAPTURE');
  for (const mesh of capture.meshes) if (!Number.isSafeInteger(mesh.material) || !capture.materials[mesh.material] || mesh.uv.length !== mesh.positions.length / 3 * 2 || mesh.uv.some(v => !Number.isFinite(v))) throw Error('EXPORT_INVALID_MATERIAL_BINDING');
  for (const m of capture.materials) if (m.color.length !== 4 || m.color.some(n => !Number.isFinite(n) || n < 0 || n > 1) || m.png && (m.png.length > 8 * 1024 * 1024 || ![137,80,78,71,13,10,26,10].every((n, i) => m.png![i] === n))) throw Error('EXPORT_INVALID_MATERIAL');
  const report = inspectGeometry(capture.meshes);
  if (Math.abs(report.dimensionsMm[1] - selection.heightMm) > 0.01) throw Error('EXPORT_CAPTURE_HEIGHT_MISMATCH');
  const selectionDigest = await digestValue(selection), sourceGeometryDigest = await captureDigest(capture);
  const proposal = await repairProposal(selection, capture, selectionDigest, sourceGeometryDigest);
  return { selection, capture, selectionDigest, sourceGeometryDigest, report, proposal };
}
function freeze<T>(value: T): T { if (value && typeof value === 'object') { Object.freeze(value); for (const child of Object.values(value)) freeze(child); } return value; }
/** No implicit repair. The host must display proposal + source preview and pass its exact digest on approval. */
export async function finishKittyExport(prepared: PreparedKittyExport, options: { approvedRepairDigest?: string; wasmUrl?: string } = {}): Promise<ExportPackage> {
  plain(prepared, 0, true);
  const selection = normalizeExportSelection(prepared.selection), capture = structuredClone(prepared.capture);
  if (await digestValue(selection) !== prepared.selectionDigest || await captureDigest(capture) !== prepared.sourceGeometryDigest) throw Error('EXPORT_SELECTION_CHANGED');
  const { digest, ...proposalFacts } = prepared.proposal;
  if (digest !== await digestValue(proposalFacts) || digest !== (await repairProposal(selection, capture, prepared.selectionDigest, prepared.sourceGeometryDigest)).digest) throw Error('EXPORT_PROPOSAL_CHANGED');
  const approved = options.approvedRepairDigest !== undefined;
  if (approved && options.approvedRepairDigest !== digest) throw Error('EXPORT_REPAIR_REVIEW_CHANGED');
  if (approved && prepared.proposal.blockers.length) throw Error('EXPORT_REPAIR_UNSUPPORTED');
  if (selection.construction === 'hollow' && !approved) throw Error('EXPORT_HOLLOW_REVIEW_REQUIRED');
  const derived = approved ? await manufactureKitty(selection, capture, options.wasmUrl) : { meshes: capture.meshes, openings: null };
  const materials = [...capture.materials, { name: 'unpainted-cut-clay', color: [0.82, 0.76, 0.66, 1] as [number, number, number, number] }];
  const report = inspectGeometry(derived.meshes);
  if (approved && (!report.watertight || report.degenerateTriangles || report.selfIntersections.status === 'found')) throw Error(`EXPORT_DERIVATIVE_GEOMETRY_FAILED:${JSON.stringify(report)}`);
  if (selection.construction === 'hollow') report.wallThickness = sampleWallThickness(derived.meshes, selection.hollow!.wallMm);
  if (report.connectedComponents > 1) report.warnings.push(`${report.connectedComponents} disconnected solid components remain; attachment and manufacturing require review.`);
  if (!approved) report.warnings.push('3MF object type is other: source-exact reference geometry, not an assertion of manifold manufacturing geometry.');
  const files = new Map<string, Uint8Array>();
  files.set('kitty.stl', writeStl(derived.meshes)); files.set('kitty.3mf', writeThreeMf(derived.meshes, materials, selection.piece.id, approved));
  files.set('kitty.glb', writeGlb(derived.meshes, materials, selection.piece.id));
  if (approved) files.set('source-authored.glb', writeGlb(capture.meshes, capture.materials, selection.piece.id));
  files.set('paint/source-paint.json', jsonBytes(selection.piece.paint));
  for (const [i, material] of capture.materials.entries()) if (material.png) files.set(`paint/material-${i}.png`, new Uint8Array(material.png));
  files.set('source-design.json', jsonBytes({ documentId: selection.documentId, revision: selection.revision, piece: selection.piece, ...(selection.appearance?{appearance:selection.appearance}:{}), ...(selection.manufacturingProfile!==undefined?{manufacturingProfile:selection.manufacturingProfile}:{}) }));
  if (selection.manufacturingProfile !== undefined) files.set('manufacturing-profile.txt', new TextEncoder().encode(selection.manufacturingProfile));
  files.set('geometry-report.json', jsonBytes({ ...report, openings: derived.openings, sourceReport: approved ? inspectGeometry(capture.meshes) : report }));
  const profile = selection.manufacturingProfile;
  const profileSheet = profile === undefined ? [] : [
    ...Array.from({ length: Math.ceil(profile.length / 48) }, (_, index) => `${index ? 'Manufacturing profile (continued):' : 'Manufacturing profile (reference only):'} ${profile.slice(index * 48, (index + 1) * 48)}`),
    'The supplied profile does not verify maker tolerances, strength, fit, shrinkage or printer settings.',
  ];
  const sheet = ['Hearthside - geometry and paint reference', `Piece: ${selection.piece.id} / revision ${selection.revision}`, `Requested authored height: ${selection.heightMm} mm`, `Construction: ${selection.construction}; reviewed repair: ${approved ? 'yes' : 'no'}`, ...profileSheet, `Measured X/Y/Z mm: ${report.dimensionsMm.map(n => n.toFixed(3)).join(' / ')}`, `Triangles: ${report.triangles}; components: ${report.connectedComponents}`, `Watertight: ${report.watertight}; self intersections: ${report.selfIntersections.status}`, `Wall check: ${report.wallThickness.status}; sampled minimum: ${report.wallThickness.minimumSampleMm?.toFixed(3) ?? 'not measured'} mm`, 'STL: mm import, Z-up. 3MF: explicit mm, Z-up. GLB: meters, Y-up.', 'Paint: embedded PNGs + source stroke/stamp JSON. No color in STL.', 'Maker tolerances, strength, fit and material shrinkage: UNVERIFIED.', ...report.warnings];
  if (derived.openings) sheet.splice(9, 0, `Coin slot: ${derived.openings.coinSlot.widthMm} x ${derived.openings.coinSlot.depthMm} mm; access ray clear.`, `Base opening: ${derived.openings.baseOpening.diameterMm} mm diameter; access ray clear.`);
  files.set('geometry-sheet.pdf', writeExportPdf(sheet, report.dimensionsMm));
  const manifest: ExportManifest = { version: 1, documentId: selection.documentId, designRevision: selection.revision, pieceId: selection.piece.id, selectionDigest: prepared.selectionDigest, sourceGeometryDigest: prepared.sourceGeometryDigest, physicalGeometryDigest: await digestValue(derived.meshes), heightMm: selection.heightMm, construction: selection.construction, ...(selection.manufacturingProfile!==undefined?{manufacturingProfile:selection.manufacturingProfile}:{}), units: { stl: 'millimeter (unitless file; import as mm)', threeMf: 'millimeter', glb: 'meter' }, sourceGeometry: capture.source, ...(selection.appearance?{appearance:selection.appearance}:{}), sourceChanged: false, repair: approved ? structuredClone(prepared.proposal) : null, report, openings: derived.openings, files: await Promise.all([...files].map(async ([name, data]) => ({ name, bytes: data.length, sha256: await sha256(data) }))) };
  files.set('manifest.json', jsonBytes(manifest));
  return { manifest: freeze(manifest), files };
}
