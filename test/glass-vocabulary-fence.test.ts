import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { WORDS } from "../src/harbour/glass/copy.ts";

/**
 * The dock's vocabulary fence (Tool Atlas §3.2, A13): the retired words never
 * reach the screen from the strip, the camp card or the Desk's Today — in
 * `.tsx` copy *and* `.ts` copy tables. "Record" is a verb only; "jar" is for
 * bills only; "pot" only for Prepare · Protect · Build; money moves are
 * named, never "Pay it".
 */
const root = process.cwd();
const glass = join(root, "src", "harbour", "glass");
const files = [
  ...readdirSync(glass).filter(name => /\.(ts|tsx)$/.test(name)).map(name => join(glass, name)),
  join(root, "src", "harbour", "desk", "DeskToday.tsx"),
  join(root, "src", "harbour", "desk", "todayModel.ts"),
];

/** Every string a person could read: JSX text, string and template literals — minus imports, class names, ids and data hooks. */
function copyOf(file: string): { line: number; text: string }[] {
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

const RETIRED: { word: string; pattern: RegExp }[] = [
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
  const copy = files.flatMap(file => copyOf(file).map(row => ({ ...row, file: relative(root, file).replace(/\\/g, "/") })));

  it("finds the copy it fences", () => {
    expect(copy.some(row => row.text.includes("Everyday · now"))).toBe(true);
    expect(copy.some(row => row.text.includes("Leaving next"))).toBe(true);
    expect(copy.some(row => row.text.includes("Shift tonight? Record it here."))).toBe(true);
  });

  it("uses none of the retired words", () => {
    const hits = copy.flatMap(row => RETIRED.filter(rule => rule.pattern.test(row.text)).map(rule => `${row.file}:${row.line} "${row.text.trim().slice(0, 60)}" → ${rule.word}`));
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
