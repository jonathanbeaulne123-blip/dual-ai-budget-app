// @vitest-environment jsdom
import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { COURT_DRESSING, COURT_THEMES, contrastRatio, courtDressingFrom } from "../src/harbour/court/dressing.ts";
import { engravedWords, plateFinish, plateLines } from "../src/harbour/court/engraved.ts";
import { SUNDIAL_HORIZON_DAYS, sundialAngle, sundialReach } from "../src/harbour/court/sundial.ts";
import { slipLines } from "../src/harbour/court/mailbox.ts";
import { COURT_PIECES, normalisePiece } from "../src/harbour/court/pieces.ts";
import { COURT_LAYOUT, courtPlace, createCourt, readCourtReading, type CourtHandle } from "../src/harbour/court/CourtScene.ts";

describe("court dressing", () => {
  it("authors all three themes with ink-on-plate contrast of at least 4.5:1", () => {
    expect(Object.keys(COURT_DRESSING).sort()).toEqual([...COURT_THEMES].sort());
    for (const theme of COURT_THEMES) {
      const d = COURT_DRESSING[theme];
      expect(d.theme).toBe(theme);
      expect(contrastRatio(d.ink, d.plate), `${theme} plate`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(d.paperInk, d.paper), `${theme} slip paper`).toBeGreaterThanOrEqual(4.5);
      expect(d.props.length).toBeGreaterThanOrEqual(3);
      expect(d.props.length).toBeLessThanOrEqual(5);
      expect(d.light.sunIntensity).toBeGreaterThan(0);
      expect(d.light.fog.near).toBeLessThan(d.light.fog.far);
      for (const colour of [d.stone, d.stoneAlt, d.joint, d.moss, d.plinth, d.timber, d.metal, d.gate.post, d.gate.rail, d.gate.accent, d.sea, d.sky, d.light.sun, d.light.hemiSky, d.light.hemiGround, d.light.fog.color]) expect(colour).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
  it("uses the BUILD_PLAN §6 colours per theme", () => {
    expect(COURT_DRESSING.classic.stone).toBe("#cbb48f");
    expect(COURT_DRESSING.classic.moss).toBe("#6d7f4f");
    expect(COURT_DRESSING.taylor.stone).toBe("#ead8d2");
    expect(COURT_DRESSING.taylor.joint).toBe("#d9b8c4");
    expect(COURT_DRESSING.newfoundland.stone).toBe("#7d8d93");
    expect(COURT_DRESSING.newfoundland.gate).toEqual({ post: "#b75a4e", rail: "#488c98", accent: "#c9ae5a" });
  });
  it("resolves a dressing from a theme id, a dressing object, or anything else", () => {
    expect(courtDressingFrom("taylor")).toBe(COURT_DRESSING.taylor);
    expect(courtDressingFrom(COURT_DRESSING.newfoundland)).toBe(COURT_DRESSING.newfoundland);
    expect(courtDressingFrom({ theme: "newfoundland" })).toBe(COURT_DRESSING.newfoundland);
    expect(courtDressingFrom(undefined)).toBe(COURT_DRESSING.classic);
  });
});

describe("engraved words", () => {
  it("never writes $0 for unknown, and writes $0 for zero", () => {
    expect(engravedWords(null)).toBe("—");
    expect(engravedWords(Number.NaN)).toBe("—");
    expect(engravedWords(0)).toBe("$0");
    expect(engravedWords(124_000)).toBe("$1,240");
    expect(engravedWords(124_099)).toBe("$1,240");
    expect(engravedWords(1_234_567_89)).toBe("$1,234,567");
    expect(engravedWords(-5_000)).toBe("−$50");
    expect(engravedWords(-40)).toBe("$0");
  });
  it("follows the Queen's glaze for its finish", () => {
    expect(plateFinish("current")).toBe("glazed");
    expect(plateFinish("stale")).toBe("matte");
    expect(plateFinish("offline")).toBe("offline");
  });
  it("keeps at most three slip lines and never an empty plate", () => {
    expect(plateLines("a\n\n b \nc\nd")).toEqual(["a", "b", "c"]);
    expect(plateLines("   ")).toEqual(["—"]);
    expect(slipLines(["  one  two ", "", "three", "four", "five"])).toEqual(["one two", "three", "four"]);
    expect(slipLines(["x".repeat(60)])[0]!.length).toBeLessThanOrEqual(42);
  });
});

describe("sundial", () => {
  it("points at noon for today and at the rim from a month out", () => {
    expect(sundialAngle(0)).toBe(0);
    expect(sundialAngle(-3)).toBe(0);
    expect(sundialAngle(SUNDIAL_HORIZON_DAYS)).toBeCloseTo(Math.PI / 2);
    expect(sundialAngle(90)).toBeCloseTo(Math.PI / 2);
    expect(sundialAngle(15.5)).toBeCloseTo(Math.PI / 4);
    expect(sundialAngle(Number.NaN)).toBeCloseTo(Math.PI / 2);
    expect(sundialReach(0)).toBeCloseTo(0.35);
    expect(sundialReach(31)).toBeCloseTo(1);
  });
});

describe("the Court", () => {
  it("normalises a piece to the kit's height beside the Queen and stands it on y = 0", () => {
    const root = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 2));
    mesh.position.set(3, 7, -1);
    root.add(mesh);
    normalisePiece(root, COURT_PIECES.rook.scale);
    const box = new THREE.Box3().setFromObject(root);
    expect(box.min.y).toBeCloseTo(0, 5);
    expect(box.max.y).toBeCloseTo(2.05 * 0.82, 5);
    expect(box.getCenter(new THREE.Vector3()).x).toBeCloseTo(0, 5);
    expect(box.getCenter(new THREE.Vector3()).z).toBeCloseTo(0, 5);
  });

  function build(reading: unknown = {}, quality: "full" | "lite" = "full"): { handle: CourtHandle; scene: THREE.Scene } {
    const scene = new THREE.Scene();
    const handle = createCourt(scene, { dressing: COURT_DRESSING.classic, reading: readCourtReading(reading), quality, loadModels: false });
    return { handle, scene };
  }

  it("is the 'court' Place with the seven named anchors, door targets and phone/desktop poses", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined); // jsdom has no 2D canvas; the plates fall back to blank stone.
    expect(courtPlace.id).toBe("court");
    const { handle, scene } = build();
    expect(scene.children).toContain(handle.group);
    const anchors = handle.anchors();
    const ids = anchors.map((a) => a.id);
    for (const id of ["queen", "rook", "bishop", "knight", "sundial", "mailbox", "gate"]) expect(ids).toContain(id);
    const byId = Object.fromEntries(anchors.map((a) => [a.id, a]));
    expect(byId.rook!.door).toEqual({ target: "loft-banks" });
    expect(byId.bishop!.door).toEqual({ target: "cellar-bills" });
    expect(byId.knight!.door).toEqual({ target: "loft-banks", object: "bank/plan:protect" });
    expect(byId.rook!.position[0]).toBeCloseTo(4.2); expect(byId.rook!.position[2]).toBeCloseTo(-3.0);
    expect(byId.knight!.position[0]).toBeCloseTo(-4.2);
    expect(byId.bishop!.position[2]).toBeCloseTo(4.6);
    expect(byId.gate!.zone).toBe("gate"); expect(byId.queen!.zone).toBe("queen"); expect(byId.rook!.zone).toBe("piece");
    const poses = handle.poses();
    for (const key of ["court:phone", "court:desktop", "sky:phone", "sky:desktop", "object:queen:phone", "object:rook:desktop", "object:mailbox:phone"]) expect(poses[key]).toBeDefined();
    expect(poses["court:phone"]!.phi).toBeGreaterThan(poses["sky:phone"]!.phi);
    expect(handle.regions().map((r) => r.id)).toEqual(expect.arrayContaining(["queen", "flagstone", "rook", "bishop", "knight", "sundial", "mailbox", "slip", "gate", "hercules"]));
    expect(COURT_LAYOUT.flagstone).toEqual([0, 0, 1.6]);
    expect(handle.drawCalls()).toBeLessThanOrEqual(68); // 60 with the Cistern (slice 2); the rest is headroom for the court itself
    handle.dispose();
    expect(scene.children).not.toContain(handle.group);
  });

  it("engraves the reading onto the plates, raises the flag, swings the shadow and grows moss by condition", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { handle } = build({
      everyday: 124_000, prepare: { cents: 80_000, target: 100_000 }, protect: { cents: null, target: 1 }, build: { cents: 0, target: 1, goals: 2 },
      next: { label: "Hydro", date: "2026-10-01", cents: 9_000, daysAhead: 11, target: "cellar-bills" },
      noticed: { fact: "Groceries ran high", next: "cellar-bills", target: "cellar-bills", source: "pulse" },
      slip: ["Bianca posted the hydro bill", "Two shifts logged", "A bank filled", "Ignored fourth line"],
      condition: { state: "weathered", days: 9, words: "" }, freshness: "current", partner: { fresh: true, name: "Bianca" },
    });
    const words = handle.words();
    expect(words.everyday).toBe("$1,240");
    expect(words.bishop).toBe("$800");
    expect(words.knight).toBe("—");
    expect(words.rook).toBe("$0");
    expect(words.tag).toBe("Hydro");
    expect(words.slip).toEqual(["Bianca posted the hydro bill", "Two shifts logged", "A bank filled"]);
    expect(words.flagUp).toBe(true);
    expect(handle.mossCoverage()).toBe(0.8);
    expect(handle.group.getObjectByName("partner")?.visible).toBe(true);
    // Update: quiet books, nothing noticed, settled.
    handle.update({ everyday: null, condition: { state: "settled" }, freshness: "stale", slip: [], partner: { fresh: false } });
    const after = handle.words();
    expect(after.everyday).toBe("—");
    expect(after.flagUp).toBe(false);
    expect(after.tag).toBeNull();
    expect(after.slip).toEqual([]);
    expect(handle.mossCoverage()).toBe(0.2);
    expect(handle.group.getObjectByName("partner")?.visible).toBe(false);
    // Only Hercules's tail moves; at rest the scene asks for no frames.
    expect(handle.animate(0.5, 0.016)).toBe(true); // the first frame after an update redraws, and the tail flicks early in its cycle
    expect(handle.animate(5, 0.016)).toBe(false);
    expect(handle.animate(5.1, 0.016)).toBe(false);
    handle.dispose();
  });

  it("seats the Queen in her slot", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { handle } = build();
    const queen = new THREE.Group(); queen.name = "queen";
    handle.attachQueen(queen);
    expect(handle.group.getObjectByName("queen-slot")?.children).toEqual([queen]);
    expect(handle.detachQueen()).toBe(queen);
    expect(handle.group.getObjectByName("queen-slot")?.children).toEqual([]);
    handle.dispose();
  });
});
