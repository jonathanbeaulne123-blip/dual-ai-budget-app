/**
 * Per-viewer Journey view state (T4) — the ONLY storage the Journey Board touches.
 *
 * Key: `journeyViewStateKey(identity)` (`hearth:journey-board:v1:<environment>:<householdId>:<memberId>`). Device
 * local, household scope, nothing financial: camera tier + target, the focused date, the selected stop, the list/map
 * choice, the piece's look and the last explicit "Enter Horizon here". Every read and write is inside try/catch; a
 * missing, invalid or unreadable record — or a storage that throws — is `DEFAULT_JOURNEY_VIEW_STATE`.
 * Restored on mount; written debounced (300 ms) and flushed on unmount / before entering Horizon.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_JOURNEY_VIEW_STATE, journeyViewStateKey, PIECE_LOOKS,
  type CameraTier, type HorizonLocation, type JourneyViewIdentity, type JourneyViewState, type PieceLookId,
} from "../contracts.ts";

export const VIEW_STATE_WRITE_DELAY_MS = 300;

/** The browser's storage, or null when it is missing or refuses (private mode, blocked cookies). */
export function journeyStorage(): Storage | null {
  try { return typeof globalThis.localStorage === "undefined" ? null : globalThis.localStorage; } catch { return null; }
}

const TIERS: readonly CameraTier[] = ["sky", "region", "stop"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 && v.length < 400 ? v : null);
const date = (v: unknown) => (typeof v === "string" && DATE.test(v) ? (v as JourneyViewState["focusDate"]) : null);
const point = (v: unknown): { x: number; y: number } | null => {
  const p = v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  return p && isNum(p.x) && isNum(p.y) ? { x: p.x, y: p.y } : null;
};
function location(v: unknown): HorizonLocation | null {
  const p = point(v);
  if (p) return p;
  const host = v && typeof v === "object" ? str((v as Record<string, unknown>).host) : null;
  return host ? { host } : null;
}

/** Any stored value → a valid state (unknown fields dropped, bad fields defaulted). */
export function parseJourneyViewState(raw: unknown): JourneyViewState {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  if (!row || row.version !== 1) return { ...DEFAULT_JOURNEY_VIEW_STATE };
  const d = DEFAULT_JOURNEY_VIEW_STATE;
  const lastRaw = row.lastEnter && typeof row.lastEnter === "object" ? (row.lastEnter as Record<string, unknown>) : null;
  const lastLocation = lastRaw ? location(lastRaw.location) : null;
  return {
    version: 1,
    tier: TIERS.includes(row.tier as CameraTier) ? (row.tier as CameraTier) : d.tier,
    focusDate: date(row.focusDate),
    target: point(row.target),
    selectedStopId: str(row.selectedStopId),
    expandedClusterId: str(row.expandedClusterId),
    listMode: row.listMode === "list" ? "list" : "map",
    pieceLook: PIECE_LOOKS.includes(row.pieceLook as PieceLookId) ? (row.pieceLook as PieceLookId) : d.pieceLook,
    lastEnter: lastRaw && lastLocation
      ? { location: lastLocation, tier: TIERS.includes(lastRaw.tier as CameraTier) ? (lastRaw.tier as CameraTier) : "stop", focusDate: date(lastRaw.focusDate) }
      : null,
  };
}

export function readJourneyViewState(identity: JourneyViewIdentity, storage: Storage | null = journeyStorage()): JourneyViewState {
  try {
    const raw = storage?.getItem(journeyViewStateKey(identity));
    return raw ? parseJourneyViewState(JSON.parse(raw)) : { ...DEFAULT_JOURNEY_VIEW_STATE };
  } catch {
    return { ...DEFAULT_JOURNEY_VIEW_STATE };
  }
}

/** False when the storage refused (the in-memory state stays; nothing else happens). */
export function writeJourneyViewState(identity: JourneyViewIdentity, state: JourneyViewState, storage: Storage | null = journeyStorage()): boolean {
  try {
    if (!storage) return false;
    storage.setItem(journeyViewStateKey(identity), JSON.stringify(parseJourneyViewState(state)));
    return true;
  } catch {
    return false;
  }
}

export type JourneyViewStateStore = {
  /** Restored once, on mount (synchronously, so the first render already frames the restored view). */
  initial: JourneyViewState;
  /** Schedule a write of the latest state (debounced). */
  save(state: JourneyViewState): void;
  /** Write now (before leaving for Horizon; on unmount). */
  flush(): void;
};

/** Restore on mount, debounced write, flush on unmount. `storage` is a test seam. */
export function useJourneyViewStateStore(identity: JourneyViewIdentity, storage?: Storage | null): JourneyViewStateStore {
  const key = journeyViewStateKey(identity);
  const [initial] = useState(() => readJourneyViewState(identity, storage === undefined ? journeyStorage() : storage));
  const pending = useRef<{ state: JourneyViewState; identity: JourneyViewIdentity } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const storageRef = useRef(storage);
  storageRef.current = storage;

  const flush = useCallback(() => {
    if (timer.current !== null) { clearTimeout(timer.current); timer.current = null; }
    const next = pending.current;
    pending.current = null;
    if (next) writeJourneyViewState(next.identity, next.state, storageRef.current === undefined ? journeyStorage() : storageRef.current);
  }, []);
  const save = useCallback((state: JourneyViewState) => {
    pending.current = { state, identity: identityRef.current };
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(flush, VIEW_STATE_WRITE_DELAY_MS);
  }, [flush]);
  // A different viewer or household: write what is pending under the old key first.
  useEffect(() => () => flush(), [key, flush]);
  return { initial, save, flush };
}
