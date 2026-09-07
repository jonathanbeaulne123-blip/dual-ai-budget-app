import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { it, expect } from "vitest";
const sql = readFileSync(
  new URL(
    "../supabase/migrations/019_ledger_sync_v2_cutover.sql",
    import.meta.url,
  ),
  "utf8",
);
it("fences every old financial writer and keeps import Personal scope bound to the live session", async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA hearth_private; CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT '11111111-1111-1111-1111-111111111111'::uuid$$;
 CREATE FUNCTION hearth_private.own_member_id(text,text) RETURNS text LANGUAGE sql AS $$SELECT current_setting('test.actor')$$;
 CREATE FUNCTION hearth_private.is_household_owner(text,text) RETURNS boolean LANGUAGE sql AS $$SELECT true$$;
 CREATE TABLE public.schema_migrations(id integer primary key,applied_at text not null);
 CREATE TABLE public.households(id text primary key,environment text,revision integer);
 CREATE TABLE public.household_snapshots(household_id text primary key,environment text,payload text);
 CREATE TABLE public.continuity_personal_snapshots(environment text,household_id text,member_id text,payload text);
 CREATE TABLE public.continuity_command_events(household_id text,environment text);
 CREATE TABLE public.continuity_memberships(environment text,household_id text,member_id text,display_name text,google_subject text,google_email text,active boolean,revoked_at text,role text);
 INSERT INTO households VALUES('HH-test','development',7);
 INSERT INTO household_snapshots VALUES('HH-test','development','shared-frozen');
 INSERT INTO continuity_personal_snapshots VALUES('development','HH-test','MEM-001','private-one'),('development','HH-test','MEM-002','private-two');
 SET test.actor='MEM-001';`);
    await db.exec(sql);
    const claimed = await db.query<{
      value: { shared: string; personal: string };
    }>(
      "SELECT claim_ledger_sync_v2('development','HH-test','MEM-001','22222222-2222-2222-2222-222222222222') value",
    );
    expect(claimed.rows[0]?.value).toEqual({
      shared: "shared-frozen",
      personal: "private-one",
    });
    for (const mutation of [
      "UPDATE households SET revision=8 WHERE id='HH-test'",
      "UPDATE household_snapshots SET payload='stale' WHERE household_id='HH-test'",
      "UPDATE continuity_personal_snapshots SET payload='stale' WHERE household_id='HH-test'",
      "INSERT INTO continuity_command_events VALUES('HH-test','development')",
      "DELETE FROM households WHERE id='HH-test'",
    ])
      await expect(db.exec(mutation)).rejects.toThrow(
        "LEDGER_SYNC_V2_REQUIRED",
      );
    await expect(
      db.query(
        "SELECT claim_ledger_sync_v2('development','HH-test','MEM-002','22222222-2222-2222-2222-222222222222')",
      ),
    ).rejects.toThrow("FORBIDDEN");
    await db.exec("SET test.actor='MEM-002'");
    const repeated = await db.query<{
      value: { shared: string; personal: string };
    }>(
      "SELECT claim_ledger_sync_v2('development','HH-test','MEM-002','22222222-2222-2222-2222-222222222222') value",
    );
    expect(repeated.rows[0]?.value.personal).toBe("private-two");
    await expect(
      db.query(
        "SELECT claim_ledger_sync_v2('development','HH-test','MEM-002','33333333-3333-3333-3333-333333333333')",
      ),
    ).rejects.toThrow("AUTHORITY_RECOVERY_REQUIRED");
    await db.exec(sql); // migration rerun preserves the fence and frozen source
    expect(
      (await db.query("SELECT * FROM hearth_private.ledger_sync_cutovers"))
        .rows,
    ).toHaveLength(1);
  } finally {
    await db.close();
  }
}, 30000);

it("creates one authenticated bootstrap and makes deletion idempotent without allowing another owner identity to resurrect it", async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;CREATE SCHEMA hearth_private;
   CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT current_setting('test.uid')::uuid$$;
   CREATE TABLE auth.identities(user_id uuid,provider text,provider_id text,identity_data jsonb);
   CREATE TABLE schema_migrations(id integer primary key,applied_at text);
   CREATE TABLE households(id text primary key,name text,timezone text,currency text,environment text,invite_phrase text,linked boolean,revision integer,last_committed_at text);
   CREATE TABLE household_snapshots(household_id text primary key references households(id) on delete cascade,invite_phrase text,environment text,payload text,updated_at text,revision integer,snapshot_hash text);
   CREATE TABLE continuity_personal_snapshots(environment text,household_id text references households(id) on delete cascade,member_id text,payload text);
   CREATE TABLE continuity_command_events(household_id text references households(id) on delete cascade,environment text);
   CREATE TABLE continuity_memberships(environment text,household_id text references households(id) on delete cascade,member_id text,google_subject text,google_email text,display_name text,active boolean,updated_at text,auth_user_id uuid,role text,revoked_at text);
   CREATE FUNCTION hearth_private.own_member_id(text,text) RETURNS text LANGUAGE sql AS $$SELECT member_id FROM public.continuity_memberships WHERE household_id=$1 AND environment=$2 AND auth_user_id=auth.uid() AND active AND revoked_at IS NULL$$;
   CREATE FUNCTION hearth_private.is_household_owner(text,text) RETURNS boolean LANGUAGE sql AS $$SELECT EXISTS(SELECT 1 FROM public.continuity_memberships WHERE household_id=$1 AND environment=$2 AND auth_user_id=auth.uid() AND active AND revoked_at IS NULL AND role='owner')$$;
   INSERT INTO auth.identities VALUES('11111111-1111-1111-1111-111111111111','google','google-one','{"email":"one@example.test"}'),('22222222-2222-2222-2222-222222222222','google','google-two','{"email":"two@example.test"}');
   SET test.uid='11111111-1111-1111-1111-111111111111';`);
    for (const [file, name] of [
      ["006_auth_rls_cutover.sql", "payload_is_shared"],
      ["012_publish_continuity_snapshot.sql", "payload_is_member_personal"],
    ]) {
      const source = readFileSync(
        new URL(`../supabase/migrations/${file}`, import.meta.url),
        "utf8",
      );
      const start = source.indexOf(
          `CREATE OR REPLACE FUNCTION hearth_private.${name}(`,
        ),
        end = source.indexOf("$$;", start) + 3;
      await db.exec(source.slice(start, end));
    }
    await db.exec(sql);
    const { catalogHousehold, splitForSync } = await import(
      "../src/core/index.ts"
    );
    const h = {
        ...catalogHousehold(),
        householdId: "HH-SQL-CREATE",
        revision: 0,
        baseRevision: 0,
      },
      parts = splitForSync(h, "MEM-001"),
      instance = "33333333-3333-3333-3333-333333333333";
    const create = () =>
      db.query<{ value: { created: boolean } }>(
        "SELECT create_ledger_sync_v2($1,$2,$3,$4::jsonb,$5::jsonb) value",
        [
          h.householdId,
          "MEM-001",
          instance,
          JSON.stringify(parts.shared),
          JSON.stringify(parts.personal),
        ],
      );
    expect((await create()).rows[0]?.value.created).toBe(true);
    expect((await create()).rows[0]?.value.created).toBe(true);
    expect((await db.query("SELECT * FROM households")).rows).toHaveLength(1);
    await db.exec("SET test.uid='22222222-2222-2222-2222-222222222222'");
    await expect(create()).rejects.toThrow("HOUSEHOLD_ALREADY_EXISTS");
    await expect(
      db.query("SELECT delete_ledger_sync_v2('HH-SQL-CREATE')"),
    ).rejects.toThrow("FORBIDDEN");
    await db.exec("SET test.uid='11111111-1111-1111-1111-111111111111'");
    expect(
      (
        await db.query<{ value: { deleted: boolean } }>(
          "SELECT delete_ledger_sync_v2('HH-SQL-CREATE') value",
        )
      ).rows[0]?.value.deleted,
    ).toBe(true);
    expect((await db.query("SELECT * FROM households")).rows).toHaveLength(0);
    expect(
      (
        await db.query(
          "SELECT * FROM hearth_private.ledger_sync_personal_imports",
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query<{ shared_payload: string }>(
          "SELECT shared_payload FROM hearth_private.ledger_sync_cutovers",
        )
      ).rows[0]?.shared_payload,
    ).toBe("{}");
    await db.query("SELECT delete_ledger_sync_v2('HH-SQL-CREATE')");
    await expect(create()).rejects.toThrow("LEDGER_DELETED");
  } finally {
    await db.close();
  }
}, 30000);
