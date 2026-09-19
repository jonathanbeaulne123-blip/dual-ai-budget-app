import { DurableObject } from 'cloudflare:workers';
import type { DurableObjectId, DurableObjectState, R2Bucket, R2ObjectBody } from '@cloudflare/workers-types';
import { authorizeRequest, type AuthEnv } from './ledgerSyncAuth.ts';
import type { Scope } from '../src/ledgerSync/protocol.ts';
import { HearthsideVaultEncounters, type VaultEncounterContext, type EncounterPrivateView } from './hearthsideVaultEncounters.ts';
import { VaultEncounterAdapter } from './hearthsideVaultEncounterAdapter.ts';
import type { EncounterRevealBinding } from '../src/hearthside/encounterContracts.ts';
import { HearthsideVaultStore } from './hearthsideVaultStore.ts';
import { HearthsideVaultArchive, VaultJournalStorage } from './hearthsideVaultArchive.ts';
import { createVaultPublicationAuthority, type VaultAudienceEnv } from './hearthsideVaultAudience.ts';
import { memoryCompositionDigest, memoryPublicationBinding, memoryPublicationProjection,
  type MemoryPublicationBinding, type MemoryPublicationCandidate, type VaultMemoryCandidateValidation } from '../src/hearthside/memoryPublication.ts';
import {
  VAULT_MEDIA_LIMIT, VAULT_REQUEST_LIMIT, VaultError, vaultAssert, vaultId, vaultObject,
  vaultPublicationInput, vaultPrincipals, vaultAuthorReview, vaultInteger, type VaultAcceptance, type VaultAudiencePolicy, type VaultMedia,
  type VaultPublication, type VaultPublicationInput, type VaultReference, type VaultScope,
} from '../src/hearthside/vaultContracts.ts';

/** Server-only capability. Implement with canonical roster and exact publication receipts. */
export interface VaultPublicationAuthority {
  policy(scope: Scope, input: VaultPublicationInput, authorization?: string): Promise<VaultAudiencePolicy>;
  accept(scope: Scope, reference: VaultReference, authorization?: string): Promise<VaultAcceptance>;
  isReferenced(scope: Scope, mediaId: string): Promise<boolean>;
}
export interface VaultMemoryAuthority {
  validateVaultMemoryCandidate(scope: Scope, candidate: unknown, expectedRevision: number): Promise<VaultMemoryCandidateValidation>;
  vaultMemoryAccess(scope: Scope, binding: MemoryPublicationBinding, mediaId: string | null): Promise<{ current: boolean; kept: boolean }>;
}
/** Narrow structural RPC contract avoids importing the LedgerRoom runtime. */
type VaultReferenceRoom = VaultMemoryAuthority & {
  vaultEncounterContext(scope: Scope, id: string): Promise<VaultEncounterContext>;
  acceptVaultPublication(scope: Scope, reference: VaultReference): Promise<VaultAcceptance>;
  vaultMediaReferenced(scope: Scope, mediaId: string): Promise<boolean>;
};
type VaultBindings = Partial<VaultAudienceEnv> & {
  HEARTHSIDE_VAULT_MEDIA?: R2Bucket;
  HEARTHSIDE_VAULT_ARCHIVE?: R2Bucket;
  HEARTHSIDE_VAULT_AUTHORITY?: VaultPublicationAuthority;
  HEARTHSIDE_MEMORY_AUTHORITY?: VaultMemoryAuthority;
  LEDGER_ROOMS?: { idFromName(name: string): DurableObjectId; get(id: DurableObjectId): VaultReferenceRoom };
};
/** Optional by design: no binding/migration/activation is added by this package. */
export type HearthsideVaultEnv = AuthEnv & VaultBindings & {
  HEARTHSIDE_VAULT_ENABLED?: string;
  HEARTHSIDE_VAULT_PUBLICATION?: string;
  HEARTHSIDE_VAULTS?: {
    idFromName(name: string): DurableObjectId;
    get(id: DurableObjectId): Pick<HearthsideVault, 'commandFor' | 'snapshotFor' | 'uploadFor' | 'mediaFor'>;
  };
};
const privateHeaders = {
  'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
  'Cross-Origin-Resource-Policy': 'same-origin', 'Content-Security-Policy': "default-src 'none'; sandbox",
};
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: privateHeaders });
// RPC preserves messages, not custom prototypes. Return only our closed vocabulary.
const publicErrorCodes = new Set([
  'INVALID_ID', 'INVALID_INPUT', 'INVALID_NUMBER', 'INVALID_TEXT', 'INVALID_MEDIA', 'INVALID_AUDIENCE', 'INVALID_KIND',
  'INVALID_RELEASE', 'INVALID_SCOPE', 'INVALID_DIGEST', 'INVALID_MEDIA_TYPE', 'INVALID_APPROVERS', 'INVALID_ACCEPTANCE',
  'INVALID_OPERATION', 'INVALID_MEDIA_BYTES', 'INVALID_CONTENT_TYPE', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND',
  'ENVIRONMENT_DISABLED', 'PUBLICATION_DISABLED', 'DRAFT_CHANGED', 'DRAFT_REMOVED', 'AUDIENCE_CHANGED', 'COMPOSITION_CHANGED',
  'ACCEPTANCE_CHANGED', 'MEDIA_BYTES_CHANGED', 'MEDIA_ID_REUSED', 'PUBLICATION_ID_REUSED', 'MEDIA_TOO_LARGE',
  'MEDIA_UNAVAILABLE', 'MEDIA_PENDING', 'MEDIA_REFERENCED', 'MUTUAL_APPROVAL_REQUIRED', 'APPROVAL_REQUIRED',
  'ACCEPTANCE_REQUIRED', 'PUBLICATION_REVOKED', 'REVIEW_CLOSED', 'SEALED', 'CLEANUP_UNAVAILABLE',
  'INPUT_TOO_LARGE', 'BODY_REQUIRED', 'VAULT_UNAVAILABLE', 'VAULT_NOT_ACTIVATED', 'VAULT_AUTHORITY_UNAVAILABLE', 'GUEST_AUTHORITY_REQUIRED',
  'VAULT_ARCHIVE_UNAVAILABLE', 'VAULT_ARCHIVE_CORRUPT', 'VAULT_ARCHIVE_CONFLICT', 'VAULT_RESTORE_REQUIRED', 'VAULT_RESTORE_NOT_EMPTY',
  'INVALID_MEMORY_BINDING', 'MEMORY_REVIEW_REQUIRED', 'MEMORY_CHANGED',
  'INVALID_ENCOUNTER', 'INVALID_ENCOUNTER_COMMAND', 'ENCOUNTER_SCOPE_CHANGED', 'ENCOUNTER_NOT_FOUND', 'ENCOUNTER_WITHDRAWN', 'ENCOUNTER_HISTORY_FULL', 'ENCOUNTER_PAUSED', 'ANSWER_CHANGED', 'REVEAL_REQUIRED', 'COMMAND_ID_REUSED',
]);

