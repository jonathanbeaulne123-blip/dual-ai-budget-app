import { describe, expect, it } from "vitest";
import {
  AFFIRMATIVE_ALLOWED,
  ONBOARDING_REGISTRY,
  catalogHousehold,
  resolveAction,
  type Household,
  type SemanticAction,
  type SemanticActionKind,
} from "../src/core/index.ts";

const BIANCA = "MEM-001";
const CHAPTER = "ch-01-meet";
const AT = "2026-09-03T18:00:00.000Z";
const ACTION_KINDS: readonly SemanticActionKind[] = [
  "navigate",
  "pause",
  "stop-setup",
  "skip-personal",
  "continue",
  "submit",
  "approve",
  "edit",
  "reopen",
];
const COMMAND_KINDS: readonly SemanticActionKind[] = ["stop-setup", "skip-personal", "submit", "approve"];

function actionFor(
  household: Household,
  kind: SemanticActionKind,
  origin: SemanticAction["origin"],
  revision: string | null = String(household.revision),
): SemanticAction {
  return { kind, chapterId: CHAPTER, memberId: BIANCA, revision, origin, at: AT };
}

describe("onboarding semantic actions", () => {
  it.each(ACTION_KINDS.flatMap((kind) => (["button", "affirmative"] as const)
    .map((origin) => [kind, origin] as const)))("resolves %s from %s according to its authority", (kind, origin) => {
    const household = catalogHousehold("development");
    const outcome = resolveAction(household, actionFor(household, kind, origin));
    if (origin === "affirmative" && !AFFIRMATIVE_ALLOWED.includes(kind)) {
      expect(outcome).toEqual({ kind: "refused", reason: "Typed text cannot perform that action." });
    } else if (COMMAND_KINDS.includes(kind)) {
      expect(outcome).toEqual({ kind: "command", command: kind });
    } else {
      expect(outcome).toEqual({ kind: "local", nextResumePoint: CHAPTER });
    }
  });

  it.each(["submit", "approve", "edit"] as const)("refuses missing and stale revision for %s", (kind) => {
    const household = catalogHousehold("development");
    expect(resolveAction(household, actionFor(household, kind, "button", null))).toEqual({
      kind: "refused",
      reason: "This onboarding step changed. Review it again.",
    });
    expect(resolveAction(household, actionFor(household, kind, "button", String(household.revision + 1)))).toEqual({
      kind: "refused",
      reason: "This onboarding step changed. Review it again.",
    });
  });

  it.each(["submit", "approve"] as const)("routes %s through a command and never as local", (kind) => {
    const household = catalogHousehold("development");
    expect(resolveAction(household, actionFor(household, kind, "button"))).toEqual({
      kind: "command",
      command: kind,
    });
  });

  it("is idempotent and does not mutate household state", () => {
    const household = catalogHousehold("development");
    const before = structuredClone(household);
    const action = actionFor(household, "approve", "button");
    const first = resolveAction(household, action);
    const second = resolveAction(household, action);
    expect(second).toEqual(first);
    expect(household).toEqual(before);
  });

  it("keeps a button path for every registry chapter that permits continue", () => {
    const household = catalogHousehold("development");
    const chapters = ONBOARDING_REGISTRY.filter((chapter) => chapter.actions.includes("continue"));
    expect(chapters.length).toBeGreaterThan(0);
    for (const chapter of chapters) {
      expect(resolveAction(household, {
        ...actionFor(household, "continue", "button"),
        chapterId: chapter.id,
      })).toEqual({ kind: "local", nextResumePoint: chapter.id });
    }
  });
});
