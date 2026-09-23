import { describe, expect, it } from "vitest";
import { HARBOUR_PLACE_LEVELS, HARBOUR_PLACE_NAMES, type HarbourPlaceId } from "../src/harbour/flag.ts";
import { HARBOUR_CAMERA_SLOT_PREFIX, harbourCameraSlot, lidFor, roofFor, travelAt, travelPlan } from "../src/harbour/scene/travel.ts";

const places = Object.keys(HARBOUR_PLACE_NAMES) as HarbourPlaceId[];

describe("village travel", () => {
  it("has complete room and level metadata including the bank", () => {
    expect(Object.keys(HARBOUR_PLACE_LEVELS).sort()).toEqual([...places].sort());
    expect(HARBOUR_PLACE_LEVELS.bank).toBe("middle");
  });

  it("keeps a separate v4 village camera slot for every place and composition", () => {
    const slots = new Set<string>();
    for (const id of places) for (const composition of ["desktop", "phone"] as const) slots.add(harbourCameraSlot(composition, id));
    expect(slots.size).toBe(places.length * 2);
    expect(harbourCameraSlot("desktop", "tower")).toBe(`${HARBOUR_CAMERA_SLOT_PREFIX}:desktop:tower`);
  });

  it("plans finite directional travel and cuts reduced motion", () => {
    for (const from of places) for (const to of places) {
      const plan = travelPlan(from, to, false);
      expect(Number.isFinite(plan.ms)).toBe(true);
      expect([-1, 0, 1]).toContain(plan.rise);
      const reduced = travelPlan(from, to, true);
      expect(reduced.cut).toBe(true);
      expect(reduced.ms).toBe(0);
      expect(travelAt(reduced, 0).done).toBe(true);
    }
  });

  it("animates the roof and cellar lid only for their named rooms", () => {
    expect(roofFor("tower")).toBe(1);
    expect(lidFor("cellar")).toBe(1);
    for (const id of places.filter(id => id !== "tower")) expect(roofFor(id)).toBe(0);
    for (const id of places.filter(id => id !== "cellar")) expect(lidFor(id)).toBe(0);
    const up = travelPlan("court", "tower", false);
    expect(travelAt(up, 0).roof).toBe(0);
    expect(travelAt(up, up.ms).roof).toBe(1);
  });

  it("keeps animated midpoint frames bounded and monotonic", () => {
    for (const [from,to] of [["court","tower"],["tower","court"],["court","cellar"],["cellar","court"]] as const) { const plan=travelPlan(from,to,false), frames=[0,.25,.5,.75,1].map(k=>travelAt(plan,plan.ms*k)), values=frames.map(f=>from==="tower"||to==="tower"?f.roof:f.lid), direction=values.at(-1)!-values[0]!; expect(frames[0]!.done).toBe(false); expect(frames.at(-1)!.done).toBe(true); for(let i=1;i<values.length;i+=1)expect((values[i]!-values[i-1]!)*direction).toBeGreaterThanOrEqual(-1e-9); }
  });});
