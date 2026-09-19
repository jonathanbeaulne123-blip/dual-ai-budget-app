import { knownCents } from "./fixtures/knownCents.ts";
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { saveKittyNestDesign } from "../src/core/index.ts";
import { closeChapter, openChapter, openChapterFor } from "../src/core/chapters.ts";
import { newKittyPiece, shapeKittyPiece } from "../src/core/kittyStudio.ts";
import { allocateNestTotal, projectKittyNest } from "../src/core/kittyNest.ts";
import { queenBanks } from "../src/core/queenPresentation.ts";
import { QUEEN_CHARM_KINDS, type QueenCharmV1 } from "../src/core/queenCharms.ts";
import {
  QUEEN_FORM_LIMITS, QUEEN_FORM_REST, QUEEN_PORTRAIT_LIMITS, QUEEN_RING, queenFormHandles, queenPortraitDue, queenPortraitOf, queenRingCount, queenRingSeats, queenWheelPull, queenWheelRim, shapeQueenPortraits, shapeQueenWheel,
  type QueenFormHandles, type QueenPortraitV1,
} from "../src/core/queenForm.ts";
import { QUEEN_LIGHT, queenLampShare, queenLight } from "../src/core/queenLight.ts";
import { QUEEN_GLAZE_AXIS, QUEEN_RESERVED_CHANNELS, guardQueenDesignSave, queenForm, queenPortraits, queenSanitizePaint, queenStampAllowed, queenWheel } from "../src/queen/world/queenAuthoring.ts";
import {
  QUEEN_CHARM_KEYBOARD_SEATS, QUEEN_FORM_BASE, QUEEN_SKIRT_PROFILE, QUEEN_UNDERSIDE_V, queenCharmAllowed, queenCharmRefusal, queenCharmSettle, queenOnRing, queenSeamPathsFor, queenSkirtAt, queenSkirtProfilePoints, queenSurfaceSeat,
  type QueenForm,
} from "../src/queen/world/queenCharmSurface.ts";
import { createQueenSculpture } from "../src/queen/world/queenSculpture.ts";
import { QueenFigure, queenFlatVessel } from "../src/queen/QueenFigure.tsx";
import { QueenPortraitFigure, QueenPortraits } from "../src/queen/QueenPortraits.tsx";
import { QueenWheel } from "../src/queen/QueenWheel.tsx";
import { queenStill } from "../src/core/queenPresentation.ts";
import { planLifeFixture } from "./fixtures/plan-life.ts";
import type { Household } from "../src/core/types.ts";

const memberId = "MEM-001";
const partner = "MEM-002";
const charm = (over: Partial<QueenCharmV1> = {}): QueenCharmV1 => ({ id: `c-${Math.random().toString(36).slice(2, 8)}`, kind: "sitting-cat", part: "body", u: 0.62, v: 0.45, spin: 0, tilt: 0, scale: 1, color: "#e3a534", ...over });
const base = { memberId, view: "household" as const, bankKey: "king", expectedRevision: 0, name: "Our Queen", glaze: "cream" as const, category: null };
const piece = (over: Partial<ReturnType<typeof newKittyPiece>> = {}) => ({ ...newKittyPiece("queen", "2026-01-10T00:00:00.000Z", "cream"), ...over });
const ALL = new Set(QUEEN_CHARM_KINDS);
const still = queenStill({ state: "building", destination: "fund" }, "current");
const figure = (props: Partial<Parameters<typeof QueenFigure>[0]>) => renderToStaticMarkup(createElement(QueenFigure, { still, body: { level: 5, fullness: "half", glaze: "glazed", seams: 0, amountCents: 100 }, crown: "both", vine: { chapter: null, growth: 0 }, buds: 0, feet: { count: 0, nearness: [] }, ...props }));

