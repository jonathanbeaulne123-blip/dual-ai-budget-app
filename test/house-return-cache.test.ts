import { describe, expect, it } from "vitest";
import { houseCameraRoute, houseCameraSlot, houseReturnSlot, needsHouseReturnCapture, sameHouseCameraRoute } from "../src/house/returnCache.ts";

const room = { room: "together" as const, level: "middle" as const, householdId: "HH-1", scope: "household" as const };

describe("house return cache addresses", () => {
  it("gives each addressed object on one surface its own return slot", () => {
    const first = { ...room, surface: "letters", object: "note/NOTE-1" };
    const second = { ...room, surface: "letters", object: "note/NOTE-2" };
    expect(houseReturnSlot(first)).toBe("letters:note/NOTE-1");
    expect(houseReturnSlot(second)).toBe("letters:note/NOTE-2");
    expect(needsHouseReturnCapture(first, second)).toBe(true);
  });

  it("does not replace an origin when the address is unchanged", () => {
    const focused = { ...room, surface: "pottery", object: "piece/PIECE-1/DESIGN-1" };
    expect(needsHouseReturnCapture(focused, { ...focused })).toBe(false);
  });

  it("uses a room/time camera slot without changing the full arrival route", () => {
    const focused = { ...room, surface: "pottery", object: "piece/PIECE-1/DESIGN-1", time: "2026-09" };
    expect(houseCameraRoute(focused)).toEqual({ ...room, time: "2026-09" });
    expect(houseCameraSlot(focused)).toBe("camera:together:middle:2026-09");
    expect(sameHouseCameraRoute(room, focused)).toBe(false);
    expect(sameHouseCameraRoute(room, { ...focused, time: undefined })).toBe(true);
    expect(sameHouseCameraRoute(room, { ...room, scope: "personal" })).toBe(false);
  });
});
