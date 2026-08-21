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

const INVITE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

export function randomInviteCode(): string {
  const bytes = new Uint8Array(6);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => INVITE_ALPHABET[byte % INVITE_ALPHABET.length]!).join("");
}

export function randomHouseholdId(): string {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  return `HH-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export function normalizeInviteCode(value: string | undefined | null): string {
  return String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function formatInviteCode(code: string): string {
  const normalized = normalizeInviteCode(code);
  if (normalized.length === 6) return `${normalized.slice(0, 3)}-${normalized.slice(3)}`;
  return normalized;
}

export function isValidInviteCode(value: string | undefined | null): boolean {
  return /^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{6}$/.test(normalizeInviteCode(value));
}
