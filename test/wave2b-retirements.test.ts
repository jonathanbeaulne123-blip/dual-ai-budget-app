// @vitest-environment jsdom
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bankRoomRequest } from "../src/house/bankRoom.ts";
import { houseTargets } from "../src/house/houseTargets.ts";
import { TARGET_NAMES } from "../src/house/navigation.ts";
import { HostPanel, PANEL_DOORS } from "../src/harbour/panels/HostPanel.tsx";
import { DESK_PAGES } from "../src/harbour/desk/pages.ts";
import { BOOK_DIVISIONS } from "../src/house/HouseBooks.tsx";
import { searchAtlas } from "../src/core/toolAtlas.ts";

/**
 * Wave 2b: the kill / merge list (Tool Atlas brief §7, K1–K15), held at the
 * source and in small renders. Each row names what retired and where its
 * replacement lives; the retired words stay findable in All tools' search.
 */
const src = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const app = src("src/App.tsx");
let host: HTMLDivElement, root: Root;
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

describe("K1 · the Fund ledge", () => {
  it("is gone from App and the tree; the bank panel's door opens the Fund, which draws The Level", () => {
    expect(app).not.toMatch(/<FundLedge\b|FundLedge\.tsx/);
    expect(existsSync("src/FundLedge.tsx")).toBe(false);
    expect(existsSync("src/fund-ledge.css")).toBe(false);
    expect(PANEL_DOORS.bank.target).toBe("fund");
    expect(src("src/HouseholdFundPanel.tsx")).toMatch(/<DeskLevel walk=\{levelWalk\} \/>/);
    // The Ask is a Glasshouse step: its door opens the planner.
    expect(app).toMatch(/if \(destination === "ask"\) \{ openHouseObject\("planner"\); return; \}/);
    expect(searchAtlas("the level").slice(0, 3).map((hit) => hit.id)).toContain("fund-bank");
  });
});

describe("K2 · the Time Machine screen", () => {
  it("is not mounted; a month opens its books, and the Desk's Calendar reads any month", () => {
    expect(app).not.toMatch(/<TimeMachine /);
    expect(src("src/Books.tsx")).toMatch(/requestedPane\?\.startsWith\("month:"\)/);
    const calendar = src("src/harbour/desk/DeskCalendar.tsx");
    expect(calendar).toMatch(/aria-label="Previous month"/);
    expect(calendar).toMatch(/aria-label="Next month"/);
    expect(src("src/path/OurPathWorld.tsx")).toMatch(/Open the books for \{monthName\(first\)\}/);
  });
});

describe("K5 · Spend a moment together", () => {
  it("has no host: not the house targets, not the rowboat, not the rooms; the module is marked deprecated", () => {
    expect(houseTargets("household", "together", "middle").map((row) => row.id)).not.toContain("encounters");
    expect(src("src/harbour/boathouse/BoathouseScene.ts")).not.toMatch(/door: \{ target: "encounters" \}/);
    expect(src("src/hearthside/Hearthside.tsx")).not.toMatch(/Discover a season together<\/button>/);
    expect(src("src/hearthside/EncounterEntry.tsx")).toMatch(/@deprecated K5/);
  });
});

describe("K6 · the Mountain & town guide", () => {
  it("keeps only Step in's rides, tour and small moments", () => {
    const panel = src("src/harbour/mountain/MountainPanel.tsx");
    expect(panel).not.toMatch(/>Places<\/button>|>The glass dam<\/button>|mountain-trigger/);
    expect(panel).toMatch(/aria-label="Step in: rides, a tour and small moments"/);
  });
});

describe("K7 · Quick travel and the palette", () => {
  it("no rendered Quick travel remains", () => {
    expect(src("src/harbour/HarbourWorld.tsx")).not.toMatch(/Quick travel\./);
    expect(app).not.toMatch(/CommandPalette/);
  });
});

