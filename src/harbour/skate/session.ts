/**
 * Tideline Skate Club — device-local progress, challenges and island stats (v2).
 *
 * Recreational only: nothing here reads or writes household money, Journey,
 * or anything hosted. Progress is one small JSON blob per person, household
 * and environment on this device.
 *
 * v2 adds: Own the Spot goals (three per spot, generated from data), island
 * stats, expanded milestones, deck unlocks by discoveries OR goals, and
 * rider settings. v1 saves migrate losslessly (see `decodeSkateProgress`).
 *
 * Two drivers share one session:
 *  - `observeSkate(session, present, events, outcome, dt)` — v2: the sim's
 *    `SkatePresent` + `SkateSimEvent[]` and the scorer's `ScoreOutcome`.
 *  - `stepSkateSession(session, v1State, dt)` — the v1 adapter the current
 *    rider.ts still calls; kept so the v1 game and its tests run unchanged
 *    until integration swaps the sim. Delete it with skateModel.ts.
 */
import {SKATE_DECKS, SKATE_RAILS, SKATE_RAMPS, SKATE_ROUTES, SKATE_SPOTS, type SkateDeckId} from './park.ts';
import type {Grindable, ScoreOutcome, SkatePresent, SkateSimEvent, Stance} from './contract.ts';
import type {SkateState} from './skateModel.ts';

/* ------------------------------------------------------------------ tables */
/** The minimum the session needs from the park's tables. PARK may add fields and change ids freely. */
export type SpotLike = {readonly id: string; readonly name: string; readonly words: string; readonly x: number; readonly z: number; readonly halfWidth: number; readonly halfDepth: number};
export type RouteLike = {readonly id: string; readonly name: string; readonly detail?: string; readonly seconds: readonly number[]; readonly points: readonly (readonly [number, number])[]};
export type DeckLike = {readonly id: string; readonly name: string; readonly colour: string; readonly ink: string; readonly discoveries?: number};
export type FeatureLike = {readonly id: string; readonly name?: string; readonly x: number; readonly z: number};
export type NamedLike = {readonly id: string; readonly name: string; readonly difficulty?: number};
export type SkateTables = {
  spots: readonly SpotLike[]; routes: readonly RouteLike[]; decks: readonly DeckLike[];
  /** Grindables (field.grindables in v2). Used to write grind goals with real names. */
  grindables?: readonly Pick<Grindable, 'id' | 'name' | 'points'>[];
  /** Named rideable features (ramps, banks, kickers) with a position. */
  features?: readonly FeatureLike[];
  /** Trick catalogs (TRICKS track) — only ids and display names are read. */
  flips?: readonly NamedLike[];
  grinds?: readonly NamedLike[];
};
const v1Grindables = (): Pick<Grindable, 'id' | 'name' | 'points'>[] => (SKATE_RAILS ?? []).map(r => ({id: r.id, name: r.name, points: [[r.a[0], r.height, r.a[1]], [r.b[0], r.height, r.b[1]]] as const}));
const v1Features = (): FeatureLike[] => (SKATE_RAMPS ?? []).map(r => ({id: r.id, x: r.x, z: r.z, name: featureName(r.id)}));
/** The park's own tables. Integration may pass a richer set (field.grindables, catalogs) to `setSkateTables`. */
export const DEFAULT_SKATE_TABLES: SkateTables = {spots: SKATE_SPOTS, routes: SKATE_ROUTES, decks: SKATE_DECKS, grindables: v1Grindables(), features: v1Features()};
let tables: SkateTables = DEFAULT_SKATE_TABLES;
/** Swap the tables the session reads (integration: the v2 field's spots/grindables and the trick catalogs). */
export function setSkateTables(next: Partial<SkateTables>): void { tables = {...DEFAULT_SKATE_TABLES, ...next}; goalCache.clear(); }
export const skateTables = (): SkateTables => tables;
function featureName(id: string): string {
  const tail = id.split('-').slice(1).join(' ') || id;
  const words: Record<string, string> = {halfpipe: 'the halfpipe', launch: 'the launch ramp', funbox: 'the funbox', bank: 'the bank', kicker: 'the kicker', hip: 'the hip'};
  return words[tail] ?? `the ${tail}`;
}

