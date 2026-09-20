import { resolveThemeScene, type ThemeId } from "../../theme/scenes.ts";

/**
 * Court dressing — data, not branches. Every value is design data, never a
 * financial fact. Colours are hex strings so a Three material can `set()` them
 * and a canvas can fill with them; the ink/plate pair is the engraved-letter
 * contrast the tests fence at 4.5:1.
 */
export type CourtLight = {
  sun: string;
  hemiSky: string;
  hemiGround: string;
  sunIntensity: number;
  fog: { color: string; near: number; far: number };
};

export type CourtProp =
  | "terracotta-pot" | "herb-pot" | "brass-lantern" | "clay-urn"
  | "washi-lantern" | "album-planter" | "paper-rose" | "heart-pot"
  | "wharf-barrel" | "buoy" | "rope-coil" | "lobster-pot" | "clapboard-planter";

export type CourtDressing = {
  theme: ThemeId;
  light: CourtLight;
  /** Paving tiles: two checker tones, the joint fill, and the moss that grows in it. */
  stone: string;
  stoneAlt: string;
  joint: string;
  moss: string;
  /** Terrace apron and lawn ring around the board. */
  terrace: string;
  lawn: string;
  /** Plinth block, gate/timber, metal fittings. */
  plinth: string;
  timber: string;
  metal: string;
  gate: { post: string; rail: string; accent: string };
  /** Engraved plates: face stone and letter ink; slip paper and its ink. */
  plate: string;
  plateHighlight: string;
  ink: string;
  paper: string;
  paperInk: string;
  accent: string;
  second: string;
  sea: string;
  sky: string;
  /** Hercules: porcelain body and the pink of his ears. */
  porcelain: string;
  pink: string;
  /** Potted-plant set for the terrace edge, three to five. */
  props: readonly CourtProp[];
  /** Foliage tones for the props. */
  leaf: string;
  bloom: string;
};

const homePalette = (theme: ThemeId) => resolveThemeScene(theme, "home", "household").palette;

const classic = homePalette("classic");
const taylor = homePalette("taylor");
const newfoundland = homePalette("newfoundland");

export const COURT_DRESSING: Record<ThemeId, CourtDressing> = {
  classic: {
    theme: "classic",
    light: { sun: "#ffe6be", hemiSky: "#dbe9f4", hemiGround: "#5c4230", sunIntensity: 2.2, fog: { color: "#e8dcc4", near: 18, far: 60 } },
    stone: "#cbb48f", stoneAlt: "#b9a27c", joint: "#8f7d60", moss: "#6d7f4f",
    terrace: "#b8a380", lawn: "#7d9a58",
    plinth: "#a8916c", timber: "#6b4a32", metal: "#caa252",
    gate: { post: "#6b4a32", rail: "#6b4a32", accent: "#caa252" },
    plate: "#d9c8a6", plateHighlight: "#efe3c9", ink: classic.ink, paper: classic.card, paperInk: classic.ink,
    accent: classic.accent, second: classic.second, sea: "#7fb2b8", sky: "#e8dcc4",
    porcelain: "#f4efe6", pink: "#e8a9a0",
    props: ["terracotta-pot", "herb-pot", "brass-lantern", "clay-urn"],
    leaf: "#4f6b3a", bloom: "#c9563d",
  },
  taylor: {
    theme: "taylor",
    light: { sun: "#ffd9e4", hemiSky: "#f7e7ed", hemiGround: "#7f6070", sunIntensity: 2.0, fog: { color: "#f2e3ea", near: 16, far: 55 } },
    stone: "#ead8d2", stoneAlt: "#dfc7c3", joint: "#d9b8c4", moss: "#9aa77a",
    terrace: "#e2ccc8", lawn: "#9fbf86",
    plinth: "#77629b", timber: "#b08a92", metal: "#d9b26a",
    gate: { post: "#b08a92", rail: "#f7e7ed", accent: "#a63968" },
    plate: "#f7ebe8", plateHighlight: "#fffaf8", ink: taylor.ink, paper: taylor.card, paperInk: taylor.ink,
    accent: taylor.accent, second: taylor.second, sea: "#a9c9dd", sky: "#f2e3ea",
    porcelain: "#f8f2ee", pink: "#eaa6b4",
    props: ["washi-lantern", "album-planter", "paper-rose", "heart-pot"],
    leaf: "#6f8f6a", bloom: "#d76a95",
  },
  newfoundland: {
    theme: "newfoundland",
    light: { sun: "#fff3e0", hemiSky: "#dfe9ec", hemiGround: "#4d7582", sunIntensity: 2.4, fog: { color: "#dfe9ec", near: 18, far: 65 } },
    stone: "#7d8d93", stoneAlt: "#6f7f86", joint: "#c9b48c", moss: "#5f7a4c",
    terrace: "#8a979c", lawn: "#6a8d5a",
    plinth: "#6d4b36", timber: "#6d4b36", metal: "#d9b45b",
    gate: { post: "#b75a4e", rail: "#488c98", accent: "#c9ae5a" },
    plate: "#d3dcde", plateHighlight: "#eef3f4", ink: newfoundland.ink, paper: newfoundland.card, paperInk: newfoundland.ink,
    accent: newfoundland.accent, second: newfoundland.second, sea: "#4f98aa", sky: "#dfe9ec",
    porcelain: "#f3f1ea", pink: "#e39d9a",
    props: ["wharf-barrel", "buoy", "rope-coil", "lobster-pot", "clapboard-planter"],
    leaf: "#4d6b45", bloom: "#c9ae5a",
  },
};

export const COURT_THEMES: readonly ThemeId[] = ["classic", "taylor", "newfoundland"];

/** Accepts a dressing object, a theme id, or anything else (→ classic). */
export function courtDressingFrom(value: unknown): CourtDressing {
  if (typeof value === "string" && value in COURT_DRESSING) return COURT_DRESSING[value as ThemeId];
  if (value && typeof value === "object") {
    const row = value as Partial<CourtDressing>;
    if (typeof row.theme === "string" && row.theme in COURT_DRESSING && typeof row.stone === "string" && typeof row.ink === "string") return row as CourtDressing;
    if (typeof row.theme === "string" && row.theme in COURT_DRESSING) return COURT_DRESSING[row.theme];
  }
  return COURT_DRESSING.classic;
}

/** WCAG 2.x relative luminance of a #rrggbb colour. */
export function relativeLuminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const n = parseInt(m[1]!, 16);
  const channel = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** WCAG contrast ratio between two #rrggbb colours (≥ 1). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a), lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
