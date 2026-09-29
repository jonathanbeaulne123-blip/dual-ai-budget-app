/**
 * Reduced motion for the Journey Board (T4), read the way `src/theme/comfort.ts` applies it: the device's
 * `prefers-reduced-motion`, or the Comfort choice written to `<html data-motion="reduced">`. Under reduced motion
 * every camera move is a cut, the piece does not settle, and no CSS transition runs (no `--animated` class).
 */
import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

export function readReducedMotion(): boolean {
  try {
    if (typeof document !== "undefined" && document.documentElement?.dataset.motion === "reduced") return true;
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") return window.matchMedia(QUERY).matches;
  } catch { /* an unreadable preference reads as "no preference" */ }
  return false;
}

/** Live: follows the media query and the Comfort attribute while the board is open. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(readReducedMotion);
  useEffect(() => {
    const sync = () => setReduced(readReducedMotion());
    sync();
    let media: MediaQueryList | null = null;
    try { media = typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(QUERY) : null; } catch { media = null; }
    media?.addEventListener?.("change", sync);
    let observer: MutationObserver | null = null;
    if (typeof MutationObserver !== "undefined" && typeof document !== "undefined") {
      observer = new MutationObserver(sync);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-motion"] });
    }
    return () => { media?.removeEventListener?.("change", sync); observer?.disconnect(); };
  }, []);
  return reduced;
}
