import type { DurableObjectStorage } from '@cloudflare/workers-types';
import { decodePreparedExperienceArtifact } from '../../src/hearthside/workspacePublication.ts';
import { workspaceId, workspaceText } from '../../src/workspace/contracts.ts';

export type SharedCopyFamily = 'owner' | 'legacy' | 'experience';
export type SharedCopyRow = { family: SharedCopyFamily; id: string; data: string };
export type SharedArchiveMeta = { scope: string; sequence: number; archived: number; digest: string };
export const SHARED_ROW_BYTES = 4 * 1024 * 1024;
export const ZERO_DIGEST = '0'.repeat(64);
export function archiveAssert(value: unknown, code = 'SHARED_ARCHIVE_CORRUPT'): asserts value {
  if (!value) throw new Error(code);
}
export function archiveParse<T>(data: string): T {
  try { return JSON.parse(data) as T; } catch { throw new Error('SHARED_ARCHIVE_CORRUPT'); }
}
export function sharedScopeName(scope: { environment: string; householdId: string }): string {
  archiveAssert(scope.environment === 'development' && /^HH-[A-Za-z0-9_-]{1,96}$/.test(scope.householdId), 'INVALID_SCOPE');
  return `${scope.environment}/${scope.householdId}`;
}
export function validateSharedRow(row: SharedCopyRow, scope: string): void {
  archiveAssert(row && ['owner', 'legacy', 'experience'].includes(row.family) && typeof row.data === 'string' && new TextEncoder().encode(row.data).length <= SHARED_ROW_BYTES);
  try {
    const value = archiveParse<Record<string, unknown>>(row.data);
    if (row.family === 'owner') { archiveAssert(row.id === 'owner' && value === (scope as unknown)); return; }
    workspaceId(row.id);
    if (row.family === 'experience') { archiveAssert(decodePreparedExperienceArtifact(value).id === row.id); return; }
    archiveAssert(Object.keys(value).sort().join(',') === 'content,format,id,sharedAt,sharedBy,title' && value.id === row.id);
    workspaceText(value.title, 180); workspaceText(value.content, 500000);
    archiveAssert(['markdown', 'html', 'csv', 'python', 'json'].includes(String(value.format)) && typeof value.sharedBy === 'string' && value.sharedBy.length > 0 && typeof value.sharedAt === 'string' && Number.isFinite(Date.parse(value.sharedAt)));
  } catch { throw new Error('SHARED_ARCHIVE_CORRUPT'); }
}
export function validateSharedTransition(old: string | undefined, row: SharedCopyRow): void {
  if (old === undefined || old === row.data) return;
  archiveAssert(row.family === 'experience');
  const before = decodePreparedExperienceArtifact(archiveParse(old)), after = decodePreparedExperienceArtifact(archiveParse(row.data));
  archiveAssert(before.contentDigest === after.contentDigest);
  const rank = { prepared: 0, active: 1, withdrawn: 2 };
  archiveAssert(rank[after.state] >= rank[before.state]);
}

/** Existing shared-copy tables remain authoritative. Every change and its recovery
 * outbox row are committed in the same SQLite transaction. No Agent broadcast. */
