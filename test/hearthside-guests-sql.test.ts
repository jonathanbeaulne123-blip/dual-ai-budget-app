import {expect,it} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {readFileSync} from 'node:fs';
import {guestAuthorityAttestation} from '../workers/hearthsideGuestAuthority.ts';
it('executes source-only guest SQL with live own sessions, no host membership prerequisite, disabled server key and exact HMAC proof',async()=>{
 const db=new PGlite({extensions:{pgcrypto}}),alice='11111111-1111-4111-a111-111111111111',bob='22222222-2222-4222-a222-222222222222',cara='44444444-4444-4444-a444-444444444444',session='33333333-3333-4333-a333-333333333333',token='synthetic.user.jwt';
 const env={HEARTHSIDE_GUEST_AUTHORITY_KEY:'34'.repeat(32),HEARTHSIDE_GUEST_AUTHORITY_KEY_ID:'synthetic-key'};
 try{
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE SCHEMA hearth_private;
      CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid);
      CREATE TABLE public.continuity_memberships(environment text,household_id text,member_id text,auth_user_id uuid,active boolean,revoked_at timestamptz);
      CREATE TABLE public.hearth_member_sessions(environment text,household_id text,member_id text,auth_user_id uuid,session_id uuid,revoked_at timestamptz);
      CREATE TABLE hearth_private.ledger_sync_cutovers(environment text,household_id text,deleted_at timestamptz);
      CREATE TABLE public.schema_migrations(id integer PRIMARY KEY,applied_at text);
      CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT (auth.jwt()->>'sub')::uuid$$;
      INSERT INTO auth.users VALUES('${alice}'),('${bob}'),('${cara}'); INSERT INTO auth.sessions VALUES('${session}','${alice}');
      INSERT INTO public.continuity_memberships VALUES('development','HH-AUDIENCE','MEM-A','${alice}',true,null),
        ('development','HH-AUDIENCE','MEM-B','${bob}',true,null),('development','HH-AUDIENCE','MEM-UNBOUND',null,true,null),
        ('development','HH-OTHER','MEM-OTHER','${bob}',true,null);`);
    const canonical = readFileSync('supabase/migrations/017_shared_money_membership_sessions.sql', 'utf8');
    for (const name of ['current_session_id', 'session_is_live', 'membership_session_allowed', 'own_member_id']) {
      const definition = canonical.match(new RegExp(`CREATE OR REPLACE FUNCTION hearth_private\\.${name}\\([\\s\\S]*?\\$\\$;`))?.[0];
      expect(definition, name).toBeDefined(); await db.exec(definition!);
    }

  await db.exec(readFileSync('supabase/migrations/024_hearthside_guest_authority.sql','utf8'));
  expect((await db.query('SELECT * FROM hearth_private.guest_authority_keys')).rows).toEqual([]);
  await db.query('SELECT set_config($1,$2,false)',['request.jwt.claims',JSON.stringify({sub:alice,session_id:session})]);
  await db.query('SELECT set_config($1,$2,false)',['request.headers',JSON.stringify({authorization:`Bearer ${token}`})]);
  type Signed=Awaited<ReturnType<typeof guestAuthorityAttestation>>;
  const query=(r:Signed)=>db.query<{value:{subject:string;actorMemberId:string|null;principals:{memberId:string;subject:string}[]}}>('SELECT public.hearthside_guest_authority($1,$2,$3,$4,$5,$6) AS value',[r.p_environment,r.p_household_id,r.p_key_id,r.p_issued_at,r.p_token_sha256,r.p_signature]);
  const signed=(hh:string|null='HH-AUDIENCE')=>guestAuthorityAttestation(env,token,hh);
  await db.exec('SET ROLE authenticated');
  await expect(query(await signed())).rejects.toThrow('GUEST_AUTHORITY_DENIED');
  await expect(db.query('SELECT * FROM hearth_private.guest_authority_keys')).rejects.toThrow(/permission denied/);
  await db.exec('RESET ROLE');
  await db.query("INSERT INTO hearth_private.guest_authority_keys(key_id,environment,secret,expires_at) VALUES($1,'development',decode($2,'hex'),clock_timestamp()+interval '1 day')",['synthetic-key',env.HEARTHSIDE_GUEST_AUTHORITY_KEY]);
  await db.exec('SET ROLE authenticated');await expect(query(await signed())).rejects.toThrow('GUEST_AUTHORITY_DENIED');
  await db.exec('RESET ROLE; UPDATE hearth_private.guest_authority_keys SET enabled=true; SET ROLE authenticated');
  expect((await query(await signed())).rows[0]!.value).toMatchObject({subject:alice,actorMemberId:'MEM-A',principals:[{memberId:'MEM-A',subject:alice},{memberId:'MEM-B',subject:bob}]});
  for(const changed of [{p_signature:'0'.repeat(64)},{p_household_id:'HH-OTHER'},{p_environment:'production'},{p_token_sha256:'0'.repeat(64)},{p_key_id:'missing'},{p_issued_at:Math.floor(Date.now()/1000)-31},{p_issued_at:Math.floor(Date.now()/1000)+10}])await expect(query({...await signed(),...changed} as Signed)).rejects.toThrow('GUEST_AUTHORITY_DENIED');
  await db.exec(`RESET ROLE; UPDATE auth.sessions SET user_id='${cara}'; SET ROLE authenticated`);
  await db.query('SELECT set_config($1,$2,false)',['request.jwt.claims',JSON.stringify({sub:cara,session_id:session})]);
  expect((await query(await signed(null))).rows[0]!.value).toMatchObject({subject:cara,actorMemberId:null,principals:[]});
  expect((await query(await signed())).rows[0]!.value).toMatchObject({subject:cara,actorMemberId:null,principals:[{memberId:'MEM-A',subject:alice},{memberId:'MEM-B',subject:bob}]});
  await db.exec(`RESET ROLE; UPDATE public.continuity_memberships SET auth_user_id='${cara}' WHERE member_id='MEM-B'; SET ROLE authenticated`);
  expect((await query(await signed())).rows[0]!.value.principals[1]!.subject).toBe(cara);
  await db.exec(`RESET ROLE; UPDATE public.continuity_memberships SET revoked_at=clock_timestamp() WHERE member_id='MEM-B'; SET ROLE authenticated`);
  await expect(query(await signed())).rejects.toThrow('GUEST_AUTHORITY_DENIED');
  await db.exec('RESET ROLE; DELETE FROM auth.sessions; SET ROLE authenticated');
  await expect(query(await signed(null))).rejects.toThrow('GUEST_AUTHORITY_DENIED');
  await db.exec('RESET ROLE; SET ROLE anon');await expect(query(await signed(null))).rejects.toThrow(/permission denied/);
 }finally{await db.close();}
},45000);
