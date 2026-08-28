import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const office = readFileSync(new URL("../src/Office.tsx", import.meta.url), "utf8");
const officePhone = readFileSync(new URL("../src/OfficePhone.tsx", import.meta.url), "utf8");
const books = readFileSync(new URL("../src/Books.tsx", import.meta.url), "utf8");
const calendar = readFileSync(new URL("../src/Calendar.tsx", import.meta.url), "utf8");
const shift = readFileSync(new URL("../src/WorkShiftPage.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/ledger-story.css", import.meta.url), "utf8");
const panel = readFileSync(new URL("../src/HouseholdFundPanel.tsx", import.meta.url), "utf8");

describe("D-164 ledger story UI fences", () => {
  it("routes every tab through projectLedgerExperience and a visible purpose banner", () => {
    expect(app).toContain("projectLedgerExperience");
    expect(app).toContain("<LedgerPurposeBanner");
    expect(app).toContain("data-ledger-mode={view}");
    expect(app).toContain("experience.exportHousehold");
    expect(app).toContain("data-ledger-confirm-purpose");
  });

  it("makes Shared Story the wide paper primary and keeps OfficePhone structurally unchanged", () => {
    expect(office).toContain("<SharedLedgerStory");
    expect(office).toContain("<PersonalLedgerFolio");
    expect(office).toContain("Also on this desk");
    expect(officePhone).not.toContain("SharedLedgerStory");
    expect(officePhone).not.toContain("Fund free-to-spend");
    expect(office).not.toContain('emitOfficeIntent({ type: "expand", id: "fund"');
    expect(css).toContain("min-width: 720px");
    expect(css).toContain("max-width: 899px");
    expect(css).toContain("grid-template-areas");
  });

  it("gives Calendar, Shift, and Books a mode contract", () => {
    expect(calendar).toContain("view?: LedgerView");
    expect(shift).toContain("view?: LedgerView");
    expect(shift).toContain("worker-centered");
    expect(books).toContain("Household story");
    expect(books).toContain("My books");
    expect(panel).toContain("<summary>Propose or confirm a contribution</summary>");
  });
});
