#!/usr/bin/env node
/**
 * Pack the current Claude mobile-shell brief + the office sources he must not strip on wide.
 * Usage: node scripts/pack-claude-mobile.mjs
 * Writes docs/packets/CLAUDE-MOBILE-SHELL-SOURCE.txt
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const files = [
  "docs/CLAUDE_MOBILE_SHELL.md",
  "docs/DECISIONS.md",
  "docs/STRATEGY.md",
  "docs/OFFICE.md",
  "src/Office.tsx",
  "src/office.css",
  "src/styles.css",
  "src/core/officeLayout.ts",
  "src/widgets/Instrument.tsx",
  "src/widgets/Cabinets.tsx",
  "src/widgets/DeskItem.tsx",
];

const outDir = join(root, "docs/packets");
mkdirSync(outDir, { recursive: true });

const chunks = [
  "HEARTH MOBILE SHELL — attach after pasting docs/CLAUDE_MOBILE_SHELL.md.",
  "Desktop/wide (≥720px) is frozen this pass. Do not restyle .desk-wide to match five phone tiles.",
  "Each section starts with ===== path =====",
  "Do not rewrite postEntry, postShift, applySitDown, or the journal compiler.",
  "",
];

for (const rel of files) {
  const abs = join(root, rel);
  let body;
  try {
    body = readFileSync(abs, "utf8");
  } catch {
    chunks.push(`===== ${rel} =====\n\nMISSING FILE\n`);
    continue;
  }
  chunks.push(`===== ${rel} =====\n\n${body.trimEnd()}\n`);
}

const out = join(outDir, "CLAUDE-MOBILE-SHELL-SOURCE.txt");
writeFileSync(out, chunks.join("\n"));
console.log(`wrote ${out} (${chunks.join("\n").length} chars, ${files.length} files)`);
