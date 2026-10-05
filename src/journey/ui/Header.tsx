/**
 * The map's header (L4), the prototype's shell: "i" (About this map) · ‹ month › · theme dot.
 *
 * - The title is the month name (Month), the year (Year, with the month ‹ › will open under it) or "This week"; the
 *   line under it says whether the chapter is now / earlier / ahead (never a judgement). ‹ › turn the chapter; at the
 *   window's edge they disable. The view announces chapter changes once (its own live region), so the title has none.
 * - Popovers close on Escape, ×, a press outside, and whenever the view bumps `closeSignal`.
 * - "i" opens About this map: the bake revision the island was drawn from and `board.limitations`, with a × close.
 * - The theme dot applies the APP-WIDE theme (ruling 12) through `onChooseTheme`; it is hidden when the App has not
 *   supplied it. Nothing here posts anything.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { JOURNEY_THEMES, type ChapterId, type JourneyLevel, type ThemeId } from "../contracts.ts";
import { THEMES } from "../../theme/scenes.ts";
import { COPY, monthName } from "./copy.ts";

const SWATCH: Record<ThemeId, string> = { classic: "#e2643f", taylor: "#ee7fa2", newfoundland: "#3f88d8" };

export type HeaderProps = {
  level: JourneyLevel;
  chapterId: ChapterId;
  currentChapterId: ChapterId;
  weekRange: string;
  canPrev: boolean;
  canNext: boolean;
  onStep(dir: -1 | 1): void;
  bakeRevision: string | null;
  limitations: readonly string[];
  freshnessNote?: string | null;
  theme: ThemeId;
  onChooseTheme?: (theme: ThemeId) => void;
  /** Bumped by the view on a selection, a level change or a press on the map: the popovers close (UX #11). */
  closeSignal?: number;
  /** A small count chip in the header row (Year and List, where the bubble is not shown: trust M2 / minor 7). */
  countChip?: { words: string; aria: string; onOpen(): void } | null;
};

