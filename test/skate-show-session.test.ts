import {afterEach, describe, expect, it} from 'vitest';
import type {ScoreOutcome, SkatePresent, SkateSimEvent} from '../src/harbour/skate/contract.ts';
import {
  DEFAULT_SKATE_TABLES, SKATE_PROGRESS_MAX_CHARS, allSpotGoals, chooseSkateDeck, createSkateSession, decodeSkateProgress, deckUnlocked,
  freshSkateProgress, observeSkate, readSkateProgress, saveSkateProgress, setSkateSettings, setSkateTables, skateProgressKey, skateProgressKeyV1,
  spotGoals, startSkateRoute, type SkateSession, type SpotGoal,
} from '../src/harbour/skate/session.ts';

const base: SkatePresent = {
  x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 1, speed: 1, heading: 0, boardYaw: 0, boardPitch: 0, boardRoll: 0, bodyTwist: 0,
  phase: 'roll', stance: 'regular', switch: false, fakie: false, crouch: 0, lean: 0, carve: 0, balance: 0, pushPhase: 0,
  airTime: 0, clearance: 0, trick: null, grab: null, grind: null, manual: null, bail: null, impact: 0, surface: 'concrete',
};
const at = (o: Partial<SkatePresent>): SkatePresent => ({...base, ...o});
const land = (o: Partial<Extract<SkateSimEvent, {kind: 'land'}>> = {}): SkateSimEvent => ({t: 0, kind: 'land', spinDeg: 0, boardClean: 1, fakie: false, switch: false, airTime: 0.6, gap: 1, onFeature: null, revert: false, ...o});
const pop = (o: Partial<Extract<SkateSimEvent, {kind: 'pop'}>> = {}): SkateSimEvent => ({t: 0, kind: 'pop', from: 'tail', switch: false, fakie: false, height: 0.6, flipId: null, fromFeature: null, ...o});
const banked = (points: number, n = 3): ScoreOutcome => ({kind: 'banked', points, tricks: Array.from({length: n}, (_, i) => `Trick ${i}`)});

/** Feed one step. */
const step = (s: SkateSession, p: Partial<SkatePresent>, events: SkateSimEvent[] = [], outcome: ScoreOutcome | null = null) => observeSkate(s, at(p), events, outcome, 1 / 60);

/** A stream of events that should satisfy `goal` at spot (x,z). */
function satisfy(s: SkateSession, g: SpotGoal, x: number, z: number, fail = false): void {
  step(s, {x, z});
  switch (g.kind) {
    case 'line': step(s, {x, z}, [], banked(fail ? g.target - 1 : g.target)); break;
    case 'grind':
      step(s, {x, z, phase: 'grind'}, [{t: 0, kind: 'grind-start', grindId: g.grindId ?? '50-50', grindableId: g.grindableId!, kind2: 'ledge', switch: false, fakie: false}]);
      step(s, {x, z}, [{t: 0, kind: 'grind-end', grindId: g.grindId ?? '50-50', grindableId: g.grindableId!, distance: fail ? g.target * 0.5 : g.target + 0.1, seconds: 1, exit: 'roll'}]);
      break;
    case 'manual':
      step(s, {x, z, phase: 'manual'}, [{t: 0, kind: 'manual-start', manual: 'manual', distance: 0, seconds: 0}]);
      step(s, {x, z}, [{t: 0, kind: 'manual-end', manual: 'manual', distance: 3, seconds: fail ? g.target - 0.5 : g.target + 0.1}]);
      break;
    case 'air':
      step(s, {x, z, phase: 'air'}, [pop({fromFeature: g.featureId ?? null})]);
      step(s, {x, z, phase: 'air', clearance: fail ? g.target * 0.5 : g.target + 0.05});
      step(s, {x, z}, [land({airTime: 0.9})]);
      break;
    case 'flip':
      step(s, {x, z, phase: 'air'}, [pop({flipId: g.flipId!, fromFeature: g.featureId ?? null})]);
      step(s, {x, z, phase: 'air', clearance: 0.4}, [{t: 0, kind: 'flip-caught', flipId: g.flipId!, quality: 0.8}]);
      step(s, {x, z}, [land({boardClean: fail ? 0.2 : 1})]);
      break;
  }
}

