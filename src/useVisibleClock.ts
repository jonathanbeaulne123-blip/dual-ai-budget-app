import { useEffect, useState } from "react";

/** Timestamp-derived clock: no hidden timer and no accumulated elapsed counter. */
export function useVisibleClock(periodMs: number | null): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: number | undefined;
    const clear = () => { if (timer !== undefined) window.clearTimeout(timer); timer = undefined; };
    const refresh = () => {
      clear();
      if (document.visibilityState === "hidden") return;
      setNow(new Date());
      if (periodMs !== null) timer = window.setTimeout(refresh, periodMs - Date.now() % periodMs + 1);
    };
    refresh();
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("pageshow", refresh);
    return () => { clear(); document.removeEventListener("visibilitychange", refresh); window.removeEventListener("pageshow", refresh); };
  }, [periodMs]);
  return now;
}
