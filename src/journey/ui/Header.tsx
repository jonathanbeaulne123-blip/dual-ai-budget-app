/**
 * The map's header (L4), the prototype's shell: "i" (About this map) · ‹ month › · theme dot.
 *
 * - The title is the month name (Month / Year) or "This week" (Week); the line under it says the year and whether the
 *   chapter is now / earlier / ahead (never a judgement). ‹ › turn the chapter; at the window's edge they disable.
 * - "i" opens About this map: the bake revision the island was drawn from and `board.limitations`, with a × close.
 * - The theme dot applies the APP-WIDE theme (ruling 12) through `onChooseTheme`; it is hidden when the App has not
 *   supplied it. Nothing here posts anything.
 */
import { useEffect, useId, useRef, useState } from "react";
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
};

export function Header(props: HeaderProps) {
  const { level, chapterId, currentChapterId } = props;
  const [about, setAbout] = useState(false);
  const [themes, setThemes] = useState(false);
  const aboutId = useId(), themeId = useId();
  const aboutBtn = useRef<HTMLButtonElement | null>(null), themeBtn = useRef<HTMLButtonElement | null>(null);
  const when = chapterId === currentChapterId ? COPY.now : chapterId < currentChapterId ? COPY.earlier : COPY.ahead;
  const title = level === "week" ? COPY.thisWeek : monthName(chapterId);
  const sub = level === "week" ? props.weekRange : `${chapterId.slice(0, 4)} · ${level === "year" ? `${COPY.theYear} · ` : ""}${when}`;
  useEffect(() => {
    if (!about && !themes) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      if (about) { setAbout(false); aboutBtn.current?.focus(); }
      if (themes) { setThemes(false); themeBtn.current?.focus(); }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [about, themes]);
  return (
    <header className="journey-header" data-journey-header="">
      <div className="journey-header__side">
        <button ref={aboutBtn} type="button" className="journey-toy journey-toy--round" aria-label={COPY.about} aria-expanded={about} aria-controls={aboutId} data-about="" onClick={() => { setAbout((v) => !v); setThemes(false); }}>
          <span aria-hidden="true">i</span>
        </button>
        {about ? (
          <section id={aboutId} className="journey-pop journey-about" role="dialog" aria-modal={false} aria-label={COPY.about} data-about-pane="">
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
        <div className="journey-chapter__title" aria-live="polite" data-chapter-title="">
          <b data-chapter-month="">{title}</b>
          <span>{sub}</span>
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
              <div id={themeId} className="journey-pop journey-themes" role="radiogroup" aria-label={COPY.theme}>
                {JOURNEY_THEMES.map((t) => (
                  <button key={t} type="button" role="radio" aria-checked={t === props.theme} className="journey-toy journey-themes__option" data-theme-option={t}
                    onClick={() => { props.onChooseTheme?.(t); setThemes(false); themeBtn.current?.focus(); }}>
                    <span className="journey-swatch" style={{ background: SWATCH[t] }} aria-hidden="true" />{THEMES.find((x) => x.id === t)?.name ?? t}
                  </button>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </header>
  );
}
