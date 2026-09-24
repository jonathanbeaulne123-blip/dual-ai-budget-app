import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type TouchEvent as ReactTouchEvent } from "react";
import { FabSpeedDial } from "../../FabSpeedDial.tsx";
import type { FabAction, FabAddMode } from "../../core/fabActions.ts";
import { MOTION_KEY, chooseMotionEdition, readMotionEdition, type MotionEdition } from "./QuickSheet.tsx";
import "./harbour-nav.css";

/**
 * The one bar (Simple View Desk S1). The Compass's district row (Home · Study ·
 * Kitchen · Making · Together and the big All-tools handle) retired from the
 * harbour: the island's quick-travel bar (`village/VillageHUD.tsx`) is the one
 * bar now —
 *
 *   [Simple view] [⌖ Village map] [Quick travel…] [↗ Look around] [◇ Journey] [+] [All tools]
 *
 * District travel survives through Quick travel, the Village map and All tools.
 *
 * This file keeps the pieces that bar shares with the App:
 * - the **edition flip** (`EditionFlip`, `flipMotionEdition`, `useMotionEdition`)
 *   — the same `hearth:motion` switch the quick sheet has always had;
 * - the **backtick key** (`useEditionFlipKey`), never Tab;
 * - `Compass` itself, cut down to the bar's door edition — [Simple view] [+]
 *   [All tools]. The App mounts it for every household harbour route and it
 *   steps aside while the island's own bar stands (`useIslandBar`), so it only
 *   shows with a tool open in front (the door strip), on the Journey surface,
 *   or while the harbour is still arriving. The + is never more than two
 *   presses away, and there is only ever one bar.
 */
export type CompassDistrict = "home" | "study" | "kitchen" | "making" | "together";

export type CompassFab = {
  actions: readonly FabAction[];
  closedLabel: string;
  onOpenChange: (open: boolean) => void;
  onPick: (mode: FabAddMode) => void;
  onGo: (tab: Extract<FabAction, { kind: "go" }>["tab"]) => void;
  /** Mirrors App's `adding`: the dial stays shut while an entry sheet is open. */
  closed?: boolean;
};

export type CompassProps = {
  fab: CompassFab;
  onQuickSheet: () => void;
  /** App's `fabOpen`, for the `is-fab-open` class the scrim styles key on. */
  fabOpen?: boolean;
};

const TARGET: CSSProperties = { minHeight: 44, minWidth: 44 };
const SWIPE_UP_PX = 40;

/**
 * Whether the island's bar is standing. VillageHUD announces itself while it is
 * mounted with the App's + wired in; the door edition reads it and steps aside.
 * A count, not a flag, so a remount that overlaps an unmount never strands it.
 */
let islandBars = 0;
const islandListeners = new Set<() => void>();
function announceIslandBars(): void { for (const listener of islandListeners) listener(); }
function subscribeIslandBars(listener: () => void): () => void { islandListeners.add(listener); return () => { islandListeners.delete(listener); }; }
const islandBarStanding = (): boolean => islandBars > 0;
const noIslandBar = (): boolean => false;

/** VillageHUD: "the one bar is standing here" while `active`. Layout effect, so the door edition never paints beside it. */
export function useIslandBar(active: boolean): void {
  useLayoutEffect(() => {
    if (!active) return;
    islandBars += 1; announceIslandBars();
    return () => { islandBars -= 1; announceIslandBars(); };
  }, [active]);
}

/** The door edition: is the island's bar standing? */
export function useIslandBarStanding(): boolean {
  return useSyncExternalStore(subscribeIslandBars, islandBarStanding, noIslandBar);
}

/** The key that flips between the two worlds. Never Tab: Tab is focus navigation. */
export const EDITION_FLIP_KEY = "`";

/** Flip to the other edition and tell the harbour. Returns the edition now chosen. */
export function flipMotionEdition(storage?: Pick<Storage, "getItem" | "setItem">): MotionEdition {
  const next: MotionEdition = readMotionEdition(storage) === "flat" ? "illustrated" : "flat";
  chooseMotionEdition(next, storage);
  return next;
}

/** The chosen edition, kept current by the `hearth:motion` event whoever raised it. */
export function useMotionEdition(storage?: Pick<Storage, "getItem">): MotionEdition {
  const [edition, setEdition] = useState<MotionEdition>(() => readMotionEdition(storage));
  useEffect(() => {
    const sync = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      setEdition(detail === "flat" || detail === "illustrated" ? detail : readMotionEdition(storage));
    };
    window.addEventListener(MOTION_KEY, sync);
    return () => window.removeEventListener(MOTION_KEY, sync);
  }, [storage]);
  return edition;
}

/**
 * Which illustrated world the flip goes back to: the household's Harbour, or
 * (personal scope, which has no harbour — Simple View Desk S5) my own house.
 */
export type EditionWorld = "harbour" | "house";

