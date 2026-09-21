import type { ThemeId } from "../../theme/scenes.ts";

/**
 * Hercules's Cottage dressing — data, not branches (LITTLE_HARBOUR_v2 §2,
 * "Making").
 *
 * The one small crooked house on the lawn that is his and not ours, authored
 * three times: a classic wainscot-and-brass dressing room; Taylor's album-card
 * attic, blush boards and washi tape; a Newfoundland jellybean cottage with a
 * salt-bleached rail and a porthole of a window. Every value is design data —
 * no hex lives outside this table, and nothing here is a financial fact.
 */
export type CottageDressing = {
  theme: ThemeId;
  /** The shell: boards underfoot, plaster above the rail, the wainscot below it, and the rails themselves. */
  floor: string;
  plaster: string;
  wainscot: string;
  rail: string;
  beam: string;
  /** The armoire: its carcase, its doors, and the rail of hangers inside. */
  wardrobe: string;
  wardrobeDoor: string;
  hanger: string;
  /** The cheval glass: its swing frame and the cold pane in it. */
  mirrorFrame: string;
  glass: string;
  /** The cabinet of wonders: its case, its shelves, the glazing, and the small kept things on them. */
  cabinet: string;
  cabinetShelf: string;
  glazing: string;
  curio: string;
  curioSecond: string;
  /** The window seat: the bay's frame, the day beyond it, and the cushion he sleeps on. */
  window: string;
  day: string;
  cushion: string;
  /** Hercules himself: porcelain, his pink, and the ink of his closed eyes. */
  porcelain: string;
  pink: string;
  whisker: string;
  /** The bell by the door, its bracket cord, and the brass everything else is fitted in. */
  bell: string;
  cord: string;
  brass: string;
  /** Plates, and the ink they are cut in. */
  plate: string;
  plateHighlight: string;
  ink: string;
  light: { hemiSky: string; hemiGround: string; lamp: string; lampIntensity: number };
};

export const COTTAGE_DRESSING: Readonly<Record<ThemeId, CottageDressing>> = Object.freeze({
  classic: {
    theme: "classic",
    floor: "#a9825c", plaster: "#e7dcc4", wainscot: "#8f6f4c", rail: "#6b4e33", beam: "#6b4e33",
    wardrobe: "#7c5936", wardrobeDoor: "#8f6f4c", hanger: "#b08d57",
    mirrorFrame: "#8a6844", glass: "#cfd9d4",
    cabinet: "#7c5936", cabinetShelf: "#a87c50", glazing: "#dfe7e3", curio: "#e3c98f", curioSecond: "#b7c2aa",
    window: "#f2ede1", day: "#fdf3d9", cushion: "#b7715e",
    porcelain: "#f6f1e7", pink: "#e7b6b0", whisker: "#4b4234",
    bell: "#b08d57", cord: "#8a6844", brass: "#b08d57",
    plate: "#e9ddc2", plateHighlight: "#f6ecd4", ink: "#4b4234",
    light: { hemiSky: "#e2d9c2", hemiGround: "#5c5240", lamp: "#ffd98e", lampIntensity: 1.15 },
  },
  taylor: {
    theme: "taylor",
    floor: "#c09884", plaster: "#f7e7e4", wainscot: "#b08a80", rail: "#8a6255", beam: "#8a6255",
    wardrobe: "#96685a", wardrobeDoor: "#b08a80", hanger: "#c39b6a",
    mirrorFrame: "#a97c6c", glass: "#e3dee4",
    cabinet: "#96685a", cabinetShelf: "#b58a78", glazing: "#f0e6e6", curio: "#f2d2c4", curioSecond: "#d9b7c6",
    window: "#fdf3ec", day: "#ffeede", cushion: "#c58a92",
    porcelain: "#fbf3f1", pink: "#eec2c6", whisker: "#5a4a44",
    bell: "#c39b6a", cord: "#a97c6c", brass: "#c39b6a",
    plate: "#f3e2da", plateHighlight: "#fbeee7", ink: "#5a4a44",
    light: { hemiSky: "#f0dee2", hemiGround: "#7c6560", lamp: "#ffc9d6", lampIntensity: 1.05 },
  },
  newfoundland: {
    theme: "newfoundland",
    floor: "#8a7052", plaster: "#e3e6e2", wainscot: "#488c98", rail: "#5c3a2c", beam: "#5c3a2c",
    wardrobe: "#63503a", wardrobeDoor: "#a3543e", hanger: "#a1885e",
    mirrorFrame: "#7d6448", glass: "#c3d2d4",
    cabinet: "#63503a", cabinetShelf: "#8a6f50", glazing: "#dde6e6", curio: "#c9ae5a", curioSecond: "#608778",
    window: "#ece5d2", day: "#f4ecd0", cushion: "#b75a4e",
    porcelain: "#f1ecdd", pink: "#dfb0a6", whisker: "#42403a",
    bell: "#a1885e", cord: "#7d6448", brass: "#a1885e",
    plate: "#ddd6c2", plateHighlight: "#ece5d2", ink: "#42403a",
    light: { hemiSky: "#d5dee0", hemiGround: "#4c463a", lamp: "#f0c060", lampIntensity: 1.2 },
  },
});

export function cottageDressingFrom(theme: unknown): CottageDressing {
  const id = theme === "taylor" || theme === "newfoundland" ? theme : "classic";
  return COTTAGE_DRESSING[id];
}
