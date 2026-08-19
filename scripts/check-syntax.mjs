import { readFileSync, readdirSync } from "node:fs";
import vm from "node:vm";

const serverFiles = readdirSync(".")
  .filter((file) => file.endsWith(".gs"))
  .sort();
const htmlFiles = [
  "AddTransactionDialog.html",
  "AddCategoryDialog.html",
  "AddShiftDialog.html",
  "CategorySpendingDialog.html",
];

if (!serverFiles.includes("Code.gs") || !serverFiles.includes("Maintenance.gs")) {
  throw new Error("Expected Code.gs and Maintenance.gs in the Apps Script source set.");
}

const serverSources = serverFiles.map((file) => ({
  file,
  source: readFileSync(file, "utf8"),
}));
serverSources.forEach(({ file, source }) => {
  new vm.Script(source, { filename: file });
});

const codeSource = serverSources.find(({ file }) => file === "Code.gs").source;
const versionMatch = codeSource.match(/var\s+APP_VERSION\s*=\s*['\"]([^'\"]+)['\"]/);
if (!versionMatch) {
  throw new Error("Code.gs does not declare APP_VERSION.");
}

const declaredFunctions = serverSources.flatMap(({ source }) => [
  ...source.matchAll(/^\s*function\s+([A-Za-z_$][\w$]*)\s*\(/gm),
].map((match) => match[1]));
const duplicateFunctions = [...new Set(
  declaredFunctions.filter((name, index) => declaredFunctions.indexOf(name) !== index),
)];
if (duplicateFunctions.length) {
  throw new Error(`Duplicate top-level functions: ${duplicateFunctions.join(", ")}`);
}

const releaseVersions = [
  ...codeSource.matchAll(/\{\s*version:\s*['\"]([^'\"]+)['\"]/g),
].map((match) => match[1]);
if (releaseVersions.at(-1) !== versionMatch[1]) {
  throw new Error(`APP_VERSION ${versionMatch[1]} does not match the latest release-history entry ${releaseVersions.at(-1)}.`);
}
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
if (`v${packageJson.version}` !== versionMatch[1]) {
  throw new Error(`package.json ${packageJson.version} does not match APP_VERSION ${versionMatch[1]}.`);
}

const claspWhitelist = new Set(
  readFileSync(".claspignore", "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean),
);
const expectedClaspFiles = ["appsscript.json", ...serverFiles, ...htmlFiles];
const omittedClaspFiles = expectedClaspFiles.filter((file) => !claspWhitelist.has(`!${file}`));
if (omittedClaspFiles.length) {
  throw new Error(`Apps Script source omitted by .claspignore: ${omittedClaspFiles.join(", ")}`);
}

for (const htmlFile of htmlFiles) {
  const html = readFileSync(htmlFile, "utf8");
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  scripts.forEach((match, index) => {
    // Apps Script evaluates template scriptlets before sending HTML to the
    // browser. Replace those server-side placeholders with a valid JavaScript
    // literal so this check parses the client code around them.
    const clientSource = match[1].replace(/<\?[\s\S]*?\?>/g, "null");
    new vm.Script(clientSource, { filename: `${htmlFile}#script-${index + 1}` });
  });
}

console.log(`Syntax/version checks passed for Apps Script ${versionMatch[1]} across ${serverFiles.length} server files and ${htmlFiles.length} dialogs.`);
