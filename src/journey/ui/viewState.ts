/**
 * Per-viewer Journey Map view state (L4) — the ONLY storage the Journey touches.
 *
 * Key: `journeyViewStateKeyV2(identity)` (`hearth:journey-board:v2:<environment>:<householdId>:<memberId>`). Device
 * local, household scope, nothing financial: the level, the focused date, the selected stop, map/list and the last
 * explicit "Enter Horizon here". When no v2 record exists, the old v1 record (`journeyViewStateKey`) is read ONCE and
 * migrated (`migrateJourneyViewState`: sky → year, region → month, stop → week); the v2 record is written from then on.
 * Every read and write is inside try/catch; a missing, invalid or unreadable record — or a storage that throws — is
 * `DEFAULT_JOURNEY_VIEW_STATE_V2`. Restored on mount; written debounced (300 ms); flushed on unmount / before Horizon.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_JOURNEY_VIEW_STATE_V2, JOURNEY_LEVELS, journeyViewStateKey, journeyViewStateKeyV2, migrateJourneyViewState,
  type CameraTier, type HorizonLocation, type JourneyLevel, type JourneyViewIdentity, type JourneyViewState, type JourneyViewStateV2,
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
const date = (v: unknown) => (typeof v === "string" && DATE.test(v) ? v : null);
const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : null);
const level = (v: unknown, fallback: JourneyLevel): JourneyLevel => (JOURNEY_LEVELS.includes(v as JourneyLevel) ? (v as JourneyLevel) : fallback);
function location(v: unknown): HorizonLocation | null {
  const p = obj(v);
  if (p && isNum(p.x) && isNum(p.y)) return { x: p.x, y: p.y };
  const host = p ? str(p.host) : null;
  return host ? { host } : null;
}

/** Any stored v2 value → a valid v2 state (unknown fields dropped, bad fields defaulted). Null when it is not a v2 record. */
export function parseJourneyViewStateV2(raw: unknown): JourneyViewStateV2 | null {
  const row = obj(raw);
  if (!row || row.version !== 2) return null;
  const last = obj(row.lastEnter);
  const lastLocation = last ? location(last.location) : null;
  return {
    version: 2,
    level: level(row.level, DEFAULT_JOURNEY_VIEW_STATE_V2.level),
    focusDate: date(row.focusDate),
    selectedStopId: str(row.selectedStopId),
    listMode: row.listMode === "list" ? "list" : "map",
    lastEnter: last && lastLocation ? { location: lastLocation, level: level(last.level, "week"), focusDate: date(last.focusDate) } : null,
  };
}

/** A stored v1 value → a valid v1 state, or null (only for migration). */
export function parseJourneyViewStateV1(raw: unknown): JourneyViewState | null {
  const row = obj(raw);
  if (!row || row.version !== 1) return null;
  const last = obj(row.lastEnter);
  const lastLocation = last ? location(last.location) : null;
  return {
    version: 1,
    tier: TIERS.includes(row.tier as CameraTier) ? (row.tier as CameraTier) : "region",
    focusDate: date(row.focusDate),
    target: null,
    selectedStopId: str(row.selectedStopId),
    expandedClusterId: null,
    listMode: row.listMode === "list" ? "list" : "map",
    pieceLook: "lantern",
    lastEnter: last && lastLocation ? { location: lastLocation, tier: TIERS.includes(last.tier as CameraTier) ? (last.tier as CameraTier) : "stop", focusDate: date(last.focusDate) } : null,
  };
}

const fresh = (): JourneyViewStateV2 => ({ ...DEFAULT_JOURNEY_VIEW_STATE_V2 });

/** The v2 record; else the v1 record migrated once; else the default. Never throws. */
export function readJourneyViewState(identity: JourneyViewIdentity, storage: Storage | null = journeyStorage()): JourneyViewStateV2 {
  if (!storage) return fresh();
  try {
    const raw = storage.getItem(journeyViewStateKeyV2(identity));
    if (raw) return parseJourneyViewStateV2(JSON.parse(raw)) ?? fresh();
  } catch {
    return fresh();
  }
  try {
    const old = storage.getItem(journeyViewStateKey(identity));
    const v1 = old ? parseJourneyViewStateV1(JSON.parse(old)) : null;
    return v1 ? migrateJourneyViewState(v1) : fresh();
  } catch {
    return fresh();
  }
}

/** False when the storage refused (the in-memory state stays; nothing else happens). */
export function writeJourneyViewState(identity: JourneyViewIdentity, state: JourneyViewStateV2, storage: Storage | null = journeyStorage()): boolean {
  try {
    if (!storage) return false;
    storage.setItem(journeyViewStateKeyV2(identity), JSON.stringify(parseJourneyViewStateV2(state) ?? fresh()));
    return true;
  } catch {
    return false;
  }
}

export type JourneyViewStateStore = {
  /** Restored once, on mount (synchronously, so the first render already shows the restored view). */
  initial: JourneyViewStateV2;
  /** Schedule a write of the latest state (debounced). */
  save(state: JourneyViewStateV2): void;
  /** Write now (before leaving for Horizon; on unmount). */
  flush(): void;
};

/** Restore on mount, debounced write, flush on unmount. `storage` is a test seam. */
export function useJourneyViewStateStore(identity: JourneyViewIdentity, storage?: Storage | null): JourneyViewStateStore {
  const key = journeyViewStateKeyV2(identity);
  const [initial] = useState(() => readJourneyViewState(identity, storage === undefined ? journeyStorage() : storage));
  const pending = useRef<{ state: JourneyViewStateV2; identity: JourneyViewIdentity } | null>(null);
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
  const save = useCallback((state: JourneyViewStateV2) => {
    pending.current = { state, identity: identityRef.current };
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(flush, VIEW_STATE_WRITE_DELAY_MS);
  }, [flush]);
  // A different viewer or household: write what is pending under the old key first.
  useEffect(() => () => flush(), [key, flush]);
  return { initial, save, flush };
}
