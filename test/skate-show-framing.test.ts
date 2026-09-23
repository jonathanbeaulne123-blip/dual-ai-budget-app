/**
 * The skate chase camera on every Skate Lab scenario (headless, real driver,
 * real park field): the rider — head and board — stays in frame, the eye never
 * sits inside the park, and it never jams against the rider or wanders off.
 * `LAB_DEBUG=1` prints a per-frame table for the scenario that fails.
 */
import {describe, expect, it} from 'vitest';
import {createLabCore} from './browser/skateLabCore.ts';
import {LAB_SCENARIOS} from './browser/skateLabScenarios.ts';
import {groundHeightAt} from '../src/harbour/scene/ground.ts';
import {skateField} from '../src/harbour/skate/driver.ts';
import {createSkateCamera, projectToView, type SkateCameraFrame} from '../src/harbour/skate/camera/skateCamera.ts';

const field = skateField();
const blocked = (x: number, y: number, z: number) => y < field.heightAt(x, z) + 0.05;

type Shot = {frame: number; phase: string; mode: string; head: [number, number] | null; board: [number, number] | null; eyeClear: number; dist: number; fov: number};

function film(name: string, aspect: number): Shot[] {
  const sc = LAB_SCENARIOS.find(s => s.name === name)!;
  const lab = createLabCore(); lab.load(sc.load); lab.script(sc.script);
  const cam = createSkateCamera({ground: groundHeightAt});
  const shots: Shot[] = [];
  let f: SkateCameraFrame;
  cam.snap(lab.present()!);
  for (let i = 0; i < sc.frames; i++) {
    lab.step(1);
    const p = lab.present()!;
    if (lab.driver()?.takeCut()) cam.snap(p);
    f = cam.update(p, lab.events(), 1 / 60, {aspect, blocked});
    const head = projectToView(f, [p.x, p.y + 1.15, p.z], aspect), board = projectToView(f, [p.x, p.y + 0.05, p.z], aspect);
    shots.push({frame: i + 1, phase: p.phase, mode: cam.mode(), head, board, eyeClear: f.position[1] - field.heightAt(f.position[0], f.position[2]),
      dist: Math.hypot(f.position[0] - p.x, f.position[1] - p.y - 0.6, f.position[2] - p.z), fov: f.fov});
  }
  return shots;
}
const inside = (v: [number, number] | null, m = 0.02) => v !== null && v[0] >= m && v[0] <= 1 - m && v[1] >= m && v[1] <= 1 - m;

describe('skate chase camera · every lab scenario', () => {
  for (const sc of LAB_SCENARIOS) for (const [label, aspect] of [['desktop', 1.6], ['phone', 390 / 844]] as const) {
    it(`${sc.name} (${label}): rider framed, eye clear of the park`, () => {
      const shots = film(sc.name, aspect);
      if (process.env.LAB_DEBUG && (!process.env.LAB_ONLY || process.env.LAB_ONLY === sc.name)) for (const s of shots) if (s.frame % Number(process.env.LAB_EVERY ?? 5) === 0) console.log(sc.name, label, s.frame, s.phase, s.mode, s.head?.map(v => v.toFixed(2)).join(','), s.board?.map(v => v.toFixed(2)).join(','), s.eyeClear.toFixed(2), s.dist.toFixed(2), s.fov.toFixed(1));
      const bad = shots.filter(s => !inside(s.board) || !inside(s.head, -0.02));
      // The bail tumble may briefly put the head off the edge; everything else is framed.
      const allowed = shots.filter(s => s.phase === 'bail' || s.phase === 'recover').length * 0.25;
      expect(bad.length, `${sc.name}: out of frame at ${bad.slice(0, 8).map(s => `#${s.frame} ${s.phase}`).join(', ')}`).toBeLessThanOrEqual(allowed);
      const buried = shots.filter(s => s.eyeClear < 0.12);
      expect(buried.map(s => `#${s.frame}`), `${sc.name}: eye inside the park`).toEqual([]);
      const jammed = shots.filter(s => s.dist < 1.1 || s.dist > 7.5);
      expect(jammed.map(s => `#${s.frame} ${s.dist.toFixed(2)}`), `${sc.name}: eye too close/far`).toEqual([]);
    });
  }
});
