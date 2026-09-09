import { useMemo, type KeyboardEvent } from "react";
import { fundPlates, fundWidgetIdForPlateId, phoneRail, railFor, type DeskPlateModel, type FundWidgetId, type Household } from "./core/index.ts";
import { FUND_WIDGET_CARD } from "./FundDrawer.tsx";
import { DeskPlate } from "./DeskPlates.tsx";
import "./fund-board.css";

/** Every configured slot survives even when it names a workspace, not a chart. */
export function FundBoard({ household, memberId, today, presentation, selected, onSelect, plates, onOpenCabinet, panelId = "fund-stage-panel" }: {
  household: Household; memberId: string; today: string; presentation: "phone" | "desk";
  selected: FundWidgetId; onSelect: (id: FundWidgetId) => void;
  panelId?: string;
  plates?: DeskPlateModel[]; onOpenCabinet?: (plate: DeskPlateModel) => void;
}) {
  const activeMember = household.members.some(member => member.id === memberId && member.active);
  const models = useMemo(() => activeMember ? plates ?? fundPlates({ household, memberId, today }) : [], [activeMember, plates, household, memberId, today]);
  const byId = new Map(models.map(plate => [fundWidgetIdForPlateId(plate.id), plate]));
  const rail = railFor(household, memberId,presentation);
  const slots = presentation === "phone" ? phoneRail(rail) : rail;
  if (!activeMember) return null;
  const navigate = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    const tabs = [...(event.currentTarget.closest('[role="tablist"]')?.querySelectorAll<HTMLElement>('[role="tab"]') ?? [])];
    const index = tabs.indexOf(event.currentTarget);
    const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1
      : (index + (["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 1) + tabs.length) % tabs.length;
    event.preventDefault(); tabs[next]?.focus();
  };
  return <div className={`fund-board is-${presentation}`} role="tablist" aria-label="Fund board">
    {slots.map(id => {
      const plate = byId.get(id);
      if (presentation === "desk" && plate) return <DeskPlate key={id} plate={plate} active={selected === id}
        tab open={false} onSelect={() => onSelect(id)} onOpenCabinet={() => onOpenCabinet?.(plate)} />;
      return <button type="button" key={id} className="fund-board-slot" data-fund-widget={id}
        role="tab"
        id={presentation === "desk" ? `fund-rail-tab-${id}` : `${panelId}-tab-${id}`}
        aria-controls={panelId}
        aria-selected={selected === id}
        aria-current={selected === id ? "true" : undefined}
        tabIndex={selected === id ? 0 : -1}
        onKeyDown={navigate} onClick={() => onSelect(id)}>
        <span>{FUND_WIDGET_CARD[id].name}</span>
        {plate ? <strong>{plate.glance}</strong> : null}
      </button>;
    })}
  </div>;
}
