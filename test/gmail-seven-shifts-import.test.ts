import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  googleFetch: vi.fn(),
  uploadEvidence: vi.fn(),
  withGoogle: vi.fn(),
}));

vi.mock("../src/google/engine.ts", () => ({
  withGoogle: mocks.withGoogle,
}));

vi.mock("../src/imports/evidenceClient.ts", () => ({
  uploadEvidence: mocks.uploadEvidence,
}));

import { importSevenShiftsFromGmail } from "../src/google/gmailSevenShifts.ts";

function base64Url(value: string): string {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const scope = { environment: "development" as const, householdId: "HH-TEST", memberId: "MEM-001" };

describe("Gmail 7shifts importer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.withGoogle.mockImplementation(async (input: any) => input.fn({
      session: { accessToken: "short-lived-google-token" },
      fetch: mocks.googleFetch,
    }));
  });

  it("paginates the fixed query, rejects non-7shifts From, and uploads only raw RFC822", async () => {
    const good = base64Url("From: 7shifts <notifications@7shifts.com>\r\n\r\nSchedule");
    const bad = base64Url("From: alerts@7shifts.com.evil.test\r\n\r\nNope");
    mocks.googleFetch.mockImplementation(async (_token: string, url: string) => {
      if (url.includes("/messages?") && !url.includes("pageToken")) return { messages: [{ id: "msg-good" }], nextPageToken: "next-page" };
      if (url.includes("/messages?") && url.includes("pageToken")) return { messages: [{ id: "msg-bad" }, { id: "msg-duplicate" }] };
      if (url.includes("msg-good")) return { id: "msg-good", raw: good };
      if (url.includes("msg-bad")) return { id: "msg-bad", raw: bad };
      if (url.includes("msg-duplicate")) return { id: "msg-duplicate", raw: good };
      throw new Error(`unexpected ${url}`);
    });
    mocks.uploadEvidence
      .mockResolvedValueOnce({ evidenceId: "evi_first_7shifts_message_0001", duplicate: false })
      .mockResolvedValueOnce({ evidenceId: "evi_first_7shifts_message_0001", duplicate: true });

    const result = await importSevenShiftsFromGmail({ scope, after: "2024/01/01", limit: 10 });
    expect(result).toMatchObject({ discovered: 3, inspected: 3, imported: 1, duplicates: 1, rejected: 1, truncated: false });
    expect(mocks.withGoogle).toHaveBeenCalledWith(expect.objectContaining({ services: ["identity", "gmail"] }));
    const firstListUrl = mocks.googleFetch.mock.calls[0]?.[1] as string;
    expect(new URL(firstListUrl).searchParams.get("q")).toBe("from:(7shifts.com) after:2024/01/01");
    expect(mocks.uploadEvidence).toHaveBeenCalledTimes(2);
    expect(mocks.uploadEvidence).toHaveBeenCalledWith(scope, expect.any(Uint8Array), {
      captureKind: "gmail-7shifts-email",
      contentType: "message/rfc822",
    }, undefined);
    expect(JSON.stringify(mocks.uploadEvidence.mock.calls)).not.toContain("short-lived-google-token");
  });

  it("cancels before Gmail or Evidence work when scope changes", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(importSevenShiftsFromGmail({ scope, signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
    expect(mocks.googleFetch).not.toHaveBeenCalled();
    expect(mocks.uploadEvidence).not.toHaveBeenCalled();
  });
});