/** Close n fictional Chapters in a row. */
function closed(h: Household, n: number, from = 1): Household {
  for (let i = 0; i < n; i += 1) {
    const at = `2026-0${Math.min(9, from + Math.floor(i / 3))}-${String(2 + (i % 3) * 8).padStart(2, "0")}T12:00:00.000Z`;
    h = openChapter(h, { memberId, foundationId: "see-our-shared-life", at }).household;
    h = closeChapter(h, { memberId, chapterId: openChapterFor(h)!.id, outcome: i % 2 ? "established" : "still-forming", at: at.replace("T12", "T18") }).household;
  }
  return h;
}
/** jsdom has no 2D canvas; the marks texture needs only a fill and two lines of text. */
const fakeCanvas = () => vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => ({ fillRect() {}, fillText() {}, clearRect() {}, drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }), putImageData() {}, save() {}, restore() {}, beginPath() {}, arc() {}, fill() {}, stroke() {}, moveTo() {}, lineTo() {}, closePath() {}, setTransform() {}, translate() {}, rotate() {}, scale() {}, canvas: document.createElement("div") }) as never);
afterEach(() => vi.restoreAllMocks());
const designOf = (h: Household) => h.kittyNestDesigns?.find((row) => row.bankKey === "king" && row.visibility === "household");

describe("Growth rings — one shallow band per closed Chapter, derived and permanent", () => {
  it("is the tenth reserved channel", () => {
    expect(QUEEN_RESERVED_CHANNELS.map((row) => row.id)).toContain("rings");
    expect(QUEEN_RESERVED_CHANNELS).toHaveLength(10);
  });

  it("adds exactly one ring per closed Chapter and none for an open one", () => {
    let h = planLifeFixture("household");
    expect(queenRingCount(h)).toBe(0);
    h = openChapter(h, { memberId, foundationId: "see-our-shared-life", at: "2026-08-01T12:00:00.000Z" }).household;
    expect(queenRingCount(h)).toBe(0);
    h = closeChapter(h, { memberId, chapterId: openChapterFor(h)!.id, outcome: "established", at: "2026-08-30T12:00:00.000Z" }).household;
    expect(queenRingCount(h)).toBe(1);
    expect(queenRingCount(closed(h, 11, 9))).toBe(12);
    expect(queenRingCount(closed(h, 11, 9), "2026-08-31T00:00:00.000Z")).toBe(1);
    expect(queenForm(designOf(h), h).rings).toBe(1);
  });

  it("is a shallow band in the lathe profile — a dip under 2% of the radius, never a stripe, seats spaced and bounded", () => {
    const seats = queenRingSeats(12);
    expect(seats).toHaveLength(12);
    expect(seats[0]).toBe(QUEEN_RING.first);
    expect(seats[11]).toBeLessThanOrEqual(QUEEN_RING.last + 1e-9);
    expect(queenRingSeats(30).every((v) => v >= QUEEN_RING.first && v <= QUEEN_RING.last + 1e-9)).toBe(true);
    const one: QueenForm = { handles: QUEEN_FORM_REST, rings: 1 };
    const at = queenSkirtAt(seats[0]!, one).r, off = queenSkirtAt(seats[0]!, QUEEN_FORM_BASE).r;
    expect(off - at).toBeGreaterThan(0);
    expect((off - at) / off).toBeLessThan(0.02);
    // Off the band the profile is untouched; the height never changes.
    expect(queenSkirtAt(0.5, one).r).toBeCloseTo(queenSkirtAt(0.5, QUEEN_FORM_BASE).r, 10);
    expect(queenSkirtAt(seats[0]!, one).y).toBe(queenSkirtAt(seats[0]!, QUEEN_FORM_BASE).y);
    // The lathe's samples keep the base uv: sample i is v = i/(n-1) on every form.
    const pts = queenSkirtProfilePoints({ handles: QUEEN_FORM_REST, rings: 12 });
    expect(pts).toHaveLength(128);
    expect(pts[0]![1]).toBe(0);
    expect(pts[127]![1]).toBe(QUEEN_SKIRT_PROFILE[6]![1]);
  });

  it("cannot be charmed: a seat on a ring is refused as `rings` and slides off; the guard drops one that arrives anyway", () => {
    const twelve: QueenForm = { handles: QUEEN_FORM_REST, rings: 12 };
    const v = queenRingSeats(12)[3]!;
    expect(queenOnRing(v, 12)).toBe(true);
    expect(queenCharmRefusal("body", 0.62, v, twelve)).toBe("rings");
    expect(queenCharmRefusal("body", 0.62, v, QUEEN_FORM_BASE)).toBeNull();
    const settled = queenCharmSettle("body", 0.62, v, twelve);
    expect(settled).not.toBeNull();
    expect(queenOnRing(settled!.v, 12)).toBe(false);
    expect(queenCharmAllowed("body", settled!.u, settled!.v, twelve)).toBe(true);
    const kept = guardQueenDesignSave({ ...base, studio: { version: 1, draft: piece({ charms: [charm({ v }), charm({ id: "fine", u: 0.62, v: 0.46 })] }), fired: [] } }, { earned: ALL, rings: 12 });
    expect(kept.studio!.draft!.charms!.map((row) => row.id)).toEqual(["fine"]);
    // Every keyboard seat still settles somewhere with twelve rings on her.
    for (const seat of QUEEN_CHARM_KEYBOARD_SEATS) expect(queenCharmSettle(seat.part, seat.u, seat.v, twelve)).not.toBeNull();
  });

  it("cannot be painted or removed: nothing on the piece carries a ring, and the guard reads them from the household only", () => {
    const h = closed(planLifeFixture("household"), 3);
    const raw = { ...piece(), rings: 5, sculpt: { ...piece().sculpt, rings: 2 } } as unknown as Record<string, unknown>;
    const kept = guardQueenDesignSave({ ...base, studio: { version: 1, draft: raw as never, fired: [] } }, { earned: ALL, rings: queenRingCount(h) });
    expect(queenForm({ studio: kept.studio! }, h).rings).toBe(3);
    expect(queenForm({ studio: kept.studio! }, { chapters: [] }).rings).toBe(0);
    // A shaped piece drops an unknown ring field outright.
    expect("rings" in shapeKittyPiece(piece())).toBe(false);
    // The flat figure draws one arc per ring, none of them a charm or a stamp.
    const twelve = figure({ form: { handles: QUEEN_FORM_REST, rings: 12 } });
    expect(twelve.match(/class="queen-ring"/g)).toHaveLength(12);
    expect(figure({ form: { handles: QUEEN_FORM_REST, rings: 1 } }).match(/class="queen-ring"/g)).toHaveLength(1);
    expect(figure({})).not.toContain("queen-ring");
  });
});

