import { expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'node:fs';
import { vaultAudienceRequest, type VaultAudienceEnv } from '../workers/hearthsideVaultAudience.ts';
import type { Scope } from '../src/ledgerSync/protocol.ts';

it('executes the prepared audience SQL with real crypto and canonical session helpers under unprivileged roles', async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  const alice = '11111111-1111-4111-a111-111111111111', bob = '22222222-2222-4222-a222-222222222222';
  const session = '33333333-3333-4333-a333-333333333333', token = 'synthetic.user.jwt';
  const scope: Scope = { environment: 'development', householdId: 'HH-AUDIENCE', memberId: 'MEM-A', subject: alice, role: 'owner', aclEpoch: 1, expires: Date.now() + 600_000 };
  const env: VaultAudienceEnv = { SUPABASE_URL: 'https://synthetic.test', SUPABASE_PUBLISHABLE_KEY: 'synthetic',
    HEARTHSIDE_VAULT_AUTHORITY_KEY_ID: 'synthetic-key', HEARTHSIDE_VAULT_AUTHORITY_KEY: '34'.repeat(32) };
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE SCHEMA hearth_private;
      CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid);
      CREATE TABLE public.continuity_memberships(environment text,household_id text,member_id text,auth_user_id uuid,active boolean,revoked_at timestamptz);
      CREATE TABLE public.hearth_member_sessions(environment text,household_id text,member_id text,auth_user_id uuid,session_id uuid,revoked_at timestamptz);
      CREATE TABLE hearth_private.ledger_sync_cutovers(environment text,household_id text,deleted_at timestamptz);
      CREATE TABLE public.schema_migrations(id integer PRIMARY KEY,applied_at text);
      CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT (auth.jwt()->>'sub')::uuid$$;
      INSERT INTO auth.users VALUES('${alice}'),('${bob}'); INSERT INTO auth.sessions VALUES('${session}','${alice}');
      INSERT INTO public.continuity_memberships VALUES('development','HH-AUDIENCE','MEM-A','${alice}',true,null),
        ('development','HH-AUDIENCE','MEM-B','${bob}',true,null),('development','HH-AUDIENCE','MEM-UNBOUND',null,true,null),
        ('development','HH-OTHER','MEM-OTHER','${bob}',true,null);`);
    const canonical = readFileSync('supabase/migrations/017_shared_money_membership_sessions.sql', 'utf8');
    for (const name of ['current_session_id', 'session_is_live', 'membership_session_allowed', 'own_member_id']) {
      const definition = canonical.match(new RegExp(`CREATE OR REPLACE FUNCTION hearth_private\\.${name}\\([\\s\\S]*?\\$\\$;`))?.[0];
      expect(definition, name).toBeDefined(); await db.exec(definition!);
    }
    await db.exec(readFileSync('supabase/migrations/023_hearthside_vault_audience.sql', 'utf8'));
    expect((await db.query('SELECT * FROM hearth_private.vault_authority_keys')).rows).toEqual([]);
    await db.query('SELECT set_config($1,$2,false)', ['request.jwt.claims', JSON.stringify({ sub: alice, session_id: session })]);
    await db.query('SELECT set_config($1,$2,false)', ['request.headers', JSON.stringify({ authorization: `Bearer ${token}` })]);
    type SignedRequest = Awaited<ReturnType<typeof vaultAudienceRequest>>;
    const query = (r: SignedRequest) => db.query<{ value: { principals: { memberId: string; subject: string }[] } }>(
      'SELECT public.hearthside_vault_audience($1,$2,$3,$4,$5,$6,$7,$8) AS value',
      [r.p_environment, r.p_household_id, r.p_member_id, r.p_subject, r.p_key_id, r.p_issued_at, r.p_token_sha256, r.p_signature]);
    const signed = () => vaultAudienceRequest(env, scope, token);
    await db.exec('SET ROLE authenticated');
    await expect(query(await signed())).rejects.toThrow('VAULT_AUTHORITY_DENIED');
    await expect(db.query('SELECT * FROM hearth_private.vault_authority_keys')).rejects.toThrow(/permission denied/);
    await db.exec('RESET ROLE');
    await db.query('INSERT INTO hearth_private.vault_authority_keys(key_id,environment,secret,expires_at) VALUES($1,$2,decode($3,\'hex\'),clock_timestamp()+interval \'1 day\')',
      ['synthetic-key', 'development', env.HEARTHSIDE_VAULT_AUTHORITY_KEY]);
    await db.exec('SET ROLE authenticated');
    await expect(query(await signed())).rejects.toThrow('VAULT_AUTHORITY_DENIED');
    await db.exec('RESET ROLE; UPDATE hearth_private.vault_authority_keys SET enabled=true; SET ROLE authenticated');
    expect((await query(await signed())).rows[0]!.value.principals).toEqual([{ memberId: 'MEM-A', subject: alice }, { memberId: 'MEM-B', subject: bob }]);
    for (const changed of [
      { p_signature: '0'.repeat(64) }, { p_member_id: 'MEM-B' }, { p_subject: bob }, { p_household_id: 'HH-OTHER' },
      { p_environment: 'production' }, { p_token_sha256: '0'.repeat(64) }, { p_key_id: 'missing-key' },
      { p_issued_at: Math.floor(Date.now() / 1000) - 31 }, { p_issued_at: Math.floor(Date.now() / 1000) + 10 },
    ]) await expect(query({ ...await signed(), ...changed } as SignedRequest)).rejects.toThrow('VAULT_AUTHORITY_DENIED');
    await db.exec('RESET ROLE; SET ROLE anon'); await expect(query(await signed())).rejects.toThrow(/permission denied/);
    await db.exec(`RESET ROLE; UPDATE public.continuity_memberships SET revoked_at=clock_timestamp() WHERE member_id='MEM-B'; SET ROLE authenticated`);
    expect((await query(await signed())).rows[0]!.value.principals).toEqual([{ memberId: 'MEM-A', subject: alice }]);
    await db.exec(`RESET ROLE; INSERT INTO public.hearth_member_sessions VALUES('development','HH-AUDIENCE','MEM-A','${alice}','${session}',clock_timestamp()); SET ROLE authenticated`);
    await expect(query(await signed())).rejects.toThrow('VAULT_AUTHORITY_DENIED');
    await db.exec('RESET ROLE; DELETE FROM public.hearth_member_sessions; DELETE FROM auth.sessions; SET ROLE authenticated');
    await expect(query(await signed())).rejects.toThrow('VAULT_AUTHORITY_DENIED');
    await db.exec(`RESET ROLE; INSERT INTO auth.sessions VALUES('${session}','${alice}'); UPDATE public.continuity_memberships SET active=false WHERE member_id='MEM-A'; SET ROLE authenticated`);
    await expect(query(await signed())).rejects.toThrow('VAULT_AUTHORITY_DENIED');
    await db.exec(`RESET ROLE; UPDATE public.continuity_memberships SET active=true WHERE member_id='MEM-A'; INSERT INTO hearth_private.ledger_sync_cutovers VALUES('development','HH-AUDIENCE',clock_timestamp()); SET ROLE authenticated`);
    await expect(query(await signed())).rejects.toThrow('VAULT_AUTHORITY_DENIED');
    await db.exec(`RESET ROLE; DELETE FROM hearth_private.ledger_sync_cutovers; UPDATE hearth_private.vault_authority_keys SET expires_at=clock_timestamp()-interval '1 second',not_before=clock_timestamp()-interval '1 hour'; SET ROLE authenticated`);
    await expect(query(await signed())).rejects.toThrow('VAULT_AUTHORITY_DENIED');
  } finally { await db.close(); }
}, 45_000);
