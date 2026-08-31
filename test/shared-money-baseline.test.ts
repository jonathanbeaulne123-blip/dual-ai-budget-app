import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

type Capability = {
  id: string;
  status: string;
  trace: string;
  flags: string[];
  migrations: string[];
  tests: string[];
  development: string;
  production: string;
  owner: string;
  proofDate: string;
  staleDocumentation: string[];
  rollback: string;
  unknowns: string[];
};

type Baseline = {
  schemaVersion: number;
  asOfToronto: string;
  baseline: string;
  evidenceRule: string;
  capabilities: Capability[];
};

describe("SF-01 Shared Money capability truth", () => {
  const baseline = JSON.parse(read("docs/shared-money-baseline.json")) as Baseline;
  const human = read("docs/SHARED_MONEY_BASELINE.md");
  const decisions = read("docs/DECISIONS.md");
  const roadmap = read("docs/HEARTH_ROADMAP.md");

  it("keeps one complete Development-versus-Production row for all eight capabilities", () => {
    const expected = [
      "identity",
      "membership",
      "continuity",
      "opening-truth",
      "batch-imports",
      "household-fund",
      "notifications",
      "financial-writes",
    ];

    expect(baseline.schemaVersion).toBe(1);
    expect(baseline.baseline).toBe("D-180 pilot branch from origin/main@3e48bcc3ca3919d8663c2f1ab1dfbd5a5cfda7cf");
    expect(baseline.evidenceRule).toContain("A flag is not runtime proof");
    expect(baseline.capabilities.map(({ id }) => id)).toEqual(expected);
    expect(new Set(expected).size).toBe(expected.length);

    for (const capability of baseline.capabilities) {
      expect(capability.status).not.toBe("");
      expect(capability.trace).not.toBe("");
      expect(capability.development).not.toBe("");
      expect(capability.production).not.toBe("");
      expect(capability.development).not.toBe(capability.production);
      expect(capability.owner).not.toBe("");
      expect(capability.proofDate).not.toBe("");
      expect(Array.isArray(capability.staleDocumentation)).toBe(true);
      expect(capability.rollback).not.toBe("");
      expect(capability.tests.length).toBeGreaterThan(0);
      expect(capability.unknowns.length).toBeGreaterThan(0);
      const heading: Record<string, string> = {
        identity: "Identity",
        membership: "Membership",
        continuity: "Continuity",
        "opening-truth": "Opening truth",
        "batch-imports": "Batch imports",
        "household-fund": "Household Fund",
        notifications: "Notifications",
        "financial-writes": "Financial writes",
      };
      expect(human).toContain(heading[capability.id]);
    }
  });

  it("locks D-161, D-162, D-172, and D-174 without inventing bank authority", () => {
    const program = read("docs/briefs/shared-money/README.md");
    const wrangler = read("wrangler.jsonc");

    expect(decisions).toMatch(/D-161[^\n]+virtual shared operating subledger, not a bank account/);
    expect(decisions).toMatch(/D-162[^\n]+read-only evidence/);
    expect(decisions).toMatch(/D-162[^\n]+An unmatched bank row never creates or changes money/);
    expect(decisions).toMatch(/D-172[^\n]+D-159 automatic posting is superseded/);
    expect(decisions).toMatch(/D-174[^\n]+does \*\*not\*\* authorize background financial posting/);
    expect(decisions.match(/^\| D-174 \|/gm)).toHaveLength(1);
    expect(decisions.match(/^\| D-175 \|/gm)).toHaveLength(1);
    expect(decisions).toContain("D-175 why-note (2026-08-30, swift local acceptance)");
    expect(decisions).toContain("D-174 why-note (2026-08-30, SF-01 reconciliation)");

    expect(program).toContain("D-162 keeps Fund-specific connected evidence read-only and Release-gated");
    expect(program).not.toContain("D-162 remains disabled, read-only provider evidence");
    expect(wrangler).toContain('"FLINKS_ENABLED": "true"');
    expect(wrangler).toContain('"FLINKS_ALLOW_PRODUCTION": "false"');
    expect(wrangler).toContain('"EVIDENCE_AUTOMATION_ENABLED": "false"');
  });

  it("keeps Production build gates distinct from runtime and Realtime proof", () => {
    const workflow = read(".github/workflows/pages.yml");
    const realtimePolicy = read("src/continuityRealtimePolicy.ts");
    const continuity = baseline.capabilities.find(({ id }) => id === "continuity");

    expect(workflow).toContain('VITE_PRODUCTION_CONTINUITY: "0"');
    expect(workflow).toContain('VITE_SYNC_PILOT_DIAGNOSTICS: "1"');
    expect(realtimePolicy).toContain('return environment === "development"');
    expect(continuity?.development).toContain("<=500 ms p95");
    expect(continuity?.production).toContain("pilot workflow gate is off");
    expect(continuity?.production).toContain("refuses discovery/transport/Realtime");
  });

  it("rejects the stale capability claims SF-01 corrected", () => {
    const imports = read("docs/BATCH_IMPORTS.md");

    expect(roadmap).not.toContain("today’s primary path is 4 s poll fallback");
    expect(roadmap).not.toContain("G6 in-memory 012 proof still open");
    expect(roadmap).not.toContain("Production discovery remains off");
    expect(roadmap).not.toContain("T1-S1/S2 atomic Personal+Shared (Migration 012 + Auth client push) shipped on branch; merge pending");
    expect(roadmap).not.toContain("revoke UI deferred");
    expect(imports).not.toContain("D-137 reconciliation and receipt-number extraction are local branch work and are **not deployed**");
    expect(imports).toContain("is present on current `main`");
    expect(imports).toContain("does not call D-141 live");
  });
});
