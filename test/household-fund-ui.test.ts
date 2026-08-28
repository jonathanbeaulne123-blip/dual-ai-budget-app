import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const books = readFileSync(new URL("../src/Books.tsx", import.meta.url), "utf8");
const panel = readFileSync(new URL("../src/HouseholdFundPanel.tsx", import.meta.url), "utf8");
const accounts = readFileSync(new URL("../src/Accounts.tsx", import.meta.url), "utf8");

describe("Household Fund experience fences", () => {
  it("keeps funding separate from transaction visibility on Confirm", () => {
    expect(app).toContain("Use Household Fund");
    expect(app).toContain("Separate from Shared or Personal visibility");
    expect(app).toContain("fundedCents: parseAmount(form.fundedAmount || form.amount)");
    expect(app).toContain("destinationAccountId: form.fundDestinationAccountId || form.accountId");
  });

  it("adds a Home glance and dedicated books pane without changing the phone instrument model", () => {
    expect(app).toContain('className="card household-fund-glance"');
    expect(books).toContain('{ id: "fund", label: "Household Fund"');
    expect(books).toContain("<HouseholdFundPanel");
    expect(app).not.toContain('emitOfficeIntent({ type: "expand", id: "fund"');
  });

  it("shows the custody disclosure and keeps full reconciliation in Bianca's panel", () => {
    expect(panel).toContain("The money remains in Bianca’s savings. Hearth cannot move it.");
    expect(panel).toContain("Bianca’s private reconciliation");
    expect(panel).toContain("Jonathan sees only whether it ties");
    expect(panel).toContain('isCustodian && view === "personal"');
    expect(panel).toContain("Confirm reconciliation");
  });

  it("shows editable oldest-first settlement allocation and a monthly books summary", () => {
    expect(panel).toContain("Allocation preview");
    expect(panel).toContain("defaultAllocations");
    expect(panel).toContain("Fund-backed purchases");
    expect(panel).toContain("Transfers and partial settlements");
    expect(panel).toContain("Closing operating");
    expect(panel).toContain("audit {event.id}");
  });

  it("lets an account be explicitly Personal instead of relying on a hidden screen", () => {
    expect(accounts).toContain("Who can see this account?");
    expect(accounts).toContain('scope === "personal" ? memberId : undefined');
    expect(accounts).toContain("Personal account metadata, institution, last four digits, totals, and reconciliation stay in your Personal envelope.");
  });
});
