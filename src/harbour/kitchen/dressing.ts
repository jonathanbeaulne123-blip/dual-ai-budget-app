import type { ThemeId } from "../../theme/scenes.ts";

/**
 * Kitchen dressing — data, not branches (LITTLE_HARBOUR_v2 §4).
 *
 * The warm room where a plan is made, authored three times: a classic
 * farmhouse kitchen in cream plaster and old pine; Taylor's album-card
 * kitchen, blush walls and rose crockery; a Newfoundland galley, painted
 * boards and a black stove. Every value is design data — no hex lives
 * outside this table, and nothing here is a financial fact.
 */
export type KitchenDressing = {
  theme: ThemeId;
  /** Walls, the timber frame in them, and the floor boards. */
  plaster: string;
  frame: string;
  floor: string;
  floorAlt: string;
  /** The table, its drawer, and the chairs. */
  table: string;
  tableLeg: string;
  drawer: string;
  chair: string;
  /** The hearth: stone, the stove, the kettle, the fire's glow. */
  hearthStone: string;
  stove: string;
  kettle: string;
  fire: string;
  /** The window frame and the day through it. */
  window: string;
  day: string;
  /** Paper: the cards, their rule lines, their ink; the folio's cover. */
  card: string;
  cardRule: string;
  ink: string;
  folio: string;
  /** The pots' wax seals: Everyday, Prepare, Protect, Build. */
  sealEveryday: string;
  sealPrepare: string;
  sealProtect: string;
  sealBuild: string;
  /** Hercules across the table. */
  cat: string;
  catEar: string;
  /** Brass fittings, and the engraved plates. */
  brass: string;
  plate: string;
  plateHighlight: string;
  light: { hemiSky: string; hemiGround: string; fire: string; fireIntensity: number };
};

export const KITCHEN_DRESSING: Readonly<Record<ThemeId, KitchenDressing>> = Object.freeze({
  classic: {
    theme: "classic",
    plaster: "#efe5cf", frame: "#7a5c3d", floor: "#a9825c", floorAlt: "#9a7550",
    table: "#8f6a44", tableLeg: "#75552f", drawer: "#7c5a34", chair: "#82613c",
    hearthStone: "#a89684", stove: "#4a423a", kettle: "#b08d57", fire: "#e8963f",
    window: "#f2ead8", day: "#dfe8da",
    card: "#f9f2df", cardRule: "#c9b998", ink: "#4b4234", folio: "#5d4a63",
    sealEveryday: "#c9a227", sealPrepare: "#3f7d84", sealProtect: "#2c6a4e", sealBuild: "#b4642e",
    cat: "#8d7d6d", catEar: "#6f6152",
    brass: "#b08d57", plate: "#e9ddc2", plateHighlight: "#f6ecd4",
    light: { hemiSky: "#efe3cc", hemiGround: "#7c6a50", fire: "#ffb15e", fireIntensity: 1.7 },
  },
  taylor: {
    theme: "taylor",
    plaster: "#f7e9e6", frame: "#9a7268", floor: "#c09884", floorAlt: "#b28a76",
    table: "#a97c6c", tableLeg: "#8a6255", drawer: "#96685a", chair: "#a1786a",
    hearthStone: "#c4aca4", stove: "#5c4a4e", kettle: "#c39b6a", fire: "#f0975c",
    window: "#fbf1ee", day: "#f0dee2",
    card: "#fdf5ea", cardRule: "#d9c2b4", ink: "#5a4a44", folio: "#7a5570",
    sealEveryday: "#d9a441", sealPrepare: "#5c8f96", sealProtect: "#3f6b52", sealBuild: "#c06f3c",
    cat: "#a08a80", catEar: "#82695f",
    brass: "#c39b6a", plate: "#f3e2da", plateHighlight: "#fbeee7",
    light: { hemiSky: "#f5e3de", hemiGround: "#8f7770", fire: "#ffc08a", fireIntensity: 1.55 },
  },
  newfoundland: {
    theme: "newfoundland",
    plaster: "#e5e0d2", frame: "#5c4f40", floor: "#8a7052", floorAlt: "#7c6448",
    table: "#7d6448", tableLeg: "#63503a", drawer: "#6b5540", chair: "#715a42",
    hearthStone: "#8f867a", stove: "#33302c", kettle: "#a1885e", fire: "#e08b3a",
    window: "#ecf0ee", day: "#d5dee0",
    card: "#f3ecda", cardRule: "#bcae90", ink: "#42403a", folio: "#4a5568",
    sealEveryday: "#c8973a", sealPrepare: "#3a7078", sealProtect: "#2c5b46", sealBuild: "#a25f31",
    cat: "#7c7060", catEar: "#5f5546",
    brass: "#a1885e", plate: "#ddd6c2", plateHighlight: "#ece5d2",
    light: { hemiSky: "#e7e0cd", hemiGround: "#6a5f4c", fire: "#f0a050", fireIntensity: 1.6 },
  },
});

export function kitchenDressingFrom(theme: unknown): KitchenDressing {
  const id = theme === "taylor" || theme === "newfoundland" ? theme : "classic";
  return KITCHEN_DRESSING[id];
}
