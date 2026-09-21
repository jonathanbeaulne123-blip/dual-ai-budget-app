import type { ThemeId } from "../../theme/scenes.ts";

/**
 * Boathouse dressing — data, not branches (LITTLE_HARBOUR_v2 §5).
 *
 * The small building on the shore where Together lives, authored three
 * times: a classic cedar boat-shed with paper lanterns; Taylor's album-card
 * boathouse, blush boards and rose lanterns; a Newfoundland fishing stage,
 * ochre boards over dark water. Every value is design data — no hex lives
 * outside this table, and nothing here is a financial fact.
 */
export type BoathouseDressing = {
  theme: ThemeId;
  /** The plank walls, the darker frame, the floor deck. */
  plank: string;
  frame: string;
  deck: string;
  /** The slip's water inside, and its glint. */
  water: string;
  waterDeep: string;
  /** The rowboat: hull and its trim. */
  hull: string;
  hullTrim: string;
  /** The sail-screen on the back wall, and the projector's beam. */
  sail: string;
  beam: string;
  /** Lanterns for wishes: paper and glow. */
  lantern: string;
  lanternGlow: string;
  /** The workbench, the writing desk, the memory shelf. */
  bench: string;
  desk: string;
  shelf: string;
  /** Clay on the bench, paper on the desk, frames on the shelf. */
  clay: string;
  paper: string;
  frameWood: string;
  /** Brass fittings, engraved plates, letter ink. */
  brass: string;
  plate: string;
  plateHighlight: string;
  ink: string;
  light: { hemiSky: string; hemiGround: string; lantern: string; lanternIntensity: number };
};

export const BOATHOUSE_DRESSING: Readonly<Record<ThemeId, BoathouseDressing>> = Object.freeze({
  classic: {
    theme: "classic",
    plank: "#8f6f4c", frame: "#6b4e33", deck: "#a9825c",
    water: "#5d8a8f", waterDeep: "#3e6468",
    hull: "#b0745a", hullTrim: "#f2ede1",
    sail: "#f4ecd8", beam: "#fff3d0",
    lantern: "#f7ead0", lanternGlow: "#ffd98e",
    bench: "#9a7048", desk: "#82613c", shelf: "#a87c50",
    clay: "#c07a52", paper: "#f6eeda", frameWood: "#7c5936",
    brass: "#b08d57", plate: "#e9ddc2", plateHighlight: "#f6ecd4", ink: "#4b4234",
    light: { hemiSky: "#e2d9c2", hemiGround: "#5c5240", lantern: "#ffd98e", lanternIntensity: 1.2 },
  },
  taylor: {
    theme: "taylor",
    plank: "#b08a80", frame: "#8a6255", deck: "#c09884",
    water: "#7d9aa4", waterDeep: "#5a7680",
    hull: "#c58a92", hullTrim: "#fbf3f1",
    sail: "#fdf3ec", beam: "#ffe9df",
    lantern: "#fbeee7", lanternGlow: "#ffc9d6",
    bench: "#a97c6c", desk: "#96685a", shelf: "#b58a78",
    clay: "#d9a08e", paper: "#fdf3ec", frameWood: "#8a6255",
    brass: "#c39b6a", plate: "#f3e2da", plateHighlight: "#fbeee7", ink: "#5a4a44",
    light: { hemiSky: "#f0dee2", hemiGround: "#7c6560", lantern: "#ffc9d6", lanternIntensity: 1.1 },
  },
  newfoundland: {
    theme: "newfoundland",
    plank: "#a3543e", frame: "#5c3a2c", deck: "#8a7052",
    water: "#3f6068", waterDeep: "#2a444c",
    hull: "#488c98", hullTrim: "#e7eaea",
    sail: "#ece5d2", beam: "#f4ecd0",
    lantern: "#f1ecdd", lanternGlow: "#f0c060",
    bench: "#7d6448", desk: "#6b5540", shelf: "#8a6f50",
    clay: "#9c8f80", paper: "#f1ecdd", frameWood: "#63503a",
    brass: "#a1885e", plate: "#ddd6c2", plateHighlight: "#ece5d2", ink: "#42403a",
    light: { hemiSky: "#d5dee0", hemiGround: "#4c463a", lantern: "#f0c060", lanternIntensity: 1.25 },
  },
});

export function boathouseDressingFrom(theme: unknown): BoathouseDressing {
  const id = theme === "taylor" || theme === "newfoundland" ? theme : "classic";
  return BOATHOUSE_DRESSING[id];
}
