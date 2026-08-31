import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { herculesProviderForDisplayedReply, herculesProviderLabel } from "../src/core/herculesChat.ts";

describe("Hercules reply provider marker", () => {
  it("uses quiet, human labels for every allowlisted reply source", () => {
    expect(herculesProviderLabel("gemini")).toBe("Gemini");
    expect(herculesProviderLabel("groq")).toBe("Groq");
    expect(herculesProviderLabel("openai")).toBe("OpenAI");
    expect(herculesProviderLabel("workers-ai")).toBe("Workers AI");
    expect(herculesProviderLabel("local")).toBe("On-device");
    expect(herculesProviderLabel("ai")).toBe("AI");
  });

  it("keeps the marker tiny and present in both phone and ordinary chat", () => {
    const ui = readFileSync(new URL("../src/Hercules.tsx", import.meta.url), "utf8");
    const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

    expect(ui.match(/aria-label={`Reply source:/g)).toHaveLength(2);
    expect(css).toMatch(/\.hercules-source\s*{[^}]*font-size:\s*10px;/s);
  });

  it("does not credit a provider when sanitization restores the journal answer", () => {
    const gemini = { text: "grounded answer", source: "ai" as const, provider: "gemini" as const };
    const local = { text: "local answer", source: "local" as const, provider: "local" as const };

    expect(herculesProviderForDisplayedReply(gemini, true)).toBe("gemini");
    expect(herculesProviderForDisplayedReply(gemini, false)).toBeNull();
    expect(herculesProviderForDisplayedReply(local)).toBe("local");
    expect(herculesProviderForDisplayedReply(local, false)).toBeNull();
  });
});
