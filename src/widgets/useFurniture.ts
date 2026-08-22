import { useEffect, useRef, type RefObject } from "react";
import { publishFurniture, unpublishFurniture, type FurnitureKind } from "../core/officeLayout.ts";

export function useFurniture(
  id: string,
  kind: FurnitureKind,
  perchable: boolean,
  warn: boolean,
  extra?: { enabled?: boolean },
): RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement | null>(null);
  const enabled = extra?.enabled !== false;
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
        rect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
      });
    };
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(node);
    window.addEventListener("scroll", publish, true);
    window.addEventListener("resize", publish);
    const timer = window.setInterval(publish, 100);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", publish, true);
      window.removeEventListener("resize", publish);
      window.clearInterval(timer);
      unpublishFurniture(id);
    };
  }, [id, kind, perchable, warn, enabled]);
  return ref;
}