describe("The wheel — two handed-over turns on the same lathe, bounded, attributed", () => {
  const corners: QueenFormHandles[] = [];
  for (const b of [-1, 1]) for (const r of [-1, 1]) corners.push(queenWheelRim(queenWheelPull(QUEEN_FORM_REST, b), r));

  it("pulls the form on one part and opens the rim on a genuinely different part", () => {
    const pulled = queenWheelPull(QUEEN_FORM_REST, 1);
    expect(pulled.belly).toBeGreaterThan(1); expect(pulled.waist).toBeLessThan(1);
    expect(pulled.shoulder).toBe(1); expect(pulled.neck).toBe(1);
    const opened = queenWheelRim(pulled, 1);
    expect(opened.belly).toBe(pulled.belly); expect(opened.waist).toBe(pulled.waist);
    expect(opened.shoulder).toBeGreaterThan(1); expect(opened.neck).toBeGreaterThan(1);
    // On the profile: the pull moves the belly rings and leaves the collar; the rim moves the collar and leaves the belly.
    const belly = queenSkirtAt(0.5, { handles: pulled, rings: 0 }).r, collar = queenSkirtAt(0.97, { handles: pulled, rings: 0 }).r;
    expect(belly).not.toBeCloseTo(queenSkirtAt(0.5, QUEEN_FORM_BASE).r, 3);
    expect(collar).toBeCloseTo(queenSkirtAt(0.97, QUEEN_FORM_BASE).r, 6);
    expect(queenSkirtAt(0.97, { handles: opened, rings: 0 }).r).not.toBeCloseTo(collar, 3);
    expect(queenSkirtAt(0.5, { handles: opened, rings: 0 }).r).toBeCloseTo(belly, 6);
  });

  it("is bounded: no thrown profile hides a reserved channel or breaks her silhouette at 40px", () => {
    for (const handles of [...corners, queenFormHandles([0.55, 1.15, 0.55, 1.15]), queenFormHandles([9, -9, Number.NaN, 0])]) {
      for (const value of Object.values(handles)) { expect(value).toBeGreaterThanOrEqual(QUEEN_FORM_LIMITS.min); expect(value).toBeLessThanOrEqual(QUEEN_FORM_LIMITS.max); }
      const form: QueenForm = { handles, rings: 12 };
      // Solid at 40px: her widest stays within a 1.35-unit radius and her belly never thins below 0.8, so a 40px figure is still one seated shape.
      let widest = 0, thinnest = Infinity;
      for (let i = 0; i <= 100; i += 1) { const { r, y } = queenSkirtAt(i / 100, form); widest = Math.max(widest, r); if (y > 0.3 && y < 1.5) thinnest = Math.min(thinnest, r); }
      expect(widest).toBeLessThanOrEqual(1.35); expect(thinnest).toBeGreaterThanOrEqual(0.8);
      // Every reserved zone answers the same on this form: feet, hands, fill, seams; the seams follow the surface rather than sinking into it or floating off.
      expect(queenCharmRefusal("body", 0.62, 0.05, form)).toBe("feet");
      expect(queenCharmRefusal("body", 0.75, 0.8, form)).toBe("hands");
      expect(queenCharmRefusal("body", 0.79, 0.6, form)).toBe("fill");
      const vAt = (y: number) => { let best = 0, d = Infinity; for (let i = 0; i <= 200; i += 1) { const dd = Math.abs(queenSkirtAt(i / 200).y - y); if (dd < d) { d = dd; best = i / 200; } } return best; };
      const formed = queenSeamPathsFor(form), rest = queenSeamPathsFor(QUEEN_FORM_BASE);
      for (const [p, path] of formed.entries()) for (const [i, [x, y, z]] of path.entries()) {
        const [bx, , bz] = rest[p]![i]!;
        const offRest = Math.hypot(bx, bz) - queenSkirtAt(vAt(y), QUEEN_FORM_BASE).r;
        const offFormed = Math.hypot(x, z) - queenSkirtAt(vAt(y), form).r;
        // The seam keeps the stand-off it has at rest (within the ring dip and a hair), so it is neither buried nor floating.
        expect(Math.abs(offFormed - offRest)).toBeLessThan(0.05);
      }
      // The flat vessel is drawn from the same profile.
      expect(queenFlatVessel(form)).not.toBe(queenFlatVessel(QUEEN_FORM_BASE));
      expect(figure({ form })).toContain(queenFlatVessel(form));
    }
  });

  it("keeps her through the guard as sculpt.profile within her bounds plus two attributed turns; nothing else on the sculpt is hers", () => {
    const h = planLifeFixture("household");
    const handles = queenWheelRim(queenWheelPull(QUEEN_FORM_REST, 0.8), -0.6);
    const wheel = { pull: { by: memberId, at: "2026-09-14T10:00:00.000Z" }, rim: { by: partner, at: "2026-09-14T10:05:00.000Z" } };
    const input = guardQueenDesignSave({ ...base, studio: { version: 1, draft: piece({ sculpt: { ...piece().sculpt, profile: [handles.belly, handles.waist, handles.shoulder, handles.neck] }, wheel }), fired: [] } }, { earned: ALL });
    expect(input.studio!.draft!.sculpt.profile).toEqual([1.08, 0.952, 0.94, 0.94]);
    expect(input.studio!.draft!.wheel).toEqual(wheel);
    expect(input.studio!.draft!.wheel!.pull.by).not.toBe(input.studio!.draft!.wheel!.rim.by);
    const saved = saveKittyNestDesign(h, input).household;
    expect(queenWheel(designOf(saved))).toEqual(wheel);
    expect(queenForm(designOf(saved), saved).handles).toEqual({ belly: 1.08, waist: 0.952, shoulder: 0.94, neck: 0.94 });
    // A bank's wider profile on her draft is read within her bounds, not as given; a broken wheel record is dropped, not thrown.
    const wide = guardQueenDesignSave({ ...base, studio: { version: 1, draft: piece({ sculpt: { ...piece().sculpt, profile: [0.55, 1.15, 0.55, 1.15] }, wheel: { pull: { by: "", at: "x" } } as never }), fired: [] } }, { earned: ALL });
    expect(wide.studio!.draft!.sculpt.profile).toEqual([0.9, 1.1, 0.9, 1.1]);
    expect(wide.studio!.draft!.wheel).toBeUndefined();
    expect(() => shapeQueenWheel({ pull: { by: memberId, at: "2026-09-14T10:00:00.000Z" }, rim: { by: partner, at: "nope" } })).toThrow();
    expect(() => shapeQueenWheel({ pull: wheel.pull, rim: wheel.rim, fire: true })).toThrow();
    // Still never fired.
    expect(() => guardQueenDesignSave({ ...base, fire: true, studio: { version: 1, draft: piece({ wheel }), fired: [] } }, { earned: ALL })).toThrow(/kiln/);
  });

  it("says whose turn it is, hands over, and ends by keeping her — no progress bar, no step counter, no skip", () => {
    const members = [{ id: memberId, name: "Alex (fictional)", active: true }, { id: partner, name: "Sam (fictional)", active: true }];
    const html = renderToStaticMarkup(createElement(QueenWheel, { memberId, members, handles: QUEEN_FORM_REST, rings: 2, wheel: null, busy: false, onDraft: () => {}, onKeep: () => {} }));
    expect(html).toContain("Alex (fictional) pulls the form");
    expect(html).toContain("Hand the wheel to Sam (fictional)");
    expect(html).toContain('type="range"');
    expect(html).not.toMatch(/progress|step \d|skip/i);
    expect(html.match(/class="queen-ring"/g)).toHaveLength(2);
    const thrown = renderToStaticMarkup(createElement(QueenWheel, { memberId, members, handles: QUEEN_FORM_REST, rings: 0, busy: false, onDraft: () => {}, onKeep: () => {}, wheel: { pull: { by: memberId, at: "2026-09-14T10:00:00.000Z" }, rim: { by: partner, at: "2026-09-14T10:05:00.000Z" } } }));
    expect(thrown).toContain("Form pulled by Alex (fictional)");
    expect(thrown).toContain("rim opened by Sam (fictional)");
  });
});

