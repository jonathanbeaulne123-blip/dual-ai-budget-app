/**
 * Bridge from the v1 `SkateSnapshot` (rider.ts + skateModel.ts, published at
 * ~10 Hz) to the v2 HUD source and audio events, so the rebuilt HUD and audio
 * run on this branch before integration swaps in the v2 sim. Delete with
 * skateModel.ts once runtime publishes SkatePresent + ScoreLine directly.
 */
import type {ScoreLine, ScoreOutcome, SkatePresent, SkateSimEvent} from '../contract.ts';
import type {SkateSnapshot} from '../session.ts';
import type {HudSource, InputDevice} from './model.ts';

export type LegacyFrame = {source: HudSource; present: SkatePresent | null; events: SkateSimEvent[]};

export function createLegacyHudAdapter() {
  let lastEvent = -1, lastMode: string | null = null, lastTotal = 0, outcome: {outcome: ScoreOutcome; seq: number} | null = null, seq = 0, clock = 0;
  return {
    frame(s: SkateSnapshot | null, inputDevice: InputDevice): LegacyFrame | null {
      if (!s) { lastMode = null; return null; }
      clock += 0.1;
      const phase: SkatePresent['phase'] = s.mode === 'air' ? 'air' : s.mode === 'grind' ? 'grind' : s.mode === 'bail' ? 'bail' : s.balancing ? 'manual' : s.speed > 0.1 ? 'roll' : 'idle';
      const present: SkatePresent = {
        x: s.x, y: 0, z: s.z, vx: Math.sin(s.yaw) * s.speed, vy: 0, vz: Math.cos(s.yaw) * s.speed, speed: s.speed, heading: s.yaw,
        boardYaw: s.yaw, boardPitch: 0, boardRoll: 0, bodyTwist: 0, phase, stance: s.progress.settings.stance, switch: false, fakie: false,
        crouch: 0, lean: 0, carve: 0, balance: s.balance, pushPhase: 0, airTime: 0, clearance: s.mode === 'air' ? 0.4 : 0,
        trick: null, grab: null, grind: s.mode === 'grind' ? {grindId: '50-50', grindableId: 'rail', faceSign: 1} : null,
        manual: s.balancing && s.mode === 'ride' ? 'manual' : null, bail: null, impact: 0, surface: 'concrete',
      };
      const events: SkateSimEvent[] = [];
      const was = lastMode;
      if (was !== null && was !== s.mode) {
        if (s.mode === 'air') events.push({t: clock, kind: 'pop', from: 'tail', switch: false, fakie: false, height: 0.5, flipId: null, fromFeature: null});
        if (was === 'air' && s.mode === 'ride') events.push({t: clock, kind: 'land', spinDeg: 0, boardClean: 1, fakie: false, switch: false, airTime: 0.5, gap: 0, onFeature: null, revert: false});
        if (s.mode === 'grind') events.push({t: clock, kind: 'grind-start', grindId: '50-50', grindableId: 'rail', kind2: 'round-rail', switch: false, fakie: false});
        if (was === 'grind') events.push({t: clock, kind: 'grind-end', grindId: '50-50', grindableId: 'rail', distance: 1, seconds: 1, exit: s.mode === 'bail' ? 'bail' : 'roll'});
        if (s.mode === 'bail') events.push({t: clock, kind: 'bail', reason: 'balance'});
      }
      lastMode = s.mode;
      if (s.eventId !== lastEvent) {
        if (lastEvent >= 0 && s.eventKind === 'bank') outcome = {outcome: {kind: 'banked', points: lastTotal, tricks: []}, seq: ++seq};
        if (lastEvent >= 0 && s.eventKind === 'bail' && lastTotal > 0) outcome = {outcome: {kind: 'lost', points: lastTotal, reason: 'balance'}, seq: ++seq};
        if (s.eventKind === 'bank' || s.eventKind === 'bail') lastTotal = 0;
        lastEvent = s.eventId;
      }
      const line: ScoreLine = {active: s.combo > 0, tricks: s.tricks.map(label => ({label, points: 0})), base: s.combo, multiplier: s.multiplier, keepAlive: s.comboTime, latest: s.combo > 0 ? s.tricks.at(-1) ?? s.event : null};
      if (s.combo > 0) lastTotal = Math.round(s.combo * s.multiplier);
      const source: HudSource = {present, line, outcome, paused: s.paused, inputDevice,
        session: {progress: s.progress, run: s.run, message: s.message, revision: s.revision, spotId: s.spotId, spotCard: s.spotCard, goalProgress: s.goalProgress}};
      return {source, present, events};
    },
  };
}
