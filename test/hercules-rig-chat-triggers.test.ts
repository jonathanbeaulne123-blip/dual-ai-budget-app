import { describe, expect, it } from "vitest";
import {
  BUDGET_CHAT_TRIGGERS,
  CAT_CHAT_TRIGGERS,
  matchChatRigTriggers,
  rigCommandsForChatText,
} from "../src/herculesRig/chatTriggers.ts";

describe("Hercules chat rig triggers", () => {
  it("defines ten budget and ten cat trigger words", () => {
    expect(BUDGET_CHAT_TRIGGERS).toHaveLength(10);
    expect(CAT_CHAT_TRIGGERS).toHaveLength(10);
    expect(new Set(BUDGET_CHAT_TRIGGERS.map((row) => row.word)).size).toBe(10);
    expect(new Set(CAT_CHAT_TRIGGERS.map((row) => row.word)).size).toBe(10);
  });

  it("matches whole words case-insensitively", () => {
    expect(matchChatRigTriggers("How is our Budget looking?").map((row) => row.word)).toEqual(["budget"]);
    expect(matchChatRigTriggers("mrrp ok groceries").map((row) => row.word)).toEqual(["groceries", "mrrp"]);
  });

  it("ignores partial word matches", () => {
    expect(matchChatRigTriggers("confirmation pending")).toEqual([]);
    expect(matchChatRigTriggers("flywheel")).toEqual([]);
  });

  it("queues one budget and one cat reaction per message", () => {
    const commands = rigCommandsForChatText("Confirm the groceries and purr");
    expect(commands).toHaveLength(1);
    expect(commands[0]?.type).toBe("queue");
    if (commands[0]?.type === "queue") {
      expect(commands[0].commands.length).toBeGreaterThan(1);
    }
  });

  it("maps paycheck to celebrate pose", () => {
    const commands = rigCommandsForChatText("paycheck landed");
    expect(commands.some((row) => row.type === "playPose" && row.pose === "celebrate")).toBe(true);
  });

  it("maps fly to a custom hunt clip", () => {
    const commands = rigCommandsForChatText("catch that fly");
    expect(commands.some((row) => row.type === "playClip" && row.clipId === "chat-fly-hunt")).toBe(true);
  });
});
