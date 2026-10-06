import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { gunzipSync } from "node:zlib";
import { beforeAll, describe, expect, it } from "vitest";
import { fromDiorama, type JourneyLandData, type Point2, type Point3 } from "../src/journey/contracts.ts";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as THREE from "three";
import { BoardFlat, layoutClock, layoutWeek } from "../src/journey/board/index.ts";
import { buildJourneyLand, CLAY_NAMES, decodeJourneyLandSlim, dioramaFrame, journeyLandFlatData } from "../src/journey/land/index.ts";
import { deriveJourneyBoard } from "../src/journey/model/index.ts";
import { BIANCA, FIXTURE_TODAY, journeyDemoHousehold } from "./fixtures/journey-board-households.ts";

/**
 * The Horizon → Journey rule (PLAN §E; AGENTS.md Mission; src/journey/README.md rule 8): the Journey map is drawn from
 * the baked Horizon land ONLY. Every coast, landform, water body, district, road, station and Year Walk stretch on the
 * map comes from `JourneyLandData` (the bake), never from numbers typed into src/journey/{land,board}; so a structural
 * change to Horizon (a coast moved, a Year Walk rerouted) moves the map with it, and a stale hand-drawn copy cannot hide.
 *
 * 1. Source scan: no hand-authored coordinate arrays (four or more [x, y] pairs, a flat run of eight numbers, or four
 *    {x, y} points in one literal; a two-entry allowlist of non-geometry literals) and no island centre / radius
 *    literals in src/journey/land or src/journey/board.
 * 2. Behaviour: shift the baked land 50 m east → the diorama frame, the clock, the clay coast mesh, the flat twin (coast,
 *    stations, hosts) and every flat-board mark move 50 m; reroute a Year Walk stretch → the Week trail and tiles move.
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

/**
 * Literals that look like coordinate runs but are not island geometry. Exact text, with why; anything else fails.
 */
const ALLOWED_RUNS: readonly { file: string; run: string; why: string }[] = [
  { file: "src/journey/land/clay.ts", run: "[0, 0], [0.13, 0], [0.17, 0.16], [0.16, 0.18], [0, 0.18]", why: "a toy tree pot's lathe profile (toy units)" },
  { file: "src/journey/board/scene.ts", run: "[40, 30], [70, 10], [0, 50], [-30, 40], [0, 0]", why: "Hercules's offsets around The Green's baked heart" },
];
const NUM = String.raw`-?\d+(?:\.\d+)?`;
const PAIR = String.raw`\[\s*${NUM}\s*,\s*${NUM}\s*(?:,\s*${NUM}\s*)?\]`;
const XY = String.raw`\{\s*x\s*:\s*${NUM}\s*,\s*y\s*:\s*${NUM}\s*\}`;
const RUNS = [
  new RegExp(`${PAIR}(?:\\s*,\\s*${PAIR}){3,}`, "g"),
  new RegExp(String.raw`\[\s*${NUM}(?:\s*,\s*${NUM}){7,}\s*\]`, "g"),
  new RegExp(`${XY}(?:\\s*,\\s*${XY}){3,}`, "g"),
];
/** Every coordinate-looking run in `body` that is not on the allowlist. */
function coordinateRuns(body: string): string[] {
  const allowed = new Set(ALLOWED_RUNS.map((a) => a.run.replace(/\s+/g, "")));
  return RUNS.flatMap((re) => [...body.matchAll(re)].map((m) => m[0])).filter((run) => !allowed.has(run.replace(/\s+/g, "")));
}

