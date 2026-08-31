let sequence = 0;

function startMeasure(name: string): string | null {
  if (typeof performance === "undefined" || typeof performance.mark !== "function" || typeof performance.measure !== "function") return null;
  const marker = `${name}:start:${sequence += 1}`;
  performance.mark(marker);
  return marker;
}

function finishMeasure(name: string, marker: string | null): void {
  if (!marker) return;
  try {
    performance.measure(name, marker);
  } finally {
    performance.clearMarks?.(marker);
    const entries = performance.getEntriesByName?.(name) ?? [];
    if (entries.length > 40) performance.clearMeasures?.(name);
  }
}

export function measureHearthSync<T>(name: string, work: () => T): T {
  const marker = startMeasure(name);
  try {
    return work();
  } finally {
    finishMeasure(name, marker);
  }
}

export async function measureHearth<T>(name: string, work: () => Promise<T>): Promise<T> {
  const marker = startMeasure(name);
  try {
    return await work();
  } finally {
    finishMeasure(name, marker);
  }
}
