/**
 * The SVG twin's data (T2): the same `JourneyLandData`, the same concept coordinates (viewBox = the island extent,
 * 0 0 2000 1800), so a station, host or route point is at the same x/y as on the 3D land (engine x/z). Pure.
 */
import type { JourneyLandData, JourneyLandFlatData } from "../contracts.ts";
import { closedRing, pathData } from "./simplify.ts";

/** Landform relief bands for the flat map (by the landform's top height, metres). */
export function landformBand(maxHeight: number): "low" | "mid" | "high" {
  return maxHeight <= 25 ? "low" : maxHeight <= 70 ? "mid" : "high";
}

export function journeyLandFlatData(data: JourneyLandData): JourneyLandFlatData {
  return {
    viewBox: [0, 0, data.extent.w, data.extent.h],
    coast: pathData(closedRing(data.coastline), true),
    water: data.water.map((w) => ({ id: w.id, kind: w.kind, d: pathData(closedRing(w.outline), true) })),
    // Low relief first so higher ground paints over it.
    landforms: data.landforms
      .slice()
      .sort((a, b) => a.maxHeight - b.maxHeight)
      .map((l) => ({ id: l.id, d: pathData(closedRing(l.outline), true), band: landformBand(l.maxHeight) })),
    lines: data.lines.map((l) => ({ id: l.id, kind: l.kind, d: pathData(l.points, false) })),
    // Road bridges (ROAD.md §7): the deck's centreline at its true width, drawn under the lines.
    bridges: (data.bridges ?? []).map((br) => ({ id: br.id, d: pathData(br.axis.map((p) => [p[0], p[2]] as const), false), width: br.width })),
    hosts: data.hosts.map((h) => ({ id: h.id, x: h.door[0], y: h.door[1] })),
    reserves: data.reserves.map((r) => ({ id: r.id, d: pathData(closedRing(r.outline), true) })),
    districts: data.districts.flatMap((d) => (d.heart ? [{ id: d.id, label: d.label, x: d.heart[0], y: d.heart[1] }] : [])),
    stations: data.stations.map((s) => ({ id: s.id, x: s.anchor[0], y: s.anchor[1] })),
  };
}
