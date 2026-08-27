/**
 * Apply one numbered migration to the Development Supabase project via the
 * IPv4 session pooler. Requires SUPABASE_DB_PASSWORD or DATABASE_URL.
 * Never prints the password. Production apply is a separate Jonathan approval.
 *
 * Usage:
 *   SUPABASE_DB_PASSWORD=… pnpm books:apply:002
 *   node scripts/apply-supabase-migration.mjs 002
 */
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import postgres from "postgres";
import { PROJECT_REF, SQL_EDITOR, resolveApplyUrl } from "./supabase-connection.mjs";

/** Load a local .env if present without requiring --env-file. Never log values. */
function loadDotEnv() {
  const path = fileURLToPath(new URL("../.env", import.meta.url));
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadDotEnv();

const arg = String(process.argv[2] || "").trim();
if (!/^\d{3}$/.test(arg)) {
  console.error("Usage: apply-supabase-migration.mjs <NNN>   e.g. 002");
  process.exit(1);
}

const migrationsDir = fileURLToPath(new URL("../supabase/migrations/", import.meta.url));
const matches = readdirSync(migrationsDir).filter((name) => name.startsWith(`${arg}_`) && name.endsWith(".sql"));
if (!matches.length) {
  console.error(`No migration file starting with ${arg}_ in supabase/migrations/`);
  process.exit(1);
}
if (matches.length > 1) {
  console.error(`Ambiguous migration prefix ${arg}_ — rename so exactly one file matches:`);
  for (const name of matches) console.error(`  - ${name}`);
  process.exit(1);
}
const match = matches[0];

const migrationPath = `${migrationsDir}${match}`;
console.log(`Applying ${match} to project ${PROJECT_REF}…`);

let url;
try {
  url = resolveApplyUrl(process.env);
} catch (caught) {
  console.error(caught instanceof Error ? caught.message : String(caught));
  console.error(`Without a password, paste ${match} into ${SQL_EDITOR} and Run.`);
  process.exit(1);
}

const sql = postgres(url, {
  ssl: "require",
  max: 1,
  idle_timeout: 5,
  connect_timeout: 20,
  connection: { application_name: `hearth-apply-${arg}` },
});

try {
  await sql.file(migrationPath);
  if (arg === "002") {
    const cols = await sql`
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'household_snapshots'
        and column_name in ('revision', 'snapshot_hash')
      order by column_name
    `;
    const fn = await sql`
      select proname
      from pg_proc
      where pronamespace = 'public'::regnamespace
        and proname = 'publish_household_snapshot'
    `;
    console.log("household_snapshots columns:", cols.map((row) => row.column_name).join(", ") || "(missing)");
    console.log("function:", fn[0]?.proname || "(missing)");
  }
  if (arg === "012") {
    const fn = await sql`
      select proname, pg_catalog.pg_get_function_identity_arguments(oid) as args
      from pg_proc
      where pronamespace = 'public'::regnamespace
        and proname = 'publish_continuity_snapshot'
    `;
    console.log("function:", fn[0] ? `${fn[0].proname}(${fn[0].args})` : "(missing)");
  }
  if (arg === "013") {
    const table = await sql`
      select tablename
      from pg_tables
      where schemaname = 'public'
        and tablename = 'continuity_command_events'
    `;
    const fn = await sql`
      select proname, pg_catalog.pg_get_function_identity_arguments(oid) as args
      from pg_proc
      where pronamespace = 'public'::regnamespace
        and proname = 'append_continuity_command'
    `;
    console.log("table:", table[0]?.tablename || "(missing)");
    console.log("function:", fn[0] ? `${fn[0].proname}(${fn[0].args})` : "(missing)");
  }
  if (arg === "014") {
    const pubs = await sql`
      select schemaname, tablename
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename in ('household_snapshots', 'continuity_personal_snapshots')
      order by tablename
    `;
    console.log("supabase_realtime tables:", pubs.map((row) => `${row.schemaname}.${row.tablename}`).join(", ") || "(none)");
  }
  const ids = await sql`select id from public.schema_migrations order by id`;
  console.log("schema_migrations ids:", ids.map((row) => row.id).join(", ") || "(empty)");
  console.log(`applied ${match}`);
} catch (caught) {
  const message = caught instanceof Error ? caught.message : String(caught);
  console.error(`Could not apply ${match}:`, message);
  console.error(`Fallback: paste the file into ${SQL_EDITOR} and Run.`);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 2 });
}

process.exit(process.exitCode || 0);
