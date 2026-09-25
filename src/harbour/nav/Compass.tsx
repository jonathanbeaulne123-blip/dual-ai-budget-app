import {editionAvailability,useEditionAvailability,editionUnavailableWords} from "./editionAvailability.ts";
import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type TouchEvent as ReactTouchEvent } from "react";
import type { FabAction, FabAddMode } from "../../core/fabActions.ts";
import type { ThemeId } from "../../theme/scenes.ts";
import { GlassBar } from "../bubbles/GlassChrome.tsx";
import { engravedCents } from "../desk/engraved.ts";
import { compactCents, useBarBadges } from "./barBadges.ts";
import { usePageTurn } from "./pageTurn.ts";
import { MOTION_KEY, chooseMotionEdition, readMotionEdition, type MotionEdition } from "./QuickSheet.tsx";
import "./harbour-nav.css";

/**
 * The door edition of the glass (Tool Atlas brief §6): **[Simple view] [Record]
 * [All tools]**, Record centred — the island's three bubbles laid out as a bar.
 * The island stands its glass itself (`village/VillageHUD.tsx` → `GlassChrome`)
 * and announces it (`useIslandBar`); this door edition steps aside while it
 * does, so there is only ever one set: it shows with a tool open in front, on
 * the Journey, or while the harbour is still arriving.
 *
 * This file also keeps what the App shares with the glass:
 * - the **edition flip** for the personal house (`EditionFlip`,
 *   `flipMotionEdition`, `useMotionEdition`) — the same `hearth:motion`
 *   switch the Simple view bubble writes;
 * - the **backtick key** (`useEditionFlipKey`), never Tab.
 *
 * The Hercules pawprint left All tools (brief §3.4): it stands on Hercules on
 * the map now (`barBadges.ts` `useHerculesSuggestion`).
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
  /** The sheet is open: All tools reads as expanded. */
  toolsOpen?: boolean;
  /** Whose label counts the bubbles read, and the glass's dressing and fallbacks. */
  member?: string | null;
  theme?: ThemeId;
  calm?: boolean;
  lite?: boolean;
  alwaysShowLabels?: boolean;
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
  if(editionAvailability().reason) return "flat";
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
 *
 * At rest on the way to the Desk it wears the household's Everyday "Now"
 * (S7), compact, so the button previews the page it opens. The figure is
 * supplementary: the name stays the same, and the full figure is the button's
 * description. Personal scope, and a bar the App has not dressed, wear none.
 */
export function EditionFlip({ className, storage, world = "harbour" }: { className?: string; storage?: Pick<Storage, "getItem" | "setItem">; world?: EditionWorld }) {
  const preference = useMotionEdition(storage);
  const availability = useEditionAvailability();
  const edition = availability.flat ? "flat" : preference;
  const words = editionFlipWords(edition, world);
  const badges = useBarBadges();
  const figureId = useId();
  const wearsFigure = edition !== "flat" && world === "harbour" && badges.scope === "household";
  return (
    <button
      type="button"
      className={`edition-flip${className ? ` ${className}` : ""}`}
      style={TARGET}
      data-edition-flip={edition}
      data-edition-figure={wearsFigure ? (badges.everydayCents === null ? "unknown" : "known") : undefined}
      aria-label={words.aria}
      disabled={Boolean(availability.reason)}
      aria-describedby={wearsFigure ? figureId : undefined}
      title={editionUnavailableWords(availability.reason) ?? `${words.label} (\`)`}
      onClick={() => flipMotionEdition(storage)}
    >
      <b aria-hidden="true">{edition === "flat" ? "≋" : "▤"}</b> <span>{words.label}</span>
      {wearsFigure && <small className="edition-flip__figure" aria-hidden="true">{compactCents(badges.everydayCents)}</small>}
      {wearsFigure && <i className="edition-flip__description" id={figureId} hidden>{`Everyday, now: ${engravedCents(badges.everydayCents)}`}</i>}
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

/**
 * Listen for the backtick while `enabled`. The App owns this so it works over
 * the island and on every door — and with it the page turn (S7), which plays
 * whoever wrote the edition.
 */
export function useEditionFlipKey(enabled: boolean, storage?: Pick<Storage, "getItem" | "setItem">): void {
  // The page turn (S7) is heard wherever the edition is written, so it rides with the key.
  usePageTurn(enabled, storage);
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
 * The door edition: [Simple view] [Record] [All tools]. It renders nothing
 * while the island's own glass is standing. Swipe up, or All tools, opens the
 * All-tools sheet.
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
    <GlassBar
      className={`compass${fabOpen ? " is-fab-open" : ""}`}
      barKind="door"
      fab={fab}
      onOpenTools={onQuickSheet}
      toolsOpen={props.toolsOpen}
      member={props.member}
      theme={props.theme}
      calm={props.calm}
      lite={props.lite}
      alwaysShowLabels={props.alwaysShowLabels}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    />
  );
}
