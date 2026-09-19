import type { R2Bucket } from '@cloudflare/workers-types';
import { archiveAssert, archiveParse, sharedScopeName, SHARED_ROW_BYTES, ZERO_DIGEST, validateSharedRow, SharedWorkspaceArchiveStorage, type SharedCopyRow, type SharedArchiveMeta } from './sharedArchiveStorage.ts';

export type SharedWorkspaceArchiveEnv = { HERCULES_FILES?: R2Bucket };
type Scope = { environment: string; householdId: string };
type Reference = { family: SharedCopyRow['family']; id: string; bytes: number; digest: string; chunks: string[] };
type Checkpoint = { sequence: number; checksum: string };
type Head = { version: 1; scope: string; sequence: number; digest: string; checkpoint: Checkpoint | null };
type Journal = { version: 1; scope: string; sequence: number; previous: string; row: Reference };
type Snapshot = { version: 1; scope: string; sequence: number; digest: string; rows: Reference[] };
type Restore = { target: Head; sequence: number; digest: string; checkpoint?: { sequence: number; digest: string; rows: Reference[]; index: number } };
const CHUNK_BYTES = 256 * 1024, MANIFEST_BYTES = 128 * 1024, CHECKPOINT_BYTES = 512 * 1024;
const DIGEST = /^[a-f0-9]{64}$/, numberName = (n: number) => String(n).padStart(16, '0');
const encoded = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
async function hash(bytes: Uint8Array): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer))].map(n => n.toString(16).padStart(2, '0')).join('');
}
const checksum = (value: unknown) => hash(encoded(value));
const headers = { contentType: 'application/octet-stream', cacheControl: 'private, no-store' };

/** Private content archive, separate from personal Workspace files and Vault.
 * Chunk objects and manifests are immutable; only the CAS-protected head moves. */
