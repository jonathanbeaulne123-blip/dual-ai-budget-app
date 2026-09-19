import {decodeWinProvenance} from './winMemoryProvenance.ts';
import type { MemoryComposition } from './contracts.ts';
import { vaultAssert, vaultDigest, vaultId, vaultInteger, vaultObject } from './vaultContracts.ts';

/** Shared metadata contains only the reviewed copy identity, never private lineage. */
export type MemoryPublicationBinding = {
  version: 1; publicationId: string; publicationDigest: string;
  memoryId: string; memoryRevision: number; compositionDigest: string;
};
export type MemoryPublicationComposition = Pick<MemoryComposition,
  'version' | 'id' | 'revision' | 'title' | 'date' | 'experienceId' | 'media' | 'designs' | 'recollections' | 'hideAmounts' | 'legacySource'>;
export type MemoryPublicationCandidate = MemoryComposition & { publication?: MemoryPublicationBinding };
export type VaultMemoryReview = {
  expectedRevision: number; composition: MemoryPublicationComposition; compositionDigest: string;
};
export type VaultMemoryCandidateValidation = { candidate: MemoryPublicationCandidate; compositionDigest: string };
export type VaultMemoryEvidence = { binding: MemoryPublicationBinding; approvedMemberId: string | null; mediaIds: string[] };
export type VaultMemoryAuthorReview = {
  version: 1; id: string; ownerMemberId: string; recipientMemberIds: string[];
  digest: string; state: 'prepared' | 'accepted' | 'active' | 'revoked';
  memory: VaultMemoryReview; binding: MemoryPublicationBinding; approvedMemberIds: string[];
  media: { id: string; contentType: string; byteLength: number; sha256: string }[];
};

export function decodeMemoryPublicationBinding(value: unknown): MemoryPublicationBinding {
  const v = vaultObject(value, ['version', 'publicationId', 'publicationDigest', 'memoryId', 'memoryRevision', 'compositionDigest']);
  vaultAssert(v.version === 1 && typeof v.memoryId === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/.test(v.memoryId) &&
    !['__proto__', 'constructor', 'prototype'].includes(v.memoryId), 'INVALID_MEMORY_BINDING');
  vaultAssert(typeof v.publicationDigest === 'string' && /^[a-f0-9]{64}$/.test(v.publicationDigest) &&
    typeof v.compositionDigest === 'string' && /^[a-f0-9]{64}$/.test(v.compositionDigest), 'INVALID_MEMORY_BINDING');
  return { version: 1, publicationId: vaultId(v.publicationId), publicationDigest: v.publicationDigest,
    memoryId: v.memoryId, memoryRevision: vaultInteger(v.memoryRevision, 1), compositionDigest: v.compositionDigest };
}

/** Callers decode the MemoryComposition first; all authored presentation is hashed. */
export function memoryPublicationProjection(memory: MemoryPublicationComposition): MemoryPublicationComposition {
  return { version: memory.version, id: memory.id, revision: memory.revision, title: memory.title, date: memory.date,
    experienceId: memory.experienceId,
    media: memory.media.map(m => ({ version: m.version, contentId: m.contentId, revision: m.revision, kind: m.kind, alt: m.alt })),
    designs: memory.designs.map(d => ({ version: d.version, documentId: d.documentId, pieceId: d.pieceId, revision: d.revision })),
    recollections: memory.recollections.map(r => ({ memberId: r.memberId, text: r.text })).sort((a, b) => a.memberId.localeCompare(b.memberId)),
    hideAmounts: memory.hideAmounts, ...(memory.legacySource?{legacySource:decodeWinProvenance(memory.legacySource)}:{}) };
}
export function memoryCompositionDigest(memory: MemoryPublicationComposition): Promise<string> {
  return vaultDigest(memoryPublicationProjection(memory));
}
export function memoryPublicationBinding(publicationId: string, publicationDigest: string, review: VaultMemoryReview): MemoryPublicationBinding {
  return decodeMemoryPublicationBinding({ version: 1, publicationId, publicationDigest, memoryId: review.composition.id,
    memoryRevision: review.composition.revision, compositionDigest: review.compositionDigest });
}
