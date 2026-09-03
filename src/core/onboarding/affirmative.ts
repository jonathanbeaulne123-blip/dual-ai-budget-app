export const AFFIRMATIVE_VERSION = 1;

const AFFIRMATIVE_LOCALES = new Set(["en", "en-ca"]);

const AFFIRMATIVE_PHRASES = new Set([
  "yes",
  "yep",
  "yeah",
  "yup",
  "ya",
  "sure",
  "ok",
  "okay",
  "k",
  "next",
  "go",
  "go ahead",
  "let's go",
  "lets go",
  "ready",
  "i'm ready",
  "im ready",
  "sounds good",
  "good",
  "great",
  "perfect",
  "do it",
  "continue",
  "carry on",
  "keep going",
  "alright",
  "all right",
  "right",
  "please",
  "yes please",
  "mhm",
  "uh huh",
  "👍",
  "✅",
]);

/** A deliberately narrow, local English classifier. It never calls a model or command. */
export function isAffirmative(text: string, locale = "en-CA"): boolean {
  if (!AFFIRMATIVE_LOCALES.has(locale.trim().toLowerCase())) return false;
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 40) return false;
  const normalized = trimmed.replace(/[.!]$/, "").trim().toLowerCase();
  return AFFIRMATIVE_PHRASES.has(normalized);
}