export class SharedWorkspaceArchive {
  private lane: Promise<void> = Promise.resolve();
  constructor(private readonly storage: SharedWorkspaceArchiveStorage, private readonly bucket?: Pick<R2Bucket, 'get' | 'put'>) {}
  private serialize<T>(action: () => Promise<T>): Promise<T> {
    const next = this.lane.catch(() => {}).then(action); this.lane = next.then(() => {}, () => {}); return next;
  }
  private prefix(scope: string): string { return `hearthside-shared-workspace-archive-v1/${scope}/`; }
  private async io<T>(operation: () => Promise<T>): Promise<T> {
    try { return await operation(); } catch { throw new Error('SHARED_ARCHIVE_UNAVAILABLE'); }
  }
  private async bytes(key: string, limit: number): Promise<{ bytes: Uint8Array; etag: string } | null> {
    archiveAssert(this.bucket, 'SHARED_ARCHIVE_UNAVAILABLE');
    const object = await this.io(() => this.bucket!.get(key)); if (!object) return null;
    archiveAssert(object.size <= limit);
    const bytes = new Uint8Array(await this.io(() => object.arrayBuffer())); archiveAssert(bytes.byteLength <= limit);
    return { bytes, etag: object.etag };
  }
  private async json<T>(key: string, limit: number): Promise<{ value: T; etag: string } | null> {
    const saved = await this.bytes(key, limit);
    if (!saved) return null;
    try { return { value: archiveParse<T>(new TextDecoder('utf-8', { fatal: true }).decode(saved.bytes)), etag: saved.etag }; }
    catch { throw new Error('SHARED_ARCHIVE_CORRUPT'); }
  }
  private async immutable(key: string, bytes: Uint8Array): Promise<void> {
    archiveAssert(this.bucket, 'SHARED_ARCHIVE_UNAVAILABLE');
    const saved = await this.io(() => this.bucket!.put(key, bytes, { onlyIf: { etagDoesNotMatch: '*' }, httpMetadata: headers }));
    if (!saved) {
      const old = await this.bytes(key, bytes.length);
      archiveAssert(old && await hash(old.bytes) === await hash(bytes), 'SHARED_ARCHIVE_CONFLICT');
    }
  }
  private async manifest(key: string, value: unknown, limit: number): Promise<void> {
    const bytes = encoded(value); archiveAssert(bytes.length <= limit); await this.immutable(key, bytes);
  }
  private async head(scope: string): Promise<{ value: Head; etag: string } | null> {
    const saved = await this.json<Head>(this.prefix(scope) + 'head.json', 4096);
    if (saved) {
      const h = saved.value;
      archiveAssert(h && h.version === 1 && h.scope === scope && Number.isSafeInteger(h.sequence) && h.sequence > 0 && DIGEST.test(h.digest));
      archiveAssert(h.checkpoint === null || h.checkpoint && Number.isSafeInteger(h.checkpoint.sequence) && h.checkpoint.sequence > 0 && h.checkpoint.sequence <= h.sequence && DIGEST.test(h.checkpoint.checksum));
    }
    return saved;
  }
  private async advance(scope: string, head: Head, old: { etag: string } | null): Promise<{ value: Head; etag: string }> {
    archiveAssert(this.bucket, 'SHARED_ARCHIVE_UNAVAILABLE');
    const saved = await this.io(() => this.bucket!.put(this.prefix(scope) + 'head.json', JSON.stringify(head), {
      onlyIf: old ? { etagMatches: old.etag } : { etagDoesNotMatch: '*' }, httpMetadata: { ...headers, contentType: 'application/json' },
    }));
    archiveAssert(saved, 'SHARED_ARCHIVE_CONFLICT'); return { value: head, etag: saved.etag };
  }
  private async encodeRow(scope: string, row: SharedCopyRow): Promise<Reference> {
    validateSharedRow(row, scope); const bytes = new TextEncoder().encode(row.data), chunks: string[] = [];
    for (let at = 0; at < bytes.length; at += CHUNK_BYTES) {
      const chunk = bytes.slice(at, at + CHUNK_BYTES), digest = await hash(chunk);
      await this.immutable(this.prefix(scope) + `chunks/${digest}.bin`, chunk); chunks.push(digest);
    }
    return { family: row.family, id: row.id, bytes: bytes.length, digest: await hash(bytes), chunks };
  }
  private async decodeRow(scope: string, ref: Reference): Promise<SharedCopyRow> {
    archiveAssert(ref && ['owner', 'legacy', 'experience'].includes(ref.family) && typeof ref.id === 'string' && Number.isSafeInteger(ref.bytes) && ref.bytes > 0 && ref.bytes <= SHARED_ROW_BYTES && DIGEST.test(ref.digest) && Array.isArray(ref.chunks) && ref.chunks.length === Math.ceil(ref.bytes / CHUNK_BYTES) && ref.chunks.every(v => typeof v === 'string' && DIGEST.test(v)));
    const bytes = new Uint8Array(ref.bytes); let offset = 0;
    for (const digest of ref.chunks) {
      const chunk = await this.bytes(this.prefix(scope) + `chunks/${digest}.bin`, CHUNK_BYTES);
      archiveAssert(chunk && chunk.bytes.length === Math.min(CHUNK_BYTES, ref.bytes - offset) && await hash(chunk.bytes) === digest);
      bytes.set(chunk.bytes, offset); offset += chunk.bytes.length;
    }
    archiveAssert(await hash(bytes) === ref.digest);
    let data: string;
    try { data = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw new Error('SHARED_ARCHIVE_CORRUPT'); }
    const row = { family: ref.family, id: ref.id, data }; validateSharedRow(row, scope); return row;
  }
  /** Archive existing shared-workspace rows once. Never initialize over a remote tip. */
  ready(scope: Scope): Promise<void> {
    return this.serialize(async () => {
      const name = sharedScopeName(scope); archiveAssert(this.bucket, 'SHARED_ARCHIVE_UNAVAILABLE');
      archiveAssert(!this.storage.state('restore'), 'SHARED_RESTORE_REQUIRED');
      let meta = this.storage.state<SharedArchiveMeta>('meta');
      if (!meta) {
        archiveAssert(!await this.head(name) && !await this.json(this.prefix(name) + 'journal/0000000000000001.json', MANIFEST_BYTES), 'SHARED_RESTORE_REQUIRED');
        meta = this.storage.initialize(name);
      }
      archiveAssert(meta!.scope === name, 'FORBIDDEN');
      archiveAssert(this.storage.raw('owner', 'owner') === JSON.stringify(name), 'SHARED_ARCHIVE_CORRUPT');
      await this.flushLocked(name, this.storage.state<SharedArchiveMeta>('meta')!.sequence);
    });
  }
  flush(scope: Scope): Promise<void> {
    const name = sharedScopeName(scope), target = this.storage.state<SharedArchiveMeta>('meta')?.sequence;
    archiveAssert(target !== undefined, 'SHARED_RESTORE_REQUIRED'); return this.serialize(() => this.flushLocked(name, target));
  }
  private async flushLocked(scope: string, target: number): Promise<void> {
    let remote = await this.head(scope), meta = this.storage.state<SharedArchiveMeta>('meta');
    archiveAssert(meta && meta.scope === scope && !this.storage.state('restore'), 'SHARED_RESTORE_REQUIRED');
    archiveAssert(!remote || remote.value.sequence <= meta.sequence, 'SHARED_RESTORE_REQUIRED');
    if (remote?.value.sequence === meta.archived) archiveAssert(remote.value.digest === meta.digest, 'SHARED_ARCHIVE_CONFLICT');
    else archiveAssert(!remote && meta.archived === 0 || remote?.value.sequence === meta.archived + 1, 'SHARED_ARCHIVE_CONFLICT');
    while (meta.archived < target) {
      const sequence = meta.archived + 1, row = await this.encodeRow(scope, this.storage.pending(sequence));
      const journal: Journal = { version: 1, scope, sequence, previous: meta.digest, row }, digest = await checksum(journal);
      await this.manifest(this.prefix(scope) + `journal/${numberName(sequence)}.json`, { journal, checksum: digest }, MANIFEST_BYTES);
      if (remote?.value.sequence === sequence) archiveAssert(remote.value.digest === digest, 'SHARED_ARCHIVE_CONFLICT');
      else remote = await this.advance(scope, { version: 1, scope, sequence, digest, checkpoint: remote?.value.checkpoint ?? null }, remote);
      this.storage.acknowledge(sequence, digest); meta = this.storage.state<SharedArchiveMeta>('meta')!;
    }
    if (remote && meta.archived === meta.sequence && meta.archived - (remote.value.checkpoint?.sequence ?? 0) >= 32 && this.storage.count() <= 128) {
      const rows: Reference[] = [];
      for (const row of this.storage.rows()) rows.push(await this.encodeRow(scope, row));
      const snapshot: Snapshot = { version: 1, scope, sequence: meta.archived, digest: meta.digest, rows }, digest = await checksum(snapshot);
      await this.manifest(this.prefix(scope) + `checkpoints/${numberName(meta.archived)}.json`, { snapshot, checksum: digest }, CHECKPOINT_BYTES);
      await this.advance(scope, { ...remote.value, checkpoint: { sequence: meta.archived, checksum: digest } }, remote);
    }
  }
  private async journal(scope: string, sequence: number, previous: string): Promise<{ journal: Journal; checksum: string } | null> {
    const saved = await this.json<{ journal: Journal; checksum: string }>(this.prefix(scope) + `journal/${numberName(sequence)}.json`, MANIFEST_BYTES);
    if (!saved) return null;
    const value = saved.value, j = value.journal;
    archiveAssert(j && j.version === 1 && j.scope === scope && j.sequence === sequence && j.previous === previous && DIGEST.test(value.checksum) && await checksum(j) === value.checksum);
    return value;
  }
  /** Complete a written immutable tail when its head publication was uncertain. */
  private async recoverTail(scope: string, limit: number) {
    let remote = await this.head(scope);
    for (let count = 0; count < limit; count++) {
      const sequence = (remote?.value.sequence ?? 0) + 1, saved = await this.journal(scope, sequence, remote?.value.digest ?? ZERO_DIGEST);
      if (!saved) return { remote, more: false };
      await this.decodeRow(scope, saved.journal.row);
      remote = await this.advance(scope, { version: 1, scope, sequence, digest: saved.checksum, checkpoint: remote?.value.checkpoint ?? null }, remote);
    }
    return { remote, more: true };
  }
  /** Trusted explicit latest-only recovery. No HTTP route and no financial restore input. */
  restoreLatest(scope: Scope, maxEntries = 32): Promise<{ complete: boolean; sequence: number; target: number }> {
    return this.serialize(async () => {
      const name = sharedScopeName(scope); archiveAssert(Number.isInteger(maxEntries) && maxEntries > 0 && maxEntries <= 128, 'INVALID_INPUT');
      let restore = this.storage.state<Restore>('restore');
      if (!restore) archiveAssert(this.storage.count() === 0 && !this.storage.state('meta'), 'SHARED_RESTORE_NOT_EMPTY');
      else archiveAssert(restore.target.scope === name, 'FORBIDDEN');
      const tail = await this.recoverTail(name, maxEntries), remote = tail.remote;
      archiveAssert(remote, 'SHARED_ARCHIVE_UNAVAILABLE');
      if (tail.more) return { complete: false, sequence: restore?.sequence ?? 0, target: remote.value.sequence };
      if (!restore) {
        restore = { target: remote.value, sequence: 0, digest: ZERO_DIGEST };
        const checkpoint = remote.value.checkpoint;
        if (checkpoint) {
          const saved = await this.json<{ snapshot: Snapshot; checksum: string }>(this.prefix(name) + `checkpoints/${numberName(checkpoint.sequence)}.json`, CHECKPOINT_BYTES);
          archiveAssert(saved && saved.value.checksum === checkpoint.checksum && await checksum(saved.value.snapshot) === checkpoint.checksum);
          const snapshot = saved.value.snapshot;
          archiveAssert(snapshot && snapshot.version === 1 && snapshot.scope === name && snapshot.sequence === checkpoint.sequence && snapshot.sequence <= remote.value.sequence && DIGEST.test(snapshot.digest) && Array.isArray(snapshot.rows) && snapshot.rows.length <= 128);
          archiveAssert(new Set(snapshot.rows.map(row => `${row.family}/${row.id}`)).size === snapshot.rows.length);
          restore.checkpoint = { sequence: snapshot.sequence, digest: snapshot.digest, rows: snapshot.rows, index: 0 };
        }
        this.storage.setState('restore', restore);
      }
      archiveAssert(remote.value.sequence >= restore.target.sequence, 'SHARED_ARCHIVE_CONFLICT');
      if (remote.value.sequence === restore.target.sequence) archiveAssert(remote.value.digest === restore.target.digest, 'SHARED_ARCHIVE_CONFLICT');
      restore.target = remote.value;
      // Checkpoints contain references only. Decode/stage one bounded row at a
      // time, and persist the page cursor instead of retaining all copy bytes.
      if (restore.checkpoint) {
        const checkpoint = restore.checkpoint;
        for (let count = 0; count < maxEntries && checkpoint.index < checkpoint.rows.length; count++) {
          const row = await this.decodeRow(name, checkpoint.rows[checkpoint.index]!);
          checkpoint.index++;
          this.storage.transaction(() => { this.storage.stage([row], name); this.storage.setState('restore', restore); });
        }
        if (checkpoint.index < checkpoint.rows.length) return { complete: false, sequence: restore.sequence, target: restore.target.sequence };
        restore.sequence = checkpoint.sequence; restore.digest = checkpoint.digest; delete restore.checkpoint; this.storage.setState('restore', restore);
      }
      for (let count = 0; count < maxEntries && restore.sequence < restore.target.sequence; count++) {
        const sequence = restore.sequence + 1, saved = await this.journal(name, sequence, restore.digest); archiveAssert(saved);
        const row = await this.decodeRow(name, saved.journal.row);
        restore.sequence = sequence; restore.digest = saved.checksum;
        this.storage.transaction(() => { this.storage.stage([row], name); this.storage.setState('restore', restore); });
      }
      if (restore.sequence !== restore.target.sequence) return { complete: false, sequence: restore.sequence, target: restore.target.sequence };
      archiveAssert(restore.digest === restore.target.digest);
      const latest = (await this.recoverTail(name, 1)).remote; archiveAssert(latest && latest.value.sequence >= restore.sequence, 'SHARED_ARCHIVE_CONFLICT');
      if (latest.value.sequence > restore.sequence) {
        restore.target = latest.value; this.storage.setState('restore', restore);
        return { complete: false, sequence: restore.sequence, target: latest.value.sequence };
      }
      archiveAssert(latest.value.digest === restore.digest && this.storage.raw('owner', 'owner', true) === JSON.stringify(name));
      this.storage.finishRestore({ scope: name, sequence: restore.sequence, archived: restore.sequence, digest: restore.digest });
      return { complete: true, sequence: restore.sequence, target: restore.target.sequence };
    });
  }
}
