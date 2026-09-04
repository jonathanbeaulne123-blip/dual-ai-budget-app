import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const matrix = readFileSync("docs/OCTOBER_READINESS_MATRIX.md", "utf8");

const requiredControls = [
  ["OCT-001-GOOGLE-RECOVERY", "Google login/recovery"],
  ["OCT-002-PERSONAL-DENIAL", "Personal read/write denial"],
  ["OCT-003-MEMBERSHIP-DENIAL", "household membership read/write denial"],
  ["OCT-004-CROSS-ENV-DENIAL", "cross-environment denial"],
  ["OCT-005-CREATE", "create"],
  ["OCT-006-EMAIL-INVITE", "email invite"],
  ["OCT-007-QR-INVITE", "QR invite"],
  ["OCT-008-INVITE-REVOKE", "revoke invitation"],
  ["OCT-009-REMOVE-MEMBER", "remove member"],
  ["OCT-010-DEVICE-REVOKE", "device revoke"],
  ["OCT-011-LAST-OWNER", "last-owner refusal/transfer"],
  ["OCT-012-ATOMIC-COMMAND-CAS", "atomic command/CAS"],
  ["OCT-013-SECRET-INVENTORY", "secret inventory"],
  ["OCT-014-BRANCH-PROTECTION", "branch protection"],
  ["OCT-015-PRODUCTION-APPROVAL", "Production approval"],
  ["OCT-016-RATE-LIMIT", "rate limit"],
  ["OCT-017-AUDIT-EXPORT", "audit export"],
  ["OCT-018-BACKUP-RESTORE", "backup/restore"],
  ["OCT-019-DELETION-DISPOSITION", "deletion/disposition"],
  ["OCT-020-PROVIDER-OFF", "provider off-by-default"],
] as const;

const expectedColumns = [
  "controlId",
  "threat",
  "Development state",
  "Production state",
  "automated proof",
  "manual proof",
  "owner",
  "rollback",
  "evidence location",
  "status",
];

function cells(line: string): string[] {
  return line.split("|").slice(1, -1).map((cell) => cell.trim());
}

const lines = matrix.split("\n");
const headerIndex = lines.findIndex((line) => line.startsWith("| controlId |"));
const rows = lines.filter((line) => /^\| OCT-\d{3}-/.test(line)).map(cells);

describe("October readiness matrix", () => {
  it("keeps the executable headings, exact columns, and audited baseline", () => {
    for (const heading of [
      "## How to use this gate",
      "## Status vocabulary",
      "## Control ID register",
      "## Executable matrix",
      "## Current decision",
      "## Evidence update protocol",
    ]) {
      expect(matrix).toContain(heading);
    }
    expect(matrix).toContain("8ca2a9b91208922967f91c1ab2fd9841f647ae21");
    expect(headerIndex).toBeGreaterThan(-1);
    expect(cells(lines[headerIndex]!)).toEqual(expectedColumns);
    expect(rows).toHaveLength(requiredControls.length);
    expect(rows.every((row) => row.length === expectedColumns.length)).toBe(true);
  });

  it("includes every required stable control ID exactly once", () => {
    for (const [controlId, requiredMeaning] of requiredControls) {
      const matches = matrix.match(new RegExp(`^\\| ${controlId} \\|`, "gm")) ?? [];
      expect(matches, controlId).toHaveLength(1);
      const row = rows.find((candidate) => candidate[0] === controlId);
      expect(row?.[1]?.toLowerCase(), `${controlId} required meaning`).toContain(requiredMeaning.toLowerCase());
    }
    expect(new Set(rows.map((row) => row[0])).size).toBe(requiredControls.length);
  });

  it("uses only explicit statuses and never promotes Development evidence to Production", () => {
    const allowedStatuses = new Set([
      "blocked",
      "implemented-unverified",
      "development-verified",
      "production-ready",
    ]);
    for (const row of rows) {
      const [controlId, , developmentState, productionState, automatedProof, manualProof, owner, rollback, evidence, status] = row;
      expect(allowedStatuses.has(status!), `${controlId} status`).toBe(true);
      expect(developmentState, `${controlId} Development state`).not.toBe("");
      expect(productionState, `${controlId} Production state`).not.toBe("");
      expect(owner, `${controlId} owner`).not.toMatch(/^(?:none|tbd|unknown)?$/i);
      expect(rollback, `${controlId} rollback`).not.toMatch(/^(?:none|tbd|unknown)?$/i);
      expect(evidence, `${controlId} evidence`).not.toMatch(/^(?:none|tbd|unknown)?$/i);

      if (status === "production-ready") {
        const incomplete = /\b(?:none|future|pending|open|deferred|missing|unproved|unverified|absent|refused|disabled|not performed|not recorded)\b/i;
        expect(productionState, `${controlId} Production proof`).not.toMatch(incomplete);
        expect(automatedProof, `${controlId} automated proof`).not.toMatch(incomplete);
        expect(manualProof, `${controlId} manual proof`).not.toMatch(incomplete);
        expect(evidence, `${controlId} evidence`).not.toMatch(incomplete);
        expect(`${manualProof} ${evidence}`, `${controlId} exact Production receipt`).toMatch(/Production.*\b[0-9a-f]{40}\b.*receipt|receipt.*\b[0-9a-f]{40}\b.*Production/i);
      }
    }
    expect(matrix).toMatch(/Development evidence can move a row to `development-verified`; it can never make Production ready\./);
    expect(matrix).not.toMatch(/disposable[^.\n]{0,100}(?:secure|production-ready)|(?:secure|production-ready)[^.\n]{0,100}disposable/i);
  });

  it("gives every manual-only control an owner, rollback, and evidence destination", () => {
    for (const row of rows) {
      const [controlId, , , , automatedProof, , owner, rollback, evidence] = row;
      if (/^none\b/i.test(automatedProof!)) {
        expect(owner, `${controlId} owner`).not.toBe("");
        expect(rollback, `${controlId} rollback`).not.toBe("");
        expect(evidence, `${controlId} evidence`).not.toBe("");
      }
    }
  });
});
