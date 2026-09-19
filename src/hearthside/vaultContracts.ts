/** Private content contracts. These records never belong in a Household snapshot. */
import type { MemoryPublicationBinding, VaultMemoryReview } from './memoryPublication.ts';
export const VAULT_VERSION = 1 as const;
export const VAULT_TEXT_LIMIT = 24_000;
export const VAULT_REQUEST_LIMIT = 64 * 1024;
export const VAULT_MEDIA_LIMIT = 16 * 1024 * 1024;
export type VaultPrincipal = { memberId: string; subject: string };
export type VaultScope = VaultPrincipal & {
  environment: 'development' | 'production'; householdId: string; expires: number;
};
export type VaultContent = { title: string; text: string; mediaIds: string[] };
export type VaultDraft = {
  version: 1; id: string; revision: number; owner: VaultPrincipal;
  content: VaultContent; updatedAt: number; deletedAt?: number;
};
export type VaultMedia = {
  version: 1; id: string; owner: VaultPrincipal; sha256: string; byteLength: number;
  contentType: 'image/jpeg' | 'image/png' | 'audio/webm' | 'audio/mp4' | 'audio/ogg';
  status: 'pending' | 'uploaded' | 'deleted'; createdAt: number; uploadedAt: number | null;
  /** Private copy provenance; all reviewed/disclosed projections omit this. */
  copySource?: { mediaId: string; publicationId: string | null };
};
export type VaultPublicationKind = 'letter' | 'capsule' | 'answer' | 'shared-memory' | 'guest';
export type VaultPublicationInput = {
  id: string; draftId: string; draftRevision: number; kind: VaultPublicationKind;
  recipientMemberIds: string[]; releaseAt: number | null;
};
/** Policy comes from authenticated membership/consent authority, never the HTTP body. */
export type VaultAudiencePolicy = { recipients: VaultPrincipal[]; approvers: VaultPrincipal[] };
export type VaultReference = {
  version: 1; publicationId: string; digest: string; kind: VaultPublicationKind;
  environment: VaultScope['environment']; householdId: string;
  memory?: MemoryPublicationBinding;
};
export type VaultAcceptance = VaultReference & { receiptId: string; acceptedAt: number };
export type VaultPublication = {
  version: 1; id: string; owner: VaultPrincipal; draftId: string; draftRevision: number;
  kind: VaultPublicationKind; content: VaultContent; media: VaultMedia[];
  recipients: VaultPrincipal[]; approvers: VaultPrincipal[];
  releaseAt: number | null; digest: string; preparedAt: number;
  approvals: { principal: VaultPrincipal; digest: string; approvedAt: number }[];
  state: 'prepared' | 'accepted' | 'active' | 'revoked';
  acceptance: VaultAcceptance | null; activatedAt: number | null; revokedAt: number | null;
  memory?: VaultMemoryReview;
};
/** No captions, recipients, amounts, bytes, media paths, or capability URLs. */
export type VaultPublicationReceipt = VaultReference & {
  state: VaultPublication['state']; acceptedReceiptId: string | null;
  preparedAt: number; activatedAt: number | null; revokedAt: number | null;
};
/** Private inbox metadata, never included in the household publication reference. */
export type VaultMailCard = {
  id: string; kind: VaultPublicationKind; state: VaultPublication['state']; title: string | null;
  ownerMemberId: string; recipientMemberIds: string[]; role: 'sent' | 'received';
  releaseAt: number | null; preparedAt: number; sealed: boolean;
};
/** The author reviews immutable content without receiving other authentication subjects. */
export type VaultAuthorReview = Pick<VaultPublication, 'version' | 'id' | 'draftId' | 'draftRevision' | 'kind' | 'content' | 'releaseAt' | 'digest' | 'state'> & {
  ownerMemberId: string; recipientMemberIds: string[];
  media: Pick<VaultMedia, 'id' | 'contentType' | 'byteLength' | 'sha256'>[];
};
export function vaultAuthorReview(p: VaultPublication): VaultAuthorReview {
  return { version: p.version, id: p.id, draftId: p.draftId, draftRevision: p.draftRevision,
    ownerMemberId: p.owner.memberId, kind: p.kind, content: p.content,
    media: p.media.map(({ id, contentType, byteLength, sha256 }) => ({ id, contentType, byteLength, sha256 })),
    recipientMemberIds: p.recipients.map(person => person.memberId), releaseAt: p.releaseAt, digest: p.digest, state: p.state };
}
export class VaultError extends Error {
  constructor(readonly code: string) { super(code); this.name = 'VaultError'; }
}
export function vaultAssert(condition: unknown, code: string): asserts condition {
  if (!condition) throw new VaultError(code);
}
export function vaultId(value: unknown): string {
  vaultAssert(typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/.test(value), 'INVALID_ID');
  return value;
}
export function vaultObject(value: unknown, keys: string[]): Record<string, unknown> {
  vaultAssert(value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype && Object.keys(value).every(k => keys.includes(k)), 'INVALID_INPUT');
  return value as Record<string, unknown>;
}
export function vaultInteger(value: unknown, minimum = 0): number {
  vaultAssert(typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum, 'INVALID_NUMBER');
  return value;
}
export function vaultContent(value: unknown): VaultContent {
  const v = vaultObject(value, ['title', 'text', 'mediaIds']);
  vaultAssert(typeof v.title === 'string' && v.title.length <= 180 && typeof v.text === 'string' &&
    v.text.length <= VAULT_TEXT_LIMIT && !/[\u0000]/.test(v.title + v.text), 'INVALID_TEXT');
  vaultAssert(Array.isArray(v.mediaIds) && v.mediaIds.length <= 12, 'INVALID_MEDIA');
  const mediaIds = v.mediaIds.map(vaultId);
  vaultAssert(new Set(mediaIds).size === mediaIds.length, 'INVALID_MEDIA');
  return { title: v.title, text: v.text, mediaIds };
}
export function vaultPublicationInput(value: unknown): VaultPublicationInput {
  const v = vaultObject(value, ['id', 'draftId', 'draftRevision', 'kind', 'recipientMemberIds', 'releaseAt']);
  vaultAssert(['letter', 'capsule', 'answer', 'shared-memory', 'guest'].includes(String(v.kind)), 'INVALID_KIND');
  vaultAssert(Array.isArray(v.recipientMemberIds) && v.recipientMemberIds.length > 0 && v.recipientMemberIds.length <= 16, 'INVALID_AUDIENCE');
  const recipientMemberIds = v.recipientMemberIds.map(vaultId).sort();
  vaultAssert(new Set(recipientMemberIds).size === recipientMemberIds.length, 'INVALID_AUDIENCE');
  vaultAssert(v.releaseAt === null || v.kind === 'capsule', 'INVALID_RELEASE');
  vaultAssert(v.kind !== 'capsule' || v.releaseAt !== null, 'INVALID_RELEASE');
  return { id: vaultId(v.id), draftId: vaultId(v.draftId), draftRevision: vaultInteger(v.draftRevision, 1),
    kind: v.kind as VaultPublicationKind, recipientMemberIds, releaseAt: v.releaseAt === null ? null : vaultInteger(v.releaseAt, 1) };
}
export function vaultPrincipalEqual(a: VaultPrincipal, b: VaultPrincipal): boolean {
  return a.memberId === b.memberId && a.subject === b.subject;
}
export function vaultPrincipals(values: VaultPrincipal[]): VaultPrincipal[] {
  vaultAssert(Array.isArray(values) && values.length > 0 && values.length <= 16, 'INVALID_AUDIENCE');
  const result = values.map(p => {
    const v = vaultObject(p, ['memberId', 'subject']);
    vaultAssert(typeof v.subject === 'string' && v.subject.length > 0 && v.subject.length <= 256, 'INVALID_AUDIENCE');
    return { memberId: vaultId(v.memberId), subject: v.subject };
  }).sort((a, b) => a.memberId.localeCompare(b.memberId));
  vaultAssert(new Set(result.map(p => p.memberId)).size === result.length, 'INVALID_AUDIENCE');
  return result;
}
export async function vaultDigest(value: unknown): Promise<string> {
  // The payloads here are explicitly constructed with deterministic field order.
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
}
