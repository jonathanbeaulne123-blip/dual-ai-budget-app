import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DIRECT_HOST,
  POOLER_HOST,
  PROJECT_REF,
  SQL_EDITOR,
  isPlaceholderPassword,
  resolveApplyUrl,
} from "../scripts/supabase-connection.mjs";

describe("Supabase apply URL", () => {
  it("rejects the dashboard [YOUR-PASSWORD] placeholder", () => {
    expect(isPlaceholderPassword("[YOUR-PASSWORD]")).toBe(true);
    expect(isPlaceholderPassword("%5BYOUR-PASSWORD%5D")).toBe(true);
    expect(isPlaceholderPassword("")).toBe(true);
    expect(() => resolveApplyUrl({
      DATABASE_URL: `postgresql://postgres:[YOUR-PASSWORD]@${DIRECT_HOST}:5432/postgresz`,
    })).toThrow(/postgresz/);
    expect(() => resolveApplyUrl({
      DATABASE_URL: `postgresql://postgres:[YOUR-PASSWORD]@${DIRECT_HOST}:5432/postgresz`,
    })).toThrow(SQL_EDITOR);
  });

  it("rewrites a direct IPv6 URI onto the IPv4 session pooler", () => {
    const url = resolveApplyUrl({
      DATABASE_URL: `postgresql://postgres:hearth%40pass@${DIRECT_HOST}:5432/postgresz`,
    });
    const parsed = new URL(url);
    expect(parsed.hostname).toBe(POOLER_HOST);
    expect(parsed.port).toBe("5432");
    expect(parsed.username).toBe(`postgres.${PROJECT_REF}`);
    expect(parsed.pathname).toBe("/postgres");
    expect(decodeURIComponent(parsed.password)).toBe("hearth@pass");
  });

  it("accepts the password alone", () => {
    const url = resolveApplyUrl({ SUPABASE_DB_PASSWORD: "plain-secret" });
    expect(new URL(url).hostname).toBe(POOLER_HOST);
  });
});

describe("hosted books migration", () => {
  const sql = readFileSync(new URL("../supabase/migrations/001_hearth_books.sql", import.meta.url), "utf8");
  const cas = readFileSync(new URL("../supabase/migrations/002_snapshot_cas.sql", import.meta.url), "utf8");

  it("keeps invoker views, FK indexes, and the SQL Editor path", () => {
    expect(sql).toContain("security_invoker = true");
    expect(sql).toContain("CREATE INDEX IF NOT EXISTS members_household");
    expect(sql).toContain("https://supabase.com/dashboard/project/tykhocwacaxwquhynkok/sql/new");
    expect(sql).toContain("TO anon, authenticated");
  });

  it("ships CAS RPC with revision backfill and schema_migrations tracking", () => {
    expect(cas).toMatch(/publish_household_snapshot/);
    expect(cas).toMatch(/Development apply authorized by Jonathan/);
    expect(cas).toMatch(/UPDATE household_snapshots/);
    expect(cas).toMatch(/schema_migrations/);
    expect(cas).toMatch(/NOTIFY pgrst/);
    expect(cas).toMatch(/Production: DO NOT APPLY/);
  });

  it("keeps REVOKE/GRANT signatures aligned with the 12-arg CREATE", () => {
    const createArgs = cas.match(
      /CREATE OR REPLACE FUNCTION publish_household_snapshot\(([\s\S]*?)\)\s*RETURNS/i,
    )?.[1] ?? "";
    const createTypes = [...createArgs.matchAll(/\b(TEXT|INTEGER|BOOLEAN)\b/gi)].map((m) => m[1].toLowerCase());
    expect(createTypes).toEqual([
      "text", "integer", "text", "text", "text", "text", "text", "boolean", "integer", "text", "text", "text",
    ]);
    const revoke = cas.match(
      /REVOKE ALL ON FUNCTION publish_household_snapshot\(([^)]+)\)/i,
    )?.[1]?.replace(/\s+/g, "") ?? "";
    expect(revoke).toBe(createTypes.join(","));
  });
});
