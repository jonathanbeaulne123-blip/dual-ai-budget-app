import { existsSync, readFileSync } from "node:fs";
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

  it("points Wrangler at dist/ so versions upload has an assets directory", () => {
    const config = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8")) as {
      main: string;
      assets: { directory: string; not_found_handling: string };
    };
    expect(config.main).toBe("workers/site.js");
    expect(config.assets.directory).toBe("./dist");
    expect(config.assets.not_found_handling).toBe("single-page-application");
  });

  it("does not ship a catch-all _redirects file that Cloudflare Workers rejects", () => {
    expect(existsSync(new URL("../public/_redirects", import.meta.url))).toBe(false);
  });
});
