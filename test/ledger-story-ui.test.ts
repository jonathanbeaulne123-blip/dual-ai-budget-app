import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const office = readFileSync(new URL("../src/Office.tsx", import.meta.url), "utf8");
const officePhone = readFileSync(new URL("../src/OfficePhone.tsx", import.meta.url), "utf8");
const officeWide = readFileSync(new URL("../src/OfficeWide.tsx", import.meta.url), "utf8");
const books = readFileSync(new URL("../src/Books.tsx", import.meta.url), "utf8");
const calendar = readFileSync(new URL("../src/Calendar.tsx", import.meta.url), "utf8");
const shift = readFileSync(new URL("../src/WorkShiftPage.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/ledger-story.css", import.meta.url), "utf8");
const panel = readFileSync(new URL("../src/HouseholdFundPanel.tsx", import.meta.url), "utf8");
const experience = readFileSync(new URL("../src/core/ledgerExperience.ts", import.meta.url), "utf8");

describe("D-164 ledger story UI fences", () => {
  it("routes every tab through projectLedgerExperience and a mode-aware purpose banner", () => {
    expect(app).toContain("projectLedgerExperience");
    expect(app).toContain("<LedgerPurposeBanner");
    expect(app).toContain("showsLedgerPurposeBanner(tab)");
    expect(app).toContain("data-ledger-mode={view}");
    expect(app).toContain("experience.exportHousehold");
    expect(app).toContain("data-ledger-confirm-purpose");
    expect(experience).toContain("showsLedgerPurposeBanner");
  });

  it("folds Shared Story into the wide notebook and keeps OfficePhone structurally unchanged", () => {
    expect(office).toContain("sharedStory={sharedStory}");
    expect(office).toContain("personalStory={personalStory}");
    expect(office).not.toContain("Also on this desk");
    expect(officeWide).toContain("<SharedLedgerStory");
    expect(officeWide).toContain("<PersonalLedgerFolio");
    expect(officeWide).toContain("paperHomeMosaic");
    expect(officePhone).not.toContain("SharedLedgerStory");
    expect(officePhone).not.toContain("Fund free-to-spend");
    expect(officePhone).not.toContain("runHealthCheck");
    expect(office).not.toContain('emitOfficeIntent({ type: "expand", id: "fund"');
    expect(css).toContain("min-width: 720px");
    expect(css).toContain("max-width: 899px");
    expect(css).toContain("max-width: 719px");
    expect(css).toContain("strong.negative");
    expect(css).toContain("grid-template-areas");
  });

  it("keeps writers on the accepted snapshot and Add pickers on the scoped list", () => {
    expect(app).toContain("restoreAcceptedSnapshot");
    expect(app).toContain("persistLedgerWrite");
    expect(app).toContain("booksHousehold={household}");
    expect(app).toContain("projectHouseholdFund(household, today)");
    expect(app).toContain("? experience.scopedHousehold.accounts.filter((account) => account.active)");
    expect(app).not.toContain("pickerAccounts = displayHousehold.accounts");
    expect(app).toContain("healthFindings");
    expect(app).toContain("experience.herculesHousehold");
    expect(app).toContain("Choose who is using this ledger before exporting.");
    expect(app).toContain("Fund free-to-spend");
    expect(books).toContain("compileHousehold(booksHousehold)");
    expect(books).not.toContain("compileHousehold(household)");
    expect(books).toContain("HouseholdFundPanel household={booksHousehold}");
    expect(books).toContain("closeBooksMonth(booksHousehold");
    expect(books).not.toContain("books.chart[0]");
    expect(app).toContain("postDueRecurrences(current, today, ids)");
    expect(app).toContain("recurrenceIds");
    expect(office).toContain("integrityFindings");
    expect(office).toContain("buildSharedLedgerStory(booksHousehold");
    expect(office).toContain("PostcardBody household={booksHousehold}");
    expect(office).not.toContain("runHealthCheck(household)");
    expect(officeWide).toContain("PostcardBody household={booksHousehold}");
    expect(officeWide).not.toContain("runHealthCheck");
    expect(panel).toContain("Fund free-to-spend");
    expect(panel).toContain("LEDGER_CUSTODY_DISCLOSURE");
    expect(panel).not.toContain("Free to spend");
  });

  it("gives Calendar, Shift, and Books a mode contract", () => {
    expect(calendar).toContain("view?: LedgerView");
    expect(calendar).toContain("calendar-stage");
    expect(calendar).not.toContain("hero calendar-hero");
    expect(shift).toContain("view?: LedgerView");
    expect(shift).toContain("worker-centered");
    expect(books).toContain("Household table");
    expect(books).toContain("My books");
    expect(books).toContain("On the table");
    expect(books).toContain("householdTableStory");
    expect(books).toContain("books-audit-office");
    expect(books).not.toContain("Together now");
    expect(books).not.toContain("Household story · double-entry");
    expect(books).not.toContain("kind=\"Books\"");
    expect(panel).toContain("<summary>Propose or confirm a contribution</summary>");
  });

  it("keeps Books off Shared primary nav and doors it from More", () => {
    expect(app).toContain("kitchenPrimaryNav(view)");
    expect(app).toContain("Open the household table");
    expect(app).not.toContain("Open household table books");
    expect(app).not.toContain("Journal and Fund");
    expect(app).toContain('data-ledger-nav={view === "household" ? "shared" : "personal"}');
    expect(experience).toContain('return ["home", "calendar", "plan", "more"]');
    expect(experience).toContain('return ["home", "calendar", "shift", "plan", "more"]');
  });
});
