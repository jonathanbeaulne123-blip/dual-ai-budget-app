import type { DesignReference, MediaReference, MemoryComposition } from './contracts.ts';
import type { ThemeId } from '../theme/scenes.ts';

export type ProjectorLoadScope = { memoryId: string; memoryRevision: number; scopeKey: string; signal: AbortSignal };
export type ProjectorPublication = { id: string; revision: number; manifestDigest: string };
export type ProjectorMediaResult =
  | { status: 'available'; reference: MediaReference; publication: ProjectorPublication; blob: Blob }
  | { status: 'unavailable' | 'withdrawn' };
export type ProjectorDesignResult =
  | { status: 'available'; reference: DesignReference; blob: Blob; rendering: 'authored-flat' | 'authored-sculpture' }
  | { status: 'unavailable' | 'withdrawn' };
export type ProjectorAmountSnapshot = {
  memoryId: string; memoryRevision: number; amountCents: number; currency: 'CAD';
  asOf: string; provenance: string;
};
export type ProjectorLoaders = {
  resolveMedia: (reference: MediaReference, scope: ProjectorLoadScope) => Promise<ProjectorMediaResult>;
  loadDesignSnapshot: (reference: DesignReference, scope: ProjectorLoadScope) => Promise<ProjectorDesignResult>;
};
export type ProjectorOptions = { theme: ThemeId; secondsPerPage: number; showAmounts: boolean; amountSnapshots?: ProjectorAmountSnapshot[]; authorLabels?: Record<string, string> };
export type ProjectorSelection = { version: 1; memories: MemoryComposition[]; activeMemberIds: string[]; options: ProjectorOptions };
export type ProjectorAsset = {
  key: string; memoryId: string; memoryRevision: number; kind: 'image' | 'audio' | 'design';
  reference: MediaReference | DesignReference; status: 'available' | 'unavailable' | 'withdrawn';
  blob?: Blob; sha256?: string; publication?: ProjectorPublication; rendering?: 'authored-flat' | 'authored-sculpture';
};
export type PreparedProjector = { selection: ProjectorSelection; assets: ProjectorAsset[] };
export type ProjectorFile = { blob: Blob; filename: string; kind: 'film' | 'story'; mimeType: string };
export type ProjectorGuard = { signal: AbortSignal; isCurrent: () => boolean };

export type ProjectorDownloadProof = {
  version: 1;
  memories: { id: string; revision: number; sha256: string }[];
  assets: Omit<ProjectorAsset, 'blob'>[];
};
export type ProjectorDownloadValidator = (proof: ProjectorDownloadProof, context: { scopeKey: string; signal: AbortSignal }) => Promise<boolean>;
