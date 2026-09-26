// @vitest-environment jsdom
import { act, createElement, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { afterEach, describe, expect, it } from "vitest";
import { CampfireRitual } from "../src/harbour/campfire/ritual/CampfireRitual.tsx";
import { WeeklySitdown } from "../src/harbour/campfire/ritual/WeeklySitdown.tsx";
import {
  CAMPFIRE_BEATS,
  CAMPFIRE_BEAT_TITLES,
  booksCloseState,
  campfireAllocationSlices,
  campfireState,
  canGiveSeal,
  nextBeat,
  previousBeat,
  sealStatus,
  sealWords,
} from "../src/harbour/campfire/ritual/model.ts";
import { catalogHousehold } from "../src/core/seed.ts";
import { addGoal, appendPlanSitdownTurn, closeBooksMonth, postEntry } from "../src/core/commands.ts";
import { buildDashboard, type Dashboard } from "../src/core/insights.ts";
import { closeChapter, openChapter, reviewChapterClosure } from "../src/core/chapters.ts";
import { isMonthClosed } from "../src/core/statements.ts";
import { CAMPFIRE_RETIRED_TERMS } from "../src/core/terms.ts";
import type { CommitResult, Household } from "../src/core/types.ts";
import { planLifeFixture } from "./fixtures/plan-life.ts";

/**
 * The Campfire ritual (Tool Atlas T29′, decision D3), driven. Fictional books
 * only: Bianca (MEM-001) and Jonathan (MEM-002) from the catalog seed.
 *
 * The laws under test: five beats in one order, each with its own heading
 * that takes focus; the seal needs both people; the books close inside Settle,
 * only when both chairs are taken, and only once; the weekly Sitdown never
 * closes anything; every write is an existing command; the words are fenced.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const BIANCA = "MEM-001", JONATHAN = "MEM-002";
const OCT_2 = "2026-10-02";
let host: HTMLDivElement | null = null, root: Root | null = null;

afterEach(() => { act(() => root?.unmount()); host?.remove(); host = null; root = null; });

function septemberChapter(): Household {
  return openChapter(catalogHousehold(), { memberId: BIANCA, foundationId: "make-rent-boring", at: "2026-09-01T12:00:00.000Z" }).household;
}

type Harness = { commands: string[]; household: Household; setMember: (id: string) => void };

async function mountRitual(start: Household, options: { memberId?: string; today?: string; weekly?: boolean; sitDown?: { dashboard: Dashboard; displayHousehold: Household } } = {}) {
  const harness: Harness = { commands: [], household: start, setMember: () => {} };
  function Proof() {
    const [household, setHousehold] = useState(start);
    const [memberId, setMember] = useState(options.memberId ?? BIANCA);
    harness.setMember = setMember;
    const ref = useRef(household); ref.current = household;
    const onCommand = async (fn: (current: Household) => CommitResult) => {
      harness.commands.push(fn.toString());
      try {
        const result = fn(ref.current);
        ref.current = result.household; harness.household = result.household; setHousehold(result.household);
        return { ...result, ok: true };
      } catch (error) { return { ok: false, userMessage: (error as Error).message }; }
    };
    const props = { key: memberId, household, memberId, today: options.today ?? OCT_2, busy: false, onCommand, onClose: () => {} };
    return options.weekly ? createElement(WeeklySitdown, props) : createElement(CampfireRitual, { ...props, sitDown: options.sitDown ?? null });
  }
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => { root!.render(createElement(Proof)); await new Promise(r => setTimeout(r, 0)); });
  return harness;
}

const buttons = () => [...document.querySelectorAll<HTMLButtonElement>("button")];
const findButton = (name: string | RegExp) => buttons().find(b => {
  const text = (b.textContent ?? "").trim();
  return typeof name === "string" ? text === name : name.test(text);
});
const button = (name: string | RegExp) => {
  const found = findButton(name);
  if (!found) throw new Error(`No button ${name}. Have: ${buttons().map(b => (b.textContent ?? "").trim()).join(" | ")}`);
  return found;
};
const click = async (target: HTMLElement) => act(async () => { target.click(); await new Promise(r => setTimeout(r, 0)); });
const beatHeading = () => document.querySelector<HTMLHeadingElement>(".campfire-beat h3")!;
const status = () => document.querySelector(".campfire-ritual__status")?.textContent ?? "";
async function goTo(title: string) { await click(button(new RegExp(`^\\d?${title}$`))); }
async function asMember(harness: Harness, id: string) { await act(async () => { harness.setMember(id); await new Promise(r => setTimeout(r, 0)); }); }

describe("the Campfire's five beats", () => {
  it("runs Arrive · Look back · Settle · Look ahead · Seal, in that order", () => {
    expect(CAMPFIRE_BEATS.map(beat => CAMPFIRE_BEAT_TITLES[beat])).toEqual(["Arrive", "Look back", "Settle", "Look ahead", "Seal"]);
    expect(nextBeat("arrive")).toBe("look-back");
    expect(nextBeat("seal")).toBeNull();
    expect(previousBeat("arrive")).toBeNull();
    expect(previousBeat("seal")).toBe("look-ahead");
  });

  it("is a labelled dialog; each beat is a step whose heading takes focus, and Put it back is there", async () => {
    await mountRitual(septemberChapter());
    const dialog = document.querySelector("[role='dialog']")!;
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(document.getElementById(dialog.getAttribute("aria-labelledby")!)?.textContent).toBe("Make Rent Boring");
    expect(findButton("Put it back")).toBeTruthy();
    const seen = [beatHeading().textContent];
    for (let step = 0; step < 4; step++) {
      await click(button(/^Next: /));
      seen.push(beatHeading().textContent);
      expect(document.activeElement).toBe(beatHeading());
      expect(document.querySelector("[aria-current='step']")?.textContent).toContain(beatHeading().textContent!);
    }
    expect(seen).toEqual(["Arrive", "Look back", "Settle", "Look ahead", "Seal"]);
    expect(findButton(/^Next: /)).toBeUndefined();
    await click(button("Back to Look ahead"));
    expect(beatHeading().textContent).toBe("Look ahead");
  });
});

describe("the seal needs both acknowledgements (D3)", () => {
  it("one seal leaves the Chapter open; the second closes it; each phone speaks in its own person", async () => {
    const harness = await mountRitual(septemberChapter());
    await goTo("Seal");
    expect(document.querySelector(".campfire-seal-line")?.textContent).toBe("Not sealed yet · both seals are needed");
    await click(document.querySelectorAll<HTMLInputElement>("input[type='radio']")[0]!);
    await click(button("Read the seal together"));
    await click(button("Give my seal"));
    expect(harness.commands.at(-1)).toMatch(/\bcloseChapter\b/);
    expect(harness.household.chapters![0]!.state).toBe("open");
    expect(status()).toBe("Your seal is given");
    expect(document.querySelector(".campfire-seal-line")?.textContent).toBe("You sealed · waiting for Jonathan");
    expect(findButton("Give my seal")).toBeUndefined();
    expect(document.body.textContent).not.toContain("Sealed by Bianca");

    await asMember(harness, JONATHAN);
    expect(beatHeading().textContent).toBe("Seal");
    expect(document.querySelector(".campfire-seal-line")?.textContent).toBe("Sealed by Bianca · your seal is needed");
    await click(button("Give my seal"));
    expect(harness.household.chapters![0]!.state).toBe("established");
    expect(status()).toBe("Sealed by both of you · “Make Rent Boring” is closed");
    expect(findButton(/^Open the next Chapter/)).toBeTruthy();
  });

  it("one person alone never seals", () => {
    const solo = septemberChapter();
    solo.members = solo.members.map(row => row.id === JONATHAN ? { ...row, active: false } : row);
    const alone = sealStatus(solo, BIANCA);
    expect(alone.kind).toBe("alone");
    expect(canGiveSeal(alone)).toBe(false);
    expect(sealWords(alone)).toMatch(/needs two people/);
  });

  it("renders no seal button for a household of one", async () => {
    const solo = septemberChapter();
    solo.members = solo.members.map(row => row.id === JONATHAN ? { ...row, active: false } : row);
    await mountRitual(solo);
    await goTo("Seal");
    expect(findButton("Read the seal together")).toBeUndefined();
    expect(findButton("Give my seal")).toBeUndefined();
  });
});

describe("the books close inside Settle, only once", () => {
  it("offers the close in Settle and nowhere else, held until both chairs are taken", async () => {
    const harness = await mountRitual(septemberChapter());
    for (const title of ["Arrive", "Look back", "Look ahead", "Seal"]) {
      await goTo(title);
      expect(findButton(/^Close the books/), title).toBeUndefined();
    }
    await goTo("Settle");
    const held = button("Close the books for September");
    expect(held.getAttribute("aria-disabled")).toBe("true");
    const before = harness.commands.length;
    await click(held);
    expect(harness.commands.length).toBe(before);
    expect(document.body.textContent).toContain("Both chairs are taken before the books close");

    await goTo("Arrive");
    await click(button("Take my chair"));
    expect(harness.commands.at(-1)).toMatch(/\bappendPlanSitdownTurn\b/);
    expect(status()).toBe("You sat down at the Campfire");
    await asMember(harness, JONATHAN);
    await goTo("Arrive");
    await click(button("Take my chair"));
    await goTo("Settle");
    const ready = button("Close the books for September");
    expect(ready.getAttribute("aria-disabled")).toBeNull();
    await click(ready);
    expect(harness.commands.at(-1)).toMatch(/\bcloseBooksMonth\b/);
    expect(isMonthClosed(harness.household, "2026-09")).toBe(true);
    expect(status()).toBe("Books closed for September");
    expect(findButton(/^Close the books/)).toBeUndefined();
    expect(document.body.textContent).toContain("Books closed for September.");
    expect(harness.commands.filter(row => /\bcloseBooksMonth\b/.test(row))).toHaveLength(1);
  });

  it("never offers a month that has not ended, nor one already closed", () => {
    const early = septemberChapter();
    const onSept25 = booksCloseState(early, BIANCA, "2026-09-25");
    expect(onSept25.monthKey).toBe("2026-08");
    const closed = closeBooksMonth(early, { monthKey: "2026-09", createdBy: BIANCA }).household;
    const state = booksCloseState(closed, BIANCA, OCT_2);
    expect(state).toMatchObject({ monthKey: "2026-09", closed: true, closable: false, reason: "Books closed for September" });
  });
});

describe("the weekly Sitdown is two chairs", () => {
  it("writes Sitdown turns only: no close, no seal, no digest", async () => {
    const harness = await mountRitual(septemberChapter(), { weekly: true, today: "2026-09-23" });
    expect(document.querySelector("[role='dialog'] h2")?.textContent).toBe("Sitdown");
    await click(button("Take my chair"));
    const area = document.querySelector("textarea")!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
      setter.call(area, "Hydro is Saturday; groceries ran hot.");
      area.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await click(button("Share it"));
    expect(harness.commands).toHaveLength(2);
    for (const command of harness.commands) expect(command).toMatch(/\bappendPlanSitdownTurn\b/);
    const weekly = harness.household.planHerculesSessions!.find(row => row.sitDownSessionId.startsWith("SITDOWN-WEEK-"))!;
    expect(weekly.state).toBe("active");
    expect(weekly.stage).toBeUndefined();
    expect(harness.household.chapters![0]!.state).toBe("open");
    expect(findButton(/seal|close/i)).toBeUndefined();
  });

  it("holds no closing command in its source", () => {
    const source = readFileSync("src/harbour/campfire/ritual/WeeklySitdown.tsx", "utf8");
    for (const word of ["closeChapter", "closeBooksMonth", "acknowledgeHouseholdPlan", "checkpoint:", "digest:", "close: true"]) expect(source).not.toContain(word);
  });
});

describe("campfireState — the Campfire host's panel line", () => {
  it("counts down to the month's end and names what needs you", () => {
    let h = planLifeFixture("household");
    h = openChapter(h, { memberId: "MEM-001", foundationId: "make-rent-boring", at: "2026-09-01T12:00:00.000Z" }).household;
    const proposed = h.planVersions!.find(row => row.state === "proposed")!;
    const mine = h.planAcknowledgements?.some(row => row.planVersionId === proposed.id && row.memberId === "MEM-002");
    expect(mine).toBeFalsy();
    const line = campfireState(h, "MEM-002", "2026-09-25");
    expect(line.closesInDays).toBe(5);
    expect(line.line).toMatch(/^Chapter closes in 5 days · \d cards? needs? you$/);
    expect(campfireState(h, "MEM-002", "2026-09-29").line.startsWith("Chapter closes tomorrow")).toBe(true);
    expect(campfireState(h, "MEM-002", "2026-10-03").line.startsWith("Chapter still open from September")).toBe(true);
  });

  it("says who the fire waits for, in the reader's own person", () => {
    const h = septemberChapter();
    const review = reviewChapterClosure(h, { chapterId: h.chapters![0]!.id, outcome: "still-forming" });
    const once = closeChapter(h, { memberId: BIANCA, chapterId: h.chapters![0]!.id, outcome: "still-forming", expectedRevision: review.expectedRevision, reviewDigest: review.reviewDigest }).household;
    expect(campfireState(once, BIANCA, "2026-09-25").line).toBe("Chapter closes in 5 days · waiting for Jonathan");
    expect(campfireState(once, JONATHAN, "2026-09-25").line).toBe("Chapter closes in 5 days · Sealed by Bianca · your seal is needed");
    expect(campfireState(catalogHousehold(), BIANCA, "2026-09-25").line).toBe("No Chapter open");
  });

  it("knows who is here from the month's Campfire thread, not the weekly one", () => {
    let h = septemberChapter();
    h = appendPlanSitdownTurn(h, { sitDownSessionId: "SITDOWN-WEEK-2026-09-20", monthKey: "2026-09", planDraftId: "PLAN-2026-09", memberId: BIANCA, text: "A weekly word." }).household;
    h = appendPlanSitdownTurn(h, { sitDownSessionId: "SITDOWN-WEEK-2026-09-20", monthKey: "2026-09", planDraftId: "PLAN-2026-09", memberId: JONATHAN, text: "Another.", sessionId: h.planHerculesSessions![0]!.id }).household;
    expect(booksCloseState(h, BIANCA, OCT_2).closable).toBe(false);
  });
});

describe("money truth at the fire", () => {
  it("never suggests Protect in where leftover goes", () => {
    let h = catalogHousehold();
    const kept = addGoal(h, { name: "Fictional emergency cushion", target: "5000", shared: true }); h = kept.household;
    const trip = addGoal(h, { name: "Fictional weekend away", target: "800", shared: true }); h = trip.household;
    h = { ...h, goals: h.goals.map(goal => goal.id === kept.postedIds[0] ? { ...goal, envelope: { version: 1, kind: "protect", purpose: "", refill: "target", glaze: "cream" } as never } : goal) };
    const slices = campfireAllocationSlices(h, "2026-09-25");
    expect(slices.some(slice => slice.targetId === kept.postedIds[0])).toBe(false);
    expect(slices.some(slice => slice.targetId === trip.postedIds[0])).toBe(true);
  });

  it("composes only existing commands in its own files, and imports no money writer", () => {
    const dir = "src/harbour/campfire/ritual";
    const allowed = new Set(["appendPlanSitdownTurn", "acknowledgeHouseholdPlan", "closeBooksMonth", "closeChapter", "openChapter", "editRitual", "acknowledgeRitualChange", "keepWinAsMemory", "dismissWin", "offerMove"]);
    const used = new Set<string>();
    for (const name of readdirSync(dir).filter(file => /\.tsx?$/.test(file))) {
      const source = readFileSync(join(dir, name), "utf8");
      for (const match of source.matchAll(/\b([a-z][A-Za-z]+)\(current\b/g)) used.add(match[1]!);
      for (const money of ["postEntry", "postTransfer", "postShift", "postOneRecurrence", "fundGoal", "allocateHouseholdFundSurplus", "contributeToGoal", "proposeHouseholdFundContribution", "confirmHouseholdFundContribution"]) {
        expect(source, `${name} must not import ${money}`).not.toMatch(new RegExp(`\\b${money}\\b`));
      }
    }
    expect([...used].filter(name => !allowed.has(name))).toEqual([]);
  });

  /**
   * Review finding 6: the ritual does move money, through the controls it reuses. The Settle beat hosts
   * SitDownLeftover, whose "Confirm moves of $X" posts transfers (`executeSitDownMoves`); the Chapter controls
   * carry their own commands. This names every command reached that way, and proves the one money mover is
   * that named button, sent through the App's run.
   */
  const MONEY_WRITERS = ["executeSitDownMoves", "postEntry", "postTransfer", "postShift", "postOneRecurrence", "postDueRecurrences", "fundGoal", "purchaseGoal",
    "allocateHouseholdFundSurplus", "contributeToGoal", "proposeHouseholdFundContribution", "confirmHouseholdFundContribution", "settleWorkReceivable", "postPotentialExpense"];
  const slice = (file: string, from: string, to?: string) => {
    const source = readFileSync(file, "utf8");
    const start = source.indexOf(from);
    expect(start, `${file}: ${from}`).toBeGreaterThanOrEqual(0);
    const end = to ? source.indexOf(to, start + from.length) : source.length;
    return source.slice(start, end < 0 ? source.length : end);
  };
  // A captured command takes the accepted household first: `name(current, …)` / `name(h, …)`.
  const coreImports = (file: string) => new Set([...readFileSync(file, "utf8").matchAll(/import \{([^}]*)\} from ["']\.\/core\/[^"']+["']/g)]
    .flatMap(match => match[1]!.split(",").map(name => name.trim().replace(/^type\s+/, "")).filter(Boolean)));
  const commandsIn = (source: string, file: string) => {
    const core = coreImports(file);
    return new Set([...source.matchAll(/\b([a-z][A-Za-z]+)\((?:current|h)\b/g)].map(match => match[1]!).filter(name => core.has(name)));
  };
  const REUSED: Record<string, { file: string; source: () => string; commands: string[] }> = {
    "SitDownGuide.tsx › SitDownLeftover": {
      file: "src/SitDownGuide.tsx",
      source: () => slice("src/SitDownGuide.tsx", "export function SitDownLeftover(", "\nexport function "),
      commands: ["adoptSitDownStandingOrders", "applySitDown", "executeSitDownMoves", "recordSitDownDrive", "saveSitDownSession"],
    },
    "ChapterTaskControls.tsx": {
      file: "src/ChapterTaskControls.tsx",
      source: () => readFileSync("src/ChapterTaskControls.tsx", "utf8"),
      commands: ["acknowledgeRitualChange", "acknowledgeTask", "adoptChapterTasks", "completeMove", "editRitual", "prepareRitualOccurrence", "recordRitualHeld", "respondToMove", "setRitualParticipation"],
    },
    "ChapterPanel.tsx › RitualForm": {
      file: "src/ChapterPanel.tsx",
      source: () => slice("src/ChapterPanel.tsx", "export function RitualForm(", "\nexport function "),
      commands: ["addRitual"],
    },
  };

  it("names every command it reaches through reused controls", () => {
    const beats = readFileSync("src/harbour/campfire/ritual/beats.tsx", "utf8");
    // The reused controls it mounts, and nothing else from the App's root.
    expect([...beats.matchAll(/from "\.\.\/\.\.\/\.\.\/([A-Z][A-Za-z]+)\.tsx"/g)].map(match => match[1]).sort()).toEqual(["ChapterPanel", "ChapterTaskControls", "SitDownGuide"]);
    for (const [where, { file, source, commands }] of Object.entries(REUSED)) {
      expect([...commandsIn(source(), file)].sort(), where).toEqual(commands);
    }
  });

  it("moves money only through Settle's named “Confirm moves of $X”, sent through run", () => {
    const own = readdirSync("src/harbour/campfire/ritual").filter(file => /\.tsx?$/.test(file)).map(file => readFileSync(join("src/harbour/campfire/ritual", file), "utf8")).join("\n");
    const reached = Object.values(REUSED).map(({ source }) => source()).join("\n");
    const movers = MONEY_WRITERS.filter(name => new RegExp(`\\b${name}\\(`).test(own + reached));
    expect(movers).toEqual(["executeSitDownMoves"]);
    expect(own).not.toMatch(/\bexecuteSitDownMoves\b/);
    const leftover = REUSED["SitDownGuide.tsx › SitDownLeftover"]!.source();
    expect(leftover.match(/\bexecuteSitDownMoves\(/g)).toHaveLength(1);
    // Its one call is inside the button whose visible name is "Confirm moves of {amount}", handed to send → onCommand…
    const button = leftover.slice(leftover.lastIndexOf("<button", leftover.indexOf("executeSitDownMoves(")), leftover.indexOf("</button>", leftover.indexOf("executeSitDownMoves(")));
    expect(button).toContain("void send((current) => executeSitDownMoves(current,");
    expect(button).toContain("Confirm moves of {formatCad(plan.allocatedCents)}");
    const send = leftover.slice(leftover.indexOf("async function send("), leftover.indexOf("async function send(") + 200);
    expect(send).toContain("const outcome = await onCommand(fn)");
    // …and the Settle beat hands SitDownLeftover the ritual's relay, which is the App's run (runKitchen).
    const beats = readFileSync("src/harbour/campfire/ritual/beats.tsx", "utf8");
    expect(beats).toMatch(/<SitDownLeftover [^>]*onCommand=\{props\.relay\}/);
    const write = readFileSync("src/harbour/campfire/ritual/useCampfireWrite.ts", "utf8");
    expect(write).toMatch(/const relay = useCallback\(async \(fn[^)]*\)[^{]*\{[^}]*await onCommand\(fn\)/);
  });

  it("drives it: the Settle beat's “Confirm moves of $X” is the one money press, and it reaches run", async () => {
    let start = septemberChapter();
    start = postEntry(start, { date: "2026-09-02", type: "income", amount: "900", accountId: "ACC-CHEQUING", subcategoryId: "SUB-INCOME-WAGES", note: "Fictional pay", createdBy: BIANCA, visibility: "household", confirmDuplicate: true }).household;
    const sitDown = { dashboard: buildDashboard(start, "2026-09-25", new Date("2026-09-25T12:00:00Z")), displayHousehold: start };
    const harness = await mountRitual(start, { today: "2026-09-25", sitDown });
    await goTo("Settle");
    const confirm = button(/^Confirm moves of \$/);
    expect(document.querySelectorAll("[aria-label='Where leftover goes']")).toHaveLength(1);
    // Nothing on the way here moved money.
    const moves = (rows: string[]) => rows.filter(row => MONEY_WRITERS.some(name => new RegExp(`\\b${name}\\b`).test(row)));
    expect(moves(harness.commands)).toEqual([]);
    if (confirm.getAttribute("aria-disabled") === "true") throw new Error(`Confirm moves is held: ${document.body.textContent}`);
    await click(confirm);
    const moved = moves(harness.commands);
    expect(moved).toHaveLength(1);
    expect(moved[0]).toMatch(/\bexecuteSitDownMoves\b/);
  });
});

// ── The vocabulary fence ────────────────────────────────────────────────────

const CODE_ATTRIBUTES = new Set(["className", "id", "key", "htmlFor", "name", "type", "role", "href", "src", "style", "value"]);
function renderedStrings(file: string): string[] {
  const sf = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: string[] = [];
  const isCode = (node: ts.Node): boolean => {
    let parent = node.parent;
    if (!parent) return true;
    if (ts.isJsxExpression(parent) && parent.parent) parent = parent.parent;
    if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) return true;
    if (ts.isJsxAttribute(parent) && (CODE_ATTRIBUTES.has(parent.name.getText()) || /^data-/.test(parent.name.getText()))) return true;
    if (ts.isCallExpression(parent) && /querySelector|matchAll|RegExp/.test(parent.expression.getText())) return true;
    if (ts.isBinaryExpression(parent) || ts.isCaseClause(parent) || ts.isElementAccessExpression(parent)) return true;
    return false;
  };
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) out.push(node.getText());
    else if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && !isCode(node) && !/^[a-z0-9_:-]+$/.test(node.text)) out.push(node.text);
    else if (ts.isTemplateExpression(node) && !isCode(node)) out.push([node.head.text, ...node.templateSpans.map(span => span.literal.text)].join(" "));
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

