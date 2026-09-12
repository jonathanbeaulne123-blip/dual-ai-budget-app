import type {NestAppearance} from './nestDesignBinding.ts';
import type { KittyPieceV1 } from '../core/types.ts';

/** Export inputs contain a deliberate design copy, never a Household or live goal. */
export type ExportSelection = {
  version: 1; documentId: string; revision: number; piece: KittyPieceV1; appearance?:NestAppearance;
  heightMm: number; construction: 'solid' | 'hollow';
  hollow?: { wallMm: number; coinSlotWidthMm: number; coinSlotDepthMm: number; baseOpeningDiameterMm: number };
};
export type ExportMesh = {
  name: string; positions: number[]; indices: number[]; uv: number[]; material: number;
};
export type ExportMaterial = { name: string; color: [number, number, number, number]; png?: Uint8Array };
export type ExportCapture = {
  meshes: ExportMesh[]; materials: ExportMaterial[];
  crownY: number; baseY: number; crownCenter: [number, number]; baseCenter: [number, number];
  source: 'authored-kitty-sculpture-v1'|'authored-kitty-nest-v1';
};
export type GeometryReport = {
  vertices: number; triangles: number; dimensionsMm: [number, number, number];
  boundaryEdges: number; nonManifoldEdges: number; reversedEdges: number; degenerateTriangles: number;
  watertight: boolean; connectedComponents: number;
  selfIntersections: { status: 'found' | 'clear' | 'not-fully-checked'; testedPairs: number; examples: [number, number][] };
  signedVolumeMm3: number | null;
  wallThickness: { status: 'not-applicable' | 'sampled' | 'unverified'; requestedMm: number | null; minimumSampleMm: number | null; samples: number; method: string };
  makerTolerances: 'unverified'; printerReady: false; warnings: string[];
};
export type RepairProposal = {
  version: 1; digest: string; selectionDigest: string; sourceGeometryDigest: string;
  actions: string[]; omittedMeshes: string[]; cappedMeshes: string[]; blockers: string[];
};
export type ExportManifest = {
  version: 1; documentId: string; designRevision: number; pieceId: string;
  selectionDigest: string; sourceGeometryDigest: string; physicalGeometryDigest: string;
  heightMm: number; construction: 'solid' | 'hollow';
  units: { stl: 'millimeter (unitless file; import as mm)'; threeMf: 'millimeter'; glb: 'meter' };
  sourceGeometry: 'authored-kitty-sculpture-v1'|'authored-kitty-nest-v1'; appearance?:NestAppearance; sourceChanged: false;
  repair: RepairProposal | null; report: GeometryReport;
  openings: import('./exportManufacturing.ts').OpeningEvidence | null;
  files: { name: string; bytes: number; sha256: string }[];
};
export type ExportPackage = { manifest: ExportManifest; files: Map<string, Uint8Array> };

export const jsonBytes = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value, null, 2));
export async function sha256(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer);
  return [...new Uint8Array(hash)].map(n => n.toString(16).padStart(2, '0')).join('');
}
export function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).filter(([, v]) => v !== undefined).map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(',')}}`;
  return JSON.stringify(value);
}
export const digestValue = (value: unknown) => sha256(new TextEncoder().encode(stable(value)));
