import type { ThemeId } from "../../theme/scenes.ts";

/**
 * The Campfire's dressing — data, not branches (LITTLE_HARBOUR_v2 §6).
 *
 * The one place on the island that is only ever warm: a ring of beach stones,
 * two split logs to sit on, a path of laid months running away toward the
 * Boathouse, and the fire itself. Authored three times — a classic driftwood
 * fire on grey shore stone; Taylor's dusk fire, rose smoke over blush sand; a
 * Newfoundland beach fire of kelp-dark rock and cold blue water behind it.
 *
 * Every value is design data. No hex lives outside this table, and not one
 * value here is a financial fact.
 */
export type CampfireDressing = {
  theme: ThemeId;
  /** The shore under the ring, and the sand the path is laid in. */
  shore: string;
  sand: string;
  /** The ring of beach stones, and the ash inside it. */
  stone: string;
  stoneShadow: string;
  ash: string;
  /** The two split logs, their bark, and the driftwood stacked in the fire. */
  log: string;
  bark: string;
  wood: string;
  /** The fire: the low body, the tongue above it, the ember bed, and the light it throws. */
  flame: string;
  flameTip: string;
  ember: string;
  smoke: string;
  /** Unlit kindling: the fire that has never been lit is pale, dry and waiting. */
  kindling: string;
  /** The stones of the path of months: laid, and the fresh one still sealing. */
  laid: string;
  fresh: string;
  /** The two who sit here: the cloth of a figure, and the one whose seat is empty. */
  figure: string;
  figureAway: string;
  /** Hercules, who asks the questions, and his pink. */
  porcelain: string;
  pink: string;
  /** Plates, and the ink they are cut in. */
  plate: string;
  plateHighlight: string;
  ink: string;
  light: { hemiSky: string; hemiGround: string; fire: string; fireIntensity: number };
};

export const CAMPFIRE_DRESSING: Readonly<Record<ThemeId, CampfireDressing>> = Object.freeze({
  classic: {
    theme: "classic",
    shore: "#9c9079", sand: "#c6b696",
    stone: "#8e8d86", stoneShadow: "#5f5f5a", ash: "#6b675e",
    log: "#a17b50", bark: "#6b4e33", wood: "#8a6844",
    flame: "#f2913c", flameTip: "#ffd98e", ember: "#d4562c", smoke: "#ded6c6",
    kindling: "#c7b189",
    laid: "#7f8a86", fresh: "#e8c979",
    figure: "#4f6b62", figureAway: "#8d9a94",
    porcelain: "#f6f1e7", pink: "#e7b6b0",
    plate: "#e9ddc2", plateHighlight: "#f6ecd4", ink: "#4b4234",
    light: { hemiSky: "#3f4a54", hemiGround: "#4a4033", fire: "#ffb469", fireIntensity: 1.35 },
  },
  taylor: {
    theme: "taylor",
    shore: "#b19a92", sand: "#dcc3bb",
    stone: "#9d8d8c", stoneShadow: "#6c5d5e", ash: "#73646a",
    log: "#b08a80", bark: "#8a6255", wood: "#a97c6c",
    flame: "#f4a06a", flameTip: "#ffe2c4", ember: "#d9607a", smoke: "#eddbdc",
    kindling: "#d6b6a8",
    laid: "#94848c", fresh: "#f2cdb6",
    figure: "#7c5a68", figureAway: "#b3a0a6",
    porcelain: "#fbf3f1", pink: "#eec2c6",
    plate: "#f3e2da", plateHighlight: "#fbeee7", ink: "#5a4a44",
    light: { hemiSky: "#4d3f4a", hemiGround: "#57454a", fire: "#ffc9a6", fireIntensity: 1.25 },
  },
  newfoundland: {
    theme: "newfoundland",
    shore: "#86817a", sand: "#b4a88c",
    stone: "#6f7679", stoneShadow: "#474d51", ash: "#5a5a56",
    log: "#8a7052", bark: "#5c3a2c", wood: "#7d6448",
    flame: "#f0a13e", flameTip: "#ffe6a8", ember: "#c9492b", smoke: "#d6dbd8",
    kindling: "#bda878",
    laid: "#5f7278", fresh: "#c9ae5a",
    figure: "#3f6670", figureAway: "#87979c",
    porcelain: "#f1ecdd", pink: "#dfb0a6",
    plate: "#ddd6c2", plateHighlight: "#ece5d2", ink: "#42403a",
    light: { hemiSky: "#37474f", hemiGround: "#3f3a30", fire: "#ffb257", fireIntensity: 1.45 },
  },
});

export function campfireDressingFrom(theme: unknown): CampfireDressing {
  const id = theme === "taylor" || theme === "newfoundland" ? theme : "classic";
  return CAMPFIRE_DRESSING[id];
}
