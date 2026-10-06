/**
 * Clay palettes (Horizon Clock, L2): the approved prototype's three theme palettes (`horizon-clock.html` `P`) and its
 * shared prop colours (`PROPC`), keyed exactly as the contracts' `JourneyClayPalette` / `JourneyPropPalette`. The land
 * and the board both read these; every key is authored for every theme (test/journey-land.test.ts).
 *
 * Classic Hearth: warm clay, cream roads, terracotta roofs. Taylor's Scrapbook: blush plinth, rose and lavender roofs.
 * Newfoundland: fog-grey clapboard plinth (`plinthFinish: "clapboard"`, painted boards), jellybean roofs.
 * Tile colours carry meaning only together with words and the "!" / "›" marks — never colour alone.
 */
import type { JourneyClayPalette, JourneyClayPalettes, JourneyPropPalette, ThemeId } from "../contracts.ts";

export const JOURNEY_CLAY_PALETTES: JourneyClayPalettes = {
  taylor: {
    plinth: "#eab3a3", plinth2: "#d99a8c", plinthFinish: "plain",
    sand: "#f8e4c0", grass: "#b4dd8e", grass2: "#9fd283", hill: "#a9d58a", rock: "#cbbfe3", snow: "#fffaf8", water: "#93d7df", shallow: "#cdf3ef",
    road: "#fff7f0", roadPast: "#ead9d3", roadFuture: "#ffffff", stud: "#f4c6d3", gate: "#de5577",
    wall: "#fff4e9", roof1: "#ee7fa2", roof2: "#ab9cec", roof3: "#ffd27a", homeRoof: "#de5577", trunk: "#b9866d", leaf: "#93d27c", leaf2: "#7fc7a6",
    bus: "#ffcb66", busEar: "#ff92b2", glass: "#5b6fa8", ink: "#5b3c4d", honey: "#f2ad35",
    light: "#ffe2c4", hemiSky: "#fff3f0", hemiGround: "#b9d9b0",
    tin: "#2fc983", tout: "#3f9bff", tjar: "#ffb81f", tcheck: "#ff8a3d", tbase: "#ff5fa2", tempty: "#fff4ec", ped: "#fff6fa", lane: "#fffaf4",
  },
  classic: {
    plinth: "#d9a679", plinth2: "#c38e62", plinthFinish: "plain",
    sand: "#f7e3b1", grass: "#a7d57b", grass2: "#93c96b", hill: "#9fcf74", rock: "#cfc0a6", snow: "#fffbf2", water: "#88d0cf", shallow: "#d2f2e6",
    road: "#fff6df", roadPast: "#e8dcc0", roadFuture: "#ffffff", stud: "#f1d9a0", gate: "#c9502e",
    wall: "#fff5e2", roof1: "#e2643f", roof2: "#5f97cc", roof3: "#f5c24f", homeRoof: "#d4532f", trunk: "#a9774f", leaf: "#8fcd68", leaf2: "#6fbf8a",
    bus: "#f7c846", busEar: "#e2643f", glass: "#3f5a7a", ink: "#4a3a2a", honey: "#eea52f",
    light: "#ffe1b5", hemiSky: "#fff7e6", hemiGround: "#b7d6a1",
    tin: "#34bd73", tout: "#3c86f5", tjar: "#ffad1f", tcheck: "#ff7a2f", tbase: "#ff8a2b", tempty: "#fff6e4", ped: "#fffaf0", lane: "#fff8ea",
  },
  newfoundland: {
    plinth: "#a2adb3", plinth2: "#8a979e", plinthFinish: "clapboard",
    sand: "#ece4cc", grass: "#9dcc93", grass2: "#88bf80", hill: "#92c48a", rock: "#c3c8c6", snow: "#ffffff", water: "#86bccd", shallow: "#d3e9ee",
    road: "#f6f8f5", roadPast: "#dde2de", roadFuture: "#ffffff", stud: "#c9d6dc", gate: "#e5544c",
    wall: "#fbfbf7", roof1: "#e5544c", roof2: "#3f88d8", roof3: "#f6c945", homeRoof: "#e5544c", trunk: "#8f7a66", leaf: "#7fc184", leaf2: "#5fae86",
    bus: "#f6c945", busEar: "#3f88d8", glass: "#2c4152", ink: "#26384a", honey: "#eaa73a",
    light: "#ffe8c8", hemiSky: "#f2f7f8", hemiGround: "#a9c7ae",
    tin: "#22b86c", tout: "#2d79de", tjar: "#ffbd24", tcheck: "#ff7d35", tbase: "#e9473f", tempty: "#f3f6f4", ped: "#f8fbfc", lane: "#fbfcfb",
  },
};

