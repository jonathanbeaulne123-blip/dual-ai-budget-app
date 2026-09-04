#!/usr/bin/env node

import { readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { evaluateSyncDailyProof } from "../src/syncDailyProof.ts";

const MAX_INPUT_BYTES = 8 * 1024 * 1024;

function usage() {
  return [
    "Usage: node scripts/collect-sync-proof.mjs --input <evidence.json> --release-sha <40-char-sha> [--output <result.json>]",
    "",
    "Validates an operator-produced, Development-only two-account sync ledger.",
    "It never runs account actions, reads credentials, or treats synthetic tests as live proof.",
  ].join("\n");
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--help" || token === "-h") return { help: true };
    if (!["--input", "--release-sha", "--output"].includes(token)) throw new Error("unknown-argument");
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error("missing-argument-value");
    const key = token.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (key in options) throw new Error("duplicate-argument");
    options[key] = value;
    index += 1;
  }
  if (!options.input || !options.releaseSha) throw new Error("missing-required-argument");
  return options;
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch {
    process.stderr.write(`${usage()}\n`);
    process.exitCode = 2;
    return;
  }
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const inputPath = resolve(options.input);
  const outputPath = options.output ? resolve(options.output) : null;
  if (outputPath === inputPath) {
    process.stderr.write("Refusing to overwrite the evidence input.\n");
    process.exitCode = 2;
    return;
  }

  let parsed;
  try {
    const info = await stat(inputPath);
    if (!info.isFile() || info.size > MAX_INPUT_BYTES) throw new Error("invalid-input-file");
    parsed = JSON.parse(await readFile(inputPath, "utf8"));
  } catch {
    process.stderr.write("Sync proof input is unavailable, oversized, or invalid JSON.\n");
    process.exitCode = 2;
    return;
  }

  const result = evaluateSyncDailyProof(parsed, options.releaseSha);
  if (parsed?.evidenceSource === "live-two-account-development") {
    const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: process.cwd(), encoding: "utf8" });
    const trackedStatus = spawnSync("git", ["status", "--porcelain", "--untracked-files=no"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    if (
      head.status !== 0
      || head.stdout.trim() !== options.releaseSha
      || trackedStatus.status !== 0
      || trackedStatus.stdout.trim() !== ""
    ) {
      process.stderr.write("Live evidence evaluation requires a clean checkout at the exact release SHA.\n");
      process.exitCode = 2;
      return;
    }
  }
  const serialized = `${JSON.stringify(result, null, 2)}\n`;
  if (outputPath) {
    try {
      await writeFile(outputPath, serialized, { encoding: "utf8", mode: 0o600, flag: "wx" });
    } catch {
      process.stderr.write("Refusing to replace or unable to create the proof result file.\n");
      process.exitCode = 2;
      return;
    }
    process.stdout.write(`${result.classification}: ${result.summary.count} samples; ${result.issues.length} issue codes.\n`);
  } else {
    process.stdout.write(serialized);
  }
  process.exitCode = result.classification === "operator-review-required" ? 3 : 1;
}

await main();
