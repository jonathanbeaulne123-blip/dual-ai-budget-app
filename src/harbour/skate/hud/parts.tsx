/** The skate HUD's pieces. Each is a pure view of `SkateHudModel` slices. */
import {useEffect, useRef, useState, type PointerEvent as ReactPointerEvent} from 'react';
import type {SkateSpotCard, SkateNotice} from '../session.ts';
import {GlyphIcon} from './glyphs.tsx';
import {formatPoints, type ControlHint, type SkateHudModel, type TouchZone} from './model.ts';

/** Keep something on screen for `ms` after its key changes; returns [value, leaving]. */
function useTimedShow<T extends {seq: number}>(item: T | null, ms: number): [T | null, boolean] {
  const [shown, setShown] = useState<T | null>(null), [leaving, setLeaving] = useState(false);
  const seq = item?.seq ?? null;
  useEffect(() => {
    if (!item) return;
    setShown(item); setLeaving(false);
    const out = window.setTimeout(() => setLeaving(true), ms), gone = window.setTimeout(() => setShown(null), ms + 420);
    return () => { window.clearTimeout(out); window.clearTimeout(gone); };
  }, [seq]);
  return [shown, leaving];
}

/* ------------------------------------------------------------------ line ticker */
export function LineTicker({line, outcome}: {line: SkateHudModel['line']; outcome: SkateHudModel['outcome']}) {
  const [result, leaving] = useTimedShow(outcome, 1500);
  const showLine = line.active && line.latest;
  return <div className="skate-ticker" data-state={result ? result.kind : showLine ? 'live' : 'idle'}>
    {showLine && !result && <div className="skate-ticker__stack">
      <div className="skate-ticket-wrap"><div className="skate-ticket skate-ticket--latest" key={line.latest + String(line.chain.length + line.hidden)}>
        <span className="skate-ticket__label">{line.latest}</span>
      </div></div>
      <div className="skate-chain" aria-hidden="true">
        {line.hidden > 0 && <span className="skate-chain__more">+{line.hidden}</span>}
        {line.chain.map((t, i) => <span key={`${i}-${t}`} className="skate-chain__chip">{t}</span>)}
      </div>
      <div className="skate-ticker__score">
        <b>{formatPoints(line.base)}</b><span className="skate-ticker__x">×</span><b className="skate-ticker__mult">{line.multiplier}</b>
        <span className="skate-ticker__eq">= {formatPoints(line.total)}</span>
      </div>
      <div className="skate-fuse" aria-hidden="true"><i style={{transform: `scaleX(${line.keepAlive})`}}/><em style={{left: `${line.keepAlive * 100}%`}}/></div>
    </div>}
    {result && <div className={`skate-result skate-result--${result.kind}${leaving ? ' is-leaving' : ''}`} key={result.seq}>
      {result.kind === 'banked'
        ? <><div className="skate-stamp"><span>BANKED</span></div><b className="skate-result__points">{result.text}</b></>
        : <div className="skate-tear"><span className="skate-tear__half skate-tear__half--a">LOST</span><span className="skate-tear__half skate-tear__half--b">{result.text}</span></div>}
    </div>}
  </div>;
}

/* ------------------------------------------------------------------ balance arc */
export function BalanceArc({balance}: {balance: NonNullable<SkateHudModel['balance']>}) {
  const deg = balance.value * 68;
  const arc = (a0: number, a1: number) => { const r = 44, p = (a: number) => [Math.sin(a * Math.PI / 180) * r, -Math.cos(a * Math.PI / 180) * r]; const [x0, y0] = p(a0), [x1, y1] = p(a1); return `M${x0!.toFixed(2)} ${y0!.toFixed(2)}A${r} ${r} 0 0 1 ${x1!.toFixed(2)} ${y1!.toFixed(2)}`; };
  return <div className={`skate-balance skate-balance--${balance.which}`} role="meter" aria-label={`${balance.label} balance`} aria-valuemin={-100} aria-valuemax={100} aria-valuenow={Math.round(balance.value * 100)}>
    <svg viewBox="-52 -52 104 60" aria-hidden="true">
      <path d={arc(-70, -40)} className="skate-balance__zone skate-balance__zone--edge"/>
      <path d={arc(-40, -14)} className="skate-balance__zone skate-balance__zone--warm"/>
      <path d={arc(-14, 14)} className="skate-balance__zone skate-balance__zone--sweet"/>
      <path d={arc(14, 40)} className="skate-balance__zone skate-balance__zone--warm"/>
      <path d={arc(40, 70)} className="skate-balance__zone skate-balance__zone--edge"/>
      <g style={{transform: `rotate(${deg}deg)`}} className="skate-balance__needle"><path d="M0 4L-2.2 -2L0 -47L2.2 -2Z"/></g>
      <circle r="4.5" className="skate-balance__hub"/>
    </svg>
    <span>{balance.label}</span>
  </div>;
}

