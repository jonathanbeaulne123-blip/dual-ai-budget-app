/** The pause menu: a small paper book with tabs. A modal dialog with a focus trap and Escape. */
import {useEffect, useId, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode} from 'react';
import type {Stance} from '../contract.ts';
import type {SkateSettings} from '../session.ts';
import {GesturePath} from './glyphs.tsx';
import {formatPoints, formatSeconds, formatUnits, type SkateHudModel} from './model.ts';

export type BookTab = 'explore' | 'challenges' | 'tricks' | 'decks' | 'settings';
export const BOOK_TABS: readonly {id: BookTab; label: string; title: string}[] = [
  {id: 'explore', label: 'Explore', title: 'Find your next line'},
  {id: 'challenges', label: 'Challenges', title: 'Own the spot'},
  {id: 'tricks', label: 'Trick book', title: 'Every trick, drawn'},
  {id: 'decks', label: 'Decks', title: 'A board of your own'},
  {id: 'settings', label: 'Settings', title: 'Ride your way'},
];
export type TrickBookEntry = {id: string; name: string; points?: number; detail?: string};
export type TrickBook = {flips: readonly TrickBookEntry[]; grinds?: readonly TrickBookEntry[]; grabs?: readonly TrickBookEntry[]};
/** Shown until the TRICKS catalogs are passed in. Names only, original wording. */
export const FALLBACK_TRICK_BOOK: TrickBook = {
  flips: [{id: 'ollie', name: 'Ollie'}, {id: 'kickflip', name: 'Kickflip'}, {id: 'heelflip', name: 'Heelflip'}, {id: 'pop-shuvit', name: 'Pop shove-it'}, {id: 'varial-kickflip', name: 'Varial kickflip'}, {id: 'tre-flip', name: '360 flip'}],
  grinds: [{id: '50-50', name: '50-50'}, {id: '5-0', name: '5-0'}, {id: 'nosegrind', name: 'Nosegrind'}, {id: 'boardslide', name: 'Boardslide'}],
  grabs: [{id: 'indy', name: 'Indy'}, {id: 'melon', name: 'Melon'}],
};

type Props = {
  model: SkateHudModel; tab: BookTab; onTab(tab: BookTab): void;
  onClose(): void; onWalk(): void;
  onRoute(id: string): void; onSpot(id: string): void; onDeck(id: string): void;
  onSettings(patch: Partial<SkateSettings>): void;
  onCommand?(command: 'respawn' | 'marker'): void;
  trickBook?: TrickBook; gesturePath?(flipId: string, stance: Stance): string | null;
  presence?: ReactNode; settingsNote?: string | null;
};