describe("K8 · Swipe / Till into Purchase", () => {
  it("Purchase remembers the account of the last accepted purchase, per viewer and space", () => {
    expect(app).toMatch(/hearth:add:lastPurchaseAccount:\$\{environment\}:\$\{household\.householdId\}:\$\{session\.memberId\}:\$\{view\}/);
    expect(app).toMatch(/if\(postedMode==="expense"\)rememberPurchaseAccount\(postedAccountId\)/);
    expect(app).toMatch(/const launch = account \?\? remembered;/);
  });
});

describe("K9 · Meet the Queen", () => {
  it("is no longer a target name or a door; her look is in Settings › Appearance", () => {
    expect(TARGET_NAMES.queen).toBe("The Fund bank");
    expect(houseTargets("household", "home", "middle").map((row) => row.label)).not.toContain("Meet the Queen");
    expect(app).toMatch(/<QueenDressing variant="settings"/);
  });
});

describe("K10 · the Sit together board", () => {
  it("routes its doors to the Glasshouse steps and the Campfire's Look ahead", () => {
    expect(app).toMatch(/onSteps=\{\(\)=>openHearthsideTool\("planner",undefined,"Our steps"\)\}/);
    expect(app).toMatch(/onLookAhead=\{\(\)=>setCampfire\(\{beat:"look-ahead"\}\)\}/);
    expect(app).toMatch(/if \(destination === "boards"\) \{ openHearthsideTool\("planner", undefined, "Our steps"\); return; \}/);
  });
});

describe("K11 · the conversation folio", () => {
  it("opens from the Kitchen panel, and Hercules no longer lands on it", async () => {
    const opened: string[] = [];
    await act(async () => root.render(createElement(HostPanel, { host: "kitchen", reading: null, onClose: () => undefined, onOpen: (target) => opened.push(target) })));
    await act(async () => host.querySelector<HTMLButtonElement>("[data-panel-door=conversation]")!.click());
    expect(opened).toEqual(["conversation"]);
    expect(app).not.toMatch(/next==="hercules"\?"conversation"|next==='hercules'\?'conversation'/);
  });
});

describe("K12 · the Pottery Studio", () => {
  it("resolves to a Kitty Bank's studio tab; the Kiln's stations keep their own door", () => {
    expect(bankRoomRequest("studio")).toEqual({ studio: true });
    expect(bankRoomRequest("bank/goal:G1/studio")).toEqual({ bankId: "goal:G1", studio: true });
    expect(bankRoomRequest("bank/plan:protect")).toEqual({ bankId: "plan:protect", studio: false });
    expect(bankRoomRequest("wheel")).toEqual({ studio: false });
    expect(bankRoomRequest(undefined)).toEqual({ studio: false });
    expect(app).toMatch(/if\(target==="pottery"&&!object\)\{target="loft-banks";object="studio";\}/);
    expect(TARGET_NAMES.pottery).toBe("The Kiln");
  });
});

describe("K13 · renames", () => {
  it("the Books division is Paper trail, so Record is only the verb", () => {
    expect(BOOK_DIVISIONS).toContain("Paper trail");
    expect(BOOK_DIVISIONS).not.toContain("Record");
  });
});

describe("K14 · the Desk", () => {
  it("shows Calendar and Books once each, as chips, and one flip", () => {
    expect(DESK_PAGES.map((page) => page.chip)).toEqual(["Today", "Leaving", "Accounts", "Calendar", "Books"]);
    const bar = src("src/harbour/bubbles/GlassChrome.tsx");
    expect(bar).not.toMatch(/>Calendar<|>Books</);
    expect(src("src/harbour/desk/DeskShell.tsx")).toMatch(/const showFlip = headerFlip \?\? !flipStanding;/);
  });
});

describe("K15 · the money gun", () => {
  it("is merged into the jug: one named control, one Confirm", () => {
    const loft = src("src/queen/QueenLoft.tsx");
    expect(loft).not.toMatch(/queen-gun|gunFire|Pick up the money gun/);
    expect(loft).toMatch(/Move \{formatCad\(preview\.placedCents\)\} to Kitty Banks/);
    expect(loft).toMatch(/pour\.onPour\(allocations, preview\.placedCents\)/);
  });
});
