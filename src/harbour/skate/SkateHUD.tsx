/**
 * Tideline Skate Club v2 HUD — a crafted paper object that reads like a skate game.
 *
 * v2 props: pass `model` (from `buildHudModel`, throttled by
 * `createHudThrottle`) plus the callbacks. Until integration swaps the sim,
 * HarbourWorld's v1 props still work: with no `model`, the HUD adapts the v1
 * `snapshot` itself (hud/legacy.ts) and drives v1 audio from it.
 * See hud/NOTES-show.md for the full contract.
 */
import {useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode} from 'react';
import type {Stance} from './contract.ts';
import type {SkateDeckId, SkateRouteId, SkateSpotId} from './park.ts';
import type {SkateSettings, SkateSnapshot} from './session.ts';
import type {SkateAction, SkateInput} from './skateModel.ts';
import {createSkateAudio, type SkateAudio} from './audio.ts';
import {buildHudModel, createLiveAnnouncer, deviceFromEvent, formatPoints, type ControlHintSet, type InputDevice, type SkateHudModel, type TouchZone} from './hud/model.ts';
import {createLegacyHudAdapter} from './hud/legacy.ts';
import {BalanceArc, Hints, LineTicker, NoticeSlip, Radar, RideBadge, RouteCard, SpotBanner, TouchLayout} from './hud/parts.tsx';
import {PauseBook, type BookTab, type TrickBook} from './hud/PauseBook.tsx';
import './skate.css';

export type SkateHUDProps = {
  /** v2: the HUD model. `null` = not skating (shows the entry button). Leave undefined to use the v1 `snapshot`. */
  model?: SkateHudModel | null;
  /** v1 compatibility (HarbourWorld today). Ignored when `model` is provided. */
  snapshot?: SkateSnapshot | null;
  onStart(): void;
  onWalk(): void;
  /** Pause the ride. The HUD opens its book while paused and calls onPause(false) when closed. */
  onPause(on: boolean): void;
  onRoute(id: SkateRouteId | null): void;
  onSpot(id: SkateSpotId): void;
  onDeck(id: SkateDeckId): void;
  /** Settings changed in the book. Turning sound on arrives inside the click: create the AudioContext synchronously there. */
  onSettings?(patch: Partial<SkateSettings>): void;
  /** Retry (back to marker) and set marker. */
  onCommand?(command: 'respawn' | 'marker'): void;
  /** Raw pointer events from touch slots (down/move/up/cancel); the input track interprets them. */
  onZonePointer?(zone: TouchZone, event: ReactPointerEvent<HTMLElement>): void;
  /** SVG path ("-1 -1 2 2" box, y down toward the tail) of a flip's gesture, per stance. */
  gesturePath?(flipId: string, stance: Stance): string | null;
  trickBook?: TrickBook;
  /** Device-specific hint overrides from the input track. Only used in v1 mode (v2 bakes them into the model). */
  hints?: ControlHintSet;
  onFocus(): void;
  partnerName?: string | null;
  saveFailed?: boolean;
  presence?: ReactNode;
  /** v1 only. */
  onAction?(action: SkateAction): void;
  onHold?(input: Partial<SkateInput>): void;
};

function initialDevice(): InputDevice {
  try { return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches ? 'touch' : 'keyboard'; } catch { return 'keyboard'; }
}
function prefersReduced(): boolean {
  try { return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

export function SkateHUD(p: SkateHUDProps) {
  const legacyMode = p.model === undefined;
  const [device, setDevice] = useState<InputDevice>(initialDevice);
  const [legacySettings, setLegacySettings] = useState<Partial<SkateSettings>>({});
  const adapter = useMemo(() => createLegacyHudAdapter(), []);
  const audio = useRef<SkateAudio | null>(null);
  const lastFrameAt = useRef(0);

  // v1 → v2: adapt the snapshot, and run v1 audio from it.
  const legacy = useMemo(() => legacyMode ? adapter.frame(p.snapshot ?? null, device) : null, [legacyMode, adapter, p.snapshot, device]);
  const model: SkateHudModel | null = useMemo(() => {
    if (!legacyMode) return p.model ?? null;
    if (!legacy) return null;
    const src = legacy.source;
    const settings = {...src.session.progress.settings, ...legacySettings};
    return buildHudModel({...src, hints: p.hints, session: {...src.session, progress: {...src.session.progress, settings}}});
  }, [legacyMode, p.model, legacy, legacySettings, p.hints]);
  useEffect(() => {
    if (!legacyMode || !legacy) return;
    const now = performance.now(), dt = Math.min(0.25, (now - (lastFrameAt.current || now)) / 1000); lastFrameAt.current = now;
    audio.current?.update(legacy.present, legacy.events, dt, {paused: legacy.source.paused});
  }, [legacyMode, legacy]);
  useEffect(() => () => { audio.current?.dispose(); audio.current = null; }, []);

  // Which device is in use (v1 mode only; v2 gets it from the input track through the model).
  useEffect(() => {
    if (!legacyMode) return;
    const seen = (e: Event) => { const d = deviceFromEvent(e as Event & {pointerType?: string}); if (d) setDevice(prev => prev === d ? prev : d); };
    window.addEventListener('keydown', seen, true); window.addEventListener('pointerdown', seen, true);
    return () => { window.removeEventListener('keydown', seen, true); window.removeEventListener('pointerdown', seen, true); };
  }, [legacyMode]);

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

  function settings(patch: Partial<SkateSettings>) {
    if (p.onSettings) p.onSettings(patch);
    else {
      setLegacySettings(prev => ({...prev, ...patch}));
      if (patch.sound === true && !audio.current) { try { audio.current = createSkateAudio(); } catch { audio.current = null; } }
      if (patch.sound === false) { audio.current?.dispose(); audio.current = null; }
    }
  }
  function command(c: 'respawn' | 'marker') { if (p.onCommand) p.onCommand(c); else p.onAction?.(c); p.onFocus(); }
  // v1 fallback for the touch slots (the v2 input track provides onZonePointer).
  const zoneFallback = useRef<{steerId: number | null; x0: number}>({steerId: null, x0: 0});
  function zone(z: TouchZone, e: ReactPointerEvent<HTMLElement>) {
    if (p.onZonePointer) { p.onZonePointer(z, e); return; }
    const down = e.type === 'pointerdown', up = e.type === 'pointerup' || e.type === 'pointercancel' || e.type === 'lostpointercapture';
    const f = zoneFallback.current;
    if (z === 'push') p.onHold?.(down ? {push: 1} : up ? {push: 0} : {});
    else if (z === 'brake') p.onHold?.(down ? {brake: true} : up ? {brake: false} : {});
    else if (z === 'left') {
      if (down) { f.steerId = e.pointerId; f.x0 = e.clientX; }
      if (f.steerId === e.pointerId) p.onHold?.({steer: up ? 0 : Math.max(-1, Math.min(1, (e.clientX - f.x0) / 50))});
      if (up && f.steerId === e.pointerId) f.steerId = null;
    } else if (z === 'right' && up) p.onAction?.('ollie');
    else if ((z === 'grab-front' || z === 'grab-back') && down) p.onAction?.('grab');
  }

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
        onDeck={id => p.onDeck(id as SkateDeckId)} onSettings={settings} onCommand={p.onCommand || p.onAction ? command : undefined}
        trickBook={p.trickBook} gesturePath={p.gesturePath} presence={p.presence}
        settingsNote={!p.onSettings ? 'Stance, controls and camera take effect with the new board. Sound works now.' : null}/>
    </>}
  </div>;
}
