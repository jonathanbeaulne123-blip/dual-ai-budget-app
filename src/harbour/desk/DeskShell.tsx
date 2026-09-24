import { useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { DateKey } from "../../core/calendar.ts";
import type { Household, LedgerView } from "../../core/types.ts";
import type { ThemeId } from "../../theme/scenes.ts";
import type { HarbourReading } from "../data/reading.ts";
import { DESK_PAGES } from "./pages.ts";
import { flipToHarbour } from "./flip.ts";
import "./desk.css";
import "./desk-personal.css";

/**
 * The Desk (SIMPLE_VIEW_DESK S2) — the app's 2D world, the Harbourmaster's
 * Desk. Flat React and CSS only: no WebGL, no three.js. A header with the
 * flip back to the Harbour, a chip tablist of pages (roving arrow keys, or a
 * horizontal swipe on touch), and the "All tools & places" chip that opens
 * the existing quick sheet. Pages register in `pages.ts`.
 *
 * The Desk reads selectors and opens existing doors. It never posts money.
 */
export type DeskShellProps = {
  household: Household;
  memberId: string;
  scope: LedgerView;
  today: DateKey;
  reading: HarbourReading | null;
  theme?: ThemeId;
  /** flat: the reading edition by choice or by tier; fallback: the Harbour could not be drawn. */
  status?: "flat" | "fallback";
  onOpen: (target: string, object?: string) => void;
  /** The App's quick sheet (all tools, every place, the edition switch). */
  onQuickSheet?: () => void;
  /** Opens the Hercules panel; defaults to the house's own `hercules` door. */
  onTalk?: () => void;
  /** Called after the flip is written; the harbour shell hears the `hearth:motion` event itself. */
  onFlip?: () => void;
  /** Room in the header for the space switch: the App's own household ↔ personal control (S5). */
  spaceSlot?: ReactNode;
  initialPage?: string;
  /**
   * The heading's id. The App's personal mount passes the house's own
   * `house-world-title`, so "Put it back" returns focus to the Desk the way it
   * returns it to the illustrated house.
   */
  titleId?: string;
};

/**
 * The header's words. Personal scope has no harbour (S5): its illustrated
 * world is my own house, and the Desk is my folio's.
 */
export function deskHeaderWords(scope: LedgerView): { kicker: string; title: string; flip: string; flipAria: string } {
  return scope === "personal"
    ? { kicker: "My folio · simple view", title: "My Desk", flip: "My house", flipAria: "My house — flip back to the illustrated house" }
    : { kicker: "Little Harbour · simple view", title: "The Desk", flip: "Harbour", flipAria: "Harbour — flip back to the illustrated Harbour" };
}

const SWIPE_MIN = 56;

export function DeskShell({ household, memberId, scope, today, reading, theme = "classic", status = "flat", onOpen, onQuickSheet, onTalk, onFlip, spaceSlot, initialPage, titleId }: DeskShellProps) {
  const [pageId, setPageId] = useState(() => DESK_PAGES.some(page => page.id === initialPage) ? initialPage! : DESK_PAGES[0]!.id);
  const base = useId();
  const tabs = useRef<HTMLDivElement>(null);
  const swipe = useRef<{ x: number; y: number; id: number } | null>(null);
  const index = Math.max(0, DESK_PAGES.findIndex(page => page.id === pageId));
  const page = DESK_PAGES[index]!;
  const tabId = (id: string) => `${base}-tab-${id}`;
  const panelId = `${base}-panel`;
  const talk = onTalk ?? (() => onOpen("hercules"));
  const harbourDrawable = status !== "fallback";
  const words = deskHeaderWords(scope);
  const headingId = titleId ?? `${base}-title`;

  function select(next: number, focus: boolean) {
    const at = (next + DESK_PAGES.length) % DESK_PAGES.length;
    setPageId(DESK_PAGES[at]!.id);
    if (focus) tabs.current?.querySelectorAll<HTMLElement>('[role="tab"]')[at]?.focus();
  }

  // The FundBoard roving pattern, with selection following focus: the pages are cheap to show.
  function onChipKey(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? DESK_PAGES.length - 1
      : index + (["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 1);
    select(next, true);
  }

  // A horizontal swipe turns the page; a vertical drag is the page scrolling, and is left alone.
  function onSwipeStart(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" || !event.isPrimary) return;
    swipe.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
  }
  function onSwipeEnd(event: ReactPointerEvent<HTMLDivElement>) {
    const start = swipe.current; swipe.current = null;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    select(index + (dx < 0 ? 1 : -1), false);
  }

  function flip() {
    if (!harbourDrawable) return;
    flipToHarbour();
    onFlip?.();
  }

  const Page = page.Page;
  return <section className={`desk desk--${theme}`} data-desk="" data-desk-scope={scope} data-desk-page={page.id} data-desk-status={status} aria-labelledby={headingId}
    onPointerDown={event => event.stopPropagation()}>
    <header className="desk__header">
      <button type="button" className="desk__flip" data-desk-flip="" onClick={flip} aria-disabled={harbourDrawable ? undefined : true}
        aria-describedby={harbourDrawable ? undefined : `${base}-undrawn`}
        aria-label={harbourDrawable ? words.flipAria : `${words.flip} — cannot be drawn on this device`}>
        <span className="desk__flip-mark" aria-hidden="true">{scope === "personal" ? "⌂" : "⚓"}</span><span>{words.flip}</span>
      </button>
      <div className="desk__title">
        <small>{words.kicker}</small>
        <h1 id={headingId} tabIndex={titleId ? -1 : undefined}>{words.title}</h1>
      </div>
      <div className="desk__space" data-desk-slot="space">{spaceSlot}</div>
      {!harbourDrawable && <p className="desk__undrawn" id={`${base}-undrawn`} role="status">The Harbour could not be drawn here. Everything is on the Desk.</p>}
    </header>
    <div className="desk__rail">
      <div className="desk__chips" role="tablist" aria-label="Desk pages" ref={tabs}>
        {DESK_PAGES.map((entry, i) => <button key={entry.id} type="button" role="tab" className="desk__chip" data-desk-chip={entry.id}
          id={tabId(entry.id)} aria-selected={i === index} aria-controls={panelId} tabIndex={i === index ? 0 : -1}
          onKeyDown={onChipKey} onClick={() => select(i, false)}>{entry.chip}</button>)}
      </div>
      {onQuickSheet && <button type="button" className="desk__chip desk__chip--drawer" data-desk-drawer="" aria-haspopup="dialog" onClick={onQuickSheet}>
        <span aria-hidden="true">☰</span><span className="desk__drawer-long">All tools &amp; places</span><span className="desk__drawer-short">Tools</span>
      </button>}
    </div>
    <p className="desk__sign" data-desk-sign="">{page.subtitle({ reading, scope })}</p>
    <div className="desk__page" role="tabpanel" id={panelId} aria-labelledby={tabId(page.id)} tabIndex={-1}
      onPointerDown={onSwipeStart} onPointerUp={onSwipeEnd} onPointerCancel={() => { swipe.current = null; }}>
      <Page key={page.id} household={household} memberId={memberId} scope={scope} today={today} reading={reading} onOpen={onOpen} onTalk={talk} />
    </div>
  </section>;
}
