import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { PROJECT_REF, SQL_EDITOR, resolveApplyUrl } from "./supabase-connection.mjs";

const REST = `https://${PROJECT_REF}.supabase.co/rest/v1/households?select=id&limit=1`;
const migrationPath = fileURLToPath(new URL("../supabase/migrations/001_hearth_books.sql", import.meta.url));

let url;
try {
  url = resolveApplyUrl(process.env);
} catch (caught) {
  console.error(caught instanceof Error ? caught.message : String(caught));
  process.exitCode = 1;
  process.exit();
}

const sql = postgres(url, {
  ssl: "require",
  max: 1,
  idle_timeout: 5,
  connect_timeout: 20,
  connection: { application_name: "hearth-books-apply" },
});

try {
  await sql.file(migrationPath);
  const tables = await sql`
    select table_name
    from information_schema.tables
    where table_schema = 'public' and table_name in ('households', 'journal_entries', 'household_snapshots')
    order by table_name
  `;
  console.log("applied", tables.map((row) => row.table_name).join(", "));
} catch (caught) {
  const message = caught instanceof Error ? caught.message : String(caught);
  console.error("Could not apply the books schema:", message);
  console.error(`If this is still a password error, paste the file into ${SQL_EDITOR} and Run.`);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 2 });
}

if (process.exitCode) process.exit(process.exitCode);

const publishable = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (publishable) {
  const response = await fetch(REST, { headers: { apikey: publishable } });
  const body = await response.text();
  if (response.ok) console.log("postgrest households: ok");
  else console.log("postgrest households:", response.status, body.slice(0, 200));
}
