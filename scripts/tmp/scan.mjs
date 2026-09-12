import ts from "typescript";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
const root = process.argv[2] ?? "src";
const words = (process.argv[3] ?? "PGlite,kitchen,snapshot,Sitdown,Sit-down,sit-down,envelope").split(",");
function walk(dir, out=[]) { for (const n of readdirSync(dir)) { const p = join(dir,n); const s = statSync(p); if (s.isDirectory()) walk(p,out); else if (/\.tsx?$/.test(n) && !/\.d\.ts$/.test(n)) out.push(p);} return out; }
const counts = {}; const hits = {};
for (const file of walk(root)) {
  const src = readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const visit = (node) => {
    let text = null;
    if (ts.isJsxText(node)) text = node.getText();
    else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) { if (node.parent && (ts.isImportDeclaration(node.parent) || ts.isExportDeclaration(node.parent))) return; text = node.text; }
    else if (ts.isTemplateExpression(node)) text = node.head.text + node.templateSpans.map(s=>s.literal.text).join(" ");
    if (text) { for (const w of words) { const re = new RegExp(`\\b${w.replace('-','\\-')}\\b`); if (re.test(text)) { counts[w]=(counts[w]||0)+1; (hits[w] ||= []).push(`${file}:${sf.getLineAndCharacterOfPosition(node.getStart()).line+1}: ${text.trim().slice(0,70).replace(/\s+/g,' ')}`);} } }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}
console.log(counts);
if (process.argv[4]) for (const h of hits[process.argv[4]]??[]) console.log(h);
