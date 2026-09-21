import type { ThemeId } from "../../theme/scenes.ts";

/**
 * Library dressing — data, not branches (LITTLE_HARBOUR_v2 §2, the Study row).
 *
 * One great hall for the Standing Book, authored three times: a classic
 * sandstone hall with oak cases; Taylor's album-card reading room, blush
 * plaster and cream shelves; a Newfoundland lighthouse store, painted boards
 * and sea light. Every value is design data — no hex lives outside this
 * table, and nothing here is a financial fact.
 */
export type LibraryDressing = {
  theme: ThemeId;
  /** Walls, floor, and the tall window's frame and day. */
  wall: string;
  wallCourse: string;
  floor: string;
  window: string;
  day: string;
  /** The cases, their shelves, and the spines of the books in them. */
  case: string;
  caseShelf: string;
  spines: readonly string[];
  /** The lectern and the great book open on it. */
  lectern: string;
  page: string;
  cover: string;
  inkLine: string;
  /** The balcony rail and the account stickies on it. */
  rail: string;
  sticky: string;
  /** The bindery machines' bench, their bodies, their brass. */
  binderyBench: string;
  machine: string;
  brass: string;
  /** Engraved plates and letter ink. */
  plate: string;
  plateHighlight: string;
  ink: string;
  light: { hemiSky: string; hemiGround: string; shaft: string };
};

export const LIBRARY_DRESSING: Readonly<Record<ThemeId, LibraryDressing>> = Object.freeze({
  classic: {
    theme: "classic",
    wall: "#ddceac", wallCourse: "#cbb98f", floor: "#9a7550",
    window: "#f2ead8", day: "#e7ecdc",
    case: "#6f5233", caseShelf: "#82613c",
    spines: ["#8a4b3a", "#2c6a4e", "#3f5d7d", "#c9a227", "#7a4a6b", "#a25f31"],
    lectern: "#7a5c3d", page: "#f9f2df", cover: "#5c3a2c", inkLine: "#c9b998",
    rail: "#75552f", sticky: "#f6e7b2",
    binderyBench: "#8f6a44", machine: "#4a423a", brass: "#b08d57",
    plate: "#e9ddc2", plateHighlight: "#f6ecd4", ink: "#4b4234",
    light: { hemiSky: "#ece1c6", hemiGround: "#77684e", shaft: "#fff3d0" },
  },
  taylor: {
    theme: "taylor",
    wall: "#f2e1de", wallCourse: "#e2cbc8", floor: "#b28a76",
    window: "#fbf1ee", day: "#f3e4e8",
    case: "#8a6255", caseShelf: "#a1786a",
    spines: ["#c05a74", "#3f6b52", "#5c7d9a", "#d9a441", "#8a5a80", "#c06f3c"],
    lectern: "#9a7268", page: "#fdf5ea", cover: "#6b4a55", inkLine: "#d9c2b4",
    rail: "#8a6255", sticky: "#fbe7c9",
    binderyBench: "#a97c6c", machine: "#5c4a4e", brass: "#c39b6a",
    plate: "#f3e2da", plateHighlight: "#fbeee7", ink: "#5a4a44",
    light: { hemiSky: "#f5e6e2", hemiGround: "#8f7770", shaft: "#ffe9df" },
  },
  newfoundland: {
    theme: "newfoundland",
    wall: "#cfd6cd", wallCourse: "#b9c2b8", floor: "#7c6448",
    window: "#ecf0ee", day: "#dde6e4",
    case: "#4a5568", caseShelf: "#5c687d",
    spines: ["#a3543e", "#2c5b46", "#3a5d78", "#c8973a", "#6b4a6b", "#8a6f50"],
    lectern: "#5c4f40", page: "#f3ecda", cover: "#33302c", inkLine: "#bcae90",
    rail: "#63503a", sticky: "#ecdca8",
    binderyBench: "#7d6448", machine: "#33302c", brass: "#a1885e",
    plate: "#ddd6c2", plateHighlight: "#ece5d2", ink: "#42403a",
    light: { hemiSky: "#dbe2dd", hemiGround: "#5f5c4c", shaft: "#f4ecd0" },
  },
});

export function libraryDressingFrom(theme: unknown): LibraryDressing {
  const id = theme === "taylor" || theme === "newfoundland" ? theme : "classic";
  return LIBRARY_DRESSING[id];
}