describe("Her underside — the makers' marks; not paintable, no charm seat", () => {
  it("refuses a stroke, a stamp or a charm on the base disc", () => {
    expect(QUEEN_UNDERSIDE_V).toBeCloseTo(1 / 6, 10);
    const paint = queenSanitizePaint({ base: "cream", parts: {}, strokes: [{ part: "body", tool: "brush", color: "#b33a63", size: 20, opacity: 1, mirror: false, pts: [0.5, 0.5, 0.6, 0.1] }, { part: "body", tool: "brush", color: "#b33a63", size: 20, opacity: 1, mirror: false, pts: [0.5, 0.5, 0.6, 0.4] }], stamps: [] });
    expect(paint.strokes).toHaveLength(1);
    expect(paint.strokes[0]!.pts).toEqual([0.5, 0.5, 0.6, 0.4]);
    expect(queenStampAllowed({ id: "u", anchor: "belly", part: "body", u: 0.5, v: 0.08, kind: "heart", color: "#b33a63", size: 0.3, rotation: 0 })).toBe(false);
    expect(queenStampAllowed({ id: "u", anchor: "belly", part: "body", u: 0.5, v: 0.4, kind: "heart", color: "#b33a63", size: 0.3, rotation: 0 })).toBe(true);
    for (const u of [0, 0.25, 0.5, 0.75]) for (const v of [0, 0.05, 0.1, 0.16]) expect(queenCharmRefusal("body", u, v)).toBe("feet");
    // The seat for v = 0 is the base disc's centre: no charm can be pressed there in either path.
    expect(queenSurfaceSeat("body", 0.5, 0).position[1]).toBe(0);
  });

  it("tips over to a still that shows both marks and the date, in the flat path and the 3D path", () => {
    const marks = { initials: ["A", "S"], date: "14 Sep 2026" };
    const tipped = figure({ tipped: true, marks, charms: [charm()] });
    expect(tipped).toContain("queen-svg--tipped");
    expect(tipped).toContain("A · S");
    expect(tipped).toContain("14 Sep 2026");
    expect(tipped).not.toContain("queen-charm");
    expect(figure({ marks })).not.toContain("queen-underside");
    fakeCanvas();
    const queen = createQueenSculpture();
    const underside = queen.reserved.underside;
    expect((underside.material as THREE.MeshStandardMaterial).map).toBeNull();
    expect(underside.material).not.toBe(queen.materials.body);
    queen.setMarks(marks);
    expect((underside.material as THREE.MeshStandardMaterial).map).not.toBeNull();
    expect(queen.tipped).toBe(false);
    queen.setTipped(true);
    expect(queen.tipped).toBe(true);
    expect(queen.group.getObjectByName("queen-body")!.rotation.x).toBeLessThan(0);
    queen.setTipped(false);
    expect(queen.group.getObjectByName("queen-body")!.rotation.x).toBe(0);
    queen.setMarks(null);
    expect((underside.material as THREE.MeshStandardMaterial).map).toBeNull();
    queen.dispose();
    expect(queen.counts()).toEqual({ geometries: 0, materials: 0, textures: 0 });
  });
});

