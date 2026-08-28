import { emitOfficeIntent, type DeskFace } from "../core/officeLayout.ts";
import { useFurniture } from "./useFurniture.ts";

export type DeskSheet = "desks" | "look" | "drawer" | null;

export function Cabinets({
  editing,
  sheet,
  parkedCount,
  face = "paper",
  onToggleEdit,
  onSheet,
  onFace,
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
  const classic = face === "classic";
  return (
    <div ref={ref} className="cabinet-row" aria-label="Desk tools">
      <button
        type="button"
        className={!classic ? "is-on" : ""}
        onClick={() => onFace("paper")}
      >
        Paper office
      </button>
      <button
        type="button"
        className={classic ? "is-on" : ""}
        onClick={() => onFace("classic")}
      >
        Classic desk
      </button>
      <button type="button" className={editing ? "is-on" : ""} onClick={onToggleEdit}>
        {editing ? "Done" : "Edit desk"}
      </button>
      <button type="button" className={sheet === "desks" ? "is-on" : ""} onClick={() => onSheet(sheet === "desks" ? null : "desks")}>
        Desks
      </button>
      <button type="button" className={sheet === "look" ? "is-on" : ""} onClick={() => onSheet(sheet === "look" ? null : "look")}>
        Home theme
      </button>
      <button type="button" className={sheet === "drawer" ? "is-on" : ""} onClick={() => onSheet(sheet === "drawer" ? null : "drawer")}>
        Drawer{parkedCount ? ` · ${parkedCount}` : ""}
      </button>
      {classic && (
        <button type="button" onClick={() => emitOfficeIntent({ type: "tidy" })}>
          Straighten
        </button>
      )}
    </div>
  );
}
