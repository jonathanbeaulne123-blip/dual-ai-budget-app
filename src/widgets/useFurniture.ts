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
    let publishFrame = 0;
    const schedulePublish = () => {
      if (publishFrame) return;
      publishFrame = window.requestAnimationFrame(() => {
        publishFrame = 0;
        publish();
      });
    };
    publish();
    const observer = new ResizeObserver(schedulePublish);
    observer.observe(node);
    window.addEventListener("scroll", schedulePublish, true);
    window.addEventListener("resize", schedulePublish);
    let liveFrame = 0;
    const tick = () => {
      schedulePublish();
      liveFrame = window.requestAnimationFrame(tick);
    };
    if (live) liveFrame = window.requestAnimationFrame(tick);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", schedulePublish, true);
      window.removeEventListener("resize", schedulePublish);
      if (publishFrame) window.cancelAnimationFrame(publishFrame);
      if (liveFrame) window.cancelAnimationFrame(liveFrame);
      unpublishFurniture(id);
    };
  }, [id, kind, perchable, warn, enabled, live, seat]);
  return ref;
}