/* ------------------------------------------------------------------ speed + stance */
export function RideBadge({speed, stance}: {speed: SkateHudModel['speed']; stance: SkateHudModel['stance']}) {
  return <div className="skate-ride" aria-label={`${speed.value} kilometres an hour, ${stance.stance}${stance.rideLabel ? `, ${stance.rideLabel.toLowerCase()}` : ''}`}>
    <div className="skate-speed"><b>{speed.value}</b><small>km/h</small><i aria-hidden="true" style={{transform: `scaleX(${speed.frac})`}}/></div>
    <div className="skate-stance" aria-hidden="true"><span>{stance.label}</span>{stance.rideLabel && <em data-ride={stance.ride}>{stance.rideLabel}</em>}</div>
  </div>;
}

/* ------------------------------------------------------------------ spot banner */
export function SpotBanner({card}: {card: SkateSpotCard | null}) {
  const [shown, leaving] = useTimedShow(card, 3400);
  if (!shown) return null;
  return <div className={`skate-banner${leaving ? ' is-leaving' : ''}${shown.fresh ? ' is-fresh' : ''}`} key={shown.seq} role="status">
    <div className="skate-banner__paper">
      <span className="skate-banner__eyebrow">{shown.fresh ? 'New spot found' : 'You are at'}</span>
      <b className="skate-banner__name">{shown.name}</b>
      <span className="skate-banner__words">{shown.words}</span>
    </div>
  </div>;
}

export function NoticeSlip({notice, saveFailed}: {notice: SkateNotice | null; saveFailed?: boolean}) {
  const [shown, leaving] = useTimedShow(notice && notice.kind !== 'spot' ? notice : null, 3000);
  return <div className="skate-notice-rail" role="status">
    {shown && <div className={`skate-notice skate-notice--${shown.kind}${leaving ? ' is-leaving' : ''}`} key={shown.seq}>{shown.text}</div>}
    {saveFailed && <small className="skate-notice skate-notice--warn">Progress is only in this session; device saving is unavailable.</small>}
  </div>;
}

/* ------------------------------------------------------------------ radar */
export function Radar({model, partnerName}: {model: SkateHudModel; partnerName?: string | null}) {
  const [bx, bz, bw, bh] = model.map.bounds, r = Math.max(bw, bh) / 70;
  const spot = model.spot;
  return <div className="skate-radar">
    <svg viewBox={`${bx} ${bz} ${bw} ${bh}`} role="img" aria-label={model.run?.target ? 'Map to your next checkpoint' : 'Skate spot map'} preserveAspectRatio="xMidYMid meet">
      <rect x={bx} y={bz} width={bw} height={bh} rx={r * 6} className="skate-radar__paper"/>
      {model.map.route && <polyline points={model.map.route.map(a => a.join(',')).join(' ')} className="skate-radar__route" strokeWidth={r * 1.2} strokeDasharray={`${r * 3} ${r * 3}`}/>}
      {model.spots.map(s => <g key={s.id} transform={`translate(${s.x} ${s.z})`} className={`skate-radar__spot${s.discovered ? ' is-found' : ''}${s.owned ? ' is-owned' : ''}${s.here ? ' is-here' : ''}`}>
        {s.here && <circle r={r * 7} className="skate-radar__here"/>}
        {s.owned ? <path d={`M0 ${-r * 4.5}L${r * 1.3} ${-r * 1.3}L${r * 4.5} 0L${r * 1.3} ${r * 1.3}L0 ${r * 4.5}L${-r * 1.3} ${r * 1.3}L${-r * 4.5} 0L${-r * 1.3} ${-r * 1.3}Z`}/> : <circle r={s.discovered ? r * 3.2 : r * 2}/>}
      </g>)}
      {model.map.target && <circle cx={model.map.target[0]} cy={model.map.target[1]} r={r * 5} className="skate-radar__target" strokeWidth={r * 1.4}/>}
      <path d={`M0 ${r * 5}L${-r * 3.2} ${-r * 3.4}L${r * 3.2} ${-r * 3.4}Z`} transform={`translate(${model.map.x} ${model.map.z}) rotate(${-model.map.yaw * 180 / Math.PI})`} className="skate-radar__you"/>
    </svg>
    {spot ? <ol className="skate-radar__goals" aria-label={`${spot.name} goals`}>
      {spot.goals.map(g => <li key={g.key} data-done={g.done}><span aria-hidden="true">{g.done ? '✦' : '◇'}</span>{g.title}{!g.done && g.progress > 0 && <i style={{transform: `scaleX(${g.progress})`}} aria-hidden="true"/>}</li>)}
    </ol> : <span className="skate-radar__caption">{partnerName ? `Riding with ${partnerName}` : `${model.discovered}/${model.spotTotal} spots · ${model.challenges.done}/${model.challenges.total} goals`}</span>}
  </div>;
}