describe("The yearly portrait — a stored still, immutable, cheap, on the shelf in both paths", () => {
  const portrait = (year: number, over: Partial<QueenPortraitV1> = {}): QueenPortraitV1 => ({ year, at: `${year + 1}-01-03T09:00:00.000Z`, by: memberId, profile: [1.04, 0.98, 1, 1], rings: year - 2025, base: "cream", parts: {}, charms: [charm({ id: `p${year}` })], ...over });

  it("is due once for each year that closed since she was made, and is sealed with that year's exact ring count", () => {
    const h = closed(planLifeFixture("household"), 2);
    expect(queenPortraitDue({ createdAt: "2026-03-01T00:00:00.000Z" }, "2026-09-14")).toBeNull();
    expect(queenPortraitDue({ createdAt: "2026-03-01T00:00:00.000Z" }, "2027-01-01")).toBe(2026);
    expect(queenPortraitDue({ createdAt: "2026-03-01T00:00:00.000Z", portraits: [{ year: 2026 }] }, "2028-06-01")).toBe(2027);
    expect(queenPortraitDue({ createdAt: "2026-03-01T00:00:00.000Z", portraits: [{ year: 2026 }, { year: 2027 }] }, "2028-06-01")).toBeNull();
    const sealed = queenPortraitOf({ year: 2026, at: "2027-01-03T09:00:00.000Z", by: memberId, profile: [1.2, 1, 1, 1], household: h, paint: { base: "cream", parts: { body: "#123456" } }, charms: [charm({ id: "x" })] });
    expect(sealed.rings).toBe(2);
    expect(sealed.profile).toEqual([1.1, 1, 1, 1]);
    expect(sealed.parts).toEqual({ body: "#123456" });
    expect(queenPortraitOf({ ...sealed, household: h, profile: undefined, paint: { base: "cream", parts: {} }, charms: [], year: 2025 }).rings).toBe(0);
  });

  it("is immutable through the guard: a kept year can neither be replaced nor removed, only new years join", () => {
    const kept = [portrait(2026)];
    Object.freeze(kept); Object.freeze(kept[0]);
    const replaced = guardQueenDesignSave({ ...base, studio: { version: 1, draft: piece({ portraits: [portrait(2026, { base: "midnight", rings: 9 }), portrait(2027)] }), fired: [] } }, { earned: ALL, kept });
    expect(replaced.studio!.draft!.portraits!.map((row) => [row.year, row.base, row.rings])).toEqual([[2026, "cream", 1], [2027, "cream", 2]]);
    const removed = guardQueenDesignSave({ ...base, studio: { version: 1, draft: piece(), fired: [] } }, { earned: ALL, kept });
    expect(removed.studio!.draft!.portraits!.map((row) => row.year)).toEqual([2026]);
    expect(removed.studio!.draft!.portraits![0]).not.toBe(kept[0]);
    expect(removed.studio!.draft!.portraits![0]).toEqual(kept[0]);
    // Through the real save: the record keeps the first portrait against a second write that tries to change it.
    let h = planLifeFixture("household");
    h = saveKittyNestDesign(h, guardQueenDesignSave({ ...base, studio: { version: 1, draft: piece({ portraits: [portrait(2026)] }), fired: [] } }, { earned: ALL })).household;
    const design = designOf(h)!;
    h = saveKittyNestDesign(h, guardQueenDesignSave({ ...base, expectedRevision: design.revision, studio: { version: 1, draft: piece({ portraits: [portrait(2026, { rings: 7 })] }), fired: [] } }, { earned: ALL, kept: queenPortraits(design) })).household;
    expect(queenPortraits(designOf(h))[0]!.rings).toBe(1);
    // Shape: at most twelve, one per year, nothing unknown.
    expect(() => shapeQueenPortraits(Array.from({ length: QUEEN_PORTRAIT_LIMITS.count + 1 }, (_, i) => portrait(2026 + i)))).toThrow();
    expect(() => shapeQueenPortraits([portrait(2026), portrait(2026)])).toThrow();
    expect(() => shapeQueenPortraits([{ ...portrait(2026), fired: true }])).toThrow();
    expect(shapeKittyPiece(piece({ portraits: [portrait(2026)] })).portraits).toHaveLength(1);
  });

  it("renders as a flat still in both paths — ten on a shelf is ten small SVGs, no canvas, no sculpture", () => {
    const shelf = Array.from({ length: 10 }, (_, i) => portrait(2026 + i, { rings: i, charms: [charm({ id: `q${i}` }), charm({ id: `r${i}`, part: "head", u: 0.3, v: 0.5 })] }));
    const html = renderToStaticMarkup(createElement(QueenPortraits, { portraits: shelf, members: [{ id: memberId, name: "Alex (fictional)" }] }));
    expect(html.match(/class="queen-portrait"/g)).toHaveLength(10);
    expect(html).not.toContain("<canvas");
    expect(html.match(/class="queen-charm"/g)).toHaveLength(20);
    expect(html.match(/class="queen-ring"/g)).toHaveLength(45);
    expect(html).toContain("2035");
    expect(html).toContain("sealed by Alex (fictional)");
    const one = renderToStaticMarkup(createElement(QueenPortraitFigure, { portrait: portrait(2026, { profile: [1.1, 0.94, 0.9, 0.9] }) }));
    expect(one).toContain(queenFlatVessel({ handles: { belly: 1.1, waist: 0.94, shoulder: 0.9, neck: 0.9 }, rings: 1 }));
    // The world draws no sculpture for a portrait: the sculpture count is hers alone, and disposing her leaves nothing.
    const queen = createQueenSculpture();
    queen.setForm({ handles: queenFormHandles(shelf[3]!.profile), rings: shelf[3]!.rings });
    queen.setCharms(shelf[3]!.charms);
    queen.dispose();
    expect(queen.counts()).toEqual({ geometries: 0, materials: 0, textures: 0 });
  });
});

