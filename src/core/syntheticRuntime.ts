type SyntheticRuntime = { random: () => number; nowIso: string };

let active: SyntheticRuntime | null = null;

function mulberry32(seed: number): () => number {
  return function random() {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Scoped entropy/time injection used only while building a replayable synthetic fixture. */
export function withSyntheticRuntime<T>(seed: number, nowIso: string, action: () => T): T {
  if (active) throw new Error("Synthetic fixture generation cannot be nested.");
  active = { random: mulberry32(seed), nowIso };
  try {
    return action();
  } finally {
    active = null;
  }
}

export function fillRuntimeRandom(bytes: Uint8Array): void {
  if (!active) {
    globalThis.crypto.getRandomValues(bytes);
    return;
  }
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(active.random() * 256);
}

export function runtimeNowIso(fallback = new Date()): string {
  return active?.nowIso ?? fallback.toISOString();
}