export function Header(props: HeaderProps) {
  const { level, chapterId, currentChapterId } = props;
  const [about, setAbout] = useState(false);
  const [themes, setThemes] = useState(false);
  const aboutId = useId(), themeId = useId();
  const aboutBtn = useRef<HTMLButtonElement | null>(null), themeBtn = useRef<HTMLButtonElement | null>(null);
  const when = chapterId === currentChapterId ? COPY.now : chapterId < currentChapterId ? COPY.earlier : COPY.ahead;
  // Year names the year ("2026"), with the month ‹ › will open under it (B2, UX #8).
  const title = level === "week" ? COPY.thisWeek : level === "year" ? chapterId.slice(0, 4) : monthName(chapterId);
  const sub = level === "week" ? props.weekRange : level === "year" ? `${COPY.theYear} · ${monthName(chapterId)}` : `${chapterId.slice(0, 4)} · ${when}`;
  const aboutPop = useRef<HTMLElement | null>(null), themePop = useRef<HTMLDivElement | null>(null);
  useEffect(() => { setAbout(false); setThemes(false); }, [props.closeSignal]);
  useEffect(() => {
    if (!about && !themes) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      if (about) { setAbout(false); aboutBtn.current?.focus(); }
      if (themes) { setThemes(false); themeBtn.current?.focus(); }
    };
    // A press outside the open popover (and its own button) closes it, as in the prototype.
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (about && !aboutPop.current?.contains(target) && !aboutBtn.current?.contains(target)) setAbout(false);
      if (themes && !themePop.current?.contains(target) && !themeBtn.current?.contains(target)) setThemes(false);
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onDown, true);
    return () => { document.removeEventListener("keydown", onKey, true); document.removeEventListener("pointerdown", onDown, true); };
  }, [about, themes]);
  // The theme options: one tab stop, arrows move between them (roving tabindex, UX #17).
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const onThemeKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const i = optionRefs.current.findIndex((b) => b === document.activeElement);
    if (i < 0) return;
    const n = JOURNEY_THEMES.length;
    const next = e.key === "ArrowDown" || e.key === "ArrowRight" ? (i + 1) % n : e.key === "ArrowUp" || e.key === "ArrowLeft" ? (i - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    optionRefs.current[next]?.focus();
  };
  useEffect(() => { if (themes) optionRefs.current[Math.max(0, JOURNEY_THEMES.indexOf(props.theme))]?.focus(); }, [themes]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <header className="journey-header" data-journey-header="">
      <div className="journey-header__side">
        <button ref={aboutBtn} type="button" className="journey-toy journey-toy--round" aria-label={COPY.about} aria-expanded={about} aria-controls={aboutId} data-about="" onClick={() => { setAbout((v) => !v); setThemes(false); }}>
          <span aria-hidden="true">i</span>
        </button>
        {about ? (
          <section ref={aboutPop} id={aboutId} className="journey-pop journey-about" role="dialog" aria-modal={false} aria-label={COPY.about} data-about-pane="">
            <button type="button" className="journey-toy journey-toy--round journey-pop__x" aria-label={`${COPY.close} · ${COPY.about}`} onClick={() => { setAbout(false); aboutBtn.current?.focus(); }}><span aria-hidden="true">×</span></button>
            <h2 className="journey-pop__title">{COPY.about}</h2>
            <p className="journey-about__bake">{COPY.aboutBake} <b data-bake-revision="">{props.bakeRevision ?? COPY.aboutNotLoaded}</b>. {COPY.aboutHeights}</p>
            {props.freshnessNote ? <p className="journey-about__fresh" data-freshness="">{props.freshnessNote}</p> : null}
            <h3 className="journey-pop__sub">{COPY.aboutLimits}</h3>
            <ul className="journey-about__limits">{props.limitations.map((l) => <li key={l}>{l}</li>)}</ul>
          </section>
        ) : null}
      </div>
      <div className="journey-chapter">
        <button type="button" className="journey-toy journey-toy--round journey-chapter__step" aria-label={COPY.prevMonth} data-step="-1" disabled={!props.canPrev} onClick={() => props.onStep(-1)}><span aria-hidden="true">‹</span></button>
        <div className="journey-chapter__title" data-chapter-title="">
          <b data-chapter-month="">{title}</b>
          {level === "week" ? (
            <span><span className="journey-chapter__long">{sub}</span><span className="journey-chapter__short" aria-hidden="true">{sub.replace(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun) /g, "")}</span></span>
          ) : <span>{sub}</span>}
        </div>
        <button type="button" className="journey-toy journey-toy--round journey-chapter__step" aria-label={COPY.nextMonth} data-step="1" disabled={!props.canNext} onClick={() => props.onStep(1)}><span aria-hidden="true">›</span></button>
      </div>
      <div className="journey-header__side journey-header__side--end">
        {props.onChooseTheme ? (
          <>
            <button ref={themeBtn} type="button" className="journey-toy journey-toy--round" aria-label={COPY.theme} aria-haspopup="true" aria-expanded={themes} aria-controls={themeId} data-theme-dot="" onClick={() => { setThemes((v) => !v); setAbout(false); }}>
              <span className="journey-swatch" style={{ background: SWATCH[props.theme] }} aria-hidden="true" />
            </button>
            {themes ? (
              <div ref={themePop} id={themeId} className="journey-pop journey-themes" role="radiogroup" aria-label={COPY.theme} onKeyDown={onThemeKey}>
                {JOURNEY_THEMES.map((t, i) => (
                  <button key={t} ref={(el) => { optionRefs.current[i] = el; }} type="button" role="radio" aria-checked={t === props.theme} tabIndex={t === props.theme ? 0 : -1} className="journey-toy journey-themes__option" data-theme-option={t}
                    onClick={() => { props.onChooseTheme?.(t); setThemes(false); themeBtn.current?.focus(); }}>
                    <span className="journey-swatch" style={{ background: SWATCH[t] }} aria-hidden="true" />{THEMES.find((x) => x.id === t)?.name ?? t}
                  </button>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
      {props.countChip ? (
        <div className="journey-header__chips">
          {props.countChip ? (
            <button type="button" className="journey-toy journey-count-chip" aria-label={props.countChip.aria} aria-haspopup="dialog" data-journey-count-chip="" onClick={props.countChip.onOpen}>{props.countChip.words}</button>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
