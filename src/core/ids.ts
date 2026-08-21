export function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

export function nextSequence(existingIds: string[]): number {
  return existingIds.reduce((max, id) => {
    const match = String(id).match(/(\d+)\s*$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0) + 1;
}

export function nextId(prefix: string, existingIds: string[], width = 6): string {
  const id = `${prefix}${pad(nextSequence(existingIds), width)}`;
  if (existingIds.includes(id)) throw new Error(`Could not allocate a unique id for ${prefix}.`);
  return id;
}

export function slug(text: string): string {
  const value = text
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!value) throw new Error("Name must include letters or numbers.");
  return value;
}

export function uniquePrefixedId(prefix: string, existingIds: string[]): string {
  if (!existingIds.includes(prefix)) return prefix;
  let n = 2;
  while (existingIds.includes(`${prefix}-${n}`)) n += 1;
  return `${prefix}-${n}`;
}

export function nowIso(now = new Date()): string {
  return now.toISOString();
}
