/**
 * The skate HUD's whole world, as plain data.
 *
 * `buildHudModel(source)` turns sim + scorer + session state into exactly what
 * the HUD draws. Numbers are quantised so two models built a frame apart are
 * usually identical (`model.sig`), and `createHudThrottle` publishes to React
 * at most every `minMs` unless something the player must see *now* changed
 * (a new trick label, a banked/lost line, a phase change, a spot banner, pause).
 */
import type {ScoreLine, ScoreOutcome, SkatePhase, SkatePresent, Stance} from '../contract.ts';
import {
  SKATE_STAMPS, deckRequirement, deckUnlocked, skateTables, spotGoals,
  type SkateNotice, type SkateProgress, type SkateRun, type SkateSettings, type SkateSpotCard, type SkateStats, type SkateTables,
} from '../session.ts';

export type InputDevice = 'keyboard' | 'pointer' | 'touch' | 'gamepad';
export type TouchZone = 'left' | 'right' | 'push' | 'brake' | 'grab-front' | 'grab-back';
export type PadButton = 'south' | 'east' | 'west' | 'north' | 'lb' | 'rb' | 'lt' | 'rt' | 'ls' | 'rs' | 'menu';
export type StickMotion = 'any' | 'down-up' | 'down-side' | 'hold-down' | 'hold-up' | 'side';
/** Original, brand-neutral control glyphs. The HUD draws each as a small SVG. */
export type Glyph =
  | {kind: 'key'; label: string}
  | {kind: 'mouse'; motion: 'drag' | 'flick' | 'click'}
  | {kind: 'pad'; button: PadButton}
  | {kind: 'stick'; side: 'left' | 'right'; motion: StickMotion}
  | {kind: 'touch'; zone: TouchZone};
export type ControlHint = {id: string; glyphs: readonly Glyph[]; label: string};
export type ControlHintSet = Partial<Record<InputDevice, Partial<Record<HintContext, readonly ControlHint[]>>>>;
export type HintContext = 'ride' | 'air' | 'grind' | 'manual' | 'bail';

export type HudGoal = {key: string; title: string; detail: string; done: boolean; progress: number};
export type HudSpot = {id: string; name: string; words: string; x: number; z: number; discovered: boolean; owned: boolean; here: boolean; goals: HudGoal[]};
export type SkateHudModel = {
  /** Quantised signature: equal sig ⇒ nothing visible changed. */
  sig: string;
  active: boolean; paused: boolean; phase: SkatePhase;
  speed: {value: number; frac: number};
  stance: {stance: Stance; label: 'REG' | 'GOOFY'; ride: 'normal' | 'switch' | 'fakie'; rideLabel: 'SWITCH' | 'FAKIE' | null};
  balance: null | {which: 'grind' | 'manual'; value: number; label: string};
  line: {active: boolean; latest: string | null; chain: string[]; hidden: number; base: number; multiplier: number; total: number; keepAlive: number};
  outcome: null | {seq: number; kind: 'banked' | 'lost'; points: number; text: string};
  spotCard: SkateSpotCard | null;
  notice: SkateNotice | null;
  /** The spot you are standing in, with its goals. */
  spot: HudSpot | null;
  run: null | {id: string; name: string; label: string; finished: boolean; countdown: number; gate: number; gates: number; target: readonly [number, number] | null; distance: number | null};
  map: {x: number; z: number; yaw: number; bounds: [number, number, number, number]; route: readonly (readonly [number, number])[] | null; target: readonly [number, number] | null};
  spots: HudSpot[];
  challenges: {done: number; total: number};
  stats: SkateStats;
  stamps: {id: string; name: string; hint: string; earned: boolean}[];
  decks: {id: string; name: string; colour: string; ink: string; unlocked: boolean; selected: boolean; requirement: string}[];
  routes: {id: string; name: string; detail: string; best: number | null; gold: number}[];
  bestLine: number; discovered: number; spotTotal: number;
  inputDevice: InputDevice; hints: readonly ControlHint[]; settings: SkateSettings;
  message: string;
};

