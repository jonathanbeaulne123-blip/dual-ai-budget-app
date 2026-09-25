// @vitest-environment jsdom
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WORDS } from "../src/harbour/glass/copy.ts";
import { fabActionsFor, fabClosedLabel } from "../src/core/fabActions.ts";
import type { HarbourReading } from "../src/harbour/data/reading.ts";
import { ATLAS_FALLBACK } from "../src/harbour/nav/atlasFallback.ts";
import { Compass } from "../src/harbour/nav/Compass.tsx";
import { QuickSheet } from "../src/harbour/nav/QuickSheet.tsx";
import { HostPanel } from "../src/harbour/panels/HostPanel.tsx";
import type { PanelHost } from "../src/harbour/panels/panelModel.ts";
import { VillageHUD } from "../src/harbour/village/VillageHUD.tsx";

/**
 * The vocabulary fence for the glass track (Tool Atlas brief §3.2, A13): the
 * retired words never reach the screen — in source copy or in what renders.
 * Synonyms are a search index and are allowed to keep them findable.
 */
const RETIRED = [
  "Add money", "Master Planner", "Our plans", "Plan together", "Meet the Queen", "What now", "Household Fund", "Next out",
  "Scheduled to leave", "Close the month", "check-in", "Sit-down", "Hearthside", "Our Path", "Atlas nook", "Village map",
  "Quick travel", "Mountain & town", "Mountain and town", "Town square", "The Court", "Pay it", "cov.", "Village square",
];
const RETIRED_WORDS = /\b(Together|Play|pots?|Hearthside)\b/;

const OWNED = [
  "src/harbour/bubbles/Bubble.tsx", "src/harbour/bubbles/GlassChrome.tsx", "src/harbour/bubbles/icons.tsx",
  "src/harbour/panels/CompactPanel.tsx", "src/harbour/panels/HostPanel.tsx", "src/harbour/panels/panelModel.ts",
  "src/harbour/nav/QuickSheet.tsx", "src/harbour/nav/atlasFallback.ts", "src/harbour/nav/atlasSearch.ts",
  "src/harbour/village/VillageHUD.tsx", "src/harbour/HarbourEntry.tsx", "src/harbour/nav/Compass.tsx", "src/harbour/nav/barBadges.ts",
  "src/harbour/nav/worldActions.ts", "src/harbour/desk/DeskShell.tsx",
];

/** Source copy: comments out, the synonym index out. */
function copyOf(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/synonyms: \[[^\]]*\]/g, "")
    .replace(/const RECORD_SYNONYMS[\s\S]*?\}\);/, "");
}

describe("source copy", () => {
  it("carries none of the retired words", () => {
    const offences: string[] = [];
    for (const path of OWNED) {
      const copy = copyOf(path);
      for (const word of RETIRED) if (copy.includes(word)) offences.push(`${path}: ${word}`);
    }
    expect(offences).toEqual([]);
  });

  it("labels, headings and subtitles in the atlas use the one vocabulary", () => {
    const shown = ATLAS_FALLBACK.flatMap((g) => [g.heading, g.subtitle, ...g.tools.flatMap((t) => [t.label, t.subtitle ?? ""])]);
    for (const text of shown) {
      for (const word of RETIRED) expect(text, text).not.toContain(word);
      expect(text, text).not.toMatch(RETIRED_WORDS);
      // "jar" is for bills only, and even there the Cellar says "bill".
      expect(text, text).not.toMatch(/\bjars?\b/i);
    }
  });
});

let host: HTMLDivElement, root: Root;
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); window.localStorage.clear(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); document.body.innerHTML = ""; });

/** Everything a person can see or hear: text, names, descriptions, placeholders. */
function spoken(): string {
  const parts = [host.textContent ?? ""];
  for (const node of host.querySelectorAll<HTMLElement>("[aria-label], [placeholder], [title]")) parts.push(node.getAttribute("aria-label") ?? "", node.getAttribute("placeholder") ?? "", node.getAttribute("title") ?? "");
  return parts.join(" \n ");
}
function expectClean(where: string) {
  const text = spoken();
  for (const word of RETIRED) expect(text, `${where}: ${word}`).not.toContain(word);
  expect(text.match(RETIRED_WORDS)?.[0], where).toBeUndefined();
}

const fab = { actions: fabActionsFor("household", "home"), closedLabel: fabClosedLabel("household"), onOpenChange: () => undefined, onPick: () => undefined, onGo: () => undefined };

