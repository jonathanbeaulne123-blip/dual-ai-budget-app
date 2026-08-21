import { readFileSync } from "node:fs";
import postgres from "postgres";

const REF = "tykhocwacaxwquhynkok";
const POOLER = "aws-0-us-east-1.pooler.supabase.com";
const REST = `https://${REF}.supabase.co/rest/v1/households?select=id&limit=1`;

function connectionUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const password = process.env.SUPABASE_DB_PASSWORD;
  if (!password) {
    throw new Error("Set SUPABASE_DB_PASSWORD or DATABASE_URL. That is the Postgres password from Connect → Direct connection, not the API secret.");
  }
  return `postgresql://postgres.${REF}:${encodeURIComponent(password)}@${POOLER}:6543/postgres`;
}

const sql = postgres(connectionUrl(), { ssl: "require", max: 1, idle_timeout: 5 });
const migration = readFileSync(new URL("../supabase/migrations/001_hearth_books.sql", import.meta.url), "utf8");

try {
  await sql.unsafe(migration);
  const tables = await sql`
    select table_name
    from information_schema.tables
    where table_schema = 'public' and table_name in ('households', 'journal_entries', 'household_snapshots')
    order by table_name
  `;
  console.log("applied", tables.map((row) => row.table_name).join(", "));
} finally {
  await sql.end({ timeout: 2 });
}

const publishable = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (publishable) {
  const response = await fetch(REST, { headers: { apikey: publishable } });
  const body = await response.text();
  if (response.ok) console.log("postgrest households: ok");
  else console.log("postgrest households:", response.status, body.slice(0, 200));
}
