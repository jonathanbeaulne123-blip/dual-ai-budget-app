import { describe, expect, it } from "vitest";
import { relative } from "node:path";
import { listComponentFiles } from "../scripts/copy-budget.mjs";
import { COPY_TABLE_FILES, INTERNAL_TERMS_NEVER_SHOWN, householdWords } from "../src/core/terms.ts";
import { renderedStrings } from "./rendered-strings.ts";

/**
 * Vocabulary fence (feedback row 6). Rendered strings in components — and in
 * the `.ts` copy tables `COPY_TABLE_FILES` names — use the household's words:
 * no library names, no internal metaphors, one spelling of Sitdown. Class
 * names, ids, imports, keys and console output are code, not copy, and are
 * skipped.
 */
describe("Hearth's words — internal names never reach the screen", () => {
  it("keeps PGlite, kitchen, snapshot and Sit-down out of rendered component strings and copy tables", () => {
    const hits: string[] = [];
    for (const file of [...listComponentFiles("src"), ...COPY_TABLE_FILES]) {
      const rel = relative(process.cwd(), file).replace(/\\/g, "/");
      for (const { line, text } of renderedStrings(file)) {
        for (const rule of INTERNAL_TERMS_NEVER_SHOWN) if (rule.pattern.test(text)) hits.push(`${rel}:${line} "${text.trim().slice(0, 70)}" → say "${rule.use}"`);
      }
    }
    expect(hits).toEqual([]);
  });
  it("reads the copy tables it names", () => {
    for (const file of COPY_TABLE_FILES) expect(renderedStrings(file).length, file).toBeGreaterThan(0);
  });
  it("rewrites a runtime sentence into household words", () => {
    expect(householdWords("PGlite rejected the journal.")).toBe("this phone’s books rejected the journal.");
    expect(householdWords("Open the kitchen and finish the sit-down.")).toBe("Open Hearth and finish the Sitdown.");
    expect(householdWords("The household snapshot changed; a snapshot copy remains.")).toBe("the books changed; a books copy remains.");
  });
});
