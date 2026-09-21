import { describe, expect, it } from "vitest";
import { WARDROBE_BREATH_INTERVAL_MS, WARDROBE_CAMERA_INTERVAL_MS, wardrobeFramePolicy, type WardrobeFrameActivity } from "../src/wardrobe/framePolicy.ts";

const still: WardrobeFrameActivity = { paused: false, hidden: false, moving: false, performing: false, breathing: false, tier: "full" };

describe("the dressing room's frame policy", () => {
  it("draws nothing in a room where nothing is moving", () => {
    expect(wardrobeFramePolicy(still)).toEqual({ render: false, schedule: false, mirror: false, intervalMs: 0 });
  });

  it("stops entirely when paused, hidden or scrolled away", () => {
    expect(wardrobeFramePolicy({ ...still, breathing: true, paused: true }).schedule).toBe(false);
    expect(wardrobeFramePolicy({ ...still, breathing: true, moving: true, hidden: true })).toEqual({ render: false, schedule: false, mirror: false, intervalMs: 0 });
  });

  it("travels at 30 fps and breathes at 20", () => {
    expect(wardrobeFramePolicy({ ...still, moving: true }).intervalMs).toBe(WARDROBE_CAMERA_INTERVAL_MS);
    expect(wardrobeFramePolicy({ ...still, performing: true }).intervalMs).toBe(WARDROBE_CAMERA_INTERVAL_MS);
    expect(wardrobeFramePolicy({ ...still, breathing: true }).intervalMs).toBe(WARDROBE_BREATH_INTERVAL_MS);
  });

  it("keeps the mirror live for anything the reader does, and holds the last reflection through a lite tier's idle breath", () => {
    expect(wardrobeFramePolicy({ ...still, breathing: true, tier: "full" }).mirror).toBe(true);
    expect(wardrobeFramePolicy({ ...still, breathing: true, tier: "lite" }).mirror).toBe(false);
    // Turning him, travelling or posing him moves the room the glass shows.
    expect(wardrobeFramePolicy({ ...still, breathing: true, moving: true, tier: "lite" }).mirror).toBe(true);
    expect(wardrobeFramePolicy({ ...still, performing: true, tier: "lite" }).mirror).toBe(true);
  });
});
