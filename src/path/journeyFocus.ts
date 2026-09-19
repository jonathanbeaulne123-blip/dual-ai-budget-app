import { useCallback, useMemo, useRef, useState } from "react";
import type { DateKey } from "../core/calendar.ts";
import type { PathLevel } from "./world/pathWorld3d.ts";

/**
 * One shared focus for the two views of the journey: the simple view (the mini
 * 3D map on the page) and the open world (the full island, game mode). Both
 * read and write this one value, so they always say the same thing: what time
 * we're looking at, how far out, and what's picked.
 *
 * Nothing here posts, sums money or persists; it is view state only.
 */
export type JourneyLevel = "day" | "week" | "month" | "era" | "journey";
export const JOURNEY_LEVELS: readonly JourneyLevel[] = ["day", "week", "month", "era", "journey"];
export const JOURNEY_LEVEL_LABEL: Readonly<Record<JourneyLevel, string>> = {
  day: "Day", week: "Week", month: "Month", era: "Era", journey: "Journey",
};

/** Where the focus came from, so a view can ignore its own echo. */
export type JourneyFocusSource = "mini" | "world" | "page";

export type JourneyFocus = {
  level: JourneyLevel;
  /** The civil date in view (Toronto). Month and era levels read its month / era. */
  date: DateKey;
  /**
   * A shared pick id, in the open world's vocabulary where one exists
   * (`month:<index>`, `era:<id>`, `era-home`, `move:<id>`, `bank:<goalId>`, …),
   * or a mini-only id (`bill:<id>@<date>`, `contribution:<id>@<date>`, `task:<id>`).
   */
  selected: string | null;
  source: JourneyFocusSource;
  /** Bumped on every change; lets a view detect a new request for the same value. */
  seq: number;
};

/** The open world's camera levels (0 Sky … 3 Up close) for each journey level. */
export const WORLD_LEVEL_FOR: Readonly<Record<JourneyLevel, PathLevel>> = {
  day: 3, week: 3, month: 2, era: 1, journey: 0,
};
/** The journey level a world camera level reads as (Up close reads as Week: a stone and its neighbours). */
export const JOURNEY_LEVEL_FOR_WORLD: Readonly<Record<PathLevel, JourneyLevel>> = {
  3: "week", 2: "month", 1: "era", 0: "journey",
};

export type JourneyFocusApi = {
  focus: JourneyFocus;
  /** Merge a change; `source` says who asked. */
  set: (change: Partial<Omit<JourneyFocus, "seq" | "source">>, source: JourneyFocusSource) => void;
  /** Back to today at the given level (default: keep the level). */
  toToday: (source: JourneyFocusSource, level?: JourneyLevel) => void;
};

export function useJourneyFocus(today: DateKey, initialLevel: JourneyLevel = "week"): JourneyFocusApi {
  const [focus, setFocus] = useState<JourneyFocus>({ level: initialLevel, date: today, selected: null, source: "page", seq: 0 });
  const todayRef = useRef(today);
  todayRef.current = today;
  const set = useCallback((change: Partial<Omit<JourneyFocus, "seq" | "source">>, source: JourneyFocusSource) => {
    setFocus((prev) => {
      const next = { ...prev, ...change };
      if (next.level === prev.level && next.date === prev.date && next.selected === prev.selected) return prev;
      return { ...next, source, seq: prev.seq + 1 };
    });
  }, []);
  const toToday = useCallback((source: JourneyFocusSource, level?: JourneyLevel) => {
    setFocus((prev) => ({ ...prev, date: todayRef.current, level: level ?? prev.level, selected: null, source, seq: prev.seq + 1 }));
  }, []);
  return useMemo(() => ({ focus, set, toToday }), [focus, set, toToday]);
}
