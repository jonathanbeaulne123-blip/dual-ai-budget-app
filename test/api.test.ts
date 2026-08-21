import { describe, expect, it } from "vitest";
import { apiUrl, hostingHint } from "../src/api.ts";

describe("Cloudflare static host pairing", () => {
  it("does not default pairing to a Netlify function", () => {
    expect(apiUrl()).toBe("");
  });

  it("describes Supabase as the shared books", () => {
    expect(hostingHint(true)).toMatch(/Supabase/);
    expect(hostingHint(false)).not.toMatch(/Netlify/i);
  });
});
