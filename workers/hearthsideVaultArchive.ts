import type { DurableObjectStorage, R2Bucket } from '@cloudflare/workers-types';
import { vaultAssert, vaultDigest, type VaultScope } from '../src/hearthside/vaultContracts.ts';
import type { VaultStorage } from './hearthsideVaultStore.ts';
type Row = { key: string; data: string };
type Meta = { scope: string; sequence: number; archived: number; digest: string };
type Checkpoint = { sequence: number; checksum: string };
type Head = { version: 1; scope: string; sequence: number; digest: string; checkpoint: Checkpoint | null };
type Journal = { version: 1; scope: string; sequence: number; previous: string; rows: Row[] };
type Snapshot = { version: 1; scope: string; sequence: number; digest: string; rows: Row[] };
type Restore = { target: Head; sequence: number; digest: string };
const ZERO = '0'.repeat(64), ENTRY_LIMIT = 512 * 1024, CHECKPOINT_LIMIT = 8 * 1024 * 1024;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function parse<T>(data: string): T {
  try { return JSON.parse(data) as T; } catch { vaultAssert(false, 'VAULT_ARCHIVE_CORRUPT'); }
}
const scopeName = (scope: VaultScope) => {
  vaultAssert(scope.environment === 'development' && /^HH-[A-Za-z0-9_-]{1,96}$/.test(scope.householdId), 'INVALID_SCOPE');
  return `${scope.environment}/${scope.householdId}`;
};
const sequenceName = (n: number) => String(n).padStart(16, '0');
function checkRow(row: Row, scope: string): void {
  vaultAssert(row && typeof row.key === 'string' && typeof row.data === 'string' &&
    (row.key === 'scope' || /^(draft|media|publication|encounter)\/[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/.test(row.key)) &&
    new TextEncoder().encode(row.data).byteLength < ENTRY_LIMIT - 2048, 'VAULT_ARCHIVE_CORRUPT');
  const value = parse<unknown>(row.data);
  if (row.key === 'scope') vaultAssert(value === scope, 'VAULT_ARCHIVE_CORRUPT');
  else vaultAssert(value && typeof value === 'object' && 'version' in value && value.version === 1 &&
    'id' in value && value.id === row.key.split('/')[1], 'VAULT_ARCHIVE_CORRUPT');
}
function checkTransition(key: string, oldData: string | undefined, data: string): void {
  if (!oldData || key === 'scope') return;
  const old = parse<Record<string, unknown>>(oldData), next = parse<Record<string, unknown>>(data);
  vaultAssert(!(old.state === 'revoked' && next.state !== 'revoked') &&
    !(old.status === 'deleted' && next.status !== 'deleted') &&
    !(old.deletedAt !== undefined && next.deletedAt === undefined), 'VAULT_ARCHIVE_CORRUPT');
  if (key.startsWith('encounter/')) vaultAssert(Number.isSafeInteger(next.generation) && Number(next.generation) >= Number(old.generation), 'VAULT_ARCHIVE_CORRUPT');
  if (key.startsWith('draft/')) vaultAssert(Number.isSafeInteger(next.revision) && Number(next.revision) >= Number(old.revision), 'VAULT_ARCHIVE_CORRUPT');
}

/** Record writes and their monotonic recovery outbox share the same SQL transaction. */
export class VaultJournalStorage implements VaultStorage {
  private depth = 0;
  constructor(readonly durable: DurableObjectStorage) {
    durable.sql.exec('CREATE TABLE IF NOT EXISTS vault_records (key TEXT PRIMARY KEY, data TEXT NOT NULL)');
    durable.sql.exec('CREATE TABLE IF NOT EXISTS vault_archive_state (key TEXT PRIMARY KEY, data TEXT NOT NULL)');
    durable.sql.exec('CREATE TABLE IF NOT EXISTS vault_archive_outbox (sequence INTEGER PRIMARY KEY, data TEXT NOT NULL)');
    durable.sql.exec('CREATE TABLE IF NOT EXISTS vault_restore_records (key TEXT PRIMARY KEY, data TEXT NOT NULL)');
  }
  get<T>(key: string): T | undefined { const data = this.raw(key); return data === undefined ? undefined : parse<T>(data); }
  raw(key: string, staging = false): string | undefined {
    const table = staging ? 'vault_restore_records' : 'vault_records';
    return this.durable.sql.exec<{ data: string }>(`SELECT data FROM ${table} WHERE key=?`, key).toArray()[0]?.data;
  }
  state<T>(key: string): T | undefined {
    const row = this.durable.sql.exec<{ data: string }>('SELECT data FROM vault_archive_state WHERE key=?', key).toArray()[0];
    return row ? parse<T>(row.data) : undefined;
  }
  setState(key: string, value: unknown): void {
    this.durable.sql.exec('INSERT INTO vault_archive_state VALUES(?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data', key, JSON.stringify(value));
  }
  clearState(key: string): void { this.durable.sql.exec('DELETE FROM vault_archive_state WHERE key=?', key); }
  list<T>(prefix: string): T[] {
    return this.durable.sql.exec<Row>('SELECT key,data FROM vault_records WHERE key>=? AND key<? ORDER BY key', prefix, prefix + '\uffff').toArray().map(row => parse<T>(row.data));
  }
  transaction<T>(action: () => T): T {
    if (this.depth) return action();
    return this.durable.transactionSync(() => { this.depth++; try { return action(); } finally { this.depth--; } });
  }
  put(key: string, value: unknown): void {
    this.transaction(() => {
      const meta = this.state<Meta>('meta'); vaultAssert(meta && !this.state('restore'), 'VAULT_RESTORE_REQUIRED');
      const row = { key, data: JSON.stringify(value) }; checkRow(row, meta.scope);
      const old = this.raw(key); if (old === row.data) return;
      checkTransition(key, old, row.data);
      this.durable.sql.exec('INSERT INTO vault_records VALUES(?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data', key, row.data);
      meta.sequence++; vaultAssert(Number.isSafeInteger(meta.sequence), 'VAULT_ARCHIVE_CORRUPT');
      this.durable.sql.exec('INSERT INTO vault_archive_outbox VALUES(?,?)', meta.sequence, JSON.stringify([row]));
      this.setState('meta', meta);
    });
  }
  count(): number { return this.durable.sql.exec<{ count: number }>('SELECT count(*) AS count FROM vault_records').toArray()[0]!.count; }
  rows(limit: number): Row[] { return this.durable.sql.exec<Row>('SELECT key,data FROM vault_records ORDER BY key LIMIT ?', limit).toArray(); }
  pending(sequence: number): Row[] {
    const row = this.durable.sql.exec<{ data: string }>('SELECT data FROM vault_archive_outbox WHERE sequence=?', sequence).toArray()[0];
    vaultAssert(row, 'VAULT_ARCHIVE_CORRUPT'); return parse<Row[]>(row.data);
  }
  acknowledge(sequence: number, digest: string): void {
    this.transaction(() => {
      const meta = this.state<Meta>('meta')!; meta.archived = sequence; meta.digest = digest; this.setState('meta', meta);
      this.durable.sql.exec('DELETE FROM vault_archive_outbox WHERE sequence<=?', sequence);
    });
  }
  stage(rows: Row[], scope: string): void {
    for (const row of rows) {
      checkRow(row, scope); checkTransition(row.key, this.raw(row.key, true), row.data);
      this.durable.sql.exec('INSERT INTO vault_restore_records VALUES(?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data', row.key, row.data);
    }
  }
}

/** Private R2 journal; no financial restore path and no capability URL. */
export class HearthsideVaultArchive {
  private lane: Promise<void> = Promise.resolve();
  constructor(private readonly storage: VaultJournalStorage, private readonly bucket?: Pick<R2Bucket, 'get' | 'put'>) {}
  private serialize<T>(action: () => Promise<T>): Promise<T> {
    const next = this.lane.catch(() => {}).then(action); this.lane = next.then(() => {}, () => {}); return next;
  }
  private prefix(scope: string) { return `hearthside-vault-archive-v1/${scope}/`; }
  private async read<T>(key: string, limit: number): Promise<{ value: T; etag: string } | null> {
    vaultAssert(this.bucket, 'VAULT_ARCHIVE_UNAVAILABLE');
    const object = await this.bucket.get(key); if (!object) return null;
    vaultAssert(object.size <= limit, 'VAULT_ARCHIVE_CORRUPT');
    const bytes = await object.arrayBuffer(); vaultAssert(bytes.byteLength <= limit, 'VAULT_ARCHIVE_CORRUPT');
    return { value: parse<T>(new TextDecoder().decode(bytes)), etag: object.etag };
  }
  private async head(scope: string) {
    const item = await this.read<Head>(this.prefix(scope) + 'head.json', 4096);
    if (item) {
      const head = item.value;
      vaultAssert(head && head.version === 1 && head.scope === scope && Number.isSafeInteger(head.sequence) &&
        head.sequence > 0 && /^[a-f0-9]{64}$/.test(head.digest), 'VAULT_ARCHIVE_CORRUPT');
      vaultAssert(head.checkpoint === null || (head.checkpoint && Number.isSafeInteger(head.checkpoint.sequence) &&
        head.checkpoint.sequence > 0 && head.checkpoint.sequence <= head.sequence && /^[a-f0-9]{64}$/.test(head.checkpoint.checksum)), 'VAULT_ARCHIVE_CORRUPT');
    }
    return item;
  }
  private async immutable(key: string, value: unknown, limit: number): Promise<void> {
    vaultAssert(this.bucket, 'VAULT_ARCHIVE_UNAVAILABLE');
    const text = JSON.stringify(value); vaultAssert(new TextEncoder().encode(text).byteLength <= limit, 'VAULT_ARCHIVE_CORRUPT');
    const created = await this.bucket.put(key, text, { onlyIf: { etagDoesNotMatch: '*' }, httpMetadata: { contentType: 'application/json', cacheControl: 'private, no-store' } });
    if (!created) vaultAssert(same((await this.read(key, limit))?.value, value), 'VAULT_ARCHIVE_CONFLICT');
  }
  /** Refuses to silently initialize over an existing private recovery archive. */
  async ready(scope: VaultScope): Promise<void> {
    return this.serialize(async () => {
      const name = scopeName(scope); vaultAssert(this.bucket, 'VAULT_ARCHIVE_UNAVAILABLE');
      vaultAssert(!this.storage.state('restore'), 'VAULT_RESTORE_REQUIRED');
      let meta = this.storage.state<Meta>('meta');
      if (!meta) {
        vaultAssert(!await this.head(name) && !await this.read(this.prefix(name) + 'journal/0000000000000001.json', ENTRY_LIMIT), 'VAULT_RESTORE_REQUIRED');
        const existingScope = this.storage.get<string>('scope'); vaultAssert(!existingScope || existingScope === name, 'FORBIDDEN');
        this.storage.transaction(() => {
          meta = { scope: name, sequence: 0, archived: 0, digest: ZERO }; this.storage.setState('meta', meta);
          // Existing pre-archive rows become individually journalled baseline entries.
          for (const row of this.storage.durable.sql.exec<Row>('SELECT key,data FROM vault_records ORDER BY key')) {
            checkRow(row, name); meta.sequence++;
            this.storage.durable.sql.exec('INSERT INTO vault_archive_outbox VALUES(?,?)', meta.sequence, JSON.stringify([row]));
          }
          this.storage.setState('meta', meta);
        });
      }
      vaultAssert(meta!.scope === name, 'FORBIDDEN'); await this.flushLocked(name, meta!.sequence);
    });
  }
  flush(scope: VaultScope): Promise<void> {
    const name = scopeName(scope), target = this.storage.state<Meta>('meta')?.sequence;
    vaultAssert(target !== undefined, 'VAULT_RESTORE_REQUIRED');
    return this.serialize(() => this.flushLocked(name, target));
  }
  private async flushLocked(name: string, target: number): Promise<void> {
    vaultAssert(this.bucket, 'VAULT_ARCHIVE_UNAVAILABLE');
    let remote = await this.head(name), meta = this.storage.state<Meta>('meta');
    vaultAssert(meta && meta.scope === name && !this.storage.state('restore'), 'VAULT_RESTORE_REQUIRED');
    vaultAssert(!remote || remote.value.sequence <= meta.sequence, 'VAULT_RESTORE_REQUIRED');
    if (remote?.value.sequence === meta.archived) vaultAssert(remote.value.digest === meta.digest, 'VAULT_ARCHIVE_CONFLICT');
    else vaultAssert((!remote && meta.archived === 0) || remote?.value.sequence === meta.archived + 1, 'VAULT_ARCHIVE_CONFLICT');
    while (meta.archived < target) {
      const sequence = meta.archived + 1, rows = this.storage.pending(sequence);
      rows.forEach(row => checkRow(row, name));
      const journal: Journal = { version: 1, scope: name, sequence, previous: meta.digest, rows }, checksum = await vaultDigest(journal);
      await this.immutable(this.prefix(name) + `journal/${sequenceName(sequence)}.json`, { journal, checksum }, ENTRY_LIMIT);
      if (remote?.value.sequence === sequence) vaultAssert(remote.value.digest === checksum, 'VAULT_ARCHIVE_CONFLICT');
      else {
        const head: Head = { version: 1, scope: name, sequence, digest: checksum, checkpoint: remote?.value.checkpoint ?? null };
        const put = await this.bucket.put(this.prefix(name) + 'head.json', JSON.stringify(head), {
          onlyIf: remote ? { etagMatches: remote.etag } : { etagDoesNotMatch: '*' }, httpMetadata: { contentType: 'application/json', cacheControl: 'private, no-store' },
        });
        vaultAssert(put, 'VAULT_ARCHIVE_CONFLICT'); remote = { value: head, etag: put.etag };
      }
      this.storage.acknowledge(sequence, checksum); meta = this.storage.state<Meta>('meta')!;
    }
    // Bounded optional checkpoints accelerate recovery; journals are never flattened or deleted.
    if (remote && meta.sequence === meta.archived && meta.archived - (remote.value.checkpoint?.sequence ?? 0) >= 32 && this.storage.count() <= 128) {
      const snapshot: Snapshot = { version: 1, scope: name, sequence: meta.archived, digest: meta.digest, rows: this.storage.rows(128) };
      if (new TextEncoder().encode(JSON.stringify(snapshot)).byteLength > CHECKPOINT_LIMIT - 1024) return;
      const checksum = await vaultDigest(snapshot);
      await this.immutable(this.prefix(name) + `checkpoints/${sequenceName(meta.archived)}.json`, { snapshot, checksum }, CHECKPOINT_LIMIT);
      const head: Head = { ...remote.value, checkpoint: { sequence: meta.archived, checksum } };
      const put = await this.bucket.put(this.prefix(name) + 'head.json', JSON.stringify(head), { onlyIf: { etagMatches: remote.etag }, httpMetadata: { contentType: 'application/json', cacheControl: 'private, no-store' } });
      vaultAssert(put, 'VAULT_ARCHIVE_CONFLICT');
    }
  }
  /** Finish a durable journal tail after a lost head write/acknowledgement. */
  private async recoverTail(name: string, limit: number) {
    vaultAssert(this.bucket, 'VAULT_ARCHIVE_UNAVAILABLE');
    let remote = await this.head(name);
    for (let count = 0; count < limit; count++) {
      const sequence = (remote?.value.sequence ?? 0) + 1;
      const saved = await this.read<{ journal: Journal; checksum: string }>(this.prefix(name) + `journal/${sequenceName(sequence)}.json`, ENTRY_LIMIT);
      if (!saved) return { remote, more: false };
      const journal = saved.value.journal;
      vaultAssert(await vaultDigest(journal) === saved.value.checksum && journal.version === 1 && journal.scope === name &&
        journal.sequence === sequence && journal.previous === (remote?.value.digest ?? ZERO) && Array.isArray(journal.rows), 'VAULT_ARCHIVE_CORRUPT');
      journal.rows.forEach(row => checkRow(row, name));
      const head: Head = { version: 1, scope: name, sequence, digest: saved.value.checksum, checkpoint: remote?.value.checkpoint ?? null };
      const put = await this.bucket.put(this.prefix(name) + 'head.json', JSON.stringify(head), {
        onlyIf: remote ? { etagMatches: remote.etag } : { etagDoesNotMatch: '*' }, httpMetadata: { contentType: 'application/json', cacheControl: 'private, no-store' },
      });
      vaultAssert(put, 'VAULT_ARCHIVE_CONFLICT'); remote = { value: head, etag: put.etag };
    }
    return { remote, more: true };
  }
  /** Trusted explicit recovery only. Staged pages never become publicly readable. */
  restoreLatest(scope: VaultScope, maxEntries = 128): Promise<{ complete: boolean; sequence: number; target: number }> {
    return this.serialize(async () => {
      const name = scopeName(scope); vaultAssert(Number.isInteger(maxEntries) && maxEntries >= 1 && maxEntries <= 128, 'INVALID_INPUT');
      let restore = this.storage.state<Restore>('restore');
      if (!restore) vaultAssert(this.storage.count() === 0 && !this.storage.state<Meta>('meta'), 'VAULT_RESTORE_NOT_EMPTY');
      else vaultAssert(restore.target.scope === name, 'FORBIDDEN');
      const tail = await this.recoverTail(name, maxEntries), remote = tail.remote; vaultAssert(remote, 'VAULT_ARCHIVE_UNAVAILABLE');
      if (tail.more) return { complete: false, sequence: restore?.sequence ?? 0, target: remote.value.sequence };
      if (!restore) {
        restore = { target: remote.value, sequence: 0, digest: ZERO };
        const checkpoint = remote.value.checkpoint;
        if (checkpoint) {
          const saved = await this.read<{ snapshot: Snapshot; checksum: string }>(this.prefix(name) + `checkpoints/${sequenceName(checkpoint.sequence)}.json`, CHECKPOINT_LIMIT);
          vaultAssert(saved && saved.value.checksum === checkpoint.checksum && await vaultDigest(saved.value.snapshot) === checkpoint.checksum, 'VAULT_ARCHIVE_CORRUPT');
          const snapshot = saved.value.snapshot;
          vaultAssert(snapshot.scope === name && snapshot.version === 1 && snapshot.sequence === checkpoint.sequence && snapshot.sequence <= remote.value.sequence && snapshot.rows.length <= 128, 'VAULT_ARCHIVE_CORRUPT');
          restore.sequence = snapshot.sequence; restore.digest = snapshot.digest;
          this.storage.transaction(() => { this.storage.stage(snapshot.rows, name); this.storage.setState('restore', restore); });
        } else this.storage.setState('restore', restore);
      }
      vaultAssert(restore.target.scope === name, 'FORBIDDEN');
      // A concurrent authority may have advanced only forward; never recover an older tip.
      vaultAssert(remote.value.sequence >= restore.target.sequence, 'VAULT_ARCHIVE_CONFLICT');
      if (remote.value.sequence === restore.target.sequence) vaultAssert(remote.value.digest === restore.target.digest, 'VAULT_ARCHIVE_CONFLICT');
      restore.target = remote.value;
      for (let count = 0; count < maxEntries && restore.sequence < restore.target.sequence; count++) {
        const sequence = restore.sequence + 1;
        const saved = await this.read<{ journal: Journal; checksum: string }>(this.prefix(name) + `journal/${sequenceName(sequence)}.json`, ENTRY_LIMIT);
        vaultAssert(saved && await vaultDigest(saved.value.journal) === saved.value.checksum, 'VAULT_ARCHIVE_CORRUPT');
        const journal = saved.value.journal;
        vaultAssert(journal.version === 1 && journal.scope === name && journal.sequence === sequence && journal.previous === restore.digest && Array.isArray(journal.rows), 'VAULT_ARCHIVE_CORRUPT');
        restore.sequence = sequence; restore.digest = saved.value.checksum;
        this.storage.transaction(() => { this.storage.stage(journal.rows, name); this.storage.setState('restore', restore); });
      }
      if (restore.sequence === restore.target.sequence) {
        vaultAssert(restore.digest === restore.target.digest, 'VAULT_ARCHIVE_CORRUPT');
        const latest = (await this.recoverTail(name, 1)).remote; vaultAssert(latest && latest.value.sequence >= restore.sequence, 'VAULT_ARCHIVE_CONFLICT');
        if (latest.value.sequence > restore.sequence) { restore.target = latest.value; this.storage.setState('restore', restore); return { complete: false, sequence: restore.sequence, target: latest.value.sequence }; }
        vaultAssert(latest.value.digest === restore.digest && this.storage.raw('scope', true) === JSON.stringify(name), 'VAULT_ARCHIVE_CORRUPT');
        this.storage.transaction(() => {
          this.storage.durable.sql.exec('INSERT INTO vault_records SELECT key,data FROM vault_restore_records');
          this.storage.durable.sql.exec('DELETE FROM vault_restore_records');
          this.storage.setState('meta', { scope: name, sequence: restore!.sequence, archived: restore!.sequence, digest: restore!.digest } satisfies Meta);
          this.storage.clearState('restore');
        });
        return { complete: true, sequence: restore.sequence, target: restore.target.sequence };
      }
      return { complete: false, sequence: restore.sequence, target: restore.target.sequence };
    });
  }
}