/* ------------------------------------------------------------------ progress */
export type SkateSettings = {
  stance: Stance;
  /** 'flick' = analogue flick-it; 'easy' = one-key tricks. */
  controls: 'flick' | 'easy';
  camera: 'near' | 'far';
  sound: boolean;
  /** Quiets camera kick, confetti and big HUD motion even without the OS setting. */
  reducedEffects: boolean;
};
export type SkateStats = {
  /** Island units. */ longestGrind: number;
  /** Seconds. */ longestManual: number;
  /** Clearance above the surface, island units. */ biggestAir: number;
  /** Seconds. */ longestAirTime: number;
  biggestLine: number;
  biggestSpin: number;
  tricksLanded: number;
  linesBanked: number;
  bails: number;
};
export type SkateProgress = {
  version: 2;
  /** Typed from the park's deck table (the board model reads it); decode only ever stores ids from that table. */
  deck: SkateDeckId;
  discovered: string[];
  bestLine: number;
  routeBest: Partial<Record<string, number>>;
  stamps: string[];
  /** Completed Own the Spot goals, `${spotId}:${goalKind}`. */
  goals: string[];
  stats: SkateStats;
  settings: SkateSettings;
};
export const freshSkateStats = (): SkateStats => ({longestGrind: 0, longestManual: 0, biggestAir: 0, longestAirTime: 0, biggestLine: 0, biggestSpin: 0, tricksLanded: 0, linesBanked: 0, bails: 0});
export const freshSkateSettings = (): SkateSettings => ({stance: 'regular', controls: 'flick', camera: 'near', sound: false, reducedEffects: false});
export const freshSkateProgress = (): SkateProgress => ({version: 2, deck: 'tideline', discovered: [], bestLine: 0, routeBest: {}, stamps: [], goals: [], stats: freshSkateStats(), settings: freshSkateSettings()});

/** Milestones. v1 ids are kept verbatim (v1 saves migrate into them). */
export const SKATE_STAMPS = [
  {id: 'first-landing', name: 'Wheels down', hint: 'Land your first ollie.'},
  {id: 'flip', name: 'Turn it over', hint: 'Land a flip trick and bank the line.'},
  {id: 'grind', name: 'Find the groove', hint: 'Grind a rail and bank the line.'},
  {id: 'manual', name: 'Two wheels', hint: 'Link a manual into a banked line.'},
  {id: 'line', name: 'A line of your own', hint: 'Bank a 2,000-point line.'},
  {id: 'explorer', name: 'Island wheels', hint: 'Discover every skate spot.'},
  {id: 'kickflip', name: 'The first flick', hint: 'Catch and land a kickflip.'},
  {id: 'switch', name: 'Other foot forward', hint: 'Land a trick riding switch.'},
  {id: 'fakie', name: 'Backwards is fine', hint: 'Land a trick rolling fakie.'},
  {id: 'coping', name: 'Kiss the coping', hint: 'Grind or stall on bowl coping.'},
  {id: 'grab', name: 'Hold on', hint: 'Land a grab.'},
  {id: 'spin', name: 'Full circle', hint: 'Land a 360 spin.'},
  {id: 'big-air', name: 'Paper plane', hint: 'Land a big air.'},
  {id: 'long-grind', name: 'All the way down', hint: 'Grind a long way in one go.'},
  {id: 'powerslide', name: 'Scrub it', hint: 'Powerslide to check your speed.'},
  {id: 'revert', name: 'Spin it out', hint: 'Revert out of a landing.'},
  {id: 'big-line', name: 'The long way round', hint: 'Bank a 10,000-point line.'},
  {id: 'get-up', name: 'Everyone falls', hint: 'Get back up after a slam.'},
  {id: 'own-spot', name: 'This one is mine', hint: 'Finish all three goals at one spot.'},
  {id: 'gold', name: 'Gold ring', hint: 'Finish a route inside its gold time.'},
] as const;
export type SkateStampId = typeof SKATE_STAMPS[number]['id'];

/** Decks unlock by discoveries (park table) OR by completed goals (whichever comes first). */
export const DECK_GOAL_UNLOCK: Readonly<Record<string, number>> = Object.freeze({orchard: 3, northlight: 7, islander: 12});
export function deckUnlocked(deck: DeckLike, progress: Pick<SkateProgress, 'discovered' | 'goals'>): boolean {
  const need = deck.discoveries ?? 0, alt = DECK_GOAL_UNLOCK[deck.id];
  return progress.discovered.length >= need || (alt !== undefined && progress.goals.length >= alt);
}
export function deckRequirement(deck: DeckLike): string {
  const need = deck.discoveries ?? 0, alt = DECK_GOAL_UNLOCK[deck.id];
  if (!need) return 'Ready to ride';
  return alt !== undefined ? `Find ${need} spots or finish ${alt} goals` : `Find ${need} spots`;
}

