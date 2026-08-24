import { describe, expect, it } from "vitest";
import {
  catalogHousehold,
  makeHouseholdExport,
  parseHouseholdExport,
  postEntry,
  redactedDiagnostics,
  validateHouseholdImport,
} from "../src/core/index.ts";

describe("recovery import/export", () => {
  it("refuses import without Confirm and preserves the live household", async () => {
    const posted = postEntry(catalogHousehold(), {
      date: "2026-08-24",
      type: "expense",
      amount: "4.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Recovery milk",
      createdBy: "MEM-001",
      confirmDuplicate: true,
    });
    const file = await makeHouseholdExport(posted.household);
    await expect(validateHouseholdImport(JSON.stringify(file), "development", { confirm: false })).rejects.toThrow(
      /Confirm/,
    );
  });

  it("refuses a truncated export", () => {
    expect(() => parseHouseholdExport("{")).toThrow(/not a Hearth household export/);
  });

  it("redacts diagnostics by omitting partner personal notes and secrets", () => {
    const report = redactedDiagnostics(catalogHousehold());
    const blob = JSON.stringify(report);
    expect(blob).not.toMatch(/sb_secret|password|VITE_/i);
    expect(report).not.toHaveProperty("transactions");
  });
});
