import { useCallback, useEffect, useMemo, useState } from "react";
import type { DateKey } from "../../core/calendar.ts";
import type { Household, LedgerView } from "../../core/types.ts";
import { miniFund, miniJourneyBase, miniMonth, type MiniFund, type MiniJourneyBase, type MiniMonth } from "./miniJourneyModel.ts";

/**
 * The simple view's read-model, loaded in stages and shared (D-284/D-285).
 *
 * - One entry per household object (the App hands a new object for every change, so an entry is one household
 *   revision) and per member/view/day. The page's simple view, the world's corner minimap and the world's HUD all
 *   read the same entry, so they show the same numbers and nothing is computed twice.
 * - Stages: the journey's shape (eras, months) first, then this month's days, then the Fund's lanes, then the
 *   months either side while the page is idle. Each lands on its own; the map draws what it has.
 * - In a worker where the browser has one (Our Story takes seconds to read); otherwise one stage per task, so the
 *   page still paints between them.
 */
export type MiniLoadOptions = { memberId: string; view: LedgerView; today: DateKey };
export type MiniLoadState = {
  base: MiniJourneyBase | null;
  /** This month in full. */
  month: MiniMonth | null;
  fund: MiniFund | null;
  failed: boolean;
};
type Entry = {
  household: Household;
  options: MiniLoadOptions;
  state: MiniLoadState;
  months: Map<string, MiniMonth>;
  pending: Map<string, Promise<MiniMonth | null>>;
  listeners: Set<() => void>;
  started: boolean;
  timings: Record<string, number>;
};

const entries = new WeakMap<Household, Map<string, Entry>>();
const tokens = new WeakMap<Household, number>();
let nextToken = 1;
const keyOf = (o: MiniLoadOptions) => `${o.memberId}|${o.view}|${o.today}`;

// ---------------------------------------------------------------- the worker (one, shared, created on first use)
type Reply = { id: number; result?: unknown; error?: string };
let worker: Worker | null | undefined;
let postedToken = 0;
let nextId = 1;
const waiting = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
/** Tests and proofs: force the inline path. */
let inlineOnly = false;
export function miniLoaderInlineOnly(on: boolean): void { inlineOnly = on; }

function getWorker(): Worker | null {
  if (inlineOnly) return null;
  if (worker !== undefined) return worker;
  if (typeof Worker !== "function") { worker = null; return null; }
  try {
    worker = new Worker(new URL("./miniJourney.worker.ts", import.meta.url), { type: "module", name: "hearth-journey-mini" });
    worker.onmessage = (event: MessageEvent<Reply>) => {
      const job = waiting.get(event.data.id);
      if (!job) return;
      waiting.delete(event.data.id);
      if (event.data.error !== undefined) job.reject(new Error(event.data.error));
      else job.resolve(event.data.result);
    };
    worker.onerror = (event) => {
      event.preventDefault?.();
      // The worker could not start: every waiting job (and every later one) runs inline instead.
      worker?.terminate();
      worker = null;
      for (const job of waiting.values()) job.reject(new Error("worker failed"));
      waiting.clear();
    };
  } catch { worker = null; }
  return worker;
}

function inWorker<T>(household: Household, options: MiniLoadOptions, message: { kind: "base" } | { kind: "fund" } | { kind: "month"; monthKey: string }): Promise<T> | null {
  const w = getWorker();
  if (!w) return null;
  let token = tokens.get(household);
  if (!token) { token = nextToken++; tokens.set(household, token); }
  const id = nextId++;
  const send = token !== postedToken;
  postedToken = token;
  return new Promise<T>((resolve, reject) => {
    waiting.set(id, { resolve: resolve as (value: unknown) => void, reject });
    try { w.postMessage({ id, token, options, ...message, ...(send ? { household } : {}) }); }
    catch (error) { waiting.delete(id); postedToken = 0; reject(error instanceof Error ? error : new Error(String(error))); }
  });
}

/** One stage: in the worker, or inline on its own task (so the page paints between stages). */
function stage<T>(household: Household, options: MiniLoadOptions, message: Parameters<typeof inWorker>[2], inline: () => T): Promise<T> {
  const remote = inWorker<T>(household, options, message);
  const local = () => new Promise<T>((resolve, reject) => setTimeout(() => { try { resolve(inline()); } catch (error) { reject(error); } }, 0));
  return remote ? remote.catch(local) : local();
}