/* ------------------------------------------------------------------ storage */
const KEY_V1 = 'hearth.harbour.skate.v1:', KEY_V2 = 'hearth.harbour.skate.v2:';
export const SKATE_PROGRESS_MAX_CHARS = 32_000;
/** Device-local key for one person in one household in one environment (v2). */
export function skateProgressKey(environment: string, householdId: string, memberId: string): string {
  return `${KEY_V2}${[environment, householdId, memberId].map(encodeURIComponent).join(':')}`;
}
/** The v1 key the same person used before v2 (read-only; never written again). */
export const skateProgressKeyV1 = (key: string): string | null => key.startsWith(KEY_V2) ? KEY_V1 + key.slice(KEY_V2.length) : null;

const num = (v: unknown, lo: number, hi: number, or = 0) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : or;
const strings = (v: unknown): string[] => Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string' && s.length <= 120) : [];
const GOAL_KINDS = new Set(['line', 'grind', 'flip', 'air', 'manual']);

/**
 * Decode a saved blob (v1 or v2). Unknown spots/routes/stamps/decks are
 * dropped, numbers are bounded, oversized or corrupt input starts fresh.
 */
export function decodeSkateProgress(raw: string | null): SkateProgress {
  const fresh = freshSkateProgress();
  try {
    if (!raw || raw.length > SKATE_PROGRESS_MAX_CHARS) return fresh;
    const p = JSON.parse(raw);
    if (!p || typeof p !== 'object' || (p.version !== 1 && p.version !== 2)) return fresh;
    const spotIds = new Set(tables.spots.map(s => s.id)), found = new Set(strings(p.discovered));
    fresh.discovered = tables.spots.filter(s => found.has(s.id)).map(s => s.id);
    const stamps = new Set(strings(p.stamps));
    fresh.stamps = SKATE_STAMPS.filter(s => stamps.has(s.id)).map(s => s.id);
    fresh.bestLine = Number.isSafeInteger(p.bestLine) ? num(p.bestLine, 0, 1e9) : 0;
    for (const r of tables.routes) { const v = p.routeBest?.[r.id]; if (typeof v === 'number' && Number.isFinite(v) && v >= 1 && v <= 3600) fresh.routeBest[r.id] = v; }
    if (p.version === 2) {
      fresh.goals = [...new Set(strings(p.goals).filter(k => { const [spot, kind] = k.split(':'); return spotIds.has(spot!) && GOAL_KINDS.has(kind!); }))];
      const st = p.stats ?? {};
      fresh.stats = {
        longestGrind: num(st.longestGrind, 0, 1e4), longestManual: num(st.longestManual, 0, 3600), biggestAir: num(st.biggestAir, 0, 100),
        longestAirTime: num(st.longestAirTime, 0, 60), biggestLine: num(st.biggestLine, 0, 1e9), biggestSpin: num(st.biggestSpin, 0, 3600),
        tricksLanded: Math.floor(num(st.tricksLanded, 0, 1e9)), linesBanked: Math.floor(num(st.linesBanked, 0, 1e9)), bails: Math.floor(num(st.bails, 0, 1e9)),
      };
      const se = p.settings ?? {};
      fresh.settings = {
        stance: se.stance === 'goofy' ? 'goofy' : 'regular', controls: se.controls === 'easy' ? 'easy' : 'flick',
        camera: se.camera === 'far' ? 'far' : 'near', sound: se.sound === true, reducedEffects: se.reducedEffects === true,
      };
    }
    // v1 knew best line but not stats: seed the island's biggest line from it.
    fresh.stats.biggestLine = Math.max(fresh.stats.biggestLine, fresh.bestLine);
    const deck = tables.decks.find(d => d.id === p.deck && deckUnlocked(d, fresh));
    if (deck) fresh.deck = deck.id as SkateDeckId;
  } catch { /* An unavailable or corrupt device save starts a playable session. */ }
  return fresh;
}
/** Read v2; if absent, migrate the same person's v1 save (the v1 key is left untouched). */
export function readSkateProgress(store: Pick<Storage, 'getItem'>, key: string): SkateProgress {
  try {
    const raw = store.getItem(key);
    if (raw !== null) return decodeSkateProgress(raw);
    const old = skateProgressKeyV1(key);
    return decodeSkateProgress(old ? store.getItem(old) : null);
  } catch { return freshSkateProgress(); }
}
export function saveSkateProgress(store: Pick<Storage, 'setItem'>, key: string, progress: SkateProgress): boolean {
  try { store.setItem(key, JSON.stringify(progress)); return true; } catch { return false; }
}

