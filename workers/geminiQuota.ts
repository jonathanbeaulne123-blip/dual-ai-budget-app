import { DurableObject } from 'cloudflare:workers';
import { nextPacificDay, pacificDay, quotaDecision, readFreeQuotaConfig, requestDigest } from './geminiFree.js';

/** One object per Google project; stores usage metadata, never conversation text. */
export class HerculesGeminiQuota extends DurableObject<Record<string, string>> {
  constructor(ctx: DurableObjectState, env: Record<string, string>) {
    super(ctx, env);
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS requests (id TEXT PRIMARY KEY, model TEXT NOT NULL, tokens INTEGER NOT NULL, digest TEXT NOT NULL, at INTEGER NOT NULL, day TEXT NOT NULL)');
    ctx.storage.sql.exec('CREATE INDEX IF NOT EXISTS requests_usage ON requests(model,at)');
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS active_attempts (id TEXT PRIMARY KEY, attempt TEXT NOT NULL, expires INTEGER NOT NULL)');
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS quota_state (id TEXT PRIMARY KEY, value INTEGER NOT NULL)');
  }
  async begin(id: string) {
    readFreeQuotaConfig(this.env);
    if (!/^[a-f0-9]{64}$/.test(id)) return { ok: false, code: 'GEMINI_FREE_INVALID_REQUEST' };
    return this.ctx.storage.transactionSync(() => {
      const now = Date.now(), sql = this.ctx.storage.sql;
      const active = sql.exec<{expires:number}>('SELECT expires FROM active_attempts WHERE id=?', id).toArray()[0];
      if (active && active.expires > now) return {ok:false,code:'GEMINI_FREE_ATTEMPT_IN_PROGRESS'};
      const attempt = crypto.randomUUID();
      sql.exec('INSERT OR REPLACE INTO active_attempts VALUES (?,?,?)', id, attempt, now + 180000);
      sql.exec('DELETE FROM active_attempts WHERE expires<?', now - 86400000);
      return {ok:true,attempt};
    });
  }
  async release(id:string, attempt:string) {
    const held = await requestDigest(id + ':' + attempt) + ':hold';
    this.ctx.storage.transactionSync(() => {
      this.ctx.storage.sql.exec('DELETE FROM active_attempts WHERE id=? AND attempt=?', id, attempt);
      this.ctx.storage.sql.exec('DELETE FROM requests WHERE id=?', held);
    });
  }
  async reserve(request: { id: string; model: string; tokens: number; digest: string }) {
    const now = Date.now(), config = readFreeQuotaConfig(this.env, now);
    if (!/^[a-f0-9]{64}:(count|generate)$/.test(request.id) || !/^[a-f0-9]{64}$/.test(request.digest)) return { ok: false, code: 'GEMINI_FREE_INVALID_REQUEST' };
    return this.ctx.storage.transactionSync(() => {
      const sql = this.ctx.storage.sql;
      const paused = sql.exec<{ value: number }>("SELECT value FROM quota_state WHERE id='paused'").toArray()[0]?.value ?? 0;
      if (paused > now) return { ok: false, code: 'GEMINI_FREE_PROVIDER_LIMIT', retryAt: paused };
      if (sql.exec('SELECT id FROM requests WHERE id=?', request.id).toArray().length) return { ok: false, code: 'GEMINI_FREE_DUPLICATE_ATTEMPT' };
      const counting = request.id.endsWith(':count'), held = request.id.split(':')[0] + ':hold';
      const excluded = counting ? '' : held;
      const recent = sql.exec<{ at: number; tokens: number }>('SELECT at,tokens FROM requests WHERE model=? AND at>? AND id<>? ORDER BY at', request.model, now - 65000, excluded).toArray();
      const daily = sql.exec<{ count: number }>('SELECT COUNT(*) AS count FROM requests WHERE model=? AND day=? AND id<>?', request.model, pacificDay(now), excluded).one().count;
      // Hold the second request slot before counting. Generation replaces this
      // known-undispatched hold with its actual timestamp and exact token debit.
      const result = quotaDecision(config, request.model, request.tokens, counting ? [...recent, {at:now,tokens:0}] : recent, daily + (counting ? 1 : 0), now);
      if (!result.ok) return result;
      if (!counting) sql.exec('DELETE FROM requests WHERE id=?', held);
      sql.exec('INSERT INTO requests VALUES (?,?,?,?,?,?)', request.id, request.model, request.tokens, request.digest, now, pacificDay(now));
      if (counting) sql.exec('INSERT INTO requests VALUES (?,?,?,?,?,?)', held, request.model, 0, request.digest, now + 65000, pacificDay(now));
      // Retain identities beyond any 24h run-grant lifetime. No uncertain refund.
      sql.exec('DELETE FROM requests WHERE at<?', now - 7 * 86400000);
      return { ok: true };
    });
  }
  async pauseUntilReset() {
    this.ctx.storage.sql.exec("INSERT OR REPLACE INTO quota_state VALUES ('paused',?)", nextPacificDay(Date.now()));
  }
}
