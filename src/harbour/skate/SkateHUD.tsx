/**
 * Tideline Skate Club v2 HUD — a crafted paper object that reads like a skate game.
 *
 * Pass `model` (from `buildHudModel`, throttled by `createHudThrottle` in the
 * runtime) plus the callbacks; `null` shows the entry button. Sound is the
 * shell's: `onSettings({sound})` arrives inside the click so it can create the
 * AudioContext there. See hud/NOTES-show.md for the full contract.
 */
import {useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode} from 'react';
import type {Stance} from './contract.ts';
import type {SkateDeckId, SkateRouteId, SkateSpotId} from './park.ts';
import type {SkateSettings} from './session.ts';
import {createLiveAnnouncer, formatPoints, type SkateHudModel, type TouchZone} from './hud/model.ts';
import {BalanceArc, Hints, LineTicker, NoticeSlip, Radar, RideBadge, RouteCard, SpotBanner, TouchLayout} from './hud/parts.tsx';
import {PauseBook, type BookTab, type TrickBook} from './hud/PauseBook.tsx';
import './skate.css';

export type SkateHUDProps = {
  /** The HUD model. `null` = not skating (shows the entry button). */
  model: SkateHudModel | null;
  onStart(): void;
  onWalk(): void;
  /** Pause the ride. The HUD opens its book while paused and calls onPause(false) when closed. */
  onPause(on: boolean): void;
  onRoute(id: SkateRouteId | null): void;
  onSpot(id: SkateSpotId): void;
  onDeck(id: SkateDeckId): void;
  /** Settings changed in the book. Turning sound on arrives inside the click: create the AudioContext synchronously there. */
  onSettings(patch: Partial<SkateSettings>): void;
  /** Retry (back to marker) and set marker. */
  onCommand(command: 'respawn' | 'marker'): void;
  /** Raw pointer events from touch slots (down/move/up/cancel); the input track interprets them. */
  onZonePointer?(zone: TouchZone, event: ReactPointerEvent<HTMLElement>): void;
  /** SVG path ("-1 -1 2 2" box, y down toward the tail) of a flip's gesture, per stance. */
  gesturePath?(flipId: string, stance: Stance): string | null;
  trickBook?: TrickBook;
  onFocus(): void;
  partnerName?: string | null;
  saveFailed?: boolean;
  presence?: ReactNode;
};

