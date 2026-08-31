import { describe, expect, it } from "vitest";
import {
  acceptPreparedHerculesProTransaction,
  prepareHerculesProTransaction,
} from "../src/core/herculesProWrite.ts";
import { seedDemoHousehold } from "../src/core/seed.ts";

function writableHousehold() {
  return {
    ...seedDemoHousehold({ today: "2026-08-25", environment: "development" }),
    herculesProPermissions: {
      personalWrite: true,
      householdWrite: true,
      updatedAt: "2026-08-25T12:00:00.000Z",
    },
  };
}

describe("Hercules Pro confirmed transaction kernel", () => {
  it("keeps preparation read-only and isolates Personal rows from Shared", async () => {
    const household = writableHousehold();
    const original = JSON.stringify(household);
    const account = household.accounts.find((row) => row.active)!;
    const category = household.categories.find((row) => row.active && row.recordType === "category" && row.transactionType === "expense")!;
    const prepared = await prepareHerculesProTransaction(household, "MEM-002", {
      view: "personal",
      type: "expense",
      date: "2026-08-24",
      amountCents: 1234,
      accountId: account.id,
      subcategoryId: category.id,
      note: "Synthetic proof",
    });
    expect(JSON.stringify(household)).toBe(original);
    expect(prepared.preview).toMatchObject({ ledger: "personal", amountCents: 1234, amount: "$12.34" });
    expect(prepared.postedTransactions).toHaveLength(1);
    expect(prepared.postedTransactions[0]).toMatchObject({ visibility: "personal", createdBy: "MEM-002" });
    const accepted = await acceptPreparedHerculesProTransaction(household, prepared, "MEM-002", "CONFIRM-WRITE-1");
    expect(accepted.accepted.revision).toBe(household.revision + 1);
    expect(accepted.sharedProjection.transactions.some((row) => row.id === prepared.postedIds[0])).toBe(false);
    expect(accepted.sharedProjection.herculesProPermissions).toBeUndefined();
    expect(accepted.sharedProjection.activity.every((row) => household.activity.some((source) => source.id === row.id))).toBe(true);
    expect(accepted.sharedProjection.activity.length).toBeLessThan(household.activity.length);
    expect(accepted.sharedProjection.activity.some((row) => row.summary.includes("Bianca trip fund"))).toBe(false);
    const privateTransactionIds = household.transactions
      .filter((row) => row.visibility === "personal")
      .map((row) => row.id);
    expect(accepted.sharedProjection.activity.some((row) => (
      privateTransactionIds.some((transactionId) => row.summary.includes(transactionId))
    ))).toBe(false);
    expect(accepted.personalProjection?.transactions.some((row) => row.id === prepared.postedIds[0])).toBe(true);
    expect(accepted.receipt).toMatchObject({ confirmationId: "CONFIRM-WRITE-1", commandKind: "hercules-pro-transaction" });
  });

  it("accepts user-entered account and category names when preparing a write", async () => {
    const household = writableHousehold();
    const category = household.categories.find((row) => row.active && row.recordType === "category" && row.transactionType === "expense")!;
    const prepared = await prepareHerculesProTransaction(household, "MEM-002", {
      view: "personal",
      type: "expense",
      date: "2026-08-24",
      amountCents: 4321,
      accountId: "Visa",
      subcategoryId: category.name,
      note: "Name-based proof",
    });
    expect(prepared.preview.account).toBe("Visa");
    expect(prepared.preview.category).toBe(category.name);
  });

  it("refuses both ledgers when member consent is missing", async () => {
    const household = seedDemoHousehold({ today: "2026-08-25", environment: "development" });
    const account = household.accounts.find((row) => row.active)!;
    const category = household.categories.find((row) => row.active && row.recordType === "category" && row.transactionType === "income")!;
    await expect(prepareHerculesProTransaction(household, "MEM-002", {
      view: "household",
      type: "income",
      date: "2026-08-24",
      amountCents: 5000,
      accountId: account.id,
      subcategoryId: category.id,
    })).rejects.toThrow(/writes are off/);
  });

  it("previews transfers as one intent with two balanced posted rows", async () => {
    const household = writableHousehold();
    const [fromAccount, toAccount] = household.accounts.filter((row) => row.active).slice(0, 2);
    if (!fromAccount || !toAccount) throw new Error("Fixture needs two active accounts.");
    const prepared = await prepareHerculesProTransaction(household, "MEM-002", {
      view: "household",
      type: "transfer",
      date: "2026-08-24",
      amountCents: 2500,
      fromAccountId: fromAccount.id,
      toAccountId: toAccount.id,
      note: "Synthetic transfer",
    });
    expect(prepared.preview).toMatchObject({ type: "transfer", amountCents: 2500 });
    expect(prepared.postedIds).toHaveLength(2);
    expect(prepared.postedTransactions.every((row) => row.visibility === "household")).toBe(true);

    const personal = await prepareHerculesProTransaction(household, "MEM-002", {
      view: "personal",
      type: "transfer",
      date: "2026-08-24",
      amountCents: 2500,
      fromAccountId: fromAccount.id,
      toAccountId: toAccount.id,
    });
    expect(personal.postedTransactions.every((row) => row.splits.length === 1 && row.splits[0]?.party === "MEM-002")).toBe(true);
  });
});

describe("migration 011 confirmed-write contract", () => {
  it("locks shared and personal rows, rechecks consent, and grants only authenticated execution", async () => {
    const sql = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../supabase/migrations/011_hercules_pro_confirmed_write.sql", import.meta.url), "utf8"));
    expect(sql).toMatch(/pg_advisory_xact_lock/i);
    expect(sql).toMatch(/continuity_personal_snapshots[\s\S]*FOR UPDATE/i);
    expect(sql).toMatch(/herculesProPermissions,personalWrite/);
    expect(sql).toMatch(/herculesProPermissions,householdWrite/);
    expect(sql).toMatch(/payload_has_confirmation/);
    expect(sql).toMatch(/p_environment IS DISTINCT FROM 'development'[\s\S]*production-disabled/i);
    expect(sql).toMatch(/GRANT EXECUTE[\s\S]*TO authenticated/i);
    expect(sql).toMatch(/REVOKE ALL[\s\S]*FROM PUBLIC, anon/i);
    expect(sql).not.toMatch(/GRANT EXECUTE[\s\S]*TO anon/i);
  });
});