describe("rendered copy", () => {
  it("the All-tools sheet, in Ours and in Mine", async () => {
    for (const space of ["ours", "mine"] as const) {
      await act(async () => root.render(createElement(QuickSheet, { open: true, space, wide: false, onClose: () => undefined, onOpen: () => undefined, onStatus: () => undefined, onHercules: () => undefined, onPick: () => undefined, onWorld: () => undefined })));
      expectClean(`sheet (${space})`);
    }
  });

  it("the island's glass, the Desk's glass and the door edition", async () => {
    await act(async () => root.render(createElement(VillageHUD, { place: "court", travelling: null, onVisit: () => undefined, fab, onQuickSheet: () => undefined, avatar: "jonathan", onAvatar: () => undefined })));
    expectClean("island");
    await act(async () => root.render(createElement(VillageHUD, { flat: true, place: "atlas", travelling: null, onVisit: () => undefined, fab, onQuickSheet: () => undefined })));
    expectClean("desk");
    await act(async () => root.render(createElement(Compass, { fab, onQuickSheet: () => undefined })));
    expectClean("door");
  });

  it("every compact panel, with an empty reading", async () => {
    for (const panelHost of ["bank", "cellar", "tower", "kitchen", "library", "glasshouse", "campfire", "boathouse", "atlas", "cottage", "hercules"] as PanelHost[]) {
      await act(async () => root.render(createElement(HostPanel, { key: panelHost, host: panelHost, reading: null as HarbourReading | null, onClose: () => undefined, onOpen: () => undefined, onRecord: () => undefined })));
      expectClean(`panel ${panelHost}`);
    }
  });
});

// ---- The dock's fence (track B1), kept alongside the glass fence (track B2). ----

/**
 * The dock's vocabulary fence (Tool Atlas §3.2, A13): the retired words never
 * reach the screen from the strip, the camp card or the Desk's Today — in
 * `.tsx` copy *and* `.ts` copy tables. "Record" is a verb only; "jar" is for
 * bills only; "pot" only for Prepare · Protect · Build; money moves are
 * named, never "Pay it".
 */
const repo = process.cwd();
const glass = join(repo, "src", "harbour", "glass");
const dockFiles = [
  ...readdirSync(glass).filter(name => /\.(ts|tsx)$/.test(name)).map(name => join(glass, name)),
  join(repo, "src", "harbour", "desk", "DeskToday.tsx"),
  join(repo, "src", "harbour", "desk", "todayModel.ts"),
];

/** Every string a person could read: JSX text, string and template literals — minus imports, class names, ids and data hooks. */
function dockCopyOf(file: string): { line: number; text: string }[] {
  const source = readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: { line: number; text: string }[] = [];
  const code = (node: ts.Node): boolean => {
    const parent = node.parent;
    if (!parent) return true;
    if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) return true;
    if (ts.isJsxAttribute(parent) && /^(className|id|key|type|role|data-|aria-controls|aria-labelledby|aria-describedby)/.test(parent.name.getText())) return true;
    if (ts.isJsxExpression(parent) && parent.parent && ts.isJsxAttribute(parent.parent) && /^(className|id|key|data-|aria-controls|aria-labelledby|aria-describedby)/.test(parent.parent.name.getText())) return true;
    if (ts.isPropertyAssignment(parent) && /^(target|id|kind|source|className|object)$/.test(parent.name.getText())) return true;
    if (ts.isBinaryExpression(parent) || ts.isCaseClause(parent) || ts.isElementAccessExpression(parent)) return true;
    if (ts.isCallExpression(parent) && /querySelector|startsWith|replace|exec|test|match|slice/.test(parent.expression.getText())) return true;
    return false;
  };
  const push = (node: ts.Node, text: string) => out.push({ line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1, text });
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node) && node.getText().trim()) push(node, node.getText());
    else if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && !code(node) && !/^[a-z0-9_:.\/-]*$/.test(node.text)) push(node, node.text);
    else if (ts.isTemplateExpression(node) && !code(node)) push(node, [node.head.text, ...node.templateSpans.map(span => span.literal.text)].join(" "));
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