/** SQLite stores JSON per object, so no content lives only in an instance cache. */
export class HearthsideVault extends DurableObject<VaultBindings> {
  private store: HearthsideVaultStore;
  private readonly encounters: HearthsideVaultEncounters;
  private readonly encounterAdapter?: VaultEncounterAdapter;
  private archive: HearthsideVaultArchive;
  constructor(ctx: DurableObjectState, env: VaultBindings) {
    const rooms = env.LEDGER_ROOMS;
    const authority = env.HEARTHSIDE_VAULT_AUTHORITY ?? (rooms && env.SUPABASE_URL && env.SUPABASE_PUBLISHABLE_KEY &&
      env.HEARTHSIDE_VAULT_AUTHORITY_KEY_ID && env.HEARTHSIDE_VAULT_AUTHORITY_KEY ? createVaultPublicationAuthority({
        SUPABASE_URL: env.SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY: env.SUPABASE_PUBLISHABLE_KEY,
        HEARTHSIDE_VAULT_AUTHORITY_KEY_ID: env.HEARTHSIDE_VAULT_AUTHORITY_KEY_ID, HEARTHSIDE_VAULT_AUTHORITY_KEY: env.HEARTHSIDE_VAULT_AUTHORITY_KEY,
      }, {
        accept: (scope, ref) => rooms.get(rooms.idFromName(`${scope.environment}/${scope.householdId}`)).acceptVaultPublication(scope, ref),
        isReferenced: (scope, mediaId) => rooms.get(rooms.idFromName(`${scope.environment}/${scope.householdId}`)).vaultMediaReferenced(scope, mediaId),
      }) : undefined);
    const memoryAuthority = env.HEARTHSIDE_MEMORY_AUTHORITY ?? (rooms ? {
      validateVaultMemoryCandidate: (scope: Scope, candidate: unknown, expectedRevision: number) =>
        rooms.get(rooms.idFromName(`${scope.environment}/${scope.householdId}`)).validateVaultMemoryCandidate(scope, candidate, expectedRevision),
      vaultMemoryAccess: (scope: Scope, binding: MemoryPublicationBinding, mediaId: string | null) =>
        rooms.get(rooms.idFromName(`${scope.environment}/${scope.householdId}`)).vaultMemoryAccess(scope, binding, mediaId),
    } : undefined);
    super(ctx, { ...env, HEARTHSIDE_VAULT_AUTHORITY: authority, HEARTHSIDE_MEMORY_AUTHORITY: memoryAuthority });
    const storage = new VaultJournalStorage(this.ctx.storage);
    this.archive = new HearthsideVaultArchive(storage, env.HEARTHSIDE_VAULT_ARCHIVE ?? env.HEARTHSIDE_VAULT_MEDIA);
    this.store = new HearthsideVaultStore(storage);
    this.encounters = new HearthsideVaultEncounters(storage, scope => this.store.check(scope));
    if (rooms && authority) this.encounterAdapter = new VaultEncounterAdapter(this.encounters, {
      context: (scope, id) => rooms.get(rooms.idFromName(`${scope.environment}/${scope.householdId}`)).vaultEncounterContext(scope, id),
      policy: (scope, input, authorization) => authority.policy(scope, input, authorization),
    });
  }
  private async durable<T>(scope: Scope, action: () => T | Promise<T>, finalCheck?: () => void | Promise<void>): Promise<T> {
    await this.archive.ready(scope); this.store.check(scope);
    let result!: T, error: unknown, failed = false;
    try { result = await action(); } catch (caught) { error = caught; failed = true; }
    // Outbox flush is serialized; user actions may still interleave and withdraw.
    await this.archive.flush(scope); this.store.check(scope);
    if (failed) throw error;
    await finalCheck?.(); return result;
  }
  /** Trusted internal operation; deliberately absent from the HTTP command vocabulary. */
  async restoreFromArchive(scope: Scope, maxEntries = 128) {
    vaultAssert(scope.environment === 'development' && scope.expires > Date.now(), 'UNAUTHENTICATED');
    return this.archive.restoreLatest(scope, maxEntries);
  }
  private mediaKey(scope: VaultScope, id: string): string {
    return `vault-v1/${scope.environment}/${scope.householdId}/${vaultId(id)}`;
  }
  async snapshotFor(scope: Scope) {
    return this.durable(scope, () => ({ version: 1, drafts: this.store.listDrafts(scope), publications: this.store.listReceipts(scope), mail: this.store.listMail(scope), serverTime: Date.now() }));
  }
  /** The caller must release its canonical writer lock before this fresh audience check. */
  async authorizeEncounterRevealFor(scope:Scope,binding:EncounterRevealBinding,authorization:string){
    vaultAssert(this.encounterAdapter,'VAULT_AUTHORITY_UNAVAILABLE');
    return this.durable(scope,()=>this.encounterAdapter!.evidence(scope,binding,authorization),async()=>{await this.encounterAdapter!.evidence(scope,binding,authorization);});
  }
  async checkEncounterRevealFor(scope: Scope, binding: EncounterRevealBinding) {
    return this.durable(scope, () => this.encounters.evidence(scope, binding), async () => { await this.encounters.evidence(scope, binding); });
  }
  async commandFor(scope: Scope, input: unknown, publicationEnabled: boolean, authorization?: string) {
    const command = vaultObject(input, ['operation', 'input', 'id', 'digest']);
    if (command.operation === 'encounter-private') {
      vaultAssert(this.encounterAdapter, 'VAULT_AUTHORITY_UNAVAILABLE');
      let view: EncounterPrivateView;
      return this.durable(scope, async () => view = await this.encounterAdapter!.command(scope, command.input, publicationEnabled, authorization), async () => { await this.encounterAdapter!.recheck(scope, view, authorization); });
    }
    return this.durable(scope, () => this.executeCommand(scope, input, publicationEnabled, authorization), async () => {
      const v = vaultObject(input, ['operation', 'input', 'id', 'digest']);
      if (v.operation === 'read-publication') {
        const p = this.store.readPublication(scope, vaultId(v.id));
        if (p.kind === 'shared-memory') await this.authorizeMemory(scope, p, null, 'active');
      }
      if (v.operation === 'review-memory') await this.authorizeMemory(scope, this.store.reviewMemory(scope, vaultId(v.id)), null, 'review');
      if (v.operation === 'read-draft') this.store.readDraft(scope, vaultId(v.id));
      if (v.operation === 'resume-publication') this.store.resumeReview(scope, vaultId(v.id));
      if (v.operation === 'activate') this.store.readyForAcceptance(scope, vaultId(v.id));
    });
  }
  private async executeCommand(scope: Scope, input: unknown, publicationEnabled: boolean, authorization?: string) {
    this.store.check(scope);
    const v = vaultObject(input, ['operation', 'input', 'id', 'digest']);
    switch (v.operation) {
      case 'save-draft': return this.store.saveDraft(scope, v.input);
      case 'delete-draft': return this.store.deleteDraft(scope, v.input);
      case 'read-draft': return this.store.readDraft(scope, vaultId(v.id));
      case 'resume-publication': {
        const p = this.store.resumeReview(scope, vaultId(v.id));
        vaultAssert(p.kind !== 'shared-memory', 'MEMORY_REVIEW_REQUIRED'); return vaultAuthorReview(p);
      }
      case 'prepare-media': return this.store.prepareMedia(scope, v.input);
      case 'copy-media': return this.executeMediaCopy(scope, v.input);
      case 'prepare-memory': return this.prepareMemory(scope, v.input, publicationEnabled, authorization);
      case 'review-memory': {
        const p = this.store.reviewMemory(scope, vaultId(v.id));
        await this.authorizeMemory(scope, p, null, 'review');
        return this.memoryReview(p);
      }
      case 'read-publication': {
        const p = this.store.readPublication(scope, vaultId(v.id));
        if (p.kind === 'shared-memory') await this.authorizeMemory(scope, p, null, 'active');
        // Disclosed content is a copy, without private draft lineage or identity subjects.
        return { version: 1, id: p.id, kind: p.kind, content: p.content,
          media: p.media.map(m => ({ id: m.id, contentType: m.contentType, byteLength: m.byteLength, sha256: m.sha256 })),
          digest: p.digest, releaseAt: p.releaseAt, preparedAt: p.preparedAt };
      }
      case 'review-publication': {
        const p = this.store.review(scope, vaultId(v.id));
        vaultAssert(p.kind !== 'shared-memory', 'MEMORY_REVIEW_REQUIRED');
        return { version: 1, id: p.id, kind: p.kind, content: p.content,
          media: p.media.map(m => ({ id: m.id, contentType: m.contentType, byteLength: m.byteLength, sha256: m.sha256 })),
          recipientMemberIds: p.recipients.map(p => p.memberId), approverMemberIds: p.approvers.map(p => p.memberId),
          digest: p.digest, releaseAt: p.releaseAt, preparedAt: p.preparedAt };
      }
      case 'withdraw': return this.store.withdraw(scope, vaultId(v.id));
      case 'approve': {
        vaultAssert(publicationEnabled, 'PUBLICATION_DISABLED');
        vaultAssert(typeof v.digest === 'string', 'INVALID_DIGEST');
        if (this.store.listReceipts(scope).some(p => p.publicationId === v.id && p.kind === 'shared-memory'))
          await this.authorizeMemory(scope, this.store.reviewMemory(scope, vaultId(v.id)), null, 'review');
        return this.store.approve(scope, vaultId(v.id), v.digest);
      }
      case 'prepare-publication': {
        vaultAssert(publicationEnabled && this.env.HEARTHSIDE_VAULT_AUTHORITY, 'PUBLICATION_DISABLED');
        const parsed = vaultPublicationInput(v.input);
        vaultAssert(parsed.kind !== 'shared-memory', 'MEMORY_REVIEW_REQUIRED');
        const policy = await this.env.HEARTHSIDE_VAULT_AUTHORITY.policy(scope, parsed, authorization);
        return vaultAuthorReview(await this.store.preparePublication(scope, parsed, policy));
      }
      case 'activate': {
        vaultAssert(publicationEnabled && this.env.HEARTHSIDE_VAULT_AUTHORITY, 'PUBLICATION_DISABLED');
        const id = vaultId(v.id), publication = this.store.readyForAcceptance(scope, id);
        const audienceInput: VaultPublicationInput = {
          id, draftId: publication.draftId, draftRevision: publication.draftRevision, kind: publication.kind,
          recipientMemberIds: publication.recipients.map(p => p.memberId).sort(), releaseAt: publication.releaseAt,
        };
        const checkAudience = async () => {
          const policy = await this.env.HEARTHSIDE_VAULT_AUTHORITY!.policy(scope, audienceInput, authorization);
          vaultAssert(JSON.stringify(vaultPrincipals(policy.recipients)) === JSON.stringify(publication.recipients) &&
            JSON.stringify(vaultPrincipals(policy.approvers)) === JSON.stringify(publication.approvers), 'AUDIENCE_CHANGED');
        };
        await checkAudience();
        this.store.readyForAcceptance(scope, id);
        if (!publication.acceptance) {
          // Retrying uses the same identity and digest after a lost response. The
          // authority must atomically accept this reference once or return its receipt.
          const accepted = await this.env.HEARTHSIDE_VAULT_AUTHORITY.accept(scope, this.store.reference(scope, publication), authorization);
          this.store.markAccepted(scope, id, accepted);
          // Control-plane revocation can race the cross-store acceptance await.
          // The accepted reference is recoverable, but access stays off if changed.
          await checkAudience();
        }
        if (publication.kind === 'shared-memory') await this.authorizeMemory(scope, publication, null, 'activation');
        return this.store.activate(scope, id);
      }
      case 'cleanup-media': {
        vaultAssert(this.env.HEARTHSIDE_VAULT_AUTHORITY && this.env.HEARTHSIDE_VAULT_MEDIA, 'CLEANUP_UNAVAILABLE');
        const id = vaultId(v.id);
        this.store.cleanupCandidate(scope, id);
        vaultAssert(!await this.env.HEARTHSIDE_VAULT_AUTHORITY.isReferenced(scope, id), 'MEDIA_REFERENCED');
        // Recheck local references after await; then deny reads/reuse before deleting.
        this.store.tombstoneMedia(scope, id);
        // Recovery must learn the irreversible tombstone before bytes are removed.
        await this.archive.flush(scope);
        this.store.check(scope);
        await this.env.HEARTHSIDE_VAULT_MEDIA.delete(this.mediaKey(scope, id));
        return { version: 1, id, status: 'deleted' };
      }
      default: throw new VaultError('INVALID_OPERATION');
    }
  }
  /** Revocation proof is local and cannot call back into the waiting canonical writer. */
  async isMemoryRevokedFor(scope:Scope,binding:MemoryPublicationBinding){
    return this.durable(scope,()=>this.store.memoryRevoked(scope,binding));
  }
  /** Exact original active publication only. Local read avoids a LedgerRoom callback cycle. */
  async isMemoryActiveFor(scope:Scope,binding:MemoryPublicationBinding){
    return this.durable(scope,()=>this.store.memoryActive(scope,binding));
  }
  /** Invoked by the canonical writer. This path has no LedgerRoom callback. */
  async checkMemoryPublicationFor(scope: Scope, binding: MemoryPublicationBinding, candidate: MemoryPublicationCandidate, mode: 'compose' | 'keep') {
    return this.durable(scope, () => this.store.memoryEvidence(scope, binding, candidate, mode), () => {
      this.store.reviewMemory(scope, binding.publicationId);
    });
  }
  private async prepareMemory(scope: Scope, input: unknown, enabled: boolean, authorization?: string) {
    vaultAssert(enabled && this.env.HEARTHSIDE_MEMORY_AUTHORITY && this.env.HEARTHSIDE_VAULT_AUTHORITY, 'PUBLICATION_DISABLED');
    const v = vaultObject(input, ['id', 'candidate', 'expectedRevision', 'recipientMemberIds', 'sourcePublicationId']);
    const id = vaultId(v.id), expectedRevision = vaultInteger(v.expectedRevision);
    const validated = await this.env.HEARTHSIDE_MEMORY_AUTHORITY.validateVaultMemoryCandidate(scope, v.candidate, expectedRevision);
    const composition = memoryPublicationProjection(validated.candidate), compositionDigest = await memoryCompositionDigest(composition);
    vaultAssert(composition.revision === expectedRevision + 1 && compositionDigest === validated.compositionDigest &&
      validated.candidate.approvals.length === 0 && !validated.candidate.withdrawn && composition.media.length > 0, 'COMPOSITION_CHANGED');
    const parsed = vaultPublicationInput({ id, draftId: id, draftRevision: 1, kind: 'shared-memory', releaseAt: null, recipientMemberIds: v.recipientMemberIds });
    const policy = await this.env.HEARTHSIDE_VAULT_AUTHORITY.policy(scope, parsed, authorization);
    vaultAssert(JSON.stringify(vaultPrincipals(policy.recipients)) === JSON.stringify(vaultPrincipals(policy.approvers)), 'AUDIENCE_CHANGED');
    const sourceId = v.sourcePublicationId === undefined || v.sourcePublicationId === null ? null : vaultId(v.sourcePublicationId);
    let source: ReturnType<HearthsideVaultStore['reviewMemory']> | undefined;
    const owned: string[] = [], media: VaultMedia[] = [];
    for (const reference of composition.media) {
      try { media.push(this.store.mediaForUpload(scope, reference.contentId)); owned.push(reference.contentId); continue; }
      catch (error) { if (!(error instanceof Error) || error.message !== 'NOT_FOUND') throw error; }
      vaultAssert(sourceId, 'NOT_FOUND');
      if (!source) {
        source = this.store.reviewMemory(scope, sourceId);
        vaultAssert(source.memory.composition.id === composition.id && JSON.stringify(source.approvers) === JSON.stringify(vaultPrincipals(policy.approvers)), 'AUDIENCE_CHANGED');
        await this.authorizeMemory(scope, source, null, 'review');
      }
      const shared = source.media.find(m => m.id === reference.contentId); vaultAssert(shared, 'NOT_FOUND'); media.push(shared);
    }
    const p = await this.store.prepareMemoryPublication(scope, id, { expectedRevision, composition, compositionDigest }, media, policy, () => {
      owned.forEach(id => this.store.mediaForUpload(scope, id));
      if (sourceId && source) this.store.reviewMemory(scope, sourceId);
    });
    return this.memoryReview(p);
  }
  private memoryReview(p: VaultPublication & { memory: NonNullable<VaultPublication['memory']> }) {
    return { version: 1 as const, id: p.id, ownerMemberId: p.owner.memberId, recipientMemberIds: p.recipients.map(r => r.memberId),
      digest: p.digest, state: p.state, memory: p.memory, binding: memoryPublicationBinding(p.id, p.digest, p.memory),
      approvedMemberIds: p.approvals.filter(a => a.digest === p.digest).map(a => a.principal.memberId),
      media: p.media.map(({ id, contentType, byteLength, sha256 }) => ({ id, contentType, byteLength, sha256 })) };
  }
  private async authorizeMemory(scope: Scope, p: VaultPublication, mediaId: string | null, mode: 'active' | 'review' | 'activation'): Promise<void> {
    vaultAssert(p.kind === 'shared-memory' && p.memory && this.env.HEARTHSIDE_MEMORY_AUTHORITY, 'MEMORY_REVIEW_REQUIRED');
    const binding = memoryPublicationBinding(p.id, p.digest, p.memory);
    const access = await this.env.HEARTHSIDE_MEMORY_AUTHORITY.vaultMemoryAccess(scope, binding, mediaId);
    vaultAssert(access.current && (mode === 'review' || access.kept), 'MEMORY_CHANGED');
    if (mode === 'active') this.store.readPublication(scope, p.id); else this.store.reviewMemory(scope, p.id);
  }
  private async authorizeMedia(scope: Scope, id: string, publicationId: string | null, mode: 'active' | 'review'): Promise<VaultMedia> {
    const media = this.store.readMedia(scope, id, publicationId, mode);
    if (publicationId && this.store.listReceipts(scope).some(p => p.publicationId === publicationId && p.kind === 'shared-memory'))
      await this.authorizeMemory(scope, this.store.reviewMemory(scope, publicationId), id, mode);
    return this.store.readMedia(scope, media.id, publicationId, mode);
  }
  private async executeMediaCopy(scope: Scope, input: unknown): Promise<VaultMedia> {
    vaultAssert(this.env.HEARTHSIDE_VAULT_MEDIA, 'VAULT_UNAVAILABLE');
    const v = vaultObject(input, ['id', 'sourceMediaId', 'sourcePublicationId']);
    const id = vaultId(v.id), source = { mediaId: vaultId(v.sourceMediaId), publicationId: v.sourcePublicationId === null ? null : vaultId(v.sourcePublicationId) };
    vaultAssert(id !== source.mediaId, 'MEDIA_ID_REUSED');
    const previous = this.store.mediaCopy(scope, id, source);
    // An accepted new private copy is independent of subsequent source withdrawal.
    if (previous?.status === 'uploaded') return previous;
    const manifest = await this.authorizeMedia(scope, source.mediaId, source.publicationId, 'active');
    const copy = this.store.prepareMediaCopy(scope, id, source, manifest);
    const object = await this.env.HEARTHSIDE_VAULT_MEDIA.get(this.mediaKey(scope, source.mediaId));
    vaultAssert(object && object.size === manifest.byteLength && object.customMetadata?.sha256 === manifest.sha256, 'MEDIA_UNAVAILABLE');
    const bytes = new Uint8Array(await object.arrayBuffer());
    await this.authorizeMedia(scope, source.mediaId, source.publicationId, 'active');
    const written = await this.writeMediaBytes(scope, id, bytes, copy.contentType);
    try {
      await this.authorizeMedia(scope, source.mediaId, source.publicationId, 'active');
      return this.store.completeMedia(scope, id, written.sha256, written.byteLength);
    } catch (error) {
      this.store.abortMediaCopy(scope, id); await this.archive.flush(scope);
      await this.env.HEARTHSIDE_VAULT_MEDIA.delete(this.mediaKey(scope, id)); throw error;
    }
  }
  async uploadFor(scope: Scope, id: string, bytes: Uint8Array, contentType: string): Promise<VaultMedia> {
    return this.durable(scope, () => this.executeUpload(scope, id, bytes, contentType), () => { this.store.mediaForUpload(scope, id); });
  }
  private async executeUpload(scope: Scope, id: string, bytes: Uint8Array, contentType: string): Promise<VaultMedia> {
    const written = await this.writeMediaBytes(scope, id, bytes, contentType);
    return this.store.completeMedia(scope, id, written.sha256, written.byteLength);
  }
  private async writeMediaBytes(scope: Scope, id: string, bytes: Uint8Array, contentType: string): Promise<{ sha256: string; byteLength: number }> {
    vaultAssert(this.env.HEARTHSIDE_VAULT_MEDIA, 'VAULT_UNAVAILABLE');
    const manifest = this.store.mediaForUpload(scope, id);
    vaultAssert(bytes.byteLength <= VAULT_MEDIA_LIMIT && bytes.byteLength === manifest.byteLength && contentType === manifest.contentType, 'MEDIA_BYTES_CHANGED');
    validateMediaSignature(bytes, manifest.contentType);
    const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))), b => b.toString(16).padStart(2, '0')).join('');
    vaultAssert(sha256 === manifest.sha256, 'MEDIA_BYTES_CHANGED');
    this.store.mediaForUpload(scope, id);
    const key = this.mediaKey(scope, id);
    const object = await this.env.HEARTHSIDE_VAULT_MEDIA.put(key, bytes, {
      onlyIf: { etagDoesNotMatch: '*' }, httpMetadata: { contentType, cacheControl: 'private, no-store' },
      customMetadata: { sha256, ownerMemberId: scope.memberId, ownerSubject: scope.subject },
    });
    if (!object) {
      const existing = await this.env.HEARTHSIDE_VAULT_MEDIA.head(key);
      vaultAssert(existing?.customMetadata?.sha256 === sha256 && existing.size === bytes.byteLength &&
        existing.customMetadata.ownerSubject === scope.subject, 'MEDIA_ID_REUSED');
    }
    return { sha256, byteLength: bytes.byteLength };
  }
  async mediaFor(scope: Scope, id: string, publicationId: string | null, mode: 'active' | 'review' = 'active'): Promise<Response> {
    vaultAssert(mode === 'active' || mode === 'review', 'INVALID_INPUT');
    let response: Response | undefined;
    try {
      return await this.durable(scope, async () => response = await this.executeMediaRead(scope, id, publicationId, mode), async () => { await this.authorizeMedia(scope, id, publicationId, mode); });
    } catch (error) { await response?.body?.cancel().catch(() => {}); throw error; }
  }
  private async executeMediaRead(scope: Scope, id: string, publicationId: string | null, mode: 'active' | 'review'): Promise<Response> {
    vaultAssert(this.env.HEARTHSIDE_VAULT_MEDIA, 'VAULT_UNAVAILABLE');
    const manifest = await this.authorizeMedia(scope, id, publicationId, mode);
    const object = await this.env.HEARTHSIDE_VAULT_MEDIA.get(this.mediaKey(scope, id));
    // Revocation or scope expiry may have happened while object storage was read.
    await this.authorizeMedia(scope, id, publicationId, mode);
    vaultAssert(object && object.customMetadata?.sha256 === manifest.sha256 && object.size === manifest.byteLength, 'MEDIA_UNAVAILABLE');
    return new Response(mediaStream(object), { headers: { ...privateHeaders, 'Content-Type': manifest.contentType, 'Content-Length': String(manifest.byteLength) } });
  }
}

