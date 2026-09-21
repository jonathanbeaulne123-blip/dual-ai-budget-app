import type { ThemeId } from "../../theme/scenes.ts";

/**
 * Atlas dressing — data, not branches (LITTLE_HARBOUR_v2 §4, the room up the
 * kitchen stair).
 *
 * A map room under the cottage's rafters, authored three times: a limewashed
 * loft with an oak atlas stand and a brass lamp over it; Taylor's blush attic
 * with a pale maple stand; a Newfoundland loft in painted board with a spruce
 * stand under a tarred ridge. Every value is design data — no hex lives
 * outside this table, and nothing here is a financial fact.
 *
 * The model on the stand is the household's own island: `land` is its turf,
 * `earth` its cut edge, `shore` the sand at the waterline and `modelSea` the
 * glass ring it floats in. `stone` / `stoneToday` are the months underfoot,
 * `lanternLit` / `lanternDark` the gate's lamps, and `fog` the weather the
 * next era is still wrapped in.
 */
export type AtlasDressing = {
  theme: ThemeId;
  /** The loft's shell: plaster, the frame and the rafters, the boards underfoot. */
  plaster: string;
  frame: string;
  floor: string;
  floorAlt: string;
  /** The dormer, the day through it and the island seen out there. */
  window: string;
  day: string;
  farIsland: string;
  farSea: string;
  /** The atlas stand: its top, its turned column, the brass band round its rim. */
  stand: string;
  standColumn: string;
  brass: string;
  /** The island model itself. */
  land: string;
  earth: string;
  shore: string;
  modelSea: string;
  tree: string;
  /** The months underfoot: the stones of the path, and the one we stand on. */
  stone: string;
  stoneToday: string;
  /** The era's own roof on the crown of the island. */
  homeWall: string;
  homeRoof: string;
  /** The gate at the end of the ring, and its lanterns lit and unlit. */
  gate: string;
  lanternLit: string;
  lanternDark: string;
  /** The far side of the bridge: the plank across, and the weather the next island keeps. */
  bridge: string;
  fog: string;
  /** Engraved plates: the era's own, and the little card on the next island. */
  plate: string;
  plateHighlight: string;
  ink: string;
  /** The lamp over the stand — the raking light the whole room is built round. */
  lampShade: string;
  light: { hemiSky: string; hemiGround: string; lamp: string; lampIntensity: number };
};

export const ATLAS_DRESSING: Readonly<Record<ThemeId, AtlasDressing>> = Object.freeze({
  classic: {
    theme: "classic",
    plaster: "#e4d9c0", frame: "#6b4e33", floor: "#a8815c", floorAlt: "#96714f",
    window: "#8a6742", day: "#f4ead2", farIsland: "#8d9a6a", farSea: "#9dbcc0",
    stand: "#9a7048", standColumn: "#7a5738", brass: "#b08d57",
    land: "#7f9455", earth: "#7d5d3f", shore: "#d8c79c", modelSea: "#8fb6bd", tree: "#5d7a45",
    stone: "#cfc4ad", stoneToday: "#e8dcb8",
    homeWall: "#e6dcc4", homeRoof: "#9c5f43",
    gate: "#6f5a42", lanternLit: "#f0c96b", lanternDark: "#7e7565",
    bridge: "#8a6742", fog: "#e8e2d4",
    plate: "#e9ddc2", plateHighlight: "#f6ecd4", ink: "#4b4234",
    lampShade: "#4a3f30",
    light: { hemiSky: "#e6d9c0", hemiGround: "#5e5140", lamp: "#ffdfa6", lampIntensity: 1.35 },
  },
  taylor: {
    theme: "taylor",
    plaster: "#f3e2da", frame: "#8a6255", floor: "#c39a8c", floorAlt: "#b18b7f",
    window: "#a97c6c", day: "#fdf2ea", farIsland: "#a9b189", farSea: "#b6cfd1",
    stand: "#c6a086", standColumn: "#a97c6c", brass: "#c39b6a",
    land: "#9aad76", earth: "#9a7663", shore: "#eddbc4", modelSea: "#a9c8cc", tree: "#7c9464",
    stone: "#e3d6d2", stoneToday: "#fbeee7",
    homeWall: "#fbeee7", homeRoof: "#c07a72",
    gate: "#8a6f68", lanternLit: "#ffd2dc", lanternDark: "#9b8c88",
    bridge: "#a97c6c", fog: "#f6ebe6",
    plate: "#f3e2da", plateHighlight: "#fbeee7", ink: "#5a4a44",
    lampShade: "#6b504a",
    light: { hemiSky: "#f2e0e2", hemiGround: "#7d6560", lamp: "#ffe3ea", lampIntensity: 1.2 },
  },
  newfoundland: {
    theme: "newfoundland",
    plaster: "#dcd8c8", frame: "#5c3a2c", floor: "#8a7052", floorAlt: "#7a6247",
    window: "#7d6448", day: "#eef3f4", farIsland: "#6f8062", farSea: "#7ea3ad",
    stand: "#8a6f50", standColumn: "#6d573d", brass: "#a1885e",
    land: "#6e8752", earth: "#6b5340", shore: "#cbbb95", modelSea: "#7fa7b0", tree: "#4e6b40",
    stone: "#c3bca9", stoneToday: "#e2d9bd",
    homeWall: "#e3e0d0", homeRoof: "#b75a4e",
    gate: "#4e463a", lanternLit: "#f7c56c", lanternDark: "#6f6a5c",
    bridge: "#7d6448", fog: "#dfe4e3",
    plate: "#ddd6c2", plateHighlight: "#ece5d2", ink: "#42403a",
    lampShade: "#3c3a32",
    light: { hemiSky: "#d7dee0", hemiGround: "#4c463a", lamp: "#ffd79a", lampIntensity: 1.45 },
  },
});

export function atlasDressingFrom(theme: unknown): AtlasDressing {
  const id = theme === "taylor" || theme === "newfoundland" ? theme : "classic";
  return ATLAS_DRESSING[id];
}
