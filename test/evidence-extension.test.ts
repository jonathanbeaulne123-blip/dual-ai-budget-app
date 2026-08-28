import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const root = new URL("../apps/hearth-capture-extension/", import.meta.url);
const read = (name: string) => readFileSync(new URL(name, root), "utf8");

describe("7shifts browser companion", () => {
  it("has exact origin and least permissions", () => {
    const manifest = JSON.parse(read("manifest.json"));
    expect(manifest.host_permissions).toEqual(["https://app.7shifts.com/*", "https://hearth-books.jonathan-beaulne123.workers.dev/work/evidence/capability-upload"]);
    expect(manifest.permissions).toEqual(["activeTab", "scripting", "storage"]);
    expect(JSON.stringify(manifest)).not.toMatch(/cookies|webRequest|<all_urls>|history|clipboard/);
    expect(manifest.content_scripts[0].all_frames).toBe(false);
  });

  it("requires explicit enablement, top-frame scope, bounds captures, and strips credentials", () => {
    const content = read("content.js");
    const popup = read("popup.js");
    const bridge = read("page-bridge.js");
    expect(content).toContain("if (!enabled");
    expect(content).toContain("window.top !== window");
    expect(content).toMatch(/authorization\|cookie\|password/);
    expect(content).toMatch(/csrf\|secret\|jwt/);
    expect(popup).toContain("HEARTH_CAPTURE_ENABLE");
    expect(popup).toContain("app\\.7shifts\\.com");
    expect(bridge).not.toMatch(/request\.headers|document\.cookie|localStorage|sessionStorage/);
    expect(bridge).toContain("2 * 1024 * 1024");
    const service = read("service-worker.js");
    expect(service).toContain("Evidence ${evidenceCapability}");
    expect(service).toContain('remove(["evidenceCapability", "pendingEvidence"])');
  });
});