export type HudSessionView = {
  progress: SkateProgress; run: SkateRun | null; message: string; revision: number;
  spotId: string | null; spotCard: SkateSpotCard | null; notice?: SkateNotice | null; goalProgress?: Record<string, number>;
};
export type HudSource = {
  present: SkatePresent | null;
  line: ScoreLine | null;
  /** The newest resolved line and a sequence number that changes per outcome. */
  outcome: {outcome: ScoreOutcome; seq: number} | null;
  session: HudSessionView;
  paused: boolean;
  inputDevice: InputDevice;
  /** Display name for a grind id (TRICKS catalog); falls back to title-casing the id. */
  grindName?: (grindId: string) => string;
  hints?: ControlHintSet;
  tables?: SkateTables;
};

/* ------------------------------------------------------------------ formatting */
const compact = new Intl.NumberFormat('en-CA', {notation: 'compact', maximumFractionDigits: 1});
export const formatPoints = (n: number): string => { const v = Number.isFinite(n) ? Math.max(0, n) : 0; return v >= 10000 ? compact.format(v) : Math.round(v).toLocaleString('en-CA'); };
export const formatSeconds = (s: number): string => `${(Number.isFinite(s) ? Math.max(0, s) : 0).toFixed(1)}s`;
export const formatUnits = (u: number): string => `${(Number.isFinite(u) ? Math.max(0, u) : 0).toFixed(1)} m`;
export const titleCase = (id: string): string => id.split(/[-_ ]+/).filter(Boolean).map(w => /^\d/.test(w) ? w : w[0]!.toUpperCase() + w.slice(1)).join(' ');
const q = (v: number, step: number) => { const n = Number.isFinite(v) ? Math.round(v / step) * step : 0; return Math.abs(n) < 1e-9 ? 0 : +n.toFixed(4); };
export const SPEED_DISPLAY = 3.6, SPEED_FULL = 12;

/* ------------------------------------------------------------------ hints */
const k = (label: string): Glyph => ({kind: 'key', label});
const pad = (button: PadButton): Glyph => ({kind: 'pad', button});
const stick = (side: 'left' | 'right', motion: StickMotion): Glyph => ({kind: 'stick', side, motion});
const touch = (zone: TouchZone): Glyph => ({kind: 'touch', zone});
/**
 * Default hints. The TRICKS track owns the real bindings; integration passes
 * them as `hints` (same shape) and these are only the fallback wording.
 */
