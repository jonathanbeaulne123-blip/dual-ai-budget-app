/**
 * A bank of critically damped springs, integrated in closed form.
 *
 * For a target held over a step the exact solution is used, so the same
 * second of motion lands on the same pose at 30, 60 or 144 fps — no
 * frame-rate-dependent overshoot and no snapping. Allocation-free after
 * construction: positions and velocities live in typed arrays.
 */
export type SpringBank = {
  readonly x: Float64Array;
  readonly v: Float64Array;
  /** Angular frequency per channel (higher = stiffer). */
  readonly w: Float64Array;
  /** Advance every channel toward `target[i]` by `dt` seconds. */
  step(target: ArrayLike<number>, dt: number): void;
  /** Jump a channel to a value at rest. */
  set(i: number, value: number): void;
};

export function createSpringBank(stiffness: readonly number[], initial?: ArrayLike<number>): SpringBank {
  const n = stiffness.length;
  const x = new Float64Array(n), v = new Float64Array(n), w = new Float64Array(stiffness);
  if (initial) for (let i = 0; i < n; i += 1) x[i] = initial[i] ?? 0;
  return {
    x, v, w,
    step(target, dt) {
      if (!(dt > 0)) return;
      for (let i = 0; i < n; i += 1) {
        const k = w[i]!, g = target[i]!;
        if (!Number.isFinite(g)) continue;
        const c1 = x[i]! - g, c2 = v[i]! + k * c1, e = Math.exp(-k * dt);
        x[i] = g + (c1 + c2 * dt) * e;
        v[i] = (c2 - k * (c1 + c2 * dt)) * e;
      }
    },
    set(i, value) { x[i] = value; v[i] = 0; },
  };
}
