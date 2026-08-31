/** Stable, synchronous seed derivation for replayable synthetic fixtures. */
export function deriveDemoSeed(masterSeed: number, domain: string): number {
  let hash = (masterSeed >>> 0) ^ 0x811c9dc5;
  for (let index = 0; index < domain.length; index += 1) {
    hash ^= domain.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  return hash >>> 0;
}

export function createDemoRandom(masterSeed: number, domain: string): () => number {
  let seed = deriveDemoSeed(masterSeed, domain);
  return function random() {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function freshDemoSeed(): number {
  const words = new Uint32Array(1);
  crypto.getRandomValues(words);
  return words[0] || 1;
}

export function chooseDemo<T>(random: () => number, values: readonly T[]): T {
  return values[Math.min(values.length - 1, Math.floor(random() * values.length))]!;
}
