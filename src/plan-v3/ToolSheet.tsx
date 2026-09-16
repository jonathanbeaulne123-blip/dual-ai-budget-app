import { useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { PlanStudioClassic, type PlanStudioProps, type PlanStudioSection } from "../PlanStudio.tsx";
import { useDialog } from "../useDialog.ts";
import { ToolArt } from "./ToolArt.tsx";
import { toolById, type ToolId } from "./tools.ts";

/**
 * A sheet: a bottom sheet on a phone and a side panel from 720px. `useDialog`
 * keeps focus in, closes on Escape or an outside tap, and returns focus to
 * whatever opened it. It is portalled to the page body so the page behind goes inert.
 */
export function SheetFrame({ kicker, title, art, kind, onClose, children }: { kicker: string; title: string; art?: ReactNode; kind: string; onClose: () => void; children: ReactNode }) {
  const ref = useDialog(true, onClose);
  const heading = useId();
  if (typeof document === "undefined") return null;
  return createPortal(
    <div ref={ref} className="pv3-veil" data-sheet={kind}>
      <div className="pv3-sheet sheet-inner" role="dialog" aria-modal="true" aria-labelledby={heading}>
        <div className="pv3-sheet__grab" aria-hidden="true" />
        <header className="pv3-sheet__head">
          {art && <span className="pv3-sheet__art" aria-hidden="true">{art}</span>}
          <div><p className="pv3-kicker">{kicker}</p><h2 id={heading}>{title}</h2></div>
          <button type="button" className="pv3-x" aria-label={`Close ${title}`} onClick={onClose}>×</button>
        </header>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** A tool, opened, with the existing studio section inside it (Phase 1). */
export function ToolSheet({ tool, section, studio, lead, onClose }: {
  tool: ToolId;
  section?: PlanStudioSection;
  studio: PlanStudioProps;
  lead?: ReactNode;
  onClose: () => void;
}) {
  const def = toolById(tool);
  const tabs = def.tabs.filter(tab => studio.view === "household" || (tab.section !== "sitdown" && tab.section !== "bridge"));
  const [current, setCurrent] = useState<PlanStudioSection>(section ?? tabs[0]?.section ?? def.tabs[0]!.section);
  const tabsId = useId();
  return (
    <SheetFrame kind={`tool-${tool}`} kicker={def.purpose} title={def.name} art={<ToolArt tool={tool} />} onClose={onClose}>
      {lead}
      {tabs.length > 1 && (
        <div className="pv3-tabs" role="tablist" aria-label={`${def.name} sections`}>
          {tabs.map(tab => (
            <button key={tab.section} type="button" role="tab" id={`${tabsId}-${tab.section}`} aria-selected={tab.section === current} aria-controls={`${tabsId}-panel`} onClick={() => setCurrent(tab.section)}>{tab.label}</button>
          ))}
        </div>
      )}
      <div className="pv3-sheet__body" id={`${tabsId}-panel`} {...(tabs.length > 1 ? { role: "tabpanel", "aria-labelledby": `${tabsId}-${current}` } : {})}>
        <PlanStudioClassic key={current} {...studio} embeddedSection={current} onEmbeddedClose={onClose} sourceFocus={null} />
      </div>
      <p className="pv3-note">“Set aside” is a way of planning, not a bank move. Anything that posts asks you to confirm first.</p>
    </SheetFrame>
  );
}
