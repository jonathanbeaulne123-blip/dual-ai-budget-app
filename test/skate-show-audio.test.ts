import {describe, expect, it} from 'vitest';
import {SKATE_AUDIO_CEILING, SURFACE_VOICE, createSkateAudio} from '../src/harbour/skate/audio.ts';
import type {SkatePresent, SkateSimEvent} from '../src/harbour/skate/contract.ts';

/** Just enough of the Web Audio graph to count what the module builds and schedules. */
function fakeContext() {
  const log = {started: 0, stopped: 0, sources: 0, closed: false, resumed: false, targets: [] as number[]};
  const param = (v = 0) => ({value: v, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime(x: number) { log.targets.push(x); }});
  const node = () => ({connect() {}, disconnect() {}});
  const scheduled = () => ({...node(), start() { log.started++; }, stop() { log.stopped++; }, onended: null as null | (() => void)});
  const ctx = {
    currentTime: 0, sampleRate: 8000, destination: node(),
    createGain: () => ({...node(), gain: param(1)}),
    createBiquadFilter: () => ({...node(), type: 'lowpass', frequency: param(350), Q: param(1), gain: param(0)}),
    createOscillator: () => ({...scheduled(), type: 'sine', frequency: param(440)}),
    createBufferSource: () => { log.sources++; return {...scheduled(), buffer: null, loop: false, playbackRate: param(1)}; },
    createBuffer: (_c: number, n: number) => ({getChannelData: () => new Float32Array(n)}),
    resume: async () => { log.resumed = true; },
    close: async () => { log.closed = true; },
  };
  return {ctx: ctx as unknown as AudioContext, log};
}
const present = (o: Partial<SkatePresent> = {}): SkatePresent => ({
  x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 6, speed: 6, heading: 0, boardYaw: 0, boardPitch: 0, boardRoll: 0, bodyTwist: 0,
  phase: 'roll', stance: 'regular', switch: false, fakie: false, crouch: 0, lean: 0, carve: 0, balance: 0, pushPhase: 0,
  airTime: 0, clearance: 0, trick: null, grab: null, grind: null, manual: null, bail: null, impact: 0, surface: 'concrete', ...o,
});
const EVERY: SkateSimEvent[] = [
  {t: 0, kind: 'push'}, {t: 0, kind: 'pop', from: 'tail', switch: false, fakie: false, height: 0.7, flipId: 'kickflip', fromFeature: null},
  {t: 0, kind: 'late-flip', flipId: 'heelflip'}, {t: 0, kind: 'flip-caught', flipId: 'kickflip', quality: 0.9},
  {t: 0, kind: 'land', spinDeg: 180, boardClean: 0.8, fakie: true, switch: false, airTime: 0.9, gap: 2, onFeature: null, revert: false},
  {t: 0, kind: 'grind-start', grindId: '50-50', grindableId: 'r', kind2: 'round-rail', switch: false, fakie: false},
  {t: 0, kind: 'grind-end', grindId: '50-50', grindableId: 'r', distance: 3, seconds: 1, exit: 'ollie'},
  {t: 0, kind: 'revert'}, {t: 0, kind: 'bail', reason: 'hard-impact'},
];

describe('skate audio v2', () => {
  it('is absent without an AudioContext and never throws creating one', () => {
    expect(createSkateAudio({createContext: undefined})).toBeNull(); // node: no AudioContext global
    expect(createSkateAudio({createContext: () => { throw Error('blocked by autoplay'); }})).toBeNull();
  });

  it('builds its beds, plays every event one-shot, and disposes cleanly', () => {
    const {ctx, log} = fakeContext();
    const audio = createSkateAudio({createContext: () => ctx})!;
    expect(audio).not.toBeNull();
    const beds = log.started;
    expect(beds).toBeGreaterThanOrEqual(6); // roll, rattle LFO, grind saw+noise, slide, wind
    audio.update(present(), EVERY, 1 / 60);
    expect(log.started).toBeGreaterThan(beds + 8); // one-shots scheduled
    // The master level is the first value each update schedules; it never exceeds the modest ceiling.
    const masters: number[] = [];
    const frame = (p: SkatePresent) => { const n = log.targets.length; audio.update(p, [], 1 / 60); masters.push(log.targets[n]!); };
    for (const surface of Object.keys(SURFACE_VOICE) as SkatePresent['surface'][]) frame(present({surface}));
    for (const phase of ['air', 'grind', 'manual', 'powerslide', 'bail'] as const) frame(present({phase, airTime: 1.2}));
    audio.setVolume(5); frame(present());
    expect(log.targets.every(Number.isFinite)).toBe(true);
    expect(Math.max(...masters)).toBeCloseTo(SKATE_AUDIO_CEILING, 9);
    expect(SKATE_AUDIO_CEILING).toBeLessThanOrEqual(0.5);
    audio.dispose(); audio.dispose();
    expect(audio.disposed).toBe(true); expect(log.closed).toBe(true); expect(log.stopped).toBeGreaterThanOrEqual(beds);
    const after = log.started; audio.update(present(), EVERY, 1 / 60); expect(log.started).toBe(after); // inert once disposed
  });

  it('goes quiet when paused, hidden or not skating', () => {
    const {ctx, log} = fakeContext();
    const audio = createSkateAudio({createContext: () => ctx})!;
    for (const [p, opts] of [[present(), {paused: true}], [present(), {hidden: true}], [null, {}]] as const) {
      log.targets.length = 0; const started = log.started;
      audio.update(p, EVERY, 1 / 60, opts);
      expect(log.targets[0]).toBe(0); // master first, to silence
      expect(log.started).toBe(started); // no one-shots while quiet
    }
    audio.dispose();
  });

  it('caps simultaneous one-shots so a burst of events cannot pile up', () => {
    const {ctx, log} = fakeContext();
    const audio = createSkateAudio({createContext: () => ctx})!;
    const beds = log.started;
    audio.update(present(), Array.from({length: 40}, () => EVERY[8]!), 1 / 60);
    expect(log.started - beds).toBeLessThanOrEqual(10);
    audio.dispose();
  });
});
