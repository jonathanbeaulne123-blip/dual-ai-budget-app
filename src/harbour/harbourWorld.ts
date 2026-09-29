import { useSyncExternalStore } from "react";
import { HARBOUR_DEV, HORIZON_LIVE, horizonEnabled } from "./flag.ts";

/**
 * Which world shell mounts: Mountain v2 or the Horizon. Geography and presence stay partitioned.
 *
 * D15 (Jonathan, 2026-09-29): with the live switch on (`HORIZON_LIVE`, `VITE_HEARTH_HORIZON=1`) the Horizon
 * is the world for everyone; with it off the Mountain is. Production never reads or writes the world query.
 * In development the in-App toggle still flips between the two for UX dissection, from the same default.
 *
 * Preference is kept in memory because App `housePath` history writes drop
 * unrelated query keys (including `world`). An explicit `world=horizon` in the
 * URL still seeds the preference on read.
 */
export type HarbourWorldId = "mountain" | "horizon";

export const HARBOUR_WORLD_EVENT = "hearth:harbour-world";

/** DEV session preference. Null means "follow the URL / the build's default world". */
let preference: HarbourWorldId | null = null;

/** Test seam: clear the in-memory preference between cases. */
export function resetHarbourWorldPreference(): void {
  preference = null;
}

/** The world a build shows when nobody has chosen one: the Horizon once D15's switch is on. */
export function defaultHarbourWorld(live: boolean = HORIZON_LIVE): HarbourWorldId {
  return live ? "horizon" : "mountain";
}

/** `dev` and `live` are test seams; production reads the flags. */
export function readHarbourWorld(search: string = typeof location === "undefined" ? "" : location.search, dev: boolean = HARBOUR_DEV, live: boolean = HORIZON_LIVE): HarbourWorldId {
  if (!dev) return defaultHarbourWorld(live);
  if (horizonEnabled(search)) {
    preference = "horizon";
    return "horizon";
  }
  return preference ?? defaultHarbourWorld(live);
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
 * DEV only. Remembers the chosen world (survives housePath wiping search),
 * updates `world` on the current URL when possible, and notifies subscribers.
 */
export function setHarbourWorld(
  next: HarbourWorldId,
  historyApi: Pick<History, "replaceState"> & { state?: unknown } = typeof history === "undefined" ? { replaceState() { /* no browser history */ } } : history,
  loc: Pick<Location, "pathname" | "search" | "hash"> = typeof location === "undefined" ? { pathname: "/", search: "", hash: "" } : location,
): HarbourWorldId {
  if (!HARBOUR_DEV) return defaultHarbourWorld();
  preference = next;
  const search = harbourWorldSearch(loc.search, next);
  if (!(search === loc.search || (!search && !loc.search))) {
    const state = "state" in historyApi ? historyApi.state : null;
    historyApi.replaceState(state ?? null, "", `${loc.pathname}${search}${loc.hash}`);
  }
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

const serverWorld = (): HarbourWorldId => defaultHarbourWorld();

/** Reactive world id. Outside development it is always the build's default (D15). */
export function useHarbourWorld(): HarbourWorldId {
  return useSyncExternalStore(subscribeHarbourWorld, () => readHarbourWorld(), serverWorld);
}
