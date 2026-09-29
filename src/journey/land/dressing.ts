/**
 * Land dressings (T2, legibility pass T7): three authored themes for the calm budgeting map. Quieter than the Horizon
 * world (no strong accents, no spectacle) but LEGIBLE: a clearly darker deep sea, a lighter shallows rim and a sand
 * ring at the shore, three height bands (meadow → upland → high rock) with a baked raking light, rivers a shade
 * deeper than lakes, and roads muted below the board's route. Every contract key is authored for every theme (tests
 * enforce it); the extra keys the land needs beyond the frozen contract live in `JOURNEY_LAND_EXTRAS`.
 *
 * Classic Hearth: warm paper, sage, cream and a terracotta roof on Our home. Taylor's Scrapbook: soft pastel paper,
 * rose roofs, lavender slate. Newfoundland: cool maritime greys and fog blues, the jellybean colours kept to the roofs.
 */
import type { JourneyLandDressing, JourneyLandDressings, LandLineKind, ThemeId } from "../contracts.ts";

export const JOURNEY_LAND_DRESSINGS: JourneyLandDressings = {
  classic: {
    sea: "#6f9ea1", shallows: "#a8cfc5", sand: "#ead9ae", grass: "#abc189", forest: "#8fab74", rock: "#aea38e", snow: "#efe9dc",
    lake: "#79acad", river: "#5f98a3",
    road: "#d6c7a3", skate: "#cbb591", walk: "#d8cbad", cable: "#7a6d60", rail: "#86735b", ferry: "#e3eee9",
    hostWall: "#efe4cf", hostRoof: "#9c6b52", reserve: "#8c7b61", districtLabel: "#4f4536", fog: "#efe7d6", sky: "#ece3d1",
  },
  taylor: {
    sea: "#78aeb3", shallows: "#b8ddd4", sand: "#f0ddb4", grass: "#b3c890", forest: "#98b584", rock: "#b5a6a4", snow: "#f6f0ec",
    lake: "#86bdbf", river: "#6aa9b2",
    road: "#e2cdbd", skate: "#dcbcc3", walk: "#ead8c8", cable: "#86737f", rail: "#9a7d5f", ferry: "#eef7f4",
    hostWall: "#f7ece0", hostRoof: "#b98090", reserve: "#9d7f88", districtLabel: "#5e4450", fog: "#f6e9e0", sky: "#f3e5de",
  },
  newfoundland: {
    sea: "#4f7686", shallows: "#94b4b8", sand: "#d4cbb2", grass: "#94ab86", forest: "#7c9677", rock: "#999a90", snow: "#eceeed",
    lake: "#6e97a3", river: "#57899a",
    road: "#c8cbc2", skate: "#bdb7a2", walk: "#d2d4cd", cable: "#4e5a61", rail: "#6f685e", ferry: "#dfe9eb",
    hostWall: "#dcd8cc", hostRoof: "#56666d", reserve: "#6f7c7f", districtLabel: "#33414a", fog: "#dfe6e5", sky: "#dde5e5",
  },
};

/** Land colours beyond the frozen contract's keys (height bands and the hosts' own materials). */
export type JourneyLandExtras = {
  /** The upper band (≈ 60–105 m): open upland turning to heath. */
  highland: string;
  /** Bare high rock (the Crown and the Shoulder above ≈ 105 m). */
  peak: string;
  /** Settled ground (paved, cobble, plaza, boardwalk aprons): kept calm, a touch warmer than meadow. */
  settled: string;
  /** Wet sand right at the waterline (the inner edge of the shore ring). */
  wetSand: string;
  /** Hosts: each gets a roof/material of its own so it reads by silhouette AND colour. */
  homeRoof: string; homeDoor: string;
  bankWall: string; bankRoof: string;
  libraryWall: string; libraryRoof: string;
  glass: string; glassFrame: string;
  kiln: string; studioRoof: string;
  cottageWall: string; cottageRoof: string;
  timber: string; boathouseRoof: string;
  chimney: string;
};

export const JOURNEY_LAND_EXTRAS: Record<ThemeId, JourneyLandExtras> = {
  classic: {
    highland: "#a3a883", peak: "#b9ae9c", settled: "#cdc39c", wetSand: "#d6c9a0",
    homeRoof: "#b84a32", homeDoor: "#5b3b28",
    bankWall: "#e9e2d2", bankRoof: "#5f6f77",
    libraryWall: "#e7d9bd", libraryRoof: "#6f4f3f",
    glass: "#c3e3dc", glassFrame: "#557a72",
    kiln: "#b8704d", studioRoof: "#8a6a4f",
    cottageWall: "#f3ead6", cottageRoof: "#c9a453",
    timber: "#8a6444", boathouseRoof: "#3f5f68",
    chimney: "#7b5a47",
  },
  taylor: {
    highland: "#b1ac92", peak: "#c6b7b3", settled: "#dcc9b1", wetSand: "#e2cfa9",
    homeRoof: "#c24f73", homeDoor: "#6a3d52",
    bankWall: "#f2eaf0", bankRoof: "#7a6d9b",
    libraryWall: "#f1e2d6", libraryRoof: "#8b5f76",
    glass: "#d2ebe8", glassFrame: "#6c8f8c",
    kiln: "#c7806a", studioRoof: "#9c7484",
    cottageWall: "#fbf3e8", cottageRoof: "#d8b466",
    timber: "#9a7462", boathouseRoof: "#6983a6",
    chimney: "#8c6a70",
  },
  newfoundland: {
    highland: "#8f9a84", peak: "#aaaba3", settled: "#bfbeae", wetSand: "#c2bba3",
    homeRoof: "#c8412b", homeDoor: "#2f3e46",
    bankWall: "#e4e6e2", bankRoof: "#1f5f8b",
    libraryWall: "#e8e4d8", libraryRoof: "#6b5a82",
    glass: "#c6dfe2", glassFrame: "#3f5f68",
    kiln: "#a95f45", studioRoof: "#4f6b58",
    cottageWall: "#f0d9a0", cottageRoof: "#3a4a52",
    timber: "#5e5448", boathouseRoof: "#2e6b52",
    chimney: "#4a4f52",
  },
};

export const LAND_DRESSING_KEYS = Object.keys(JOURNEY_LAND_DRESSINGS.classic) as (keyof JourneyLandDressing)[];
export const LAND_EXTRA_KEYS = Object.keys(JOURNEY_LAND_EXTRAS.classic) as (keyof JourneyLandExtras)[];

export function landDressing(theme: ThemeId): JourneyLandDressing {
  return JOURNEY_LAND_DRESSINGS[theme] ?? JOURNEY_LAND_DRESSINGS.classic;
}

/** The extras for a dressing (matched by identity, so a theme's dressing always gets its own extras). */
export function landExtras(d: JourneyLandDressing): JourneyLandExtras {
  for (const theme of Object.keys(JOURNEY_LAND_DRESSINGS) as ThemeId[]) if (JOURNEY_LAND_DRESSINGS[theme] === d) return JOURNEY_LAND_EXTRAS[theme];
  return JOURNEY_LAND_EXTRAS.classic;
}

/** "#rrggbb" → [r, g, b] in 0…1, as authored (the land's shader materials write these values straight out). */
export function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** The dressing key each line kind is painted with (rowing shares the ferry's water-route colour: no `row` key). */
export const LINE_DRESSING_KEY: Readonly<Record<LandLineKind, keyof JourneyLandDressing>> = {
  road: "road", skate: "skate", walk: "walk", cable: "cable", rail: "rail", ferry: "ferry", row: "ferry",
};
