/**
 * The board's clay palettes (Horizon Clock, L3): the approved prototype's three themes (`P`) and shared prop colours
 * (`PROPC`), typed against the frozen contract (`JourneyClayPalettes`, `JourneyPropPalette`).
 *
 * INTEGRATOR: L2 authors the canonical values in `land/clayPalette.ts`. This lane could not import that file (it did
 * not exist in this worktree), so the board reads this copy; once both lanes land, point `boardPalette` at L2's export
 * and delete the table below. The values are the prototype's, unchanged.
 */
import type { JourneyClayPalette, JourneyClayPalettes, JourneyPropPalette, ThemeId } from "../contracts.ts";

export const BOARD_CLAY_PALETTES: JourneyClayPalettes = {
  taylor: {
    plinth: "#eab3a3", plinth2: "#d99a8c", plinthFinish: "plain", sand: "#f8e4c0", grass: "#b4dd8e", grass2: "#9fd283", hill: "#a9d58a",
    rock: "#cbbfe3", snow: "#fffaf8", water: "#93d7df", shallow: "#cdf3ef",
    road: "#fff7f0", roadPast: "#ead9d3", roadFuture: "#ffffff", stud: "#f4c6d3", gate: "#de5577",
    wall: "#fff4e9", roof1: "#ee7fa2", roof2: "#ab9cec", roof3: "#ffd27a", homeRoof: "#de5577", trunk: "#b9866d", leaf: "#93d27c", leaf2: "#7fc7a6",
    bus: "#ffcb66", busEar: "#ff92b2", glass: "#5b6fa8", ink: "#5b3c4d", honey: "#f2ad35",
    light: "#ffe2c4", hemiSky: "#fff3f0", hemiGround: "#b9d9b0",
    tin: "#2fc983", tout: "#3f9bff", tjar: "#ffb81f", tcheck: "#ff8a3d", tbase: "#ff5fa2", tempty: "#fff4ec", ped: "#fff6fa", lane: "#fffaf4",
  },
  classic: {
    plinth: "#d9a679", plinth2: "#c38e62", plinthFinish: "plain", sand: "#f7e3b1", grass: "#a7d57b", grass2: "#93c96b", hill: "#9fcf74",
    rock: "#cfc0a6", snow: "#fffbf2", water: "#88d0cf", shallow: "#d2f2e6",
    road: "#fff6df", roadPast: "#e8dcc0", roadFuture: "#ffffff", stud: "#f1d9a0", gate: "#c9502e",
    wall: "#fff5e2", roof1: "#e2643f", roof2: "#5f97cc", roof3: "#f5c24f", homeRoof: "#d4532f", trunk: "#a9774f", leaf: "#8fcd68", leaf2: "#6fbf8a",
    bus: "#f7c846", busEar: "#e2643f", glass: "#3f5a7a", ink: "#4a3a2a", honey: "#eea52f",
    light: "#ffe1b5", hemiSky: "#fff7e6", hemiGround: "#b7d6a1",
    tin: "#34bd73", tout: "#3c86f5", tjar: "#ffad1f", tcheck: "#ff7a2f", tbase: "#ff8a2b", tempty: "#fff6e4", ped: "#fffaf0", lane: "#fff8ea",
  },
  newfoundland: {
    plinth: "#a2adb3", plinth2: "#8a979e", plinthFinish: "clapboard", sand: "#ece4cc", grass: "#9dcc93", grass2: "#88bf80", hill: "#92c48a",
    rock: "#c3c8c6", snow: "#ffffff", water: "#86bccd", shallow: "#d3e9ee",
    road: "#f6f8f5", roadPast: "#dde2de", roadFuture: "#ffffff", stud: "#c9d6dc", gate: "#e5544c",
    wall: "#fbfbf7", roof1: "#e5544c", roof2: "#3f88d8", roof3: "#f6c945", homeRoof: "#e5544c", trunk: "#8f7a66", leaf: "#7fc184", leaf2: "#5fae86",
    bus: "#f6c945", busEar: "#3f88d8", glass: "#2c4152", ink: "#26384a", honey: "#eaa73a",
    light: "#ffe8c8", hemiSky: "#f2f7f8", hemiGround: "#a9c7ae",
    tin: "#22b86c", tout: "#2d79de", tjar: "#ffbd24", tcheck: "#ff7d35", tbase: "#e9473f", tempty: "#f3f6f4", ped: "#f8fbfc", lane: "#fbfcfb",
  },
};

export const BOARD_PROP_PALETTE: JourneyPropPalette = {
  coin: "#ffd158", coinEdge: "#e9a93a", mint: "#8fe0bd", mintEdge: "#3fae84", jarGlass: "#d8f3ff", jarLid: "#8ca8ee", phone: "#7d84e0",
  screen: "#d8ecff", white: "#ffffff", cross: "#f07f97", flame: "#ff9f45", flame2: "#ffd36b", metal: "#a5abc4", disc: "#4b3d5e",
  discLabel: "#86e3b0", umbrella: "#86cdea", bulb: "#fff1a6", pot: "#df8a63", porcelain: "#fffaf3", basket: "#e9b77f", leafy: "#7ccf6f",
  tan: "#95582c", furWhite: "#e2d6c0", nose: "#ad5249", earIn: "#b6796c", eye: "#3a3610", tooth: "#ffffff", snowflake: "#7fb3f0",
};

/** Newfoundland's painted clapboard boards (the prototype's `clapTex` colours), left to right. */
export const CLAPBOARD_BOARDS = ["#d2402e", "#f0b43c", "#2f7fb8", "#3e9a5e", "#e86a8e", "#f6efe0"] as const;

export function boardPalette(theme: ThemeId): JourneyClayPalette {
  return BOARD_CLAY_PALETTES[theme] ?? BOARD_CLAY_PALETTES.classic;
}

export type PaletteKey = keyof JourneyClayPalette | keyof JourneyPropPalette;
/** A colour by key from the theme palette, falling back to the shared prop palette (the prototype's `P[theme][k] || PROPC[k]`). */
export function colourOf(theme: ThemeId, key: PaletteKey): string {
  const p = boardPalette(theme) as Record<string, string>;
  const v = p[key];
  if (typeof v === "string" && v.startsWith("#")) return v;
  return (BOARD_PROP_PALETTE as Record<string, string>)[key] ?? "#ff00ff";
}
