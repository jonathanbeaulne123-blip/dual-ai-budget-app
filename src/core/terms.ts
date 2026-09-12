/**
 * Hearth's words, in one place (feedback row 6: "in-app jargon").
 *
 * Internal names are for code and docs. The screen uses the household's
 * words. `USER_TERMS` is the map; `INTERNAL_TERMS_NEVER_SHOWN` is the fence
 * that test/terms.test.ts holds over every rendered string in src/**\/*.tsx.
 *
 * Words that stay, and why:
 * - "posted" / "Final Confirm" — the load-bearing verbs of the money boundary
 *   (docs/CLAUDE_COMMAND_STATES_UX.md). They are defined once, on the first
 *   receipt, not replaced.
 * - "Development" — the environment must be disclosed honestly; it is a
 *   name, not jargon.
 * - "Sitdown" — one spelling, the proper noun for the household ritual
 *   (Vision v2). Stored transaction notes that already say "Sit-down" are
 *   data and stay as written.
 */
export const USER_TERMS = {
  /** The on-device books engine. Never a library name on screen. */
  PGlite: "this phone’s books",
  /** The internal metaphor for the app. On screen it is Hearth, or "this household" when that is what is meant. */
  kitchen: "Hearth",
  /** The persisted household document. On screen it is the books. */
  snapshot: "the books",
  /** The household ritual, one spelling. */
  "Sit-down": "Sitdown",
} as const;

export type InternalTerm = keyof typeof USER_TERMS;

/**
 * Words that must not appear in a rendered string. Matched as whole words.
 * "kitchen" is matched lowercase only: a capitalised Kitchen (as in "Kitchen
 * vs takeout") is the room where people cook, not the metaphor.
 * CSS class names, ids, imports and code identifiers are not rendered strings.
 */
export const INTERNAL_TERMS_NEVER_SHOWN: readonly { term: string; pattern: RegExp; use: string }[] = [
  { term: "PGlite", pattern: /\bPGlite\b/, use: USER_TERMS.PGlite },
  { term: "kitchen", pattern: /\bkitchen\b/, use: USER_TERMS.kitchen },
  { term: "snapshot", pattern: /\bsnapshots?\b/i, use: USER_TERMS.snapshot },
  { term: "Sit-down", pattern: /\bsit-down\b/i, use: USER_TERMS["Sit-down"] },
];

/** Replace internal words in a sentence with the household's words. For copy that is assembled from runtime messages. */
export function householdWords(text: string): string {
  return text
    .replace(/\bPGlite\b/g, USER_TERMS.PGlite)
    .replace(/\bthe kitchen\b/gi, USER_TERMS.kitchen)
    .replace(/\bkitchen\b/gi, USER_TERMS.kitchen)
    .replace(/\bthe (household |shared )?snapshot\b/gi, USER_TERMS.snapshot)
    .replace(/\bsnapshot\b/gi, "books")
    .replace(/\bsit-down\b/gi, USER_TERMS["Sit-down"]);
}
