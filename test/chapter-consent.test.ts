import { describe, expect, it } from "vitest";
import {
  approveChapterConsent,
  chapterConsentDigest,
  mergeChapterParticipation,
  proposeChapterConsent,
  selectChapterConsent,
} from "../src/core/chapterConsent.ts";
import { ValidationError } from "../src/core/types.ts";

const at = "2026-11-14T10:00:00.000Z";
const later = "2026-11-14T10:05:00.000Z";
const audience = ["MEM-001", "MEM-002"];
const basis = chapterConsentDigest({ kind: "unit-test-terms" });
const terms = { title: "Close the chapter" };

function propose(existing?: ReturnType<typeof proposeChapterConsent>, memberId = "MEM-001", extra: Partial<{ terms: typeof terms; expectedRevision: number; at: string }> = {}) {
  return proposeChapterConsent(existing, {
    expectedRevision: extra.expectedRevision ?? (existing?.revision ?? 0),
    identity: "closure-CH-1",
    terms: extra.terms ?? terms,
    basis,
    audience,
    memberId,
    at: extra.at ?? at,
    legacyBaseline: false,
  });
}

describe("chapter consent", () => {
  it("accepts only after every audience member agrees to the same digest", () => {
    const proposed = propose();
    const pending = proposed.proposals[0]!;
    expect(pending.state).toBe("pending");
    expect(pending.approvals.map((row) => row.memberId)).toEqual(["MEM-001"]);
    expect(pending.digest).toMatch(/^[a-f0-9]{64}$/);

    const first = approveChapterConsent(proposed, {
      expectedRevision: proposed.revision,
      proposalId: pending.id,
      digest: pending.digest,
      basis,
      audience,
      memberId: "MEM-002",
      at: later,
    });
    expect(first.accepted).toBe(true);
    expect(first.proposal.state).toBe("accepted");
    expect(first.consent.acceptedProposalId).toBe(pending.id);
    expect(first.consent.revision).toBe(proposed.revision + 1);
  });

  it("refuses a stale revision, a second personal approval, and a mutated digest", () => {
    const proposed = propose();
    const pending = proposed.proposals[0]!;

    expect(() => approveChapterConsent(proposed, {
      expectedRevision: 0,
      proposalId: pending.id,
      digest: pending.digest,
      basis,
      audience,
      memberId: "MEM-002",
      at: later,
    })).toThrow("This shared review changed. Read its exact current version before agreeing.");

    expect(() => approveChapterConsent(proposed, {
      expectedRevision: proposed.revision,
      proposalId: pending.id,
      digest: pending.digest,
      basis,
      audience,
      memberId: "MEM-001",
      at: later,
    })).toThrow("You already agreed to this exact review.");

    expect(() => approveChapterConsent(proposed, {
      expectedRevision: proposed.revision,
      proposalId: pending.id,
      digest: "0".repeat(64),
      basis,
      audience,
      memberId: "MEM-002",
      at: later,
    })).toThrow("The shared terms or participants changed. Prepare a fresh review together.");

    expect(() => propose(proposed, "MEM-002", { expectedRevision: 0 })).toThrow(ValidationError);
    expect(() => proposeChapterConsent(undefined, {
      expectedRevision: 0,
      identity: "closure-CH-1",
      terms,
      basis,
      audience: ["MEM-001"],
      memberId: "MEM-001",
      at,
      legacyBaseline: false,
    })).toThrow("Both active household members are needed for a shared agreement.");
  });

  it("keeps the later revision and refuses two different reviews at the same revision", () => {
    const first = propose();
    const superseded = propose(first, "MEM-002", { at: later });
    expect(superseded.proposals[0]?.state).toBe("superseded");
    expect(superseded.proposals[1]?.state).toBe("pending");
    expect(selectChapterConsent(first, superseded)).toBe(superseded);

    const left = propose(undefined, "MEM-001", { terms: { title: "A" } });
    const right = propose(undefined, "MEM-001", { terms: { title: "B" } });
    expect(() => selectChapterConsent(left, right)).toThrow(
      "Conflicting shared reviews need authoritative recovery.",
    );
  });

  it("merges participation by revision and refuses same-revision disagreement", () => {
    const older = { version: 1 as const, memberId: "MEM-001", revision: 1, paused: false, updatedAt: at };
    const newer = { version: 1 as const, memberId: "MEM-001", revision: 2, paused: true, updatedAt: later };
    const other = { version: 1 as const, memberId: "MEM-002", revision: 1, paused: false, updatedAt: at };
    expect(mergeChapterParticipation([older, other], [newer])).toEqual([newer, other]);
    expect(() => mergeChapterParticipation([older], [{ ...older, paused: true }])).toThrow(
      "Conflicting personal participation needs authoritative recovery.",
    );
  });
});
