import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const root = new URL("../apps/hearth-capture-extension/", import.meta.url);
const read = (name: string) => readFileSync(new URL(name, root), "utf8");

function captureSafety() {
  const context: Record<string, unknown> = { URL };
  runInNewContext(read("capture-safety.js"), context);
  return context.HearthCaptureSafety as {
    classify7shiftsPath(value: string): string | null;
    sanitizeVisibleResponsePayload(value: unknown): Record<string, unknown> | null;
  };
}

describe("7shifts browser companion", () => {
  it("has exact origin and least permissions", () => {
    const manifest = JSON.parse(read("manifest.json"));
    expect(manifest.host_permissions).toEqual(["https://app.7shifts.com/*", "https://hearth-books.jonathan-beaulne123.workers.dev/work/evidence/capability-upload"]);
    expect(manifest.permissions).toEqual(["activeTab", "scripting", "storage"]);
    expect(JSON.stringify(manifest)).not.toMatch(/cookies|webRequest|<all_urls>|history|clipboard/);
    expect(manifest.content_scripts[0].all_frames).toBe(false);
    expect(manifest.content_scripts[0].js).toEqual(["capture-safety.js", "content.js"]);
  });

  it("requires explicit enablement, top-frame scope, bounds captures, and strips credentials", () => {
    const content = read("content.js");
    const popup = read("popup.js");
    const bridge = read("page-bridge.js");
    expect(content).toContain("if (!enabled");
    expect(content).toContain("window.top !== window");
    expect(content).toContain("sanitizeVisibleResponsePayload");
    expect(popup).toContain("HEARTH_CAPTURE_ENABLE");
    expect(popup).toContain("app\\.7shifts\\.com");
    expect(bridge).not.toMatch(/request\.headers|document\.cookie|localStorage|sessionStorage/);
    expect(bridge).toContain("2 * 1024 * 1024");
    const service = read("service-worker.js");
    expect(service).toContain("Evidence ${evidenceCapability}");
    expect(service).toContain('remove(["evidenceCapability", "pendingEvidence"])');
  });

  it("classifies only explicit employee-visible response paths", () => {
    const safety = captureSafety();
    expect(safety.classify7shiftsPath("https://app.7shifts.com/api/v2/company/4/employees")).toBe("roster");
    expect(safety.classify7shiftsPath("https://app.7shifts.com/api/v2/company/4/roles")).toBe("role-catalog");
    expect(safety.classify7shiftsPath("https://app.7shifts.com/api/v2/company/4/schedules")).toBe("published-schedule");
    expect(safety.classify7shiftsPath("https://app.7shifts.com/api/v2/company/4/time_punches")).toBe("punch");
    expect(safety.classify7shiftsPath("https://app.7shifts.com/api/v2/company/4/employees/77/time_punches")).toBe("punch");
    expect(safety.classify7shiftsPath("https://app.7shifts.com/api/v2/company/4/employees/77/shifts")).toBe("published-schedule");
    expect(safety.classify7shiftsPath("https://app.7shifts.com/oauth/token")).toBeNull();
    expect(safety.classify7shiftsPath("https://example.test/api/employees")).toBeNull();
  });

  it("parses and strips credentials inside an intercepted JSON body", () => {
    const safety = captureSafety();
    const result = safety.sanitizeVisibleResponsePayload({
      captureClass: "roster",
      transport: "fetch",
      path: "/api/v2/company/4/employees",
      capturedAt: "2026-08-28T12:00:00.000Z",
      contentType: "application/json",
      body: JSON.stringify({ data: [{ id: 7, first_name: "Jonathan", last_name: "Beaulne", access_token: "secret", accessToken: "camel-secret", nested: { refreshToken: "nested-secret", cookie: "session=bad" } }] }),
    });
    expect(result).not.toBeNull();
    expect(result?.body).toEqual({ data: [{ id: 7, first_name: "Jonathan", last_name: "Beaulne", nested: {} }] });
    expect(JSON.stringify(result)).not.toMatch(/access_token|accessToken|refreshToken|session=bad|secret/);
  });

  it("rejects credential-shaped non-JSON and mismatched capture classes", () => {
    const safety = captureSafety();
    expect(safety.sanitizeVisibleResponsePayload({
      captureClass: "roster", path: "/api/employees", contentType: "text/csv", body: "name,authorization\nJonathan,Bearer abcdefghijklmnop",
    })).toBeNull();
    expect(safety.sanitizeVisibleResponsePayload({
      captureClass: "roster", path: "/api/employees", contentType: "text/csv", body: "name,accessToken\nJonathan,opaque-secret-value",
    })).toBeNull();
    expect(safety.sanitizeVisibleResponsePayload({
      captureClass: "punch", path: "/api/employees", contentType: "application/json", body: "{}",
    })).toBeNull();
  });
});