const SLIM = JSON.parse(gunzipSync(readFileSync("public/horizon/world/horizon-geo-1.journey.json.gz")).toString());
let land: JourneyLandData;
beforeAll(() => { land = decodeJourneyLandSlim(SLIM); });
const board = () => deriveJourneyBoard(journeyDemoHousehold().household, BIANCA, FIXTURE_TODAY);
/** The whole baked land moved `dx` metres east (a structural Horizon change in miniature; the terrain lattice cannot move). */
function shiftLand(l: JourneyLandData, dx: number): JourneyLandData {
  const p2 = (p: Point2): Point2 => [p[0] + dx, p[1]];
  const poly = (ring: readonly Point2[]) => ring.map(p2);
  return {
    ...l,
    coastline: poly(l.coastline),
    water: l.water.map((w) => ({ ...w, outline: poly(w.outline) })),
    landforms: l.landforms.map((f) => ({ ...f, outline: poly(f.outline) })),
    districts: l.districts.map((d) => ({ ...d, heart: d.heart ? p2(d.heart) : null })),
    hosts: l.hosts.map((h) => ({ ...h, door: p2(h.door), footprint: h.footprint ? poly(h.footprint) : null })),
    reserves: l.reserves.map((r) => ({ ...r, outline: poly(r.outline), door: p2(r.door) })),
    lines: l.lines.map((line) => ({ ...line, points: poly(line.points) })),
    stations: l.stations.map((st) => ({ ...st, anchor: p2(st.anchor), footprint: st.footprint ? poly(st.footprint) : null })),
    yearWalk: l.yearWalk.map((w) => ({ ...w, points: w.points.map((p) => [p[0] + dx, p[1], p[2]] as const) })),
    homestead: l.homestead.map((h) => ({ ...h, anchor: p2(h.anchor), footprint: poly(h.footprint) })),
    kittyPlaza: { ...l.kittyPlaza, xy: p2(l.kittyPlaza.xy) },
    bridges: l.bridges?.map((br) => ({ ...br, axis: br.axis.map((p) => [p[0] + dx, p[1], p[2]] as const) })),
    covers: l.covers?.map((c) => ({ ...c, points: poly(c.points), portals: poly(c.portals) })),
    boulevards: l.boulevards?.map((bv) => ({ ...bv, points: poly(bv.points) })),
  };
}
const shift = <P extends Point2 | Point3>(p: P, dx: number): P => (p.length === 2 ? [p[0] + dx, p[1]] : [p[0] + dx, p[1], (p as Point3)[2]]) as unknown as P;

