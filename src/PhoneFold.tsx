import { Component, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { phoneFoldCount, type PhoneFoldItem } from "./core/officePhone.ts";

export const PHONE_FOLD_OPEN_KEY = "hearth:phone-fold-open:v1";
function readFoldOpen(): boolean {
  try { return localStorage.getItem(PHONE_FOLD_OPEN_KEY) === "open"; } catch { return false; }
}

/**
 * Keeps every object mounted once; measurement spills whole objects, never clips.
 * The fold is a real fold (feedback row 5): at rest the phone shows what fits
 * above it, and everything below waits behind "the fold · N more" until it is
 * opened. Opening is remembered per device. Objects below stay laid out (so
 * measurement is stable) but are hidden from sight, the tab order and
 * assistive tech until then; a focus that must land below opens it.
 */
export function PhoneFold({ items, render }: { items: PhoneFoldItem[]; render: (id: PhoneFoldItem["id"]) => ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [measuredCount, setMeasuredCount] = useState<number | null>(null);
  const [open, setOpen] = useState(readFoldOpen);
  const count = Math.min(measuredCount ?? Infinity, phoneFoldCount(items));
  const below = Math.max(0, items.length - count);
  const setFold = (next: boolean) => {
    setOpen(next);
    try { localStorage.setItem(PHONE_FOLD_OPEN_KEY, next ? "open" : "closed"); } catch { /* A private window forgets. */ }
  };


  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const head = element.querySelector<HTMLElement>(".ph-fold-head")!;
    const measure = () => {
      const heights = new Map<PhoneFoldItem["id"], number>();
      element.querySelectorAll<HTMLElement>("[data-fold-id]").forEach((node) => {
        heights.set(node.dataset.foldId as PhoneFoldItem["id"], node.getBoundingClientRect().height);
      });
      // The authored heading and fixed furniture vary by scene and text size.
      // Count the real space once at the top of the document, not the scroll position.
      if (document.documentElement.dataset.theme && head.getBoundingClientRect().width > 0) {
        const app = element.closest(".app");
        let clearance = 76;
        app?.querySelectorAll<HTMLElement>(".nav, .fund-ledge-grip, .onboarding-return-bar, .hercules-pill").forEach(node => {
          const rect = node.getBoundingClientRect();
          if (getComputedStyle(node).position === "fixed" && rect.height > 0 && rect.top >= 0) {
            clearance = Math.max(clearance, window.innerHeight - rect.top);
          }
        });
        const documentTop = head.getBoundingClientRect().top + window.scrollY;
        const budget = `${Math.max(0, Math.min(440, window.innerHeight - documentTop - clearance - 24))}px`;
        if (head.style.getPropertyValue("--phone-fold-budget") !== budget) head.style.setProperty("--phone-fold-budget", budget);
      }
      const maxHeight = Number.parseFloat(getComputedStyle(head).maxHeight);
      if (!Number.isFinite(maxHeight)) return;
      const next = phoneFoldCount(items, heights, maxHeight);
      setMeasuredCount((previous) => previous === next ? previous : next);
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    element.querySelectorAll<HTMLElement>("[data-fold-id]").forEach((node) => observer?.observe(node));
    // Re-measure after a font/scene change, notice, or late fixed furniture arrival.
    const app = element.closest(".app");
    if (app) observer?.observe(app);
    observer?.observe(head);
    window.addEventListener("resize", measure);
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, [items]);


  const objects = (from: number, to: number) => items.slice(from, to).map((item) => (
    <div key={item.id} data-fold-id={item.id} data-fold-slots={item.slots}
      className={item.wide ? "ph-fold-object is-wide" : "ph-fold-object"}>
      {render(item.id)}
    </div>
  ));
  const folded = below > 0 && !open;
  return <FoldFocusBoundary root={root} reveal={() => setFold(true)}>
    <section className="ph-fold-head hearth-story-grid" aria-label="At a glance">{objects(0, count)}</section>
    {below > 0
      ? <button type="button" className={`ph-fold-line ${folded ? "is-folded" : "is-open"}`} aria-expanded={!folded} aria-controls="ph-fold-below" onClick={() => setFold(folded)}>
          <span>{folded ? `the fold · ${below} more` : "the fold"}</span>
        </button>
      : <div className="ph-fold-line" role="separator"><span>the fold</span></div>}
    <section id="ph-fold-below" className={`ph-fold-below hearth-story-grid ${folded ? "is-folded" : ""}`} aria-label="More from your desk" aria-hidden={folded || undefined}>{objects(count, items.length)}</section>
  </FoldFocusBoundary>;
}


type FocusPosition = { id: string; index: number } | null;
/** Capture before React reparents an object; a post-render effect is too late. */
class FoldFocusBoundary extends Component<{ root: RefObject<HTMLDivElement | null>; reveal: () => void; children: ReactNode }, object, FocusPosition> {
  getSnapshotBeforeUpdate(): FocusPosition {
    const active = document.activeElement;
    const object = active?.closest<HTMLElement>("[data-fold-id]");
    if (!object || !this.props.root.current?.contains(object)) return null;
    return { id: object.dataset.foldId!, index: [...object.querySelectorAll("button, input, [tabindex]")].indexOf(active!) };
  }
  componentDidUpdate(_previous: Readonly<{ root: RefObject<HTMLDivElement | null>; reveal: () => void; children: ReactNode }>, _state: object, snapshot: FocusPosition) {
    if (!snapshot || document.activeElement !== document.body) return;
    const object = [...(this.props.root.current?.querySelectorAll<HTMLElement>("[data-fold-id]") ?? [])].find(node => node.dataset.foldId === snapshot.id);
    if (object?.closest(".ph-fold-below.is-folded")) this.props.reveal();
    object?.querySelectorAll<HTMLElement>("button, input, [tabindex]")[snapshot.index]?.focus({ preventScroll: true });
  }
  render() { return <div className="ph-fold" ref={this.props.root}>{this.props.children}</div>; }
}
