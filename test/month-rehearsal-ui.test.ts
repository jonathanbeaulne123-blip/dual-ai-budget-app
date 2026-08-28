import { createElement } from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MonthRehearsalPanel } from "../src/MonthRehearsalPanel.tsx";
import { catalogHousehold, startMonthRehearsal } from "../src/core/index.ts";

function emptyDevelopment() {
  const household = catalogHousehold("development");
  household.transactions = [];
  household.shifts = [];
  household.commandReceipts = [];
  household.activity = [];
  return household;
}

describe("Bianca month rehearsal UI", () => {
  it("offers an ordinary Development-only Start our month invitation", () => {
    const household = emptyDevelopment();
    const html = renderToStaticMarkup(createElement(MonthRehearsalPanel, { household, memberId: "MEM-001", today: "2026-08-28", onApply: () => undefined }));
    expect(html).toContain("Start our month");
    expect(html).toContain("About ten minutes a week");
    expect(html).toContain("Nothing here enables Production");
    expect(html).toContain("Choose Bianca");
    expect(html).toContain("Choose Jonathan");
    expect(html).toContain("own signed-in phone");
    expect(html).not.toMatch(/test case|fixture|QA instruction/i);
    expect(renderToStaticMarkup(createElement(MonthRehearsalPanel, { household: { ...household, environment: "production" }, memberId: "MEM-001", today: "2026-08-28", onApply: () => undefined }))).toBe("");
  });

  it("renders a persistent four-week Hercules-led card with shared friction disclosure", () => {
    const started = startMonthRehearsal(emptyDevelopment(), {
      monthKey: "2026-09",
      biancaParticipantId: "MEM-001",
      jonathanPartnerId: "MEM-002",
      startedByMemberId: "MEM-001",
      now: "2026-08-28T16:00:00Z",
    }).household;
    const html = renderToStaticMarkup(createElement(MonthRehearsalPanel, { household: started, memberId: "MEM-001", today: "2026-09-01", onApply: () => undefined, surface: "manage" }));
    expect(html).toContain("Our month");
    expect(html.match(/Week [1-4]/g)?.length).toBeGreaterThanOrEqual(4);
    expect(html).toContain("Begin with today&#x27;s truth");
    expect(html).toContain("visible only to the two selected participants");
    expect(html).toContain("Hercules never interprets them");
    expect(html).toContain("Bianca’s ordinary playtest");
    expect(html).toContain("Needs attention");
    expect(html).toContain("Download readable report");
    expect(html).toContain("Replay rehearsal");
  });

  it("keeps exact proof behind See why and includes phone-width layout", () => {
    const panelSource = readFileSync(new URL("../src/MonthRehearsalPanel.tsx", import.meta.url), "utf8");
    const css = readFileSync(new URL("../src/month-rehearsal.css", import.meta.url), "utf8");
    expect(panelSource).toContain("<summary>See why</summary>");
    expect(panelSource).toContain("Debits");
    expect(panelSource).toContain("Credits");
    expect(panelSource).toContain("Proof code");
    expect(panelSource).toContain("How did that feel?");
    expect(panelSource).toContain("Distrusted a number");
    expect(panelSource).toContain("Still working on this?");
    expect(panelSource).toContain("Link this evidence");
    expect(panelSource).toContain("Choose another");
    expect(panelSource).toContain("This export contains the clarity and friction notes");
    expect(css).toContain("@media(max-width:520px)");
  });
});
