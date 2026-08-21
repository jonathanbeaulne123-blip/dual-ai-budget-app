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
  void width;
  const bytes = new Uint8Array(5);
  for (let attempt = 0; attempt < 32; attempt += 1) {
    globalThis.crypto.getRandomValues(bytes);
    const id = `${prefix}${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
    if (!existingIds.includes(id)) return id;
  }
  throw new Error(`Could not allocate a unique id for ${prefix}.`);
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

export { randomInvitePhrase as randomInviteCode } from "./invite.ts";
export {
  formatInvitePhrase as formatInviteCode,
  inviteFromText as normalizeInviteCode,
  isValidInviteToken as isValidInviteCode,
} from "./invite.ts";

export function randomHouseholdId(): string {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  return `HH-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
