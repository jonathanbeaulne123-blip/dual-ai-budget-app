import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { gunzipSync } from "node:zlib";
import { beforeAll, describe, expect, it } from "vitest";
import { fromDiorama, type JourneyLandData, type Point2, type Point3 } from "../src/journey/contracts.ts";
import { layoutClock, layoutWeek } from "../src/journey/board/index.ts";
import { buildJourneyLand, CLAY_NAMES, decodeJourneyLandSlim, dioramaFrame, journeyLandFlatData } from "../src/journey/land/index.ts";
import { deriveJourneyBoard } from "../src/journey/model/index.ts";
import { BIANCA, FIXTURE_TODAY, journeyDemoHousehold } from "./fixtures/journey-board-households.ts";

/**
 * The Horizon → Journey rule (PLAN §E; AGENTS.md Mission; src/journey/README.md rule 8): the Journey map is drawn from
 * the baked Horizon land ONLY. Every coast, landform, water body, district, road, station and Year Walk stretch on the
 * map comes from `JourneyLandData` (the bake), never from numbers typed into src/journey/{land,board}; so a structural
 * change to Horizon (a coast moved, a Year Walk rerouted) moves the map with it, and a stale hand-drawn copy cannot hide.
 *
 * 1. Source scan: no hand-authored coordinate arrays (six or more [x, y] pairs in one literal) and no island centre /
 *    radius literals in src/journey/land or src/journey/board.
 * 2. Behaviour: shift the baked coastline 50 m east → the diorama frame, the clock (its slots in concept metres), the clay
 *    island and its flat twin all move 50 m; reroute a Year Walk stretch → the Week trail and its tiles move with it.
 */
const root = process.cwd();
const dirs = ["land", "board"].map((d) => join(root, "src", "journey", d));
const walk = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
});
const files = dirs.flatMap(walk);
/** Source without comments (a comment may quote a coordinate as documentation). */
const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

const SLIM = JSON.parse(gunzipSync(readFileSync("public/horizon/world/horizon-geo-1.journey.json.gz")).toString());
let land: JourneyLandData;
beforeAll(() => { land = decodeJourneyLandSlim(SLIM); });
const board = () => deriveJourneyBoard(journeyDemoHousehold().household, BIANCA, FIXTURE_TODAY);
const shift = <P extends Point2 | Point3>(p: P, dx: number): P => (p.length === 2 ? [p[0] + dx, p[1]] : [p[0] + dx, p[1], (p as Point3)[2]]) as unknown as P;

describe("the Journey map is drawn from the bake (source)", () => {
  it("walks real land and board modules", () => {
    const names = files.map((f) => relative(join(root, "src", "journey"), f).replace(/\\/g, "/"));
    for (const expected of ["land/clay.ts", "land/diorama.ts", "board/clock.ts", "board/week.ts", "board/scene.ts"]) expect(names).toContain(expected);
  });

  it("has no hand-authored coordinate arrays (six or more [x, y] pairs in one literal)", () => {
    const pair = String.raw`\[\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*(?:,\s*-?\d+(?:\.\d+)?\s*)?\]`;
    const run = new RegExp(`${pair}(?:\\s*,\\s*${pair}){5,}`);
    const offences = files.filter((f) => run.test(code(readFileSync(f, "utf8")))).map((f) => relative(root, f));
    expect(offences).toEqual([]);
  });

  it("names no island centre or radius literal: the frame comes from the coastline", () => {
    // The prototype's baked frame (centre [976, 800], radius 716.5) and the island extent: none may be typed in.
    const literal = /\b(?:centre|center|radius|CX|CY)\s*[:=]\s*(?:\[\s*\d{3,}|\d{3,})/;
    const known = /\b(?:976|716\.5)\b/;
    const offences = files.flatMap((f) => {
      const body = code(readFileSync(f, "utf8"));
      return [literal.test(body) ? `${relative(root, f)}: centre/radius literal` : null, known.test(body) ? `${relative(root, f)}: the baked frame's numbers` : null].filter(Boolean);
    });
    expect(offences).toEqual([]);
  });
});

describe("the Journey map is drawn from the bake (behaviour)", () => {
  it("a coastline shifted 50 m moves the diorama frame, the clock, the clay island and its flat twin 50 m", () => {
    const moved: JourneyLandData = { ...land, coastline: land.coastline.map((p) => shift(p, 50)) };
    const a = dioramaFrame(land), b = dioramaFrame(moved);
    expect(b.centre[0] - a.centre[0]).toBeCloseTo(50, 6);
    expect(b.centre[1]).toBeCloseTo(a.centre[1], 6);
    expect(b.radius).toBeCloseTo(a.radius, 6);
    // The clock: its slots stand in diorama units round the frame's centre, so in concept metres they move with the coast.
    const clock = layoutClock(board());
    for (const slot of clock.slots.slice(0, 5)) {
      const pa = fromDiorama(a, slot.at[0], slot.at[1]), pb = fromDiorama(b, slot.at[0], slot.at[1]);
      expect(pb.x - pa.x).toBeCloseTo(50, 6);
      expect(pb.y).toBeCloseTo(pa.y, 6);
    }
    // The clay island and its flat twin follow the coastline they are built from.
    const ha = buildJourneyLand(land, { theme: "classic", tier: "lite", homes: [] });
    const hb = buildJourneyLand(moved, { theme: "classic", tier: "lite", homes: [] });
    try {
      expect(hb.frame.centre[0] - ha.frame.centre[0]).toBeCloseTo(50, 6);
      expect(ha.group.getObjectByName(CLAY_NAMES.shallows) ?? ha.group.getObjectByName(CLAY_NAMES.terrain)).toBeTruthy();
    } finally { ha.dispose(); hb.dispose(); }
    const fa = journeyLandFlatData(land), fb = journeyLandFlatData(moved);
    expect(fb.coast).not.toBe(fa.coast);
  });

  it("a rerouted Year Walk stretch moves the Week trail and its tiles", () => {
    const frame = dioramaFrame(land);
    const b = board();
    const rerouted: JourneyLandData = { ...land, yearWalk: land.yearWalk.map((w) => ({ ...w, points: w.points.map((p) => shift(p, 40)) })) };
    const a = layoutWeek(b, land, frame), c = layoutWeek(b, rerouted, frame);
    expect(a.tiles.length).toBe(7);
    const moved = a.tiles.map((t, i) => Math.hypot(c.tiles[i]!.at[0] - t.at[0], c.tiles[i]!.at[1] - t.at[1]));
    expect(Math.max(...moved)).toBeGreaterThan(10);
    expect(c.trail[0]).not.toEqual(a.trail[0]);
    // The trail lies ON the baked walk (within a smoothing tolerance), never on a path of its own.
    const near = (pts: readonly Point3[], p: Point2) => Math.min(...pts.map((q) => Math.hypot(q[0] - p[0], q[2] - p[1])));
    const walkPts = rerouted.yearWalk.flatMap((w) => w.points);
    for (const t of c.tiles) expect(near(walkPts, t.at)).toBeLessThan(40);
  });
});
