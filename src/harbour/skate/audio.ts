/**
 * Tideline Skate Club v2 — synthesized board sound.
 *
 * Original WebAudio synthesis only: no media files, no network. Created from
 * a user gesture (sound on), driven once per frame with the sim's present and
 * events, and closed on dispose. Master volume stays modest.
 *
 *  - Rolling roar: looped seeded noise through a per-surface filter, volume
 *    and brightness by speed (concrete hiss, wood hollow, cobble rattle,
 *    grass mute, metal ring).
 *  - One-shots: push scuff, pop snap, flick scrape, catch thunk, landing by
 *    impact, grind clack, bail thud.
 *  - Beds: metal grind scrape vs ledge wax slide, powerslide screech, wind
 *    in long airs.
 *
 * Mix (OfflineAudioContext render in Chromium, 2026-09-23; peaks dBFS):
 * ollie pop ≈ −21 (kickflip with its scrape ≈ −14), land ≈ −19…−20 with the
 * heaviest body, bail ≈ −15, grind clack ≈ −21; beds (RMS) roll concrete ≈ −36,
 * grind ≈ −37, wood ≈ −40, cobble ≈ −42, whole line peak ≈ −14. Landings sit just above pops; the grind bed sits over the
 * roll it replaces; nothing is a raw square/saw without a filter above 1.5 kHz.
 */
import type {GrindableKind, SkatePresent, SkateSimEvent, SurfaceKind} from './contract.ts';

export type SkateAudioOptions = {
  /** Master volume 0..1 (multiplied by a modest ceiling). */
  volume?: number;
  /** Tests inject a fake; defaults to `new AudioContext()`. */
  createContext?: () => AudioContext;
};
export type SkateAudio = {
  update(present: SkatePresent | null, events: readonly SkateSimEvent[], dt: number, opts?: {paused?: boolean; hidden?: boolean}): void;
  setVolume(volume: number): void;
  dispose(): void;
  readonly disposed: boolean;
};

/** Master ceiling. A soft compressor sits after it (when the context has one), so stacked one-shots never spike. */
export const SKATE_AUDIO_CEILING = 0.34;
type SurfaceVoice = {type: BiquadFilterType; freq: number; q: number; gain: number; body: number; bodyFreq: number; rattle: number; rattleRate: number};
export const SURFACE_VOICE: Record<SurfaceKind, SurfaceVoice> = {
  concrete: {type: 'highpass', freq: 900, q: 0.5, gain: 0.07, body: 0, bodyFreq: 160, rattle: 0, rattleRate: 0},
  path: {type: 'bandpass', freq: 1300, q: 0.6, gain: 0.07, body: 0, bodyFreq: 160, rattle: 0.15, rattleRate: 18},
  wood: {type: 'lowpass', freq: 700, q: 1.2, gain: 0.12, body: 7, bodyFreq: 190, rattle: 0.08, rattleRate: 9},
  metal: {type: 'bandpass', freq: 2300, q: 2.5, gain: 0.06, body: 4, bodyFreq: 820, rattle: 0, rattleRate: 0},
  cobble: {type: 'bandpass', freq: 800, q: 0.8, gain: 0.11, body: 3, bodyFreq: 120, rattle: 0.65, rattleRate: 22},
  sand: {type: 'lowpass', freq: 380, q: 0.4, gain: 0.03, body: 0, bodyFreq: 120, rattle: 0.1, rattleRate: 6},
  grass: {type: 'lowpass', freq: 260, q: 0.3, gain: 0.018, body: 0, bodyFreq: 100, rattle: 0.05, rattleRate: 5},
};
const METAL: ReadonlySet<GrindableKind> = new Set(['round-rail', 'kinked-rail', 'coping']);