export function RouteCard({run, onEnd}: {run: NonNullable<SkateHudModel['run']>; onEnd(): void}) {
  return <div className="skate-route-live">
    <b>{run.name}</b><span>{run.label}</span>{run.distance !== null && <small>{run.distance} m to the gold ring</small>}
    <button type="button" aria-label="End route and free skate" onClick={onEnd}>×</button>
  </div>;
}

/* ------------------------------------------------------------------ hints */
export function Hints({hints}: {hints: readonly ControlHint[]}) {
  if (!hints.length) return null;
  return <ul className="skate-hints" aria-label="Controls">
    {hints.map(h => <li key={h.id}><span className="skate-hints__glyphs">{h.glyphs.map((g, i) => <GlyphIcon key={i} glyph={g}/>)}</span><span>{h.label}</span></li>)}
  </ul>;
}

/* ------------------------------------------------------------------ touch */
export type ZonePointer = (zone: TouchZone, event: ReactPointerEvent<HTMLElement>) => void;
const ZONES: {zone: TouchZone; label: string; className: string}[] = [
  {zone: 'left', label: 'Steer and lean: drag', className: 'skate-zone skate-zone--stick skate-zone--left'},
  {zone: 'right', label: 'Board: pull down, flick to pop and flip', className: 'skate-zone skate-zone--stick skate-zone--right'},
  {zone: 'push', label: 'Push', className: 'skate-zone skate-zone--pad skate-zone--push'},
  {zone: 'brake', label: 'Brake, or powerslide while steering', className: 'skate-zone skate-zone--pad skate-zone--brake'},
  {zone: 'grab-front', label: 'Front hand grab', className: 'skate-zone skate-zone--pad skate-zone--grab-front'},
  {zone: 'grab-back', label: 'Back hand grab', className: 'skate-zone skate-zone--pad skate-zone--grab-back'},
];
const SHORT: Record<TouchZone, string> = {left: 'Ride', right: 'Board', push: 'Push', brake: 'Brake', 'grab-front': 'Grab', 'grab-back': 'Grab'};
/** Touch slots only. Raw pointer events go up to the input track's handlers via `onZone`. */
export function TouchLayout({onZone, onPause, onRetry}: {onZone: ZonePointer; onPause(): void; onRetry(): void}) {
  const active = useRef(new Map<number, TouchZone>());
  const [held, setHeld] = useState<ReadonlySet<TouchZone>>(new Set());
  const mark = () => setHeld(new Set(active.current.values()));
  const handlers = (zone: TouchZone) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => { e.stopPropagation(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* synthetic */ } active.current.set(e.pointerId, zone); mark(); onZone(zone, e); },
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => { if (active.current.get(e.pointerId) === zone) onZone(zone, e); },
    onPointerUp: (e: ReactPointerEvent<HTMLElement>) => { active.current.delete(e.pointerId); mark(); onZone(zone, e); },
    onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => { active.current.delete(e.pointerId); mark(); onZone(zone, e); },
    onLostPointerCapture: (e: ReactPointerEvent<HTMLElement>) => { if (active.current.delete(e.pointerId)) { mark(); onZone(zone, e); } },
    onContextMenu: (e: {preventDefault(): void}) => e.preventDefault(),
  });
  return <div className="skate-touch" aria-label="Touch controls">
    {ZONES.map(z => <div key={z.zone} className={z.className} data-skate-zone={z.zone} data-held={held.has(z.zone) || undefined} aria-label={z.label} role="group" {...handlers(z.zone)}>
      {z.zone === 'left' || z.zone === 'right' ? <span className="skate-zone__ring" aria-hidden="true"><i/></span> : null}
      <span className="skate-zone__label" aria-hidden="true">{SHORT[z.zone]}{z.zone === 'grab-front' ? ' ◂' : z.zone === 'grab-back' ? ' ▸' : ''}</span>
    </div>)}
    <div className="skate-touch__corner">
      <button type="button" className="skate-touch__retry" onClick={onRetry} aria-label="Back to your marker">↺</button>
      <button type="button" className="skate-touch__pause" onClick={onPause} aria-label="Pause and open the skate book">❚❚</button>
    </div>
  </div>;
}
