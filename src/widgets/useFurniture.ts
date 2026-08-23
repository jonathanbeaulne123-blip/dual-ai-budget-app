import { useEffect, useRef, type RefObject } from "react";
import { publishFurniture, unpublishFurniture, type FurnitureKind, type FurnitureSeat } from "../core/officeLayout.ts";

export function useFurniture(
  id: string,
  kind: FurnitureKind,
  perchable: boolean,
  warn: boolean,
  extra?: { enabled?: boolean; live?: boolean; seat?: FurnitureSeat },
): RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement | null>(null);
  const enabled = extra?.enabled !== false;
  const live = Boolean(extra?.live);
  const seat = extra?.seat;
  useEffect(() => {
    if (!enabled) {
      unpublishFurniture(id);
      return;
    }
    const node = ref.current;
    if (!node) return;
    const publish = () => {
      const rect = node.getBoundingClientRect();
      publishFurniture({
        id,
        kind,
        perchable,
        warn,
        seat,
        rect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
      });
    };
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(node);
    window.addEventListener("scroll", publish, true);
    window.addEventListener("resize", publish);
    let raf = 0;
    const tick = () => {
      publish();
      raf = window.requestAnimationFrame(tick);
    };
    if (live) raf = window.requestAnimationFrame(tick);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", publish, true);
      window.removeEventListener("resize", publish);
      if (raf) window.cancelAnimationFrame(raf);
      unpublishFurniture(id);
    };
  }, [id, kind, perchable, warn, enabled, live, seat]);
  return ref;
}