const DOCK_RETIRED: { word: string; pattern: RegExp }[] = [
  { word: "Add money", pattern: /\badd money\b/i },
  { word: "Master Planner", pattern: /\bmaster planner\b/i },
  { word: "Our plans", pattern: /\bour plans\b/i },
  { word: "Plan together", pattern: /\bplan together\b/i },
  { word: "Together (as a tab)", pattern: /^\s*together\s*$/i },
  { word: "Hearthside", pattern: /\bhearthside\b/i },
  { word: "Play (as a tab)", pattern: /^\s*play\s*$/i },
  { word: "Our Path", pattern: /\bour path\b/i },
  { word: "Meet the Queen", pattern: /\bmeet the queen\b/i },
  { word: "Quick travel", pattern: /\bquick travel\b/i },
  { word: "Village map", pattern: /\bvillage map\b/i },
  { word: "Sit-down / Sit down", pattern: /\bsit[- ]down\b/i },
  { word: "What now", pattern: /\bwhat now\b/i },
  { word: "Household Fund (as a label)", pattern: /\bhousehold fund\b/i },
  { word: "Next out", pattern: /\bnext out\b/i },
  { word: "Scheduled to leave", pattern: /\bscheduled to leave\b/i },
  { word: "Close the month", pattern: /\bclose the month\b/i },
  { word: "check-in", pattern: /\bcheck-in\b/i },
  { word: "Atlas nook", pattern: /\batlas nook\b/i },
  { word: "Mountain & town", pattern: /\bmountain & town\b/i },
  { word: "Town square / The Court", pattern: /\btown square\b|\bthe court\b/i },
  { word: "Pay it", pattern: /\bpay it\b/i },
  { word: "cov.", pattern: /\bcov\./i },
  { word: "Plan Studio", pattern: /\bplan studio\b/i },
];

describe("the dock's words (A13)", () => {
  const copy = dockFiles.flatMap(file => dockCopyOf(file).map(row => ({ ...row, file: relative(repo, file).replace(/\\/g, "/") })));

  it("finds the copy it fences", () => {
    expect(copy.some(row => row.text.includes("Everyday · now"))).toBe(true);
    expect(copy.some(row => row.text.includes("Leaving next"))).toBe(true);
    expect(copy.some(row => row.text.includes("Shift tonight? Record it here."))).toBe(true);
  });

  it("uses none of the retired words", () => {
    const hits = copy.flatMap(row => DOCK_RETIRED.filter(rule => rule.pattern.test(row.text)).map(rule => `${row.file}:${row.line} "${row.text.trim().slice(0, 60)}" → ${rule.word}`));
    expect(hits).toEqual([]);
  });

  it("says Record only as a verb, jar only of bills, pot only of Prepare · Protect · Build", () => {
    const record = copy.filter(row => /\brecords?\b/i.test(row.text) && !/\brecord(ed)? (it|one|a|the|\d)|\brecorded\b|\bnot recorded\b/i.test(row.text));
    expect(record.map(row => `${row.file}:${row.line} ${row.text}`)).toEqual([]);
    const jars = copy.filter(row => /\bjars?\b/i.test(row.text) && !/\bbill jars?\b/i.test(row.text));
    expect(jars.map(row => `${row.file}:${row.line} ${row.text}`)).toEqual([]);
    const pots = copy.filter(row => /\bpots?\b/i.test(row.text) && !/Prepare, Protect and Build|Prepare · Protect · Build/.test(row.text));
    expect(pots.map(row => `${row.file}:${row.line} ${row.text}`)).toEqual([]);
  });

  it("writes the brief's own sentences, exactly (§3.5, §4.1)", () => {
    expect(WORDS.everydayNow).toBe("Everyday · now");
    expect(WORDS.leavingNext).toBe("Leaving next");
    expect(WORDS.needsYou).toBe("Needs you");
    expect(WORDS.sinceYouWereHere).toBe("Since you were here");
    expect(WORDS.firstVisit).toBe("Your month runs along the bottom. Drag to look around the island, and tap a place to open it.");
    expect(WORDS.firstVisitKeyboard).toMatch(/…?and press \+ to look closer\.$/);
    expect(WORDS.shiftTonight).toBe("Shift tonight? Record it here.");
    expect(WORDS.whoseMoney).toBe("Whose money");
    expect(WORDS.showing("mine")).toBe("Showing Mine");
    expect(WORDS.headingOurs("2026-09")).toBe("Our month · September");
    expect(WORDS.coveredTo("2026-10-03")).toBe("Covered to Oct 3");
    expect(WORDS.monthBack("2026-08")).toBe("‹ August");
    expect(WORDS.monthForward("2026-09")).toBe("September ›");
    expect([WORDS.books, WORDS.stepIn, WORDS.whatChanged]).toEqual(["Books", "Step in", "What changed here"]);
  });
});