describe("Living light — the sun over the household's day, never the material axis", () => {
  it("is low and blue on a February evening and high and warm in July, and changes across hours rather than frames", () => {
    const feb = queenLight("2026-02-10", 18.5), jul = queenLight("2026-07-10", 13);
    expect(feb.level).toBeLessThan(0.2); expect(feb.warmth).toBeLessThan(0.4);
    expect(jul.level).toBeGreaterThan(0.9); expect(jul.warmth).toBeGreaterThan(0.75);
    expect(feb.words).toMatch(/Low/); expect(jul.words).toMatch(/High/);
    expect(queenLight("2026-07-10", 13)).toEqual(queenLight("2026-07-10", 13.01));
    expect(queenLight("2026-07-10", 13.5).level).toBeGreaterThanOrEqual(queenLight("2026-07-10", 16).level);
  });

  it("keeps the glaze axis reading fresh versus stale at the darkest and the brightest hour of the year", () => {
    let darkest = { level: Infinity, at: "" }, brightest = { level: -Infinity, at: "" };
    for (let doy = 0; doy < 365; doy += 1) {
      const date = new Date(Date.UTC(2026, 0, 1 + doy)).toISOString().slice(0, 10);
      for (let hour = 0; hour < 24; hour += 0.5) {
        const light = queenLight(date, hour);
        expect(light.level).toBeGreaterThanOrEqual(0); expect(light.level).toBeLessThanOrEqual(1);
        expect(queenLampShare(light)).toBeGreaterThanOrEqual(QUEEN_LIGHT.floor);
        if (light.level < darkest.level) darkest = { level: light.level, at: `${date} ${hour}` };
        if (light.level > brightest.level) brightest = { level: light.level, at: `${date} ${hour}` };
      }
    }
    expect(darkest.level).toBe(0);
    expect(brightest.level).toBeGreaterThan(0.99);
    expect(darkest.at).toMatch(/^2026-(12|01)/);
    expect(brightest.at).toMatch(/^2026-0[67]/);
    // The axis is untouched by the light: fresh and stale differ in roughness, clearcoat and environment response regardless of lamps.
    for (const light of [queenLight(darkest.at.slice(0, 10), Number(darkest.at.slice(11))), queenLight(brightest.at.slice(0, 10), Number(brightest.at.slice(11)))]) {
      const share = queenLampShare(light);
      expect(share).toBeGreaterThanOrEqual(QUEEN_LIGHT.floor); expect(share).toBeLessThanOrEqual(1);
      expect(QUEEN_GLAZE_AXIS.glazed.envMapIntensity / QUEEN_GLAZE_AXIS.matte.envMapIntensity).toBeGreaterThanOrEqual(4);
      expect(QUEEN_GLAZE_AXIS.matte.roughness - QUEEN_GLAZE_AXIS.glazed.roughness).toBeGreaterThan(0.5);
      expect(QUEEN_GLAZE_AXIS.glazed.clearcoat - QUEEN_GLAZE_AXIS.matte.clearcoat).toBe(1);
    }
    // On the sculpture the light is not a material: the axis applied under any light is the axis.
    const queen = createQueenSculpture();
    queen.setGlaze(QUEEN_GLAZE_AXIS.matte);
    expect(queen.materials.body.roughness).toBe(QUEEN_GLAZE_AXIS.matte.roughness);
    queen.setGlaze(QUEEN_GLAZE_AXIS.glazed);
    expect(queen.materials.body.clearcoat).toBe(1);
    queen.dispose();
  });
});

