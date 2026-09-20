import { resolveThemeScene, type ThemeId } from "../../theme/scenes.ts";
import { COURT_DRESSING } from "../court/dressing.ts";

/**
 * The Rook's Tower — dressing. Data, not branches, exactly as
 * `court/dressing.ts`: every value is design data and nothing here is ever a
 * financial fact. The tower stands on the court's island, so it borrows the
 * court's light, plate and ink so the two places read as one world, and adds
 * only what a tower has: its stone, its timber floors, the brass of the rack,
 * the lamp on the landing, the light through the window, the roof, and the
 * rope that runs up the stair.
 *
 * Three themes, authored: classic timber-and-brass; taylor album-and-washi
 * (paper-covered floors, a ribbon for the rope); newfoundland clapboard with
 * rope and a lantern.
 */
export type TowerRoof = {
  /** Shingle/slate/canvas field and the trim at its eave. */
  shell: string;
  trim: string;
  /** The underside you see while the roof hangs lifted overhead. */
  under: string;
};

export type TowerDressing = {
  theme: ThemeId;
  /** The round wall, inside and out, and the mortar course at each floor. */
  stone: string;
  stoneAlt: string;
  mortar: string;
  /** Timber floors, their boards and the beams under them. */
  timber: string;
  floorboard: string;
  beam: string;
  /** The rack's metal: end-plates, pins, the gun's barrel, the jug's band. */
  brass: string;
  /** The lamp body on the landing and the warm pool it throws. */
  lamp: string;
  lampGlow: string;
  /** Daylight through the window, and the frame around it. */
  windowLight: string;
  windowFrame: string;
  roof: string;
  roofTrim: string;
  roofUnder: string;
  /** The rope that follows the stair up the wall (a ribbon in the album theme). */
  rope: string;
  /** The jug's glaze and the stand it rests on. */
  jug: string;
  stand: string;
  /** Plate stone, its highlight and the ink cut into it — the court's, so the words match. */
  plate: string;
  plateHighlight: string;
  ink: string;
  /** The paper tag on an empty shelf, and its ink. */
  paper: string;
  paperInk: string;
  /** Sculpture furniture: the wood a bank stands on and the brass of its collar. */
  wood: string;
};

const palette = (theme: ThemeId) => resolveThemeScene(theme, "home", "household").palette;

const classic = palette("classic");
const taylor = palette("taylor");
const newfoundland = palette("newfoundland");

export const TOWER_DRESSING: Record<ThemeId, TowerDressing> = {
  classic: {
    theme: "classic",
    stone: "#bfae8d", stoneAlt: "#ab997a", mortar: "#8f7d60",
    timber: "#6b4a32", floorboard: "#7d5a3d", beam: "#5a3d29",
    brass: "#caa252",
    lamp: "#caa252", lampGlow: "#ffd9a0",
    windowLight: "#fff0cf", windowFrame: "#6b4a32",
    roof: "#7a5137", roofTrim: "#caa252", roofUnder: "#8a6544",
    rope: "#c2a97e",
    jug: "#cfd8cf", stand: "#6b4a32",
    plate: COURT_DRESSING.classic.plate, plateHighlight: COURT_DRESSING.classic.plateHighlight, ink: classic.ink,
    paper: classic.card, paperInk: classic.ink,
    wood: "#62412b",
  },
  taylor: {
    theme: "taylor",
    stone: "#e6d4d0", stoneAlt: "#dcc4c1", mortar: "#d9b8c4",
    timber: "#b08a92", floorboard: "#f1e2e6", beam: "#9c7580",
    brass: "#d9b26a",
    lamp: "#d9b26a", lampGlow: "#ffe2ec",
    windowLight: "#fff4f7", windowFrame: "#b08a92",
    roof: "#77629b", roofTrim: "#d9b26a", roofUnder: "#8d78ae",
    rope: "#a63968",
    jug: "#f6ecef", stand: "#b08a92",
    plate: COURT_DRESSING.taylor.plate, plateHighlight: COURT_DRESSING.taylor.plateHighlight, ink: taylor.ink,
    paper: taylor.card, paperInk: taylor.ink,
    wood: "#8f6f78",
  },
  newfoundland: {
    theme: "newfoundland",
    stone: "#8a979c", stoneAlt: "#7d8d93", mortar: "#c9b48c",
    timber: "#6d4b36", floorboard: "#e7e0cf", beam: "#5a3d2b",
    brass: "#d9b45b",
    lamp: "#d9b45b", lampGlow: "#ffe6b8",
    windowLight: "#eaf4f6", windowFrame: "#b75a4e",
    roof: "#4a5a60", roofTrim: "#c9ae5a", roofUnder: "#5f7077",
    rope: "#c9b48c",
    jug: "#dce9ea", stand: "#6d4b36",
    plate: COURT_DRESSING.newfoundland.plate, plateHighlight: COURT_DRESSING.newfoundland.plateHighlight, ink: newfoundland.ink,
    paper: newfoundland.card, paperInk: newfoundland.ink,
    wood: "#5d4130",
  },
};

export const TOWER_THEMES: readonly ThemeId[] = ["classic", "taylor", "newfoundland"];

/** Accepts a tower dressing, a court dressing, a theme id, or anything else (→ classic). */
export function towerDressingFrom(value: unknown): TowerDressing {
  if (typeof value === "string" && value in TOWER_DRESSING) return TOWER_DRESSING[value as ThemeId];
  if (value && typeof value === "object") {
    const row = value as Partial<TowerDressing>;
    if (typeof row.theme === "string" && row.theme in TOWER_DRESSING) {
      if (typeof row.floorboard === "string" && typeof row.rope === "string") return row as TowerDressing;
      return TOWER_DRESSING[row.theme];
    }
  }
  return TOWER_DRESSING.classic;
}
