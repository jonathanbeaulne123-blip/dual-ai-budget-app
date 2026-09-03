import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AFFIRMATIVE_VERSION, isAffirmative } from "../src/core/index.ts";

const TRUE_CASES = [
  "yes", "yep", "yeah", "yup", "ya", "sure", "ok", "okay", "k", "next", "go",
  "go ahead", "let's go", "lets go", "ready", "i'm ready", "im ready", "sounds good",
  "good", "great", "perfect", "do it", "continue", "carry on", "keep going", "alright",
  "all right", "right", "please", "yes please", "mhm", "uh huh", "👍", "✅",
] as const;

const FALSE_CASES = [
  "no", "nope", "nah", "not yet", "not now", "wait", "hold on", "hang on", "stop",
  "maybe", "i think so", "probably", "what", "what?", "huh", "?", "", "   ", "idk",
  "later", "skip", "undo", "back", "why", "yes but", "no thanks", "sure?",
] as const;

describe("onboarding affirmative classifier", () => {
  it("has an explicit version", () => {
    expect(AFFIRMATIVE_VERSION).toBe(1);
  });

  it.each(TRUE_CASES)("accepts the exact affirmative phrase %j and its permitted variants", (phrase) => {
    expect(isAffirmative(phrase)).toBe(true);
    expect(isAffirmative(`  ${phrase}  `)).toBe(true);
    expect(isAffirmative(`${phrase}.`)).toBe(true);
    expect(isAffirmative(`${phrase}!`)).toBe(true);
    expect(isAffirmative(phrase.toUpperCase())).toBe(true);
    expect(isAffirmative(`  ${phrase.toUpperCase()}!  `)).toBe(true);
  });

  it.each(FALSE_CASES)("refuses the exact non-affirmative phrase %j", (phrase) => {
    expect(isAffirmative(phrase)).toBe(false);
  });

  it("refuses sentences over forty characters and unsupported locales", () => {
    expect(isAffirmative("yes, and then please take care of everything else too")).toBe(false);
    expect(isAffirmative("yes", "en")).toBe(true);
    expect(isAffirmative("yes", "en-CA")).toBe(true);
    expect(isAffirmative("yes", "fr-CA")).toBe(false);
    expect(isAffirmative("yes", "en-US")).toBe(false);
  });

  it("is local and does not import the command layer", () => {
    const source = readFileSync(new URL("../src/core/onboarding/affirmative.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/from\s+["'][^"']*commands\.ts["']/);
    expect(source).not.toMatch(/fetch\s*\(|XMLHttpRequest|WebSocket|EventSource/);
  });
});
