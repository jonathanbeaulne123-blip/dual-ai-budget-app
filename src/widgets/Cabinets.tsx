import { type DeskFace } from "../core/officeLayout.ts";
import { useFurniture } from "./useFurniture.ts";

export type DeskSheet = "desks" | "look" | "drawer" | null;

export function Cabinets({
  sheet,
  parkedCount,
  onSheet,
}: {
  editing: boolean;
  sheet: DeskSheet;
  parkedCount: number;
  face?: DeskFace;
  onToggleEdit: () => void;
  onSheet: (next: DeskSheet) => void;
  onFace: (next: DeskFace) => void;
}) {
  const ref = useFurniture("cabinets", "tray", true, false);
  return (
    <div ref={ref} className="cabinet-row" aria-label="Desk tools">
      <button
        type="button"
        className={sheet === "drawer" ? "is-on" : ""}
        onClick={() => onSheet(sheet === "drawer" ? null : "drawer")}
      >
        Drawer{parkedCount ? ` · ${parkedCount}` : ""}
      </button>
    </div>
  );
}