/** The prototype's PROPC: coins, mint income coins and the props' materials (the same in every theme). */
export const JOURNEY_PROP_PALETTE: JourneyPropPalette = {
  coin: "#ffd158", coinEdge: "#e9a93a", mint: "#8fe0bd", mintEdge: "#3fae84", jarGlass: "#d8f3ff", jarLid: "#8ca8ee", phone: "#7d84e0", screen: "#d8ecff",
  white: "#ffffff", cross: "#f07f97", flame: "#ff9f45", flame2: "#ffd36b", metal: "#a5abc4", disc: "#4b3d5e", discLabel: "#86e3b0", umbrella: "#86cdea",
  bulb: "#fff1a6", pot: "#df8a63", porcelain: "#fffaf3", basket: "#e9b77f", leafy: "#7ccf6f", tan: "#95582c", furWhite: "#e2d6c0", nose: "#ad5249",
  earIn: "#b6796c", eye: "#3a3610", tooth: "#ffffff", snowflake: "#7fb3f0",
};

/**
 * Newfoundland's clapboard plinth: the prototype's painted boards (jellybean colours with a white edge, horizontal
 * lap shadows) as a texture recipe, so any canvas (the board's plinth, a DOM swatch) paints the same boards.
 */
export const CLAPBOARD = {
  boards: 48,
  colours: ["#d2402e", "#f0b43c", "#2f7fb8", "#3e9a5e", "#e86a8e", "#f6efe0"],
  edge: "rgba(255,255,255,.85)", lapShadow: "rgba(0,0,0,.14)", lapLight: "rgba(255,255,255,.18)",
  width: 1024, height: 64, lapEvery: 9,
} as const;

/** The colour keys of a clay palette (everything but `plinthFinish`). */
export const CLAY_COLOUR_KEYS = (Object.keys(JOURNEY_CLAY_PALETTES.classic) as (keyof JourneyClayPalette)[]).filter(
  (k): k is Exclude<keyof JourneyClayPalette, "plinthFinish"> => k !== "plinthFinish",
);
export const PROP_COLOUR_KEYS = Object.keys(JOURNEY_PROP_PALETTE) as (keyof JourneyPropPalette)[];

export function clayPalette(theme: ThemeId): JourneyClayPalette {
  return JOURNEY_CLAY_PALETTES[theme] ?? JOURNEY_CLAY_PALETTES.classic;
}

/** Mix two "#rrggbb" colours (t = 0 → a, 1 → b), as "#rrggbb". Pure (no three), shared by the clay and the SVG twin. */
export function mixHex(a: string, b: string, t: number): string {
  const p = (h: string) => { const n = parseInt(h.replace("#", ""), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const; };
  const x = p(a), y = p(b), k = Math.min(1, Math.max(0, t));
  return `#${x.map((v, i) => Math.round(v + (y[i]! - v) * k).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Derived clay colours (never new meaning, only softer shades of the palette): the main roads' soft grey (the
 * palette's road clay toward its ink), minor roads a whisper lighter, and the plank decks under the spans.
 */
export function clayDerived(p: JourneyClayPalette) {
  return {
    road: mixHex(p.road, p.ink, 0.38),
    minorRoad: mixHex(p.road, p.ink, 0.24),
    deck: mixHex(p.roadPast, p.ink, 0.18),
    deckEdge: mixHex(p.roadPast, p.ink, 0.45),
  } as const;
}
