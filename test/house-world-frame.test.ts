import { describe, expect, it } from "vitest";
import { houseFramePolicy } from "../src/house/world/framePolicy.ts";

describe("whole-house frame policy", () => {
  it("sleeps when settled and renders the exact final transition frame", () => {
    expect(houseFramePolicy({
      reduced: false,
      moving: true,
      walking: false,
      movedWalker: false,
      settledCamera: false,
      projectionChanged: true,
    })).toEqual({ animate: true, render: true, schedule: true });

    expect(houseFramePolicy({
      reduced: false,
      moving: false,
      walking: false,
      movedWalker: false,
      settledCamera: true,
      projectionChanged: false,
    })).toEqual({ animate: false, render: true, schedule: false });

    expect(houseFramePolicy({
      reduced: false,
      moving: false,
      walking: false,
      movedWalker: false,
      settledCamera: false,
      projectionChanged: false,
    })).toEqual({ animate: false, render: false, schedule: false });
  });

  it("renders invalidated controls and reduced-motion walk completion without starting an idle loop", () => {
    expect(houseFramePolicy({
      reduced: false,
      moving: false,
      walking: false,
      movedWalker: false,
      settledCamera: false,
      projectionChanged: true,
    })).toEqual({ animate: false, render: true, schedule: false });

    expect(houseFramePolicy({
      reduced: true,
      moving: false,
      walking: false,
      movedWalker: true,
      settledCamera: false,
      projectionChanged: false,
    })).toEqual({ animate: false, render: true, schedule: false });
  });
});
