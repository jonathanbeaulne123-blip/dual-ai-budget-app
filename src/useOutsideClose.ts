import { useEffect, useRef, type RefObject } from "react";

/**
 * Clicking off a pop-up closes it (Jonathan, 2026-09-15: "clicking off a pop up
 * window should close the pop up window. this should apply everywhere pop up
 * windows appear").
 *
 * A **tap** outside every element in `inside` closes it: the press and the
 * release both land outside, within a small slop, so a scroll or a drag that
 * merely starts outside never closes anything, and neither does a text
 * selection that ends outside. The trigger belongs in `inside`, so pressing it
 * toggles once rather than closing and reopening. A press inside an element
 * marked `data-outside-keep` (a Confirm raised over this pop-up, say) is not
 * "outside". `onClose` is the pop-up's own close — for a money confirmation
 * that is Cancel, so a click away never posts anything. Presentation only.
 */
export function useOutsideClose(
  inside: ReadonlyArray<RefObject<Element | null>>,
  open: boolean,
  onClose: (() => void) | undefined,
  options: { enabled?: () => boolean; /** Elements matching this also count as inside (the doors that open this pop-up). */ keep?: string } = {},
) {
  const latest = useRef({ inside, onClose, options });
  latest.current = { inside, onClose, options };
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    let press: { x: number; y: number; id: number } | null = null;
    const outside = (target: EventTarget | null, x: number, y: number) => {
      const { inside: refs } = latest.current;
      const node = target instanceof Node ? target : null;
      for (const ref of refs) {
        const el = ref.current;
        if (!el) continue;
        if (node && el.contains(node)) return false;
        // Inert siblings hand the event to the page beneath; read the point instead of the target.
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom && !(node && node !== document.body && node !== document.documentElement)) return false;
      }
      const keep = latest.current.options.keep;
      if (node instanceof Element && (node.closest("[data-outside-keep]") || (keep && node.closest(keep)))) return false;
      return true;
    };
    const down = (event: PointerEvent) => {
      press = null;
      if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
      if (latest.current.options.enabled && !latest.current.options.enabled()) return;
      if (outside(event.target, event.clientX, event.clientY)) press = { x: event.clientX, y: event.clientY, id: event.pointerId };
    };
    const up = (event: PointerEvent) => {
      const start = press;
      press = null;
      if (!start || start.id !== event.pointerId) return;
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) return;
      if (!outside(event.target, event.clientX, event.clientY)) return;
      latest.current.onClose?.();
    };
    const cancel = () => { press = null; };
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("pointerup", up, true);
    document.addEventListener("pointercancel", cancel, true);
    return () => {
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("pointerup", up, true);
      document.removeEventListener("pointercancel", cancel, true);
    };
  }, [open]);
}
