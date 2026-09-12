import { describe, expect, it } from "vitest";
import { LONG_LINE, WHISPER_LINE_MAX, offenderKey, scanCopyBudget } from "../scripts/copy-budget.mjs";

/**
 * Copy budget fence (feedback row 6). Explanations belong in a <Whisper>:
 * one short visible line, a remembered "Why" aside, or a described-only
 * sentence — not a paragraph under every heading. This test keeps the list
 * of always-visible paragraphs over 120 characters from growing, and keeps it
 * shrinking: an allow-listed paragraph that no longer exists must be removed.
 *
 * Allowed for now, on purpose: money-outcome copy (MonthSpread shortfall,
 * Accounts openings), error bodies, the Work flows and the Development-only
 * rehearsal panel. They come off this list as they are rewritten.
 */
const ALLOWED = new Set<string>([
  "src/AccountHistorySetup.tsx|Money you have is positive. Debt and overdrafts ",
  "src/AccountHistorySetup.tsx|Selected live openings are reversed at their ori",
  "src/Accounts.tsx|, including earlier history. Wallet can include ",
  "src/Accounts.tsx|Record chequing, savings, cards, investments, mo",
  "src/App.tsx|The saved ledger is still on this device. The cu",
  "src/App.tsx|Come home to the right books on every device. Go",
  "src/App.tsx|Compare your frozen source with the imported boo",
  "src/App.tsx|— accepted household truth in Our Home, and only",
  "src/App.tsx|— plain-language explanations and deterministic ",
  "src/App.tsx|— scenarios, talking points, proposals, and Add ",
  "src/App.tsx|— he never posts money, performs Final Confirm, ",
  "src/Appointments.tsx|Insurance, a workplace claim, a friend, a tax re",
  "src/GuidedSetupPreview.tsx|Look through every chapter without changing this",
  "src/KitchenErrorBoundary.tsx|Opening this household hit a bug. Nothing was po",
  "src/MonthRehearsalAccess.tsx|This is a later Development reliability exercise",
  "src/MonthRehearsalPanel.tsx|The backup contains the household books. Keep it",
  "src/MonthRehearsalPanel.tsx|These acknowledgements stay in this browser sess",
  "src/MonthRehearsalPanel.tsx|About ten minutes a week on your own phones. Not",
  "src/MonthRehearsalPanel.tsx|Bianca’s clarity notes are visible only to the t",
  "src/MonthSpread.tsx|standing in the Household Fund. Historical purch",
  "src/SevenShiftsConnectPanel.tsx|Punches fill Timesheet hours and role. Tips are ",
  "src/ShapeStage.tsx|Each category against its own trailing three mon",
  "src/WorkJobs.tsx|Employer rules power Timesheet, payday prompts, ",
  "src/WorkShiftFlow.tsx|People on floor is headcount only — never cowork",
  "src/WorkShiftFlow.tsx|Configured tip-outs recalculate as these figures",
  "src/WorkShiftFlow.tsx|Scheduled people start present. Turn off anyone ",
  "src/WorkShiftPage.tsx|7shifts changed this confirmed shift. Correct cr",
  "src/WorkShiftPage.tsx|Last 28 nights on the counter. A filled cup is a",
  "src/kitty/KittyBankRoom.tsx|For Fund-backed costs, release this bank’s earma",
  "src/wardrobe/HerculesDressingRoom.tsx|Hats and glasses belong together. Lock a favouri",
  "src/wardrobe/SavedLooks.tsx|Sharing publishes only the look’s name, pieces, ",
]);

describe("Copy budget — explanations whisper, they do not lecture", () => {
  const result = scanCopyBudget("src");
  it(`paints no new always-visible paragraph over ${LONG_LINE} characters`, () => {
    const fresh = result.offenders.filter(row => !ALLOWED.has(offenderKey(row)));
    expect(fresh.map(row => `${row.file}:${row.line} (${row.length}) ${row.text.slice(0, 80)}… → wrap it in <Whisper mode="aside"> or cut it to a <Whisper mode="line">`)).toEqual([]);
  });
  it("only shrinks the allow-list", () => {
    const present = new Set(result.offenders.map(offenderKey));
    const stale = [...ALLOWED].filter(key => !present.has(key));
    expect(stale, "remove these from ALLOWED — they are no longer over the line").toEqual([]);
  });
  it(`keeps every <Whisper mode="line"> at or under ${WHISPER_LINE_MAX} characters`, () => {
    expect(result.longLines.map(row => `${row.file}:${row.line} (${row.length})`)).toEqual([]);
  });
  it("keeps the daily surfaces under their prose budget", () => {
    const budget: Record<string, number> = { "src/Calendar.tsx": 900, "src/Books.tsx": 1750, "src/HouseholdHome.tsx": 400, "src/OfficePhone.tsx": 700, "src/HouseholdFundPanel.tsx": 900, "src/PlanStudio.tsx": 3450 };
    for (const [file, max] of Object.entries(budget)) {
      const row = result.files.find(entry => entry.file === file);
      expect(row, file).toBeDefined();
      expect(row!.visibleChars, `${file} always-visible characters`).toBeLessThanOrEqual(max);
    }
  });
});
