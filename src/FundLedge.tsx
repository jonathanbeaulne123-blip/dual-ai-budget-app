import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { fundWalk, type Household } from "./core/index.ts";
import { fundLedgeReading } from "./core/fundLedge.ts";
import "./fund-ledge.css";

export function FundLedge({ household, today, view, onOpen }: {
  household: Household; today: string; view: "household" | "personal"; onOpen: () => void;
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
  return <div className="fund-ledge" data-origin-view={view}>
    <div className="fund-ledge-clearance" style={{ height }} aria-hidden="true" />
    <button ref={grip} type="button" className="fund-ledge-grip" aria-expanded={false}
      aria-label={`Household Fund. ${view === "personal" ? "Shared money, from Personal." : "Shared money."} ${reading.figure}. ${reading.sentence} Open Fund.`}
      onClick={onOpen}>
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
    </button>
  </div>;
}