export const DEFAULT_HINTS: Record<InputDevice, Record<HintContext, readonly ControlHint[]>> = {
  keyboard: {
    ride: [{id: 'push', glyphs: [k('W')], label: 'Push'}, {id: 'carve', glyphs: [k('A'), k('D')], label: 'Carve'}, {id: 'pop', glyphs: [k('↓'), k('↑')], label: 'Crouch, flick to pop'}, {id: 'flip', glyphs: [k('↓'), k('←'), k('→')], label: 'Flick sideways to flip'}],
    air: [{id: 'grab', glyphs: [k('Q'), k('E')], label: 'Grab'}, {id: 'spin', glyphs: [k('A'), k('D')], label: 'Spin'}, {id: 'grind', glyphs: [k('G')], label: 'Lock onto a rail'}],
    grind: [{id: 'balance', glyphs: [k('A'), k('D')], label: 'Balance'}, {id: 'out', glyphs: [k('↓'), k('↑')], label: 'Pop out'}],
    manual: [{id: 'balance', glyphs: [k('↑'), k('↓')], label: 'Balance'}, {id: 'out', glyphs: [k('↓'), k('↑')], label: 'Pop out'}],
    bail: [{id: 'reset', glyphs: [k('R')], label: 'Back to your marker'}],
  },
  pointer: {
    ride: [{id: 'push', glyphs: [k('W')], label: 'Push'}, {id: 'carve', glyphs: [k('A'), k('D')], label: 'Carve'}, {id: 'pop', glyphs: [{kind: 'mouse', motion: 'flick'}], label: 'Drag down, flick up to pop'}, {id: 'flip', glyphs: [{kind: 'mouse', motion: 'drag'}], label: 'Flick sideways to flip'}],
    air: [{id: 'grab', glyphs: [{kind: 'mouse', motion: 'click'}], label: 'Hold to grab'}, {id: 'spin', glyphs: [k('A'), k('D')], label: 'Spin'}],
    grind: [{id: 'balance', glyphs: [k('A'), k('D')], label: 'Balance'}, {id: 'out', glyphs: [{kind: 'mouse', motion: 'flick'}], label: 'Pop out'}],
    manual: [{id: 'balance', glyphs: [{kind: 'mouse', motion: 'drag'}], label: 'Balance'}],
    bail: [{id: 'reset', glyphs: [k('R')], label: 'Back to your marker'}],
  },
  gamepad: {
    ride: [{id: 'push', glyphs: [pad('south')], label: 'Push'}, {id: 'carve', glyphs: [stick('left', 'side')], label: 'Carve'}, {id: 'pop', glyphs: [stick('right', 'down-up')], label: 'Pop'}, {id: 'flip', glyphs: [stick('right', 'down-side')], label: 'Flip'}],
    air: [{id: 'grab', glyphs: [pad('lt'), pad('rt')], label: 'Grab'}, {id: 'spin', glyphs: [stick('left', 'side')], label: 'Spin'}],
    grind: [{id: 'balance', glyphs: [stick('left', 'side')], label: 'Balance'}, {id: 'out', glyphs: [stick('right', 'down-up')], label: 'Pop out'}],
    manual: [{id: 'balance', glyphs: [stick('right', 'hold-down')], label: 'Balance'}],
    bail: [{id: 'reset', glyphs: [pad('north')], label: 'Back to your marker'}],
  },
  touch: {
    ride: [{id: 'push', glyphs: [touch('push')], label: 'Push'}, {id: 'carve', glyphs: [touch('left')], label: 'Steer'}, {id: 'pop', glyphs: [touch('right')], label: 'Pull down, flick up'}],
    air: [{id: 'grab', glyphs: [touch('grab-front'), touch('grab-back')], label: 'Grab'}],
    grind: [{id: 'balance', glyphs: [touch('left')], label: 'Balance'}],
    manual: [{id: 'balance', glyphs: [touch('right')], label: 'Hold gently'}],
    bail: [],
  },
};
const HINT_CONTEXT: Record<SkatePhase, HintContext> = {idle: 'ride', push: 'ride', roll: 'ride', crouch: 'ride', land: 'ride', powerslide: 'ride', recover: 'ride', air: 'air', grind: 'grind', manual: 'manual', bail: 'bail'};
export function controlHints(device: InputDevice, phase: SkatePhase, override?: ControlHintSet): readonly ControlHint[] {
  const ctx = HINT_CONTEXT[phase] ?? 'ride';
  return override?.[device]?.[ctx] ?? DEFAULT_HINTS[device]?.[ctx] ?? DEFAULT_HINTS.keyboard.ride;
}
/** Which device the player used last, from a DOM event. `gamepad` comes from the input track's poller. */
export function deviceFromEvent(e: {type: string; pointerType?: string}): InputDevice | null {
  if (e.type.startsWith('key')) return 'keyboard';
  if (e.type.startsWith('pointer') || e.type.startsWith('touch') || e.type.startsWith('mouse')) return e.pointerType === 'touch' || e.type.startsWith('touch') ? 'touch' : 'pointer';
  return null;
}

/* ------------------------------------------------------------------ build */
const EMPTY_LINE: ScoreLine = {active: false, tricks: [], base: 0, multiplier: 1, keepAlive: 0, latest: null};
const LOST: Record<string, string> = {'flip-not-caught': 'Missed the catch', 'bad-angle': 'Landed sideways', 'hard-impact': 'Too hard', balance: 'Lost balance', wall: 'Hit a wall', water: 'In the drink'};
export const lostText = (reason: string): string => LOST[reason] ?? (reason ? reason[0]!.toUpperCase() + reason.slice(1) : 'Line lost');

