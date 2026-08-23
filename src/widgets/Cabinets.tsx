import { emitOfficeIntent } from "../core/officeLayout.ts";
import { useFurniture } from "./useFurniture.ts";

export type DeskSheet = "desks" | "look" | "drawer" | null;

export function Cabinets({
  editing,
  sheet,
  parkedCount,
  onToggleEdit,
  onSheet,
}: {
  editing: boolean;
  sheet: DeskSheet;
  parkedCount: number;
  onToggleEdit: () => void;
  onSheet: (next: DeskSheet) => void;
}) {
  const ref = useFurniture("cabinets", "tray", true, false);
  return (
    <div ref={ref} className="cabinet-row" aria-label="Desk tools">
      <button type="button" className={editing ? "is-on" : ""} onClick={onToggleEdit}>
        {editing ? "Done" : "Edit desk"}
      </button>
      <button type="button" className={sheet === "desks" ? "is-on" : ""} onClick={() => onSheet(sheet === "desks" ? null : "desks")}>
        Desks
      </button>
      <button type="button" className={sheet === "look" ? "is-on" : ""} onClick={() => onSheet(sheet === "look" ? null : "look")}>
        Look
      </button>
      <button type="button" className={sheet === "drawer" ? "is-on" : ""} onClick={() => onSheet(sheet === "drawer" ? null : "drawer")}>
        Drawer{parkedCount ? ` · ${parkedCount}` : ""}
      </button>
      <button type="button" onClick={() => emitOfficeIntent({ type: "tidy" })}>
        Straighten
      </button>
    </div>
  );
}
