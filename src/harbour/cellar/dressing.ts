import { resolveThemeScene, type ThemeId } from "../../theme/scenes.ts";

/**
 * Cellar dressing — data, not branches (BUILD_PLAN §6, BUILD_PLAN_SLICE2 §3).
 *
 * The undercroft under the court's terrace, authored three times: a classic
 * sandstone cellar with lime mortar and a brass lamp; Taylor's album-card
 * cellar with washi-taped shelves and a paper lantern; a Newfoundland slate
 * cellar with rope-lashed timber and a storm lantern. Every value is design
 * data — no hex lives outside this table, and nothing here is a financial fact.
 */
export type CellarLight = {
  /** The lamp's own warm bulb, and the cool bounce off the stone. */
  lamp: string;
  lampIntensity: number;
  hemiSky: string;
  hemiGround: string;
  ambient: number;
  fog: { color: string; near: number; far: number };
};

export type CellarDressing = {
  theme: ThemeId;
  /** Walls and floor of the undercroft. */
  stone: string;
  stoneAlt: string;
  mortar: string;
  floor: string;
  /** The vault: its ribs, its plaster webbing, and the court's flagstones seen from below. */
  vault: string;
  vaultRib: string;
  flagstoneUnderside: string;
  /** The rail along the back wall, and the shelf the jars stand on. */
  railTimber: string;
  railShelf: string;
  /** Brass: the lamp's cage, the rail's end-plates, the date plate's frame. */
  brass: string;
  /** The stair up to the court. */
  stairStone: string;
  stairRail: string;
  /** Prepare's water behind the rail, its dark stain line and the wall's old mark. */
  water: string;
  waterDeep: string;
  stain: string;
  /** Jar glass: the clear body, the frosted (planned) tint, and the crack's ink. */
  glass: string;
  glassFrost: string;
  crack: string;
  /** Cut-paper / porcelain jar body when a bill has no umbrella. */
  porcelain: string;
  /** Engraved plates: face stone, its highlight, and the letter ink. */
  plate: string;
  plateHighlight: string;
  ink: string;
  /** How the shelf is trimmed, one word per theme, for the twins' words. */
  shelfTrim: "brass-pins" | "washi-tape" | "rope-lashing";
};

const homePalette = (theme: ThemeId) => resolveThemeScene(theme, "home", "household").palette;

const classic = homePalette("classic");
const taylor = homePalette("taylor");
const newfoundland = homePalette("newfoundland");

export const CELLAR_DRESSING: Record<ThemeId, CellarDressing> = {
  classic: {
    theme: "classic",
    stone: "#9a8a70", stoneAlt: "#8b7c64", mortar: "#c3b596", floor: "#7f725d",
    vault: "#a3937a", vaultRib: "#8a7a62", flagstoneUnderside: "#b9a27c",
    railTimber: "#6b4a32", railShelf: "#7d5a3e", brass: "#caa252",
    stairStone: "#a8916c", stairRail: "#6b4a32",
    water: "#4f7f86", waterDeep: "#2e5158", stain: "#5d4c38",
    glass: "#cfe0e2", glassFrost: "#e6eeef", crack: "#4a3b2c",
    porcelain: "#f4efe6",
    plate: "#d9c8a6", plateHighlight: "#efe3c9", ink: classic.ink,
    shelfTrim: "brass-pins",
  },
  taylor: {
    theme: "taylor",
    stone: "#cdb6b9", stoneAlt: "#c0a7ac", mortar: "#eddfe2", floor: "#b59ba2",
    vault: "#d8c3c6", vaultRib: "#b08a92", flagstoneUnderside: "#e2ccc8",
    railTimber: "#b08a92", railShelf: "#e4d3cf", brass: "#d9b26a",
    stairStone: "#77629b", stairRail: "#b08a92",
    water: "#7fa8c4", waterDeep: "#4f7394", stain: "#8a6a78",
    glass: "#e7edf2", glassFrost: "#f6f1f3", crack: "#6d4a58",
    porcelain: "#f8f2ee",
    plate: "#f7ebe8", plateHighlight: "#fffaf8", ink: taylor.ink,
    shelfTrim: "washi-tape",
  },
  newfoundland: {
    theme: "newfoundland",
    stone: "#5f6d73", stoneAlt: "#556268", mortar: "#9aa6a9", floor: "#4c585d",
    vault: "#6a777d", vaultRib: "#6d4b36", flagstoneUnderside: "#7d8d93",
    railTimber: "#6d4b36", railShelf: "#7d5c44", brass: "#c9ae5a",
    stairStone: "#6f7d83", stairRail: "#b75a4e",
    water: "#3f7f91", waterDeep: "#255460", stain: "#3a4a4f",
    glass: "#d7e3e6", glassFrost: "#eaf1f2", crack: "#2c3a3f",
    porcelain: "#f3f1ea",
    plate: "#d3dcde", plateHighlight: "#eef3f4", ink: newfoundland.ink,
    shelfTrim: "rope-lashing",
  },
};

/** One lamp per theme: the only light source the undercroft has of its own. */
export const CELLAR_LIGHT: Record<ThemeId, CellarLight> = {
  classic: { lamp: "#ffcf8e", lampIntensity: 2.4, hemiSky: "#c9bca2", hemiGround: "#4a3f30", ambient: 0.32, fog: { color: "#3d3527", near: 6, far: 26 } },
  taylor: { lamp: "#ffd9e4", lampIntensity: 2.2, hemiSky: "#e6d3d8", hemiGround: "#6d5560", ambient: 0.36, fog: { color: "#4a3a41", near: 6, far: 24 } },
  newfoundland: { lamp: "#ffe6b8", lampIntensity: 2.6, hemiSky: "#b9c6ca", hemiGround: "#2f3d42", ambient: 0.3, fog: { color: "#2a3438", near: 6, far: 26 } },
};

export const CELLAR_THEMES: readonly ThemeId[] = ["classic", "taylor", "newfoundland"];

/** Accepts a dressing object, a theme id, or anything else (→ classic). */
export function cellarDressingFrom(value: unknown): CellarDressing {
  if (typeof value === "string" && value in CELLAR_DRESSING) return CELLAR_DRESSING[value as ThemeId];
  if (value && typeof value === "object") {
    const row = value as Partial<CellarDressing>;
    if (typeof row.theme === "string" && row.theme in CELLAR_DRESSING && typeof row.stone === "string" && typeof row.ink === "string") return row as CellarDressing;
    if (typeof row.theme === "string" && row.theme in CELLAR_DRESSING) return CELLAR_DRESSING[row.theme];
  }
  return CELLAR_DRESSING.classic;
}

/** The lamp for a dressing's theme. */
export const cellarLightFor = (dressing: Pick<CellarDressing, "theme">): CellarLight => CELLAR_LIGHT[dressing.theme];

/** The shelf trim in plain words, for the rail's twin. */
export const shelfTrimWords = (trim: CellarDressing["shelfTrim"]): string =>
  trim === "washi-tape" ? "taped with washi" : trim === "rope-lashing" ? "lashed with rope" : "pinned with brass";
