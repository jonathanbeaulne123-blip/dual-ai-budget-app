// Copy budget: how much always-visible prose each screen paints, and which
// paragraphs are over the line. Used by test/copy-budget.test.ts as the fence
// and by hand for the handoff numbers:  node scripts/copy-budget.mjs [--top=20]
//
// A text run counts as "always visible" unless an ancestor JSX element is
// <details>, <Whisper> (any mode but "line"), or <summary>. Only JSX text and
// {"string"} children count — attributes such as title and aria-label do not
// take screen space.
import ts from "typescript";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export const LONG_LINE = 120;
export const WHISPER_LINE_MAX = 90;
const DISCLOSED_TAGS = new Set(["details", "Whisper", "summary", "WhyAside"]);

export function listComponentFiles(root = "src") {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (name.endsWith(".tsx") && !name.endsWith(".d.ts")) out.push(path);
    }
  };
  walk(root);
  return out.sort();
}

function tagName(node) {
  if (ts.isJsxElement(node)) return node.openingElement.tagName.getText();
  if (ts.isJsxSelfClosingElement(node)) return node.tagName.getText();
  return null;
}
function whisperIsLine(node) {
  const opening = ts.isJsxElement(node) ? node.openingElement : node;
  return opening.attributes.properties.some(prop => ts.isJsxAttribute(prop) && prop.name.getText() === "mode" && prop.initializer && ts.isStringLiteral(prop.initializer) && prop.initializer.text === "line");
}
function insideWhisperLine(node) {
  for (let cursor = node.parent; cursor; cursor = cursor.parent) {
    const tag = tagName(cursor);
    if (tag === "Whisper") return whisperIsLine(cursor);
  }
  return false;
}
function disclosed(node) {
  for (let cursor = node.parent; cursor; cursor = cursor.parent) {
    const tag = tagName(cursor);
    if (tag && DISCLOSED_TAGS.has(tag) && !(tag === "Whisper" && whisperIsLine(cursor))) return true;
  }
  return false;
}
const collapse = (text) => text.replace(/\s+/g, " ").trim();

/** Returns { files: {file, visibleChars, runs:[{line,text,length,disclosed}]}, offenders:[{file,line,text,length}] } */
export function scanCopyBudget(root = "src", cwd = process.cwd()) {
  const files = [];
  const offenders = [];
  const longLines = [];
  for (const path of listComponentFiles(root)) {
    const file = relative(cwd, path).replace(/\\/g, "/");
    const source = readFileSync(path, "utf8");
    const sf = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const runs = [];
    const visit = (node) => {
      let text = null;
      if (ts.isJsxText(node)) text = collapse(node.getText());
      else if (ts.isJsxExpression(node) && node.expression && (ts.isStringLiteral(node.expression) || ts.isNoSubstitutionTemplateLiteral(node.expression)) && node.parent && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) text = collapse(node.expression.text);
      if (text && text.length > 0) {
        const hidden = disclosed(node);
        const line = sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;
        runs.push({ line, text, length: text.length, disclosed: hidden });
        if (!hidden && text.length > LONG_LINE) offenders.push({ file, line, text, length: text.length });
        if (insideWhisperLine(node) && text.length > WHISPER_LINE_MAX) longLines.push({ file, line, text, length: text.length });
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
    files.push({ file, visibleChars: runs.filter(run => !run.disclosed).reduce((sum, run) => sum + run.length, 0), disclosedChars: runs.filter(run => run.disclosed).reduce((sum, run) => sum + run.length, 0), runs });
  }
  return { files, offenders, longLines };
}

/** Stable identity for an allow-list entry: file plus the first 48 characters of the text. */
export const offenderKey = (offender) => `${offender.file}|${offender.text.slice(0, 48)}`;

if (import.meta.url === `file://${process.argv[1]}`) {
  const top = Number((process.argv.find(arg => arg.startsWith("--top=")) ?? "--top=20").slice(6));
  const result = scanCopyBudget();
  const ranked = [...result.files].sort((a, b) => b.visibleChars - a.visibleChars).slice(0, top);
  console.log("always-visible prose (characters) by file");
  for (const row of ranked) console.log(String(row.visibleChars).padStart(6), String(row.disclosedChars).padStart(6) + " disclosed", row.file);
  console.log(`\n${result.offenders.length} always-visible runs over ${LONG_LINE} characters`);
  if (process.argv.includes("--list")) for (const row of result.offenders) console.log(`${row.file}:${row.line} (${row.length}) ${row.text.slice(0, 90)}`);
}
