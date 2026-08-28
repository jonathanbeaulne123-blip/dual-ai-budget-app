import { describe, expect, it } from "vitest";
import { decodeGmailRaw, sevenShiftsSender, SEVENSHIFTS_GMAIL_QUERY } from "../src/google/gmailSevenShifts.ts";

function base64Url(value: string): string {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

describe("direct Gmail 7shifts capture", () => {
  it("uses a fixed 7shifts-only Gmail query and accepts exact provider domains", () => {
    expect(SEVENSHIFTS_GMAIL_QUERY).toBe("from:(7shifts.com)");
    const raw = decodeGmailRaw(base64Url([
      "From: 7shifts <notifications@mailer.7shifts.com>",
      "To: member@example.test",
      "Subject: The schedule has been posted!",
      "", "Schedule body",
    ].join("\r\n")));
    expect(sevenShiftsSender(raw)).toBe("notifications@mailer.7shifts.com");
  });

  it("rejects lookalike domains and malformed raw payloads", () => {
    const lookalike = new TextEncoder().encode("From: alerts@7shifts.com.evil.test\r\n\r\nbody");
    expect(sevenShiftsSender(lookalike)).toBeNull();
    const deceptiveDisplay = new TextEncoder().encode("From: notifications@7shifts.com <alerts@evil.test>\r\n\r\nbody");
    expect(sevenShiftsSender(deceptiveDisplay)).toBeNull();
    expect(() => decodeGmailRaw("not raw mail!!!")).toThrow(/invalid raw/i);
  });
});
