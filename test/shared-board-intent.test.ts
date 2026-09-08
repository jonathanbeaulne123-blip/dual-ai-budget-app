// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { readSharedBoardSelection, requestSharedBoard, takeSharedBoardRequest } from "../src/core/sharedBoardIntent.ts";

afterEach(() => { vi.restoreAllMocks(); sessionStorage.clear(); });
describe("deferred board navigation", () => {
  it("consumes opening once without losing the selected board", () => {
    const scope = { environment: "development", householdId: "HH-intent-once", memberId: "MEM-1" };
    expect(readSharedBoardSelection(scope)).toBe("notes");
    requestSharedBoard(scope, "ask");
    expect(takeSharedBoardRequest({ ...scope, memberId: "MEM-2" })).toBeNull();
    expect(takeSharedBoardRequest(scope)).toBe("ask");
    expect(takeSharedBoardRequest(scope)).toBeNull();
    expect(readSharedBoardSelection(scope)).toBe("ask");
  });
  it("keeps a request through a deferred Home mount when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("blocked"); });
    const scope = { environment: "development", householdId: "HH-intent-private", memberId: "MEM-1" };
    requestSharedBoard(scope, "ask");
    expect(takeSharedBoardRequest({ ...scope, householdId: "HH-other" })).toBeNull();
    expect(takeSharedBoardRequest(scope)).toBe("ask");
    expect(readSharedBoardSelection(scope)).toBe("ask");
    expect(takeSharedBoardRequest(scope)).toBeNull();
    requestSharedBoard(scope, "ask");
    expect(takeSharedBoardRequest(scope)).toBe("ask");
  });
});
