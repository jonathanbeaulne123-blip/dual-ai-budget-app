import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The Campfire ritual's own fence (Tool Atlas D3; moved out of src/harbour by the fix pass, review §2 item 1).
 * src/campfire is a working surface, not the scene: it may import core's captured commands and the App-level
 * Chapter and Sitdown controls, and hand every write to the App's run. It may not reach the kitchen, the
 * ledger, sync, storage, continuity, the network or the harbour. Nothing under src/harbour may import any of
 * this (test/harbour-source-fences.test.ts).
 */
const root = process.cwd();
const campfire = join(root, "src", "campfire");
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}
const files = walk(campfire);
const name = (file: string) => relative(campfire, file).replace(/\\/g, "/");
const importsOf = (source: string): string[] => [...source.matchAll(/(?:from|import\(|import)\s*["']([^"']+)["']/g)].map((m) => m[1]!);
const captured = new Set(walk(join(root, "src", "core")).flatMap((file) => [...readFileSync(file, "utf8").matchAll(/export const (\w+)\s*=\s*captureCommand\(/g)].map((m) => m[1]!)));

describe("src/campfire source fence", () => {
  it("is the ritual's whole directory, and src/harbour no longer holds it", () => {
    expect(files.map(name).sort()).toEqual(["CampfireDoor.tsx", "CampfireGlyph.tsx", "CampfireRitual.tsx", "WeeklySitdown.tsx", "beats.tsx", "index.ts", "model.ts", "useCampfireWrite.ts"]);
    expect(() => statSync(join(root, "src", "harbour", "campfire", "ritual"))).toThrow();
  });

  it("imports only react, core, useDialog, its own files and the three App-level controls it reuses", () => {
    const allowed = (specifier: string) =>
      specifier === "react"
      || /^\.\/[A-Za-z]+\.(tsx?|css)$/.test(specifier)
      || /^\.\.\/core\/[A-Za-z]+\.ts$/.test(specifier)
      || ["../useDialog.ts", "../ChapterPanel.tsx", "../ChapterTaskControls.tsx", "../SitDownGuide.tsx"].includes(specifier);
    const offences = files.flatMap((file) => importsOf(readFileSync(file, "utf8")).filter((specifier) => !allowed(specifier)).map((specifier) => `${name(file)} → ${specifier}`));
    expect(offences).toEqual([]);
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, name(file)).not.toMatch(/kitchenCommand|ledgerSync|\/ledger\/|supabase|continuity|\/harbour\//);
      expect(source, name(file)).not.toMatch(/localStorage|sessionStorage|indexedDB|\bfetch\(|import\.meta\.env/);
    }
  });

  it("imports exactly these captured commands, and calls each on the accepted household it is handed", () => {
    const imported = new Set<string>();
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+["']\.\.\/core\/[^"']+["']/g)) {
        for (const raw of match[1]!.split(",")) {
          const id = raw.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0]!.trim();
          if (captured.has(id)) imported.add(id);
        }
      }
      // Every captured command in this directory is called as `command(current, …)`, inside a function the
      // App's run is given (useCampfireWrite's write / relay → onCommand = runKitchen); never on a stored household.
      for (const id of captured) {
        for (const call of source.matchAll(new RegExp(`\\b${id}\\(([a-z]+)`, "g"))) expect(call[1], `${name(file)}: ${id}(${call[1]}…`).toBe("current");
      }
    }
    expect([...imported].sort()).toEqual([
      "acknowledgeHouseholdPlan", "acknowledgeRitualChange", "appendPlanSitdownTurn", "closeBooksMonth", "closeChapter",
      "dismissWin", "editRitual", "keepWinAsMemory", "offerMove", "openChapter",
    ]);
    // No money writer is imported here; the one reached through a reused control is fenced in campfire-ritual.test.ts.
    for (const money of ["executeSitDownMoves", "postEntry", "postTransfer", "postShift", "postOneRecurrence", "fundGoal", "allocateHouseholdFundSurplus"]) expect(imported.has(money)).toBe(false);
  });

  it("hands every write to the App's run: useCampfireWrite calls onCommand and nothing commits itself", () => {
    const write = readFileSync(join(campfire, "useCampfireWrite.ts"), "utf8");
    expect(write.match(/await onCommand\(fn\)/g)).toHaveLength(2);
    for (const file of files) expect(readFileSync(file, "utf8"), name(file)).not.toMatch(/commitCommand|acceptHouseholdWrite|setHousehold\(/);
  });
});
