import { useRef } from "react";
import {
  wideMiniBrowserTabs,
  type InstrumentId,
  type HearthTab,
} from "../core/index.ts";

const CLICK_WAIT_MS = 280;

/**
 * Compact chip strip that replaces the fat bottom nav on wide Home.
 * Single click previews; double click opens the full page.
 */
export function WideMiniBrowser({
  currentTab,
  drawerIds,
  activeInstrument,
  onRoute,
  onPost,
  onInstrument,
}: {
  currentTab: Exclude<HearthTab, "add">;
  drawerIds: InstrumentId[];
  activeInstrument?: InstrumentId | null;
  onRoute: (tab: Exclude<HearthTab, "add">, full: boolean) => void;
  onPost: (full: boolean) => void;
  onInstrument: (id: InstrumentId, full: boolean) => void;
}) {
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tabs = wideMiniBrowserTabs(drawerIds);

  function fire(id: string, full: boolean) {
    if (pending.current) {
      clearTimeout(pending.current);
      pending.current = null;
    }
    const tab = tabs.find((row) => row.id === id);
    if (!tab) return;
    if (tab.kind === "post") {
      onPost(full);
      return;
    }
    if (tab.kind === "route" && tab.route) {
      onRoute(tab.route, full);
      return;
    }
    if (tab.instrument) onInstrument(tab.instrument, full);
  }

  return (
    <nav className="office-wide-tabs" aria-label="Hearth">
      {tabs.map((tab) => {
        const active = tab.kind === "route"
          ? tab.route === currentTab && !activeInstrument
          : tab.instrument != null && tab.instrument === activeInstrument;
        return (
          <button
            key={tab.id}
            type="button"
            className={`office-wide-tab ${tab.kind === "post" ? "is-post" : ""} ${active ? "is-on" : ""}`}
            aria-current={active ? "page" : undefined}
            aria-label={tab.kind === "post" ? "Post. Preview the pad, double-click for Add." : tab.label}
            onClick={() => {
              if (pending.current) clearTimeout(pending.current);
              pending.current = setTimeout(() => fire(tab.id, false), CLICK_WAIT_MS);
            }}
            onDoubleClick={(event) => {
              event.preventDefault();
              fire(tab.id, true);
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
