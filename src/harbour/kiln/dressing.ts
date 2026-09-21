import type { ThemeId } from "../../theme/scenes.ts";

/**
 * Kiln dressing — data, not branches (LITTLE_HARBOUR_v2 §2, the Making
 * district).
 *
 * The pottery's own building, authored three times: a brick bottle-kiln shed
 * with terracotta floor and a slate-topped bench; Taylor's album-card pottery,
 * blush brick and bone slipware; a Newfoundland stage-side kiln, ochre brick
 * under a tarred roof. Every value is design data — no hex lives outside this
 * table, and nothing here is a financial fact.
 *
 * `glaze` is the studio's own five-name palette (`core/types.ts`
 * `KittyGlaze`), authored once per theme so a fired piece on the shelf wears
 * the colour its bank wears everywhere else in the app.
 */
export type KilnGlazeTable = { cream: string; "sea-glass": string; terracotta: string; midnight: string; rose: string };

export type KilnDressing = {
  theme: ThemeId;
  /** The shell: the brick walls, the mortar in their courses (a shade off the brick, never a painted stripe), the floor and the roof beams. */
  brick: string;
  mortar: string;
  floor: string;
  beam: string;
  /** The kiln itself: the bottle body, its iron bands, the fire door and the heat inside it. */
  kilnBody: string;
  kilnBand: string;
  kilnDoor: string;
  ember: string;
  emberGlow: string;
  /** The wheel: the stone head, the painted frame, the clay standing on it. */
  wheelHead: string;
  wheelFrame: string;
  clay: string;
  /** The workbench and the glaze jars standing on it. */
  bench: string;
  benchTop: string;
  jar: string;
  /** The shelves the fired pieces stand on, and their brackets. */
  shelf: string;
  bracket: string;
  /** Hercules, asleep where the bricks are warm. */
  cat: string;
  catEar: string;
  /** Brass fittings, engraved plates, plate ink. */
  brass: string;
  plate: string;
  plateHighlight: string;
  ink: string;
  /** The studio's five glazes, in this theme's hand. */
  glaze: KilnGlazeTable;
  light: { hemiSky: string; hemiGround: string; fire: string; fireIntensity: number };
};

export const KILN_DRESSING: Readonly<Record<ThemeId, KilnDressing>> = Object.freeze({
  classic: {
    theme: "classic",
    brick: "#b06a4a", mortar: "#c08a67", floor: "#a8815c", beam: "#6b4e33",
    kilnBody: "#c4795a", kilnBand: "#6f5a42", kilnDoor: "#4a3628", ember: "#ff9a4d", emberGlow: "#ffca7a",
    wheelHead: "#cfc4ad", wheelFrame: "#8a6742", clay: "#c98f66",
    bench: "#8a6742", benchTop: "#6f6558", jar: "#e9ddc2",
    shelf: "#9a7048", bracket: "#6b4e33",
    cat: "#f4ede2", catEar: "#e3b7ab",
    brass: "#b08d57", plate: "#e9ddc2", plateHighlight: "#f6ecd4", ink: "#4b4234",
    glaze: { cream: "#f2e7d0", "sea-glass": "#9fc4bb", terracotta: "#c87a52", midnight: "#41506b", rose: "#e0a5ad" },
    light: { hemiSky: "#e6d9c0", hemiGround: "#5e5140", fire: "#ff9a4d", fireIntensity: 1.5 },
  },
  taylor: {
    theme: "taylor",
    brick: "#c08a86", mortar: "#d3a49f", floor: "#c39a8c", beam: "#8a6255",
    kilnBody: "#cf9891", kilnBand: "#8a6f68", kilnDoor: "#5e4640", ember: "#ff9fb0", emberGlow: "#ffd2dc",
    wheelHead: "#e3d6d2", wheelFrame: "#a97c6c", clay: "#dda995",
    bench: "#a97c6c", benchTop: "#7f6e68", jar: "#fbeee7",
    shelf: "#b58a78", bracket: "#8a6255",
    cat: "#fbf3f1", catEar: "#e8b6be",
    brass: "#c39b6a", plate: "#f3e2da", plateHighlight: "#fbeee7", ink: "#5a4a44",
    glaze: { cream: "#fbeee7", "sea-glass": "#aecbc9", terracotta: "#d9967c", midnight: "#4f5878", rose: "#f0b0bf" },
    light: { hemiSky: "#f2e0e2", hemiGround: "#7d6560", fire: "#ff9fb0", fireIntensity: 1.35 },
  },
  newfoundland: {
    theme: "newfoundland",
    brick: "#9c5540", mortar: "#ad7053", floor: "#8a7052", beam: "#5c3a2c",
    kilnBody: "#a9614a", kilnBand: "#4e463a", kilnDoor: "#3a2f26", ember: "#f2913c", emberGlow: "#f7c56c",
    wheelHead: "#c3bca9", wheelFrame: "#7d6448", clay: "#b08872",
    bench: "#7d6448", benchTop: "#5f5a4e", jar: "#f1ecdd",
    shelf: "#8a6f50", bracket: "#5c3a2c",
    cat: "#f0ece1", catEar: "#c79c92",
    brass: "#a1885e", plate: "#ddd6c2", plateHighlight: "#ece5d2", ink: "#42403a",
    glaze: { cream: "#eee6d2", "sea-glass": "#87a9a5", terracotta: "#b96b46", midnight: "#35455c", rose: "#cf9099" },
    light: { hemiSky: "#d7dee0", hemiGround: "#4c463a", fire: "#f2913c", fireIntensity: 1.6 },
  },
});

export function kilnDressingFrom(theme: unknown): KilnDressing {
  const id = theme === "taylor" || theme === "newfoundland" ? theme : "classic";
  return KILN_DRESSING[id];
}
