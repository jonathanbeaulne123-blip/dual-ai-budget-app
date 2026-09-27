import { useLayoutEffect, useSyncExternalStore } from "react";

/**
 * "A flip is standing on the glass": the Desk's header hides its own flip
 * while one does, so there is only ever one (Tool Atlas brief §3.5, K14).
 * A count, so an overlapping remount never strands it.
 */
let flips = 0;
const listeners = new Set<() => void>();
const announce = () => { for (const listener of listeners) listener(); };
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

export function useFlipStanding(): boolean {
  return useSyncExternalStore(subscribe, () => flips > 0, () => false);
}

/** The Simple view bubble: "I am standing" while mounted. */
export function useAnnounceFlip(): void {
  useLayoutEffect(() => { flips += 1; announce(); return () => { flips -= 1; announce(); }; }, []);
}
