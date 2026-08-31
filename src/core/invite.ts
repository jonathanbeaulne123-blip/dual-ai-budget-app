import { fillRuntimeRandom } from "./syntheticRuntime.ts";

/** Kitchen-safe words. Distinct enough to say across a table; not a cryptographic secret. */
export const INVITE_WORDS = [
  "amber", "apron", "aspen", "basin", "birch", "blanket", "bluff", "bramble",
  "cedar", "cello", "cider", "clover", "cobalt", "copper", "cove", "cradle",
  "daisy", "denim", "drift", "ember", "fable", "feather", "fern", "flint",
  "flour", "frost", "garden", "ginger", "glove", "grain", "grove", "harbor",
  "harvest", "hazel", "hearth", "honey", "ivy", "jasper", "kettle", "lantern",
  "lark", "laurel", "linen", "lotus", "maple", "marble", "meadow", "mint",
  "moss", "nectar", "needle", "nook", "olive", "opal", "orchard", "otter",
  "oven", "paper", "pebble", "pine", "plaid", "plaza", "plum", "pond",
  "quilt", "ridge", "river", "robin", "saffron", "sage", "shawl", "shore",
  "silo", "silver", "slate", "spice", "spruce", "stove", "sugar", "table",
  "thimble", "thyme", "timber", "toast", "trail", "tulip", "valley", "velvet",
  "violet", "wagon", "walnut", "willow", "window", "wool", "yarn", "yarrow",
  "zephyr", "beacon", "brook", "canvas", "coral", "delta", "echo", "compass",
] as const;

const LEGACY = /^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{6}$/;
const WORD_SET = new Set<string>(INVITE_WORDS);

function cleanWord(word: string): string {
  return word.toLowerCase().replace(/[^a-z]/g, "");
}

function randomInt(max: number): number {
  const bytes = new Uint8Array(4);
  fillRuntimeRandom(bytes);
  return (bytes[0]! * 0x1000000 + bytes[1]! * 0x10000 + bytes[2]! * 0x100 + bytes[3]!) % max;
}

export function randomInvitePhrase(): string {
  const pool = INVITE_WORDS.map(cleanWord).filter((word) => word.length >= 3);
  const picked: string[] = [];
  for (let i = 0; i < 3; i += 1) {
    const index = randomInt(pool.length);
    picked.push(pool.splice(index, 1)[0]!);
  }
  return picked.join("-");
}

export function inviteFromText(value: string | undefined | null): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw) || raw.includes("?join=") || raw.includes("/join/")) {
    try {
      const asUrl = new URL(raw, "https://hearth.local");
      const fromQuery = asUrl.searchParams.get("join");
      if (fromQuery) return inviteFromText(fromQuery);
      const parts = asUrl.pathname.split("/").filter(Boolean);
      if (parts[0] === "join" && parts[1]) return inviteFromText(decodeURIComponent(parts[1]));
    } catch {
      // Fall through to phrase parsing.
    }
  }
  const legacy = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (LEGACY.test(legacy)) return legacy;
  return raw
    .toLowerCase()
    .split(/[^a-z]+/)
    .map(cleanWord)
    .filter((word) => word.length >= 3)
    .slice(0, 3)
    .join("-");
}

export function isLegacyInviteCode(value: string): boolean {
  return LEGACY.test(value.toUpperCase().replace(/[^A-Z0-9]/g, ""));
}

export function isValidInviteToken(value: string | undefined | null): boolean {
  const token = inviteFromText(value);
  if (!token) return false;
  if (LEGACY.test(token)) return true;
  const words = token.split("-");
  return words.length === 3 && words.every((word) => WORD_SET.has(word));
}

export function formatInvitePhrase(value: string): string {
  const token = inviteFromText(value);
  if (LEGACY.test(token) && token.length === 6) return `${token.slice(0, 3)}-${token.slice(3)}`;
  return token
    .split("-")
    .filter(Boolean)
    .map((word) => word.slice(0, 1).toUpperCase() + word.slice(1))
    .join(" · ");
}

export function joinUrlFor(invite: string, origin: string): string {
  const token = inviteFromText(invite);
  return `${origin.replace(/\/$/, "")}/?join=${encodeURIComponent(token)}`;
}

export function inviteFromLocation(href: string): string {
  try {
    const url = new URL(href);
    const query = url.searchParams.get("join");
    if (query) return inviteFromText(query);
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] === "join" && parts[1]) return inviteFromText(parts[1]);
    if (url.hash) {
      const hash = url.hash.replace(/^#/, "");
      const params = new URLSearchParams(hash.startsWith("join") ? hash : hash);
      const fromHash = params.get("join") || (hash.startsWith("join=") ? hash.slice(5) : "");
      if (fromHash) return inviteFromText(fromHash);
    }
  } catch {
    return "";
  }
  return "";
}

export function spokenInviteHint(value: string): string {
  const formatted = formatInvitePhrase(value);
  if (formatted.includes("·")) return `Say “${formatted.replace(/ · /g, ", then ")}.”`;
  return `The household code is ${formatted}.`;
}