/* ------------------------------------------------------------------ Own the Spot */
export type SpotGoalKind = 'line' | 'grind' | 'flip' | 'air' | 'manual';
export type SpotGoal = {
  key: string; spotId: string; kind: SpotGoalKind;
  title: string; detail: string;
  /** Points (line), distance (grind), seconds (manual), height (air), 1 (flip). */
  target: number;
  grindableId?: string; grindId?: string | null; flipId?: string; featureId?: string | null;
};
function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const inSpot = (spot: SpotLike, x: number, z: number, margin = 0) => Math.abs(x - spot.x) <= spot.halfWidth + margin && Math.abs(z - spot.z) <= spot.halfDepth + margin;
const round = (v: number, step: number) => Math.round(v / step) * step;
const fmt = (n: number) => Math.round(n).toLocaleString('en-CA');
const railName = (name: string) => /^the /i.test(name) ? name.replace(/^The /, 'the ') : `the ${name}`;
const goalCache = new Map<string, readonly SpotGoal[]>();

/** Three goals for a spot, generated from its size, its grindables/features and the trick catalogs. Deterministic. */
export function spotGoals(spot: SpotLike, t: SkateTables = tables): readonly SpotGoal[] {
  const cached = t === tables ? goalCache.get(spot.id) : undefined;
  if (cached) return cached;
  const h = hash(spot.id), area = spot.halfWidth * spot.halfDepth * 4;
  const goals: SpotGoal[] = [];
  const line = Math.max(1000, Math.min(6000, round(900 + area * 8, 250)));
  goals.push({key: `${spot.id}:line`, spotId: spot.id, kind: 'line', target: line, title: `Bank ${fmt(line)} in one line`, detail: `Start or finish the line inside ${spot.name}.`});
  const rails = (t.grindables ?? []).filter(g => { const a = g.points[0], b = g.points.at(-1); return Boolean(a && b && inSpot(spot, (a[0] + b[0]) / 2, (a[2] + b[2]) / 2, 1.5)); });
  const features = (t.features ?? []).filter(f => inSpot(spot, f.x, f.z, 0.5));
  const flips = (t.flips ?? []).filter(f => (f.difficulty ?? 0.3) <= 0.6);
  const flip = flips.length ? flips[h % flips.length]! : {id: 'kickflip', name: 'Kickflip'};
  if (rails.length) {
    const rail = rails[h % rails.length]!;
    let len = 0; for (let i = 1; i < rail.points.length; i++) { const a = rail.points[i - 1]!, b = rail.points[i]!; len += Math.hypot(b[0] - a[0], b[2] - a[2]); }
    const distance = Math.max(1, Math.min(8, round(len * 0.6, 0.5)));
    const grinds = (t.grinds ?? []).filter(g => (g.difficulty ?? 0.3) <= 0.55);
    const grind = grinds.length ? grinds[(h >>> 3) % grinds.length]! : null;
    goals.push({key: `${spot.id}:grind`, spotId: spot.id, kind: 'grind', target: distance, grindableId: rail.id, grindId: grind?.id ?? null,
      title: grind ? `${grind.name} on ${railName(rail.name)}` : `Grind ${railName(rail.name)}`, detail: `Lock on for ${distance} m and ride away.`});
  } else goals.push({key: `${spot.id}:flip`, spotId: spot.id, kind: 'flip', target: 1, flipId: flip.id, featureId: null, title: `Land a ${flip.name}`, detail: `Anywhere in ${spot.name}. Catch it, roll away.`});
  const third: SpotGoalKind = features.length ? ((h >>> 5) % 2 ? 'air' : (goals[1]!.kind === 'flip' ? 'air' : 'flip')) : 'manual';
  if (third === 'air') {
    const f = features[(h >>> 7) % features.length]!, height = round(0.6 + ((h >>> 9) % 5) * 0.15, 0.05);
    goals.push({key: `${spot.id}:air`, spotId: spot.id, kind: 'air', target: height, featureId: f.id, title: `Get ${height.toFixed(2).replace(/0$/, '')} m of air`, detail: `Try ${f.name ?? 'the ramp'}. Land it clean.`});
  } else if (third === 'flip') {
    const f = features[(h >>> 7) % features.length]!;
    goals.push({key: `${spot.id}:flip`, spotId: spot.id, kind: 'flip', target: 1, flipId: flip.id, featureId: f.id, title: `${flip.name} off ${f.name ?? 'the ramp'}`, detail: 'Pop from the feature, catch it, roll away.'});
  } else {
    const seconds = 2 + ((h >>> 11) % 3);
    goals.push({key: `${spot.id}:manual`, spotId: spot.id, kind: 'manual', target: seconds, title: `Manual for ${seconds} seconds`, detail: `Keep two wheels up inside ${spot.name}.`});
  }
  const frozen = Object.freeze(goals);
  if (t === tables) goalCache.set(spot.id, frozen);
  return frozen;
}
export const allSpotGoals = (t: SkateTables = tables): SpotGoal[] => t.spots.flatMap(s => [...spotGoals(s, t)]);

