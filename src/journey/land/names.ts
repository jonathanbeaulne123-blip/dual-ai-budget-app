/**
 * Authored display names for the Journey land (T2). The baked index carries ids only, and MANIFEST.json is never read
 * at runtime, so the board's words live here. They follow the design canon's labels (Horizon neighbourhoods,
 * landforms, hosts and the Year Walk stations) as of geography `horizon-geo-1`; if the design lead renames a place,
 * this file changes with it (PLAN §E N8).
 */
import type { StationId } from "../contracts.ts";

/** District (index `districts[].id`) → the words shown on the board. */
export const DISTRICT_NAMES: Readonly<Record<string, string>> = {
  harbour: "Little Harbour",
  landing: "The Landing",
  reach: "The Reach",
  green: "The Green",
  hollow: "The Hollow",
  scholars: "Scholars' Edge",
  flats: "The Flats",
  bight: "The Bight",
  lakeside: "Lakeside",
  notch: "The Notch",
  prow: "The Prow",
  crown: "The Crown",
  offshore: "Offshore",
};

/** Station (one per calendar month) → the place it stands in. */
export const STATION_NAMES: Readonly<Record<StationId, string>> = {
  jan: "The Shoulder",
  feb: "Lakeside",
  mar: "Scholars' floor",
  apr: "The Green, west",
  may: "The Hollow, west rows",
  jun: "Long Sands",
  jul: "The Flats",
  aug: "The Reach",
  sep: "The Hollow, east rows",
  oct: "The north pass",
  nov: "The Prow",
  dec: "Little Harbour",
};

/** Host (index `hosts[].id`) → name. `home` is the shared household house ("Our home"), not a member's modular home. */
export const HOST_NAMES: Readonly<Record<string, string>> = {
  home: "Our home",
  bank: "The Fund bank",
  library: "The Library",
  glasshouse: "The Glasshouse",
  studio: "The Pottery Studio",
  cottage: "Hercules's cottage",
  boathouse: "The Boathouse",
};

/** Reserve plots: words by family; the number stays the plot's own. */
export function reserveName(id: string): string {
  const m = /^plot\.([a-z]+)\.(\d+)$/.exec(id);
  if (!m) return "A home plot";
  const family: Record<string, string> = { terraces: "Terraces", bight: "Bight shore", under: "Undercroft", flats: "The Flats" };
  return `${family[m[1]!] ?? "Home"} plot ${m[2]}`;
}

export function districtName(id: string): string {
  return DISTRICT_NAMES[id] ?? id.replace(/(^|[-_.])(\w)/g, (_, sep: string, c: string) => `${sep ? " " : ""}${c.toUpperCase()}`);
}
export function hostName(id: string): string {
  return HOST_NAMES[id] ?? districtName(id);
}
