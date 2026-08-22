import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { hostingHint, UNPUBLISHED_PHRASE } from "../src/api.ts";

const root = fileURLToPath(new URL("..", import.meta.url));

describe("Cloudflare static host pairing", () => {
  it("describes Supabase as the shared books", () => {
    expect(hostingHint(true)).toMatch(/Supabase/);
    expect(hostingHint(false)).not.toMatch(/Netlify/i);
    expect(UNPUBLISHED_PHRASE).not.toMatch(/phrase is right/i);
  });

  it("points Wrangler at dist/ and runs the Worker before HTML assets", () => {
    const config = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8")) as {
      account_id: string;
      main: string;
      assets: { directory: string; not_found_handling: string; run_worker_first?: unknown };
    };
    expect(config.account_id).toBe("7dfdfbba3053d8b857cbc359e0761c00");
    expect(config.main).toBe("workers/site.js");
    expect(config.assets.directory).toBe("./dist");
    expect(config.assets.not_found_handling).toBe("single-page-application");
    expect(config.assets.run_worker_first).toBe(true);
  });

  it("does not ship a catch-all _redirects file that Cloudflare Workers rejects", () => {
    expect(existsSync(fileURLToPath(new URL("../public/_redirects", import.meta.url)))).toBe(false);
    const ignore = readFileSync(new URL("../public/.assetsignore", import.meta.url), "utf8");
    expect(ignore).toMatch(/^_redirects$/m);
    const pkg = readFileSync(new URL("../package.json", import.meta.url), "utf8");
    expect(pkg).toContain("rm -rf dist");
    expect(pkg).toContain("test ! -e dist/_redirects");
    const vite = readFileSync(new URL("../vite.config.ts", import.meta.url), "utf8");
    expect(vite).toContain("emptyOutDir: true");
  });

  it("does not keep a Netlify function or blob host in the working tree", () => {
    expect(existsSync(fileURLToPath(new URL("../netlify.toml", import.meta.url)))).toBe(false);
    expect(existsSync(fileURLToPath(new URL("../netlify/functions/hearth.ts", import.meta.url)))).toBe(false);
    const pkg = readFileSync(new URL("../package.json", import.meta.url), "utf8");
    expect(pkg).not.toContain("@netlify/blobs");
  });

  it("serves HTML with no-store so an old Worker shell cannot stick on the phone", () => {
    const worker = readFileSync(new URL("../workers/site.js", import.meta.url), "utf8");
    expect(worker).toContain("Cache-Control");
    expect(worker).toContain("no-store");
    expect(worker).toContain("env.ASSETS.fetch");
    expect(worker).toMatch(/text\/html/);
  });

  it("publishes hearth-books from main with wrangler deploy, not a preview upload", () => {
    const workflow = readFileSync(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8");
    expect(workflow).toContain("scripts/sanitize-cloudflare-env.sh");
    expect(workflow).toContain("wrangler deploy");
    expect(workflow).not.toContain("versions upload");
    expect(workflow).toMatch(/branches:\s*\[main\]/);
    expect(workflow).not.toContain("hearth-rebuild-cfde");
    expect(workflow).toContain("VITE_GOOGLE_CLIENT_ID");
    expect(workflow).toContain("::error::");
    expect(workflow).toContain("workflow_dispatch");
    expect(workflow).toContain("actions/checkout@v5");
    expect(workflow).toContain("pnpm/action-setup@v6");
    expect(workflow).toContain("actions/setup-node@v5");
    expect(workflow).not.toMatch(/No Cloudflare API secrets[\s\S]*exit 0/);
    const ci = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
    expect(ci).toContain("actions/checkout@v5");
    expect(ci).toContain("pnpm/action-setup@v6");
    expect(ci).toContain("actions/setup-node@v5");
  });

  it("strips wrapping quotes, Bearer, BOM, and newlines so Wrangler can authenticate", () => {
    const run = (env: Record<string, string>) =>
      execFileSync(
        "bash",
        [
          "-c",
          '. scripts/sanitize-cloudflare-env.sh && printf %s "$CLOUDFLARE_API_TOKEN|$CLOUDFLARE_ACCOUNT_ID|$VITE_GOOGLE_CLIENT_ID"',
        ],
        {
          cwd: root,
          encoding: "utf8",
          env: { ...process.env, ...env },
        },
      );

    expect(
      run({
        CLOUDFLARE_API_TOKEN: '"Bearer abc_Token-123"',
        CLOUDFLARE_ACCOUNT_ID: "'7dfdfbba3053d8b857cbc359e0761c00'",
        VITE_GOOGLE_CLIENT_ID: '  "123.apps.googleusercontent.com"  ',
      }),
    ).toBe("abc_Token-123|7dfdfbba3053d8b857cbc359e0761c00|123.apps.googleusercontent.com");

    expect(
      run({
        CLOUDFLARE_API_TOKEN: '\ufeff“\nBearer cfut_abc-123\n”',
        CLOUDFLARE_ACCOUNT_ID: "&quot;7dfdfbba3053d8b857cbc359e0761c00&quot;",
        VITE_GOOGLE_CLIENT_ID: "",
      }),
    ).toBe("cfut_abc-123|7dfdfbba3053d8b857cbc359e0761c00|");
  });
});
