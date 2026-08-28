import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

describe("Production 7shifts connection migration", () => {
  it("applies cleanly and accepts only Production-owned connection rows", () => {
    const migration = readFileSync(new URL("../migrations/sevenshifts-production/0001_seven_shifts_connections.sql", import.meta.url), "utf8");
    const db = new DatabaseSync(":memory:");
    try {
      db.exec(migration);
      const insert = db.prepare("INSERT INTO seven_shifts_connections (connection_id, environment, auth_user_id, household_id, member_id, job_id, state, sealed_private, company_label, created_at, updated_at) VALUES (?, ?, 'auth-1', 'HH-TEST', 'MEM-001', 'JOB-1', 'ready', 'sealed', 'Harbour', '2026-08-28T00:00:00.000Z', '2026-08-28T00:00:00.000Z')") as unknown as { run: (...values: unknown[]) => unknown };
      insert.run("s7c_production_schema_0001", "production");
      expect(() => insert.run("s7c_development_schema_001", "development")).toThrow(/CHECK constraint failed/);
      expect(db.prepare("SELECT environment, member_id FROM seven_shifts_connections").get())
        .toMatchObject({ environment: "production", member_id: "MEM-001" });
    } finally {
      db.close();
    }
  });
});
