/**
 * The chapter strip (T4): past · now · ahead, one button per chapter (it frames that chapter — browsing never moves
 * the household piece), the Map / List choice, and **Back to now**. Words carry the state; colour only repeats it.
 */
import { useEffect, useRef, type ReactNode } from "react";
import type { Chapter } from "../contracts.ts";
import { CHAPTER_STATE_WORDS, COPY, shortMonth } from "./copy.ts";

export type ChapterStripProps = {
  chapters: readonly Chapter[];
  /** The chapter the view is on (focus date's month), highlighted. */
  focusedChapterId: string;
  onChapter(id: string): void;
  onBackToNow(): void;
  /** The Map / List toggle (keyboard order: chapters → Map/List → Back to now). */
  children?: ReactNode;
};

export function ChapterStrip({ chapters, focusedChapterId, onChapter, onBackToNow, children }: ChapterStripProps) {
  // Keep the focused chapter in the strip's view (a narrow phone shows four or five), without scrolling the page.
  const list = useRef<HTMLOListElement | null>(null);
  useEffect(() => {
    const ol = list.current;
    if (!ol) return;
    const centre = () => {
      const chip = ol.querySelector<HTMLElement>(`[data-chapter-id="${focusedChapterId}"]`);
      if (!chip || ol.scrollWidth <= ol.clientWidth) return;
      ol.scrollLeft = Math.max(0, chip.offsetLeft - ol.offsetLeft - (ol.clientWidth - chip.offsetWidth) / 2);
    };
    centre();
    // A rotation or a resized window changes how many chips fit: centre the focused one again (only on a size change,
    // so a person scrolling the strip by hand is never pulled back).
    if (typeof ResizeObserver === "undefined") return;
    let width = ol.clientWidth;
    const observer = new ResizeObserver(() => { if (ol.clientWidth !== width) { width = ol.clientWidth; centre(); } });
    observer.observe(ol);
    return () => observer.disconnect();
  }, [focusedChapterId, chapters.length]);
  return (
    <nav className="journey-strip" aria-label="Chapters">
      <ol className="journey-strip__chapters" ref={list}>
        {chapters.map((c) => {
          const n = c.unresolved.attention;
          return (
            <li key={c.id}>
              <button
                type="button"
                className={[`journey-strip__chapter`, `journey-strip__chapter--${c.state}`, c.id === focusedChapterId ? "is-focused" : ""].filter(Boolean).join(" ")}
                data-chapter-id={c.id}
                aria-current={c.state === "open" ? "date" : undefined}
                aria-label={`${c.label} · ${CHAPTER_STATE_WORDS[c.state]}${n ? ` · ${n} need${n === 1 ? "s" : ""} attention` : ""}`}
                onClick={() => onChapter(c.id)}
              >
                <span className="journey-strip__month" aria-hidden="true">{shortMonth(c.id)}</span>
                {c.state === "open" ? <span className="journey-strip__now-word" aria-hidden="true">{CHAPTER_STATE_WORDS.open}</span> : null}
                {n ? <span className="journey-strip__count" aria-hidden="true">{n}</span> : null}
              </button>
            </li>
          );
        })}
      </ol>
      <div className="journey-strip__tools">
        {children}
        <button type="button" className="journey-strip__back" data-back-to-now="" onClick={onBackToNow}>{COPY.backToNow}</button>
      </div>
    </nav>
  );
}
