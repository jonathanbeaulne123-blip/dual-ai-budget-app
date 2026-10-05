/**
 * The level pull (L4): Year · Month · Week buttons over one slider (t 0 → 2), plus the Key (how to read the stacks).
 *
 * - Dragging the slider moves `t` continuously (`onPull(t, false)`); letting go settles on the nearest rest
 *   (`onPull(LEVEL_T[level], true)`). The three words jump straight to a rest. Wheel and pinch on the stage drive the
 *   same pull (JourneyMap). Under reduced motion every change is a cut (the scene ignores `animate`).
 * - The Key explains the ruler of the level being shown (a ring every $100 at Month and Week, every $1,000 at Year),
 *   mint in / gold out, solid = recorded, see-through = not recorded, the honey "!" ring; Year adds the legend
 *   "bills and planned costs on the map, not all spending" (ruling 5). Words beside every swatch — never colour alone.
 */
import { useEffect, useId, useRef, useState } from "react";
import { JOURNEY_LEVELS, LEVEL_T, levelForT, STACK_RULER, type JourneyLevel } from "../contracts.ts";
import { MAP_WORDS } from "../model/index.ts";
import { COPY, LEVEL_WORDS, money } from "./copy.ts";

export type LevelPullProps = {
  t: number;
  onPull(t: number, settle: boolean): void;
};

export function LevelPull({ t, onPull }: LevelPullProps) {
  const level = levelForT(t);
  const [keyOpen, setKeyOpen] = useState(false);
  const keyId = useId(), sliderId = useId();
  const keyBtn = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!keyOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setKeyOpen(false); keyBtn.current?.focus(); } };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [keyOpen]);
  return (
    <>
      <div className="journey-pull" data-journey-pull="">
        <div className="journey-pull__row" role="group" aria-label={COPY.pull}>
          {JOURNEY_LEVELS.map((lv) => (
            <button key={lv} type="button" className="journey-pull__lv" aria-current={lv === level} data-level={lv} onClick={() => onPull(LEVEL_T[lv], true)}>{LEVEL_WORDS[lv]}</button>
          ))}
          <button ref={keyBtn} type="button" className="journey-toy journey-pull__key" aria-expanded={keyOpen} aria-controls={keyId} data-key-button="" onClick={() => setKeyOpen((v) => !v)}>{COPY.key}</button>
        </div>
        <label className="journey-visually-hidden" htmlFor={sliderId}>{COPY.pull}</label>
        <input
          id={sliderId} className="journey-pull__slider" type="range" min={0} max={2} step={0.01} value={t.toFixed(2)} aria-valuetext={LEVEL_WORDS[level]} data-level-slider=""
          onChange={(e) => onPull(Number(e.currentTarget.value), false)}
          onPointerUp={(e) => onPull(LEVEL_T[levelForT(Number(e.currentTarget.value))], true)}
          onKeyUp={(e) => { if (/^Arrow|^Page|^Home$|^End$/.test(e.key)) onPull(LEVEL_T[levelForT(Number(e.currentTarget.value))], true); }}
          onBlur={(e) => { const v = Number(e.currentTarget.value); if (Math.abs(v - LEVEL_T[levelForT(v)]) > 0.001) onPull(LEVEL_T[levelForT(v)], true); }}
        />
      </div>
      {keyOpen ? <Key id={keyId} level={level} onClose={() => { setKeyOpen(false); keyBtn.current?.focus(); }} /> : null}
    </>
  );
}

export function Key({ id, level, onClose }: { id?: string; level: JourneyLevel; onClose(): void }) {
  const ruler = money(STACK_RULER[level].centsPerRing);
  const mw = money(STACK_RULER.month.centsPerRing), yr = money(STACK_RULER.year.centsPerRing);
  return (
    <section id={id} className="journey-pop journey-key" role="dialog" aria-modal={false} aria-label={COPY.keyTitle} data-journey-key={level}>
      <button type="button" className="journey-toy journey-toy--round journey-pop__x" aria-label={`${COPY.close} · ${COPY.keyTitle}`} onClick={onClose}><span aria-hidden="true">×</span></button>
      <h2 className="journey-pop__title">{COPY.keyTitle}</h2>
      <ul className="journey-key__list">
        <li className={level !== "year" ? "is-current" : ""} data-key-row="ruler-month">
          <svg viewBox="0 0 18 22" aria-hidden="true"><rect x="4" y="3" width="10" height="17" rx="2" className="journey-key__accent" /><path d="M4 9h10M4 14h10" className="journey-key__ink" /></svg>
          <span><b>{COPY.keyHeight}</b> Month and Week: one ruler, a ring every <b>{mw}</b>.</span>
        </li>
        <li className={level === "year" ? "is-current" : ""} data-key-row="ruler-year">
          <svg viewBox="0 0 18 22" aria-hidden="true"><rect x="4" y="5" width="10" height="15" rx="2" className="journey-key__honey" /><path d="M4 12h10" className="journey-key__ink" /></svg>
          <span><b>Year:</b> one stack per month, a ring every <b>{yr}</b> — {MAP_WORDS.yearLegend}.</span>
        </li>
        <li data-key-row="mint-gold">
          <svg viewBox="0 0 18 22" aria-hidden="true"><rect x="1" y="6" width="7" height="14" rx="2" fill="#8fe0bd" stroke="#2f8a64" /><rect x="10" y="9" width="7" height="11" rx="2" fill="#ffd158" stroke="#9a6a1c" /></svg>
          <span><b>{COPY.keyMintGold}</b> {COPY.keyMintGoldMore}</span>
        </li>
        <li data-key-row="solid">
          <svg viewBox="0 0 18 22" aria-hidden="true"><rect x="4" y="5" width="10" height="15" rx="2" className="journey-key__solid" /></svg>
          <span><b>Solid</b> — {MAP_WORDS.stack.solid}: paid or received.</span>
        </li>
        <li data-key-row="see-through">
          <svg viewBox="0 0 18 22" aria-hidden="true"><rect x="4" y="5" width="10" height="15" rx="2" fill="none" className="journey-key__dash" /></svg>
          <span><b>See-through</b> — {MAP_WORDS.stack.seeThrough}: planned, expected or due. {MAP_WORDS.stack.unknown}: no stack at all.</span>
        </li>
        <li data-key-row="honey">
          <svg viewBox="0 0 18 22" aria-hidden="true"><ellipse cx="9" cy="17" rx="7.5" ry="3.4" fill="none" className="journey-key__ring" /></svg>
          <span>{COPY.keyHoney}</span>
        </li>
      </ul>
      <p className="journey-key__now">Showing {LEVEL_WORDS[level]} · a ring every {ruler}.</p>
    </section>
  );
}
