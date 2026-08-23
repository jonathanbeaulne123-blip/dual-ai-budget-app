#!/usr/bin/env node
/**
 * Pack the current Claude desktop-office brief + the sources he must extend, not strip.
 * Usage: node scripts/pack-claude-desktop.mjs
 * Writes docs/packets/CLAUDE-DESKTOP-OFFICE-SOURCE.txt
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const files = [
  "docs/CLAUDE_DESKTOP_OFFICE.md",
  "docs/DECISIONS.md",
  "docs/STRATEGY.md",
  "docs/OFFICE.md",
  "docs/GOOGLE.md",
  "src/Office.tsx",
  "src/OfficePhone.tsx",
  "src/office.css",
  "src/office-phone.css",
  "src/styles.css",
  "src/core/officeLayout.ts",
  "src/core/officePhone.ts",
  "src/widgets/Cabinets.tsx",
  "src/widgets/DeskItem.tsx",
];

const outDir = join(root, "docs/packets");
mkdirSync(outDir, { recursive: true });

const chunks = [
  "HEARTH DESKTOP OFFICE — attach after pasting docs/CLAUDE_DESKTOP_OFFICE.md.",
  "Desktop/wide (≥720px) takes the customization packet. OfficePhone is shipped; do not turn it back into seventeen rows.",
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

const out = join(outDir, "CLAUDE-DESKTOP-OFFICE-SOURCE.txt");
writeFileSync(out, chunks.join("\n"));
console.log(`wrote ${out} (${chunks.join("\n").length} chars, ${files.length} files)`);
