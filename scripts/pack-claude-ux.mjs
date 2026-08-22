#!/usr/bin/env node
/**
 * Pack living canon + UI source for Claude (September Office UX).
 * Usage: node scripts/pack-claude-ux.mjs
 * Writes docs/packets/CLAUDE-OFFICE-UX-SOURCE.txt
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const files = [
  "docs/CLAUDE_OFFICE_UX.md",
  "docs/OFFICE.md",
  "AGENTS.md",
  "docs/STRATEGY.md",
  "docs/DECISIONS.md",
  "docs/ARCHITECTURE.md",
  "docs/HERCULES.md",
  "docs/ACCOUNTS.md",
  "docs/AUDIT_OFFICE.md",
  "docs/AI_HANDOFF.md",
  "docs/ENVIRONMENTS.md",
  "package.json",
  "src/main.tsx",
  "src/App.tsx",
  "src/Hercules.tsx",
  "src/DailyHearth.tsx",
  "src/Accounts.tsx",
  "src/CadPad.tsx",
  "src/SitDownGuide.tsx",
  "src/Calendar.tsx",
  "src/Books.tsx",
  "src/Confirm.tsx",
  "src/styles.css",
  "src/core/index.ts",
  "src/core/herculesTalk.ts",
  "src/core/hercules.ts",
  "src/core/herculesLedger.ts",
  "src/core/companion.ts",
  "src/core/cadPad.ts",
  "src/core/shiftStreak.ts",
  "src/core/insights.ts",
  "src/core/kitchen.ts",
  "src/core/herculesPersonality.ts",
  "src/core/askBooks.ts",
  "src/core/calendar.ts",
  "src/core/money.ts",
  "src/core/accounts.ts",
];

const outDir = join(root, "docs/packets");
mkdirSync(outDir, { recursive: true });

const chunks = [
  "HEARTH SEPTEMBER OFFICE — living source for Claude.",
  "Copy this file after docs/CLAUDE_OFFICE_UX.md if you did not paste the prompt separately.",
  "Each section starts with ===== path =====",
  "docs/nostalgia and docs/reference are not included. They are history, not this brief.",
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

const out = join(outDir, "CLAUDE-OFFICE-UX-SOURCE.txt");
writeFileSync(out, chunks.join("\n"));
console.log(`wrote ${out} (${chunks.join("\n").length} chars, ${files.length} files)`);