/* ------------------------------------------------------------------ session */
export type SkateRun = {id: string; checkpoint: number; elapsed: number; countdown: number; finished: boolean; medal: string | null};
/** A paper banner to unfold: a spot entered or discovered. `seq` increments per card. */
export type SkateSpotCard = {id: string; name: string; words: string; fresh: boolean; seq: number};
export type SkateNotice = {seq: number; kind: 'stamp' | 'goal' | 'deck' | 'route' | 'spot'; text: string};
type LineTrack = {spots: Set<string>; flip: boolean; grind: boolean; manual: boolean; grab: boolean};
type AirTrack = {active: boolean; maxClear: number; fromFeature: string | null; flipId: string | null; caught: boolean; grab: boolean; switch: boolean; fakie: boolean};
export type SkateSession = {
  progress: SkateProgress; run: SkateRun | null; message: string; revision: number;
  /** v1 adapter bookkeeping. */ lastEvent: number; lineTags: string[];
  spotId: string | null; spotCard: SkateSpotCard | null; notice: SkateNotice | null;
  /** Best progress toward each goal this session, 0..1 (for HUD progress ticks). */
  goalProgress: Record<string, number>;
  line: LineTrack; air: AirTrack; bailed: boolean;
};
const freshLine = (): LineTrack => ({spots: new Set(), flip: false, grind: false, manual: false, grab: false});
const freshAir = (): AirTrack => ({active: false, maxClear: 0, fromFeature: null, flipId: null, caught: false, grab: false, switch: false, fakie: false});
export const createSkateSession = (progress = freshSkateProgress()): SkateSession => ({
  progress, run: null, message: 'Your island. Your line.', revision: 0, lastEvent: 0, lineTags: [],
  spotId: null, spotCard: null, notice: null, goalProgress: {}, line: freshLine(), air: freshAir(), bailed: false,
});
export function startSkateRoute(session: SkateSession, id: string): void {
  session.run = {id, checkpoint: 1, elapsed: 0, countdown: 3, finished: false, medal: null}; session.message = 'Ready at the start · 3, 2, 1'; session.lineTags = [];
}
export function skateMedal(id: string, seconds: number): string {
  const r = tables.routes.find(r => r.id === id);
  if (!r) return 'Finished';
  return seconds <= r.seconds[0]! ? 'Gold' : seconds <= r.seconds[1]! ? 'Silver' : seconds <= r.seconds[2]! ? 'Bronze' : 'Finished';
}
/** Change rider settings (stance, controls, camera, sound, reduced effects). */
export function setSkateSettings(session: SkateSession, patch: Partial<SkateSettings>): void {
  const s = {...session.progress.settings, ...patch};
  session.progress = {...session.progress, settings: {
    stance: s.stance === 'goofy' ? 'goofy' : 'regular', controls: s.controls === 'easy' ? 'easy' : 'flick',
    camera: s.camera === 'far' ? 'far' : 'near', sound: Boolean(s.sound), reducedEffects: Boolean(s.reducedEffects)}};
  session.revision++;
}
export function chooseSkateDeck(session: SkateSession, id: string): boolean {
  const deck = tables.decks.find(d => d.id === id);
  if (!deck || !deckUnlocked(deck, session.progress)) return false;
  session.progress = {...session.progress, deck: id as SkateDeckId}; session.revision++; return true;
}