export function PauseBook(p: Props) {
  const id = useId(), ref = useRef<HTMLElement>(null), closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { closeRef.current?.focus({preventScroll: true}); }, []);
  const m = p.model, meta = BOOK_TABS.find(t => t.id === p.tab)!;
  function onKeyDown(e: ReactKeyboardEvent<HTMLElement>) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); p.onClose(); return; }
    if (e.key === 'Tab') {
      const f = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]')).filter(el => el.tabIndex >= 0);
      const first = f[0], last = f.at(-1);
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    e.stopPropagation();
  }
  function onTabKey(e: ReactKeyboardEvent<HTMLButtonElement>) {
    const i = BOOK_TABS.findIndex(t => t.id === p.tab);
    const next = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? i + 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? BOOK_TABS.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    const tab = BOOK_TABS[(next + BOOK_TABS.length) % BOOK_TABS.length]!;
    p.onTab(tab.id);
    requestAnimationFrame(() => document.getElementById(`${id}-tab-${tab.id}`)?.focus());
  }
  const stance = m.settings.stance;
  const book = p.trickBook ?? FALLBACK_TRICK_BOOK;
  return <section ref={ref} className="skate-book" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} onKeyDown={onKeyDown}>
    <header className="skate-book__head">
      <div><span className="skate-book__eyebrow">Tideline Skate Club · paused</span><h2 id={`${id}-title`}>{meta.title}</h2></div>
      <button type="button" ref={closeRef} className="skate-book__resume" onClick={p.onClose}>Back to the ride</button>
    </header>
    <div className="skate-book__tabs" role="tablist" aria-label="Skate book">
      {BOOK_TABS.map(t => <button key={t.id} type="button" role="tab" id={`${id}-tab-${t.id}`} aria-selected={t.id === p.tab} aria-controls={`${id}-panel`} tabIndex={t.id === p.tab ? 0 : -1} onClick={() => p.onTab(t.id)} onKeyDown={onTabKey}>{t.label}</button>)}
    </div>
    <div className="skate-book__page" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${p.tab}`}>
      {p.tab === 'explore' && <>
        <p>Follow the roads, find every spot, or chase a gold ring. Ride at your own pace; every route is optional.</p>
        <h3>Routes</h3>
        <div className="skate-book__list">{m.routes.map(r => <button type="button" key={r.id} onClick={() => p.onRoute(r.id)}>
          <span><b>{r.name}</b><small>{r.detail}</small></span><span className="skate-book__aside">{r.best ? `Best ${formatSeconds(r.best)}` : `Gold ${r.gold}s`}</span>
        </button>)}</div>
        <h3>The spot book</h3>
        <div className="skate-book__grid">{m.spots.map((s, i) => <button type="button" key={s.id} disabled={!s.discovered && i !== 0} onClick={() => p.onSpot(s.id)}>
          <b>{s.discovered || i === 0 ? s.name : 'Not found yet'}</b><small>{s.discovered ? `${s.goals.filter(g => g.done).length}/3 goals · ride here` : i === 0 ? 'Start at the park' : `Somewhere ${s.x < 0 ? 'west' : 'east'} on the island`}</small>
        </button>)}</div>
        {p.onCommand && <div className="skate-book__row"><button type="button" onClick={() => p.onCommand!('marker')}>Set marker here</button><button type="button" onClick={() => p.onCommand!('respawn')}>Back to marker</button></div>}
        {p.presence && <div className="skate-sharing">{p.presence}</div>}
        <p className="skate-book__note">Explore with Bianca by both turning on Walk together. Her live rider appears while she is sharing this island.</p>
      </>}
      {p.tab === 'challenges' && <>
        <p className="skate-book__tally"><b>{m.challenges.done}</b> of {m.challenges.total} goals · <b>{m.discovered}</b> of {m.spotTotal} spots</p>
        <div className="skate-book__spots">{m.spots.map(s => <article key={s.id} className="skate-goal-card" data-owned={s.owned} data-found={s.discovered}>
          <h4>{s.discovered ? s.name : 'A spot not found yet'}{s.owned && <span className="skate-goal-card__seal" aria-label="Owned">OWNED</span>}</h4>
          <ul>{s.goals.map(g => <li key={g.key} data-done={g.done}>
            <span aria-hidden="true">{g.done ? '✦' : '◇'}</span>
            <span><b>{g.title}</b><small>{g.detail}</small>{!g.done && g.progress > 0 && <i className="skate-goal-card__bar" style={{transform: `scaleX(${g.progress})`}} aria-hidden="true"/>}</span>
            <span className="skate-sr">{g.done ? 'Done' : g.progress > 0 ? `${Math.round(g.progress * 100)} percent` : 'Not yet'}</span>
          </li>)}</ul>
        </article>)}</div>
        <h3>Island stats</h3>
        <dl className="skate-book__stats">
          <div><dt>Biggest line</dt><dd>{formatPoints(m.stats.biggestLine)}</dd></div>
          <div><dt>Longest grind</dt><dd>{formatUnits(m.stats.longestGrind)}</dd></div>
          <div><dt>Longest manual</dt><dd>{formatSeconds(m.stats.longestManual)}</dd></div>
          <div><dt>Biggest air</dt><dd>{formatUnits(m.stats.biggestAir)}</dd></div>
          <div><dt>Biggest spin</dt><dd>{Math.round(m.stats.biggestSpin)}°</dd></div>
          <div><dt>Tricks landed</dt><dd>{m.stats.tricksLanded.toLocaleString('en-CA')}</dd></div>
        </dl>
        <h3>Little milestones</h3>
        <div className="skate-book__stamps">{m.stamps.map(t => <div key={t.id} data-earned={t.earned}><span aria-hidden="true">{t.earned ? '✦' : '◇'}</span><b>{t.name}</b><small>{t.hint}</small><span className="skate-sr">{t.earned ? 'Earned' : 'Not yet'}</span></div>)}</div>
      </>}
      {p.tab === 'tricks' && <>
        <p>Pull the board stick back to crouch, then flick. The path you draw picks the trick. Drawn for {stance === 'goofy' ? 'goofy' : 'regular'} stance: the dot is where you start.</p>
        <h3>Flips</h3>
        <div className="skate-book__tricks">{book.flips.map(f => <div key={f.id} className="skate-trick">
          <GesturePath d={p.gesturePath?.(f.id, stance) ?? null} label={f.name}/><b>{f.name}</b>{f.points ? <small>{formatPoints(f.points)} pts</small> : f.detail ? <small>{f.detail}</small> : null}
        </div>)}</div>
        {book.grinds && book.grinds.length > 0 && <><h3>Grinds and slides</h3><ul className="skate-book__names">{book.grinds.map(g => <li key={g.id}><b>{g.name}</b>{g.detail && <small>{g.detail}</small>}</li>)}</ul></>}
        {book.grabs && book.grabs.length > 0 && <><h3>Grabs</h3><ul className="skate-book__names">{book.grabs.map(g => <li key={g.id}><b>{g.name}</b>{g.detail && <small>{g.detail}</small>}</li>)}</ul></>}
      </>}
      {p.tab === 'decks' && <>
        <p>Every deck rides the same. Find quiet corners of the island, or own a few spots, to collect the rest.</p>
        <div className="skate-book__decks">{m.decks.map(d => <button type="button" key={d.id} disabled={!d.unlocked} aria-pressed={d.selected} onClick={() => p.onDeck(d.id)}>
          <span className="skate-deck-art" style={{background: d.colour, color: d.ink}} aria-hidden="true"><i>H</i><em>HARBOUR</em></span>
          <b>{d.name}</b><small>{d.selected ? 'Under your feet' : d.unlocked ? 'Ready to ride' : d.requirement}</small>
        </button>)}</div>
      </>}
      {p.tab === 'settings' && <div className="skate-book__settings">
        <Choice legend="Stance" help="Which foot leads. Tricks and the trick book follow it." value={m.settings.stance} options={[['regular', 'Regular'], ['goofy', 'Goofy']]} onChange={v => p.onSettings({stance: v as Stance})}/>
        <Choice legend="Controls" help="Flick-it draws tricks with the board stick. Easy keys puts one trick on each key." value={m.settings.controls} options={[['flick', 'Flick-it'], ['easy', 'Easy keys']]} onChange={v => p.onSettings({controls: v as SkateSettings['controls']})}/>
        <Choice legend="Camera" help="How close the chase camera rides." value={m.settings.camera} options={[['near', 'Near'], ['far', 'Far']]} onChange={v => p.onSettings({camera: v as SkateSettings['camera']})}/>
        <Choice legend="Board sound" help="Made on this device; nothing is downloaded." value={m.settings.sound ? 'on' : 'off'} options={[['on', 'On'], ['off', 'Off']]} onChange={v => p.onSettings({sound: v === 'on'})}/>
        <Choice legend="Reduced effects" help="Quiets camera kick, speed widening and big stamps. Your device's reduced-motion setting always applies." value={m.settings.reducedEffects ? 'on' : 'off'} options={[['on', 'On'], ['off', 'Off']]} onChange={v => p.onSettings({reducedEffects: v === 'on'})}/>
        {p.settingsNote && <p className="skate-book__note">{p.settingsNote}</p>}
        <p className="skate-book__note">Scores, spots and settings belong to this person on this device. They never move money or change your household’s Journey.</p>
      </div>}
    </div>
    <footer className="skate-book__foot"><button type="button" onClick={p.onWalk}>Put the board away</button><button type="button" className="skate-book__go" onClick={p.onClose}>Ride</button></footer>
  </section>;
}

function Choice({legend, help, value, options, onChange}: {legend: string; help: string; value: string; options: readonly (readonly [string, string])[]; onChange(v: string): void}) {
  const name = useId();
  return <fieldset className="skate-choice">
    <legend>{legend}</legend>
    <div className="skate-choice__opts">{options.map(([v, label]) => <label key={v} data-checked={v === value}>
      <input type="radio" name={name} value={v} checked={v === value} onChange={() => onChange(v)}/><span>{label}</span>
    </label>)}</div>
    <small>{help}</small>
  </fieldset>;
}
