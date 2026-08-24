import { describe, expect, it } from "vitest";
import {
  isCurrentHerculesReply,
  type HerculesReplyContext,
} from "../src/core/index.ts";

const started: HerculesReplyContext = {
  environment: "development",
  householdId: "HH-ONE",
  memberId: "MEM-001",
  requestId: 7,
};

describe("delayed Hercules reply identity (D-116)", () => {
  it("accepts a reply only for the exact context that sent it", () => {
    expect(isCurrentHerculesReply(started, { ...started })).toBe(true);
  });

  it.each([
    ["environment", { environment: "production" }],
    ["household", { householdId: "HH-TWO" }],
    ["member", { memberId: "MEM-002" }],
    ["newer request", { requestId: 8 }],
  ] as const)("rejects a reply after a %s change", (_label, change) => {
    expect(isCurrentHerculesReply(started, { ...started, ...change })).toBe(false);
  });

  it("keeps an older overlapping response from replacing the newest request", () => {
    const newer = { ...started, requestId: started.requestId + 1 };
    expect(isCurrentHerculesReply(started, newer)).toBe(false);
    expect(isCurrentHerculesReply(newer, newer)).toBe(true);
  });
});
