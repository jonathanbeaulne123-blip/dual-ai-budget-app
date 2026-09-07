import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { importReservationDigests, reservationDigest } from '../workers/ledgerReservations.ts';
import type { Scope } from '../src/ledgerSync/protocol.ts';

const scope: Scope = {environment:'development',householdId:'HH-reservations',memberId:'MEM-001',subject:'subject',role:'owner',expires:Date.now()+60000,aclEpoch:1};
const authority = '22222222-2222-2222-2222-222222222222';
const migration = (id: string) => readFileSync(new URL(`../supabase/migrations/${id}`,import.meta.url),'utf8');
afterEach(() => vi.restoreAllMocks());

it('imports every retained identity beyond the ring, including private and compacted commands, without returning private data', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA hearth_private; CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT '11111111-1111-1111-1111-111111111111'::uuid$$;
      CREATE FUNCTION hearth_private.own_member_id(text,text) RETURNS text LANGUAGE sql AS $$SELECT current_setting('test.actor')$$;
      CREATE FUNCTION hearth_private.is_household_owner(text,text) RETURNS boolean LANGUAGE sql AS $$SELECT true$$;
      CREATE TABLE schema_migrations(id integer primary key,applied_at text);
      CREATE TABLE households(id text primary key,environment text,revision integer);
      CREATE TABLE household_snapshots(household_id text primary key,environment text,payload text);
      CREATE TABLE continuity_personal_snapshots(environment text,household_id text,member_id text,payload text);
      CREATE TABLE continuity_command_events(household_id text,environment text,confirmation_id text,idempotency_key text,payload_json jsonb,member_id text,ledger_scope text);
      CREATE TABLE continuity_memberships(environment text,household_id text,member_id text,display_name text,google_subject text,google_email text,active boolean,revoked_at text,role text);
      INSERT INTO households VALUES('HH-reservations','development',301);
      INSERT INTO household_snapshots VALUES('HH-reservations','development','{"commandReceipts":[{"confirmationId":"AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA","postedIds":["PRIVATE-TXN"]}]}');
      INSERT INTO continuity_command_events SELECT 'HH-reservations','development','old-'||n,'key-'||n,
        '{"compactedConfirmationIds":["folded-one"],"compactedCommands":[{"confirmationId":"folded-two","postedIds":["PRIVATE-TXN"]}]}', 'MEM-002','personal' FROM generate_series(1,300) n;
      SET test.actor='MEM-001';`);
    await db.exec(migration('019_ledger_sync_v2_cutover.sql'));
    await db.query('SELECT claim_ledger_sync_v2($1,$2,$3,$4)',[scope.environment,scope.householdId,scope.memberId,authority]);
    await db.exec(migration('020_ledger_sync_reservations.sql'));
    const page = async (cursor: string | null, member='MEM-001', instance=authority) => (await db.query<{value:any}>(
      'SELECT ledger_sync_reservations_page($1,$2,$3,$4,$5,127) value',[scope.environment,scope.householdId,member,instance,cursor])).rows[0]!.value;
    let cursor: string | null = null; const digests: string[] = []; let first: any;
    do {
      const value = await page(cursor); first ??= value;
      expect(value.total).toBe(603);
      expect(value.manifestId).toBe(first.manifestId);
      expect(JSON.stringify(value)).not.toMatch(/PRIVATE-TXN|MEM-002|old-1|key-1|folded-one/);
      digests.push(...value.digests); cursor = value.next;
    } while(cursor);
    expect(new Set(digests).size).toBe(603);
    for (const identity of ['old-1','old-300','key-300','folded-one','folded-two','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']) {
      expect(digests).toContain(await reservationDigest(scope,identity));
    }
    await expect(page(null,'MEM-002')).rejects.toThrow('FORBIDDEN');
    await expect(page(null,'MEM-001','33333333-3333-3333-3333-333333333333')).rejects.toThrow('AUTHORITY_RECOVERY_REQUIRED');
    await expect(page('bad-cursor')).rejects.toThrow('INVALID_RESERVATION_PAGE');
    await db.exec("SET ROLE authenticated");
    await expect(db.query('SELECT * FROM hearth_private.ledger_reservation_digests')).rejects.toThrow();
    expect((await page(null)).manifestId).toBe(first.manifestId);
    await db.exec("RESET ROLE; SET test.actor='revoked'");
    await expect(page(null)).rejects.toThrow('FORBIDDEN');
  } finally { await db.close(); }
},30000);

describe('bounded manifest consumer', () => {
  const env={SUPABASE_URL:'https://example.test',SUPABASE_PUBLISHABLE_KEY:'test-publishable'};
  const value={version:1,manifestId:'manifest',authorityInstance:authority,sourceRevision:301,total:2,digests:['1'.repeat(64)],next:'1'.repeat(64),complete:false};
  it('verifies all pages before returning any reservation set', async () => {
    vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(Response.json(value)).mockResolvedValueOnce(Response.json({...value,digests:['2'.repeat(64)],next:null,complete:true}));
    expect(await importReservationDigests(env,scope,'test-session',authority)).toEqual(['1'.repeat(64),'2'.repeat(64)]);
  });
  it.each([
    {...value,manifestId:'changed'}, {...value,digests:['1'.repeat(64)]},
    {...value,digests:[],next:null,complete:true}, {...value,total:100001},
  ])('refuses changed, repeated, truncated or over-limit manifests', async second => {
    vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(Response.json(value)).mockResolvedValueOnce(Response.json(second));
    await expect(importReservationDigests(env,scope,'test-session',authority)).rejects.toThrow(/RESERVATION/);
  });
  it('fails closed when the migration is unavailable', async () => {
    vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('',{status:404}));
    await expect(importReservationDigests(env,scope,'test-session',authority)).rejects.toThrow('CONTROL_PLANE_UNAVAILABLE');
  });
});
