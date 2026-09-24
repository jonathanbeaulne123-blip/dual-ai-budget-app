import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The Desk's money-safety fence (SIMPLE_VIEW_DESK hard rules): the Desk reads
 * selectors and opens existing doors. It never imports a command, a poster,
 * the kitchen, the ledger or the network; it never writes a hypothetical walk
 * or a Hercules suggestion back; it draws no WebGL; and no word on it claims
 * money was saved. All posting stays in the existing flows (FAB, Swipe).
 */
const desk = join(process.cwd(), "src", "harbour", "desk");
const files = (function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
})(desk);
const name = (file: string) => relative(desk, file).replace(/\\/g, "/");
const importsOf = (source: string): string[] => [...source.matchAll(/(?:from|import\()\s*["']([^"']+)["']/g)].map((m) => m[1]!);

const FORBIDDEN_IMPORTS: { rule: string; test: (specifier: string) => boolean }[] = [
  { rule: "core/commands", test: (s) => /\/core\/commands(\.ts)?$/.test(s) || /\/core\/commands\//.test(s) || /commands\.ts$/.test(s) },
  { rule: "core/index (the command surface)", test: (s) => /\/core\/index(\.ts)?$/.test(s) || /\/core$/.test(s) },
  { rule: "kitchenCommand", test: (s) => /kitchenCommand/.test(s) },
  { rule: "a ledger writer", test: (s) => /\/ledger\//.test(s) || /\/ledger\.ts$/.test(s) || /ledgerSync/.test(s) },
  { rule: "storage / continuity / api", test: (s) => /\/(storage|continuity|api)(\.ts)?$/.test(s) },
  { rule: "supabase", test: (s) => /supabase/i.test(s) },
  { rule: "the Hercules companion writer", test: (s) => /herculesCompanion(\.ts)?$/.test(s) },
  { rule: "three.js / WebGL", test: (s) => /(^|\/)three(\/|$)/.test(s) || /\/scene\/(runtime|quality)/.test(s) },
  { rule: "the App", test: (s) => /\/App(\.tsx)?$/.test(s) },
];

const MONEY_VERBS = /\b(postEntry|postShift|postVisit|postTransaction|acceptHouseholdWrite|allocateHouseholdFundSurplus|commitCommand|commitCompanion|runKitchen|dispatchCommand|onCommand|applyCommand|fundWalkWith|discoveryState|deferObligation)\b/;

describe("src/harbour/desk money-safety fence", () => {
  it("has the shell, the registry and Today", () => {
    expect(files.map(name)).toEqual(expect.arrayContaining(["DeskShell.tsx", "pages.ts", "DeskToday.tsx", "flip.ts"]));
  });

  it("imports no command, poster, kitchen, ledger writer, network, companion writer or WebGL", () => {
    const offences: string[] = [];
    for (const file of files) for (const specifier of importsOf(readFileSync(file, "utf8"))) {
      for (const { rule, test } of FORBIDDEN_IMPORTS) if (test(specifier)) offences.push(`${name(file)} → ${specifier} (${rule})`);
    }
    expect(offences).toEqual([]);
  });

  it("calls no posting or writing function by name", () => {
    const offences = files.filter((file) => MONEY_VERBS.test(readFileSync(file, "utf8"))).map(name);
    expect(offences).toEqual([]);
  });

  it("draws no WebGL and reads no environment flag", () => {
    const offences = files.filter((file) => /getContext\(|WebGLRenderer|import\.meta\.env/.test(readFileSync(file, "utf8"))).map(name);
    expect(offences).toEqual([]);
  });

  it("touches storage only to write the edition switch, in one file", () => {
    const readers = files.filter((file) => /localStorage|sessionStorage|indexedDB|\bfetch\(/.test(readFileSync(file, "utf8"))).map(name);
    expect(readers).toEqual(["flip.ts"]);
  });

  it("never says money was saved", () => {
    const offences = files.filter((file) => file.endsWith(".tsx") && /\bsaved\b|\bsaving\b/i.test(readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ""))).map(name);
    expect(offences).toEqual([]);
  });
});
