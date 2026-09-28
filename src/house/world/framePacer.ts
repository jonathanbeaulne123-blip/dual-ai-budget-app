/** Keep a 60 Hz budget without losing a refresh to fractional rAF timestamps.
 * Deadlines advance from the previous deadline, not the actual paint time, so
 * 90/120/144 Hz displays do not accumulate rounding drift. Never catch up by
 * rendering multiple frames after a stall or a suspended tab.
 */
export function createFramePacer() {
  let next = 0, previousInterval = 0;
  return {
    due(now: number, intervalMs: number): boolean {
      if (intervalMs <= 0) { next = 0; previousInterval = 0; return true; }
      if (!next || intervalMs !== previousInterval || now - next > intervalMs * 4) {
        next = now + intervalMs; previousInterval = intervalMs; return true;
      }
      // Real rAF timestamps vary by over 1 ms on the measured 60 Hz Metal
      // browser. A 2 ms lead keeps those refreshes without accumulating drift.
      if (now + 2 < next) return false;
      next += Math.max(1, Math.floor((now - next) / intervalMs) + 1) * intervalMs;
      return true;
    },
    reset() { next = 0; previousInterval = 0; },
  };
}