afterEach(() => setSkateTables({}));

describe('skate progress v2 storage', () => {
  it('migrates a v1 save losslessly and drops what the park no longer has', () => {
    const v1 = {version: 1, deck: 'orchard', discovered: ['tideline', 'bookends', 'gone-spot', 'bookends'], bestLine: 4200, routeBest: {'first-line': 30.5, 'retired-route': 12, 'north-run': -1}, stamps: ['first-landing', 'flip', 'secret']};
    const p = decodeSkateProgress(JSON.stringify(v1));
    expect(p.version).toBe(2);
    expect(p.discovered).toEqual(['tideline', 'bookends']);
    expect(p.deck).toBe('orchard'); // two discoveries still unlock it
    expect(p.bestLine).toBe(4200); expect(p.stats.biggestLine).toBe(4200);
    expect(p.routeBest).toEqual({'first-line': 30.5});
    expect(p.stamps).toEqual(['first-landing', 'flip']);
    expect(p.goals).toEqual([]); expect(p.settings).toEqual(freshSkateProgress().settings);
  });

  it('starts fresh on corrupt, oversized, wrong-version or hostile input', () => {
    const fresh = freshSkateProgress();
    for (const raw of [null, '', '{broken', '[]', 'null', '42', JSON.stringify({version: 3}), JSON.stringify({version: '2'}), 'x'.repeat(SKATE_PROGRESS_MAX_CHARS + 1)]) expect(decodeSkateProgress(raw)).toEqual(fresh);
    const big = JSON.stringify({version: 2, discovered: Array(Math.ceil(SKATE_PROGRESS_MAX_CHARS/10)).fill('tideline')});
    expect(big.length).toBeGreaterThan(SKATE_PROGRESS_MAX_CHARS);
    expect(decodeSkateProgress(big)).toEqual(fresh);
    const hostile = decodeSkateProgress(JSON.stringify({version: 2, deck: 'islander', discovered: 'tideline', goals: ['tideline:line', 'tideline:hack', 'nowhere:line', 7, 'tideline:line'], bestLine: 1.5,
      stats: {longestGrind: -4, biggestAir: 1e9, tricksLanded: 3.7, bails: 'many'}, settings: {stance: 'mongo', camera: 'far', sound: 'yes', controls: 'easy'}, __proto__: {polluted: true}}));
    expect(hostile.deck).toBe('tideline'); expect(hostile.discovered).toEqual([]); expect(hostile.goals).toEqual(['tideline:line']);
    expect(hostile.bestLine).toBe(0); expect(hostile.stats.longestGrind).toBe(0); expect(hostile.stats.biggestAir).toBe(0); expect(hostile.stats.tricksLanded).toBe(3); expect(hostile.stats.bails).toBe(0);
    expect(hostile.settings).toEqual({stance: 'regular', controls: 'easy', camera: 'far', sound: false, reducedEffects: false});
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('reads the v1 key when there is no v2 save, writes only v2, and round-trips v2', () => {
    const key = skateProgressKey('development', 'hh:a', 'member');
    expect(key.startsWith('hearth.harbour.skate.v2:')).toBe(true);
    expect(skateProgressKeyV1(key)).toBe('hearth.harbour.skate.v1:development:hh%3Aa:member');
    expect(skateProgressKey('production', 'hh:a', 'member')).not.toBe(key);
    const store = new Map<string, string>();
    const storage = {getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v)};
    store.set(skateProgressKeyV1(key)!, JSON.stringify({version: 1, deck: 'saltwood', discovered: ['tideline'], bestLine: 900, routeBest: {}, stamps: ['first-landing']}));
    const migrated = readSkateProgress(storage, key);
    expect(migrated.deck).toBe('saltwood'); expect(migrated.stamps).toEqual(['first-landing']);
    migrated.goals = ['tideline:line']; migrated.stats.longestGrind = 3.5; migrated.settings.stance = 'goofy';
    expect(saveSkateProgress(storage, key, migrated)).toBe(true);
    expect(JSON.parse(store.get(skateProgressKeyV1(key)!)!).version).toBe(1); // v1 untouched
    expect(readSkateProgress(storage, key)).toEqual(migrated);
    const broken = {getItem() { throw Error('blocked'); }, setItem() { throw Error('quota'); }};
    expect(readSkateProgress(broken, key)).toEqual(freshSkateProgress());
    expect(saveSkateProgress(broken, key, migrated)).toBe(false);
  });
});

describe('Own the Spot', () => {
  it('generates three distinct, deterministic, data-driven goals per spot', () => {
    for (const spot of DEFAULT_SKATE_TABLES.spots) {
      const goals = spotGoals(spot);
      expect(goals).toHaveLength(3);
      expect(new Set(goals.map(g => g.key)).size).toBe(3);
      expect(goals[0]!.kind).toBe('line');
      expect(goals.every(g => g.title.length > 3 && g.target > 0)).toBe(true);
      expect(spotGoals(spot).map(g => g.title)).toEqual(goals.map(g => g.title));
      for (const g of goals) if (g.kind === 'grind') expect(DEFAULT_SKATE_TABLES.grindables!.some(r => r.id === g.grindableId)).toBe(true);
    }
    // Catalog names come through when the tricks track supplies them.
    setSkateTables({grinds: [{id: 'fifty', name: 'Fifty-fifty', difficulty: 0.2}], flips: [{id: 'kick', name: 'Kick flip', difficulty: 0.3}]});
    const titles = allSpotGoals().map(g => g.title).join(' | ');
    expect(titles).toMatch(/Fifty-fifty on/);
  });

  it('completes every goal from its event stream, and not from a near miss', () => {
    for (const g of allSpotGoals()) {
      const spot = DEFAULT_SKATE_TABLES.spots.find(s => s.id === g.spotId)!;
      const miss = createSkateSession();
      satisfy(miss, g, spot.x, spot.z, true);
      expect(miss.progress.goals, `${g.key} near miss`).not.toContain(g.key);
      const hit = createSkateSession();
      satisfy(hit, g, spot.x, spot.z);
      expect(hit.progress.goals, `${g.key} ${g.title}`).toContain(g.key);
      // Doing it somewhere else does not count.
      const away = createSkateSession();
      satisfy(away, g, 500, 500);
      expect(away.progress.goals).not.toContain(g.key);
    }
  });

  it('owning a spot stamps it, and goals unlock decks without discoveries', () => {
    const s = createSkateSession();
    const spot = DEFAULT_SKATE_TABLES.spots[0]!;
    const orchard = DEFAULT_SKATE_TABLES.decks.find(d => d.id === 'orchard')!;
    expect(deckUnlocked(orchard, {discovered: ['x'], goals: []})).toBe(false);
    for (const g of spotGoals(spot)) satisfy(s, g, spot.x, spot.z);
    expect(s.progress.goals).toHaveLength(3);
    expect(s.progress.stamps).toContain('own-spot');
    expect(deckUnlocked(orchard, s.progress)).toBe(true);
    expect(chooseSkateDeck(s, 'orchard')).toBe(true); expect(s.progress.deck).toBe('orchard');
    expect(chooseSkateDeck(s, 'islander')).toBe(false);
    expect(s.revision).toBeGreaterThan(0);
  });
});

describe('island stats, milestones and routes', () => {
  it('keeps personal bests from the sim and scorer streams', () => {
    const s = createSkateSession();
    step(s, {}, [{t: 0, kind: 'grind-end', grindId: '50-50', grindableId: 'r', distance: 4.2, seconds: 1.2, exit: 'roll'}]);
    step(s, {}, [{t: 0, kind: 'grind-end', grindId: '50-50', grindableId: 'r', distance: 9, seconds: 3, exit: 'bail'}]); // a slam is not a best
    step(s, {}, [{t: 0, kind: 'manual-end', manual: 'manual', distance: 2, seconds: 2.6}]);
    step(s, {phase: 'air'}, [pop()]); step(s, {phase: 'air', clearance: 1.1}); step(s, {}, [land({airTime: 1.05, spinDeg: -360})]);
    step(s, {}, [], banked(3400, 4)); step(s, {}, [], banked(1200, 2)); step(s, {}, [], {kind: 'lost', points: 9000, reason: 'balance'});
    expect(s.progress.stats).toMatchObject({longestGrind: 4.2, longestManual: 2.6, biggestAir: 1.1, longestAirTime: 1.05, biggestSpin: 360, biggestLine: 3400, tricksLanded: 6, linesBanked: 2});
    expect(s.progress.bestLine).toBe(3400);
    expect(s.progress.stamps).toEqual(expect.arrayContaining(['spin', 'line', 'first-landing']));
  });

  it('awards first-time milestones from real acts only', () => {
    const s = createSkateSession();
    step(s, {phase: 'air'}, [pop({flipId: 'kickflip'})]);
    step(s, {phase: 'air'}, [{t: 0, kind: 'flip-caught', flipId: 'kickflip', quality: 0.9}]);
    step(s, {}, [land({boardClean: 0.1})]); // sketchy: board not under the feet
    expect(s.progress.stamps).not.toContain('kickflip');
    step(s, {phase: 'air'}, [pop({flipId: 'kickflip', switch: true})]);
    step(s, {phase: 'air'}, [{t: 0, kind: 'flip-caught', flipId: 'kickflip', quality: 0.9}]);
    step(s, {}, [land({switch: true})]);
    expect(s.progress.stamps).toEqual(expect.arrayContaining(['kickflip', 'switch']));
    step(s, {phase: 'grind'}, [{t: 0, kind: 'grind-start', grindId: '50-50', grindableId: 'bowl', kind2: 'coping', switch: false, fakie: false}]);
    step(s, {phase: 'bail'}, [{t: 0, kind: 'bail', reason: 'balance'}]);
    step(s, {phase: 'recover'}, [{t: 0, kind: 'recovered'}]);
    expect(s.progress.stamps).toEqual(expect.arrayContaining(['coping', 'get-up']));
    expect(s.progress.stats.bails).toBe(1);
    // Flip stamp waits for a banked line with a flip in it.
    expect(s.progress.stamps).not.toContain('flip');
    step(s, {phase: 'air'}, [pop({flipId: 'heelflip'})]); step(s, {phase: 'air'}, [{t: 0, kind: 'flip-caught', flipId: 'heelflip', quality: 1}]); step(s, {}, [land()]);
    step(s, {}, [], banked(800));
    expect(s.progress.stamps).toContain('flip');
    expect(s.notice?.kind).toBe('stamp');
  });

  it('discovers spots with a banner card and still runs timed routes', () => {
    const s = createSkateSession();
    const [a, b] = DEFAULT_SKATE_TABLES.spots;
    step(s, {x: a!.x, z: a!.z});
    expect(s.spotCard).toMatchObject({id: a!.id, fresh: true});
    const seq = s.spotCard!.seq;
    step(s, {x: a!.x + 0.5, z: a!.z}); expect(s.spotCard!.seq).toBe(seq); // no re-show while inside
    step(s, {x: b!.x, z: b!.z}); expect(s.spotCard).toMatchObject({id: b!.id, fresh: true});
    step(s, {x: a!.x, z: a!.z}); expect(s.spotCard).toMatchObject({id: a!.id, fresh: false});
    expect(s.progress.discovered).toEqual([a!.id, b!.id]);
    for (const sp of DEFAULT_SKATE_TABLES.spots) step(s, {x: sp.x, z: sp.z});
    expect(s.progress.stamps).toContain('explorer');
    const route = DEFAULT_SKATE_TABLES.routes[1]!;
    startSkateRoute(s, route.id);
    for (let i = 0; i < 40; i++) observeSkate(s, at({x: route.points[0]![0], z: route.points[0]![1]}), [], null, 0.1);
    for (const pt of route.points.slice(1)) observeSkate(s, at({x: pt[0], z: pt[1]}), [], null, 0.1);
    expect(s.run!.finished).toBe(true); expect(s.progress.routeBest[route.id]).toBeGreaterThan(0);
  });

  it('keeps settings sane', () => {
    const s = createSkateSession();
    setSkateSettings(s, {stance: 'goofy', camera: 'far', sound: true});
    setSkateSettings(s, {controls: 'nonsense' as 'easy'});
    expect(s.progress.settings).toEqual({stance: 'goofy', controls: 'flick', camera: 'far', sound: true, reducedEffects: false});
  });
});