let noticeSeq = 0, cardSeq = 0;
function notify(session: SkateSession, kind: SkateNotice['kind'], text: string): void { session.notice = {seq: ++noticeSeq, kind, text}; session.message = text; }
function award(session: SkateSession, id: SkateStampId): void {
  const p = session.progress;
  if (p.stamps.includes(id)) return;
  p.stamps = [...p.stamps, id];
  const stamp = SKATE_STAMPS.find(s => s.id === id);
  if (stamp) notify(session, 'stamp', `Milestone · ${stamp.name}`);
}
function unlockCheck(session: SkateSession, before: Set<string>): void {
  for (const d of tables.decks) if (!before.has(d.id) && deckUnlocked(d, session.progress)) notify(session, 'deck', `New deck · ${d.name}`);
}
const unlockedSet = (p: SkateProgress) => new Set(tables.decks.filter(d => deckUnlocked(d, p)).map(d => d.id));

/** Discovery, current spot (with hysteresis) and the banner card. */
function visit(session: SkateSession, x: number, z: number): void {
  const p = session.progress;
  if (session.spotId) { const cur = tables.spots.find(s => s.id === session.spotId); if (!cur || !inSpot(cur, x, z, 1.5)) session.spotId = null; }
  if (session.spotId) return;
  const spot = tables.spots.find(s => inSpot(s, x, z));
  if (!spot) return;
  session.spotId = spot.id;
  const fresh = !p.discovered.includes(spot.id);
  if (fresh) {
    const before = unlockedSet(p);
    p.discovered = [...p.discovered, spot.id];
    notify(session, 'spot', `Discovered ${spot.name} · ${p.discovered.length} / ${tables.spots.length}`);
    if (p.discovered.length === tables.spots.length) award(session, 'explorer');
    unlockCheck(session, before);
    session.message = `Discovered ${spot.name} · ${p.discovered.length} / ${tables.spots.length}`;
  }
  if (!session.spotCard || session.spotCard.id !== spot.id || fresh) session.spotCard = {id: spot.id, name: spot.name, words: spot.words, fresh, seq: ++cardSeq};
}
function stepRun(session: SkateSession, x: number, z: number, bailing: boolean, dt: number): void {
  const run = session.run, p = session.progress;
  if (!run || run.finished) return;
  const step = Math.min(.1, Math.max(0, Number.isFinite(dt) ? dt : 0));
  if (run.countdown > 0) { run.countdown = Math.max(0, run.countdown - step); if (run.countdown === 0) session.message = 'Go · find the first gold ring'; return; }
  run.elapsed += step;
  const route = tables.routes.find(r => r.id === run.id);
  if (!route) { session.run = null; return; }
  const target = route.points[run.checkpoint];
  if (target && !bailing && Math.hypot(x - target[0], z - target[1]) < 2.8) {
    run.checkpoint++;
    if (run.checkpoint >= route.points.length) {
      run.finished = true; run.medal = skateMedal(run.id, run.elapsed);
      p.routeBest = {...p.routeBest, [run.id]: Math.min(p.routeBest[run.id] ?? Infinity, run.elapsed)};
      if (run.medal === 'Gold') award(session, 'gold');
      notify(session, 'route', `${route.name} · ${run.medal} · ${run.elapsed.toFixed(1)}s`);
    } else session.message = `Checkpoint ${run.checkpoint} / ${route.points.length - 1}`;
  }
}
function completeGoal(session: SkateSession, goal: SpotGoal): void {
  const p = session.progress;
  session.goalProgress[goal.key] = 1;
  if (p.goals.includes(goal.key)) return;
  const before = unlockedSet(p);
  p.goals = [...p.goals, goal.key];
  const spot = tables.spots.find(s => s.id === goal.spotId);
  notify(session, 'goal', `${spot?.name ?? 'Spot'} · ${goal.title}`);
  if (spotGoals(spot ?? {id: goal.spotId, name: '', words: '', x: 0, z: 0, halfWidth: 0, halfDepth: 0}).every(g => p.goals.includes(g.key))) { award(session, 'own-spot'); notify(session, 'goal', `You own ${spot?.name ?? 'this spot'}`); }
  unlockCheck(session, before);
}
function nudge(session: SkateSession, goal: SpotGoal, value: number): void {
  const v = Math.max(0, Math.min(1, value / goal.target));
  if (v > (session.goalProgress[goal.key] ?? 0)) session.goalProgress[goal.key] = v;
  if (v >= 1) completeGoal(session, goal);
}
const goalsHere = (spotId: string | null) => { const s = spotId ? tables.spots.find(s => s.id === spotId) : null; return s ? spotGoals(s) : []; };

