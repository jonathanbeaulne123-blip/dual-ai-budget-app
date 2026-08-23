import { emitOfficeIntent } from "../core/officeLayout.ts";
import { useFurniture } from "./useFurniture.ts";
import type { HearthTab } from "../core/hercules.ts";

export function Cabinets({
  onGo,
}: {
  onGo: (tab: HearthTab) => void;
}) {
  const ref = useFurniture("cabinets", "tray", true, false);
  return (
    <div ref={ref} className="cabinet-row" aria-label="Cabinet handles">
      <button type="button" onClick={() => onGo("ledger")}>Books</button>
      <button type="button" onClick={() => onGo("calendar")}>Calendar</button>
      <button type="button" onClick={() => onGo("plan")}>Plan</button>
      <button type="button" onClick={() => onGo("more")}>More</button>
      <button type="button" onClick={() => emitOfficeIntent({ type: "tidy" })}>Straighten</button>
    </div>
  );
}