function prefersReduced(): boolean {
  try { return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

export function SkateHUD(p: SkateHUDProps) {
  const model = p.model;

  // The book: open while paused. `tab` remembers where you were.
  const [tab, setTab] = useState<BookTab>('explore'), [bookOpen, setBookOpen] = useState(false);
  const origin = useRef<HTMLElement | null>(null);
  const paused = Boolean(model?.paused);
  useEffect(() => { if (!model) setBookOpen(false); }, [Boolean(model)]);
  const open = bookOpen || paused;
  function openBook(which: BookTab = tab) { origin.current = document.activeElement as HTMLElement | null; setTab(which); setBookOpen(true); p.onPause(true); }
  function closeBook() { setBookOpen(false); p.onPause(false); const back = origin.current; origin.current = null; if (back && back.isConnected && back !== document.body) back.focus({preventScroll: true}); else p.onFocus(); }

  // Polite live region, at most one announcement a second.
  const announcer = useMemo(() => createLiveAnnouncer(1000), []);
  const [live, setLive] = useState(''), seenOutcome = useRef(-1), pending = useRef<string | null>(null);
  useEffect(() => {
    if (!model) return;
    let text: string | null = null;
    if (model.outcome && model.outcome.seq !== seenOutcome.current) { seenOutcome.current = model.outcome.seq; text = model.outcome.kind === 'banked' ? `Banked ${formatPoints(model.outcome.points)} points` : `Line lost. ${model.outcome.text}`; }
    else if (model.line.active && model.line.latest) text = `${model.line.latest}. ${formatPoints(model.line.total)}, times ${model.line.multiplier}`;
    const now = performance.now(), out = announcer.offer(text, now);
    if (out) setLive(out); else if (text) pending.current = text;
  }, [model?.outcome?.seq, model?.line.latest, model?.line.active]);
  useEffect(() => {
    const timer = window.setInterval(() => { if (pending.current) { const out = announcer.offer(pending.current, performance.now()); if (out) { setLive(out); pending.current = null; } } }, 500);
    return () => window.clearInterval(timer);
  }, [announcer]);

  function command(c: 'respawn' | 'marker') { p.onCommand(c); p.onFocus(); }
  function zone(z: TouchZone, e: ReactPointerEvent<HTMLElement>) { p.onZonePointer?.(z, e); }

  const reduced = prefersReduced() || Boolean(model?.settings.reducedEffects);
  if (!model) return <button className="skate-entry" type="button" onPointerDown={e => e.stopPropagation()} onClick={() => { p.onStart(); p.onFocus(); }}>
    <span className="skate-entry__deck" aria-hidden="true"/><span><b>Skate the island</b><small>Your next line starts here · B</small></span><span aria-hidden="true">↗</span>
  </button>;
  const m = model, touch = m.inputDevice === 'touch';
  return <div className="skate-hud" data-skate-phase={m.phase} data-skate-device={m.inputDevice} data-skate-reduced={reduced || undefined} data-skate-open={open || undefined} onPointerDown={e => e.stopPropagation()}>
    <div className="skate-hud__play" inert={open ? true : undefined} aria-hidden={open ? true : undefined}>
      <header className="skate-top">
        <div className="skate-wordmark" aria-label="Tideline Skate Club"><span>Little Harbour</span><b>TIDELINE<span> SKATE CLUB</span></b></div>
        <RideBadge speed={m.speed} stance={m.stance}/>
        <nav className="skate-top__nav" aria-label="Skate session">
          <button type="button" onClick={() => command('respawn')} aria-label="Back to your marker"><span aria-hidden="true">↺</span><span className="skate-top__word">Retry</span></button>
          <button type="button" onClick={() => openBook('challenges')}><span aria-hidden="true">◇</span><span className="skate-top__word">Goals</span><span className="skate-sr"> {m.challenges.done} of {m.challenges.total}</span></button>
          <button type="button" onClick={() => openBook()} aria-label="Pause and open the skate book"><span aria-hidden="true">❚❚</span><span className="skate-top__word">Book</span></button>
        </nav>
      </header>
      <SpotBanner card={m.spotCard}/>
      <NoticeSlip notice={m.notice} saveFailed={p.saveFailed}/>
      {m.run && <RouteCard run={m.run} onEnd={() => { p.onRoute(null); p.onFocus(); }}/>}
      <Radar model={m} partnerName={p.partnerName}/>
      {m.balance && <BalanceArc balance={m.balance}/>}
      <LineTicker line={m.line} outcome={m.outcome}/>
      {!touch && <Hints hints={m.hints}/>}
      {touch && <TouchLayout onZone={zone} onPause={() => openBook()} onRetry={() => command('respawn')}/>}
      <div className="skate-sr" aria-live="polite" aria-atomic="true">{live}</div>
    </div>
    {open && <>
      <div className="skate-book-shade" aria-hidden="true" onClick={closeBook}/>
      <PauseBook model={m} tab={tab} onTab={setTab} onClose={closeBook} onWalk={() => { setBookOpen(false); p.onWalk(); }}
        onRoute={id => { setBookOpen(false); p.onPause(false); p.onRoute(id as SkateRouteId); p.onFocus(); }}
        onSpot={id => { setBookOpen(false); p.onPause(false); p.onSpot(id as SkateSpotId); p.onFocus(); }}
        onDeck={id => p.onDeck(id as SkateDeckId)} onSettings={p.onSettings} onCommand={command}
        trickBook={p.trickBook} gesturePath={p.gesturePath} presence={p.presence} settingsNote={null}/>
    </>}
  </div>;
}