export function buildHudModel(src: HudSource): SkateHudModel {
  const t = src.tables ?? skateTables();
  const p = src.present, s = src.session, prog = s.progress, gp = s.goalProgress ?? {};
  const line = src.line ?? EMPTY_LINE;
  const phase: SkatePhase = p?.phase ?? 'idle';
  const speedRaw = p ? Math.max(0, Number.isFinite(p.speed) ? p.speed : 0) : 0;
  const speed = {value: Math.round(speedRaw * SPEED_DISPLAY), frac: q(Math.min(1, speedRaw / SPEED_FULL), 0.05)};
  const stanceV: Stance = p?.stance ?? prog.settings.stance;
  const ride = p?.switch ? 'switch' : p?.fakie ? 'fakie' : 'normal';
  const stance = {stance: stanceV, label: stanceV === 'goofy' ? 'GOOFY' as const : 'REG' as const, ride: ride as 'normal' | 'switch' | 'fakie', rideLabel: ride === 'switch' ? 'SWITCH' as const : ride === 'fakie' ? 'FAKIE' as const : null};
  let balance: SkateHudModel['balance'] = null;
  if (p && (phase === 'grind' || phase === 'manual')) {
    const which = phase === 'grind' ? 'grind' as const : 'manual' as const;
    const label = which === 'grind' ? (p.grind ? (src.grindName?.(p.grind.grindId) ?? titleCase(p.grind.grindId)) : 'Grind') : p.manual === 'nose-manual' ? 'Nose manual' : 'Manual';
    balance = {which, value: q(Math.max(-1, Math.min(1, p.balance)), 0.02), label};
  }
  const tricks = line.tricks.map(tr => tr.label);
  const chain = tricks.slice(-5);
  const total = Math.round(Math.max(0, line.base) * Math.max(1, line.multiplier));
  const hudLine = {active: line.active, latest: line.latest, chain, hidden: Math.max(0, tricks.length - chain.length), base: Math.round(Math.max(0, line.base)), multiplier: Math.max(1, Math.round(line.multiplier * 10) / 10), total, keepAlive: q(Math.max(0, Math.min(1, line.keepAlive)), 0.02)};
  const o = src.outcome;
  const outcome = o ? {seq: o.seq, kind: o.outcome.kind, points: Math.round(o.outcome.points), text: o.outcome.kind === 'banked' ? `+${formatPoints(o.outcome.points)}` : lostText(o.outcome.reason)} : null;

  const goalsFor = (spot: (typeof t.spots)[number]): HudGoal[] => spotGoals(spot, t).map(g => ({key: g.key, title: g.title, detail: g.detail, done: prog.goals.includes(g.key), progress: prog.goals.includes(g.key) ? 1 : q(gp[g.key] ?? 0, 0.05)}));
  const spots: HudSpot[] = t.spots.map(sp => {
    const goals = goalsFor(sp);
    return {id: sp.id, name: sp.name, words: sp.words, x: sp.x, z: sp.z, discovered: prog.discovered.includes(sp.id), owned: goals.every(g => g.done), here: s.spotId === sp.id, goals};
  });
  const spot = spots.find(sp => sp.here) ?? null;
  const total3 = spots.reduce((n, sp) => n + sp.goals.length, 0), done = spots.reduce((n, sp) => n + sp.goals.filter(g => g.done).length, 0);

  const x = p?.x ?? 0, z = p?.z ?? 0;
  const route = s.run ? t.routes.find(r => r.id === s.run!.id) ?? null : null;
  const target = s.run && !s.run.finished && route ? route.points[s.run.checkpoint] ?? null : null;
  let run: SkateHudModel['run'] = null;
  if (s.run && route) {
    const r = s.run, gates = route.points.length - 1;
    const label = r.finished ? `${r.medal ?? 'Finished'} · ${formatSeconds(r.elapsed)}` : r.countdown > 0 ? `Ready · ${Math.ceil(r.countdown)}` : `${formatSeconds(r.elapsed)} · Gate ${r.checkpoint}/${gates}`;
    run = {id: r.id, name: route.name, label, finished: r.finished, countdown: Math.ceil(r.countdown), gate: r.checkpoint, gates, target, distance: target ? Math.round(Math.hypot(x - target[0], z - target[1])) : null};
  }
  // Map bounds: every spot and route, with a margin.
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  const grow = (a: number, b: number) => { if (a < minX) minX = a; if (a > maxX) maxX = a; if (b < minZ) minZ = b; if (b > maxZ) maxZ = b; };
  for (const sp of t.spots) grow(sp.x, sp.z);
  for (const r of t.routes) for (const pt of r.points) grow(pt[0], pt[1]);
  if (!Number.isFinite(minX)) { minX = minZ = -60; maxX = maxZ = 60; }
  const bounds: [number, number, number, number] = [minX - 10, minZ - 10, maxX - minX + 20, maxZ - minZ + 20];

  const unlockView = {discovered: prog.discovered, goals: prog.goals};
  const decks = t.decks.map(d => ({id: d.id, name: d.name, colour: d.colour, ink: d.ink, unlocked: deckUnlocked(d, unlockView), selected: prog.deck === d.id, requirement: deckRequirement(d)}));
  const routes = t.routes.map(r => ({id: r.id, name: r.name, detail: r.detail ?? '', best: prog.routeBest[r.id] ?? null, gold: r.seconds[0] ?? 0}));
  const stamps = SKATE_STAMPS.map(st => ({id: st.id, name: st.name, hint: st.hint, earned: prog.stamps.includes(st.id)}));
  const hints = controlHints(src.inputDevice, phase, src.hints);
  const yaw = p ? (Number.isFinite(p.heading) ? p.heading : 0) : 0;

  const sig = [
    p ? 1 : 0, src.paused ? 1 : 0, phase, speed.value, speed.frac, stance.label, stance.ride,
    balance ? `${balance.which}${balance.value}${balance.label}` : '-',
    hudLine.active ? 1 : 0, hudLine.latest ?? '', tricks.length, hudLine.base, hudLine.multiplier, hudLine.keepAlive,
    outcome?.seq ?? -1, s.spotCard?.seq ?? -1, s.notice?.seq ?? -1, s.spotId ?? '', s.revision, prog.goals.length,
    run ? `${run.label}${run.distance}` : '-', q(x, 0.5), q(z, 0.5), q(yaw, 0.05), src.inputDevice, s.message,
    Object.values(gp).reduce((a, b) => a + b, 0).toFixed(2),
  ].join('|');
  return {
    sig, active: Boolean(p), paused: src.paused, phase, speed, stance, balance, line: hudLine, outcome,
    spotCard: s.spotCard, notice: s.notice ?? null, spot, run,
    map: {x, z, yaw, bounds, route: route ? route.points : null, target},
    spots, challenges: {done, total: total3}, stats: {...prog.stats}, stamps, decks, routes,
    bestLine: Math.max(prog.bestLine, prog.stats.biggestLine), discovered: prog.discovered.length, spotTotal: t.spots.length,
    inputDevice: src.inputDevice, hints, settings: {...prog.settings}, message: s.message,
  };
}

