import { readFileSync, readdirSync } from "node:fs";
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
  const casHardening = readFileSync(new URL("../supabase/migrations/005_snapshot_cas_hardening.sql", import.meta.url), "utf8");

  it("keeps invoker views, FK indexes, and the SQL Editor path", () => {
    expect(sql).toContain("security_invoker = true");
    expect(sql).toContain("CREATE INDEX IF NOT EXISTS members_household");
    expect(sql).toContain("https://supabase.com/dashboard/project/tykhocwacaxwquhynkok/sql/new");
    expect(sql).toContain("TO anon, authenticated");
  });

  it("ships CAS RPC with revision backfill and schema_migrations tracking", () => {
    expect(cas).toMatch(/publish_household_snapshot/);
    expect(cas).toMatch(/Applied to Development.*Jonathan/i);
    expect(cas).toMatch(/UPDATE household_snapshots/);
    expect(cas).toMatch(/schema_migrations/);
    expect(cas).toMatch(/NOTIFY pgrst/);
    expect(cas).toMatch(/Production: DO NOT APPLY/);
  });

  it("keeps REVOKE/GRANT signatures aligned with the 12-arg CREATE", () => {
    const createArgs = cas.match(
      /CREATE OR REPLACE FUNCTION publish_household_snapshot\(([\s\S]*?)\)\s*RETURNS/i,
    )?.[1] ?? "";
    const createTypes = [...createArgs.matchAll(/\b(TEXT|INTEGER|BOOLEAN)\b/gi)].map((match) => {
      const type = match[1];
      if (!type) throw new Error("CAS argument type capture was unexpectedly empty");
      return type.toLowerCase();
    });
    expect(createTypes).toEqual([
      "text", "integer", "text", "text", "text", "text", "text", "boolean", "integer", "text", "text", "text",
    ]);
    const revoke = cas.match(
      /REVOKE ALL ON FUNCTION publish_household_snapshot\(([^)]+)\)/i,
    )?.[1]?.replace(/\s+/g, "") ?? "";
    expect(revoke).toBe(createTypes.join(","));
  });

  it("ships the already-applied 002 repair as a forward migration", () => {
    expect(casHardening).toMatch(/DO NOT APPLY/i);
    expect(casHardening).toMatch(/pg_advisory_xact_lock/);
    expect(casHardening).toMatch(/p_revision <= p_expected_revision/);
    expect(casHardening).toMatch(/compacted offline/i);
    expect(casHardening).toMatch(/VALUES \(5,/);
    expect(casHardening).not.toMatch(/DROP COLUMN|DELETE FROM public\.household_snapshots/i);
  });

  it("keeps one SQL file per numeric prefix and parks D-126 timezone as 007", () => {
    const names = readdirSync("supabase/migrations").filter((name) => name.endsWith(".sql"));
    const byPrefix = new Map<string, string[]>();
    for (const name of names) {
      const prefix = name.slice(0, 3);
      const list = byPrefix.get(prefix) ?? [];
      list.push(name);
      byPrefix.set(prefix, list);
    }
    for (const [prefix, list] of byPrefix) {
      expect(list, `prefix ${prefix}`).toHaveLength(1);
    }
    expect(names).toContain("007_household_timezone_iana.sql");
    expect(names).toContain("016_reset_development_households.sql");
    expect(names.some((name) => name.startsWith("004_household"))).toBe(false);
    expect(names.some((name) => /^\d{14}_/.test(name))).toBe(false);
    expect(names.some((name) => name.startsWith("009_"))).toBe(false);
    expect(names.every((name) => /^\d{3}_[a-z0-9_]+\.sql$/.test(name))).toBe(true);
    expect(names.map((name) => name.slice(0, 3)).sort()).toEqual([
      "001", "002", "003", "004", "005", "006", "007", "008",
      "010", "011", "012", "013", "014", "015", "016", "017", "018",
    ]);
    const tz = readFileSync("supabase/migrations/007_household_timezone_iana.sql", "utf8");
    expect(tz).toMatch(/Applied to the shared Supabase project/i);
    expect(tz).toMatch(/VALUES \(7,/);
    expect(tz).toMatch(/households_timezone_nonempty/);
  });
});