describe("the Journey map is drawn from the bake (source)", () => {
  it("walks real land and board modules", () => {
    const names = files.map((f) => relative(join(root, "src", "journey"), f).replace(/\\/g, "/"));
    for (const expected of ["land/clay.ts", "land/diorama.ts", "board/clock.ts", "board/week.ts", "board/scene.ts"]) expect(names).toContain(expected);
  });

  it("has no hand-authored coordinate arrays: four or more [x, y] pairs, a flat run of eight numbers, or four {x, y}", () => {
    const offences = files.flatMap((f) => coordinateRuns(code(readFileSync(f, "utf8"))).map((run) => `${relative(root, f)}: ${run.slice(0, 60)}`));
    expect(offences).toEqual([]);
  });

  it("the scan catches a hand-authored coast (four pairs), a flat run and {x, y} points, and the allowlist stays exact", () => {
    expect(coordinateRuns("const coast = [[900, 180], [1075.6, 176.7], [1200, 190], [1261.6, 208.4]];")).toHaveLength(1);
    expect(coordinateRuns("const coast = [900, 180, 1075.6, 176.7, 1200, 190, 1261.6, 208.4];")).toHaveLength(1);
    expect(coordinateRuns("const pts = [{ x: 900, y: 180 }, { x: 1075, y: 176 }, { x: 1200, y: 190 }, { x: 1261, y: 208 }];")).toHaveLength(1);
    expect(coordinateRuns("const pair = [[0, 0], [1, 1], [2, 2]];")).toHaveLength(0);
    // Each allowlisted literal is still where it is (a stale allowlist entry would hide nothing and must be removed).
    for (const allowed of ALLOWED_RUNS) {
      const body = code(readFileSync(join(root, allowed.file), "utf8"));
      expect(body.replace(/\s+/g, ""), `${allowed.file}: ${allowed.why}`).toContain(allowed.run.replace(/\s+/g, ""));
    }
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
  it("a coastline shifted 50 m moves the diorama frame, the clock and the clay coast 50 m", () => {
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
    // The clay island: its coast meshes are built round the frame from the coastline, so in concept metres their bounding
    // box moves 50 m with the coast; the terrain lattice (not moved) sits 50 m × scale further west in diorama units.
    const ha = buildJourneyLand(land, { theme: "classic", tier: "lite", homes: [] });
    const hb = buildJourneyLand(moved, { theme: "classic", tier: "lite", homes: [] });
    try {
      expect(hb.frame.centre[0] - ha.frame.centre[0]).toBeCloseTo(50, 6);
      const box = (h: typeof ha, name: string) => { const g = (h.group.getObjectByName(name) as THREE.Mesh).geometry; g.computeBoundingBox(); return g.boundingBox!; };
      for (const name of [CLAY_NAMES.shallows, CLAY_NAMES.slab]) {
        const ba = box(ha, name), bb = box(hb, name);
        expect(fromDiorama(hb.frame, bb.min.x, 0).x - fromDiorama(ha.frame, ba.min.x, 0).x, `${name} min x (m)`).toBeCloseTo(50, 3);
        expect(fromDiorama(hb.frame, bb.max.x, 0).x - fromDiorama(ha.frame, ba.max.x, 0).x, `${name} max x (m)`).toBeCloseTo(50, 3);
      }
      const ta = box(ha, CLAY_NAMES.terrain), tb = box(hb, CLAY_NAMES.terrain);
      expect(tb.min.x - ta.min.x).toBeCloseTo(-50 * ha.frame.scale, 3);
    } finally { ha.dispose(); hb.dispose(); }
  });

  it("a land shifted 50 m moves the flat twin's coast, stations and hosts, and every flat-board mark, 50 m", () => {
    const moved = shiftLand(land, 50);
    // The flat twin: the coast path's every x, the stations and the hosts.
    const fa = journeyLandFlatData(land), fb = journeyLandFlatData(moved);
    const xs = (d: string) => [...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m) => Number(m[1]));
    const ca = xs(fa.coast), cb = xs(fb.coast);
    expect(cb.length).toBe(ca.length);
    expect(ca.length).toBeGreaterThan(20);
    cb.forEach((x, i) => expect(x - ca[i]!).toBeCloseTo(50, 0));
    fb.stations.forEach((st, i) => { expect(st.x - fa.stations[i]!.x).toBeCloseTo(50, 6); expect(st.y).toBeCloseTo(fa.stations[i]!.y, 6); });
    fb.hosts.forEach((h, i) => expect(h.x - fa.hosts[i]!.x).toBeCloseTo(50, 6));
    // BoardFlat at every level: each mark's data-x moves 50 m, data-y stays (concept metres, one decimal).
    const b = board();
    for (const level of ["month", "year", "week"] as const) {
      const marks = (l: JourneyLandData) => [...renderToStaticMarkup(createElement("svg", null, createElement(BoardFlat, { board: b, land: l, level, theme: "classic" })))
        .matchAll(/data-id="([^"]+)"[^>]*?data-x="(-?[\d.]+)" data-y="(-?[\d.]+)"/g)].map((m) => ({ id: m[1]!, x: Number(m[2]), y: Number(m[3]) }));
      const ma = marks(land), mb = marks(moved);
      expect(ma.length, level).toBeGreaterThan(level === "week" ? 5 : 10);
      expect(mb.map((m) => m.id)).toEqual(ma.map((m) => m.id));
      mb.forEach((m, i) => { expect(m.x - ma[i]!.x, `${level} ${m.id} x`).toBeCloseTo(50, 0); expect(m.y - ma[i]!.y, `${level} ${m.id} y`).toBeCloseTo(0, 0); });
    }
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