/**
 * v2 driver: one call per rendered frame (or per sim step) with that step's
 * events and, when the scorer resolved a line, its outcome. Pure data in,
 * session mutation out; `revision` increments when saved progress changed.
 */
export function observeSkate(session: SkateSession, present: SkatePresent, events: readonly SkateSimEvent[], outcome: ScoreOutcome | null, dt: number): void {
  const p = session.progress, before = JSON.stringify(p), s = p.stats;
  const x = present.x, z = present.z;
  visit(session, x, z);
  if (session.spotId) session.line.spots.add(session.spotId);
  const air = session.air, here = goalsHere(session.spotId);
  if (present.phase === 'air') air.maxClear = Math.max(air.maxClear, Number.isFinite(present.clearance) ? present.clearance : 0);
  for (const e of events) {
    switch (e.kind) {
      case 'pop': Object.assign(air, freshAir(), {active: true, fromFeature: e.fromFeature, flipId: e.flipId, switch: e.switch, fakie: e.fakie}); break;
      case 'late-flip': air.flipId = e.flipId; break;
      case 'flip-caught': air.caught = true; air.flipId = e.flipId; session.line.flip = true; break;
      case 'grab-start': air.grab = true; session.line.grab = true; break;
      case 'land': {
        const clean = e.boardClean >= 0.5;
        if (clean && !session.bailed) {
          s.longestAirTime = Math.max(s.longestAirTime, Math.min(60, e.airTime));
          s.biggestAir = Math.max(s.biggestAir, Math.min(100, air.maxClear));
          s.biggestSpin = Math.max(s.biggestSpin, Math.min(3600, Math.abs(e.spinDeg)));
          if (e.airTime > 0.15) award(session, 'first-landing');
          if (air.caught && air.flipId === 'kickflip') award(session, 'kickflip');
          const didTrick = air.caught || air.grab || Math.abs(e.spinDeg) >= 170;
          if (didTrick && (e.switch || air.switch)) award(session, 'switch');
          if (didTrick && (e.fakie || air.fakie)) award(session, 'fakie');
          if (air.grab) award(session, 'grab');
          if (Math.abs(e.spinDeg) >= 340) award(session, 'spin');
          if (air.maxClear >= 1.2) award(session, 'big-air');
          if (e.revert) award(session, 'revert');
          for (const g of here) {
            if (g.kind === 'air') nudge(session, g, air.maxClear);
            if (g.kind === 'flip' && air.caught && air.flipId === g.flipId && (!g.featureId || air.fromFeature === g.featureId || e.onFeature === g.featureId)) nudge(session, g, 1);
          }
        }
        Object.assign(air, freshAir());
        break;
      }
      case 'grind-start': if (e.kind2 === 'coping') award(session, 'coping'); break;
      case 'grind-end':
        if (e.exit !== 'bail') {
          session.line.grind = true;
          s.longestGrind = Math.max(s.longestGrind, Math.min(1e4, e.distance));
          if (e.distance >= 6) award(session, 'long-grind');
          for (const g of here) if (g.kind === 'grind' && g.grindableId === e.grindableId && (!g.grindId || g.grindId === e.grindId)) nudge(session, g, e.distance);
        }
        break;
      case 'manual-end':
        if (present.phase !== 'bail') {
          session.line.manual = true;
          s.longestManual = Math.max(s.longestManual, Math.min(3600, e.seconds));
          for (const g of here) if (g.kind === 'manual') nudge(session, g, e.seconds);
        }
        break;
      case 'powerslide': if (e.seconds >= 0.4) award(session, 'powerslide'); break;
      case 'revert': award(session, 'revert'); break;
      case 'lip-trick': award(session, 'coping'); break;
      case 'bail': s.bails = Math.min(1e9, s.bails + 1); session.bailed = true; Object.assign(air, freshAir()); break;
      case 'recovered': if (session.bailed) award(session, 'get-up'); session.bailed = false; break;
      default: break;
    }
  }
  if (outcome) {
    const line = session.line;
    if (outcome.kind === 'banked') {
      const points = Math.max(0, Math.min(1e9, Math.round(outcome.points)));
      s.linesBanked = Math.min(1e9, s.linesBanked + 1);
      s.tricksLanded = Math.min(1e9, s.tricksLanded + outcome.tricks.length);
      s.biggestLine = Math.max(s.biggestLine, points);
      p.bestLine = Math.max(p.bestLine, points);
      if (line.flip) award(session, 'flip');
      if (line.grind) award(session, 'grind');
      if (line.manual) award(session, 'manual');
      if (points >= 2000) award(session, 'line');
      if (points >= 10000) award(session, 'big-line');
      if (session.spotId) line.spots.add(session.spotId);
      for (const id of line.spots) { const spot = tables.spots.find(sp => sp.id === id); if (spot) for (const g of spotGoals(spot)) if (g.kind === 'line') nudge(session, g, points); }
    }
    session.line = freshLine();
  }
  stepRun(session, x, z, present.phase === 'bail', dt);
  if (before !== JSON.stringify(p)) session.revision++;
}

