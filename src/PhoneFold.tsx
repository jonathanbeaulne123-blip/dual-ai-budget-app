import { Component, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { phoneFoldCount, type PhoneFoldItem } from "./core/officePhone.ts";

/** Keeps every object mounted once; measurement spills whole objects, never clips. */
export function PhoneFold({ items, render }: { items: PhoneFoldItem[]; render: (id: PhoneFoldItem["id"]) => ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [measuredCount, setMeasuredCount] = useState<number | null>(null);
  const count = Math.min(measuredCount ?? Infinity, phoneFoldCount(items));


  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const measure = () => {
      const head = element.querySelector<HTMLElement>(".ph-fold-head")!;
      const heights = new Map<PhoneFoldItem["id"], number>();
      element.querySelectorAll<HTMLElement>("[data-fold-id]").forEach((node) => {
        heights.set(node.dataset.foldId as PhoneFoldItem["id"], node.getBoundingClientRect().height);
      });
      const maxHeight = Number.parseFloat(getComputedStyle(head).maxHeight);
      if (!Number.isFinite(maxHeight)) return;
      const next = phoneFoldCount(items, heights, maxHeight);
      setMeasuredCount((previous) => previous === next ? previous : next);
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    element.querySelectorAll<HTMLElement>("[data-fold-id]").forEach((node) => observer?.observe(node));
    window.addEventListener("resize", measure);
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, [items]);


  const objects = (from: number, to: number) => items.slice(from, to).map((item) => (
    <div key={item.id} data-fold-id={item.id} data-fold-slots={item.slots}
      className={item.wide ? "ph-fold-object is-wide" : "ph-fold-object"}>
      {render(item.id)}
    </div>
  ));
  return <FoldFocusBoundary root={root}>
    <section className="ph-fold-head hearth-story-grid" aria-label="At a glance">{objects(0, count)}</section>
    <div className="ph-fold-line" role="separator"><span>the fold</span></div>
    <section className="ph-fold-below hearth-story-grid" aria-label="More from your desk">{objects(count, items.length)}</section>
  </FoldFocusBoundary>;
}


type FocusPosition = { id: string; index: number } | null;
/** Capture before React reparents an object; a post-render effect is too late. */
class FoldFocusBoundary extends Component<{ root: RefObject<HTMLDivElement | null>; children: ReactNode }, object, FocusPosition> {
  getSnapshotBeforeUpdate(): FocusPosition {
    const active = document.activeElement;
    const object = active?.closest<HTMLElement>("[data-fold-id]");
    if (!object || !this.props.root.current?.contains(object)) return null;
    return { id: object.dataset.foldId!, index: [...object.querySelectorAll("button, input, [tabindex]")].indexOf(active!) };
  }
  componentDidUpdate(_previous: Readonly<{ root: RefObject<HTMLDivElement | null>; children: ReactNode }>, _state: object, snapshot: FocusPosition) {
    if (!snapshot || document.activeElement !== document.body) return;
    const object = [...(this.props.root.current?.querySelectorAll<HTMLElement>("[data-fold-id]") ?? [])].find(node => node.dataset.foldId === snapshot.id);
    object?.querySelectorAll<HTMLElement>("button, input, [tabindex]")[snapshot.index]?.focus({ preventScroll: true });
  }
  render() { return <div className="ph-fold" ref={this.props.root}>{this.props.children}</div>; }
}