/** Reject HTML/polytype mislabeled uploads; images/audio remain bytes, never executable markup. */
export function validateMediaSignature(bytes: Uint8Array, type: VaultMedia['contentType']): void {
  const ascii = (start: number, length: number) => new TextDecoder().decode(bytes.slice(start, start + length));
  const valid = type === 'image/jpeg' ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff :
    type === 'image/png' ? [137,80,78,71,13,10,26,10].every((n, i) => bytes[i] === n) :
    type === 'audio/ogg' ? ascii(0, 4) === 'OggS' :
    type === 'audio/mp4' ? ascii(4, 4) === 'ftyp' :
    [0x1a,0x45,0xdf,0xa3].every((n, i) => bytes[i] === n);
  vaultAssert(valid, 'INVALID_MEDIA_BYTES');
}
function mediaStream(object: R2ObjectBody): ReadableStream<Uint8Array<ArrayBuffer>> {
  const reader = object.body.getReader();
  return new ReadableStream({
    async pull(controller) {
      try { const p = await reader.read(); if (p.done) { reader.releaseLock(); controller.close(); } else controller.enqueue(new Uint8Array(p.value)); }
      catch (error) { reader.releaseLock(); controller.error(error); }
    },
    async cancel(reason) { try { await reader.cancel(reason); } finally { reader.releaseLock(); } },
  });
}
export async function vaultBoundedBody(request: Request, limit: number): Promise<Uint8Array<ArrayBuffer>> {
  const declared = request.headers.get('Content-Length');
  vaultAssert(declared === null || (/^\d+$/.test(declared) && Number(declared) <= limit), 'INPUT_TOO_LARGE');
  const reader = request.body?.getReader();
  vaultAssert(reader, 'BODY_REQUIRED');
  const chunks: Uint8Array[] = []; let total = 0;
  try {
    for (;;) {
      const part = await reader.read(); if (part.done) break;
      total += part.value.byteLength;
      if (total > limit) { await reader.cancel(); throw new VaultError('INPUT_TOO_LARGE'); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return result;
}

/** HTTP auth is always fresh; no guest URL and no household-membership read shortcut. */
export async function handleHearthsideVault(request: Request, env: HearthsideVaultEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/hearthside-vault/')) return null;
  try {
    const match = /^\/api\/hearthside-vault\/(development|production)\/(HH-[A-Za-z0-9_-]{1,96})(?:\/media\/([A-Za-z0-9][A-Za-z0-9_-]{0,95}))?$/.exec(url.pathname);
    vaultAssert(match && !url.search, 'INVALID_SCOPE');
    vaultAssert(env.HEARTHSIDE_VAULT_ENABLED === 'true' && env.HEARTHSIDE_VAULTS, 'VAULT_NOT_ACTIVATED');
    const { scope, token } = await authorizeRequest(request, env, match[1]!, match[2]!);
    vaultAssert(scope.environment === 'development', 'ENVIRONMENT_DISABLED');
    vaultAssert(request.headers.get('X-Vault-Actor') === scope.memberId && request.headers.get('X-Vault-Identity') === scope.subject, 'FORBIDDEN');
    const room = env.HEARTHSIDE_VAULTS.get(env.HEARTHSIDE_VAULTS.idFromName(`${scope.environment}/${scope.householdId}`));
    const mediaId = match[3];
    if (mediaId && request.method === 'GET') {
      const mode = request.headers.get('X-Vault-Media-Mode') ?? 'active';
      vaultAssert(mode === 'active' || mode === 'review', 'INVALID_INPUT');
      return await room.mediaFor(scope, mediaId, request.headers.get('X-Vault-Publication'), mode);
    }
    if (mediaId && request.method === 'PUT') return json(await room.uploadFor(scope, mediaId, await vaultBoundedBody(request, VAULT_MEDIA_LIMIT), request.headers.get('Content-Type') ?? ''));
    if (!mediaId && request.method === 'GET') return json(await room.snapshotFor(scope));
    if (!mediaId && request.method === 'POST') {
      vaultAssert(request.headers.get('Content-Type')?.split(';')[0] === 'application/json', 'INVALID_CONTENT_TYPE');
      const bytes = await vaultBoundedBody(request, VAULT_REQUEST_LIMIT);
      let input: unknown;
      try { input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { throw new VaultError('INVALID_INPUT'); }
      return json(await room.commandFor(scope, input, env.HEARTHSIDE_VAULT_PUBLICATION === 'true', token));
    }
    return json({ code: 'METHOD_NOT_ALLOWED' }, 405);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const code = publicErrorCodes.has(message) ? message : 'VAULT_UNAVAILABLE';
    return json({ code }, code === 'UNAUTHENTICATED' ? 401 : /FORBIDDEN|DISABLED/.test(code) ? 403 :
      code === 'NOT_FOUND' ? 404 : /TOO_LARGE/.test(code) ? 413 : /CHANGED|REUSED|SEALED|REQUIRED|REVOKED|PENDING|REFERENCED/.test(code) ? 409 :
      /UNAVAILABLE|NOT_ACTIVATED|ARCHIVE_CORRUPT|ARCHIVE_CONFLICT/.test(code) ? 503 : 400);
  }
}
