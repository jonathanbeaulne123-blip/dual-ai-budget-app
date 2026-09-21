import type { ThemeId } from "../../theme/scenes.ts";

/**
 * Glasshouse dressing — data, not branches (LITTLE_HARBOUR_v2 §3).
 *
 * The garden behind the Library, authored three times: a classic whitewashed
 * glasshouse with terracotta pots on cedar benches; Taylor's album-card
 * conservatory, rose-tinted glass and cream pots; a Newfoundland cold frame,
 * sea-grey ribs and stoneware. Every value is design data — no hex lives
 * outside this table, and nothing here is a financial fact.
 */
export type GlasshouseDressing = {
  theme: ThemeId;
  /** The low brick plinth walls, and the path down the middle. */
  brick: string;
  brickJoint: string;
  path: string;
  gravel: string;
  /** The frame: ribs, the ridge, the glazing bars. */
  rib: string;
  ridge: string;
  /** The glass panes, and the light they let through. */
  glass: string;
  glassLight: string;
  /** The benches, and the harvest shelf on the right wall. */
  bench: string;
  benchLeg: string;
  shelf: string;
  /** Pots: fired clay, its rim, dry earth, watered earth. */
  pot: string;
  potRim: string;
  earth: string;
  earthDry: string;
  /** Plants: stem, leaf, bloom petals and the bloom's heart. */
  stem: string;
  leaf: string;
  petal: string;
  heart: string;
  /** The tags: paper, ink, and the two threads (pine hers, copper yours). */
  paper: string;
  paperInk: string;
  threadPine: string;
  threadCopper: string;
  /** Brass: the watering can, stakes, small fittings. */
  brass: string;
  /** Engraved plates: face, highlight and letter ink. */
  plate: string;
  plateHighlight: string;
  ink: string;
  light: { sun: string; hemiSky: string; hemiGround: string; intensity: number };
};

export const GLASSHOUSE_DRESSING: Readonly<Record<ThemeId, GlasshouseDressing>> = Object.freeze({
  classic: {
    theme: "classic",
    brick: "#b0745a", brickJoint: "#d9c3a8", path: "#cdbb9a", gravel: "#d8cdb4",
    rib: "#f2ede1", ridge: "#e4dccb",
    glass: "#eef4ef", glassLight: "#fff6dd",
    bench: "#9a7048", benchLeg: "#7c5936", shelf: "#a87c50",
    pot: "#c07a52", potRim: "#a9643f", earth: "#584635", earthDry: "#b7a98e",
    stem: "#4f7d4a", leaf: "#5f9457", petal: "#d9a441", heart: "#8a5a2c",
    paper: "#f6eeda", paperInk: "#4b4234", threadPine: "#2e5d43", threadCopper: "#b4642e",
    brass: "#b08d57",
    plate: "#e9ddc2", plateHighlight: "#f6ecd4", ink: "#4b4234",
    light: { sun: "#fff2d4", hemiSky: "#dfe8da", hemiGround: "#8a7a5e", intensity: 1.15 },
  },
  taylor: {
    theme: "taylor",
    brick: "#c58a92", brickJoint: "#ecd7da", path: "#e6d3d2", gravel: "#ecdcd8",
    rib: "#fbf3f1", ridge: "#f1e2e0",
    glass: "#f6ecf0", glassLight: "#ffeef2",
    bench: "#a97c6c", benchLeg: "#8a6255", shelf: "#b58a78",
    pot: "#d9a08e", potRim: "#c08672", earth: "#6b5348", earthDry: "#cbb6a6",
    stem: "#6b8f66", leaf: "#7ba372", petal: "#d97b9a", heart: "#a4506e",
    paper: "#fdf3ec", paperInk: "#5a4a44", threadPine: "#3f6b52", threadCopper: "#c06f3c",
    brass: "#c39b6a",
    plate: "#f3e2da", plateHighlight: "#fbeee7", ink: "#5a4a44",
    light: { sun: "#ffeadd", hemiSky: "#f0dee2", hemiGround: "#9a7f7a", intensity: 1.08 },
  },
  newfoundland: {
    theme: "newfoundland",
    brick: "#7d7268", brickJoint: "#a99e90", path: "#b3aa9a", gravel: "#c2bbac",
    rib: "#e7eaea", ridge: "#d3d9d9",
    glass: "#e8eef0", glassLight: "#f4f8ef",
    bench: "#7d6448", benchLeg: "#63503a", shelf: "#8a6f50",
    pot: "#9c8f80", potRim: "#847768", earth: "#4d4238", earthDry: "#aca08c",
    stem: "#48705a", leaf: "#578468", petal: "#c8973a", heart: "#7c5a2e",
    paper: "#f1ecdd", paperInk: "#42403a", threadPine: "#2c5b46", threadCopper: "#a25f31",
    brass: "#a1885e",
    plate: "#ddd6c2", plateHighlight: "#ece5d2", ink: "#42403a",
    light: { sun: "#f4ecd6", hemiSky: "#d5dee0", hemiGround: "#6f6a58", intensity: 1.05 },
  },
});

/** The place contract hands the scene table a `PlaceDressing`; the glasshouse keeps its own richer table by theme. */
export function glasshouseDressingFrom(theme: unknown): GlasshouseDressing {
  const id = theme === "taylor" || theme === "newfoundland" ? theme : "classic";
  return GLASSHOUSE_DRESSING[id];
}