export function createSkateAudio(options: SkateAudioOptions = {}): SkateAudio | null {
  const make = options.createContext ?? (typeof AudioContext === 'undefined' ? null : () => new AudioContext());
  if (!make) return null;
  let ctx: AudioContext;
  try { ctx = make(); } catch { return null; }
  const now = () => ctx.currentTime;
  const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : Number.isFinite(v) ? v : lo);
  let volume = clamp(options.volume ?? 1, 0, 1);

  const master = ctx.createGain(); master.gain.value = 0;
  // Glue and a safety net: a gentle compressor between the mix and the speakers.
  const glue = typeof ctx.createDynamicsCompressor === 'function' ? ctx.createDynamicsCompressor() : null;
  if (glue) { glue.threshold.value = -20; glue.knee.value = 10; glue.ratio.value = 3.5; glue.attack.value = 0.003; glue.release.value = 0.2; master.connect(glue); glue.connect(ctx.destination); }
  else master.connect(ctx.destination);
  // Seeded noise (1 s) shared by every voice.
  const noise = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate)), ctx.sampleRate), data = noise.getChannelData(0);
  let seed = 31; for (let i = 0; i < data.length; i++) { seed = (seed * 16807) % 2147483647; data[i] = (seed / 2147483647) * 2 - 1; }
  const loop = (): AudioBufferSourceNode => { const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; return s; };
  const bed = (): GainNode => { const g = ctx.createGain(); g.gain.value = 0; g.connect(master); return g; };

  // Rolling roar: noise → surface filter → body resonance → rattle AM → gain.
  const rollGain = bed(), rattleGain = ctx.createGain(), rollFilter = ctx.createBiquadFilter(), rollBody = ctx.createBiquadFilter(), rollSrc = loop();
  rollBody.type = 'peaking'; rollBody.gain.value = 0; rattleGain.gain.value = 1;
  rollSrc.connect(rollFilter); rollFilter.connect(rollBody); rollBody.connect(rattleGain); rattleGain.connect(rollGain);
  const rattleLfo = ctx.createOscillator(), rattleDepth = ctx.createGain(); rattleLfo.type = 'square'; rattleLfo.frequency.value = 12; rattleDepth.gain.value = 0;
  rattleLfo.connect(rattleDepth); rattleDepth.connect(rattleGain.gain);
  // Grind: saw + band noise (metal) or low wax noise (ledge).
  const grindGain = bed(), grindSaw = ctx.createOscillator(), grindSawGain = ctx.createGain(), grindNoise = loop(), grindFilter = ctx.createBiquadFilter();
  // The saw is the rail's ring; a lowpass takes its fizz off so a long grind never grates.
  const grindTone = ctx.createBiquadFilter(); grindTone.type = 'lowpass'; grindTone.frequency.value = 1500; grindTone.Q.value = 0.7;
  grindSaw.type = 'sawtooth'; grindSaw.frequency.value = 190; grindSawGain.gain.value = 0; grindSaw.connect(grindTone); grindTone.connect(grindSawGain); grindSawGain.connect(grindGain);
  grindFilter.type = 'bandpass'; grindFilter.Q.value = 3; grindNoise.connect(grindFilter); grindFilter.connect(grindGain);
  // Powerslide screech: resonant band noise with a wobble.
  const slideGain = bed(), slideFilter = ctx.createBiquadFilter(), slideSrc = loop();
  slideFilter.type = 'bandpass'; slideFilter.frequency.value = 1600; slideFilter.Q.value = 9; slideSrc.connect(slideFilter); slideFilter.connect(slideGain);
  // Wind: filtered noise for long airs.
  const windGain = bed(), windFilter = ctx.createBiquadFilter(), windSrc = loop();
  windFilter.type = 'bandpass'; windFilter.frequency.value = 500; windFilter.Q.value = 0.7; windSrc.connect(windFilter); windFilter.connect(windGain);

  const started: (AudioScheduledSourceNode)[] = [rollSrc, rattleLfo, grindSaw, grindNoise, slideSrc, windSrc];
  for (const s of started) s.start();
  let disposed = false, voices = 0, grindMetal = true, surface: SurfaceKind | null = null, wobble = 0;
  void ctx.resume?.().catch(() => {});

  /** A short one-shot: noise or tone through a filter, with an attack/decay envelope. */
  function shot(o: {gain: number; decay: number; attack?: number; filter?: BiquadFilterType; freq?: number; freqTo?: number; q?: number; tone?: OscillatorType; toneFreq?: number; toneTo?: number; delay?: number}): void {
    if (disposed || voices >= 10 || o.gain <= 0) return;
    const t0 = now() + (o.delay ?? 0), a = o.attack ?? 0.003, end = t0 + a + o.decay;
    const g = ctx.createGain(); g.gain.value = 0; g.connect(master);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(o.gain, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, end);
    let src: AudioScheduledSourceNode, f: BiquadFilterNode | null = null;
    if (o.tone) {
      const osc = ctx.createOscillator(); osc.type = o.tone; osc.frequency.setValueAtTime(o.toneFreq ?? 200, t0);
      if (o.toneTo) osc.frequency.exponentialRampToValueAtTime(o.toneTo, end);
      src = osc; osc.connect(g);
    } else {
      const b = ctx.createBufferSource(); b.buffer = noise; src = b;
      f = ctx.createBiquadFilter(); f.type = o.filter ?? 'bandpass'; f.frequency.setValueAtTime(o.freq ?? 1000, t0); f.Q.value = o.q ?? 0.8;
      if (o.freqTo) f.frequency.exponentialRampToValueAtTime(o.freqTo, end);
      b.connect(f); f.connect(g);
    }
    voices++;
    src.onended = () => { voices--; try { src.disconnect(); f?.disconnect(); g.disconnect(); } catch { /* already gone */ } };
    src.start(t0); src.stop(end + 0.02);
  }
  const sounds = {
    push: () => shot({gain: 0.05, attack: 0.04, decay: 0.16, filter: 'lowpass', freq: 1100, q: 0.4}),
    pop: (h: number) => {
      // Sharp wooden snap: a bright click, a hollow knock and a tail scrape.
      const k = clamp(0.7 + h * 0.4, 0.6, 1.2);
      shot({gain: 0.12 * k, decay: 0.035, filter: 'highpass', freq: 2200, q: 0.7});
      shot({gain: 0.15 * k, decay: 0.07, tone: 'triangle', toneFreq: 420, toneTo: 180});
      shot({gain: 0.05, decay: 0.08, filter: 'bandpass', freq: 3000, freqTo: 1500, q: 1.5, delay: 0.01});
    },
    flick: () => shot({gain: 0.05, attack: 0.01, decay: 0.12, filter: 'bandpass', freq: 3400, freqTo: 1400, q: 2.2}),
    catch: (quality: number) => {
      shot({gain: 0.1 + 0.05 * clamp(quality, 0, 1), decay: 0.07, tone: 'sine', toneFreq: 160, toneTo: 90});
      shot({gain: 0.05, decay: 0.03, filter: 'highpass', freq: 2500});
    },
    land: (impact: number) => {
      const k = clamp(impact, 0.15, 1);
      shot({gain: 0.27 * k, decay: 0.12 + 0.1 * k, tone: 'sine', toneFreq: 95, toneTo: 48});
      shot({gain: 0.16 * k, decay: 0.09, filter: 'lowpass', freq: 900, q: 0.5});
      shot({gain: 0.06 * k, decay: 0.05, filter: 'highpass', freq: 2600, delay: 0.012});
    },
    clack: () => shot({gain: 0.09, decay: 0.05, tone: 'square', toneFreq: 1150, toneTo: 700}),
    bail: () => {
      shot({gain: 0.2, decay: 0.28, tone: 'sine', toneFreq: 80, toneTo: 38});
      shot({gain: 0.1, attack: 0.02, decay: 0.35, filter: 'lowpass', freq: 600, q: 0.4, delay: 0.06});
      shot({gain: 0.06, decay: 0.2, filter: 'bandpass', freq: 1800, freqTo: 600, q: 1, delay: 0.18});
    },
    revert: () => shot({gain: 0.06, attack: 0.02, decay: 0.22, filter: 'bandpass', freq: 1400, freqTo: 900, q: 3}),
  };

  const set = (param: AudioParam, value: number, tc: number) => param.setTargetAtTime(clamp(value, -1e5, 1e5), now(), tc);
  const api: SkateAudio = {
    update(p, events, dt, opts) {
      if (disposed) return;
      const quiet = !p || Boolean(opts?.paused) || Boolean(opts?.hidden) || (typeof document !== 'undefined' && document.hidden);
      set(master.gain, quiet ? 0 : SKATE_AUDIO_CEILING * volume, quiet ? 0.05 : 0.15);
      if (quiet || !p) { set(rollGain.gain, 0, 0.05); set(grindGain.gain, 0, 0.05); set(slideGain.gain, 0, 0.05); set(windGain.gain, 0, 0.1); return; }
      const speed = clamp(p.speed / 12, 0, 1), phase = p.phase;
      const grounded = phase !== 'air' && phase !== 'grind' && phase !== 'bail';
      if (p.surface !== surface) {
        surface = p.surface; const v = SURFACE_VOICE[surface] ?? SURFACE_VOICE.concrete;
        rollFilter.type = v.type; rollFilter.Q.value = v.q; set(rollBody.gain, v.body, 0.05); set(rollBody.frequency, v.bodyFreq, 0.05);
        set(rattleLfo.frequency, v.rattleRate || 1, 0.05);
      }
      const v = SURFACE_VOICE[p.surface] ?? SURFACE_VOICE.concrete;
      set(rollFilter.frequency, v.freq * (0.6 + speed * 0.9), 0.08);
      set(rattleDepth.gain, v.rattle * speed * 0.8, 0.08);
      set(rattleLfo.frequency, (v.rattleRate || 1) * (0.5 + speed), 0.1);
      const manualK = phase === 'manual' ? 0.6 : 1;
      set(rollGain.gain, grounded ? v.gain * Math.sqrt(speed) * manualK : 0, 0.07);
      rollSrc.playbackRate.setTargetAtTime(0.55 + speed * 1.2, now(), 0.1);
      // Grind bed.
      const grinding = phase === 'grind';
      set(grindGain.gain, grinding ? 0.1 + speed * 0.05 : 0, grinding ? 0.02 : 0.05);
      set(grindSawGain.gain, grinding && grindMetal ? 0.16 : 0, 0.03);
      set(grindFilter.frequency, grindMetal ? 2400 + speed * 900 : 700 + speed * 300, 0.05);
      set(grindSaw.frequency, 150 + speed * 160 + (p.balance || 0) * 30, 0.05);
      // Powerslide screech with a wobble.
      const sliding = phase === 'powerslide';
      wobble += (Number.isFinite(dt) ? clamp(dt, 0, 0.1) : 0) * 23;
      set(slideGain.gain, sliding ? 0.03 + speed * 0.05 : 0, sliding ? 0.03 : 0.08);
      set(slideFilter.frequency, 1500 + Math.sin(wobble) * 180 + speed * 400, 0.02);
      // Wind grows with time in the air.
      const air = phase === 'air' ? clamp((p.airTime - 0.35) / 0.8, 0, 1) : 0;
      set(windGain.gain, air * 0.06, air > 0 ? 0.25 : 0.08);
      set(windFilter.frequency, 380 + air * 500 + speed * 200, 0.2);
      for (const e of events) {
        switch (e.kind) {
          case 'push': sounds.push(); break;
          case 'pop': sounds.pop(e.height); if (e.flipId) sounds.flick(); break;
          case 'late-flip': sounds.flick(); break;
          case 'flip-caught': sounds.catch(e.quality); break;
          case 'land': sounds.land(clamp(0.25 + e.airTime * 0.55 + (1 - e.boardClean) * 0.2, 0, 1)); break;
          case 'grind-start': grindMetal = METAL.has(e.kind2); sounds.clack(); break;
          case 'grind-end': if (e.exit !== 'bail') sounds.clack(); break;
          case 'revert': sounds.revert(); break;
          case 'lip-trick': sounds.clack(); break;
          case 'bail': sounds.bail(); break;
          default: break;
        }
      }
    },
    setVolume(next) { volume = clamp(next, 0, 1); },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const s of started) { try { s.stop(); s.disconnect(); } catch { /* not started or already stopped */ } }
      try { master.disconnect(); } catch { /* ignore */ }
      try { glue?.disconnect(); } catch { /* ignore */ }
      void ctx.close?.().catch(() => {});
    },
    get disposed() { return disposed; },
  };
  return api;
}
