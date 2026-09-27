import ts from "typescript";
import { readFileSync } from "node:fs";

/**
 * Rendered strings in a source file: JSX text and string literals that are not
 * code (class names, ids, imports, keys, storage keys, console output,
 * comparisons). Shared by the vocabulary fences (test/terms.test.ts and
 * test/atlas-vocabulary-fence.test.ts) so both read copy the same way.
 */
const CODE_ATTRIBUTES = new Set(["className", "id", "key", "htmlFor", "name", "type", "role", "href", "src", "to", "scope", "data-testid", "rel", "target", "style", "value", "accept", "autoComplete", "inputMode", "method", "action", "form", "list"]);
const CODE_PROPERTIES = new Set(["className", "id", "key", "kind", "scope", "route", "tab", "type", "source", "status", "storageKey", "path"]);

function isCodeString(node: ts.Node): boolean {
  let parent = node.parent;
  if (!parent) return true;
  if (ts.isJsxExpression(parent) && parent.parent) parent = parent.parent;
  if (ts.isParenthesizedExpression(parent) || ts.isConditionalExpression(parent)) return isCodeString(parent);
  if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent) || ts.isImportTypeNode(parent) || ts.isLiteralTypeNode(parent)) return true;
  if (ts.isJsxAttribute(parent) && CODE_ATTRIBUTES.has(parent.name.getText())) return true;
  if (ts.isJsxAttribute(parent) && /^data-/.test(parent.name.getText())) return true;
  if (ts.isPropertyAssignment(parent) && CODE_PROPERTIES.has(parent.name.getText())) return true;
  if (ts.isCallExpression(parent) && /^console\./.test(parent.expression.getText())) return true;
  // import("./kitchen/KitchenScene.ts") is a module path, not copy.
  if (ts.isCallExpression(parent) && parent.expression.kind === ts.SyntaxKind.ImportKeyword) return true;
  if (ts.isCallExpression(parent) && /localStorage|sessionStorage|getItem|setItem|removeItem|querySelector|getElementById|classList|matchMedia/.test(parent.expression.getText())) return true;
  if (ts.isBinaryExpression(parent) || ts.isCaseClause(parent) || ts.isElementAccessExpression(parent)) return true;
  if (ts.isTemplateSpan(parent) && parent.parent && ts.isTemplateExpression(parent.parent)) return isCodeString(parent.parent);
  return false;
}

export function renderedStrings(file: string): { line: number; text: string }[] {
  const source = readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: { line: number; text: string }[] = [];
  const push = (node: ts.Node, text: string) => out.push({ line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1, text });
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) push(node, node.getText());
    else if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && !isCodeString(node) && !/^[a-z0-9_:-]+$/.test(node.text)) push(node, node.text);
    else if (ts.isTemplateExpression(node) && !isCodeString(node) && !/^hearth:/.test(node.head.text)) push(node, [node.head.text, ...node.templateSpans.map(span => span.literal.text)].join(" "));
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}