export class SharedWorkspaceArchiveStorage {
  constructor(readonly durable: DurableObjectStorage) {
    durable.sql.exec('CREATE TABLE IF NOT EXISTS shared_archive_state (key TEXT PRIMARY KEY,data TEXT NOT NULL)');
    durable.sql.exec('CREATE TABLE IF NOT EXISTS shared_archive_outbox (sequence INTEGER PRIMARY KEY,family TEXT NOT NULL,id TEXT NOT NULL,data TEXT NOT NULL)');
    durable.sql.exec('CREATE TABLE IF NOT EXISTS shared_archive_restore (family TEXT NOT NULL,id TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(family,id))');
  }
  transaction<T>(action: () => T): T { return this.durable.transactionSync(action); }
  state<T>(key: string): T | undefined {
    const row = this.durable.sql.exec<{ data: string }>('SELECT data FROM shared_archive_state WHERE key=?', key).toArray()[0];
    return row ? archiveParse<T>(row.data) : undefined;
  }
  setState(key: string, value: unknown): void {
    this.durable.sql.exec('INSERT INTO shared_archive_state VALUES(?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data', key, JSON.stringify(value));
  }
  clearState(key: string): void { this.durable.sql.exec('DELETE FROM shared_archive_state WHERE key=?', key); }
  raw(family: SharedCopyFamily, id: string, staged = false): string | undefined {
    if (staged) return this.durable.sql.exec<{ data: string }>('SELECT data FROM shared_archive_restore WHERE family=? AND id=?', family, id).toArray()[0]?.data;
    if (family === 'owner') {
      const row = this.durable.sql.exec<{ id: string }>('SELECT id FROM shared_workspace_owner').toArray()[0];
      return row ? JSON.stringify(row.id) : undefined;
    }
    const table = family === 'legacy' ? 'shared_workspace_artifacts' : 'shared_experience_artifacts';
    return this.durable.sql.exec<{ data: string }>(`SELECT data FROM ${table} WHERE id=?`, id).toArray()[0]?.data;
  }
  *rows(): Generator<SharedCopyRow> {
    const owner = this.raw('owner', 'owner'); if (owner) yield { family: 'owner', id: 'owner', data: owner };
    for (const family of ['legacy', 'experience'] as const) {
      const table = family === 'legacy' ? 'shared_workspace_artifacts' : 'shared_experience_artifacts';
      for (const row of this.durable.sql.exec<{ id: string; data: string }>(`SELECT id,data FROM ${table} ORDER BY id`)) yield { family, ...row };
    }
  }
  count(): number {
    return this.durable.sql.exec<{ n: number }>('SELECT (SELECT count(*) FROM shared_workspace_owner)+(SELECT count(*) FROM shared_workspace_artifacts)+(SELECT count(*) FROM shared_experience_artifacts) AS n').toArray()[0]!.n;
  }
  private insert(row: SharedCopyRow): void {
    if (row.family === 'owner') { this.durable.sql.exec('INSERT OR IGNORE INTO shared_workspace_owner VALUES(?)', archiveParse<string>(row.data)); return; }
    const table = row.family === 'legacy' ? 'shared_workspace_artifacts' : 'shared_experience_artifacts';
    this.durable.sql.exec(`INSERT INTO ${table} VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data`, row.id, row.data);
  }
  /** Bootstrap ownership, adopted rows and their outbox atomically. A failed owner
   * insert must not leave metadata that makes a later retry skip ownership. */
  initialize(scope: string): SharedArchiveMeta {
    return this.transaction(() => {
      archiveAssert(!this.state('meta') && !this.state('restore'), 'SHARED_RESTORE_REQUIRED');
      const owner = this.raw('owner', 'owner');
      archiveAssert(!owner || owner === JSON.stringify(scope), 'FORBIDDEN');
      const meta: SharedArchiveMeta = { scope, sequence: 0, archived: 0, digest: ZERO_DIGEST };
      for (const row of this.rows()) { validateSharedRow(row, scope); this.enqueue(row, meta); }
      if (!owner) {
        const row: SharedCopyRow = { family: 'owner', id: 'owner', data: JSON.stringify(scope) };
        validateSharedRow(row, scope); this.insert(row); this.enqueue(row, meta);
      }
      this.setState('meta', meta);
      return meta;
    });
  }
  enqueue(row: SharedCopyRow, meta: SharedArchiveMeta): void {
    meta.sequence++; archiveAssert(Number.isSafeInteger(meta.sequence));
    this.durable.sql.exec('INSERT INTO shared_archive_outbox VALUES(?,?,?,?)', meta.sequence, row.family, row.id, row.data);
  }
  put(family: SharedCopyFamily, id: string, value: unknown): void {
    this.transaction(() => {
      const meta = this.state<SharedArchiveMeta>('meta'); archiveAssert(meta && !this.state('restore'), 'SHARED_RESTORE_REQUIRED');
      const row = { family, id, data: JSON.stringify(value) }; validateSharedRow(row, meta.scope);
      const before = this.raw(family, id); if (before === row.data) return;
      validateSharedTransition(before, row); this.insert(row); this.enqueue(row, meta); this.setState('meta', meta);
    });
  }
  pending(sequence: number): SharedCopyRow {
    const row = this.durable.sql.exec<SharedCopyRow>('SELECT family,id,data FROM shared_archive_outbox WHERE sequence=?', sequence).toArray()[0];
    archiveAssert(row); return row;
  }
  acknowledge(sequence: number, digest: string): void {
    this.transaction(() => {
      const meta = this.state<SharedArchiveMeta>('meta')!;
      archiveAssert(sequence === meta.archived + 1 && sequence <= meta.sequence);
      meta.archived = sequence; meta.digest = digest; this.setState('meta', meta);
      this.durable.sql.exec('DELETE FROM shared_archive_outbox WHERE sequence<=?', sequence);
    });
  }
  stage(rows: SharedCopyRow[], scope: string): void {
    for (const row of rows) {
      validateSharedRow(row, scope); validateSharedTransition(this.raw(row.family, row.id, true), row);
      this.durable.sql.exec('INSERT INTO shared_archive_restore VALUES(?,?,?) ON CONFLICT(family,id) DO UPDATE SET data=excluded.data', row.family, row.id, row.data);
    }
  }
  finishRestore(meta: SharedArchiveMeta): void {
    this.transaction(() => {
      archiveAssert(this.count() === 0, 'SHARED_RESTORE_NOT_EMPTY');
      for (const row of this.durable.sql.exec<SharedCopyRow>('SELECT family,id,data FROM shared_archive_restore ORDER BY family,id')) this.insert(row);
      this.durable.sql.exec('DELETE FROM shared_archive_restore'); this.setState('meta', meta); this.clearState('restore');
    });
  }
}
