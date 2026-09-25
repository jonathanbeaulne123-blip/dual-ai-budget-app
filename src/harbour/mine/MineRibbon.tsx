import { useEffect, useState } from "react";
import type { MineSpace } from "./mineLayer.ts";
import "./mine.css";

/**
 * The "Mine" ribbon (Tool Atlas §3.5): a small glass ribbon in the map's
 * top-left corner whenever the harbour shows Mine, so the scope is never a
 * surprise. Driven only by the `space` prop — the Ours | Mine pill and the
 * App's `view` are the source; nothing here persists.
 *
 * Its status line says "Showing Mine" when the ribbon appears. The live region
 * is always mounted and is empty at load (A24: nothing on home is `aria-live`
 * with content at load); the words arrive a tick later, so the change is what
 * is announced. Leaving Mine empties it without a second announcement — the
 * pill announces its own state.
 */
export function MineRibbon({ space }: { space: MineSpace }) {
  const [said, setSaid] = useState("");
  useEffect(() => {
    if (space !== "mine") { setSaid(""); return; }
    const timer = window.setTimeout(() => setSaid("Showing Mine"), 60);
    return () => window.clearTimeout(timer);
  }, [space]);
  return <div className="mine-ribbon-host" data-mine-space={space}>
    {space === "mine" && <p className="mine-ribbon" data-mine-ribbon="">
      <svg className="mine-ribbon__icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
        <path d="M6 3h12v18l-6-4-6 4z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <span className="mine-ribbon__ink">Mine</span>
      <span className="mine-sr"> · only you can see what is drawn here</span>
    </p>}
    <p className="mine-sr" role="status">{said}</p>
  </div>;
}