/** The words on the flip for each edition: Jonathan's "Simple view" out, the illustrated world back. */
export function editionFlipWords(edition: MotionEdition, world: EditionWorld = "harbour"): { label: string; aria: string } {
  if (edition !== "flat") return { label: "Simple view", aria: "Switch to the simple view" };
  return world === "house"
    ? { label: "My house", aria: "Switch to the illustrated house" }
    : { label: "Harbour", aria: "Switch to the illustrated harbour" };
}

/**
 * The flip button: the bar's left end in both worlds. It is a plain button
 * whose name says where it goes (not a pressed-state toggle), so a screen
 * reader hears "Switch to the simple view" and then "Switch to the illustrated
 * harbour" — never a state it has to translate.
 */
export function EditionFlip({ className, storage, world = "harbour" }: { className?: string; storage?: Pick<Storage, "getItem" | "setItem">; world?: EditionWorld }) {
  const edition = useMotionEdition(storage);
  const words = editionFlipWords(edition, world);
  return (
    <button
      type="button"
      className={`edition-flip${className ? ` ${className}` : ""}`}
      style={TARGET}
      data-edition-flip={edition}
      aria-label={words.aria}
      title={`${words.label} (\`)`}
      onClick={() => flipMotionEdition(storage)}
    >
      <b aria-hidden="true">{edition === "flat" ? "≋" : "▤"}</b> <span>{words.label}</span>
    </button>
  );
}

/** Pure: would a key typed here be typing? Inputs, textareas, selects, contenteditable, textboxes. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as Element).closest !== "function") return false;
  const element = target as HTMLElement;
  if (element.isContentEditable) return true;
  return element.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"], [role="searchbox"]') !== null;
}

/**
 * Pure: should this keydown flip the edition? Only the backtick, with no
 * modifier (Shift is allowed: some layouts need it), never a repeat or an IME
 * composition, never while typing, and never inside a modal dialog — a dialog
 * that traps focus owns its keys, and the world must not turn under it.
 */
export function editionKeyShouldFlip(event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "repeat" | "isComposing" | "defaultPrevented" | "target">): boolean {
  if (event.key !== EDITION_FLIP_KEY) return false;
  if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || event.isComposing || event.defaultPrevented) return false;
  const targets = [event.target, typeof document === "undefined" ? null : document.activeElement];
  for (const target of targets) {
    if (isTypingTarget(target)) return false;
    if (target && typeof (target as Element).closest === "function" && (target as Element).closest('[aria-modal="true"], dialog[open]')) return false;
  }
  return true;
}

/** Listen for the backtick while `enabled`. The App owns this so it works over the island and on every door. */
export function useEditionFlipKey(enabled: boolean, storage?: Pick<Storage, "getItem" | "setItem">): void {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (!editionKeyShouldFlip(event)) return;
      event.preventDefault();
      flipMotionEdition(storage);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, storage]);
}

/**
 * The bar's + : the App's own FabSpeedDial, byte-identical verbs. Whichever
 * edition of the bar carries it, a + that leaves while open tells the App it
 * shut, so the App's `fabOpen` (which hides the fund ledge) is never stranded.
 */
export function BarFab({ fab }: { fab: CompassFab }) {
  const onOpenChange = useRef(fab.onOpenChange); onOpenChange.current = fab.onOpenChange;
  const open = useRef(false);
  const change = useCallback((next: boolean) => { open.current = next; onOpenChange.current(next); }, []);
  useEffect(() => () => { if (open.current) onOpenChange.current(false); }, []);
  return (
    <FabSpeedDial
      closed={fab.closed}
      actions={fab.actions}
      closedLabel={fab.closedLabel}
      onOpenChange={change}
      onPick={fab.onPick}
      onGo={fab.onGo}
    />
  );
}

/**
 * The bar's door edition: [Simple view] [+] [All tools]. It renders nothing
 * while the island's own bar is standing, and stands in for it otherwise (a
 * tool open in front, the Journey surface, the harbour still arriving). Swipe
 * up, or All tools, opens the quick sheet — every place and every tool.
 */
export function Compass(props: CompassProps) {
  const { fab, onQuickSheet, fabOpen = false } = props;
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const islandBar = useIslandBarStanding();

  function onTouchStart(event: ReactTouchEvent) {
    const touch = event.touches[0];
    touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  }
  function onTouchEnd(event: ReactTouchEvent) {
    const start = touchStart.current; touchStart.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch) return;
    const dx = touch.clientX - start.x, dy = touch.clientY - start.y;
    if (dy <= -SWIPE_UP_PX && Math.abs(dx) < Math.abs(dy)) onQuickSheet();
  }

  if (islandBar) return null;
  return (
    <nav
      className={`nav compass harbour-bar${fabOpen ? " is-fab-open" : ""}`}
      data-ledger-nav="shared"
      data-harbour-bar="door"
      aria-label="Harbour bar"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <EditionFlip className="harbour-bar__flip" />
      <BarFab fab={fab} />
      <button
        type="button"
        className="harbour-bar__tools"
        style={TARGET}
        aria-label="All tools"
        title="All tools (swipe up or press Space)"
        onClick={onQuickSheet}
      >
        <b aria-hidden="true">☰</b> <span>All tools</span>
      </button>
    </nav>
  );
}
