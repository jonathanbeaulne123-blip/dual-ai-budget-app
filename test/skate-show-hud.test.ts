// @vitest-environment jsdom
import {act, createElement} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {ScoreLine, SkatePresent} from '../src/harbour/skate/contract.ts';
import {SkateHUD, type SkateHUDProps} from '../src/harbour/skate/SkateHUD.tsx';
import {
  DEFAULT_HINTS, buildHudModel, controlHints, createHudThrottle, createLiveAnnouncer, deviceFromEvent, formatPoints, type HudSource, type SkateHudModel,
} from '../src/harbour/skate/hud/model.ts';
import {createLegacyHudAdapter} from '../src/harbour/skate/hud/legacy.ts';
import {DEFAULT_SKATE_TABLES, createSkateSession, skateSnapshot} from '../src/harbour/skate/session.ts';
import {createSkateState} from '../src/harbour/skate/skateModel.ts';

(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true;

const present = (o: Partial<SkatePresent> = {}): SkatePresent => ({
  x: 25, y: 0, z: -13, vx: 0, vy: 0, vz: 5, speed: 5, heading: 0, boardYaw: 0, boardPitch: 0, boardRoll: 0, bodyTwist: 0,
  phase: 'roll', stance: 'regular', switch: false, fakie: false, crouch: 0, lean: 0, carve: 0, balance: 0, pushPhase: 0,
  airTime: 0, clearance: 0, trick: null, grab: null, grind: null, manual: null, bail: null, impact: 0, surface: 'concrete', ...o,
});
const line = (labels: string[], o: Partial<ScoreLine> = {}): ScoreLine => ({active: labels.length > 0, tricks: labels.map(label => ({label, points: 100})), base: 600, multiplier: 3, keepAlive: 0.5, latest: labels.at(-1) ?? null, ...o});
function source(o: Partial<HudSource> = {}): HudSource {
  const session = createSkateSession();
  session.spotId = 'tideline';
  return {present: present(), line: null, outcome: null, session, paused: false, inputDevice: 'keyboard', ...o};
}

describe('HUD model', () => {
  it('formats speed, stance, balance and the line chain', () => {
    const m = buildHudModel(source({
      present: present({speed: 7.26, stance: 'goofy', switch: true, phase: 'grind', balance: 0.333, grind: {grindId: 'fifty-fifty', grindableId: 'tideline-ledge', faceSign: 1}}),
      line: line(['Ollie', 'Kickflip', 'Heelflip', 'Fifty-fifty', 'Manual', 'Nollie Backside 180 Heelflip', 'Boardslide', 'Pop shove-it']),
      grindName: id => id === 'fifty-fifty' ? '50-50' : id,
    }));
    expect(m.speed.value).toBe(26);
    expect(m.stance).toMatchObject({label: 'GOOFY', rideLabel: 'SWITCH'});
    expect(m.balance).toEqual({which: 'grind', value: 0.34, label: '50-50'});
    expect(m.line.chain).toHaveLength(5); expect(m.line.hidden).toBe(3); expect(m.line.latest).toBe('Pop shove-it');
    expect(m.line.total).toBe(1800);
    expect(buildHudModel(source({present: present({phase: 'manual', manual: 'nose-manual', fakie: true})})).balance!.label).toBe('Nose manual');
    expect(buildHudModel(source({present: present({fakie: true})})).stance.rideLabel).toBe('FAKIE');
    expect(formatPoints(999.4)).toBe('999'); expect(formatPoints(12_345)).toBe('12.3K'); expect(formatPoints(NaN)).toBe('0');
  });

  it('describes banked and lost lines, the spot you are in, and a map that holds every spot', () => {
    const banked = buildHudModel(source({outcome: {outcome: {kind: 'banked', points: 1200, tricks: ['Ollie']}, seq: 4}}));
    expect(banked.outcome).toEqual({seq: 4, kind: 'banked', points: 1200, text: '+1,200'});
    expect(buildHudModel(source({outcome: {outcome: {kind: 'lost', points: 500, reason: 'flip-not-caught'}, seq: 5}})).outcome!.text).toBe('Missed the catch');
    const m = buildHudModel(source());
    expect(m.spot?.id).toBe('tideline'); expect(m.spot?.goals).toHaveLength(3);
    expect(m.challenges.total).toBe(DEFAULT_SKATE_TABLES.spots.length * 3);
    const [bx, bz, bw, bh] = m.map.bounds;
    for (const s of DEFAULT_SKATE_TABLES.spots) { expect(s.x).toBeGreaterThan(bx); expect(s.x).toBeLessThan(bx + bw); expect(s.z).toBeGreaterThan(bz); expect(s.z).toBeLessThan(bz + bh); }
    expect(m.decks.find(d => d.id === 'islander')!.unlocked).toBe(false);
    expect(m.stamps.length).toBeGreaterThan(10);
  });

  it('quantises so tiny changes keep the same signature, and throttles publishing', () => {
    const a = buildHudModel(source({present: present({speed: 5.001, x: 25.01})}));
    const b = buildHudModel(source({present: present({speed: 5.002, x: 25.02})}));
    expect(a.sig).toBe(b.sig);
    const t = createHudThrottle(100);
    expect(t.offer(a, 0)).toBe(a);
    expect(t.offer(b, 10)).toBeNull();
    const faster = buildHudModel(source({present: present({speed: 6})}));
    expect(t.offer(faster, 40)).toBeNull(); // not urgent, too soon
    expect(t.offer(faster, 120)).toBe(faster);
    const trick = buildHudModel(source({present: present({speed: 6}), line: line(['Kickflip'])}));
    expect(t.offer(trick, 125)).toBe(trick); // a new trick label is urgent
    const paused = buildHudModel(source({present: present({speed: 6}), line: line(['Kickflip']), paused: true}));
    expect(t.offer(paused, 130)).toBe(paused);
  });

  it('matches control hints to the active device and phase', () => {
    expect(controlHints('gamepad', 'roll').some(h => h.glyphs.some(g => g.kind === 'pad' || g.kind === 'stick'))).toBe(true);
    expect(controlHints('keyboard', 'roll').every(h => h.glyphs.every(g => g.kind === 'key'))).toBe(true);
    expect(controlHints('pointer', 'roll').some(h => h.glyphs.some(g => g.kind === 'mouse'))).toBe(true);
    expect(controlHints('touch', 'air').every(h => h.glyphs.every(g => g.kind === 'touch'))).toBe(true);
    expect(controlHints('keyboard', 'grind')).toBe(DEFAULT_HINTS.keyboard.grind);
    const custom = [{id: 'x', glyphs: [{kind: 'key' as const, label: 'Z'}], label: 'Custom pop'}];
    expect(controlHints('keyboard', 'roll', {keyboard: {ride: custom}})).toBe(custom);
    expect(buildHudModel(source({inputDevice: 'gamepad'})).hints).toBe(DEFAULT_HINTS.gamepad.ride);
    expect(deviceFromEvent({type: 'keydown'})).toBe('keyboard');
    expect(deviceFromEvent({type: 'pointerdown', pointerType: 'touch'})).toBe('touch');
    expect(deviceFromEvent({type: 'pointerdown', pointerType: 'mouse'})).toBe('pointer');
    expect(deviceFromEvent({type: 'focus'})).toBeNull();
  });

  it('announces to screen readers at most once a second', () => {
    const a = createLiveAnnouncer(1000);
    expect(a.offer('Kickflip', 0)).toBe('Kickflip');
    expect(a.offer('Heelflip', 300)).toBeNull();
    expect(a.offer('Heelflip', 700)).toBeNull();
    expect(a.offer(null, 1001)).toBe('Heelflip');
    expect(a.offer('Heelflip', 2500)).toBeNull(); // no repeats
  });

  it('adapts the v1 snapshot into a HUD source and audio events', () => {
    const adapter = createLegacyHudAdapter(), session = createSkateSession();
    const state = createSkateState(25, -13, 0, {ground: () => 0, surface: () => ({y: 0, ramp: null}), obstacles: []});
    state.speed = 4; state.combo = 300; state.multiplier = 2; state.comboTricks = ['Kickflip'];
    const first = adapter.frame(skateSnapshot(state, session), 'touch')!;
    expect(first.present!.phase).toBe('roll'); expect(first.source.line!.latest).toBe('Kickflip');
    state.mode = 'air';
    expect(adapter.frame(skateSnapshot(state, session), 'touch')!.events.map(e => e.kind)).toEqual(['pop']);
    state.mode = 'ride'; state.combo = 0; state.event = {id: state.event.id + 1, kind: 'bank', text: 'Line landed', points: 600};
    const banked = adapter.frame(skateSnapshot(state, session), 'touch')!;
    expect(banked.events.map(e => e.kind)).toEqual(['land']);
    expect(banked.source.outcome!.outcome).toMatchObject({kind: 'banked', points: 600});
    expect(adapter.frame(null, 'touch')).toBeNull();
  });
});

describe('SkateHUD component', () => {
  let host: HTMLDivElement, root: Root;
  beforeEach(() => { host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
  afterEach(() => { act(() => root.unmount()); host.remove(); });
  const props = (o: Partial<SkateHUDProps> = {}): SkateHUDProps => ({
    onStart: vi.fn(), onWalk: vi.fn(), onPause: vi.fn(), onRoute: vi.fn(), onSpot: vi.fn(), onDeck: vi.fn(), onFocus: vi.fn(), onSettings: vi.fn(), onCommand: vi.fn(), ...o,
  });
  const render = (p: SkateHUDProps) => act(() => root.render(createElement(SkateHUD, p)));
  const model = (o: Partial<HudSource> = {}): SkateHudModel => buildHudModel(source(o));

  it('shows the entry button when not skating', () => {
    const p = props({model: null}); render(p);
    const entry = host.querySelector<HTMLButtonElement>('.skate-entry')!;
    act(() => entry.click());
    expect(p.onStart).toHaveBeenCalled();
  });

  it('renders the live line ticker, balance meter and device hints', () => {
    render(props({model: model({line: line(['Ollie', 'Nollie Backside 180 Heelflip']), present: present({phase: 'manual', manual: 'manual', balance: -0.4})})}));
    expect(host.querySelector('.skate-ticket__label')!.textContent).toBe('Nollie Backside 180 Heelflip');
    expect(host.querySelectorAll('.skate-chain__chip')).toHaveLength(2);
    const meter = host.querySelector('[role=meter]')!;
    expect(meter.getAttribute('aria-valuenow')).toBe('-40');
    expect(host.querySelector('.skate-hints')).not.toBeNull();
    expect(host.querySelector('[data-skate-zone]')).toBeNull();
    expect(host.querySelector('[aria-live=polite]')!.textContent).toContain('Nollie Backside 180 Heelflip');
  });

  it('stamps a banked line and tears a lost one', () => {
    render(props({model: model({outcome: {outcome: {kind: 'banked', points: 2400, tricks: []}, seq: 1}})}));
    expect(host.querySelector('.skate-stamp')!.textContent).toBe('BANKED');
    render(props({model: model({outcome: {outcome: {kind: 'lost', points: 2400, reason: 'bad-angle'}, seq: 2}})}));
    expect(host.querySelector('.skate-tear')!.textContent).toContain('Landed sideways');
  });

  it('lays out touch slots with raw pointer events for the input track', () => {
    const onZonePointer = vi.fn();
    render(props({model: model({inputDevice: 'touch'}), onZonePointer}));
    const zones = [...host.querySelectorAll<HTMLElement>('[data-skate-zone]')].map(z => z.dataset.skateZone);
    expect(zones).toEqual(['left', 'right', 'push', 'brake', 'grab-front', 'grab-back']);
    expect(host.querySelector('.skate-hints')).toBeNull();
    const push = host.querySelector<HTMLElement>('[data-skate-zone=push]')!;
    // jsdom has no PointerEvent: a MouseEvent with a pointer type and id is what React reads.
    const pointer = (type: string) => Object.assign(new MouseEvent(type, {bubbles: true}), {pointerId: 3, pointerType: 'touch'});
    act(() => { push.dispatchEvent(pointer('pointerdown')); });
    expect(push.hasAttribute('data-held')).toBe(true);
    act(() => { push.dispatchEvent(pointer('pointerup')); });
    expect(push.hasAttribute('data-held')).toBe(false);
    expect(onZonePointer.mock.calls.map(c => [c[0], c[1].type])).toEqual([['push', 'pointerdown'], ['push', 'pointerup']]);
  });

  it('opens the pause book as a trapped dialog and closes on Escape', () => {
    const p = props({model: model(), gesturePath: (id: string) => id === 'kickflip' ? 'M0 0.8L0 -0.2L-0.7 -0.6' : null});
    render(p);
    const book = [...host.querySelectorAll<HTMLButtonElement>('.skate-top__nav button')].find(b => b.textContent!.includes('Book'))!;
    act(() => book.click());
    expect(p.onPause).toHaveBeenLastCalledWith(true);
    const dialog = host.querySelector<HTMLElement>('[role=dialog]')!;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement?.textContent).toBe('Back to the ride');
    expect(host.querySelector('.skate-hud__play')!.hasAttribute('inert')).toBe(true);
    // Trick book: drawn gesture for kickflip, placeholder for the rest.
    const tab = [...dialog.querySelectorAll<HTMLButtonElement>('[role=tab]')].find(t => t.textContent === 'Trick book')!;
    act(() => tab.click());
    expect(dialog.querySelectorAll('.skate-gesture__stroke')).toHaveLength(1);
    expect(dialog.querySelectorAll('.skate-gesture__missing').length).toBeGreaterThan(0);
    // Focus trap: Tab from the last control wraps to the first.
    const focusables = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)')].filter(e => e.tabIndex >= 0);
    act(() => focusables.at(-1)!.focus());
    act(() => { focusables.at(-1)!.dispatchEvent(new KeyboardEvent('keydown', {key: 'Tab', bubbles: true})); });
    expect(document.activeElement).toBe(focusables[0]);
    act(() => { dialog.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true})); });
    expect(p.onPause).toHaveBeenLastCalledWith(false);
    expect(host.querySelector('[role=dialog]')).toBeNull();
  });

  it('changes settings and picks routes from the book', () => {
    const p = props({model: model()});
    render(p);
    act(() => [...host.querySelectorAll<HTMLButtonElement>('.skate-top__nav button')].find(b => b.textContent!.includes('Book'))!.click());
    const settings = [...host.querySelectorAll<HTMLButtonElement>('[role=tab]')].find(t => t.textContent === 'Settings')!;
    act(() => settings.click());
    const goofy = [...host.querySelectorAll<HTMLInputElement>('input[type=radio]')].find(i => i.value === 'goofy')!;
    act(() => goofy.click());
    expect(p.onSettings).toHaveBeenCalledWith({stance: 'goofy'});
    const far = [...host.querySelectorAll<HTMLInputElement>('input[type=radio]')].find(i => i.value === 'far')!;
    act(() => far.click());
    expect(p.onSettings).toHaveBeenCalledWith({camera: 'far'});
    act(() => [...host.querySelectorAll<HTMLButtonElement>('[role=tab]')].find(t => t.textContent === 'Explore')!.click());
    const route = host.querySelector<HTMLButtonElement>('.skate-book__list button')!;
    act(() => route.click());
    expect(p.onRoute).toHaveBeenCalledWith(DEFAULT_SKATE_TABLES.routes[0]!.id);
    expect(host.querySelector('[role=dialog]')).toBeNull();
  });

  it('still runs from the v1 snapshot HarbourWorld passes today', () => {
    const session = createSkateSession();
    const state = createSkateState(25, -13, 0, {ground: () => 0, surface: () => ({y: 0, ramp: null}), obstacles: []});
    state.speed = 3; state.combo = 250; state.multiplier = 2; state.comboTricks = ['Ollie', 'Kickflip'];
    const onAction = vi.fn();
    render({...props({onSettings: undefined, onCommand: undefined}), snapshot: skateSnapshot(state, session), onAction});
    expect(host.querySelector('.skate-ticket__label')!.textContent).toBe('Kickflip');
    const retry = host.querySelector<HTMLButtonElement>('.skate-top__nav button')!;
    act(() => retry.click());
    expect(onAction).toHaveBeenCalledWith('respawn');
  });
});