// ---------------------------------------------------------------- entries
function entryFor(household: Household, options: MiniLoadOptions): Entry {
  let byKey = entries.get(household);
  if (!byKey) { byKey = new Map(); entries.set(household, byKey); }
  let entry = byKey.get(keyOf(options));
  if (!entry) {
    entry = { household, options, state: { base: null, month: null, fund: null, failed: false }, months: new Map(), pending: new Map(), listeners: new Set(), started: false, timings: {} };
    byKey.set(keyOf(options), entry);
  }
  return entry;
}
const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
function update(entry: Entry, patch: Partial<MiniLoadState>) {
  entry.state = { ...entry.state, ...patch };
  for (const listener of entry.listeners) listener();
}

function start(entry: Entry) {
  if (entry.started) return;
  entry.started = true;
  const { household, options } = entry;
  const t0 = now();
  const nowMonth = options.today.slice(0, 7);
  void stage<MiniJourneyBase>(household, options, { kind: "base" }, () => miniJourneyBase(household, options))
    .then((base) => {
      entry.timings.base = now() - t0;
      update(entry, { base });
      return loadMonth(entry, nowMonth);
    })
    .then((month) => {
      entry.timings.month = now() - t0;
      if (!month) throw new Error("Journey month unavailable");
      update(entry, { month });
      return stage<MiniFund>(household, options, { kind: "fund" }, () => miniFund(household, options.memberId, options.today));
    })
    .then((fund) => {
      entry.timings.fund = now() - t0;
      update(entry, { fund });
      // The months either side, while nothing else is asking.
      const base = entry.state.base;
      if (!base) return;
      const at = base.months.findIndex((m) => m.key === nowMonth);
      for (const key of [base.months[at - 1]?.key, base.months[at + 1]?.key]) if (key) idle(() => void loadMonth(entry, key));
    })
    .catch(() => update(entry, { failed: true }));
}

function idle(run: () => void) {
  const ric = (globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (typeof ric === "function") ric(run, { timeout: 2000 });
  else setTimeout(run, 200);
}

function loadMonth(entry: Entry, monthKey: string): Promise<MiniMonth | null> {
  const hit = entry.months.get(monthKey);
  if (hit) return Promise.resolve(hit);
  const pending = entry.pending.get(monthKey);
  if (pending) return pending;
  const base = entry.state.base;
  if (!base) return Promise.resolve(null);
  const { household, options } = entry;
  const job = stage<MiniMonth>(household, options, { kind: "month", monthKey }, () => miniMonth(household, monthKey, { ...options, journey: base }))
    .then((month) => { entry.months.set(monthKey, month); entry.pending.delete(monthKey); for (const l of entry.listeners) l(); return month; })
    .catch(() => { entry.pending.delete(monthKey); return null; });
  entry.pending.set(monthKey, job);
  return job;
}

/** The loaded state for this household (starting the load on first use); `months` holds every month read so far. */
export function useMiniJourneyLoad(household: Household, options: MiniLoadOptions): {
  state: MiniLoadState;
  month: (key: string) => MiniMonth | null;
  request: (key: string) => void;
  timings: Record<string, number>;
  retry: () => void;
} {
  const entry = useMemo(() => entryFor(household, options), [household, options.memberId, options.view, options.today]); // eslint-disable-line react-hooks/exhaustive-deps
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((n) => n + 1);
    entry.listeners.add(listener);
    start(entry);
    return () => { entry.listeners.delete(listener); };
  }, [entry]);
  const month = useCallback((key: string) => entry.months.get(key) ?? null, [entry]);
  const request = useCallback((key: string) => { void loadMonth(entry, key); }, [entry]);
  const retry = useCallback(() => {
    if (!entry.state.failed) return;
    entry.started = false;
    update(entry, { failed: false });
    start(entry);
  }, [entry]);
  return {
    state: entry.state,
    month, request, retry,
    timings: entry.timings,
  };
}

/** Promise form (tests, the proof page): resolves once the journey's shape, this month and the Fund are all read. */
export function loadMiniJourney(household: Household, options: MiniLoadOptions): Promise<MiniLoadState> {
  const entry = entryFor(household, options);
  if (entry.state.failed) return Promise.resolve(entry.state);
  if (entry.state.base && entry.state.month && entry.state.fund) return Promise.resolve(entry.state);
  return new Promise((resolve) => {
    const listener = () => {
      if ((entry.state.base && entry.state.month && entry.state.fund) || entry.state.failed) { entry.listeners.delete(listener); resolve(entry.state); }
    };
    entry.listeners.add(listener);
    start(entry);
  });
}