/* ------------------------------------------------------------------ throttle */
/**
 * Publish-rate gate for the HUD. `offer(model, nowMs)` returns the model when
 * React should re-render, else null. Urgent changes publish immediately.
 */
export function createHudThrottle(minMs = 100) {
  let last: SkateHudModel | null = null, at = -Infinity;
  const urgent = (a: SkateHudModel, b: SkateHudModel | null) => !b || a.active !== b.active || a.paused !== b.paused || a.phase !== b.phase
    || a.line.latest !== b.line.latest || a.line.active !== b.line.active || a.outcome?.seq !== b.outcome?.seq
    || a.spotCard?.seq !== b.spotCard?.seq || a.notice?.seq !== b.notice?.seq || a.inputDevice !== b.inputDevice || a.stance.ride !== b.stance.ride;
  return {
    offer(model: SkateHudModel, now: number): SkateHudModel | null {
      if (last && model.sig === last.sig) return null;
      if (!urgent(model, last) && now - at < minMs) return null;
      last = model; at = now; return model;
    },
    reset() { last = null; at = -Infinity; },
  };
}

/**
 * Screen-reader text for the ticker, at most one announcement per `minMs`.
 * Returns the text to put in the polite live region, or null to leave it.
 */
export function createLiveAnnouncer(minMs = 1000) {
  let lastText = '', at = -Infinity, pending: string | null = null;
  return {
    offer(text: string | null, now: number): string | null {
      if (text && text !== lastText) pending = text;
      if (pending && now - at >= minMs) { lastText = pending; pending = null; at = now; return lastText; }
      return null;
    },
  };
}
export function tickerAnnouncement(m: SkateHudModel): string | null {
  if (m.outcome && m.outcome.kind === 'banked') return `Banked ${formatPoints(m.outcome.points)} points`;
  if (m.outcome && m.outcome.kind === 'lost') return `Line lost. ${m.outcome.text}`;
  if (m.line.latest) return `${m.line.latest}. ${formatPoints(m.line.total)} at times ${m.line.multiplier}`;
  return null;
}
