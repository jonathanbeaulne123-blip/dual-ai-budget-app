import type {ReplayAction} from './replay.ts';
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
import {BalanceMeter, Hints, LineTicker, NoticeSlip, Radar, RideBadge, RouteCard, SpotBanner, TouchLayout} from './hud/parts.tsx';
import {PauseBook, type BookTab, type TrickBook} from './hud/PauseBook.tsx';
import './skate.css';

export type SkateHUDProps = {
  /** The HUD model. `null` = not skating (shows the entry button). */
  model: SkateHudModel | null;
  onStart(): void;
  onReplay?(action:ReplayAction):void;
  onWalk(): void;
  /** Pause the ride. The HUD opens its book while paused and calls onPause(false) when closed. */
  onPause(on: boolean): void;
  onRoute(id: SkateRouteId | null): void;
  onSpot(id: SkateSpotId): void;
  onDeck(id: SkateDeckId): void;
  /** Settings changed in the book. Turning sound on arrives inside the click: create the AudioContext synchronously there. */
  onSettings(patch: Partial<SkateSettings>): void;
  /** Retry (in a race: the last gate, the run kept; otherwise back to your marker) and set marker. */
  onCommand(command: 'respawn' | 'marker' | 'retry'): void;
  /** At a race's finish: open the Fund tool (the same navigation the bank door's tool uses). */
  onOpenFund?(): void;
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
function coarsePointer(): boolean {
  try { return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches; } catch { return false; }
}
/** Below 720 px of stage the HUD is the phone HUD (Hearth's glance branch): one top band, no radar. */
export const SKATE_NARROW = 720;
function useStageWidth(ref: {current: HTMLElement | null}, live: boolean): number {
  const [w, setW] = useState(() => (typeof window === 'undefined' ? 1200 : window.innerWidth || 1200));
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => { const next = Math.round(e?.contentRect.width ?? 0); if (next > 0) setW(next); });
    ro.observe(el);
    return () => ro.disconnect();
  }, [live]);
  return w;
}
/** Touch controls show for a touch device before its first touch (a phone never sends a key), and stop once a key is pressed. */
function useTouchFirst(device: string | undefined): boolean {
  const [keys, setKeys] = useState(false);
  useEffect(() => {
    if (keys) return;
    const on = (e: KeyboardEvent) => { if (!e.isComposing) setKeys(true); };
    window.addEventListener('keydown', on, true);
    return () => window.removeEventListener('keydown', on, true);
  }, [keys]);
  if (device === 'touch') return true;
  if (device === 'gamepad' || device === 'pointer') return false;
  return !keys && coarsePointer();
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
  function closeBook() {
    setBookOpen(false); p.onPause(false);
    const back = origin.current; origin.current = null;
    // The play layer is inert until React re-renders, so hand focus back on the next frame; if it cannot land, the stage takes it (keys ride from there).
    const land = () => { const ok = Boolean(back && back.isConnected && back !== document.body); if (ok) back!.focus({preventScroll: true}); if (!ok || document.activeElement !== back) p.onFocus(); };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(land); else land();
  }

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

  function command(c: 'respawn' | 'marker' | 'retry') { p.onCommand(c); p.onFocus(); }
  function zone(z: TouchZone, e: ReactPointerEvent<HTMLElement>) { p.onZonePointer?.(z, e); }

  const hudRef = useRef<HTMLDivElement>(null);
  const width = useStageWidth(hudRef, Boolean(model));
  const touchFirst = useTouchFirst(model?.inputDevice);
  const reduced = prefersReduced() || Boolean(model?.settings.reducedEffects);
  if (!model) return <button className="skate-entry" type="button" onPointerDown={e => e.stopPropagation()} onClick={() => { p.onStart(); p.onFocus(); }}>
    <span className="skate-entry__deck" aria-hidden="true"/><span><b>Skate the island</b><small>Your next line starts here · B</small></span><span aria-hidden="true">↗</span>
  </button>;
  const m = model, touch = touchFirst, narrow = width < SKATE_NARROW;
  // Phones and touch screens read the line in the top band (the thumbs own the bottom corners);
  // a desktop reads it in the lower-left corner, beside the rider, never on them.
  const band = narrow || touch;
  const ticker = <LineTicker line={m.line} outcome={m.outcome} where={band ? 'band' : 'corner'}/>;
  const notice = <NoticeSlip notice={m.notice} saveFailed={p.saveFailed}/>;
  const route = m.run && <RouteCard run={m.run} onEnd={() => { p.onRoute(null); p.onFocus(); }} onRetry={()=>{p.onRoute(m.run!.id as SkateRouteId);p.onFocus();}} {...(p.onOpenFund ? {onOpenFund: () => p.onOpenFund!()} : {})}/>;
  const racing = Boolean(m.run?.raced && !m.run.finished);
  return <div ref={hudRef} className="skate-hud" data-skate-phase={m.phase} data-skate-device={touch ? 'touch' : m.inputDevice} data-skate-layout={narrow ? 'narrow' : 'wide'} data-skate-reduced={reduced || undefined} data-skate-open={open || undefined} onPointerDown={e => e.stopPropagation()}>
    <div className="skate-hud__play" inert={open ? true : undefined} aria-hidden={open ? true : undefined}>
      <header className="skate-top">
        <div className="skate-top__ride">
          <span className="skate-wordmark" aria-label="Tideline Skate Club">Tideline Skate Club</span>
          <RideBadge speed={m.speed} stance={m.stance}/>
        </div>
        <nav className="skate-top__nav" aria-label="Skate session">
          <button type="button" onClick={() => command(racing ? 'retry' : 'respawn')} aria-label={racing ? 'Retry from the last gate' : 'Back to your marker'}><span aria-hidden="true">↺</span><span className="skate-top__word">Retry</span></button>
          {!racing && <button type="button" onClick={() => openBook('challenges')} aria-label={`Goals, ${m.challenges.done} of ${m.challenges.total}`}><span aria-hidden="true">◇</span><span className="skate-top__word">Goals</span><span className="skate-top__count" aria-hidden="true">{m.challenges.done}/{m.challenges.total}</span></button>}
          <button type="button" onClick={() => openBook()} aria-label="Pause and open the skate book"><span aria-hidden="true">❚❚</span><span className="skate-top__word">Book</span></button>
        </nav>
      </header>
      <div className="skate-band">
        {route}
        {m.replay?.available && p.onReplay && <div className="skate-replay" aria-label="Your device-local best run">
          <span><b>Your best run</b> {m.replay.seconds.toFixed(1)}s <small>On this device only</small></span>
          {m.replay.playing ? <button type="button" onClick={()=>{p.onReplay?.('stop');p.onFocus();}}>Close replay</button> : <button type="button" disabled={reduced||m.replay.reduced||Boolean(m.run&&!m.run.finished)} onClick={()=>{p.onReplay?.('play');p.onFocus();}}>Watch replay</button>}
          <button type="button" aria-pressed={m.replay.ghostEnabled} disabled={reduced||m.replay.reduced} onClick={()=>{p.onReplay?.('toggle-ghost');p.onFocus();}}>{m.replay.ghostEnabled?'Hide ghost':'Race your ghost'}</button>
          {(reduced||m.replay.reduced) && <small>Moving replay and ghost are off with reduced motion.</small>}
          {m.replay.playing && <><small role="timer">Replay · {m.replay.time.toFixed(1)} / {m.replay.seconds.toFixed(1)}s</small><ReplayMap path={m.replay.path} pose={m.replay.pose}/></>}
        </div>}
        {band && ticker}
        <SpotBanner card={m.spotCard}/>
        {band && notice}
      </div>
      {!narrow && <Radar model={m} partnerName={p.partnerName}/>}
      {m.balance && <BalanceMeter balance={m.balance}/>}
      {!band && <div className="skate-corner">{notice}{ticker}</div>}
      {!touch && !narrow && <Hints hints={m.hints}/>}
      {touch && <TouchLayout onZone={zone}/>}
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

/** Small, phone-readable course overview; replay motion comes from the shared world frame. */
function ReplayMap({path,pose}:{path:readonly (readonly [number,number])[];pose:import('./replay.ts').GhostPose|null}){
  if(!path.length)return null;
  const xs=path.map(p=>p[0]),zs=path.map(p=>p[1]),x=Math.min(...xs)-8,z=Math.min(...zs)-8,w=Math.max(...xs)-x+8,h=Math.max(...zs)-z+8,r=Math.max(w,h)/65;
  return <svg className="skate-replay__map" viewBox={`${x} ${z} ${w} ${h}`} role="img" aria-label="Replay of your best completed route"><polyline points={path.map(p=>p.join(',')).join(' ')} fill="none" stroke="currentColor" strokeWidth={r}/>{pose&&<circle cx={pose.x} cy={pose.z} r={r*2.2} fill="currentColor"/>}</svg>;
}
