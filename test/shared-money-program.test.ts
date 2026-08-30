import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const programDir = resolve(root, "docs/briefs/shared-money");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("D-174 Shared Money program canon", () => {
  it("preserves current financial authority and names future direction honestly", () => {
    const program = read("docs/briefs/shared-money/README.md");
    const decisions = read("docs/DECISIONS.md");

    expect(decisions).toContain("| D-174 |");
    expect(program).toContain("D-172 remains the current financial-write boundary");
    expect(program).toContain("Household Fund remains a virtual operating subledger");
    expect(program).toContain("Nothing in this program authorizes background ledger posting");
    expect(program).toContain("partner-backed Canadian joint-account company");
    expect(program).toContain("Unmatched, duplicate, late, reversed, or ambiguous events go to review");
  });

  it("provides every executable Phase 0 packet", () => {
    const packets = [
      "SF-00-program-canon.md",
      "SF-01-baseline-reconciliation.md",
      "SF-02-membership-completion.md",
      "SF-03-continuity-completion.md",
      "SF-04-opening-truth.md",
      "SF-05-fail-closed-acceptance-audit.md",
    ];

    for (const packet of packets) {
      const path = resolve(programDir, packet);
      expect(existsSync(path), `${packet} should exist`).toBe(true);
      const contents = readFileSync(path, "utf8");
      expect(contents).toMatch(/\*\*(Exact baseline|Baseline):\*\*/);
      expect(contents).toMatch(/\*\*Risk:\*\*/);
      expect(contents).toMatch(/Acceptance|Exit rule/);
      expect(contents).toMatch(/Production|runtime impact none/);
    }
  });

  it("links the program from living canon instead of creating a replacement roadmap", () => {
    const program = read("docs/briefs/shared-money/README.md");
    const roadmap = read("docs/HEARTH_ROADMAP.md");
    const index = read("docs/README.md");

    expect(program).toContain("extends [HEARTH_ROADMAP.md]");
    expect(program).toContain("does not replace it");
    expect(roadmap).toContain("briefs/shared-money/");
    expect(index).toContain("briefs/shared-money/");
  });
});
