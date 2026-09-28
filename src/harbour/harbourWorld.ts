import { useSyncExternalStore } from "react";
import { HARBOUR_DEV, horizonEnabled } from "./flag.ts";

/**
 * Dev-only XOR between Mountain v2 and Horizon for full-App UX dissection.
 * Geography and presence stay partitioned; this only chooses which shell mounts.
 * Production never reads or writes the world query (D15 switch stays open).
 */
export type HarbourWorldId = "mountain" | "horizon";

export const HARBOUR_WORLD_EVENT = "hearth:harbour-world";

export function readHarbourWorld(search: string = typeof location === "undefined" ? "" : location.search): HarbourWorldId {
  return horizonEnabled(search) ? "horizon" : "mountain";
}

/** Pure: next search string with only the `world` query param changed. */
export function harbourWorldSearch(search: string, next: HarbourWorldId): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  if (next === "horizon") params.set("world", "horizon");
  else params.delete("world");
  const query = params.toString();
  return query ? `?${query}` : "";
}

/**
 * DEV only. Updates `world` via `history.replaceState`, preserves every other
 * query key (seed, member, story, sun, …), and notifies subscribers.
 */
export function setHarbourWorld(next: HarbourWorldId, historyApi: Pick<History, "replaceState"> = history, loc: Pick<Location, "pathname" | "search" | "hash"> = location): HarbourWorldId {
  if (!HARBOUR_DEV) return "mountain";
  const search = harbourWorldSearch(loc.search, next);
  if (search === loc.search || (!search && !loc.search)) {
    announceHarbourWorld();
    return next;
  }
  historyApi.replaceState(historyApi === history ? history.state : null, "", `${loc.pathname}${search}${loc.hash}`);
  announceHarbourWorld();
  return next;
}

const listeners = new Set<() => void>();
function announceHarbourWorld(): void {
  for (const listener of listeners) listener();
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(HARBOUR_WORLD_EVENT, { detail: readHarbourWorld() }));
}

function subscribeHarbourWorld(listener: () => void): () => void {
  listeners.add(listener);
  if (typeof window === "undefined") return () => { listeners.delete(listener); };
  const onPop = () => listener();
  window.addEventListener("popstate", onPop);
  window.addEventListener(HARBOUR_WORLD_EVENT, onPop);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("popstate", onPop);
    window.removeEventListener(HARBOUR_WORLD_EVENT, onPop);
  };
}

const serverWorld = (): HarbourWorldId => "mountain";

/** Reactive DEV world id. Always `"mountain"` outside development. */
export function useHarbourWorld(): HarbourWorldId {
  return useSyncExternalStore(subscribeHarbourWorld, () => readHarbourWorld(), serverWorld);
}
