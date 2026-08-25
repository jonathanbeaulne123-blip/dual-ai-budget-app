import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CAT,
  NAV,
  defaultLayout,
  herculesBubbleBox,
  perchTarget,
  phoneDeskKey,
  phoneDrawerIds,
  phoneDueBill,
  phoneRailOrder,
  phoneStoryIds,
  revealPhoneInstrument,
  type Furniture,
  type InstrumentId,
} from "../src/core/index.ts";

describe("phone desk choice", () => {
  it("uses Tracker when the household has no shifts and no chalk", () => {
    expect(phoneDeskKey({ shiftCount: 0, chalkboardLength: 0 })).toBe("tracker");
    expect(phoneDeskKey({ shiftCount: 1, chalkboardLength: 0 })).toBe("household");
    expect(phoneDeskKey({ shiftCount: 0, chalkboardLength: 3 })).toBe("household");
  });
});

describe("phone rail", () => {
  it("keeps five or fewer objects at rest and pins the pad even if hidden", () => {
    const rest = phoneRailOrder({
      desk: "household",
      hidden: [],
      lampLit: false,
    });
    expect(rest).toEqual(["blotter", "calculator", "timesheet", "chalkboard", "jars"]);
    expect(rest.length).toBeLessThanOrEqual(5);
    expect(rest).toContain("calculator");

    const hiddenPad = phoneRailOrder({
      desk: "household",
      hidden: ["calculator", "jars"] as InstrumentId[],
      lampLit: false,
    });
    expect(hiddenPad).toContain("calculator");
    expect(hiddenPad).not.toContain("jars");
  });

  it("guest-appends Due mail onto a Household desk that does not show mail", () => {
    const rail = phoneRailOrder({
      desk: "household",
      hidden: [],
      lampLit: false,
      expanded: "mail",
    });
    expect(rail).toContain("mail");
    expect(rail[rail.length - 1]).toBe("mail");
    expect(phoneDrawerIds(rail)).not.toContain("mail");
  });

  it("does not put Calendar on the phone rail when it is expanded", () => {
    const rail = phoneRailOrder({
      desk: "household",
      hidden: [],
      lampLit: false,
      expanded: "calendar",
    });
    expect(rail).not.toContain("calendar");
  });

  it("appends Health only when the lamp is lit", () => {
    expect(phoneRailOrder({ desk: "tracker", hidden: [], lampLit: false })).not.toContain("lamp");
    expect(phoneRailOrder({ desk: "tracker", hidden: [], lampLit: true })).toContain("lamp");
  });

  it("builds a four-tile story strip without pad or chalk", () => {
    const rail = phoneRailOrder({ desk: "household", hidden: [], lampLit: false });
    expect(phoneStoryIds(rail)).toEqual(["blotter", "timesheet", "jars"]);
    expect(phoneStoryIds(rail)).not.toContain("calculator");
    expect(phoneStoryIds(rail)).not.toContain("chalkboard");
  });

  it("reveals a hidden instrument onto the phone layout without touching other items", () => {
    const layout = defaultLayout();
    layout.items = layout.items.map((item) => item.id === "mail" ? { ...item, hidden: true } : item);
    const next = revealPhoneInstrument(layout, "mail");
    expect(next.expanded).toBe("mail");
    expect(next.items.find((item) => item.id === "mail")?.hidden).toBe(false);
    expect(next.items.find((item) => item.id === "blotter")?.hidden).toBeFalsy();
  });
});

describe("Due stamp ignores visits", () => {
  it("picks an outgoing bill and never a quiet visit title", () => {
    const upcoming = [
      { kind: "visit" as const, direction: "out" as const, title: "the Thursday visit" },
      { kind: "bill" as const, direction: "out" as const, title: "Rent" },
    ];
    expect(phoneDueBill(upcoming)?.title).toBe("Rent");
    expect(phoneDueBill([{ kind: "visit" as const, direction: "out" as const, title: "Therapy" }])).toBeUndefined();
    expect(phoneDueBill([{ kind: "bill" as const, direction: "in" as const, title: "Bianca pay" }])).toBeUndefined();
  });
});

describe("phone Hercules perch and bubble", () => {
  it("sits a corner-seat card on the top-right, not on the glance number", () => {
    const blotter: Furniture = {
      id: "blotter",
      rect: { x: 8, y: 180, w: 374, h: 88 },
      perchable: true,
      warn: false,
      kind: "card",
      seat: "corner",
    };
    const land = perchTarget([blotter], "content", "evening", false, { w: 390, h: 844 }, null, () => 0.2);
    expect(land.on).toBe("blotter");
    expect(land.x + CAT / 2).toBeGreaterThan(blotter.rect.x + blotter.rect.w / 2);
    expect(land.y + CAT).toBeLessThan(blotter.rect.y + 36);
  });

  it("does not change wide centered perch when seat is omitted", () => {
    const blotter: Furniture = {
      id: "blotter",
      rect: { x: 8, y: 180, w: 374, h: 88 },
      perchable: true,
      warn: false,
      kind: "card",
    };
    const land = perchTarget([blotter], "content", "evening", false, { w: 390, h: 844 }, null, () => 0.2);
    const center = blotter.rect.x + blotter.rect.w / 2;
    expect(Math.abs(land.x + CAT / 2 - center)).toBeLessThan(12);
  });

  it("keeps a proposal bubble on a 390 phone above the nav and off the left edge", () => {
    const box = herculesBubbleBox({
      catX: 300,
      catY: 36,
      catSize: 96,
      bubbleW: 248,
      bubbleH: 160,
      viewW: 390,
      viewH: 844,
    });
    expect(box.left).toBeGreaterThanOrEqual(8);
    expect(box.left + 248).toBeLessThanOrEqual(390 - 8);
    expect(box.top).toBeGreaterThanOrEqual(8);
    expect(box.top + 160).toBeLessThanOrEqual(844 - NAV - 8);
  });

  it("still loafs off the Post button while adding", () => {
    const land = perchTarget(
      [{ id: "blotter", rect: { x: 8, y: 180, w: 374, h: 88 }, perchable: true, warn: false, kind: "card", seat: "corner" }],
      "content",
      "morning",
      true,
      { w: 390, h: 844 },
      { x: 40, y: 520, w: 310, h: 56 },
    );
    expect(land).toMatchObject({ x: 6, y: 6, on: null, pose: "loaf" });
  });
});

describe("phone CSS fence", () => {
  it("does not restyle desktop bubbles or invent --body", () => {
    const css = readFileSync("src/office-phone.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(css).not.toMatch(/body\s+\.hercules-bubble/);
    expect(css).not.toMatch(/\.desk-wide/);
    expect(css).not.toMatch(/var\(--body\)/);
    expect(css).toMatch(/var\(--font\)/);
  });

  it("keeps OfficePhone off the wide canvas path", () => {
    const office = readFileSync("src/Office.tsx", "utf8");
    expect(office).toMatch(/if \(breakpoint === "phone"\)/);
    expect(office).toMatch(/desk-canvas desk-wide/);
    expect(office).toMatch(/is-wide-room/);
    const phone = readFileSync("src/OfficePhone.tsx", "utf8");
    expect(phone).not.toMatch(/desk-wide/);
    expect(phone).toMatch(/revealPhoneInstrument/);
    expect(phone).toMatch(/StoryStrip/);
    expect(phone).toMatch(/WaxSeal/);
  });
});
