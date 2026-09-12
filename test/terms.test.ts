import { describe, expect, it } from "vitest";
import ts from "typescript";
import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { listComponentFiles } from "../scripts/copy-budget.mjs";
import { INTERNAL_TERMS_NEVER_SHOWN, householdWords } from "../src/core/terms.ts";

/**
 * Vocabulary fence (feedback row 6). Rendered strings in components use the
 * household's words: no library names, no internal metaphors, one spelling
 * of Sitdown. Class names, ids, imports, keys and console output are code,
 * not copy, and are skipped.
 */
const CODE_ATTRIBUTES = new Set(["className", "id", "key", "htmlFor", "name", "type", "role", "href", "src", "to", "scope", "data-testid", "rel", "target", "style", "value", "accept", "autoComplete", "inputMode", "method", "action", "form", "list"]);
const CODE_PROPERTIES = new Set(["className", "id", "key", "kind", "scope", "route", "tab", "type", "source", "status", "storageKey", "path"]);

function isCodeString(node: ts.Node): boolean {
  let parent = node.parent;
  if (!parent) return true;
  if (ts.isJsxExpression(parent) && parent.parent) parent = parent.parent;
  if (ts.isParenthesizedExpression(parent) || ts.isConditionalExpression(parent)) return isCodeString(parent);
  if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent) || ts.isImportTypeNode(parent)) return true;
  if (ts.isJsxAttribute(parent) && CODE_ATTRIBUTES.has(parent.name.getText()) ) return true;
  if (ts.isJsxAttribute(parent) && /^data-/.test(parent.name.getText())) return true;
  if (ts.isPropertyAssignment(parent) && CODE_PROPERTIES.has(parent.name.getText())) return true;
  if (ts.isCallExpression(parent) && /^console\./.test(parent.expression.getText())) return true;
  if (ts.isCallExpression(parent) && /localStorage|sessionStorage|getItem|setItem|removeItem|querySelector|getElementById|classList|matchMedia/.test(parent.expression.getText())) return true;
  if (ts.isBinaryExpression(parent) || ts.isCaseClause(parent) || ts.isElementAccessExpression(parent)) return true;
  if (ts.isTemplateSpan(parent) && parent.parent && ts.isTemplateExpression(parent.parent)) return isCodeString(parent.parent);
  return false;
}

function renderedStrings(file: string): { line: number; text: string }[] {
  const source = readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: { line: number; text: string }[] = [];
  const push = (node: ts.Node, text: string) => out.push({ line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1, text });
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) push(node, node.getText());
    else if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && !isCodeString(node) && !/^[a-z0-9_:-]+$/.test(node.text)) push(node, node.text);
    else if (ts.isTemplateExpression(node) && !isCodeString(node)) push(node, [node.head.text, ...node.templateSpans.map(span => span.literal.text)].join(" "));
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

describe("Hearth's words — internal names never reach the screen", () => {
  it("keeps PGlite, kitchen, snapshot and Sit-down out of rendered component strings", () => {
    const hits: string[] = [];
    for (const file of listComponentFiles("src")) {
      const rel = relative(process.cwd(), file).replace(/\\/g, "/");
      for (const { line, text } of renderedStrings(file)) {
        for (const rule of INTERNAL_TERMS_NEVER_SHOWN) if (rule.pattern.test(text)) hits.push(`${rel}:${line} "${text.trim().slice(0, 70)}" → say "${rule.use}"`);
      }
    }
    expect(hits).toEqual([]);
  });
  it("rewrites a runtime sentence into household words", () => {
    expect(householdWords("PGlite rejected the journal.")).toBe("this phone’s books rejected the journal.");
    expect(householdWords("Open the kitchen and finish the sit-down.")).toBe("Open Hearth and finish the Sitdown.");
    expect(householdWords("The household snapshot changed; a snapshot copy remains.")).toBe("the books changed; a books copy remains.");
  });
});
