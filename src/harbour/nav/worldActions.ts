import { useLayoutEffect, useRef, useSyncExternalStore } from "react";

/**
 * World experiences behind Step in (Tool Atlas brief §3.2 Places: "Step in ·
 * Skate · Arrange room"). The island's HUD offers what it can do while it
 * stands; All tools lists a world row only while someone offers it, and runs
 * it through here. This keeps the guide (tour, monorail, race), Arrange room
 * and the rest reachable from the sheet without the App holding a second
 * navigator into the world. A route to an experience, never a write.
 */
export type WorldAction = "step-in" | "skate" | "arrange";

let offers = new Map<WorldAction, () => void>();
let snapshot: ReadonlySet<WorldAction> = new Set();
const listeners = new Set<() => void>();
const publish = () => { snapshot = new Set(offers.keys()); for (const listener of listeners) listener(); };
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const EMPTY: ReadonlySet<WorldAction> = new Set();

/** The world experiences someone can run right now. */
export function useWorldActions(): ReadonlySet<WorldAction> {
  return useSyncExternalStore(subscribe, () => snapshot, () => EMPTY);
}

/** Run one; false when nobody offers it. */
export function runWorldAction(action: string): boolean {
  const run = offers.get(action as WorldAction);
  if (!run) return false;
  run();
  return true;
}

/** Offer these while mounted. Handlers may change every render; only which actions are offered republishes. */
export function useOfferWorldActions(handlers: Partial<Record<WorldAction, (() => void) | undefined>>): void {
  const latest = useRef(handlers); latest.current = handlers;
  const keys = (Object.keys(handlers) as WorldAction[]).filter((key) => typeof handlers[key] === "function").sort().join(",");
  useLayoutEffect(() => {
    if (!keys) return;
    const mine = keys.split(",") as WorldAction[];
    const next = new Map(offers);
    for (const key of mine) next.set(key, () => latest.current[key]?.());
    offers = next; publish();
    return () => {
      const after = new Map(offers);
      for (const key of mine) after.delete(key);
      offers = after; publish();
    };
  }, [keys]);
}
