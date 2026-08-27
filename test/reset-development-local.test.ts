import { describe, expect, it } from "vitest";
import { wipeLocalDevelopmentCopies } from "../src/resetDevelopmentLocal.ts";

describe("wipeLocalDevelopmentCopies", () => {
  it("refuses Production", async () => {
    await expect(wipeLocalDevelopmentCopies("production")).rejects.toThrow(/Development only/);
  });
});
