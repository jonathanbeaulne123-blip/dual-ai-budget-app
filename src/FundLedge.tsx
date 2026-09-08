import type { ScenarioSourceContext } from "./scenarioSourceContext.ts";
import { fundStageStorageKey, storedFundStage } from "./core/fundStageMemory.ts";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { fundWalk, phoneRail, railFor, type CommitResult, type FundWidgetId, type Household } from "./core/index.ts";
import { fundLedgeReading, ledgeHeights, nearestLedgeDetent, type LedgeDetent } from "./core/fundLedge.ts";
import "./fund-ledge.css";
import { createPortal } from "react-dom";
import { useDialog } from "./useDialog.ts";
import { FundBoard } from "./FundBoard.tsx";
import { FundDrawer, FUND_WIDGET_CARD } from "./FundDrawer.tsx";
import { FundStage, type FundDestination } from "./FundStage.tsx";

export function FundLedge({ household, today, view, memberId, busy, onOpen, onKitchen, onOpenAccount, onExpandedChange, scenarioSource }: {
  household: Household; today: string; view: "household" | "personal"; memberId: string; busy: boolean;
  onOpen: (destination?: FundDestination) => void;
  onKitchen: (fn: (current: Household) => CommitResult) => void;
  onOpenAccount: (accountId: string) => void;
  onExpandedChange?: (expanded: boolean) => void;
  scenarioSource?: ScenarioSourceContext | null;
}) {
  const reading = useMemo(() => fundLedgeReading(fundWalk(household, today.slice(0, 7), today)), [household, today]);
  const grip = useRef<HTMLButtonElement>(null);
  const [height, setHeight] = useState(84);
  useLayoutEffect(() => {
    const node = grip.current;
    if (!node) return;
    const app = node.closest<HTMLElement>(".app");
    const priorHeight = app?.style.getPropertyValue("--fund-ledge-height") ?? "";
    const priorReturn = app?.style.getPropertyValue("--fund-return-height") ?? "";
    const measure = () => {
      const gripHeight = node.getBoundingClientRect().height;
      const returnHeight = app?.querySelector(".onboarding-return-bar")?.getBoundingClientRect().height ?? 0;
      const pillHeight = app?.querySelector(".hercules-pill")?.getBoundingClientRect().height ?? 0;
      app?.style.setProperty("--fund-ledge-height", `${gripHeight}px`);
      app?.style.setProperty("--fund-return-height", `${returnHeight}px`);
      setHeight(gripHeight + returnHeight + (pillHeight ? pillHeight + 10 : 0));
    };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    const observed = new Set<Element>();
    const observeChrome = () => {
      const current = new Set<Element>([node, ...(app?.querySelectorAll(".onboarding-return-bar, .hercules-pill") ?? [])]);
      for (const previous of observed) if (!current.has(previous)) { observer?.unobserve(previous); observed.delete(previous); }
      for (const element of current) if (!observed.has(element)) { observer?.observe(element); observed.add(element); }
      measure();
    };
    observeChrome();
    const mutations = typeof MutationObserver === "undefined" ? null : new MutationObserver(observeChrome);
    if (app) mutations?.observe(app, { childList: true, subtree: true });
    return () => {
      observer?.disconnect(); mutations?.disconnect();
      if (app) {
        if (priorHeight) app.style.setProperty("--fund-ledge-height", priorHeight); else app.style.removeProperty("--fund-ledge-height");
        if (priorReturn) app.style.setProperty("--fund-return-height", priorReturn); else app.style.removeProperty("--fund-return-height");
      }
    };
  }, []);
  const [detent, setDetent] = useState<LedgeDetent>("rest");
  const [selected, setSelected] = useState<FundWidgetId>(() => storedFundStage(household.environment, household.householdId, memberId, today));
  const [drawer, setDrawer] = useState(false);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const [viewport, setViewport] = useState({ height: window.innerHeight, nav: 76, inset: 0 });
  const drag = useRef<{ id: number; y: number; height: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const stage = useRef<HTMLDivElement>(null);
  const sheetId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const expanded = detent !== "rest";
  const close = () => { drag.current = null; setDragHeight(null); setDetent("rest"); setDrawer(false); };
  const dialog = useDialog(expanded, close);
  useLayoutEffect(() => { close(); setSelected(storedFundStage(household.environment, household.householdId, memberId, today)); }, [household.environment, household.householdId, memberId, view, today]);
  const heights = ledgeHeights(viewport.height, viewport.nav, grip.current?.getBoundingClientRect().height || 84);
  const selectedId = phoneRail(railFor(household, memberId)).includes(selected) ? selected : "level";
  const shownId = detent === "half" ? "level" : selectedId;
  const selectWidget = (id: FundWidgetId) => {
    setSelected(id);
    try { sessionStorage.setItem(fundStageStorageKey(household.environment, household.householdId, memberId, today), id); } catch { /* The in-session selection still works. */ }
    queueMicrotask(() => (heading.current ?? stage.current)?.focus());
  };

  useLayoutEffect(() => {
    const measureViewport = () => {
      const vv = window.visualViewport;
      const nav = grip.current?.closest(".app")?.querySelector(".nav")?.getBoundingClientRect().height || 76;
      setViewport({ height: vv?.height ?? window.innerHeight, nav,
        inset: Math.max(0, window.innerHeight - (vv?.height ?? window.innerHeight) - (vv?.offsetTop ?? 0)) });
      drag.current = null; setDragHeight(null);
      if (window.innerWidth >= 720) setDetent("rest");
    };
    measureViewport(); window.addEventListener("resize", measureViewport);
    window.visualViewport?.addEventListener("resize", measureViewport);
    window.visualViewport?.addEventListener("scroll", measureViewport);
    return () => {
      window.removeEventListener("resize", measureViewport);
      window.visualViewport?.removeEventListener("resize", measureViewport);
      window.visualViewport?.removeEventListener("scroll", measureViewport);
    };
  }, []);
  useEffect(() => {
    onExpandedChange?.(expanded);
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [expanded, onExpandedChange]);
  useEffect(() => () => onExpandedChange?.(false), [onExpandedChange]);

  const cycle = () => { setDragHeight(null); setDetent(current => current === "rest" ? "half" : current === "half" ? "full" : "rest"); };
  const pointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!event.isPrimary || event.button !== 0) return;
    suppressClick.current = false;
    drag.current = { id: event.pointerId, y: event.clientY, height: heights[detent], moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const pointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    if (Math.abs(current.y - event.clientY) > 4) current.moved = true;
    if (current.moved) setDragHeight(Math.max(heights.rest, Math.min(heights.full, current.height + current.y - event.clientY)));
  };
  const pointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    drag.current = null;
    suppressClick.current = current.moved;
    if (current.moved) setDetent(nearestLedgeDetent(current.height + current.y - event.clientY, heights));
    setDragHeight(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const cancel = () => { if (drag.current) { suppressClick.current = true; drag.current = null; setDragHeight(null); } };
  const gripProps = {
    type: "button" as const,
    "aria-expanded": expanded,
    "aria-controls": expanded ? sheetId : undefined,
    "aria-label": `Household Fund. ${view === "personal" ? "Shared money, from Personal." : "Shared money."} ${reading.figure}. ${reading.sentence} ${detent}. Enter opens ${detent === "rest" ? "half" : detent === "half" ? "full" : "rest"}.`,
    onClick: (event: { detail: number }) => { if (event.detail > 0 && suppressClick.current) { suppressClick.current = false; return; } cycle(); },
    onPointerDown: pointerDown, onPointerMove: pointerMove, onPointerUp: pointerUp,
    onPointerCancel: cancel, onLostPointerCapture: cancel,
  };
  const gripContent = <>
      <span className="fund-ledge-handle" aria-hidden="true" />
      <span className="fund-ledge-row">
        <span className="fund-ledge-reading">
          <span className="fund-ledge-scope">Household Fund{view === "personal" ? " · from Personal" : " · Shared"}</span>
          <span className="fund-ledge-figure">{reading.figure}</span>
          <span className="fund-ledge-sentence">{reading.sentence}</span>
        </span>
        <span className="fund-ledge-arrow" aria-hidden="true">↑</span>
      </span>
      <span className="fund-ledge-ground" aria-hidden="true"><i style={{ width: `${reading.claimedPercent}%` }} /></span>
  </>;
  const openDestination = (destination?: FundDestination) => { close(); onOpen(destination); };
  return <div className="fund-ledge" data-origin-view={view}>
    <div className="fund-ledge-clearance" style={{ height }} aria-hidden="true" />
    <button ref={grip} className="fund-ledge-grip" {...gripProps}>{gripContent}</button>
    {(expanded || dragHeight !== null) && createPortal(
      <div ref={dialog} className="fund-ledge-modal" role={expanded ? "dialog" : undefined}
        aria-modal={expanded || undefined} aria-label="Household Fund · Shared" aria-hidden={!expanded || undefined}>
        <button type="button" className="fund-ledge-scrim" aria-label="Close Household Fund" tabIndex={-1} onClick={close} />
        <section id={sheetId} className={`fund-ledge-sheet ${dragHeight === null ? "is-settling" : "is-tracking"}`}
          data-detent={detent} style={{ height: dragHeight ?? heights[detent], bottom: viewport.nav + viewport.inset }}>
          <button className="fund-ledge-grip is-sheet-grip" data-autofocus {...gripProps}>{gripContent}</button>
          <div className="fund-ledge-content">
          <div className="fund-ledge-board" hidden={detent !== "full" || drawer} inert={!expanded || undefined}>
            <FundBoard household={household} memberId={memberId} today={today} presentation="phone"
              selected={selectedId} panelId={`${sheetId}-stage`} onSelect={selectWidget} />
            <button type="button" className="fund-ledge-arrange" onClick={() => { setDrawer(true); queueMicrotask(() => stage.current?.focus()); }}>Arrange</button>
          </div>
          <div ref={stage} className="fund-ledge-stage" id={`${sheetId}-stage`} role="tabpanel" aria-labelledby={detent === "full" && !drawer ? `${sheetId}-stage-tab-${selectedId}` : undefined} tabIndex={-1} inert={!expanded || busy || undefined}
            aria-label={drawer && detent === "full" ? "Arrange the Fund board" : FUND_WIDGET_CARD[shownId].name}>
            {drawer && detent === "full" ? <FundDrawer household={household} memberId={memberId} busy={busy} onKitchen={onKitchen} onClose={() => setDrawer(false)} />
              : <FundStage scenarioSource={scenarioSource} presentation="phone" widgetId={shownId} household={household} memberId={memberId} today={today} busy={busy}
                headingRef={heading} onKitchen={onKitchen} onOpenDestination={openDestination}
                onOpenAccount={accountId => { close(); onOpenAccount(accountId); }} />}
            <button type="button" className="fund-ledge-record" onClick={() => openDestination("record")}>Open the Fund register</button>
          </div>
          </div>
        </section>
      </div>, document.body)}
  </div>;
}