describe("the Campfire's words", () => {
  const ritualFiles = readdirSync("src/harbour/campfire/ritual").filter(file => /\.tsx$/.test(file)).map(file => `src/harbour/campfire/ritual/${file}`);
  const doors = ["src/ChapterPanel.tsx", "src/SitDownGuide.tsx", "src/tabs/BooksTab.tsx", ...ritualFiles];

  it("never says check-in, Close the month, Close the previous Chapter, Sit-down or Our Path", () => {
    const hits: string[] = [];
    for (const file of doors) for (const text of renderedStrings(file)) {
      for (const rule of CAMPFIRE_RETIRED_TERMS) if (rule.pattern.test(text)) hits.push(`${file}: "${text.trim().slice(0, 70)}" → ${rule.use}`);
    }
    expect(hits).toEqual([]);
  });

  it("keeps the retired words out of the Plan Studio's Sitdown and review", () => {
    const source = readFileSync("src/PlanStudio.tsx", "utf8").split("\n");
    const sections = source.filter(line => /section === "sitdown"|section === "review"/.test(line)).join("\n");
    for (const word of ["check-in", "Our check-in", "Close the previous Chapter", "Close the month", "Arrive together", "Acknowledge this exact version"]) expect(sections).not.toContain(word);
    expect(sections).toContain("CampfireDoor");
  });

  it("spells Sitdown so, and names the Chapter and the Campfire", () => {
    const words = ritualFiles.flatMap(renderedStrings).join(" \n ");
    expect(words).not.toMatch(/\bsit-down\b/i);
    expect(words).toMatch(/\bSitdown\b/);
    expect(words).toMatch(/\bChapter\b/);
    expect(words).toMatch(/\bThe Campfire\b|\bthe Campfire\b/);
  });

  it("puts the doors where the three screens stood", async () => {
    const books = readFileSync("src/tabs/BooksTab.tsx", "utf8");
    expect(books).not.toMatch(/SitDownGuide/);
    expect(books).toMatch(/CampfireDoor/);
    const panel = readFileSync("src/ChapterPanel.tsx", "utf8");
    const room = panel.slice(panel.indexOf("export function ChapterRoom"), panel.indexOf("/**\n * Closing a Chapter"));
    expect(room).toMatch(/CampfireDoor/);
    expect(room).not.toMatch(/openChapter\(|addRitual\(|offerMove\(/);
  });
});