describe("Conservation and disposal hold", () => {
  it("conserves the King exactly as before: the categories still sum to the cent", () => {
    const h = closed(planLifeFixture("household"), 12);
    const nest = projectKittyNest(h, memberId, "household", "2026-09-12");
    const banks = queenBanks(nest);
    expect([...banks.protect.banks, ...banks.whatnow.banks, ...banks.build.banks].reduce((sum, bank) => sum + knownCents(bank.amountCents), 0)).toBe(knownCents(nest.king.amountCents));
    for (const total of [0, 1, 12345, -50000]) {
      const allocation = allocateNestTotal(total, { build: 400, protect: 900, prepare: 250 });
      expect(allocation.protect + allocation.prepare + allocation.everyday + allocation.build).toBe(total);
    }
  });

  it("rebuilds the lathe only when the form changes, and returns every count to zero on dispose with rings, marks and charms on her", () => {
    fakeCanvas();
    const queen = createQueenSculpture();
    const before = queen.counts();
    const skirt = queen.paintable.body;
    const geometry = skirt.geometry;
    queen.setForm(QUEEN_FORM_BASE);
    expect(skirt.geometry).toBe(geometry);
    queen.setForm({ handles: queenWheelPull(QUEEN_FORM_REST, 1), rings: 12 });
    expect(skirt.geometry).not.toBe(geometry);
    expect(queen.counts().geometries).toBe(before.geometries);
    queen.setMarks({ initials: ["A", "S"], date: "14 Sep 2026" });
    expect(queen.counts().textures).toBe(before.textures + 1);
    queen.setCharms(QUEEN_CHARM_KEYBOARD_SEATS.map((seat, i) => charm({ id: `z${i}`, ...seat })));
    queen.dispose();
    expect(queen.counts()).toEqual({ geometries: 0, materials: 0, textures: 0 });
    expect(queen.group.children).toHaveLength(0);
  });
});
