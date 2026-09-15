import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Hold the house's edits on this device and send them once (2026-09-15).
 *
 * Jonathan: "to prevent stuttering … we should wait until all edits have been
 * made and send one final [save] to the server, not every time something is
 * touched or interacted with." Every shared design change in the house is a
 * whole-row save that is written, journalled and replicated; doing that on
 * each slide of a weight or press of a charm is what made the rooms stutter.
 *
 * So a change is **held**: it shows at once, from the draft, and nothing is
 * written. It is **sent** — once, with whatever the draft is by then — when
 * the person says Done, when they leave the room or put the tool away, when
 * the page is hidden or closed, or when this component goes. The draft yields
 * to the record once the save has settled. The last save still wins, exactly
 * as it does everywhere else in Hearth. Nothing here reads or moves money.
 */
export function useHeldSave<T>(commit: (value: T) => Promise<unknown> | void) {
  const [draft, setDraft] = useState<T | null>(null);
  const [dirty, setDirty] = useState(false);
  const pending = useRef<T | null>(null);
  const commitRef = useRef(commit);
  commitRef.current = commit;
  const generation = useRef(0);

  const flush = useCallback(() => {
    const value = pending.current;
    if (value === null) return false;
    pending.current = null;
    setDirty(false);
    const mine = ++generation.current;
    const settle = () => { if (generation.current === mine && pending.current === null) setDraft(null); };
    try {
      const result = commitRef.current(value);
      if (result && typeof (result as Promise<unknown>).then === "function") void (result as Promise<unknown>).then(settle, settle);
      else settle();
    } catch {
      settle();
    }
    return true;
  }, []);
  const hold = useCallback((value: T) => { pending.current = value; setDraft(value); setDirty(true); }, []);
  const discard = useCallback(() => { pending.current = null; generation.current += 1; setDraft(null); setDirty(false); }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onHidden = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHidden);
      flush();
    };
  }, [flush]);

  return { draft, dirty, hold, flush, discard };
}
