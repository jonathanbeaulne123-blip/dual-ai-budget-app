import { emitOfficeIntent, INSTRUMENT_IDS, INSTRUMENT_LABEL, PINNED_INSTRUMENTS, setInstrumentHidden, type InstrumentId, type OfficeLayout } from "../core/officeLayout.ts";
import { useFurniture } from "./useFurniture.ts";
import type { HearthTab } from "../core/hercules.ts";

export function Cabinets({
  onGo,
  layout,
  onLayout,
}: {
  onGo: (tab: HearthTab) => void;
  layout: OfficeLayout;
  onLayout: (next: OfficeLayout) => void;
}) {
  const ref = useFurniture("cabinets", "tray", true, false);
  return (
    <div ref={ref} className="cabinet-row" aria-label="Cabinet handles">
      <button type="button" onClick={() => onGo("ledger")}>Books</button>
      <button type="button" onClick={() => onGo("calendar")}>Calendar</button>
      <button type="button" onClick={() => onGo("plan")}>Plan</button>
      <button type="button" onClick={() => onGo("more")}>More</button>
      <button type="button" onClick={() => emitOfficeIntent({ type: "tidy" })}>Straighten</button>
      <details className="desk-customize">
        <summary>Desk</summary>
        <p className="muted">Hide what you don't use. Calculator stays. Layout is this phone, not the books.</p>
        {INSTRUMENT_IDS.map((id) => {
          const item = layout.items.find((row) => row.id === id);
          const hidden = Boolean(item?.hidden);
          const pinned = PINNED_INSTRUMENTS.includes(id);
          return (
            <label key={id} className="desk-toggle">
              <input
                type="checkbox"
                checked={!hidden}
                disabled={pinned}
                onChange={(event) => onLayout(setInstrumentHidden(layout, id as InstrumentId, !event.currentTarget.checked))}
              />
              {INSTRUMENT_LABEL[id]}
              {pinned ? " · stays" : ""}
            </label>
          );
        })}
      </details>
    </div>
  );
}