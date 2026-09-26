import type { LedgerView } from "../core/types.ts";
import type { HouseLevel, HouseRoom } from "../hearthside/houseRoutes.ts";

export type HouseTarget = Readonly<{ id: string; label: string }>;
export type PersonalFolioPage = "wish" | "note" | "memory" | "experience";

const TARGETS: Record<`${HouseRoom}:${HouseLevel}`, readonly HouseTarget[]> = {
  "home:above": [{ id: "loft-banks", label: "Open Kitty Banks" }],
  "home:middle": [{ id: "queen", label: "Open the Fund bank" }, { id: "hercules", label: "Talk with Hercules" }],
  "home:below": [{ id: "cellar-bills", label: "Read the bill jars" }],
  "study:above": [{ id: "planner", label: "Open the Glasshouse steps" }],
  "study:middle": [{ id: "books", label: "Open the Standing Book" }],
  "study:below": [{ id: "calendar", label: "Unfold the Calendar" }],
  "kitchen-table:above": [{ id: "journey", label: "Step into Journey" }],
  "kitchen-table:middle": [{ id: "conversation", label: "Open the conversation folio" }],
  "kitchen-table:below": [{ id: "plan-studio", label: "Open the kitchen table" }],
  "together:above": [{ id: "wishes", label: "Tend a wish" }],
  "together:middle": [{ id: "pottery", label: "Open a bank's studio" }, { id: "letters", label: "Open the writing desk" }],
  "together:below": [{ id: "memories", label: "Open a memory" }, { id: "projector", label: "Choose three memories" }],
  // Making: the Kiln above, Hercules's Cottage on the level, his shelves below.
  "making:above": [{ id: "pottery", label: "Open a bank's studio" }],
  "making:middle": [{ id: "wardrobe", label: "Open the dressing room" }, { id: "hercules", label: "Talk with Hercules" }],
  "making:below": [{ id: "wardrobe", label: "Open the dressing room" }],
};

const personalTargets = (key: `${HouseRoom}:${HouseLevel}`, rows: readonly HouseTarget[]): readonly HouseTarget[] => {
  if (key === "together:above") return [{ id: "wishes", label: "Tend a private wish" }];
  if (key === "together:middle") return [{ id: "pottery", label: "Open a private bank's studio" }, { id: "letters", label: "Write a private note" }];
  if (key === "together:below") return [{ id: "memories", label: "Open a private memory" }];
  return rows;
};

/** Visible direct actions only. Personal scope never offers a shared encounter or projector. */
export function houseTargets(scope: LedgerView, room: HouseRoom, level: HouseLevel): readonly HouseTarget[] {
  const key = `${room}:${level}` as `${HouseRoom}:${HouseLevel}`;
  const rows = TARGETS[key];
  return scope === "personal" ? personalTargets(key, rows) : rows;
}

/** A house object can select a real private folio page; unsupported shared-only surfaces return null. */
export function personalFolioPage(surface: string | undefined): PersonalFolioPage | null {
  if (surface === "personal-experience") return "experience";
  if (surface === "wishes") return "wish";
  if (surface === "letters") return "note";
  if (surface === "memories") return "memory";
  return null;
}

export function personalSurfaceAvailable(surface: string | undefined): boolean {
  return surface !== "encounters" && surface !== "projector";
}