/* ------------------------------------------------------------------ v1 adapter */
/** v1 driver (rider.ts / skateModel.ts). Kept until integration replaces the v1 sim. */
export function stepSkateSession(session: SkateSession, s: SkateState, dt: number): void {
  const before = JSON.stringify(session.progress), p = session.progress;
  visit(session, s.x, s.z);
  if (s.event.id !== session.lastEvent) {
    session.lastEvent = s.event.id;
    if (s.event.kind === 'trick' || s.event.kind === 'grind') session.lineTags = [...new Set([...session.lineTags, s.event.text])];
    if (s.event.kind === 'bail') { session.lineTags = []; p.stats.bails++; }
    if (s.event.kind === 'bank') {
      if (s.landings > 0) award(session, 'first-landing');
      if (session.lineTags.some(t => /flip/i.test(t))) award(session, 'flip');
      if (session.lineTags.some(t => /grind|flatbar|rail|ledge/i.test(t))) award(session, 'grind');
      if (session.lineTags.includes('Manual')) award(session, 'manual');
      if (s.event.points >= 2000) award(session, 'line');
      p.stats.linesBanked++; p.stats.tricksLanded += session.lineTags.length; p.stats.biggestLine = Math.max(p.stats.biggestLine, s.event.points);
      session.lineTags = [];
    }
  }
  // Model combo tags cover multiple physics events occurring inside one visual frame.
  if (s.comboTricks.length) session.lineTags = [...new Set([...session.lineTags, ...s.comboTricks])];
  p.bestLine = Math.max(p.bestLine, s.best);
  stepRun(session, s.x, s.z, s.mode === 'bail', dt);
  if (before !== JSON.stringify(p)) session.revision++;
}
export type SkateSnapshot = {active: boolean; paused: boolean; speed: number; mode: SkateState['mode']; combo: number; multiplier: number; comboTime: number; score: number; best: number; balance: number; balancing: boolean; tricks: string[]; event: string; eventId: number; eventKind: string; x: number; z: number; yaw: number; progress: SkateProgress; run: SkateRun | null; message: string; revision: number; spotCard: SkateSpotCard | null; spotId: string | null; goalProgress: Record<string, number>};
export const cloneSkateProgress = (p: SkateProgress): SkateProgress => ({...p, discovered: [...p.discovered], stamps: [...p.stamps], goals: [...p.goals], routeBest: {...p.routeBest}, stats: {...p.stats}, settings: {...p.settings}});
export function skateSnapshot(s: SkateState, session: SkateSession, paused = false): SkateSnapshot {
  return {active: true, paused, speed: s.speed, mode: s.mode, combo: Math.round(s.combo), multiplier: s.multiplier, comboTime: Math.max(0, 1 - s.comboAge / 2.4), score: s.score, best: s.best, balance: s.balance, balancing: s.mode === 'grind' || s.manualTime > 0, tricks: s.comboTricks, event: s.event.text, eventId: s.event.id, eventKind: s.event.kind, x: s.x, z: s.z, yaw: s.yaw,
    progress: cloneSkateProgress(session.progress), run: session.run ? {...session.run} : null, message: session.message, revision: session.revision, spotCard: session.spotCard, spotId: session.spotId, goalProgress: {...session.goalProgress}};
}
